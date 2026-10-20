/**
 * カード別スペック: XG3-043〜XG3-049（クロスギャザー ザ・Wインパクト ライダーマン〜ストレンジベント）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-045 Q1（page-2015）、XG3-049 Q1〜Q3（page-1913）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-05 RC・R-KW-CHASE-01・R-KW-RESIST-01・R-KW-MORPH 系・R-ADD-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で、カタログの誤りは「カタログ」と書いて残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  bpOf,
  canSkip,
  cardIn,
  chaseTargets,
  choiceIds,
  choiceOf,
  DEFS,
  deckCards,
  endTurnKeep,
  enter,
  enemyRushes,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  inst,
  legal,
  morphCandidates,
  pickAs,
  PLAIN_VEHICLE,
  powerCards,
  rcEnter,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  ridingPair,
  rushBoard,
  settle,
  skip,
  st,
  sUnit,
  useCard,
  useRef,
  vehicleCard,
  zoneOf,
  zordDownTests,
} from "./XG3-043-062.helpers";

const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const ENEMY = sUnit("SPEC-EN", { category: "WB", bp: 1000 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const BP3000_CARD = sUnit("SPEC-BP3000", { bp: 3000 });
const MIRROR = sUnit("SPEC-MIRROR", { category: "WB", bp: 1000, features: ["ミラーライダー"] });
const VEHICLE2 = vehicleCard("SPEC-VEHICLE2", { category: "ET" });
const EXTRA = [NOSP, ENEMY, C2, C4, BP3000_CARD, MIRROR, VEHICLE2, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const rc = (rider: string, p1: P1 = {}, p2: P2 = {}) => rcEnter(rider, p1, p2, EXTRA);
/** 敵軍（player2）ターンのバトルフェイズに、attacker（敵軍バトルエリア）で自軍の target をアタックする（反応ウィンドウは残す）。 */
const enemyAttack = (p1: P1, target: string, attacker = "TST-UNIT-7:atk", p2: P2 = {}) => {
  const [aid, asuf] = attacker.split(":") as [string, string];
  const s = st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { battle: [inst(aid, asuf)], deck: deckCards(5, "e"), ...p2 } }, EXTRA);
  return attack(s, attacker, target, "player2");
};

