import { findNamedEffectByEffectId, getCardEffect } from "@rangers-strike/cards";
import { openEffectChoice } from "./pendingChoices";
import type { GameState, PendingStrike, PlayerId, PlayerState } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
} from "../core/catalog";
import { playerHasOperationGrantKeyword } from "../dsl/operationKeywords";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { isBloodVesselStrikeActive } from "../keywords/battleKeywords";
import {
  restoreMountedVehicleIfMistakenlyDiscarded,
  sanitizeUnitLeavingField,
} from "../keywords/ride";
import { buildLogEntry } from "../log/formatLog";
import {
  autoHoldForBattleEntry,
  canMoveUnitToBattleWithHolds,
  clearEffectBattleEntryWindows,
} from "./restrictions";
import { tryDestroyStrikerForStrike, tryLeaveField } from "./operationCounters";

export function earthForceActive(state: GameState): boolean {
  return (
    hasOperationEffect(state.players.player1, "earth_force", state.definitions) ||
    hasOperationEffect(state.players.player2, "earth_force", state.definitions)
  );
}

export function collectFiveTechInterceptors(
  state: GameState,
  defenderId: PlayerId,
): string[] {
  const defender = state.players[defenderId];
  if (
    !playerHasOperationGrantKeyword(state, defenderId, "strike_intercept_with_s_unit") &&
    !hasOperationEffect(defender, "five_tech", state.definitions)
  ) {
    return [];
  }

  // ルール: R-BA-03 — 効果で出す場合も「出る制限」は出る直前に判定する。
  // ルール: R-ADD-07 — ハリケンレオン等の「ホールドしなければ出られない」はホールドできなければ出せない（RS-014 Q2）。
  return defender.rush
    .filter((card) => isSmallUnit(state.definitions, card.cardId))
    .filter((card) => canMoveUnitToBattleWithHolds(state, defenderId, card))
    .map((card) => card.instanceId);
}

export function canPlayPlasmaEnergyCounter(
  state: GameState,
  defenderId: PlayerId,
): boolean {
  return (
    playerHasOperationGrantKeyword(
      state,
      defenderId,
      "destroy_striker_on_strike_self_discard",
    ) ||
    hasOperationEffect(state.players[defenderId], "plasma_energy", state.definitions)
  );
}

export function applyPlasmaEnergyCounter(
  state: GameState,
  defenderId: PlayerId,
  strikerPlayerId: PlayerId,
  strikerInstanceId: string,
): { state: GameState; log: string } {
  const strikerPlayer = state.players[strikerPlayerId];
  const strikerFound = findInZone(strikerPlayer, "battle", strikerInstanceId);
  if (!strikerFound) {
    return {
      state,
      log: buildLogEntry(defenderId, "plasma_energy", "RS-067", state.definitions, "failed"),
    };
  }

  const pending: PendingStrike = state.pendingStrike ?? {
    strikerPlayerId,
    strikerInstanceId,
    damage: 0,
    battlePhasePlayer: strikerPlayerId,
  };
  const destroyResult = destroyStrikerOrDeferLeave(state, pending, false);
  if (destroyResult.deferred) {
    return {
      state: { ...destroyResult.state, pendingStrike: pending },
      log: buildLogEntry(
        defenderId,
        "plasma_energy",
        "RS-067",
        state.definitions,
        cardName(state.definitions, strikerFound.card.cardId),
      ),
    };
  }

  const defender = state.players[defenderId];
  const opFound = defender.operation.find((c) => c.cardId === "RS-067");
  let nextState = destroyResult.state;
  if (opFound) {
    const opIndex = defender.operation.findIndex((c) => c.instanceId === opFound.instanceId);
    const [, operation] = removeAt(defender.operation, opIndex);
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, defenderId, {
        ...nextState.players[defenderId],
        operation,
        discard: [...nextState.players[defenderId].discard, opFound],
      }),
    };
  }

  return {
    state: nextState,
    log: buildLogEntry(
      defenderId,
      "plasma_energy",
      "RS-067",
      state.definitions,
      cardName(state.definitions, strikerFound.card.cardId),
    ),
  };
}

