/**
 * カード別スペック: XG7-024〜XG7-031（クロスギャザー ザ・ベストパートナー 獣拳神サイダイン〜新サイクロン号）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない（「XG7-」とカード名で検索）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CROSS・R-KW-WING・R-KW-RESIST・R-KW-READ・R-KW-BREAKER・R-CTR）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG7-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマル」を SR／R／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  act,
  attack,
  bpOf,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  crossTests,
  deckCards,
  enemyTurnOf,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnitStats,
  expectVehicleSpec,
  extraHoldTests,
  fill,
  heldN,
  inst,
  lastBattleBps,
  leadTests,
  legal,
  ncBoard,
  p1Battle,
  pick,
  pickAs,
  played,
  powerCards,
  registerOffered,
  attackUntilRegister,
  releasedCat,
  resolveAll,
  rushOpen,
  ridingPair,
  rushFromHand,
  rushPhaseOf,
  settle,
  skip,
  st,
  sUnit,
  targetsOf,
  useCounter,
  canCounter,
  vehicleCard,
  wingTests,
  zoneOf,
} from "./XG7-024-046.helpers";

const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const GEKI_S = sUnit("SPEC-GEKI-S", { category: "WB", bp: 1000, powerCost: 3, features: ["激気"] });
const WB_M1 = sUnit("SPEC-WB-M1", { category: "WB", bp: 3000, size: "M", powerCost: 1 });
const WB_M2 = sUnit("SPEC-WB-M2", { category: "WB", bp: 3000, size: "M", powerCost: 2 });
const MA_M1 = sUnit("SPEC-MA-M1", { category: "MA", bp: 3000, size: "M", powerCost: 1 });
const WB_S1 = sUnit("SPEC-WB-S1", { category: "WB", bp: 1000, powerCost: 1 });
const E_A = sUnit("SPEC-E-A", { category: "WB", bp: 1000, sp: undefined });
const E_B = sUnit("SPEC-E-B", { category: "WB", bp: 1000, sp: undefined });
const E_C = sUnit("SPEC-E-C", { category: "WB", bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { category: "WB", bp: 3000, size: "M", sp: undefined });
const MA_S1 = sUnit("SPEC-MA-S1", { category: "MA", bp: 1000, powerCost: 1 });
const MA_S3 = sUnit("SPEC-MA-S3", { category: "MA", bp: 1000, powerCost: 3 });
const C1 = sUnit("SPEC-C1", { category: "WB", bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { category: "WB", bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const C3M = sUnit("SPEC-C3M", { category: "WB", bp: 3000, powerCost: 3, size: "M" });
const C3COND = sUnit("SPEC-C3COND", { category: "WB", bp: 1000, powerCost: "3+", rushAdditionalCondition: { conditionId: "hold_extra_command", text: "追加で自軍コマンドを1つホールドする", unitCount: 1 } } as never);
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const MULTI_L = sUnit("SPEC-MULTI-L", { category: ["WB", "MA"] as unknown as "WB", bp: 9000, size: "L", powerCost: 5 });
const MONO_L = sUnit("SPEC-MONO-L", { category: "MA", bp: 9000, size: "L", powerCost: 5 });
const BIG = sUnit("SPEC-BIG", { category: "WB", bp: 9000, sp: undefined });
const PLAIN_V = vehicleCard("SPEC-PLAIN-V", { features: ["メカ"] });
const EXTRA = [ENEMY, GEKI_S, WB_M1, WB_M2, MA_M1, WB_S1, E_A, E_B, E_C, E_M, MA_S1, MA_S3, C1, C2, C3, C3M, C3COND, PLAIN, MULTI_L, MONO_L, BIG, PLAIN_V];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG7-024 獣拳神サイダイン", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍「ゲキチョッパー」があれば、自分は1枚ドローする。【獣力開花】これが自軍エリアにある間、カード名に「サイダイ」を含まない、特徴「激気」を持つユニットは次の能力を得る⇒これがバトルエリアに出たとき、自分自身の手札から、これの必要パワーの数字よりも必要パワーの数字が小さいWBのMユニットのカードを1枚選び、自分自身のラッシュエリアに出してもよい。";

  it("XG7-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-2418）", () => {
    expectCatalogText("XG7-024", TEXT);
    expectUnitStats("XG7-024", { name: "獣拳神サイダイン", category: ["WB", "MA"], size: "XL", bp: 6000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["拳聖", "激気"], rushCondition: "state_gate" });
    expectRarityIn("XG7-024", ["N"]);
  });

  const rushBoard = (rush: CardInstance[]) =>
    rushPhaseOf({ hand: [inst("XG7-024", "sd")], rush, command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(4), deck: deckCards(5) }, {}, EXTRA);

  it("XG7-024: 追加条件 — 特徴「激気」を持つ自軍 S ユニットがあればラッシュできる（出典: atwiki/page-2418「追加条件：特徴「激気」を持つ自軍Sユニットがある」）", () => {
    const r = rushFromHand(rushBoard([inst("SPEC-GEKI-S", "g")]), "player1", "XG7-024:sd");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-024:sd")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-GEKI-S:g")).toBe("rush");
  });

  it("XG7-024: 追加条件 — 特徴「激気」を持つ自軍 S ユニットがなければラッシュできない（出典: atwiki/page-2418）", () => {
    expect(canStartRush(rushBoard([inst("SPEC-PLAIN", "p")]), "player1", "XG7-024:sd")).toBe(false);
  });

  it("XG7-024: ※ラッシュしたとき、自軍「ゲキチョッパー」（RS-500）があれば1枚ドローする（出典: atwiki/page-2418「自軍「ゲキチョッパー」があれば、自分は1枚ドローする」）", () => {
    const s = resolveAll(rushFromHand(rushBoard([inst("RS-500", "gc")]), "player1", "XG7-024:sd").state);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it.fails("XG7-024: ※ 自軍「ゲキチョッパー」がなければドローしない（出典: atwiki/page-2418「…があれば」） — 既知の不具合: CARD-XG7-024 自軍「ゲキチョッパー」がなくてもドローする", () => {
    const s = resolveAll(rushFromHand(rushBoard([inst("SPEC-GEKI-S", "g")]), "player1", "XG7-024:sd").state);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  const bloom = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(p1Battle({ rush: [inst("XG7-024", "sd"), inst("SPEC-GEKI-S", "g")], hand: [inst("SPEC-WB-M1", "m1"), inst("SPEC-WB-M2", "m2"), inst("SPEC-MA-M1", "ma"), inst("SPEC-WB-S1", "s1")], ...p1 }, {}, EXTRA), "SPEC-GEKI-S:g");

  it.fails("XG7-024: 【獣力開花】これが自軍エリアにある間、特徴「激気」のユニットがバトルエリアに出たとき、手札の、それより必要パワーの数字が小さい WB の M ユニットのカードから1枚選べる（任意）（出典: atwiki/page-2418「これの必要パワーの数字よりも必要パワーの数字が小さいWBのMユニットのカードを1枚選び、自分自身のラッシュエリアに出してもよい」） — 既知の不具合: CARD-XG7-024 【獣力開花】（激気のユニットに手札の WB の M ユニットを出す能力を与える）が未実装", () => {
    const s = bloom();
    expectChoiceFrom(s, "player1", "XG7-024");
    expect(choiceIds(s)).toEqual(["SPEC-WB-M1:m1", "SPEC-WB-M2:m2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-024: 【獣力開花】選んだカードを自軍ラッシュエリアに出す（出典: atwiki/page-2418） — 既知の不具合: CARD-XG7-024 【獣力開花】（激気のユニットに手札の WB の M ユニットを出す能力を与える）が未実装", () => {
    const s = resolveAll(bloom(), ["SPEC-WB-M2:m2"]);
    expect(zoneOf(s, "player1", "SPEC-WB-M2:m2")).toBe("rush");
  });

  it("XG7-024: 【獣力開花】カード名に「サイダイ」を含むユニット（XG7-024 自身）は能力を得ない（出典: atwiki/page-2418「カード名に「サイダイ」を含まない」）", () => {
    const s = enter(p1Battle({ rush: [inst("XG7-024", "sd")], hand: [inst("SPEC-WB-M1", "m1")] }, {}, EXTRA), "XG7-024:sd");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-024");
  });

  it("XG7-024: 【獣力開花】これが自軍エリアになければ能力を得ない（出典: atwiki/page-2418「これが自軍エリアにある間」）", () => {
    const s = enter(p1Battle({ rush: [inst("SPEC-GEKI-S", "g")], discard: [inst("XG7-024", "sd")], hand: [inst("SPEC-WB-M1", "m1")] }, {}, EXTRA), "SPEC-GEKI-S:g");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-024");
  });
});

// ===========================================================================
describe("XG7-025 ゴーオンシルバー×ゴーオンゴールド", () => {
  const TEXT =
    "※クロス1 ※ウイング ※このユニットのナンバーの数字は、リリース状態の自軍コマンド1つにつき1少なくなる。【正義のツバサ】これがアタックして敵軍ユニットを撃破したとき、そのユニットと隣り合うSユニットを1体選び撃破してもよい。（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）";

  it("XG7-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-2391）", () => {
    expectCatalogText("XG7-025", TEXT);
    expectUnitStats("XG7-025", { name: "ゴーオンシルバー×ゴーオンゴールド", category: "OT", size: "S", bp: 6000, sp: undefined, powerCost: "4+", comboNumber: 6, features: ["ゴールド", "シルバー", "男", "女"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-025", ["R"]);
  });

  crossTests("XG7-025", "atwiki/page-2391");
  wingTests("XG7-025", "atwiki/page-2391");
  extraHoldTests("XG7-025", ["OT"], "4+", "atwiki/page-2391");

  const enemy = { battle: [inst("SPEC-E-A", "a"), inst("SPEC-E-B", "b"), inst("SPEC-E-C", "c"), inst("SPEC-E-M", "m")] };
  const wingsAt = (fillers: number, released: number) => {
    let s = nc("XG7-025:gg", fillers, { command: releasedCat("OT", released, "rc") }, enemy);
    s = resolveAll(s);
    return settle(attack(s, "XG7-025:gg", "SPEC-E-B:b"));
  };

  it.fails("XG7-025: ※ナンバーの減少 — リリース状態の自軍コマンド2つで CN4 になり、4番目で【正義のツバサ】が働く（撃破したユニットと隣り合う S ユニットから1体選べる・任意）（出典: atwiki/page-2391「リリース状態の自軍コマンド1つにつき1少なくなる」「そのユニットと隣り合うSユニットを1体選び撃破してもよい」） — 既知の不具合: CARD-XG7-025 【正義のツバサ】（撃破したユニットと隣り合う S ユニットの撃破）が未実装", () => {
    const s = wingsAt(3, 2);
    expectChoiceFrom(s, "player1", "XG7-025");
    expect(choiceIds(s)).toEqual(["SPEC-E-A:a", "SPEC-E-C:c"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-025: 【正義のツバサ】選んだユニットを撃破する（出典: atwiki/page-2391） — 既知の不具合: CARD-XG7-025 【正義のツバサ】（撃破したユニットと隣り合う S ユニットの撃破）が未実装", () => {
    const s = resolveAll(wingsAt(3, 2), ["SPEC-E-C:c"]);
    expect(zoneOf(s, "player2", "SPEC-E-B:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-C:c")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-A:a")).toBe("battle");
  });

  it("XG7-025: リリース状態の自軍コマンドがなければ CN6 のまま、4番目では働かない（出典: atwiki/page-2391「CN：6」）", () => {
    expect(wingsAt(3, 0).pendingEffectChoice?.sourceCardId).not.toBe("XG7-025");
  });

  it.fails("XG7-025: 【正義のツバサ】ウイングでアタックして撃破したときはナンバーに関係なく働く（出典: atwiki/page-2391「（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）」） — 既知の不具合: CARD-XG7-025 【正義のツバサ】（撃破したユニットと隣り合う S ユニットの撃破）が未実装", () => {
    let s = p1Battle({ rush: [inst("XG7-025", "gg")] }, enemy, EXTRA);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG7-025:gg" });
    s = settle(attack(s, "XG7-025:gg", "SPEC-E-B:b"));
    expectChoiceFrom(s, "player1", "XG7-025");
  });
});

// ===========================================================================
describe("XG7-026 ゴセイブラック×ゴセイイエロー", () => {
  const TEXT = "※クロス1 ※レジスト 【ランドコンビアタック】レジストを持つ敵軍Sユニットを1体選ぶか、レジストを持つ敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG7-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-2386）", () => {
    expectCatalogText("XG7-026", TEXT);
    expectUnitStats("XG7-026", { name: "ゴセイブラック×ゴセイイエロー", category: "MA", size: "S", bp: 4000, sp: undefined, powerCost: "4+", comboNumber: 3, features: ["ブラック", "イエロー", "男", "女"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-026", ["N"]);
  });

  crossTests("XG7-026", "atwiki/page-2386");
  extraHoldTests("XG7-026", ["MA"], "4+", "atwiki/page-2386");

  it("XG7-026: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2386「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG7-026", "gb")] }, "XG7-026:gb"))).toBe(true);
  });

  const land = () =>
    nc("XG7-026:gb", 2, {}, { battle: [inst("RK-214", "b"), inst("SPEC-ENEMY", "e")], rush: [inst("RK-214", "r")], command: [{ ...inst("RK-214", "c"), commandHeld: false }, ...releasedCat("WB", 1, "ec")] });

  it.fails("XG7-026: 【ランドコンビアタック】NC（3番目）— レジストを持つ敵軍 S ユニット（エリアを問わない）か、レジストを持つ敵軍コマンドから1つを選ぶ（見送れない）（出典: atwiki/page-2386「レジストを持つ敵軍Sユニットを1体選ぶか、レジストを持つ敵軍コマンドを1つ選び」） — 既知の不具合: CARD-XG7-026 【ランドコンビアタック】がレジストを見ずに敵軍バトルエリアのユニットを選ばせる（ラッシュエリア・コマンドも選べない）", () => {
    const s = land();
    expectChoiceFrom(s, "player1", "XG7-026");
    expect(choiceIds(s)).toEqual(["RK-214:b", "RK-214:c", "RK-214:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG7-026: 【ランドコンビアタック】選んだカードを持ち主のパワーゾーンにダメージ（ウラ向き）で置く（出典: atwiki/page-2386「持ち主のパワーゾーンにダメージにして置く」） — 既知の不具合: CARD-XG7-026 【ランドコンビアタック】がレジストを見ずに敵軍バトルエリアのユニットを選ばせる（ラッシュエリア・コマンドも選べない）", () => {
    const s = resolveAll(land(), ["RK-214:c"]);
    expect(zoneOf(s, "player2", "RK-214:c")).toBe("power");
    expect(cardIn(s, "player2", "RK-214:c")?.faceDown).toBe(true);
  });
});

// ===========================================================================
describe("XG7-027 雷撃ディスク", () => {
  const TEXT =
    "※カウンター 敵軍Sユニットがラッシュされたとき発動できる⇒自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ。そうしたとき、選んだユニットより必要パワーの数字が大きい、追加条件を持たない敵軍Sユニットを1体選び撃破する。";

  it("XG7-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-2419）", () => {
    expectCatalogText("XG7-027", TEXT);
    expectOpStats("XG7-027", { name: "雷撃ディスク", category: "MA", powerCost: 1 });
    expectRarityIn("XG7-027", ["N"]);
  });

  /** 敵軍（player2）ラッシュフェイズに、敵軍が SPEC-C3（必要パワー3）を手札からラッシュした直後（ラッシュの反応ウィンドウ）。 */
  const enemyRushed = (p1: Partial<GameState["players"]["player1"]> = {}, rushedUnit = "SPEC-C3") => {
    const s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { hand: [inst("XG7-027", "rd")], command: releasedCat("MA", 1), power: powerCards(1), rush: [inst("SPEC-MA-S1", "ma1"), inst("SPEC-MA-S3", "ma3"), inst("SPEC-C1", "wb1")], deck: deckCards(5), ...p1 },
        player2: { hand: [inst(rushedUnit, "h")], rush: [inst("SPEC-C2", "r2"), inst("SPEC-C1", "r1"), inst("SPEC-C3M", "m3"), inst("SPEC-C3COND", "cond")], command: releasedCat("WB", 2, "ew"), power: powerCards(3, "ep"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return rushOpen(s, "player2", `${rushedUnit}:h`);
  };

  it.fails("XG7-027: ※カウンター — 敵軍 S ユニットがラッシュされたとき使える（出典: atwiki/page-2419「敵軍Sユニットがラッシュされたとき発動できる」） — 既知の不具合: CARD-XG7-027 「敵軍 S ユニットがラッシュされたとき」のカウンターが使えない（効果も未実装）", () => {
    expect(canCounter(enemyRushed(), "XG7-027:rd")).toBe(true);
  });

  it.fails("XG7-027: 使うと、自軍ラッシュエリアの MA を持つ S ユニットから1体を選ぶ（出典: atwiki/page-2419「自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ」） — 既知の不具合: CARD-XG7-027 「敵軍 S ユニットがラッシュされたとき」のカウンターが使えない（効果も未実装）", () => {
    const s = useCounter(enemyRushed(), "XG7-027:rd");
    expectChoiceFrom(s, "player1", "XG7-027");
    expect(choiceIds(s)).toEqual(["SPEC-MA-S1:ma1", "SPEC-MA-S3:ma3"]);
  });

  it.fails("XG7-027: 選んだユニット（必要パワー1）より必要パワーの数字が大きい、追加条件を持たない敵軍 S ユニット（いまラッシュされたものも含む）から1体選び撃破する（出典: atwiki/page-2419・カード評価「既にラッシュされているユニットも対象にすることができる」） — 既知の不具合: CARD-XG7-027 「敵軍 S ユニットがラッシュされたとき」のカウンターが使えない（効果も未実装）", () => {
    let s = pick(useCounter(enemyRushed(), "XG7-027:rd"), "SPEC-MA-S1:ma1");
    expectChoiceFrom(s, "player1", "XG7-027");
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2", "SPEC-C3:h"]);
    s = resolveAll(pick(s, "SPEC-C3:h"));
    expect(zoneOf(s, "player2", "SPEC-C3:h")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-028 ゴセイアルティメット", () => {
  const TEXT =
    "※リードMA 【アルティメットストライク】自軍ターン中、これがバトルエリアに出たとき、「自軍コマンドを1つリリースするか、自軍ユニットを1体リリースする」を1～5回実行してもよい。そうしたとき、実行した回数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG7-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-2425）", () => {
    expectCatalogText("XG7-028", TEXT);
    expectUnitStats("XG7-028", { name: "ゴセイアルティメット", category: "MA", size: "XL", bp: 9000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["魔法", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG7-028", ["R"]);
  });

  leadTests("XG7-028", "MA", "atwiki/page-2425");

  it("XG7-028: 追加条件 — 自軍「ゴセイアルティメットMM」1体を捨札にしてラッシュする（出典: atwiki/page-2425「追加条件：自軍「ゴセイアルティメットMM」1体を捨札にする」）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-028", "ga")], rush: [inst("XG7-029", "mm")], command: releasedCat("MA", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG7-028:ga");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-029:mm")).toBe("discard");
  });

  const strike = () =>
    enter(p1Battle({ rush: [inst("XG7-028", "ga")], command: heldN(3, "TST-OP-MA", "hc") }, { battle: [inst("SPEC-C1", "e1"), inst("SPEC-C2", "e2"), inst("SPEC-C3", "e3")] }, EXTRA), "XG7-028:ga");

  it("XG7-028: 【アルティメットストライク】自軍ターン中、バトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-2425「1～5回実行してもよい」）", () => {
    const s = strike();
    expectChoiceFrom(s, "player1", "XG7-028");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-028: 【アルティメットストライク】ホールド状態の自軍コマンドを2回リリースすると、必要パワーの数字が2以下の敵軍ユニットを持ち主のパワーゾーンにダメージで置ける（出典: atwiki/page-2425「実行した回数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」） — 既知の不具合: CARD-XG7-028 【アルティメットストライク】（リリースした回数以下の敵軍ユニットをダメージに）が未実装", () => {
    const s = resolveAll(strike(), ["TST-OP-MA:hc0", "TST-OP-MA:hc1", "SPEC-C2:e2"]);
    expect(s.players.player1.command.filter((c) => !c.commandHeld).length).toBeGreaterThanOrEqual(2);
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C2:e2")?.faceDown).toBe(true);
  });
});

// ===========================================================================
describe("XG7-029 ゴセイアルティメットMM", () => {
  const TEXT =
    "※ウイング ※これは敵軍ユニットにアタックされない。【アルティメットグレートストライク】カテゴリを2つ以上持つLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒ウイングを持たない敵軍ユニットを1体選び撃破する。";

  it("XG7-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-2405）", () => {
    expectCatalogText("XG7-029", TEXT);
    expectUnitStats("XG7-029", { name: "ゴセイアルティメットMM", category: "MA", size: "XL", bp: 3000, sp: undefined, powerCost: 4, comboNumber: "L", features: ["魔法"] });
    expectRarityIn("XG7-029", ["N"]);
  });

  wingTests("XG7-029", "atwiki/page-2405");

  it("XG7-029: ※ 敵軍ユニットにアタックされない（出典: atwiki/page-2405「※これは敵軍ユニットにアタックされない」）", () => {
    const s = enemyTurnOf({ battle: [inst("XG7-029", "mm"), inst("SPEC-PLAIN", "p")] }, { battle: [inst("SPEC-BIG", "atk")] }, EXTRA);
    expect(targetsOf(s, "SPEC-BIG:atk", "player2")).toEqual(["SPEC-PLAIN:p"]);
  });

  const combo = (l: string) =>
    enter(p1Battle({ battle: [inst("XG7-029", "mm")], rush: [inst(l, "l")] }, { battle: [inst("SPEC-ENEMY", "e"), inst("XG7-011", "w")] }, EXTRA), `${l}:l`);

  it.fails("XG7-029: 【アルティメットグレートストライク】カテゴリを2つ以上持つ L ユニットがこれからコンビネーションするとき、ウイングを持たない敵軍ユニットから1体選べる（発動は任意）（出典: atwiki/page-2405「次の効果を発動できる⇒ウイングを持たない敵軍ユニットを1体選び撃破する」） — 既知の不具合: CARD-XG7-029 【アルティメットグレートストライク】が未実装", () => {
    const s = combo("SPEC-MULTI-L");
    expectChoiceFrom(s, "player1", "XG7-029");
    expect(choiceIds(s)).toEqual(["SPEC-ENEMY:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-029: 【アルティメットグレートストライク】選んだユニットを撃破する（出典: atwiki/page-2405） — 既知の不具合: CARD-XG7-029 【アルティメットグレートストライク】が未実装", () => {
    const s = resolveAll(combo("SPEC-MULTI-L"), ["SPEC-ENEMY:e"]);
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe("discard");
  });

  it("XG7-029: 【アルティメットグレートストライク】カテゴリが1つの L ユニットでは発動しない（出典: atwiki/page-2405「カテゴリを2つ以上持つLユニット」）", () => {
    expect(combo("SPEC-MONO-L").pendingEffectChoice?.sourceCardId).not.toBe("XG7-029");
  });
});

// ===========================================================================
describe("XG7-030 ゴセイヘッダー", () => {
  const TEXT =
    "ウイング、タクス、レジスト、リードのどれかを持つ自軍ユニットを1体選ぶ。このターン、選んだユニットはBP+1000され、ホールド状態ならリリースする。（これが自軍コマンドゾーンにある間、カード名に「ゴセイ」を含む自軍ユニットがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このカードの効果を発動する）";

  it("XG7-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-2420）", () => {
    expectCatalogText("XG7-030", TEXT);
    const d = DEFS["XG7-030"]!;
    expect(d.name).toBe("ゴセイヘッダー");
    expect(d.type).toBe("operation");
    expect(d.category).toEqual(["WB", "MA"]);
    expect(d.powerCost).toBe(2);
    expectRarityIn("XG7-030", ["N"]);
  });

  const used = () =>
    played(
      rushPhaseOf({ hand: [inst("XG7-030", "op")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(2), rush: [{ ...inst("XG7-011", "w"), commandHeld: true }, inst("XG7-018", "rg"), inst("SPEC-PLAIN", "p")] }, { rush: [inst("XG7-011", "ew")] }, EXTRA),
      "XG7-030:op",
    );

  it.fails("XG7-030: 使うと、ウイング・タクス・レジスト・リードのどれかを持つ自軍ユニットから1体を選ぶ（出典: atwiki/page-2420「ウイング、タクス、レジスト、リードのどれかを持つ自軍ユニットを1体選ぶ」） — 既知の不具合: CARD-XG7-030 選んだユニットの BP+1000・リリースと、コマンドゾーンからの発動が未実装", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG7-030");
    expect(choiceIds(s)).toEqual(["XG7-011:w", "XG7-018:rg"]);
  });

  it.fails("XG7-030: このターン、選んだユニットは BP+1000 され、ホールド状態ならリリースする（出典: atwiki/page-2420「このターン、選んだユニットはBP+1000され、ホールド状態ならリリースする」） — 既知の不具合: CARD-XG7-030 選んだユニットの BP+1000・リリースと、コマンドゾーンからの発動が未実装", () => {
    const s = resolveAll(used(), ["XG7-011:w"]);
    expect(bpOf(s, "player1", "XG7-011:w")).toBe(4000);
    expect(cardIn(s, "player1", "XG7-011:w")?.commandHeld ?? false).toBe(false);
  });

  it.fails("XG7-030: （）— 自軍コマンドゾーンにある間、カード名に「ゴセイ」を含む自軍ユニットがバトルエリアに出たとき、これをホールドして効果を発動できる（出典: atwiki/page-2420「これが自軍コマンドゾーンにある間…これをホールドしてもよい。そうしたとき、このカードの効果を発動する」） — 既知の不具合: CARD-XG7-030 選んだユニットの BP+1000・リリースと、コマンドゾーンからの発動が未実装", () => {
    let s = enter(p1Battle({ rush: [inst("XG7-019", "gs")], command: [{ ...inst("XG7-030", "cz"), commandHeld: false }] }, {}, EXTRA), "XG7-019:gs");
    s = resolveAll(s, ["XG7-030:cz", "XG7-019:gs"]);
    expect(cardIn(s, "player1", "XG7-030:cz")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", "XG7-019:gs")).toBe(4000);
  });
});

// ===========================================================================
describe("XG7-031 新サイクロン号", () => {
  const TEXT =
    "※ブレイカー ※これにライドしているユニットは、「仮面ライダー1号」または「仮面ライダー2号」ならクロス1を得る。【サイクロンアタック】これにライドしているユニットはBP+1000され、敵軍Sユニットまたは敵軍Sビークルの効果に選ばれない。";

  it("XG7-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-2429）", () => {
    expectCatalogText("XG7-031", TEXT);
    expectVehicleSpec(DEFS, "XG7-031", { name: "新サイクロン号", category: "ET", size: "S", powerCost: 3, features: ["メカ", "車両"] });
    expectRarityIn("XG7-031", ["R"]);
  });

  it("XG7-031: ※ブレイカー — 同名の自軍ビークルがあるとき、ラッシュできない（出典: atwiki/page-2429「※ブレイカー」・atwiki/page-2355 A1）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-031", "h")], rush: [inst("XG7-031", "same")], command: releasedCat("ET", 1), power: powerCards(3) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG7-031:h")).toBe(false);
  });

  it.fails("XG7-031: 【サイクロンアタック】これにライドしているユニットは BP+1000（RK-023 仮面ライダー1号 4000→5000）（出典: atwiki/page-2429「これにライドしているユニットはBP+1000され」） — 既知の不具合: CARD-XG7-031 【サイクロンアタック】（ライドしたユニットの BP+1000）が未実装", () => {
    const s = p1Battle({ battle: ridingPair("RK-023", "r", "XG7-031", "v") }, {}, EXTRA);
    expect(bpOf(s, "player1", "RK-023:r")).toBe(5000);
  });

  it.fails("XG7-031: ※ ライドしている「仮面ライダー1号」はクロス1を得る（右に出た CN3 の XG1-007 が2番目で NC）（出典: atwiki/page-2429「「仮面ライダー1号」または「仮面ライダー2号」ならクロス1を得る」） — 既知の不具合: CARD-XG7-031 ライドしている「仮面ライダー1号」がクロス1を得ない", () => {
    const s = enter(p1Battle({ battle: ridingPair("RK-023", "r", "XG7-031", "v"), rush: [inst("XG1-007", "cd")] }, {}, EXTRA), "XG1-007:cd");
    expect(s.log.some((l) => l.includes("number_combo") && l.includes("XG1-007"))).toBe(true);
  });

  it("XG7-031: 【サイクロンアタック】の「選ばれない」は敵軍 S の効果だけ — 敵軍 M ユニット RS-155 ガオバイソンの効果では選べる（出典: atwiki/page-2429「敵軍Sユニットまたは敵軍Sビークルの効果に選ばれない」）", () => {
    let s = enemyTurnOf(
      { battle: ridingPair("RK-023", "r", "XG7-031", "v"), damage: 6, power: Array.from({ length: 6 }, (_, i) => ({ ...inst("TST-P", `d${i}`), faceDown: true })) },
      { rush: [inst("RS-155", "bs")], command: releasedCat("WB", 1) },
      EXTRA,
    );
    s = act(s, { type: "initiate_command_payment", playerId: "player2", kind: "battle_entry", sourceInstanceId: "RS-155:bs" } as GameAction);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).toContain("RK-023:r");
  });
});

void fill;
void lastBattleBps;
void skip;
void pickAs;
void legal;
void PLAIN_V;
