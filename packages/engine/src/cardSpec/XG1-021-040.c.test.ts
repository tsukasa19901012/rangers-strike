/**
 * カード別スペック: XG1-035〜XG1-040（クロスギャザー ザ・ファーストエンカウント 兜折神〜虎折神）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。
 *     atwiki へ転載された公式 Q&A: page-1634 Q1（XG1-038）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・合体）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: RS9-605-626.c.test.ts（【侍武装】を重ねたユニットが ※ウイング・BP+2000 を得ないこと）。
 * 重ねたあとのユニットは、RS9-605-626.c と同じく stackedCards 付きのユニットとして盤面に置いて確かめる（フェイズをまたいで組み直すため）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types/game";
import {
  act,
  attack,
  attackedInEnemyTurn,
  bpOf,
  canActivate,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enemyBoard,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  heldUnit,
  inst,
  isDamageCard,
  isHeldCard,
  p1Battle,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  rushResults,
  spOf,
  stackOnto,
  stackedIds,
  sUnit,
  targetsOf,
  wingTests,
  zoneOf,
} from "./XG1-021-040.helpers";

const LDA = sUnit("SPEC-LDA", { category: "DA", bp: 8000, size: "L" });
const SDA = sUnit("SPEC-SDA", { category: "DA", bp: 3000 });
const N6 = sUnit("SPEC-N6", { bp: 6000, sp: undefined });
const SAMURAI_M = sUnit("SPEC-SAMURAI-M", { category: "MA", size: "M", features: ["侍"] });
const EXTRA = [LDA, SDA, N6, SAMURAI_M];

const STACK_TEXT =
  "【侍武装】自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒";
const ORIGAMI5 = () => [inst("RS-680", "a"), inst("RS-681", "b"), inst("RS-682", "c"), inst("RS-683", "d"), inst("RS-684", "e")];
const withStack = (card: CardInstance, under: string, suffix = "u"): CardInstance => ({ ...card, stackedCards: [inst(under, suffix)] });

/** 【侍武装】の起動の共通テスト（候補・重ねたあとの扱い・時期）。 */
function samuraiArmorTests(id: string, page: string) {
  const board = () => rushPhaseBoard({ rush: [inst(id, "o"), inst("RS-679", "sko"), inst("SPEC-LDA", "lda")] }, {}, EXTRA);

  it(`${id}: 【侍武装】自軍ラッシュフェイズに起動でき、DA を持たない自軍 L ユニットだけを選べる（DA の L は選べない。任意）（出典: ${page}「DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい」）`, () => {
    expect(canActivate(board(), `${id}:o`)).toBe(true);
    const s = act(board(), { type: "activate_field_unit_ability", playerId: "player1", unitInstanceId: `${id}:o` });
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["RS-679:sko"]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: 【侍武装】選んだ L ユニットに重なり、ユニットとしてはラッシュエリアからなくなる（出典: ${page}「これは、ユニットが重ねられている間カードとして扱い」）`, () => {
    const s = stackOnto(board(), `${id}:o`, "RS-679:sko");
    expect(stackedIds(s, "player1", "RS-679:sko")).toEqual([`${id}:o`]);
    expect(s.players.player1.rush.map((c) => c.instanceId)).not.toContain(`${id}:o`);
  });

  it(`${id}: 【侍武装】自軍バトルフェイズには起動できない（出典: ${page}「自軍ラッシュフェイズ中」）`, () => {
    expect(canActivate(p1Battle({ rush: [inst(id, "o"), inst("RS-679", "sko")] }, {}, EXTRA), `${id}:o`)).toBe(false);
  });

  it(`${id}: 【侍武装】重ねたユニットが撃破されてユニットでなくなるとき、重ねたこのカードも捨札になる（出典: ${page}「重ねたユニットがユニットでなくなるとき捨札になる」）`, () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [withStack(inst("RS-618", "ji"), id, "o")] }, "RS-618:ji"));
    expect(zoneOf(s, "player1", "RS-618:ji")).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:o`)).toBe("discard");
  });
}

