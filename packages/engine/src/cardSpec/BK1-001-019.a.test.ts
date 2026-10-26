/**
 * カード別スペック: BK-001〜BK-007（ザ・マスクドライダーエクスパンション ベルトコレクションBOX タイフーン（1号）〜サイクロード）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「BK-」とカード名で検索:
 *     本範囲のカードの項はない。ほかのカードの項に出てくるのは card_7 RS-495 Q（BK-005 エレクトラーで分数 SP を得る）と、
 *     rider_2 SK-002 Q2（括弧書きもカード名に含む）だけ。atwiki に転載された公式 Q&A: BK-001 Q1（＝atwiki/page-1084 RK-175 Q1）、atwiki/page-818 RS-495 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-BK-NNN.md。本範囲のライブ写し pages/N.txt はなし）・atwiki/page-1739「カード名」
 *  3. docs/rules/*.md の一般ルール（R-STK-03・R-BTL-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-BK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／プロモーションカード」を N／PR として照合する。
 */
import { describe, expect, it } from "vitest";
import { setBattleDestroyToPower } from "../rules/turnModifierBridge";
import type { CardInstance, GameState } from "../types/game";
import {
  beltUsed,
  searchBeltTests,
  bpOf,
  canSkip,
  choiceIds,
  deckCards,
  deckOrder,
  endTurn,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  featuresOf,
  fill,
  inst,
  logged,
  nextPhase,
  pick,
  releasedN,
  resolveAll,
  skip,
  spOf,
  sUnit,
  zoneOf,
  type Cat,
} from "./BK1-001-019.helpers";

const PLAIN = sUnit("SPEC-PLAIN", { category: "ET", bp: 3000 });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "ET", bp: 3000, size: "M" });
const NOSP = sUnit("SPEC-NOSP", { category: "ET", bp: 1000, sp: undefined });
const CYBORG_M = sUnit("SPEC-CYBORG-M", { category: "ET", bp: 3000, size: "M", features: ["改造人間"] });
const AIR_S = sUnit("SPEC-AIR-S", { bp: 1000, features: ["航空機"] });
const PLAIN_EM = sUnit("SPEC-PLAIN-EM", { bp: 1000, size: "M" });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const EXTRA = [PLAIN, PLAIN_M, NOSP, CYBORG_M, AIR_S, PLAIN_EM, E3000];

