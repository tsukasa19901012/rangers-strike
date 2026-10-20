/**
 * カード別スペック: XG5-061〜XG5-067（クロスギャザー XG5 ザ・チケットブレイカー バッファローアンデッド〜仮面ライダーナイト）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG5-066 Q1/Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CALL-01・R-KW-READ-01・R-KW-WING-01）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 * オペレーションの特徴（atwiki の「特徴：アドベントカード」）はカタログに項目がなく、照合しない。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activateField,
  attack,
  beltUsed,
  canActivateField,
  canCounter,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  endPhase,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  faceUp,
  inst,
  leadTestsFor,
  payableFor,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushedInstead,
  settle,
  skipFrom,
  st,
  sUnit,
  useCounter,
  wingTests,
  zoneOf,
} from "./XG5-061-080.helpers";

const MECHA = sUnit("SPEC-MECHA", { category: "WB", bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { category: "WB", bp: 1000, size: "M", features: ["メカ"] });
const RIDER = sUnit("SPEC-RIDER", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const WB_UNIT = sUnit("SPEC-WB-UNIT", { category: "WB", bp: 1000, powerCost: 2 });
const EXTRA = [MECHA, MECHA_M, RIDER, WB_UNIT];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

/** 「自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして…発動できる」の共通テスト（確認と、選ばないとき）。 */
function insteadTests(id: string, cost: number, page: string, effect: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
  const board = () => rushBoard({ hand: [inst(id, "x")], power: powerCards(cost), command: releasedCat("DA", 1), ...p1 }, p2, EXTRA);
  it(`${id}:【${effect}】— 自軍ラッシュフェイズにこれをラッシュするとき、ラッシュエリアに出すかわりに捨札にして発動するかを選べる（任意）（出典: ${page}「自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、次の効果を発動できる」）`, () => {
    const r = rushFromHand(board(), "player1", `${id}:x`);
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", id);
    expect(canSkip(r.state)).toBe(true);
  });
  it(`${id}:【${effect}】— 選ばなければ通常どおりラッシュエリアに出る（出典: ${page}「発動できる」）`, () => {
    const r = rushFromHand(board(), "player1", `${id}:x`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(skipFrom(r.state, id), "player1", `${id}:x`)).toBe("rush");
  });
}

