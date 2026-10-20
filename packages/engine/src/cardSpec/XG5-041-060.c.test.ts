/**
 * カード別スペック: XG5-055〜XG5-060（クロスギャザー XG5 ザ・チケットブレイカー 仮面ライダーギャレン〜仮面ライダーワイルドカリス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。同じ書き方のビークル RK-129 ブルースペイダーの項（faq-rider-2「手札のオペレーションを使用して捨札になった場合も、
 *     効果を発動させる事ができます」）を XG5-057 にも当てた。atwiki に転載された公式 Q&A: XG5-056 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CALL-01・R-KW-RIDE-01〜05・R-KW-RC-01・R-KW-WING-01）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  attack,
  beltUsed,
  bpOf,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  exiled,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  expectVehicleStats,
  fill,
  inst,
  legal,
  mount,
  pick,
  pickAll,
  powerCards,
  releasedCat,
  resolveAll,
  rideOff,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  skipFrom,
  spOf,
  st,
  sUnit,
  targetsOf,
  undeadCommandTests,
  wingTests,
  zoneOf,
} from "./XG5-041-060.helpers";

const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const C5 = sUnit("SPEC-C5", { category: "WB", bp: 1000, powerCost: 5 });
const C6 = sUnit("SPEC-C6", { category: "WB", bp: 1000, powerCost: 6 });
const ES = sUnit("SPEC-ES", { category: "WB", bp: 1000 });
const EM = sUnit("SPEC-EM", { category: "WB", bp: 1000, size: "M" });
const ATK_S = sUnit("SPEC-ATK-S", { category: "WB", bp: 9000 });
const ATK_M = sUnit("SPEC-ATK-M", { category: "WB", bp: 9000, size: "M" });
const E8000 = sUnit("SPEC-E8000", { category: "WB", bp: 8000 });
const E8500 = sUnit("SPEC-E8500", { category: "WB", bp: 8500 });
const RC = sUnit("SPEC-RC", { category: "WB", bp: 1000, comboNumber: "RC" } as never);
const EXTRA = [C3, C5, C6, ES, EM, ATK_S, ATK_M, E8000, E8500, RC];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

const handN = (n: number) => Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `h${i}`));

// ===========================================================================
describe("XG5-055 仮面ライダーギャレン", () => {
  const TEXT =
    "※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる。 【ファイアアッパー】自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの必要パワーの数字が「3」と「6」なら、敵軍捨札からSユニットのカードを１枚選びゲームから除外する。";

  it("XG5-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-2173）", () => {
    expectCatalogText("XG5-055", TEXT);
    expectMultiStats("XG5-055", { name: "仮面ライダーギャレン", category: ["WB"], size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("XG5-055", ["NR"]);
  });

  undeadCommandTests("XG5-055", "atwiki/page-2173");

  /** ギャレンを XG5-057 レッドランバスにライドさせて出し、ライドオフする（RC）。敵軍: ラッシュエリアに S・M、捨札に S ユニットのカード。 */
  const rc = (hand: CardInstance[]) => {
    const s = battle({ hand, rush: [inst("XG5-057", "rb"), inst("XG5-055", "g")] }, { rush: [inst("SPEC-ES", "s"), inst("SPEC-EM", "m")], discard: [inst("SPEC-ES", "d")] });
    return rideOff(mount(s, "XG5-055:g", "XG5-057:rb"), true);
  };

  it("XG5-055: RC【ファイアアッパー】— ライドオフしたとき、手札を2枚選んで相手に見せるかを選べる（任意）（出典: atwiki/page-2173「自分の手札を2枚選び、相手に見せてもよい」・R-KW-RC-01）", () => {
    const s = rc([inst("SPEC-C3", "a"), inst("SPEC-C6", "b"), inst("SPEC-C5", "c")]);
    expectChoiceFrom(s, "player1", "XG5-055");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-055: RC【ファイアアッパー】— 見せたとき、敵軍 S ユニットを1体選んでホールドする（M ユニットは選べない）（出典: atwiki/page-2173「そうしたとき、敵軍Sユニットを1体選びホールドする」）", () => {
    let s = pickAll(rc([inst("SPEC-C3", "a"), inst("SPEC-C5", "c")]), ["SPEC-C3:a", "SPEC-C5:c"]);
    expectChoiceFrom(s, "player1", "XG5-055");
    expect(choiceIds(s)).toEqual(["SPEC-ES:s"]);
    s = resolveAll(pick(s, "SPEC-ES:s"));
    expect(cardIn(s, "player2", "SPEC-ES:s")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-ES:d")).toBe("discard");
  });

  it("XG5-055: RC【ファイアアッパー】— 見せたカードの必要パワーが「3」と「6」なら、さらに敵軍捨札の S ユニットのカードを1枚ゲームから除外する（出典: atwiki/page-2173「見せたカードの必要パワーの数字が「3」と「6」なら、敵軍捨札からSユニットのカードを１枚選びゲームから除外する」）", () => {
    let s = pickAll(rc([inst("SPEC-C3", "a"), inst("SPEC-C6", "b")]), ["SPEC-C3:a", "SPEC-C6:b"]);
    s = resolveAll(pick(s, "SPEC-ES:s"), ["SPEC-ES:d"]);
    expect(exiled(s, "player2", "SPEC-ES:d")).toBe(true);
  });

  it("XG5-055: RC【ファイアアッパー】— 見せなければ敵軍ユニットはホールドされない（出典: atwiki/page-2173「そうしたとき」）", () => {
    const s = skipFrom(rc([inst("SPEC-C3", "a"), inst("SPEC-C6", "b")]), "XG5-055");
    expect(cardIn(s, "player2", "SPEC-ES:s")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG5-056 仮面ライダーギャレンJF", () => {
  const TEXT =
    "※ウイング ※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる。 【捨て身の一撃】これが敵軍Sユニットにアタックされたとき、このユニットをホールドするか撃破してもよい。そうしたとき、アタックしてきた敵軍Sユニットを撃破する。（このとき、バトルは行われない）";

  it("XG5-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-2174）", () => {
    expectCatalogText("XG5-056", TEXT);
    expectMultiStats("XG5-056", { name: "仮面ライダーギャレンJF", category: ["WB"], size: "S", bp: 5000, sp: "1/2", powerCost: "3+", comboNumber: undefined, features: ["仮面ライダー", "男", "ジャックフォーム"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-056", ["R"]);
  });

  wingTests("XG5-056", "atwiki/page-2174");
  undeadCommandTests("XG5-056", "atwiki/page-2174");

  it("XG5-056: 追加条件 — 自軍「仮面ライダーギャレン」（XG5-055）1体を捨札にし、パワー3でラッシュできる（出典: atwiki/page-2174「追加条件：自軍「仮面ライダーギャレン」1体を捨札にする」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-056", "jf")], rush: [inst("XG5-055", "g")], power: powerCards(3), command: releasedCat("WB", 1) }), "player1", "XG5-056:jf", { materials: ["XG5-055:g"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-056:jf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-055:g")).toBe("discard");
  });

  it("XG5-056: 公式Q&A — 手札の RK-218 ピーコックアンデッドを捨札にして「仮面ライダーギャレン」を捨札にしたことにしてラッシュしたとき、RS-558 ガンマジンのドローはできない（出典: atwiki/page-2174 Q1「いいえ、それはできません…実際には追加条件を実行してはいないと扱われます」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-056", "jf"), inst("RK-218", "pk")], rush: [inst("RS-558", "gm")], power: powerCards(3), command: releasedCat("WB", 1), deck: deckCards(5) });
    const r = rushFromHand(s0, "player1", "XG5-056:jf", { materials: ["RK-218:pk"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG5-056:jf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-218:pk")).toBe("discard");
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-558");
  });

  it("XG5-056: 公式Q&A の対照 —「仮面ライダーギャレン」を実際に捨札にしてラッシュしたときは、RS-558 ガンマジンでドローするかを選べる（出典: atwiki/page-2174 Q1・RS-558 本文「追加条件を実行して満たしたとき…1枚ドローしてもよい」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-056", "jf")], rush: [inst("RS-558", "gm"), inst("XG5-055", "g")], power: powerCards(3), command: releasedCat("WB", 1), deck: deckCards(5) });
    const r = rushFromHand(s0, "player1", "XG5-056:jf", { materials: ["XG5-055:g"] });
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "RS-558");
  });

  /** 敵軍ターン、敵軍の attacker（BP9000）が自軍バトルエリアのギャレンJF にアタックする。 */
  const attacked = (attacker: string) =>
    attack(st({ activePlayer: "player2", player1: { battle: [inst("XG5-056", "jf")], deck: deckCards(5) }, player2: { battle: [inst(attacker, "atk")], deck: deckCards(5, "e") } }, EXTRA), `${attacker}:atk`, "XG5-056:jf", "player2");

  it("XG5-056:【捨て身の一撃】— 敵軍 S ユニットにアタックされたとき、これをホールドするか撃破するかを選べる（任意）（出典: atwiki/page-2174「これが敵軍Sユニットにアタックされたとき、このユニットをホールドするか撃破してもよい」）", () => {
    const s = attacked("SPEC-ATK-S");
    expectChoiceFrom(s, "player1", "XG5-056");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-056:【捨て身の一撃】— ホールドすれば、アタックしてきた敵軍 S ユニットを撃破し、バトルは行われない（これはホールド状態で残る）（出典: atwiki/page-2174「そうしたとき、アタックしてきた敵軍Sユニットを撃破する。（このとき、バトルは行われない）」）", () => {
    const s = resolveAll(attacked("SPEC-ATK-S"));
    expect(zoneOf(s, "player2", "SPEC-ATK-S:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-056:jf")).toBe("battle");
    expect(cardIn(s, "player1", "XG5-056:jf")?.commandHeld).toBe(true);
  });

  it("XG5-056:【捨て身の一撃】— 敵軍 M ユニットにアタックされたときは発動しない（出典: atwiki/page-2174「敵軍Sユニットにアタックされたとき」）", () => {
    const s = attacked("SPEC-ATK-M");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-056");
  });
});

