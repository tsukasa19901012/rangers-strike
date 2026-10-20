/**
 * cardSpec XG4-001〜XG4-021（クロスギャザー ザ・ジェットアクセル 牛靴仮面〜カラクリマント）用ヘルパー。
 * BK1-001-019.helpers.ts（RK1〜RK16・RM1〜RM3 のヘルパーを含む）をそのまま再エクスポートし、
 * マルチカテゴリのスペック照合・ゲームから除外されたカードの確認・自軍ラッシュフェイズのオペレーション使用を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  DEFS,
  canStartRush,
  deckCards,
  inst,
  played,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  st,
  zoneOf,
  type Cat,
} from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

type CatArg = string | string[];

/** カテゴリの比較（マルチカテゴリ〈"WB,MA" 等〉は配列で書く）。 */
function expectCategory(actual: unknown, expected: CatArg): void {
  const a = Array.isArray(actual) ? [...actual].sort() : [actual];
  const e = Array.isArray(expected) ? [...expected].sort() : [expected];
  expect(a).toEqual(e);
}

/**
 * ユニットの印刷スペック（名前・種類・カテゴリ・サイズ・BP・SP・必要パワー・CN・特徴・追加条件）。
 * SP は「！」を "special"、「－」を undefined、分数を "1/3" のように書く。マルチカテゴリは配列で書く。
 */
export function expectUnit(
  id: string,
  stats: {
    name: string;
    category: CatArg;
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
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expectCategory(d.category, stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect([...(d.features ?? [])].sort()).toEqual([...stats.features].sort());
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/** ビークルの印刷スペック（名前・種類・カテゴリ・必要パワー・サイズ・特徴）。 */
export function expectVehicle(
  id: string,
  stats: { name: string; category: CatArg; powerCost: number | string; size: string; features: string[] },
): void {
  const d = DEFS[id]!;
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("vehicle");
  expectCategory(d.category, stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect([...(d.features ?? [])].sort()).toEqual([...stats.features].sort());
}

/** オペレーションの印刷スペック（名前・種類・カテゴリ・必要パワー）。マルチカテゴリは配列で書く。 */
export function expectOperation(id: string, stats: { name: string; category: CatArg; powerCost: number | string }): void {
  const d = DEFS[id]!;
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("operation");
  expectCategory(d.category, stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
}

/** カードがゲームから除外されているか（PlayerState.exile）。 */
export function isExiled(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return (s.players[playerId].exile ?? []).some((c) => c.instanceId === instanceId);
}

/**
 * 自軍（player1）ラッシュフェイズに、手札のオペレーション（instanceId `${id}:op`）を使う。
 * 支払いはカテゴリ cat のリリース状態のコマンド1つ（p1.command の前に置く）、パワーゾーンは既定で cost 枚。
 */
export function opUsed(
  id: string,
  cat: "WB" | "MA" | "OT" | "ET" | "DA",
  cost: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const { hand = [], command = [], power = powerCards(cost), ...rest } = p1;
  return played(rushBoard({ ...rest, hand: [inst(id, "op"), ...hand], command: [...releasedCat(cat, 1), ...command], power }, p2, extra), `${id}:op`);
}

/** 敵軍（player2）ターン・バトルフェイズの盤面（player1 が守る側）。 */
export function enemyTurn(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 場のカードの下に重なっているカード（stackedCards）の cardId。 */
export function stackedIds(c: CardInstance | undefined): string[] {
  return (c?.stackedCards ?? []).map((x) => x.instanceId);
}

/**
 * 「自軍「X」1体を捨札にすれば必要パワー0になる」（必要パワー7-）の追加条件の共通テスト（マルチカテゴリ版）。
 * RK1 の zordDownTests と同じ確認を、持つ全カテゴリのリリース状態のコマンドを置いて行う（R-CAT-02「持つ全カテゴリのコマンドが自軍コマンドゾーンにあり」）。
 */
export function zordDownMultiTests(id: string, partnerId: string, partnerName: string, page: string, cats: Cat[]) {
  const cmd = () => cats.flatMap((c) => releasedCat(c, 1));
  it(`${id}: 追加条件 — 自軍「${partnerName}」1体を捨札にすれば必要パワー0でラッシュできる（出典: ${page}・R-CAT-02）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "am")], rush: [inst(partnerId, "p")], command: cmd(), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", `${id}:am`, (a) => a.zordMaterialInstanceId === `${partnerId}:p`);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:am`)).toBe("rush");
    expect(zoneOf(t, "player1", `${partnerId}:p`)).toBe("discard");
  });

  it(`${id}: 必要パワー7- — 「${partnerName}」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst(id, "am")], command: cmd(), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(6), "player1", `${id}:am`)).toBe(false);
    const r = rushFromHand(mk(7), "player1", `${id}:am`);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:am`)).toBe("rush");
  });

  it(`${id}: マルチカテゴリ — 自軍コマンドゾーンに一方のカテゴリのコマンドしかなければ、手札からラッシュできない（出典: ${page}「カテゴリ」・R-CAT-02）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "am")], command: releasedCat(cats[0]!, 2), power: powerCards(7), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", `${id}:am`)).toBe(false);
  });
}
