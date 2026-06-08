import type { CardInstance, GameState, PlayerId, PlayerState, ZoneName } from "../types/game";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";

type FieldZone = "hand" | "rush" | "battle" | "command" | "power" | "discard" | "operation";

const FIELD_ZONES: FieldZone[] = [
  "hand",
  "rush",
  "battle",
  "command",
  "power",
  "discard",
  "operation",
];

/** 除外ゾーンへ移動（フレームワーク — カード効果から個別接続）。 */
export function moveToExile(
  state: GameState,
  playerId: PlayerId,
  fromZone: FieldZone,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, fromZone, instanceId);
  if (!found) return state;

  const [, rest] = removeAt(player[fromZone], found.index);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      [fromZone]: rest,
      exile: [...(player.exile ?? []), found.card],
    }),
  };
}

/** 除外ゾーンから指定ゾーンへ戻す。 */
export function moveFromExile(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  toZone: Exclude<ZoneName, "deck" | "exile" | "commander">,
): GameState {
  const player = state.players[playerId];
  const exile = player.exile ?? [];
  const index = exile.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return state;

  const [card, rest] = removeAt(exile, index);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      exile: rest,
      [toZone]: [...player[toZone], card],
    }),
  };
}

export function findInExile(
  player: PlayerState,
  instanceId: string,
): CardInstance | undefined {
  return (player.exile ?? []).find((c) => c.instanceId === instanceId);
}

export function findCardInAnyZone(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { zone: FieldZone | "exile"; card: CardInstance } | null {
  const player = state.players[playerId];
  for (const zone of FIELD_ZONES) {
    const found = findInZone(player, zone, instanceId);
    if (found) return { zone, card: found.card };
  }
  const exiled = findInExile(player, instanceId);
  if (exiled) return { zone: "exile", card: exiled };
  return null;
}
