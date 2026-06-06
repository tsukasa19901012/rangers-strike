import type { Category } from "@rangers-strike/cards";
import { getCardEffect, hasDestroySelfDamageNote, winButDestroyedVsSp1 } from "@rangers-strike/cards";
import type {
  GameState,
  PendingBattle,
  PendingLeave,
  PendingRush,
  PendingStrike,
  PlayerId,
} from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  canPlayOperation,
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { buildLogEntry } from "../log/formatLog";
import { finishBattleEntryIf } from "./battleEntry";
import {
  attackerBlocksDefenderCounters,
  battleAttackerBpBonus,
  battleDefenderBp,
  resolveFocusedBreakthroughDamage,
} from "./namedUnitEffects";
import { findCardOwner } from "./fieldLookup";
import { canStrikeUnit } from "./combo";
import { opponentInfiniteChainBlocks } from "./turnModifiers";
import {
  resolveLegend2OnDestroy,
} from "./legend2/destroyEffects";
import { resolveLegend3OnBattleWin } from "./legend3/destroyEffects";
import { shouldMedicalRescueToPower } from "./legend2/fieldEffects";

function isEnemyTurn(state: GameState, counterPlayerId: PlayerId): boolean {
  return state.activePlayer !== counterPlayerId;
}

function categoriesInclude(
  categories: Category | Category[],
  target: Category,
): boolean {
  const list = Array.isArray(categories) ? categories : [categories];
  return list.includes(target);
}

function isWildBeastUnit(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || def.type !== "unit") return false;
  return categoriesInclude(def.category, "WB");
}

/** RS-052 超シールド進化 — WB味方を撃破する代わりにシールドを捨てる。 */
export function findSuperShieldSubstitute(
  state: GameState,
  intent: LeaveIntent,
): string | undefined {
  if (intent.toZone !== "discard") return undefined;
  if (!isWildBeastUnit(state.definitions, intent.leavingCardId)) return undefined;

  const shield = state.players[intent.ownerPlayerId].battle.find(
    (card) => card.cardId === "RS-052" && card.instanceId !== intent.instanceId,
  );
  return shield?.instanceId;
}

export function applySuperShieldSubstitute(
  state: GameState,
  ownerId: PlayerId,
  shieldInstanceId: string,
): { state: GameState; log: string } {
  const owner = state.players[ownerId];
  const found = findInZone(owner, "battle", shieldInstanceId);
  if (!found) {
    return {
      state,
      log: buildLogEntry(ownerId, "named_effect", "RS-052", state.definitions, "super_shield_failed"),
    };
  }

  const [, battle] = removeAt(owner.battle, found.index);
  const nextOwner = {
    ...owner,
    battle,
    discard: [...owner.discard, found.card],
  };

  return {
    state: { ...state, ...updatePlayer(state, ownerId, nextOwner) },
    log: buildLogEntry(ownerId, "named_effect", "RS-052", state.definitions, "super_shield"),
  };
}

export function canPlayHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return false;

  const effect = getCardEffect(found.card.cardId);
  if (effect?.kind !== "counter") return false;

  const definition = getDefinition(state.definitions, found.card.cardId);
  if (!definition) return false;

  return canPlayOperation(player, state.definitions, definition);
}

function discardHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; cardId: string } | null {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return null;

  const [, hand] = removeAt(player.hand, found.index);
  const nextPlayer = {
    ...player,
    hand,
    discard: [...player.discard, found.card],
  };

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    cardId: found.card.cardId,
  };
}

export function hasBattleCounterReactions(
  state: GameState,
  defenderId: PlayerId,
  defenderInstanceId: string,
  attackerPlayerId?: PlayerId,
  attackerInstanceId?: string,
): boolean {
  if (
    attackerPlayerId &&
    attackerInstanceId &&
    attackerBlocksDefenderCounters(state, attackerPlayerId, attackerInstanceId)
  ) {
    return false;
  }

  if (!isEnemyTurn(state, defenderId)) return false;
  if (opponentInfiniteChainBlocks(state, defenderId)) return false;

  const defender = state.players[defenderId];
  const defenderCard = findInZone(defender, "battle", defenderInstanceId)?.card;
  if (!defenderCard) return false;

  for (const card of defender.hand) {
    if (!canPlayHandCounter(state, defenderId, card.instanceId)) continue;
    const effectId = getCardEffect(card.cardId)?.effectId;
    if (effectId === "new_gymnastics" && isSmallUnit(state.definitions, defenderCard.cardId)) {
      return true;
    }
    if (effectId === "hidden_ninja") return true;
  }

  return false;
}