export function hasStrikeReactions(
  state: GameState,
  defenderId: PlayerId,
): boolean {
  if (collectFiveTechInterceptors(state, defenderId).length > 0) return true;
  if (canPlayPlasmaEnergyCounter(state, defenderId)) return true;

  return false;
}

export function releaseOneHeldCommand(player: PlayerState): PlayerState {
  const command = player.command.map((card) => ({ ...card }));
  const index = command.findIndex((card) => card.commandHeld);
  if (index < 0) return player;
  command[index] = { ...command[index]!, commandHeld: false };
  return { ...player, command };
}

/**
 * RS-029【勇気の魔法】「自軍Sユニットがバトルエリアに出るたびに、自軍コマンドを1つリリースしてもよい」。
 * 任意効果なので、ホールド状態の自軍コマンドから1つ選ぶ（または選ばない）選択を開く（出典: atwiki/page-245）。
 */
export function applyCourageMagicRelease(
  state: GameState,
  playerId: PlayerId,
  unitCardId: string,
): { state: GameState; log?: string } {
  if (!isSmallUnit(state.definitions, unitCardId)) {
    return { state };
  }

  const player = state.players[playerId];
  if (!hasOperationEffect(player, "courage_magic", state.definitions)) {
    return { state };
  }
  if (state.pendingEffectChoice) return { state };

  const heldIds = player.command.filter((c) => c.commandHeld).map((c) => c.instanceId);
  if (heldIds.length === 0) {
    return { state };
  }
  const source = player.operation.find(
    (c) => getCardEffect(c.cardId)?.effectId === "courage_magic",
  );

  const log = buildLogEntry(
    playerId,
    "courage_magic",
    source?.cardId ?? "RS-029",
    state.definitions,
  );

  return {
    state: openEffectChoice(state, {
      playerId,
      effectId: "courage_magic",
      sourceCardId: source?.cardId ?? "RS-029",
      sourceInstanceId: source?.instanceId,
      phasePlayerId: state.activePlayer,
      kind: "select_command",
      validInstanceIds: heldIds,
      selectCount: 1,
      commandAction: "release",
      optional: true,
    }),
    log,
  };
}

function destroyStriker(
  state: GameState,
  strikerPlayerId: PlayerId,
  strikerInstanceId: string,
): GameState {
  const strikerPlayer = state.players[strikerPlayerId];
  const found = findInZone(strikerPlayer, "battle", strikerInstanceId);
  if (!found) return state;

  const [, battle] = removeAt(strikerPlayer.battle, found.index);
  const leavingCard = sanitizeUnitLeavingField(found.card, "battle", "discard");
  let nextStrikerPlayer = {
    ...strikerPlayer,
    battle,
    discard: [...strikerPlayer.discard, leavingCard],
  };
  nextStrikerPlayer = restoreMountedVehicleIfMistakenlyDiscarded(
    nextStrikerPlayer,
    found.card,
    "battle",
  );

  return { ...state, ...updatePlayer(state, strikerPlayerId, nextStrikerPlayer) };
}

function destroyStrikerOrDeferLeave(
  state: GameState,
  pending: PendingStrike,
  damageCancelled: boolean,
): { state: GameState; deferred: boolean } {
  const deferred = tryDestroyStrikerForStrike(state, pending, damageCancelled);
  if (deferred.deferred) return deferred;
  return {
    state: destroyStriker(state, pending.strikerPlayerId, pending.strikerInstanceId),
    deferred: false,
  };
}

