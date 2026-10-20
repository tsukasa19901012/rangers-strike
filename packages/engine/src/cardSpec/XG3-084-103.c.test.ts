/**
 * カード別スペック: XG3-098〜XG3-103（クロスギャザー ザ・Wインパクト ロボタック〜ライジンゴー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. 公式FAQ・エラッタ: grnrngr の公式FAQ・docs/rules/08-errata.md に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-103 Q1〜Q4（page-1884。【噛みつき】で S ユニットになってもラッシュしたことにはならない、など）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・RC・NC・ゾードダウン R-ADD-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  advanceToBattle,
  attack,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  DEFS,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectOpStats,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  inst,
  legal,
  lineUp,
  PLAIN_VEHICLE,
  powerCards,
  rcEnter,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  st,
  sUnit,
  useCard,
  useRef,
  vehicleCard,
  zordDownTests,
  zoneOf,
} from "./XG3-084-103.helpers";

const BP5 = sUnit("SPEC-BP5", { bp: 5000 });
const SVEH = vehicleCard("SPEC-SV", { category: "WB" });
const MA_RC = sUnit("SPEC-MA-RC", { category: "MA", bp: 1000, comboNumber: "RC" });
const MA_NORC = sUnit("SPEC-MA-NORC", { category: "MA", bp: 1000 });
const EXTRA = [BP5, SVEH, MA_RC, MA_NORC, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-098 ロボタック", () => {
  it("XG3-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-1950「BP：1000」「SP：－」「必要パワー：3」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-098",
      "※レジスト 【ジシャックチェンジ】これが自軍バトルエリアからラッシュエリアに戻るとき、これをホールドして次の効果を発動できる⇒自軍山札から特徴「スペシャルモード」を持つカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。",
    );
    expectUnitStats("XG3-098", { name: "ロボタック", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG3-098", ["N"]);
  });

  resistTests("XG3-098", "atwiki/page-1950");

  it("XG3-098:【ジシャックチェンジ】— 自軍バトルエリアからラッシュエリアに戻るとき、これをホールドして自軍山札の「スペシャルモード」のカード（XG3-099）を手札に加えられる（出典: atwiki/page-1950「これをホールドして次の効果を発動できる⇒自軍山札から特徴「スペシャルモード」を持つカードを1枚選び、相手に見せてから手札に加える」）", () => {
    let s = st({ phase: "start", player1: { battle: [inst("XG3-098", "rt")], deck: [inst("TST-UNIT-0", "x"), inst("XG3-099", "sp"), ...deckCards(3)] }, player2: { deck: deckCards(3, "e") } }, EXTRA);
    s = act(s, legal(s).find((a) => a.type === "return_all_battle_to_rush")!);
    s = resolveAll(useRef(s, "XG3-098:rt"), ["XG3-099:sp"]);
    expect(zoneOf(s, "player1", "XG3-099:sp")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:x")).toBe("deck");
    expect(zoneOf(s, "player1", "XG3-098:rt")).toBe("rush");
    expect(cardIn(s, "player1", "XG3-098:rt")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG3-099 ロボタックSM", () => {
  it("XG3-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-2010「BP：4500」「SP：1」「必要パワー：7-」「CN：5」「レアリティ：スーパーレア」）", () => {
    expectCatalogText(
      "XG3-099",
      "※これが撃破されて捨札になったとき、自軍コマンドゾーンか自軍捨札から「ロボタック」のカードを1枚選び、自軍ラッシュエリアに出す。 【RKバー】 敵軍バトルエリアからSユニットを1体選んでもよい。そうしたとき、選んだユニットは、次の相手ターン、アタックもストライクもできない。",
    );
    expectUnitStats("XG3-099", { name: "ロボタックSM", category: "ET", size: "S", bp: 4500, sp: 1, powerCost: "7-", comboNumber: 5, features: ["メカ", "人型", "スペシャルモード"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG3-099", ["SR"]);
  });

  zordDownTests("XG3-099", "XG3-098", "ロボタック", "atwiki/page-2010「追加条件：自軍「ロボタック」1体をコマンドゾーンに送るか捨札にすれば必要パワー0になる」", "ET");

  it("XG3-099: 追加条件 — 「ロボタック」をコマンドゾーンに送っても必要パワー0でラッシュできる（出典: atwiki/page-2010「コマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    const r = rushVia(board({ hand: [inst("XG3-099", "sm")], rush: [inst("XG3-098", "rt")], power: [], command: releasedCat("ET", 1) }), "player1", "XG3-099:sm", (a) => a.zordMaterialInstanceId === "XG3-098:rt" && a.zordMaterialDestination === "command");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG3-099:sm")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-098:rt")).toBe("command");
  });

  const destroyed = (p1: P1) => resolveAll(settle(attack(st({ activePlayer: "player2", player1: { deck: deckCards(5), battle: [inst("XG3-099", "sm")], ...p1 }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") } }, EXTRA), "TST-UNIT-7:atk", "XG3-099:sm", "player2")));

  it("XG3-099: ※ 撃破されて捨札になったとき、自軍コマンドゾーンの「ロボタック」を自軍ラッシュエリアに出す（出典: atwiki/page-2010「自軍コマンドゾーンか自軍捨札から「ロボタック」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = destroyed({ command: [inst("XG3-098", "rc")] });
    expect(zoneOf(s, "player1", "XG3-099:sm")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-098:rc")).toBe("rush");
  });

  it("XG3-099: ※ 自軍捨札の「ロボタック」でも出せる（出典: atwiki/page-2010「自軍コマンドゾーンか自軍捨札から」）", () => {
    const s = destroyed({ discard: [inst("XG3-098", "rd")] });
    expect(zoneOf(s, "player1", "XG3-098:rd")).toBe("rush");
  });

  const nc5 = () => line(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c", "TST-UNIT-0:d", "XG3-099:sm"], {}, { battle: [inst("SPEC-BP5", "b5"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "r")] });

  it("XG3-099:【RKバー】— 5番目に出たとき（NC5）、敵軍バトルエリアの S ユニットを1体選べる（M・ラッシュエリアは選べない。任意）（出典: atwiki/page-2010「敵軍バトルエリアからSユニットを1体選んでもよい」）", () => {
    const s = nc5();
    expect(choiceIds(s)).toEqual(["SPEC-BP5:b5"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-099:【RKバー】— 選んだユニットは次の相手ターン、アタックもストライクもできない（出典: atwiki/page-2010「選んだユニットは、次の相手ターン、アタックもストライクもできない」）", () => {
    let s = resolveAll(nc5(), ["SPEC-BP5:b5"]);
    s = advanceToBattle(endTurn(s), "player2");
    s = enter(s, "SPEC-BP5:b5", "player2");
    expect(legal(s).some((a) => (a.type === "battle" && a.attackerInstanceId === "SPEC-BP5:b5") || (a.type === "strike" && a.instanceId === "SPEC-BP5:b5"))).toBe(false);
  });
});

// ===========================================================================
describe("XG3-100 少年同盟", () => {
  it("XG3-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-2012「種類：オペレーション」「必要パワー：4」「レアリティ：レア」）", () => {
    expectCatalogText(
      "XG3-100",
      "自分の手札から、Sビークルのカードと、MAを持ちRCを持つSユニットのカードをそれぞれ1枚ずつ選び、相手に見せてもよい。そうしたとき、見せた2枚のカードを好きな順番で自軍ラッシュエリアに出す。ただし、追加条件はそれぞれ満たすこと。",
    );
    expectOpStats("XG3-100", { name: "少年同盟", category: "MA", powerCost: 4 });
    expect(DEFS["XG3-100"]!.features ?? []).toEqual([]);
    expectRarityIn("XG3-100", ["R"]);
  });

  it("XG3-100: 使うと、手札の S ビークル（カテゴリを問わない）と MA・RC の S ユニットを1枚ずつ自軍ラッシュエリアに出せる（RC のない MA ユニットは選べない）（出典: atwiki/page-2012「Sビークルのカードと、MAを持ちRCを持つSユニットのカードをそれぞれ1枚ずつ選び…自軍ラッシュエリアに出す」・コメント欄「ビークルの方はカテゴリも無視できる」）", () => {
    const s0 = board({ hand: [inst("XG3-100", "op"), inst("SPEC-SV", "v"), inst("SPEC-MA-RC", "u"), inst("SPEC-MA-NORC", "n")], power: powerCards(4), command: releasedCat("MA", 1) });
    const s = resolveAll(useCard(s0, "player1", "XG3-100:op"), ["SPEC-SV:v", "SPEC-MA-RC:u"]);
    expect(zoneOf(s, "player1", "SPEC-SV:v")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-MA-RC:u")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-MA-NORC:n")).toBe("hand");
  });
});

// ===========================================================================
describe("XG3-101 イナズマン", () => {
  it("XG3-101: カタログ本文・スペックが出典と一致（出典: atwiki/page-1966「BP：4000」「SP：1/3」「必要パワー：4+」「CN：RC」「レアリティ：スーパーレア」）", () => {
    expectCatalogText(
      "XG3-101",
      "※レジスト ※敵軍ターン中、これをラッシュしたとき、そのターンのバトルフェイズを飛ばす。 【逆転チェスト】次の相手ターン中、1度だけ次の効果を発動できる⇒これがユニットでなくなるとき、これをホールドしてその場に留めてもよい。そうしたとき、これのBP以下のBPを持つ敵軍ユニットを1体選び撃破する。",
    );
    expectUnitStats("XG3-101", { name: "イナズマン", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: "4+", comboNumber: "RC", features: ["昆虫", "男"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG3-101", ["SR"]);
  });

  resistTests("XG3-101", "atwiki/page-1966");

  it("XG3-101: 追加条件 — 自軍「サナギマン」1体を捨札にし、パワー4でラッシュできる（出典: atwiki/page-1966「必要パワー：4+」「追加条件：自軍「サナギマン」1体を捨札する」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG3-101", "iz")], rush: [inst("XG3-102", "sg")], power: powerCards(4), command: releasedCat("MA", 1) }), "player1", "XG3-101:iz", { materials: ["XG3-102:sg"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG3-101:iz")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-102:sg")).toBe("discard");
  });

  it("XG3-101: 追加条件 — 「サナギマン」がいなければラッシュできない（出典: atwiki/page-1966「追加条件：自軍「サナギマン」1体を捨札する」）", () => {
    expect(canStartRush(board({ hand: [inst("XG3-101", "iz")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(6), command: releasedCat("MA", 1) }), "player1", "XG3-101:iz")).toBe(false);
  });

  it.todo("XG3-101: ※ 敵軍ターン中にこれをラッシュしたとき、そのターンのバトルフェイズを飛ばす（敵軍ターン中にこれをラッシュする手順を用意できない。そのための XG3-102【チョーリキショーライ！】がエンジンにない）（出典: atwiki/page-1966「敵軍ターン中、これをラッシュしたとき、そのターンのバトルフェイズを飛ばす」）");

  it("XG3-101:【逆転チェスト】— RC した次の相手ターン、バトルで撃破されるとき、ホールドしてその場に留まり、BP4000 以下の敵軍ユニット（ラッシュエリアの BP1000）を撃破できる（出典: atwiki/page-1966「これがユニットでなくなるとき、これをホールドしてその場に留めてもよい。そうしたとき、これのBP以下のBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = resolveAll(rcEnter("XG3-101:iz", { deck: deckCards(8) }, { battle: [inst("SPEC-BP5", "b5"), inst("TST-UNIT-0", "x")], deck: deckCards(8, "e") }, EXTRA));
    s = advanceToBattle(endTurn(s), "player2");
    s = attack(enter(s, "SPEC-BP5:b5", "player2"), "SPEC-BP5:b5", "XG3-101:iz", "player2");
    s = resolveAll(useRef(s, "XG3-101:iz"), ["TST-UNIT-0:x"]);
    expect(zoneOf(s, "player1", "XG3-101:iz")).toBe("battle");
    expect(cardIn(s, "player1", "XG3-101:iz")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP5:b5")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-102 サナギマン", () => {
  it("XG3-102: カタログ本文・スペックが出典と一致（出典: atwiki/page-1952「BP：500」「SP：－」「必要パワー：1」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-102",
      "※レジスト 【チョーリキショーライ！】敵軍ターン中、このユニットがホールド状態になったとき、MAを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒これをリリースするか、自分の手札から「イナズマン」のユニットカードを1枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。",
    );
    expectUnitStats("XG3-102", { name: "サナギマン", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["昆虫", "男"] });
    expectRarityIn("XG3-102", ["N"]);
  });

  resistTests("XG3-102", "atwiki/page-1952");

  /** 敵軍ターン中にアタックされ、※レジストでホールドした直後。 */
  const heldByResist = () => {
    const s = attackUntilRegister({ battle: [inst("XG3-102", "sg")], hand: [inst("XG3-101", "iz")], command: releasedCat("MA", 1) }, "XG3-102:sg");
    return act(s, legal(s).find((a) => a.type === "use_register" && a.playerId === "player1")!);
  };

  it("XG3-102:【チョーリキショーライ！】— 敵軍ターン中にホールド状態になったとき、MA のコマンドをホールドしてこれをリリースできる（出典: atwiki/page-1952「MAを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒これをリリースするか」）", () => {
    const s = resolveAll(useRef(heldByResist(), "XG3-102:sg"), ["XG3-102:sg"]);
    expect(cardIn(s, "player1", "XG3-102:sg")?.commandHeld).toBeFalsy();
    expect(cardIn(s, "player1", "TST-OP-MA:cMA0")?.commandHeld).toBe(true);
  });

  it("XG3-102:【チョーリキショーライ！】— かわりに手札の「イナズマン」を、追加条件（このサナギマンを捨札）を満たして自軍ラッシュエリアに出せる（必要パワーは要らない）（出典: atwiki/page-1952「自分の手札から「イナズマン」のユニットカードを1枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと」・コメント欄「必要パワーを満たすようにと書いてないし、追加条件だけでよし」）", () => {
    const s = resolveAll(useRef(heldByResist(), "XG3-102:sg"), ["XG3-101:iz", "XG3-102:sg"]);
    expect(zoneOf(s, "player1", "XG3-101:iz")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-102:sg")).toBe("discard");
  });

  it("XG3-102:【チョーリキショーライ！】— MA を持つ自軍コマンドがリリース状態でなければ発動できない（出典: atwiki/page-1952「MAを持つ自軍コマンドを1つホールドして」）", () => {
    const s0 = attackUntilRegister({ battle: [inst("XG3-102", "sg")], hand: [inst("XG3-101", "iz")], command: releasedCat("WB", 1) }, "XG3-102:sg");
    const s = act(s0, legal(s0).find((a) => a.type === "use_register" && a.playerId === "player1")!);
    expect(refsOf(s, "XG3-102:sg")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-103 ライジンゴー", () => {
  it("XG3-103: カタログ本文・スペックが出典と一致（出典: atwiki/page-1884「種類：Sビークル」「必要パワー：2」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-103",
      "【噛みつき】自軍バトルフェイズ中、このビークルが自軍ラッシュエリアでライドされていなければ、自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは本来のテキストを持たないSユニットとして扱い、次の情報とテキストが追加される⇒「BP2000」「SP空欄」「ウイング」",
    );
    expectVehicleStats("XG3-103", { name: "ライジンゴー", category: "ET", powerCost: 2, size: "S", features: ["メカ", "獣", "車両", "航空機"] });
    expectRarityIn("XG3-103", ["N"]);
  });

  it("XG3-103:【噛みつき】— 自軍バトルフェイズ中、ラッシュエリアでライドされていなければ、自軍コマンドを1つホールドして、このターン BP2000 の S ユニットとしてバトルエリアに出られる（出典: atwiki/page-1884「自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは本来のテキストを持たないSユニットとして扱い、次の情報とテキストが追加される⇒「BP2000」「SP空欄」「ウイング」」）", () => {
    let s = battle({ rush: [inst("XG3-103", "rg")], command: releasedCat("ET", 1) });
    s = resolveAll(useRef(s, "XG3-103:rg"));
    expect(cardIn(s, "player1", "TST-OP-ET:cET0")?.commandHeld).toBe(true);
    expect(canEnter(s, "XG3-103:rg")).toBe(true);
  });

  it("XG3-103:【噛みつき】— 使わなければ、ライドされていないビークルのままバトルエリアに出られない（出典: atwiki/page-1884「このビークルが自軍ラッシュエリアでライドされていなければ」・一般ルール）", () => {
    const s = battle({ rush: [inst("XG3-103", "rg")], command: releasedCat("ET", 1) });
    expect(canEnter(s, "XG3-103:rg")).toBe(false);
  });
});
