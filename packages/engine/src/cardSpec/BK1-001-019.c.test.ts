/**
 * カード別スペック: BK-015〜BK-019（ザ・マスクドライダーエクスパンション ベルトコレクションBOX ブレイバックル〜キバットベルト）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「BK-」とカード名で検索）。atwiki に転載された公式 Q&A: BK-019 Q1（必要パワーを満たさずにラッシュできる）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-BK-NNN.md）・atwiki/page-1739「カード名」（ブレイバックルの例）
 *  3. docs/rules/*.md の一般ルール（R-STK-03・R-RUSH-20/21）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-BK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／プロモーションカード」を N／PR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  beltUsed,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  faceUpResident,
  fill,
  heldField,
  inst,
  isHeld,
  nextPhase,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  spOf,
  sUnit,
  zoneOf,
  type Cat,
} from "./BK1-001-019.helpers";

const PLAIN = sUnit("SPEC-PLAIN", { category: "MA", bp: 3000 });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "MA", bp: 3000, size: "M" });
const NOSP = sUnit("SPEC-NOSP", { category: "WB", bp: 1000, sp: undefined });
const ONI_M = sUnit("SPEC-ONI-M", { category: "MA", bp: 3000, size: "M", features: ["猛士"] });
const EXTRA = [PLAIN, PLAIN_M, NOSP, ONI_M];

const used = (id: string, cat: Cat, cost: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  beltUsed(id, cat, cost, p1, p2, EXTRA);

// ===========================================================================
describe("BK-015 ブレイバックル", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自分の手札から「仮面ライダーブレイド」のカードを1枚選び、自軍ラッシュエリアに出してもよい。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットは「SP1/2」になる。";
  const HAND = () => [inst("RK-125", "h0"), inst("XG2-075", "h1"), inst("XG4-081", "h2"), inst("XG1-067", "h3"), inst("XG1-059", "kf"), inst("RK-211", "jf"), inst("XG7-038", "x")];

  it("BK-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-714）", () => {
    expectCatalogText("BK-015", TEXT);
    expectOpStats("BK-015", { name: "ブレイバックル", category: "WB", powerCost: 2 });
    expectRarityIn("BK-015", ["N"]);
  });

  it("BK-015: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: atwiki/page-714「次の効果から1つ選び発動する」）", () => {
    const s = used("BK-015", "WB", 2, { hand: HAND() });
    expectChoiceFrom(s, "player1", "BK-015");
    expect(choiceIds(s)).toEqual(["rush", "sp_1_2"]);
  });

  it("BK-015: ◎1つ目 — 手札の「仮面ライダーブレイド」のカードから1枚選べる。「仮面ライダーブレイドKF」は対象外、「ディケイド ブレイド」は対象（任意）（出典: atwiki/page-714「自分の手札から「仮面ライダーブレイド」のカードを1枚選び、自軍ラッシュエリアに出してもよい」・atwiki/page-1739「ブレイバックルは「仮面ライダーブレイド」が対象なので「仮面ライダーブレイドKF」は対象外。一方「ディケイド ブレイド」は…対象になる」）", () => {
    const s = pick(used("BK-015", "WB", 2, { hand: HAND() }), "rush");
    expectChoiceFrom(s, "player1", "BK-015");
    expect(choiceIds(s)).toEqual(["RK-125:h0", "XG1-067:h3", "XG2-075:h1", "XG4-081:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("BK-015: ◎1つ目 — 選んだカードは自軍ラッシュエリアに出る（必要パワーを満たさなくてよい）（出典: atwiki/page-714・カード評価「ブレイドを本来のパワー-1で出せるカード」）", () => {
    const s = resolveAll(pick(pick(used("BK-015", "WB", 2, { hand: HAND() }), "rush"), "RK-125:h0"));
    expect(zoneOf(s, "player1", "RK-125:h0")).toBe("rush");
  });

  /** ブレイバックルの◎2つ目で SPEC-NOSP（印刷 SP なし）を選び、バトルフェイズに n 体の後へ出す。 */
  const sp12 = (fillers: number) => {
    let s = used("BK-015", "WB", 2, { rush: [inst("SPEC-NOSP", "u"), ...fill(fillers)] });
    s = resolveAll(pick(pick(s, "sp_1_2"), "SPEC-NOSP:u"));
    s = nextPhase(s);
    return enterSeq(s, [...fill(fillers).map((c) => c.instanceId), "SPEC-NOSP:u"]);
  };

  it("BK-015: ◎2つ目 — 選べるのは自軍の S ユニットだけ（出典: atwiki/page-714「自軍Sユニットを1体選ぶ」）", () => {
    const s = pick(used("BK-015", "WB", 2, { rush: [inst("SPEC-NOSP", "u"), inst("SPEC-PLAIN-M", "m")], command: [inst("SPEC-PLAIN", "cmd")] }, { rush: [inst("SPEC-PLAIN", "e")] }), "sp_1_2");
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:u"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-015: ◎2つ目 — 選んだユニットは SP1/2 になる（バトルエリアの2番目で「SP1」、1番目では SP なし）（出典: atwiki/page-714「このターン、選んだユニットは「SP1/2」になる」・R-STK-03）", () => {
    expect(spOf(sp12(1), "player1", "SPEC-NOSP:u")).toBe(1);
    expect(spOf(sp12(0), "player1", "SPEC-NOSP:u")).toBe(0);
  });
});

