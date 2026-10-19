/**
 * カード別スペック: XG7-055〜XG7-061（クロスギャザー ザ・ベストパートナー サイクロン・ドーパント〜トンデモジョーズ）
 *
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. 公式 FAQ・エラッタ・公式 Q&A — grnrngr の FAQ・08-errata.md には載っていない。XG7-055・056・058・059 は atwiki に公式 Q&A の転記がある。
 *  2. atwiki のカードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）の本文・Q&A。
 *  3. 一般ルール（docs/rules/*.md）、atwiki のカード評価・コメント。
 *
 * エンジンが出典と違う／効果が無いところは、出典どおりの期待値のまま it.fails（既知の不具合: CARD-XG7-NNN）にしている。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  actionsMentioning,
  attack,
  canCounter,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  categoriesOf,
  choiceFromCard,
  choiceIds,
  deckCards,
  enemyRushedFromHand,
  enemyTurnOf,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  featuresOf,
  inst,
  lastBattleBps,
  leadTests,
  legal,
  p1Battle,
  payableFor,
  powerCards,
  rcRideOff,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushOpen,
  rushPhaseOf,
  settle,
  spOf,
  st,
  sUnit,
  toPhase,
  vehicleCard,
  zoneOf,
} from "./XG7-047-068.helpers";

const V = vehicleCard("SPEC-V", { features: ["メカ"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const E1000 = sUnit("SPEC-E1000", { category: "WB", bp: 1000, sp: undefined });
const S4000 = sUnit("SPEC-S4000", { category: "WB", bp: 4000, powerCost: 0 });
const WOMAN = sUnit("SPEC-WOMAN", { category: "WB", bp: 1000, powerCost: 0, features: ["女"] });
const EXTRA = [V, PLAIN, E1000, S4000, WOMAN];

/** 自軍ターン（ラッシュフェイズ）と敵軍ターンで、場の id のカテゴリ・特徴を見る。 */
const ownTurn = (id: string) => rushPhaseOf({ rush: [inst(id, "x")] }, {}, EXTRA);
const enemyTurn = (id: string) => enemyTurnOf({ rush: [inst(id, "x")] }, {}, EXTRA);

/** 敵軍ラッシュフェイズに、敵軍が手札の unit を通常の手段でラッシュした直後。 */
const enemyRush = (p1: Partial<GameState["players"]["player1"]>, unit: string, p2: Partial<GameState["players"]["player2"]> = {}) => {
  const [id, suf] = unit.split(":") as [string, string];
  const s = st({ phase: "rush", activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { hand: [inst(id, suf)], command: releasedCat("WB", 1, "ew"), power: powerCards(6, "ep"), deck: deckCards(5, "e"), ...p2 } }, EXTRA);
  return rushOpen(s, "player2", unit);
};

/** 敵軍ターン、TST-UNIT-7 が自軍の target にアタックした直後（バトルの反応は開いたまま）。 */
const attacked = (p1: Partial<GameState["players"]["player1"]>, target: string) =>
  attack(enemyTurnOf(p1, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA), "TST-UNIT-7:atk", target, "player2");

const offeredBy = (s: GameState, cardId: string, instanceId: string) => choiceFromCard(s, cardId) || actionsMentioning(s, instanceId).length > 0;
const accept = (s0: GameState, instanceId: string, prefer: string[] = []) => {
  let s = s0;
  const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes(instanceId) && x.type !== "end_phase");
  if (a && !s.pendingEffectChoice) s = act(s, a);
  return resolveAll(s, [instanceId, "confirm", ...prefer]);
};

