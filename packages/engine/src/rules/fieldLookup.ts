import type { GameState, PlayerId, ZoneName } from "../types/game";

export function findCardOwner(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; zone: Extract<ZoneName, "rush" | "battle"> } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of ["rush", "battle"] as const) {
      if (player[zone].some((c) => c.instanceId === instanceId)) {
        return { playerId, zone };
      }
    }
  }
  return null;
}
