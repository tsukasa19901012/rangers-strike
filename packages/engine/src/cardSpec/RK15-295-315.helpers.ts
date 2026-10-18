/**
 * cardSpec RK-295〜RK-315（ザ・マスクドライダーEXP vol.4 仮面ライダーサソードRF〜仮面ライダーキバ飛翔態）用ヘルパー。
 * RK14-274-294.helpers.ts（RK1〜RK13 のヘルパーを含む）をそのまま再エクスポートし、複数の選択・相手の手番の進入を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { act, legal, pick } from "./RK14-274-294.helpers";

export * from "./RK14-274-294.helpers";

/** ids を順に選ぶ（resolve_effect_choice を続ける）。 */
export function pickAll(s: GameState, ids: string[]): GameState {
  return ids.reduce((next, id) => pick(next, id), s);
}

/** player の unit の、進入直後の行動（アタック・ストライク）の合法手。 */
export function unitActions(s: GameState, unit: string, playerId: PlayerId = "player2"): GameAction[] {
  return legal(s).filter(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "battle" && a.attackerInstanceId === unit) || (a.type === "strike" && a.instanceId === unit)),
  );
}

/** player2 が自軍バトルフェイズに unit をバトルエリアに出す。 */
export function enemyEnter(s: GameState, unit: string): GameState {
  return act(s, { type: "move_to_battle", playerId: "player2", instanceId: unit });
}
