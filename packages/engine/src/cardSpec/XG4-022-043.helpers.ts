/**
 * cardSpec XG4-022〜XG4-043（クロスギャザー ザ・ジェットアクセル シュリケンジャー（XG4）〜ゴセイレッド）用ヘルパー。
 * XG4-001-021.helpers.ts（BK1・RM・RK のヘルパーを含む）をそのまま再エクスポートし、※モーフ・※タクスの共通テストを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  act,
  cardIn,
  deckCards,
  enemyRushes,
  inst,
  morphCandidates,
  pickAs,
  released,
  settle,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./XG4-001-021.helpers";

export * from "./XG4-001-021.helpers";

/** 敵軍（player2）が手札からラッシュする必要パワー0・WB の S ユニット（モーフの引き金）。 */
export const MORPH_RUSHER = sUnit("SPEC-MORPH-RUSHER", { bp: 1000, powerCost: 0 });

/**
 * ※モーフ の共通テスト（R-KW-MORPH-01〜03。RK13-253-273.b.test.ts RK-261 と同じ形）。
 * id が自軍バトルエリアにあり、敵軍ユニットが通常のラッシュをしたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（partnerId）と置き換えられる。
 */
export function morphTests(id: string, partnerId: string, otherId: string, page: string, extra: CardDefinition[] = []): void {
  const rushed = () => enemyRushes({ battle: [inst(id, "me")], command: [released(partnerId, "pt"), released(otherId, "ot")] }, "SPEC-MORPH-RUSHER:e", [MORPH_RUSHER, ...extra]);

  it(`${id}: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカードから選べる（特徴が違うものは選べない）（出典: ${page}「※モーフ」・atwiki/page-1294・R-KW-MORPH-03）`, () => {
    expect(morphCandidates(rushed())).toEqual([`${partnerId}:pt`]);
  });

  it(`${id}: ※モーフ — 置き換えると、選んだカードがその場に出て、これはコマンドゾーンに置かれる（出典: ${page}・atwiki/page-1294「これと置き換えてもよい」）`, () => {
    const s = settle(pickAs(rushed(), "player1", `${partnerId}:pt`));
    expect(zoneOf(s, "player1", `${partnerId}:pt`)).toBe("battle");
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("command");
  });
}

/** CN なし・SP なしの S ユニット（タクスで SP1 を得るかの確認用）。 */
export function noSpUnit(id: string, category: CardDefinition["category"]): CardDefinition {
  return sUnit(id, { category, bp: 1000, sp: undefined } as Partial<CardDefinition>);
}

/**
 * ※タクス○○ の共通テスト（R-KW-TAX-01。atwiki/page-1291「これがバトルエリアの○番目にある間、これの次に並ぶ○○を持つSユニットは「SP1」を得る」）。
 * 番号は WB=1、MA=2、OT=3、ET=4。
 */
export function taxTests(id: string, cat: "WB" | "MA" | "OT" | "ET", page: string): void {
  const pos = { WB: 1, MA: 2, OT: 3, ET: 4 }[cat];
  const SAME = noSpUnit(`SPEC-TAX-${cat}`, cat);
  const OTHER = noSpUnit("SPEC-TAX-OTHER", cat === "ET" ? "DA" : "ET");
  const SAME_M = { ...noSpUnit(`SPEC-TAX-${cat}-M`, cat), size: "M" } as CardDefinition;
  const extra = [SAME, OTHER, SAME_M];
  const line = (taxPos: number, next: string) => {
    const before = Array.from({ length: taxPos - 1 }, (_, i) => inst("TST-UNIT-0", `f${i}`));
    return st({ player1: { battle: [...before, inst(id, "tx"), inst(next, "nx")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, extra);
  };

  it(`${id}: ※タクス${cat} — バトルエリアの${pos}番目にある間、次に並ぶ ${cat} を持つ S ユニットは「SP1」を得る（出典: ${page}「※タクス${cat}」・atwiki/page-1291・R-KW-TAX-01）`, () => {
    expect(spOf(line(pos, SAME.id), "player1", `${SAME.id}:nx`)).toBe(1);
  });

  it(`${id}: ※タクス${cat} — 次に並ぶのが ${cat} を持たないユニット・M ユニットなら「SP1」を得ない（出典: ${page}・atwiki/page-1291「○○を持つSユニット」）`, () => {
    expect(spOf(line(pos, OTHER.id), "player1", `${OTHER.id}:nx`)).toBe(0);
    expect(spOf(line(pos, SAME_M.id), "player1", `${SAME_M.id}:nx`)).toBe(0);
  });

  it(`${id}: ※タクス${cat} — ${pos}番目以外にあれば、次に並ぶユニットは「SP1」を得ない（出典: ${page}・atwiki/page-1291「これがバトルエリアの${pos}番目にある間」）`, () => {
    expect(spOf(line(pos + 1, SAME.id), "player1", `${SAME.id}:nx`)).toBe(0);
  });
}

/** 自軍（player1）バトルフェイズに、ラッシュエリアの id をバトルエリアに出す（進入直後の行動ウィンドウ・選択は残す）。 */
export function enterNow(s: GameState, id: string): GameState {
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
}

/** パワーゾーンのカードがウラ向き（ダメージ）か。 */
export function isDamage(s: GameState, playerId: "player1" | "player2", instanceId: string): boolean {
  return zoneOf(s, playerId, instanceId) === "power" && cardIn(s, playerId, instanceId)?.faceDown === true;
}
