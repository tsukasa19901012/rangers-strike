/**
 * カード別スペック: XG3-050〜XG3-056（クロスギャザー ザ・Wインパクト 仮面ライダーゾルダ〜仮面ライダー響鬼）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。本範囲のカードページに atwiki 転載の公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-COUNTER 系・R-ADD 系）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で、カタログの誤りは「カタログ」と書いて残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  bpOf,
  canCounter,
  canEndPhase,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  DEFS,
  deckCards,
  deckWithTen,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  inst,
  pickAs,
  lineUp,
  PLAIN_VEHICLE,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  useCounter,
  zoneOf,
} from "./XG3-043-062.helpers";

const ENEMY = sUnit("SPEC-EN", { category: "WB", bp: 1000 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const E5500 = sUnit("SPEC-E5500", { bp: 5500 });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000 });
const MA_S_NOSP = sUnit("SPEC-MA-S0", { category: "MA", bp: 1000, sp: undefined });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const RIDER = sUnit("SPEC-RIDER", { category: "OT", bp: 1000, features: ["仮面ライダー"] });
const S3500 = sUnit("SPEC-S3500", { category: "MA", bp: 3500 });
const S3000 = sUnit("SPEC-S3000", { category: "MA", bp: 3000 });
const TAKESHI = sUnit("SPEC-TK", { category: "MA", bp: 1000, features: ["猛士"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C2M = sUnit("SPEC-C2M", { bp: 3000, powerCost: "2+", size: "M" });
const EXTRA = [ENEMY, E5000, E5500, MA_S, MA_S_NOSP, WB_S, RIDER, S3500, S3000, TAKESHI, C1, C2, C3, C2M, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);
const enemyAttack = (p1: P1, target: string, attacker = "TST-UNIT-7:atk", p2: P2 = {}) => {
  const [aid, asuf] = attacker.split(":") as [string, string];
  const s = st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { battle: [inst(aid, asuf)], deck: deckCards(5, "e"), ...p2 } }, EXTRA);
  return attack(s, attacker, target, "player2");
};

// ===========================================================================
describe("XG3-050 仮面ライダーゾルダ", () => {
  const TEXT = "【ギガランチャー】これをラッシュしたとき、カテゴリにWBを持つ自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、BP5000以下の敵軍ユニットを1体選び撃破する。";

  it("XG3-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-1914「SP：1/2」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-050", TEXT);
    expectStats("XG3-050", { name: "仮面ライダーゾルダ", category: "WB", size: "S", bp: 4000, sp: "1/2", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG3-050", ["N"]);
  });

  /** 自軍コマンド: WB 2つ（1つはラッシュでホールド）・MA 1つ。敵軍: BP5000（バトルエリア）・BP5500・BP1000（ラッシュエリア）。 */
  const rushed = () =>
    rushFromHand(
      board({ hand: [inst("XG3-050", "z")], power: powerCards(5), command: [...releasedCat("WB", 2), ...releasedCat("MA", 1)] }, { battle: [inst("SPEC-E5000", "e5")], rush: [inst("SPEC-E5500", "e55"), inst("TST-UNIT-0", "e1")] }),
      "player1",
      "XG3-050:z",
    ).state;

  it("XG3-050:【ギガランチャー】— ラッシュしたとき、まずカテゴリに WB を持つ自軍コマンド（ホールド状態のものも）から1つ選べる（MA のコマンドは選べない。任意）（出典: atwiki/page-1914「カテゴリにWBを持つ自軍コマンドを1つ選び捨札にしてもよい」・カード評価「捨札にするコマンドはホールドされていても良い」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG3-050");
    expect(choiceIds(s).sort()).toEqual(["TST-OP:cWB0", "TST-OP:cWB1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-050:【ギガランチャー】— コマンドを捨札にしたとき、BP5000 以下の敵軍ユニット（エリア・サイズを問わない）を1体選び撃破する（BP5500 は選べない）（出典: atwiki/page-1914「BP5000以下の敵軍ユニットを1体選び撃破する」・カード評価「サイズ、エリアを問わない」）", () => {
    let s = pickAs(rushed(), "player1", "TST-OP:cWB1");
    expect(zoneOf(s, "player1", "TST-OP:cWB1")).toBe("discard");
    expect(choiceIds(s).sort()).toEqual(["SPEC-E5000:e5", "TST-UNIT-0:e1"]);
    s = resolveAll(s, ["SPEC-E5000:e5"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:e5")).toBe("discard");
  });

  it("XG3-050:【ギガランチャー】— 見送れば、敵軍ユニットは撃破されない（出典: atwiki/page-1914「捨札にしてもよい。そうしたとき」）", () => {
    let s = rushed();
    while (s.pendingEffectChoice?.sourceCardId === "XG3-050") s = skip(s);
    expect(zoneOf(s, "player2", "SPEC-E5000:e5")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });
});

// ===========================================================================
describe("XG3-051 仮面ライダー王蛇", () => {
  const TEXT = "【ここが祭りの場所か】このユニットは、特徴「仮面ライダー」を持つオモテ向きの敵軍パワー1枚につきBP+1000される。";

  it("XG3-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-1915「SP：1/2」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-051", TEXT);
    expectStats("XG3-051", { name: "仮面ライダー王蛇", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG3-051", ["N"]);
  });

  it("XG3-051:【ここが祭りの場所か】— 特徴「仮面ライダー」を持つオモテ向きの敵軍パワー1枚につき BP+1000（2枚で 5000。ウラ向き・仮面ライダーでないカードは数えない）（出典: atwiki/page-1915「特徴「仮面ライダー」を持つオモテ向きの敵軍パワー1枚につきBP+1000される」）", () => {
    const s = battle({ battle: [inst("XG3-051", "o")] }, { power: [faceUp("SPEC-RIDER", "p1"), faceUp("XG3-044", "p2"), faceDown("SPEC-RIDER", "p3"), faceUp("TST-UNIT-0", "p4")] });
    expect(bpOf(s, "player1", "XG3-051:o")).toBe(5000);
  });

  it("XG3-051:【ここが祭りの場所か】— 該当する敵軍パワーがなければ BP3000（出典: atwiki/page-1915）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-051", "o")] }, { power: [faceDown("SPEC-RIDER", "p3"), faceUp("TST-UNIT-0", "p4")] }), "player1", "XG3-051:o")).toBe(3000);
  });
});

