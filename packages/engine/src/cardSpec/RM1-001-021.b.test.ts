/**
 * カード別スペック: RM-008〜RM-014（スペシャルメタルエディション 対バイオロン法〜ソニックフラップ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし。RM-012 はスターター再録版の常駐アイコンの記載漏れの読み替えだけで、効果は変わらない）。
 *     grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない（「RM-008」〜「RM-014」とカード名で検索）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01・R-KW-SCRUM-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア」を MR として照合する（クロスギャザー再録版はノーマル）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  activateResident,
  attack,
  attackTargets,
  canActivateResident,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  fill,
  heldCount,
  heldN,
  inst,
  ncFired,
  nextPhase,
  passEntry,
  pick,
  played,
  powerCards,
  releasedCat,
  residentOp,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  stackedUnder,
  strike,
  sUnit,
  zoneOf,
} from "./RM1-001-021.helpers";

const BIO_TEXT = "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。";
const BIO = sUnit("SPEC-BIO", { category: "DA", bp: 5000, text: BIO_TEXT } as Partial<CardDefinition>);
const BIO_M = sUnit("SPEC-BIO-M", { category: "DA", bp: 6000, size: "M", text: BIO_TEXT } as Partial<CardDefinition>);
const PLAIN = sUnit("SPEC-PLAIN", { category: "DA", bp: 5000 });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const ET_M = sUnit("SPEC-ET-M", { category: "ET", bp: 3000, size: "M" });
const ET_CN3 = sUnit("SPEC-ET-CN3", { category: "ET", bp: 1000, comboNumber: 3 } as Partial<CardDefinition>);
const ET_RC = sUnit("SPEC-ET-RC", { category: "ET", bp: 1000, comboNumber: "RC" } as Partial<CardDefinition>);
const WB_CN3 = sUnit("SPEC-WB-CN3", { category: "WB", bp: 1000, comboNumber: 3 } as Partial<CardDefinition>);
const ET_CN3_M = sUnit("SPEC-ET-CN3-M", { category: "ET", bp: 3000, size: "M", comboNumber: 3 } as Partial<CardDefinition>);
const BLUE3 = sUnit("SPEC-BLUE3", { category: "ET", bp: 1000, comboNumber: 3, features: ["ブルー"] } as Partial<CardDefinition>);
const SWAT3 = sUnit("SPEC-SWAT3", { category: "ET", bp: 1000, comboNumber: 3, features: ["スワット"] } as Partial<CardDefinition>);
const PLAIN3 = sUnit("SPEC-PLAIN3", { category: "ET", bp: 1000, comboNumber: 3 } as Partial<CardDefinition>);
const CN4 = sUnit("SPEC-CN4", { category: "ET", bp: 1000, comboNumber: 4 } as Partial<CardDefinition>);
const RUSHER = sUnit("SPEC-RUSHER", { category: "WB", bp: 1000 });
const VEHICLE_S = { id: "SPEC-VS", name: "SPEC-VS", type: "vehicle", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 0, size: "S", features: ["メカ"] } as unknown as CardDefinition;
const VEHICLE_L = { id: "SPEC-VL", name: "SPEC-VL", type: "vehicle", category: "OT", rarity: "N", expansion: "card-spec", powerCost: 5, size: "L", features: ["メカ"] } as unknown as CardDefinition;
const EXTRA = [BIO, BIO_M, PLAIN, ET_S, ET_M, ET_CN3, ET_RC, WB_CN3, ET_CN3_M, BLUE3, SWAT3, PLAIN3, CN4, RUSHER, VEHICLE_S, VEHICLE_L];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RM-008 対バイオロン法", () => {
  const TEXT =
    "敵軍バトルエリアから「これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれた敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  const used = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    played(
      board(
        { hand: [inst("RM-008", "op")], command: releasedCat("ET", 1), power: powerCards(3), rush: [inst("SPEC-BIO", "own")] },
        { battle: [inst("SPEC-BIO", "b"), inst("SPEC-BIO-M", "bm"), inst("SPEC-PLAIN", "p")], rush: [inst("SPEC-BIO", "r")], ...p2 },
      ),
      "RM-008:op",
    );

  it("RM-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-880）", () => {
    expectCatalogText("RM-008", TEXT);
    expectOpStats("RM-008", { name: "対バイオロン法", category: "ET", powerCost: 3 });
    expectRarityIn("RM-008", ["MR"]);
  });

  it.fails("RM-008: 選べるのは、その文が書かれた敵軍バトルエリアのユニット（サイズを問わない）。ラッシュエリアのユニット・文のないユニット・自軍のユニットは選べない（出典: atwiki/page-880「敵軍バトルエリアから…と書かれた敵軍ユニットを1体選び」・カード評価「サイズ指定がない」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "RM-008");
    expect(choiceIds(s)).toEqual(["SPEC-BIO-M:bm", "SPEC-BIO:b"].sort());
  });

  it.fails("RM-008: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-880「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(used(), "SPEC-BIO-M:bm"));
    expect(zoneOf(s, "player2", "SPEC-BIO-M:bm")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-BIO-M:bm")?.commandHeld).toBe(true);
  });

  it.fails("RM-008: 持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-880「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(used({ command: heldN(5, "TST-OP", "ec") }), "SPEC-BIO:b"));
    expect(zoneOf(s, "player2", "SPEC-BIO:b")).toBe("discard");
  });

  it.todo(
    "RM-008: 効果で同じ文の能力を得たユニット（atwiki カード評価「京介変身体や音撃と組み合わせれば効果の適用範囲がぐっと広がる」）も選べるか — コミュニティの記述だけで、「書かれた」に付与された能力を含めるかを確かめる公式の記述がない。エンジンはカードに印刷された文だけを見る",
  );
});

// ===========================================================================
describe("RM-009 マルチパック", () => {
  const TEXT =
    "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。このカードに重ねたユニットがストライクしてダメージを与えたとき、自軍捨札からSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。置けなければ手札に加える。";

  const packed = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(
      played(board({ hand: [inst("RM-009", "op")], command: releasedCat("ET", 1), power: powerCards(4), rush: [inst("TST-UNIT-0", "u")], ...p1 }, p2), "RM-009:op"),
      ["TST-UNIT-0:u"],
    );
  const DISCARD = [inst("SPEC-ET-S", "ds"), inst("SPEC-ET-M", "dm"), inst("TST-OP", "dop")];
  /** マルチパックを重ねた TST-UNIT-0 をバトルフェイズに1番目に出してストライクする（相手のダメージの支払いまで進める）。 */
  const struck = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    let s = nextPhase(packed({ discard: DISCARD, ...p1 }));
    s = enter(s, "TST-UNIT-0:u");
    return settle(strike(s, "TST-UNIT-0:u"));
  };

  it("RM-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-830）", () => {
    expectCatalogText("RM-009", TEXT);
    expectOpStats("RM-009", { name: "マルチパック", category: "ET", powerCost: 4 });
    expectRarityIn("RM-009", ["MR", "N"]);
  });

  it.fails("RM-009: 選べるのは自軍の S ユニット（M ユニットは選べない）（出典: atwiki/page-830「自軍Sユニットを1体選ぶ」）", () => {
    const s = played(board({ hand: [inst("RM-009", "op")], command: releasedCat("ET", 1), power: powerCards(4), rush: [inst("TST-UNIT-0", "u"), inst("SPEC-ET-M", "m")] }), "RM-009:op");
    expectChoiceFrom(s, "player1", "RM-009");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
  });

  it.fails("RM-009: 選んだユニットはラッシュエリアに残り、このカードがその下に重なる（捨札にならない）（出典: atwiki/page-830「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」）", () => {
    const s = packed();
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("rush");
    expect(stackedUnder(s, "player1", "TST-UNIT-0:u")).toEqual(["RM-009:op"]);
    expect(zoneOf(s, "player1", "RM-009:op")).toBeNull();
  });

  it.fails("RM-009: 重ねたユニットがストライクしてダメージを与えたとき、自軍捨札の S ユニットのカードから1枚選ぶ（M ユニット・オペレーションは選べない）（出典: atwiki/page-830「自軍捨札からSユニットのカードを1枚選び」）", () => {
    const s = struck();
    expect(damageOf(s, "player2")).toBe(1);
    expectChoiceFrom(s, "player1", "RM-009");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:ds"]);
  });

  it.fails("RM-009: 選んだカードは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-830「自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(struck(), "SPEC-ET-S:ds"));
    expect(zoneOf(s, "player1", "SPEC-ET-S:ds")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-ET-S:ds")?.commandHeld).toBe(true);
  });

  it.fails("RM-009: 自軍コマンドゾーンが5枚で置けなければ手札に加える（出典: atwiki/page-830「置けなければ手札に加える」）", () => {
    const s = resolveAll(pick(struck({ command: [...releasedCat("ET", 1), ...heldN(4, "TST-OP", "hc")] }), "SPEC-ET-S:ds"));
    expect(zoneOf(s, "player1", "SPEC-ET-S:ds")).toBe("hand");
  });

  it("RM-009: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-830「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = nextPhase(packed({}, { battle: [inst("TST-UNIT-7", "big")] }));
    s = enter(s, "TST-UNIT-0:u");
    s = resolveAll(attack(s, "TST-UNIT-0:u", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
    expect(zoneOf(s, "player1", "RM-009:op")).toBe("discard");
  });
});