/** 「追加条件：特徴「X」を持つ自軍(S)ユニットがある」の共通テスト。 */
function gateTests(id: string, cost: number, ok: CardInstance, ng: CardInstance, label: string, page: string) {
  const board = (rush: CardInstance[]) => rushPhaseBoard({ hand: [inst(id, "h")], rush, command: releasedCat("MA", 1), power: powerCards(cost) }, {}, EXTRA);
  it(`${id}: 追加条件 — ${label}がいればパワー${cost}でラッシュできる（出典: ${page}「追加条件：${label}がある」）`, () => {
    const r = rushFromHand(board([ok]), "player1", `${id}:h`);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:h`)).toBe("rush");
  });
  it(`${id}: 追加条件 — ${label}がいなければラッシュできない（出典: ${page}）`, () => {
    expect(canStartRush(board([ng]), "player1", `${id}:h`)).toBe(false);
  });
}

// ===========================================================================
describe("XG1-035 兜折神", () => {
  const TEXT = `※これをラッシュしたとき、DAを持つSユニットを1体選び撃破する。 ${STACK_TEXT}これは敵軍ラッシュエリアのユニットにアタックできる。`;

  it("XG1-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-1591）", () => {
    expectCatalogText("XG1-035", TEXT);
    expectUnitStats("XG1-035", { name: "兜折神", category: "MA", size: "M", bp: 5000, sp: undefined, powerCost: "4+", features: ["昆虫", "折神獣"], rushCondition: "state_gate" });
    expectRarityIn("XG1-035", ["N"]);
  });

  gateTests("XG1-035", 4, inst("RS-674", "red"), inst("RS-675", "blue"), "特徴「レッド」を持つ自軍Sユニット", "atwiki/page-1591");

  it.fails("XG1-035: ※ ラッシュしたとき、DA を持つ S ユニット（自軍・敵軍、ラッシュエリア・バトルエリアを問わない）を1体選び撃破する（見送れない）（既知の不具合: CARD-XG1-035 選択が開かず何も撃破されない）（出典: atwiki/page-1591「DAを持つSユニットを1体選び撃破する」）", () => {
    const s0 = rushPhaseBoard({ hand: [inst("XG1-035", "kb")], rush: [inst("RS-674", "red")], command: releasedCat("MA", 1), power: powerCards(4) }, { rush: [inst("SPEC-SDA", "d")], battle: [inst("SPEC-SDA", "db"), inst("SPEC-LDA", "l")] }, EXTRA);
    const r = rushFromHand(s0, "player1", "XG1-035:kb");
    expect(r.ok).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG1-035");
    expect([...choiceIds(r.state)].sort()).toEqual(["SPEC-SDA:d", "SPEC-SDA:db"]);
    expect(canSkip(r.state)).toBe(false);
    expect(zoneOf(resolveAll(r.state, ["SPEC-SDA:db"]), "player2", "SPEC-SDA:db")).toBe("discard");
  });

  samuraiArmorTests("XG1-035", "atwiki/page-1591");

  it.fails("XG1-035: 【侍武装】を重ねたユニットは、敵軍ラッシュエリアのユニット（ホールド・リリースとも）にアタックできる（既知の不具合: CARD-XG1-035 付与された能力がなくバトルエリアにしかアタックできない）（出典: atwiki/page-1591「このカードに重ねたユニットは、次の能力を得る⇒これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = p1Battle({ battle: [withStack(inst("RS-679", "sko"), "XG1-035", "kb")] }, { rush: [inst("TST-UNIT-0", "r"), heldUnit("TST-UNIT-0", "h")], battle: [inst("TST-UNIT-0", "b")] }, EXTRA);
    expect([...targetsOf(s, "RS-679:sko")].sort()).toEqual(["TST-UNIT-0:b", "TST-UNIT-0:h", "TST-UNIT-0:r"]);
  });
});

// ===========================================================================
describe("XG1-036 舵木折神", () => {
  const TEXT = `※これをラッシュしたとき、Sユニットをすべてリリースする。 ${STACK_TEXT}自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く。`;

  it("XG1-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-1592）", () => {
    expectCatalogText("XG1-036", TEXT);
    expectUnitStats("XG1-036", { name: "舵木折神", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: "5+", features: ["獣", "折神獣"], rushCondition: "state_gate" });
    expectRarityIn("XG1-036", ["N"]);
  });

  gateTests("XG1-036", 5, inst("RS-675", "blue"), inst("RS-674", "red"), "特徴「ブルー」を持つ自軍Sユニット", "atwiki/page-1592");

  it.fails("XG1-036: ※ ラッシュしたとき、ホールド状態の S ユニットをすべて（自軍・敵軍とも）リリースする（M はそのまま）（既知の不具合: CARD-XG1-036 何もリリースされない）（出典: atwiki/page-1592「Sユニットをすべてリリースする」）", () => {
    const s0 = rushPhaseBoard({ hand: [inst("XG1-036", "kj")], rush: [inst("RS-675", "blue"), heldUnit("TST-UNIT-0", "h"), heldUnit("RS-680", "hm")], command: releasedCat("MA", 1), power: powerCards(5) }, { rush: [heldUnit("TST-UNIT-0", "eh")] }, EXTRA);
    const r = rushFromHand(s0, "player1", "XG1-036:kj");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(isHeldCard(s, "player1", "TST-UNIT-0:h")).toBe(false);
    expect(isHeldCard(s, "player2", "TST-UNIT-0:eh")).toBe(false);
    expect(isHeldCard(s, "player1", "RS-680:hm")).toBe(true);
  });

  samuraiArmorTests("XG1-036", "atwiki/page-1592");

  it.fails("XG1-036: 【侍武装】を重ねたユニットが自軍ターンにバトルエリアに出たとき、ホールドしてもよく、そうしたとき敵軍コマンドを1つ選び持ち主のパワーゾーンにダメージとして置く（既知の不具合: CARD-XG1-036 付与された能力がなく何も起きない）（出典: atwiki/page-1592「自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍コマンドを1つ選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s0 = p1Battle({ rush: [withStack(inst("RS-679", "sko"), "XG1-036", "kj")] }, { command: [inst("TST-OP", "c1"), heldUnit("TST-OP", "c2")] }, EXTRA);
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: "RS-679:sko" });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(s, ["hold", "TST-OP:c1"]);
    expect(isHeldCard(t, "player1", "RS-679:sko")).toBe(true);
    expect(zoneOf(t, "player2", "TST-OP:c1")).toBe("power");
    expect(isDamageCard(t, "player2", "TST-OP:c1")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-037 ダイテンクウ", () => {
  const TEXT =
    "合体―-兜折神＋舵木折神＋虎折神 ※ウイング 【虚空からの一撃】これがウイングでアタックした敵軍ユニットが、撃破されて捨札になったとき、そのユニットカードを持ち主のパワーゾーンにダメージにして置く。";

  it("XG1-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-1641）", () => {
    expectCatalogText("XG1-037", TEXT);
    expectUnitStats("XG1-037", { name: "ダイテンクウ", category: "MA", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["獣", "折神獣"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG1-037", ["NR"]);
  });

  it("XG1-037: 合体 — 兜折神・舵木折神・虎折神を素材にパワー6でラッシュでき、素材は捨札になる（出典: atwiki/page-1641「合体―兜折神＋舵木折神＋虎折神」「追加条件：自軍合体ユニットを捨札にする」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-037", "dt")], rush: [inst("XG1-035", "kb"), inst("XG1-036", "kj"), inst("XG1-040", "tr")], command: releasedCat("MA", 1), power: powerCards(6) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG1-037:dt");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-037:dt")).toBe("rush");
    for (const m of ["XG1-035:kb", "XG1-036:kj", "XG1-040:tr"]) expect(zoneOf(r.state, "player1", m)).toBe("discard");
  });

  it("XG1-037: 合体 — 素材が1体（虎折神）欠ければラッシュできない（出典: atwiki/page-1641）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-037", "dt")], rush: [inst("XG1-035", "kb"), inst("XG1-036", "kj")], command: releasedCat("MA", 1), power: powerCards(6) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG1-037:dt")).toBe(false);
  });

  wingTests("XG1-037", "atwiki/page-1641");

  it.fails("XG1-037: 【虚空からの一撃】ウイングでアタックして撃破した敵軍ユニットのカードは、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（既知の不具合: CARD-XG1-037 捨札に置かれたまま）（出典: atwiki/page-1641「撃破されて捨札になったとき、そのユニットカードを持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = p1Battle({ rush: [inst("XG1-037", "dt")] }, { battle: [inst("SPEC-N6", "e")] }, EXTRA);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG1-037:dt" });
    s = resolveAll(attack(s, "XG1-037:dt", "SPEC-N6:e"));
    expect(zoneOf(s, "player2", "SPEC-N6:e")).toBe("power");
    expect(isDamageCard(s, "player2", "SPEC-N6:e")).toBe(true);
  });

  it("XG1-037: バトルエリアからの通常のアタックで撃破したユニットは捨札に置かれる（出典: atwiki/page-1641「これがウイングでアタックした敵軍ユニット」）", () => {
    const s = resolveAll(attack(p1Battle({ battle: [inst("XG1-037", "dt")] }, { battle: [inst("SPEC-N6", "e")] }, EXTRA), "XG1-037:dt", "SPEC-N6:e"));
    expect(zoneOf(s, "player2", "SPEC-N6:e")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-038 シンケンゴールド", () => {
  const TEXT =
    "【サカナマル】これが自軍ラッシュエリアにある間、敵軍バトルフェイズ中、相手が自分自身のSユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに出してもよい。そうしたとき、自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。このとき、捨札にしたカードと相手の選んだユニットの特徴を比べて、同じ特徴が2つ以上あれば、そのユニットを持ち主のパワーゾーンにダメージにして置き、1つだけならそのユニットを撃破する。";

  it("XG1-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-1634）", () => {
    expectCatalogText("XG1-038", TEXT);
    expectUnitStats("XG1-038", { name: "シンケンゴールド", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, features: ["ゴールド", "男", "侍"] });
    expectRarityIn("XG1-038", ["SR"]);
  });

  /** 敵軍バトルフェイズ。自軍ラッシュエリアにシンケンゴールド、手札 hand。相手が enemy（ラッシュエリア）をバトルエリアに出す。 */
  const enemyEnters = (enemy: CardInstance, hand: CardInstance[] = [], deckTop = "TST-OP") =>
    act(
      enemyBoard({ rush: [inst("XG1-038", "sg")], hand, deck: [inst(deckTop, "top"), ...deckCards(3)] }, { rush: [enemy] }, EXTRA),
      { type: "move_to_battle", playerId: "player2", instanceId: enemy.instanceId },
    );

  it.fails("XG1-038: 【サカナマル】相手が S ユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに出すかを選べる（任意）（既知の不具合: CARD-XG1-038 反応の機会がない）（出典: atwiki/page-1634「相手が自分自身のSユニットをバトルエリアに出すために選んだとき、これを自軍バトルエリアに出してもよい」）", () => {
    const s = enemyEnters(inst("RS-674", "e"));
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-038");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG1-038: 出したとき 1枚ドローしてから手札を1枚捨て、捨てたカードと相手のユニットに同じ特徴が2つ以上あれば、そのユニットを持ち主のパワーゾーンにダメージにして置く（既知の不具合: CARD-XG1-038）（出典: atwiki/page-1634「同じ特徴が2つ以上あれば、そのユニットを持ち主のパワーゾーンにダメージにして置き」）", () => {
    // シンケンレッド（レッド／男／侍）に、シンケンブルー（ブルー／男／侍）を捨てる → 「男」「侍」の2つが同じ
    const s = resolveAll(enemyEnters(inst("RS-674", "e"), [inst("RS-675", "x")]), ["accept", "XG1-038:sg", "RS-675:x"]);
    expect(zoneOf(s, "player1", "XG1-038:sg")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-675:x")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-674:e")).toBe("power");
    expect(isDamageCard(s, "player2", "RS-674:e")).toBe(true);
  });

  it.fails("XG1-038: 同じ特徴が1つだけなら、相手のユニットを撃破する（既知の不具合: CARD-XG1-038）（出典: atwiki/page-1634「1つだけならそのユニットを撃破する」）", () => {
    // シンケンレッド（レッド／男／侍）に、シンケンピンク（ピンク／女／侍）を捨てる → 「侍」の1つだけ
    const s = resolveAll(enemyEnters(inst("RS-674", "e"), [inst("RS-676", "x")]), ["accept", "XG1-038:sg", "RS-676:x"]);
    expect(zoneOf(s, "player1", "XG1-038:sg")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-674:e")).toBe("discard");
  });

  it.fails("XG1-038: Q&A — 相手の選んだユニットが「アタックされる以外では相手に選ばれない」仮面ライダーカブトRF（RK-065）でも【サカナマル】を発動できる（既知の不具合: CARD-XG1-038）（出典: atwiki/page-1634 Q1「はい、できます。【サカナマル】の効果はユニットを選んで発動するのではなく、特定のタイミングに対して発動するからです」）", () => {
    const s = enemyEnters(inst("RK-065", "e"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-038");
  });

  it("XG1-038: 自軍のバトルフェイズに自分の S ユニットを出しても【サカナマル】は発動しない（出典: atwiki/page-1634「敵軍バトルフェイズ中、相手が」）", () => {
    const s = act(p1Battle({ rush: [inst("XG1-038", "sg"), inst("RS-674", "r")] }, {}, EXTRA), { type: "move_to_battle", playerId: "player1", instanceId: "RS-674:r" });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-038");
    expect(zoneOf(s, "player1", "XG1-038:sg")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-039 テンクウシンケンオー", () => {
  const TEXT =
    "合体―獅子折神＋龍折神＋亀折神＋熊折神＋猿折神＋ダイテンクウ（または兜折神＋舵木折神＋虎折神） ※ウイング 【折神の結集】これが自軍エリアにある間、自軍捨札にある効果名「侍武装」を持つユニットカードは、このユニットが重ねられているかのように効果を発動する。ただし、同じカード名の効果は重複して発動しない。";

  it("XG1-039: カタログ本文・スペックが出典と一致（追加条件「自軍「シンケンオー」1体または自軍合体ユニットを捨札にする」）（出典: atwiki/page-1589）", () => {
    expectCatalogText("XG1-039", TEXT);
    expectUnitStats("XG1-039", { name: "テンクウシンケンオー", category: "MA", size: "L", bp: 20000, sp: 2, powerCost: "7+", features: ["人型", "侍"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG1-039", ["R"]);
  });

  const rushBoard = (rush: CardInstance[]) => rushPhaseBoard({ hand: [inst("XG1-039", "ts")], rush, command: releasedCat("MA", 1), power: powerCards(7) }, {}, EXTRA);

  it("XG1-039: 合体 — 5体の折神とダイテンクウを素材にパワー7でラッシュできる（出典: atwiki/page-1589「合体―獅子折神＋龍折神＋亀折神＋熊折神＋猿折神＋ダイテンクウ」）", () => {
    const r = rushFromHand(rushBoard([...ORIGAMI5(), inst("XG1-037", "dt")]), "player1", "XG1-039:ts");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-039:ts")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG1-037:dt")).toBe("discard");
  });

  it.fails("XG1-039: 合体 — ダイテンクウのかわりに兜折神・舵木折神・虎折神を素材にしてもラッシュできる（既知の不具合: CARD-XG1-039 かっこ内の素材の組ではラッシュの手がない）（出典: atwiki/page-1589「（または兜折神＋舵木折神＋虎折神）」）", () => {
    const r = rushFromHand(rushBoard([...ORIGAMI5(), inst("XG1-035", "kb"), inst("XG1-036", "kj"), inst("XG1-040", "tr")]), "player1", "XG1-039:ts");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-039:ts")).toBe("rush");
  });

  it.fails("XG1-039: 追加条件 — 自軍「シンケンオー」（RS-679）1体を捨札にしてもラッシュできる（既知の不具合: CARD-XG1-039 シンケンオー1体ではラッシュの手がない）（出典: atwiki/page-1589「追加条件：自軍「シンケンオー」1体または自軍合体ユニットを捨札にする」）", () => {
    const results = rushResults(rushBoard([inst("RS-679", "sko")]), "player1", "XG1-039:ts");
    const ok = results.filter((r) => zoneOf(r, "player1", "XG1-039:ts") === "rush");
    expect(ok.length).toBeGreaterThan(0);
    expect(zoneOf(ok[0]!, "player1", "RS-679:sko")).toBe("discard");
  });

  it("XG1-039: 合体 — ダイテンクウも3体の折神もいなければ（5体の折神だけでは）ラッシュできない（出典: atwiki/page-1589）", () => {
    expect(canStartRush(rushBoard(ORIGAMI5()), "player1", "XG1-039:ts")).toBe(false);
  });

  wingTests("XG1-039", "atwiki/page-1589");

  it("XG1-039: SP2・BP20000（自軍捨札に侍武装のカードがなければ修正なし）（出典: atwiki/page-1589「BP：20000」「SP：2」）", () => {
    const s = p1Battle({ battle: [inst("XG1-039", "ts")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-039:ts")).toBe(20000);
    expect(spOf(s, "player1", "XG1-039:ts")).toBe(2);
  });

  it.fails("XG1-039: 【折神の結集】自軍捨札の兜折神の【侍武装】が働き、敵軍ラッシュエリアのユニットにアタックできる（既知の不具合: CARD-XG1-039 捨札の侍武装が働かない）（出典: atwiki/page-1589「自軍捨札にある効果名「侍武装」を持つユニットカードは、このユニットが重ねられているかのように効果を発動する」）", () => {
    const s = p1Battle({ battle: [inst("XG1-039", "ts")], discard: [inst("XG1-035", "kb")] }, { rush: [inst("TST-UNIT-0", "r")] }, EXTRA);
    expect(targetsOf(s, "XG1-039:ts")).toContain("TST-UNIT-0:r");
  });

  it.fails("XG1-039: 【折神の結集】自軍捨札の虎折神の【侍武装】で、合体に必要なユニットの最大数（8体）×1000 の BP+8000 になる（既知の不具合: CARD-XG1-039）（出典: atwiki/page-1589「このユニットが重ねられているかのように」・atwiki/page-1593「このユニットの合体に必要なユニットの最大数を数えて、1体につきBP+1000」）", () => {
    const s = p1Battle({ battle: [inst("XG1-039", "ts")], discard: [inst("XG1-040", "tr")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-039:ts")).toBe(28000);
  });

  it.fails("XG1-039: 【折神の結集】同じカード名（虎折神2枚）の効果は重複しない（BP+8000 は1回だけ）（既知の不具合: CARD-XG1-039）（出典: atwiki/page-1589「ただし、同じカード名の効果は重複して発動しない」）", () => {
    const s = p1Battle({ battle: [inst("XG1-039", "ts")], discard: [inst("XG1-040", "tr"), inst("XG1-040", "tr2")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG1-039:ts")).toBe(28000);
  });
});

// ===========================================================================
describe("XG1-040 虎折神", () => {
  const TEXT = `※これをラッシュしたとき、MAを持たないコマンドをすべてリリースする。 ${STACK_TEXT}このユニットの合体に必要なユニットの最大数を数えて、1体につきBP+1000される。`;

  it("XG1-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-1593）", () => {
    expectCatalogText("XG1-040", TEXT);
    expectUnitStats("XG1-040", { name: "虎折神", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: "4+", features: ["獣", "折神獣"], rushCondition: "state_gate" });
    expectRarityIn("XG1-040", ["N"]);
  });

  gateTests("XG1-040", 4, inst("SPEC-SAMURAI-M", "m"), inst("RS-680", "x"), "特徴「侍」を持つ自軍ユニット", "atwiki/page-1593");

  const rushed = () => {
    const s0 = rushPhaseBoard(
      { hand: [inst("XG1-040", "tr")], rush: [inst("RS-674", "red")], command: [...releasedCat("MA", 1), heldUnit("TST-OP", "w"), heldUnit("TST-OP-MA", "m")], power: powerCards(4) },
      { command: [heldUnit("TST-OP", "ew"), heldUnit("TST-OP-MA", "em")] },
      EXTRA,
    );
    const r = rushFromHand(s0, "player1", "XG1-040:tr");
    expect(r.ok).toBe(true);
    return resolveAll(r.state);
  };

  it("XG1-040: ※ ラッシュしたとき、自軍の MA を持たないホールド状態のコマンドはリリースされ、MA のコマンドはホールドのまま（出典: atwiki/page-1593「MAを持たないコマンドをすべてリリースする」）", () => {
    const s = rushed();
    expect(isHeldCard(s, "player1", "TST-OP:w")).toBe(false);
    expect(isHeldCard(s, "player1", "TST-OP-MA:m")).toBe(true);
  });

  it.fails("XG1-040: ※ 敵軍の MA を持たないコマンドもリリースされる（「コマンドをすべて」）（既知の不具合: CARD-XG1-040 自軍のコマンドしかリリースされない）（出典: atwiki/page-1593「MAを持たないコマンドをすべてリリースする」）", () => {
    const s = rushed();
    expect(isHeldCard(s, "player2", "TST-OP:ew")).toBe(false);
    expect(isHeldCard(s, "player2", "TST-OP-MA:em")).toBe(true);
  });

  samuraiArmorTests("XG1-040", "atwiki/page-1593");

  it.fails("XG1-040: 【侍武装】を重ねたシンケンオー（合体に5体）は BP+5000 で 22000 になる（既知の不具合: CARD-XG1-040 BP が変わらない）（出典: atwiki/page-1593「このユニットの合体に必要なユニットの最大数を数えて、1体につきBP+1000される」）", () => {
    const s = p1Battle({ battle: [withStack(inst("RS-679", "sko"), "XG1-040", "tr")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "RS-679:sko")).toBe(22000);
  });

  it("XG1-040: 【侍武装】を重ねたユニットが合体ユニットでなければ（ジェットイカロス）BP は変わらない（出典: atwiki/page-1593「このユニットの合体に必要なユニットの最大数」）", () => {
    const s = p1Battle({ battle: [withStack(inst("RS-618", "ji"), "XG1-040", "tr")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "RS-618:ji")).toBe(6000);
  });
});
