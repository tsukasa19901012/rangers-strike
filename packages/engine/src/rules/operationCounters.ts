import type { Category } from "@rangers-strike/cards";
import { getCardEffect, winButDestroyedVsSp1 } from "@rangers-strike/cards";
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
  allCategoriesExistInCommandZone,
  canPlayOperationExceptCommandHold,
  cardCategories,
  cardName,
  effectiveBp,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  hasReleasedCommandForCategories,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { countReleasedCommands } from "./restrictions";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { emitUnitLeftZoneAndResolve } from "../events/emitUnitLeftZone";
import { isCostWindowSatisfied } from "../core/costWindow";
import { buildLogEntry } from "../log/formatLog";
import { finishBattleEntryIf, restorePhaseActivePlayerUnlessBlocked } from "./battleEntry";
import {
  attackerBlocksDefenderCounters,
  battleAttackerBpBonus,
  battleDefenderBp,
  resolveFocusedBreakthroughDamage,
} from "./namedUnitEffects";
import { findCardOwner } from "./fieldLookup";
import { canOfferRegister, toPendingRegister } from "./resist";
import { canStrikeUnit } from "./combo";
import { opponentInfiniteChainBlocks } from "./turnModifiers";
import { resolveLegend3OnBattleWin } from "./legend3/destroyEffects";
import { shouldMedicalRescueToPower } from "./legend2/fieldEffects";
import { emitBattleDeclaredAndResolve } from "../events/emitBattleDeclared";
import { buildPendingChaseFromIntent, buildPendingChaseOnVehicleDestroyed, canInitiateChase } from "../keywords";
import { findFieldInstanceByKeyword } from "../dsl/fieldKeywords";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { registerBattlePendingResolver } from "../events/listeners/battleDeclaredListener";

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

/** 超シールド進化 — WB味方を撃破する代わりにシールドを捨てる。 */
export function findSuperShieldSubstitute(
  state: GameState,
  intent: LeaveIntent,
): string | undefined {
  if (intent.toZone !== "discard") return undefined;
  if (!isWildBeastUnit(state.definitions, intent.leavingCardId)) return undefined;

  return findFieldInstanceByKeyword(
    state,
    intent.ownerPlayerId,
    "substitute_on_wb_destroy",
    ["battle"],
    intent.instanceId,
  );
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
    log: buildLogEntry(
      ownerId,
      "named_effect",
      found.card.cardId,
      state.definitions,
      "super_shield",
    ),
  };
}

export function isCounterReactionActive(state: GameState): boolean {
  return !!(state.pendingBattle || state.pendingRush || state.pendingLeave || state.pendingMorph);
}

export function isHandCounterCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const found = findInZone(state.players[playerId], "hand", instanceId);
  if (!found) return false;
  return getCardEffect(found.card.cardId)?.kind === "counter";
}

function counterDefinition(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
) {
  const player = state.players[playerId];
  const found = findInZone(player, "hand", instanceId);
  if (!found) return null;

  const effect = getCardEffect(found.card.cardId);
  if (effect?.kind !== "counter") return null;

  const definition = getDefinition(state.definitions, found.card.cardId);
  if (!definition) return null;

  return { player, found, definition };
}

export function canAffordCounterPower(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  return canPlayOperationExceptCommandHold(state, playerId, ctx.definition);
}

export function canPayCounterCategoryHold(
  player: GameState["players"][PlayerId],
  definitions: GameState["definitions"],
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;
  if (hasReleasedCommandForCategories(player, definitions, categories)) return true;
  return (
    hasOperationEffect(player, "prism_power", definitions) &&
    countReleasedCommands(player) >= 2
  );
}

export function canInitiateCounterCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  if (!isCounterReactionActive(state)) return false;

  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (!canPayCounterCategoryHold(ctx.player, state.definitions, categories)) {
    return false;
  }
  if (isCostWindowSatisfied(ctx.player, "counter_category")) return false;
  if (canExecuteHandCounter(state, playerId, instanceId)) return false;

  return canPayCounterCategoryHold(ctx.player, state.definitions, categories);
}

