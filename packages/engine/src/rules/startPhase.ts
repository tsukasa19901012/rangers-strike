import { getCardEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
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

export function applyStartPhaseReset(state: GameState, playerId: PlayerId): GameState {
  let next = releaseAllCommands(state, playerId);
  next = returnBattleToRush(next, playerId);
  return next;
}

export function canBonusDraw(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return (
    player.hasDrawnThisStart === true &&
    player.hand.length < player.damage &&
    player.deck.length > 0
  );
}

export function mustDrawBeforeStartEnd(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  return !player.hasDrawnThisStart;
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