// ===========================================================================
describe("BK-016 火炎鼓装備帯", () => {
  const TEXT = "特徴「猛士」を持つ自軍ユニット2体につき1枚ドローする。";
  const ONI = (n: number, prefix = "o"): CardInstance[] => Array.from({ length: n }, (_, i) => inst("RK-047", `${prefix}${i}`));

  it("BK-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-729）", () => {
    expectCatalogText("BK-016", TEXT);
    expectOpStats("BK-016", { name: "火炎鼓装備帯", category: "MA", powerCost: 5 });
    expectRarityIn("BK-016", ["N"]);
  });

  it("BK-016: 特徴「猛士」を持つ自軍ユニット（ラッシュエリア・バトルエリア。サイズを問わない）4体なら2枚ドローする（出典: atwiki/page-729「特徴「猛士」を持つ自軍ユニット2体につき1枚ドローする」）", () => {
    const s = resolveAll(used("BK-016", "MA", 5, { rush: [...ONI(2), inst("SPEC-ONI-M", "m")], battle: ONI(1, "b") }));
    expect(s.players.player1.hand).toHaveLength(2);
  });

  it("BK-016: 3体なら1枚、1体なら0枚（出典: atwiki/page-729「2体につき1枚」）", () => {
    expect(resolveAll(used("BK-016", "MA", 5, { rush: ONI(3) })).players.player1.hand).toHaveLength(1);
    expect(resolveAll(used("BK-016", "MA", 5, { rush: ONI(1) })).players.player1.hand).toHaveLength(0);
  });

  it("BK-016: 敵軍のユニット・自軍コマンドゾーンの「猛士」のカード・「猛士」を持たない自軍ユニットは数えない（出典: atwiki/page-729「特徴「猛士」を持つ自軍ユニット」）", () => {
    const s = resolveAll(used("BK-016", "MA", 5, { rush: [...ONI(1), inst("SPEC-PLAIN", "p")], command: [inst("RK-047", "cmd")] }, { rush: ONI(2, "e") }));
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("BK-017 カブトゼクター", () => {
  const TEXT =
    "次の効果から1つ選び発動する。◎自軍山札から「仮面ライダーカブトMF」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。◎このターン、特徴「加速」を持つBP2000以下のSユニットのカードは、追加条件を満たさなくてもラッシュできる。";
  const DECK = () => [inst("RK-070", "h0"), inst("XG2-064", "h1"), inst("RK-065", "rf"), ...deckCards(3)];

  it("BK-017: カタログ本文・スペックが出典と一致（レアリティはプロモーションカード）（出典: atwiki/page-723）", () => {
    expectCatalogText("BK-017", TEXT);
    expectOpStats("BK-017", { name: "カブトゼクター", category: "OT", powerCost: 5 });
    expectRarityIn("BK-017", ["PR"]);
  });

  it("BK-017: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: atwiki/page-723「次の効果から1つ選び発動する」）", () => {
    const s = used("BK-017", "OT", 5, { deck: DECK() });
    expectChoiceFrom(s, "player1", "BK-017");
    expect(choiceIds(s)).toEqual(["accel_waive", "rush"]);
  });

  it("BK-017: ◎1つ目 — 自軍山札の「仮面ライダーカブトMF」のカードから1枚選べる（「仮面ライダーカブトRF」は対象外。任意）（出典: atwiki/page-723「自軍山札から「仮面ライダーカブトMF」のカードを1枚選び、自軍ラッシュエリアに出してもよい」・atwiki/page-1739）", () => {
    const s = pick(used("BK-017", "OT", 5, { deck: DECK() }), "rush");
    expectChoiceFrom(s, "player1", "BK-017");
    expect(choiceIds(s)).toEqual(["RK-070:h0", "XG2-064:h1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("BK-017: ◎1つ目 — 選んだカードは自軍ラッシュエリアに出る（山札から離れる）（出典: atwiki/page-723）", () => {
    const s = resolveAll(pick(pick(used("BK-017", "OT", 5, { deck: DECK() }), "rush"), "RK-070:h0"));
    expect(zoneOf(s, "player1", "RK-070:h0")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(DECK().length - 1);
  });

  /** ◎2つ目の後（または使わずに）、手札の unit をパワーゾーン5枚・OT のリリース状態のコマンドで出せるか。 */
  const canRushAfter = (unit: string, useOp: boolean) => {
    const p1 = { hand: [inst(unit, "u")], power: powerCards(5), command: releasedCat("OT", 1, "rushCmd") };
    const s = useOp ? resolveAll(pick(used("BK-017", "OT", 5, p1), "accel_waive")) : rushBoard(p1, {}, EXTRA);
    return canStartRush(s, "player1", `${unit}:u`);
  };

  it("BK-017: ◎2つ目 — このターン、特徴「加速」を持つ BP2000 以下の S ユニットのカード（RK-065 カブトRF。追加条件は自軍カブトMF をパワーゾーンに送る）は、追加条件を満たさずにラッシュできる（出典: atwiki/page-723「このターン、特徴「加速」を持つBP2000以下のSユニットのカードは、追加条件を満たさなくてもラッシュできる」）", () => {
    expect(canRushAfter("RK-065", true)).toBe(true);
    const s = resolveAll(pick(used("BK-017", "OT", 5, { hand: [inst("RK-065", "u")], power: powerCards(5), command: releasedCat("OT", 1, "rushCmd") }), "accel_waive"));
    const r = rushFromHand(s, "player1", "RK-065:u");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-065:u")).toBe("rush");
  });

  it("BK-017: ◎2つ目 — BP が2000より大きい「加速」の S ユニット（XG1-074 ザビーRF・BP3000）は追加条件が必要（出典: atwiki/page-723「BP2000以下」）", () => {
    expect(canRushAfter("XG1-074", true)).toBe(false);
  });

  it("BK-017: 対照 — 使わなければ RK-065 は追加条件（自軍カブトMF）なしではラッシュできない（出典: RK-065 の追加条件）", () => {
    expect(canRushAfter("RK-065", false)).toBe(false);
  });
});

// ===========================================================================
describe("BK-018 デンオウベルト", () => {
  const TEXT =
    "自軍山札か、自軍常駐置き場でオモテ向きになっているになっているカードの中から、本来の特徴に「DEN-O」を持つユニットカードを1枚選び、ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、山札から選んだ場合は山札をシャッフルする。";
  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    used("BK-018", "OT", 4, {
      deck: [inst("RK-072", "gf"), inst("RK-140", "lf"), inst("RK-029", "x"), ...deckCards(3)],
      hand: [inst("RK-061", "hand")],
      operation: [faceUpResident("RK-062", "res"), { ...inst("RK-066", "down"), faceDown: true }],
      ...p1,
    });

  it("BK-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-724）", () => {
    // atwiki の本文の写し（「オモテ向きになっているになっている」の重複も含めて）とカタログの本文は同じ。
    expectCatalogText("BK-018", TEXT);
    expectOpStats("BK-018", { name: "デンオウベルト", category: "OT", powerCost: 4 });
    expectRarityIn("BK-018", ["N"]);
  });

  it("BK-018: 自軍山札と、自軍常駐置き場でオモテ向きのカードの中から、本来の特徴に「DEN-O」を持つユニットカードを1枚選ぶ（手札・ウラ向き・追加条件を満たせないカードは選べない。見送れない）（出典: atwiki/page-724「自軍山札か、自軍常駐置き場でオモテ向きになっているカードの中から…1枚選び、ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）」）", () => {
    const s = board();
    expectChoiceFrom(s, "player1", "BK-018");
    expect(choiceIds(s)).toEqual(["RK-062:res", "RK-072:gf"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-018: 追加条件を満たせるカード（RK-140 電王LF: 自軍「仮面ライダー電王PF」1体をパワーゾーンに送る）は選べる（出典: atwiki/page-724「ただし、追加条件は満たすこと」）", () => {
    const s = board({ rush: [inst("RK-152", "pf")] });
    expect(choiceIds(s)).toEqual(["RK-062:res", "RK-072:gf", "RK-140:lf"]);
  });

  it("BK-018: 選んだカードは自軍ラッシュエリアに出る（必要パワーを満たさなくてよい。このカードは常駐せず捨札）（出典: atwiki/page-724「必要パワーは満たさなくてもよい」）", () => {
    let s = resolveAll(pick(board(), "RK-072:gf"));
    expect(zoneOf(s, "player1", "RK-072:gf")).toBe("rush");
    expect(zoneOf(s, "player1", "BK-018:op")).toBe("discard");
    s = resolveAll(pick(board(), "RK-062:res"));
    expect(zoneOf(s, "player1", "RK-062:res")).toBe("rush");
  });
});

// ===========================================================================
describe("BK-019 キバットベルト", () => {
  const TEXT =
    "次の効果から1つ選び発動する。◎自分の手札から本来の特徴に｢魔皇力｣を持つカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。◎自軍Sユニットを1体選び、リリースする。";
  const HAND = () => [inst("RK-245", "kiba"), inst("RK-323", "mk"), inst("RK-324", "bb"), inst("RK-047", "x")];

  it("BK-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-942）", () => {
    expectCatalogText("BK-019", TEXT);
    expectOpStats("BK-019", { name: "キバットベルト", category: "MA", powerCost: 3 });
    expectRarityIn("BK-019", ["N"]);
  });

  it("BK-019: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: atwiki/page-942「次の効果から1つ選び発動する」）", () => {
    const s = used("BK-019", "MA", 3, { hand: HAND() });
    expectChoiceFrom(s, "player1", "BK-019");
    expect(choiceIds(s)).toEqual(["release", "rush"]);
  });

  it("BK-019: ◎1つ目 — 手札の、本来の特徴に「魔皇力」を持つカード（ユニット・ビークル）で追加条件を満たせるものから1枚選べる（RK-324 ブロンブースターは自軍ビークルがないので選べない。任意）（出典: atwiki/page-942「自分の手札から本来の特徴に｢魔皇力｣を持つカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと」）", () => {
    const s = pick(used("BK-019", "MA", 3, { hand: HAND() }), "rush");
    expectChoiceFrom(s, "player1", "BK-019");
    expect(choiceIds(s)).toEqual(["RK-245:kiba", "RK-323:mk"]);
    expect(canSkip(s)).toBe(true);
  });

  it("BK-019: 公式Q&A — 必要パワーを満たさずにラッシュできる（パワーゾーン3枚で必要パワー4のキバを出せる）（出典: atwiki/page-942 Q1「はい、可能です」）", () => {
    const s = resolveAll(pick(pick(used("BK-019", "MA", 3, { hand: HAND() }), "rush"), "RK-245:kiba"));
    expect(zoneOf(s, "player1", "RK-245:kiba")).toBe("rush");
  });

  it("BK-019: ◎2つ目 — 自軍のホールド状態の S ユニット（ラッシュエリア・バトルエリア）から1体選ぶ（M ユニット・敵軍のユニットは選べない）（出典: atwiki/page-942「自軍Sユニットを1体選び、リリースする」）", () => {
    const s = pick(
      used("BK-019", "MA", 3, { rush: [heldField("SPEC-PLAIN", "h"), inst("SPEC-PLAIN", "r"), heldField("SPEC-PLAIN-M", "m")], battle: [heldField("SPEC-NOSP", "b")] }, { battle: [heldField("SPEC-PLAIN", "e")] }),
      "release",
    );
    expectChoiceFrom(s, "player1", "BK-019");
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:b", "SPEC-PLAIN:h"]);
  });

  it("BK-019: ◎2つ目 — 選んだユニットはリリース状態になる（出典: atwiki/page-942「リリースする」）", () => {
    const s = resolveAll(pick(pick(used("BK-019", "MA", 3, { battle: [heldField("SPEC-NOSP", "b")] }), "release"), "SPEC-NOSP:b"));
    expect(isHeld(s, "player1", "SPEC-NOSP:b")).toBe(false);
  });
});