export function canExecuteHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (categories.length === 0) return true;

  return (
    isCostWindowSatisfied(ctx.player, "counter_category") &&
    hasHeldCommandForCategories(ctx.player, state.definitions, categories)
  );
}

/** 反応窓を開くかどうかの判定（窓が未成立でも使用可）。 */
export function canPlayHandCounter(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const ctx = counterDefinition(state, playerId, instanceId);
  if (!ctx) return false;
  if (!canPlayOperationExceptCommandHold(state, playerId, ctx.definition)) {
    return false;
  }

  const categories = cardCategories(ctx.definition);
  if (categories.length === 0) return true;
  if (canExecuteHandCounter(state, playerId, instanceId)) return true;
  return canPayCounterCategoryHold(ctx.player, state.definitions, categories);
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

/** Event Listener から呼ばれるバトル解決の実装本体。 */
export function resolveBattlePendingCore(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const finish = (nextState: GameState, log: string) => ({
    state: finishBattleEntryIf(
      restorePhaseActivePlayerUnlessBlocked(
        { ...nextState, pendingBattle: undefined },
        pending.phasePlayerId,
      ),
      pending.attackerInstanceId,
    ),
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
  let battleState = state;
  const attacker = battleState.players[attackerId];
  const defenderInstanceId = pending.substituteInstanceId ?? pending.defenderInstanceId;

  let defenderOwner = defenderId;
  let defenderZone: "rush" | "battle" = "battle";
  if (pending.substituteInstanceId) {
    const located = findCardOwner(battleState, pending.substituteInstanceId);
    if (located) {
      defenderOwner = located.playerId;
      defenderZone = located.zone;
    }
  } else if (
    findInZone(battleState.players[defenderId], "rush", pending.defenderInstanceId)
  ) {
    defenderZone = "rush";
  }

  const defenderPlayer = battleState.players[defenderOwner];
  const attackerFound = findInZone(attacker, "battle", pending.attackerInstanceId);
  const defenderFound = findInZone(defenderPlayer, defenderZone, defenderInstanceId);

  if (attackerFound) {
    battleState = tryResolveDslTriggeredEffects({
      state: battleState,
      cardId: attackerFound.card.cardId,
      instanceId: pending.attackerInstanceId,
      playerId: attackerId,
      phasePlayerId: pending.phasePlayerId,
      triggerType: "on_attack",
    }).state;
  }

  const refreshedAttacker = battleState.players[attackerId];
  const refreshedAttackerFound = findInZone(
    refreshedAttacker,
    "battle",
    pending.attackerInstanceId,
  );
  const refreshedDefenderPlayer = battleState.players[defenderOwner];
  const refreshedDefenderFound = findInZone(
    refreshedDefenderPlayer,
    defenderZone,
    defenderInstanceId,
  );

  if (!refreshedAttackerFound || !refreshedDefenderFound) {
    const markAttackerActedOnFail = (base: GameState): GameState => {
      if (!refreshedAttackerFound) return base;
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
    const logCardId = refreshedAttackerFound?.card.cardId ?? pending.attackerInstanceId;
    return finish(
      markAttackerActedOnFail({ ...battleState }),
      buildLogEntry(attackerId, "battle", logCardId, battleState.definitions, "failed"),
    );
  }

  const attackerBp = battleAttackerBpBonus(battleState, pending);
  const defenderBp = battleDefenderBp(battleState, pending);

  const destroyAttacker = attackerBp <= defenderBp;
  const destroyDefender = defenderBp <= attackerBp;

  const winButSelfDestruct =
    !destroyAttacker &&
    destroyDefender &&
    battleState.activePlayer !== attackerId &&
    winButDestroyedVsSp1(refreshedAttackerFound.card.cardId) &&
    canStrikeUnit(battleState.definitions, refreshedDefenderFound.card, battleState, defenderOwner);

  const finalDestroyAttacker = destroyAttacker || winButSelfDestruct;
  const detail = `${cardName(battleState.definitions, refreshedDefenderFound.card.cardId)}:${attackerBp}vs${defenderBp}`;
  const log = buildLogEntry(
    attackerId,
    "battle",
    refreshedAttackerFound.card.cardId,
    battleState.definitions,
    detail,
  );

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
    leavingCardId: refreshedAttackerFound.card.cardId,
    phasePlayerId: pending.phasePlayerId,
  };

  let nextState = battleState;
  let extraLogs: string[] = [];

  if (destroyDefender) {
    const leaveResult = tryLeaveField(nextState, {
      ownerPlayerId: defenderOwner,
      instanceId: defenderInstanceId,
      fromZone: defenderZone,
      toZone: "discard",
      leavingCardId: refreshedDefenderFound.card.cardId,
      phasePlayerId: pending.phasePlayerId,
      followUpAttackerLeave: finalDestroyAttacker ? attackerLeaveIntent : undefined,
    });
    if (leaveResult.deferred) {
      const withAttacker = finalDestroyAttacker ? leaveResult.state : markAttackerActed(leaveResult.state);
      return finish(withAttacker, log);
    }
    nextState = leaveResult.state;

    if (canStrikeUnit(battleState.definitions, refreshedDefenderFound.card, battleState, defenderOwner)) {
      const fb = resolveFocusedBreakthroughDamage(
        nextState,
        attackerId,
        refreshedDefenderFound.card.cardId,
      );
      nextState = fb.state;
      extraLogs = fb.logs;
    }
  }

  if (finalDestroyAttacker) {
    const leaveResult = tryLeaveField(nextState, attackerLeaveIntent);
    if (leaveResult.deferred) {
      return finish(leaveResult.state, log);
    }
    nextState = leaveResult.state;
  } else if (destroyDefender) {
    const winFx = resolveLegend3OnBattleWin(
      nextState,
      pending,
      refreshedDefenderFound.card,
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

registerBattlePendingResolver(resolveBattlePendingCore);

/** `BattleDeclared` イベント経由でバトルを解決する（後方互換 API）。 */
export function resolveBattlePending(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  return emitBattleDeclaredAndResolve(state, pending);
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

  if (canOfferRegister(state, pending)) {
    return {
      ...state,
      pendingRegister: toPendingRegister(pending),
      activePlayer: pending.ownerPlayerId,
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

  const effectiveToZone =
    pending.toZone === "command" && owner.command.length >= COMMAND_ZONE_MAX
      ? "discard"
      : pending.toZone;

  const leaveFx = emitUnitLeftZoneAndResolve(nextStateBase, {
    ownerPlayerId: pending.ownerPlayerId,
    instanceId: pending.instanceId,
    cardId: found.card.cardId,
    fromZone: pending.fromZone,
    toZone: effectiveToZone,
    phasePlayerId: pending.phasePlayerId,
  });

  return {
    ...leaveFx.state,
    log: [...leaveFx.state.log, ...leaveFx.logs],
  };
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
    const owner = state.players[intent.ownerPlayerId];
    const found = findInZone(owner, intent.fromZone, intent.instanceId);

    const vehicleChase = buildPendingChaseOnVehicleDestroyed(state, intent);
    if (vehicleChase) {
      return {
        state: {
          ...state,
          pendingChase: vehicleChase,
          activePlayer: intent.ownerPlayerId,
        },
        deferred: true,
      };
    }

    if (found && canInitiateChase(state, intent.ownerPlayerId, found.card)) {
      const pendingChase = buildPendingChaseFromIntent(state, intent);
      if (pendingChase) {
        return {
          state: {
            ...state,
            pendingChase,
            activePlayer: intent.ownerPlayerId,
          },
          deferred: true,
        };
      }
    }

    const next = finalizeLeavePending(state, intent, false);
    if (next.pendingRegister) {
      return { state: next, deferred: true };
    }
    return { state: next, deferred: false };
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