// ===========================================================================
describe("XG7-055 サイクロン・ドーパント", () => {
  const TEXT =
    "※これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、ETが追加される。 ※リードET 【神出鬼没の疾風】これが自軍コマンドゾーンにある間、敵軍ターン中、自軍Sユニットがアタックされたとき、アタックされたユニットとこれを置き換えてもよい。そうしたとき、アタックされたユニットのかわりにこのユニットがバトルする。";

  it("XG7-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-2423）", () => {
    expectCatalogText("XG7-055", TEXT);
    expectUnitStats("XG7-055", { name: "サイクロン・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["怪人", "女", "ドーパント"] });
    expectRarityIn("XG7-055", ["N"]);
  });

  it("XG7-055: ※ 自軍ターン中、自軍エリアにある間は ET が追加される（DA・ET）（出典: atwiki/page-2423「自軍ターン中、ETが追加される」）", () => {
    expect(categoriesOf(ownTurn("XG7-055"), "player1", "XG7-055:x")).toEqual(["DA", "ET"]);
  });

  it("XG7-055: ※ 敵軍ターン中は DA だけ（出典: atwiki/page-2423「自軍ターン中」）", () => {
    expect(categoriesOf(enemyTurn("XG7-055"), "player1", "XG7-055:x")).toEqual(["DA"]);
  });

  it.fails("XG7-055: ※ 自軍ターン中、自軍コマンドゾーンにある間も ET のコマンドとして ET のオペレーションの支払いに使える（出典: atwiki/page-2423「自軍エリアまたは自軍ゾーンにある間」） — 既知の不具合: CARD-XG7-055 自軍コマンドゾーンにあるとき ET が追加されない（ET のコマンドとして払えない）", () => {
    const s = rushPhaseOf({ hand: [inst("TST-OP-ET", "op")], command: [released("XG7-055", "c")], power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "TST-OP-ET:op")).toContain("XG7-055:c");
  });

  it("XG7-055: ※ 敵軍ターン中は ET のコマンドにならない — ET のカウンター RK-012 宏のオルゴール時計を払えない（出典: atwiki/page-2423「自軍ターン中」）", () => {
    expect(canCounter(enemyRush({ hand: [inst("RK-012", "mb")], command: [released("XG7-055", "c")], power: powerCards(4) }, "SPEC-S4000:u"), "RK-012:mb")).toBe(false);
  });

  it("XG7-055: （確認）ET のコマンドがあれば同じ場面で RK-012 を使える（出典: RK-012 本文）", () => {
    expect(canCounter(enemyRush({ hand: [inst("RK-012", "mb")], command: releasedCat("ET", 1), power: powerCards(4) }, "SPEC-S4000:u"), "RK-012:mb")).toBe(true);
  });

  leadTests("XG7-055", "ET", "atwiki/page-2423");

  it("XG7-055: 【神出鬼没の疾風】自軍コマンドゾーンにある間、敵軍ターン中、自軍 S ユニットがアタックされたとき、置き換えるかを選べる（出典: atwiki/page-2423「アタックされたユニットとこれを置き換えてもよい」）", () => {
    const s = attacked({ battle: [inst("SPEC-PLAIN", "p")], command: [released("XG7-055", "c")] }, "SPEC-PLAIN:p");
    expect(offeredBy(s, "XG7-055", "XG7-055:c")).toBe(true);
  });

  it("XG7-055: 【神出鬼没の疾風】置き換えたとき、アタックされたユニットはコマンドゾーンへ、これがバトルエリアでかわりにバトルする（出典: atwiki/page-2423「そうしたとき、アタックされたユニットのかわりにこのユニットがバトルする」・rules R-REPL-04）", () => {
    const s = settle(accept(attacked({ battle: [inst("SPEC-PLAIN", "p")], command: [released("XG7-055", "c")] }, "SPEC-PLAIN:p"), "XG7-055:c"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:p")).toBe("command");
    expect(lastBattleBps(s)?.defender).toBe(3000);
  });
});

// ===========================================================================
describe("XG7-056 ルナ・ドーパント", () => {
  const TEXT =
    "※これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、MAが追加される。 【嫌いじゃないわ！】これが自分の手札にある間、特徴「男」を持つ敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。そうしたとき、そのターン、そのユニットはバトルエリアに出られない。";

  it("XG7-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-2376）", () => {
    expectCatalogText("XG7-056", TEXT);
    expectUnitStats("XG7-056", { name: "ルナ・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["怪人", "男", "ドーパント"] });
    expectRarityIn("XG7-056", ["N"]);
  });

  it("XG7-056: ※ 自軍ターン中、自軍エリアにある間は MA が追加される（DA・MA）（出典: atwiki/page-2376「自軍ターン中、MAが追加される」）", () => {
    expect(categoriesOf(ownTurn("XG7-056"), "player1", "XG7-056:x")).toEqual(["DA", "MA"]);
  });

  it("XG7-056: ※ 敵軍ターン中は DA だけ（出典: atwiki/page-2376・カード評価「自軍ターン中だけマルチカテゴリになる」）", () => {
    expect(categoriesOf(enemyTurn("XG7-056"), "player1", "XG7-056:x")).toEqual(["DA"]);
  });

  it("XG7-056: 【嫌いじゃないわ！】手札にある間、特徴「男」を持つ敵軍 S ユニットがラッシュされたとき、これを自軍ラッシュエリアに出すかを選べる（出典: atwiki/page-2376「これを自軍ラッシュエリアに出してもよい」）", () => {
    const s = enemyRushedFromHand({ hand: [inst("XG7-056", "ln")] }, EXTRA);
    expect(offeredBy(s, "XG7-056", "XG7-056:ln")).toBe(true);
  });

  it("XG7-056: 【嫌いじゃないわ！】ラッシュされたのが「男」を持たないユニットなら出せない（出典: atwiki/page-2376「特徴「男」を持つ敵軍Sユニット」）", () => {
    const s = enemyRush({ hand: [inst("XG7-056", "ln")] }, "SPEC-WOMAN:w");
    expect(offeredBy(s, "XG7-056", "XG7-056:ln")).toBe(false);
  });

  it("XG7-056: 【嫌いじゃないわ！】出したとき、そのターン、ラッシュされたユニットはバトルエリアに出られない（出典: atwiki/page-2376「そのターン、そのユニットはバトルエリアに出られない」）", () => {
    let s = accept(enemyRushedFromHand({ hand: [inst("XG7-056", "ln")] }, EXTRA), "XG7-056:ln");
    expect(zoneOf(s, "player1", "XG7-056:ln")).toBe("rush");
    s = toPhase(s, "player2", "battle");
    expect(canEnter(s, "SPEC-MORPH-RUSHER:h", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("XG7-057 ヒート・ドーパント", () => {
  const TEXT = "※これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、WBが追加される。 【冷たいファイヤーガール】「SP1/2」 これがアタックしたとき、相手は自分自身の捨札を1枚選び、ゲームから除外する。";

  it("XG7-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-2377「SP：！」「CN：RC」）", () => {
    expectCatalogText("XG7-057", TEXT);
    expectUnitStats("XG7-057", { name: "ヒート・ドーパント", category: "DA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: "RC", features: ["怪人", "女", "ドーパント"] });
    expectRarityIn("XG7-057", ["N"]);
  });

  it("XG7-057: ※ 自軍ターン中、自軍エリアにある間は WB が追加される（DA・WB）（出典: atwiki/page-2377「自軍ターン中、WBが追加される」）", () => {
    expect(categoriesOf(ownTurn("XG7-057"), "player1", "XG7-057:x")).toEqual(["DA", "WB"]);
  });

  it("XG7-057: ※ 敵軍ターン中は DA だけ（出典: atwiki/page-2377）", () => {
    expect(categoriesOf(enemyTurn("XG7-057"), "player1", "XG7-057:x")).toEqual(["DA"]);
  });

  const heat = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(settle(rcRideOff(p1Battle({ rush: [inst("XG7-057", "ht"), inst("SPEC-V", "v")] }, { battle: [inst("SPEC-E1000", "e")], discard: [inst("TST-OP", "d0"), inst("TST-OP", "d1")], ...p2 }, EXTRA), "XG7-057:ht", "SPEC-V:v")));

  it("XG7-057: 【冷たいファイヤーガール】RC（ライドオフ）— 「SP1/2」になり、ビークルの次（2番目）で SP1（出典: atwiki/page-2377「【冷たいファイヤーガール】「SP1/2」」・rules/07-keywords R-KW-RIDE「ライドオフしたユニットはビークルの次に並び」）", () => {
    expect(spOf(heat(), "player1", "XG7-057:ht")).toBe(1);
  });

  it("XG7-057: 【冷たいファイヤーガール】アタックしたとき、相手は自分自身の捨札を1枚選んで除外する（出典: atwiki/page-2377「これがアタックしたとき、相手は自分自身の捨札を1枚選び、ゲームから除外する」）", () => {
    const s = resolveAll(settle(attack(heat(), "XG7-057:ht", "SPEC-E1000:e")), ["TST-OP:d1"]);
    expect((s.players.player2.exile ?? []).length).toBe(1);
  });
});

// ===========================================================================
describe("XG7-058 メタル・ドーパント", () => {
  const TEXT = "※これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、特徴「メカ」を得る。 【鋼鉄のマッチョボディ】これがユニットでなくなるとき、これをホールドしてその場に留めてもよい。また、これはホールド状態なら、アタックするときBP+2000される。";

  it("XG7-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-2378）", () => {
    expectCatalogText("XG7-058", TEXT);
    expectUnitStats("XG7-058", { name: "メタル・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["怪人", "男", "ドーパント"] });
    expectRarityIn("XG7-058", ["N"]);
  });

  it("XG7-058: ※ 自軍ターン中、自軍エリアにある間は特徴「メカ」を得る（出典: atwiki/page-2378「自軍ターン中、特徴「メカ」を得る」）", () => {
    expect(featuresOf(ownTurn("XG7-058"), "player1", "XG7-058:x")).toContain("メカ");
  });

  it("XG7-058: ※ 敵軍ターン中は「メカ」を持たない（出典: atwiki/page-2378）", () => {
    expect(featuresOf(enemyTurn("XG7-058"), "player1", "XG7-058:x")).not.toContain("メカ");
  });

  it("XG7-058: 【鋼鉄のマッチョボディ】バトルで撃破されてユニットでなくなるとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-2378「これがユニットでなくなるとき、これをホールドしてその場に留めてもよい」・Q2）", () => {
    let s = attacked({ battle: [inst("XG7-058", "mt")] }, "XG7-058:mt");
    for (let i = 0; i < 4 && !offeredBy(s, "XG7-058", "XG7-058:mt"); i++) s = settle(s, 1);
    expect(offeredBy(s, "XG7-058", "XG7-058:mt")).toBe(true);
  });

  it("XG7-058: 【鋼鉄のマッチョボディ】留めたとき、ホールド状態でバトルエリアに残る（出典: atwiki/page-2378）", () => {
    let s = attacked({ battle: [inst("XG7-058", "mt")] }, "XG7-058:mt");
    for (let i = 0; i < 4 && !offeredBy(s, "XG7-058", "XG7-058:mt"); i++) s = settle(s, 1);
    s = settle(accept(s, "XG7-058:mt"));
    expect(zoneOf(s, "player1", "XG7-058:mt")).toBe("battle");
    expect(cardIn(s, "player1", "XG7-058:mt")?.commandHeld).toBe(true);
  });

  it("XG7-058: 【鋼鉄のマッチョボディ】ホールド状態ならアタックするとき BP+2000（5000）（出典: atwiki/page-2378「ホールド状態なら、アタックするときBP+2000される」・カード評価「自力でBP5000にまで上昇する」）", () => {
    const s = settle(attack(p1Battle({ battle: [{ ...inst("XG7-058", "mt"), commandHeld: true }] }, { battle: [inst("SPEC-E1000", "e")] }, EXTRA), "XG7-058:mt", "SPEC-E1000:e"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
  });

  it("XG7-058: 【鋼鉄のマッチョボディ】リリース状態でアタックするときは BP3000 のまま（出典: atwiki/page-2378）", () => {
    const s = settle(attack(p1Battle({ battle: [inst("XG7-058", "mt")] }, { battle: [inst("SPEC-E1000", "e")] }, EXTRA), "XG7-058:mt", "SPEC-E1000:e"));
    expect(lastBattleBps(s)?.attacker).toBe(3000);
  });
});

// ===========================================================================
describe("XG7-059 トリガー・ドーパント", () => {
  const TEXT =
    "※これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、OTが追加される。 【ゲームスタート……】これが自軍パワーゾーンでオモテ向きになっている間、効果に「ラッシュしたとき」とある敵軍ユニットがその効果を発動するとき、それを実行する前に、これを自軍ラッシュエリアに出してもよい。そうしたとき、その効果は無効になる。";

  it("XG7-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-2379）", () => {
    expectCatalogText("XG7-059", TEXT);
    expectUnitStats("XG7-059", { name: "トリガー・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["怪人", "男", "ドーパント"] });
    expectRarityIn("XG7-059", ["N"]);
  });

  it("XG7-059: ※ 自軍ターン中、自軍エリアにある間は OT が追加される（DA・OT）（出典: atwiki/page-2379「自軍ターン中、OTが追加される」）", () => {
    expect(categoriesOf(ownTurn("XG7-059"), "player1", "XG7-059:x")).toEqual(["DA", "OT"]);
  });

  it("XG7-059: ※ 敵軍ターン中は DA だけ（出典: atwiki/page-2379）", () => {
    expect(categoriesOf(enemyTurn("XG7-059"), "player1", "XG7-059:x")).toEqual(["DA"]);
  });

  /** 敵軍が XG7-049 ガタキリバコンボ（「手札からラッシュしたとき」【分身体】）を手札からラッシュする。 */
  const trigger = (power: CardInstance[] = [inst("XG7-059", "tg")]) =>
    enemyRush({ power }, "XG7-049:g", { deck: [inst("XG7-049", "e1"), inst("TST-OP", "e2"), ...deckCards(3, "e")], power: powerCards(4, "ep") });

  it("XG7-059: 【ゲームスタート……】自軍パワーゾーンでオモテ向きの間、敵軍ユニットの「ラッシュしたとき」の効果の発動に対して、これを自軍ラッシュエリアに出すかを選べる（出典: atwiki/page-2379「それを実行する前に、これを自軍ラッシュエリアに出してもよい」）", () => {
    expect(offeredBy(trigger(), "XG7-059", "XG7-059:tg")).toBe(true);
  });

  it("XG7-059: 【ゲームスタート……】ウラ向き（ダメージ）なら出せない（出典: atwiki/page-2379「自軍パワーゾーンでオモテ向きになっている間」）", () => {
    expect(offeredBy(trigger([{ ...inst("XG7-059", "tg"), faceDown: true }]), "XG7-059", "XG7-059:tg")).toBe(false);
  });

  it("XG7-059: 【ゲームスタート……】出したとき、その効果は無効になる（【分身体】で敵軍の山札の XG7-049 がラッシュエリアに出ない）（出典: atwiki/page-2379「そうしたとき、その効果は無効になる」）", () => {
    const s = accept(trigger(), "XG7-059:tg");
    expect(zoneOf(s, "player1", "XG7-059:tg")).toBe("rush");
    expect(zoneOf(s, "player2", "XG7-049:e1")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-OP:e2")).toBe("deck");
  });
});

// ===========================================================================
describe("XG7-060 ドデカブタック", () => {
  const TEXT = "【射手座のスターピース】これをラッシュしたとき、自軍パワーゾーンからウラ向きのカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードがオペレーションカードなら、自軍パワーゾーンにオモテ向きで置き直してもよい。";

  it("XG7-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-2432）", () => {
    expectCatalogText("XG7-060", TEXT);
    expectUnitStats("XG7-060", { name: "ドデカブタック", category: ["OT", "ET"], size: "M", bp: 7000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "state_gate" });
    expectRarityIn("XG7-060", ["R"]);
  });

  const SM = { ...inst("XG7-063", "sm"), faceDown: false };
  // マルチカテゴリ（OT・ET）のカードは、両方のカテゴリのコマンドがコマンドゾーンに要る（rules/02-zones-cards R-CAT-02）。
  const board = (power: CardInstance[]) => rushPhaseOf({ hand: [inst("XG7-060", "dk")], command: [...releasedCat("OT", 1), ...releasedCat("ET", 1)], power }, {}, EXTRA);

  it("XG7-060: 追加条件 — カード名に「SM」を含む自軍パワー（オモテ向きの XG7-063 シャークラーSM）があればラッシュできる（出典: atwiki/page-2432「追加条件：カード名に「スター」または「SM」を含む自軍パワーがある」）", () => {
    const r = rushFromHand(board([SM, ...powerCards(4)]), "player1", "XG7-060:dk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-060:dk")).toBe("rush");
  });

  it("XG7-060: 追加条件 — 「スター」「SM」を含む自軍パワーがなければラッシュできない（出典: atwiki/page-2432）", () => {
    expect(canStartRush(board(powerCards(5)), "player1", "XG7-060:dk")).toBe(false);
  });

  const piece = () =>
    rushFromHand(board([SM, { ...inst("TST-OP", "dop"), faceDown: true }, { ...inst("SPEC-PLAIN", "dun"), faceDown: true }, ...powerCards(2)]), "player1", "XG7-060:dk").state;

  it("XG7-060: 【射手座のスターピース】ラッシュしたとき、自軍パワーゾーンのウラ向きのカードから1枚選べる（任意）（出典: atwiki/page-2432「自軍パワーゾーンからウラ向きのカードを1枚選び、捨札にしてもよい」）", () => {
    const s = piece();
    expectChoiceFrom(s, "player1", "XG7-060");
    expect(choiceIds(s)).toEqual(["SPEC-PLAIN:dun", "TST-OP:dop"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-060: 【射手座のスターピース】捨札にしたのがオペレーションカードなら、自軍パワーゾーンにオモテ向きで置き直せる（出典: atwiki/page-2432「捨札にしたカードがオペレーションカードなら、自軍パワーゾーンにオモテ向きで置き直してもよい」）", () => {
    const s = resolveAll(piece(), ["TST-OP:dop", "confirm"]);
    expect(zoneOf(s, "player1", "TST-OP:dop")).toBe("power");
    expect(cardIn(s, "player1", "TST-OP:dop")?.faceDown).toBe(false);
  });

  it("XG7-060: 【射手座のスターピース】捨札にしたのがユニットカードなら捨札のまま（出典: atwiki/page-2432「オペレーションカードなら」）", () => {
    const s = resolveAll(piece(), ["SPEC-PLAIN:dun"]);
    expect(zoneOf(s, "player1", "SPEC-PLAIN:dun")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-061 トンデモジョーズ", () => {
  const TEXT = "【蠍座のスターピース】これをラッシュしたとき、敵軍パワーゾーンからオモテ向きのカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードがオペレーションカードなら、敵軍パワーゾーンにダメージにして置き直してもよい。";

  it("XG7-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-2410）", () => {
    expectCatalogText("XG7-061", TEXT);
    expectUnitStats("XG7-061", { name: "トンデモジョーズ", category: ["OT", "DA"], size: "M", bp: 7000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "state_gate" });
    expectRarityIn("XG7-061", ["N"]);
  });

  const SM = { ...inst("XG7-063", "sm"), faceDown: false };
  // マルチカテゴリ（OT・DA）のカードは、両方のカテゴリのコマンドがコマンドゾーンに要る（rules/02-zones-cards R-CAT-02）。
  const board = (power: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushPhaseOf({ hand: [inst("XG7-061", "tj")], command: [...releasedCat("OT", 1), ...releasedCat("DA", 1)], power }, p2, EXTRA);

  it("XG7-061: 追加条件 — カード名に「SM」を含む自軍パワーがあればラッシュできる（出典: atwiki/page-2410「追加条件：カード名に「スター」または「SM」を含む自軍パワーがある」）", () => {
    const r = rushFromHand(board([SM, ...powerCards(5)]), "player1", "XG7-061:tj");
    expect(r.ok, r.error).toBe(true);
  });

  it("XG7-061: 追加条件 — 「スター」「SM」を含む自軍パワーがなければラッシュできない（出典: atwiki/page-2410）", () => {
    expect(canStartRush(board(powerCards(6)), "player1", "XG7-061:tj")).toBe(false);
  });

  const piece = () =>
    rushFromHand(board([SM, ...powerCards(5)], { power: [inst("TST-OP", "eop"), inst("SPEC-PLAIN", "eun"), { ...inst("TST-OP", "edn"), faceDown: true }] }), "player1", "XG7-061:tj").state;

  it("XG7-061: 【蠍座のスターピース】ラッシュしたとき、敵軍パワーゾーンのオモテ向きのカードから1枚選べる（任意。ウラ向きは選べない）（出典: atwiki/page-2410「敵軍パワーゾーンからオモテ向きのカードを1枚選び、捨札にしてもよい」）", () => {
    const s = piece();
    expectChoiceFrom(s, "player1", "XG7-061");
    expect(choiceIds(s)).toEqual(["SPEC-PLAIN:eun", "TST-OP:eop"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-061: 【蠍座のスターピース】捨札にしたのがオペレーションカードなら、敵軍パワーゾーンにダメージ（ウラ向き）で置き直せる（出典: atwiki/page-2410「敵軍パワーゾーンにダメージにして置き直してもよい」）", () => {
    const s = resolveAll(piece(), ["TST-OP:eop", "confirm"]);
    expect(zoneOf(s, "player2", "TST-OP:eop")).toBe("power");
    expect(cardIn(s, "player2", "TST-OP:eop")?.faceDown).toBe(true);
  });

  it("XG7-061: 【蠍座のスターピース】捨札にしたのがユニットカードなら捨札のまま（出典: atwiki/page-2410「オペレーションカードなら」）", () => {
    const s = resolveAll(piece(), ["SPEC-PLAIN:eun"]);
    expect(zoneOf(s, "player2", "SPEC-PLAIN:eun")).toBe("discard");
  });
});
