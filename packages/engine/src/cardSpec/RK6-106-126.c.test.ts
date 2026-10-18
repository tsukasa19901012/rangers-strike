/**
 * カード別スペック: RK-120〜RK-126（ザ・マスクドライダーEXP vol.2 サイドバッシャーVM〜仮面ライダーギャレン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RK125 の読み替え）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-125 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-BP-02、R-ADD-02、R-KW-REG、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-125 の読み替え後の本文、【ブレイラウザー】のホールドと撃破、手札3枚未満でもライドオフできる（Q1）、3枚ちょうど選ぶ（Q2）
 *    — rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK125・errataCardEffects.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  NOSP_ATTACKER,
  PLAIN_VEHICLE,
  attack,
  attackTargets,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  featuresOf,
  fill,
  heldUnit,
  inst,
  mount,
  mountedOn,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOff,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./RK6-106-126.helpers";

const RC2000 = rcUnit("SPEC-RC2000", { category: "ET", bp: 2000 });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E500 = sUnit("SPEC-E500", { bp: 500, powerCost: 1 });
const EM = sUnit("SPEC-EM", { bp: 5000, powerCost: 3, size: "M" });
const OWN = sUnit("SPEC-OWN", { category: "DA", bp: 1000 });
const OWN_M = sUnit("SPEC-OWN-M", { category: "DA", bp: 5000, size: "M" });
const BIG = sUnit("SPEC-BIG", { bp: 13000 });
const ORPH = sUnit("SPEC-ORPH", { category: "DA", bp: 1000, features: ["オルフェノク"] });
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 1000, features: ["仮面ライダー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000, features: ["男"] });
const MULTI = sUnit("SPEC-MULTI", { category: ["WB", "MA"] as never, bp: 1000 });
const WB = sUnit("SPEC-WB", { category: "WB", bp: 1000 });
const MA = sUnit("SPEC-MA", { category: "MA", bp: 1000 });
const COST = [0, 1, 2, 3, 5].map((n) => sUnit(`SPEC-C${n}`, { bp: 1000, powerCost: n }));
const EXTRA = [RC2000, E1, E500, EM, OWN, OWN_M, BIG, ORPH, KAMEN, PLAIN, MULTI, WB, MA, NOSP_ATTACKER, PLAIN_VEHICLE, ...COST];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターン（バトルフェイズ）の盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const riding = (vehicle: CardInstance, rider: CardInstance): CardInstance[] => [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];

// ===========================================================================
describe("RK-120 サイドバッシャーVM", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1000される。 【ニーラーシャトル】これがライドされたままなら、このビークルからコンビネーションするSユニットは次の能力を得る⇒ナンバーにＲＣを持っていれば、ライドオフしなくてもその効果を発動できる。";

  it("RK-120: カタログ本文・スペックが出典と一致（出典: atwiki/page-657）", () => {
    expectCatalogText("RK-120", TEXT);
    expectVehicleStats("RK-120", { name: "サイドバッシャーVM", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-120", ["N"]);
  });

  it("RK-120: ※ これにライドしているユニットは BP+1000（出典: atwiki/page-657「※これにライドしているユニットはBP+1000される」）", () => {
    expect(bpOf(board({ battle: riding(inst("RK-120", "vm"), inst("SPEC-RC2000", "a")) }), "player1", "SPEC-RC2000:a")).toBe(3000);
  });

  // 次に出る RC のユニットは仮面ライダーアギトSF（RK-105【ハルバードスピン】。敵軍に必要パワー1 のユニットがいれば選択が開く）。
  const enemy = { battle: [inst("SPEC-E1", "e")] };
  const vmPair = riding(inst("RK-120", "vm"), inst("SPEC-RC2000", "a"));

  it.fails("RK-120: ライドされたままのこれからコンビネーションする RC のユニットは、ライドしたまま進んでも RC の効果を発動できる（出典: atwiki/page-657「ナンバーにＲＣを持っていれば、ライドオフしなくてもその効果を発動できる」）", () => {
    let s = mount(board({ battle: vmPair, rush: [inst("RK-105", "sf"), inst("SPEC-VEHICLE", "v")] }, enemy), "RK-105:sf", "SPEC-VEHICLE:v");
    s = rideOff(s, false);
    expectChoiceFrom(s, "player1", "RK-105");
    expect(mountedOn(s, "player1", "RK-105:sf")).toBe("SPEC-VEHICLE:v");
  });

  it.fails("RK-120: ビークルにライドせずに出た RC のユニットも、RC の効果を発動できる（出典: atwiki/page-657 コメント欄「RCを持っていればビークルが無くてもｏｋです」）", () => {
    const s = enter(board({ battle: vmPair, rush: [inst("RK-105", "sf")] }, enemy), "RK-105:sf");
    expectChoiceFrom(s, "player1", "RK-105");
  });

  it("RK-120: これがライドされていなければ発動しない（出典: atwiki/page-657「これがライドされたままなら」）", () => {
    const s = enter(board({ battle: [inst("RK-120", "vm")], rush: [inst("RK-105", "sf")] }, enemy), "RK-105:sf");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-105");
  });

  it("RK-120: これからコンビネーションしない（間に別のユニットが出た）RC のユニットは発動しない（出典: atwiki/page-657「このビークルからコンビネーションするSユニット」・コメント欄）", () => {
    const s = enter(board({ battle: [...vmPair, inst("SPEC-OWN", "x")], rush: [inst("RK-105", "sf")] }, enemy), "RK-105:sf");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-105");
  });

  it("RK-120: ライドオフを選んだときは、RC の効果を通常どおり1回だけ発動する（出典: atwiki/page-657・R-KW-RC-01）", () => {
    let s = mount(board({ battle: vmPair, rush: [inst("RK-105", "sf"), inst("SPEC-VEHICLE", "v")] }, enemy), "RK-105:sf", "SPEC-VEHICLE:v");
    s = rideOff(s, true);
    expectChoiceFrom(s, "player1", "RK-105");
    s = settle(skip(s));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-105");
  });
});

// ===========================================================================
describe("RK-121 サイドバッシャーBM", () => {
  const TEXT = "【エクザップバスター】これをラッシュしたターン、敵軍SユニットはBP-500される。（BP0以下になったユニットは撃破される）";

  it("RK-121: カタログ本文・スペックが出典と一致（出典: atwiki/page-656）", () => {
    expectCatalogText("RK-121", TEXT);
    expectStats("RK-121", { name: "サイドバッシャーBM", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("RK-121", ["NR"]);
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst("RK-121", "bm")], rush: [inst("RK-120", "vm")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA);

  it("RK-121: 追加条件 — 自軍「サイドバッシャーVM」1体をコマンドゾーンに送ってラッシュできる（出典: atwiki/page-656「追加条件：自軍「サイドバッシャーVM」1体をコマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushBoard(), "player1", "RK-121:bm", { materials: ["RK-120:vm"], destination: "command" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-121:bm")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-120:vm")).toBe("command");
  });

  it("RK-121: 追加条件 — 「サイドバッシャーVM」を捨札にしてラッシュすることもできる（出典: atwiki/page-656「…コマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(rushBoard(), "player1", "RK-121:bm", { materials: ["RK-120:vm"], destination: "discard" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-120:vm")).toBe("discard");
  });

  it("RK-121: 追加条件 — 「サイドバッシャーVM」がいなければラッシュできない（出典: atwiki/page-656「必要パワー：6+」・R-ADD-02）", () => {
    expect(canStartRush(rushBoard({ rush: [] }), "player1", "RK-121:bm")).toBe(false);
  });

  const enemy = { battle: [inst("SPEC-E1", "b"), inst("SPEC-E500", "w")], rush: [inst("SPEC-E1", "r"), inst("SPEC-EM", "m")] };
  const rushedBm = () => {
    const r = rushFromHand(rushBoard({}, enemy), "player1", "RK-121:bm", { materials: ["RK-120:vm"], destination: "discard" });
    expect(r.ok, r.error).toBe(true);
    return settle(r.state);
  };

  it.fails("RK-121: ラッシュしたターン、敵軍 S ユニット（エリアを問わない）は BP-500 される。M ユニットは変わらない（出典: atwiki/page-656「これをラッシュしたターン、敵軍SユニットはBP-500される」・カード評価「敵軍ラッシュエリアまで効果は届く」）", () => {
    const s = rushedBm();
    expect(bpOf(s, "player2", "SPEC-E1:b")).toBe(500);
    expect(bpOf(s, "player2", "SPEC-E1:r")).toBe(500);
    expect(bpOf(s, "player2", "SPEC-EM:m")).toBe(5000);
  });

  it.fails("RK-121: BP0 以下になった敵軍ユニットは撃破される（出典: atwiki/page-656「（BP0以下になったユニットは撃破される）」・R-BP-02）", () => {
    expect(zoneOf(rushedBm(), "player2", "SPEC-E500:w")).toBe("discard");
  });

  it("RK-121: 次のターンには元の BP に戻る（出典: atwiki/page-656「これをラッシュしたターン、」・カード評価「効果はラッシュしたターンだけ」）", () => {
    const s = endTurn(rushedBm());
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player2", "SPEC-E1:b")).toBe(1000);
  });
});

// ===========================================================================
describe("RK-122 ホースオルフェノク格闘態", () => {
  const TEXT =
    "※これは自軍パワーゾーンに6枚以上カードが無ければバトルエリアに出られない。 【使途再生】これが自軍エリアにある間、ホールド状態の自軍Sユニットは特徴「オルフェノク」が追加される。";

  it("RK-122: カタログ本文・スペックが出典と一致（出典: atwiki/page-706）", () => {
    expectCatalogText("RK-122", TEXT);
    expectStats("RK-122", { name: "ホースオルフェノク格闘態", category: "DA", size: "S", bp: 4000, sp: 1, powerCost: 3, features: ["オルフェノク", "怪人", "男"] });
    expectRarityIn("RK-122", ["R"]);
  });

  it.fails("RK-122: ※ 自軍パワーゾーンが5枚ならバトルエリアに出られない（出典: atwiki/page-706「これは自軍パワーゾーンに6枚以上カードが無ければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-122", "ho")], power: powerCards(5) }), "RK-122:ho")).toBe(false);
  });

  it("RK-122: ※ 自軍パワーゾーンが6枚なら出られる（ウラ向きのダメージのカードも数える）（出典: atwiki/page-706「6枚以上カードが」・R-POW-01「表裏は関係ない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-122", "ho")], power: powerCards(6) }), "RK-122:ho")).toBe(true);
    expect(canEnter(board({ rush: [inst("RK-122", "ho")], power: [...powerCards(3), ...damageCards(3)] }), "RK-122:ho")).toBe(true);
  });

  it.fails("RK-122: 【使途再生】これが自軍エリアにある間、ホールド状態の自軍 S ユニット（エリアを問わない）は特徴「オルフェノク」が追加される（出典: atwiki/page-706「ホールド状態の自軍Sユニットは特徴「オルフェノク」が追加される」）", () => {
    const s = board({ battle: [inst("RK-122", "ho"), heldUnit("SPEC-OWN", "hb")], rush: [heldUnit("SPEC-OWN", "hr")] });
    expect(featuresOf(s, "player1", "SPEC-OWN:hb")).toContain("オルフェノク");
    expect(featuresOf(s, "player1", "SPEC-OWN:hr")).toContain("オルフェノク");
  });

  it("RK-122: 【使途再生】リリース状態のユニット・M ユニット・敵軍のユニットには追加されない（出典: atwiki/page-706「ホールド状態の自軍Sユニット」）", () => {
    const s = board({ battle: [inst("RK-122", "ho"), inst("SPEC-OWN", "rb"), heldUnit("SPEC-OWN-M", "hm")] }, { battle: [heldUnit("SPEC-E1", "eh")] });
    expect(featuresOf(s, "player1", "SPEC-OWN:rb")).not.toContain("オルフェノク");
    expect(featuresOf(s, "player1", "SPEC-OWN-M:hm")).not.toContain("オルフェノク");
    expect(featuresOf(s, "player2", "SPEC-E1:eh")).not.toContain("オルフェノク");
  });

  it.fails("RK-122: 【使途再生】これが自軍ラッシュエリアにあっても追加される（出典: atwiki/page-706「これが自軍エリアにある間」）", () => {
    const s = board({ rush: [inst("RK-122", "ho"), heldUnit("SPEC-OWN", "hr")] });
    expect(featuresOf(s, "player1", "SPEC-OWN:hr")).toContain("オルフェノク");
  });
});

// ===========================================================================
describe("RK-123 クレインオルフェノク", () => {
  const TEXT =
    "【制裁する光の翼】これが自軍ラッシュエリアにある間、敵軍ターン中、「クレインオルフェノク」以外の特徴「オルフェノク」を持つ自軍ユニットが撃破されて捨札になるたび、敵軍Sユニットを1体選び撃破してもよい。";

  it("RK-123: カタログ本文・スペックが出典と一致（出典: atwiki/page-707）", () => {
    expectCatalogText("RK-123", TEXT);
    expectStats("RK-123", { name: "クレインオルフェノク", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 5, features: ["オルフェノク", "怪人", "女"] });
    expectRarityIn("RK-123", ["NR"]);
  });

  const enemyRush = { rush: [inst("SPEC-E1", "er"), inst("SPEC-EM", "em")] };

  it.fails("RK-123: 自軍ラッシュエリアにある間、敵軍ターン中に「オルフェノク」の自軍ユニットが撃破されて捨札になると、敵軍 S ユニット（エリアを問わない）を1体選べる（任意）（出典: atwiki/page-707「敵軍Sユニットを1体選び撃破してもよい」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SPEC-ORPH", "o")], rush: [inst("RK-123", "cr")] }, "SPEC-ORPH:o", enemyRush);
    expectChoiceFrom(s, "player1", "RK-123");
    expect(choiceIds(s)).toEqual(["SPEC-E1:er", "TST-UNIT-7:atk"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-123: 選んだ敵軍ユニットを撃破する（出典: atwiki/page-707）", () => {
    const s = resolveAll(pick(attackedInEnemyTurn({ battle: [inst("SPEC-ORPH", "o")], rush: [inst("RK-123", "cr")] }, "SPEC-ORPH:o", enemyRush), "SPEC-E1:er"));
    expect(zoneOf(s, "player2", "SPEC-E1:er")).toBe("discard");
  });

  it("RK-123: これが自軍バトルエリアにあるときは発動しない（出典: atwiki/page-707「これが自軍ラッシュエリアにある間」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-123", "cr"), inst("SPEC-ORPH", "o")] }, "SPEC-ORPH:o", enemyRush);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-123");
  });

  it("RK-123: 撃破されたのが「クレインオルフェノク」なら発動しない（出典: atwiki/page-707「「クレインオルフェノク」以外の」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-123", "b")], rush: [inst("RK-123", "cr")] }, "RK-123:b", enemyRush);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-123");
  });

  it("RK-123: 「オルフェノク」を持たない自軍ユニットが撃破されたときは発動しない（出典: atwiki/page-707「特徴「オルフェノク」を持つ自軍ユニット」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SPEC-OWN", "x")], rush: [inst("RK-123", "cr")] }, "SPEC-OWN:x", enemyRush);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-123");
  });

  it("RK-123: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-707「敵軍ターン中、」）", () => {
    const s = settle(attack(board({ battle: [inst("SPEC-ORPH", "o")], rush: [inst("RK-123", "cr")] }, { battle: [inst("SPEC-BIG", "big")] }), "SPEC-ORPH:o", "SPEC-BIG:big"));
    expect(zoneOf(s, "player1", "SPEC-ORPH:o")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-123");
  });

  it.fails("RK-123: 2体あれば、1体の撃破につき2回選べる（重複する）（出典: atwiki/page-707 コメント欄「重複します」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("SPEC-ORPH", "o")], rush: [inst("RK-123", "c1"), inst("RK-123", "c2")] }, "SPEC-ORPH:o", enemyRush);
    expectChoiceFrom(s, "player1", "RK-123");
    s = settle(pick(s, "SPEC-E1:er"));
    expectChoiceFrom(s, "player1", "RK-123");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:atk"]);
  });

  it.fails("RK-123: ホースオルフェノク格闘態で「オルフェノク」が追加されたホールド状態の自軍ユニットが撃破されたときも発動する（出典: atwiki/page-707 カード評価「ホースオルフェノク格闘態と特に相性が良く」）", () => {
    const s = attackedInEnemyTurn({ battle: [heldUnit("SPEC-OWN", "h")], rush: [inst("RK-122", "ho"), inst("RK-123", "cr")] }, "SPEC-OWN:h", enemyRush);
    expectChoiceFrom(s, "player1", "RK-123");
  });
});

// ===========================================================================
describe("RK-124 スネークオルフェノク", () => {
  const TEXT =
    "【人を守る決意】これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のターン中、アタックや効果の対象として対戦相手の「スネークオルフェノク」を一度も選んでいなければ、特徴「仮面ライダー」を持つ対戦相手のユニットと「スネークオルフェノク」以外の特徴「オルフェノク」を持つ対戦相手のユニットは選べない。";

  it("RK-124: カタログ本文・スペックが出典と一致（出典: atwiki/page-708）", () => {
    expectCatalogText("RK-124", TEXT);
    expectStats("RK-124", { name: "スネークオルフェノク", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 4, features: ["オルフェノク", "怪人", "男"] });
    expectRarityIn("RK-124", ["NR"]);
  });

  const guarded = [inst("RK-124", "sn"), inst("SPEC-KAMEN", "k"), inst("SPEC-ORPH", "o"), inst("SPEC-PLAIN", "p")];
  const attackers = { battle: [inst("TST-UNIT-7", "a1"), inst("SPEC-NOSP", "a2")] };

  it.fails("RK-124: これが自軍バトルエリアにある間、相手はそのターンにスネークオルフェノクを選んでいなければ、「仮面ライダー」と（スネーク以外の）「オルフェノク」の自軍ユニットにアタックできない（出典: atwiki/page-708「…一度も選んでいなければ、特徴「仮面ライダー」を持つ対戦相手のユニットと…選べない」）", () => {
    const s = enemyTurn({ battle: guarded }, attackers);
    expect(attackTargets(s, "TST-UNIT-7:a1", "player2").sort()).toEqual(["RK-124:sn", "SPEC-PLAIN:p"]);
  });

  it("RK-124: 相手がスネークオルフェノクをアタックの対象に選んだ後は、そのターン、「仮面ライダー」「オルフェノク」のユニットも選べる（出典: atwiki/page-708・カード評価「雑魚ユニットの自爆アタックでも能力が解除されてしまう」）", () => {
    let s = enemyTurn({ battle: guarded }, attackers);
    s = settle(attack(s, "SPEC-NOSP:a2", "RK-124:sn", "player2"));
    expect(zoneOf(s, "player1", "RK-124:sn")).toBe("battle");
    expect(attackTargets(s, "TST-UNIT-7:a1", "player2").sort()).toEqual(["RK-124:sn", "SPEC-KAMEN:k", "SPEC-ORPH:o", "SPEC-PLAIN:p"]);
  });

  it.fails("RK-124: 効果の対象にも選べない（デストワイルダー【クロー】で選べるのはスネークと他のユニットだけ）（出典: atwiki/page-708「アタックや効果の対象として」）", () => {
    const s = enterWithHold(enemyTurn({ battle: guarded }, { rush: [inst("RK-118", "dw")], command: releasedCat("WB", 1) }), "RK-118:dw", ["TST-OP:cWB0"], "player2");
    expectChoiceFrom(s, "player2", "RK-118");
    expect(choiceIds(s)).toEqual(["RK-124:sn", "SPEC-PLAIN:p"]);
  });

  it.fails("RK-124: 効果の対象としてスネークオルフェノクを選んだ後は、そのターン、「仮面ライダー」のユニットにアタックできる（出典: atwiki/page-708「アタックや効果の対象として…一度も選んでいなければ」）", () => {
    let s = enterWithHold(
      enemyTurn({ battle: guarded }, { battle: [inst("TST-UNIT-7", "a1")], rush: [inst("RK-118", "dw")], command: releasedCat("WB", 1) }),
      "RK-118:dw",
      ["TST-OP:cWB0"],
      "player2",
    );
    s = settle(pick(s, "RK-124:sn"));
    expect(attackTargets(s, "TST-UNIT-7:a1", "player2")).toContain("SPEC-KAMEN:k");
  });

  it("RK-124: これが自軍ラッシュエリアにあるときは制限しない（出典: atwiki/page-708「これが自軍バトルエリアにある間」）", () => {
    const s = enemyTurn({ battle: guarded.slice(1), rush: [inst("RK-124", "sn")] }, attackers);
    expect(attackTargets(s, "TST-UNIT-7:a1", "player2")).toEqual(expect.arrayContaining(["SPEC-KAMEN:k", "SPEC-ORPH:o"]));
  });

  it.fails("RK-124: 他の「スネークオルフェノク」は選べる（出典: atwiki/page-708「「スネークオルフェノク」以外の特徴「オルフェノク」を持つ」）", () => {
    const s = enemyTurn({ battle: [inst("RK-124", "s1"), inst("RK-124", "s2"), inst("SPEC-KAMEN", "k")] }, attackers);
    expect(attackTargets(s, "TST-UNIT-7:a1", "player2").sort()).toEqual(["RK-124:s1", "RK-124:s2"]);
  });
});

// ===========================================================================
describe("RK-125 仮面ライダーブレイド", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 【ブレイラウザー】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの持つカテゴリがすべて同じなら、敵軍バトルエリアからSユニットを1体選び撃破する。";

  it("RK-125: カタログ本文（読み替え後）・スペックが出典と一致（出典: atwiki/page-646・grnrngr/faq-rider-2 RK-125 Q2 の読み替え）", () => {
    expectCatalogText("RK-125", TEXT);
    expectStats("RK-125", { name: "仮面ライダーブレイド", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-125", ["SR"]);
  });

  const blade = (hand: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcRideOff(board({ hand, rush: [inst("RK-125", "bl"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-125:bl", "SPEC-VEHICLE:v");

  it("RK-125: ※ ライドオフしたときはストライクできない（出典: atwiki/page-646「※これはライドオフしたときストライクできない」）", () => {
    // 手札が3枚未満で【ブレイラウザー】の選択は開かない盤面で確かめる。
    const s = settle(blade([], { battle: fill(1) }));
    expect(canStrike(s, "RK-125:bl")).toBe(false);
  });

  const enemy = { battle: [inst("SPEC-E1", "b")], rush: [inst("SPEC-E1", "r")] };
  /** 手札3枚を見せ、ラッシュエリアの敵軍ユニットをホールドするところまで進める。 */
  const shown = (hand: CardInstance[]) => {
    let s = blade(hand, {}, enemy);
    for (const c of hand) s = pick(s, c.instanceId);
    return pick(s, "SPEC-E1:r");
  };

  it.fails("RK-125: マルチカテゴリのカードを含む手札（WB/MA・WB・WB）は「カテゴリがすべて同じ」として扱い、撃破に進む（出典: atwiki/page-646 カード評価「「赤青マルチ、赤、赤」と言う手札を公開した場合カテゴリが全て同じである、として扱う」）", () => {
    const s = shown([inst("SPEC-MULTI", "m"), inst("SPEC-WB", "w1"), inst("SPEC-WB", "w2")]);
    expectChoiceFrom(s, "player1", "RK-125");
    expect(choiceIds(s)).toEqual(["SPEC-E1:b"]);
  });

  it("RK-125: カテゴリが揃わない手札（WB・WB・MA）ならホールドだけで終わる（出典: atwiki/page-646「見せたカードの持つカテゴリがすべて同じなら」）", () => {
    const s = shown([inst("SPEC-WB", "w1"), inst("SPEC-WB", "w2"), inst("SPEC-MA", "a")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-125");
    expect(zoneOf(s, "player2", "SPEC-E1:b")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-126 仮面ライダーギャレン", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ギャレンラウザー】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が番号順（例：0、1、2や3、4、5など）に揃うなら、敵軍Sユニットを1体選び撃破する。";

  it("RK-126: カタログ本文・スペックが出典と一致（出典: atwiki/page-647）", () => {
    expectCatalogText("RK-126", TEXT);
    expectStats("RK-126", { name: "仮面ライダーギャレン", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-126", ["R"]);
  });

  it("RK-126: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-647「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-126", "ga")] }, "RK-126:ga"))).toBe(true);
  });

  const c = (n: number, suf = `h${n}`) => inst(`SPEC-C${n}`, suf);
  const enemy = { battle: [inst("SPEC-E1", "b"), inst("SPEC-EM", "m")], rush: [inst("SPEC-E1", "r")] };
  const garren = (hand: CardInstance[]) =>
    rcRideOff(board({ hand, rush: [inst("RK-126", "ga"), inst("SPEC-VEHICLE", "v")] }, enemy), "RK-126:ga", "SPEC-VEHICLE:v");
  /** 手札から picks の3枚を見せる。 */
  const show = (hand: CardInstance[], picks: CardInstance[]) => {
    let s = garren(hand);
    for (const p of picks) s = pick(s, p.instanceId);
    return s;
  };

  it.fails("RK-126: RC — 自分の手札を3枚選んで見せるかを選べる（任意）（出典: atwiki/page-647「自分の手札を3枚選び、相手に見せてもよい」）", () => {
    const hand = [c(1), c(2), c(3), c(5)];
    const s = garren(hand);
    expectChoiceFrom(s, "player1", "RK-126");
    expect(choiceIds(s)).toEqual(hand.map((x) => x.instanceId).sort());
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-126: RC — 手札が3枚未満なら選べない（出典: atwiki/page-647「自分の手札を3枚選び」・カード評価「効果の発動には手札が３枚以上必要」）", () => {
    const s = garren([c(1), c(2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-126");
  });

  it.fails("RK-126: RC — 見せたら、敵軍 S ユニット（エリアを問わない）を1体選びホールドする（選ばないことはできない）（出典: atwiki/page-647「そうしたとき、敵軍Sユニットを1体選びホールドする」）", () => {
    const hand = [c(1), c(2), c(3), c(5)];
    let s = show(hand, hand.slice(0, 3));
    expectChoiceFrom(s, "player1", "RK-126");
    expect(choiceIds(s)).toEqual(["SPEC-E1:b", "SPEC-E1:r"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "SPEC-E1:r");
    expect(cardIn(s, "player2", "SPEC-E1:r")?.commandHeld).toBe(true);
  });

  it.fails("RK-126: RC — 見せたカードの必要パワーが番号順（1・2・3）に揃えば、続けて敵軍 S ユニット（エリアを問わない。ホールドしたものとは別でもよい）を1体選び撃破する（出典: atwiki/page-647「番号順…に揃うなら、敵軍Sユニットを1体選び撃破する」・カード評価「ホールドと撃破で選ぶ敵ユニットは別々でよく…撃破するユニットはラッシュエリアから選んでもよい」）", () => {
    const hand = [c(1), c(2), c(3), c(5)];
    let s = pick(show(hand, hand.slice(0, 3)), "SPEC-E1:b");
    expectChoiceFrom(s, "player1", "RK-126");
    expect(choiceIds(s)).toEqual(["SPEC-E1:b", "SPEC-E1:r"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E1:r"));
    expect(zoneOf(s, "player2", "SPEC-E1:r")).toBe("discard");
    expect(cardIn(s, "player2", "SPEC-E1:b")?.commandHeld).toBe(true);
  });

  it.fails("RK-126: RC — 見せる順番は問わない（3・1・2 の順に選んでも揃う）（出典: atwiki/page-647「番号順（例：0、1、2や3、4、5など）に揃うなら」）", () => {
    const hand = [c(1), c(2), c(3)];
    const s = pick(show(hand, [hand[2]!, hand[0]!, hand[1]!]), "SPEC-E1:b");
    expectChoiceFrom(s, "player1", "RK-126");
  });

  it.fails("RK-126: RC — 番号順に揃わない（1・2・5、1・1・2）ならホールドだけで終わる（出典: atwiki/page-647）", () => {
    for (const hand of [[c(1), c(2), c(5)], [c(1), c(1, "dup"), c(2)]]) {
      const s = pick(show(hand, hand), "SPEC-E1:b");
      expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-126");
      expect(zoneOf(s, "player2", "SPEC-E1:r")).toBe("rush");
    }
  });

  it.fails("RK-126: RC — 見せなければ何も起きない（出典: atwiki/page-647「相手に見せてもよい」）", () => {
    const s = settle(skip(garren([c(1), c(2), c(3)])));
    expect(cardIn(s, "player2", "SPEC-E1:b")?.commandHeld ?? false).toBe(false);
  });
});
