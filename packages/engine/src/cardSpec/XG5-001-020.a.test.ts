/**
 * カード別スペック: XG5-001〜XG5-007（クロスギャザー XG5 ザ・チケットブレイカー ゴーグルレッド〜ゴーグルジェット）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     XG5 のカードの項はない（同じ名前の RS のカード〈RS-062 ボウケンレッド等〉の項だけ）。atwiki に転載された公式 Q&A: XG5-003 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-SCRUM-01・R-KW-TAKUS-01・R-KW-WING-01・R-ADD-06）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  canAttackAny,
  canSkip,
  canStrike,
  choiceIds,
  cnUnit,
  commandState,
  damageOf,
  deckCards,
  endTurn,
  enemyAttackTargets,
  enter,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  heldN,
  inst,
  legal,
  ncEnter,
  passEntry,
  passTurnTo,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  wingTests,
  zoneOf,
} from "./XG5-001-020.helpers";

const CN2 = cnUnit(2);
const CN3 = cnUnit(3);
const CN4 = cnUnit(4);
const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", bp: 1000, sp: undefined });
const WB_NOSP = sUnit("SPEC-WB-NOSP", { category: "WB", bp: 1000, sp: undefined });
const ET_M_NOSP = sUnit("SPEC-ET-M-NOSP", { category: "ET", bp: 3000, size: "M", sp: undefined });
const BLACK = sUnit("SPEC-BLACK", { category: "WB", bp: 2000, powerCost: 7, features: ["ブラック"] });
const BLACK_M = sUnit("SPEC-BLACK-M", { category: "DA", bp: 5000, size: "M", powerCost: 5, features: ["ブラック"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "ET", bp: 2000 });
const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C2P = sUnit("SPEC-C2P", { bp: 3000, size: "M", powerCost: "2+" });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const E9000 = sUnit("SPEC-E9000", { bp: 9000, size: "L" });
const E9500 = sUnit("SPEC-E9500", { bp: 9500, size: "L" });
const EXTRA = [CN2, CN3, CN4, ET_NOSP, WB_NOSP, ET_M_NOSP, BLACK, BLACK_M, PLAIN, C0, C2, C2P, C3, ES, EM, E9000, E9500];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncEnter(id, fillers, p1, p2, EXTRA);

/** ※タクスET の共通テスト（4番目にある間、次に並ぶ ET の S ユニットは「SP1」を得る。R-KW-TAKUS-01）。 */
function takusEtTests(id: string, page: string) {
  const fourth = (next: string, fillers = 3) => {
    let s = battle({ battle: fill(fillers), rush: [inst(id, "tx"), inst(next.split(":")[0]!, next.split(":")[1]!)] });
    s = passEntry(resolveAll(enter(s, `${id}:tx`)));
    return passEntry(resolveAll(enter(s, next)));
  };
  it(`${id}: ※タクスET — バトルエリアの4番目にある間、次に並ぶ ET の S ユニット（SP 空欄）は「SP1」を得る（出典: ${page}「※タクスET」・R-KW-TAKUS-01）`, () => {
    expect(spOf(fourth("SPEC-ET-NOSP:n"), "player1", "SPEC-ET-NOSP:n")).toBe(1);
  });
  it(`${id}: ※タクスET — 次に並ぶのが ET を持たない S ユニット・ET の M ユニットなら SP を得ない（出典: ${page}・R-KW-TAKUS-01「○○を持つSユニット」）`, () => {
    expect(spOf(fourth("SPEC-WB-NOSP:n"), "player1", "SPEC-WB-NOSP:n")).toBe(0);
    expect(spOf(fourth("SPEC-ET-M-NOSP:n"), "player1", "SPEC-ET-M-NOSP:n")).toBe(0);
  });
  it(`${id}: ※タクスET — 4番目でない（3番目）なら次の ET の S ユニットは SP を得ない（出典: R-KW-TAKUS-01「これがバトルエリアの○番目にある間」・ET=4）`, () => {
    expect(spOf(fourth("SPEC-ET-NOSP:n", 2), "player1", "SPEC-ET-NOSP:n")).toBe(0);
  });
}

