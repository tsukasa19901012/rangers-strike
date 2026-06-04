import type { GameState, PendingStrike, PlayerId, PlayerState } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  hasOperationEffect,
  isSmallUnit,
} from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { applyDamageToPlayer } from "./damagePayment";
import { buildLogEntry } from "../log/formatLog";
import { tryDestroyStrikerForStrike } from "./operationCounters";

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
  if (!hasOperationEffect(defender, "five_tech", state.definitions)) return [];

  return defender.rush
    .filter((card) => isSmallUnit(state.definitions, card.cardId))
    .map((card) => card.instanceId);
}

export function canPlayPlasmaEnergyCounter(
  state: GameState,
  defenderId: PlayerId,
): boolean {
  return hasOperationEffect(
    state.players[defenderId],
    "plasma_energy",
    state.definitions,
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

  if (!player.command.some((c) => c.commandHeld)) {
    return { state };
  }

  const nextPlayer = releaseOneHeldCommand(player);
  const log = buildLogEntry(
    playerId,
    "courage_magic",
    "RS-029",
    state.definitions,
  );

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
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
  const nextStrikerPlayer = {
    ...strikerPlayer,
    battle,
    discard: [...strikerPlayer.discard, found.card],
  };

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

  const [, rush] = removeAt(defender.rush, interceptFound.index);
  let nextDefender = {
    ...defender,
    rush,
    battle: [...defender.battle, interceptFound.card],
  };

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

  if (strikerBp <= interceptorBp) {
    const destroyResult = destroyStrikerOrDeferLeave(nextState, pending, true);
    nextState = destroyResult.state;
    nextPending.damageCancelled = true;
    if (destroyResult.deferred) {
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

export function finalizeStrike(
  state: GameState,
  pending: PendingStrike,
): GameState {
  const defenderId = opponent(pending.strikerPlayerId);

  if (!pending.damageCancelled && pending.damage > 0) {
    const withDamage = applyDamageToPlayer(state, defenderId, pending.damage, {
      kind: "strike",
      pending,
    });
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
