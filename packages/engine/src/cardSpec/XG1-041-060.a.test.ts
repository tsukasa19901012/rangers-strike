/**
 * カード別スペック: XG1-041〜XG1-047（クロスギャザー ザ・ファーストエンカウント 仮面ライダーアマゾン〜仮面ライダースーパー1）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。
 *     atwiki へ転載された公式 Q&A: page-1619 Q1（XG1-044）・page-1614 Q1・Q2（XG1-045。キャプテントンボーグとの順番で、本範囲では組み立てない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01 RC はライドオフしたとき、R-KW-MORPH-01〜03、05-battle-strike-damage「1/2」等の SP）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: BK1-001-019.a.test.ts（XG1-041・044・047 をサイクロン等の対象として使う。本ファイルはカード自身の効果を見る）。
 */
import { describe, expect, it } from "vitest";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enemyBoard,
  enemyRushes,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  featuresOf,
  fill,
  heldUnit,
  inst,
  isHeldCard,
  legal,
  morphCandidates,
  mount,
  p1Battle,
  pick,
  rcAt,
  rcUnit,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOff,
  rushPhaseBoard,
  settle,
  spOf,
  sUnit,
  targetsOf,
  zoneOf,
} from "./XG1-041-060.helpers";

const MAN = sUnit("SPEC-MAN", { bp: 1000, features: ["男"] });
const THING = sUnit("SPEC-THING", { bp: 1000, features: ["メカ"] });
const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 5000, features: ["怪人"] });
const S1 = sUnit("SPEC-S1", { bp: 2000 });
const S0 = sUnit("SPEC-S0", { bp: 3000, sp: undefined });
const B5 = sUnit("SPEC-B5", { bp: 5000 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const RCU = rcUnit("SPEC-RCU");
const EXTRA = [PLAIN_VEHICLE, MAN, THING, KAIJIN, S1, S0, B5, C6, RCU];

const RIDER_FEATURES = ["仮面ライダー", "男", "改造人間"];

// ===========================================================================
describe("XG1-041 仮面ライダーアマゾン", () => {
  const TEXT = "※レジスト 【ガガの腕輪】これをリリースする。";

  it("XG1-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-1543）", () => {
    expectCatalogText("XG1-041", TEXT);
    expectUnitStats("XG1-041", { name: "仮面ライダーアマゾン", category: ["WB", "MA"], size: "S", bp: 4000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("XG1-041", ["NR"]);
  });

  it("XG1-041: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1543「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-041", "am")] }, "XG1-041:am"))).toBe(true);
  });

  it("XG1-041: SP「1/2」— バトルエリアの2番目で SP1、3番目では SP を持たない（出典: atwiki/page-1543「SP：1/2」・05-battle-strike-damage）", () => {
    expect(spOf(p1Battle({ battle: [...fill(1), inst("XG1-041", "am")] }), "player1", "XG1-041:am")).toBe(1);
    expect(spOf(p1Battle({ battle: [...fill(2), inst("XG1-041", "am")] }), "player1", "XG1-041:am")).toBe(0);
  });

  it("XG1-041: 【ガガの腕輪】RC — ホールド状態でバトルエリアに出ても（敵軍のブラックファングでホールドされた）、ライドオフするとリリースされる（既知の不具合: CARD-XG1-057 ブラックファングでホールド状態にならず、前提の状態を作れない）（出典: atwiki/page-1543「【ガガの腕輪】これをリリースする」・カード評価「ウエイクアップ！などのホールド要員」・atwiki/page-1564「ライドしてバトルエリアに出たとき、ホールド状態になる」）", () => {
    let s = p1Battle(
      { rush: [inst("SPEC-VEHICLE", "v"), inst("XG1-041", "am")] },
      { rush: [inst("XG1-057", "bf"), { ...inst("TST-UNIT-0", "r"), mountedOnInstanceId: "XG1-057:bf" }] },
      EXTRA,
    );
    s = mount(s, "XG1-041:am", "SPEC-VEHICLE:v");
    expect(isHeldCard(s, "player1", "XG1-041:am")).toBe(true);
    s = resolveAll(rideOff(s, true));
    expect(isHeldCard(s, "player1", "XG1-041:am")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-042 十面鬼ゴルゴス", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【吸血】これが自軍エリアにある間、自軍ターン中、特徴「怪人」を持つ自軍ユニットが、特徴「男」または「女」を持つ敵軍ユニットを撃破したとき、このターン、これは「SP1」になる。";

  it("XG1-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-1586）", () => {
    expectCatalogText("XG1-042", TEXT);
    expectUnitStats("XG1-042", { name: "十面鬼ゴルゴス", category: "DA", size: "S", bp: 6000, sp: "special", powerCost: 5, features: ["ゲドン", "男", "改造人間"] });
    expectRarityIn("XG1-042", ["N"]);
  });

  it("XG1-042: ※ 敵軍ターン中、SP1 のユニットにアタックされると、バトルに勝っても撃破される（出典: atwiki/page-1586「バトルに勝っても撃破される」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-042", "gg")] }, "XG1-042:gg", {}, "TST-UNIT-0:atk");
    expect(zoneOf(s, "player1", "XG1-042:gg")).toBe("discard");
  });

  const kill = (target: string) =>
    settle(attack(p1Battle({ rush: [inst("XG1-042", "gg")], battle: [inst("SPEC-KAIJIN", "k")] }, { battle: [inst(target, "t")] }, EXTRA), "SPEC-KAIJIN:k", `${target}:t`));

  it("XG1-042: 【吸血】自軍ターンに特徴「怪人」の自軍ユニットが特徴「男」の敵軍ユニットを撃破すると、このターン「SP1」になる（既知の不具合: CARD-XG1-042 SP1 にならない）（出典: atwiki/page-1586「特徴「男」または「女」を持つ敵軍ユニットを撃破したとき、このターン、これは「SP1」になる」）", () => {
    const s = kill("SPEC-MAN");
    expect(zoneOf(s, "player2", "SPEC-MAN:t")).toBe("discard");
    expect(spOf(s, "player1", "XG1-042:gg")).toBe(1);
  });

  it("XG1-042: 「男」「女」を持たない敵軍ユニットを撃破しても SP を持たない（SP：！のまま）（出典: atwiki/page-1586・カード評価「特徴が合わないユニットしかいなくても」）", () => {
    const s = kill("SPEC-THING");
    expect(zoneOf(s, "player2", "SPEC-THING:t")).toBe("discard");
    expect(spOf(s, "player1", "XG1-042:gg")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-043 カメバズーカ", () => {
  const TEXT = "※レジスト 【砲撃】このユニットは、ホールド状態のとき敵軍ラッシュエリアのユニットにアタックできる。";

  it("XG1-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-1612）", () => {
    expectCatalogText("XG1-043", TEXT);
    expectUnitStats("XG1-043", { name: "カメバズーカ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 3, features: ["デストロン", "怪人", "男", "改造人間"] });
    expectRarityIn("XG1-043", ["N"]);
  });

  it("XG1-043: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1612「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-043", "kb")] }, "XG1-043:kb"))).toBe(true);
  });

  const enemy = { rush: [inst("TST-UNIT-0", "r")], battle: [inst("TST-UNIT-0", "b")] };

  it("XG1-043: 【砲撃】ホールド状態のとき、敵軍ラッシュエリアのユニットにもアタックできる（既知の不具合: CARD-XG1-043 ラッシュエリアのユニットがアタック先に出ない）（出典: atwiki/page-1612「ホールド状態のとき敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    expect([...targetsOf(p1Battle({ battle: [heldUnit("XG1-043", "kb")] }, enemy), "XG1-043:kb")].sort()).toEqual(["TST-UNIT-0:b", "TST-UNIT-0:r"]);
  });

  it("XG1-043: リリース状態のときは敵軍ラッシュエリアのユニットにアタックできない（出典: atwiki/page-1612「ホールド状態のとき」）", () => {
    expect(targetsOf(p1Battle({ battle: [inst("XG1-043", "kb")] }, enemy), "XG1-043:kb")).toEqual(["TST-UNIT-0:b"]);
  });
});