export function hasRushCounterReactions(
  state: GameState,
  defenderId: PlayerId,
  rushedInstanceId: string,
  rusherId: PlayerId,
): boolean {
  if (!isEnemyTurn(state, defenderId)) return false;
  if (opponentInfiniteChainBlocks(state, defenderId)) return false;

  const rusher = state.players[rusherId];
  const rushed = findInZone(rusher, "rush", rushedInstanceId)?.card;
  if (!rushed) return false;
  if (effectiveBp(state, rusherId, rushed) > 8000) return false;

  const defender = state.players[defenderId];
  for (const card of defender.hand) {
    if (card.cardId !== "RS-026") continue;
    if (canPlayHandCounter(state, defenderId, card.instanceId)) return true;
  }

  return false;
}

export function canPlayDinoGutsLeaveCounter(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  counterInstanceId: string,
  options?: { requireEnemyTurn?: boolean },
): boolean {
  if (options?.requireEnemyTurn !== false && !isEnemyTurn(state, ownerId)) return false;

  const found = findInZone(state.players[ownerId], "hand", counterInstanceId);
  if (!found || found.card.cardId !== "RS-027") return false;
  if (!canPlayHandCounter(state, ownerId, counterInstanceId)) return false;

  const leavingDef = getDefinition(state.definitions, leavingCardId);
  const drawCost = parsePowerCost(leavingDef?.powerCost ?? 0);
  return state.players[ownerId].deck.length >= drawCost;
}

export function hasPlayableDinoChronicleCounter(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
  options?: { requireEnemyTurn?: boolean },
): boolean {
  if (options?.requireEnemyTurn !== false && !isEnemyTurn(state, ownerId)) return false;

  const owner = state.players[ownerId];
  const sameNameInDiscard = owner.discard.some(
    (c) => cardName(state.definitions, c.cardId) === cardName(state.definitions, leavingCardId),
  );
  if (!sameNameInDiscard) return false;

  for (const card of owner.hand) {
    if (card.cardId !== "RS-016") continue;
    if (canPlayHandCounter(state, ownerId, card.instanceId)) return true;
  }

  return false;
}

export function hasDinoChronicleLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  return hasPlayableDinoChronicleCounter(state, ownerId, leavingCardId);
}

export function hasDinoGutsLeaveReaction(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  const owner = state.players[ownerId];
  for (const card of owner.hand) {
    if (card.cardId !== "RS-027") continue;
    if (canPlayDinoGutsLeaveCounter(state, ownerId, leavingCardId, card.instanceId)) {
      return true;
    }
  }
  return false;
}

/** @deprecated hasDinoChronicleLeaveReaction を使用 */
export function hasLeaveCounterReactions(
  state: GameState,
  ownerId: PlayerId,
  leavingCardId: string,
): boolean {
  return hasDinoChronicleLeaveReaction(state, ownerId, leavingCardId);
}

export function collectHiddenNinjaSubstitutes(
  state: GameState,
  excludeInstanceIds: string[],
): Array<{ playerId: PlayerId; instanceId: string }> {
  const excluded = new Set(excludeInstanceIds);
  const results: Array<{ playerId: PlayerId; instanceId: string }> = [];
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const card of [...player.rush, ...player.battle]) {
      if (excluded.has(card.instanceId)) continue;
      results.push({ playerId: pid, instanceId: card.instanceId });
    }
  }
  return results;
}

