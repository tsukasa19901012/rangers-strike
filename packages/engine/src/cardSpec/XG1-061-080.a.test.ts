/**
 * カード別スペック: XG1-061〜XG1-067（クロスギャザー ザ・ファーストエンカウント 仮面ライダーカリス〜ディケイド ブレイド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。本範囲に atwiki へ転載された公式 Q&A はない
 *     （「○○としてつかえる」は atwiki/page-1668 Q1〈XG1-068〉の公式回答「山札、手札、エリア、ゾーン、常駐置き場、捨札などの全ての場にあるとき常に有効」に従う）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-MORPH、05-battle-strike-damage「1/2」等の SP）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: errataCardEffects（XG1-062）、XP-001-016.a（XG1-064 をカメンライドの置き換え先として使う）、
 * BK1-001-019.b・rulesSpec/06-effects-timing（XG1-065・066）、BK1-001-019.c（XG1-067 を手札として使う）。本ファイルはカード自身の効果を見る。
 */
import { describe, expect, it } from "vitest";
import {
  PLAIN_VEHICLE,
  canSkip,
  canStrike,
  choiceIds,
  enteredFromRush,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  fill,
  inst,
  isHeldCard,
  ncAt,
  p1Battle,
  pick,
  powerCards,
  rcAt,
  reanimateTests,
  registerOffered,
  attackUntilRegister,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  rushVia,
  skip,
  spOf,
  sUnit,
  zoneOf,
  zordDownTests,
  act,
} from "./XG1-061-080.helpers";

const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const DAS = sUnit("SPEC-DAS", { category: "DA" });
const B6 = sUnit("SPEC-B6", { bp: 6000 });
const B45 = sUnit("SPEC-B45", { bp: 4500 });
const B15 = sUnit("SPEC-B15", { bp: 1500 });
const B4 = sUnit("SPEC-B4", { bp: 4000 });
const DRG = sUnit("SPEC-DRG", { features: ["ドラゴン"] });
const EXTRA = [PLAIN_VEHICLE, C3, C6, DAS, B6, B45, B15, B4, DRG];

const DCD = ["仮面ライダー", "男", "ディケイドライバー"];

