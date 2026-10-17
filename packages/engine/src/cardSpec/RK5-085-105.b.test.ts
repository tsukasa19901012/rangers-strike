/**
 * カード別スペック: RK-092〜RK-098（ザ・マスクドライダーEXP vol.2 狼男〜クルーザー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-097 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。RK-093 の Q&A は atwiki に転載された公式 Q&A）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-01、R-KW-REG、R-END-01、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-096 がレジストを持たない — keywords/battleKeywords.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attackUntilRegister,
  bpOf,
  canSkip,
  cardIn,
  categoriesOf,
  choiceIds,
  confirm,
  deckCards,
  deckWithTen,
  endTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  heldCount,
  inst,
  mount,
  mountedOn,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOff,
  rushFromHand,
  rushOffered,
  settle,
  skip,
  st,
  sUnit,
  toTurnEnd,
  zoneIds,
  zoneOf,
} from "./RK5-085-105.helpers";

const MALE_DA = sUnit("SPEC-MALE-DA", { category: "DA", bp: 2000, features: ["男"] });
const MALE_WB = sUnit("SPEC-MALE-WB", { category: "WB", bp: 2000, features: ["男"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "DA", bp: 4000, size: "M", features: ["男"] });
const PLAIN_DA = sUnit("SPEC-PLAIN-DA", { category: "DA", bp: 2000, features: ["女"] });
const E_COST2_M = sUnit("SPEC-E2M", { bp: 3000, powerCost: 2, size: "M" });
const E_PLAIN = sUnit("SPEC-E", { bp: 1000, powerCost: 1 });
/** RC を持つ S ユニット（ライドできる。BP2000）。 */
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 2000, comboNumber: "RC" });
const BIG = sUnit("SPEC-BIG", { bp: 13000 });
const BP2500 = sUnit("SPEC-E2500", { bp: 2500, powerCost: 2 });
const EXTRA = [MALE_DA, MALE_WB, MALE_M, PLAIN_DA, E_COST2_M, E_PLAIN, PLAIN_VEHICLE, RIDER, BIG, BP2500];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-092 狼男", () => {
  const TEXT = "【狼作戦】これが自軍エリアにある間、特徴「男」を持つ自軍SユニットはカテゴリにWBが追加される。";

  it("RK-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-697）", () => {
    expectCatalogText("RK-092", TEXT);
    expectStats("RK-092", {
      name: "狼男",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: "5+",
      features: ["ショッカー", "怪人", "男", "改造人間"],
      rushCondition: "discard_named_unit",
    });
    expectRarityIn("RK-092", ["R"]);
  });

  it("RK-092: 追加条件 — 自軍「ゾル大佐」1体を捨札にしてラッシュする（出典: atwiki/page-697「追加条件：自軍「ゾル大佐」1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-092", "wo")], rush: [inst("RK-091", "zol")], power: powerCards(5), command: releasedCat("DA", 1) }), "player1", "RK-092:wo");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-092:wo")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-091:zol")).toBe("discard");
  });

  it("RK-092: 自軍に「ゾル大佐」がなければラッシュできない（出典: atwiki/page-697）", () => {
    const s = rushPhase({ hand: [inst("RK-092", "wo")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(5), command: releasedCat("DA", 1) });
    expect(rushOffered(s, "RK-092:wo")).toBe(false);
  });

  it.fails("RK-092: これが自軍エリアにある間、特徴「男」を持つ自軍 S ユニット（これ自身を含む）はカテゴリに WB が追加される（出典: atwiki/page-697「特徴「男」を持つ自軍SユニットはカテゴリにWBが追加される」）", () => {
    const s = board({ battle: [inst("SPEC-MALE-DA", "m")], rush: [inst("RK-092", "wo")] });
    expect(categoriesOf(s, "player1", "SPEC-MALE-DA:m")).toEqual(["DA", "WB"]);
    expect(categoriesOf(s, "player1", "RK-092:wo")).toEqual(["DA", "WB"]);
  });

  it("RK-092: 「男」を持たないユニット・M ユニット・敵軍の「男」のユニットにはカテゴリが追加されない（出典: atwiki/page-697「特徴「男」を持つ自軍Sユニット」）", () => {
    const s = board({ battle: [inst("SPEC-PLAIN-DA", "f"), inst("SPEC-MALE-M", "mm")], rush: [inst("RK-092", "wo")] }, { battle: [inst("SPEC-MALE-DA", "em")] });
    expect(categoriesOf(s, "player1", "SPEC-PLAIN-DA:f")).toEqual(["DA"]);
    expect(categoriesOf(s, "player1", "SPEC-MALE-M:mm")).toEqual(["DA"]);
    expect(categoriesOf(s, "player2", "SPEC-MALE-DA:em")).toEqual(["DA"]);
  });

  it("RK-092: すでに WB を持つユニットには重ねて追加されない（出典: atwiki/page-697 コメント欄「既に持っているカテゴリは重複して追加されない」）", () => {
    const s = board({ battle: [inst("SPEC-MALE-WB", "w")], rush: [inst("RK-092", "wo")] });
    expect(categoriesOf(s, "player1", "SPEC-MALE-WB:w")).toEqual(["WB"]);
  });

  it("RK-092: これが自軍エリアになければカテゴリは追加されない（出典: atwiki/page-697「これが自軍エリアにある間」）", () => {
    const s = board({ battle: [inst("SPEC-MALE-DA", "m")] }, { rush: [inst("RK-092", "ewo")] });
    expect(categoriesOf(s, "player1", "SPEC-MALE-DA:m")).toEqual(["DA"]);
  });
});

