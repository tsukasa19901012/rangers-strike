/**
 * cardSpec RK-064〜RK-084（ザ・マスクドライダーEXP vol.1 仮面ライダーファイズ〜vol.2 トリックベント）用ヘルパー。
 * RK3-043-063.helpers.ts（RK1・RK2 のヘルパーを含む）をそのまま再エクスポートし、RC・常駐用の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, legal, mount, playOp, rideOff } from "./RK3-043-063.helpers";

export * from "./RK3-043-063.helpers";

/** RC を持たないビークル（RC のユニットだけがライドできる。BP の修正なし）。 */
export const PLAIN_VEHICLE = {
  id: "SPEC-VEHICLE",
  name: "SPEC-VEHICLE",
  type: "vehicle",
  category: "ET",
  rarity: "N",
  expansion: "card-spec",
  powerCost: 0,
  size: "S",
  features: ["メカ"],
} as unknown as CardDefinition;

/** rider を vehicle（ラッシュエリア）にライドさせてバトルエリアに出し、ライドオフする（RC の選択は残す）。 */
export function rcRideOff(s: GameState, rider: string, vehicle: string, playerId: PlayerId = "player1"): GameState {
  return rideOff(mount(s, rider, vehicle, playerId), true, playerId);
}

/** 手札のオペレーションを使う（失敗なら例外）。 */
export function played(s: GameState, id: string, playerId: PlayerId = "player1"): GameState {
  const r = playOp(s, playerId, id);
  expect(r.ok, r.error).toBe(true);
  return r.state;
}

/** 常駐オペレーションの起動（activate_resident_operation）。 */
export function activateResident(s: GameState, operationInstanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "activate_resident_operation", playerId, operationInstanceId });
}

/** 常駐置き場のカード（instanceId）に重なっているカードの instanceId。 */
export function stackedOn(s: GameState, playerId: PlayerId, operationInstanceId: string): string[] {
  const op = s.players[playerId].operation.find((c) => c.instanceId === operationInstanceId);
  return (op?.stackedCards ?? []).map((c) => c.instanceId);
}

/** 常駐オペレーション（重ねたカード付き）。 */
export function resident(cardId: string, suffix: string, stacked: CardInstance[] = []): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId, stackedCards: stacked };
}

/** 合法手に、指定の type・playerId のものがあるか。 */
export function offered(s: GameState, type: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === type && a.playerId === playerId);
}
