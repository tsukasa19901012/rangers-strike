/**
 * カード別スペック: XG2-075〜XG2-081（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーブレイド〜デンオウモモタロス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-075」〜「XG2-081」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-077 Q1・Q2。プロモーション版 XP-004 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-MORPH-01〜03・R-CN-04「コンビネーション」）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-077 と同じ本文の XP-004 は cardSpec/XP-001-016.a.test.ts、モーフの起動の流れは keywords/activeMorph.test.ts。
 *  - XG2-080 の追加条件に「仮面ライダー龍騎」としてつかえるユニットを使えることは cardSpec/XG7-024-046.b.test.ts（XG7-036）。
 */
import { describe, expect, it } from "vitest";
import {
  attackedInEnemyTurn,
  bpOf,
  canHoldPay,
  canSkip,
  canStartRush,
  choiceIds,
  comboEnter,
  exiled,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  faceDownCard,
  handN,
  enteredInEnemyTurn,
  heldUnit,
  holdPay,
  inst,
  isDamageIn,
  isHeld,
  morphCandidates,
  morphRush,
  ncEnter,
  p1Battle,
  pick,
  pickAs,
  PLAIN_VEHICLE,
  powerCards,
  rcBoard,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  sUnit,
  zoneOf,
  attack,
} from "./XG2-062-081.helpers";

const B2500 = sUnit("SPEC-B2500", { bp: 2500 });
const B8000 = sUnit("SPEC-B8000", { bp: 8000 });
const B9000 = sUnit("SPEC-B9000", { bp: 9000 });
const DA_S = sUnit("SPEC-DA-S", { bp: 1000, category: "DA" });
const EXTRA = [B2500, B8000, B9000, DA_S];

/** 敵軍: バトルエリアに S（BP1000）・S（BP2500）・M、ラッシュエリアに S（BP2500）。 */
const ENEMY = () => ({ battle: [inst("TST-UNIT-0", "e"), inst("SPEC-B2500", "e25"), inst("TST-UNIT-2", "em")], rush: [inst("SPEC-B2500", "r25")] });

/** 「このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる」の盤面（自軍 WB コマンド2つ）。 */
const combo = (ffrId: string, nextId: string) => comboEnter(ffrId, nextId, { command: releasedCat("WB", 2) }, ENEMY(), EXTRA);