// ===========================================================================
describe("XG3-043 ライダーマン", () => {
  const TEXT =
    "【プルトンロケット阻止】これが自軍エリアにある間、自軍ラッシュフェイズ中、これを捨札にして次の効果を発動できる⇒敵軍山札の上から5枚をオモテにする。そうしたとき、その中から常駐オペレーション以外のオペレーションカードを1枚選び捨札にする。その後、残りのカードを山札に戻してシャッフルする。";

  it("XG3-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-1911「SP：1/5」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-043", TEXT);
    expectStats("XG3-043", { name: "ライダーマン", category: "ET", size: "S", bp: 1000, sp: "1/5", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG3-043", ["N"]);
  });

  /** 敵軍山札の上5枚: 通常のオペレーション・常駐オペレーション（PK-010）・ユニット・通常のオペレーション・ユニット。6枚目も通常のオペレーション。 */
  const enemyDeck = () => [inst("TST-OP", "o1"), inst("PK-010", "res"), inst("TST-UNIT-0", "u1"), inst("TST-OP", "o2"), inst("TST-UNIT-2", "u2"), inst("TST-OP", "o6")];
  const rushPhase = () => board({ rush: [inst("XG3-043", "rm")] }, { deck: enemyDeck() });

  it("XG3-043:【プルトンロケット阻止】— 自軍ラッシュフェイズ中、自軍エリアのこれを捨札にして発動でき、敵軍山札の上5枚から常駐でないオペレーションカードを選ぶ（常駐オペレーション・ユニット・6枚目は選べない）（出典: atwiki/page-1911「これを捨札にして次の効果を発動できる⇒敵軍山札の上から5枚をオモテにする。そうしたとき、その中から常駐オペレーション以外のオペレーションカードを1枚選び」）", () => {
    const s = useRef(rushPhase(), "XG3-043:rm");
    expect(zoneOf(s, "player1", "XG3-043:rm")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG3-043");
    expect(choiceIds(s).sort()).toEqual(["TST-OP:o1", "TST-OP:o2"]);
  });

  it("XG3-043:【プルトンロケット阻止】— 選んだオペレーションカードを捨札にし、残りを山札に戻す（敵軍山札は1枚減る）（出典: atwiki/page-1911「1枚選び捨札にする。その後、残りのカードを山札に戻してシャッフルする」）", () => {
    const s = resolveAll(useRef(rushPhase(), "XG3-043:rm"), ["TST-OP:o2"]);
    expect(zoneOf(s, "player2", "TST-OP:o2")).toBe("discard");
    expect(s.players.player2.deck).toHaveLength(5);
    expect(zoneOf(s, "player2", "PK-010:res")).toBe("deck");
  });

  it("XG3-043:【プルトンロケット阻止】— 自軍バトルフェイズ中は発動できない（出典: atwiki/page-1911「自軍ラッシュフェイズ中」）", () => {
    expect(refsOf(battle({ battle: [inst("XG3-043", "rm")] }, { deck: enemyDeck() }), "XG3-043:rm").filter((a) => a.type !== "battle" && a.type !== "strike")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-044 仮面ライダーストロンガー", () => {
  const TEXT = "【エレクトロファイヤー】敵軍コマンドゾーンから、SPが空欄ではないユニットカードを1枚選び、敵軍ラッシュエリアにホールド状態で出してもよい。";

  it("XG3-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-1912「CN：RC」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-044", TEXT);
    expectStats("XG3-044", { name: "仮面ライダーストロンガー", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("XG3-044", ["NR"]);
  });

  /** 敵軍コマンドゾーン: SP！のユニット（XG3-022）・SP1 のユニット・SP なしのユニット・オペレーション。 */
  const ridden = () => rc("XG3-044:s", {}, { command: [inst("XG3-022", "c1"), inst("TST-UNIT-0", "c2"), inst("SPEC-NOSP", "c3"), inst("TST-OP", "c4")] });

  it("XG3-044:【エレクトロファイヤー】— RC で、敵軍コマンドゾーンの SP が空欄でないユニットカード（「！」・「1」）から選べる（SP なしのユニット・オペレーションは選べない。任意）（出典: atwiki/page-1912「SPが空欄ではないユニットカードを1枚選び…出してもよい」・R-CN-05）", () => {
    const s = ridden();
    expectChoiceFrom(s, "player1", "XG3-044");
    expect(choiceIds(s).sort()).toEqual(["TST-UNIT-0:c2", "XG3-022:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-044:【エレクトロファイヤー】— 選んだカードを敵軍ラッシュエリアにホールド状態で出す（出典: atwiki/page-1912「敵軍ラッシュエリアにホールド状態で出してもよい」）", () => {
    const s = resolveAll(ridden(), ["TST-UNIT-0:c2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:c2")).toBe("rush");
    expect(cardIn(s, "player2", "TST-UNIT-0:c2")?.commandHeld).toBe(true);
  });

  it("XG3-044:【エレクトロファイヤー】— ライドせずにバトルエリアに出たとき（RC 不成立）は発動しない（出典: atwiki/page-1912「CN：RC」・R-CN-05）", () => {
    const s = enter(battle({ rush: [inst("XG3-044", "s")] }, { command: [inst("TST-UNIT-0", "c2")] }), "XG3-044:s");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-044");
    expect(zoneOf(s, "player2", "TST-UNIT-0:c2")).toBe("command");
  });
});

// ===========================================================================
describe("XG3-045 チャージアップストロンガー", () => {
  const TEXT =
    "※これが自軍エリアにある間、自分がターンを終えるとき、自軍捨札の「仮面ライダーストロンガー」のカードとこれを置き換える。置き換えられなければこれを捨札にする。 【超電稲妻キック】このターン、これがSPが空欄ではないユニットをバトルで撃破したとき、相手に1点ダメージを与える。";

  it("XG3-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-2015「必要パワー：7-」「CN：RC」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-045", TEXT);
    expectStats("XG3-045", { name: "チャージアップストロンガー", category: "ET", size: "S", bp: 6500, sp: 1, powerCost: "7-", comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "超電子ダイナモ"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG3-045", ["SR"]);
  });

  zordDownTests("XG3-045", "XG3-044", "仮面ライダーストロンガー", "atwiki/page-2015「追加条件：自軍「仮面ライダーストロンガー」1枚を捨札にすれば必要パワー0になる」", "ET");

  const endBoard = (discard = [inst("XG3-044", "d")]) => battle({ battle: [inst("XG3-045", "cs")], discard });

  it("XG3-045: ※ 自分がターンを終えるとき、自軍捨札の「仮面ライダーストロンガー」とこれを置き換える（ストロンガーがこれのいた場所へ、これは捨札へ）（出典: atwiki/page-2015「自軍捨札の「仮面ライダーストロンガー」のカードとこれを置き換える」・R-REPL-04）", () => {
    const s = resolveAll(endTurnKeep(endBoard()), ["XG3-044:d"]);
    expect(zoneOf(s, "player1", "XG3-045:cs")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-044:d")).toBe("battle");
  });

  it("XG3-045: ※ 自軍捨札に「仮面ライダーストロンガー」がなければ、ターンを終えるときにこれを捨札にする（出典: atwiki/page-2015「置き換えられなければこれを捨札にする」）", () => {
    const s = resolveAll(endTurnKeep(endBoard([])));
    expect(zoneOf(s, "player1", "XG3-045:cs")).toBe("discard");
  });

  it("XG3-045:【超電稲妻キック】— RC しただけでは相手にダメージを与えない（出典: atwiki/page-2015「このターン、これがSPが空欄ではないユニットをバトルで撃破したとき、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(rc("XG3-045:cs", {}, { battle: [inst("TST-UNIT-0", "e")] }));
    expect(s.players.player2.damage).toBe(0);
  });

  it("XG3-045:【超電稲妻キック】— RC したターン、SP のあるユニットをバトルで撃破すると相手に1点ダメージ（出典: atwiki/page-2015「SPが空欄ではないユニットをバトルで撃破したとき」）", () => {
    let s = resolveAll(rc("XG3-045:cs", {}, { battle: [inst("TST-UNIT-0", "e")] }));
    const before = s.players.player2.damage;
    s = resolveAll(settle(attack(s, "XG3-045:cs", "TST-UNIT-0:e")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(before + 1);
  });

  it("XG3-045:【超電稲妻キック】— SP のないユニットをバトルで撃破してもダメージは増えない（出典: atwiki/page-2015「SPが空欄ではないユニット」）", () => {
    let s = resolveAll(rc("XG3-045:cs", {}, { battle: [inst("SPEC-NOSP", "e")] }));
    const before = s.players.player2.damage;
    s = resolveAll(settle(attack(s, "XG3-045:cs", "SPEC-NOSP:e")));
    expect(zoneOf(s, "player2", "SPEC-NOSP:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(before);
  });
});

// ===========================================================================
describe("XG3-046 仮面ライダーBLACK", () => {
  const TEXT =
    "※チェイス ※敵軍ターン中、これが撃破されて捨札になったとき、これを自軍パワーゾーンにダメージにして置いてもよい。そうしたとき、自分の手札から「仮面ライダーBLACK RX」のカードを1枚選び、自軍ラッシュエリアに出す。 【キングストーンフラッシュ】自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。そうしたとき、捨札にしたカードの必要パワーの数字以下の必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す。";

  it("XG3-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-1967「CN：ＲＣ」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-046", TEXT);
    expectStats("XG3-046", { name: "仮面ライダーBLACK", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "世紀王"] });
    expectRarityIn("XG3-046", ["SR"]);
  });

  it("XG3-046: ※チェイス — ライド中にバトルで撃破されるとき、ライドされていない自軍ビークルに乗り換えられる（出典: atwiki/page-1967「※チェイス」・R-KW-CHASE-01）", () => {
    const s = enemyAttack({ battle: ridingPair("XG3-046", "b", "SPEC-VEHICLE", "v"), rush: [inst("SPEC-VEHICLE2", "v2")] }, "XG3-046:b");
    expect(chaseTargets(s, "player1")).toEqual(["SPEC-VEHICLE2:v2"]);
  });

  it("XG3-046: ※ 敵軍ターン中に撃破されて捨札になったとき、自軍パワーゾーンにダメージとして置き、手札の「仮面ライダーBLACK RX」（XG3-048）を自軍ラッシュエリアに出せる（出典: atwiki/page-1967「これを自軍パワーゾーンにダメージにして置いてもよい。そうしたとき、自分の手札から「仮面ライダーBLACK RX」のカードを1枚選び、自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-046", "b")], hand: [inst("XG3-048", "rx")] }, "XG3-046:b")), ["XG3-048:rx"]);
    expect(zoneOf(s, "player1", "XG3-046:b")).toBe("power");
    expect(cardIn(s, "player1", "XG3-046:b")?.faceDown).toBe(true);
    expect(zoneOf(s, "player1", "XG3-048:rx")).toBe("rush");
  });

  it("XG3-046: ※ 手札に「仮面ライダーBLACK RX」がなくても、ダメージとして置くことはできる（出典: atwiki/page-1967 カード評価「仮面ライダーBLACK RXがラッシュできなくてもダメージに送ることができる」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-046", "b")] }, "XG3-046:b")), ["XG3-046:b", "confirm"]);
    expect(zoneOf(s, "player1", "XG3-046:b")).toBe("power");
  });

  /** RC。自軍山札の上: 必要パワー4のユニット。手札: 必要パワー2のユニット。敵軍: 必要パワー0・2・4 の S ユニット・M ユニット。 */
  const kingStone = () =>
    rc("XG3-046:b", { deck: [inst("SPEC-C4", "top"), ...deckCards(3)], hand: [inst("SPEC-C2", "h")] }, { rush: [inst("TST-UNIT-0", "e0"), inst("SPEC-C2", "e2"), inst("SPEC-C4", "e4"), inst("TST-UNIT-2", "m")] });

  it("XG3-046:【キングストーンフラッシュ】— RC で、1枚ドローしてから手札を1枚選び捨札にする（出典: atwiki/page-1967「自分は1枚ドローしてから、自分の手札を1枚選び捨札にする」）", () => {
    const s = kingStone();
    expect(zoneOf(s, "player1", "SPEC-C4:top")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG3-046");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C2:h", "SPEC-C4:top"]);
  });

  it("XG3-046:【キングストーンフラッシュ】— 捨札にしたカードの必要パワー（4）以下の必要パワーを持つ敵軍 S ユニットを1体選び、持ち主の山札の下に戻す（M ユニットは選べない）（出典: atwiki/page-1967「捨札にしたカードの必要パワーの数字以下の必要パワーを持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す」）", () => {
    let s = pickAs(kingStone(), "player1", "SPEC-C4:top");
    expect(zoneOf(s, "player1", "SPEC-C4:top")).toBe("discard");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C2:e2", "SPEC-C4:e4", "TST-UNIT-0:e0"]);
    s = resolveAll(s, ["SPEC-C4:e4"]);
    const deck = s.players.player2.deck;
    expect(deck[deck.length - 1]?.instanceId).toBe("SPEC-C4:e4");
  });
});

