/**
 * カード別スペック: PK-001〜PK-007（プロモーションカード 仮面ライダー龍騎〜モモタロス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「PK-」とカード名で検索:
 *     PK の項はない（card_plomo は PR- のカードだけ）。同じ本文のカードの項（rider_2 RK-142 Q1〜Q3）は元のカードの照合で済んでいる。
 *     atwiki の PK のカードページに転載された公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PK-NNN.md。本範囲のライブ写し pages/N.txt は page-962 だけ）
 *  3. docs/rules/*.md の一般ルール（R-CN-05・R-KW-RC-01・R-DECK-02/03 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PK-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションカード」を PR として照合する。
 *
 * 本範囲のカードは、元のカードと効果名・イラストだけが違う（atwiki カード評価「能力名が…から…になっている」）か、同じ本文の再録。
 * 元のカード（RK-033・RK-059・RK-066・RK-060・RK-142）の照合と同じ内容を、PK の ID で確かめ直す。
 * 元のカードの公式 Q&A（RK-142 Q1・Q2 など）は元のカードの照合（cardSpec/RK7-127-147.c 等）で済んでいるので重ねない。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  battleBoard,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  dragonComboTests,
  enemyBattle,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceUpPower,
  fill,
  inst,
  lastBattleBps,
  nextPhase,
  pick,
  powerCards,
  rcRideOff,
  releasedCat,
  resolveAll,
  rushBoardWith,
  rushFromHand,
  settle,
  shadowMoonTests,
  skip,
  spOf,
  strike,
  sUnit,
  zoneOf,
} from "./PROMO1-PK-SK.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E7000 = sUnit("SPEC-E7000", { bp: 7000 });
const CN1 = sUnit("SPEC-CN1", { bp: 2000, comboNumber: 1 });
const CN2 = sUnit("SPEC-CN2", { bp: 2000, comboNumber: 2 });
const CN1_M = sUnit("SPEC-CN1-M", { bp: 2000, comboNumber: 1, size: "M" });
const RC = sUnit("SPEC-RC", { bp: 1500, comboNumber: "RC" });
const MINUS = sUnit("SPEC-MINUS", { bp: 10000, powerCost: "7-" });
const MINUS7 = sUnit("SPEC-MINUS7", { bp: 7000, powerCost: "7-" });
const COST1 = sUnit("SPEC-COST1", { bp: 1000, powerCost: 1 });
const COST3 = sUnit("SPEC-COST3", { bp: 1000, powerCost: 3 });
const COST5 = sUnit("SPEC-COST5", { bp: 1000, powerCost: 5 });
const COST3_M = sUnit("SPEC-COST3-M", { bp: 1000, powerCost: 3, size: "M" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "OT", bp: 1000, sp: "1/4" as never, features: ["仮面ライダー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "OT", bp: 1000, sp: "1/4" as never, features: ["男"] });
const EXTRA = [E2000, E7000, CN1, CN2, CN1_M, RC, MINUS, MINUS7, COST1, COST3, COST5, COST3_M, KAMEN, PLAIN, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => battleBoard(EXTRA, p1, p2);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBattle(EXTRA, p1, p2);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("PK-001 仮面ライダー龍騎", () => {
  dragonComboTests("PK-001", "ドラゴクロー", "atwiki/page-960", "（効果名【ドラゴクロー】が RK-033 の【ドラゴンライダーキック】と違うため、「ドラゴン」からのコンビネーションで「SP1」を得ない。RK-033 は同じ盤面で得る）");

  it("PK-001: 同名カードの枚数制限 — 「仮面ライダー龍騎」は PK-001・PK-003・RK-033 を合わせて3枚まで（4枚はデッキに入れられない）（出典: R-DECK-02・atwiki/page-960 カード評価「能力名が…から【ドラグクロー】になっている」（同じカード名の別版））", () => {
    expect(validateDeckEntries([{ cardId: "PK-001", count: 2 }, { cardId: "RK-033", count: 2 }]).errors.some((e) => e.includes("枚まで"))).toBe(true);
    expect(validateDeckEntries([{ cardId: "PK-001", count: 1 }, { cardId: "PK-003", count: 1 }, { cardId: "RK-033", count: 1 }]).errors.some((e) => e.includes("枚まで"))).toBe(false);
  });
});

// ===========================================================================
describe("PK-002 ゼクトルーパー", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【フォーメーションα】これが自軍バトルエリアにある間、敵軍ターン中、カードに表記された本来のナンバーが自軍バトルエリアの「ゼクトルーパー」の数と同じ敵軍Sユニットは、バトルエリアに出られない。";

  it("PK-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-962・pages/962.txt）", () => {
    expectCatalogText("PK-002", TEXT);
    expectStats("PK-002", { name: "ゼクトルーパー", category: "OT", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["男", "戦闘員"] });
    expectRarityIn("PK-002", ["PR"]);
  });

  it("PK-002: ※ デッキに好きな枚数入れてもよい（40枚すべてでもよい。RK-059 と合わせても制限なし）（出典: atwiki/page-962「※このカードはデッキに好きな枚数入れてもよい。」・R-DECK-03）", () => {
    expect(validateDeckEntries([{ cardId: "PK-002", count: 40 }]).ok).toBe(true);
    expect(validateDeckEntries([{ cardId: "PK-002", count: 20 }, { cardId: "RK-059", count: 20 }]).ok).toBe(true);
  });

  it("PK-002: 【フォーメーションα】自軍バトルエリアに1体なら、敵軍ターン中、ナンバー1の敵軍 S ユニットはバトルエリアに出られない（ナンバー2は出られる）（出典: atwiki/page-962）", () => {
    const s = enemyTurn({ battle: [inst("PK-002", "z1")] }, { rush: [inst("SPEC-CN1", "a"), inst("SPEC-CN2", "b")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(false);
    expect(canEnter(s, "SPEC-CN2:b", "player2")).toBe(true);
  });

  it("PK-002: 【フォーメーションα】PK-002 と RK-059 が1体ずつなら「ゼクトルーパー」は2体と数え、ナンバー2の敵軍 S ユニットが出られなくなる（出典: atwiki/page-962「自軍バトルエリアの「ゼクトルーパー」の数と同じ」・atwiki/page-962 カード評価「ゲーム上では特にこの２枚には違いは無い」）", () => {
    const s = enemyTurn({ battle: [inst("PK-002", "z1"), inst("RK-059", "z2")] }, { rush: [inst("SPEC-CN1", "a"), inst("SPEC-CN2", "b")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(true);
    expect(canEnter(s, "SPEC-CN2:b", "player2")).toBe(false);
  });

  it("PK-002: 【フォーメーションα】M ユニット・ナンバーが数字でない（RC）ユニットは制限されない（出典: atwiki/page-962「…敵軍Sユニットは」）", () => {
    const s = enemyTurn({ battle: [inst("PK-002", "z1")] }, { rush: [inst("SPEC-CN1-M", "m"), inst("SPEC-RC", "r")] });
    expect(canEnter(s, "SPEC-CN1-M:m", "player2")).toBe(true);
    expect(canEnter(s, "SPEC-RC:r", "player2")).toBe(true);
  });

  it("PK-002: 【フォーメーションα】ラッシュエリアにあるときは効かない（出典: atwiki/page-962「これが自軍バトルエリアにある間」）", () => {
    const s = enemyTurn({ rush: [inst("PK-002", "z1")] }, { rush: [inst("SPEC-CN1", "a")] });
    expect(canEnter(s, "SPEC-CN1:a", "player2")).toBe(true);
  });

  it("PK-002: 【フォーメーションα】自軍のユニットは制限されない（出典: atwiki/page-962「敵軍Sユニットは」）", () => {
    const s = board({ battle: [inst("PK-002", "z1")], rush: [inst("SPEC-CN1", "a")] });
    expect(canEnter(s, "SPEC-CN1:a")).toBe(true);
  });
});

// ===========================================================================
describe("PK-003 仮面ライダー龍騎", () => {
  dragonComboTests("PK-003", "ドラグセイバー", "atwiki/page-961", "（効果名【ドラグセイバー】が RK-033 の【ドラゴンライダーキック】と違うため、「ドラゴン」からのコンビネーションで「SP1」を得ない。RK-033 は同じ盤面で得る）");
});

// ===========================================================================
describe("PK-004 仮面ライダー電王SF", () => {
  const TEXT =
    "※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【俺の必殺技・パートⅡ】これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する。";

  it("PK-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-971）", () => {
    expectCatalogText("PK-004", TEXT);
    expectStats("PK-004", { name: "仮面ライダー電王SF", category: "OT", size: "S", bp: 3000, sp: 1, powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("PK-004", ["PR"]);
  });

  it("PK-004: ※ 敵軍バトルエリアにユニットがあるとストライクできず、なければストライクできる（出典: atwiki/page-971）", () => {
    expect(canStrike(enter(board({ rush: [inst("PK-004", "sf")] }, { battle: [inst("SPEC-E2000", "a")] }), "PK-004:sf"), "PK-004:sf")).toBe(false);
    expect(canStrike(enter(board({ rush: [inst("PK-004", "sf")] }), "PK-004:sf"), "PK-004:sf")).toBe(true);
  });

  /** 電王SF をライドオフ（RC）して出し、ストライクして、相手が flip のカードをウラ返す。 */
  const swung = (flip: string, p2: Partial<GameState["players"]["player2"]>, ride = true) => {
    let s = board({ rush: [inst("PK-004", "sf"), inst("SPEC-VEHICLE", "v")] }, p2);
    s = ride ? settle(rcRideOff(s, "PK-004:sf", "SPEC-VEHICLE:v")) : enter(s, "PK-004:sf");
    s = strike(s, "PK-004:sf");
    return act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: flip });
  };
  const enemyField = {
    rush: [inst("SPEC-COST3", "c3"), inst("SPEC-COST3-M", "c3m"), inst("SPEC-COST1", "c1")],
    power: [inst("TST-OP", "pw3"), inst("SPEC-COST5", "pw5")],
  };

  it.fails("PK-004: 【俺の必殺技・パートⅡ】（RC）ストライクして相手がウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選ぶ（ラッシュエリア・M ユニットも対象。選ばないことはできない）（出典: atwiki/page-971）— 既知の不具合: CARD-PK-004 RC の効果が発動しない（RK-066【俺の必殺技！】は同じ盤面で発動する。効果名だけが違う）", () => {
    const s = swung("TST-OP:pw3", enemyField);
    expectChoiceFrom(s, "player1", "PK-004");
    expect(choiceIds(s)).toEqual(["SPEC-COST3-M:c3m", "SPEC-COST3:c3"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("PK-004: 【俺の必殺技・パートⅡ】選んだユニットを撃破し、カードはウラ返る（出典: atwiki/page-971「1体選び撃破する」）— 既知の不具合: CARD-PK-004 RC の効果が発動しない", () => {
    const s = resolveAll(pick(swung("TST-OP:pw3", enemyField), "SPEC-COST3:c3"));
    expect(zoneOf(s, "player2", "SPEC-COST3:c3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-COST3-M:c3m")).toBe("rush");
    expect(cardIn(s, "player2", "TST-OP:pw3")?.faceDown).toBe(true);
  });

  it("PK-004: 【俺の必殺技・パートⅡ】必要パワーの数字が同じ敵軍ユニットがいなければ何もしない（出典: atwiki/page-971）", () => {
    const s = settle(swung("SPEC-COST5:pw5", enemyField));
    expect(s.players.player2.rush).toHaveLength(3);
    expect(cardIn(s, "player2", "SPEC-COST5:pw5")?.faceDown).toBe(true);
  });

  it("PK-004: 【俺の必殺技・パートⅡ】は RC の効果 — ライドしないで出てストライクしたときは発動しない（出典: atwiki/page-971「CN：ＲＣ」・R-KW-RC-01）", () => {
    const s = swung("TST-OP:pw3", enemyField, false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PK-004");
  });
});

// ===========================================================================
describe("PK-005 デンライナーゴウカ", () => {
  const TEXT = "【時の列車】これは必要パワーの数字に「－」のあるユニットにアタックするときBP+5000される。";

  it("PK-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-967）", () => {
    expectCatalogText("PK-005", TEXT);
    expectStats("PK-005", { name: "デンライナーゴウカ", category: "OT", size: "M", bp: 6000, sp: undefined, powerCost: "5+", features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("PK-005", ["PR"]);
  });

  it("PK-005: 追加条件 — 自軍 S ユニットを1体パワーゾーンに送ってラッシュできる（出典: atwiki/page-967「自軍Sユニットを1体パワーゾーンに送る」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("PK-005", "g")], rush: [inst("TST-UNIT-0", "u")], power: powerCards(5), command: releasedCat("OT", 1) }), "player1", "PK-005:g");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PK-005:g")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:u")).toBe("power");
  });

  it.fails("PK-005: 【時の列車】必要パワーの数字に「－」のあるユニットにアタックするとき BP+5000（11000対10000で勝つ）（出典: atwiki/page-967）— 既知の不具合: CARD-PK-005 BP+5000 が2重にかかり 16000 になる（RK-060 は同じ盤面で 11000）", () => {
    const s = resolveAll(attack(board({ battle: [inst("PK-005", "g")] }, { battle: [inst("SPEC-MINUS", "x")] }), "PK-005:g", "SPEC-MINUS:x"));
    expect(lastBattleBps(s)?.attacker).toBe(11000);
    expect(zoneOf(s, "player2", "SPEC-MINUS:x")).toBe("discard");
    expect(zoneOf(s, "player1", "PK-005:g")).toBe("battle");
  });

  it.fails("PK-005: 【時の列車】必要パワーに「－」のないユニットにアタックするときは BP+5000 されない（6000対7000で負ける）（出典: atwiki/page-967「必要パワーの数字に「－」のあるユニットに」）— 既知の不具合: CARD-PK-005 相手の必要パワーを問わず、アタックするとき BP+5000 される（11000）", () => {
    const s = resolveAll(attack(board({ battle: [inst("PK-005", "g")] }, { battle: [inst("SPEC-E7000", "x")] }), "PK-005:g", "SPEC-E7000:x"));
    expect(lastBattleBps(s)?.attacker).toBe(6000);
    expect(zoneOf(s, "player1", "PK-005:g")).toBe("discard");
  });

  it("PK-005: 【時の列車】「－」のあるユニットにアタックされるときは BP+5000 されない（出典: atwiki/page-967「アタックするとき」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("PK-005", "g")] }, { battle: [inst("SPEC-MINUS7", "x")] }), "SPEC-MINUS7:x", "PK-005:g", "player2"));
    expect(zoneOf(s, "player1", "PK-005:g")).toBe("discard");
  });
});

// ===========================================================================
describe("PK-006 シャドームーン", () => {
  shadowMoonTests(
    "PK-006",
    "atwiki/page-964",
    "PR",
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【サタンサーベル】敵軍バトルエリアからSビークルを１体選ぶ。選んだビークルにライドしているユニットがあれば、それを撃破する。その後、選んだビークルを捨札にする。",
  );
});

// ===========================================================================
describe("PK-007 モモタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【最初からクライマックスだぜ】これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にしてもよい。そうしたとき、このターン、そのユニットは「SP1」になる。";

  /** パワーゾーンにオモテ向きのモモタロス、ラッシュエリアの仮面ライダー（SP1/4）を2番目に出す。 */
  const kamenEnters = (power: CardInstance[]) => enter(board({ power, rush: [inst("SPEC-KAMEN", "k")], battle: fill(1) }), "SPEC-KAMEN:k");

  it("PK-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-966）", () => {
    expectCatalogText("PK-007", TEXT);
    expectStats("PK-007", { name: "モモタロス", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 1, features: ["イマジン"] });
    expectRarityIn("PK-007", ["PR"]);
  });

  it("PK-007: ※ バトルエリアに出た時点ですぐに撃破され、ストライクもアタックもできない（出典: atwiki/page-966「※これはバトルエリアに出たとき撃破される。」・grnrngr/faq-rider-2 RK-142 Q3）", () => {
    const s = settle(enter(board({ rush: [inst("PK-007", "im")], battle: fill(3) }), "PK-007:im"));
    expect(zoneOf(s, "player1", "PK-007:im")).toBe("discard");
    expect(canStrike(s, "PK-007:im")).toBe(false);
  });

  it("PK-007: パワーゾーンでオモテ向きの間、自軍バトルフェイズ中に特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にするかを選べる（任意）（出典: atwiki/page-966「これを捨札にしてもよい」）", () => {
    const s = kamenEnters([faceUpPower("PK-007", "im"), ...powerCards(2)]);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["PK-007:im"]);
    expect(canSkip(s)).toBe(true);
  });

  it("PK-007: 捨札にすると、このターン、出た仮面ライダー（SP1/4 の2番目）は「SP1」になりストライクできる（出典: atwiki/page-966「このターン、そのユニットは「SP1」になる」）", () => {
    const s = settle(pick(kamenEnters([faceUpPower("PK-007", "im")]), "PK-007:im"));
    expect(zoneOf(s, "player1", "PK-007:im")).toBe("discard");
    expect(spOf(s, "player1", "SPEC-KAMEN:k")).toBe(1);
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(true);
  });

  it("PK-007: 捨札にしなければ SP は変わらない（SP1/4 の2番目はストライクできない）（出典: atwiki/page-966「捨札にしてもよい。そうしたとき」）", () => {
    const s = settle(skip(kamenEnters([faceUpPower("PK-007", "im")])));
    expect(zoneOf(s, "player1", "PK-007:im")).toBe("power");
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(false);
  });

  it("PK-007: ウラ向き（ダメージ）なら発動しない（出典: atwiki/page-966「自軍パワーゾーンでオモテ向きになっている間」）", () => {
    const s = kamenEnters([{ ...inst("PK-007", "im"), faceDown: true }, ...powerCards(2)]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("PK-007:im");
  });

  it("PK-007: 特徴「仮面ライダー」を持たないユニットが出たときは発動しない（出典: atwiki/page-966「特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき」）", () => {
    const s = enter(board({ power: [faceUpPower("PK-007", "im")], rush: [inst("SPEC-PLAIN", "p")], battle: fill(1) }), "SPEC-PLAIN:p");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("PK-007:im");
  });

  it("PK-007: 敵軍ターン中に自軍の仮面ライダーがバトルエリアに出ても発動しない（出典: atwiki/page-966「自軍バトルフェイズ中、」）", () => {
    // 相手（player2）の電王RF【一本釣り】で、自軍パワーゾーンの仮面ライダーを自軍バトルエリアに出す。
    let s = enemyTurn({ power: [faceUpPower("PK-007", "im"), faceUpPower("SPEC-KAMEN", "k")] }, { rush: [inst("RK-061", "rf"), inst("SPEC-VEHICLE", "v")] });
    s = rcRideOff(s, "RK-061:rf", "SPEC-VEHICLE:v", "player2");
    if (s.pendingEffectChoice?.sourceCardId === "RK-061") s = pick(s, "SPEC-KAMEN:k");
    s = settle(s);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("battle");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("PK-007:im");
    expect(zoneOf(s, "player1", "PK-007:im")).toBe("power");
  });

  it("PK-007: RK-242 クライマックス刑事の太字部分を実行したターンは、「バトルエリアに出たとき撃破される」が無効になり、特徴「警察」が追加される（出典: atwiki/page-966・atwiki/page-762 RK-242 本文「特徴「イマジン」を持つ自軍ユニットは…そのテキストは無効になり、特徴「警察」を追加される」）", () => {
    let s = rushPhase({ operation: [{ instanceId: "RK-242:cx", cardId: "RK-242", stackedCards: [] }], power: [faceUpPower("TST-P", "up")], rush: [inst("PK-007", "mo")] });
    s = act(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RK-242:cx" });
    s = resolveAll(pick(s, "TST-P:up"));
    s = nextPhase(s);
    s = enter(s, "PK-007:mo");
    expect(zoneOf(s, "player1", "PK-007:mo")).toBe("battle");
  });
});
