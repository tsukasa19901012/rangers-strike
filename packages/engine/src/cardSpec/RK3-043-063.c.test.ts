/**
 * カード別スペック: RK-057〜RK-063（ザ・マスクドライダーEXP vol.1 仮面ライダーザビーRF〜仮面ライダー龍騎）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-057・RK-058・RK-061 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし。
 *     RK-063 は RK-033 と同じ page-178（スターター版））
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-04/05、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマル」を SR／N として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-057 Q1（勝鬼【風牙】で相手は自分のザビーRF を選べる）— cardSpec/RK3-043-063.a.test.ts RK-049
 *  - RK-057 を RS-205 リュウレンジャー等で選べない — cardSpec/RS4-201-221.a.test.ts・RS5-327-347.b.test.ts
 *  - RK-058 と RK-031 の BP0 撃破・RC の順 — rulesSpec/05-bp-strike-damage.test.ts R-BP-02
 *  - RK-058 に RC なしの仮面ライダーがライドしたあとダークウイングで特徴を失ってもライドオフしない — cardSpec/RK2-022-042.b.test.ts RK-035
 *  - RK-059 のデッキ枚数（好きな枚数）— rulesSpec/01-overview-deck.test.ts R-DECK-03
 *  - RK-061 をライダーパスで置き換える手順 — cardSpec/RS5-audit-crossref.test.ts RK-022
 *  - RK-062 のパワーを捨札にして1枚につき BP+1000・しなくてもよい — set6AuditOutOfRange.test.ts
 *  - RK-063 と RK-033（同名）の枚数制限 — rulesSpec/01-overview-deck.test.ts R-DECK-02/04
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  damageOf,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  inst,
  lastBattleBps,
  legal,
  mount,
  mountedOn,
  p1Battle,
  passEntry,
  pick,
  playOp,
  powerCards,
  rcUnit,
  releasedCat,
  resolveAll,
  rideOff,
  rideOffOffered,
  ridingPair,
  rushFromHand,
  rushOffered,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK3-043-063.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const EM5000 = sUnit("SPEC-EM5000", { bp: 5000, size: "M" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "OT", bp: 2000, features: ["仮面ライダー", "男"] });
const KAMEN_M = sUnit("SPEC-KAMEN-M", { category: "OT", bp: 2000, size: "M", features: ["仮面ライダー", "男"] });
const MALE = sUnit("SPEC-MALE", { category: "OT", bp: 2000, features: ["男"] });
const RC = rcUnit("SPEC-RC", { bp: 1500 });
const CN1 = sUnit("SPEC-CN1", { bp: 2000, comboNumber: 1 });
const CN2 = sUnit("SPEC-CN2", { bp: 2000, comboNumber: 2 });
const CN1_M = sUnit("SPEC-CN1-M", { bp: 2000, comboNumber: 1, size: "M" });
const MINUS = sUnit("SPEC-MINUS", { bp: 10000, powerCost: "7-" });
const MINUS7 = sUnit("SPEC-MINUS7", { bp: 7000, powerCost: "7-" });
const E7000 = sUnit("SPEC-E7000", { bp: 7000 });
const DRAGON = sUnit("SPEC-DRAGON", { category: "WB", bp: 2000, features: ["ドラゴン"] });
const DRAGON_RC = rcUnit("SPEC-DRAGON-RC", { category: "WB", bp: 2000, features: ["ドラゴン"] });
const EXTRA = [E2000, E3500, E4000, EM5000, KAMEN, KAMEN_M, MALE, RC, CN1, CN2, CN1_M, MINUS, MINUS7, E7000, DRAGON, DRAGON_RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** mount_ride の合法手があるか。 */
const canMount = (s: GameState, rider: string, vehicle: string) =>
  legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === vehicle);

