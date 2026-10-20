/**
 * カード別スペック: XG1-081〜XG1-087（クロスギャザー ザ・ファーストエンカウント 磁雷神〜少女仮面ヘルバイラ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。本範囲に atwiki へ転載された公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CHASE-01・02、R-KW-RC-01、R-HOLD、05-battle-strike-damage「1/N」の SP）・atwiki のカード評価・コメント
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canSkip,
  chaseTargets,
  choiceIds,
  deckCards,
  enemyAttack,
  enemyBoard,
  enter,
  enteredFromRush,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  expectVehicleStats,
  heldUnit,
  inst,
  isDamageCard,
  legal,
  ncAt,
  p1Battle,
  pick,
  PLAIN_VEHICLE,
  powerCards,
  rcAt,
  resolveAll,
  ridingPair,
  rushPhaseBoard,
  rushResults,
  spOf,
  st,
  sUnit,
  targetsOf,
  toEnemyBattle,
  vehicleCard,
  zoneOf,
} from "./XG1-081-100.helpers";
import type { GameState } from "../types/game";

const NIN = sUnit("SPEC-NIN", { features: ["忍者"] });
const OTET = sUnit("SPEC-OTET", { category: ["OT", "ET"] });
const VEH2 = vehicleCard("SPEC-VEH2");
const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const B45 = sUnit("SPEC-B45", { bp: 4500 });
const B3 = sUnit("SPEC-B3", { bp: 3000 });
// SPEC-VEHICLE（XG1-082 の power で使うビークルカード）の定義も加える（RK4-064-084.helpers.ts PLAIN_VEHICLE）。
const EXTRA = [NIN, OTET, VEH2, C3, C6, B45, B3, PLAIN_VEHICLE];

// ===========================================================================
describe("XG1-081 磁雷神", () => {
  const TEXT = "【パコの守護神】これが自軍エリアにある間、自軍常駐置き場にあるカードは相手に選ばれない。";

  it("XG1-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-1587）", () => {
    expectCatalogText("XG1-081", TEXT);
    expectUnitStats("XG1-081", { name: "磁雷神", category: ["OT", "ET"], size: "L", bp: 6000, sp: 1, powerCost: "5+", features: ["侍", "人型"], rushCondition: "discard_feature_unit" });
    expectRarityIn("XG1-081", ["N"]);
  });

  const board = (rush: ReturnType<typeof inst>[]) =>
    rushPhaseBoard({ hand: [inst("XG1-081", "jr")], rush, command: [inst("SPEC-OTET", "c")], power: powerCards(5) }, {}, EXTRA);

  it("XG1-081: 追加条件 — 特徴「忍者」を持つ自軍 S ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1587「追加条件：特徴「忍者」を持つ自軍Sユニット1体を捨札にする」）", () => {
    const r = rushResults(board([inst("SPEC-NIN", "n")]), "player1", "XG1-081:jr");
    expect(r.some((s) => zoneOf(s, "player1", "XG1-081:jr") === "rush" && zoneOf(s, "player1", "SPEC-NIN:n") === "discard")).toBe(true);
  });

  it("XG1-081: 「忍者」を持つ S ユニットがいなければラッシュできない（出典: atwiki/page-1587・カード評価「このユニットの特徴に忍者は無い」）", () => {
    const r = rushResults(board([inst("TST-UNIT-0", "n")]), "player1", "XG1-081:jr");
    expect(r.some((s) => zoneOf(s, "player1", "XG1-081:jr") === "rush")).toBe(false);
  });

  /** 自軍（player1）デンジレッド（XG1-002）の NC で、敵軍常駐置き場のカードを選ぶ。敵軍エリアに rush。 */
  const denji = (rush: ReturnType<typeof inst>[]) => ncAt("XG1-002:dr", 2, {}, { operation: [inst("XG1-015", "o1"), inst("RS-244", "o2")], rush }, EXTRA);

  it("XG1-081: 【パコの守護神】これが自軍エリアにある間、自軍常駐置き場のカードは相手の効果（敵軍デンジレッドの NC）に選ばれない（既知の不具合: CARD-XG1-081 候補に入る）（出典: atwiki/page-1587「自軍常駐置き場にあるカードは相手に選ばれない」・カード評価「レッドワンや仮面ライダーキバBFなどへのメタ効果」）", () => {
    const s = denji([inst("XG1-081", "jr")]);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-002" ? choiceIds(s) : []).toEqual([]);
  });

  it("XG1-081: 対照 — 磁雷神がなければ、常駐置き場のカードは敵軍デンジレッドの NC の候補になる（出典: atwiki/page-1587「これが自軍エリアにある間」）", () => {
    expect([...choiceIds(denji([inst("TST-UNIT-0", "o")]))].sort()).toEqual(["RS-244:o2", "XG1-015:o1"]);
  });
});