// ===========================================================================
describe("XG1-061 仮面ライダーカリス", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 【スピニングウェーブ】自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍コマンドをすべてホールドする。その後、見せたカードの必要パワーの数字が「3」と「6」なら、敵軍バトルエリアからSユニットを1体選び撃破する。";

  it("XG1-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-1639）", () => {
    expectCatalogText("XG1-061", TEXT);
    expectUnitStats("XG1-061", { name: "仮面ライダーカリス", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: ["アンデッド", "仮面ライダー", "男"] });
    expectRarityIn("XG1-061", ["NR"]);
  });

  const rc = (hand = [inst("SPEC-C3", "h3"), inst("SPEC-C6", "h6"), inst("TST-OP", "x")]) =>
    rcAt("XG1-061:ka", { hand }, { command: releasedCat("WB", 2, "ec"), battle: [inst("TST-UNIT-0", "b")] }, EXTRA);

  it("XG1-061: ※ ライドオフしたときはストライクできない（ライドせずに2番目に出れば SP1 でストライクできる）（出典: atwiki/page-1639「※これはライドオフしたときストライクできない」）", () => {
    expect(canStrike(resolveAll(rc()), "XG1-061:ka")).toBe(false);
    expect(canStrike(enteredFromRush("XG1-061:ka", { battle: fill(1) }), "XG1-061:ka")).toBe(true);
  });

  it.fails("XG1-061: 【スピニングウェーブ】RC — 手札を2枚見せるかを選べ（任意）、見せると敵軍コマンドがすべてホールドされる（既知の不具合: CARD-XG1-061 手札を見せる選択がなく、敵軍コマンドもホールドされない）（出典: atwiki/page-1639「自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍コマンドをすべてホールドする」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-061");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toContain("SPEC-C3:h3");
    const t = resolveAll(s, ["SPEC-C3:h3", "SPEC-C6:h6", "TST-UNIT-0:b"]);
    expect(isHeldCard(t, "player2", "TST-OP:ec0")).toBe(true);
    expect(isHeldCard(t, "player2", "TST-OP:ec1")).toBe(true);
  });

  it.fails("XG1-061: 見せた2枚の必要パワーが「3」と「6」でなければ、敵軍ユニットは撃破されない（既知の不具合: CARD-XG1-061 条件を見ずに撃破の選択が開く）（出典: atwiki/page-1639「見せたカードの必要パワーの数字が「3」と「6」なら」）", () => {
    const s = resolveAll(rc([inst("SPEC-C3", "h3"), inst("TST-OP", "x"), inst("TST-OP", "y")]), ["SPEC-C3:h3", "TST-OP:x", "TST-UNIT-0:b"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b")).toBe("battle");
  });

  it("XG1-061: 見せた2枚が「3」と「6」なら、敵軍バトルエリアの S ユニットを1体撃破する（出典: atwiki/page-1639「敵軍バトルエリアからSユニットを1体選び撃破する」）", () => {
    const s = resolveAll(rc(), ["SPEC-C3:h3", "SPEC-C6:h6", "TST-UNIT-0:b"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-062 仮面ライダーワイルドカリス", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーカリス」のカードを1枚選び、自軍ラッシュエリアに出す。 【ワイルドサイクロン】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSユニットを好きな数選び、ホールドしてもよい。そうしたとき、ホールドしたユニットのBPを合計して、BP10000ごとに相手に1点ダメージを与える。";

  it("XG1-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-1667）", () => {
    expectCatalogText("XG1-062", TEXT);
    expectUnitStats("XG1-062", { name: "仮面ライダーワイルドカリス", category: "WB", size: "S", bp: 4500, sp: "1/2", powerCost: "7-", features: ["アンデッド", "仮面ライダー", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG1-062", ["SR"]);
  });

  zordDownTests("XG1-062", "XG1-061", "仮面ライダーカリス", "atwiki/page-1667", "WB");
  reanimateTests("XG1-062", "XG1-061", "仮面ライダーカリス", "atwiki/page-1667");

  const entered = () => enteredFromRush("XG1-062:wc", {}, { battle: [inst("SPEC-B6", "a"), inst("SPEC-B45", "b"), inst("TST-UNIT-0", "c")] }, EXTRA);

  it("XG1-062: 【ワイルドサイクロン】自軍ターンにバトルエリアに出たとき、敵軍バトルエリアの S ユニットを選ぶ選択が開く（任意）（出典: atwiki/page-1667「Sユニットを好きな数選び、ホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-062");
    expect(canSkip(s)).toBe(true);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-B45:b", "SPEC-B6:a", "TST-UNIT-0:c"]);
  });

  it("XG1-062: 選んだユニット（BP6000＋4500＋1000＝11500）をホールドし、BP10000 ごとに1点（1点）のダメージを与える（出典: atwiki/page-1667「ホールドしたユニットのBPを合計して、BP10000ごとに相手に1点ダメージを与える」）", () => {
    const s = resolveAll(entered(), ["SPEC-B6:a", "SPEC-B45:b", "TST-UNIT-0:c"]);
    expect(isHeldCard(s, "player2", "SPEC-B6:a")).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG1-062: ホールドしなければダメージは与えない（出典: atwiki/page-1667「してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(isHeldCard(s, "player2", "SPEC-B6:a")).toBe(false);
    expect(s.players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("XG1-063 シャドーチェイサー", () => {
  const TEXT = "【トルネードチェイサー】これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒敵軍コマンドを1つ選びホールドする。";

  it("XG1-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-1606）", () => {
    expectCatalogText("XG1-063", TEXT);
    expectVehicleStats("XG1-063", { name: "シャドーチェイサー", category: "WB", powerCost: 0, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG1-063", ["N"]);
  });

  /** 仮面ライダー響鬼（RK-221）の NC で手札のオペレーションを捨札にする。自軍ラッシュエリアに rush。 */
  const discarded = (rush: ReturnType<typeof inst>[]) =>
    ncAt("RK-221:hb", 1, { rush, hand: [inst("TST-OP", "op")] }, { command: releasedCat("WB", 1, "ec") }, EXTRA);

  it.fails("XG1-063: 【トルネードチェイサー】ライドしたユニットがある間に手札のカードが捨札に置かれると、敵軍コマンドを1つホールドする効果を発動できる（既知の不具合: CARD-XG1-063 発動の機会がない）（出典: atwiki/page-1606「自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒敵軍コマンドを1つ選びホールドする」）", () => {
    const s = resolveAll(discarded([inst("XG1-063", "sc"), { ...inst("XG1-061", "ka"), mountedOnInstanceId: "XG1-063:sc" }]), ["TST-OP:op", "accept", "TST-OP:ec0"]);
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expect(isHeldCard(s, "player2", "TST-OP:ec0")).toBe(true);
  });

  it("XG1-063: ライドしたユニットがなければ、手札のカードを捨てても敵軍コマンドはホールドされない（出典: atwiki/page-1606「これにライドしたユニットがある間」）", () => {
    const s = resolveAll(discarded([inst("XG1-063", "sc")]), ["TST-OP:op"]);
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expect(isHeldCard(s, "player2", "TST-OP:ec0")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-064 ディケイド アギトGF", () => {
  const TEXT = "※モーフ ※レジスト ※これは「仮面ライダーアギトGF」としてつかえる。 【アタックライド】DAを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG1-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-1603）", () => {
    expectCatalogText("XG1-064", TEXT);
    expectUnitStats("XG1-064", { name: "ディケイド アギトGF", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-064", ["N"]);
  });

  it("XG1-064: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1603「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-064", "dg")] }, "XG1-064:dg"))).toBe(true);
  });

  it.fails("XG1-064: ※「仮面ライダーアギトGF」としてつかえる — アギトTF（XG1-052）の追加条件「自軍「仮面ライダーアギトGF」1体を捨札にすれば必要パワー0」の素材にできる（既知の不具合: CARD-XG1-064 素材の候補にならない）（出典: atwiki/page-1603「これは「仮面ライダーアギトGF」としてつかえる」・atwiki/page-1668 Q1「全ての場にあるとき常に有効であり、特定のカード名を指定する効果の対象として選ぶことが出来ます」）", () => {
    const r = rushVia(rushPhaseBoard({ hand: [inst("XG1-052", "tf")], rush: [inst("XG1-064", "dg")], command: releasedCat("MA", 1) }), "player1", "XG1-052:tf", (a) => a.zordMaterialInstanceId === "XG1-064:dg");
    expect(r.ok).toBe(true);
  });

  const rc = () => rcAt("XG1-064:dg", {}, { battle: [inst("SPEC-DAS", "d"), inst("TST-UNIT-0", "w")], rush: [inst("SPEC-DAS", "dr")] }, EXTRA);

  it("XG1-064: 【アタックライド】RC — DA の敵軍 S ユニットを選んで撃破する（見送れない）（出典: atwiki/page-1603「DAを持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-064");
    expect(canSkip(s)).toBe(false);
    expect(zoneOf(pick(s, "SPEC-DAS:d"), "player2", "SPEC-DAS:d")).toBe("discard");
  });

  it.fails("XG1-064: 候補は DA を持つ敵軍 S ユニットだけ（WB のユニットは選べない）（既知の不具合: CARD-XG1-064 DA を持たないユニットも候補になる）（出典: atwiki/page-1603「DAを持つ敵軍Sユニット」）", () => {
    expect([...choiceIds(rc())].sort()).toEqual(["SPEC-DAS:d", "SPEC-DAS:dr"]);
  });
});

// ===========================================================================
describe("XG1-065 ディケイド 龍騎", () => {
  const TEXT = "※モーフ ※これは「仮面ライダー龍騎」としてつかえる。 【アタックライド】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」";

  it("XG1-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-1636）", () => {
    expectCatalogText("XG1-065", TEXT);
    expectUnitStats("XG1-065", { name: "ディケイド 龍騎", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 5, features: DCD });
    expectRarityIn("XG1-065", ["NR"]);
  });

  it.fails("XG1-065: 【アタックライド】特徴「ドラゴン」のユニットの次に（3番目に）並ぶと、このターン SP1 を得る（既知の不具合: CARD-XG1-065 SP を得ない）（出典: atwiki/page-1636「特徴「ドラゴン」を持つユニットからコンビネーションするとき…「SP1」」）", () => {
    const s = enteredFromRush("XG1-065:ry", { battle: [...fill(1), inst("SPEC-DRG", "dr")] }, {}, EXTRA);
    expect(spOf(s, "player1", "XG1-065:ry")).toBe(1);
  });

  it("XG1-065: 「ドラゴン」を持たないユニットの次の3番目では SP を持たない（出典: atwiki/page-1636・SP「1/2」）", () => {
    const s = enteredFromRush("XG1-065:ry", { battle: fill(2) }, {}, EXTRA);
    expect(spOf(s, "player1", "XG1-065:ry")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-066 ディケイド ファイズ", () => {
  const TEXT = "※モーフ ※これは「仮面ライダーファイズ」としてつかえる。 【アタックライド】BPの下三桁が500の敵軍Sユニットを1体選び撃破する。";

  it("XG1-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-1626）", () => {
    expectCatalogText("XG1-066", TEXT);
    expectUnitStats("XG1-066", { name: "ディケイド ファイズ", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-066", ["NR"]);
  });

  const rc = () => rcAt("XG1-066:fz", {}, { battle: [inst("SPEC-B45", "a"), inst("SPEC-B15", "b"), inst("TST-UNIT-0", "c")], rush: [inst("SPEC-B45", "r")] }, EXTRA);

  it("XG1-066: 【アタックライド】RC — BP の下三桁が500 の敵軍 S ユニットを選んで撃破する（見送れない）（出典: atwiki/page-1626「BPの下三桁が500の敵軍Sユニットを1体選び撃破する」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-066");
    expect(canSkip(s)).toBe(false);
    expect(zoneOf(pick(s, "SPEC-B15:b"), "player2", "SPEC-B15:b")).toBe("discard");
  });

  it.fails("XG1-066: 候補は BP の下三桁が500 の S ユニット（BP4500・1500。敵軍ラッシュエリアも含む）だけで、BP1000 は選べない（既知の不具合: CARD-XG1-066 BP1000 が候補に入り、ラッシュエリアのユニットが入らない）（出典: atwiki/page-1626「敵軍Sユニット」・RK-064 の「敵軍バトルエリアから」の限定がない）", () => {
    expect([...choiceIds(rc())].sort()).toEqual(["SPEC-B15:b", "SPEC-B45:a", "SPEC-B45:r"]);
  });
});

// ===========================================================================
describe("XG1-067 ディケイド ブレイド", () => {
  const TEXT =
    "※モーフ ※これは「仮面ライダーブレイド」としてつかえる。 【アタックライド】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの持つカテゴリがすべて同じなら、敵軍バトルエリアからSユニットを1体選び撃破する。";

  it("XG1-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-1605）", () => {
    expectCatalogText("XG1-067", TEXT);
    expectUnitStats("XG1-067", { name: "ディケイド ブレイド", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-067", ["N"]);
  });

  it.fails("XG1-067: ※「仮面ライダーブレイド」としてつかえる — ブレイドKF（XG1-059）の追加条件「自軍「仮面ライダーブレイド」1体を捨札にする」の素材にできる（既知の不具合: CARD-XG1-067 ラッシュできない）（出典: atwiki/page-1605・atwiki/page-1546 カード評価「ディケイド ブレイドでも代用可能」・atwiki/page-1668 Q1）", () => {
    const r = rushFromHand(rushPhaseBoard({ hand: [inst("XG1-059", "kf")], rush: [inst("XG1-067", "bl")], command: releasedCat("WB", 1), power: powerCards(6) }), "player1", "XG1-059:kf");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-067:bl")).toBe("discard");
  });

  const rc = () =>
    rcAt("XG1-067:bl", { hand: [inst("TST-OP", "a"), inst("TST-OP", "b"), inst("TST-OP", "c"), inst("TST-OP-ET", "d")] }, { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it.fails("XG1-067: 【アタックライド】RC — 手札を3枚見せるかを選べる（任意）（既知の不具合: CARD-XG1-067 見せる選択がなく、すぐに敵軍ユニットの選択が開く）（出典: atwiki/page-1605「自分の手札を3枚選び、相手に見せてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-067");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toContain("TST-OP:a");
  });

  it.fails("XG1-067: 見せたとき、敵軍 S ユニット（ラッシュエリアも含む）を1体ホールドし、3枚のカテゴリがすべて同じなら敵軍バトルエリアの S ユニットを1体撃破する（既知の不具合: CARD-XG1-067）（出典: atwiki/page-1605「敵軍Sユニットを1体選びホールドする。その後、見せたカードの持つカテゴリがすべて同じなら…撃破する」）", () => {
    const s = resolveAll(rc(), ["TST-OP:a", "TST-OP:b", "TST-OP:c", "TST-UNIT-0:r", "TST-UNIT-0:a"]);
    expect(isHeldCard(s, "player2", "TST-UNIT-0:r")).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
  });

  it("XG1-067: ライドせずに出れば（RC が発動しなければ）何も起きない（出典: R-KW-RC-01）", () => {
    const s = act(p1Battle({ rush: [inst("XG1-067", "bl")] }, { battle: [inst("TST-UNIT-0", "a")] }), { type: "move_to_battle", playerId: "player1", instanceId: "XG1-067:bl" });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-067");
  });
});
