/**
 * cardSpec PR-001〜PR-014（プロモーションカード ボウケンレッド〜ダークナイト）用ヘルパー。
 * XP-017-032.helpers.ts（RS・RK・RM・BK・XP のヘルパーの連なりを含む）をそのまま再エクスポートし、小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { act, drain, settle, strike } from "./XP-017-032.helpers";

export * from "./XP-017-032.helpers";

/** instanceId でストライクして、相手が受けたダメージの点数を返す。 */
export function strikeDmg(s: GameState, instanceId: string, playerId: PlayerId = "player1"): number {
  const enemy: PlayerId = playerId === "player1" ? "player2" : "player1";
  const before = s.players[enemy].damage;
  return settle(strike(s, instanceId, playerId)).players[enemy].damage - before;
}

/** 手番のプレイヤーがフェイズを終え、ターンを終えるときの選択が開けば、その持ち主が先頭の候補を選び続ける。 */
export function endWithChoices(s: GameState): GameState {
  let next = act(s, { type: "end_phase", playerId: s.activePlayer });
  for (let i = 0; i < 6 && next.pendingEffectChoice; i++) {
    const before = next;
    next = drain(next, next.pendingEffectChoice.playerId);
    if (next === before) break;
  }
  return next;
}