export function applyNewGymnasticsCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "failed"),
    };
  }

  let nextState = discarded.state;
  const defender = nextState.players[defenderId];
  const found = findInZone(defender, "battle", pending.defenderInstanceId);
  if (!found || !isSmallUnit(nextState.definitions, found.card.cardId)) {
    return {
      state: nextState,
      log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "failed"),
    };
  }

  const [, battle] = removeAt(defender.battle, found.index);
  const nextDefender = {
    ...defender,
    battle,
    rush: [...defender.rush, found.card],
  };

  nextState = {
    ...nextState,
    ...updatePlayer(nextState, defenderId, nextDefender),
  };

  return {
    state: nextState,
    log: buildLogEntry(defenderId, "play_counter", "RS-006", state.definitions, "new_gymnastics"),
  };
}

export function applyHiddenNinjaCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  substituteInstanceId: string,
  pending: PendingBattle,
): { state: GameState; pending: PendingBattle; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      pending,
      log: buildLogEntry(defenderId, "play_counter", "RS-018", state.definitions, "failed"),
    };
  }

  const located = findCardOwner(discarded.state, substituteInstanceId);
  if (!located) {
    return {
      state: discarded.state,
      pending,
      log: buildLogEntry(defenderId, "play_counter", "RS-018", state.definitions, "failed"),
    };
  }

  return {
    state: discarded.state,
    pending: { ...pending, substituteInstanceId },
    log: buildLogEntry(
      defenderId,
      "play_counter",
      "RS-018",
      discarded.state.definitions,
      substituteInstanceId,
    ),
  };
}

export function applyShippuNinjaCounter(
  state: GameState,
  defenderId: PlayerId,
  counterInstanceId: string,
  pending: PendingRush,
): { state: GameState; log: string } {
  const discarded = discardHandCounter(state, defenderId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "failed"),
    };
  }

  const rusher = discarded.state.players[pending.rusherPlayerId];
  const found = findInZone(rusher, "rush", pending.rushedInstanceId);
  if (!found) {
    return {
      state: discarded.state,
      log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "failed"),
    };
  }

  const [, rush] = removeAt(rusher.rush, found.index);
  const nextRusher = {
    ...rusher,
    rush,
    deck: [{ ...found.card, faceDown: true }, ...rusher.deck],
  };

  return {
    state: {
      ...discarded.state,
      ...updatePlayer(discarded.state, pending.rusherPlayerId, nextRusher),
    },
    log: buildLogEntry(defenderId, "play_counter", "RS-026", state.definitions, "shippu_ninja"),
  };
}

export function applyDinoGutsCounter(
  state: GameState,
  ownerId: PlayerId,
  counterInstanceId: string,
  leavingCardId: string,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, ownerId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(ownerId, "play_counter", "RS-027", state.definitions, "failed"),
      prevented: false,
    };
  }

  const leavingDef = getDefinition(discarded.state.definitions, leavingCardId);
  const drawCost = parsePowerCost(leavingDef?.powerCost ?? 0);
  const owner = discarded.state.players[ownerId];
  const drawn = owner.deck.slice(0, drawCost);
  const restDeck = owner.deck.slice(drawCost);
  const nextOwner = {
    ...owner,
    deck: restDeck,
    discard: [...owner.discard, ...drawn],
  };

  return {
    state: { ...discarded.state, ...updatePlayer(discarded.state, ownerId, nextOwner) },
    log: buildLogEntry(
      ownerId,
      "play_counter",
      "RS-027",
      discarded.state.definitions,
      `dino_guts:${drawCost}`,
    ),
    prevented: true,
  };
}

export function applyDinoChronicleCounter(
  state: GameState,
  ownerId: PlayerId,
  counterInstanceId: string,
): { state: GameState; log: string; prevented: boolean } {
  const discarded = discardHandCounter(state, ownerId, counterInstanceId);
  if (!discarded) {
    return {
      state,
      log: buildLogEntry(ownerId, "play_counter", "RS-016", state.definitions, "failed"),
      prevented: false,
    };
  }

  return {
    state: discarded.state,
    log: buildLogEntry(ownerId, "play_counter", "RS-016", state.definitions, "dino_chronicle"),
    prevented: true,
  };
}

