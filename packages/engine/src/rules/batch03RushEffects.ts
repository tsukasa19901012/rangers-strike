import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { updatePlayer } from "../core/helpers";

function isUnriddenSVehicle(
  state: GameState,
  playerId: PlayerId,
  vehicleInstanceId: string,
): boolean {
  const player = state.players[playerId];
  const card = player.rush.find((c) => c.instanceId === vehicleInstanceId);
  if (!card) return false;
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "vehicle" || def.size !== "S") return false;
  return !player.rush.some(
    (c) =>
      c.mountedOnInstanceId === vehicleInstanceId &&
      c.instanceId !== vehicleInstanceId,
  );
}

/** RS-387 緊急車両誘導: 未ライドSビークルを持ち主山札下へ（CPUは見た順で自動）。 */
export function applyPinkRaiderVehicleReturn(
  state: GameState,
  phasePlayerId: PlayerId,
): GameState {
  let next = state;
  for (const ownerId of ["player1", "player2"] as const) {
    const player = next.players[ownerId];
    const toReturn = player.rush.filter((c) =>
      isUnriddenSVehicle(next, ownerId, c.instanceId),
    );
    if (toReturn.length === 0) continue;

    const returnIds = new Set(toReturn.map((c) => c.instanceId));
    const rush = player.rush.filter((c) => !returnIds.has(c.instanceId));
    const deck = [...player.deck, ...toReturn];
    next = {
      ...next,
      ...updatePlayer(next, ownerId, { ...player, rush, deck }),
    };
  }
  return next;
}

export function releaseHeldSUnitCommands(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  let changed = false;
  const command = player.command.map((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    if (def?.type === "unit" && def.size === "S" && c.commandHeld) {
      changed = true;
      return { ...c, commandHeld: false };
    }
    return c;
  });
  if (!changed) return state;
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}
