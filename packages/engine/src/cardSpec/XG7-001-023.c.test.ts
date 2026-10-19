/**
 * カード別スペック: XG7-017〜XG7-023（クロスギャザー ザ・ベストパートナー ゴーオンレッド〜獣拳巨神サイダイオー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない（「XG7-」とカード名で検索）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CROSS・R-KW-TAKUS・R-KW-WING・R-KW-RESIST・R-KW-BREAKER・R-ADD-06 合体）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG7-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマル」を SR／R／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attack,
  attackUntilRegister,
  bpOf,
  breakerTests,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  crossTests,
  deckCards,
  deckOf,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  extraHoldTests,
  inst,
  lastBattleBps,
  legal,
  mountedOn,
  ncBoard,
  p1Battle,
  passEntry,
  pick,
  pickAs,
  powerCards,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOffOffered,
  rushFromHand,
  rushPhaseOf,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  takusTests,
  vehicleCard,
  wingTests,
  zoneOf,
} from "./XG7-001-023.helpers";

const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const CAR = vehicleCard("SPEC-CAR", { features: ["車両"], category: "OT" });
const CAR_COND = vehicleCard("SPEC-CAR-COND", { features: ["車両"], category: "OT", rushAdditionalCondition: { conditionId: "hold_extra_command", text: "追加で自軍コマンドを1つホールドする", unitCount: 1 } } as never);
const MECHA_V = vehicleCard("SPEC-MECHA-V", { features: ["メカ"] });
const RED_WB = sUnit("SPEC-RED-WB", { category: "WB", bp: 1000, powerCost: 0, features: ["レッド"] });
const PLAIN_WB = sUnit("SPEC-PLAIN-WB", { category: "WB", bp: 1000, powerCost: 0 });
const NINJA = sUnit("SPEC-NINJA", { category: "MA", bp: 1000, powerCost: 0, features: ["忍者"] });
const PLAIN_MA = sUnit("SPEC-PLAIN-MA", { category: "MA", bp: 1000, powerCost: 0 });
const C2 = sUnit("SPEC-C2", { category: "WB", bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const C3P = sUnit("SPEC-C3P", { category: "WB", bp: 1000, powerCost: "3+" });
const C2M = sUnit("SPEC-C2M", { category: "WB", bp: 3000, size: "M", powerCost: 2 });
const EXTRA = [ENEMY, CAR, CAR_COND, MECHA_V, RED_WB, PLAIN_WB, NINJA, PLAIN_MA, C2, C3, C3P, C2M];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG7-017 ゴーオンレッド", () => {
  const TEXT =
    "※これは特徴「車両」を持つビークルにライドできる。【マッハ全開！】自軍ターン中、これがバトルエリアに出るとき、これがライドしていなければ、次の効果を発動できる⇒自分の手札から特徴「車両」を持ち追加条件を持たないビークルカードを1枚選び自軍ラッシュエリアに出してから、これをライドさせる。そうしたとき、このターン、これはライドオフできない。";

  it("XG7-017: カタログ本文・スペックが出典と一致（出典: atwiki/page-2417）", () => {
    expectCatalogText("XG7-017", TEXT);
    expectUnitStats("XG7-017", { name: "ゴーオンレッド", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["レッド", "男"] });
    expectRarityIn("XG7-017", ["N"]);
  });

  it("XG7-017: ※ 特徴「車両」を持つビークルにライドできる（特徴「メカ」だけのビークルにはできない）（出典: atwiki/page-2417「※これは特徴「車両」を持つビークルにライドできる」）", () => {
    expect(canMount(p1Battle({ rush: [inst("XG7-017", "r"), inst("SPEC-CAR", "v")] }, {}, EXTRA), "XG7-017:r", "SPEC-CAR:v")).toBe(true);
    expect(canMount(p1Battle({ rush: [inst("XG7-017", "r"), inst("SPEC-MECHA-V", "v")] }, {}, EXTRA), "XG7-017:r", "SPEC-MECHA-V:v")).toBe(false);
  });

  const mach = () => enter(p1Battle({ rush: [inst("XG7-017", "r")], hand: [inst("SPEC-CAR", "h"), inst("SPEC-CAR-COND", "hc"), inst("SPEC-MECHA-V", "hm")] }, {}, EXTRA), "XG7-017:r");

  it.fails("XG7-017: 【マッハ全開！】自軍ターン中、ライドせずにバトルエリアに出るとき、手札の特徴「車両」を持ち追加条件を持たないビークルカードから1枚選べる（任意）（出典: atwiki/page-2417「自分の手札から特徴「車両」を持ち追加条件を持たないビークルカードを1枚選び」） — 既知の不具合: CARD-XG7-017 【マッハ全開！】が未実装（バトルエリアに出るとき手札のビークルを出してライドする選択が開かない）", () => {
    const s = mach();
    expectChoiceFrom(s, "player1", "XG7-017");
    expect(choiceIds(s)).toEqual(["SPEC-CAR:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-017: 【マッハ全開！】選んだビークルを出し、これをライドさせる（出典: atwiki/page-2417「自軍ラッシュエリアに出してから、これをライドさせる」） — 既知の不具合: CARD-XG7-017 【マッハ全開！】が未実装（バトルエリアに出るとき手札のビークルを出してライドする選択が開かない）", () => {
    const s = resolveAll(mach(), ["SPEC-CAR:h"]);
    expect(zoneOf(s, "player1", "SPEC-CAR:h")).not.toBe("hand");
    expect(mountedOn(s, "player1", "XG7-017:r")).toBe("SPEC-CAR:h");
  });

  it("XG7-017: 【マッハ全開！】そうしたとき、このターン、これはライドオフできない（出典: atwiki/page-2417「このターン、これはライドオフできない」）", () => {
    const s = resolveAll(mach(), ["SPEC-CAR:h"]);
    expect(rideOffOffered(s)).toBe(false);
  });
});

// ===========================================================================
describe("XG7-018 シンケンレッド", () => {
  const TEXT = "※レジスト 【影武者】これが自軍エリアにある間、特徴「レッド」を持つユニットがラッシュされたとき、これを捨札にする。";

  it("XG7-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-2403）", () => {
    expectCatalogText("XG7-018", TEXT);
    expectUnitStats("XG7-018", { name: "シンケンレッド", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 1, comboNumber: undefined, features: ["レッド", "男", "侍"] });
    expectRarityIn("XG7-018", ["N"]);
  });

  it("XG7-018: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2403「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG7-018", "sk")] }, "XG7-018:sk"))).toBe(true);
  });

  const rushedBy = (unit: string, who: "player1" | "player2" = "player1") => {
    const mine = { rush: [inst("XG7-018", "sk")] };
    const theirs = { hand: [inst(unit, "h")], command: releasedCat("WB", 1), power: powerCards(1) };
    const s =
      who === "player1"
        ? rushPhaseOf({ ...mine, ...theirs }, {}, EXTRA)
        : st({ phase: "rush", activePlayer: "player2", player1: { deck: deckCards(5), ...mine }, player2: { deck: deckCards(5, "e"), ...theirs } }, EXTRA);
    const r = rushFromHand(s, who, `${unit}:h`);
    expect(r.ok, r.error).toBe(true);
    return resolveAll(r.state);
  };

  it.fails("XG7-018: 【影武者】これが自軍エリアにある間、特徴「レッド」を持つユニットがラッシュされたとき、これを捨札にする（出典: atwiki/page-2403「これを捨札にする」） — 既知の不具合: CARD-XG7-018 【影武者】が未実装（「レッド」のユニットがラッシュされても捨札にならない）", () => {
    expect(zoneOf(rushedBy("SPEC-RED-WB"), "player1", "XG7-018:sk")).toBe("discard");
  });

  it.fails("XG7-018: 【影武者】相手が特徴「レッド」を持つユニットをラッシュしたときも捨札になる（出典: atwiki/page-2403「特徴「レッド」を持つユニットが」（自軍・敵軍の限定がない）・カード評価「相手が特徴「レッド」持ちをラッシュしても除去されてしまう」） — 既知の不具合: CARD-XG7-018 【影武者】が未実装（「レッド」のユニットがラッシュされても捨札にならない）", () => {
    expect(zoneOf(rushedBy("SPEC-RED-WB", "player2"), "player1", "XG7-018:sk")).toBe("discard");
  });

  it("XG7-018: 【影武者】特徴「レッド」を持たないユニットのラッシュでは残る（出典: atwiki/page-2403）", () => {
    expect(zoneOf(rushedBy("SPEC-PLAIN-WB"), "player1", "XG7-018:sk")).toBe("rush");
  });

  it("XG7-018: 【影武者】これ自身をラッシュしたときは捨札にならない（出典: atwiki/page-2403 カード評価「他のレッドが登場すると捨札になる」）", () => {
    const r = rushFromHand(rushPhaseOf({ hand: [inst("XG7-018", "sk")], command: releasedCat("MA", 1), power: powerCards(1) }, {}, EXTRA), "player1", "XG7-018:sk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG7-018:sk")).toBe("rush");
  });
});

// ===========================================================================
describe("XG7-019 ゴセイレッド×ゴセイピンク", () => {
  const TEXT =
    "※クロス1 ※ウイング 【スカイコンビブレイク】このターン、自軍ユニットは、ウイングでアタックしたとき、そのバトル中、BP+2000される。（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）";

  it("XG7-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-2385）", () => {
    expectCatalogText("XG7-019", TEXT);
    expectUnitStats("XG7-019", { name: "ゴセイレッド×ゴセイピンク", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: "2+", comboNumber: 1, features: ["レッド", "ピンク", "男", "女"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-019", ["N"]);
  });

  crossTests("XG7-019", "atwiki/page-2385");
  wingTests("XG7-019", "atwiki/page-2385");
  extraHoldTests("XG7-019", ["MA"], "2+", "atwiki/page-2385");

  const wingAttack = (s0: GameState, wing: string) => {
    let s = act(passEntry(resolveAll(s0)), { type: "hold_for_wing", playerId: "player1", instanceId: wing });
    s = settle(attack(s, wing, "SPEC-ENEMY:e"));
    return lastBattleBps(s)?.attacker;
  };

  it.fails("XG7-019: 【スカイコンビブレイク】NC（1番目）— このターン、自軍ユニット（XG7-011 ハリケンレッド）はウイングでアタックしたバトル中 BP+2000（3000→5000）（出典: atwiki/page-2385「このターン、自軍ユニットは、ウイングでアタックしたとき、そのバトル中、BP+2000される」） — 既知の不具合: CARD-XG7-019 【スカイコンビブレイク】が未実装（ウイングでアタックしたときの BP+2000 が付かない）", () => {
    expect(wingAttack(nc("XG7-019:gs", 0, { rush: [inst("XG7-011", "w")] }, { battle: [inst("SPEC-ENEMY", "e")] }), "XG7-011:w")).toBe(5000);
  });

  it("XG7-019: NC にならなければ（2番目）ウイングでアタックしても上がらない（出典: atwiki/page-2385「CN：1」）", () => {
    expect(wingAttack(nc("XG7-019:gs", 1, { rush: [inst("XG7-011", "w")] }, { battle: [inst("SPEC-ENEMY", "e")] }), "XG7-011:w")).toBe(3000);
  });

  it.fails("XG7-019: 【スカイコンビブレイク】これ自身がウイングでアタックするときはナンバーに関係なく発動し、BP5000 でバトルする（出典: atwiki/page-2385「（この効果はこれがウイングでアタックするときナンバーに関係なく発動する）」・カード評価「これ自身がウイングでアタックする際のBPは【スカイコンビブレイク】の修正を受けた値になる」） — 既知の不具合: CARD-XG7-019 【スカイコンビブレイク】が未実装（ウイングでアタックしたときの BP+2000 が付かない）", () => {
    expect(wingAttack(p1Battle({ rush: [inst("XG7-019", "gs")] }, { battle: [inst("SPEC-ENEMY", "e")] }, EXTRA), "XG7-019:gs")).toBe(5000);
  });
});

// ===========================================================================
describe("XG7-020 クワガライジャー×カブトライジャー", () => {
  const TEXT =
    "※クロス1 ※タクスMA 【影に向かいて影を斬り、光に向かいて光を斬る】 これが自分の手札にある間、クロスを持たない特徴「忍者」を持つ敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。そうしたとき、そのユニットを持ち主の山札に戻してシャッフルする。";

  it("XG7-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-2435）", () => {
    expectCatalogText("XG7-020", TEXT);
    expectUnitStats("XG7-020", { name: "クワガライジャー×カブトライジャー", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: "1+", comboNumber: undefined, features: ["男", "忍者"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-020", ["R"]);
  });

  crossTests("XG7-020", "atwiki/page-2435");
  takusTests("XG7-020", "MA", "atwiki/page-2435");
  extraHoldTests("XG7-020", ["MA"], "1+", "atwiki/page-2435");

  /** 敵軍（player2）ラッシュフェイズに、敵軍が unit を手札からラッシュした直後（反応はパスしない）。 */
  const enemyRushes = (unit: string, extraCmd: CardInstance[] = []) => {
    let s = st(
      { phase: "rush", activePlayer: "player2", player1: { hand: [inst("XG7-020", "kk")], deck: deckCards(5) }, player2: { hand: [inst(unit, "h")], command: [...releasedCat("MA", 1), ...extraCmd], power: powerCards(1), deck: deckCards(5, "e") } },
      EXTRA,
    );
    s = act(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: `${unit}:h` } as GameAction);
    return s;
  };
  const offers = (s: GameState) =>
    legal(s).filter((a) => a.playerId === "player1" && JSON.stringify(a).includes("XG7-020:kk"));

  it.fails("XG7-020: 【影に向かいて…】手札にある間、クロスを持たない特徴「忍者」の敵軍 S ユニットがラッシュされたとき、これを自軍ラッシュエリアに出せる（任意）（出典: atwiki/page-2435「これを自軍ラッシュエリアに出してもよい」） — 既知の不具合: CARD-XG7-020 【影に向かいて影を斬り…】が未実装（敵軍の「忍者」がラッシュされても手札から出す手段がない）", () => {
    const s = enemyRushes("SPEC-NINJA");
    expect(offers(s).length > 0 || s.pendingEffectChoice?.sourceCardId === "XG7-020").toBe(true);
  });

  it.fails("XG7-020: 【影に向かいて…】出したとき、そのユニットを持ち主の山札に戻す（出典: atwiki/page-2435「そうしたとき、そのユニットを持ち主の山札に戻してシャッフルする」） — 既知の不具合: CARD-XG7-020 【影に向かいて影を斬り…】が未実装（敵軍の「忍者」がラッシュされても手札から出す手段がない）", () => {
    let s = enemyRushes("SPEC-NINJA");
    const o = offers(s)[0];
    if (o) s = act(s, o);
    else if (s.pendingEffectChoice?.sourceCardId === "XG7-020") s = pickAs(s, "player1", s.pendingEffectChoice.validInstanceIds[0]!);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG7-020:kk")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-NINJA:h")).toBe("deck");
  });

  it.todo("XG7-020: 【影に向かいて…】戻したあと持ち主の山札をシャッフルする（出典: atwiki/page-2435「持ち主の山札に戻してシャッフルする」）— シャッフルの結果は乱数で、公開 API から確かめる手段がない");

  it("XG7-020: 【影に向かいて…】特徴「忍者」を持たない敵軍ユニットのラッシュでは出せない（出典: atwiki/page-2435）", () => {
    const s = enemyRushes("SPEC-PLAIN-MA");
    expect(offers(s)).toHaveLength(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-020");
  });

  it("XG7-020: 【影に向かいて…】クロスを持つ「忍者」（XG7-020 自身と同じカード）のラッシュでは出せない（出典: atwiki/page-2435「クロスを持たない」）", () => {
    const s = enemyRushes("XG7-020", releasedCat("MA", 1, "x"));
    expect(offers(s)).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG7-021 デカピンク×デカイエロー", () => {
  const TEXT =
    "※クロス1 【ガールズ・イン・トラブル！】SP1 自軍パワーゾーンからSユニットのカードを1枚選び、手札に加えてもよい。そうしたとき、相手は、自分自身のパワーゾーンから、そのカードと同じ必要パワーの数字を持つSユニットのカードを1枚選び、手札に加える。";

  it("XG7-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-2389）", () => {
    expectCatalogText("XG7-021", TEXT);
    expectUnitStats("XG7-021", { name: "デカピンク×デカイエロー", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: "4+", comboNumber: 4, features: ["イエロー", "ピンク", "女", "警察"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-021", ["R"]);
  });

  crossTests("XG7-021", "atwiki/page-2389");
  extraHoldTests("XG7-021", ["OT"], "4+", "atwiki/page-2389");

  const girls = () =>
    nc("XG7-021:dk", 3, { power: [inst("SPEC-C2", "own2"), inst("SPEC-C2M", "ownm"), ...powerCards(2)] }, { power: [inst("SPEC-C2", "e2"), inst("SPEC-C3", "e3"), inst("SPEC-C2M", "em"), ...powerCards(1, "ep")] });

  it.fails("XG7-021: 【ガールズ・イン・トラブル！】「SP1」— NC（4番目）で SP1（出典: atwiki/page-2389「SP：！」「SP1」） — 既知の不具合: CARD-XG7-021 【ガールズ・イン・トラブル！】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    expect(spOf(resolveAll(girls()), "player1", "XG7-021:dk")).toBe(1);
  });

  it.fails("XG7-021: 【ガールズ・イン・トラブル！】NC — 自軍パワーゾーンの S ユニットのカードから1枚選べる（任意。M・ユニット以外は選べない）（出典: atwiki/page-2389「自軍パワーゾーンからSユニットのカードを1枚選び、手札に加えてもよい」） — 既知の不具合: CARD-XG7-021 【ガールズ・イン・トラブル！】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    const s = girls();
    expectChoiceFrom(s, "player1", "XG7-021");
    expect(choiceIds(s)).toEqual(["SPEC-C2:own2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-021: 【ガールズ・イン・トラブル！】選んだカードは手札へ。相手は自分のパワーゾーンの、同じ必要パワーの数字（2）を持つ S ユニットのカードを1枚選び手札に加える（見送れない）（出典: atwiki/page-2389「相手は、自分自身のパワーゾーンから、そのカードと同じ必要パワーの数字を持つSユニットのカードを1枚選び、手札に加える」） — 既知の不具合: CARD-XG7-021 【ガールズ・イン・トラブル！】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    let s = pick(girls(), "SPEC-C2:own2");
    expect(zoneOf(s, "player1", "SPEC-C2:own2")).toBe("hand");
    expectChoiceFrom(s, "player2", "XG7-021");
    expect(choiceIds(s)).toEqual(["SPEC-C2:e2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("hand");
  });
});

// ===========================================================================
describe("XG7-022 マジピンク×マジブルー", () => {
  const TEXT =
    "※クロス1 ※これは「マジマーメイド＋マジフェアリー」としてつかえる。【トゥインクルイリュージョン】SP1 自軍山札の上から1枚をオモテにしてから手札に加える。そうしたとき、そのカードと同じ必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の上に戻してもよい。";

  it("XG7-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-2390）", () => {
    expectCatalogText("XG7-022", TEXT);
    expectUnitStats("XG7-022", { name: "マジピンク×マジブルー", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: "3+", comboNumber: 3, features: ["ブルー", "ピンク", "女", "魔法"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-022", ["R"]);
  });

  crossTests("XG7-022", "atwiki/page-2390");
  extraHoldTests("XG7-022", ["MA"], "3+", "atwiki/page-2390");

  it("XG7-022: ※「マジマーメイド＋マジフェアリー」としてつかえる — RS-056 マジドラゴン（マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス）の2体分にできる（出典: atwiki/page-2390・カード評価「マジキングやマジドラゴンの合体素材に使える」）", () => {
    const three = ["RS-058", "XG7-022", "RS-061"].map((id) => inst(id, "m"));
    const s = rushPhaseOf({ hand: [inst("RS-056", "k")], rush: three, command: releasedCat("MA", 2), power: powerCards(6) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "RS-056:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-056:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-022:m")).toBe("discard");
  });

  const twinkle = (top: CardInstance) =>
    nc("XG7-022:mp", 2, { deck: [top, ...deckCards(3)] }, { battle: [inst("SPEC-C2", "b2"), inst("SPEC-C3", "b3"), inst("SPEC-C2M", "m2")], rush: [inst("SPEC-C2", "r2")], deck: deckCards(3, "e") });

  it.fails("XG7-022: 【トゥインクルイリュージョン】「SP1」— NC（3番目）で SP1（出典: atwiki/page-2390「SP：！」「SP1」） — 既知の不具合: CARD-XG7-022 【トゥインクルイリュージョン】が未実装（NC で SP1 にならず、山札の上を手札に加えない）", () => {
    expect(spOf(resolveAll(twinkle(inst("SPEC-C2", "top"))), "player1", "XG7-022:mp")).toBe(1);
  });

  it.fails("XG7-022: 【トゥインクルイリュージョン】山札の上の1枚をオモテにして手札に加え、同じ必要パワー（2）の敵軍 S ユニット（エリアを問わない。M は選べない）から1体選べる（任意）（出典: atwiki/page-2390「自軍山札の上から1枚をオモテにしてから手札に加える。そうしたとき、そのカードと同じ必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の上に戻してもよい」） — 既知の不具合: CARD-XG7-022 【トゥインクルイリュージョン】が未実装（NC で SP1 にならず、山札の上を手札に加えない）", () => {
    const s = twinkle(inst("SPEC-C2", "top"));
    expect(zoneOf(s, "player1", "SPEC-C2:top")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG7-022");
    expect(choiceIds(s)).toEqual(["SPEC-C2:b2", "SPEC-C2:r2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-022: 【トゥインクルイリュージョン】選んだユニットを持ち主の山札の上に戻す（出典: atwiki/page-2390） — 既知の不具合: CARD-XG7-022 【トゥインクルイリュージョン】が未実装（NC で SP1 にならず、山札の上を手札に加えない）", () => {
    const s = resolveAll(twinkle(inst("SPEC-C2", "top")), ["SPEC-C2:b2"]);
    expect(deckOf(s, "player2")[0]).toBe("SPEC-C2:b2");
  });
});

// ===========================================================================
describe("XG7-023 獣拳巨神サイダイオー", () => {
  const TEXT =
    "※ブレイカー 【大大砕大斬】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、選んだユニットがリリース状態ならホールドする。その後、選んだユニットとこのユニットでバトルする。";

  it("XG7-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-2453）", () => {
    expectCatalogText("XG7-023", TEXT);
    expectUnitStats("XG7-023", { name: "獣拳巨神サイダイオー", category: ["WB", "MA"], size: "XL", bp: 13000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["拳聖", "激気", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG7-023", ["SR"]);
  });

  breakerTests("XG7-023", "atwiki/page-2453", EXTRA, { breaker_select: "ブレイカーを持たない敵軍ユニットの効果（RS-155【鋼の角】）の候補から外れない" });

  it("XG7-023: 追加条件 — 自軍「獣拳神サイダイン」1体を捨札にしてラッシュする（出典: atwiki/page-2453「追加条件：自軍「獣拳神サイダイン」1体を捨札にする」）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-023", "sd")], rush: [inst("XG7-024", "sn")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG7-023:sd");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-023:sd")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-024:sn")).toBe("discard");
  });

  it("XG7-023: 追加条件 — 自軍「獣拳神サイダイン」がいなければラッシュできない（出典: atwiki/page-2453）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-023", "sd")], command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], power: powerCards(5) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG7-023:sd")).toBe(false);
  });

  const enterSd = (enemy: CardInstance[]) => enter(p1Battle({ rush: [inst("XG7-023", "sd")] }, { battle: enemy }, EXTRA), "XG7-023:sd");

  it("XG7-023: 【大大砕大斬】自軍ターン中、バトルエリアに出たとき、敵軍バトルエリアのユニットから1体選べる（任意）（出典: atwiki/page-2453「敵軍バトルエリアからユニットを1体選んでもよい」）", () => {
    const s = enterSd([inst("SPEC-ENEMY", "e"), { ...inst("SPEC-C2M", "h"), commandHeld: true }]);
    expectChoiceFrom(s, "player1", "XG7-023");
    expect(choiceIds(s)).toEqual(["SPEC-C2M:h", "SPEC-ENEMY:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-023: 【大大砕大斬】選んだユニットがリリース状態ならホールドし、その後このユニットとバトルする（BP13000 で撃破）（出典: atwiki/page-2453「選んだユニットがリリース状態ならホールドする。その後、選んだユニットとこのユニットでバトルする」） — 既知の不具合: CARD-XG7-023 【大大砕大斬】が選んだユニットをコマンドゾーンへ送り（「ホールドする」を hold_command として処理）、バトルしない", () => {
    const s = resolveAll(enterSd([inst("SPEC-ENEMY", "e")]), ["SPEC-ENEMY:e"]);
    expect(lastBattleBps(s)).toEqual({ attacker: 13000, defender: 1000 });
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe("discard");
  });

  it.fails("XG7-023: 【大大砕大斬】ホールドされた敵軍ユニット（※レジストを持つ RK-214）はレジストでその場に留められず撃破される（出典: atwiki/page-2453 カード評価「【大大砕大斬】はレジストを潰してからバトルできる」・R-KW-RESIST） — 既知の不具合: CARD-XG7-023 【大大砕大斬】が選んだユニットをコマンドゾーンへ送り、バトルしない", () => {
    let s = enterSd([inst("RK-214", "ln")]);
    if (s.pendingEffectChoice?.sourceCardId === "XG7-023") s = pick(s, "RK-214:ln");
    let offered = false;
    for (let i = 0; i < 10; i++) {
      if (registerOffered(s, "player2")) offered = true;
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction" || a.type === "pass_strike_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(offered).toBe(false);
    expect(zoneOf(resolveAll(s), "player2", "RK-214:ln")).toBe("discard");
  });

  it("XG7-023: 【大大砕大斬】選ばなければバトルしない（出典: atwiki/page-2453「選んでもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(enterSd([inst("SPEC-ENEMY", "e")])));
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-ENEMY:e")?.commandHeld ?? false).toBe(false);
  });
});

void bpOf;
void takusTests;
