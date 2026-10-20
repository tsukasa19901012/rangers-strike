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

/**
 * 除外ゾーンから指定ゾーンへ戻す操作。
 * ルール: R-ZONE-11 — 除外されたカードはそのゲーム中再びプレイに使えないため、常に何もしない。
 */
export function moveFromExile(
  state: GameState,
  _playerId: PlayerId,
  _instanceId: string,
  _toZone: Exclude<ZoneName, "deck" | "exile" | "commander">,
): GameState {
  return state;
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