export function resolveBattlePending(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const finish = (nextState: GameState, log: string) => ({
    state: finishBattleEntryIf(nextState, pending.attackerInstanceId),
    log,
  });

  if (pending.battleCancelled) {
    const attacker = state.players[pending.attackerPlayerId];
    const nextAttacker = {
      ...attacker,
      battle: attacker.battle.map((c) =>
        c.instanceId === pending.attackerInstanceId ? { ...c, battleActed: true } : c,
      ),
    };
    return finish(
      {
        ...state,
        pendingBattle: undefined,
        activePlayer: pending.phasePlayerId,
        ...updatePlayer(state, pending.attackerPlayerId, nextAttacker),
      },
      buildLogEntry(
        pending.attackerPlayerId,
        "battle",
        pending.attackerInstanceId,
        state.definitions,
        "cancelled",
      ),
    );
  }

  const attackerId = pending.attackerPlayerId;
  const defenderId = pending.defenderPlayerId;
  const attacker = state.players[attackerId];
  const defenderInstanceId = pending.substituteInstanceId ?? pending.defenderInstanceId;

  let defenderOwner = defenderId;
  let defenderZone: "rush" | "battle" = "battle";
  if (pending.substituteInstanceId) {
    const located = findCardOwner(state, pending.substituteInstanceId);
    if (located) {
      defenderOwner = located.playerId;
      defenderZone = located.zone;
    }
  } else if (
    findInZone(state.players[defenderId], "rush", pending.defenderInstanceId)
  ) {
    defenderZone = "rush";
  }

  const defenderPlayer = state.players[defenderOwner];
  const attackerFound = findInZone(attacker, "battle", pending.attackerInstanceId);
  const defenderFound = findInZone(defenderPlayer, defenderZone, defenderInstanceId);

  if (!attackerFound || !defenderFound) {
    const markAttackerActedOnFail = (base: GameState): GameState => {
      if (!attackerFound) return base;
      const currentAttacker = base.players[attackerId];
      return {
        ...base,
        ...updatePlayer(base, attackerId, {
          ...currentAttacker,
          battle: currentAttacker.battle.map((c) =>
            c.instanceId === pending.attackerInstanceId ? { ...c, battleActed: true } : c,
          ),
        }),
      };
    };
    const logCardId = attackerFound?.card.cardId ?? pending.attackerInstanceId;
    return finish(
      markAttackerActedOnFail({
        ...state,
        pendingBattle: undefined,
        activePlayer: pending.phasePlayerId,
      }),
      buildLogEntry(attackerId, "battle", logCardId, state.definitions, "failed"),
    );
  }

  const attackerBp = battleAttackerBpBonus(state, pending);
  const defenderBp = battleDefenderBp(state, pending);

  const destroyAttacker = attackerBp <= defenderBp;
  const destroyDefender = defenderBp <= attackerBp;

  const winButSelfDestruct =
    !destroyAttacker &&
    destroyDefender &&
    state.activePlayer !== attackerId &&
    winButDestroyedVsSp1(attackerFound.card.cardId) &&
    canStrikeUnit(state.definitions, defenderFound.card, state, defenderOwner);

  const finalDestroyAttacker = destroyAttacker || winButSelfDestruct;
  const detail = `${cardName(state.definitions, defenderFound.card.cardId)}:${attackerBp}vs${defenderBp}`;
  const log = buildLogEntry(attackerId, "battle", attackerFound.card.cardId, state.definitions, detail);

  const markAttackerActed = (base: GameState): GameState => {
    const currentAttacker = base.players[attackerId];
    return {
      ...base,
      ...updatePlayer(base, attackerId, {
        ...currentAttacker,
        battle: currentAttacker.battle.map((c) =>
          c.instanceId === pending.attackerInstanceId ? { ...c, battleActed: true } : c,
        ),
      }),
    };
  };

  const attackerLeaveIntent: LeaveIntent = {
    ownerPlayerId: attackerId,
    instanceId: pending.attackerInstanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: attackerFound.card.cardId,
    phasePlayerId: pending.phasePlayerId,
  };

  let nextState = state;
  let extraLogs: string[] = [];

  if (destroyDefender) {
    const leaveResult = tryLeaveField(nextState, {
      ownerPlayerId: defenderOwner,
      instanceId: defenderInstanceId,
      fromZone: defenderZone,
      toZone: "discard",
      leavingCardId: defenderFound.card.cardId,
      phasePlayerId: pending.phasePlayerId,
      followUpAttackerLeave: finalDestroyAttacker ? attackerLeaveIntent : undefined,
    });
    if (leaveResult.deferred) {
      const withAttacker = finalDestroyAttacker ? leaveResult.state : markAttackerActed(leaveResult.state);
      return finish({ ...withAttacker, pendingBattle: undefined }, log);
    }
    nextState = leaveResult.state;

    if (canStrikeUnit(state.definitions, defenderFound.card, state, defenderOwner)) {
      const fb = resolveFocusedBreakthroughDamage(
        nextState,
        attackerId,
        defenderFound.card.cardId,
      );
      nextState = fb.state;
      extraLogs = fb.logs;
    }
  }

  if (finalDestroyAttacker) {
    const leaveResult = tryLeaveField(nextState, attackerLeaveIntent);
    if (leaveResult.deferred) {
      return finish({ ...leaveResult.state, pendingBattle: undefined }, log);
    }
    nextState = leaveResult.state;
  } else if (destroyDefender) {
    const winFx = resolveLegend3OnBattleWin(
      nextState,
      pending,
      defenderFound.card,
      defenderOwner,
    );
    nextState = {
      ...winFx.state,
      log: [...nextState.log, ...winFx.logs, ...extraLogs],
    };
    extraLogs = [];
    if (!winFx.skipMarkAttackerActed) {
      nextState = markAttackerActed(nextState);
    }
  } else {
    nextState = markAttackerActed(nextState);
  }

  let finishedState: GameState = {
    ...nextState,
    log: [...nextState.log, ...extraLogs],
    pendingBattle: undefined,
    activePlayer: pending.phasePlayerId,
  };
  if (pending.mirageBeamDiscard) {
    const player = finishedState.players[pending.attackerPlayerId];
    finishedState = {
      ...finishedState,
      ...updatePlayer(finishedState, pending.attackerPlayerId, {
        ...player,
        discard: [...player.discard, pending.mirageBeamDiscard],
      }),
    };
  }

  return finish(finishedState, log);
}