// ===========================================================================
describe("XG3-052 オックスオルフェノク", () => {
  const TEXT = "【強力無双の怪腕】自軍ターン中、これはBP+2000される。";

  it("XG3-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-1916「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-052", TEXT);
    expectStats("XG3-052", { name: "オックスオルフェノク", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["オルフェノク", "怪人", "男"] });
    expectRarityIn("XG3-052", ["N"]);
  });

  it("XG3-052:【強力無双の怪腕】— 自軍ターン中は BP+2000（4000）（出典: atwiki/page-1916「自軍ターン中、これはBP+2000される」・カード評価「自軍ターン中はBPが4000まで上昇」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-052", "o")] }), "player1", "XG3-052:o")).toBe(4000);
  });

  it("XG3-052:【強力無双の怪腕】— 敵軍ターン中は BP2000（出典: atwiki/page-1916「自軍ターン中、」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG3-052", "o")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);
    expect(bpOf(s, "player1", "XG3-052:o")).toBe(2000);
  });
});

// ===========================================================================
describe("XG3-053 港区のウワン", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【分裂】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から2枚をオモテにしてもよい。オモテにしたカードが「港区のウワン」なら自軍ラッシュエリアに出し、それ以外なら捨札にする。この効果で出したユニットは、このターン、バトルエリアに出られない。";

  it("XG3-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-1917「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-053", TEXT);
    expectStats("XG3-053", { name: "港区のウワン", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["怪人", "妖怪"] });
    expectRarityIn("XG3-053", ["N"]);
  });

  it("XG3-053: ※ デッキに好きな枚数入れられる（10枚でもデッキとして有効）（出典: atwiki/page-1917「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("XG3-053", "港区のウワン")).toBe(true);
  });

  const entered = () => enter(battle({ rush: [inst("XG3-053", "u")], deck: [inst("XG3-053", "d1"), inst("TST-OP", "d2"), ...deckCards(3)] }), "XG3-053:u");

  it("XG3-053:【分裂】— 自軍ターン中にバトルエリアに出たとき、山札の上2枚をオモテにでき（任意）、「港区のウワン」は自軍ラッシュエリアに、それ以外は捨札に置く（出典: atwiki/page-1917「自軍山札の上から2枚をオモテにしてもよい。オモテにしたカードが「港区のウワン」なら自軍ラッシュエリアに出し、それ以外なら捨札にする」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG3-053");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s, ["confirm"]);
    expect(zoneOf(s, "player1", "XG3-053:d1")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:d2")).toBe("discard");
  });

  it("XG3-053:【分裂】— この効果で出したウワンは、このターンバトルエリアに出られない（出典: atwiki/page-1917「この効果で出したユニットは、このターン、バトルエリアに出られない」）", () => {
    const s = resolveAll(entered(), ["confirm"]);
    expect(zoneOf(s, "player1", "XG3-053:d1")).toBe("rush");
    expect(canEnter(s, "XG3-053:d1")).toBe(false);
  });

  it("XG3-053:【分裂】— 敵軍ターン中にバトルエリアに出されたときは発動しない（山札はそのまま）（出典: atwiki/page-1917「自軍ターン中、」）", () => {
    const s = resolveAll(enteredInEnemyTurn("XG3-053:u", { deck: [inst("XG3-053", "d1"), inst("TST-OP", "d2"), ...deckCards(3)] }, {}, EXTRA));
    expect(zoneOf(s, "player1", "XG3-053:d1")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-OP:d2")).toBe("deck");
  });
});

