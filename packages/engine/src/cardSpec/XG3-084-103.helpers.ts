/**
 * cardSpec XG3-084〜XG3-103（クロスギャザー ザ・Wインパクト 大甲神カブテリオス〜ライジンゴー）用ヘルパー。
 * XG3-063-083.helpers.ts をそのまま再エクスポートし、マルチカテゴリのユニットのラッシュに使うコマンドの並びを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardInstance } from "../types/game";
import { releasedCat } from "./XG3-063-083.helpers";

export * from "./XG3-063-083.helpers";

/** カテゴリごとにリリース状態のコマンドを1つずつ（マルチカテゴリのユニットをラッシュするため）。 */
export function cmds(...cats: Array<"WB" | "MA" | "OT" | "ET" | "DA">): CardInstance[] {
  return cats.flatMap((c) => releasedCat(c, 1));
}
