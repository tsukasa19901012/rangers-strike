/**
 * カード別スペック: RK-274〜RK-280（ザ・マスクドライダーEXP vol.4 ビートチェイサー〜ダークレイダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ は rider_2.html の RK-160 Q3・Q4（RK-275・RK-276 との組み合わせ）だけ
 *     （「RK-274」〜「RK-280」とカード名で rider_1〜4・rider.html・card_*.html を検索）。atwiki に転載された公式 Q&A（RK-277 Q1・RK-280 Q1・Q2・
 *     RK-275 Q1・RK-276 Q1・page-1011 RK-247 Q1・page-1350 RK-250 Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: RK-277 Q1（RS-435 アレで必要パワー−4・追加条件も満たせる）は RS7-432-452.a の RS-435 で照合済みのため重ねない。
 * RK-275 Q1・RK-276 Q1（= grnrngr/faq-rider-2 RK-160 Q3・Q4）は RK8-148-168.b の it.todo だったものをここで照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  activateField,
  attackUntilRegister,
  bpOf,
  canActivateField,
  canConfirm,
  canEnter,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  deckCards,
  enemyBoard,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  featuresOf,
  held,
  inst,
  mount,
  nextPhase,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  rcRideOff,
  reanimateTests,
  registerOffered,
  releasedCat,
  releasedN,
  resolveAll,
  riding,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  untilChoiceFrom,
  withStacked,
  zoneIds,
  zoneOf,
  attackedInEnemyTurn,
  canStartRush,
  rushFromHand,
} from "./RK14-274-294.helpers";

const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const DA3 = sUnit("SPEC-DA3", { category: "DA", bp: 2000, powerCost: 3 });
const OPDA = { id: "SPEC-OPDA", name: "SPEC-OPDA", type: "operation", category: "DA", rarity: "N", expansion: "card-spec", powerCost: 1 } as unknown as CardDefinition;
const FEMALE = sUnit("SPEC-FEMALE", { category: "WB", bp: 1000, features: ["女"] });
const F0 = sUnit("SPEC-F0", { bp: 1000, features: [] });
const F1 = sUnit("SPEC-F1", { bp: 1000, features: ["男"] });
const F2 = sUnit("SPEC-F2", { bp: 1000, features: ["男", "怪人"] });
const F3 = sUnit("SPEC-F3", { bp: 1000, features: ["男", "怪人", "獣"] });
const FM1 = sUnit("SPEC-FM1", { bp: 1000, features: ["男"], size: "M" });
/** 特徴「アドベントカード」を持つオペレーション（必要パワー1〜3）。 */
const advent = (n: number) =>
  ({ id: `SPEC-ADV${n}`, name: `SPEC-ADV${n}`, type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: n, features: ["アドベントカード"] }) as unknown as CardDefinition;
