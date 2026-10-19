/**
 * カード別スペック: XG2-035〜XG2-041（クロスギャザー ザ・ドラゴンタイガー デカレンジャーロボFC〜スーパーシンケンイエロー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-035」〜「XG2-041」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-041 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-ADD-02・R-KW-BLAST-01・R-KW-RESIST-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - ブラストそのもの（R-KW-BLAST-01）は rulesSpec/07-blast.test.ts。ここでは XG2-035 で1件だけ確かめる。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  attack,
  attackTargets,
  attackUntilRegister,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  handN,
  inst,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zordDownTests,
  zoneOf,
} from "./XG2-021-041.helpers";

const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 3000, size: "M" });
const BP8000 = sUnit("SPEC-BP8000", { bp: 8000, size: "M" });
const BP4000 = sUnit("SPEC-BP4000", { bp: 4000 });
const BP5000 = sUnit("SPEC-BP5000", { bp: 5000 });
const EXTRA = [DA_S, DA_M, BP8000, BP4000, BP5000];

// ===========================================================================
describe("XG2-035 デカレンジャーロボFC", () => {
  const TEXT =
    "合体―デカレンジャーロボ（またはデカマシン）+ブラストバギー ※ブラスト 【フルブラストランチャー】自分がゲームに負けるまで残りダメージ1点なら、自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーを好きな枚数選び捨札にしてもよい。そうしたとき、捨札にしたカード1枚につき、敵軍ユニット1体か敵軍パワーゾーンのカードを1枚選び捨札にする。";

  it("XG2-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-1820）", () => {
    expectCatalogText("XG2-035", TEXT);
    expectUnit("XG2-035", { name: "デカレンジャーロボFC", category: "OT", size: "L", bp: 20000, sp: 2, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG2-035", ["R"]);
  });

  const board = (rush: CardInstance[], power = 7) => rushBoard({ hand: [inst("XG2-035", "h")], rush, power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-035: 追加条件（合体）— デカレンジャーロボ（XG2-032）とブラストバギー（XG2-034）を自軍パワーゾーンに送り、パワー7でラッシュできる。パワー6ではできない（出典: atwiki/page-1820「合体―デカレンジャーロボ（またはデカマシン）+ブラストバギー」「追加条件：自軍合体ユニットをパワーゾーンに送る」「必要パワー：7+」）", () => {
    const r = rushFromHand(board([inst("XG2-032", "d"), inst("XG2-034", "b")]), "player1", "XG2-035:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-032:d")).toBe("power");
    expect(zoneOf(r.state, "player1", "XG2-034:b")).toBe("power");
    expect(canStartRush(board([inst("XG2-032", "d"), inst("XG2-034", "b")], 6), "player1", "XG2-035:h")).toBe(false);
  });

  it("XG2-035: 追加条件（合体）— デカレンジャーロボのかわりにデカマシン（XG2-031）でもよい（出典: atwiki/page-1820「（またはデカマシン）」）", () => {
    const r = rushFromHand(board([inst("XG2-031", "d"), inst("XG2-034", "b")]), "player1", "XG2-035:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-031:d")).toBe("power");
    expect(zoneOf(r.state, "player1", "XG2-034:b")).toBe("power");
  });

  it("XG2-035: ※ブラスト — 残りダメージ1点（ダメージ6点）で自軍 L ユニットがなければ、合体ユニットなしでラッシュできる。ダメージ5点ではできない（出典: atwiki/page-1820「※ブラスト」・R-KW-BLAST-01）", () => {
    const mk = (dmg: number) => rushBoard({ hand: [inst("XG2-035", "h")], power: [...damageCards(dmg), ...powerCards(9 - dmg)], damage: dmg, command: releasedCat("OT", 1) });
    expect(canStartRush(mk(6), "player1", "XG2-035:h")).toBe(true);
    expect(canStartRush(mk(5), "player1", "XG2-035:h")).toBe(false);
  });

  const launch = (dmg = 6) =>
    enter(
      p1Battle(
        { rush: [inst("XG2-035", "fc")], power: [...damageCards(dmg), ...powerCards(3)], damage: dmg },
        { battle: [inst("TST-UNIT-0", "e")], rush: [inst("TST-UNIT-7", "r")], power: powerCards(2, "ep") },
      ),
      "XG2-035:fc",
    );

  it("XG2-035: 【フルブラストランチャー】残りダメージ1点なら、自軍ターン中にバトルエリアに出たとき、オモテ向きの自軍パワー（ダメージは選べない）を好きな枚数選び捨札にできる（任意）（出典: atwiki/page-1820「オモテ向きの自軍パワーを好きな枚数選び捨札にしてもよい」）", () => {
    const s = launch();
    expectChoiceFrom(s, "player1", "XG2-035");
    expect(choiceIds(s)).toEqual(["TST-P:pw0", "TST-P:pw1", "TST-P:pw2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-035: 【フルブラストランチャー】捨札にした枚数（2枚）だけ、敵軍ユニット（エリア・サイズを問わない）か敵軍パワーゾーンのカードを選び捨札にする（出典: atwiki/page-1820「捨札にしたカード1枚につき、敵軍ユニット1体か敵軍パワーゾーンのカードを1枚選び捨札にする」・カード評価「サイズ・エリアを無視して」）", () => {
    let s = launch();
    expectChoiceFrom(s, "player1", "XG2-035");
    s = resolveAll(s, ["TST-P:pw0", "TST-P:pw1", "TST-UNIT-7:r", "TST-P:ep0"]);
    expect(zoneOf(s, "player1", "TST-P:pw0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:pw1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:r")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-P:ep0")).toBe("discard");
  });

  it("XG2-035: 【フルブラストランチャー】残りダメージ2点（ダメージ5点）なら発動しない（出典: atwiki/page-1820「残りダメージ1点なら」）", () => {
    const s = resolveAll(launch(5));
    expect(s.players.player1.power.filter((c) => !c.faceDown)).toHaveLength(3);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-7:r")).toBe("rush");
  });
});

// ===========================================================================
describe("XG2-036 トラシンケンオー", () => {
  const TEXT =
    "【虎ドリル突撃】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP8000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置いてもよい。そうしたとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-1755）", () => {
    expectCatalogText("XG2-036", TEXT);
    expectUnit("XG2-036", { name: "トラシンケンオー", category: "MA", size: "L", bp: 17500, sp: undefined, powerCost: "14-", features: ["侍", "人型"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-036", ["N"]);
  });

  it("XG2-036: 追加条件 — 自軍「シンケンオー」（RS-679）1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1755「追加条件：自軍「シンケンオー」1体を捨札にすれば必要パワー0になる」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("XG2-036", "h")], rush: [inst("RS-679", "so")], command: releasedCat("MA", 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", "XG2-036:h", (a) => a.zordMaterialInstanceId === "RS-679:so");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-036:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-679:so")).toBe("discard");
  });

  it("XG2-036: 必要パワー14- — 「シンケンオー」がいなければパワー14でラッシュでき、13ではできない（出典: atwiki/page-1755「必要パワー：14-」・R-ADD-02）", () => {
    const mk = (n: number) => rushBoard({ hand: [inst("XG2-036", "h")], power: powerCards(n), command: releasedCat("MA", 1) });
    expect(canStartRush(mk(13), "player1", "XG2-036:h")).toBe(false);
    const r = rushFromHand(mk(14), "player1", "XG2-036:h");
    expect(r.ok, r.error).toBe(true);
  });

  const drill = () =>
    enter(
      p1Battle(
        { rush: [inst("XG2-036", "t")] },
        {
          battle: [inst("TST-UNIT-0", "e"), inst("SPEC-BP8000", "e8"), inst("TST-UNIT-7", "big")],
          rush: [inst("SPEC-BP4000", "r4"), inst("SPEC-BP5000", "r5")],
        },
        EXTRA,
      ),
      "XG2-036:t",
    );

  it("XG2-036: 【虎ドリル突撃】自軍ターン中にバトルエリアに出たとき、まず敵軍バトルエリアの BP8000 以下のユニット（サイズを問わない）から1体選べる。任意（出典: atwiki/page-1755「敵軍バトルエリアからBP8000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = drill();
    expectChoiceFrom(s, "player1", "XG2-036");
    expect(choiceIds(s)).toEqual(["SPEC-BP8000:e8", "TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-036: 【虎ドリル突撃】バトルエリアのユニットを置いたときは、続けて敵軍ラッシュエリアの BP4000 以下のユニットを1体選び（強制）、どちらも持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1755「そうしたとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び持ち主のパワーゾーンにダメージにして置く」・カード評価「バトルエリアとラッシュエリアのユニットを一気に除去する」）", () => {
    let s = settle(pick(drill(), "SPEC-BP8000:e8"));
    expectChoiceFrom(s, "player1", "XG2-036");
    expect(choiceIds(s)).toEqual(["SPEC-BP4000:r4"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(s, ["SPEC-BP4000:r4"]);
    for (const id of ["SPEC-BP8000:e8", "SPEC-BP4000:r4"]) {
      expect(zoneOf(s, "player2", id)).toBe("power");
      expect(cardIn(s, "player2", id)?.faceDown).toBe(true);
    }
    expect(damageOf(s, "player2")).toBe(2);
  });

  it("XG2-036: 【虎ドリル突撃】バトルエリアのユニットを置かなければ、ラッシュエリアのユニットも置かない（出典: atwiki/page-1755「…置いてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(drill()));
    expect(zoneOf(s, "player2", "SPEC-BP4000:r4")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG2-037 スーパーシンケンレッド", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札から「シンケンレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 【スーパーシンケンマル】DAを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG2-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-1853）", () => {
    expectCatalogText("XG2-037", TEXT);
    expectUnit("XG2-037", { name: "スーパーシンケンレッド", category: "MA", size: "S", bp: 4500, sp: 1, powerCost: "7-", comboNumber: 1, features: ["レッド", "男", "侍"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-037", ["SR"]);
  });

  zordDownTests("XG2-037", "RS-674", "シンケンレッド", "atwiki/page-1853", "MA");
  reanimateTests("XG2-037", "RS-674", "シンケンレッド", "atwiki/page-1853");

  const nc = () => ncEnter("XG2-037:b", 0, {}, { battle: [inst("SPEC-DA-S", "x"), inst("SPEC-DA-M", "m"), inst("TST-UNIT-0", "y")], rush: [inst("SPEC-DA-S", "z")] }, EXTRA);

  it("XG2-037: 【スーパーシンケンマル】NC で、DA を持つ敵軍 S ユニット（ラッシュエリア・バトルエリア）から1体選ぶ（強制）。DA を持たないユニット・M ユニットは選べない（出典: atwiki/page-1853「DAを持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG2-037");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:x", "SPEC-DA-S:z"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG2-037: 【スーパーシンケンマル】選んだユニットを撃破する（出典: atwiki/page-1853）", () => {
    const s = resolveAll(pick(nc(), "SPEC-DA-S:z"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:z")).toBe("discard");
  });

  it("XG2-037: SP1 は印刷の値なので、NC しなくても（バトルエリアの2番目）ストライクで1点与えられる（出典: atwiki/page-1853「SP：1」・カード評価「ナンバーに関係なくストライクできる」）", () => {
    expect(spOf(settle(ncEnter("XG2-037:b", 1)), "player1", "XG2-037:b")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-038 スーパーシンケンブルー", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札から「シンケンブルー」のカードを1枚選び、自軍ラッシュエリアに出す。 【真・水流の舞い】これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("XG2-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-1854）", () => {
    expectCatalogText("XG2-038", TEXT);
    expectUnit("XG2-038", { name: "スーパーシンケンブルー", category: "MA", size: "S", bp: 3500, sp: undefined, powerCost: "7-", comboNumber: 2, features: ["ブルー", "男", "侍"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-038", ["R"]);
  });

  zordDownTests("XG2-038", "RS-675", "シンケンブルー", "atwiki/page-1854", "MA");
  reanimateTests("XG2-038", "RS-675", "シンケンブルー", "atwiki/page-1854");

  it("XG2-038: 【真・水流の舞い】NC（バトルエリアの2番目）で、敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1854「これは敵軍ラッシュエリアのユニットにアタックできる」・カード評価「ナンバーが２なので序盤から効果を発動しやすい」）", () => {
    const s = settle(ncEnter("XG2-038:b", 1, {}, { rush: [inst("TST-UNIT-0", "r")], battle: [inst("TST-UNIT-0", "e")] }));
    expect(attackTargets(s, "XG2-038:b")).toContain("TST-UNIT-0:r");
    const t = resolveAll(attack(s, "XG2-038:b", "TST-UNIT-0:r"));
    expect(zoneOf(t, "player2", "TST-UNIT-0:r")).toBe("discard");
  });

  it("XG2-038: 【真・水流の舞い】NC しなければ（バトルエリアの1番目）敵軍ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-1854・R-CN-02。RS-675 シンケンブルー【ウォーターアロー】と同じ）", () => {
    const s = settle(ncEnter("XG2-038:b", 0, {}, { rush: [inst("TST-UNIT-0", "r")], battle: [inst("TST-UNIT-0", "e")] }));
    expect(attackTargets(s, "XG2-038:b")).not.toContain("TST-UNIT-0:r");
    expect(attackTargets(s, "XG2-038:b")).toContain("TST-UNIT-0:e");
  });
});

// ===========================================================================
describe("XG2-039 スーパーシンケンピンク", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札から「シンケンピンク」のカードを1枚選び、自軍ラッシュエリアに出す。 【真・天空の舞い】「SP1」自分は1枚ドローする。";

  it("XG2-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-1756）", () => {
    expectCatalogText("XG2-039", TEXT);
    expectUnit("XG2-039", { name: "スーパーシンケンピンク", category: "MA", size: "S", bp: 2500, sp: "special", powerCost: "7-", comboNumber: 3, features: ["ピンク", "女", "侍"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-039", ["N"]);
  });

  zordDownTests("XG2-039", "RS-676", "シンケンピンク", "atwiki/page-1756", "MA");
  reanimateTests("XG2-039", "RS-676", "シンケンピンク", "atwiki/page-1756");

  it("XG2-039: 【真・天空の舞い】NC（バトルエリアの3番目）で「SP1」を得る。NC しなければ SP は「！」のまま（出典: atwiki/page-1756「「SP1」」・R-CN-01）", () => {
    expect(spOf(resolveAll(ncEnter("XG2-039:b", 2)), "player1", "XG2-039:b")).toBe(1);
    expect(spOf(resolveAll(ncEnter("XG2-039:b", 0)), "player1", "XG2-039:b")).toBe(0);
  });

  it("XG2-039: 【真・天空の舞い】NC で、自分は1枚ドローする（相手はドローしない）（出典: atwiki/page-1756「自分は1枚ドローする」・コメント「相手の手札を増やさないところはパワーアップ前にはない違い」）", () => {
    const s = resolveAll(ncEnter("XG2-039:b", 2));
    expect(handN(s, "player1")).toBe(1);
    expect(handN(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG2-040 スーパーシンケングリーン", () => {
  const TEXT = "※レジスト ※これが撃破されて捨札になったとき、自軍捨札から「シンケングリーン」のカードを1枚選び、自軍ラッシュエリアに出す。 【真・木枯らしの舞い】「SP1」";

  it("XG2-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-1757）", () => {
    expectCatalogText("XG2-040", TEXT);
    expectUnit("XG2-040", { name: "スーパーシンケングリーン", category: "MA", size: "S", bp: 5500, sp: "special", powerCost: "7-", comboNumber: 3, features: ["グリーン", "男", "侍"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-040", ["NR"]);
  });

  zordDownTests("XG2-040", "RS-677", "シンケングリーン", "atwiki/page-1757", "MA");
  reanimateTests("XG2-040", "RS-677", "シンケングリーン", "atwiki/page-1757");

  it("XG2-040: 【真・木枯らしの舞い】NC（バトルエリアの3番目）で「SP1」を得る。NC しなければ SP は「！」のまま（出典: atwiki/page-1757「「SP1」」・R-CN-01）", () => {
    expect(spOf(resolveAll(ncEnter("XG2-040:b", 2)), "player1", "XG2-040:b")).toBe(1);
    expect(spOf(resolveAll(ncEnter("XG2-040:b", 0)), "player1", "XG2-040:b")).toBe(0);
  });

  it("XG2-040: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1757「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-040", "g")] }, "XG2-040:g"))).toBe(true);
  });
});

// ===========================================================================
describe("XG2-041 スーパーシンケンイエロー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「シンケンイエロー」のカードを1枚選び、自軍ラッシュエリアに出す。 【真・土煙の舞い】このターン、次に自軍Sユニットが撃破されて捨札になったとき、そのカードを手札に戻してもよい。そうしたとき、手札に戻したカードと同名のカードを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。";

  it("XG2-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-1758）", () => {
    expectCatalogText("XG2-041", TEXT);
    expectUnit("XG2-041", { name: "スーパーシンケンイエロー", category: "MA", size: "S", bp: 1500, sp: undefined, powerCost: "7-", comboNumber: 1, features: ["イエロー", "女", "侍"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-041", ["N"]);
  });

  zordDownTests("XG2-041", "RS-678", "シンケンイエロー", "atwiki/page-1758", "MA");
  reanimateTests("XG2-041", "RS-678", "シンケンイエロー", "atwiki/page-1758");

  /** NC（1番目）で【真・土煙の舞い】を発動し、自軍の TST-UNIT-0 を BP13000 の敵軍ユニットにアタックさせて撃破させる。 */
  const sacrificed = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    let s = settle(ncEnter("XG2-041:b", 0, { ...p1, rush: [inst("TST-UNIT-0", "a"), ...(p1.rush ?? [])] }, { battle: [inst("TST-UNIT-7", "big"), inst("TST-UNIT-7", "big2")] }));
    s = enter(passEntry(s), "TST-UNIT-0:a");
    return settle(attack(s, "TST-UNIT-0:a", "TST-UNIT-7:big"));
  };

  it("XG2-041: 【真・土煙の舞い】NC したターン、次に自軍 S ユニットが撃破されて捨札になったとき、そのカードを手札に戻すかを選べる（任意）。戻すと手札に加わる（出典: atwiki/page-1758「次に自軍Sユニットが撃破されて捨札になったとき、そのカードを手札に戻してもよい」）", () => {
    let s = sacrificed();
    expectChoiceFrom(s, "player1", "XG2-041");
    expect(canSkip(s)).toBe(true);
    s = settle(accept(s, s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:a") ? "TST-UNIT-0:a" : undefined));
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("hand");
  });

  it("XG2-041: 【真・土煙の舞い】戻したとき、戻したカードと同名のカードを手札から1枚選び、自軍ラッシュエリアに出せる（戻したカード自身も選べる）（出典: atwiki/page-1758「手札に戻したカードと同名のカードを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい」・コメント「手札に戻した段階で同名カードは１枚ある」）", () => {
    let s = sacrificed();
    s = settle(accept(s, s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:a") ? "TST-UNIT-0:a" : undefined));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG2-041");
    s = resolveAll(s, ["TST-UNIT-0:a"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("rush");
  });

  it("XG2-041: 【真・土煙の舞い】戻さなければ、そのあとに撃破された自軍 S ユニットも戻せない（効くのは「次に」撃破された1体だけ）（出典: atwiki/page-1758「次に自軍Sユニットが撃破されて」・カード評価「発動しないことを選択した場合も、それ以降撃破されたユニットを回収することはできない」）", () => {
    let s = sacrificed({ rush: [inst("TST-UNIT-0", "c")] });
    expectChoiceFrom(s, "player1", "XG2-041");
    s = settle(skip(s));
    s = enter(passEntry(s), "TST-UNIT-0:c");
    s = settle(attack(s, "TST-UNIT-0:c", "TST-UNIT-7:big2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-041");
    expect(zoneOf(s, "player1", "TST-UNIT-0:c")).toBe("discard");
  });

  /** NC（1番目）で発動し、これ自身を BP13000 の敵軍ユニットにアタックさせて撃破させる。 */
  const selfDestroyed = (p1: Partial<GameState["players"]["player1"]>) => {
    const s = settle(ncEnter("XG2-041:b", 0, p1, { battle: [inst("TST-UNIT-7", "big")] }));
    return settle(attack(s, "XG2-041:b", "TST-UNIT-7:big"));
  };
  const returnSelf = (s: GameState) => {
    let n = s;
    for (let i = 0; i < 4 && n.pendingEffectChoice && !n.pendingEffectChoice.validInstanceIds.includes("XG2-041:b"); i++) n = settle(accept(n));
    return n.pendingEffectChoice ? settle(pick(n, "XG2-041:b")) : n;
  };

  it("XG2-041: 【真・土煙の舞い】手札から出すときも必要パワーは満たすこと（パワー6・「シンケンイエロー」なしでは、手札に戻した XG2-041（7-）を出せない）（出典: atwiki/page-1758「ただし、必要パワーと追加条件は満たすこと」）", () => {
    let s = returnSelf(selfDestroyed({ power: powerCards(6), command: releasedCat("MA", 1) }));
    expect(zoneOf(s, "player1", "XG2-041:b")).toBe("hand");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG2-041:b")).toBe("hand");
  });

  it("XG2-041: 【真・土煙の舞い】パワー7なら、手札に戻した XG2-041 を自軍ラッシュエリアに出せる（出典: atwiki/page-1758）", () => {
    let s = returnSelf(selfDestroyed({ power: powerCards(7), command: releasedCat("MA", 1) }));
    s = resolveAll(s, ["XG2-041:b"]);
    expect(zoneOf(s, "player1", "XG2-041:b")).toBe("rush");
  });

  it("XG2-041: カード評価のループ — パワー0でも、※で自軍捨札の「シンケンイエロー」がラッシュエリアに出ていれば、それを捨札にして（追加条件）手札に戻した XG2-041 をラッシュエリアに出せる（出典: atwiki/page-1758 カード評価「自身の効果で手札に戻りシンケンイエローを捨てて再ラッシュ」）", () => {
    let s = selfDestroyed({ discard: [inst("RS-678", "y")], command: releasedCat("MA", 1) });
    s = returnSelf(resolveAll(s, ["RS-678:y"], 1));
    s = resolveAll(s, ["XG2-041:b", "RS-678:y"]);
    expect(zoneOf(s, "player1", "XG2-041:b")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-678:y")).toBe("discard");
  });

  it("XG2-041: 公式Q&A — RS-382 ビクトリーロボは、このターンに【真・土煙の舞い】で自軍捨札から手札に加えた XG2-041 の枚数だけ SP+1 される（出典: atwiki/page-1758 Q1「はい、できます」）", () => {
    let s = returnSelf(selfDestroyed({ power: powerCards(7), command: releasedCat("MA", 1), rush: [inst("RS-382", "vr")] }));
    s = resolveAll(s, ["XG2-041:b"]);
    s = enter(passEntry(s), "RS-382:vr");
    expect(spOf(settle(s), "player1", "RS-382:vr")).toBe(2);
  });

});
