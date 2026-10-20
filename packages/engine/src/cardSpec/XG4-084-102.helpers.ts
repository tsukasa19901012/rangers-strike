/**
 * cardSpec XG4-084〜XG4-102（仮面ライダー幽汽HF〜ケンローダー）用ヘルパー。
 * XG4-064-083.helpers.ts（XG4-001〜083・BK1・RM・RK のヘルパーを含む）をそのまま再エクスポートし、
 * 盤面のユニットの BP を短く読む関数を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState } from "../types/game";
import { bpOf } from "./XG4-064-083.helpers";

export * from "./XG4-064-083.helpers";

/** player1・player2 それぞれのユニットの今の BP（instanceId の一覧の順）。 */
export function bpsOf(s: GameState, playerId: "player1" | "player2", ids: string[]): number[] {
  return ids.map((id) => bpOf(s, playerId, id));
}