// ===========================================================================
describe("XG3-047 シャドームーン", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 【シャドーフラッシュ】自分の手札からユニットカードを1枚選び、捨札にしてもよい。そうしたとき、捨札にしたカードのBP以下の本来のBPを持つ敵軍ユニットを1体選び撃破する。";

  it("XG3-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-1968「CN：RC」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-047", TEXT);
    expectStats("XG3-047", { name: "シャドームーン", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: 5, comboNumber: "RC", features: ["男", "改造人間", "世紀王"] });
    expectRarityIn("XG3-047", ["SR"]);
  });

  it("XG3-047: ※ 敵軍ターン中、SP1 以上のユニットとバトルすると、バトルに勝っても撃破される（出典: atwiki/page-1968「敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-047", "sm")] }, "XG3-047:sm", "TST-UNIT-0:atk")));
    expect(zoneOf(s, "player1", "XG3-047:sm")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
  });

  it("XG3-047: ※ 相手が SP なしのユニットなら、勝てば撃破されない（出典: atwiki/page-1968「SP1以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-047", "sm")] }, "XG3-047:sm", "SPEC-NOSP:atk")));
    expect(zoneOf(s, "player1", "XG3-047:sm")).toBe("battle");
  });

  it("XG3-047: ※ 自軍ターン中に SP1 のユニットとバトルして勝っても撃破されない（出典: atwiki/page-1968「敵軍ターン中、」）", () => {
    const s = resolveAll(settle(attack(battle({ battle: [inst("XG3-047", "sm")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG3-047:sm", "TST-UNIT-0:e")));
    expect(zoneOf(s, "player1", "XG3-047:sm")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  /** RC。手札: BP3000 のユニット・オペレーション。敵軍: BP1000・BP3000（M）・BP13000。 */
  const shadow = () =>
    rc("XG3-047:sm", { hand: [inst("SPEC-BP3000", "h"), inst("TST-OP", "op")] }, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-2", "e3"), inst("TST-UNIT-7", "e13")] });

  it("XG3-047:【シャドーフラッシュ】— RC で、自分の手札のユニットカードから選べる（オペレーションは選べない。任意）（出典: atwiki/page-1968「自分の手札からユニットカードを1枚選び、捨札にしてもよい」）", () => {
    const s = shadow();
    expectChoiceFrom(s, "player1", "XG3-047");
    expect(choiceIds(s)).toEqual(["SPEC-BP3000:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-047:【シャドーフラッシュ】— 捨札にしたカードの BP（3000）以下の本来の BP を持つ敵軍ユニット（エリア・サイズを問わない）を1体選び撃破する（出典: atwiki/page-1968「捨札にしたカードのBP以下の本来のBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = pickAs(shadow(), "player1", "SPEC-BP3000:h");
    expect(zoneOf(s, "player1", "SPEC-BP3000:h")).toBe("discard");
    expect(choiceIds(s).sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-2:e3"]);
    s = resolveAll(s, ["TST-UNIT-2:e3"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e3")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-048 仮面ライダーBLACK RX", () => {
  const TEXT = "※レジスト ※モーフ 【リボルクラッシュ】敵軍バトルエリアのユニットがSユニット1体だけなら、そのユニットを持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("XG3-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-2008「CN：RC」「レアリティ：スーパーレア」）", () => {
    expectCatalogText("XG3-048", TEXT);
    expectStats("XG3-048", { name: "仮面ライダーBLACK RX", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("XG3-048", ["SR"]);
  });

  resistTests("XG3-048", "atwiki/page-2008");

  it("XG3-048: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（RK-261 仮面ライダーBLACK RX）と置き換えられる（出典: atwiki/page-2008「※モーフ」「（モーフできるユニット）仮面ライダーBLACK RX」）", () => {
    const s = enemyRushes({ battle: [inst("XG3-048", "rx")], command: [inst("RK-261", "rk"), inst("XG3-046", "b")] }, "SPEC-EN:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-261:rk"]);
  });

  it("XG3-048:【リボルクラッシュ】— RC で、敵軍バトルエリアのユニットが S ユニット1体だけなら、そのユニットを選べる（任意）（出典: atwiki/page-2008「そのユニットを持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = rc("XG3-048:rx", {}, { battle: [inst("TST-UNIT-0", "e0")] });
    expectChoiceFrom(s, "player1", "XG3-048");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-048:【リボルクラッシュ】— そのユニットを持ち主のパワーゾーンにダメージ（ウラ向き）として置く（出典: atwiki/page-2008「持ち主のパワーゾーンにダメージにして置いてもよい」・カード評価「除去+2点を狙える」）", () => {
    const s = resolveAll(rc("XG3-048:rx", {}, { battle: [inst("TST-UNIT-0", "e0")] }), ["TST-UNIT-0:e0"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-0:e0")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG3-048:【リボルクラッシュ】— 敵軍バトルエリアのユニットが2体以上なら発動しない（出典: atwiki/page-2008「敵軍バトルエリアのユニットがSユニット1体だけなら」）", () => {
    const s = resolveAll(rc("XG3-048:rx", {}, { battle: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-0", "e1")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("XG3-048:【リボルクラッシュ】— 敵軍バトルエリアのユニットが M ユニット1体だけなら発動しない（出典: atwiki/page-2008「Sユニット1体だけなら」）", () => {
    const s = resolveAll(rc("XG3-048:rx", {}, { battle: [inst("TST-UNIT-2", "m")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-049 ストレンジベント", () => {
  const TEXT =
    "自軍捨札にある「ストレンジベント」以外のカードを、すべてウラ向きにしてシャッフルする。その後、その中から相手にウラ向きのまま1枚選ばせてから、すべてオモテにする。選ばれたカードが通常のオペレーションカードなら、その効果を発動してもよい。発動しなかったか、それ以外のカードだったなら、特徴「ミラーライダー」を持つユニットを1体選び、このターン、BP+2000する。";

  it("XG3-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-1913「カテゴリ：ワイルドビースト」「必要パワー：4」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-049", TEXT);
    expectOpStats("XG3-049", { name: "ストレンジベント", category: "WB", powerCost: 4 });
    expectRarityIn("XG3-049", ["N"]);
  });

  it("XG3-049: 特徴「アドベントカード」を持つ（出典: atwiki/page-1913「特徴：アドベントカード」）", () => {
    expect(DEFS["XG3-049"]?.features).toEqual(["アドベントカード"]);
  });

  /** 自軍ラッシュフェイズ。自軍捨札: ユニット2枚。自軍ラッシュエリア: ミラーライダーのユニット。 */
  const used = (discard = [inst("TST-UNIT-2", "d1"), inst("TST-UNIT-0", "d2")]) =>
    useCard(board({ hand: [inst("XG3-049", "sv")], discard, rush: [inst("SPEC-MIRROR", "mr")], command: releasedCat("WB", 1), power: powerCards(4) }), "player1", "XG3-049:sv");

  it("XG3-049: 使うと、相手が自軍捨札（ストレンジベント以外）のカードからウラ向きのまま1枚選ぶ（出典: atwiki/page-1913「その中から相手にウラ向きのまま1枚選ばせてから」）", () => {
    const s = used();
    expect(choiceOf(s, "player2", "XG3-049")).toBe(true);
    expect(choiceIds(s).sort()).toEqual(["TST-UNIT-0:d2", "TST-UNIT-2:d1"]);
  });

  it("XG3-049: 選ばれたカードがユニットなら、特徴「ミラーライダー」を持つユニットを1体選び、このターン BP+2000（出典: atwiki/page-1913「それ以外のカードだったなら、特徴「ミラーライダー」を持つユニットを1体選び、このターン、BP+2000する」）", () => {
    let s = used();
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-0:d2" });
    s = resolveAll(s, ["SPEC-MIRROR:mr"]);
    expect(bpOf(s, "player1", "SPEC-MIRROR:mr")).toBe(3000);
  });

  it("XG3-049: Q1・Q2 — 自軍捨札にストレンジベント以外のカードが1枚しかなければ、処理はそこで終わる（BP は上がらない）（出典: atwiki/page-1913 Q1「その後以降の…も実行することができません」・Q2「処理は中断されます」）", () => {
    const s = resolveAll(used([inst("TST-UNIT-0", "d2")]), ["SPEC-MIRROR:mr"]);
    expect(bpOf(s, "player1", "SPEC-MIRROR:mr")).toBe(1000);
    expect(legal(s).some((a) => a.type === "resolve_effect_choice")).toBe(false);
  });
});
