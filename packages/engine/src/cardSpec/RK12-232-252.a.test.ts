/**
 * カード別スペック: RK-232〜RK-238（ザ・マスクドライダーEXP vol.3 火焔大将〜キャッスルドラン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない
 *     （rider_1〜4・rider.html・card_*.html を「RK-232」〜「RK-238」で検索）。atwiki に転載された公式 Q&A（RK-238 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-05、R-BTL-02、R-KW-RESIST 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-232〜238 で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  accept,
  act,
  attack,
  attackUntilRegister,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  endTurn,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  releasedCat,
  resident,
  resolveAll,
  rushed,
  settle,
  skip,
  st,
  sUnit,
  toStartEnd,
  zoneOf,
} from "./RK12-232-252.helpers";

const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
/** 本来のカテゴリに MA を持ち、ナンバーを持たない S ユニット。 */
const MA_NONUM = sUnit("SPEC-MA-NONUM", { category: "MA", bp: 1000 });
const MA_CN1 = sUnit("SPEC-MA-CN1", { category: "MA", bp: 1000, comboNumber: 1 });
const MA_M = sUnit("SPEC-MA-M", { category: "MA", bp: 1000, size: "M" });
const MA_WB = sUnit("SPEC-MA-WB", { category: ["MA", "WB"], bp: 1000 } as never);
const WB_NONUM = sUnit("SPEC-WB-NONUM", { category: "WB", bp: 1000 });
const WB2000 = sUnit("SPEC-WB2000", { category: "WB", bp: 2000 });
const MA1000 = sUnit("SPEC-MA1000", { category: "MA", bp: 1000 });
const MA3000 = sUnit("SPEC-MA3000", { category: "MA", bp: 3000 });
const MA2000 = sUnit("SPEC-MA2000", { category: "MA", bp: 2000 });
const MA_M1000 = sUnit("SPEC-MA-M1000", { category: "MA", bp: 1000, size: "M" });
const WB1000 = sUnit("SPEC-WB1000", { category: "WB", bp: 1000 });
/** 特徴「警察」を持つ S ユニット。 */
const POLICE = sUnit("SPEC-POLICE", { category: "WB", bp: 1000, powerCost: 1, features: ["警察"] });
const NOPOLICE = sUnit("SPEC-NOPOLICE", { category: "WB", bp: 1000, powerCost: 1 });
const DA3000 = sUnit("SPEC-DA3000", { category: "DA", bp: 3000, powerCost: 5 });
const DA3500 = sUnit("SPEC-DA3500", { category: "DA", bp: 3500, powerCost: 1 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 1000, powerCost: 1, size: "M" });
const WB_LOW = sUnit("SPEC-WB-LOW", { category: "WB", bp: 1000, powerCost: 1 });
/** 特徴「仮面ライダー」を持つ S ユニット（BP3000・5000）。 */
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const RIDER5 = sUnit("SPEC-RIDER5", { category: "WB", bp: 5000, features: ["仮面ライダー"] });
const BP500 = sUnit("SPEC-BP500", { bp: 500 });
const EXTRA = [
  PLAIN_VEHICLE, C0, C1, C2, C3, M2, MA_NONUM, MA_CN1, MA_M, MA_WB, WB_NONUM, WB2000, MA1000, MA3000, MA2000, MA_M1000, WB1000,
  POLICE, NOPOLICE, DA3000, DA3500, DA_M, WB_LOW, KAMEN, RIDER5, BP500,
];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターン（バトルフェイズ）の盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, phase: GameState["phase"] = "battle") =>
  st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