export function finalizeBattlePending(
  state: GameState,
  pending: PendingBattle,
): GameState {
  return resolveBattlePending(state, pending).state;
}

export function finalizeRushPending(state: GameState, pending: PendingRush): GameState {
  return {
    ...state,
    pendingRush: undefined,
    activePlayer: pending.phasePlayerId,
  };
}

export function finalizeLeavePending(
  state: GameState,
  pending: PendingLeave,
  prevented: boolean,
): GameState {
  if (prevented) {
    return {
      ...state,
      pendingLeave: undefined,
      activePlayer: pending.phasePlayerId,
    };
  }

  const owner = state.players[pending.ownerPlayerId];
  const found = findInZone(owner, pending.fromZone, pending.instanceId);
  if (!found) {
    return {
      ...state,
      pendingLeave: undefined,
      activePlayer: pending.phasePlayerId,
    };
  }

  const [, fromCards] = removeAt(owner[pending.fromZone], found.index);
  let nextOwner: typeof owner;

  if (pending.toZone === "command") {
    if (owner.command.length < COMMAND_ZONE_MAX) {
      nextOwner = {
        ...owner,
        [pending.fromZone]: fromCards,
        command: [...owner.command, { ...found.card, commandHeld: true }],
      };
    } else {
      nextOwner = {
        ...owner,
        [pending.fromZone]: fromCards,
        discard: [...owner.discard, found.card],
      };
    }
  } else if (
    pending.toZone === "discard" &&
    shouldMedicalRescueToPower(state, pending.ownerPlayerId, found.card.cardId)
  ) {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      power: [...owner.power, { ...found.card, faceDown: false }],
    };
  } else if (pending.toZone === "discard") {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      discard: [...owner.discard, found.card],
    };
  } else {
    nextOwner = {
      ...owner,
      [pending.fromZone]: fromCards,
      power: [...owner.power, { ...found.card, faceDown: false }],
    };
  }

  let nextStateBase = {
    ...state,
    pendingLeave: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, pending.ownerPlayerId, nextOwner),
  };

  const wentToDiscard =
    pending.toZone === "discard" ||
    (pending.toZone === "command" && owner.command.length >= COMMAND_ZONE_MAX);

  if (wentToDiscard) {
    const destroyFx = resolveLegend2OnDestroy(
      nextStateBase,
      pending.ownerPlayerId,
      found.card.cardId,
    );
    nextStateBase = {
      ...nextStateBase,
      ...destroyFx.state,
      pendingLeave: undefined,
      log: [...nextStateBase.log, ...destroyFx.logs],
    };
  }

  if (pending.toZone === "discard" && hasDestroySelfDamageNote(found.card.cardId)) {
    return applyDamageToPlayer(nextStateBase, pending.ownerPlayerId, 1, {
      kind: "none",
      activePlayer: nextStateBase.activePlayer,
    });
  }

  return nextStateBase;
}

