/**
 * cardSpec XG4-044〜XG4-063（ゴセイブラック〜仮面ライダースカル）用ヘルパー。
 * XG4-022-043.helpers.ts（XG4-001-021・BK1・RM・RK のヘルパーを含む）をそのまま再エクスポートし、
 * 「ホールドしなければバトルエリアに出られない」・自軍ターン開始時の置き換えの共通テストを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  canEnter,
  canSkip,
  choiceIds,
  deckCards,
  endTurn,
  enemyBoard,
  enterHold,
  expectChoiceFrom,
  inst,
  p1Battle,
  pick,
  releasedCat,
  resolveAll,
  toStartEnd,
  zoneOf,
} from "./XG4-022-043.helpers";

export * from "./XG4-022-043.helpers";

/**
 * 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」の共通テスト（RK12-232-252.a.test.ts RK-238 と同じ形）。
 */
export function holdEnterTests(id: string, cat: "WB" | "MA" | "OT" | "ET" | "DA", page: string, extra: CardDefinition[] = []): void {
  it(`${id}: ※ — ホールドできるリリース状態の自軍コマンドがなければバトルエリアに出られない（出典: ${page}「自軍コマンドを1つホールドしなければバトルエリアに出られない」）`, () => {
    expect(canEnter(p1Battle({ rush: [inst(id, "me")], command: [] }, {}, extra), `${id}:me`)).toBe(false);
  });

  it(`${id}: ※ — 自軍コマンドを1つホールドしてバトルエリアに出られる（出典: ${page}）`, () => {
    const s0 = p1Battle({ rush: [inst(id, "me")], command: releasedCat(cat, 1) }, {}, extra);
    expect(canEnter(s0, `${id}:me`)).toBe(true);
    const s = enterHold(s0, `${id}:me`);
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });
}

/**
 * 敵軍（player2）のバトルフェイズからターンを終え、自軍（player1）のターン開始時の処理を進める。
 * sourceCardId の選択が開いたら止める。
 */
export function toMyTurnStart(
  p1: Partial<GameState["players"]["player1"]>,
  sourceCardId: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return toStartEnd(endTurn(enemyBoard({ deck: deckCards(6), ...p1 }, p2, extra)), sourceCardId);
}

/**
 * 「※自軍ターン開始時、自分の手札から「A」か「B」のカードを1枚選び、これと置き換えてもよい。」の共通テスト
 * （XG4-049 アクロバッター・XG4-050 ロボイザー・XG4-051 マックジャバー。atwiki/page-2076・2075・2056 Q1）。
 */
export function swapTests(id: string, partners: [string, string], other: string, page: string): void {
  const [a, b] = partners;
  it(`${id}: ※ — 自軍ターン開始時、手札の ${a}・${b} から1枚選べる（ほかのカードは選べない。任意）（出典: ${page}「自分の手札から…のカードを1枚選び、これと置き換えてもよい」）`, () => {
    const s = toMyTurnStart({ rush: [inst(id, "me")], hand: [inst(a, "ha"), inst(b, "hb"), inst(other, "ho")] }, id);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([`${a}:ha`, `${b}:hb`].sort());
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ※ — 置き換えると、選んだカードがこれのあった場所に出て、これは手札に入る（出典: ${page}「これと置き換えてもよい」）`, () => {
    let s = toMyTurnStart({ rush: [inst(id, "me")], hand: [inst(a, "ha")] }, id);
    expectChoiceFrom(s, "player1", id);
    s = resolveAll(pick(s, `${a}:ha`));
    expect(zoneOf(s, "player1", `${a}:ha`)).toBe("rush");
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("hand");
  });

  // 3枚とも、捨札からの置き換えは今のエンジンで働かない（既知の不具合。docs/verification/unverified/XG4-gaps.md）。
  it.fails(`${id}: 公式Q&A — 捨札にあっても置き換えられる（公開情報なら有効。捨札のこれと手札のカードを置き換える）（出典: ${page} Q1「ゲームから除外されている以外で公開情報になっていれば、そのテキストは有効であり置き換えることができます」）（既知の不具合: CARD-${id} 捨札にあるときの置き換え（公式Q&A）が働かない）`, () => {
    let s = toMyTurnStart({ discard: [inst(id, "me")], hand: [inst(a, "ha")] }, id);
    expectChoiceFrom(s, "player1", id);
    s = resolveAll(pick(s, `${a}:ha`));
    expect(zoneOf(s, "player1", `${a}:ha`)).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("hand");
  });
}
