/**
 * cardSpec RK-085〜RK-105（ザ・マスクドライダーEXP vol.2 ガードベント〜仮面ライダーアギトSF）用ヘルパー。
 * RK4-064-084.helpers.ts（RK1〜RK3 のヘルパーを含む）をそのまま再エクスポートし、ターン終了・カテゴリ用の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { unitEffectiveCategories } from "../core/catalog";
import type { GameState, PlayerId } from "../types/game";
import { act, legal, settle } from "./RK4-064-084.helpers";

export * from "./RK4-064-084.helpers";

/** ユニットの今のカテゴリ（バトルエリア・ラッシュエリア。効果で追加されたものを含む）。 */
export function categoriesOf(s: GameState, playerId: PlayerId, instanceId: string): string[] {
  const p = s.players[playerId];
  const inBattle = p.battle.find((c) => c.instanceId === instanceId);
  const c = inBattle ?? p.rush.find((x) => x.instanceId === instanceId);
  if (!c) throw new Error(`no unit ${instanceId}`);
  return [...unitEffectiveCategories(s, playerId, c, inBattle ? "battle" : "rush")].sort();
}

/**
 * 今のアクティブプレイヤーのターンを終える方向に進める（反応はパス、フェイズ終了を繰り返す）。
 * sourceCardId の選択が開いたらそこで止める。ターンが相手に移ったら止める。
 * （03-helpers の settle と違い、任意の選択を自動で見送らない。）
 */
export function toTurnEnd(s: GameState, sourceCardId?: string, maxSteps = 12): GameState {
  let n = settle(s);
  const who = n.activePlayer;
  for (let i = 0; i < maxSteps; i++) {
    if (sourceCardId && n.pendingEffectChoice?.sourceCardId === sourceCardId) return n;
    if (n.activePlayer !== who) return n;
    const end = legal(n).find((a) => a.type === "end_phase" && a.playerId === who);
    if (!end) return n;
    n = settle(act(n, end));
  }
  return n;
}