// ===========================================================================
describe("XG5-057 レッドランバス", () => {
  const TEXT =
    "【ファイアランバス】これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒捨札に置かれたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍捨札を1枚選びゲームから除外する。";

  it("XG5-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-2208）", () => {
    expectCatalogText("XG5-057", TEXT);
    expectVehicleStats("XG5-057", { name: "レッドランバス", category: "WB", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG5-057", ["N"]);
  });

  // 敵軍捨札: 必要パワー3 のユニットカード・必要パワー5 のユニットカード・TST-OP（必要パワー3 のオペレーション）。
  const ENEMY = () => ({ discard: [inst("SPEC-C3", "e3"), inst("SPEC-C5", "e5"), inst("TST-OP", "eo")] });
  /** 手札の TST-OP（必要パワー3）を使う（手札→捨札）。riding なら自軍バトルエリアで SPEC-RC がレッドランバスにライドしている。 */
  const used = (riding = true) =>
    settle(beltUsed("TST-OP", "WB", 3, { battle: riding ? ridingPair("SPEC-RC", "r", "XG5-057", "rb") : [inst("XG5-057", "rb"), inst("SPEC-RC", "r")] }, ENEMY(), EXTRA));

  it("XG5-057:【ファイアランバス】— ライドしたユニットがある間、手札のカード（必要パワー3 のオペレーション）が捨札に置かれたとき、同じ必要パワーの数字の敵軍捨札（カードの種類を問わない）から選べる（任意）（出典: atwiki/page-2208「捨札に置かれたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍捨札を1枚選び」・grnrngr/faq-rider-2 RK-129（同じ書き方）「手札のオペレーションを使用して捨札になった場合も、効果を発動させる事ができます」）", () => {
    const s = used();
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-057");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-C3:e3", "TST-OP:eo"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-057:【ファイアランバス】— 選んだ敵軍捨札はゲームから除外される（出典: atwiki/page-2208「ゲームから除外する」）", () => {
    const s = resolveAll(pick(used(), "SPEC-C3:e3"));
    expect(exiled(s, "player2", "SPEC-C3:e3")).toBe(true);
  });

  it("XG5-057:【ファイアランバス】— ライドしたユニットがなければ発動しない（出典: atwiki/page-2208「これにライドしたユニットがある間」）", () => {
    const s = used(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-057");
  });
});

// ===========================================================================
describe("XG5-058 ロイヤルストレートフラッシュ", () => {
  const TEXT =
    "自軍山札の上から5枚をオモテにする。そうしたとき、オモテにしたユニットカードのBPの合計以下のBPを持つ敵軍ユニットを1体選び、ゲームから除外する（この効果で選ばれたユニットがゲームから除外されるまで、選ばれたユニットが持つ効果名を持たないテキストは無効になり、発動もできない）。その後、オモテにしたカードはすべて捨札になる。";

  it("XG5-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-2262）", () => {
    expectCatalogText("XG5-058", TEXT);
    expectOpStats("XG5-058", { name: "ロイヤルストレートフラッシュ", category: "WB", powerCost: 6 });
    expectRarityIn("XG5-058", ["SR"]);
  });

  // 山札の上から: TST-UNIT-2（BP3000）×2・TST-OP・TST-UNIT-0（BP1000）×2（ユニットの BP の合計 8000）、6枚目 TST-UNIT-7。
  const DECK = () => [inst("TST-UNIT-2", "d1"), inst("TST-UNIT-2", "d2"), inst("TST-OP", "d3"), inst("TST-UNIT-0", "d4"), inst("TST-UNIT-0", "d5"), inst("TST-UNIT-7", "d6")];
  const used = () => beltUsed("XG5-058", "WB", 6, { deck: DECK() }, { rush: [inst("SPEC-E8000", "a"), inst("SPEC-E8500", "b")], battle: [inst("TST-UNIT-0", "c")] }, EXTRA);

  it("XG5-058: 山札の上5枚のユニットカードの BP の合計（8000）以下の敵軍ユニットを選ぶ（エリアを問わない。BP8500 は選べない）（出典: atwiki/page-2262「オモテにしたユニットカードのBPの合計以下のBPを持つ敵軍ユニットを1体選び」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-058");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-E8000:a", "TST-UNIT-0:c"]);
  });

  it("XG5-058: 選んだユニットはゲームから除外され、オモテにした5枚はすべて捨札になる（6枚目は山札に残る）（出典: atwiki/page-2262「ゲームから除外する」「その後、オモテにしたカードはすべて捨札になる」）", () => {
    const s = resolveAll(pick(used(), "SPEC-E8000:a"));
    expect(exiled(s, "player2", "SPEC-E8000:a")).toBe(true);
    for (const id of ["TST-UNIT-2:d1", "TST-UNIT-2:d2", "TST-OP:d3", "TST-UNIT-0:d4", "TST-UNIT-0:d5"]) expect(zoneOf(s, "player1", id)).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-7:d6")).toBe("deck");
  });

  it.todo("XG5-058:（）— 選ばれたユニットが除外されるまで、効果名を持たないテキストは無効になる（出典: atwiki/page-2262「この効果で選ばれたユニットがゲームから除外されるまで…無効になり、発動もできない」）— 選んでから除外するまでの間に割り込む手順が公開 API になく、テストできない");
});

// ===========================================================================
describe("XG5-059 仮面ライダーカリス", () => {
  const TEXT =
    "※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる。 【暴走する本能】これは、自分の手札が1枚以下のとき、BP+3000され、次の能力を得る⇒これは毎ターン可能ならバトルエリアに出る。また、これはアタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする。";

  it("XG5-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-2172）", () => {
    expectCatalogText("XG5-059", TEXT);
    expectMultiStats("XG5-059", { name: "仮面ライダーカリス", category: ["WB", "DA"], size: "S", bp: 3000, sp: "1/2", powerCost: 1, comboNumber: undefined, features: ["アンデッド", "仮面ライダー", "男"] });
    expectRarityIn("XG5-059", ["N"]);
  });

  undeadCommandTests("XG5-059", "atwiki/page-2172");

  it("XG5-059:【暴走する本能】— 自分の手札が1枚以下なら BP+3000（BP6000）、2枚なら BP3000（出典: atwiki/page-2172「自分の手札が1枚以下のとき、BP+3000され」・カード評価「BP6000まで上がる」）", () => {
    expect(bpOf(battle({ hand: handN(1), battle: [inst("XG5-059", "c")] }), "player1", "XG5-059:c")).toBe(6000);
    expect(bpOf(battle({ hand: handN(2), battle: [inst("XG5-059", "c")] }), "player1", "XG5-059:c")).toBe(3000);
  });

  it("XG5-059:【暴走する本能】— 手札が1枚以下なら、出られるかぎり出ずにバトルフェイズを終えられない（出典: atwiki/page-2172「これは毎ターン可能ならバトルエリアに出る」）", () => {
    const s = battle({ hand: handN(1), rush: [inst("XG5-059", "c")] });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
  });

  it("XG5-059:【暴走する本能】— 手札が2枚なら、出ずにバトルフェイズを終えられる（出典: atwiki/page-2172「自分の手札が1枚以下のとき」）", () => {
    const s = battle({ hand: handN(2), rush: [inst("XG5-059", "c")] });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(true);
  });

  /** 2番目に出る（SP1/2 で SP1）。敵軍バトルエリアに TST-UNIT-0。 */
  const second = (hand: number) => enter(battle({ hand: handN(hand), battle: fill(1), rush: [inst("XG5-059", "c")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG5-059:c");

  it("XG5-059:【暴走する本能】— 手札が1枚以下なら、アタックできる敵軍ユニットがいればストライクを選べない（出典: atwiki/page-2172「アタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする」）", () => {
    const s = second(1);
    expect(targetsOf(s, "XG5-059:c")).toEqual(["TST-UNIT-0:e"]);
    expect(canStrike(s, "XG5-059:c")).toBe(false);
  });

  it("XG5-059:【暴走する本能】— 手札が2枚なら、2番目（SP1）でストライクを選べる（出典: atwiki/page-2172「SP：1/2」）", () => {
    const s = second(2);
    expect(spOf(s, "player1", "XG5-059:c")).toBe(1);
    expect(canStrike(s, "XG5-059:c")).toBe(true);
  });
});

// ===========================================================================
describe("XG5-060 仮面ライダーワイルドカリス", () => {
  const TEXT =
    "※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる。 【ワイルド】これは、自軍の手札が1枚のとき次の能力を得る⇒自軍ターン中、これがバトルエリアに出たとき、相手に1点ダメージを与える。";

  it("XG5-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-2171）", () => {
    expectCatalogText("XG5-060", TEXT);
    expectMultiStats("XG5-060", { name: "仮面ライダーワイルドカリス", category: ["WB", "DA"], size: "S", bp: 6000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["アンデッド", "仮面ライダー", "男"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-060", ["SR"]);
  });

  undeadCommandTests("XG5-060", "atwiki/page-2171");

  it("XG5-060: 追加条件 — 自軍「仮面ライダーカリス」（XG5-059）1体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-2171「追加条件：自軍「仮面ライダーカリス」1体を捨札にする」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-060", "wc")], rush: [inst("XG5-059", "c")], power: powerCards(5), command: [...releasedCat("WB", 1), ...releasedCat("DA", 1)] });
    const r = rushFromHand(s0, "player1", "XG5-060:wc", { materials: ["XG5-059:c"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-060:wc")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-059:c")).toBe("discard");
  });

  const entered = (hand: number) => resolveAll(enter(battle({ hand: handN(hand), rush: [inst("XG5-060", "wc")] }), "XG5-060:wc"));

  it("XG5-060:【ワイルド】— 自軍の手札が1枚のとき、自軍ターン中にバトルエリアに出たら相手に1点ダメージ（出典: atwiki/page-2171「自軍の手札が1枚のとき…相手に1点ダメージを与える」）", () => {
    expect(damageOf(entered(1), "player2")).toBe(1);
  });

  it("XG5-060:【ワイルド】— 手札が2枚のときはダメージを与えない（出典: atwiki/page-2171「自軍の手札が1枚のとき」）", () => {
    expect(damageOf(entered(2), "player2")).toBe(0);
  });

  it("XG5-060:【ワイルド】— 手札が0枚のときもダメージを与えない（出典: atwiki/page-2171「自軍の手札が1枚のとき」。「1枚以下」ではない）", () => {
    expect(damageOf(entered(0), "player2")).toBe(0);
  });
});
