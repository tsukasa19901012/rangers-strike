/**
 * cardSpec XG6-023〜XG6-044（クロスギャザー ザ・ギガンティックタイタン データスハイパー〜仮面ライダーNEW電王SF）用ヘルパー。
 * XG6-001-022.helpers.ts（BK・RM・RK のヘルパーを含む）をそのまま再エクスポートし、
 * ※リード・※タクスMA・※レジスト・※ブレイカーの共通テストなどを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  attackUntilRegister,
  canStartRush,
  choiceIds,
  enemyTurn,
  enter,
  enterSeq,
  expectChoiceFrom,
  fill,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  raw,
  registerOffered,
  releasedCat,
  rushBoard,
  spOf,
  sUnit,
} from "./XG6-001-022.helpers";

export * from "./XG6-001-022.helpers";

type Cat = "WB" | "MA" | "OT" | "ET" | "DA";

/** 手札のカード（オペレーション・ユニット）を使う／ラッシュするときのコマンドの支払いで選べるもの。 */
export function payableFor(s: GameState, sourceInstanceId: string, playerId: PlayerId = "player1"): string[] {
  const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.playerId === playerId && "sourceInstanceId" in x && x.sourceInstanceId === sourceInstanceId);
  if (!a) return [];
  return [...(raw(s, a).pendingCommandPayment?.validInstanceIds ?? [])].sort();
}

/** 一時的な BP の増減（CardInstance.bpModifier）を付けたカード。 */
export function withBp(card: CardInstance, delta: number): CardInstance {
  return { ...card, bpModifier: delta };
}

/** ※リード○○ の共通テスト（R-KW-READ-01、atwiki/page-2250）。 */
export function leadTests(id: string, cat: Cat, page: string): void {
  const OP = cat === "WB" ? "TST-OP" : `TST-OP-${cat}`;
  const UNIT = sUnit(`SPEC-LEAD-${cat}`, { category: cat, bp: 1000, powerCost: 0 });
  it(`${id}: ※リード${cat} — 自軍ラッシュエリアのこれを、${cat} のオペレーションを使用するためのコマンドとしてホールドできる（出典: ${page}「※リード${cat}」・R-KW-READ-01）`, () => {
    const s = rushBoard({ hand: [inst(OP, "op")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) });
    expect(payableFor(s, `${OP}:op`)).toContain(`${id}:ld`);
  });
  it(`${id}: ※リード${cat} — ユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250 本文「オペレーション使用以外の目的ではコマンドとして使うことはできない」）`, () => {
    const s = rushBoard({ hand: [inst(UNIT.id, "u")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) }, {}, [UNIT]);
    expect(payableFor(s, `${UNIT.id}:u`)).not.toContain(`${id}:ld`);
  });
}

/** ※タクスMA の共通テスト（R-KW-TAKUS-01）: これがバトルエリアの2番目にある間、これの次に並ぶ MA を持つ S ユニットは「SP1」を得る。 */
export function takusMaTests(id: string, page: string): void {
  const MA = sUnit("SPEC-TK-MA", { category: "MA", bp: 1000, sp: undefined });
  const ET = sUnit("SPEC-TK-ET", { category: "ET", bp: 1000, sp: undefined });
  const at = (pos: number, next: string) =>
    enterSeq(p1Battle({ rush: [inst(id, "tk"), inst(next, "nx")], battle: fill(pos - 1) }, {}, [MA, ET]), [`${id}:tk`, `${next}:nx`]);
  it(`${id}: ※タクスMA — バトルエリアの2番目にある間、次に並ぶ MA の S ユニット（SP なし）は「SP1」を得る。MA を持たないユニットは得ない（出典: ${page}「※タクスMA」・R-KW-TAKUS-01）`, () => {
    expect(spOf(at(2, MA.id), "player1", `${MA.id}:nx`)).toBe(1);
    expect(spOf(at(2, ET.id), "player1", `${ET.id}:nx`)).toBe(0);
  });
  it(`${id}: ※タクスMA — これが3番目なら次の MA のユニットも SP を得ない（出典: R-KW-TAKUS-01「MAなら2」）`, () => {
    expect(spOf(at(3, MA.id), "player1", `${MA.id}:nx`)).toBe(0);
  });
}

/** ※レジスト の共通テスト（R-KW-RESIST-01）。 */
export function resistTest(id: string, page: string): void {
  it(`${id}: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: ${page}「※レジスト」・R-KW-RESIST-01）`, () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst(id, "r")] }, `${id}:r`))).toBe(true);
  });
}

/**
 * ※ブレイカー の共通テスト（R-KW-BREAKER-01、atwiki/page-2355 A1）。
 * 敵軍（player2）の XG6-006 ダイタンケン【ボウケンフラッシュ】（ブレイカーを持たないユニットの効果）の選択に、player1 のこれが入らないこと。
 * 同名の自軍ユニットがあればラッシュできないこと（sameNameGap を渡すと it.fails）。
 */
export function breakerTests(id: string, page: string, cat: Cat, extra: CardDefinition[] = [], board: Partial<GameState["players"]["player1"]> = {}, sameNameGap?: string): void {
  it(`${id}: ※ブレイカー — ブレイカーを持たない敵軍ユニットの効果（XG6-006 ダイタンケン【ボウケンフラッシュ】）に選ばれない（出典: ${page}「※ブレイカー」・R-KW-BREAKER-01）`, () => {
    let s = enemyTurn({ battle: [inst(id, "b"), inst("TST-UNIT-0", "o")] }, { rush: [inst("XG6-006", "dt")], command: [inst("XG6-016", "an")] }, extra);
    s = enter(s, "XG6-006:dt", "player2");
    for (let i = 0; i < 2 && s.pendingEffectChoice?.sourceCardId === "XG6-006" && choiceIds(s).includes("XG6-016:an"); i++) s = pick(s, "XG6-016:an");
    expectChoiceFrom(s, "player2", "XG6-006");
    expect(choiceIds(s)).toContain("TST-UNIT-0:o");
    expect(choiceIds(s)).not.toContain(`${id}:b`);
  });
  (sameNameGap ? it.fails : it)(`${id}: ※ブレイカー — 本来のカード名が同じ自軍ユニットがあるとき、これはラッシュできない（ないときはラッシュできる）（出典: ${page}・atwiki/page-2355 A1・R-KW-BREAKER-02）${sameNameGap ? `— 既知の不具合: CARD-${id} ${sameNameGap}` : ""}`, () => {
    const mk = (same: CardInstance[]) => rushBoard({ ...board, hand: [inst(id, "h")], battle: [...same, ...(board.battle ?? [])], command: releasedCat(cat, 2), power: powerCards(14) }, {}, extra);
    expect(canStartRush(mk([]), "player1", `${id}:h`)).toBe(true);
    expect(canStartRush(mk([inst(id, "same")]), "player1", `${id}:h`)).toBe(false);
  });
}