export function applyFiveTechIntercept(
  state: GameState,
  defenderId: PlayerId,
  pending: PendingStrike,
  interceptInstanceId: string,
): { state: GameState; pending: PendingStrike; log: string } {
  const defender = state.players[defenderId];
  const interceptFound = findInZone(defender, "rush", interceptInstanceId);
  if (!interceptFound || !isSmallUnit(state.definitions, interceptFound.card.cardId)) {
    return {
      state,
      pending,
      log: buildLogEntry(defenderId, "five_tech", "RS-014", state.definitions, "failed"),
    };
  }

  const strikerPlayer = state.players[pending.strikerPlayerId];
  const strikerFound = findInZone(strikerPlayer, "battle", pending.strikerInstanceId);
  if (!strikerFound) {
    return { state, pending, log: buildSimpleFiveTechLog(defenderId, interceptFound.card.cardId, state, "failed") };
  }

  // 「ホールドしなければ出られない」制限の分のコマンドをホールドしてから出す（RS-014 Q2・RS-097 Q7）。
  const held = autoHoldForBattleEntry(state, defenderId, interceptFound.card);
  if (!held) {
    return { state, pending, log: buildSimpleFiveTechLog(defenderId, interceptFound.card.cardId, state, "failed") };
  }
  const [, rush] = removeAt(held.rush, interceptFound.index);
  let nextDefender = clearEffectBattleEntryWindows(
    {
      ...held,
      rush,
      battle: [...held.battle, interceptFound.card],
    },
  );

  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, defenderId, nextDefender),
  };

  const interceptorBp = effectiveBp(nextState, defenderId, interceptFound.card);
  const strikerBp = effectiveBp(nextState, pending.strikerPlayerId, strikerFound.card);
  let nextPending = { ...pending };
  const log = buildLogEntry(
    defenderId,
    "five_tech",
    "RS-014",
    state.definitions,
    `${cardName(state.definitions, interceptFound.card.cardId)}:${interceptorBp}vs${strikerBp}`,
  );

  // ルール: R-STK-05 — ファイブテクターで出したユニットとバトルになり、敵軍のストライクは（勝敗に関わらず）無効になる。
  nextPending.damageCancelled = true;
  if (strikerBp <= interceptorBp) {
    const destroyResult = destroyStrikerOrDeferLeave(nextState, pending, true);
    nextState = destroyResult.state;
    if (destroyResult.deferred) {
      return {
        state: { ...nextState, pendingStrike: pending },
        pending: nextPending,
        log,
      };
    }
  }
  if (interceptorBp <= strikerBp) {
    // BP の低い（同じ）ファイブテクターのユニットはバトルで撃破される（R-BP-02: BP0 でも先にバトルになる）。
    const left = tryLeaveField(nextState, {
      ownerPlayerId: defenderId,
      instanceId: interceptFound.card.instanceId,
      fromZone: "battle",
      toZone: "discard",
      leavingCardId: interceptFound.card.cardId,
      phasePlayerId: pending.battlePhasePlayer,
      registerEligible: true,
      resumePendingStrike: { damageCancelled: true },
    });
    nextState = left.state;
    if (left.deferred) {
      return {
        state: { ...nextState, pendingStrike: pending },
        pending: nextPending,
        log,
      };
    }
  }

  return { state: nextState, pending: nextPending, log };
}

function buildSimpleFiveTechLog(
  playerId: PlayerId,
  cardId: string,
  state: GameState,
  detail: string,
): string {
  return buildLogEntry(playerId, "five_tech", "RS-014", state.definitions, detail);
}

function sideKnuckleChoosingPlayer(
  state: GameState,
  pending: PendingStrike,
): PlayerId | undefined {
  const striker = findInZone(
    state.players[pending.strikerPlayerId],
    "battle",
    pending.strikerInstanceId,
  );
  if (!striker || !findNamedEffectByEffectId(striker.card.cardId, "side_knuckle")) {
    return undefined;
  }
  return pending.strikerPlayerId;
}

export function finalizeStrike(
  state: GameState,
  pending: PendingStrike,
): GameState {
  const defenderId = opponent(pending.strikerPlayerId);

  if (!pending.damageCancelled && pending.damage > 0 && !pending.damageApplied) {
    const withDamage = applyDamageToPlayer(
      state,
      defenderId,
      pending.damage,
      {
        kind: "strike",
        pending,
      },
      sideKnuckleChoosingPlayer(state, pending),
      {
        bloodVesselPreferMorph: isBloodVesselStrikeActive(
          state,
          pending.strikerPlayerId,
        ),
      },
    );
    if (withDamage.pendingDamagePayment) {
      return { ...withDamage, pendingStrike: pending };
    }
    return {
      ...withDamage,
      pendingStrike: undefined,
      activePlayer: pending.battlePhasePlayer,
    };
  }

  return {
    ...state,
    pendingStrike: undefined,
    activePlayer: pending.battlePhasePlayer,
  };
}