export function getCounterEffectId(state: GameState, playerId: PlayerId, instanceId: string): string | undefined {
  const found = findInZone(state.players[playerId], "hand", instanceId);
  if (!found) return undefined;
  return getCardEffect(found.card.cardId)?.effectId;
}

export type LeaveIntent = PendingLeave;

export function finalizeLeaveReaction(
  state: GameState,
  pending: PendingLeave,
  prevented: boolean,
): GameState {
  let nextState = finalizeLeavePending(state, pending, prevented);

  if (prevented) {
    if (pending.resumePendingStrike && state.pendingStrike) {
      return {
        ...nextState,
        activePlayer: pending.phasePlayerId,
        pendingStrike: state.pendingStrike,
      };
    }
    return nextState;
  }

  if (pending.followUpAttackerLeave) {
    const followUp = tryLeaveField(nextState, {
      ...pending.followUpAttackerLeave,
      phasePlayerId: pending.followUpAttackerLeave.phasePlayerId,
    });
    if (followUp.deferred) return followUp.state;
    nextState = followUp.state;
  }

  return nextState;
}

export function tryLeaveField(
  state: GameState,
  intent: LeaveIntent,
): { state: GameState; deferred: boolean } {
  const superShieldInstanceId = findSuperShieldSubstitute(state, intent);
  const dinoChronicle = hasDinoChronicleLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
  );
  const dinoGuts = hasDinoGutsLeaveReaction(
    state,
    intent.ownerPlayerId,
    intent.leavingCardId,
  );

  if (!dinoChronicle && !dinoGuts && !superShieldInstanceId) {
    return { state: finalizeLeavePending(state, intent, false), deferred: false };
  }

  return {
    state: {
      ...state,
      pendingLeave: {
        ...intent,
        superShieldInstanceId,
      },
      activePlayer: intent.ownerPlayerId,
    },
    deferred: true,
  };
}

export function tryDestroyStrikerForStrike(
  state: GameState,
  pending: PendingStrike,
  damageCancelled: boolean,
): { state: GameState; deferred: boolean } {
  const strikerPlayerId = pending.strikerPlayerId;
  const strikerPlayer = state.players[strikerPlayerId];
  const found = findInZone(strikerPlayer, "battle", pending.strikerInstanceId);
  if (!found) return { state, deferred: false };

  const defenderId = opponent(strikerPlayerId);
  const leaveResult = tryLeaveField(state, {
    ownerPlayerId: strikerPlayerId,
    instanceId: pending.strikerInstanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: found.card.cardId,
    phasePlayerId: defenderId,
    resumePendingStrike: { damageCancelled },
  });
  if (leaveResult.deferred) {
    return {
      state: { ...leaveResult.state, pendingStrike: pending },
      deferred: true,
    };
  }
  return { state: leaveResult.state, deferred: false };
}
