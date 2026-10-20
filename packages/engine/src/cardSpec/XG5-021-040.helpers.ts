/**
 * cardSpec XG5-021〜XG5-040（クロスギャザー XG5 ザ・チケットブレイカー ボウケンブラック〜ゴセイブラック）用ヘルパー。
 * XG5-001-020.helpers.ts（RS・RK・RM・BK のヘルパーを含む）をそのまま再エクスポートし、「ボウケンレッド」からのコンビネーションの手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { DEFS, act, deckCards, inst, legal, passEntry, payableFor, powerCards, releasedCat, rushBoard, settle, skip, spOf, st, sUnit } from "./XG5-001-020.helpers";

export * from "./XG5-001-020.helpers";

/** 開いている選択が sourceCardId のものなら見送る（なければそのまま）。反応ウィンドウはパスする。 */
export function skipFrom(s: GameState, sourceCardId: string): GameState {
  let n = settle(s);
  for (let i = 0; i < 4 && n.pendingEffectChoice?.sourceCardId === sourceCardId; i++) n = settle(skip(n));
  return n;
}

/**
 * 自軍（player1）バトルフェイズに、before（並びの順。既にバトルエリアにいるユニット）の後へ、
 * red（「ボウケンレッド」のカード。既定は XG5-020）を出し、その NC の選択があれば見送ってから、id を出す（id の NC の選択は残す）。
 */
export function afterRed(
  id: string,
  before: CardInstance[] = [],
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  red = "XG5-020",
): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  let s = st(
    {
      player1: { deck: deckCards(5), ...p1, battle: [...before, ...(p1.battle ?? [])], rush: [inst(red, "red"), inst(cid, suf), ...(p1.rush ?? [])] },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    extra,
  );
  s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${red}:red` });
  s = passEntry(skipFrom(s, red));
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
}

/** 指定プレイヤーが hold_for_wing（ウイングのホールド）できるか。 */
export function wingOffered(s: GameState, instanceId: string, playerId: PlayerId): boolean {
  return legal(s).some((a) => a.type === "hold_for_wing" && a.playerId === playerId && a.instanceId === instanceId);
}

/** ゲームから除外されたか（除外ゾーン exile にある）。 */
export function exiled(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return (s.players[playerId].exile ?? []).some((c) => c.instanceId === instanceId);
}

/** 印刷スペック（マルチカテゴリのユニット用。カテゴリは配列で比べる）。 */
export function expectMultiStats(
  id: string,
  stats: {
    name: string;
    category: string[];
    size: string;
    bp: number;
    sp: number | string | undefined;
    powerCost: number | string;
    comboNumber?: number | string;
    features: string[];
    rushCondition?: string;
  },
): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(([] as string[]).concat(d.category as string | string[])).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/**
 * ※リードMA の共通テスト（docs/rules/07-keywords.md のリード。atwiki/page-2250「オペレーション使用以外の目的ではコマンドとして使うことはできない」）。
 * 自軍ラッシュエリアのこれを、MA のオペレーション（TST-OP-MA）を使うためのコマンドとしてホールドできる。ユニットのラッシュには使えない。
 */
export function leadMaTests(id: string, page: string): void {
  const UNIT = sUnit("SPEC-LEAD-MA-UNIT", { category: "MA", bp: 1000, powerCost: 0 });
  it(`${id}: ※リードMA — 自軍ラッシュエリアのこれを、MA のオペレーションを使うためのコマンドとしてホールドできる（出典: ${page}「※リードMA」・atwiki/page-2250）`, () => {
    const s = rushBoard({ hand: [inst("TST-OP-MA", "op")], rush: [inst(id, "ld")], command: releasedCat("MA", 1, "lc"), power: powerCards(3) });
    expect(payableFor(s, "TST-OP-MA:op")).toContain(`${id}:ld`);
  });
  it(`${id}: ※リードMA — ユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250「オペレーション使用以外の目的ではコマンドとして使うことはできない」）`, () => {
    const s = rushBoard({ hand: [inst(UNIT.id, "u")], rush: [inst(id, "ld")], command: releasedCat("MA", 1, "lc"), power: powerCards(3) }, {}, [UNIT]);
    expect(payableFor(s, `${UNIT.id}:u`) ?? []).not.toContain(`${id}:ld`);
  });
}

/**
 * ※タクスMA の共通テスト（atwiki/page-1291「これがバトルエリアの○番目にある間、これの次に並ぶ○○を持つSユニットは「SP1」を得る」。MA は2番目）。
 */
export function taxMaTests(id: string, page: string): void {
  const MA = sUnit("SPEC-TAX-MA", { category: "MA", bp: 1000, sp: undefined });
  const ET = sUnit("SPEC-TAX-ET", { category: "ET", bp: 1000, sp: undefined });
  const MA_M = sUnit("SPEC-TAX-MA-M", { category: "MA", bp: 1000, sp: undefined, size: "M" });
  const line = (pos: number, next: string) =>
    st(
      {
        player1: { battle: [...Array.from({ length: pos - 1 }, (_, i) => inst("TST-UNIT-0", `f${i}`)), inst(id, "tx"), inst(next, "nx")], deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      [MA, ET, MA_M],
    );
  it(`${id}: ※タクスMA — バトルエリアの2番目にある間、次に並ぶ MA を持つ S ユニットは「SP1」を得る（出典: ${page}「※タクスMA」・atwiki/page-1291）`, () => {
    expect(spOf(line(2, MA.id), "player1", `${MA.id}:nx`)).toBe(1);
  });
  it(`${id}: ※タクスMA — 次に並ぶのが MA を持たないユニット・M ユニットなら「SP1」を得ない（出典: atwiki/page-1291「○○を持つSユニット」）`, () => {
    expect(spOf(line(2, ET.id), "player1", `${ET.id}:nx`)).toBe(0);
    expect(spOf(line(2, MA_M.id), "player1", `${MA_M.id}:nx`)).toBe(0);
  });
  it(`${id}: ※タクスMA — 2番目以外（3番目）にあれば、次に並ぶユニットは「SP1」を得ない（出典: atwiki/page-1291「これがバトルエリアの○番目にある間」）`, () => {
    expect(spOf(line(3, MA.id), "player1", `${MA.id}:nx`)).toBe(0);
  });
}