// ===========================================================================
describe("RM-010 ソルインジケーター", () => {
  const TEXT = "自軍山札からビークルカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";
  const DECK = [inst("SPEC-VS", "vs"), inst("SPEC-VL", "vl"), inst("RM-020", "dol"), inst("SPEC-ET-S", "u"), ...deckCards(2)];
  const used = () => played(board({ hand: [inst("RM-010", "op")], command: releasedCat("ET", 1), power: powerCards(2), deck: DECK }), "RM-010:op");

  it("RM-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-881）", () => {
    expectCatalogText("RM-010", TEXT);
    expectOpStats("RM-010", { name: "ソルインジケーター", category: "ET", powerCost: 2 });
    expectRarityIn("RM-010", ["MR", "N"]);
  });

  it.fails("RM-010: 自軍山札のビークルカード（サイズ・カテゴリを問わない）から1枚選べる（任意）。ユニットカード（ビークルとして扱うことのある電子星獣ドルを含む）は選べない（出典: atwiki/page-881「自軍山札からビークルカードを1枚選び」・カード評価「サイズやカテゴリの指定も一切ない」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "RM-010");
    expect(choiceIds(s)).toEqual(["SPEC-VL:vl", "SPEC-VS:vs"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-010: 選んだカードは手札に加わる（出典: atwiki/page-881「手札に加えてもよい」）", () => {
    const s = resolveAll(pick(used(), "SPEC-VL:vl"));
    expect(zoneOf(s, "player1", "SPEC-VL:vl")).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(DECK.length - 1);
  });

  it.fails("RM-010: 加えなくてもよい（手札は増えない）（出典: atwiki/page-881「手札に加えてもよい」）", () => {
    const s = resolveAll(skip(used()));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(DECK.length);
  });
});

// ===========================================================================
describe("RM-011 ターボユニット-W", () => {
  const TEXT =
    "ナンバーに数字を持ち、ETを持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。このカードに重ねたユニットのナンバーの数字は1少なくなる。ただし、2より少なくならない。";

  const used = (rush: CardInstance[], extra: Partial<GameState["players"]["player1"]> = {}) =>
    played(board({ hand: [inst("RM-011", "op")], command: releasedCat("ET", 1), power: powerCards(4), rush, ...extra }, { battle: [inst("TST-UNIT-7", "big")] }), "RM-011:op");

  it("RM-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-882）", () => {
    expectCatalogText("RM-011", TEXT);
    expectOpStats("RM-011", { name: "ターボユニット-W", category: "ET", powerCost: 3 });
    expectRarityIn("RM-011", ["MR"]);
  });

  it.fails("RM-011: 選べるのはナンバーに数字を持つ、ET の自軍 S ユニットだけ（RC・ナンバーなし・WB・M ユニットは選べない）（出典: atwiki/page-882「ナンバーに数字を持ち、ETを持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = used([inst("SPEC-ET-CN3", "a"), inst("SPEC-ET-RC", "rc"), inst("SPEC-ET-S", "nn"), inst("SPEC-WB-CN3", "wb"), inst("SPEC-ET-CN3-M", "m")]);
    expectChoiceFrom(s, "player1", "RM-011");
    expect(choiceIds(s)).toEqual(["SPEC-ET-CN3:a"]);
  });

  it.fails("RM-011: 選んだユニットはラッシュエリアに残り、このカードがその下に重なる（出典: atwiki/page-882「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」）", () => {
    const s = resolveAll(used([inst("SPEC-ET-CN3", "a")]), ["SPEC-ET-CN3:a"]);
    expect(zoneOf(s, "player1", "SPEC-ET-CN3:a")).toBe("rush");
    expect(stackedUnder(s, "player1", "SPEC-ET-CN3:a")).toEqual(["RM-011:op"]);
  });

  it.fails("RM-011: 重ねたユニットのナンバーの数字は1少なくなる（ナンバー3のダイナブルーが2番目で NC【アタックボード】）（出典: atwiki/page-882「このカードに重ねたユニットのナンバーの数字は1少なくなる」）", () => {
    let s = resolveAll(used([inst("RS-192", "db"), ...fill(1)], { power: powerCards(4) }), ["RS-192:db"]);
    s = nextPhase(s);
    s = passEntry(enter(s, "TST-UNIT-0:f0"));
    s = enter(s, "RS-192:db");
    expect(ncFired(s, "player1", "RS-192:db", "RS-192")).toBe(true);
  });

  it("RM-011: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-882「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = nextPhase(resolveAll(used([inst("SPEC-ET-CN3", "a")]), ["SPEC-ET-CN3:a"]));
    s = enter(s, "SPEC-ET-CN3:a");
    s = resolveAll(attack(s, "SPEC-ET-CN3:a", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-ET-CN3:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RM-011:op")).toBe("discard");
  });
});

// ===========================================================================
describe("RM-012 JPカード", () => {
  const TEXT =
    "※常駐 自軍ラッシュフェイズごとに1度だけ、自分の手札からカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードの持つカテゴリごとに、次の効果を発動する⇒WBなら、敵軍バトルエリアからSユニットを1体選び撃破する。MAなら、敵軍ラッシュエリアのSユニットを2体まで選び、持ち主の手札に戻す。OTなら、敵軍ラッシュエリアのSユニットを1体選び、バトルエリアに出す。それ以外なら、自軍捨札からSユニットのカードを1枚選び、山札の上に戻す。";

  const HAND = [inst("TST-OP", "wb"), inst("TST-OP-MA", "ma"), inst("TST-OP-OT", "ot"), inst("TST-OP-ET", "et"), inst("TST-OP-WB-ET", "multi")];
  const ENEMY = { battle: [inst("SPEC-ET-S", "eb"), inst("SPEC-ET-M", "ebm")], rush: [inst("SPEC-ET-S", "er1"), inst("SPEC-ET-S", "er2"), inst("SPEC-ET-M", "erm")] };
  const jp = (p1: Partial<GameState["players"]["player1"]> = {}, phase: GameState["phase"] = "rush") =>
    st({ phase, player1: { operation: [residentOp("RM-012", "jp")], hand: HAND, discard: [inst("SPEC-ET-S", "ds"), inst("SPEC-ET-M", "dm")], deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...ENEMY } }, EXTRA);
  /** JPカードを起動して手札の id を捨札にする。 */
  const discardWith = (id: string) => pick(activateResident(jp(), "RM-012:jp"), id);

  it("RM-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-883）", () => {
    expectCatalogText("RM-012", TEXT);
    expectOpStats("RM-012", { name: "JPカード", category: "ET", powerCost: 4 });
    expectRarityIn("RM-012", ["MR", "N"]);
  });

  it.fails("RM-012: 自軍ラッシュフェイズに起動でき、手札のカードから1枚選んで捨札にできる（任意）（出典: atwiki/page-883「自軍ラッシュフェイズごとに1度だけ、自分の手札からカードを1枚選び捨札にしてもよい」）", () => {
    const s0 = jp();
    expect(canActivateResident(s0, "RM-012:jp")).toBe(true);
    const s = activateResident(s0, "RM-012:jp");
    expectChoiceFrom(s, "player1", "RM-012");
    expect(choiceIds(s)).toEqual(HAND.map((c) => c.instanceId).sort());
    expect(canSkip(s)).toBe(true);
  });

  it("RM-012: 自軍バトルフェイズには起動できない（出典: atwiki/page-883「自軍ラッシュフェイズごとに」）", () => {
    expect(canActivateResident(jp({}, "battle"), "RM-012:jp")).toBe(false);
  });

  it.fails("RM-012: 1度使ったら、そのラッシュフェイズにはもう起動できない（出典: atwiki/page-883「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = resolveAll(pick(discardWith("TST-OP-ET:et"), "SPEC-ET-S:ds"));
    expect(zoneOf(s, "player1", "TST-OP-ET:et")).toBe("discard");
    expect(canActivateResident(s, "RM-012:jp")).toBe(false);
  });

  it.fails("RM-012: WB なら、敵軍バトルエリアの S ユニットを1体選んで撃破する（出典: atwiki/page-883「WBなら、敵軍バトルエリアからSユニットを1体選び撃破する」）", () => {
    const s = discardWith("TST-OP:wb");
    expectChoiceFrom(s, "player1", "RM-012");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:eb"]);
    const done = resolveAll(pick(s, "SPEC-ET-S:eb"));
    expect(zoneOf(done, "player2", "SPEC-ET-S:eb")).toBe("discard");
  });

  it.fails("RM-012: MA なら、敵軍ラッシュエリアの S ユニットを2体まで選んで持ち主の手札に戻す（出典: atwiki/page-883「MAなら、敵軍ラッシュエリアのSユニットを2体まで選び、持ち主の手札に戻す」）", () => {
    let s = discardWith("TST-OP-MA:ma");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:er1", "SPEC-ET-S:er2"]);
    s = pick(pick(s, "SPEC-ET-S:er1"), "SPEC-ET-S:er2");
    if (s.pendingEffectChoice?.sourceCardId === "RM-012") s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-ET-S:er1")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-ET-S:er2")).toBe("hand");
  });

  it.fails("RM-012: OT なら、敵軍ラッシュエリアの S ユニットを1体選んでバトルエリアに出す（出典: atwiki/page-883「OTなら、敵軍ラッシュエリアのSユニットを1体選び、バトルエリアに出す」）", () => {
    const s = discardWith("TST-OP-OT:ot");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:er1", "SPEC-ET-S:er2"]);
    const done = resolveAll(pick(s, "SPEC-ET-S:er2"));
    expect(zoneOf(done, "player2", "SPEC-ET-S:er2")).toBe("battle");
  });

  it.fails("RM-012: それ以外（ET）なら、自軍捨札の S ユニットのカードを1枚選んで山札の上に戻す（出典: atwiki/page-883「それ以外なら、自軍捨札からSユニットのカードを1枚選び、山札の上に戻す」）", () => {
    const s = discardWith("TST-OP-ET:et");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:ds"]);
    const done = resolveAll(pick(s, "SPEC-ET-S:ds"));
    expect(done.players.player1.deck[0]?.instanceId).toBe("SPEC-ET-S:ds");
  });

  it.fails("RM-012: マルチカテゴリのカード（WB・ET）を捨てたら、両方の効果を発動する（出典: atwiki/page-883「捨札にしたカードの持つカテゴリごとに」・カード評価「両方の効果を発動出来る状況で一方の効果だけを使う事は出来ない」）", () => {
    const s = resolveAll(discardWith("TST-OP-WB-ET:multi"), ["SPEC-ET-S:eb", "SPEC-ET-S:ds"]);
    expect(zoneOf(s, "player2", "SPEC-ET-S:eb")).toBe("discard");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-ET-S:ds");
  });

  it.todo(
    "RM-012: マルチカテゴリのカードを捨てたとき、2つの効果を好きな順で発動できる（atwiki カード評価「両方のカテゴリの効果を好きな順で発動できる」）— コミュニティの記述だけ。エンジンは WB→MA→OT→それ以外 の順に自動で発動し、順番を選ばせない",
  );
});

