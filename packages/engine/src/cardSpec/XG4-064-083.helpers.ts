/**
 * cardSpec XG4-064〜XG4-083（リボルギャリー〜ディケイド ファイズ）用ヘルパー。
 * XG4-044-063.helpers.ts（XG4-001〜063・BK1・RM・RK のヘルパーを含む）をそのまま再エクスポートし、
 * ※コール○○ の共通テストと、選択を順に進める小さな関数を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { GameState } from "../types/game";
import { canConfirm, canStartRush, cardIn, choiceIds, confirm, deckCards, inst, pick, rushFromHand, st, sUnit, zoneOf } from "./XG4-044-063.helpers";

export * from "./XG4-044-063.helpers";

/**
 * ※コール○○ の共通テスト（R-KW-CALL-01、atwiki/page-1293「このユニットは○○のユニットをラッシュするためのコマンドとしてホールドできる」）。
 * 自軍ラッシュエリアのこれ（リリース状態）を、cat の S ユニットをラッシュするためのコマンドとしてホールドできる。
 */
export function callTests(id: string, cat: "WB" | "MA" | "OT" | "ET" | "DA", page: string): void {
  const SAME = sUnit(`SPEC-CALL-${cat}`, { category: cat, bp: 1000, powerCost: 0 });
  const otherCat = cat === "OT" ? "ET" : "OT";
  const OTHER = sUnit(`SPEC-CALL-${otherCat}`, { category: otherCat, bp: 1000, powerCost: 0 });
  const board = (unit: string) =>
    st({ phase: "rush", player1: { hand: [inst(unit, "h")], rush: [inst(id, "c")], command: [], power: [], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [SAME, OTHER]);

  it(`${id}: ※コール${cat} — 自軍ラッシュエリアのこれを、${cat} のユニットをラッシュするためのコマンドとしてホールドできる（出典: ${page}「※コール${cat}」・atwiki/page-1293・R-KW-CALL-01）`, () => {
    const r = rushFromHand(board(SAME.id), "player1", `${SAME.id}:h`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${SAME.id}:h`)).toBe("rush");
    expect(cardIn(r.state, "player1", `${id}:c`)?.commandHeld).toBe(true);
  });

  it(`${id}: ※コール${cat} — ${cat} を持たないユニットのラッシュには使えない（出典: ${page}・atwiki/page-1293・R-KW-CALL-01）`, () => {
    expect(canStartRush(board(OTHER.id), "player1", `${OTHER.id}:h`)).toBe(false);
  });
}

/**
 * sourceCardId の選択が開いている間、ids のうち候補にあるものを順に選び、候補が選べるものでなくなったら確認で進める。
 * （「〜してもよい」の確認と、カード選択のどちらの形でも同じ手順で進めるため。）
 */
export function pickThrough(s: GameState, sourceCardId: string, ids: string[]): GameState {
  let n = s;
  for (let i = 0; i < 8 && n.pendingEffectChoice?.sourceCardId === sourceCardId; i++) {
    const next = ids.find((id) => choiceIds(n).includes(id));
    if (next) n = pick(n, next);
    else if (canConfirm(n)) n = confirm(n);
    else break;
  }
  return n;
}