// ===========================================================================
describe("XG5-001 ゴーグルレッド", () => {
  const TEXT =
    "※これが自軍エリアにある間、ナンバーに数字を持つ自軍ユニットは次の能力を得る⇒スクラム 【レッドロープ】「SP1」これがストライクしたとき、その処理をすべて終えてから、このバトルフェイズを終える。";

  it("XG5-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-2180）", () => {
    expectCatalogText("XG5-001", TEXT);
    expectStats("XG5-001", { name: "ゴーグルレッド", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 1, features: ["レッド", "男"] });
    expectRarityIn("XG5-001", ["R"]);
  });

  it("XG5-001: ※ — これが自軍ラッシュエリアにある間、CN2 の自軍ユニットの次に CN3 のユニットが並べば、CN2 のユニットはアタックされない（スクラムを得る）（出典: atwiki/page-2180「ナンバーに数字を持つ自軍ユニットは次の能力を得る⇒スクラム」・R-KW-SCRUM-01）", () => {
    const t = enemyAttackTargets({ battle: [inst("SPEC-CN2", "a"), inst("SPEC-CN3", "b")], rush: [inst("XG5-001", "r")] }, EXTRA);
    expect(t).not.toContain("SPEC-CN2:a");
    expect(t).toContain("SPEC-CN3:b");
  });

  it("XG5-001: ※ — これが自軍バトルエリアにある間も、自軍ユニットはスクラムを得る（出典: atwiki/page-2180「これが自軍エリアにある間」）", () => {
    const t = enemyAttackTargets({ battle: [inst("XG5-001", "r"), inst("SPEC-CN3", "a"), inst("SPEC-CN4", "b")] }, EXTRA);
    expect(t).not.toContain("SPEC-CN3:a");
  });

  it("XG5-001: ※ — これがなければスクラムを得ない（CN2 の次に CN3 が並んでもアタックされる）（出典: atwiki/page-2180「これが自軍エリアにある間」）", () => {
    const t = enemyAttackTargets({ battle: [inst("SPEC-CN2", "a"), inst("SPEC-CN3", "b")] }, EXTRA);
    expect(t).toContain("SPEC-CN2:a");
  });

  it("XG5-001: ※ — 敵軍のゴーグルレッドでは自軍ユニットはスクラムを得ない（出典: atwiki/page-2180「自軍ユニットは」）", () => {
    const t = enemyAttackTargets({ battle: [inst("SPEC-CN2", "a"), inst("SPEC-CN3", "b")] }, EXTRA, { rush: [inst("XG5-001", "er")] });
    expect(t).toContain("SPEC-CN2:a");
  });

  it("XG5-001: NC【レッドロープ】— 1番目に出れば「SP1」になりストライクできる（出典: atwiki/page-2180「【レッドロープ】「SP1」」）", () => {
    const s = nc("XG5-001:r", 0);
    expect(spOf(s, "player1", "XG5-001:r")).toBe(1);
    expect(canStrike(s, "XG5-001:r")).toBe(true);
  });

  it("XG5-001: 1番目以外に出れば NC は成立せず、SP を持たない（SP!）（出典: atwiki/page-2180「SP：！」・R-CN-01）", () => {
    const s = nc("XG5-001:r", 1);
    expect(spOf(s, "player1", "XG5-001:r")).toBe(0);
    expect(canStrike(s, "XG5-001:r")).toBe(false);
  });

  it("XG5-001: NC【レッドロープ】— ストライクしたとき、そのダメージの処理を終えてから、このバトルフェイズを終える（ほかのユニットはもう出られない）（出典: atwiki/page-2180「これがストライクしたとき、その処理をすべて終えてから、このバトルフェイズを終える」）", () => {
    let s = nc("XG5-001:r", 0, { rush: [inst("SPEC-PLAIN", "next")] });
    s = settle(strike(s, "XG5-001:r"));
    expect(damageOf(s, "player2")).toBe(1);
    expect(s.phase).not.toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:next")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-002 ゴーグルブラック", () => {
  const TEXT =
    "※タクスET 【ブラックシャドウ】自軍コマンドゾーンから、「ゴーグルブラック」以外の特徴「ブラック」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。そうしたとき、これを自軍コマンドゾーンにホールド状態で置く。";

  it("XG5-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-2274）", () => {
    expectCatalogText("XG5-002", TEXT);
    expectStats("XG5-002", { name: "ゴーグルブラック", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 2, features: ["ブラック", "男"] });
    expectRarityIn("XG5-002", ["R"]);
  });

  takusEtTests("XG5-002", "atwiki/page-2274");

  const COMMAND = () => [
    released("SPEC-BLACK", "c1"),
    { ...inst("SPEC-BLACK-M", "c2"), commandHeld: true },
    released("XG5-002", "c3"),
    released("SPEC-PLAIN", "c4"),
    released("TST-OP-ET", "c5"),
  ];

  it("XG5-002: NC【ブラックシャドウ】— 自軍コマンドゾーンの、特徴「ブラック」を持つユニットカード（ホールド状態・M ユニットも）から選べる。「ゴーグルブラック」・「ブラック」を持たないカード・オペレーション・敵軍のカードは選べない（任意）（出典: atwiki/page-2274「自軍コマンドゾーンから、「ゴーグルブラック」以外の特徴「ブラック」を持つユニットカードを1枚選び、…出してもよい」・カード評価「効果のラッシュはサイズも問わない」）", () => {
    const s = nc("XG5-002:b", 1, { command: COMMAND() }, { command: [released("SPEC-BLACK", "e1")] });
    expectChoiceFrom(s, "player1", "XG5-002");
    expect(choiceIds(s)).toEqual(["SPEC-BLACK-M:c2", "SPEC-BLACK:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-002: NC【ブラックシャドウ】— 選んだカードは自軍ラッシュエリアに出て（必要パワー7でもパワー0で出せる）、これは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-2274「ただし、追加条件は満たすこと。そうしたとき、これを自軍コマンドゾーンにホールド状態で置く」・カード評価「必要パワーを無視できる」）", () => {
    const s = resolveAll(pick(nc("XG5-002:b", 1, { command: COMMAND(), power: [] }), "SPEC-BLACK:c1"));
    expect(zoneOf(s, "player1", "SPEC-BLACK:c1")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-002:b")).toBe("command");
    expect(commandState(s, "player1", "XG5-002:b")).toBe("held");
  });

  it("XG5-002: NC【ブラックシャドウ】— 出さなければ、これはバトルエリアに残る（出典: atwiki/page-2274「出してもよい。…そうしたとき」）", () => {
    const s = resolveAll(skip(nc("XG5-002:b", 1, { command: COMMAND() })));
    expect(zoneOf(s, "player1", "SPEC-BLACK:c1")).toBe("command");
    expect(zoneOf(s, "player1", "XG5-002:b")).toBe("battle");
  });

  it("XG5-002: NC【ブラックシャドウ】— 追加条件は満たすこと: RS-584 ボウケンブラックAT（追加条件「自軍「ボウケンブラック」1体を捨札にする」）は、自軍エリアにボウケンブラックがあれば選べて、出すときにボウケンブラックを捨札にする（出典: atwiki/page-2274「ただし、追加条件は満たすこと」・カード評価「同じETで性能の高いブラックであるボウケンブラックATを引っ張り出す」）", () => {
    let s = nc("XG5-002:b", 1, { command: [released("RS-584", "at")], rush: [inst("RS-063", "bb")] });
    expect(choiceIds(s)).toEqual(["RS-584:at"]);
    s = resolveAll(pick(s, "RS-584:at"), ["RS-063:bb"]);
    expect(zoneOf(s, "player1", "RS-584:at")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-063:bb")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-002:b")).toBe("command");
  });

  it("XG5-002: NC【ブラックシャドウ】— 追加条件を満たせなければ（自軍エリアにボウケンブラックがない）RS-584 は選べない（出典: atwiki/page-2274「ただし、追加条件は満たすこと」）", () => {
    const s = nc("XG5-002:b", 1, { command: [released("RS-584", "at")] });
    expect(s.pendingEffectChoice?.sourceCardId === "XG5-002" ? choiceIds(s) : []).not.toContain("RS-584:at");
  });

  it("XG5-002: 2番目以外に出れば【ブラックシャドウ】は発動しない（出典: atwiki/page-2274「CN：2」・R-CN-01）", () => {
    const s = nc("XG5-002:b", 0, { command: COMMAND() });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-002");
  });
});

// ===========================================================================
describe("XG5-003 ゴーグルブルー", () => {
  const TEXT = "【ブルージェットダッシュ】このターン、敵軍ユニットの必要パワーの数字は1少なくなる。";

  it("XG5-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-2185）", () => {
    expectCatalogText("XG5-003", TEXT);
    expectStats("XG5-003", { name: "ゴーグルブルー", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 3, features: ["ブルー", "男"] });
    expectRarityIn("XG5-003", ["N"]);
  });

  it("XG5-003: NC【ブルージェットダッシュ】— このターン、敵軍ユニットの必要パワーの数字が1少なくなる（必要パワー3の敵軍ユニットを XG5-004 ゴーグルイエロー【イエローボール】（必要パワー2以下）で選べる）（出典: atwiki/page-2185「このターン、敵軍ユニットの必要パワーの数字は1少なくなる」・コメント欄「ゴーグルイエロー…のサポート担当」）", () => {
    const enemy = { rush: [inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2")] };
    let s = battle({ battle: fill(2), rush: [inst("XG5-003", "bl"), inst("XG5-004", "y")] }, enemy);
    s = enterKeep(s, ["XG5-003:bl", "XG5-004:y"]);
    expectChoiceFrom(s, "player1", "XG5-004");
    expect(choiceIds(s)).toEqual(["SPEC-C2:e2", "SPEC-C3:e3"]);
  });

  it("XG5-003: ブルーが3番目にいなければ（NC 不成立）必要パワー3の敵軍ユニットは【イエローボール】で選べない（出典: atwiki/page-2185「CN：3」）", () => {
    const enemy = { rush: [inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2")] };
    // ブルーは2番目（NC 不成立）、イエローは4番目。
    let s = battle({ battle: fill(1), rush: [inst("XG5-003", "bl"), inst("TST-UNIT-0", "g"), inst("XG5-004", "y")] }, enemy);
    s = enterKeep(s, ["XG5-003:bl", "TST-UNIT-0:g", "XG5-004:y"]);
    expectChoiceFrom(s, "player1", "XG5-004");
    expect(choiceIds(s)).toEqual(["SPEC-C2:e2"]);
  });

  it("XG5-003: NC【ブルージェットダッシュ】— 減るのはこのターンだけ（次の自軍ターンには必要パワー3の敵軍ユニットを【イエローボール】で選べない）（出典: atwiki/page-2185「このターン」）", () => {
    // このターンはフィラー2体の後にブルー（3番目）を出す。フィラー g とイエローはラッシュエリアで待つ。
    let s = battle({ battle: fill(2), rush: [inst("XG5-003", "bl"), inst("TST-UNIT-0", "g"), inst("XG5-004", "y")] }, { rush: [inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2")] });
    s = enterSeq(s, ["XG5-003:bl"]);
    s = passTurnTo(endTurn(passTurnTo(endTurn(resolveAll(s)), "player2", "battle")), "player1", "battle");
    // 次の自軍ターン: ラッシュエリアに戻ったフィラー2体と g を出し、4番目にイエロー（ブルーは出さない）。
    s = enterKeep(s, ["TST-UNIT-0:f0", "TST-UNIT-0:f1", "TST-UNIT-0:g", "XG5-004:y"]);
    expectChoiceFrom(s, "player1", "XG5-004");
    expect(choiceIds(s)).toEqual(["SPEC-C2:e2"]);
  });

  it.todo(
    "XG5-003: 公式Q&A — 必要パワー0のユニットは【ブルージェットダッシュ】で「−1」にならない（0より少なくならない）（出典: atwiki/page-2185 Q1）— 必要パワーの数字が0か−1かで結果が変わる効果（「○以下」以外の参照）が本範囲になく、公開 API で違いを観測できない",
  );
});

// ===========================================================================
describe("XG5-004 ゴーグルイエロー", () => {
  const TEXT = "【イエローボール】敵軍ラッシュエリアから、必要パワーの数字が2以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。";

  it("XG5-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-2186）", () => {
    expectCatalogText("XG5-004", TEXT);
    expectStats("XG5-004", { name: "ゴーグルイエロー", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: 4, features: ["イエロー", "男"] });
    expectRarityIn("XG5-004", ["N"]);
  });

  const ENEMY = () => ({ rush: [inst("SPEC-C0", "e0"), inst("SPEC-C2", "e2"), inst("SPEC-C2P", "e2p"), inst("SPEC-C3", "e3")], battle: [inst("SPEC-C0", "eb")] });

  it("XG5-004: NC【イエローボール】— 敵軍ラッシュエリアの、必要パワーの数字が2以下のユニット（「2+」・M ユニットも）から選べる。必要パワー3・敵軍バトルエリア・自軍のユニットは選べない（出典: atwiki/page-2186「敵軍ラッシュエリアから、必要パワーの数字が2以下のユニットを1体選び」）", () => {
    const s = nc("XG5-004:y", 3, { rush: [inst("SPEC-C0", "own")] }, ENEMY());
    expectChoiceFrom(s, "player1", "XG5-004");
    expect(choiceIds(s)).toEqual(["SPEC-C0:e0", "SPEC-C2:e2", "SPEC-C2P:e2p"]);
  });

  it("XG5-004: NC【イエローボール】— 選ぶかは任意（見送れる）（出典: atwiki/page-2186「置いてもよい」）", () => {
    expect(canSkip(nc("XG5-004:y", 3, {}, ENEMY()))).toBe(true);
  });

  it("XG5-004: NC【イエローボール】— 選んだユニットは持ち主（敵軍）のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-2186「持ち主のコマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = resolveAll(pick(nc("XG5-004:y", 3, {}, ENEMY()), "SPEC-C2:e2"));
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("command");
    expect(commandState(s, "player2", "SPEC-C2:e2")).toBe("held");
  });

  it("XG5-004: NC【イエローボール】— 敵軍コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-2186「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(nc("XG5-004:y", 3, {}, { ...ENEMY(), command: heldN(5) }), "SPEC-C2:e2"));
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("discard");
  });

  it("XG5-004: NC【イエローボール】— 選ばなければ何も起きない（出典: atwiki/page-2186「置いてもよい」）", () => {
    const s = resolveAll(skip(nc("XG5-004:y", 3, {}, ENEMY())));
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-005 ゴーグルピンク", () => {
  const TEXT = "※これが自軍バトルエリアにある間、敵軍Sユニットがバトルエリアに出たとき、これを自軍コマンドゾーンにホールド状態で置いてもよい。置けなければ手札に加える。 【ピンクリボン】「SP1」";

  it("XG5-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-2187）", () => {
    expectCatalogText("XG5-005", TEXT);
    expectStats("XG5-005", { name: "ゴーグルピンク", category: "ET", size: "S", bp: 1000, sp: "special", powerCost: 1, comboNumber: 5, features: ["ピンク", "女"] });
    expectRarityIn("XG5-005", ["N"]);
  });

  it("XG5-005: NC【ピンクリボン】— 5番目に出れば「SP1」（出典: atwiki/page-2187「【ピンクリボン】「SP1」」）", () => {
    const s = nc("XG5-005:p", 4);
    expect(spOf(s, "player1", "XG5-005:p")).toBe(1);
  });

  it("XG5-005: 5番目以外なら SP を持たない（出典: atwiki/page-2187「SP：！」）", () => {
    expect(spOf(nc("XG5-005:p", 3), "player1", "XG5-005:p")).toBe(0);
  });

  /** 敵軍（player2）のバトルフェイズに、player2 が unit をバトルエリアに出す（player1 のバトルエリアにピンク）。 */
  const enemyEnters = (unit: string, p1: Partial<GameState["players"]["player1"]> = {}) => {
    const [cid, suf] = unit.split(":") as [string, string];
    const s = st({ activePlayer: "player2", player1: { deck: deckCards(5), battle: [inst("XG5-005", "p")], ...p1 }, player2: { deck: deckCards(5, "e"), rush: [inst(cid, suf)] } }, EXTRA);
    return act(s, { type: "move_to_battle", playerId: "player2", instanceId: unit });
  };

  it("XG5-005: ※ — 自軍バトルエリアにある間、敵軍 S ユニットがバトルエリアに出たとき、これを自軍コマンドゾーンに置くかを自分が選べる（任意）（出典: atwiki/page-2187「敵軍Sユニットがバトルエリアに出たとき、これを自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = enemyEnters("SPEC-ES:e");
    expectChoiceFrom(s, "player1", "XG5-005");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-005: ※ — 置くことを選べば、自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-2187）", () => {
    const s = resolveAll(accept(enemyEnters("SPEC-ES:e")));
    expect(zoneOf(s, "player1", "XG5-005:p")).toBe("command");
    expect(commandState(s, "player1", "XG5-005:p")).toBe("held");
  });

  it("XG5-005: ※ — 自軍コマンドゾーンが5枚で置けなければ手札に加える（出典: atwiki/page-2187「置けなければ手札に加える」）", () => {
    const s = resolveAll(accept(enemyEnters("SPEC-ES:e", { command: heldN(5) })));
    expect(zoneOf(s, "player1", "XG5-005:p")).toBe("hand");
  });

  it("XG5-005: ※ — 敵軍 M ユニットがバトルエリアに出たときは何も起きない（出典: atwiki/page-2187「敵軍Sユニットが」）", () => {
    const s = enemyEnters("SPEC-EM:e");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-005");
  });

  it("XG5-005: ※ — これが自軍ラッシュエリアにあるときは何も起きない（出典: atwiki/page-2187「これが自軍バトルエリアにある間」）", () => {
    const s = enemyEnters("SPEC-ES:e", { battle: [], rush: [inst("XG5-005", "p")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-005");
  });
});

// ===========================================================================
describe("XG5-006 ゴーグルロボ", () => {
  const TEXT =
    "合体―ゴーグルジェット＋ゴーグルタンク＋ゴーグルダンプ ※これが自分の手札にある間、自軍ラッシュフェイズ中、自軍パワーが5以上あればこれを捨札にしてから、必要パワーの数字が4以下の自軍捨札を1枚選び手札に加えてもよい。 【ストップ・ザ・バトル】これをラッシュしたとき、次の効果を発動する⇒次の相手ターン、BP9000以下のユニットはアタックすることができない。";

  it("XG5-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-2231）", () => {
    expectCatalogText("XG5-006", TEXT);
    expectStats("XG5-006", { name: "ゴーグルロボ", category: "ET", size: "L", bp: 9000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG5-006", ["SR"]);
  });

  const PARTS = () => [inst("XG5-007", "j"), inst("XG5-008", "t"), inst("XG5-009", "d")];
  const rushBoardRobo = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushBoard({ hand: [inst("XG5-006", "robo")], rush: PARTS(), power: powerCards(5), command: releasedCat("ET", 1), ...p1 }, p2, EXTRA);

  it("XG5-006: 合体 — 自軍エリアのゴーグルジェット・ゴーグルタンク・ゴーグルダンプを捨札にし、パワー5でラッシュできる（出典: atwiki/page-2231「合体―ゴーグルジェット＋ゴーグルタンク＋ゴーグルダンプ」・R-ADD-06）", () => {
    const r = rushFromHand(rushBoardRobo(), "player1", "XG5-006:robo", { materials: ["XG5-007:j", "XG5-008:t", "XG5-009:d"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-006:robo")).toBe("rush");
    for (const p of ["XG5-007:j", "XG5-008:t", "XG5-009:d"]) expect(zoneOf(s, "player1", p)).toBe("discard");
  });

  it("XG5-006: 合体 — 素材が1体でも欠ければラッシュできない（出典: R-ADD-06「表記されたユニットを全て」）", () => {
    const r = rushFromHand(rushBoardRobo({ rush: PARTS().slice(0, 2) }), "player1", "XG5-006:robo");
    expect(r.ok && zoneOf(r.state, "player1", "XG5-006:robo") === "rush").toBe(false);
  });

  it("XG5-006: ※ — 手札にある間、自軍ラッシュフェイズ中、自軍パワーが5以上あれば、これを捨札にして自軍捨札の必要パワーの数字が4以下のカードを手札に加えられる（出典: atwiki/page-2231「これを捨札にしてから、必要パワーの数字が4以下の自軍捨札を1枚選び手札に加えてもよい」・カード評価「オペレーションのように使える効果名を持たないテキスト」）", () => {
    const s = rushBoard({ hand: [inst("XG5-006", "robo")], power: powerCards(5), discard: [inst("SPEC-C3", "d3"), inst("TST-UNIT-7", "d7")] }, {}, EXTRA);
    const fromRobo = legal(s).filter(
      (a) =>
        ("instanceId" in a && a.instanceId === "XG5-006:robo") ||
        ("sourceInstanceId" in a && a.sourceInstanceId === "XG5-006:robo") ||
        ("unitInstanceId" in a && a.unitInstanceId === "XG5-006:robo"),
    );
    expect(fromRobo.length).toBeGreaterThan(0);
  });

  it("XG5-006: 【ストップ・ザ・バトル】— ラッシュしたとき、次の相手ターン、BP9000以下のユニットはアタックできない（BP9500 のユニットはアタックできる）（出典: atwiki/page-2231「次の相手ターン、BP9000以下のユニットはアタックすることができない」）", () => {
    const r = rushFromHand(rushBoardRobo({ battle: [inst("SPEC-PLAIN", "def")] }, { rush: [inst("SPEC-E9000", "a"), inst("SPEC-E9500", "b")] }), "player1", "XG5-006:robo", {
      materials: ["XG5-007:j", "XG5-008:t", "XG5-009:d"],
    });
    expect(r.ok, r.error).toBe(true);
    let s = passTurnTo(endTurn(resolveAll(r.state)), "player2", "battle");
    s = passEntry(enter(s, "SPEC-E9000:a", "player2"), "player2");
    expect(canAttackAny(s, "SPEC-E9000:a", "player2")).toBe(false);
    s = enter(s, "SPEC-E9500:b", "player2");
    expect(canAttackAny(s, "SPEC-E9500:b", "player2")).toBe(true);
  });

  it("XG5-006: 【ストップ・ザ・バトル】— ラッシュしなければ（ラッシュエリアにあるだけ）次の相手ターンの BP9000以下のユニットはアタックできる（出典: atwiki/page-2231「これをラッシュしたとき」）", () => {
    let s = rushBoard({ rush: [inst("XG5-006", "robo")], battle: [inst("SPEC-PLAIN", "def")] }, { rush: [inst("SPEC-E9000", "a")] }, EXTRA);
    s = passTurnTo(endTurn(s), "player2", "battle");
    s = enter(s, "SPEC-E9000:a", "player2");
    expect(canAttackAny(s, "SPEC-E9000:a", "player2")).toBe(true);
  });
});

// ===========================================================================
describe("XG5-007 ゴーグルジェット", () => {
  const TEXT = "※ウイング 【ゴーゴーチェンジ】このターン、自軍コマンドゾーンにホールド状態でカードを置くとき、かわりにリリース状態で置くか捨札にしてもよい。";

  it("XG5-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-2188）", () => {
    expectCatalogText("XG5-007", TEXT);
    expectStats("XG5-007", { name: "ゴーグルジェット", category: "ET", size: "M", bp: 4000, sp: undefined, powerCost: "5+", comboNumber: 1, features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_command_or_discard" });
    expectRarityIn("XG5-007", ["N"]);
  });

  it("XG5-007: 追加条件 — 自軍 S ユニット1体をコマンドゾーンに送り、パワー5でラッシュできる（出典: atwiki/page-2188「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-007", "j")], rush: [inst("SPEC-PLAIN", "m")], power: powerCards(5), command: releasedCat("ET", 1) }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-007:j", { materials: ["SPEC-PLAIN:m"], destination: "command" });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-007:j")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:m")).toBe("command");
  });

  wingTests("XG5-007", "atwiki/page-2188");

  it("XG5-007: NC【ゴーゴーチェンジ】— このターン、自軍コマンドゾーンにホールド状態でカードを置くとき（RS-631 メガブラック【サテライトサーチ】）、かわりにリリース状態で置くか捨札にするかを選べる（出典: atwiki/page-2188「かわりにリリース状態で置くか捨札にしてもよい」）", () => {
    // 1番目にジェット（NC）、2・3番目にフィラー、4番目にメガブラック（CN4。NC）。
    let s = battle({ rush: [inst("XG5-007", "j"), ...fill(2), inst("RS-631", "mb")], deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] });
    s = passEntry(resolveAll(enter(s, "XG5-007:j")));
    s = enterSeq(s, ["TST-UNIT-0:f0", "TST-UNIT-0:f1"]);
    s = resolveAll(enter(s, "RS-631:mb"), ["SPEC-PLAIN:top", "release"]);
    expect(commandState(s, "player1", "SPEC-PLAIN:top")).toBe("released");
  });

  it("XG5-007: 1番目でなければ、ホールド状態で置くカードはそのままホールド状態で置かれる（RS-631 メガブラック【サテライトサーチ】）（出典: atwiki/page-2188「CN：1」・atwiki/page-1431「自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    let s = battle({ battle: fill(3), rush: [inst("RS-631", "mb")], deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] });
    s = resolveAll(enter(s, "RS-631:mb"), ["SPEC-PLAIN:top"]);
    expect(commandState(s, "player1", "SPEC-PLAIN:top")).toBe("held");
  });
});