const used = (id: string, cat: Cat, cost: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  beltUsed(id, cat, cost, p1, p2, EXTRA);

// ===========================================================================
describe("BK-001 タイフーン（1号）", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダー1号」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットは特徴「仮面ライダー」が追加される。";

  searchBeltTests({
    id: "BK-001",
    name: "タイフーン（1号）",
    cat: "ET",
    cost: 2,
    page: "atwiki/page-715",
    text: TEXT,
    heroName: "仮面ライダー1号",
    otherMode: "add_feature",
    heroes: ["RK-023", "RK-175", "XP-019"],
    others: ["RK-164", "RK-073"],
    othersWhy: "grnrngr/faq-rider-2 SK-002 Q2（括弧書きもカード名に含むので「仮面ライダー1号（THE FIRST）」は別のカード名）",
  });

  it("BK-001: 公式Q&A — 山札の「RK-175 仮面ライダー新1号」を「仮面ライダー1号」として選び、手札に加えられる（出典: atwiki/page-715 Q1・atwiki/page-1084 Q1）", () => {
    let s = used("BK-001", "ET", 2, { deck: [inst("RK-175", "new1"), ...deckCards(3)] });
    s = pick(s, "search");
    expect(choiceIds(s)).toEqual(["RK-175:new1"]);
    s = resolveAll(pick(s, "RK-175:new1"));
    expect(zoneOf(s, "player1", "RK-175:new1")).toBe("hand");
  });

  it("BK-001: ◎2つ目 — 選べるのは自軍の S ユニット（ラッシュエリア・バトルエリア）だけ。M ユニット・敵軍のユニット・コマンドゾーンのユニットカードは選べない（出典: atwiki/page-715「自軍Sユニットを1体選ぶ」）", () => {
    const s = pick(
      used("BK-001", "ET", 2, { rush: [inst("SPEC-PLAIN", "a"), inst("SPEC-PLAIN-M", "m")], battle: [inst("SPEC-NOSP", "b")], command: [inst("SPEC-PLAIN", "cmd")] }, { rush: [inst("SPEC-E3000", "e")] }),
      "add_feature",
    );
    expectChoiceFrom(s, "player1", "BK-001");
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:b", "SPEC-PLAIN:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-001: ◎2つ目 — このターン、選んだユニットに特徴「仮面ライダー」が追加される（ほかの自軍ユニットには追加されない）（出典: atwiki/page-715「このターン、選んだユニットは特徴「仮面ライダー」が追加される」）", () => {
    let s = used("BK-001", "ET", 2, { rush: [inst("SPEC-PLAIN", "a"), inst("SPEC-NOSP", "o")] });
    s = resolveAll(pick(pick(s, "add_feature"), "SPEC-PLAIN:a"));
    expect(featuresOf(s, "player1", "SPEC-PLAIN:a")).toEqual(["仮面ライダー"]);
    expect(featuresOf(s, "player1", "SPEC-NOSP:o")).toEqual([]);
  });

  it("BK-001: ◎2つ目 — 追加された特徴はターンの終わりに消える（出典: atwiki/page-715「このターン」）", () => {
    let s = used("BK-001", "ET", 2, { rush: [inst("SPEC-PLAIN", "a")] });
    s = resolveAll(pick(pick(s, "add_feature"), "SPEC-PLAIN:a"));
    s = endTurn(s);
    expect(featuresOf(s, "player1", "SPEC-PLAIN:a")).toEqual([]);
  });
});