/** 敵軍（player1）のターン。自軍（player2）の宇宙刑事シャイダー（XG1-083）がブルホーク（XG1-082）にライドしてバトルエリアにあり、BP13000 のユニットにアタックされる。 */
function shaiderAttacked(p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  const s = st(
    {
      player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) },
      player2: { battle: ridingPair("XG1-083", "sh", "XG1-082", "bh"), rush: [inst("SPEC-VEH2", "v2")], deck: deckCards(3, "e"), ...p2 },
    },
    EXTRA,
  );
  return attack(enter(s, "TST-UNIT-7:a"), "TST-UNIT-7:a", "XG1-083:sh");
}

/** チェイスで SPEC-VEH2 に乗り換える。 */
function chaseToVeh2(s: GameState): GameState {
  const a = legal(s).find((x) => x.type === "resolve_chase" && "newVehicleInstanceId" in x && x.newVehicleInstanceId === "SPEC-VEH2:v2");
  if (!a) throw new Error("no chase");
  return act(s, a);
}

// ===========================================================================
describe("XG1-082 ブルホーク", () => {
  const TEXT = "【戦士シャイダーの遺産】このビークルが捨札になったとき、自軍パワーゾーンのオモテ向きのカードからビークルカードを1枚選び、自分の手札に加えてもよい。";

  it("XG1-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-1566）", () => {
    expectCatalogText("XG1-082", TEXT);
    expectVehicleStats("XG1-082", { name: "ブルホーク", category: "OT", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG1-082", ["N"]);
  });

  const power = [inst("SPEC-VEHICLE", "pv"), { ...inst("SPEC-VEH2", "pd"), faceDown: true }, inst("TST-P", "p")];

  it("XG1-082: 【戦士シャイダーの遺産】チェイスで捨札になったとき、自軍パワーゾーンのオモテ向きのビークルカードを1枚選び手札に加えられる（任意。ウラ向きのカード・ビークル以外は選べない）（既知の不具合: CARD-XG1-082 選択が開かない）（出典: atwiki/page-1566「このビークルが捨札になったとき…ビークルカードを1枚選び、自分の手札に加えてもよい」・カード評価「チェイスとの相性が良い」）", () => {
    const s = chaseToVeh2(shaiderAttacked({ power }));
    expect(zoneOf(s, "player2", "XG1-082:bh")).toBe("discard");
    expectChoiceFrom(s, "player2", "XG1-082");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:pv"]);
    expect(zoneOf(resolveAll(pick(s, "SPEC-VEHICLE:pv")), "player2", "SPEC-VEHICLE:pv")).toBe("hand");
  });
});

// ===========================================================================
describe("XG1-083 宇宙刑事シャイダー", () => {
  const TEXT = "※チェイス 【シャイダーブルーフラッシュ】敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が3以下のカードを1枚選び、ダメージにしてもよい。";

  it("XG1-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-1611）", () => {
    expectCatalogText("XG1-083", TEXT);
    expectUnitStats("XG1-083", { name: "宇宙刑事シャイダー", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 4, comboNumber: "RC", features: ["宇宙刑事", "メカ", "男", "警察"] });
    expectRarityIn("XG1-083", ["SR"]);
  });

  it("XG1-083: ※チェイス — ライド中にバトルで撃破されるとき、ライドされていない自軍ビークルに乗り換えられ、乗り換えたらラッシュエリアに残る（出典: atwiki/page-1611「※チェイス」・R-KW-CHASE-01・02）", () => {
    const s = shaiderAttacked();
    expect(chaseTargets(s, "player2")).toEqual(["SPEC-VEH2:v2"]);
    const t = chaseToVeh2(s);
    expect(zoneOf(t, "player2", "XG1-083:sh")).toBe("rush");
  });

  const rc = () =>
    rcAt("XG1-083:sh", {}, { power: [inst("SPEC-C3", "p3"), inst("SPEC-C6", "p6"), { ...inst("SPEC-C3", "pd"), faceDown: true }, inst("TST-P", "p0")] }, EXTRA);

  it("XG1-083: 【シャイダーブルーフラッシュ】RC — 敵軍パワーゾーンのオモテ向きの、必要パワー3以下のカードを選べる（任意。必要パワー6・ウラ向きのカードは選べない）（既知の不具合: CARD-XG1-083 選択が開かない）（出典: atwiki/page-1611「必要パワーの数字が3以下のカードを1枚選び、ダメージにしてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-083");
    expect(canSkip(s)).toBe(true);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-C3:p3", "TST-P:p0"]);
  });

  it("XG1-083: 選んだカードをダメージにする（相手のダメージが1点増える）（既知の不具合: CARD-XG1-083）（出典: atwiki/page-1611「ダメージにしてもよい」・カード評価「ストライク以外のダメージ」）", () => {
    const s = resolveAll(rc(), ["SPEC-C3:p3"]);
    expect(isDamageCard(s, "player2", "SPEC-C3:p3")).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("XG1-084 マッドギャラン", () => {
  const TEXT =
    "【人質と脅迫】これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のバトルエリアにあるホールド状態のSユニットはラッシュエリアに戻せない。また、自分自身の手札を1枚選び捨札にしなければ、このユニットにアタックすることができない。";

  it("XG1-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-1677）", () => {
    expectCatalogText("XG1-084", TEXT);
    expectUnitStats("XG1-084", { name: "マッドギャラン", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 5, features: ["男"] });
    expectRarityIn("XG1-084", ["SR"]);
  });

  it("XG1-084: 【人質と脅迫】相手は手札がなければこれにアタックできない（既知の不具合: CARD-XG1-084 手札がなくてもアタックできる）（出典: atwiki/page-1677「自分自身の手札を1枚選び捨札にしなければ、このユニットにアタックすることができない」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-084", "mg"), inst("TST-UNIT-0", "o")] }, { battle: [inst("TST-UNIT-7", "a")] }, EXTRA);
    expect(targetsOf(s, "TST-UNIT-7:a", "player2")).toEqual(["TST-UNIT-0:o"]);
  });

  it("XG1-084: 相手がこれにアタックするときは、手札を1枚捨札にする（既知の不具合: CARD-XG1-084 手札を捨てずにアタックできる）（出典: atwiki/page-1677「手札を1枚選び捨札にしなければ」・コメント「アタックの際に手札を捨てさせる制限」）", () => {
    const s = resolveAll(enemyAttack(enemyBoard({ battle: [inst("XG1-084", "mg")] }, { battle: [inst("TST-UNIT-7", "a")], hand: [inst("TST-OP", "h")] }, EXTRA), "TST-UNIT-7:a", "XG1-084:mg"), ["TST-OP:h"]);
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("discard");
  });

  it("XG1-084: これ以外の自軍ユニットには、手札を捨てずにアタックできる（出典: atwiki/page-1677「このユニットにアタックすることができない」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-084", "mg"), inst("TST-UNIT-0", "o")] }, { battle: [inst("TST-UNIT-7", "a")], hand: [inst("TST-OP", "h")] }, EXTRA);
    const t = resolveAll(enemyAttack(s, "TST-UNIT-7:a", "TST-UNIT-0:o"));
    expect(zoneOf(t, "player2", "TST-OP:h")).toBe("hand");
    expect(zoneOf(t, "player1", "TST-UNIT-0:o")).toBe("discard");
  });

  it("XG1-084: 相手のバトルエリアのホールド状態の S ユニットは、相手のスタートフェイズにラッシュエリアに戻らない（既知の不具合: CARD-XG1-084 戻る）（出典: atwiki/page-1677「自分自身のバトルエリアにあるホールド状態のSユニットはラッシュエリアに戻せない」・R-HOLD-02）", () => {
    const s = toEnemyBattle(p1Battle({ battle: [inst("XG1-084", "mg")] }, { battle: [heldUnit("TST-UNIT-0", "h"), inst("TST-UNIT-0", "r")] }, EXTRA));
    expect(zoneOf(s, "player2", "TST-UNIT-0:h")).toBe("battle");
  });

  it("XG1-084: リリース状態の S ユニットはふつうにラッシュエリアに戻る（出典: atwiki/page-1677「ホールド状態のSユニットは」）", () => {
    const s = toEnemyBattle(p1Battle({ battle: [inst("XG1-084", "mg")] }, { battle: [heldUnit("TST-UNIT-0", "h"), inst("TST-UNIT-0", "r")] }, EXTRA));
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-085 ダイアナレディ", () => {
  const TEXT =
    "【レディスナイパー】このユニットからコンビネーションするOTを持ち特徴「男」を持つSユニットは、このターン、次の能力を得る⇒BP+2000され、ナンバーにＲＣを持っていれば、ライドオフしなくてもその効果を発動できる。";

  it("XG1-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-1567）", () => {
    expectCatalogText("XG1-085", TEXT);
    expectUnitStats("XG1-085", { name: "ダイアナレディ", category: "OT", size: "S", bp: 1000, sp: "1/4", powerCost: 3, features: ["メカ", "女"] });
    expectRarityIn("XG1-085", ["N"]);
  });

  const spielban = () =>
    enteredFromRush("XG1-086:sp", { battle: [inst("XG1-085", "dl")] }, { battle: [inst("SPEC-B45", "x"), inst("TST-UNIT-0", "y")] }, EXTRA);

  it("XG1-085: 【レディスナイパー】次に並ぶ OT・「男」の S ユニット（スピルバン XG1-086）は BP+2000（BP5000）され、スピルバン自身の効果で SP1 になる（既知の不具合: CARD-XG1-085 BP が上がらない）（出典: atwiki/page-1567「BP+2000され」・atwiki/page-1674 カード評価「相方のダイアナレディと組めばBP5000、SP1になり」）", () => {
    const s = spielban();
    expect(bpOf(s, "player1", "XG1-086:sp")).toBe(5000);
    expect(spOf(s, "player1", "XG1-086:sp")).toBe(1);
  });

  it("XG1-085: ナンバーに RC を持っていれば、ライドオフしなくても RC の効果（スピルバンの【アークインパルス】）を発動する（既知の不具合: CARD-XG1-085 発動しない）（出典: atwiki/page-1567「ライドオフしなくてもその効果を発動できる」・コメント「ビークルに乗ってなきゃ…発動しませんよね？」「します。」）", () => {
    expectChoiceFrom(spielban(), "player1", "XG1-086");
  });

  it("XG1-085: OT・「男」を持たない S ユニット（WB・特徴なしの BP3000）は BP が上がらない（出典: atwiki/page-1567「OTを持ち特徴「男」を持つSユニット」）", () => {
    const s = enteredFromRush("SPEC-B3:z", { battle: [inst("XG1-085", "dl")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "SPEC-B3:z")).toBe(3000);
  });
});

// ===========================================================================
describe("XG1-086 スピルバン", () => {
  const TEXT = "※これはBP5000以上のとき「SP1」になる。 【アークインパルス】このユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("XG1-086: カタログ本文・スペックが出典と一致（出典: atwiki/page-1674）", () => {
    expectCatalogText("XG1-086", TEXT);
    expectUnitStats("XG1-086", { name: "スピルバン", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["メカ", "男"] });
    expectRarityIn("XG1-086", ["SR"]);
  });

  const rc = () => rcAt("XG1-086:sp", {}, { battle: [inst("SPEC-B45", "x"), inst("SPEC-B3", "y")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it("XG1-086: ※ BP3000 のまま（2番目）では SP1 にならない（出典: atwiki/page-1674「※これはBP5000以上のとき「SP1」になる」・SP「1/4」）", () => {
    expect(spOf(rc(), "player1", "XG1-086:sp")).toBe(0);
  });

  it("XG1-086: 【アークインパルス】RC — 候補はこのユニットの BP（3000）以下の敵軍 S ユニット（バトルエリア・ラッシュエリア）で、見送れる（既知の不具合: CARD-XG1-086 候補がスピルバン自身だけで、見送れない）（出典: atwiki/page-1674「このユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送ってもよい」・カード評価「エリアに制限されない除去効果」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-086");
    expect(canSkip(s)).toBe(true);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-B3:y", "TST-UNIT-0:r"]);
  });

  it("XG1-086: 選んだユニットを持ち主のパワーゾーンに送る（既知の不具合: CARD-XG1-086）（出典: atwiki/page-1674「持ち主のパワーゾーンに送って」）", () => {
    const s = resolveAll(rc(), ["SPEC-B3:y"]);
    expect(zoneOf(s, "player2", "SPEC-B3:y")).toBe("power");
  });
});

