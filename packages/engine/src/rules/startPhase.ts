import { getCardEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { hasOperationEffect } from "../core/catalog";
import { removeAt, updatePlayer } from "../core/helpers";
import { startSelectPowerChoice } from "./pendingChoices";

/** Start phase: release all held commands. */
export function releaseAllCommands(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const command = player.command.map((c) =>
    c.commandHeld ? { ...c, commandHeld: false, mothershipHold: false } : c,
  );
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

/** Start phase: return battle units to rush (player chooses order — we preserve order). */
export function returnBattleToRush(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  if (player.battle.length === 0) return state;

  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      rush: [...player.rush, ...player.battle],
      battle: [],
    }),
  };
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
