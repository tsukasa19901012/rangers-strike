import type { CardInstance, GameState, PlayerId, ZoneName } from "../types/game";

export type FieldZone = Extract<
  ZoneName,
  "hand" | "discard" | "power" | "command" | "rush" | "battle"
>;

const FIELD_ZONES: FieldZone[] = [
  "hand",
  "discard",
  "power",
  "command",
  "rush",
  "battle",
];

export function findCardOwner(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; zone: Extract<ZoneName, "rush" | "battle"> } | null {
  const located = findCardInField(state, instanceId);
  if (!located) return null;
  if (located.zone !== "rush" && located.zone !== "battle") return null;
  return { playerId: located.playerId, zone: located.zone };
}

export function findCardInField(
  state: GameState,
  instanceId: string,
): { playerId: PlayerId; zone: FieldZone; index: number; card: CardInstance } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of FIELD_ZONES) {
      const index = player[zone].findIndex((c) => c.instanceId === instanceId);
      if (index >= 0) {
        return { playerId, zone, index, card: player[zone][index]! };
      }
    }
  }
  return null;
}
