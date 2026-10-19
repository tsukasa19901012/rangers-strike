/**
 * cardSpec XG4-091〜XG4-096（ガンギブソン〜バビロスBF）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activate,
  attack,
  canActivate,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  choicePlayer,
  damageOf,
  deckCards,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  faceUp,
  inst,
  lastBattleBps,
  p1Battle,
  pick,
  pickAs,
  pickThrough,
  powerCards,
  rcRideOff,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushVia,
  settle,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
} from "./XG4-084-102.helpers";

const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { bp: 1000, size: "M", sp: undefined });
const E_MAN = sUnit("SPEC-E-MAN", { category: "WB", bp: 1000, sp: undefined, features: ["男"] });
const E_DA_MAN = sUnit("SPEC-E-DA-MAN", { category: "DA", bp: 6000, sp: undefined, features: ["男"] });
const E_NOFEAT = sUnit("SPEC-E-NOFEAT", { category: "WB", bp: 1000, sp: undefined, features: ["メカ"] });
const E_5000 = sUnit("SPEC-E-5000", { bp: 5000, sp: undefined });
const E_6000 = sUnit("SPEC-E-6000", { bp: 6000, sp: undefined });
const E_8000 = sUnit("SPEC-E-8000", { bp: 8000, sp: undefined });
const E_9000 = sUnit("SPEC-E-9000", { bp: 9000, sp: undefined });
const E_WB = sUnit("SPEC-E-WB", { category: "WB", bp: 1000, sp: undefined });
const E_MA = sUnit("SPEC-E-MA", { category: "MA", bp: 1000, sp: undefined });
const DA_CARD = sUnit("SPEC-DA-CARD", { category: "DA", bp: 1000 });
const WB_CARD = sUnit("SPEC-WB-CARD", { category: "WB", bp: 1000 });
const KEIJI = sUnit("SPEC-KEIJI", { category: "OT", bp: 1000, sp: undefined, features: ["宇宙刑事"] });
const BIKE = vehicleCard("SPEC-BIKE", { category: "OT" });
const EXTRA = [E_S, E_M, E_MAN, E_DA_MAN, E_NOFEAT, E_5000, E_6000, E_8000, E_9000, E_WB, E_MA, DA_CARD, WB_CARD, KEIJI, BIKE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-091 ガンギブソン", () => {
  const TEXT =
    "※このユニットからコンビネーションする、特徴「メカ」を持つDA以外のSユニットは、ライドオフしなくてもＲＣの効果を発動できる。 【スピンドルキャノン】これをホールドすれば、次の効果を発動できる⇒相手は自分自身のユニットを1体選び、可能なら自軍コマンドゾーンにホールド状態で置く。";

  it("XG4-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-2118）", () => {
    expectCatalogText("XG4-091", TEXT);
    expectUnit("XG4-091", { name: "ガンギブソン", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: ["メカ", "人型"] });
    expectRarityIn("XG4-091", ["NR"]);
  });

  it.todo("XG4-091: ※ — これからコンビネーションする、特徴「メカ」を持つ DA 以外の S ユニットは、ライドオフしなくても RC の効果を発動できる（出典: atwiki/page-2118）（未対応の理由: 「このユニットからコンビネーションする」が RC 持ちのユニットのどの並べ方を指すか出典で決まらず、盤面を決められない）");

  const ready = () => board({ rush: [inst("XG4-091", "gg")] }, { battle: [inst("SPEC-E-S", "a")], rush: [inst("SPEC-E-M", "m")], deck: deckCards(3, "e") });

  it.fails("XG4-091:【スピンドルキャノン】— リリース状態のこれをホールドして発動でき、相手が自分自身のユニット（どのエリア・サイズでも）を1体選ぶ（出典: atwiki/page-2118「これをホールドすれば、次の効果を発動できる⇒相手は自分自身のユニットを1体選び」・カード評価「エリア・サイズを問わず相手ユニットを除去出来る」）（既知の不具合: CARD-XG4-091 【スピンドルキャノン】を起動できない）", () => {
    expect(canActivate(ready(), "XG4-091:gg")).toBe(true);
    const s = activate(ready(), "XG4-091:gg");
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E-M:m", "SPEC-E-S:a"]);
  });

  it.fails("XG4-091:【スピンドルキャノン】— 相手が選んだユニットは相手のコマンドゾーンにホールド状態で置かれ、これはホールド状態になる（出典: atwiki/page-2118「可能なら自軍コマンドゾーンにホールド状態で置く」）（既知の不具合: CARD-XG4-091 【スピンドルキャノン】を起動できない）", () => {
    let s = activate(ready(), "XG4-091:gg");
    s = resolveAll(pickAs(s, "player2", "SPEC-E-M:m"));
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "SPEC-E-M:m")?.commandHeld).toBe(true);
    expect(s.players.player1.rush.find((c) => c.instanceId === "XG4-091:gg")?.commandHeld).toBe(true);
  });

  it("XG4-091:【スピンドルキャノン】— ホールド状態のこれでは発動できない（出典: atwiki/page-2118「これをホールドすれば」）", () => {
    expect(canActivate(board({ rush: [{ ...inst("XG4-091", "gg"), commandHeld: true }] }, { battle: [inst("SPEC-E-S", "a")] }), "XG4-091:gg")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-092 ジャンパーソン", () => {
  const TEXT =
    "※これは、カテゴリにDAを持たない、特徴「男」または「女」を持つユニットにアタックできない。 【JANPERSON FOR JUSTICE】これはカテゴリにDAを持つユニットにアタックするとき、BP+2000される。また、これがカテゴリにDAを持つユニットをバトルで撃破したとき、相手に1点ダメージを与える。";

  it("XG4-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-2140）", () => {
    expectCatalogText("XG4-092", TEXT);
    expectUnit("XG4-092", { name: "ジャンパーソン", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["メカ", "人型", "警察"] });
    expectRarityIn("XG4-092", ["SR"]);
  });

  it.fails("XG4-092: ※ — DA を持たず「男」「女」を持つユニットにはアタックできない（DA の「男」、「男」「女」を持たないユニットにはアタックできる）（出典: atwiki/page-2140「カテゴリにDAを持たない、特徴「男」または「女」を持つユニットにアタックできない」）（既知の不具合: CARD-XG4-092 「男」「女」を持つ DA 以外のユニットにもアタックできてしまう）", () => {
    const s = battle({ battle: [inst("XG4-092", "jp")] }, { battle: [inst("SPEC-E-MAN", "m"), inst("SPEC-E-DA-MAN", "d"), inst("SPEC-E-NOFEAT", "n")] });
    expect(targetsOf(s, "XG4-092:jp")).toEqual(["SPEC-E-DA-MAN:d", "SPEC-E-NOFEAT:n"]);
  });

  it.fails("XG4-092:【JANPERSON FOR JUSTICE】— DA を持つユニットにアタックするとき BP+2000（BP7000 で BP6000 の DA に勝ち）、撃破すると相手に1点ダメージ（出典: atwiki/page-2140「BP+2000される。また…撃破したとき、相手に1点ダメージを与える」）（既知の不具合: CARD-XG4-092 【JANPERSON FOR JUSTICE】の BP+2000 が働かず、DA 以外を撃破してもダメージを与える）", () => {
    const s = resolveAll(settle(attack(battle({ battle: [inst("XG4-092", "jp")] }, { battle: [inst("SPEC-E-DA-MAN", "d")], deck: deckCards(3, "e") }), "XG4-092:jp", "SPEC-E-DA-MAN:d")));
    expect(lastBattleBps(s)?.attacker).toBe(7000);
    expect(zoneOf(s, "player2", "SPEC-E-DA-MAN:d")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("XG4-092:【JANPERSON FOR JUSTICE】— DA を持たないユニットにアタックするときは BP も上がらず、撃破してもダメージはない（出典: atwiki/page-2140「カテゴリにDAを持つユニットに」）（既知の不具合: CARD-XG4-092 【JANPERSON FOR JUSTICE】の BP+2000 が働かず、DA 以外を撃破してもダメージを与える）", () => {
    const s = resolveAll(settle(attack(battle({ battle: [inst("XG4-092", "jp")] }, { battle: [inst("SPEC-E-NOFEAT", "n")], deck: deckCards(3, "e") }), "XG4-092:jp", "SPEC-E-NOFEAT:n")));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG4-093 ビルゴルディ", () => {
  const TEXT = "【BILLGOLDY FOR EVIL】自軍ターン中、これがバトルエリアに出たとき、自軍ゾーンのオモテ向きのカードがすべてDAを持つなら、本来のBPが5000以下の敵軍ユニットを1体選び撃破する。";

  it("XG4-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-2152）", () => {
    expectCatalogText("XG4-093", TEXT);
    expectUnit("XG4-093", { name: "ビルゴルディ", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "男", "改造人間"] });
    expectRarityIn("XG4-093", ["SR"]);
  });

  const entered = (power: ReturnType<typeof inst>[]) =>
    settle(enterNow(battle({ rush: [inst("XG4-093", "bg")], power, command: [released("SPEC-DA-CARD", "c")] }, { battle: [inst("SPEC-E-5000", "a"), inst("SPEC-E-6000", "b")], rush: [inst("SPEC-E-M", "m")], deck: deckCards(3, "e") }), "XG4-093:bg"));

  it.fails("XG4-093:【BILLGOLDY FOR EVIL】— 自軍ゾーンのオモテ向きのカードがすべて DA なら、本来の BP が5000以下の敵軍ユニット（どのエリア・サイズでも）を1体選ぶ（BP6000 は選べない。任意ではない）（出典: atwiki/page-2152「本来のBPが5000以下の敵軍ユニットを1体選び撃破する」・カード評価「エリア・サイズを問わない除去効果」）（既知の不具合: CARD-XG4-093 【BILLGOLDY FOR EVIL】の候補がバトルエリアの BP だけで選ばれ（本来の BP・エリアを見ない）、DA 以外のオモテ向きのカードがあっても発動する）", () => {
    const s = entered([faceUp("SPEC-DA-CARD", "p1"), faceUp("SPEC-DA-CARD", "p2")]);
    expectChoiceFrom(s, "player1", "XG4-093");
    expect(choiceIds(s)).toEqual(["SPEC-E-5000:a", "SPEC-E-M:m"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-093:【BILLGOLDY FOR EVIL】— 選んだユニットは撃破される（出典: atwiki/page-2152「撃破する」）", () => {
    let s = entered([faceUp("SPEC-DA-CARD", "p1")]);
    expectChoiceFrom(s, "player1", "XG4-093");
    s = resolveAll(pick(s, "SPEC-E-5000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-5000:a")).toBe("discard");
  });

  it.fails("XG4-093:【BILLGOLDY FOR EVIL】— DA を持たないオモテ向きのカード（WB のパワー）があれば発動しない（出典: atwiki/page-2152「自軍ゾーンのオモテ向きのカードがすべてDAを持つなら」）（既知の不具合: CARD-XG4-093 【BILLGOLDY FOR EVIL】の候補がバトルエリアの BP だけで選ばれ（本来の BP・エリアを見ない）、DA 以外のオモテ向きのカードがあっても発動する）", () => {
    const s = entered([faceUp("SPEC-DA-CARD", "p1"), faceUp("SPEC-WB-CARD", "p2")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-093");
  });
});

// ===========================================================================
describe("XG4-094 宇宙刑事シャイダー（XG4）", () => {
  const TEXT = "※チェイス 【ビデオビームガン】敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、リリースしたカードと同じカテゴリを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG4-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-2144）", () => {
    expectCatalogText("XG4-094", TEXT);
    expectUnit("XG4-094", { name: "宇宙刑事シャイダー", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["宇宙刑事", "メカ", "男", "警察"] });
    expectRarityIn("XG4-094", ["R"]);
  });

  const rodeOff = () =>
    settle(
      rcRideOff(
        battle({ rush: [inst("XG4-094", "sh"), inst("SPEC-BIKE", "bk")] }, { command: [{ ...inst("SPEC-WB-CARD", "hc"), commandHeld: true }, released("SPEC-DA-CARD", "rc")], battle: [inst("SPEC-E-WB", "w")], rush: [inst("SPEC-E-MA", "m")], deck: deckCards(3, "e") }),
        "XG4-094:sh",
        "SPEC-BIKE:bk",
      ),
    );

  it.fails("XG4-094: RC【ビデオビームガン】— ライドオフしたとき、ホールド状態の敵軍コマンドを1つ選んでリリースできる（任意）（出典: atwiki/page-2144「敵軍コマンドを1つ選びリリースしてもよい」）（既知の不具合: CARD-XG4-094 RC【ビデオビームガン】の選択が開かない）", () => {
    const s = rodeOff();
    expectChoiceFrom(s, "player1", "XG4-094");
    expect(choiceIds(s)).toContain("SPEC-WB-CARD:hc");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-094: RC — リリースすると、そのカードと同じカテゴリ（WB）の敵軍 S ユニットを1体撃破する（MA は選べない）（出典: atwiki/page-2144「リリースしたカードと同じカテゴリを持つ敵軍Sユニットを1体選び撃破する」）（既知の不具合: CARD-XG4-094 RC【ビデオビームガン】の選択が開かない）", () => {
    let s = rodeOff();
    expectChoiceFrom(s, "player1", "XG4-094");
    s = pick(s, "SPEC-WB-CARD:hc");
    if (s.pendingEffectChoice?.sourceCardId === "XG4-094") {
      expect(choiceIds(s)).toEqual(["SPEC-E-WB:w"]);
      s = pick(s, "SPEC-E-WB:w");
    }
    s = resolveAll(s);
    expect(s.players.player2.command.find((c) => c.instanceId === "SPEC-WB-CARD:hc")?.commandHeld).toBeFalsy();
    expect(zoneOf(s, "player2", "SPEC-E-WB:w")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-MA:m")).toBe("rush");
  });
});

// ===========================================================================
describe("XG4-095 バビロスSF", () => {
  const TEXT =
    "※自分が「バビロス」をラッシュしたとき、自軍エリアに「バビロスBF」または「バビロスSF」があれば1体選び手札に戻す。 ※これはバトルエリアに出られない。 【ビッグマグナム】 これが自軍エリアにある間、特徴「宇宙刑事」を持つ自軍ユニットがバトルエリアに出たとき、これをホールドして次の効果を発動できる⇒敵軍バトルエリアから、BP8000以下のユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG4-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-2121）", () => {
    expectCatalogText("XG4-095", TEXT);
    expectUnit("XG4-095", { name: "バビロスSF", category: "OT", size: "XL", bp: 9000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["メカ"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG4-095", ["N"]);
  });

  it("XG4-095: 追加条件 — 自軍「バビロス」（XG2-084）を手札に戻してラッシュできる（出典: atwiki/page-2121「追加条件：自軍「バビロス」または「バビロスBF」を手札に戻す」）", () => {
    const r = rushVia(board({ hand: [inst("XG4-095", "sf")], rush: [inst("XG2-084", "bb")], command: releasedCat("OT", 1), power: powerCards(6) }), "player1", "XG4-095:sf");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-095:sf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-084:bb")).toBe("hand");
  });

  it("XG4-095: 追加条件 — 「バビロスBF」を手札に戻してもラッシュできる（出典: atwiki/page-2121「または「バビロスBF」」）", () => {
    const r = rushVia(board({ hand: [inst("XG4-095", "sf")], rush: [inst("XG4-096", "bf")], command: releasedCat("OT", 1), power: powerCards(6) }), "player1", "XG4-095:sf");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG4-096:bf")).toBe("hand");
  });

  it("XG4-095: 追加条件 — どちらもいなければラッシュできない（出典: atwiki/page-2121）", () => {
    expect(canStartRush(board({ hand: [inst("XG4-095", "sf")], command: releasedCat("OT", 1), power: powerCards(6) }), "player1", "XG4-095:sf")).toBe(false);
  });

  it("XG4-095: ※ — バトルエリアに出られない（出典: atwiki/page-2121「これはバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG4-095", "sf")], command: releasedCat("OT", 2) }), "XG4-095:sf")).toBe(false);
  });

  const keijiEnters = () =>
    settle(enterNow(battle({ rush: [inst("XG4-095", "sf"), inst("SPEC-KEIJI", "k")] }, { battle: [inst("SPEC-E-8000", "a"), inst("SPEC-E-9000", "b")], rush: [inst("SPEC-E-S", "r")], deck: deckCards(3, "e") }), "SPEC-KEIJI:k"));

  it.fails("XG4-095:【ビッグマグナム】— 特徴「宇宙刑事」を持つ自軍ユニットがバトルエリアに出たとき、これをホールドして発動できる（任意）（出典: atwiki/page-2121「これをホールドして次の効果を発動できる」）（既知の不具合: CARD-XG4-095 【ビッグマグナム】の選択が開かない）", () => {
    const s = keijiEnters();
    expectChoiceFrom(s, "player1", "XG4-095");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-095:【ビッグマグナム】— 発動すると、敵軍バトルエリアの BP8000 以下のユニットを1体選び、持ち主のパワーゾーンに送る（BP9000・ラッシュエリアは選べない）（出典: atwiki/page-2121「敵軍バトルエリアから、BP8000以下のユニットを1体選び、持ち主のパワーゾーンに送る」）（既知の不具合: CARD-XG4-095 【ビッグマグナム】の選択が開かない）", () => {
    let s = keijiEnters();
    expectChoiceFrom(s, "player1", "XG4-095");
    s = resolveAll(pickThrough(s, "XG4-095", ["SPEC-E-8000:a"]));
    expect(zoneOf(s, "player2", "SPEC-E-8000:a")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E-9000:b")).toBe("battle");
    expect(s.players.player1.rush.find((c) => c.instanceId === "XG4-095:sf")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG4-096 バビロスBF", () => {
  const TEXT =
    "※自分が「バビロス」をラッシュしたとき、自軍エリアに「バビロスBF」または「バビロスSF」があれば1体選び手札に戻す。 【バビロスファイヤー】 これをラッシュしたとき、敵軍パワーゾーンからカードを1枚選び捨札にしてもよい。そうしたとき、敵軍捨札からカードを1枚選び敵軍パワーゾーンにオモテ向きで置く。";

  it("XG4-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-2122）", () => {
    expectCatalogText("XG4-096", TEXT);
    expectUnit("XG4-096", { name: "バビロスBF", category: "OT", size: "XL", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG4-096", ["N"]);
  });

  const rushed = () => {
    const r = rushVia(
      board({ hand: [inst("XG4-096", "bf")], rush: [inst("XG2-084", "bb")], command: releasedCat("OT", 1), power: powerCards(5) }, { power: [faceUp("SPEC-WB-CARD", "ep")], discard: [inst("SPEC-DA-CARD", "ed")] }),
      "player1",
      "XG4-096:bf",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG4-096: 追加条件 — 自軍「バビロス」（XG2-084）を手札に戻してラッシュできる（出典: atwiki/page-2122「追加条件：自軍「バビロス」または「バビロスSF」1体を手札に戻す」）", () => {
    const s = rushed();
    expect(zoneOf(s, "player1", "XG4-096:bf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-084:bb")).toBe("hand");
  });

  it.fails("XG4-096:【バビロスファイヤー】— ラッシュしたとき、敵軍パワーゾーンのカードを1枚選んで捨札にできる（任意）（出典: atwiki/page-2122「敵軍パワーゾーンからカードを1枚選び捨札にしてもよい」）（既知の不具合: CARD-XG4-096 【バビロスファイヤー】の選択が開かない）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-096");
    expect(choiceIds(s)).toContain("SPEC-WB-CARD:ep");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-096:【バビロスファイヤー】— 捨札にすると、敵軍捨札のカードを1枚選び敵軍パワーゾーンにオモテ向きで置く（出典: atwiki/page-2122「敵軍捨札からカードを1枚選び敵軍パワーゾーンにオモテ向きで置く」）（既知の不具合: CARD-XG4-096 【バビロスファイヤー】の選択が開かない）", () => {
    let s = rushed();
    expectChoiceFrom(s, "player1", "XG4-096");
    s = resolveAll(pickThrough(pick(s, "SPEC-WB-CARD:ep"), "XG4-096", ["SPEC-DA-CARD:ed"]));
    expect(zoneOf(s, "player2", "SPEC-WB-CARD:ep")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DA-CARD:ed")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "SPEC-DA-CARD:ed")?.faceDown).toBeFalsy();
  });
});
