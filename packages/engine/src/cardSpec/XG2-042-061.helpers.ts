/**
 * cardSpec XG2-042〜XG2-061（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーディケイドCF〜リョクオオザル）用ヘルパー。
 * XG2-021-041.helpers.ts（RK1〜RK16・RM1〜RM3・BK1・XG2-001〜041 のヘルパーを含む）をそのまま再エクスポートし、
 * モーフを起こすための敵軍のラッシュと、ライドオフ（RC）の小さな手順を足したもの。
 * 公開 API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { enemyRushes, inst, p1Battle, rcRideOff, sUnit } from "./XG2-021-041.helpers";

export * from "./XG2-021-041.helpers";

/** モーフを起こすために敵軍がラッシュする S ユニット（WB・必要パワー0）。 */
export const MORPH_RUSHER = sUnit("SPEC-MORPH-RUSHER", { bp: 1000, powerCost: 0 });

/** 敵軍（player2）が MORPH_RUSHER を通常のラッシュで出す。player1 のモーフの選択が開いたところで止まる。 */
export function morphRush(p1: Partial<GameState["players"]["player1"]>, extra: CardDefinition[] = []): GameState {
  return enemyRushes(p1, "SPEC-MORPH-RUSHER:e", [MORPH_RUSHER, ...extra]);
}

/**
 * 自軍バトルフェイズに、rider（RC を持つユニット）を自軍ラッシュエリアの RS-466 ギンガレオンにライドさせて出し、ライドオフする（RC の選択は残す）。
 * ギンガレオンの本文「特徴「レッド」を持つSユニットは…RCを持っていなくてもこのビークルにライドできる」— RC を持つユニットはそのままライドできる。
 */
export function rcBoard(
  riderId: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = riderId.split(":") as [string, string];
  const s = p1Battle({ ...p1, rush: [inst(cid, suf), inst("RS-466", "rcv"), ...(p1.rush ?? [])] }, p2, extra);
  return rcRideOff(s, riderId, "RS-466:rcv");
}

/** ウラ向きのカード。 */
export function faceDownCard(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), faceDown: true };
}
