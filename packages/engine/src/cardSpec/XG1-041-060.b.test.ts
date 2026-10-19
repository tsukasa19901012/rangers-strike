/**
 * カード別スペック: XG1-048〜XG1-054（クロスギャザー ザ・ファーストエンカウント 仮面ライダースーパー1・EH〜仮面ライダーアギトSHF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md R-ERR-XG1-048（読み替え推奨。atwiki/page-1632 Q1 の公式回答）。grnrngr の公式FAQ に XG のカードの項はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md。XG1-048 はライブ写し pages/1632.txt も同文）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-WING-01、05-battle-strike-damage「1/5」）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: rulesSpec/08-errata.s2-atwiki.test.ts（R-ERR-XG1-048 の修正後テキストと選択が開くこと。Q1 の「一時的に隣り合っただけ」は it.todo）、
 * BK1-001-019.a/b（XG1-048・049・051 をサイクロン等の対象として使う）、XG6-023-044.a（XG1-049 をコマンドとして使う）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  endTurn,
  enemyBoard,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnitStats,
  fill,
  heldUnit,
  inst,
  isDamageCard,
  isHeldCard,
  legal,
  p1Battle,
  pick,
  powerCards,
  rcAt,
  reanimateTests,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  settle,
  spOf,
  sUnit,
  targetsOf,
  toEnemyBattle,
  useCard,
  wingTests,
  zoneOf,
  zordDownTests,
  bpOf,
} from "./XG1-041-060.helpers";

const S1 = sUnit("SPEC-S1", { bp: 2000 });
const B6 = sUnit("SPEC-B6", { bp: 6000 });
const B9 = sUnit("SPEC-B9", { bp: 9000 });
const C2 = sUnit("SPEC-C2", { powerCost: 2 });
const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const C7 = sUnit("SPEC-C7", { powerCost: 7 });
const EXTRA = [S1, B6, B9, C2, C3, C6, C7];

const RIDER_FEATURES = ["仮面ライダー", "男", "改造人間"];

// ===========================================================================
describe("XG1-048 仮面ライダースーパー1・EH", () => {
  // R-ERR-XG1-048（読み替え後の本文。カタログは読み替え後の文を持つ）
  const TEXT = "※モーフ 【エレキ光線】敵軍Ｓユニットを１体選んでもよい。次の相手のターン、選んだユニットがバトルエリアにあるとき、選んだユニットと隣り合っているユニットは、そのターンを終えるとき撃破される。";

  it("XG1-048: カタログ本文（読み替え後）・スペックが出典と一致（出典: atwiki/page-1632・R-ERR-XG1-048）", () => {
    expectCatalogText("XG1-048", TEXT);
    expectUnitStats("XG1-048", { name: "仮面ライダースーパー1・EH", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: [...RIDER_FEATURES, "ファイブハンド"] });
    expectRarityIn("XG1-048", ["R"]);
  });

  it("XG1-048: SP「1/5」— 5番目で SP1、4番目では SP を持たない（出典: atwiki/page-1632「SP：1/5」・05-battle-strike-damage）", () => {
    expect(spOf(p1Battle({ battle: [...fill(4), inst("XG1-048", "eh")] }), "player1", "XG1-048:eh")).toBe(1);
    expect(spOf(p1Battle({ battle: [...fill(3), inst("XG1-048", "eh")] }), "player1", "XG1-048:eh")).toBe(0);
  });

  const enemy = () => ({ battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2"), inst("TST-UNIT-0", "b3")], rush: [inst("TST-UNIT-0", "r")] });
  const rc = () => rcAt("XG1-048:eh", {}, enemy());

  it("XG1-048: 【エレキ光線】RC — 敵軍 S ユニット（バトルエリア・ラッシュエリア）から1体選べる（任意）（出典: atwiki/page-1632「敵軍Ｓユニットを１体選んでもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-048");
    expect([...choiceIds(s)].sort()).toEqual(["TST-UNIT-0:b1", "TST-UNIT-0:b2", "TST-UNIT-0:b3", "TST-UNIT-0:r"]);
    expect(canSkip(s)).toBe(true);
  });

  /** b2 を選び、相手のターンのバトルフェイズに ids をバトルエリアに出して、相手のターンを終える。 */
  const nextTurn = (ids: string[]) => {
    let s = toEnemyBattle(resolveAll(rc(), ["TST-UNIT-0:b2"]));
    s = enterSeq(s, ids, "player2");
    return endTurn(s);
  };

  it("XG1-048: 次の相手のターンを終えるとき、選んだユニットがバトルエリアにあれば、隣り合っているユニット（両隣）が撃破される（選んだユニットは残る）（出典: R-ERR-XG1-048「選んだユニットがバトルエリアにあるとき、選んだユニットと隣り合っているユニットは、そのターンを終えるとき撃破される」）", () => {
    const s = nextTurn(["TST-UNIT-0:b1", "TST-UNIT-0:b2", "TST-UNIT-0:b3"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b2")).toBe("battle");
  });

  it("XG1-048: 選んだユニットがバトルエリアになければ、ほかのユニットは撃破されない（出典: R-ERR-XG1-048「選んだユニットがバトルエリアにあるとき」・atwiki/page-1632 Q1）", () => {
    const s = nextTurn(["TST-UNIT-0:b1", "TST-UNIT-0:b3"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b3")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-049 スカイライダー", () => {
  const TEXT =
    "※ウイング ※これはウイングを持たないユニットにアタックされない。 【セイリングジャンプ】敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードがSユニットのカードなら持ち主の山札の下に、それ以外なら上に戻す。";

  it("XG1-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-1540）", () => {
    expectCatalogText("XG1-049", TEXT);
    expectUnitStats("XG1-049", { name: "スカイライダー", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: RIDER_FEATURES });
    expectRarityIn("XG1-049", ["NR"]);
  });

  wingTests("XG1-049", "atwiki/page-1540");

  it("XG1-049: ※ ウイングを持たない敵軍ユニットはこれにアタックできない（出典: atwiki/page-1540「これはウイングを持たないユニットにアタックされない」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-049", "sk")] }, { battle: [inst("TST-UNIT-0", "a")] });
    expect(targetsOf(s, "TST-UNIT-0:a", "player2")).not.toContain("XG1-049:sk");
  });

  it("XG1-049: ※ ウイングを持つ敵軍ユニット（バルイーグル XG1-003）はウイングでこれにアタックできる（出典: atwiki/page-1540「ウイングを持たないユニットに」）", () => {
    let s = enemyBoard({ battle: [inst("XG1-049", "sk")] }, { rush: [inst("XG1-003", "w")] });
    s = act(s, { type: "hold_for_wing", playerId: "player2", instanceId: "XG1-003:w" });
    expect(targetsOf(s, "XG1-003:w", "player2")).toContain("XG1-049:sk");
  });

  const rc = (top: string) => rcAt("XG1-049:sk", {}, { deck: [inst(top, "top"), ...deckCards(3, "e")] });

  it("XG1-049: 【セイリングジャンプ】RC — 敵軍山札の上をオモテにするかを選べる（任意）（既知の不具合: CARD-XG1-049 選択が開かない）（出典: atwiki/page-1540「敵軍山札の上から1枚をオモテにしてもよい」）", () => {
    const s = rc("TST-UNIT-0");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-049");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-049: オモテにしたカードが S ユニットのカードなら、持ち主の山札の下に戻る（既知の不具合: CARD-XG1-049 山札の上に残る）（出典: atwiki/page-1540「Sユニットのカードなら持ち主の山札の下に」）", () => {
    const s = resolveAll(rc("TST-UNIT-0"), ["accept", "reveal"]);
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("TST-UNIT-0:top");
  });

  it("XG1-049: オモテにしたカードが S ユニット以外（オペレーション）なら山札の上に戻る（出典: atwiki/page-1540「それ以外なら上に戻す」）", () => {
    const s = resolveAll(rc("TST-OP"), ["accept", "reveal"]);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:top");
  });
});

// ===========================================================================
describe("XG1-050 ライダーシンドローム", () => {
  const TEXT =
    "本来の特徴に「仮面ライダー」を持つ自軍ユニットが10体以上あれば、すべての敵軍ユニットを撃破する。9体以下なら、本来の特徴に「仮面ライダー」を持つ自軍ユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを1体選び撃破する。";

  it("XG1-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-1633）", () => {
    expectCatalogText("XG1-050", TEXT);
    expectOpStats("XG1-050", { name: "ライダーシンドローム", category: "ET", powerCost: 6 });
    expectRarityIn("XG1-050", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[]) =>
    rushPhaseBoard(
      { rush, hand: [inst("XG1-050", "op")], command: releasedCat("ET", 1), power: powerCards(6) },
      { battle: [inst("SPEC-B6", "e6"), inst("SPEC-B9", "e9")], rush: [inst("TST-UNIT-0", "er")] },
      EXTRA,
    );

  it("XG1-050: 9体以下なら、仮面ライダーの自軍ユニットの BP の合計（V3 4000＋スーパー1 3000＝7000）以下の敵軍ユニットを1体選び撃破する（BP9000 は選べない。仮面ライダーでない自軍ユニットは数えない）（既知の不具合: CARD-XG1-050 何も撃破されない）（出典: atwiki/page-1633「本来の特徴に「仮面ライダー」を持つ自軍ユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを1体選び撃破する」・カード評価「サイズやエリアを問わずに対象を選べる」）", () => {
    const s = useCard(board([inst("XG1-044", "r1"), inst("XG1-047", "r2"), inst("TST-UNIT-7", "x")]), "player1", "XG1-050:op");
    expectChoiceFrom(s, "player1", "XG1-050");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-B6:e6", "TST-UNIT-0:er"]);
    expect(zoneOf(resolveAll(s, ["SPEC-B6:e6"]), "player2", "SPEC-B6:e6")).toBe("discard");
  });

  it("XG1-050: 仮面ライダーの自軍ユニットが10体以上なら、すべての敵軍ユニットを撃破する（既知の不具合: CARD-XG1-050）（出典: atwiki/page-1633「10体以上あれば、すべての敵軍ユニットを撃破する」）", () => {
    const riders = Array.from({ length: 10 }, (_, i) => inst("RK-125", `r${i}`));
    const s = resolveAll(useCard(board(riders), "player1", "XG1-050:op"));
    expect(s.players.player2.battle).toHaveLength(0);
    expect(s.players.player2.rush).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG1-051 仮面ライダーZX", () => {
  const TEXT =
    "【ZXキック】敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、選んだカードを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG1-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-1637）", () => {
    expectCatalogText("XG1-051", TEXT);
    expectUnitStats("XG1-051", { name: "仮面ライダーZX", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: [...RIDER_FEATURES, "メカ", "忍者"] });
    expectRarityIn("XG1-051", ["NR"]);
  });

  const two = (p2: Partial<GameState["players"]["player2"]> = {}) => rcAt("XG1-051:zx", {}, { operation: [inst("RS-436", "o1"), inst("RS-437", "o2")], ...p2 });

  it("XG1-051: 【ZXキック】RC — 敵軍常駐置き場にカードが2枚あれば、その中から1枚選ぶ選択が開く（任意）（出典: atwiki/page-1637「敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい」）", () => {
    const s = two();
    expectChoiceFrom(s, "player1", "XG1-051");
    expect([...choiceIds(s)].sort()).toEqual(["RS-436:o1", "RS-437:o2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-051: 選んだカードは持ち主のコマンドゾーンにホールド状態で置かれる（既知の不具合: CARD-XG1-051 候補は出るが選ぶ手が合法手にない）（出典: atwiki/page-1637「選んだカードを持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = pick(two(), "RS-437:o2");
    expect(zoneOf(s, "player2", "RS-437:o2")).toBe("command");
    expect(isHeldCard(s, "player2", "RS-437:o2")).toBe(true);
  });

  it("XG1-051: 敵軍コマンドゾーンが5枚で置けなければ捨札にする（既知の不具合: CARD-XG1-051）（出典: atwiki/page-1637「置けなければ捨札にする」）", () => {
    const s = pick(two({ command: releasedCat("WB", 5, "fc") }), "RS-437:o2");
    expect(zoneOf(s, "player2", "RS-437:o2")).toBe("discard");
  });

  it("XG1-051: 常駐に重ねたウラ向きのカードも常駐置き場のカードとして選べる（ウラ向きのまま）（既知の不具合: CARD-XG1-051 重ねたカードを数えず選択が開かない）（出典: atwiki/page-1637「（ウラ向きのカードはウラ向きのまま選ぶ）」・カード評価「貴重な常駐破壊能力」）", () => {
    const s = rcAt("XG1-051:zx", {}, { operation: [{ ...inst("RS-436", "o1"), stackedCards: [{ ...inst("TST-OP", "fd"), faceDown: true }] }, inst("RS-437", "o2")] });
    expect(choiceIds(s)).toContain("TST-OP:fd");
  });

  it("XG1-051: 敵軍常駐置き場のカードが1枚なら選択は開かない（出典: atwiki/page-1637「2枚以上あれば」）", () => {
    const s = rcAt("XG1-051:zx", {}, { operation: [inst("RS-436", "o1")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-051");
    expect(zoneOf(s, "player2", "RS-436:o1")).toBe("operation");
  });
});

// ===========================================================================
describe("XG1-052 仮面ライダーアギトTF", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーアギトGF」のカードを1枚選び、自軍ラッシュエリアに出す。 【ファイヤーストームアタック】これが自軍エリアにある間、相手がターンを終えるとき、次の効果を発動できる⇒そのターン中にホールド状態になった敵軍ユニットを、すべて持ち主の山札に戻してシャッフルする。";

  it("XG1-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-1673）", () => {
    expectCatalogText("XG1-052", TEXT);
    expectUnitStats("XG1-052", { name: "仮面ライダーアギトTF", category: "MA", size: "S", bp: 3500, sp: 1, powerCost: "7-", features: ["仮面ライダー", "男", "賢者の石"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG1-052", ["R"]);
  });

  zordDownTests("XG1-052", "RK-162", "仮面ライダーアギトGF", "atwiki/page-1673", "MA");
  reanimateTests("XG1-052", "RK-162", "仮面ライダーアギトGF", "atwiki/page-1673");

  /** 敵軍（player2）バトルフェイズ。敵軍のバルイーグルがウイングでホールドし、敵軍ラッシュエリアにはターンの前からホールド状態のユニットもいる。相手がターンを終える。 */
  const enemyTurnEnd = () => {
    let s = enemyBoard({ rush: [inst("XG1-052", "tf")] }, { rush: [inst("XG1-003", "w"), heldUnit("TST-UNIT-0", "old")] });
    s = act(s, { type: "hold_for_wing", playerId: "player2", instanceId: "XG1-003:w" });
    return endTurn(s);
  };

  it("XG1-052: 【ファイヤーストームアタック】相手がターンを終えるとき、発動するかを選べる（任意）（既知の不具合: CARD-XG1-052 選択が開かない）（出典: atwiki/page-1673「相手がターンを終えるとき、次の効果を発動できる」）", () => {
    const s = enemyTurnEnd();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG1-052");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-052: そのターン中にホールド状態になった敵軍ユニット（ウイングでホールドしたバルイーグル）だけが持ち主の山札に戻る（前からホールド状態のユニットは残る）（既知の不具合: CARD-XG1-052）（出典: atwiki/page-1673「そのターン中にホールド状態になった敵軍ユニットを、すべて持ち主の山札に戻してシャッフルする」・カード評価「ウイング…へのメタ」）", () => {
    const s = resolveAll(enemyTurnEnd(), ["accept"]);
    expect(zoneOf(s, "player2", "XG1-003:w")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:old")).toBe("rush");
  });
});

// ===========================================================================
describe("XG1-053 仮面ライダーアギトBF", () => {
  const TEXT =
    "【バーニングライダーパンチ】これは、アタックしてバトルに勝つたび、可能なら追加でアタックする。ただし、これはバトルを終えるたび、このターン、BP+500され、自分がターンを終えるときBP6000以上なら撃破される。";

  it("XG1-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-1571）", () => {
    expectCatalogText("XG1-053", TEXT);
    expectUnitStats("XG1-053", { name: "仮面ライダーアギトBF", category: "MA", size: "S", bp: 4000, sp: undefined, powerCost: 5, features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("XG1-053", ["N"]);
  });

  const won = () =>
    settle(attack(p1Battle({ battle: [inst("XG1-053", "bf")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3"), inst("TST-UNIT-0", "e4"), inst("TST-UNIT-0", "e5")] }), "XG1-053:bf", "TST-UNIT-0:e1"));

  it("XG1-053: 【バーニングライダーパンチ】アタックしてバトルに勝つと、可能なら追加でアタックする（ほかの行動・フェイズの終了より先にアタックしなければならない）（既知の不具合: CARD-XG1-053 追加のアタックの手がない）（出典: atwiki/page-1571「アタックしてバトルに勝つたび、可能なら追加でアタックする」・カード評価「強制的にアタックし続けなければならない」）", () => {
    const s = won();
    expect(targetsOf(s, "XG1-053:bf")).toContain("TST-UNIT-0:e2");
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
  });

  it("XG1-053: バトルを終えるたび、このターン BP+500（1回で 4500）（既知の不具合: CARD-XG1-053 BP4000 のまま）（出典: atwiki/page-1571「バトルを終えるたび、このターン、BP+500され」）", () => {
    expect(bpOf(won(), "player1", "XG1-053:bf")).toBe(4500);
  });

  it("XG1-053: 4回バトルして BP6000 になれば、自分がターンを終えるとき撃破される（既知の不具合: CARD-XG1-053）（出典: atwiki/page-1571「自分がターンを終えるときBP6000以上なら撃破される」・カード評価「4体以上撃破すると自分も撃破されてしまう」）", () => {
    let s = won();
    for (const e of ["e2", "e3", "e4"]) s = settle(attack(s, "XG1-053:bf", `TST-UNIT-0:${e}`));
    expect(bpOf(s, "player1", "XG1-053:bf")).toBe(6000);
    // 「可能なら追加でアタックする」ので、残りの e5 にもアタックしてからでないとターンを終えられない（XG1-judgments.md）。
    s = settle(attack(s, "XG1-053:bf", "TST-UNIT-0:e5"));
    s = endTurn(s);
    expect(zoneOf(s, "player1", "XG1-053:bf")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-054 仮面ライダーアギトSHF", () => {
  const TEXT =
    "【シャイニングカリバー】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から2枚をオモテにしてもよい。そうしたとき、オモテにしたカードの必要パワーの数字を見て、数字の小さい方以上～数字が大きい方以下の必要パワーの数字を持つ敵軍ユニットがあれば1体選び、持ち主のパワーゾーンにダメージにして置く。その後、オモテにしたカードから1枚選び手札に加え、残りを山札の上に戻す。";

  it("XG1-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-1670）", () => {
    expectCatalogText("XG1-054", TEXT);
    expectUnitStats("XG1-054", { name: "仮面ライダーアギトSHF", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: "5+", features: ["仮面ライダー", "男", "賢者の石"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG1-054", ["SR"]);
  });

  it("XG1-054: 追加条件 — 自軍「仮面ライダーアギトBF」（XG1-053）1体を捨札にしてパワー5でラッシュできる（いなければラッシュできない）（出典: atwiki/page-1670「追加条件：自軍「仮面ライダーアギトBF」1体を捨札にする」）", () => {
    const board = (rush: ReturnType<typeof inst>[]) => rushPhaseBoard({ hand: [inst("XG1-054", "sh")], rush, command: releasedCat("MA", 1), power: powerCards(5) });
    const r = rushFromHand(board([inst("XG1-053", "bf")]), "player1", "XG1-054:sh");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-053:bf")).toBe("discard");
    expect(canStartRush(board([inst("TST-UNIT-0", "x")]), "player1", "XG1-054:sh")).toBe(false);
  });

  /** 自軍山札の上が必要パワー2・6 のカード。敵軍は必要パワー3・0・7 の S ユニット。 */
  const entered = () =>
    act(
      p1Battle({ rush: [inst("XG1-054", "sh")], deck: [inst("SPEC-C2", "d2"), inst("SPEC-C6", "d6"), ...deckCards(3)] }, { battle: [inst("SPEC-C3", "c3"), inst("TST-UNIT-0", "c0"), inst("SPEC-C7", "c7")] }, EXTRA),
      { type: "move_to_battle", playerId: "player1", instanceId: "XG1-054:sh" },
    );

  it("XG1-054: 【シャイニングカリバー】自軍ターンにバトルエリアに出たとき、選択が開く（任意）（出典: atwiki/page-1670「自軍山札の上から2枚をオモテにしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-054");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-054: 選べるのは、オモテにした2枚の必要パワー（2と6）の間（2以上6以下）の必要パワーを持つ敵軍ユニットだけ（0・7 は選べない）（既知の不具合: CARD-XG1-054 山札をオモテにせず必要パワー0 のユニットも候補になる）（出典: atwiki/page-1670「数字の小さい方以上～数字が大きい方以下の必要パワーの数字を持つ敵軍ユニット」）", () => {
    expect(choiceIds(entered())).toEqual(["SPEC-C3:c3"]);
  });

  it("XG1-054: 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（既知の不具合: CARD-XG1-054 オモテ向きで置かれる）（出典: atwiki/page-1670「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(entered(), ["accept", "SPEC-C3:c3", "SPEC-C6:d6"]);
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("power");
    expect(isDamageCard(s, "player2", "SPEC-C3:c3")).toBe(true);
  });

  it("XG1-054: その後、オモテにした2枚から1枚を手札に加え、残りを山札の上に戻す（既知の不具合: CARD-XG1-054 手札に加わらない）（出典: atwiki/page-1670「オモテにしたカードから1枚選び手札に加え、残りを山札の上に戻す」）", () => {
    const s = resolveAll(entered(), ["accept", "SPEC-C3:c3", "SPEC-C6:d6"]);
    expect(zoneOf(s, "player1", "SPEC-C6:d6")).toBe("hand");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-C2:d2");
  });
});
