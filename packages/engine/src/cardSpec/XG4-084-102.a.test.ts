/**
 * cardSpec XG4-084〜XG4-090（仮面ライダー幽汽HF〜GGスレイヤー）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  activate,
  attack,
  attackTargets,
  bpsOf,
  callTests,
  canActivate,
  canEnter,
  canSkip,
  canStrike,
  canWing,
  cardIn,
  choiceIds,
  deckCards,
  destroyedInEnemyBattle,
  enter,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  lastBattleBps,
  nextPhase,
  p1Battle,
  pick,
  pickThrough,
  rcRideOff,
  resolveAll,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  spOf,
  st,
  sUnit,
  vehicleCard,
  zoneOf,
} from "./XG4-084-102.helpers";

const MAN = sUnit("SPEC-MAN", { category: "DA", bp: 1000, sp: undefined, features: ["男"] });
const WOMAN = sUnit("SPEC-WOMAN", { category: "DA", bp: 1000, sp: undefined, features: ["女"] });
const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { bp: 1000, size: "M", sp: undefined });
const E_500 = sUnit("SPEC-E-500", { bp: 500, sp: undefined });
const E_5000 = sUnit("SPEC-E-5000", { bp: 5000, sp: undefined });
const DA0 = sUnit("SPEC-DA0", { category: "DA", bp: 1000, powerCost: 0 });
const OWN_S3000 = sUnit("SPEC-S3000", { category: "DA", bp: 3000, sp: undefined });
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 2000, sp: undefined, comboNumber: "RC" });
const BIKE = vehicleCard("SPEC-BIKE", { category: "ET" });
const E_2000 = sUnit("SPEC-E-2000", { bp: 2000, sp: undefined });
const E_3000 = sUnit("SPEC-E-3000", { bp: 3000, sp: undefined });
const EXTRA = [MAN, WOMAN, E_S, E_M, E_500, E_5000, DA0, OWN_S3000, RIDER, BIKE, E_2000, E_3000];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-084 仮面ライダー幽汽HF", () => {
  const TEXT =
    "※コールDA ※これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない。 【乱れ独楽】これが自軍ラッシュエリアにある間、自軍エンドフェイズ中、次の効果を好きなだけ発動できる⇒自分の手札を1枚選び捨札にする。そうしたとき、敵軍バトルエリアからSユニットを1体選び撃破する。";

  it("XG4-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-2150）", () => {
    expectCatalogText("XG4-084", TEXT);
    expectUnit("XG4-084", { name: "仮面ライダー幽汽HF", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG4-084", ["SR"]);
  });

  callTests("XG4-084", "DA", "atwiki/page-2150");

  it("XG4-084: ※ — 自軍ユニットがホールドされていないターンはバトルエリアに出られない（出典: atwiki/page-2150「これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG4-084", "hf")] }), "XG4-084:hf")).toBe(false);
  });

  it("XG4-084: ※ — そのターンに自軍ユニット（コールでホールドしたこれ自身）がホールドされていれば、バトルエリアに出られる（出典: atwiki/page-2150・カード評価「自身がコールDAを持つため手札にDAのユニットさえあれば」）", () => {
    const r = rushFromHand(board({ hand: [inst("SPEC-DA0", "h")], rush: [inst("XG4-084", "hf")], command: [], power: [] }), "player1", "SPEC-DA0:h");
    expect(r.ok, r.error).toBe(true);
    const s = nextPhase(resolveAll(r.state));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "XG4-084:hf")).toBe(true);
  });

  const endPhase = (hand: ReturnType<typeof inst>[]) =>
    settle(nextPhase(battle({ rush: [inst("XG4-084", "hf")], hand }, { battle: [inst("SPEC-E-S", "a"), inst("SPEC-E-M", "m")], rush: [inst("SPEC-E-S", "r")], deck: deckCards(3, "e") })));

  it("XG4-084:【乱れ独楽】— 自軍エンドフェイズ中、ラッシュエリアにあれば、手札を1枚捨札にして敵軍バトルエリアの S ユニットを1体撃破できる（出典: atwiki/page-2150「自分の手札を1枚選び捨札にする。そうしたとき、敵軍バトルエリアからSユニットを1体選び撃破する」）", () => {
    let s = endPhase([inst("TST-UNIT-0", "h1")]);
    expect(s.phase).toBe("end");
    if (s.pendingEffectChoice?.sourceCardId !== "XG4-084") {
      expect(canActivate(s, "XG4-084:hf")).toBe(true);
      s = activate(s, "XG4-084:hf");
    }
    s = resolveAll(pickThrough(s, "XG4-084", ["TST-UNIT-0:h1", "SPEC-E-S:a"]));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-S:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-S:r")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-085 仮面ライダー幽汽SF", () => {
  const TEXT =
    "※これが撃破されて捨札になるとき、かわりに特徴「男」を持つ自軍ユニット1体を捨札にすれば、これはその場にとどまる。 【ターミネイトフラッシュ】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからホールド状態の敵軍Sユニットを自軍ダメージの数まで選び、撃破する。";

  it("XG4-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-2151）", () => {
    expectCatalogText("XG4-085", TEXT);
    expectUnit("XG4-085", { name: "仮面ライダー幽汽SF", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG4-085", ["R"]);
  });

  const destroyed = (others: ReturnType<typeof inst>[]) => settle(destroyedInEnemyBattle(inst("XG4-085", "sf"), { rush: others }, {}, EXTRA));

  it("XG4-085: ※ — 撃破されて捨札になるとき、特徴「男」を持つ自軍ユニットを1体捨札にするかを選べる（「男」でないユニットは選べない。任意）（出典: atwiki/page-2151「かわりに特徴「男」を持つ自軍ユニット1体を捨札にすれば」）", () => {
    const s = destroyed([inst("SPEC-MAN", "m"), inst("SPEC-WOMAN", "w")]);
    expectChoiceFrom(s, "player1", "XG4-085");
    expect(choiceIds(s)).toEqual(["SPEC-MAN:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-085: ※ — 捨札にすれば、これはその場にとどまる（出典: atwiki/page-2151「これはその場にとどまる」）", () => {
    let s = destroyed([inst("SPEC-MAN", "m")]);
    expectChoiceFrom(s, "player1", "XG4-085");
    s = resolveAll(pick(s, "SPEC-MAN:m"));
    expect(zoneOf(s, "player1", "XG4-085:sf")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-MAN:m")).toBe("discard");
  });

  const entered = (damage: number) =>
    settle(
      enterNow(
        battle({ rush: [inst("XG4-085", "sf")], damage }, { battle: [{ ...inst("SPEC-E-S", "h1"), commandHeld: true }, { ...inst("SPEC-E-S", "h2"), commandHeld: true }, inst("SPEC-E-S", "r1")], rush: [{ ...inst("SPEC-E-S", "hr"), commandHeld: true }], deck: deckCards(3, "e") }),
        "XG4-085:sf",
      ),
    );

  it("XG4-085:【ターミネイトフラッシュ】— 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアのホールド状態の S ユニットから選ぶ（リリース状態・ラッシュエリアのユニットは選べない）（出典: atwiki/page-2151「敵軍バトルエリアからホールド状態の敵軍Sユニットを自軍ダメージの数まで選び、撃破する」）", () => {
    const s = entered(1);
    expectChoiceFrom(s, "player1", "XG4-085");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:h1", "SPEC-E-S:h2"]);
  });

  it("XG4-085:【ターミネイトフラッシュ】— 自軍ダメージが1点なら1体まで撃破する（出典: atwiki/page-2151「自軍ダメージの数まで」）", () => {
    let s = entered(1);
    expectChoiceFrom(s, "player1", "XG4-085");
    s = resolveAll(pickThrough(s, "XG4-085", ["SPEC-E-S:h1", "SPEC-E-S:h2"]));
    const gone = ["SPEC-E-S:h1", "SPEC-E-S:h2"].filter((id) => zoneOf(s, "player2", id) === "discard");
    expect(gone).toEqual(["SPEC-E-S:h1"]);
  });

  it("XG4-085:【ターミネイトフラッシュ】— 自軍ダメージが0点なら何も撃破しない（出典: atwiki/page-2151「自軍ダメージの数まで」）", () => {
    const s = resolveAll(entered(0));
    expect(zoneOf(s, "player2", "SPEC-E-S:h1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E-S:h2")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-086 仮面ライダーイクサBM", () => {
  const TEXT = "【イクサカリバー・ガンモード】ウイングを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG4-086: カタログ本文・スペックが出典と一致（出典: atwiki/page-2064）", () => {
    expectCatalogText("XG4-086", TEXT);
    expectUnit("XG4-086", { name: "仮面ライダーイクサBM", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 1, comboNumber: "RC", features: ["仮面ライダー", "メカ", "男"] });
    expectRarityIn("XG4-086", ["N"]);
  });

  const rodeOff = () =>
    settle(rcRideOff(battle({ rush: [inst("XG4-086", "ix"), inst("SPEC-BIKE", "bk")] }, { battle: [inst("SPEC-E-S", "a")], rush: [inst("XG4-043", "w")], deck: deckCards(3, "e") }), "XG4-086:ix", "SPEC-BIKE:bk"));

  it("XG4-086: RC【イクサカリバー・ガンモード】— ライドオフしたとき、ウイングを持つ敵軍 S ユニット（どのエリアでも）を1体選ぶ（ウイングを持たないユニットは選べない。任意ではない）（出典: atwiki/page-2064「ウイングを持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = rodeOff();
    expectChoiceFrom(s, "player1", "XG4-086");
    expect(choiceIds(s)).toEqual(["XG4-043:w"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-086: RC — 選んだユニットは撃破される（出典: atwiki/page-2064「撃破する」）", () => {
    let s = rodeOff();
    expectChoiceFrom(s, "player1", "XG4-086");
    s = resolveAll(pick(s, "XG4-043:w"));
    expect(zoneOf(s, "player2", "XG4-043:w")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-087 スカイライダー（XG4）", () => {
  const TEXT = "※ウイング 【スカイキック】これが自軍エリアにある間、ウイングを持たないSユニットはBP-500される。（BP0以下になったユニットは撃破される）";

  it("XG4-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-2063）", () => {
    expectCatalogText("XG4-087", TEXT);
    expectUnit("XG4-087", { name: "スカイライダー", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("XG4-087", ["N"]);
  });

  // ※ウイングの共通テスト（RK1-001-021.helpers.ts wingTests）は敵が BP500 の S ユニットで、【スカイキック】の BP-500 で BP0 になり撃破されてしまう。
  // 同じ手順を BP1000 の敵（【スカイキック】で BP500）で行う。
  const WING_ENEMY = sUnit("SPEC-WING-ENEMY", { bp: 1000, sp: undefined });
  const wingBoard = (phase: GameState["phase"] = "battle") =>
    st({ phase, player1: { rush: [inst("XG4-087", "w")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-WING-ENEMY", "e")], deck: deckCards(3, "e") } }, [WING_ENEMY]);

  it("XG4-087: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドし、ラッシュエリアから敵軍ユニットにアタックできる（出典: atwiki/page-2063、grnrngr/faq-card-9 ウイング A1・R-KW-WING-01）", () => {
    let s = wingBoard();
    expect(canWing(s, "XG4-087:w")).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-087:w" });
    expect(cardIn(s, "player1", "XG4-087:w")?.commandHeld).toBe(true);
    expect(attackTargets(s, "XG4-087:w")).toContain("SPEC-WING-ENEMY:e");
    s = settle(attack(s, "XG4-087:w", "SPEC-WING-ENEMY:e"));
    expect(zoneOf(s, "player2", "SPEC-WING-ENEMY:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG4-087:w")).toBe("rush");
  });

  it("XG4-087: ※ウイング — 発動したターンはバトルエリアに出られない（出典: grnrngr/faq-card-9 ウイング Q4「いいえ、できません」）", () => {
    const s = act(wingBoard(), { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-087:w" });
    expect(canEnter(s, "XG4-087:w")).toBe(false);
  });

  it("XG4-087: ※ウイング — 自軍バトルフェイズ以外（ラッシュフェイズ）には発動できない（出典: grnrngr/faq-card-9 ウイング Q3「いいえ、できません」）", () => {
    expect(canWing(wingBoard("rush"), "XG4-087:w")).toBe(false);
  });

  it("XG4-087: ※ウイング — ラッシュエリア以外（バトルエリア）からは発動できない（出典: grnrngr/faq-card-9 ウイング Q5）", () => {
    const s = st({ player1: { battle: [inst("XG4-087", "w")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-WING-ENEMY", "e")] } }, [WING_ENEMY]);
    expect(canWing(s, "XG4-087:w")).toBe(false);
  });

  it("XG4-087: ※ウイング — ホールドしてもストライクはできない（出典: grnrngr/faq-card-9 ウイング Q6「いいえ、できません」）", () => {
    const s = act(wingBoard(), { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-087:w" });
    expect(canStrike(s, "XG4-087:w")).toBe(false);
  });

  it("XG4-087:【スカイキック】— ウイングを持たない S ユニット（敵軍・自軍）は BP-500。ウイングを持つユニット・M ユニット・これ自身は変わらない（出典: atwiki/page-2063「ウイングを持たないSユニットはBP-500される」・同 Q1「常に効果を発揮し続ける効果」）", () => {
    const s = battle({ rush: [inst("XG4-087", "sk"), inst("SPEC-S3000", "own")] }, { battle: [inst("SPEC-E-S", "a"), inst("XG4-043", "w"), inst("SPEC-E-M", "m")] });
    expect(bpsOf(s, "player2", ["SPEC-E-S:a", "XG4-043:w", "SPEC-E-M:m"])).toEqual([500, 3000, 1000]);
    expect(bpsOf(s, "player1", ["SPEC-S3000:own", "XG4-087:sk"])).toEqual([2500, 2000]);
  });

  it("XG4-087:【スカイキック】— BP0以下になったユニットは撃破される（BP500 の S ユニットがいる場にスカイライダーが出る）（出典: atwiki/page-2063「（BP0以下になったユニットは撃破される）」）", () => {
    const s = resolveAll(settle(enter(battle({ rush: [inst("XG4-087", "sk")] }, { battle: [inst("SPEC-E-500", "a")], deck: deckCards(3, "e") }), "XG4-087:sk")));
    expect(zoneOf(s, "player2", "SPEC-E-500:a")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-088 仮面ライダーW・CC", () => {
  const TEXT = "【旋風の右半身】このユニットからコンビネーションするSユニットは、次の能力を得る⇒自軍ターン中、BP+3000され、BP8000以上のとき「SP1」になる。";

  it("XG4-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-2039）", () => {
    expectCatalogText("XG4-088", TEXT);
    expectUnit("XG4-088", { name: "仮面ライダーW・CC", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: "L", features: ["仮面ライダー", "男", "ダブルドライバー", "FFR"] });
    expectRarityIn("XG4-088", ["SR"]);
  });

  it.todo("XG4-088:【旋風の右半身】JC（L）— バトルエリアのユニットの左に並べてコンビネーションすると、そのユニットは自軍ターン中 BP+3000 され、BP8000以上なら「SP1」になる（出典: atwiki/page-2039・atwiki/page-266「「L」は左…に並べることで効果が発動する」）（未対応の理由: バトルエリアのユニットの左に出す進入（move_to_battle に並べる位置の指定がない）を公開 API で行う手段がない）");
});

// ===========================================================================
describe("XG4-089 仮面ライダーW・JJ", () => {
  const TEXT =
    "【切札の左半身】これがSユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、撃破する。また、自軍バトルエリアに「仮面ライダーW・CC」があれば、これは「SP1」になる。";

  it("XG4-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-2101）", () => {
    expectCatalogText("XG4-089", TEXT);
    expectUnit("XG4-089", { name: "仮面ライダーW・JJ", category: "DA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: "R", features: ["仮面ライダー", "男", "ダブルドライバー", "FFR"] });
    expectRarityIn("XG4-089", ["SR"]);
  });

  // バトルエリアの BP3000 の S ユニットの右に出て JC（R）が成立する（atwiki/page-266「「R」は右に並べる」）。
  const jc = (left: ReturnType<typeof inst>[]) =>
    settle(enterNow(battle({ battle: left, rush: [inst("XG4-089", "jj")] }, { battle: [inst("SPEC-E-2000", "a"), inst("SPEC-E-3000", "b")], rush: [inst("SPEC-E-S", "r")], deck: deckCards(3, "e") }), "XG4-089:jj"));

  it("XG4-089:【切札の左半身】JC（R）— S ユニットの右に出ると、そのユニット（BP3000）より BP の低い敵軍ユニット（どのエリアでも）を1体選べる（BP3000 は選べない。任意）（出典: atwiki/page-2101「コンビネーションしたユニットよりもBPの低い敵軍ユニットを1体選び、撃破する」）", () => {
    const s = jc([inst("SPEC-S3000", "s")]);
    expectChoiceFrom(s, "player1", "XG4-089");
    expect(choiceIds(s)).toEqual(["SPEC-E-2000:a", "SPEC-E-S:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-089: JC — 選んだユニットは撃破される（出典: atwiki/page-2101「撃破する」）", () => {
    let s = jc([inst("SPEC-S3000", "s")]);
    expectChoiceFrom(s, "player1", "XG4-089");
    s = resolveAll(pick(s, "SPEC-E-2000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-2000:a")).toBe("discard");
  });

  it("XG4-089: JC — 自軍バトルエリアに「仮面ライダーW・CC」があれば「SP1」になる（出典: atwiki/page-2101「自軍バトルエリアに「仮面ライダーW・CC」があれば、これは「SP1」になる」）", () => {
    let s = jc([inst("XG4-088", "cc"), inst("SPEC-S3000", "s")]);
    expectChoiceFrom(s, "player1", "XG4-089");
    s = resolveAll(pick(s, "SPEC-E-2000:a"));
    expect(s.players.player1.battle.find((c) => c.instanceId === "XG4-089:jj")).toBeDefined();
    expect(spOf(s, "player1", "XG4-089:jj")).toBe(1);
  });
});

// ===========================================================================
describe("XG4-090 GGスレイヤー", () => {
  it("XG4-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-2082）", () => {
    expectCatalogText("XG4-090", "※これにライドしているユニットは、アタックするときBP+2000される。");
    expectVehicle("XG4-090", { name: "GGスレイヤー", category: "ET", powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-090", ["N"]);
  });

  it("XG4-090: ※ — ライドしているユニットはアタックするとき BP+2000（BP2000 が BP4000 でバトルする）（出典: atwiki/page-2082「これにライドしているユニットは、アタックするときBP+2000される」）", () => {
    const s = settle(attack(battle({ battle: ridingPair("SPEC-RIDER", "r", "XG4-090", "gg") }, { battle: [inst("SPEC-E-5000", "t")] }), "SPEC-RIDER:r", "SPEC-E-5000:t"));
    expect(lastBattleBps(s)?.attacker).toBe(4000);
  });
});
