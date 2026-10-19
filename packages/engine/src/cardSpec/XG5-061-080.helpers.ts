/**
 * cardSpec XG5-061〜XG5-080（クロスギャザー XG5 ザ・チケットブレイカー バッファローアンデッド〜マシンディケイダー）用ヘルパー。
 * XG5-041-060.helpers.ts（RS・RK・RM・BK と XG5-001〜060 のヘルパーを含む）をそのまま再エクスポートし、
 * 「ラッシュエリアに出すかわりに捨札にして」の手順と、ライドオフ（RC）までの手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { GameState } from "../types/game";
import { accept, mount, rideOff, rushFromHand, settle } from "./XG5-041-060.helpers";

export * from "./XG5-041-060.helpers";

/**
 * 自軍ラッシュフェイズに手札の id をラッシュし、「ラッシュエリアに出すかわりに捨札にして…発動できる」の確認が開いていれば発動を選ぶ。
 * 確認が開かなければ（エンジンが選ばせなければ）そのまま返す。
 */
export function rushedInstead(s: GameState, instanceId: string): GameState {
  const r = rushFromHand(s, "player1", instanceId);
  expect(r.ok, r.error).toBe(true);
  const cardId = instanceId.split(":")[0];
  let n = r.state;
  if (n.pendingEffectChoice?.sourceCardId === cardId && n.pendingEffectChoice?.kind === "confirm") n = accept(n);
  return n;
}

/** 自軍バトルフェイズに rider を vehicle にライドさせて出し、ライドオフする（RC の選択は残す）。 */
export function rcOff(s: GameState, rider: string, vehicle: string): GameState {
  return settle(rideOff(mount(s, rider, vehicle), true));
}
