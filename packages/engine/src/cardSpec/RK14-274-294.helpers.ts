/**
 * cardSpec RK-274〜RK-294（ザ・マスクドライダーEXP vol.4 ビートチェイサー〜仮面ライダーサソードMF）用ヘルパー。
 * RK13-253-273.helpers.ts（RK1〜RK12 のヘルパーを含む）をそのまま再エクスポートし、ダメージの支払いの候補などを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { legal, skip } from "./RK13-253-273.helpers";

export * from "./RK13-253-273.helpers";

/** ダメージの支払いで player が選べるパワーゾーンのカード（resolve_damage_payment の候補）。 */
export function damageChoices(s: GameState, playerId: PlayerId): string[] {
  return legal(s)
    .filter((a): a is Extract<typeof a, { type: "resolve_damage_payment" }> => a.type === "resolve_damage_payment" && a.playerId === playerId)
    .map((a) => a.instanceId)
    .sort();
}

/** sourceCardId の選択が開くまで、ほかの任意の選択を見送る（開かなければそのままの state）。 */
export function untilChoiceFrom(s: GameState, sourceCardId: string, maxSteps = 6): GameState {
  let next = s;
  for (let i = 0; i < maxSteps; i++) {
    const p = next.pendingEffectChoice;
    if (!p || p.sourceCardId === sourceCardId || !p.optional) return next;
    next = skip(next);
  }
  return next;
}