// ===========================================================================
describe("XG5-061 バッファローアンデッド", () => {
  const TEXT =
    "【スペード8－マグネット】自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、次の効果を発動できる⇒敵軍ラッシュエリアにある特徴「メカ」を持つSユニットをすべて敵軍バトルエリアに出してもよい（出す順番は自分が選ぶ）。";

  it("XG5-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-2183）", () => {
    expectCatalogText("XG5-061", TEXT);
    expectMultiStats("XG5-061", { name: "バッファローアンデッド", category: ["DA"], size: "S", bp: 3500, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["アンデッド", "獣"] });
    expectRarityIn("XG5-061", ["N"]);
  });

  const ENEMY = () => ({ rush: [inst("SPEC-MECHA", "a"), inst("SPEC-MECHA", "b"), inst("SPEC-MECHA-M", "m"), inst("TST-UNIT-0", "o")] });
  insteadTests("XG5-061", 4, "atwiki/page-2183", "スペード8－マグネット", {}, ENEMY());

  it("XG5-061:【スペード8－マグネット】— 発動すれば、これは捨札になり、敵軍ラッシュエリアの「メカ」の S ユニットをすべて敵軍バトルエリアに出せる（M ユニット・メカでないユニットは残る）（出典: atwiki/page-2183「敵軍ラッシュエリアにある特徴「メカ」を持つSユニットをすべて敵軍バトルエリアに出してもよい」）", () => {
    const s = resolveAll(rushedInstead(rushBoard({ hand: [inst("XG5-061", "x")], power: powerCards(4), command: releasedCat("DA", 1) }, ENEMY(), EXTRA), "XG5-061:x"));
    expect(zoneOf(s, "player1", "XG5-061:x")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MECHA:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-MECHA:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-MECHA-M:m")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:o")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-062 モスアンデッド", () => {
  const TEXT = "【ハート8－リフレクト】自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、次の効果を発動できる⇒このターン、相手はカウンターを発動できない。";

  it("XG5-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-2209）", () => {
    expectCatalogText("XG5-062", TEXT);
    expectMultiStats("XG5-062", { name: "モスアンデッド", category: ["DA"], size: "S", bp: 1500, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["アンデッド", "昆虫"] });
    expectRarityIn("XG5-062", ["N"]);
  });

  insteadTests("XG5-062", 3, "atwiki/page-2209", "ハート8－リフレクト");

  it("XG5-062:【ハート8－リフレクト】— 発動したターン、相手はカウンター（XG5-064 コンファインベント。自軍バトルフェイズ開始時）を使えない（出典: atwiki/page-2209「このターン、相手はカウンターを発動できない」）", () => {
    let s = rushedInstead(rushBoard({ hand: [inst("XG5-062", "x")], power: powerCards(3), command: releasedCat("DA", 1) }, { hand: [inst("XG5-064", "cv")], command: releasedCat("WB", 1, "ec") }, EXTRA), "XG5-062:x");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG5-062:x")).toBe("discard");
    s = settle(endPhase(s));
    expect(canCounter(s, "XG5-064:cv", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("XG5-063 ペッカーアンデッド", () => {
  const TEXT =
    "【ダイヤ4－ラピッド】自軍ラッシュフェイズ中、これをラッシュするとき、ラッシュエリアに出すかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは次の能力を得る⇒これはアタックとストライクを1度ずつ行ってもよい。";

  it("XG5-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-2210）", () => {
    expectCatalogText("XG5-063", TEXT);
    expectMultiStats("XG5-063", { name: "ペッカーアンデッド", category: ["DA"], size: "S", bp: 2500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["アンデッド", "獣"] });
    expectRarityIn("XG5-063", ["N"]);
  });

  const board = () => rushBoard({ hand: [inst("XG5-063", "x")], rush: [inst("SPEC-RIDER", "r"), inst("TST-UNIT-0", "o")], power: powerCards(2), command: releasedCat("DA", 1) }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA);

  it("XG5-063:【ダイヤ4－ラピッド】— ラッシュするとき、捨札にして「仮面ライダー」を持つ自軍ユニットを選べる（任意。持たないユニットは選べない）（出典: atwiki/page-2210「ラッシュエリアに出すかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい」）", () => {
    const r = rushFromHand(board(), "player1", "XG5-063:x");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG5-063");
    expect(choiceIds(r.state)).toEqual(["SPEC-RIDER:r"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it("XG5-063:【ダイヤ4－ラピッド】— 選んだユニットは、このターン、アタックしたあとにストライクも行える（出典: atwiki/page-2210「これはアタックとストライクを1度ずつ行ってもよい」）", () => {
    const r = rushFromHand(board(), "player1", "XG5-063:x");
    let s = resolveAll(pick(r.state, "SPEC-RIDER:r"));
    expect(zoneOf(s, "player1", "XG5-063:x")).toBe("discard");
    s = settle(endPhase(s));
    s = settle(attack(enter(s, "SPEC-RIDER:r"), "SPEC-RIDER:r", "TST-UNIT-0:e"));
    expect(canStrike(s, "SPEC-RIDER:r")).toBe(true);
  });

  it("XG5-063:【ダイヤ4－ラピッド】— 選ばなければ通常どおりラッシュエリアに出る（出典: atwiki/page-2210「選んでもよい」）", () => {
    const r = rushFromHand(board(), "player1", "XG5-063:x");
    expect(zoneOf(skipFrom(r.state, "XG5-063"), "player1", "XG5-063:x")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-064 コンファインベント", () => {
  const TEXT = "※カウンター 敵軍バトルフェイズ開始時に発動できる⇒敵軍ユニットまたは敵軍ビークルを1体選ぶ。このターン、そのユニットまたはビークルの効果名を持つテキストは無効になり、発動もできない。";

  it("XG5-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-2211）", () => {
    expectCatalogText("XG5-064", TEXT);
    expectOpStats("XG5-064", { name: "コンファインベント", category: "WB", powerCost: 0 });
    expectRarityIn("XG5-064", ["N"]);
  });

  /** 敵軍（player2）のラッシュフェイズを終えてバトルフェイズに入る。player1 の手札にコンファインベント。 */
  const enemyBattleStart = () =>
    settle(endPhase(st({ phase: "rush", activePlayer: "player2", player1: { hand: [inst("XG5-064", "cv")], command: releasedCat("WB", 1), deck: deckCards(5) }, player2: { rush: [inst("XG5-077", "kb"), inst("XG5-057", "rb")], deck: deckCards(5, "e") } }, EXTRA), "player2"));

  it("XG5-064: ※カウンター — 敵軍バトルフェイズ開始時に使える（出典: atwiki/page-2211「敵軍バトルフェイズ開始時に発動できる」）", () => {
    expect(canCounter(enemyBattleStart(), "XG5-064:cv")).toBe(true);
  });

  it("XG5-064: 敵軍ユニットか敵軍ビークルを1体選ぶ（出典: atwiki/page-2211「敵軍ユニットまたは敵軍ビークルを1体選ぶ」）", () => {
    const s = useCounter(enemyBattleStart(), "XG5-064:cv");
    expectChoiceFrom(s, "player1", "XG5-064");
    expect([...choiceIds(s)].sort()).toEqual(["XG5-057:rb", "XG5-077:kb"]);
  });

  it("XG5-064: 自軍バトルフェイズ開始時には使えない（出典: atwiki/page-2211「敵軍バトルフェイズ開始時」・※カウンター）", () => {
    const s = settle(endPhase(rushBoard({ hand: [inst("XG5-064", "cv")], command: releasedCat("WB", 1) }, {}, EXTRA)));
    expect(canCounter(s, "XG5-064:cv")).toBe(false);
  });
});

// ===========================================================================
describe("XG5-065 タイムベント", () => {
  const TEXT = "追加条件を持たないユニットをすべて撃破する。";

  it("XG5-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-2261）", () => {
    expectCatalogText("XG5-065", TEXT);
    expectOpStats("XG5-065", { name: "タイムベント", category: "WB", powerCost: 8 });
    expectRarityIn("XG5-065", ["R"]);
  });

  it("XG5-065: 両軍の、追加条件を持たないユニットをすべて撃破する（エリア・サイズを問わない）。追加条件を持つユニットは残る（出典: atwiki/page-2261「追加条件を持たないユニットをすべて撃破する」）", () => {
    const s = resolveAll(beltUsed("XG5-065", "WB", 8, { rush: [inst("TST-UNIT-0", "a"), inst("XG5-049", "c")] }, { rush: [inst("TST-UNIT-2", "b")], battle: [inst("XG5-043", "d"), inst("TST-UNIT-0", "e")] }, EXTRA));
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:b")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-049:c")).toBe("rush");
    expect(zoneOf(s, "player2", "XG5-043:d")).toBe("battle");
  });
});

// ===========================================================================
describe("XG5-066 仮面ライダーベルデ", () => {
  const TEXT =
    "※リードWB 【コピーベント】これが自軍エリアにある間、自軍ラッシュフェイズ中、次の効果を発動できる⇒自軍ゾーンのオモテ向きのカードから、特徴「ミラーライダー」を持つユニットのカードを1枚選びこれと置き換えてもよい。ただし、必要パワーは満たすこと。";

  it("XG5-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-2212）", () => {
    expectCatalogText("XG5-066", TEXT);
    expectMultiStats("XG5-066", { name: "仮面ライダーベルデ", category: ["WB"], size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG5-066", ["N"]);
  });

  leadTestsFor("XG5-066", "WB", "atwiki/page-2212");

  // 自軍パワーゾーン: オモテ向きの XG5-067 仮面ライダーナイト（ミラーライダー・必要パワー4）・XG5-068 ナイトサバイブ（7）・TST-UNIT-0（ミラーライダーでない）、ほか3枚（パワー6）。
  const board = () => rushBoard({ rush: [inst("XG5-066", "v")], power: [faceUp("XG5-067", "n"), faceUp("XG5-068", "ns"), faceUp("TST-UNIT-0", "o"), ...powerCards(3)] }, {}, EXTRA);

  it("XG5-066:【コピーベント】— 自軍ラッシュフェイズ中に起動でき、自軍ゾーンのオモテ向きの「ミラーライダー」のユニットのカードのうち、必要パワーを満たすものを選べる（出典: atwiki/page-2212「自軍ゾーンのオモテ向きのカードから、特徴「ミラーライダー」を持つユニットのカードを1枚選びこれと置き換えてもよい。ただし、必要パワーは満たすこと」）", () => {
    const s0 = board();
    expect(canActivateField(s0, "XG5-066:v")).toBe(true);
    const s = activateField(s0, "XG5-066:v");
    expectChoiceFrom(s, "player1", "XG5-066");
    expect(choiceIds(s)).toEqual(["XG5-067:n"]);
  });

  it("XG5-066:【コピーベント】— 選んだカードとこれを置き換える（ナイトがラッシュエリアに、ベルデがパワーゾーンに）（出典: atwiki/page-2212「これと置き換えてもよい」）", () => {
    const s = resolveAll(pick(activateField(board(), "XG5-066:v"), "XG5-067:n"));
    expect(zoneOf(s, "player1", "XG5-067:n")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-066:v")).toBe("power");
  });

  it("XG5-066:【コピーベント】— 自軍バトルフェイズ中は起動できない（出典: atwiki/page-2212「自軍ラッシュフェイズ中」）", () => {
    const s = battle({ rush: [inst("XG5-066", "v")], power: [faceUp("XG5-067", "n"), ...powerCards(5)] });
    expect(canActivateField(s, "XG5-066:v")).toBe(false);
  });

  it.todo("XG5-066: 公式Q&A — RK-043 ライドシューター【突入】の直後に【コピーベント】でラッシュするミラーライダーは、必要パワーの数字が3少なくなる（出典: atwiki/page-2212 Q1「はい、そのとおりです」）—【コピーベント】の起動自体がエンジンにないため、【突入】との組み合わせを組めない");
  it.todo("XG5-066: 公式Q&A —「－」の追加条件（RK-333 仮面ライダー龍騎サバイブ）を満たして必要パワーを減らすことはできない（出典: atwiki/page-2212 Q2「いいえ、それはできません」）—【コピーベント】の起動自体がエンジンになく、選べないことが Q2 によるものか確かめられない");
});

// ===========================================================================
describe("XG5-067 仮面ライダーナイト", () => {
  const TEXT = "※ウイング ※コールWB";

  it("XG5-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-2213）", () => {
    expectCatalogText("XG5-067", TEXT);
    expectMultiStats("XG5-067", { name: "仮面ライダーナイト", category: ["WB"], size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG5-067", ["N"]);
  });

  wingTests("XG5-067", "atwiki/page-2213");

  it("XG5-067: ※コールWB — 自軍ラッシュエリアのこれを、WB のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-2213「※コールWB」・R-KW-CALL-01）", () => {
    const s = rushBoard({ hand: [inst("SPEC-WB-UNIT", "u")], rush: [inst("XG5-067", "n")], command: releasedCat("WB", 1, "wc"), power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-WB-UNIT:u")).toContain("XG5-067:n");
  });

  it("XG5-067: ※コールWB — オペレーションを使うためのコマンドにはできない（出典: R-KW-CALL-01「オペレーションには使えない」）", () => {
    const s = rushBoard({ hand: [inst("TST-OP", "op")], rush: [inst("XG5-067", "n")], command: releasedCat("WB", 1, "wc"), power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "TST-OP:op") ?? []).not.toContain("XG5-067:n");
  });
});
