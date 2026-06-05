import { findNamedEffectByEffectId, getCardEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { checkWinner } from "../core/createGame";
import { hasOperationEffect } from "../core/catalog";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry, buildSimpleLogEntry } from "../log/formatLog";
import { startSelectPowerChoice } from "./pendingChoices";
import { tryLegend3BattleToRush } from "./legend3/restrictions";

/** Start phase: release all held commands. */
export function releaseAllCommands(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const command = player.command.map((c) =>
    c.commandHeld ? { ...c, commandHeld: false, mothershipHold: false } : c,
  );
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

function collectBattleToRushEffectQueue(cards: CardInstance[]): string[] {
  return cards
    .filter((card) => findNamedEffectByEffectId(card.cardId, "falcon_claw"))
    .map((card) => card.instanceId);
}

/** Opens the next optional battle→rush effect after bulk start-phase return. */
export function continueBattleToRushEffectQueue(state: GameState): GameState {
  const queue = state.pendingBattleToRushQueue ?? [];
  const phasePlayerId = state.pendingBattleToRushPhasePlayerId;
  if (!phasePlayerId || queue.length === 0 || state.pendingEffectChoice) {
    if (queue.length === 0) {
      return {
        ...state,
        pendingBattleToRushQueue: undefined,
        pendingBattleToRushPhasePlayerId: undefined,
      };
    }
    return state;
  }

  const [nextId, ...rest] = queue;
  const owner = state.players[phasePlayerId];
  const card = owner.rush.find((c) => c.instanceId === nextId);
  if (!card) {
    return continueBattleToRushEffectQueue({
      ...state,
      pendingBattleToRushQueue: rest,
    });
  }

  const withChoice = tryLegend3BattleToRush(state, phasePlayerId, card, phasePlayerId);
  if (withChoice.pendingEffectChoice) {
    return { ...withChoice, pendingBattleToRushQueue: rest };
  }

  return continueBattleToRushEffectQueue({
    ...withChoice,
    pendingBattleToRushQueue: rest,
  });
}

/** Start phase: return all battle units to rush at once, then queue optional effects. */
export function returnAllBattleUnitsToRush(
  state: GameState,
  playerId: PlayerId,
): GameState | null {
  const player = state.players[playerId];
  if (player.battle.length === 0) return null;

  const movedCards = [...player.battle];
  const effectQueue = collectBattleToRushEffectQueue(movedCards);
  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: [],
      rush: [...player.rush, ...movedCards],
      hasReturnedBattleThisStart: true,
    }),
    pendingBattleToRushQueue: effectQueue.length > 0 ? effectQueue : undefined,
    pendingBattleToRushPhasePlayerId:
      effectQueue.length > 0 ? playerId : undefined,
  };

  if (effectQueue.length > 0) {
    nextState = continueBattleToRushEffectQueue(nextState);
  }

  return nextState;
}

export function initializeStartPhasePlayer(player: PlayerState): PlayerState {
  const hasHeld = player.command.some((c) => c.commandHeld);
  const hasBattle = player.battle.length > 0;
  return {
    ...player,
    hasDrawnThisStart: false,
    hasPaidEarthForceUpkeep: false,
    hasReleasedCommandsThisStart: !hasHeld,
    hasReturnedBattleThisStart: !hasBattle,
  };
}

export function hasCompletedStartPhaseSteps(player: PlayerState): boolean {
  return (
    player.hasReleasedCommandsThisStart === true &&
    player.hasReturnedBattleThisStart === true &&
    player.hasDrawnThisStart === true
  );
}

export function canReleaseStartCommands(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "start") return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  const player = state.players[playerId];
  if (player.hasReleasedCommandsThisStart) return false;
  return player.command.some((c) => c.commandHeld);
}

export function canReturnBattleAtStart(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "start") return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  const player = state.players[playerId];
  if (player.hasReturnedBattleThisStart) return false;
  return player.battle.length > 0;
}

export function canBonusDraw(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return (
    player.hasDrawnThisStart === true &&
    player.hand.length < player.damage &&
    player.deck.length > 0
  );
}

export function canAdvanceFromStartPhase(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (state.phase !== "start") return false;
  if (state.pendingEffectChoice?.playerId === playerId) return false;
  if (!hasCompletedStartPhaseSteps(player)) return false;
  if (
    mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId) &&
    canPayEarthForceUpkeep(state, playerId)
  ) {
    return false;
  }
  return true;
}

/** Auto-advance after mandatory steps; optional bonus draw may still be taken first. */
export function shouldAutoAdvanceFromStartPhase(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return canAdvanceFromStartPhase(state, playerId) && !canBonusDraw(state, playerId);
}