// ===========================================================================
describe("RK-093 蜘蛛男", () => {
  const TEXT =
    "【要人の暗殺】「これはバトルエリアに出られない」または「これは自軍ターン中、バトルエリアに出られない」と書かれた敵軍ユニットを1体選び撃破してもよい。";

  it("RK-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-625）", () => {
    expectCatalogText("RK-093", TEXT);
    expectStats("RK-093", { name: "蜘蛛男", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 5, comboNumber: 3, features: ["ショッカー", "怪人", "男", "改造人間"] });
    expectRarityIn("RK-093", ["N"]);
  });

  /** バトルエリアの3番目に蜘蛛男を出す（NC の選択は残す）。 */
  const assassin = (p2: Partial<GameState["players"]["player2"]>) => ncEnter("RK-093:km", 2, {}, p2, EXTRA);
  const enemy = {
    battle: [inst("SPEC-E", "plain")],
    rush: [inst("RS-223", "tak"), inst("RS-140", "col"), inst("RS-628", "wing"), inst("RK-104", "tf"), inst("SPEC-E2M", "m")],
  };

  // 公式 Q（atwiki/page-625 Q1）「はい、できます。省略表記のテキストも、カードに書かれているものとして扱ってください。」
  it.fails("RK-093: NC — 「これはバトルエリアに出られない」「これは自軍ターン中、バトルエリアに出られない」と書かれた敵軍ユニットと、ウイングを持つ敵軍ユニットを選べる（任意）（出典: atwiki/page-625 本文・Q1「省略表記のテキストも、カードに書かれているものとして扱ってください」）", () => {
    const s = assassin(enemy);
    expectChoiceFrom(s, "player1", "RK-093");
    expect(choiceIds(s)).toEqual(["RS-140:col", "RS-223:tak", "RS-628:wing"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-093: NC — 選んだ敵軍ユニットを撃破する（出典: atwiki/page-625「1体選び撃破してもよい」）", () => {
    const s = resolveAll(pick(assassin(enemy), "RS-628:wing"));
    expect(zoneOf(s, "player2", "RS-628:wing")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-223:tak")).toBe("rush");
  });

  it.fails("RK-093: NC — 「これは自軍コマンドを2つホールドしなければバトルエリアに出られない」（クウガTF）は「これは」と「バトルエリアに出られない」の間に文があるので選べない（出典: atwiki/page-625 コメント欄「「これは」と「バトルエリアに出られない」の間にテキストがあるから無理」）", () => {
    expect(choiceIds(assassin({ rush: [inst("RK-104", "tf"), inst("RS-223", "tak")] }))).toEqual(["RS-223:tak"]);
  });

  it.fails("RK-093: NC — 敵軍の蜘蛛男も、テキストに「これはバトルエリアに出られない」と書かれているので選べる（出典: atwiki/page-625 カード評価「蜘蛛男は蜘蛛男を能力で撃破することが出来る」）", () => {
    expect(choiceIds(assassin({ rush: [inst("RK-093", "ekm")] }))).toEqual(["RK-093:ekm"]);
  });

  it("RK-093: 3番目以外に出たときは発動しない（出典: atwiki/page-625「CN：3」・R-CN-01）", () => {
    const s = ncEnter("RK-093:km", 1, {}, enemy, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-093");
  });
});

// ===========================================================================
describe("RK-094 ショッカー戦闘員バイク部隊", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。 ※これは、自分がターンを終えるとき、ビークルにライドしていなければ撃破される。";

  it("RK-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-701）", () => {
    expectCatalogText("RK-094", TEXT);
    expectStats("RK-094", { name: "ショッカー戦闘員バイク部隊", category: "DA", size: "S", bp: 1500, sp: undefined, powerCost: 0, comboNumber: "RC", features: ["ショッカー", "男", "戦闘員"] });
    expectRarityIn("RK-094", ["N"]);
  });

  it("RK-094: ※ デッキに好きな枚数入れてもよい（出典: atwiki/page-701）", () => {
    expect(deckWithTen("RK-094", "ショッカー戦闘員バイク部隊")).toBe(true);
  });

  it.fails("RK-094: ※ 自分がターンを終えるとき、ビークルにライドしていなければ撃破される（バトルエリア・ラッシュエリアとも）（出典: atwiki/page-701「自分がターンを終えるとき、ビークルにライドしていなければ撃破される」）", () => {
    const s = endTurn(board({ battle: [inst("RK-094", "b1")], rush: [inst("RK-094", "b2")] }));
    expect(zoneOf(s, "player1", "RK-094:b1")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-094:b2")).toBe("discard");
  });

  it("RK-094: ※ ビークルにライドしていれば撃破されない（出典: atwiki/page-701）", () => {
    const s = endTurn(board({ battle: [inst("SPEC-VEHICLE", "v"), { ...inst("RK-094", "b1"), mountedOnInstanceId: "SPEC-VEHICLE:v" }] }));
    expect(zoneOf(s, "player1", "RK-094:b1")).not.toBe("discard");
  });

  it("RK-094: ※ 相手がターンを終えるときは撃破されない（出典: atwiki/page-701「自分がターンを終えるとき」）", () => {
    const s = endTurn(enemyTurn({ battle: [inst("RK-094", "b1")] }));
    expect(zoneOf(s, "player1", "RK-094:b1")).not.toBe("discard");
  });
});

// ===========================================================================
describe("RK-095 ハリケーン", () => {
  const TEXT =
    "【ハリケーンダッシュ】自分がターンを終えるとき、このビークルがバトルエリアでライドされていれば、このビークルにライドしているユニットをラッシュエリアに戻してもよい。（ライドオフしない限り、ユニットとビークルは重ねたまま扱う）";

  it("RK-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-658）", () => {
    expectCatalogText("RK-095", TEXT);
    expectVehicleStats("RK-095", { name: "ハリケーン", category: "ET", powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-095", ["N"]);
  });

  const riding = () => [inst("RK-095", "hu"), { ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "RK-095:hu" }];

  it("RK-095: ライドしているユニットの BP は変わらない（BP 修正の記載がない）（出典: atwiki/page-658）", () => {
    expect(bpOf(board({ battle: riding() }), "player1", "SPEC-RIDER:r")).toBe(2000);
  });

  it.fails("RK-095: 自分がターンを終えるとき、バトルエリアでライドされていれば、ライドしているユニットをラッシュエリアに戻すかを選べる（任意）（出典: atwiki/page-658「戻してもよい」）", () => {
    const s = toTurnEnd(board({ battle: riding() }), "RK-095");
    expectChoiceFrom(s, "player1", "RK-095");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-095: 戻すと、ユニットとビークルは重ねたままラッシュエリアに戻り、敵軍ターンにアタックされない（出典: atwiki/page-658「（ライドオフしない限り、ユニットとビークルは重ねたまま扱う）」・カード評価「やられてしまっては困るユニットを守るためのビークル」）", () => {
    const s = toTurnEnd(confirm(toTurnEnd(board({ battle: riding() }), "RK-095")));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "SPEC-RIDER:r")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-095:hu")).toBe("rush");
    expect(mountedOn(s, "player1", "SPEC-RIDER:r")).toBe("RK-095:hu");
  });

  it.fails("RK-095: 戻さなければバトルエリアに残る（出典: atwiki/page-658「戻してもよい」）", () => {
    const s = toTurnEnd(skip(toTurnEnd(board({ battle: riding() }), "RK-095")));
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "SPEC-RIDER:r")).toBe("battle");
  });

  it("RK-095: ラッシュエリアでライドされているとき・ライドされていないときは発動しない（出典: atwiki/page-658「このビークルがバトルエリアでライドされていれば」）", () => {
    const a = toTurnEnd(board({ rush: riding() }), "RK-095");
    expect(a.pendingEffectChoice?.sourceCardId).not.toBe("RK-095");
    const b = toTurnEnd(board({ battle: [inst("RK-095", "hu")] }), "RK-095");
    expect(b.pendingEffectChoice?.sourceCardId).not.toBe("RK-095");
  });

  it("RK-095: 相手がターンを終えるときは発動しない（出典: atwiki/page-658「自分がターンを終えるとき」）", () => {
    const s = toTurnEnd(enemyTurn({ battle: riding() }), "RK-095");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-095");
  });
});

// ===========================================================================
describe("RK-096 ハサミジャガー", () => {
  const TEXT = "【切断溶解】レジストを持つ敵軍Sユニットを1体選び撃破する。";

  it("RK-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-696）", () => {
    expectCatalogText("RK-096", TEXT);
    expectStats("RK-096", { name: "ハサミジャガー", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 4, comboNumber: 2, features: ["デストロン", "怪人", "男", "改造人間"] });
    expectRarityIn("RK-096", ["SR"]);
  });

  const cut = (p2: Partial<GameState["players"]["player2"]>) => ncEnter("RK-096:hj", 1, {}, p2, EXTRA);
  const enemy = { battle: [inst("RK-102", "df"), inst("SPEC-E", "plain")], rush: [inst("RK-104", "tf"), inst("RS-680", "mreg")] };

  it.fails("RK-096: NC — レジストを持つ敵軍 S ユニットを、バトルエリア・ラッシュエリアから選ぶ（M ユニット・レジストのないユニットは選べない。選ばないことはできない）（出典: atwiki/page-696「レジストを持つ敵軍Sユニットを1体選び撃破する」・カード評価「エリア制限が無い」）", () => {
    const s = cut(enemy);
    expectChoiceFrom(s, "player1", "RK-096");
    expect(choiceIds(s)).toEqual(["RK-102:df", "RK-104:tf"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-096: NC — 選んだユニットを撃破する（効果での撃破なのでレジストで留まれない）（出典: atwiki/page-696・R-KW-REG「バトルで撃破されたとき」）", () => {
    const s = resolveAll(pick(cut(enemy), "RK-104:tf"));
    expect(zoneOf(s, "player2", "RK-104:tf")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-102:df")).toBe("battle");
  });

  it("RK-096: 2番目以外に出たときは発動しない（出典: atwiki/page-696「CN：2」・R-CN-01）", () => {
    const s = ncEnter("RK-096:hj", 2, {}, enemy, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-096");
  });
});

// ===========================================================================
describe("RK-097 仮面ライダーX", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ライドルスティック】自軍コマンドゾーンから、ホールド状態のＲＣを持つユニットカードを1枚選び、手札に戻してもよい。そうしたとき、戻したカードのRCの効果を、このユニットの効果として発動する。";

  it("RK-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-615）", () => {
    expectCatalogText("RK-097", TEXT);
    expectStats("RK-097", { name: "仮面ライダーX", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-097", ["R"]);
  });

  it("RK-097: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-615「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-097", "x")] }, "RK-097:x", {}, "SPEC-BIG:atk", EXTRA))).toBe(true);
  });

  /** X をビークルにライドさせて出し、ライドオフする（RC の選択は残す）。 */
  const riddle = (command: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-097", "x"), inst("SPEC-VEHICLE", "v")], command }, p2), "RK-097:x", "SPEC-VEHICLE:v");
  const heldCard = (id: string, suffix: string): CardInstance => ({ ...inst(id, suffix), commandHeld: true });
  const releasedCard = (id: string, suffix: string): CardInstance => ({ ...inst(id, suffix), commandHeld: false });

  it.fails("RK-097: RC — 自軍コマンドゾーンのホールド状態の、RC を持つユニットカードだけを選べる（任意）（出典: atwiki/page-615「ホールド状態のＲＣを持つユニットカードを1枚選び、手札に戻してもよい」）", () => {
    const s = riddle([heldCard("RK-064", "fz"), releasedCard("RK-105", "sf"), heldCard("RK-096", "hj"), heldCard("TST-OP", "op")]);
    expectChoiceFrom(s, "player1", "RK-097");
    expect(choiceIds(s)).toEqual(["RK-064:fz"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-097: RC — 選んだカードは手札に戻り、そのカードの RC の効果（ファイズ【ファイズエッジ】）をこのユニットの効果として発動する（出典: atwiki/page-615「そうしたとき、戻したカードのRCの効果を、このユニットの効果として発動する」）", () => {
    let s = pick(riddle([heldCard("RK-064", "fz")], { battle: [inst("SPEC-E2500", "a"), inst("SPEC-E", "b")] }), "RK-064:fz");
    expect(zoneOf(s, "player1", "RK-064:fz")).toBe("hand");
    expectChoiceFrom(s, "player1", "RK-064");
    expect(choiceIds(s)).toEqual(["SPEC-E2500:a"]);
    s = resolveAll(pick(s, "SPEC-E2500:a"));
    expect(zoneOf(s, "player2", "SPEC-E2500:a")).toBe("discard");
  });

  it("RK-097: RC — 戻さなければ何も起きない（出典: atwiki/page-615「戻してもよい」）", () => {
    const s = settle(skip(riddle([heldCard("RK-064", "fz")], { battle: [inst("SPEC-E2500", "a")] })));
    expect(zoneOf(s, "player1", "RK-064:fz")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-E2500:a")).toBe("battle");
  });

  // 公式 Q「はい、できます。」
  it.fails("RK-097: 公式Q&A — 戻した仮面ライダーX の【ライドルスティック】で、コマンドゾーンの別の仮面ライダーX のカードを戻せる（出典: grnrngr/faq-rider-2 RK-097 Q）", () => {
    let s = pick(riddle([heldCard("RK-097", "x2"), heldCard("RK-097", "x3")]), "RK-097:x2");
    expect(zoneOf(s, "player1", "RK-097:x2")).toBe("hand");
    expectChoiceFrom(s, "player1", "RK-097");
    expect(choiceIds(s)).toEqual(["RK-097:x3"]);
    s = pick(s, "RK-097:x3");
    expect(zoneOf(s, "player1", "RK-097:x3")).toBe("hand");
  });

  it("RK-097: ライドオフしなければ発動しない（出典: atwiki/page-615「CN：RC」・R-KW-RC-01）", () => {
    const s = rideOff(mount(board({ rush: [inst("RK-097", "x"), inst("SPEC-VEHICLE", "v")], command: [heldCard("RK-064", "fz")] }), "RK-097:x", "SPEC-VEHICLE:v"), false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-097");
  });
});

// ===========================================================================
describe("RK-098 クルーザー", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1000される。 【水中走行】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒ 自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい（コマンドゾーンに置けるカードは通常5枚まで）。そうしたとき、相手も同じようにしてもよい。";

  it("RK-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-659）", () => {
    expectCatalogText("RK-098", TEXT);
    expectVehicleStats("RK-098", { name: "クルーザー", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-098", ["N"]);
  });

  it("RK-098: ※ これにライドしているユニットは BP+1000 される（出典: atwiki/page-659）", () => {
    const s = board({ battle: [inst("RK-098", "cr"), { ...inst("SPEC-RIDER", "r"), mountedOnInstanceId: "RK-098:cr" }] });
    expect(bpOf(s, "player1", "SPEC-RIDER:r")).toBe(3000);
  });

  const MY_DECK = [inst("TST-OP", "top"), inst("TST-OP", "mid"), inst("TST-OP-ET", "bottom")];
  const ENEMY_DECK = [inst("TST-OP", "etop"), inst("TST-OP-DA", "ebottom")];
  /** クルーザーにライドしてバトルエリアに出る（水中走行の確認は残す）。 */
  const cruise = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    mount(board({ rush: [inst("SPEC-RIDER", "r"), inst("RK-098", "cr")], deck: MY_DECK, ...p1 }, { deck: ENEMY_DECK, ...p2 }), "SPEC-RIDER:r", "RK-098:cr");

  it.fails("RK-098: 自軍ターン中、バトルエリアに出たとき、発動するかを選べる（出典: atwiki/page-659「次の効果を発動できる」）", () => {
    const s = cruise();
    expectChoiceFrom(s, "player1", "RK-098");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-098: 発動すると、自軍山札の下から1枚ひいて、自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-659「自軍山札の下から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = confirm(cruise());
    expect(zoneOf(s, "player1", "TST-OP-ET:bottom")).toBe("command");
    expect(cardIn(s, "player1", "TST-OP-ET:bottom")?.commandHeld).toBe(true);
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:top", "TST-OP:mid"]);
  });

  it.fails("RK-098: そうしたとき、相手も同じようにするかを選べ、選ぶと相手の山札の下の1枚が相手のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-659「そうしたとき、相手も同じようにしてもよい」）", () => {
    let s = confirm(cruise());
    expectChoiceFrom(s, "player2", "RK-098");
    expect(canSkip(s)).toBe(true);
    s = settle(confirm(s));
    expect(zoneOf(s, "player2", "TST-OP-DA:ebottom")).toBe("command");
    expect(cardIn(s, "player2", "TST-OP-DA:ebottom")?.commandHeld).toBe(true);
  });

  it.fails("RK-098: 相手が選ばなければ相手のコマンドは増えない（出典: atwiki/page-659「相手も同じようにしてもよい」）", () => {
    let s = confirm(cruise());
    s = settle(skip(s));
    expect(zoneOf(s, "player2", "TST-OP-DA:ebottom")).toBe("deck");
    expect(s.players.player2.command).toHaveLength(0);
  });

  it.fails("RK-098: 自分が発動しなければ、相手は何もしない（出典: atwiki/page-659「そうしたとき、」）", () => {
    const s = settle(skip(cruise()));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-098");
    expect(s.players.player1.command).toHaveLength(0);
    expect(s.players.player2.command).toHaveLength(0);
  });

  it("RK-098: 自軍コマンドゾーンにカードが5枚あれば置けない（出典: atwiki/page-659「（コマンドゾーンに置けるカードは通常5枚まで）」）", () => {
    const s = settle(cruise({ command: releasedCat("WB", 5) }));
    expect(s.players.player1.command).toHaveLength(5);
    expect(zoneOf(s, "player1", "TST-OP-ET:bottom")).toBe("deck");
  });
});

// 未使用の import を避けるための参照。
void act;
void fill;
void heldCount;
