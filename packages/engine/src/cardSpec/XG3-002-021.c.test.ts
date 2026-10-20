/**
 * カード別スペック: XG3-016〜XG3-021（クロスギャザー ザ・Wインパクト ガオゴリラ〜カブトライジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG3-」とカード名で検索:
 *     本範囲のカードの項はない（同名の別カード RS-312 カブトライジャー・RS-313 クワガライジャーの項だけ）。本範囲のカードページに atwiki 転載の公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAKUS-01・R-KW-RESIST-01・R-CN-02・R-BTL-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attackersOf,
  canEnter,
  canSkip,
  categoriesOf,
  choiceIds,
  deckCards,
  enter,
  enterAny,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  heldUnit,
  inst,
  lineUp,
  passEntry,
  pick,
  PLAIN_VEHICLE,
  powerCards,
  releasedCat,
  resistTests,
  resolveAll,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  toTurnEnd,
  zoneOf,
} from "./XG3-002-021.helpers";

const MA_L = sUnit("SPEC-MA-L", { category: "MA", bp: 13000, size: "L" });
const WB_L = sUnit("SPEC-WB-L", { category: "WB", bp: 13000, size: "L" });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000, sp: undefined });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000, sp: undefined });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000, sp: 1 });
const DA_S0 = sUnit("SPEC-DA-S0", { category: "DA", bp: 1000, sp: undefined });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const M3000 = sUnit("SPEC-M3000", { bp: 3000, size: "M" });
const BEAST_S = sUnit("SPEC-BEAST-S", { bp: 2000, features: ["獣"] });
const BEAST_BIG = sUnit("SPEC-BEAST-BIG", { bp: 6000, size: "M", features: ["獣"] });
const EXTRA = [MA_L, WB_L, MA_S, WB_S, DA_S, DA_S0, DA_M, M3000, BEAST_S, BEAST_BIG, PLAIN_VEHICLE];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-016 ガオゴリラ", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【バナナボム】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態の敵軍ユニットを1体選び撃破してもよい。";

  it("XG3-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-1894）", () => {
    expectCatalogText("XG3-016", TEXT);
    expectStats("XG3-016", { name: "ガオゴリラ", category: "WB", size: "M", bp: 5000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["獣"] });
    expectRarityIn("XG3-016", ["N"]);
  });

  it("XG3-016: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1894）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-016", "g")] }), "XG3-016:g")).toBe(false);
    const s = enterAny(battle({ rush: [inst("XG3-016", "g")], command: releasedCat("WB", 1) }), "XG3-016:g");
    expect(zoneOf(s, "player1", "XG3-016:g")).toBe("battle");
  });

  const enemy = () => ({ battle: [heldUnit("TST-UNIT-0", "hb")], rush: [heldUnit("SPEC-M3000", "hr"), inst("TST-UNIT-0", "r")] });
  const entered = () => enterAny(battle({ rush: [inst("XG3-016", "g")], command: releasedCat("WB", 1) }, enemy()), "XG3-016:g");

  it("XG3-016:【バナナボム】— 選べるのは敵軍ラッシュエリアのホールド状態の敵軍ユニットだけ（リリース状態のユニット・バトルエリアのユニットは選べない。任意）（出典: atwiki/page-1894「敵軍ラッシュエリアからホールド状態の敵軍ユニットを1体選び撃破してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-016");
    expect(choiceIds(s)).toEqual(["SPEC-M3000:hr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-016:【バナナボム】— 選んだホールド状態のユニットを撃破する（サイズを問わない）。見送れば何もしない（出典: atwiki/page-1894・カード評価「ラッシュエリアにいるホールドされたユニットを撃破」）", () => {
    let s = resolveAll(pick(entered(), "SPEC-M3000:hr"));
    expect(zoneOf(s, "player2", "SPEC-M3000:hr")).toBe("discard");
    s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player2", "SPEC-M3000:hr")).toBe("rush");
  });
});

// ===========================================================================
describe("XG3-017 猛獣使いオルグ", () => {
  const TEXT = "【猛獣使いの鞭】 自軍ターン中、これがバトルエリアに出たとき、特徴「獣」を持つユニットを2体選んでもよい。そうしたとき、選んだ2体でバトルする。";

  it("XG3-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-1895）", () => {
    expectCatalogText("XG3-017", TEXT);
    expectStats("XG3-017", { name: "猛獣使いオルグ", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["怪人", "男"] });
    expectRarityIn("XG3-017", ["N"]);
  });

  const p1 = () => ({ rush: [inst("XG3-017", "o"), inst("SPEC-BEAST-S", "own"), inst("TST-UNIT-0", "x")], battle: [inst("SPEC-BEAST-BIG", "ownb")] });
  const p2 = () => ({ battle: [inst("SPEC-BEAST-S", "eb")], rush: [inst("SPEC-BEAST-BIG", "er"), inst("TST-UNIT-0", "ex")] });
  const entered = () => enter(battle(p1(), p2()), "XG3-017:o");

  it("XG3-017:【猛獣使いの鞭】— 特徴「獣」を持つユニットなら、自軍・敵軍、ラッシュエリア・バトルエリアを問わず選べる（任意）（出典: atwiki/page-1895「特徴「獣」を持つユニットを2体選んでもよい」・コメント欄「相手に獣を追加させて、自軍のゴルトフェニックスにぶつけさせる」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-017");
    expect(choiceIds(s)).toEqual(["SPEC-BEAST-BIG:er", "SPEC-BEAST-BIG:ownb", "SPEC-BEAST-S:eb", "SPEC-BEAST-S:own"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-017:【猛獣使いの鞭】— 選んだ2体でバトルし、BP の低いほうが撃破される（出典: atwiki/page-1895「そうしたとき、選んだ2体でバトルする」・R-BTL-02）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-BEAST-S:eb"), "SPEC-BEAST-BIG:ownb"));
    expect(zoneOf(s, "player2", "SPEC-BEAST-S:eb")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-BEAST-BIG:ownb")).toBe("battle");
  });

  it("XG3-017:【猛獣使いの鞭】— 「獣」でないユニットは選べない（出典: atwiki/page-1895）", () => {
    const s = entered();
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:x");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:ex");
  });

  it("XG3-017:【猛獣使いの鞭】— 敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-1895「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG3-017:o", { rush: p1().rush.slice(1), battle: p1().battle }, p2(), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-017");
  });
});

// ===========================================================================
/** スピンビー・キャッチスパイダー（CN「L」の M ユニット。同カテゴリの L ユニットが能力を得る）の共通部分。 */
function karakuriTests(id: string, name: string, page: string, effect: string) {
  it(`${id}: ※ S ユニットにアタックされない（M・L ユニットにはアタックされる）（出典: ${page}「※これはSユニットにアタックされない」）`, () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst(id, "k")] }, player2: { battle: [inst("TST-UNIT-0", "a"), inst("SPEC-M3000", "m"), inst("SPEC-WB-L", "l")] } }, EXTRA);
    expect(attackersOf(s, `${id}:k`)).toEqual(["SPEC-M3000:m", "SPEC-WB-L:l"]);
  });

  it(`${id}:【${name}】— ${effect}は同カテゴリ（MA）の L ユニットだけが得る。カテゴリの違う L ユニットがコンビネーションしてストライクしても何も起きない（出典: ${page}「このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る」）`, () => {
    let s = line([`${id}:k`, "SPEC-WB-L:L"], {}, { battle: [inst("TST-UNIT-0", "e")], power: powerCards(3, "ep") });
    const hand = s.players.player1.hand.length;
    s = resolveAll(strike(s, "SPEC-WB-L:L"));
    expect(s.players.player1.hand).toHaveLength(hand);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });
}