/** Moves from start to charge when {@link canAdvanceFromStartPhase} is satisfied. */
export function transitionStartToChargePhase(
  state: GameState,
  playerId: PlayerId,
): GameState | null {
  if (!canAdvanceFromStartPhase(state, playerId)) return null;

  let nextState = state;
  const logEntries: string[] = [];

  if (
    mustResolveEarthForceUpkeepBeforeStartEnd(state, playerId) &&
    !canPayEarthForceUpkeep(state, playerId)
  ) {
    const discarded = discardEarthForceForUnpaidUpkeep(nextState, playerId);
    nextState = discarded.state;
    logEntries.push(
      buildLogEntry(
        playerId,
        "earth_force_upkeep",
        "RS-022",
        state.definitions,
        "failed",
      ),
    );
  }

  const resetPlayer = {
    ...nextState.players[playerId],
    hasChargedThisTurn: false,
    hasDrawnThisStart: false,
    hasReleasedCommandsThisStart: false,
    hasReturnedBattleThisStart: false,
  };
  nextState = {
    ...nextState,
    ...updatePlayer(nextState, playerId, resetPlayer),
    phase: "charge",
  };
  logEntries.push(buildSimpleLogEntry(playerId, "end_phase", "start"));

  return {
    ...nextState,
    log: [...nextState.log, ...logEntries],
    winner: checkWinner(nextState),
  };
}

export type StartPhaseBattleUnit = {
  instanceId: string;
  cardId: string;
};

export type StartPhaseStatus = {
  releaseDone: boolean;
  returnDone: boolean;
  drawDone: boolean;
  canRelease: boolean;
  canReturn: boolean;
  canDraw: boolean;
  canBonusDraw: boolean;
  canAdvanceToCharge: boolean;
  heldCommandCount: number;
  battleUnitCount: number;
  battleUnits: StartPhaseBattleUnit[];
};

export function getStartPhaseStatus(
  state: GameState,
  playerId: PlayerId,
): StartPhaseStatus {
  const player = state.players[playerId];
  const effectBlocksStart =
    state.pendingEffectChoice?.playerId === playerId;
  return {
    releaseDone: player.hasReleasedCommandsThisStart === true,
    returnDone: player.hasReturnedBattleThisStart === true,
    drawDone: player.hasDrawnThisStart === true,
    canRelease: canReleaseStartCommands(state, playerId),
    canReturn: canReturnBattleAtStart(state, playerId),
    canDraw:
      state.phase === "start" &&
      !effectBlocksStart &&
      !player.hasDrawnThisStart,
    canBonusDraw: !effectBlocksStart && canBonusDraw(state, playerId),
    canAdvanceToCharge: canAdvanceFromStartPhase(state, playerId),
    heldCommandCount: player.command.filter((c) => c.commandHeld).length,
    battleUnitCount: player.battle.length,
    battleUnits: player.battle.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
    })),
  };
}

function countFaceUpPower(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].power.filter((c) => !c.faceDown).length;
}

export function hasOwnEarthForce(state: GameState, playerId: PlayerId): boolean {
  return hasOperationEffect(
    state.players[playerId],
    "earth_force",
    state.definitions,
  );
}

/** RS-022: upkeep is due after the mandatory draw until paid or the permanent leaves. */
export function needsEarthForceUpkeep(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (!player.hasDrawnThisStart) return false;
  if (player.hasPaidEarthForceUpkeep) return false;
  return hasOwnEarthForce(state, playerId);
}

export function canPayEarthForceUpkeep(state: GameState, playerId: PlayerId): boolean {
  return countFaceUpPower(state, playerId) >= 3;
}

export function mustResolveEarthForceUpkeepBeforeStartEnd(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return needsEarthForceUpkeep(state, playerId);
}

export function openEarthForceUpkeepChoiceIfNeeded(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!needsEarthForceUpkeep(state, playerId)) return state;
  if (!canPayEarthForceUpkeep(state, playerId)) return state;
  if (state.pendingEffectChoice) return state;

  const player = state.players[playerId];
  const earthForce = player.operation.find((c) => getCardEffect(c.cardId)?.effectId === "earth_force");
  if (!earthForce) return state;

  const next = startSelectPowerChoice(state, {
    playerId,
    effectId: "earth_force",
    sourceCardId: earthForce.cardId,
    sourceInstanceId: earthForce.instanceId,
    phasePlayerId: playerId,
    selectCount: 3,
    optional: false,
  });
  return next ?? state;
}

/** RS-022: discard the permanent when upkeep cannot be paid. */
export function discardEarthForceForUnpaidUpkeep(
  state: GameState,
  playerId: PlayerId,
): { state: GameState; discarded: boolean } {
  const player = state.players[playerId];
  const index = player.operation.findIndex(
    (c) => getCardEffect(c.cardId)?.effectId === "earth_force",
  );
  if (index < 0) return { state, discarded: false };

  const [card, withoutOp] = removeAt(player.operation, index);
  const nextPlayer = {
    ...player,
    operation: withoutOp,
    discard: [...player.discard, card],
  };

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    discarded: true,
  };
}