const ADV1 = advent(1);
const ADV2 = advent(2);
const ADV3 = advent(3);
const NOADV3 = { id: "SPEC-NOADV3", name: "SPEC-NOADV3", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 3 } as unknown as CardDefinition;
const SURVIVE_RC = sUnit("SPEC-SURVIVE-RC", { category: "WB", bp: 1000, powerCost: 1, comboNumber: "RC", sp: undefined, features: ["仮面ライダー", "サバイブ"] });
const EXTRA = [PLAIN_VEHICLE, RCU, C1, C3, M2, DA3, OPDA, FEMALE, F0, F1, F2, F3, FM1, ADV1, ADV2, ADV3, NOADV3, SURVIVE_RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-274 ビートチェイサー", () => {
  const TEXT =
    "※これにライドしているユニットはBP+500される。 【ニューマシンの性能】 自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍山札の上から2枚を見て、そのカードを山札の上か下にそれぞれ好きな順で戻す。";

  it("RK-274: カタログ本文・スペックが出典と一致（出典: atwiki/page-1371）", () => {
    expectCatalogText("RK-274", TEXT);
    expectVehicleStats("RK-274", { name: "ビートチェイサー", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-274", ["N"]);
  });

  it("RK-274: ※ これにライドしているユニットは BP+500 される（出典: atwiki/page-1371「これにライドしているユニットはBP+500される」）", () => {
    const s = board({ battle: riding(inst("RK-274", "bc"), inst("SPEC-RCU", "r")) });
    expect(bpOf(s, "player1", "SPEC-RCU:r")).toBe(1500);
  });

  const chase = (deck = deckCards(5)) => mount(board({ rush: [inst("SPEC-RCU", "r"), inst("RK-274", "bc")], deck }), "SPEC-RCU:r", "RK-274:bc");
  const place = (s: GameState, id: string, where: "deck_top" | "deck_bottom") => pick(pick(s, id), where);

  it.fails("RK-274: 【ニューマシンの性能】自軍ターン中にライドされてバトルエリアに出たとき、発動するかを選べ（任意）、自軍山札の上から2枚を見る（出典: atwiki/page-1371「次の効果を発動できる⇒自軍山札の上から2枚を見て」）", () => {
    const s = chase();
    expectChoiceFrom(s, "player1", "RK-274");
    expect(choiceIds(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-274: 見た2枚は1枚ずつ山札の上か下を選んで戻せる（1枚は上、1枚は下でもよい）（出典: atwiki/page-1371「そのカードを山札の上か下にそれぞれ好きな順で戻す」・コメント欄「それぞれとあるので一枚ずつ決めることが可能」）", () => {
    let s = chase();
    s = place(s, "TST-OP:dk0", "deck_bottom");
    s = place(s, "TST-OP:dk1", "deck_top");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-274");
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3", "TST-OP:dk4", "TST-OP:dk0"]);
  });

  it.fails("RK-274: 2枚とも山札の上に好きな順で戻せる（後から戻したものが上）（出典: atwiki/page-1371「好きな順で戻す」）", () => {
    let s = chase();
    s = place(s, "TST-OP:dk0", "deck_top");
    s = place(s, "TST-OP:dk1", "deck_top");
    expect(zoneIds(s, "player1", "deck").slice(0, 2)).toEqual(["TST-OP:dk1", "TST-OP:dk0"]);
  });

  it.fails("RK-274: 発動しなければ山札はそのまま（出典: atwiki/page-1371「発動できる」）", () => {
    const s = skip(chase());
    expect(zoneIds(s, "player1", "deck")).toEqual(deckCards(5).map((c) => c.instanceId));
  });

  it.fails("RK-274: 自軍山札が1枚なら、その1枚だけを見る（出典: atwiki/page-1371・R-TGT-01（できる限り実行する））", () => {
    expect(choiceIds(chase(deckCards(1)))).toEqual(["TST-OP:dk0"]);
  });
});

// ===========================================================================
describe("RK-275 ゴ・ガドル・バ", () => {
  const TEXT =
    "【ザバギンバシグラ】自軍ターン中、これがバトルエリアに出たとき、敵軍パワーゾーンのダメージ以外のカードから、Sユニットのカードを1枚選び、敵軍ラッシュエリアに出してもよい。そうしたとき、相手は自分自身の山札の上から1枚ひいて、自分自身のパワーゾーンに置いてもよい。";

  it("RK-275: カタログ本文・スペックが出典と一致（出典: atwiki/page-1255）", () => {
    expectCatalogText("RK-275", TEXT);
    expectStats("RK-275", { name: "ゴ・ガドル・バ", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 5, features: ["グロンギ", "怪人", "男"] });
    expectRarityIn("RK-275", ["NR"]);
  });

  const enemyPower = [faceUp("SPEC-C3", "pu"), faceUp("SPEC-M2", "pm"), faceUp("TST-OP", "po"), faceDown("SPEC-C1", "pd")];
  const charisma = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ rush: [inst("RK-275", "gd")], ...p1 }, { power: enemyPower, damage: 1 }), "RK-275:gd");

  it.fails("RK-275: 【ザバギンバシグラ】自軍ターン中にバトルエリアに出たとき、敵軍パワーゾーンのダメージ以外（オモテ向き）の S ユニットのカードから1枚選べる（任意。M ユニット・オペレーション・ダメージは対象外）（出典: atwiki/page-1255）", () => {
    const s = charisma();
    expectChoiceFrom(s, "player1", "RK-275");
    expect(choiceIds(s)).toEqual(["SPEC-C3:pu"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-275: 選んだカードは敵軍ラッシュエリアに出て、相手は山札の上から1枚ひいて自分のパワーゾーンに置くかを選べる（相手の任意）（出典: atwiki/page-1255「敵軍ラッシュエリアに出してもよい。そうしたとき、相手は自分自身の山札の上から1枚ひいて、自分自身のパワーゾーンに置いてもよい」）", () => {
    const s = pick(charisma(), "SPEC-C3:pu");
    expect(zoneOf(s, "player2", "SPEC-C3:pu")).toBe("rush");
    expectChoiceFrom(s, "player2", "RK-275");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-275: 相手が置くことを選べば、相手の山札の上のカードが相手のパワーゾーンに置かれる（出典: atwiki/page-1255「自分自身のパワーゾーンに置いてもよい」）", () => {
    const s = settle(confirm(pick(charisma(), "SPEC-C3:pu")));
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("power");
    expect(cardIn(s, "player2", "TST-OP:e0")?.faceDown).not.toBe(true);
  });

  it.fails("RK-275: 相手が置かないことを選べば、相手の山札はそのまま（出典: atwiki/page-1255「置いてもよい」）", () => {
    const s = settle(skip(pick(charisma(), "SPEC-C3:pu")));
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("deck");
  });

  it.fails("RK-275: 出さなければ相手は何もしない（出典: atwiki/page-1255「そうしたとき」）", () => {
    const s = settle(skip(charisma()));
    expect(zoneOf(s, "player2", "SPEC-C3:pu")).toBe("power");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // grnrngr/faq-rider-2 RK-160 Q3「はい、できます。」・atwiki/page-1255 Q1「はい、できます。」
  it.fails("RK-275: 公式Q&A — 【ザバギンバシグラ】で敵軍ラッシュエリアに出た追加条件を持たない S ユニットに対して、自軍 RK-160 シザーズジャガー【ナノロボット散布実験】を発動できる（出典: grnrngr/faq-rider-2 RK-160 Q3・atwiki/page-1255 Q1）", () => {
    let s = pick(charisma({ rush: [inst("RK-275", "gd"), inst("RK-160", "sj")], hand: [inst("SPEC-DA3", "d3")], command: releasedCat("DA", 1) }), "SPEC-C3:pu");
    s = untilChoiceFrom(s, "RK-160");
    expectChoiceFrom(s, "player1", "RK-160");
    expect(choiceIds(s)).toEqual(["SPEC-DA3:d3"]);
    s = resolveAll(pick(s, "SPEC-DA3:d3"));
    expect(zoneOf(s, "player1", "SPEC-DA3:d3")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C3:pu")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-276 ズ・バヅー・バ", () => {
  const TEXT =
    "【キョクギンジャンママ】自軍ターン中、これがバトルエリアに出たとき、相手の手札を見ないで1枚選んでもよい。そうしたとき、選んだカードをお互いに見て、それがSユニットのカードだったなら、敵軍ラッシュエリアに出す。このとき、可能ならそのユニットをホールドする。その後、相手は1枚ドローする。";

  it("RK-276: カタログ本文・スペックが出典と一致（出典: atwiki/page-1391）", () => {
    expectCatalogText("RK-276", TEXT);
    expectStats("RK-276", { name: "ズ・バヅー・バ", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 0, features: ["グロンギ", "怪人", "男"] });
    expectRarityIn("RK-276", ["N"]);
  });

  const enemyHand = [inst("SPEC-C3", "hs"), inst("SPEC-M2", "hm"), inst("TST-OP", "ho")];
  const jumper = (p1: Partial<GameState["players"]["player1"]> = {}) => enter(board({ rush: [inst("RK-276", "bz")], ...p1 }, { hand: enemyHand }), "RK-276:bz");

  it.fails("RK-276: 【キョクギンジャンママ】自軍ターン中にバトルエリアに出たとき、相手の手札から1枚選ぶかを選べる（任意。手札のどのカードでも選べる）（出典: atwiki/page-1391「相手の手札を見ないで1枚選んでもよい」）", () => {
    const s = jumper();
    expectChoiceFrom(s, "player1", "RK-276");
    expect(choiceIds(s)).toEqual(["SPEC-C3:hs", "SPEC-M2:hm", "TST-OP:ho"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-276: 選んだカードが S ユニットのカードなら敵軍ラッシュエリアにホールド状態で出て、その後、相手は1枚ドローする（出典: atwiki/page-1391「Sユニットのカードだったなら、敵軍ラッシュエリアに出す。このとき、可能ならそのユニットをホールドする。その後、相手は1枚ドローする」）", () => {
    const s = settle(pick(jumper(), "SPEC-C3:hs"));
    expect(zoneOf(s, "player2", "SPEC-C3:hs")).toBe("rush");
    expect(cardIn(s, "player2", "SPEC-C3:hs")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
  });

  it.fails("RK-276: 選んだカードが S ユニットのカードでなければ（オペレーション）相手の手札に残り、その後、相手は1枚ドローする（出典: atwiki/page-1391「その後、相手は1枚ドローする」・コメント欄「ドローしないのは最初でカードを選ばなかった場合」）", () => {
    const s = settle(pick(jumper(), "TST-OP:ho"));
    expect(zoneOf(s, "player2", "TST-OP:ho")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
  });

  it.fails("RK-276: M ユニットのカードは敵軍ラッシュエリアに出ない（出典: atwiki/page-1391「それがSユニットのカードだったなら」）", () => {
    const s = settle(pick(jumper(), "SPEC-M2:hm"));
    expect(zoneOf(s, "player2", "SPEC-M2:hm")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
  });

  it.fails("RK-276: 選ばなければ相手はドローしない（出典: atwiki/page-1391「選んでもよい。そうしたとき」・コメント欄）", () => {
    const s = settle(skip(jumper()));
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("deck");
    expect(s.players.player2.hand).toHaveLength(3);
  });

  // grnrngr/faq-rider-2 RK-160 Q4「はい、可能です。」・atwiki/page-1391 Q1「はい、可能です。」
  it.fails("RK-276: 公式Q&A — 【キョクギンジャンママ】で敵軍ラッシュエリアに出た追加条件を持たない S ユニットに対して、自軍 RK-160 シザーズジャガー【ナノロボット散布実験】を発動できる（出典: grnrngr/faq-rider-2 RK-160 Q4・atwiki/page-1391 Q1）", () => {
    let s = pick(jumper({ rush: [inst("RK-276", "bz"), inst("RK-160", "sj")], hand: [inst("SPEC-DA3", "d3")], command: releasedCat("DA", 1) }), "SPEC-C3:hs");
    s = untilChoiceFrom(s, "RK-160");
    expectChoiceFrom(s, "player1", "RK-160");
    s = resolveAll(pick(s, "SPEC-DA3:d3"));
    expect(zoneOf(s, "player1", "SPEC-DA3:d3")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C3:hs")).toBe("discard");
  });

  it.todo(
    "RK-276: 「相手の手札を見ないで」選ぶ（選ぶ側に相手の手札の中身を見せない）（出典: atwiki/page-1391）— 対戦画面の情報公開の問題で、エンジンの選択の候補は相手の手札のカードそのもの（中身を隠す仕組みは UI 側）",
  );
});

// ===========================================================================
describe("RK-277 ン・ダグバ・ゼバ", () => {
  const TEXT =
    "【究極の闇をもたらす者】これをラッシュしたとき、この追加条件で捨札にしたカードを見て、DAを持つカードをすべてこれの下に好きな順でウラ向きに重ねる。このとき、ウラ向きに4枚重ねなかったなら、「ン・ダグバ・ゼバ」以外の自軍ユニットをすべて捨札にする。また、これがユニットでなくなるとき、これにウラ向きで重ねたカードをウラ向きのまま1枚選び捨札にして、これをその場に留める。";

  it("RK-277: カタログ本文・スペックが出典と一致（出典: atwiki/page-1254）", () => {
    expectCatalogText("RK-277", TEXT);
    expectStats("RK-277", {
      name: "ン・ダグバ・ゼバ",
      category: "DA",
      size: "S",
      bp: 5000,
      sp: 1,
      powerCost: "9+",
      features: ["グロンギ", "怪人", "男"],
      rushCondition: "discard_operation_cards",
    });
    expectRarityIn("RK-277", ["SR"]);
  });

  /** 常駐置き場の ops（4枚）を追加条件で捨札にして、ン・ダグバ・ゼバをラッシュする（自軍ラッシュエリア・バトルエリアには others）。 */
  const darkness = (ops: ReturnType<typeof inst>[], others: Partial<GameState["players"]["player1"]> = {}) => {
    const s = rushPhase({ operation: ops, hand: [inst("RK-277", "dg")], command: releasedCat("DA", 1), power: powerCards(9), ...others });
    const r = rushVia(s, "player1", "RK-277:dg");
    expect(r.ok, r.error).toBe(true);
    return resolveAll(r.state);
  };
  const daOps = (n: number) => Array.from({ length: n }, (_, i) => inst("SPEC-OPDA", `o${i}`));

  it.fails("RK-277: 【究極の闇をもたらす者】ラッシュしたとき、追加条件で捨札にした DA のカードをすべて、これの下にウラ向きで重ねる（4枚なら他の自軍ユニットは残る）（出典: atwiki/page-1254）", () => {
    const s = darkness(daOps(4), { battle: [inst("SPEC-C1", "b")] });
    const dg = cardIn(s, "player1", "RK-277:dg");
    expect(zoneOf(s, "player1", "RK-277:dg")).toBe("rush");
    expect((dg?.stackedCards ?? []).map((c) => c.instanceId).sort()).toEqual(daOps(4).map((c) => c.instanceId).sort());
    expect((dg?.stackedCards ?? []).every((c) => c.faceDown)).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-C1:b")).toBe("battle");
  });

  it.fails("RK-277: 捨札にしたカードのうち DA を持たないカードは重ねず、ウラ向きに4枚重ねなかったなら「ン・ダグバ・ゼバ」以外の自軍ユニットをすべて捨札にする（出典: atwiki/page-1254「ウラ向きに4枚重ねなかったなら、「ン・ダグバ・ゼバ」以外の自軍ユニットをすべて捨札にする」）", () => {
    const s = darkness([...daOps(3), inst("TST-OP", "w")], { battle: [inst("SPEC-C1", "b")], rush: [inst("SPEC-C3", "r")] });
    expect((cardIn(s, "player1", "RK-277:dg")?.stackedCards ?? []).map((c) => c.instanceId).sort()).toEqual(daOps(3).map((c) => c.instanceId).sort());
    expect(zoneOf(s, "player1", "TST-OP:w")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C1:b")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C3:r")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-277:dg")).toBe("rush");
  });

  const stackedDagba = () => withStacked(inst("RK-277", "dg"), daOps(3).map((c) => ({ ...c, faceDown: true })));

  it.fails("RK-277: これがユニットでなくなるとき（バトルで撃破される）、ウラ向きで重ねたカードを1枚選んで捨札にし、これはその場に留まる（見送れない）（出典: atwiki/page-1254「これにウラ向きで重ねたカードをウラ向きのまま1枚選び捨札にして、これをその場に留める」）", () => {
    let s = attackedInEnemyTurn({ battle: [stackedDagba()] }, "RK-277:dg");
    expectChoiceFrom(s, "player1", "RK-277");
    expect(choiceIds(s)).toEqual(["SPEC-OPDA:o0", "SPEC-OPDA:o1", "SPEC-OPDA:o2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-OPDA:o1"));
    expect(zoneOf(s, "player1", "RK-277:dg")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-OPDA:o1")).toBe("discard");
    expect((cardIn(s, "player1", "RK-277:dg")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["SPEC-OPDA:o0", "SPEC-OPDA:o2"]);
  });

  it("RK-277: ウラ向きで重ねたカードがなければ、撃破されて捨札になる（出典: atwiki/page-1254「これにウラ向きで重ねたカードを…1枚選び」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RK-277", "dg")] }, "RK-277:dg"));
    expect(zoneOf(s, "player1", "RK-277:dg")).toBe("discard");
  });

  it.todo(
    "RK-277: 重ねる順番（「好きな順で」）を選ぶ（出典: atwiki/page-1254「DAを持つカードをすべてこれの下に好きな順でウラ向きに重ねる」）— ウラ向きのカードの並びを参照するカードが本範囲になく、エンジンは捨札にした順に重ねる",
  );
  it.todo(
    "RK-277: 手札・山札に戻るときも「ユニットでなくなるとき」としてその場に留まるか（出典: atwiki/page-1254）— エンジンの手札・山札に戻す処理が「ユニットでなくなるとき」の置換を通らない（RK12 RK-250 の it.todo と同じ）",
  );
});

// ===========================================================================
describe("RK-278 仮面ライダーナイト（2nd）", () => {
  const TEXT =
    "※これは自軍捨札に特徴「女」を持つユニットカードがあれば次の能力を得る⇒レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【飛翔斬】「ダークウイング」からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、特徴の数が1番少ないSユニットを1体選び撃破する。";

  it("RK-278: カタログ本文・スペックが出典と一致（出典: atwiki/page-1382）", () => {
    expectCatalogText("RK-278", TEXT);
    expectStats("RK-278", { name: "仮面ライダーナイト（2nd）", category: "WB", size: "S", bp: 4000, sp: "1/2", powerCost: 6, features: ["仮面ライダー", "男", "ミラーライダー", "2nd"] });
    expectRarityIn("RK-278", ["R"]);
  });

  it.fails("RK-278: ※ 自軍捨札に「女」を持つユニットカードがあれば、レジスト（バトルで撃破されたときホールドして留まる）を得る（出典: atwiki/page-1382・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-278", "kn")], discard: [inst("SPEC-FEMALE", "f")] }, "RK-278:kn", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
  });

  it("RK-278: ※ 自軍捨札に「女」を持つユニットカードがなければ（敵軍の捨札にあるだけでも）レジストを得ない（出典: atwiki/page-1382「自軍捨札に」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-278", "kn")] }, "RK-278:kn", { discard: [inst("SPEC-FEMALE", "f")] }, "TST-UNIT-7:atk", EXTRA))).toBe(false);
  });

  /** ダークウイング（RK-035）の次にナイト（2nd）を出す。 */
  const slash = (prev = [inst("RK-035", "dw")]) =>
    enter(
      board({ battle: prev, rush: [inst("RK-278", "kn")] }, { battle: [inst("SPEC-F1", "a"), inst("SPEC-F3", "c"), inst("SPEC-FM1", "m")], rush: [inst("SPEC-F0", "r")] }),
      "RK-278:kn",
    );

  it.fails("RK-278: 【飛翔斬】「ダークウイング」からコンビネーションしたとき発動でき、敵軍バトルエリアの特徴の数が1番少ない S ユニットから選ぶ — ダークウイング【ソニックブレイカー】で敵軍ユニットはすべて特徴を持たないので、敵軍バトルエリアの S ユニットすべてから選べる（M・ラッシュエリアは対象外）（出典: atwiki/page-1382・カード評価「ダークウイングの効果が発動すれば完全に無視できる」・atwiki/page-180（RK-035）「すべての敵軍ユニットは特徴を持たないユニットとして扱い」）", () => {
    const s = slash();
    expectChoiceFrom(s, "player1", "RK-278");
    expect(choiceIds(s)).toEqual(["SPEC-F1:a", "SPEC-F3:c"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-278: 【飛翔斬】選んだユニットを撃破する（出典: atwiki/page-1382「1体選び撃破する」）", () => {
    const s = resolveAll(pick(slash(), "SPEC-F3:c"));
    expect(zoneOf(s, "player2", "SPEC-F3:c")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-F1:a")).toBe("battle");
  });

  it.fails("RK-278: 【飛翔斬】発動しなければ何も撃破しない（出典: atwiki/page-1382「発動できる」）", () => {
    const s = resolveAll(skip(slash()));
    expect(zoneOf(s, "player2", "SPEC-F1:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-F3:c")).toBe("battle");
  });

  it("RK-278: 【飛翔斬】ダークウイング以外のユニットの次に出たときは発動しない（出典: atwiki/page-1382「「ダークウイング」からコンビネーションしたとき」・R-CN-05）", () => {
    const s = slash([inst("SPEC-C1", "x")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-278");
  });

  it.todo(
    "RK-278: 【飛翔斬】敵軍ユニットに特徴が残っているとき（ダークウイングの【ソニックブレイカー】が無効のとき）は、特徴の数が1番少ない S ユニットだけを選べる（出典: atwiki/page-1382「特徴の数が1番少ないSユニット」）— ダークウイングの効果を無効にした状態でコンビネーションさせる手段が本範囲になく、状況を組めない（エンジンは特徴の数が最少の S ユニットに絞る）",
  );
});

// ===========================================================================
describe("RK-279 仮面ライダーナイトサバイブ", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーナイト」を1体選び、自軍ラッシュエリアに出す。 【ダークバイザーツバイ】 自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい。そうしたとき、敵軍バトルエリアからSユニットを好きな数選び撃破してもよい。ただし、選んだユニットの特徴の数の合計が、捨札から選んだカードの必要パワーの数字の合計以下になるように選ぶこと。";

  it("RK-279: カタログ本文・スペックが出典と一致（出典: atwiki/page-1284）", () => {
    expectCatalogText("RK-279", TEXT);
    expectStats("RK-279", {
      name: "仮面ライダーナイトサバイブ",
      category: "WB",
      size: "S",
      bp: 5500,
      sp: "1/2",
      powerCost: "10-",
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"],
      rushCondition: "zord_down_discard_named",
    });
    expectRarityIn("RK-279", ["SR"]);
  });

  it("RK-279: 追加条件 — 自軍「仮面ライダーナイト」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1284「自軍「仮面ライダーナイト」を1体捨札にすれば必要パワー0になる」）", () => {
    const s = rushPhase({ hand: [inst("RK-279", "am")], rush: [inst("RK-067", "p")], command: releasedCat("WB", 1), power: [], deck: deckCards(3) });
    const r = rushVia(s, "player1", "RK-279:am", (a) => a.zordMaterialInstanceId === "RK-067:p");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RK-279:am")).toBe("rush");
    expect(zoneOf(t, "player1", "RK-067:p")).toBe("discard");
  });

  it("RK-279: 必要パワー10- — 「仮面ライダーナイト」がいなければパワー10でラッシュでき、9ではラッシュできない（出典: atwiki/page-1284「必要パワー：10-」・R-ADD-02）", () => {
    const mk = (n: number) => rushPhase({ hand: [inst("RK-279", "am")], command: releasedCat("WB", 1), power: powerCards(n), deck: deckCards(3) });
    expect(canStartRush(mk(9), "player1", "RK-279:am")).toBe(false);
    const r = rushFromHand(mk(10), "player1", "RK-279:am");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-279:am")).toBe("rush");
  });
  reanimateTests("RK-279", "RK-067", "仮面ライダーナイト", "atwiki/page-1284");

  it("RK-279: ※ 「仮面ライダーナイト（2nd）」も同名の「仮面ライダーナイト」として選べる（出典: atwiki/page-1284 関連カード「仮面ライダーナイト（2nd）」・core/cardNames.ts（2nd は同名カード））", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-279", "am")], discard: [inst("RK-278", "k2")] }, "RK-279:am");
    expectChoiceFrom(s, "player1", "RK-279");
    expect(choiceIds(s)).toEqual(["RK-278:k2"]);
  });

  const visorDiscard = [inst("SPEC-ADV1", "a1"), inst("SPEC-ADV2", "a2"), inst("SPEC-ADV3", "a3"), inst("SPEC-NOADV3", "n3")];
  const visorEnemy = { battle: [inst("SPEC-F1", "f1"), inst("SPEC-F2", "f2"), inst("SPEC-F3", "f3"), inst("SPEC-FM1", "m")], rush: [inst("SPEC-F1", "r")] };
  const visor = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-279", "ks"), inst("SPEC-VEHICLE", "v")], discard: visorDiscard, ...p1 }, visorEnemy), "RK-279:ks", "SPEC-VEHICLE:v");

  it.fails("RK-279: 【ダークバイザーツバイ】RC — 自軍捨札の特徴「アドベントカード」を持つカードから2枚まで選べる（任意）（出典: atwiki/page-1284「自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい」）", () => {
    const s = visor();
    expectChoiceFrom(s, "player1", "RK-279");
    expect(choiceIds(s)).toEqual(["SPEC-ADV1:a1", "SPEC-ADV2:a2", "SPEC-ADV3:a3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-279: 0枚では確定できない（1枚以上選ぶ）（出典: atwiki/page-1284 コメント欄「公式Q&Aのボウケンブルーの項を参照すると、0枚選ぶことはできない」）", () => {
    expect(canConfirm(visor())).toBe(false);
  });

  it.fails("RK-279: 選んだカードの必要パワーの数字の合計（2+3=5）まで、敵軍バトルエリアの S ユニットを特徴の数の合計で選んで撃破できる（特徴2つと3つ）（出典: atwiki/page-1284「選んだユニットの特徴の数の合計が、捨札から選んだカードの必要パワーの数字の合計以下になるように選ぶこと」）", () => {
    let s = visor();
    s = confirm(pick(pick(s, "SPEC-ADV2:a2"), "SPEC-ADV3:a3"));
    expectChoiceFrom(s, "player1", "RK-279");
    expect(choiceIds(s)).toEqual(["SPEC-F1:f1", "SPEC-F2:f2", "SPEC-F3:f3"]);
    expect(canSkip(s)).toBe(true);
    s = pick(pick(s, "SPEC-F2:f2"), "SPEC-F3:f3");
    // 特徴の数の合計が 5 に達したので、残りの f1（特徴1つ）は選べない。
    expect(choiceIds(s)).not.toContain("SPEC-F1:f1");
    s = resolveAll(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-F2:f2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-F3:f3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-F1:f1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-FM1:m")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-F1:r")).toBe("rush");
  });

  it.fails("RK-279: 選んだカードの合計が 1 なら、特徴の数が 1 以下の S ユニットだけを選べる（選んだ捨札のカードは捨札に残る）（出典: atwiki/page-1284）", () => {
    let s = confirm(pick(visor(), "SPEC-ADV1:a1"));
    expect(choiceIds(s)).toEqual(["SPEC-F1:f1"]);
    s = resolveAll(confirm(pick(s, "SPEC-F1:f1")));
    expect(zoneOf(s, "player2", "SPEC-F1:f1")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-ADV1:a1")).toBe("discard");
  });

  it.fails("RK-279: 撃破しないことも選べる（出典: atwiki/page-1284「撃破してもよい」）", () => {
    const s = resolveAll(skip(confirm(pick(visor(), "SPEC-ADV3:a3"))));
    expect(zoneOf(s, "player2", "SPEC-F3:f3")).toBe("battle");
  });

  it.fails("RK-279: 自軍バトルエリアのダークレイダー（RK-280）【疾風断】で敵軍バトルエリアの S ユニットが特徴を持たなければ、合計 1 でもすべて選べる（出典: atwiki/page-1284 カード評価「ダークレイダーを使えば問題ない」・コメント欄・atwiki/page-1375（RK-280）【疾風断】）", () => {
    const s = confirm(pick(visor({ battle: [inst("RK-280", "dr")] }), "SPEC-ADV1:a1"));
    expect(choiceIds(s)).toEqual(["SPEC-F1:f1", "SPEC-F2:f2", "SPEC-F3:f3"]);
  });
});

// ===========================================================================
describe("RK-280 ダークレイダー", () => {
  const TEXT =
    "※これは、自軍エリアでホールド状態かライドされている間、Sビークルとして扱う。 ※これはユニットの間、次のテキストを得る⇒これは自軍コマンドを1つホールドしなければバトルエリアに出られない。また、自軍ラッシュフェイズ中、これをホールドしてもよい。 【疾風断】これがライドされているか、これが自軍バトルエリアにある間、敵軍バトルエリアのSユニットは特徴を持たないユニットとして扱い、特徴を追加されない。";

  it("RK-280: カタログ本文・スペックが出典と一致（出典: atwiki/page-1375）", () => {
    expectCatalogText("RK-280", TEXT);
    expectStats("RK-280", { name: "ダークレイダー", category: "WB", size: "S", bp: 4000, sp: undefined, powerCost: 3, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-280", ["NR"]);
  });

  it.fails("RK-280: ※ ユニットの間は、自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1375「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-280", "dr")], command: [held("TST-OP", "h")] }), "RK-280:dr")).toBe(false);
    const s = settle(enterHold(board({ rush: [inst("RK-280", "dr")], command: releasedCat("WB", 1) }), "RK-280:dr"));
    expect(zoneOf(s, "player1", "RK-280:dr")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it.fails("RK-280: ※ 自軍ラッシュフェイズ中、自軍ラッシュエリアのこれをホールドできる（出典: atwiki/page-1375「また、自軍ラッシュフェイズ中、これをホールドしてもよい」・コメント欄「自軍ラッシュフェイズなら任意にホールドしてもいい」）", () => {
    const s0 = rushPhase({ rush: [inst("RK-280", "dr")] });
    expect(canActivateField(s0, "RK-280:dr")).toBe(true);
    const s = activateField(s0, "RK-280:dr");
    expect(cardIn(s, "player1", "RK-280:dr")?.commandHeld).toBe(true);
  });

  it("RK-280: ※ 自軍バトルフェイズ中はホールドできない（出典: atwiki/page-1375「自軍ラッシュフェイズ中」）", () => {
    expect(canActivateField(board({ rush: [inst("RK-280", "dr")] }), "RK-280:dr")).toBe(false);
  });

  it.fails("RK-280: ※ ホールド状態のこれは S ビークルとして扱い、RC を持つユニットがライドできる（出典: atwiki/page-1375「自軍エリアでホールド状態かライドされている間、Sビークルとして扱う」・カード評価「スクーパーのようにビークルになれるユニット」）", () => {
    const s = nextPhase(activateField(rushPhase({ rush: [inst("RK-280", "dr"), inst("SPEC-RCU", "r")] }), "RK-280:dr"));
    expect(s.phase).toBe("battle");
    expect(canMount(s, "SPEC-RCU:r", "RK-280:dr")).toBe(true);
    const t = settle(mount(s, "SPEC-RCU:r", "RK-280:dr"));
    expect(zoneOf(t, "player1", "RK-280:dr")).toBe("battle");
    expect(cardIn(t, "player1", "SPEC-RCU:r")?.mountedOnInstanceId).toBe("RK-280:dr");
  });

  it("RK-280: ※ リリース状態のこれ（ユニット）には、ライドできない（出典: atwiki/page-1011 Q1「リリース状態ならユニット、ホールド状態ならビークルとして扱われ」）", () => {
    expect(canMount(board({ rush: [inst("RK-280", "dr"), inst("SPEC-RCU", "r")] }), "SPEC-RCU:r", "RK-280:dr")).toBe(false);
  });

  const enemyUnits = { battle: [inst("SPEC-F2", "s"), inst("SPEC-FM1", "m")], rush: [inst("SPEC-F2", "r")] };

  it.fails("RK-280: 【疾風断】ユニットとして自軍バトルエリアにある間、敵軍バトルエリアの S ユニットは特徴を持たない（M・ラッシュエリアのユニットは特徴を持つ）（出典: atwiki/page-1375・Q1「ユニットである間、バトルエリアにある」）", () => {
    const s = board({ battle: [inst("RK-280", "dr")] }, enemyUnits);
    expect(featuresOf(s, "player2", "SPEC-F2:s")).toEqual([]);
    expect(featuresOf(s, "player2", "SPEC-FM1:m")).toEqual(["男"]);
    expect(featuresOf(s, "player2", "SPEC-F2:r")).toEqual(["男", "怪人"]);
  });

  // atwiki/page-1375 Q1「ビークル・ユニットの状態を問わず、【疾風断】のテキストは有効です。具体的には「ビークルである間、ライドされている状態で自軍エリアにある」「ビークルである間、ライドされていない状態で自軍バトルエリアにある」「ユニットである間、バトルエリアにある」の3つの状況において、【疾風断】の効果を発揮します。」
  it.fails("RK-280: 公式Q&A — ビークル（ホールド状態）でライドされずに自軍バトルエリアにある間も【疾風断】は有効（出典: atwiki/page-1375 Q1）", () => {
    const s = board({ battle: [{ ...inst("RK-280", "dr"), commandHeld: true }] }, enemyUnits);
    expect(featuresOf(s, "player2", "SPEC-F2:s")).toEqual([]);
  });

  it.fails("RK-280: 公式Q&A — ビークルでライドされている間は、自軍ラッシュエリアにあっても【疾風断】は有効（出典: atwiki/page-1375 Q1「ライドされている状態で自軍エリアにある」）", () => {
    const s = board({ rush: riding({ ...inst("RK-280", "dr"), commandHeld: true }, inst("SPEC-RCU", "r")) }, enemyUnits);
    expect(featuresOf(s, "player2", "SPEC-F2:s")).toEqual([]);
  });

  it.fails("RK-280: ユニット（リリース状態）として自軍ラッシュエリアにあるだけなら【疾風断】は働かない（出典: atwiki/page-1375 Q1（3つの状況に当たらない））", () => {
    const s = board({ rush: [inst("RK-280", "dr")] }, enemyUnits);
    expect(featuresOf(s, "player2", "SPEC-F2:s")).toEqual(["男", "怪人"]);
  });

  // atwiki/page-1375 Q2「ユニットでなくなるので「RK-250 サバイブ」は捨札になります。」（= atwiki/page-1350 RK-250 Q2）
  it.fails("RK-280: 公式Q&A — RK-250 サバイブを重ねたこれをホールドしてビークルにすると、ユニットでなくなるのでサバイブは捨札になる（出典: atwiki/page-1375 Q2・atwiki/page-1350 Q2）", () => {
    const s = settle(activateField(rushPhase({ rush: [withStacked(inst("RK-280", "dr"), [inst("RK-250", "sv")])] }), "RK-280:dr"));
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-280:dr")).toBe("rush");
    expect(cardIn(s, "player1", "RK-280:dr")?.stackedCards ?? []).toEqual([]);
  });

  it.todo(
    "RK-280: 【疾風断】の「特徴を追加されない」— 敵軍バトルエリアの S ユニットに効果で特徴を追加できない（出典: atwiki/page-1375）— 敵軍が自分のユニットに特徴を追加する効果を自軍ターンに使う状況を本範囲のカードで組めない（エンジンは特徴の判定で、追加分も含めて特徴を持たないものとして扱う）",
  );
  it.todo(
    "RK-280: ビークルになった後、リリース状態に戻ったらユニットに戻るか（出典: atwiki/page-1011 Q1「リリース状態ならユニット」・コメント欄「ビークルからユニットに戻る事ができない」）— 公式回答とコメント欄の記述が食い違い、ユニットのホールドを解除する手段も本範囲にない（エンジンはホールド状態の間だけビークルとして扱う）",
  );
});