// ===========================================================================
describe("XG1-044 仮面ライダーV3", () => {
  const TEXT =
    "※レジスト ※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、自軍捨札に「仮面ライダー1号」のカードと「仮面ライダー2号」のカードがあれば、これを自軍ラッシュエリアに出してもよい。 【V3反転キック】敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンに置いてもよい。置けなければ捨札にする。このとき選んだユニットのSPが1以上だったなら、これはSP1になる。";

  it("XG1-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-1619）", () => {
    expectCatalogText("XG1-044", TEXT);
    expectUnitStats("XG1-044", { name: "仮面ライダーV3", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: "RC", features: RIDER_FEATURES });
    expectRarityIn("XG1-044", ["NR"]);
  });

  it("XG1-044: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1619「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-044", "v3")] }, "XG1-044:v3"))).toBe(true);
  });

  /** 自軍ラッシュフェイズ、コマンドゾーンに V3、捨札に discard。 */
  const fromCommand = (discard: ReturnType<typeof inst>[]) => rushPhaseBoard({ command: [inst("XG1-044", "v3")], discard }, {}, EXTRA);
  const selfRushActions = (s: ReturnType<typeof fromCommand>) =>
    legal(s).filter((a) => a.playerId === "player1" && "instanceId" in a && a.instanceId === "XG1-044:v3");

  it("XG1-044: ※ 自軍捨札に仮面ライダー1号（RK-023）と2号（RK-073）があれば、自軍ラッシュフェイズにコマンドゾーンから自軍ラッシュエリアに出せる（既知の不具合: CARD-XG1-044 出す手がない）（出典: atwiki/page-1619「これを自軍ラッシュエリアに出してもよい」・カード評価「コマンドから直接ラッシュできる」）", () => {
    const s = fromCommand([inst("RK-023", "g1"), inst("RK-073", "g2")]);
    const a = selfRushActions(s)[0];
    expect(a).toBeDefined();
    expect(zoneOf(resolveAll(act(s, a!)), "player1", "XG1-044:v3")).toBe("rush");
  });

  it("XG1-044: ※ 「仮面ライダー1号」「仮面ライダー2号」としてつかえる新1号（RK-175）・新2号（RK-176）でも満たす。XG7-032（「1号」または「2号」）1枚だけでは満たさない（出典: atwiki/page-1619「「仮面ライダー1号」のカードと「仮面ライダー2号」のカード」・atwiki/page-1668 Q1「としてつかえる」は全ての場で常に有効）", () => {
    expect(selfRushActions(fromCommand([inst("RK-175", "n1"), inst("RK-176", "n2")]))).not.toHaveLength(0);
    expect(selfRushActions(fromCommand([inst("XG7-032", "w"), inst("RK-073", "g2")]))).not.toHaveLength(0);
    expect(selfRushActions(fromCommand([inst("XG7-032", "w")]))).toHaveLength(0);
  });

  it("XG1-044: ※ 1号しかなければ、コマンドゾーンから出す手はない（出典: atwiki/page-1619「「仮面ライダー1号」のカードと「仮面ライダー2号」のカードがあれば」）", () => {
    expect(selfRushActions(fromCommand([inst("RK-023", "g1")]))).toHaveLength(0);
  });

  const rc = () => rcAt("XG1-044:v3", {}, { battle: [inst("SPEC-S1", "s1"), inst("SPEC-S0", "s0")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it("XG1-044: 【V3反転キック】RC — 敵軍バトルエリアの S ユニットから1体選べる（ラッシュエリアは対象外。任意）（既知の不具合: CARD-XG1-044 選択が開かない）（出典: atwiki/page-1619「敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンに置いてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-044");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-S0:s0", "SPEC-S1:s1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-044: 選んだ SP1 のユニットは持ち主のコマンドゾーンにリリース状態で置かれ、これは SP1 になる（既知の不具合: CARD-XG1-044）（出典: atwiki/page-1619「このとき選んだユニットのSPが1以上だったなら、これはSP1になる」・カード評価「リリース状態で置かれる」）", () => {
    const s = resolveAll(rc(), ["SPEC-S1:s1"]);
    expect(zoneOf(s, "player2", "SPEC-S1:s1")).toBe("command");
    expect(isHeldCard(s, "player2", "SPEC-S1:s1")).toBe(false);
    expect(spOf(s, "player1", "XG1-044:v3")).toBe(1);
  });

  it("XG1-044: Q&A — 敵軍コマンドゾーンが5枚で置けなくても（捨札になる）、選んだユニットの SP が1以上なら SP1 になる（既知の不具合: CARD-XG1-044）（出典: atwiki/page-1619 Q1「コマンドゾーンに送る、または捨札にすることができなくても、選ぶだけでSP1になります」・本文「置けなければ捨札にする」）", () => {
    const s = resolveAll(rcAt("XG1-044:v3", {}, { battle: [inst("SPEC-S1", "s1")], command: releasedCat("WB", 5, "fc") }, EXTRA), ["SPEC-S1:s1"]);
    expect(zoneOf(s, "player2", "SPEC-S1:s1")).toBe("discard");
    expect(spOf(s, "player1", "XG1-044:v3")).toBe(1);
  });

  it("XG1-044: SP を持たないユニットを選んだ（または選ばなかった）なら SP を持たない（出典: atwiki/page-1619「SPが1以上だったなら」）", () => {
    const s = resolveAll(rc(), ["SPEC-S0:s0"]);
    expect(spOf(s, "player1", "XG1-044:v3")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-045 イカファイア", () => {
  const TEXT =
    "【墨攻撃】これが自軍バトルエリアにある間、敵軍バトルエリアのユニットは特徴「ブラック」を追加され、次の制限を受ける⇒アタックするとき、バトルの前に自分自身の山札の上から1枚をオモテにする。そして、そのカードの必要パワーの数字が3以下なら、バトルは行われない。その後、オモテにしたカードは山札の下に戻す。";

  it("XG1-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-1614）", () => {
    expectCatalogText("XG1-045", TEXT);
    expectUnitStats("XG1-045", { name: "イカファイア", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 2, features: ["デストロン", "怪人", "男", "改造人間"] });
    expectRarityIn("XG1-045", ["N"]);
  });

  /** 敵軍（player2）バトルフェイズ。自軍バトルエリアにイカファイア、敵軍の山札の上は top。 */
  const board = (top: string) => enemyBoard({ battle: [inst("XG1-045", "ik")] }, { battle: [inst("TST-UNIT-0", "a")], deck: [inst(top, "top"), ...deckCards(3, "e")] }, EXTRA);

  it("XG1-045: 【墨攻撃】敵軍バトルエリアのユニットに特徴「ブラック」が追加される（既知の不具合: CARD-XG1-045 特徴が追加されない）（出典: atwiki/page-1614「敵軍バトルエリアのユニットは特徴「ブラック」を追加され」）", () => {
    expect(featuresOf(board("TST-OP"), "player2", "TST-UNIT-0:a")).toContain("ブラック");
  });

  it("XG1-045: 【墨攻撃】敵軍ユニットがアタックするとき山札の上が必要パワー3 のカードなら、バトルは行われず、そのカードは山札の下に戻る（既知の不具合: CARD-XG1-045 山札を見ずにバトルが行われる）（出典: atwiki/page-1614「そのカードの必要パワーの数字が3以下なら、バトルは行われない。その後、オモテにしたカードは山札の下に戻す」）", () => {
    const s = settle(attack(board("TST-OP"), "TST-UNIT-0:a", "XG1-045:ik", "player2"));
    expect(zoneOf(s, "player1", "XG1-045:ik")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("battle");
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("TST-OP:top");
  });

  it("XG1-045: 山札の上が必要パワー6 のカードなら、バトルは行われる（出典: atwiki/page-1614「3以下なら」）", () => {
    const s = settle(attack(board("SPEC-C6"), "TST-UNIT-0:a", "XG1-045:ik", "player2"));
    expect(s.log.some((l) => l.includes("|battle|TST-UNIT-0|"))).toBe(true);
  });
});

// ===========================================================================
describe("XG1-046 Vマシーン（Vジェット）", () => {
  const TEXT = "【Vジェット】このビークルにライドしているユニットがモーフで置き換えられたとき、このビークルにライドしているユニットをラッシュエリアに戻してもよい。（ライドオフしない限り、ユニットとビークルは重ねたまま扱う）";

  it("XG1-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-1607）", () => {
    expectCatalogText("XG1-046", TEXT);
    expectVehicleStats("XG1-046", { name: "Vマシーン（Vジェット）", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG1-046", ["N"]);
  });

  /** 敵軍ラッシュフェイズ。自軍バトルエリアで vehicle にスーパー1（モーフ）がライド中、パワーゾーンにスーパー1・EH。敵軍がユニットをラッシュしてモーフの選択が開く。 */
  const morphing = (vehicle: string) =>
    enemyRushes({ battle: [inst(vehicle, "vj"), { ...inst("XG1-047", "s1"), mountedOnInstanceId: `${vehicle}:vj` }], power: [inst("XG1-048", "eh")] }, "TST-UNIT-0:x", EXTRA);

  it("XG1-046: 【Vジェット】ライドしているユニットがモーフで置き換えられたとき、ライドしているユニット（とビークル）をラッシュエリアに戻せる（既知の不具合: CARD-XG1-046 戻すかの選択がなくバトルエリアに残る）（出典: atwiki/page-1607「このビークルにライドしているユニットをラッシュエリアに戻してもよい」・カード評価「ラッシュエリアに戻すことでライドしているユニットを守る」）", () => {
    const s = resolveAll(morphing("XG1-046"), ["XG1-048:eh", "accept"]);
    expect(zoneOf(s, "player1", "XG1-048:eh")).toBe("rush");
    expect(zoneOf(s, "player1", "XG1-046:vj")).toBe("rush");
  });

  it("XG1-046: Vジェットでないビークルなら、モーフで置き換えたユニットはバトルエリアに残る（対照）（出典: atwiki/page-1294 モーフ・atwiki/page-1607）", () => {
    const s = resolveAll(morphing("SPEC-VEHICLE"), ["XG1-048:eh"]);
    expect(zoneOf(s, "player1", "XG1-048:eh")).toBe("battle");
    expect(zoneOf(s, "player1", "XG1-047:s1")).toBe("power");
  });
});

// ===========================================================================
describe("XG1-047 仮面ライダースーパー1", () => {
  const TEXT = "※モーフ 【赤心少林拳】BP1000またはBP3000またはBP5000の敵軍Sユニットを1体選び、撃破してもよい。また、MAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これはSP1になる。";

  it("XG1-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-1635）", () => {
    expectCatalogText("XG1-047", TEXT);
    expectUnitStats("XG1-047", { name: "仮面ライダースーパー1", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: "RC", features: [...RIDER_FEATURES, "ファイブハンド"] });
    expectRarityIn("XG1-047", ["SR"]);
  });

  it("XG1-047: ※モーフ — 敵軍がユニットをラッシュしたとき、特徴が完全一致する自軍パワーゾーンのスーパー1・EH（XG1-048）と置き換えられる（特徴の違う V3 は候補外）（出典: atwiki/page-1635「※モーフ」・R-KW-MORPH-01・03）", () => {
    const s = enemyRushes({ rush: [inst("XG1-047", "s1")], power: [inst("XG1-048", "eh"), inst("XG1-044", "v3")] }, "TST-UNIT-0:x", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG1-048:eh"]);
  });

  const enemy = { battle: [inst("TST-UNIT-0", "b1"), inst("SPEC-S1", "b2"), inst("SPEC-B5", "b5"), inst("TST-UNIT-7", "b7")] };
  const rc = () => rcAt("XG1-047:s1", { command: releasedCat("MA", 1) }, enemy, EXTRA);

  it("XG1-047: 【赤心少林拳】RC — ライドオフすると敵軍ユニットを選ぶ選択が開く（任意）（出典: atwiki/page-1635「…敵軍Sユニットを1体選び、撃破してもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-047");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-047: 候補は BP1000・3000・5000 の敵軍 S ユニットだけ（BP2000・L は選べない）（既知の不具合: CARD-XG1-047 BP2000 の S・L ユニットも候補になる）（出典: atwiki/page-1635「BP1000またはBP3000またはBP5000の敵軍Sユニット」）", () => {
    expect([...choiceIds(rc())].sort()).toEqual(["SPEC-B5:b5", "TST-UNIT-0:b1"]);
  });

  it("XG1-047: 選んだユニットは撃破されて捨札になる（既知の不具合: CARD-XG1-047 撃破ではなく敵軍コマンドゾーンに置かれる）（出典: atwiki/page-1635「撃破してもよい」）", () => {
    const s = pick(rc(), "TST-UNIT-0:b1");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b1")).toBe("discard");
  });

  it("XG1-047: MA を持つ自軍コマンドを1つホールドすれば、このターン SP1 になる（既知の不具合: CARD-XG1-047 コマンドはホールドされず SP を持たない）（出典: atwiki/page-1635「MAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これはSP1になる」・カード評価「並び順に関係なくお手軽にストライク」）", () => {
    const s = resolveAll(rc(), ["TST-UNIT-0:b1", "TST-OP-MA:cMA0", "hold_command"]);
    expect(isHeldCard(s, "player1", "TST-OP-MA:cMA0")).toBe(true);
    expect(spOf(s, "player1", "XG1-047:s1")).toBe(1);
  });

  it("XG1-047: RC が発動しなければ（ライドせずに出る）SP を持たない（出典: atwiki/page-1635「SP：！」・R-KW-RC-01）", () => {
    const s = act(p1Battle({ rush: [inst("XG1-047", "s1")], command: releasedCat("MA", 1) }, {}, EXTRA), { type: "move_to_battle", playerId: "player1", instanceId: "XG1-047:s1" });
    expect(spOf(s, "player1", "XG1-047:s1")).toBe(0);
    expect(cardIn(s, "player1", "TST-OP-MA:cMA0")?.commandHeld ?? false).toBe(false);
    expect(canStartRush(s, "player1", "XG1-047:s1")).toBe(false);
  });
});