describe("XG3-018 スピンビー", () => {
  const TEXT =
    "※これはSユニットにアタックされない。 【暴れ独楽】 このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒これがストライクしたとき、追加条件を持たない敵軍ユニットを1体選び、持ち主の手札に戻す。";

  it("XG3-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-1896「CN：L」）", () => {
    expectCatalogText("XG3-018", TEXT);
    expectStats("XG3-018", { name: "スピンビー", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 4, comboNumber: "L", features: ["メカ", "カラクリボール"] });
    expectRarityIn("XG3-018", ["N"]);
  });

  karakuriTests("XG3-018", "暴れ独楽", "atwiki/page-1896", "手札に戻す能力");

  // ストライクしたときの選択（強制）を残すため、resolveAll（選択に答えてしまう）ではなく settle で止める。
  const struck = () => settle(strike(line(["XG3-018:k", "SPEC-MA-L:L"], {}, { battle: [inst("TST-UNIT-0", "e")], rush: [inst("XG3-003", "rb"), inst("SPEC-M3000", "m")], power: powerCards(3, "ep") }), "SPEC-MA-L:L"));

  it("XG3-018:【暴れ独楽】— コンビネーションした MA の L ユニットがストライクしたとき、追加条件を持たない敵軍ユニット（エリア・サイズを問わない）から1体選ぶ（出典: atwiki/page-1896「これがストライクしたとき、追加条件を持たない敵軍ユニットを1体選び」）", () => {
    const s = struck();
    expectChoiceFrom(s, "player1", "XG3-018");
    expect(choiceIds(s)).toEqual(["SPEC-M3000:m", "TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG3-018:【暴れ独楽】— 選んだユニットを持ち主の手札に戻す（出典: atwiki/page-1896「持ち主の手札に戻す」）", () => {
    const s = resolveAll(struck(), ["SPEC-M3000:m"]);
    expect(zoneOf(s, "player2", "SPEC-M3000:m")).toBe("hand");
  });
});

describe("XG3-019 キャッチスパイダー", () => {
  const TEXT =
    "※これはSユニットにアタックされない。 【カラクリボール奪還】 このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒これがストライクしたとき、自分は1枚ドローする。";

  it("XG3-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-1897「CN：L」）", () => {
    expectCatalogText("XG3-019", TEXT);
    expectStats("XG3-019", { name: "キャッチスパイダー", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 6, comboNumber: "L", features: ["メカ", "カラクリボール"] });
    expectRarityIn("XG3-019", ["N"]);
  });

  karakuriTests("XG3-019", "カラクリボール奪還", "atwiki/page-1897", "ドローする能力");

  it("XG3-019:【カラクリボール奪還】— コンビネーションした MA の L ユニットがストライクしたとき、自分は1枚ドローする（出典: atwiki/page-1897「これがストライクしたとき、自分は1枚ドローする」・コメント欄「ストライクしてダメージを与えたときではないので相手テクター時のドロー加速」）", () => {
    let s = line(["XG3-019:k", "SPEC-MA-L:L"], {}, { power: powerCards(3, "ep") });
    const hand = s.players.player1.hand.length;
    const deck = s.players.player1.deck.length;
    s = resolveAll(strike(s, "SPEC-MA-L:L"));
    expect(s.players.player1.hand).toHaveLength(hand + 1);
    expect(s.players.player1.deck).toHaveLength(deck - 1);
  });
});

// ===========================================================================
describe("XG3-020 クワガライジャー", () => {
  const TEXT = "※タクスMA 【迅雷流剣技・雷牙一閃】 敵軍Sユニットを1体選び、カテゴリを1つ宣言する。このターン、宣言したカテゴリを選んだユニットに追加する。";

  it("XG3-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-1961「CN：2」）", () => {
    expectCatalogText("XG3-020", TEXT);
    expectStats("XG3-020", { name: "クワガライジャー", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["男", "忍者"] });
    expectRarityIn("XG3-020", ["R"]);
  });

  it("XG3-020: ※タクスMA — これがバトルエリアの2番目にある間、次に並ぶ MA の S ユニットは「SP1」を得る（MA でなければ得ない）（出典: atwiki/page-1961「※タクスMA」・R-KW-TAKUS-01）", () => {
    const s = resolveAll(line(["TST-UNIT-0:f", "XG3-020:k", "SPEC-MA-S:m"], {}, {}), ["__none__"]);
    expect(spOf(s, "player1", "SPEC-MA-S:m")).toBe(1);
    const t = resolveAll(line(["TST-UNIT-0:f", "XG3-020:k", "SPEC-WB-S:w"], {}, {}), ["__none__"]);
    expect(spOf(t, "player1", "SPEC-WB-S:w")).toBe(0);
  });

  it("XG3-020: ※タクスMA — これが1番目にあるときは、次の MA の S ユニットも SP を得ない（出典: R-KW-TAKUS-01「これがバトルエリアの○番目にある間」）", () => {
    const s = resolveAll(line(["XG3-020:k", "SPEC-MA-S:m"], {}, {}), ["__none__"]);
    expect(spOf(s, "player1", "SPEC-MA-S:m")).toBe(0);
  });

  const nc = () => line(["TST-UNIT-0:f", "XG3-020:k"], {}, { battle: [inst("SPEC-DA-S", "e")], rush: [inst("TST-UNIT-0", "r"), inst("SPEC-M3000", "m")] });

  it("XG3-020:【迅雷流剣技・雷牙一閃】— 2番目に出たとき（NC）、敵軍 S ユニット（エリアを問わない。M は選べない）を1体選ぶ（出典: atwiki/page-1961「敵軍Sユニットを1体選び」・R-CN-02）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-020");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:e", "TST-UNIT-0:r"]);
  });

  it("XG3-020:【迅雷流剣技・雷牙一閃】— 宣言したカテゴリ（例: ET）が、このターン選んだユニットに追加される（もとのカテゴリも残る）（出典: atwiki/page-1961「カテゴリを1つ宣言する。このターン、宣言したカテゴリを選んだユニットに追加する」）", () => {
    let s = pick(nc(), "SPEC-DA-S:e");
    expectChoiceFrom(s, "player1", "XG3-020");
    s = resolveAll(pick(s, choiceIds(s).find((c) => c.includes("ET"))!));
    expect(categoriesOf(s, "player2", "SPEC-DA-S:e")).toEqual(["DA", "ET"]);
  });

  it("XG3-020:【迅雷流剣技・雷牙一閃】— 追加したカテゴリはターンの終わりに消える（出典: atwiki/page-1961「このターン」）", () => {
    let s = pick(nc(), "SPEC-DA-S:e");
    s = resolveAll(pick(s, choiceIds(s).find((c) => c.includes("ET"))!));
    // 2番目に出た直後の進入ウィンドウ（end_phase が出ない）をパスしてからターンを終える。
    s = toTurnEnd(passEntry(s));
    expect(categoriesOf(s, "player2", "SPEC-DA-S:e")).toEqual(["DA"]);
  });
});

// ===========================================================================
describe("XG3-021 カブトライジャー", () => {
  const TEXT =
    "※レジスト 【迅雷流剣技・カブト雷撃破】 敵軍バトルエリアから、DAを持つSユニットを1体選び撃破してもよい。そうして撃破したユニットが捨札になったとき、選んだユニットの本来のSPが1以上だったなら、敵軍捨札からカードを1枚選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG3-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-1960「CN：3」）", () => {
    expectCatalogText("XG3-021", TEXT);
    expectStats("XG3-021", { name: "カブトライジャー", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 3, features: ["男", "忍者"] });
    expectRarityIn("XG3-021", ["R"]);
  });

  resistTests("XG3-021", "atwiki/page-1960");

  const nc = (enemyBattle = [inst("SPEC-DA-S", "e"), inst("SPEC-DA-M", "m"), inst("TST-UNIT-0", "wb")]) =>
    line(["TST-UNIT-0:f1", "TST-UNIT-0:f2", "XG3-021:k"], {}, { battle: enemyBattle, rush: [inst("SPEC-DA-S0", "r")], discard: [inst("TST-OP", "ed")], power: powerCards(2, "ep") });

  it("XG3-021:【迅雷流剣技・カブト雷撃破】— 3番目に出たとき（NC）、敵軍バトルエリアの DA を持つ S ユニットから選ぶ（M ユニット・DA でないユニット・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-1960「敵軍バトルエリアから、DAを持つSユニットを1体選び撃破してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-021");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-021:【迅雷流剣技・カブト雷撃破】— 選んだユニットを撃破し、その本来の SP が1以上なら、敵軍捨札のカードを1枚選び持ち主のパワーゾーンにダメージ（ウラ向き）として置く（出典: atwiki/page-1960「選んだユニットの本来のSPが1以上だったなら、敵軍捨札からカードを1枚選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(nc(), ["SPEC-DA-S:e", "TST-OP:ed"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:e")).not.toBe("battle");
    const dmg = s.players.player2.power.filter((c) => c.faceDown).map((c) => c.instanceId);
    expect(dmg).toHaveLength(1);
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG3-021:【迅雷流剣技・カブト雷撃破】— 撃破したユニットの本来の SP がなければダメージは置かない（出典: atwiki/page-1960「本来のSPが1以上だったなら」）", () => {
    const s = resolveAll(nc([inst("SPEC-DA-S0", "e0")]), ["SPEC-DA-S0:e0", "TST-OP:ed"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S0:e0")).toBe("discard");
    expect(s.players.player2.power.filter((c) => c.faceDown)).toEqual([]);
  });

  it("XG3-021:【迅雷流剣技・カブト雷撃破】— 敵軍バトルエリアに DA の S ユニットがいなければ何もしない（出典: atwiki/page-1960）", () => {
    const s = nc([inst("TST-UNIT-0", "wb")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-021");
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:wb")).toBe("battle");
  });
});
