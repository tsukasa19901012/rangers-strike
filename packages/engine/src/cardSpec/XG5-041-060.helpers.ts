/**
 * cardSpec XG5-041〜XG5-060（クロスギャザー XG5 ザ・チケットブレイカー ゴセイイエロー〜仮面ライダーワイルドカリス）用ヘルパー。
 * XG5-021-040.helpers.ts（RS・RK・RM・BK と XG5-001〜040 のヘルパーを含む）をそのまま再エクスポートし、パワーゾーンのオモテ向きのカード・
 * ラッシュフェイズの終わり・「アンデッド」のユニットのためのコマンドの共通テストを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, inst, legal, payableFor, powerCards, releasedCat, rushBoard, sUnit } from "./XG5-021-040.helpers";

export * from "./XG5-021-040.helpers";

/** パワーゾーンにオモテ向きで置くカード。 */
export function faceUp(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), faceDown: false };
}

/** いまのフェイズ（ラッシュフェイズ）を終える（end_phase）。 */
export function endPhase(s: GameState, playerId: PlayerId = "player1"): GameState {
  const end = legal(s).find((a) => a.type === "end_phase" && a.playerId === playerId);
  if (!end) throw new Error("no end_phase");
  return act(s, end);
}

/**
 * 「※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる」の共通テスト
 * （R-KW-CALL-01 と同じ形の、特徴で指定したもの）。自軍ラッシュエリアのこれを、手札の「アンデッド」の DA ユニットのラッシュに使える。
 * 「アンデッド」を持たないユニット・オペレーションには使えない。
 */
export function undeadCommandTests(id: string, page: string): void {
  const UD = sUnit("SPEC-UNDEAD-DA", { category: "DA", bp: 1000, powerCost: 2, features: ["アンデッド"] });
  const PLAIN = sUnit("SPEC-PLAIN-DA", { category: "DA", bp: 1000, powerCost: 2 });
  const board = (hand: CardInstance) => rushBoard({ hand: [hand], rush: [inst(id, "ud")], command: releasedCat("DA", 1, "dc"), power: powerCards(3) }, {}, [UD, PLAIN]);
  it(`${id}: ※ — 自軍ラッシュエリアのこれを、特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる（出典: ${page}「このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる」・R-KW-CALL-01）`, () => {
    expect(payableFor(board(inst(UD.id, "u")), `${UD.id}:u`)).toContain(`${id}:ud`);
  });
  it(`${id}: ※ —「アンデッド」を持たないユニット・オペレーションを使うためのコマンドにはできない（出典: ${page}「特徴「アンデッド」を持つユニットをラッシュするための」・R-KW-CALL-01「オペレーションには使えない」）`, () => {
    expect(payableFor(board(inst(PLAIN.id, "p")), `${PLAIN.id}:p`) ?? []).not.toContain(`${id}:ud`);
    expect(payableFor(board(inst("TST-OP-DA", "op")), "TST-OP-DA:op") ?? []).not.toContain(`${id}:ud`);
  });
}

/** ※リード○○ の共通テスト（XG5-021-040.helpers の leadMaTests を任意のカテゴリにしたもの。atwiki/page-2250）。 */
export function leadTestsFor(id: string, cat: "WB" | "MA" | "OT" | "ET" | "DA", page: string): void {
  const OP = cat === "WB" ? "TST-OP" : `TST-OP-${cat}`;
  const UNIT = sUnit(`SPEC-LEAD-${cat}-UNIT`, { category: cat, bp: 1000, powerCost: 0 });
  it(`${id}: ※リード${cat} — 自軍ラッシュエリアのこれを、${cat} のオペレーションを使うためのコマンドとしてホールドできる（出典: ${page}「※リード${cat}」・atwiki/page-2250）`, () => {
    const s = rushBoard({ hand: [inst(OP, "op")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) });
    expect(payableFor(s, `${OP}:op`)).toContain(`${id}:ld`);
  });
  it(`${id}: ※リード${cat} — ユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250「オペレーション使用以外の目的ではコマンドとして使うことはできない」）`, () => {
    const s = rushBoard({ hand: [inst(UNIT.id, "u")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) }, {}, [UNIT]);
    expect(payableFor(s, `${UNIT.id}:u`) ?? []).not.toContain(`${id}:ld`);
  });
}
