/**
 * cardSpec BK-001〜BK-019（ザ・マスクドライダーエクスパンション ベルトコレクションBOX のオペレーション）用ヘルパー。
 * RM3-043-062.helpers.ts（RM1・RM2・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、ベルトのオペレーションを使う手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  inst,
  logged,
  pick,
  played,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  skip,
  zoneOf,
} from "./RM3-043-062.helpers";

export * from "./RM3-043-062.helpers";

export type Cat = "WB" | "MA" | "OT" | "ET" | "DA";

/**
 * 自軍（player1）ラッシュフェイズに、手札の BK オペレーション（instanceId `${id}:op`）を使う。
 * 支払いはカテゴリ cat のリリース状態のコマンド1つ（p1.command の前に置く）、パワーゾーンは既定で cost 枚。
 */
export function beltUsed(
  id: string,
  cat: Cat,
  cost: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const { hand = [], command = [], power = powerCards(cost), ...rest } = p1;
  return played(rushBoard({ ...rest, hand: [inst(id, "op"), ...hand], command: [...releasedCat(cat, 1), ...command], power }, p2, extra), `${id}:op`);
}

/** 山札の instanceId（上から順）。 */
export function deckOrder(s: GameState, playerId: PlayerId = "player1"): string[] {
  return s.players[playerId].deck.map((c) => c.instanceId);
}

/** 場（ラッシュ・バトルエリア）のユニットがホールド状態か。 */
export function isHeld(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return cardIn(s, playerId, instanceId)?.commandHeld === true;
}

/** ホールド状態の場のユニット。 */
export function heldField(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

/** 常駐置き場にオモテ向きで置かれたカード。 */
export function faceUpResident(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), faceDown: false };
}

// ===========================================================================
/** 「次の効果から1つ選び発動する⇒◎自軍山札から「X」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎…」の共通テスト。 */
export function searchBeltTests(opts: {
  id: string;
  name: string;
  cat: Cat;
  cost: number;
  page: string;
  text: string;
  heroName: string;
  otherMode: string;
  /** 選べるカード（山札に置く。instanceId は `${cardId}:h${i}`）。 */
  heroes: string[];
  /** 選べないカード（山札に置く。instanceId は `${cardId}:x${i}`）と、その出典。 */
  others: string[];
  othersWhy: string;
  rarity?: string;
}) {
  const { id, page } = opts;
  const heroDeck = (): CardInstance[] => [
    ...opts.heroes.map((h, i) => inst(h, `h${i}`)),
    ...opts.others.map((h, i) => inst(h, `x${i}`)),
    ...deckCards(3),
  ];
  const usedWith = (p1: Partial<GameState["players"]["player1"]> = {}) => beltUsed(id, opts.cat, opts.cost, { deck: heroDeck(), ...p1 });

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, opts.text);
    expectOpStats(id, { name: opts.name, category: opts.cat, powerCost: opts.cost });
    expectRarityIn(id, [opts.rarity ?? "N"]);
  });

  it(`${id}: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: ${page}「次の効果から1つ選び発動する」）`, () => {
    const s = usedWith();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["search", opts.otherMode].sort());
  });

  it(`${id}: ◎1つ目 — 自軍山札の「${opts.heroName}」のカードから1枚選べる（任意）（出典: ${page}「自軍山札から「${opts.heroName}」のカードを1枚選び…手札に加えてもよい」・atwiki/page-1084 Q1（「これは「○○」として使える」カードは山札でも選べる）・${opts.othersWhy}）`, () => {
    const s = pick(usedWith(), "search");
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(opts.heroes.map((h, i) => `${h}:h${i}`).sort());
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ◎1つ目 — 選んだカードは相手に見せてから手札に加わる（山札から離れ、このカードは捨札）（出典: ${page}「相手に見せてから手札に加えて」）`, () => {
    const hero = `${opts.heroes[0]}:h0`;
    const s = resolveAll(pick(pick(usedWith(), "search"), hero));
    expect(zoneOf(s, "player1", hero)).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(heroDeck().length - 1);
    expect(zoneOf(s, "player1", `${id}:op`)).toBe("discard");
    expect(logged(s, "reveal")).toBe(true);
  });

  it(`${id}: ◎1つ目 — 手札に加えなくてもよい（手札・山札の枚数は変わらない）（出典: ${page}「手札に加えてもよい」）`, () => {
    const s = resolveAll(skip(pick(usedWith(), "search")));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(heroDeck().length);
  });
}