// ===========================================================================
describe("RK-057 仮面ライダーザビーRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ライダースティング】これをラッシュしたとき、敵軍バトルエリアからBP4000以上のSユニットを1体選び持ち主のパワーゾーンに置く。";

  it("RK-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-161）", () => {
    expectCatalogText("RK-057", TEXT);
    expectStats("RK-057", {
      name: "仮面ライダーザビーRF",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: "1/4",
      powerCost: "3+",
      features: ["仮面ライダー", "男", "加速"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-057", ["N"]);
  });

  const rushRf = (rush: ReturnType<typeof inst>[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushFromHand(rushPhase({ hand: [inst("RK-057", "rf")], rush, power: powerCards(3), command: releasedCat("OT", 1) }, p2), "player1", "RK-057:rf");

  it("RK-057: 追加条件 — 自軍「仮面ライダーザビーMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-161「自軍「仮面ライダーザビーMF」1体をパワーゾーンに送る」）", () => {
    const r = rushRf([inst("RK-056", "mf")]);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-057:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-056:mf")).toBe("power");
  });

  it("RK-057: 追加条件 — ザビーMF 以外の S ユニットでは満たせない（出典: atwiki/page-161）", () => {
    const s = rushPhase({ hand: [inst("RK-057", "rf")], rush: [inst("SPEC-KAMEN", "k")], power: powerCards(3), command: releasedCat("OT", 1) });
    expect(rushOffered(s, "RK-057:rf")).toBe(false);
  });

  it("RK-057: 【ライダースティング】ラッシュしたとき、敵軍バトルエリアの BP4000 以上の S ユニットを1体選び、持ち主のパワーゾーンに置く（出典: atwiki/page-161）", () => {
    const r = rushRf([inst("RK-056", "mf")], { battle: [inst("SPEC-E4000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-EM5000", "m")] });
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    expectChoiceFrom(s, "player1", "RK-057");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:a"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E4000:a"));
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E4000:a")?.faceDown ?? false).toBe(false);
  });

  it("RK-057: 【ライダースティング】条件に合うユニットがいなければ何もしない（出典: atwiki/page-161）", () => {
    const r = rushRf([inst("RK-056", "mf")], { battle: [inst("SPEC-E3500", "b")] });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-057");
    expect(zoneOf(settle(r.state), "player2", "SPEC-E3500:b")).toBe("battle");
  });

  // 公式 Q「はい、対象になります。条件を満たしているものが自動的に対象になるような効果…の場合は、プレイヤーが対象を「選ぶ」ということを行わないので…」
  it("RK-057: 公式Q&A — 選ばずにすべてを対象にする効果（敵軍オートバジンBM【バスターホイール】）は受ける（出典: grnrngr/faq-rider-1 RK-057 Q・atwiki/page-161 Q2）", () => {
    expect(bpOf(board({ battle: [inst("RK-046", "bm")] }, { battle: [inst("RK-057", "rf")] }), "player2", "RK-057:rf")).toBe(500);
  });

  it.todo(
    "RK-057: 公式Q&A — 捨札・パワーゾーンにあるときも「相手に選ばれない」が有効か（出典: grnrngr/faq-rider-1 RK-057 Q「いいえ。…パワーゾーンやコマンドゾーンにあるカードは…有効ではない」と、atwiki/page-161 Q3（公式回答の転載）「オモテ向きのゾーン・捨札では常に有効」）— 公式の回答どうしが食い違い、日付がなくどちらが新しいか決められないため保留",
  );
});

// ===========================================================================
describe("RK-058 マシンゼクトロン", () => {
  const TEXT = "※これにライドしているユニットはBP+500される。 ※特徴「仮面ライダー」を持つ自軍Sユニットは、ＲＣを持っていなくてもこのビークルにライドできる。";

  it("RK-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-162）", () => {
    expectCatalogText("RK-058", TEXT);
    expectVehicleStats("RK-058", { name: "マシンゼクトロン", category: "OT", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-058", ["N"]);
  });

  it("RK-058: ※ これにライドしているユニットは BP+500 される（出典: atwiki/page-162）", () => {
    expect(bpOf(board({ battle: ridingPair("SPEC-RC", "u", "RK-058", "v") }), "player1", "SPEC-RC:u")).toBe(2000);
  });

  it("RK-058: ※ 特徴「仮面ライダー」を持つ自軍 S ユニットは RC がなくてもライドできる（出典: atwiki/page-162）", () => {
    const s = board({ rush: [inst("SPEC-KAMEN", "k"), inst("RK-058", "v")] });
    expect(canMount(s, "SPEC-KAMEN:k", "RK-058:v")).toBe(true);
    const t = settle(mount(s, "SPEC-KAMEN:k", "RK-058:v"));
    expect(zoneOf(t, "player1", "SPEC-KAMEN:k")).toBe("battle");
    expect(mountedOn(t, "player1", "SPEC-KAMEN:k")).toBe("RK-058:v");
    expect(bpOf(t, "player1", "SPEC-KAMEN:k")).toBe(2500);
  });

  it("RK-058: ※ RC も特徴「仮面ライダー」もないユニット・M ユニットはライドできない（出典: atwiki/page-162「特徴「仮面ライダー」を持つ自軍Sユニットは」）", () => {
    const s = board({ rush: [inst("SPEC-MALE", "m"), inst("SPEC-KAMEN-M", "km"), inst("RK-058", "v")] });
    expect(canMount(s, "SPEC-MALE:m", "RK-058:v")).toBe(false);
    expect(canMount(s, "SPEC-KAMEN-M:km", "RK-058:v")).toBe(false);
  });

  it("RK-058: ※ RC のない仮面ライダーがライドできるのはこのビークルだけ（ほかのビークルにはライドできない）（出典: atwiki/page-162「このビークルにライドできる」）", () => {
    const s = board({ rush: [inst("SPEC-KAMEN", "k"), inst("RK-045", "vm")] });
    expect(canMount(s, "SPEC-KAMEN:k", "RK-045:vm")).toBe(false);
  });

  // 公式 Q1「はい、できます。」
  it("RK-058: 公式Q&A — RC を持たずにライドしたユニットもライドオフできる（RC はないので何も発動しない）（出典: grnrngr/faq-rider-1 RK-058 Q1・atwiki/page-162 Q1）", () => {
    const s = mount(board({ rush: [inst("SPEC-KAMEN", "k"), inst("RK-058", "v")] }), "SPEC-KAMEN:k", "RK-058:v");
    expect(rideOffOffered(s)).toBe(true);
    const t = settle(rideOff(s, true));
    expect(mountedOn(t, "player1", "SPEC-KAMEN:k")).toBeUndefined();
    expect(zoneOf(t, "player1", "SPEC-KAMEN:k")).toBe("battle");
    expect(t.pendingEffectChoice).toBeUndefined();
  });

  // 公式 Q2「「RK-013 Jパワー」の対象に選んだ「RK-027 仮面ライダーBLACK」は、ユニットでなくなるまで「RK-013 Jパワー」の上に重ねたまま扱います…」
  it("RK-058: 公式Q&A — ライド中のユニットに J パワーを使うと、重なるのはユニットだけで、ライド状態のまま（出典: grnrngr/faq-rider-1 RK-058 Q2・atwiki/page-162 Q2）", () => {
    const s0 = rushPhase({ hand: [inst("RK-013", "jp")], rush: ridingPair("SPEC-RC", "u", "RK-058", "v"), command: releasedCat("MA", 1), power: powerCards(4) });
    const r = playOp(s0, "player1", "RK-013:jp");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["SPEC-RC:u"]);
    expect((cardIn(s, "player1", "SPEC-RC:u")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-013:jp"]);
    expect(mountedOn(s, "player1", "SPEC-RC:u")).toBe("RK-058:v");
    expect(zoneOf(s, "player1", "RK-058:v")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-059 ゼクトルーパー", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【フォーメーションα】これが自軍バトルエリアにある間、敵軍ターン中、カードに表記された本来のナンバーが自軍バトルエリアの「ゼクトルーパー」の数と同じ敵軍Sユニットは、バトルエリアに出られない。";

  it("RK-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-159）", () => {
    expectCatalogText("RK-059", TEXT);
    expectStats("RK-059", { name: "ゼクトルーパー", category: "OT", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["男", "戦闘員"] });
    expectRarityIn("RK-059", ["N"]);
  });

  it("RK-059: 【フォーメーションα】自軍バトルエリアに1体なら、敵軍ターン中、ナンバー1の敵軍 S ユニットはバトルエリアに出られない（ナンバー2は出られる）（出典: atwiki/page-159）", () => {
    const s = enemyTurn({ battle: [inst("RK-059", "z1")] }, { rush: [inst("SPEC-CN1", "a"), inst("SPEC-CN2", "b")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(false);
    expect(canEnter(s, "SPEC-CN2:b", "player2")).toBe(true);
  });

  it("RK-059: 【フォーメーションα】2体なら、ナンバー2の敵軍 S ユニットが出られなくなり、ナンバー1は出られる（出典: atwiki/page-159「自軍バトルエリアの「ゼクトルーパー」の数と同じ」）", () => {
    const s = enemyTurn({ battle: [inst("RK-059", "z1"), inst("RK-059", "z2")] }, { rush: [inst("SPEC-CN1", "a"), inst("SPEC-CN2", "b")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(true);
    expect(canEnter(s, "SPEC-CN2:b", "player2")).toBe(false);
  });

  it("RK-059: 【フォーメーションα】M ユニット・ナンバーが数字でない（RC）ユニットは制限されない（出典: atwiki/page-159「…敵軍Sユニットは」）", () => {
    const s = enemyTurn({ battle: [inst("RK-059", "z1")] }, { rush: [inst("SPEC-CN1-M", "m"), inst("SPEC-RC", "r")] });
    expect(canEnter(s, "SPEC-CN1-M:m", "player2")).toBe(true);
    expect(canEnter(s, "SPEC-RC:r", "player2")).toBe(true);
  });

  it("RK-059: 【フォーメーションα】ゼクトルーパーがラッシュエリアにあるときは効かない（出典: atwiki/page-159「これが自軍バトルエリアにある間」）", () => {
    const s = enemyTurn({ rush: [inst("RK-059", "z1")] }, { rush: [inst("SPEC-CN1", "a")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(true);
  });

  it("RK-059: 【フォーメーションα】自軍のユニットは制限されない（出典: atwiki/page-159「敵軍Sユニットは」）", () => {
    const s = board({ battle: [inst("RK-059", "z1")], rush: [inst("SPEC-CN1", "a")] });
    expect(canEnter(s, "SPEC-CN1:a")).toBe(true);
  });
});

// ===========================================================================
describe("RK-060 デンライナーゴウカ", () => {
  const TEXT = "【戦闘モード】これは必要パワーの数字に「－」のあるユニットにアタックするときBP+5000される。";

  it("RK-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-135）", () => {
    expectCatalogText("RK-060", TEXT);
    expectStats("RK-060", {
      name: "デンライナーゴウカ",
      category: "OT",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-060", ["N"]);
  });

  it("RK-060: 追加条件 — 自軍 S ユニットを1体パワーゾーンに送ってラッシュできる（出典: atwiki/page-135「自軍Sユニットを1体パワーゾーンに送る」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-060", "g")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(5), command: releasedCat("OT", 1) }), "player1", "RK-060:g");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-060:g")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:u")).toBe("power");
  });

  it("RK-060: 【戦闘モード】必要パワーの数字に「－」のあるユニットにアタックするとき BP+5000（11000対10000で勝つ）（出典: atwiki/page-135）", () => {
    let s = board({ battle: [inst("RK-060", "g")] }, { battle: [inst("SPEC-MINUS", "x")] });
    s = resolveAll(attack(s, "RK-060:g", "SPEC-MINUS:x"));
    expect(lastBattleBps(s)?.attacker).toBe(11000);
    expect(zoneOf(s, "player2", "SPEC-MINUS:x")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-060:g")).toBe("battle");
  });

  it("RK-060: 【戦闘モード】必要パワーに「－」のないユニットにアタックするときは BP+5000 されない（6000対7000で負ける）（出典: atwiki/page-135「必要パワーの数字に「－」のあるユニットに」）", () => {
    let s = board({ battle: [inst("RK-060", "g")] }, { battle: [inst("SPEC-E7000", "x")] });
    s = resolveAll(attack(s, "RK-060:g", "SPEC-E7000:x"));
    expect(lastBattleBps(s)?.attacker).toBe(6000);
    expect(zoneOf(s, "player1", "RK-060:g")).toBe("discard");
  });

  it("RK-060: 【戦闘モード】「－」のあるユニットにアタックされるときは BP+5000 されない（出典: atwiki/page-135「アタックするとき」）", () => {
    let s = enemyTurn({ battle: [inst("RK-060", "g")] }, { battle: [inst("SPEC-MINUS7", "x")] });
    s = resolveAll(attack(s, "SPEC-MINUS7:x", "RK-060:g", "player2"));
    expect(zoneOf(s, "player1", "RK-060:g")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-061 仮面ライダー電王RF", () => {
  const TEXT = "【一本釣り】敵軍パワーゾーンのダメージ以外のカードから、Sユニットのカードを1枚選び、敵軍バトルエリアに出してもよい。このとき出したユニットの効果は発動しない。";

  it("RK-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-166）", () => {
    expectCatalogText("RK-061", TEXT);
    expectStats("RK-061", { name: "仮面ライダー電王RF", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-061", ["N"]);
  });

  /** RK-061 をマシンゼクトロンにライドさせて出し、ライドオフする（RC の選択は残す）。 */
  const fishing = (p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rideOff(mount(board({ rush: [inst("RK-061", "rf"), inst("RK-058", "v")], ...p1 }, p2), "RK-061:rf", "RK-058:v"), true);

  it("RK-061: RC — 敵軍パワーゾーンのダメージ以外の S ユニットのカードを1枚選べる（M ユニット・オペレーション・ダメージは選べない。任意）（出典: atwiki/page-166）", () => {
    const s = fishing({ power: [inst("SPEC-E2000", "p"), inst("SPEC-EM5000", "m"), inst("TST-OP", "op"), { ...inst("SPEC-E4000", "d"), faceDown: true }] });
    expectChoiceFrom(s, "player1", "RK-061");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:p"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-061: 選んだカードは敵軍バトルエリアに出る（出典: atwiki/page-166「敵軍バトルエリアに出してもよい」）", () => {
    const s = resolveAll(pick(fishing({ power: [inst("SPEC-E2000", "p"), ...powerCards(2, "ep")] }), "SPEC-E2000:p"));
    expect(zoneOf(s, "player2", "SPEC-E2000:p")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(2);
  });

  it("RK-061: 出さなくてもよい（出典: atwiki/page-166「出してもよい」）", () => {
    const s = resolveAll(skip(fishing({ power: [inst("SPEC-E2000", "p")] })));
    expect(zoneOf(s, "player2", "SPEC-E2000:p")).toBe("power");
  });

  it("RK-061: 出したユニットの効果は発動しない（CN1 のパンチホッパーを1番目に出しても NC は発動しない）（出典: atwiki/page-166「このとき出したユニットの効果は発動しない」）", () => {
    const s = resolveAll(pick(fishing({ power: [inst("RK-055", "ph")] }, { battle: [inst("SPEC-E2000", "own")] }), "RK-055:ph"));
    expect(zoneOf(s, "player2", "RK-055:ph")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-E2000:own")).toBe("battle");
  });

  it("RK-061: ライドしないで出たときは RC が発動しない（出典: atwiki/page-166・R-KW-RC-01）", () => {
    const s = settle(enter(board({ rush: [inst("RK-061", "rf")] }, { power: [inst("SPEC-E2000", "p")] }), "RK-061:rf"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-061");
  });

  // 公式 Q1「いいえ、できません。正しく処理を実行できないものを対象に選ぶことはできません。」
  it("RK-061: 公式Q&A — 「ラッシュしたターンにバトルエリアに出られない」カード（オートバジンBM）は選べない（出典: grnrngr/faq-rider-1 RK-061 Q1・atwiki/page-166 Q1）", () => {
    const s = fishing({ power: [inst("RK-046", "bm"), inst("SPEC-E2000", "p")] });
    expect(choiceIds(s)).toEqual(["SPEC-E2000:p"]);
  });

  // 公式 Q2「はい、その通りです。ただし、敵軍ラッシュエリアに特徴「仮面ライダー」を持つユニットが1体もなければ…バトルエリアに出すことはできません。」
  it("RK-061: 公式Q&A — アナザーアギトは、敵軍ラッシュエリアに特徴「仮面ライダー」のユニットがなければ選べない（出典: grnrngr/faq-rider-1 RK-061 Q2・atwiki/page-166 Q2）", () => {
    const s = fishing({ power: [inst("RK-032", "aa"), inst("SPEC-E2000", "p")], rush: [inst("SPEC-MALE", "m")] });
    expect(choiceIds(s)).toEqual(["SPEC-E2000:p"]);
  });

  it("RK-061: 公式Q&A — 敵軍ラッシュエリアに「仮面ライダー」がいればアナザーアギトを選べ、相手はそのユニットを1体捨札にする（出典: grnrngr/faq-rider-1 RK-061 Q2・atwiki/page-166 Q2）", () => {
    let s = fishing({ power: [inst("RK-032", "aa")], rush: [inst("SPEC-KAMEN", "k")] });
    expect(choiceIds(s)).toEqual(["RK-032:aa"]);
    s = resolveAll(pick(s, "RK-032:aa"), ["SPEC-KAMEN:k"]);
    expect(zoneOf(s, "player2", "RK-032:aa")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-KAMEN:k")).toBe("discard");
  });

  it.todo(
    "RK-061: 公式Q&A — 敵軍パワーゾーンにオモテ向きの仮面ライダーカブトRF（RK-065「相手に選ばれない」）は選べない（出典: atwiki/page-166 Q3（公式回答の転載）と、grnrngr/faq-rider-1 RK-054・RK-057 欄「パワーゾーンやコマンドゾーンにあるカードは…有効ではない」）— 公式の回答どうしが食い違い、どちらが新しいか決められないためユーザーの判断待ち（エンジンは現状「選べない」のまま。RK-065 側の同じ問いは cardSpec/RK4-064-084.a.test.ts）",
  );
});

// ===========================================================================
describe("RK-062 仮面ライダー電王AF", () => {
  const TEXT =
    "【ダイナミックチョップ】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンのダメージ以外のカードを好きな枚数捨札にしてもよい。そうしたとき、このターン、これは捨札にしたカード1枚につきBP+1000される";

  it("RK-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-167）", () => {
    expectCatalogText("RK-062", TEXT);
    expectStats("RK-062", { name: "仮面ライダー電王AF", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-062", ["N"]);
  });

  it("RK-062: BP+1000 は「このターン」だけ — 敵軍ターンには元の BP4000 に戻る（出典: atwiki/page-167「このターン、これは捨札にしたカード1枚につきBP+1000される」）", () => {
    let s = enter(board({ rush: [inst("RK-062", "af")], power: [...powerCards(3), ...damageCards(1)] }), "RK-062:af");
    s = confirm(pick(pick(s, "TST-P:pw0"), "TST-P:pw1"));
    expect(bpOf(settle(s), "player1", "RK-062:af")).toBe(6000);
    s = endTurn(passEntry(settle(s)));
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "RK-062:af")).toBe(4000);
  });
});

// ===========================================================================
describe("RK-063 仮面ライダー龍騎", () => {
  const TEXT = "【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」";

  it("RK-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-178（スターター版））", () => {
    expectCatalogText("RK-063", TEXT);
    expectStats("RK-063", { name: "仮面ライダー龍騎", category: "WB", size: "S", bp: 4000, sp: "special", powerCost: 6, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-063", ["SR"]);
  });

  it("RK-063: 特徴「ドラゴン」を持つユニットの次に出ると「SP1」を得て、ストライクで1点与える（出典: atwiki/page-178・R-CN-05）", () => {
    let s = enter(board({ battle: [inst("SPEC-DRAGON", "d")], rush: [inst("RK-063", "r")] }), "RK-063:r");
    expect(canStrike(s, "RK-063:r")).toBe(true);
    s = settle(strike(s, "RK-063:r"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-063: ドラグレッダー（特徴「ドラゴン」）からのコンビネーションでも「SP1」を得る（出典: atwiki/page-178・page-179）", () => {
    const s = enter(board({ battle: [inst("RK-034", "d")], rush: [inst("RK-063", "r")] }), "RK-063:r");
    expect(spOf(s, "player1", "RK-063:r")).toBe(1);
  });

  it("RK-063: 直前がビークルにライドした「ドラゴン」のユニットでも、ビークルを飛ばしてコンビネーションする（出典: atwiki/page-178・R-CN-04/05）", () => {
    const s = enter(board({ battle: ridingPair("SPEC-DRAGON-RC", "d", "RK-058", "v"), rush: [inst("RK-063", "r")] }), "RK-063:r");
    expect(spOf(s, "player1", "RK-063:r")).toBe(1);
  });

  it("RK-063: 「ドラゴン」以外のユニットの次に出たときは「SP！」のままでストライクできない（出典: atwiki/page-178「SP：！」）", () => {
    const s = enter(board({ battle: [inst("SPEC-DRAGON", "d"), inst("TST-UNIT-0", "x")], rush: [inst("RK-063", "r")] }), "RK-063:r");
    expect(canStrike(s, "RK-063:r")).toBe(false);
  });

  it("RK-063: 1番目に出たとき（コンビネーションの相手がいない）はストライクできない（出典: atwiki/page-178「ユニットからコンビネーションするとき」）", () => {
    const s = enter(board({ rush: [inst("RK-063", "r")] }), "RK-063:r");
    expect(canStrike(s, "RK-063:r")).toBe(false);
  });
});

// 未使用の import を避けるための参照。
void act;