/** 敵軍ターン中に、敵軍の RK-139 ゼロノスAF【俺はかーなーり強い】（RC）で自軍ラッシュエリアの id をバトルエリアに出させる。 */
function enteredInEnemyTurn(id: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  let s = enemyTurn({ rush: [inst(cid, suf)], ...p1 }, { ...p2, rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v"), ...(p2.rush ?? [])] });
  s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
  s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
  return pick(s, id);
}

// ===========================================================================
describe("RK-232 火焔大将", () => {
  const TEXT =
    "※これが自軍捨札にある間、自軍スタートフェイズ中、本来のカテゴリにMAを持ち、ナンバーを持たない自軍Sユニットがバトルエリアからラッシュエリアに戻るとき、自軍エリアに｢火焔大将｣がなければ、これをラッシュエリアに出してもよい。";

  it("RK-232: カタログ本文・スペックが出典と一致（出典: atwiki/page-949）", () => {
    expectCatalogText("RK-232", TEXT);
    expectStats("RK-232", { name: "火焔大将", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["魔化魍"] });
    expectRarityIn("RK-232", ["N"]);
  });

  /** 敵軍ターンの終わりから自軍のスタートフェイズに入り、バトルエリアのユニットを戻すところまで進める（火焔大将の選択は残す）。 */
  const started = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    toStartEnd(endTurn(enemyTurn({ battle: [inst("SPEC-MA-NONUM", "u")], discard: [inst("RK-232", "kd")], deck: deckCards(6), ...p1 })), "RK-232");

  it.fails("RK-232: ※ 自軍スタートフェイズに、本来のカテゴリに MA を持ちナンバーを持たない自軍 S ユニットがバトルエリアからラッシュエリアに戻るとき、捨札のこれをラッシュエリアに出すかを選べる（任意）（出典: atwiki/page-949「これをラッシュエリアに出してもよい」）", () => {
    const s = started();
    expect(zoneOf(s, "player1", "SPEC-MA-NONUM:u")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-232");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-232: ※ 出すことを選ぶと、捨札のこれが自軍ラッシュエリアに出る（出典: atwiki/page-949）", () => {
    const s = resolveAll(accept(started()));
    expect(zoneOf(s, "player1", "RK-232:kd")).toBe("rush");
  });

  it.fails("RK-232: ※ 出さないことも選べる（捨札に残る）（出典: atwiki/page-949「出してもよい」）", () => {
    const s = resolveAll(skip(started()));
    expect(zoneOf(s, "player1", "RK-232:kd")).toBe("discard");
  });

  it.fails("RK-232: ※ 本来のカテゴリが MA を含むマルチカテゴリ（MA・WB）のユニットでも出せる（出典: atwiki/page-949「本来のカテゴリにMAを持ち」）", () => {
    const s = started({ battle: [inst("SPEC-MA-WB", "u")] });
    expectChoiceFrom(s, "player1", "RK-232");
  });

  it("RK-232: ※ 戻るユニットがナンバーを持っていれば出せない（出典: atwiki/page-949「ナンバーを持たない」）", () => {
    const s = started({ battle: [inst("SPEC-MA-CN1", "u")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-232");
    expect(zoneOf(s, "player1", "RK-232:kd")).toBe("discard");
  });

  it("RK-232: ※ 戻るユニットの本来のカテゴリに MA がなければ出せない（出典: atwiki/page-949）", () => {
    const s = started({ battle: [inst("SPEC-WB-NONUM", "u")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-232");
  });

  it("RK-232: ※ 戻るユニットが M ユニットなら出せない（出典: atwiki/page-949「自軍Sユニットが」）", () => {
    const s = started({ battle: [inst("SPEC-MA-M", "u")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-232");
  });

  it("RK-232: ※ 自軍エリアに「火焔大将」があれば出せない（出典: atwiki/page-949「自軍エリアに｢火焔大将｣がなければ」）", () => {
    const s = started({ rush: [inst("RK-232", "other")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-232");
    expect(zoneOf(s, "player1", "RK-232:kd")).toBe("discard");
  });

  it("RK-232: ※ 敵軍のスタートフェイズに敵軍ユニットが戻っても出せない（出典: atwiki/page-949「自軍スタートフェイズ中」「自軍Sユニットが」）", () => {
    const s0 = board({ discard: [inst("RK-232", "kd")] }, { battle: [inst("SPEC-MA-NONUM", "e")] });
    const s = toStartEnd(endTurn(s0), "RK-232", "player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-232");
    expect(zoneOf(s, "player1", "RK-232:kd")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-233 仮面ライダーコーカサス", () => {
  const TEXT =
    "【ハイパーライダーキック】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒相手は1枚ドローしてから、自分自身の手札からカードを1枚選び、自分自身のパワーゾーンに置く。その後、相手の置いたカードの必要パワーの数字を見て、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("RK-233: カタログ本文・スペックが出典と一致（出典: atwiki/page-953）", () => {
    expectCatalogText("RK-233", TEXT);
    expectStats("RK-233", { name: "仮面ライダーコーカサス", category: "OT", size: "S", bp: 4000, sp: "1/4" as never, powerCost: 5, features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("RK-233", ["R"]);
  });

  const enemy = {
    hand: [inst("SPEC-C2", "h2"), inst("SPEC-C0", "h0")],
    battle: [inst("SPEC-C1", "b1"), inst("SPEC-C3", "b3")],
    rush: [inst("SPEC-M2", "m2"), inst("TST-UNIT-7", "l")],
    deck: deckCards(5, "e"),
  };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => enter(board({ rush: [inst("RK-233", "ck")] }, p2), "RK-233:ck");

  it.fails("RK-233: 【ハイパーライダーキック】自軍ターン中、バトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-953「次の効果を発動できる」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-233");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-233: 発動すると、相手は1枚ドローしてから、自分の手札（ドローしたカードを含む）から1枚選ぶ（選ばないことはできない）（出典: atwiki/page-953「相手は1枚ドローしてから、自分自身の手札からカードを1枚選び」）", () => {
    const s = accept(entered());
    expectChoiceFrom(s, "player2", "RK-233");
    expect(choiceIds(s)).toEqual(["SPEC-C0:h0", "SPEC-C2:h2", "TST-OP:e0"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-233: 相手が選んだカードは相手のパワーゾーンに置かれ、その必要パワーの数字（2）以下の必要パワーの数字を持つ敵軍ユニット（サイズ・エリアを問わない）から1体選ぶ（出典: atwiki/page-953「その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び」）", () => {
    const s = pick(accept(entered()), "SPEC-C2:h2");
    expect(zoneOf(s, "player2", "SPEC-C2:h2")).toBe("power");
    expectChoiceFrom(s, "player1", "RK-233");
    expect(choiceIds(s)).toEqual(["SPEC-C1:b1", "SPEC-M2:m2"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-233: 選んだ敵軍ユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-953「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(pick(accept(entered()), "SPEC-C2:h2"), "SPEC-M2:m2"));
    expect(zoneOf(s, "player2", "SPEC-M2:m2")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:b1")).toBe("battle");
  });

  it.fails("RK-233: 相手が必要パワー0のカードを置けば、必要パワーの数字が0の敵軍ユニットしか選べない（いなければ送らない）（出典: atwiki/page-953）", () => {
    const s = resolveAll(pick(accept(entered()), "SPEC-C0:h0"));
    expect(zoneOf(s, "player2", "SPEC-C0:h0")).toBe("power");
    expect(s.players.player2.battle).toHaveLength(2);
    expect(s.players.player2.rush).toHaveLength(2);
  });

  it.fails("RK-233: 「7+」の必要パワーは数字の 7 として比べる（出典: atwiki/page-953「必要パワーの数字」）", () => {
    const s = pick(accept(entered({ ...enemy, hand: [inst("TST-UNIT-7", "h7")] })), "TST-UNIT-7:h7");
    expect(choiceIds(s)).toEqual(["SPEC-C1:b1", "SPEC-C3:b3", "SPEC-M2:m2", "TST-UNIT-7:l"]);
  });

  it.fails("RK-233: 発動しなければ、相手はドローしない（出典: atwiki/page-953「発動できる」）", () => {
    const s = resolveAll(skip(entered()));
    expect(s.players.player2.hand).toHaveLength(2);
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RK-233: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-953「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-233:ck", {}, { hand: enemy.hand, battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-233:ck")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-233");
  });
});

// ===========================================================================
describe("RK-234 仮面ライダーケタロス", () => {
  const TEXT =
    "【ショルダータックル】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒敵軍バトルエリアからSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアに、戻したユニットの持つカテゴリを持たないユニットがあれば1体選び、戻したユニットとバトルさせる。";

  it("RK-234: カタログ本文・スペックが出典と一致（出典: atwiki/page-933）", () => {
    expectCatalogText("RK-234", TEXT);
    expectStats("RK-234", { name: "仮面ライダーケタロス", category: "OT", size: "S", bp: 2000, sp: "1/4" as never, powerCost: 4, features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("RK-234", ["NR"]);
  });

  const enemy = {
    battle: [inst("SPEC-WB2000", "w"), inst("SPEC-M2", "m")],
    rush: [inst("SPEC-MA1000", "ma"), inst("SPEC-WB1000", "wb"), inst("SPEC-MA-M1000", "mm"), inst("SPEC-MA3000", "big")],
  };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => enter(board({ rush: [inst("RK-234", "kt")] }, p2), "RK-234:kt");

  it.fails("RK-234: 【ショルダータックル】自軍ターン中、バトルエリアに出たとき、敵軍バトルエリアの S ユニット（M は対象外）から1体選んでラッシュエリアに戻すかを選べる（任意）（出典: atwiki/page-933「敵軍バトルエリアからSユニットを1体選び、敵軍ラッシュエリアに戻してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-234");
    expect(choiceIds(s)).toEqual(["SPEC-WB2000:w"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-234: 戻すと、敵軍ラッシュエリアの、戻したユニットのカテゴリ（WB）を持たないユニット（サイズを問わない）から1体選ぶ（出典: atwiki/page-933「戻したユニットの持つカテゴリを持たないユニットがあれば1体選び」）", () => {
    const s = pick(entered(), "SPEC-WB2000:w");
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-234");
    expect(choiceIds(s)).toEqual(["SPEC-MA-M1000:mm", "SPEC-MA1000:ma", "SPEC-MA3000:big"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-234: 選んだユニットと戻したユニットをバトルさせ、BP の低い方が撃破される（出典: atwiki/page-933「戻したユニットとバトルさせる」・R-BTL-02）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-WB2000:w"), "SPEC-MA1000:ma"));
    expect(zoneOf(s, "player2", "SPEC-MA1000:ma")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("rush");
  });

  it.fails("RK-234: 戻したユニットの方が BP が低ければ、戻したユニットが撃破される（出典: atwiki/page-933・R-BTL-02）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-WB2000:w"), "SPEC-MA3000:big"));
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MA3000:big")).toBe("rush");
  });

  it.fails("RK-234: BP が同じなら両方とも撃破される（出典: R-BTL-02）", () => {
    const s = resolveAll(pick(pick(entered({ ...enemy, rush: [inst("SPEC-MA2000", "eq")] }), "SPEC-WB2000:w"), "SPEC-MA2000:eq"));
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MA2000:eq")).toBe("discard");
  });

  it.fails("RK-234: 敵軍ラッシュエリアに戻したユニットのカテゴリを持たないユニットがなければ、戻すだけでバトルは起きない（出典: atwiki/page-933「…がなければ」・カード評価「相手が単色の場合は同士討ちを狙えない」）", () => {
    const s = resolveAll(pick(entered({ ...enemy, rush: [inst("SPEC-WB1000", "wb")] }), "SPEC-WB2000:w"));
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-WB1000:wb")).toBe("rush");
    expect(s.players.player2.discard).toHaveLength(0);
  });

  it("RK-234: 戻さないことも選べる（出典: atwiki/page-933「戻してもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player2", "SPEC-WB2000:w")).toBe("battle");
  });

  it("RK-234: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-933「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-234:kt", {}, { battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-234:kt")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-234");
  });
});

// ===========================================================================
describe("RK-235 仮面ライダーヘラクス", () => {
  const TEXT = "【アバランチクラッシュ】敵軍Sユニットの数が自軍Sユニットの数より3体以上多いとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("RK-235: カタログ本文・スペックが出典と一致（出典: atwiki/page-934）", () => {
    expectCatalogText("RK-235", TEXT);
    expectStats("RK-235", { name: "仮面ライダーヘラクス", category: "OT", size: "S", bp: 2000, sp: "1/4" as never, powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("RK-235", ["NR"]);
  });

  const four = { battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b")], rush: [inst("SPEC-C3", "c"), inst("SPEC-C1", "d"), inst("SPEC-M2", "m")] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = four) => rcRideOff(board({ rush: [inst("RK-235", "hx"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-235:hx", "SPEC-VEHICLE:v");

  it.fails("RK-235: 【アバランチクラッシュ】RC — 敵軍 S ユニット（4体）が自軍 S ユニット（これ1体）より3体以上多ければ、敵軍 S ユニット（エリアを問わない。M は対象外）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-934「敵軍Sユニットの数が自軍Sユニットの数より3体以上多いとき、敵軍Sユニットを1体選び」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-235");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:d", "SPEC-C2:b", "SPEC-C3:c"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-235: 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-934「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-C3:c"));
    expect(zoneOf(s, "player2", "SPEC-C3:c")).toBe("power");
  });

  it.fails("RK-235: 差が2体（敵軍 S 3体）なら発動しない（M ユニットは数えない）（出典: atwiki/page-934「3体以上多いとき」）", () => {
    const s = rc({ ...four, rush: [inst("SPEC-C3", "c"), inst("SPEC-M2", "m")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-235");
  });

  it.fails("RK-235: 自軍 S ユニットが増えれば、その分だけ多く必要になる（自軍2体・敵軍4体では発動しない）（出典: atwiki/page-934）", () => {
    const s = rcRideOff(board({ rush: [inst("RK-235", "hx"), inst("SPEC-VEHICLE", "v"), inst("SPEC-C1", "own")] }, four), "RK-235:hx", "SPEC-VEHICLE:v");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-235");
  });
});

// ===========================================================================
describe("RK-236 ネガタロス", () => {
  const TEXT =
    "【ネガタロス軍団（仮）結成の野望】これが自軍エリアにある間、敵軍ラッシュフェイズ中、特徴「警察」を持つ敵軍ユニットがラッシュされたとき、次の効果を発動できる⇒自分の手札からDAを持つBP3000以下のSユニットのカードを1枚選び、ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。";

  it("RK-236: カタログ本文・スペックが出典と一致（出典: atwiki/page-950）", () => {
    expectCatalogText("RK-236", TEXT);
    expectStats("RK-236", { name: "ネガタロス", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, features: ["イマジン"] });
    expectRarityIn("RK-236", ["N"]);
  });

  const HAND = [inst("SPEC-DA3000", "ok"), inst("SPEC-DA3500", "hi"), inst("SPEC-DA-M", "m"), inst("SPEC-WB-LOW", "wb")];
  /** 敵軍（player2）のラッシュフェイズに、敵軍が手札の id をラッシュする。 */
  const enemyRush = (id = "SPEC-POLICE:p", p1: Partial<GameState["players"]["player1"]> = { rush: [inst("RK-236", "ng")] }) =>
    rushed(enemyTurn({ hand: HAND, ...p1 }, { hand: [inst(id.split(":")[0]!, id.split(":")[1]!)], command: releasedCat("WB", 1), power: powerCards(3, "ep") }, "rush"), id, "player2");

  it.fails("RK-236: 【ネガタロス軍団（仮）結成の野望】敵軍ラッシュフェイズ中、特徴「警察」を持つ敵軍ユニットがラッシュされたとき、手札の DA・BP3000 以下の S ユニットのカード（BP3500・M・WB は対象外）から1枚選べる（任意）（出典: atwiki/page-950「自分の手札からDAを持つBP3000以下のSユニットのカードを1枚選び、ラッシュエリアに出してもよい」）", () => {
    const s = enemyRush();
    expect(zoneOf(s, "player2", "SPEC-POLICE:p")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-236");
    expect(choiceIds(s)).toEqual(["SPEC-DA3000:ok"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-236: 選んだカードは自軍ラッシュエリアに出る（必要パワーは満たさなくてよい）（出典: atwiki/page-950「ラッシュエリアに出してもよい。ただし、追加条件は満たすこと」）", () => {
    const s = resolveAll(pick(enemyRush(), "SPEC-DA3000:ok"));
    expect(zoneOf(s, "player1", "SPEC-DA3000:ok")).toBe("rush");
  });

  it.fails("RK-236: 出さないことも選べる（出典: atwiki/page-950「発動できる」「出してもよい」）", () => {
    const s = resolveAll(skip(enemyRush()));
    expect(zoneOf(s, "player1", "SPEC-DA3000:ok")).toBe("hand");
  });

  it("RK-236: ラッシュされた敵軍ユニットが特徴「警察」を持たなければ発動しない（出典: atwiki/page-950「特徴「警察」を持つ敵軍ユニットが」）", () => {
    const s = enemyRush("SPEC-NOPOLICE:p");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-236");
  });

  it.fails("RK-236: これがバトルエリアにあっても発動する（出典: atwiki/page-950「これが自軍エリアにある間」）", () => {
    const s = enemyRush("SPEC-POLICE:p", { battle: [inst("RK-236", "ng")] });
    expectChoiceFrom(s, "player1", "RK-236");
  });

  it("RK-236: これが手札にあるときは発動しない（出典: atwiki/page-950「これが自軍エリアにある間」）", () => {
    const s = enemyRush("SPEC-POLICE:p", { hand: [...HAND, inst("RK-236", "ng")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-236");
  });

  it("RK-236: 自軍ラッシュフェイズに自軍の「警察」をラッシュしても発動しない（出典: atwiki/page-950「敵軍ラッシュフェイズ中、」「敵軍ユニットが」）", () => {
    const s0 = st({ phase: "rush", player1: { rush: [inst("RK-236", "ng")], hand: [...HAND, inst("SPEC-POLICE", "p")], command: releasedCat("WB", 1), power: powerCards(3), deck: deckCards(5) } }, EXTRA);
    const s = rushed(s0, "SPEC-POLICE:p");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-236");
  });

  it.todo("RK-236: 追加条件を持つ DA・BP3000 以下の S ユニットのカードは、追加条件を満たせなければ選べない（出典: atwiki/page-950「ただし、追加条件は満たすこと」）— 本範囲の確認に使える、追加条件を持つ DA・BP3000 以下の S ユニットの組み合わせを決めていない（エンジンは startEffectRush の requireConditions で判定する）");
});

// ===========================================================================
describe("RK-237 仮面ライダーキバBF", () => {
  const TEXT =
    "【バッシャー・アクアトルネード】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、常駐しているオペレーションを1つ選び、選んだオペレーションを持ち主の山札に戻してシャッフルする。";

  it("RK-237: カタログ本文・スペックが出典と一致（出典: atwiki/page-940）", () => {
    expectCatalogText("RK-237", TEXT);
    expectStats("RK-237", { name: "仮面ライダーキバBF", category: "MA", size: "S", bp: 2000, sp: "1/3" as never, powerCost: 5, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("RK-237", ["NR"]);
  });

  const residents = { p1: [resident("RK-249", "own")], p2: [resident("RK-001", "kz")] };
  const entered = (p1Ops = residents.p1, p2Ops = residents.p2) =>
    enter(board({ rush: [inst("RK-237", "bf")], operation: p1Ops }, { operation: p2Ops }), "RK-237:bf");

  it.fails("RK-237: 【バッシャー・アクアトルネード】自軍ターン中、バトルエリアに出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-940「このユニットをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-237");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-237: ホールドすると、常駐しているオペレーション（自軍・敵軍とも）から1つ選ぶ（選ばないことはできない）（出典: atwiki/page-940「そうしたとき、常駐しているオペレーションを1つ選び」）", () => {
    const s = accept(entered());
    expect(cardIn(s, "player1", "RK-237:bf")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-237");
    expect(choiceIds(s)).toEqual(["RK-001:kz", "RK-249:own"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-237: 選んだオペレーションは持ち主の山札に戻る（敵軍の常駐は敵軍の山札へ）（出典: atwiki/page-940「選んだオペレーションを持ち主の山札に戻してシャッフルする」）", () => {
    const s = resolveAll(pick(accept(entered()), "RK-001:kz"));
    expect(zoneOf(s, "player2", "RK-001:kz")).toBe("deck");
    expect(s.players.player2.deck).toHaveLength(6);
    expect(zoneOf(s, "player1", "RK-249:own")).toBe("operation");
  });

  it.fails("RK-237: ホールドしなければ常駐は残る（出典: atwiki/page-940「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(cardIn(s, "player1", "RK-237:bf")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player2", "RK-001:kz")).toBe("operation");
  });

  it("RK-237: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-940「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-237:bf", { operation: residents.p1 }, { operation: residents.p2 });
    expect(zoneOf(s, "player1", "RK-237:bf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-237");
  });
});

// ===========================================================================
describe("RK-238 キャッスルドラン", () => {
  const TEXT =
    "※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。 【魂の捕獲】これが自軍エリアにある間、特徴「仮面ライダー」を持つユニットがユニットを撃破して捨札にしたとき、その特徴「仮面ライダー」を持つユニットの持ち主は1枚ドローしてもよい。";

  it("RK-238: カタログ本文・スペックが出典と一致（出典: atwiki/page-941）", () => {
    expectCatalogText("RK-238", TEXT);
    expectStats("RK-238", { name: "キャッスルドラン", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: 1, features: ["獣", "ドラゴン"] });
    expectRarityIn("RK-238", ["N"]);
  });

  it("RK-238: ※ 自軍コマンドが1つしかホールドできなければバトルエリアに出られない（出典: atwiki/page-941「自軍コマンドを2つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-238", "cd")], command: releasedCat("MA", 1) }), "RK-238:cd")).toBe(false);
  });

  it("RK-238: ※ 自軍コマンドを2つホールドしてバトルエリアに出られる（出典: atwiki/page-941）", () => {
    const s0 = board({ rush: [inst("RK-238", "cd")], command: releasedCat("MA", 2) });
    expect(canEnter(s0, "RK-238:cd")).toBe(true);
    const s = enterHold(s0, "RK-238:cd");
    expect(zoneOf(s, "player1", "RK-238:cd")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  /** 自軍の特徴「仮面ライダー」を持つユニット（BP3000）で敵軍の BP1000 のユニットにアタックして撃破する（ドローの選択は残す）。 */
  const ownKill = (p1: Partial<GameState["players"]["player1"]> = { rush: [inst("RK-238", "cd")] }, p2: Partial<GameState["players"]["player2"]> = {}) =>
    settle(attack(board({ battle: [inst("SPEC-KAMEN", "k")], ...p1 }, { battle: [inst("SPEC-C1", "e")], ...p2 }), "SPEC-KAMEN:k", "SPEC-C1:e"));

  it.fails("RK-238: 【魂の捕獲】特徴「仮面ライダー」を持つ自軍ユニットがバトルで敵軍ユニットを撃破して捨札にしたとき、自分は1枚ドローするかを選べる（任意）（出典: atwiki/page-941「その特徴「仮面ライダー」を持つユニットの持ち主は1枚ドローしてもよい」）", () => {
    const s = ownKill();
    expect(zoneOf(s, "player2", "SPEC-C1:e")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-238");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-238: ドローを選ぶと1枚ドローする（出典: atwiki/page-941）", () => {
    const s = resolveAll(confirm(ownKill()));
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it.fails("RK-238: ドローしないことも選べる（出典: atwiki/page-941「ドローしてもよい」）", () => {
    const s = resolveAll(skip(ownKill()));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.fails("RK-238: 敵軍の「仮面ライダー」が自軍ユニットを撃破したときは、相手（その仮面ライダーの持ち主）がドローするかを選べる（出典: atwiki/page-941「その特徴「仮面ライダー」を持つユニットの持ち主は」・カード評価「相手も恩恵を受ける」）", () => {
    let s = enemyTurn({ rush: [inst("RK-238", "cd")], battle: [inst("SPEC-C1", "mine")] }, { battle: [inst("SPEC-KAMEN", "ek")] });
    s = settle(attack(s, "SPEC-KAMEN:ek", "SPEC-C1:mine", "player2"));
    expect(zoneOf(s, "player1", "SPEC-C1:mine")).toBe("discard");
    expectChoiceFrom(s, "player2", "RK-238");
    s = resolveAll(confirm(s));
    expect(s.players.player2.hand).toHaveLength(1);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.fails("RK-238: キャッスルドランが敵軍エリアにあっても、自軍の「仮面ライダー」が撃破すれば自分がドローできる（出典: atwiki/page-941「これが自軍エリアにある間」（キャッスルドランの持ち主から見て）・「その…ユニットの持ち主は」）", () => {
    const s = ownKill({}, { rush: [inst("RK-238", "cd")] });
    expectChoiceFrom(s, "player1", "RK-238");
  });

  it("RK-238: 撃破したユニットが特徴「仮面ライダー」を持たなければドローしない（出典: atwiki/page-941）", () => {
    const s = settle(attack(board({ battle: [inst("TST-UNIT-7", "big")], rush: [inst("RK-238", "cd")] }, { battle: [inst("SPEC-C1", "e")] }), "TST-UNIT-7:big", "SPEC-C1:e"));
    expect(zoneOf(s, "player2", "SPEC-C1:e")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-238");
  });

  it("RK-238: 撃破されたユニットがレジストで場に留まった（捨札にならなかった）ときはドローしない（出典: atwiki/page-941「撃破して捨札にしたとき」・R-KW-RESIST）", () => {
    let s = attackUntilRegister({ battle: [inst("RK-245", "kb")] }, "RK-245:kb", { battle: [inst("SPEC-RIDER5", "r")], rush: [inst("RK-238", "cd")] }, "SPEC-RIDER5:r", EXTRA);
    s = act(s, { type: "use_register", playerId: "player1" } as never);
    s = settle(s);
    expect(zoneOf(s, "player1", "RK-245:kb")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-238");
  });

  it("RK-238: キャッスルドランが場になければドローしない（出典: atwiki/page-941「これが自軍エリアにある間」）", () => {
    const s = ownKill({ hand: [inst("RK-238", "cd")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-238");
  });

  // atwiki/page-941 Q1「いいえ、できません。【スカイキック】等の効果に書かれた「BP0以下になったユニットは撃破される」とはルールの補足であり、
  // 「XG4-087 スカイライダー」がユニットを撃破したとは扱われません。」
  it.todo(
    "RK-238: 公式Q&A — XG4-087 スカイライダー【スカイキック】で BP0 以下になって撃破されたユニットは、スカイライダーが撃破したことにならないのでドローできない（出典: atwiki/page-941 Q1）— XG4-087【スカイキック】の BP-500 が未実装（本範囲外のカード。RK1-001-021.b の RK-012 Q7 と同じ）で、BP0 以下にする場面を作れない",
  );

  it.todo(
    "RK-238: 特徴「仮面ライダー」を持つユニットが効果（「撃破する」と書かれたテキスト）で撃破したときもドローできる（出典: atwiki/page-941・grnrngr/faq-rider-1 RK-005 Q（撃破を行う起点は「撃破する」と直接書かれているテキストの持ち主））— エンジンが効果による撃破の起点のユニットを記録していない（RK-005 の効果による撃破と同じ未対応）",
  );
});

// 使っていない import の警告を避ける。
void legal;