// ===========================================================================
describe("RM-013 BS（ブルースワット）フォーメーション", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 特徴「ブルー」または「スワット」を持つ自軍ユニットは、次の能力を得る⇒スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない）";

  /** 敵軍（player2）のバトルフェイズで、player1 のバトルエリアが battle のとき、player2 の TST-UNIT-7 がアタックできる相手。 */
  const targets = (battle: CardInstance[], withResident = true) =>
    attackTargets(
      st({ activePlayer: "player2", player1: { battle, operation: withResident ? [residentOp("RM-013", "bs")] : [] }, player2: { battle: [inst("TST-UNIT-7", "atk")] } }, EXTRA),
      "TST-UNIT-7:atk",
      "player2",
    ).sort();

  it("RM-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-884）", () => {
    expectCatalogText("RM-013", TEXT);
    expectOpStats("RM-013", { name: "BSフォーメーション", category: "ET", powerCost: 3 });
    expectRarityIn("RM-013", ["MR"]);
  });

  it.fails("RM-013: 特徴「ブルー」を持つ自軍ユニットはスクラムを得る（CN4 のユニットが次に並んでいる間はアタックされない）（出典: atwiki/page-884・R-KW-SCRUM-01）", () => {
    expect(targets([inst("SPEC-BLUE3", "b"), inst("SPEC-CN4", "n")])).toEqual(["SPEC-CN4:n"]);
  });

  it.fails("RM-013: 特徴「スワット」を持つ自軍ユニットもスクラムを得る（出典: atwiki/page-884「特徴「ブルー」または「スワット」を持つ自軍ユニット」）", () => {
    expect(targets([inst("SPEC-SWAT3", "w"), inst("SPEC-CN4", "n")])).toEqual(["SPEC-CN4:n"]);
  });

  it("RM-013: 「ブルー」「スワット」を持たないユニット・常駐していないときはスクラムを得ない（アタックされる）（出典: atwiki/page-884）", () => {
    expect(targets([inst("SPEC-PLAIN3", "p"), inst("SPEC-CN4", "n")])).toContain("SPEC-PLAIN3:p");
    expect(targets([inst("SPEC-BLUE3", "b"), inst("SPEC-CN4", "n")], false)).toContain("SPEC-BLUE3:b");
  });

  it("RM-013: 敵軍の「ブルー」のユニットはスクラムを得ない（出典: atwiki/page-884「自軍ユニットは」）", () => {
    const s = st({ player1: { operation: [residentOp("RM-013", "bs")], battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst("SPEC-BLUE3", "b"), inst("SPEC-CN4", "n")] } }, EXTRA);
    expect(attackTargets(s, "TST-UNIT-7:atk")).toContain("SPEC-BLUE3:b");
  });
});