// ===========================================================================
describe("XG1-087 少女仮面ヘルバイラ", () => {
  const TEXT =
    "【瞬間移動】敵軍ターン中、これがアタックされたとき、これのバトルエリアでの並び順が自分から見て左から1番目以外なら、これを自分から見て左隣のユニットと置き替えてもよい。そうしたとき、バトルは行われない。";

  it("XG1-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-1568）", () => {
    expectCatalogText("XG1-087", TEXT);
    expectUnitStats("XG1-087", { name: "少女仮面ヘルバイラ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 1, features: ["メカ", "ワーラー帝国", "女"] });
    expectRarityIn("XG1-087", ["N"]);
  });

  const attacked = (battle: ReturnType<typeof inst>[]) =>
    enemyAttack(enemyBoard({ battle }, { battle: [inst("TST-UNIT-7", "a")] }, EXTRA), "TST-UNIT-7:a", "XG1-087:hv");

  it("XG1-087: 【瞬間移動】2番目にあってアタックされたとき、左隣のユニットと置き替えるかを選べる（任意）（既知の不具合: CARD-XG1-087 選択が開かず、そのままバトルして撃破される）（出典: atwiki/page-1568「左隣のユニットと置き替えてもよい」）", () => {
    const s = attacked([inst("TST-UNIT-0", "l"), inst("XG1-087", "hv")]);
    expectChoiceFrom(s, "player1", "XG1-087");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-087: 置き替えると並び順が入れ替わり、バトルは行われない（どちらも撃破されない）（既知の不具合: CARD-XG1-087）（出典: atwiki/page-1568「そうしたとき、バトルは行われない」）", () => {
    const s = resolveAll(attacked([inst("TST-UNIT-0", "l"), inst("XG1-087", "hv")]), ["accept"]);
    expect(s.players.player1.battle.map((c) => c.instanceId)).toEqual(["XG1-087:hv", "TST-UNIT-0:l"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:l")).toBe("battle");
  });

  it("XG1-087: 1番目にあるときは置き替えられず、そのままバトルが行われる（出典: atwiki/page-1568「左から1番目以外なら」）", () => {
    const s = resolveAll(attacked([inst("XG1-087", "hv"), inst("TST-UNIT-0", "l")]));
    expect(zoneOf(s, "player1", "XG1-087:hv")).toBe("discard");
  });
});