/** FFR の共通テスト: S ユニットがこれからコンビネーションするとき、これをホールドして発動できる（任意）。M ユニットのときは発動しない。 */
function ffrHoldTests(id: string, effect: string, page: string) {
  it(`${id}: 【${effect}】自軍バトルフェイズ中、S ユニットがこれからコンビネーションするとき、これをホールドして発動できる（任意）（出典: ${page}「このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる」）`, () => {
    const s = combo(`${id}:ffr`, "TST-UNIT-0:n");
    expect(canHoldPay(s, `${id}:ffr`)).toBe(true);
  });

  it(`${id}: 【${effect}】M ユニットがこれからコンビネーションするときは発動できない（出典: ${page}「Sユニットがコンビネーションするとき」）`, () => {
    const s = combo(`${id}:ffr`, "TST-UNIT-2:m");
    expect(canHoldPay(s, `${id}:ffr`)).toBe(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
  });
}

// ===========================================================================
describe("XG2-075 仮面ライダーブレイド", () => {
  const TEXT =
    "【ブレイドブレード】自軍バトルフェイズ中、このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる⇒敵軍バトルエリアからSユニットを1体選び撃破する。（コンビネーションしたSユニットが「仮面ライダーディケイド」または「仮面ライダーディエンド」なら、撃破するかわりにゲームから除外する）";

  it("XG2-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-1776）", () => {
    expectCatalogText("XG2-075", TEXT);
    expectUnit("XG2-075", { name: "仮面ライダーブレイド", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 3, features: ["仮面ライダー", "男", "FFR"] });
    expectRarityIn("XG2-075", ["NR"]);
  });

  ffrHoldTests("XG2-075", "ブレイドブレード", "atwiki/page-1776");

  it("XG2-075: 【ブレイドブレード】ホールドすると、敵軍バトルエリアの S ユニットを1体選び撃破する（ラッシュエリア・M ユニットは選べない）（出典: atwiki/page-1776「敵軍バトルエリアからSユニットを1体選び撃破する」）", () => {
    let s = holdPay(combo("XG2-075:ffr", "TST-UNIT-0:n"), "XG2-075:ffr");
    expect(isHeld(s, "player1", "XG2-075:ffr")).toBe(true);
    expect(choiceIds(s).sort()).toEqual(["SPEC-B2500:e25", "TST-UNIT-0:e"]);
    s = resolveAll(pick(s, "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  it("XG2-075: 【ブレイドブレード】コンビネーションした S ユニットが「仮面ライダーディケイド」（XG2-077）なら、撃破するかわりにゲームから除外する（出典: atwiki/page-1776「撃破するかわりにゲームから除外する」・カード評価「除外効果によって相手に対象のユニットが再利用されるのを防ぐ」）", () => {
    const s = resolveAll(holdPay(combo("XG2-075:ffr", "XG2-077:dc"), "XG2-075:ffr"), ["TST-UNIT-0:e"]);
    expect(exiled(s, "player2", "TST-UNIT-0:e")).toBe(true);
  });
});

// ===========================================================================
describe("XG2-076 仮面ライダーキバ", () => {
  const TEXT =
    "【キバアロー】自軍バトルフェイズ中、このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる⇒相手は自分自身のSユニットを1体選び捨札にする。（コンビネーションしたSユニットが「仮面ライダーディケイド」または「仮面ライダーディエンド」なら、捨札にするかわりにダメージにする）";

  it("XG2-076: カタログ本文・スペックが出典と一致（出典: atwiki/page-982）", () => {
    expectCatalogText("XG2-076", TEXT);
    expectUnit("XG2-076", { name: "仮面ライダーキバ", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "魔皇力", "FFR"] });
    expectRarityIn("XG2-076", ["R"]);
  });

  ffrHoldTests("XG2-076", "キバアロー", "atwiki/page-982");

  it("XG2-076: 【キバアロー】ホールドすると、相手が自分自身の S ユニット（エリアを問わない。M ユニットは選べない）を1体選び捨札にする（出典: atwiki/page-982「相手は自分自身のSユニットを1体選び捨札にする」・カード評価「除去するユニットは相手が選ぶ」）", () => {
    let s = holdPay(combo("XG2-076:ffr", "TST-UNIT-0:n"), "XG2-076:ffr");
    expectChoiceFrom(s, "player2", "XG2-076");
    expect(choiceIds(s).sort()).toEqual(["SPEC-B2500:e25", "SPEC-B2500:r25", "TST-UNIT-0:e"]);
    s = resolveAll(pickAs(s, "player2", "SPEC-B2500:r25"));
    expect(zoneOf(s, "player2", "SPEC-B2500:r25")).toBe("discard");
  });

  it("XG2-076: 【キバアロー】コンビネーションした S ユニットが「仮面ライダーディケイド」（XG2-077）なら、捨札にするかわりにダメージ（ウラ向きでパワーゾーン）にする（出典: atwiki/page-982「捨札にするかわりにダメージにする」）", () => {
    const s = holdPay(combo("XG2-076:ffr", "XG2-077:dc"), "XG2-076:ffr");
    const t = resolveAll(pickAs(s, "player2", "TST-UNIT-0:e"));
    expect(isDamageIn(t, "player2", "TST-UNIT-0:e")).toBe(true);
  });
});

// ===========================================================================
describe("XG2-077 仮面ライダーディケイド", () => {
  const TEXT =
    "※モーフ 【カメンライド】効果名「アタックライド」を持つオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい。このとき出したユニットは、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。";

  it("XG2-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-1748）", () => {
    expectCatalogText("XG2-077", TEXT);
    expectUnit("XG2-077", { name: "仮面ライダーディケイド", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男", "ディケイドライバー"] });
    expectRarityIn("XG2-077", ["NR"]);
  });

  it("XG2-077: ※モーフ — 敵軍ユニットが通常のラッシュをされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（XG1-066 ディケイド ファイズ）と置き換えられる。特徴が違うカードは選べない（出典: atwiki/page-1748「※モーフ」・R-KW-MORPH-01〜03）", () => {
    const s = morphRush({ battle: [inst("XG2-077", "dc")], command: [released("XG1-066", "fz"), released("XG2-043", "wcj")] });
    expect(morphCandidates(s)).toEqual(["XG1-066:fz"]);
    const t = settle(pickAs(s, "player1", "XG1-066:fz"));
    expect(zoneOf(t, "player1", "XG1-066:fz")).toBe("battle");
    expect(zoneOf(t, "player1", "XG2-077:dc")).toBe("command");
  });

  const kamenRide = (p1: Parameters<typeof rcBoard>[1] = {}) =>
    rcBoard("XG2-077:dc", { command: [released("XG1-064", "agito"), released("XG2-043", "wcj")], power: [inst("XG1-066", "fz"), faceDownCard("XG1-068", "kuuga")], ...p1 }, { battle: [inst("SPEC-DA-S", "da")] }, EXTRA);

  it("XG2-077: 【カメンライド】RC — 自軍ゾーンのオモテ向きの、効果名「アタックライド」を持つユニットカードから選べる（任意。「アタックライド」を持たないカード・ウラ向きのカードは選べない）（出典: atwiki/page-1748「効果名「アタックライド」を持つオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい」）", () => {
    const s = kamenRide();
    expectChoiceFrom(s, "player1", "XG2-077");
    expect(choiceIds(s)).toEqual(["XG1-064:agito", "XG1-066:fz"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-077: 【カメンライド】置き換えて出たユニット（XG1-064 ディケイド アギトGF・RC）はライドオフした直後として RC の【アタックライド】を発動する（DA の敵軍 S ユニットを撃破）（出典: atwiki/page-1748「ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する」・XG1-064 本文）", () => {
    let s = pick(kamenRide(), "XG1-064:agito");
    expect(zoneOf(s, "player1", "XG1-064:agito")).toBe("battle");
    expect(zoneOf(s, "player1", "XG2-077:dc")).toBe("command");
    s = resolveAll(s, ["SPEC-DA-S:da"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:da")).toBe("discard");
  });

  it("XG2-077: 公式Q&A — RC でない【アタックライド】（XG1-069 ディケイド 響鬼。CN1）は、NC を満たさない並び（2番目）なら発動しない（出典: atwiki/page-1748 Q1「いいえ、できません。…ＲＣではないため発動することはできません」）", () => {
    const s = pick(kamenRide({ command: [released("XG1-069", "hibiki")] }), "XG1-069:hibiki");
    expect(zoneOf(s, "player1", "XG1-069:hibiki")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-069");
  });

  it("XG2-077: 公式Q&A — 置き換えでバトルエリアに出た XG1-072 ディケイド キバは「バトルエリアに出たとき」の【アタックライド】を使える（出典: atwiki/page-1748 Q2「置き換えることでバトルエリアに出ていますので、…結果として【アタックライド】の効果を発動することが出来ます」） 既知の不具合: CARD-XG2-077 置き換えで出たユニットの「バトルエリアに出たとき」の効果が発動しない", () => {
    const s = pick(kamenRide({ command: [released("XG1-072", "kiba")] }), "XG1-072:kiba");
    expect(zoneOf(s, "player1", "XG1-072:kiba")).toBe("battle");
    expectChoiceFrom(s, "player1", "XG1-072");
  });

  it("XG2-077: 【カメンライド】置き換えないことを選べば、そのまま場に残る（出典: atwiki/page-1748「置き換えてもよい」）", () => {
    const s = resolveAll(skip(kamenRide()));
    expect(zoneOf(s, "player1", "XG2-077:dc")).toBe("battle");
    expect(zoneOf(s, "player1", "XG1-064:agito")).toBe("command");
  });
});

// ===========================================================================
describe("XG2-078 仮面ライダーファイズ", () => {
  const TEXT =
    "【ファイズブラスター】自軍バトルフェイズ中、このユニットからSユニットがコンビネーションするとき、これをホールドして次の効果を発動できる⇒敵軍バトルエリアからBPの下三桁が500のユニットを1体選び撃破する。（コンビネーションしたSユニットが「仮面ライダーディケイド」または「仮面ライダーディエンド」なら、ユニットを選ぶとき敵軍ラッシュエリアから選んでもよい）";

  it("XG2-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-1777）", () => {
    expectCatalogText("XG2-078", TEXT);
    expectUnit("XG2-078", { name: "仮面ライダーファイズ", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 2, features: ["仮面ライダー", "男", "FFR"] });
    expectRarityIn("XG2-078", ["NR"]);
  });

  ffrHoldTests("XG2-078", "ファイズブラスター", "atwiki/page-1777");

  it("XG2-078: 【ファイズブラスター】ホールドすると、敵軍バトルエリアの BP の下三桁が500のユニットを1体選び撃破する（BP1000・ラッシュエリアのユニットは選べない）（出典: atwiki/page-1777「敵軍バトルエリアからBPの下三桁が500のユニットを1体選び撃破する」）", () => {
    let s = holdPay(combo("XG2-078:ffr", "TST-UNIT-0:n"), "XG2-078:ffr");
    expect(choiceIds(s)).toEqual(["SPEC-B2500:e25"]);
    s = resolveAll(pick(s, "SPEC-B2500:e25"));
    expect(zoneOf(s, "player2", "SPEC-B2500:e25")).toBe("discard");
  });

  it("XG2-078: 【ファイズブラスター】コンビネーションした S ユニットが「仮面ライダーディケイド」（XG2-077）なら、敵軍ラッシュエリアからも選べる（出典: atwiki/page-1777「ユニットを選ぶとき敵軍ラッシュエリアから選んでもよい」）", () => {
    const s = holdPay(combo("XG2-078:ffr", "XG2-077:dc"), "XG2-078:ffr");
    expect(choiceIds(s).sort()).toEqual(["SPEC-B2500:e25", "SPEC-B2500:r25"]);
  });
});

// ===========================================================================
describe("XG2-079 仮面ライダー龍騎", () => {
  const TEXT =
    "【タイムベント】敵軍ターン中、これが自軍エリアにある間、これ以外の自軍Sユニットがバトルで撃破されたとき、捨札にするかわりに手札から1枚選びゲームから除外してよい。そうしたとき、撃破されたユニットはその場に留まる。";

  it("XG2-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-1541）", () => {
    expectCatalogText("XG2-079", TEXT);
    expectUnit("XG2-079", { name: "仮面ライダー龍騎", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 5, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG2-079", ["R"]);
  });

  const defended = () => attackedInEnemyTurn({ battle: [inst("TST-UNIT-0", "ally")], rush: [inst("XG2-079", "ry")], hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] }, "TST-UNIT-0:ally");

  it("XG2-079: 【タイムベント】敵軍ターン中、これ以外の自軍 S ユニットがバトルで撃破されたとき、手札から1枚選びゲームから除外できる（任意。これは自軍ラッシュエリアにあってもよい）（出典: atwiki/page-1541「敵軍ターン中、これが自軍エリアにある間、これ以外の自軍Sユニットがバトルで撃破されたとき、捨札にするかわりに手札から1枚選びゲームから除外してよい」）", () => {
    const s = defended();
    expectChoiceFrom(s, "player1", "XG2-079");
    expect(choiceIds(s).sort()).toEqual(["TST-OP:h1", "TST-OP:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-079: 【タイムベント】除外したら、撃破されたユニットはその場に留まる（出典: atwiki/page-1541「そうしたとき、撃破されたユニットはその場に留まる」）", () => {
    const s = resolveAll(pick(defended(), "TST-OP:h1"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("battle");
    expect(exiled(s, "player1", "TST-OP:h1")).toBe(true);
    expect(handN(s)).toBe(1);
  });

  it("XG2-079: 【タイムベント】これ自身がバトルで撃破されたときは留まれない（出典: atwiki/page-1541「これ以外の自軍Sユニット」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("XG2-079", "ry")], hand: [inst("TST-OP", "h1")] }, "XG2-079:ry"));
    expect(zoneOf(s, "player1", "XG2-079:ry")).toBe("discard");
  });

  it("XG2-079: 【タイムベント】自軍ターン中にバトルで撃破されたときは使えない（捨札になる）（出典: atwiki/page-1541「敵軍ターン中、」）", () => {
    const s0 = p1Battle({ battle: [inst("TST-UNIT-0", "ally")], rush: [inst("XG2-079", "ry")], hand: [inst("TST-OP", "h1")] }, { battle: [inst("TST-UNIT-7", "big")] });
    const s = resolveAll(settle(attack(s0, "TST-UNIT-0:ally", "TST-UNIT-7:big")));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("discard");
    expect(handN(s)).toBe(1);
  });
});

// ===========================================================================
describe("XG2-080 リュウキドラグレッダー", () => {
  const TEXT =
    "※自分が「仮面ライダー龍騎」をラッシュしたとき、自軍エリアに「リュウキドラグレッダー」があれば1体選んで手札に戻す。 【ファイナルアタックライド】このユニットからコンビネーションする、「仮面ライダーディケイド」または「仮面ライダーディエンド」は、次の能力を得る⇒BP+3000";

  it("XG2-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-1778）", () => {
    expectCatalogText("XG2-080", TEXT);
    expectUnit("XG2-080", { name: "リュウキドラグレッダー", category: "WB", size: "S", bp: 5000, sp: undefined, powerCost: "5+", features: ["獣", "ドラゴン", "FFR"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG2-080", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) => rushBoard({ hand: [inst("XG2-080", "dr")], rush, power: powerCards(power), command: releasedCat("WB", 1) });

  it("XG2-080: 追加条件 — 自軍「仮面ライダー龍騎」（XG2-079）1体を手札に戻し、パワー5でラッシュできる（出典: atwiki/page-1778「必要パワー：5+」「追加条件：自軍「仮面ライダー龍騎」1体を手札に戻す」）", () => {
    const r = rushVia(board([inst("XG2-079", "ry")]), "player1", "XG2-080:dr", (a) => JSON.stringify(a).includes("XG2-079:ry"));
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-080:dr")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-079:ry")).toBe("hand");
  });

  it("XG2-080: 追加条件 — パワー4、または「仮面ライダー龍騎」がいなければラッシュできない（出典: atwiki/page-1778）", () => {
    expect(canStartRush(board([inst("XG2-079", "ry")], 4), "player1", "XG2-080:dr")).toBe(false);
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-080:dr")).toBe(false);
  });

  it("XG2-080: ※ 自分が「仮面ライダー龍騎」をラッシュしたとき、自軍エリアの「リュウキドラグレッダー」を1体選んで手札に戻す（必ず）（出典: atwiki/page-1778「自軍エリアに「リュウキドラグレッダー」があれば1体選んで手札に戻す」・コメント欄「戻さないといけない」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG2-079", "ry")], rush: [inst("XG2-080", "dr")], power: powerCards(5), command: releasedCat("WB", 1) }), "player1", "XG2-079:ry");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG2-080");
    expect(canSkip(r.state)).toBe(false);
    expect(zoneOf(resolveAll(r.state), "player1", "XG2-080:dr")).toBe("hand");
  });

  const comboBp = (next: string) => {
    const s = resolveAll(comboEnter("XG2-080:dr", next, {}, { battle: [inst("TST-UNIT-0", "e")] }));
    return bpOf(s, "player1", next);
  };

  it("XG2-080: 【ファイナルアタックライド】これからコンビネーションする「仮面ライダーディケイド」（XG2-077。BP2000）は BP+3000（5000）される（出典: atwiki/page-1778「このユニットからコンビネーションする、「仮面ライダーディケイド」または「仮面ライダーディエンド」は、次の能力を得る⇒BP+3000」）", () => {
    expect(comboBp("XG2-077:dc")).toBe(5000);
  });

  it("XG2-080: 【ファイナルアタックライド】これからコンビネーションする「仮面ライダーディエンド」（XG2-071。BP1000）も BP+3000（4000）される（出典: atwiki/page-1778）", () => {
    expect(comboBp("XG2-071:de")).toBe(4000);
  });

  it("XG2-080: 【ファイナルアタックライド】ほかのユニットがコンビネーションしても BP は変わらない（出典: atwiki/page-1778「「仮面ライダーディケイド」または「仮面ライダーディエンド」は」）", () => {
    expect(comboBp("TST-UNIT-0:n")).toBe(1000);
  });
});

// ===========================================================================
describe("XG2-081 デンオウモモタロス", () => {
  const TEXT =
    "【俺の必殺技・ディケイドバージョン】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアからホールド状態のSユニットを1体選んでもよい。そうしたとき、選んだユニットをパワーゾーンに送ってから、そのユニットのBP以下のBPを持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG2-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-1779）", () => {
    expectCatalogText("XG2-081", TEXT);
    expectUnit("XG2-081", { name: "デンオウモモタロス", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: "3+", features: ["イマジン", "FFR"], rushCondition: "state_gate" });
    expectRarityIn("XG2-081", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 3) => rushBoard({ hand: [inst("XG2-081", "mo")], rush, power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-081: 追加条件 — カード名に「ディケイド」か「ディエンド」を含む自軍ユニット（XG2-077 ディケイド・XG2-071 ディエンド・XG2-042 ディケイドCF）があればラッシュできる。なければ、またはパワー2ではできない（出典: atwiki/page-1779「追加条件：カード名に「ディケイド」または「ディエンド」を含む自軍ユニットがある」「必要パワー：3+」）", () => {
    expect(canStartRush(board([inst("XG2-077", "dc")]), "player1", "XG2-081:mo")).toBe(true);
    expect(canStartRush(board([inst("XG2-071", "de")]), "player1", "XG2-081:mo")).toBe(true);
    expect(canStartRush(board([inst("XG2-042", "cf")]), "player1", "XG2-081:mo")).toBe(true);
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-081:mo")).toBe(false);
    expect(canStartRush(board([inst("XG2-077", "dc")], 2), "player1", "XG2-081:mo")).toBe(false);
  });

  /** 自軍ラッシュエリア: ホールド状態の BP8000、リリース状態の BP9000。敵軍: BP8000・BP9000（バトル）。 */
  const sword = () =>
    ncEnter("XG2-081:mo", 0, { rush: [heldUnit("SPEC-B8000", "h8"), inst("SPEC-B9000", "rel")] }, { battle: [inst("SPEC-B8000", "e8"), inst("SPEC-B9000", "e9")] }, EXTRA);

  it("XG2-081: 【俺の必殺技・ディケイドバージョン】自軍ターン中にバトルエリアに出たとき、まず自軍ラッシュエリアのホールド状態の S ユニットを1体選べる（任意。リリース状態のユニットは選べない）（出典: atwiki/page-1779「自軍ラッシュエリアからホールド状態のSユニットを1体選んでもよい」）", () => {
    const s = sword();
    expectChoiceFrom(s, "player1", "XG2-081");
    expect(choiceIds(s)).toEqual(["SPEC-B8000:h8"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-081: 【俺の必殺技・ディケイドバージョン】選んだユニットをパワーゾーンに送ってから、その BP（8000）以下の敵軍ユニットを選び、持ち主のパワーゾーン（オモテ向き）に送る。BP9000 は選べない（出典: atwiki/page-1779「選んだユニットをパワーゾーンに送ってから、そのユニットのBP以下のBPを持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る」）", () => {
    let s = pick(sword(), "SPEC-B8000:h8");
    expect(zoneOf(s, "player1", "SPEC-B8000:h8")).toBe("power");
    expect(choiceIds(s)).toEqual(["SPEC-B8000:e8"]);
    s = resolveAll(pick(s, "SPEC-B8000:e8"));
    expect(zoneOf(s, "player2", "SPEC-B8000:e8")).toBe("power");
    expect(isDamageIn(s, "player2", "SPEC-B8000:e8")).toBe(false);
  });

  it("XG2-081: 【俺の必殺技・ディケイドバージョン】自軍ラッシュエリアにホールド状態の S ユニットがなければ、敵軍ユニットは送られない（出典: atwiki/page-1779「そうしたとき、」）", () => {
    const s = resolveAll(ncEnter("XG2-081:mo", 0, { rush: [inst("SPEC-B9000", "rel")] }, { battle: [inst("SPEC-B8000", "e8")] }, EXTRA), ["SPEC-B8000:e8"]);
    expect(zoneOf(s, "player2", "SPEC-B8000:e8")).toBe("battle");
  });

  it("XG2-081: 【俺の必殺技・ディケイドバージョン】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1779「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG2-081:mo", { rush: [heldUnit("SPEC-B8000", "h8")] }, { battle: [inst("SPEC-B8000", "e8")] }, [...EXTRA, PLAIN_VEHICLE]);
    expect(zoneOf(s, "player1", "XG2-081:mo")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-081");
  });
});
