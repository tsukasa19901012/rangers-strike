/**
 * カード別スペック: XG2-049〜XG2-055（クロスギャザー ザ・ドラゴンタイガー 仮面ライダーギルス〜変身一発）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-049」〜「XG2-055」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-052 Q1〜Q9、XG2-055 Q1〜Q4）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-RESIST-01・R-ADD-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-052 ユナイトベント Q1〜Q4（RS-437 白熱する実況で重ねたカードとの順番・BP 修正）は cardSpec/RS7-432-452.a.test.ts、Q6 は cardSpec/RK16-316-335.a.test.ts（RK-321）。
 *  - XG2-055 変身一発 Q2（RK-245 仮面ライダーキバ）は cardSpec/RK12-232-252.b.test.ts。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  act,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  damageOf,
  DEFS,
  endTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnit,
  faceDownCard,
  held,
  inst,
  legal,
  nextPhase,
  p1Battle,
  pick,
  playOp,
  powerCards,
  rcBoard,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  withStacked,
  zordDownTests,
  zoneOf,
} from "./XG2-042-061.helpers";

const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const BEAST_L = sUnit("SPEC-BEAST-L", { bp: 5000, size: "L", features: ["獣"] });
const BEAST_L10 = sUnit("SPEC-BEAST-L10", { bp: 10000, size: "L", features: ["獣"] });
const BEAST_M = sUnit("SPEC-BEAST-M", { bp: 3000, size: "M", features: ["獣"], sp: undefined });
const EXTRA = [C2, C3, C4, BEAST_L, BEAST_L10, BEAST_M];

// ===========================================================================
describe("XG2-049 仮面ライダーギルス", () => {
  const TEXT =
    "※レジスト 【デモンズファングクラッシャー】敵軍山札の上から1枚をオモテにする。オモテにしたカードがSユニットのカードだったなら、敵軍バトルエリアに出してもよい（出したユニットの効果は発動しない）。出さなかったか、Sユニットのカード以外だったなら、オモテにしたカードを山札の上に戻す。";

  it("XG2-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-1759）", () => {
    expectCatalogText("XG2-049", TEXT);
    expectUnit("XG2-049", { name: "仮面ライダーギルス", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("XG2-049", ["N"]);
  });

  it("XG2-049: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1759「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-049", "g")] }, "XG2-049:g"))).toBe(true);
  });

  const rc = (top: CardInstance) => rcBoard("XG2-049:g", {}, { deck: [top, inst("TST-OP", "e2")] });

  it.fails("XG2-049: 【デモンズファングクラッシャー】RC（ライドオフ）で、敵軍山札の上から1枚をオモテにし、S ユニットのカードなら敵軍バトルエリアに出すかを選べる（任意）（出典: atwiki/page-1759「敵軍山札の上から1枚をオモテにする。…Sユニットのカードだったなら、敵軍バトルエリアに出してもよい」・R-KW-RC-01） 既知の不具合: CARD-XG2-049 【デモンズファングクラッシャー】が自軍の山札の上のカードを見る", () => {
    const s = rc(inst("TST-UNIT-0", "top"));
    expectChoiceFrom(s, "player1", "XG2-049");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:top"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-049: 【デモンズファングクラッシャー】出すと、そのカードは敵軍バトルエリアに出る（出典: atwiki/page-1759・カード評価「敵軍Sユニットを山札から強制的にラッシュさせる」） 既知の不具合: CARD-XG2-049 【デモンズファングクラッシャー】が自軍の山札の上のカードを見て、敵軍の山札のカードを出せない", () => {
    const s = resolveAll(pick(rc(inst("TST-UNIT-0", "top")), "TST-UNIT-0:top"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:top")).toBe("battle");
  });

  it("XG2-049: 【デモンズファングクラッシャー】S ユニットのカード以外（オペレーション）なら、山札の上に戻す（出典: atwiki/page-1759「Sユニットのカード以外だったなら、オモテにしたカードを山札の上に戻す」）", () => {
    let s = rc(inst("TST-OP", "top"));
    if (s.pendingEffectChoice?.sourceCardId === "XG2-049") s = skip(s);
    s = settle(s);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:top");
  });
});

// ===========================================================================
describe("XG2-050 仮面ライダーエクシードギルス", () => {
  const TEXT =
    "※レジスト ※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーギルス」のカードを1枚選び、自軍ラッシュエリアに出す。 【ギルススティンガー】自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍バトルエリアのユニットを必要パワーの数字の合計が3以下になるように2体まで選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-1856）", () => {
    expectCatalogText("XG2-050", TEXT);
    expectUnit("XG2-050", { name: "仮面ライダーエクシードギルス", category: "MA", size: "S", bp: 3500, sp: undefined, powerCost: "7-", features: ["仮面ライダー", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG2-050", ["R"]);
  });

  zordDownTests("XG2-050", "XG2-049", "仮面ライダーギルス", "atwiki/page-1856", "MA");
  reanimateTests("XG2-050", "XG2-049", "仮面ライダーギルス", "atwiki/page-1856");

  it("XG2-050: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1856「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-050", "x")] }, "XG2-050:x"))).toBe(true);
  });

  const sting = () =>
    enter(p1Battle({ rush: [inst("XG2-050", "x")] }, { battle: [inst("TST-UNIT-0", "a"), inst("SPEC-C2", "c2"), inst("SPEC-C3", "c3"), inst("SPEC-C4", "c4")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA), "XG2-050:x");

  it.fails("XG2-050: 【ギルススティンガー】自軍ターン中にバトルエリアに出たとき、これをホールドするかを選べる（任意）（出典: atwiki/page-1856「これをホールドしてもよい」） 既知の不具合: CARD-XG2-050 【ギルススティンガー】の選択が開かない", () => {
    const s = sting();
    expectChoiceFrom(s, "player1", "XG2-050");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-050: 【ギルススティンガー】ホールドしたら、敵軍バトルエリアのユニットを必要パワーの数字の合計が3以下になるように2体まで選び（0＋3）、持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1856「必要パワーの数字の合計が3以下になるように2体まで選び、持ち主のパワーゾーンにダメージにして置く」） 既知の不具合: CARD-XG2-050 【ギルススティンガー】がなく、敵軍ユニットをダメージにできない", () => {
    let s = settle(accept(sting()));
    expect(cardIn(s, "player1", "XG2-050:x")?.commandHeld).toBe(true);
    expect(choiceIds(s)).not.toContain("SPEC-C4:c4");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:r");
    s = pick(s, "TST-UNIT-0:a");
    if (s.pendingEffectChoice) s = pick(s, "SPEC-C3:c3");
    s = resolveAll(s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("power");
    expect(damageOf(s, "player2")).toBe(2);
  });

  it("XG2-050: 【ギルススティンガー】ホールドしなければ、敵軍のユニットはそのまま（出典: atwiki/page-1856「ホールドしてもよい。そうしたとき」）", () => {
    let s = sting();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-050") s = skip(s);
    s = settle(s);
    expect(cardIn(s, "player1", "XG2-050:x")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG2-051 地のエル", () => {
  const TEXT = "【塵は塵に】 これをラッシュしたとき、敵軍捨札からSユニットのカードを1枚選んでもよい。そうしたとき、選んだカードと同じカード名の敵軍ユニットがあれば、すべて撃破する。";

  it("XG2-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-1760）", () => {
    expectCatalogText("XG2-051", TEXT);
    expectUnit("XG2-051", { name: "地のエル", category: "DA", size: "S", bp: 6000, sp: undefined, powerCost: 6, features: ["アンノウン", "エルロード", "獣"] });
    expectRarityIn("XG2-051", ["N"]);
  });

  const rushed = () => {
    const r = rushFromHand(
      rushBoard(
        { hand: [inst("XG2-051", "h")], power: powerCards(6), command: releasedCat("DA", 1) },
        { discard: [inst("TST-UNIT-0", "d"), inst("XG2-049", "d2"), inst("TST-OP", "op")], battle: [inst("TST-UNIT-0", "a"), inst("XG2-049", "g")], rush: [inst("TST-UNIT-0", "r")] },
      ),
      "player1",
      "XG2-051:h",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it.fails("XG2-051: 【塵は塵に】ラッシュしたとき、敵軍捨札の S ユニットのカードから1枚選べる（オペレーションは選べない）。任意（出典: atwiki/page-1760「敵軍捨札からSユニットのカードを1枚選んでもよい」・コメント「強制効果じゃない」） 既知の不具合: CARD-XG2-051 【塵は塵に】の選択が開かない", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG2-051");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:d", "XG2-049:d2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-051: 【塵は塵に】選んだカードと同じカード名の敵軍ユニットを（ラッシュエリア・バトルエリアとも）すべて撃破する。違う名前のユニットは残る（出典: atwiki/page-1760「選んだカードと同じカード名の敵軍ユニットがあれば、すべて撃破する」） 既知の不具合: CARD-XG2-051 【塵は塵に】がなく、同名の敵軍ユニットを撃破できない", () => {
    const s = resolveAll(pick(rushed(), "TST-UNIT-0:d"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
    expect(zoneOf(s, "player2", "XG2-049:g")).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-052 ユナイトベント", () => {
  const TEXT =
    "ライドしていない特徴「獣」を持つ自軍ユニットを1体選びターゲットとする。そして、このカードを自軍ラッシュエリアに置き、ターゲットをこのカードに重ねる。さらにターゲット以外のライドしていない特徴「獣」を持つ自軍ユニットを好きな数選び、このカードより下にウラ向きにして重ねる。ターゲットは、ウラ向きに重ねたカード1枚につきBP+2000され、BP10000ごとにSP+1される。ターゲットがユニットでなくなるとき、ターゲットの下に重ねていたカードはすべて捨札になる。";

  it("XG2-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-1761）", () => {
    expectCatalogText("XG2-052", TEXT);
    expectOpStats("XG2-052", { name: "ユナイトベント", category: "WB", powerCost: 5 });
    expectRarityIn("XG2-052", ["N"]);
  });

  it.fails("XG2-052: カタログの特徴 — オペレーションだが特徴「アドベントカード」を持つ（出典: atwiki/page-1761「特徴：アドベントカード」） 既知の不具合: CARD-XG2-052 カタログ: オペレーションの特徴「アドベントカード」がない", () => {
    expect((DEFS["XG2-052"] as { features?: string[] }).features ?? []).toEqual(["アドベントカード"]);
  });

  /** ターゲット（target）にユナイトベントを使い、stackIds の獣のユニットをウラ向きに重ねる。 */
  const vent = (target: CardInstance, others: CardInstance[], stackIds: string[]) => {
    const s = rushBoard({ hand: [inst("XG2-052", "uv")], rush: [target, ...others], power: powerCards(5), command: releasedCat("WB", 1) }, {}, EXTRA);
    const r = playOp(s, "player1", "XG2-052:uv", target.instanceId);
    expect(r.ok, r.error).toBe(true);
    let t = r.state;
    for (const id of stackIds) if (t.pendingEffectChoice?.validInstanceIds.includes(id)) t = pick(t, id);
    if (t.pendingEffectChoice?.sourceCardId === "XG2-052") t = t.pendingEffectChoice.kind === "confirm" ? confirm(t) : skip(t);
    return resolveAll(t);
  };

  it("XG2-052: ターゲット以外の特徴「獣」を持つ自軍ユニットを選んで重ねられる（「獣」を持たないユニットは選べない）（出典: atwiki/page-1761「ターゲット以外のライドしていない特徴「獣」を持つ自軍ユニットを好きな数選び」）", () => {
    const s = rushBoard({ hand: [inst("XG2-052", "uv")], rush: [inst("SPEC-BEAST-L", "t"), inst("SPEC-BEAST-M", "b1"), inst("TST-UNIT-0", "n")], power: powerCards(5), command: releasedCat("WB", 1) }, {}, EXTRA);
    const r = playOp(s, "player1", "XG2-052:uv", "SPEC-BEAST-L:t");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG2-052");
    expect(choiceIds(r.state)).toEqual(["SPEC-BEAST-M:b1"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it("XG2-052: ターゲットはウラ向きに重ねたカード1枚につき BP+2000（BP5000 に3枚で11000）、BP10000 ごとに SP+1（SP2）（出典: atwiki/page-1761・Q5「修正後のターゲットのBPを参照します」）", () => {
    const s = vent(inst("SPEC-BEAST-L", "t"), [inst("SPEC-BEAST-M", "b1"), inst("SPEC-BEAST-M", "b2"), inst("SPEC-BEAST-M", "b3")], ["SPEC-BEAST-M:b1", "SPEC-BEAST-M:b2", "SPEC-BEAST-M:b3"]);
    expect(bpOf(s, "player1", "SPEC-BEAST-L:t")).toBe(11000);
    expect(spOf(s, "player1", "SPEC-BEAST-L:t")).toBe(2);
    expect(zoneOf(s, "player1", "SPEC-BEAST-M:b1")).toBeNull();
  });

  it("XG2-052: 公式Q&A — 1枚も重ねなくてよく、そのときも BP10000 ごとに SP+1 は有効（BP10000 の L ユニットは SP2）（出典: atwiki/page-1761 Q9「はい、重ねなくてもかまいません。…BP10000ごとにSP＋1される効果は有効です」）", () => {
    const s = vent(inst("SPEC-BEAST-L10", "t"), [], []);
    expect(bpOf(s, "player1", "SPEC-BEAST-L10:t")).toBe(10000);
    expect(spOf(s, "player1", "SPEC-BEAST-L10:t")).toBe(2);
  });

  it.fails("XG2-052: ターゲットがユニットでなくなる（撃破される）とき、下に重ねていたカードはすべて捨札になる（出典: atwiki/page-1761「ターゲットの下に重ねていたカードはすべて捨札になる」） 既知の不具合: CARD-XG2-052 ターゲットが撃破されると、重ねていたカード（ユナイトベント・ウラ向きのカード）が捨札にならず、どのゾーンにも残らない", () => {
    let s = vent(inst("SPEC-BEAST-L", "t"), [inst("SPEC-BEAST-M", "b1")], ["SPEC-BEAST-M:b1"]);
    const tgt = cardIn(s, "player1", "SPEC-BEAST-L:t")!;
    s = resolveAll(attackedInEnemyTurn({ battle: [tgt] }, "SPEC-BEAST-L:t", {}, "TST-UNIT-7:atk", EXTRA));
    expect(zoneOf(s, "player1", "SPEC-BEAST-L:t")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-052:uv")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-BEAST-M:b1")).toBe("discard");
  });

  it.fails("XG2-052: 公式Q&A — 2枚重ねたターゲットは効果が重複し、ウラ向きのカード1枚につき BP+4000（出典: atwiki/page-1761 Q7「ターゲットはウラ向きのカード1枚につきBP＋4000され、BP10000ごとにSP＋2されます」） 既知の不具合: CARD-XG2-052 2枚重ねても効果が重複せず、ウラ向きのカード1枚につき BP+2000 のまま", () => {
    const t = withStacked(inst("SPEC-BEAST-L", "t"), [inst("XG2-052", "v1"), faceDownCard("SPEC-BEAST-M", "b1"), inst("XG2-052", "v2"), faceDownCard("SPEC-BEAST-M", "b2")]);
    const s = p1Battle({ battle: [t] }, {}, EXTRA);
    expect(bpOf(s, "player1", "SPEC-BEAST-L:t")).toBe(13000);
    expect(spOf(s, "player1", "SPEC-BEAST-L:t")).toBe(3);
  });

  it.fails("XG2-052: ターゲットに選べるのは「獣」を持つ自軍ユニットだけ（出典: atwiki/page-1761「ライドしていない特徴「獣」を持つ自軍ユニットを1体選びターゲットとする」） 既知の不具合: CARD-XG2-052 「獣」を持たない自軍ユニットもターゲットにして使える", () => {
    const s = rushBoard({ hand: [inst("XG2-052", "uv")], rush: [inst("TST-UNIT-0", "n")], power: powerCards(5), command: releasedCat("WB", 1) }, {}, EXTRA);
    expect(playOp(s, "player1", "XG2-052:uv", "TST-UNIT-0:n").ok).toBe(false);
  });
});

// ===========================================================================
describe("XG2-053 仮面ライダータイガ", () => {
  const TEXT = "【間違った英雄】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを1体選び捨札にしてもよい。そうしたとき、このターン、このユニットのBPは、捨札にしたユニットの本来のBPを「+」した値になる。";

  it("XG2-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-1762）", () => {
    expectCatalogText("XG2-053", TEXT);
    expectUnit("XG2-053", { name: "仮面ライダータイガ", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 5, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG2-053", ["N"]);
  });

  const hero = () => enter(p1Battle({ rush: [inst("XG2-053", "t"), inst("XG2-042", "k"), inst("XG2-046", "ph"), inst("TST-UNIT-0", "u")] }), "XG2-053:t");

  it.fails("XG2-053: 【間違った英雄】自軍ターン中にバトルエリアに出たとき、自軍ラッシュエリアの特徴「仮面ライダー」を持つユニットから1体選べる（「仮面ライダー」を持たないユニットは選べない）。任意（出典: atwiki/page-1762「自軍ラッシュエリアから特徴「仮面ライダー」を持つ自軍ユニットを1体選び捨札にしてもよい」） 既知の不具合: CARD-XG2-053 【間違った英雄】の選択が開かない", () => {
    const s = hero();
    expectChoiceFrom(s, "player1", "XG2-053");
    expect(choiceIds(s)).toEqual(["XG2-042:k", "XG2-046:ph"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-053: 【間違った英雄】捨札にしたユニットの本来の BP を足した値になる（XG2-042 BP6000 なら 9000）（出典: atwiki/page-1762「このユニットのBPは、捨札にしたユニットの本来のBPを「+」した値になる」） 既知の不具合: CARD-XG2-053 【間違った英雄】の選択が開かず、BP が上がらない", () => {
    const s = resolveAll(pick(hero(), "XG2-042:k"));
    expect(zoneOf(s, "player1", "XG2-042:k")).toBe("discard");
    expect(bpOf(s, "player1", "XG2-053:t")).toBe(9000);
  });

  it.fails("XG2-053: 【間違った英雄】足すのは「本来の」BP（自軍ターン中 BP+5000 の XG2-046 でも 3000 を足して 6000）（出典: atwiki/page-1762「本来のBP」・コメント「参照が本来のBPでなけりゃスーパー１PHを肥やしにして､BP11000」） 既知の不具合: CARD-XG2-053 【間違った英雄】の選択が開かず、BP が上がらない", () => {
    const s = resolveAll(pick(hero(), "XG2-046:ph"));
    expect(bpOf(s, "player1", "XG2-053:t")).toBe(6000);
  });
});

// ===========================================================================
describe("XG2-054 アビスハンマー", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【土中からの奇襲】これが自軍捨札にある間、自軍ラッシュフェイズ中、自軍ダメージの数がこれの必要パワーの数字以上あれば、WBを持つ自軍コマンドを2つホールドしてから、これを自軍ラッシュエリアに出してもよい。";

  it("XG2-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-1763）", () => {
    expectCatalogText("XG2-054", TEXT);
    expectUnit("XG2-054", { name: "アビスハンマー", category: "WB", size: "S", bp: 5000, sp: undefined, powerCost: 4, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("XG2-054", ["N"]);
  });

  it("XG2-054: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1763 ※）", () => {
    const s = p1Battle({ rush: [inst("XG2-054", "ah")], command: releasedCat("WB", 1) });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG2-054:ah")).toBe(false);
    const t = enterWithHold(s, "XG2-054:ah", ["TST-OP:cWB0"]);
    expect(zoneOf(t, "player1", "XG2-054:ah")).toBe("battle");
    expect(canEnter(p1Battle({ rush: [inst("XG2-054", "ah")], command: [held("TST-OP", "h")] }), "XG2-054:ah")).toBe(false);
  });

  const inDiscard = (damage: number, command = releasedCat("WB", 2)) =>
    rushBoard({ discard: [inst("XG2-054", "ah")], power: damageCards(damage), damage, command });
  const ambushAction = (s: GameState) => legal(s).find((a) => a.playerId === "player1" && JSON.stringify(a).includes("XG2-054:ah"));

  it.fails("XG2-054: 【土中からの奇襲】自軍捨札にある間、自軍ラッシュフェイズ中、自軍ダメージが4点（必要パワーの数字）以上あれば、WB を持つ自軍コマンドを2つホールドして自軍ラッシュエリアに出せる（出典: atwiki/page-1763「WBを持つ自軍コマンドを2つホールドしてから、これを自軍ラッシュエリアに出してもよい」・カード評価「捨札からラッシュできる珍しい能力」） 既知の不具合: CARD-XG2-054 【土中からの奇襲】がなく、捨札から出す合法手がない", () => {
    const s = inDiscard(4);
    const a = ambushAction(s);
    expect(a).toBeDefined();
    let t = act(s, a!);
    for (let i = 0; i < 3 && t.pendingCommandPayment; i++) t = act(t, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: t.pendingCommandPayment.validInstanceIds.slice(0, t.pendingCommandPayment.totalNeeded) });
    t = resolveAll(t);
    expect(zoneOf(t, "player1", "XG2-054:ah")).toBe("rush");
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG2-054: 【土中からの奇襲】自軍ダメージが3点なら出せない。WB のリリース状態のコマンドが1つしかなくても出せない（出典: atwiki/page-1763「自軍ダメージの数がこれの必要パワーの数字以上あれば」「WBを持つ自軍コマンドを2つ」）", () => {
    expect(ambushAction(inDiscard(3))).toBeUndefined();
    expect(ambushAction(inDiscard(4, releasedCat("WB", 1)))).toBeUndefined();
  });
});

// ===========================================================================
describe("XG2-055 変身一発", () => {
  const TEXT =
    "自分の手札から特徴「男」または「女」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。このとき、出したユニットの効果は発動しない。また、この効果で出したユニットは、このターン、ストライクすることができず、自分がターンを終えるとき、自軍エリアにあれば持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG2-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-1764）", () => {
    expectCatalogText("XG2-055", TEXT);
    expectOpStats("XG2-055", { name: "変身一発", category: "ET", powerCost: 0 });
    expectRarityIn("XG2-055", ["N"]);
  });

  const played = (hand: CardInstance[] = [inst("XG2-042", "m"), inst("XG2-058", "ud"), inst("SPEC-BEAST-M", "bm"), inst("TST-OP", "op")]) => {
    const r = playOp(rushBoard({ hand: [inst("XG2-055", "ip"), ...hand], command: releasedCat("ET", 1) }, {}, EXTRA), "player1", "XG2-055:ip");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it.fails("XG2-055: 自分の手札から、特徴「男」か「女」を持つ S ユニットのカード（必要パワー・追加条件を満たさない XG2-042 も）を1枚選べる。「男」「女」を持たないユニット・M ユニット・オペレーションは選べない。任意（出典: atwiki/page-1764・カード評価「必要パワーや追加条件を無視してSユニットを出せる」・コメント「スカラベアンデッドは特徴に男も女も持っていないので変身一発ではラッシュできません」） 既知の不具合: CARD-XG2-055 変身一発の効果がない（使っても選択が開かない）", () => {
    const s = played();
    expectChoiceFrom(s, "player1", "XG2-055");
    expect(choiceIds(s)).toEqual(["XG2-042:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-055: 選んだユニットは自軍ラッシュエリアに出て、このターンはストライクできない（出典: atwiki/page-1764「このターン、ストライクすることができず」） 既知の不具合: CARD-XG2-055 変身一発の効果がなく、手札のユニットを出せない", () => {
    let s = resolveAll(pick(played(), "XG2-042:m"));
    expect(zoneOf(s, "player1", "XG2-042:m")).toBe("rush");
    s = enter(nextPhase(s), "XG2-042:m");
    expect(canStrike(settle(s), "XG2-042:m")).toBe(false);
  });

  it.fails("XG2-055: 自分がターンを終えるとき、出したユニットが自軍エリアにあれば、自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-1764「自分がターンを終えるとき、自軍エリアにあれば持ち主のコマンドゾーンにホールド状態で置く」） 既知の不具合: CARD-XG2-055 変身一発の効果がなく、手札のユニットを出せない", () => {
    let s = resolveAll(pick(played(), "XG2-042:m"));
    s = endTurn(s);
    expect(zoneOf(s, "player1", "XG2-042:m")).toBe("command");
    expect(cardIn(s, "player1", "XG2-042:m")?.commandHeld).toBe(true);
  });

  it.fails("XG2-055: 公式Q&A — 出したユニットの「ラッシュしたとき」の効果は発動しない（XG2-025 ギンガレッドの ※「これをラッシュしたとき、…ビークルを1体選び、これの下に重ねてもよい」）（出典: atwiki/page-1764 Q1「ラッシュしたときに発動できる効果だけが発動しません」） 既知の不具合: CARD-XG2-055 変身一発の効果がなく、手札のユニットを出せない", () => {
    const r = playOp(rushBoard({ hand: [inst("XG2-055", "ip"), inst("XG2-025", "gr")], rush: [inst("RS-466", "v")], command: releasedCat("ET", 1) }), "player1", "XG2-055:ip");
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    expect(choiceIds(s)).toContain("XG2-025:gr");
    s = settle(pick(s, "XG2-025:gr"));
    expect(zoneOf(s, "player1", "XG2-025:gr")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-025");
  });
});
