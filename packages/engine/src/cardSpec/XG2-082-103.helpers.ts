/**
 * cardSpec XG2-082〜XG2-103（クロスギャザー ザ・ドラゴンタイガー 電子星獣ドル〜サイドマシーン。XG2-091・094 は指揮官でカタログにない）用ヘルパー。
 * XG2-062-081.helpers.ts（RK1〜RK16・RM1〜RM3・BK1・XG2-001〜081 のヘルパーを含む）をそのまま再エクスポートし、
 * ライドしたまま盤面に置くユニットを足したもの（チェイスの乗り換え先は RM2 の chaseTargets を使う）。
 * 公開 API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardInstance } from "../types/game";
import { inst } from "./XG2-062-081.helpers";

export * from "./XG2-062-081.helpers";

/** vehicleId のビークルにライドした状態のユニット（ビークルは同じエリアに別に置く）。 */
export function ridingOn(cardId: string, suffix: string, vehicleId: string): CardInstance {
  return { ...inst(cardId, suffix), mountedOnInstanceId: vehicleId };
}