// ===========================================================================
describe("BK-002 ダブルタイフーン", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダーV3」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍山札の上から1枚を見て、そのカードを山札の上か下かに戻す。";

  searchBeltTests({
    id: "BK-002",
    name: "ダブルタイフーン",
    cat: "ET",
    cost: 2,
    page: "atwiki/page-716",
    text: TEXT,
    heroName: "仮面ライダーV3",
    otherMode: "scry",
    heroes: ["PK-009", "SK-002", "XG1-044"],
    others: ["RK-159", "XG7-033"],
    othersWhy: "grnrngr/faq-rider-2 SK-002 Q2（括弧書きもカード名に含む）・atwiki/page-1739（カード名は完全に一致しなければ対象にできない）",
  });

  const deck = () => [inst("SPEC-PLAIN", "top"), ...deckCards(3)];

  it("BK-002: ◎2つ目 — 自軍山札の上から1枚を見て、山札の上か下かを選ぶ（出典: atwiki/page-716「そのカードを山札の上か下かに戻す」）", () => {
    const s = pick(used("BK-002", "ET", 2, { deck: deck() }), "scry");
    expectChoiceFrom(s, "player1", "BK-002");
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-002: ◎2つ目 — 下を選べば、見たカードは山札の一番下に移る（出典: atwiki/page-716）", () => {
    const s = resolveAll(pick(pick(used("BK-002", "ET", 2, { deck: deck() }), "scry"), "deck_bottom"));
    expect(deckOrder(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2", "SPEC-PLAIN:top"]);
  });

  it("BK-002: ◎2つ目 — 上を選べば、山札はそのまま（出典: atwiki/page-716）", () => {
    const s = resolveAll(pick(pick(used("BK-002", "ET", 2, { deck: deck() }), "scry"), "deck_top"));
    expect(deckOrder(s)).toEqual(["SPEC-PLAIN:top", "TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2"]);
  });

  it("BK-002: ◎2つ目 — 山札が0枚なら何もしない（このカードは捨札）（出典: atwiki/page-716「自軍山札の上から1枚を見て」）", () => {
    const s = resolveAll(pick(used("BK-002", "ET", 2, { deck: [] }), "scry"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "BK-002:op")).toBe("discard");
  });
});

// ===========================================================================
describe("BK-003 ライドル", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダーX」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍捨札からSユニットのカードを1枚選び、自軍山札の下に戻す。";

  searchBeltTests({
    id: "BK-003",
    name: "ライドル",
    cat: "ET",
    cost: 3,
    page: "atwiki/page-717",
    text: TEXT,
    heroName: "仮面ライダーX",
    otherMode: "discard_to_deck_bottom",
    heroes: ["RK-097", "XG4-074"],
    others: ["RK-023"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない）",
  });

  const discard = () => [inst("SPEC-PLAIN", "s"), inst("SPEC-PLAIN-M", "m"), inst("TST-OP", "op2"), inst("RK-323", "v")];

  it("BK-003: ◎2つ目 — 自軍捨札の S ユニットのカードから1枚選ぶ（M ユニット・オペレーション・ビークルは選べない。見送れない）（出典: atwiki/page-717「自軍捨札からSユニットのカードを1枚選び」）", () => {
    const s = pick(used("BK-003", "ET", 3, { discard: discard() }), "discard_to_deck_bottom");
    expectChoiceFrom(s, "player1", "BK-003");
    expect(choiceIds(s)).toEqual(["SPEC-PLAIN:s"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-003: ◎2つ目 — 選んだカードは自軍山札の一番下に戻る（出典: atwiki/page-717「自軍山札の下に戻す」）", () => {
    const s = resolveAll(pick(pick(used("BK-003", "ET", 3, { discard: discard() }), "discard_to_deck_bottom"), "SPEC-PLAIN:s"));
    expect(deckOrder(s).at(-1)).toBe("SPEC-PLAIN:s");
    expect(zoneOf(s, "player1", "SPEC-PLAIN-M:m")).toBe("discard");
  });

  it("BK-003: ◎2つ目 — 自軍捨札に S ユニットのカードがなければ何もしない（出典: atwiki/page-717）", () => {
    const s = resolveAll(pick(used("BK-003", "ET", 3, { discard: [inst("SPEC-PLAIN-M", "m")] }), "discard_to_deck_bottom"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "SPEC-PLAIN-M:m")).toBe("discard");
  });
});

// ===========================================================================
describe("BK-004 コンドラー", () => {
  const TEXT = "自軍Sユニットを1体選ぶ。このターン、選んだユニットはBP+1000される。選んだユニットが「仮面ライダーアマゾン」なら、さらにBP+4000される。";
  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => used("BK-004", "WB", 3, p1, p2);

  it("BK-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-712）", () => {
    expectCatalogText("BK-004", TEXT);
    expectOpStats("BK-004", { name: "コンドラー", category: "WB", powerCost: 3 });
    expectRarityIn("BK-004", ["N"]);
  });

  it("BK-004: 選べるのは自軍の S ユニット（ラッシュエリア・バトルエリア）だけ（M ユニット・敵軍・コマンドゾーンは選べない。見送れない）（出典: atwiki/page-712「自軍Sユニットを1体選ぶ」）", () => {
    const s = board({ rush: [inst("SPEC-PLAIN", "a"), inst("SPEC-PLAIN-M", "m")], battle: [inst("RK-178", "amz")], command: [inst("SPEC-PLAIN", "cmd")] }, { rush: [inst("SPEC-E3000", "e")] });
    expectChoiceFrom(s, "player1", "BK-004");
    expect(choiceIds(s)).toEqual(["RK-178:amz", "SPEC-PLAIN:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-004: 選んだユニットはこのターン BP+1000（出典: atwiki/page-712「このターン、選んだユニットはBP+1000される」）", () => {
    const s = resolveAll(pick(board({ rush: [inst("SPEC-PLAIN", "a")] }), "SPEC-PLAIN:a"));
    expect(bpOf(s, "player1", "SPEC-PLAIN:a")).toBe(4000);
  });

  it("BK-004: 選んだユニットが「仮面ライダーアマゾン」（RK-178・XG1-041）なら、さらに BP+4000（合計 +5000）（出典: atwiki/page-712「さらにBP+4000される」・カード評価「仮面ライダーアマゾン（XG）に使えば、BPが9000になり」）", () => {
    let s = resolveAll(pick(board({ rush: [inst("RK-178", "amz")] }), "RK-178:amz"));
    expect(bpOf(s, "player1", "RK-178:amz")).toBe(7000);
    s = resolveAll(pick(board({ rush: [inst("XG1-041", "amz")] }), "XG1-041:amz"));
    expect(bpOf(s, "player1", "XG1-041:amz")).toBe(9000);
  });

  it("BK-004: BP の増加はバトルエリアに出ても続き、ターンの終わりに消える（出典: atwiki/page-712「このターン」）", () => {
    let s = resolveAll(pick(board({ rush: [inst("SPEC-PLAIN", "a")] }), "SPEC-PLAIN:a"));
    s = enterSeq(nextPhase(s), ["SPEC-PLAIN:a"]);
    expect(bpOf(s, "player1", "SPEC-PLAIN:a")).toBe(4000);
    s = endTurn(resolveAll(s));
    expect(bpOf(s, "player1", "SPEC-PLAIN:a")).toBe(3000);
  });
});

// ===========================================================================
describe("BK-005 エレクトラー", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダーストロンガー」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットは「SP1/5」になる。";

  searchBeltTests({
    id: "BK-005",
    name: "エレクトラー",
    cat: "ET",
    cost: 3,
    page: "atwiki/page-718",
    text: TEXT,
    heroName: "仮面ライダーストロンガー",
    otherMode: "sp_1_5",
    heroes: ["RK-254", "XG3-044"],
    others: ["XG7-034"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない）",
  });

  /** エレクトラーの◎2つ目で unit を選び、バトルフェイズに fillers 体の後へ出す。 */
  const sp15 = (unit: CardInstance, fillers: number, rush: CardInstance[] = []) => {
    let s = used("BK-005", "ET", 3, { rush: [unit, ...fill(fillers), ...rush] });
    s = resolveAll(pick(pick(s, "sp_1_5"), unit.instanceId));
    s = nextPhase(s);
    return enterSeq(s, [...fill(fillers).map((c) => c.instanceId), unit.instanceId]);
  };

  it("BK-005: ◎2つ目 — 選べるのは自軍の S ユニットだけ（出典: atwiki/page-718「自軍Sユニットを1体選ぶ」）", () => {
    const s = pick(used("BK-005", "ET", 3, { rush: [inst("SPEC-NOSP", "u"), inst("SPEC-PLAIN-M", "m")] }, { rush: [inst("SPEC-E3000", "e")] }), "sp_1_5");
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:u"]);
  });

  it("BK-005: ◎2つ目 — 選んだユニットは SP1/5 になる（バトルエリアの5番目に並べば「SP1」）（出典: atwiki/page-718「このターン、選んだユニットは「SP1/5」になる」・R-STK-03）", () => {
    expect(spOf(sp15(inst("SPEC-NOSP", "u"), 4), "player1", "SPEC-NOSP:u")).toBe(1);
  });

  it("BK-005: ◎2つ目 — SP1/5 のユニットは5番目以外では SP を持たない（出典: atwiki/page-718・R-STK-03（分数 SP は分母の位置で SP1））", () => {
    expect(spOf(sp15(inst("SPEC-NOSP", "u"), 3), "player1", "SPEC-NOSP:u")).toBe(0);
  });

  it("BK-005: 公式Q&A（相互参照）— エレクトラーで分数 SP を得た SP 空欄のユニットは RS-495 オモ・カル【宇宙忍法・重力無秩序】の対象から外れる（ガオブラックは本来の CN4 のまま4番目で NC が成立）（出典: grnrngr/faq-card-7 RS-495 Q・atwiki/page-818 Q1）", () => {
    const s = sp15(inst("RS-163", "g"), 3, [inst("RS-495", "o")]);
    expect(bpOf(s, "player1", "RS-163:g")).toBe(6000);
  });
});

// ===========================================================================
describe("BK-006 トルネード", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「スカイライダー」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎敵軍バトルエリアから特徴「航空機」を持つ敵軍Mユニットを1体選び、自軍Sユニットを1体選ぶ。その後、選んだユニット同士でバトルする。";

  searchBeltTests({
    id: "BK-006",
    name: "トルネード",
    cat: "ET",
    cost: 4,
    page: "atwiki/page-719",
    text: TEXT,
    heroName: "スカイライダー",
    otherMode: "air_battle",
    heroes: ["XG1-049", "XG4-087", "XG6-029"],
    others: ["RK-023"],
    othersWhy: "atwiki/page-1739（XG6-029 強化スカイライダーは「これは「スカイライダー」として使える」）",
  });

  const enemy = () => ({ battle: [inst("RS-135", "jf"), inst("RS-128", "bj"), inst("SPEC-PLAIN-EM", "pm"), inst("SPEC-AIR-S", "as")], rush: [inst("RS-143", "sp")] });
  const own = () => ({ rush: [inst("SPEC-PLAIN", "a"), inst("SPEC-PLAIN-M", "m")], battle: [inst("SPEC-NOSP", "b")] });

  it("BK-006: ◎2つ目 — まず敵軍バトルエリアの、特徴「航空機」を持つ M ユニットから1体選ぶ（S ユニット・「航空機」を持たない M ユニット・敵軍ラッシュエリアのユニットは選べない）（出典: atwiki/page-719「敵軍バトルエリアから特徴「航空機」を持つ敵軍Mユニットを1体選び」）", () => {
    const s = pick(used("BK-006", "ET", 4, own(), enemy()), "air_battle");
    expectChoiceFrom(s, "player1", "BK-006");
    expect(choiceIds(s)).toEqual(["RS-128:bj", "RS-135:jf"]);
  });

  it("BK-006: ◎2つ目 — 次に自軍 S ユニット（ラッシュエリア・バトルエリア）を1体選ぶ（出典: atwiki/page-719「自軍Sユニットを1体選ぶ」）", () => {
    const s = pick(pick(used("BK-006", "ET", 4, own(), enemy()), "air_battle"), "RS-135:jf");
    expectChoiceFrom(s, "player1", "BK-006");
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:b", "SPEC-PLAIN:a"]);
  });

  it("BK-006: ◎2つ目 — 選んだ2体がバトルし、BP の低い敵軍ユニットが撃破される（出典: atwiki/page-719「選んだユニット同士でバトルする」・R-BTL-02）", () => {
    const s = resolveAll(pick(pick(pick(used("BK-006", "ET", 4, own(), enemy()), "air_battle"), "RS-135:jf"), "SPEC-PLAIN:a"));
    expect(zoneOf(s, "player2", "RS-135:jf")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:a")).toBe("rush");
  });

  it("BK-006: ◎2つ目 — 自軍ユニットの BP が低ければ自軍ユニットが撃破される（出典: atwiki/page-719・R-BTL-02）", () => {
    const s = resolveAll(pick(pick(pick(used("BK-006", "ET", 4, own(), enemy()), "air_battle"), "RS-128:bj"), "SPEC-PLAIN:a"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:a")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-128:bj")).toBe("battle");
  });

  it("BK-006: ◎2つ目 — BP が同じなら両方撃破される（出典: atwiki/page-719・R-BTL-02）", () => {
    const enemyEq = { battle: [{ ...inst("RS-135", "jf"), bpModifier: 2000 }] };
    const s = resolveAll(pick(pick(pick(used("BK-006", "ET", 4, own(), enemyEq), "air_battle"), "RS-135:jf"), "SPEC-PLAIN:a"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:a")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-135:jf")).toBe("discard");
  });

  // RS-182 ジャイアントローラー「選んだユニットとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く」は
  // アタックかどうかを見ない（XG1-058【ワーウルフ化】と同じ。利用者の決定 2026-10-20・questions-all.md U-11、2026-10-26 にこのカードにも広げる）。
  it("BK-006 × RS-182: ジャイアントローラーで選んだ自軍ユニットとバトルして負けた敵軍ユニットは、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-379「このターン、選んだユニットとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く」・atwiki/page-719）", () => {
    const mark = setBattleDestroyToPower({ modifiers: [] } as unknown as GameState["players"]["player1"], "SPEC-PLAIN:a", "RS-182").modifiers;
    const s = resolveAll(pick(pick(pick(used("BK-006", "ET", 4, { ...own(), modifiers: mark }, enemy()), "air_battle"), "RS-135:jf"), "SPEC-PLAIN:a"));
    expect(zoneOf(s, "player2", "RS-135:jf")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "RS-135:jf")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("BK-006: ◎2つ目 — 選べる敵軍 M ユニットか自軍 S ユニットがなければ何もしない（出典: atwiki/page-719）", () => {
    let s = resolveAll(pick(used("BK-006", "ET", 4, own(), { battle: [inst("SPEC-PLAIN-EM", "pm")] }), "air_battle"));
    expect(s.pendingEffectChoice).toBeUndefined();
    s = resolveAll(pick(used("BK-006", "ET", 4, { rush: [inst("SPEC-PLAIN-M", "m")] }, enemy()), "air_battle"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "RS-135:jf")).toBe("battle");
  });
  it.todo(
    "BK-006: ◎2つ目 — 効果によるバトルで、「バトルするとき」「バトルしたとき」の効果（BP の増減・誘発）が働くか — 本文・公式 FAQ・atwiki に記述がない（エンジンは選んだときの BP を比べるだけ）",
  );
});

// ===========================================================================
describe("BK-007 サイクロード", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダースーパー1」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍捨札から特徴「改造人間」を持つSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。（コマンドゾーンに置けるカードは通常5枚まで）";

  searchBeltTests({
    id: "BK-007",
    name: "サイクロード",
    cat: "ET",
    cost: 4,
    page: "atwiki/page-720",
    text: TEXT,
    heroName: "仮面ライダースーパー1",
    otherMode: "discard_to_command",
    heroes: ["XG1-047"],
    others: ["XG1-048", "XG2-046"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない。「仮面ライダースーパー1・EH」等は別のカード名）",
  });

  const discard = () => [inst("RK-023", "c"), inst("SPEC-PLAIN", "s"), inst("SPEC-CYBORG-M", "m")];

  it("BK-007: ◎2つ目 — 自軍捨札の、特徴「改造人間」を持つ S ユニットのカードから1枚選ぶ（見送れない）（出典: atwiki/page-720「自軍捨札から特徴「改造人間」を持つSユニットのカードを1枚選び」）", () => {
    const s = pick(used("BK-007", "ET", 4, { discard: discard() }), "discard_to_command");
    expectChoiceFrom(s, "player1", "BK-007");
    expect(choiceIds(s)).toEqual(["RK-023:c"]);
    expect(canSkip(s)).toBe(false);
  });

  it("BK-007: ◎2つ目 — 選んだカードは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-720「自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(pick(used("BK-007", "ET", 4, { discard: discard() }), "discard_to_command"), "RK-023:c"));
    expect(zoneOf(s, "player1", "RK-023:c")).toBe("command");
    expect(s.players.player1.command.find((c) => c.instanceId === "RK-023:c")?.commandHeld).toBe(true);
  });

  it("BK-007: ◎2つ目 — 自軍コマンドゾーンが5枚なら置けない（捨札のまま）（出典: atwiki/page-720「（コマンドゾーンに置けるカードは通常5枚まで）」）", () => {
    const s = resolveAll(pick(used("BK-007", "ET", 4, { discard: discard(), command: releasedN(4, "TST-OP-ET", "c") }), "discard_to_command"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "RK-023:c")).toBe("discard");
    expect(s.players.player1.command).toHaveLength(5);
  });
});

