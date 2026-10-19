/**
 * カード別スペック: XG5-021〜XG5-027（クロスギャザー XG5 ザ・チケットブレイカー ボウケンブラック〜ボウケンピンクAT）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし。R-ERR-RS065 は RS-065 ボウケンイエローの項で XG5-023 とは別のカード）。
 *     grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索: 本範囲のカードの項はない
 *     （「ボウケン○○」は RS-062〜066・RS-241 等、同じ名前の別のカードの項だけ）。atwiki に転載された公式 Q&A: XG5-025 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-READ-01・R-KW-RESIST-01・R-CN-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  afterRed,
  attack,
  attackUntilRegister,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  commandState,
  deckCards,
  enter,
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
  payableFor,
  pick,
  pickAs,
  powerCards,
  reanimateTests,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  wingOffered,
  wingTests,
  zordDownTests,
  zoneOf,
} from "./XG5-021-040.helpers";

const DA8000 = sUnit("SPEC-DA8000", { category: "DA", bp: 8000, size: "M" });
const DA9000 = sUnit("SPEC-DA9000", { category: "DA", bp: 9000, size: "M" });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 2000 });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 2000 });
const DA_WB = sUnit("SPEC-DA-WB", { category: ["DA", "WB"], bp: 2000 } as never);
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const E500 = sUnit("SPEC-E500", { bp: 500 });
const RESIST_S = sUnit("SPEC-RESIST-S", { bp: 1000, text: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）" });
const RED = sUnit("SPEC-RED", { category: "ET", bp: 1000, features: ["レッド"] });
const BLACK = sUnit("SPEC-BLACK", { category: "ET", bp: 1000, features: ["ブラック"] });
const BLUE = sUnit("SPEC-BLUE", { category: "ET", bp: 1000, features: ["ブルー"] });
const PINK = sUnit("SPEC-PINK", { category: "ET", bp: 1000, features: ["ピンク"] });
const BLACK_M = sUnit("SPEC-BLACK-M", { category: "ET", bp: 3000, size: "M", features: ["ブラック"] });
const E6000 = sUnit("SPEC-E6000", { bp: 6000, size: "M" });
const E6500 = sUnit("SPEC-E6500", { bp: 6500, size: "M" });
const OP2 = { id: "SPEC-OP2", name: "SPEC-OP2", type: "operation", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 2 } as never;
const OP3 = { id: "SPEC-OP3", name: "SPEC-OP3", type: "operation", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 3 } as never;
const U1 = sUnit("SPEC-U1", { bp: 1000, powerCost: 1 });
const EXTRA = [DA8000, DA9000, DA_S, WB_S, DA_WB, E3000, E500, RESIST_S, RED, BLACK, BLUE, PINK, BLACK_M, E6000, E6500, OP2, OP3, U1];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncEnter(id, fillers, p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-021 ボウケンブラック", () => {
  const TEXT =
    "【ハンマーブレイク】「SP1」DAを持つ、本来のBPが8000以下の敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。（この効果は「ボウケンレッド」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG5-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-2195）", () => {
    expectCatalogText("XG5-021", TEXT);
    expectStats("XG5-021", { name: "ボウケンブラック", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: 5, features: ["ブラック", "男"] });
    expectRarityIn("XG5-021", ["N"]);
  });

  const ENEMY = () => ({
    rush: [inst("SPEC-DA8000", "a"), { ...inst("SPEC-DA9000", "b"), bpModifier: -2000 }, inst("SPEC-WB-S", "w")],
    battle: [{ ...inst("SPEC-DA-S", "c"), bpModifier: 7000 }, inst("SPEC-DA-WB", "m")],
  });

  it("XG5-021: NC【ハンマーブレイク】— 5番目に出れば「SP1」（出典: atwiki/page-2195「【ハンマーブレイク】「SP1」」）", () => {
    expect(spOf(nc("XG5-021:b", 4, {}, ENEMY()), "player1", "XG5-021:b")).toBe(1);
  });

  it.fails("XG5-021: NC【ハンマーブレイク】— DA を持つ、本来の BP が8000以下の敵軍ユニット（エリア・サイズを問わない。マルチカテゴリも）から選べる。いまの BP ではなく本来の BP で見る（任意）既知の不具合: CARD-XG5-021 NC は成立するが効果がない（選択が開かない）（出典: atwiki/page-2195「DAを持つ、本来のBPが8000以下の敵軍ユニットを1体選び、…置いてもよい」）", () => {
    const s = nc("XG5-021:b", 4, { rush: [inst("SPEC-DA-S", "own")] }, ENEMY());
    expectChoiceFrom(s, "player1", "XG5-021");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:c", "SPEC-DA-WB:m", "SPEC-DA8000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-021: NC【ハンマーブレイク】— 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる。置けなければ捨札 既知の不具合: CARD-XG5-021 NC の効果がない（出典: atwiki/page-2195「持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする」）", () => {
    let s = resolveAll(pick(nc("XG5-021:b", 4, {}, ENEMY()), "SPEC-DA8000:a"));
    expect(commandState(s, "player2", "SPEC-DA8000:a")).toBe("held");
    s = resolveAll(pick(nc("XG5-021:b", 4, {}, { ...ENEMY(), command: heldN(5) }), "SPEC-DA8000:a"));
    expect(zoneOf(s, "player2", "SPEC-DA8000:a")).toBe("discard");
  });

  it("XG5-021: （）—「ボウケンレッド」（XG5-020）からコンビネーションするとき（2番目）でも NC が成立し「SP1」になる（出典: atwiki/page-2195「この効果は「ボウケンレッド」からコンビネーションするときはナンバーに関係なく発動する」）", () => {
    expect(spOf(afterRed("XG5-021:b", [], {}, ENEMY(), EXTRA), "player1", "XG5-021:b")).toBe(1);
  });

  it("XG5-021: 5番目でなく「ボウケンレッド」からのコンビネーションでもなければ NC は成立しない（SP を持たない）（出典: atwiki/page-2195「CN：5」）", () => {
    expect(spOf(nc("XG5-021:b", 3, {}, ENEMY()), "player1", "XG5-021:b")).toBe(0);
  });
});

// ===========================================================================
describe("XG5-022 ボウケンブルー", () => {
  const TEXT =
    "※ウイング 【ナックルキャノン】これがアタックしたとき、自軍コマンドが3つ以下なら、自軍捨札から必要パワーの数字が2以下のオペレーションカードを1枚選び自軍コマンドゾーンにホールド状態で置いてもよい。（この効果は「ボウケンレッド」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG5-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-2196）", () => {
    expectCatalogText("XG5-022", TEXT);
    expectStats("XG5-022", { name: "ボウケンブルー", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["ブルー", "男"] });
    expectRarityIn("XG5-022", ["N"]);
  });

  wingTests("XG5-022", "atwiki/page-2196");

  const DISCARD = () => [inst("SPEC-OP2", "o2"), inst("SPEC-OP3", "o3"), inst("SPEC-U1", "u1")];
  /** 2番目に出てアタックする。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]> = {}, fillers = 1) =>
    attack(nc("XG5-022:b", fillers, { discard: DISCARD(), ...p1 }, { battle: [inst("SPEC-E500", "e")] }), "XG5-022:b", "SPEC-E500:e");

  it.fails("XG5-022: NC【ナックルキャノン】— アタックしたとき、自軍コマンドが3つ以下なら、自軍捨札の必要パワーの数字が2以下のオペレーションカードから選べる（必要パワー3・ユニットは選べない。任意）既知の不具合: CARD-XG5-022 選択が開かない（出典: atwiki/page-2196「自軍捨札から必要パワーの数字が2以下のオペレーションカードを1枚選び自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = attacked({ command: releasedCat("ET", 3) });
    expectChoiceFrom(s, "player1", "XG5-022");
    expect(choiceIds(s)).toEqual(["SPEC-OP2:o2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-022: NC【ナックルキャノン】— 選んだカードは自軍コマンドゾーンにホールド状態で置かれる 既知の不具合: CARD-XG5-022 置かれない（出典: atwiki/page-2196）", () => {
    const s = resolveAll(attacked(), ["SPEC-OP2:o2"]);
    expect(zoneOf(s, "player1", "SPEC-OP2:o2")).toBe("command");
    expect(commandState(s, "player1", "SPEC-OP2:o2")).toBe("held");
  });

  it("XG5-022: NC【ナックルキャノン】— 自軍コマンドが4つなら置かない（出典: atwiki/page-2196「自軍コマンドが3つ以下なら」）", () => {
    const s = resolveAll(attacked({ command: releasedCat("ET", 4) }), ["SPEC-OP2:o2"]);
    expect(zoneOf(s, "player1", "SPEC-OP2:o2")).toBe("discard");
  });

  it("XG5-022: 2番目でなく「ボウケンレッド」からのコンビネーションでもなければ、アタックしても置かない（出典: atwiki/page-2196「CN：2」）", () => {
    const s = resolveAll(attacked({}, 0), ["SPEC-OP2:o2"]);
    expect(zoneOf(s, "player1", "SPEC-OP2:o2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-023 ボウケンイエロー", () => {
  const TEXT =
    "【スクーパーファントム】「SP1」相手は、自分自身のコマンドゾーンからユニットカードを1枚選び自分自身のラッシュエリアに出す（このとき、出したユニットの効果は発動しない）。そうしたとき、出したユニットとこのユニットとでバトルする。（この効果は「ボウケンレッド」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG5-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-2197）", () => {
    expectCatalogText("XG5-023", TEXT);
    expectStats("XG5-023", { name: "ボウケンイエロー", category: "ET", size: "S", bp: 1000, sp: "special", powerCost: 0, comboNumber: 3, features: ["イエロー", "女"] });
    expectRarityIn("XG5-023", ["N"]);
  });

  const ENEMY = () => ({ command: [released("SPEC-E3000", "big"), { ...inst("SPEC-E500", "small"), commandHeld: true }, released("TST-OP", "op")] });

  it("XG5-023: NC【スクーパーファントム】— 3番目に出れば「SP1」（出典: atwiki/page-2197「【スクーパーファントム】「SP1」」）", () => {
    expect(spOf(nc("XG5-023:y", 2, {}, ENEMY()), "player1", "XG5-023:y")).toBe(1);
  });

  it.fails("XG5-023: NC【スクーパーファントム】— 相手が自分自身のコマンドゾーンのユニットカード（リリース状態・ホールド状態とも）から1枚選ぶ（オペレーションは選べない。見送れない）既知の不具合: CARD-XG5-023 NC は成立するが効果がない（相手の選択が開かない）（出典: atwiki/page-2197「相手は、自分自身のコマンドゾーンからユニットカードを1枚選び自分自身のラッシュエリアに出す」）", () => {
    const s = nc("XG5-023:y", 2, {}, ENEMY());
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG5-023");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:big", "SPEC-E500:small"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG5-023: NC【スクーパーファントム】— 選ばれたユニットは相手のラッシュエリアに出て、これとバトルする（BP の低いほうが撃破される）既知の不具合: CARD-XG5-023 NC の効果がない（出典: atwiki/page-2197「そうしたとき、出したユニットとこのユニットとでバトルする」・カード評価「ラッシュされたユニットと強制的にバトルしなければならない」）", () => {
    let s = resolveAll(pickAs(nc("XG5-023:y", 2, {}, ENEMY()), "player2", "SPEC-E3000:big"));
    expect(zoneOf(s, "player2", "SPEC-E3000:big")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-023:y")).toBe("discard");
    s = resolveAll(pickAs(nc("XG5-023:y", 2, {}, ENEMY()), "player2", "SPEC-E500:small"));
    expect(zoneOf(s, "player2", "SPEC-E500:small")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-023:y")).toBe("battle");
  });

  it("XG5-023: NC【スクーパーファントム】— 相手のコマンドゾーンにユニットカードがなければ何も起きない（バトルしない）（出典: atwiki/page-2197「そうしたとき」）", () => {
    const s = resolveAll(nc("XG5-023:y", 2, {}, { command: [released("TST-OP", "op")] }));
    expect(zoneOf(s, "player1", "XG5-023:y")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-OP:op")).toBe("command");
  });

  it("XG5-023: （）—「ボウケンレッド」からコンビネーションするとき（2番目）でも「SP1」になる（出典: atwiki/page-2197「ナンバーに関係なく発動する」）", () => {
    expect(spOf(afterRed("XG5-023:y", [], {}, { command: [released("TST-OP", "op")] }, EXTRA), "player1", "XG5-023:y")).toBe(1);
  });
});

// ===========================================================================
describe("XG5-024 ボウケンピンク", () => {
  const TEXT =
    "※リードET 【プレシャスの確保】自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（置けなければ手札に加える）。そうしたとき、相手も同じようにしてもよい。（この効果は、「ボウケンレッド」からコンビネーションするときはナンバーに関係なく発動する）";

  it("XG5-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-2240）", () => {
    expectCatalogText("XG5-024", TEXT);
    expectStats("XG5-024", { name: "ボウケンピンク", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 4, features: ["ピンク", "女"] });
    expectRarityIn("XG5-024", ["NR"]);
  });

  it("XG5-024: ※リードET — 自軍エリアのこれを、ET のオペレーションを使用するためのコマンドとしてホールドできる（出典: atwiki/page-2240「※リードET」・R-KW-READ-01・atwiki/page-2250 Q1）", () => {
    const s = rushBoard({ hand: [inst("TST-OP-ET", "op")], rush: [inst("XG5-024", "p")], command: [released("TST-OP-ET", "rel")], power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "TST-OP-ET:op")).toContain("XG5-024:p");
  });

  const DECKS = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    nc("XG5-024:p", 3, { deck: [...deckCards(3), inst("SPEC-WB-S", "bot")], ...p1 }, { deck: [...deckCards(3, "e"), inst("SPEC-E500", "ebot")], ...p2 });

  it.fails("XG5-024: NC【プレシャスの確保】— 自軍山札の下の1枚を自軍コマンドゾーンにホールド状態で置くかを選べる（任意）既知の不具合: CARD-XG5-024 NC は成立するが効果がない（出典: atwiki/page-2240「自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = DECKS();
    expectChoiceFrom(s, "player1", "XG5-024");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-024: NC【プレシャスの確保】— 置けば、相手も自分自身の山札の下の1枚を自分自身のコマンドゾーンにホールド状態で置くかを選べる 既知の不具合: CARD-XG5-024 NC の効果がない（出典: atwiki/page-2240「そうしたとき、相手も同じようにしてもよい」）", () => {
    let s = accept(DECKS());
    expect(commandState(s, "player1", "SPEC-WB-S:bot")).toBe("held");
    expect(choicePlayer(s)).toBe("player2");
    s = resolveAll(accept(s));
    expect(commandState(s, "player2", "SPEC-E500:ebot")).toBe("held");
  });

  it.fails("XG5-024: NC【プレシャスの確保】— 自軍コマンドゾーンが5枚で置けなければ手札に加える 既知の不具合: CARD-XG5-024 NC の効果がない（出典: atwiki/page-2240「置けなければ手札に加える」）", () => {
    const s = accept(DECKS({ command: heldN(5) }));
    expect(zoneOf(s, "player1", "SPEC-WB-S:bot")).toBe("hand");
  });

  it("XG5-024: 4番目でなければ（「ボウケンレッド」からでもなければ）発動しない（山札の下はそのまま）（出典: atwiki/page-2240「CN：4」）", () => {
    const s = resolveAll(nc("XG5-024:p", 2, { deck: [...deckCards(3), inst("SPEC-WB-S", "bot")] }));
    expect(zoneOf(s, "player1", "SPEC-WB-S:bot")).toBe("deck");
  });
});

// ===========================================================================
describe("XG5-025 ボウケンブルーAT", () => {
  const TEXT =
    "※ウイング ※これが撃破されて捨札になったとき、自軍捨札に「ボウケンブルー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【上空からの牽制】これが自軍エリアにある間、リリース状態の敵軍ユニットは次の制限を受ける⇒これは、自分自身のターン中、ホールドすることができない。";

  it("XG5-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-2265）", () => {
    expectCatalogText("XG5-025", TEXT);
    expectStats("XG5-025", { name: "ボウケンブルーAT", category: "ET", size: "S", bp: 4500, sp: undefined, powerCost: "7-", comboNumber: undefined, features: ["ブルー", "男", "アクセルテクター"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG5-025", ["R"]);
  });

  zordDownTests("XG5-025", "XG5-022", "ボウケンブルー", "atwiki/page-2265", "ET");
  wingTests("XG5-025", "atwiki/page-2265");
  reanimateTests("XG5-025", "XG5-022", "ボウケンブルー", "atwiki/page-2265");

  /** 敵軍（player2）のバトルフェイズ。player2 のラッシュエリアにウイングを持つ RS-631 メガブラック（リリース状態）。 */
  const enemyTurn = (p1: Partial<GameState["players"]["player1"]>) =>
    st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), rush: [inst("RS-631", "w")], battle: [inst("SPEC-E500", "x")] } }, EXTRA);

  it.fails("XG5-025:【上空からの牽制】— これが自軍エリアにある間、リリース状態の敵軍ユニットは自分自身のターン中ホールドできない（ウイングを発動できない） 既知の不具合: CARD-XG5-025 敵軍ユニットのホールド（ウイング）が制限されない（出典: atwiki/page-2265「リリース状態の敵軍ユニットは…自分自身のターン中、ホールドすることができない」・カード評価「相手のウイング、コール、リードといった厄介な効果を封印出来る」）", () => {
    expect(wingOffered(enemyTurn({ battle: [inst("SPEC-WB-S", "d")], rush: [inst("XG5-025", "at")] }), "RS-631:w", "player2")).toBe(false);
  });

  it("XG5-025:【上空からの牽制】— これがなければ敵軍ユニットはウイングを発動できる（出典: atwiki/page-2265「これが自軍エリアにある間」）", () => {
    expect(wingOffered(enemyTurn({ battle: [inst("SPEC-WB-S", "d")] }), "RS-631:w", "player2")).toBe(true);
  });

  it("XG5-025:【上空からの牽制】— 自軍ターン中は敵軍ユニットもホールドできる（敵軍ユニットのレジスト）（出典: atwiki/page-2265「自分自身のターン中」・カード評価「効果は敵軍ターン中のみ」）", () => {
    let s = battle({ battle: [inst("TST-UNIT-7", "big")], rush: [inst("XG5-025", "at")] }, { battle: [inst("SPEC-RESIST-S", "r")] });
    s = attack(s, "TST-UNIT-7:big", "SPEC-RESIST-S:r");
    for (let i = 0; i < 6 && !registerOffered(s, "player2"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(registerOffered(s, "player2")).toBe(true);
  });

  it("XG5-025: 公式Q&A —「ラッシュするとき可能ならホールド状態で置く」RK-245 仮面ライダーキバは、これがあってもホールド状態でラッシュされる（出典: atwiki/page-2265 Q1「ホールド状態になります」）", () => {
    const s0 = st(
      { phase: "rush", activePlayer: "player2", player1: { deck: deckCards(5), rush: [inst("XG5-025", "at")] }, player2: { deck: deckCards(5, "e"), hand: [inst("RK-245", "kiba")], command: releasedCat("MA", 1), power: powerCards(4) } },
      EXTRA,
    );
    const r = rushFromHand(s0, "player2", "RK-245:kiba");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player2", "RK-245:kiba")).toBe("rush");
    expect(cardIn(s, "player2", "RK-245:kiba")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG5-026 ボウケンイエローAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ボウケンイエロー」のカードを1枚選び、自軍ラッシュエリアに出す。 【仲間の支え】｢SP1｣ 自軍バトルエリアに、特徴に「レッド」「ブラック」「ブルー」「ピンク」を持つSユニットがそれぞれあれば、本来のBPが6000以下の敵軍ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG5-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-2272）", () => {
    expectCatalogText("XG5-026", TEXT);
    expectStats("XG5-026", { name: "ボウケンイエローAT", category: "ET", size: "S", bp: 2500, sp: "special", powerCost: "7-", comboNumber: 5, features: ["イエロー", "女", "アクセルテクター"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG5-026", ["R"]);
  });

  zordDownTests("XG5-026", "XG5-023", "ボウケンイエロー", "atwiki/page-2272", "ET");
  reanimateTests("XG5-026", "XG5-023", "ボウケンイエロー", "atwiki/page-2272");

  const FOUR = () => [inst("SPEC-RED", "r"), inst("SPEC-BLACK", "k"), inst("SPEC-BLUE", "b"), inst("SPEC-PINK", "p")];
  const ENEMY = () => ({ rush: [inst("SPEC-E6000", "a"), inst("SPEC-E6500", "b")], battle: [{ ...inst("SPEC-E500", "c"), bpModifier: 6000 }] });
  const at5 = (left = FOUR(), p2: Partial<GameState["players"]["player2"]> = ENEMY()) =>
    act(battle({ battle: left, rush: [inst("XG5-026", "y")] }, p2), { type: "move_to_battle", playerId: "player1", instanceId: "XG5-026:y" });

  it.fails("XG5-026: NC【仲間の支え】— 5番目に出れば「SP1」 既知の不具合: CARD-XG5-026 5番目に出ても SP が付かない（出典: atwiki/page-2272「【仲間の支え】｢SP1｣」）", () => {
    expect(spOf(at5(), "player1", "XG5-026:y")).toBe(1);
  });

  it.fails("XG5-026: NC【仲間の支え】— 自軍バトルエリアに「レッド」「ブラック」「ブルー」「ピンク」の S ユニットがそれぞれあれば、本来の BP が6000以下の敵軍ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く（本来の BP6500 は残る）既知の不具合: CARD-XG5-026 NC は成立するが効果がない（出典: atwiki/page-2272「本来のBPが6000以下の敵軍ユニットをすべて持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(at5());
    expect(commandState(s, "player2", "SPEC-E6000:a")).toBe("held");
    expect(commandState(s, "player2", "SPEC-E500:c")).toBe("held");
    expect(zoneOf(s, "player2", "SPEC-E6500:b")).toBe("rush");
  });

  it.fails("XG5-026: NC【仲間の支え】— 置けなければ捨札にする 既知の不具合: CARD-XG5-026 NC の効果がない（出典: atwiki/page-2272「置けなければ捨札にする」）", () => {
    const s = resolveAll(at5(FOUR(), { ...ENEMY(), command: heldN(5) }));
    expect(zoneOf(s, "player2", "SPEC-E6000:a")).toBe("discard");
  });

  it("XG5-026: NC【仲間の支え】— 4つの特徴の S ユニットがそろわなければ（「ピンク」がない・「ブラック」が M ユニット）何も置かない（出典: atwiki/page-2272「特徴に「レッド」「ブラック」「ブルー」「ピンク」を持つSユニットがそれぞれあれば」）", () => {
    let s = resolveAll(at5([inst("SPEC-RED", "r"), inst("SPEC-BLACK", "k"), inst("SPEC-BLUE", "b"), inst("SPEC-RED", "r2")]));
    expect(zoneOf(s, "player2", "SPEC-E6000:a")).toBe("rush");
    s = resolveAll(at5([inst("SPEC-RED", "r"), inst("SPEC-BLACK-M", "k"), inst("SPEC-BLUE", "b"), inst("SPEC-PINK", "p")]));
    expect(zoneOf(s, "player2", "SPEC-E6000:a")).toBe("rush");
  });
});

// ===========================================================================
describe("XG5-027 ボウケンピンクAT", () => {
  const TEXT =
    "※レジスト ※これが撃破されて捨札になったとき、自軍捨札から「ボウケンピンク」のカードを1枚選び、自軍ラッシュエリアに出す。 【デュアルクラッシャー・コンビネーションクラッシュ】このターン、次に敵軍ユニットがホールド状態になったとき、そのユニットを撃破する。";

  it("XG5-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-2270）", () => {
    expectCatalogText("XG5-027", TEXT);
    expectStats("XG5-027", { name: "ボウケンピンクAT", category: "ET", size: "S", bp: 3500, sp: undefined, powerCost: "7-", comboNumber: 1, features: ["ピンク", "女", "アクセルテクター"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG5-027", ["R"]);
  });

  zordDownTests("XG5-027", "XG5-024", "ボウケンピンク", "atwiki/page-2270", "ET");
  reanimateTests("XG5-027", "XG5-024", "ボウケンピンク", "atwiki/page-2270");

  it("XG5-027: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2270「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-027", "pk")] }, "XG5-027:pk"))).toBe(true);
  });

  /** 1番目にピンクAT（NC、または fillers 体の後）、次に TST-UNIT-7 を出して敵軍のレジスト持ちにアタックし、相手のレジストの提示まで進める。 */
  const registerAfter = (fillers: number) => {
    let s = battle({ battle: fill(fillers), rush: [inst("XG5-027", "pk"), inst("TST-UNIT-7", "big")] }, { battle: [inst("SPEC-RESIST-S", "r")] });
    s = passEntry(resolveAll(enter(s, "XG5-027:pk")));
    s = attack(enter(s, "TST-UNIT-7:big"), "TST-UNIT-7:big", "SPEC-RESIST-S:r");
    for (let i = 0; i < 6 && !registerOffered(s, "player2"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(registerOffered(s, "player2")).toBe(true);
    return settle(act(s, legal(s).find((a) => a.type === "use_register" && a.playerId === "player2")!));
  };

  it.fails("XG5-027: NC【デュアルクラッシャー・コンビネーションクラッシュ】— 成立したときにはユニットを選ばない（選択は開かない）既知の不具合: CARD-XG5-027 NC で敵軍ユニットを1体選ばせてホールドさせる（本文にない処理）（出典: atwiki/page-2270「このターン、次に敵軍ユニットがホールド状態になったとき」）", () => {
    const s = nc("XG5-027:pk", 0, {}, { battle: [inst("SPEC-RESIST-S", "r")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-027");
    expect(cardIn(s, "player2", "SPEC-RESIST-S:r")?.commandHeld ?? false).toBe(false);
  });

  it.fails("XG5-027: NC【デュアルクラッシャー・コンビネーションクラッシュ】— このターン、次に敵軍ユニットがホールド状態になったとき（相手がレジストでホールドしたとき）、そのユニットを撃破する 既知の不具合: CARD-XG5-027 NC で敵軍ユニットを選んでホールドさせ、その後のアタックができなくなる（出典: atwiki/page-2270「このターン、次に敵軍ユニットがホールド状態になったとき、そのユニットを撃破する」・カード評価「単純にレジストを封じられる」）", () => {
    const s = registerAfter(0);
    expect(zoneOf(s, "player2", "SPEC-RESIST-S:r")).toBe("discard");
  });

  it("XG5-027: 1番目でなければ（NC 不成立）、レジストでホールドした敵軍ユニットはその場に留まる（出典: atwiki/page-2270「CN：1」・R-KW-RESIST-01）", () => {
    const s = registerAfter(1);
    expect(zoneOf(s, "player2", "SPEC-RESIST-S:r")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-RESIST-S:r")?.commandHeld).toBe(true);
  });
});

void skip;
