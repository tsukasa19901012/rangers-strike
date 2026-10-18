/**
 * cardSpec RK-148〜RK-168（ザ・マスクドライダーEXP vol.2 デンライナーレッコウ〜仮面ライダー電王CF）用ヘルパー。
 * RK7-127-147.helpers.ts（RK1〜RK6 のヘルパーを含む）をそのまま再エクスポートし、スタートフェイズの戻し・ターンの終わりを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, legal } from "./RK7-127-147.helpers";

export * from "./RK7-127-147.helpers";

/** スタートフェイズに、バトルエリアのユニットをラッシュエリアに戻す（戻すときの選択は開いたまま）。 */
export function returnAll(s: GameState, playerId: PlayerId = "player1"): GameState {
  const ret = legal(s).find((a) => a.type === "return_all_battle_to_rush" && a.playerId === playerId && !("instanceId" in a && a.instanceId));
  if (!ret) throw new Error(`no return_all_battle_to_rush; legal=${legal(s).map((a) => a.type).join(",")}`);
  return act(s, ret);
}

/** フェイズ終了を、手番が相手に移るか選択が開くまで繰り返す（ターンを終えるときの選択は開いたまま）。 */
export function endTurnKeep(s: GameState): GameState {
  let next = s;
  const start = next.activePlayer;
  for (let i = 0; i < 10 && next.activePlayer === start && !next.pendingEffectChoice; i++) {
    const end = legal(next).find((a) => a.type === "end_phase");
    if (!end) break;
    next = act(next, end);
  }
  return next;
}

/** オモテ向きのカード（パワーゾーン用）。 */
export function faceUp(cardId: string, suf: string): CardInstance {
  return { instanceId: `${cardId}:${suf}`, cardId, faceDown: false };
}

/** ウラ向きのカード（ダメージ）。 */
export function faceDown(cardId: string, suf: string): CardInstance {
  return { instanceId: `${cardId}:${suf}`, cardId, faceDown: true };
}

/** ビークルとそれにライドしたユニット。 */
export function riding(vehicle: CardInstance, rider: CardInstance): CardInstance[] {
  return [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];
}

/** ※モーフの規定文（rulesSpec/07-helpers.ts KW.morph と同じ。atwiki/page-1294）。 */
export const KW_MORPH =
  "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";