// ===========================================================================
describe("XG3-054 牛鬼", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【受け止める覚悟】これはMAを持たない敵軍Sユニットにアタックされない。";

  it("XG3-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-1918「追加条件：カード名に「鬼」を含む自軍ユニット1体を捨札にする」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-054", TEXT);
    expectStats("XG3-054", { name: "牛鬼", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: "4+", comboNumber: undefined, features: ["怪人", "男", "妖怪"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("XG3-054", ["N"]);
  });

  it("XG3-054: 追加条件 — カード名に「鬼」を含む自軍ユニット（XG3-056 仮面ライダー響鬼）1体を捨札にしてラッシュできる。名前に「鬼」がないユニットだけならラッシュできない（出典: atwiki/page-1918「追加条件：カード名に「鬼」を含む自軍ユニット1体を捨札にする」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-054", "g")], rush, power: powerCards(4), command: releasedCat("DA", 1) });
    expect(canStartRush(mk([inst("TST-UNIT-0", "n")]), "player1", "XG3-054:g")).toBe(false);
    const r = rushFromHand(mk([inst("XG3-056", "h")]), "player1", "XG3-054:g");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-054:g")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-056:h")).toBe("discard");
  });

  it("XG3-054: ※ 毎ターン、可能ならバトルエリアに出る（自軍ラッシュエリアにいる間はバトルフェイズを終えられない）（出典: atwiki/page-1918「これは毎ターン、可能ならバトルエリアに出る」）", () => {
    const s = battle({ rush: [inst("XG3-054", "g")] });
    expect(canEnter(s, "XG3-054:g")).toBe(true);
    expect(canEndPhase(s)).toBe(false);
  });

  it("XG3-054: ※ 敵軍ターン中、SP1 以上のユニットとバトルすると、バトルに勝っても撃破される（出典: atwiki/page-1918「敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-054", "g")] }, "XG3-054:g", "SPEC-MA-S:atk")));
    expect(zoneOf(s, "player1", "XG3-054:g")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MA-S:atk")).toBe("discard");
  });

  it("XG3-054: ※ 相手が SP なしのユニットなら、勝てば撃破されない（出典: atwiki/page-1918「「SP1」以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(settle(enemyAttack({ battle: [inst("XG3-054", "g")] }, "XG3-054:g", "SPEC-MA-S0:atk")));
    expect(zoneOf(s, "player1", "XG3-054:g")).toBe("battle");
  });

  const attackers = () =>
    attackersOf(st({ activePlayer: "player2", player1: { battle: [inst("XG3-054", "g")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-WB-S", "wb"), inst("SPEC-MA-S", "ma"), inst("TST-UNIT-2", "m")], deck: deckCards(3, "e") } }, EXTRA), "XG3-054:g");

  it("XG3-054:【受け止める覚悟】— MA を持たない敵軍 S ユニットにアタックされない（出典: atwiki/page-1918「これはMAを持たない敵軍Sユニットにアタックされない」）", () => {
    expect(attackers()).not.toContain("SPEC-WB-S:wb");
  });

  it("XG3-054:【受け止める覚悟】— MA を持つ S ユニット・M ユニットにはアタックされる（出典: atwiki/page-1918「MAを持たない敵軍Sユニット」）", () => {
    expect(attackers()).toEqual(expect.arrayContaining(["SPEC-MA-S:ma", "TST-UNIT-2:m"]));
  });
});

// ===========================================================================
describe("XG3-055 セイジガエル", () => {
  const TEXT = "※カウンター BP3000以下の自軍Sユニットがバトルで撃破されて捨札になるとき発動できる⇒そのユニットを捨札にするかわりに、自分の手札に戻す。";

  it("XG3-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-1919「カテゴリ：ミスティックアームズ」「必要パワー：4」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-055", TEXT);
    expectOpStats("XG3-055", { name: "セイジガエル", category: "MA", powerCost: 4 });
    expectRarityIn("XG3-055", ["N"]);
  });

  it("XG3-055: 特徴「ディスクアニマル」を持つ（出典: atwiki/page-1919「特徴：ディスクアニマル」）", () => {
    expect(DEFS["XG3-055"]?.features).toEqual(["ディスクアニマル"]);
  });

  const attacked = (unit: string) => enemyAttack({ battle: [inst(unit.split(":")[0]!, unit.split(":")[1]!)], hand: [inst("XG3-055", "c")], command: releasedCat("MA", 1), power: powerCards(4) }, unit);

  it("XG3-055: BP3000 以下の自軍 S ユニットがバトルで撃破されて捨札になるとき使え、そのユニットは捨札にならず手札に戻る（出典: atwiki/page-1919「そのユニットを捨札にするかわりに、自分の手札に戻す」）", () => {
    const s0 = attacked("SPEC-S3000:me");
    expect(canCounter(s0, "XG3-055:c")).toBe(true);
    const s = settle(useCounter(s0, "XG3-055:c"));
    expect(zoneOf(s, "player1", "SPEC-S3000:me")).toBe("hand");
    expect(zoneOf(s, "player1", "XG3-055:c")).toBe("discard");
  });

  it("XG3-055: BP3500 の自軍ユニットが撃破されるときは使えない（出典: atwiki/page-1919「BP3000以下の自軍Sユニット」）", () => {
    expect(canCounter(attacked("SPEC-S3500:me"), "XG3-055:c")).toBe(false);
  });
});

// ===========================================================================
describe("XG3-056 仮面ライダー響鬼", () => {
  const TEXT =
    "【集う音撃】自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアにある、本来の特徴に「猛士」を持つユニットの数を数えてもよい。そうしたとき、敵軍バトルエリアからその数と同じ必要パワーの数字を持つユニットを1体選び撃破する。";

  it("XG3-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-1920「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-056", TEXT);
    expectStats("XG3-056", { name: "仮面ライダー響鬼", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG3-056", ["N"]);
  });

  /** 自軍バトルエリア: 猛士のユニット1体（これを入れて2体）。敵軍: 必要パワー1・2・2+（M）・3 のユニット（バトルエリア）と必要パワー2（ラッシュエリア）。 */
  const entered = () =>
    line(["SPEC-TK:t", "XG3-056:h"], {}, { battle: [inst("SPEC-C1", "c1"), inst("SPEC-C2", "c2"), inst("SPEC-C2M", "c2m"), inst("SPEC-C3", "c3")], rush: [inst("SPEC-C2", "r2")] });

  it("XG3-056:【集う音撃】— 自軍ターン中にバトルエリアに出たとき、本来の特徴「猛士」の自軍バトルエリアのユニットの数（これを含めて2）と同じ必要パワーの数字を持つ敵軍バトルエリアのユニット（サイズを問わない）から選ぶ（数えるかは任意）（出典: atwiki/page-1920「…ユニットの数を数えてもよい。そうしたとき、敵軍バトルエリアからその数と同じ必要パワーの数字を持つユニットを1体選び撃破する」・カード評価「サイズも関係ない」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-056");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C2:c2", "SPEC-C2M:c2m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-056:【集う音撃】— 選んだユニットを撃破する（出典: atwiki/page-1920「1体選び撃破する」）", () => {
    const s = resolveAll(entered(), ["SPEC-C2:c2"]);
    expect(zoneOf(s, "player2", "SPEC-C2:c2")).toBe("discard");
  });

  it("XG3-056:【集う音撃】— 敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-1920「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG3-056:h", {}, { battle: [inst("SPEC-C1", "c1")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-056");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-C1:c1")).toBe("battle");
  });
});

void act;