// ===========================================================================
describe("RM-014 ソニックフラップ", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 自分も相手も次の制限を受ける⇒自分自身の捨札にあるユニットカードと同じカード名のユニットカードを、コマンドをホールドしてラッシュするとき、コマンドを追加で2つホールドしなければ、そのユニットカードはラッシュできない。";

  /** player のラッシュフェイズ。player1 がソニックフラップを常駐させている。player の手札に SPEC-RUSHER、捨札に discard、リリース状態の WB コマンドが commands 枚。 */
  const rushTurn = (commands: number, discard: CardInstance[], player: "player1" | "player2" = "player1") => {
    const own = { hand: [inst("SPEC-RUSHER", "h")], discard, command: releasedCat("WB", commands, `${player}c`), deck: deckCards(5, `${player}d`) };
    return st(
      {
        phase: "rush",
        activePlayer: player,
        player1: { operation: [residentOp("RM-014", "sf")], ...(player === "player1" ? own : { deck: deckCards(5) }) },
        player2: player === "player2" ? own : { deck: deckCards(5, "e") },
      },
      EXTRA,
    );
  };
  const tryRush = (s: GameState, player: "player1" | "player2" = "player1") => {
    const r = rushFromHand(s, player, "SPEC-RUSHER:h");
    return r.ok ? r.state : s;
  };

  it("RM-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-875）", () => {
    expectCatalogText("RM-014", TEXT);
    expectOpStats("RM-014", { name: "ソニックフラップ", category: "WB", powerCost: 5 });
    expectRarityIn("RM-014", ["MR"]);
  });

  it.fails("RM-014: 自分の捨札に同じカード名のユニットカードがあると、コマンドを追加で2つ（計3つ）ホールドしなければラッシュできない（出典: atwiki/page-875「コマンドを追加で2つホールドしなければ、そのユニットカードはラッシュできない」）", () => {
    const s = tryRush(rushTurn(2, [inst("SPEC-RUSHER", "d")]));
    expect(zoneOf(s, "player1", "SPEC-RUSHER:h")).toBe("hand");
  });

  it.fails("RM-014: コマンドを3つホールドすればラッシュできる（出典: atwiki/page-875）", () => {
    const s = tryRush(rushTurn(3, [inst("SPEC-RUSHER", "d")]));
    expect(zoneOf(s, "player1", "SPEC-RUSHER:h")).toBe("rush");
    expect(heldCount(s)).toBe(3);
  });

  it("RM-014: 捨札に同じカード名のユニットカードがなければ、いつもどおりコマンド1つでラッシュできる（出典: atwiki/page-875「自分自身の捨札にあるユニットカードと同じカード名の」）", () => {
    const s = tryRush(rushTurn(1, [inst("SPEC-ET-S", "d")]));
    expect(zoneOf(s, "player1", "SPEC-RUSHER:h")).toBe("rush");
    expect(heldCount(s)).toBe(1);
  });

  it.fails("RM-014: 相手も制限を受ける（相手の捨札に同じカード名があれば、相手もコマンドを3つホールドしなければラッシュできない）（出典: atwiki/page-875「自分も相手も次の制限を受ける」）", () => {
    const blocked = tryRush(rushTurn(2, [inst("SPEC-RUSHER", "d")], "player2"), "player2");
    expect(zoneOf(blocked, "player2", "SPEC-RUSHER:h")).toBe("hand");
    const ok = tryRush(rushTurn(3, [inst("SPEC-RUSHER", "d")], "player2"), "player2");
    expect(zoneOf(ok, "player2", "SPEC-RUSHER:h")).toBe("rush");
    expect(heldCount(ok, "player2")).toBe(3);
  });

  it("RM-014: 相手の捨札にあるだけなら制限を受けない（自分自身の捨札だけを見る）（出典: atwiki/page-875「自分自身の捨札にある」）", () => {
    const s0 = rushTurn(1, []);
    const s1 = { ...s0, players: { ...s0.players, player2: { ...s0.players.player2, discard: [inst("SPEC-RUSHER", "ed")] } } };
    const s = tryRush(s1);
    expect(zoneOf(s, "player1", "SPEC-RUSHER:h")).toBe("rush");
  });

});
