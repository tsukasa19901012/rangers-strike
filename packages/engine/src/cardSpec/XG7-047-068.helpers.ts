/**
 * cardSpec XG7-047〜XG7-068（クロスギャザー ザ・ベストパートナー 仮面ライダーオーズ・タカキリーター〜宇宙刑事シャリバン×ギャバン×シャイダー）用ヘルパー。
 * XG7-024-046.helpers.ts（XG7-001-023・BK・RM・RK・RS のヘルパーを含む）をそのまま再エクスポートし、※モーフ の共通テストなどを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { expect } from "vitest";
import { type Gaps, DEFS, deckCards, inst, morphCandidates, releasedCat, rushOpen, specIt, st, sUnit } from "./XG7-024-046.helpers";

export * from "./XG7-024-046.helpers";

/** リリース状態のコマンドとして置くカード。 */
export function released(id: string, suf: string): CardInstance {
  return { ...inst(id, suf), commandHeld: false };
}

/** 敵軍（player2）のラッシュフェイズに、player2 が手札の SPEC-MORPH-RUSHER を通常の手段でラッシュした直後（反応は開いたまま）。 */
export function enemyRushedFromHand(p1: Partial<GameState["players"]["player1"]>, extra: CardDefinition[] = [], p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  const RUSHER = sUnit("SPEC-MORPH-RUSHER", { category: "WB", bp: 1000, powerCost: 0, features: ["男"] });
  const s = st(
    {
      phase: "rush",
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { hand: [inst(RUSHER.id, "h")], command: releasedCat("WB", 1, "ew"), deck: deckCards(5, "e"), ...p2 },
    },
    [RUSHER, ...extra],
  );
  return rushOpen(s, "player2", `${RUSHER.id}:h`);
}

/** ※モーフ の共通テスト（R-KW-MORPH-01・02）。特徴が完全一致する自軍コマンドゾーンのユニットカードと置き換えられ、特徴が1つ足りないものは選べない。 */
export function morphTests(id: string, page: string, gaps: Gaps = {}): void {
  const features = DEFS[id]!.features ?? [];
  const SAME = sUnit(`SPEC-MORPH-SAME-${id}`, { category: "WB", bp: 1000, powerCost: 3, features: [...features] });
  const LESS = sUnit(`SPEC-MORPH-LESS-${id}`, { category: "WB", bp: 1000, powerCost: 3, features: features.slice(0, -1) });
  specIt(
    id,
    `${id}: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカードと置き換えられる（特徴が1つ足りないものは選べない）（出典: ${page}「※モーフ」・rules/07-keywords R-KW-MORPH-01）`,
    () => {
      const s = enemyRushedFromHand({ battle: [inst(id, "me")], command: [released(SAME.id, "same"), released(LESS.id, "less")] }, [SAME, LESS]);
      expect(morphCandidates(s)).toEqual([`${SAME.id}:same`]);
    },
    gaps.morph,
  );
}
