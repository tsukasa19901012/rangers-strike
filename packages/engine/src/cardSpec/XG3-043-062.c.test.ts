/**
 * カード別スペック: XG3-057〜XG3-062（クロスギャザー ザ・Wインパクト ヒビキアカネタカ〜仮面ライダーガタックRF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-059 Q1（page-1923）、XG3-060 Q1〜Q3（page-1924）、XG3-061 Q1（page-1925）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING 系・R-KW-RESIST-01・R-CN-02・R-ADD-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  heldUnit,
  inst,
  lastBattleBps,
  legal,
  lineUp,
  opCard,
  powerCards,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  targetsOf,
  useRef,
  wingTests,
  zoneOf,
} from "./XG3-043-062.helpers";

const TAKESHI = sUnit("SPEC-TK", { category: "MA", bp: 1000, features: ["猛士"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "MA", bp: 1000, features: ["メカ"] });
const MAN = sUnit("SPEC-MAN", { bp: 1000, features: ["男"] });
const WOMAN = sUnit("SPEC-WOMAN", { bp: 1000, features: ["女"] });
const HUMANOID = sUnit("SPEC-HUMANOID", { bp: 13000, size: "L", features: ["人型"] });
const BEAST = sUnit("SPEC-BEAST", { bp: 13000, size: "L", features: ["獣"] });
const DISC_OP = opCard("SPEC-DISC-OP", 2, { category: "MA", features: ["ディスクアニマル"] } as never);
const DISC_UNIT = sUnit("SPEC-DISC-UNIT", { category: "MA", bp: 1000, features: ["ディスクアニマル"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const EXTRA = [TAKESHI, PLAIN, MAN, WOMAN, HUMANOID, BEAST, DISC_OP, DISC_UNIT, C1, C2, C3, E4000];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-057 ヒビキアカネタカ", () => {
  const TEXT =
    "※自分が「仮面ライダー響鬼」をラッシュしたとき、自軍エリアに「ヒビキアカネタカ」があれば1体選んで手札に戻す。 ※ウイング 【ヒビキオンゲキコ】ホールド状態のこのユニットから、「仮面ライダーディケイド」または「仮面ライダーディエンド」または特徴「猛士」を持つユニットがコンビネーションしたとき、次の効果を発動できる⇒敵軍バトルエリアから特徴「男」または「女」または「人型」を持たないユニットを1体選び撃破する。";

  it("XG3-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-1921「追加条件：自軍「仮面ライダー響鬼」1体を手札に戻す」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-057", TEXT);
    expectStats("XG3-057", { name: "ヒビキアカネタカ", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: "2+", comboNumber: undefined, features: ["猛士", "FFR"], rushCondition: "return_named_to_hand" });
    expectRarityIn("XG3-057", ["N"]);
  });

  it("XG3-057: 追加条件 — 自軍「仮面ライダー響鬼」（XG3-056）1体を手札に戻してラッシュできる。いなければラッシュできない（出典: atwiki/page-1921「追加条件：自軍「仮面ライダー響鬼」1体を手札に戻す」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-057", "ak")], rush, power: powerCards(2), command: releasedCat("MA", 1) });
    expect(canStartRush(mk([inst("SPEC-TK", "t")]), "player1", "XG3-057:ak")).toBe(false);
    const r = rushVia(mk([inst("XG3-056", "h")]), "player1", "XG3-057:ak");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG3-057:ak")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-056:h")).toBe("hand");
  });

  it("XG3-057: ※ 自分が「仮面ライダー響鬼」をラッシュしたとき、自軍エリアの「ヒビキアカネタカ」を1体選んで手札に戻す（見送れない）（出典: atwiki/page-1921「自軍エリアに「ヒビキアカネタカ」があれば1体選んで手札に戻す」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG3-056", "h")], rush: [inst("XG3-057", "ak")], power: powerCards(1), command: releasedCat("MA", 1) }), "player1", "XG3-056:h");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "XG3-057");
    expect(choiceIds(r.state)).toEqual(["XG3-057:ak"]);
    expect(canSkip(r.state)).toBe(false);
    expect(zoneOf(resolveAll(r.state), "player1", "XG3-057:ak")).toBe("hand");
  });

  wingTests("XG3-057", "atwiki/page-1921");

  /** 自軍バトルエリア: ホールド状態のこれ。次に next を出す。敵軍バトルエリア: 男・女・人型・獣（L）・メカ（特徴なし扱い）のユニット。 */
  const combo = (next: string) => {
    const [cid, suf] = next.split(":") as [string, string];
    const s = battle({ battle: [heldUnit("XG3-057", "ak")], rush: [inst(cid, suf)] }, { battle: [inst("SPEC-MAN", "m"), inst("SPEC-WOMAN", "w"), inst("SPEC-HUMANOID", "hu"), inst("SPEC-BEAST", "b"), inst("TST-UNIT-0", "x")] });
    return enter(s, next);
  };

  it.fails("XG3-057:【ヒビキオンゲキコ】— ホールド状態のこれから特徴「猛士」のユニットがコンビネーションしたとき、敵軍バトルエリアの「男」「女」「人型」を持たないユニット（サイズを問わない）から選べる（既知の不具合: CARD-XG3-057【ヒビキオンゲキコ】の選択が開かない）（出典: atwiki/page-1921「敵軍バトルエリアから特徴「男」または「女」または「人型」を持たないユニットを1体選び撃破する」・カード評価「サイズを無視してユニットを撃破できる」）", () => {
    const s = combo("SPEC-TK:t");
    expectChoiceFrom(s, "player1", "XG3-057");
    expect(choiceIds(s).sort()).toEqual(["SPEC-BEAST:b", "TST-UNIT-0:x"]);
  });

  it.fails("XG3-057:【ヒビキオンゲキコ】— 「仮面ライダーディケイド」（XG1-077）からのコンビネーションでも発動し、選んだユニットを撃破する（既知の不具合: CARD-XG3-057）（出典: atwiki/page-1921「「仮面ライダーディケイド」または「仮面ライダーディエンド」または特徴「猛士」を持つユニット」）", () => {
    const s = resolveAll(combo("XG1-077:d"), ["SPEC-BEAST:b"]);
    expect(zoneOf(s, "player2", "SPEC-BEAST:b")).toBe("discard");
  });

  it("XG3-057:【ヒビキオンゲキコ】— 「猛士」でもディケイド・ディエンドでもないユニットからのコンビネーションでは発動しない（出典: atwiki/page-1921）", () => {
    const s = resolveAll(combo("SPEC-PLAIN:p"));
    expect(zoneOf(s, "player2", "SPEC-BEAST:b")).toBe("battle");
  });

  it("XG3-057:【ヒビキオンゲキコ】— リリース状態のこれからのコンビネーションでは発動しない（出典: atwiki/page-1921「ホールド状態のこのユニットから」・カード評価「ホールド状態でなければ効果の発動ができない」）", () => {
    const s = resolveAll(line(["XG3-057:ak", "SPEC-TK:t"], {}, { battle: [inst("SPEC-BEAST", "b")] }));
    expect(zoneOf(s, "player2", "SPEC-BEAST:b")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-058 仮面ライダー斬鬼", () => {
  const TEXT =
    "※自軍ラッシュフェイズ中、このユニットをホールドしてもよい。そうしたとき、このユニット以外の自軍Sユニットを1体選びリリースする。 【蘇る雷】これが自軍捨札にある間、自軍ラッシュフェイズ中、自分の手札から特徴「ディスクアニマル」を持つカードを1枚選び捨札にしてもよい。そうしたとき、これを自軍ラッシュエリアに出す。";

  it("XG3-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-1922「SP：1/3」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-058", TEXT);
    expectStats("XG3-058", { name: "仮面ライダー斬鬼", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG3-058", ["NR"]);
  });

  it.fails("XG3-058: ※ 自軍ラッシュフェイズ中、これをホールドして、これ以外のホールド状態の自軍 S ユニットを1体リリースできる（既知の不具合: CARD-XG3-058 ※の起動がない）（出典: atwiki/page-1922「このユニットをホールドしてもよい。そうしたとき、このユニット以外の自軍Sユニットを1体選びリリースする」）", () => {
    const s = resolveAll(useRef(board({ rush: [inst("XG3-058", "z"), heldUnit("TST-UNIT-0", "h")] }), "XG3-058:z"), ["TST-UNIT-0:h"]);
    expect(cardIn(s, "player1", "XG3-058:z")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-UNIT-0:h")?.commandHeld ?? false).toBe(false);
  });

  it("XG3-058: ※ 自軍バトルフェイズ中はホールドできない（出典: atwiki/page-1922「自軍ラッシュフェイズ中」）", () => {
    const s = battle({ rush: [inst("XG3-058", "z"), heldUnit("TST-UNIT-0", "h")] });
    expect(refsOf(s, "XG3-058:z").filter((a) => a.type !== "move_to_battle" && a.type !== "mount_ride")).toEqual([]);
  });

  it.fails("XG3-058:【蘇る雷】— 自軍捨札にある間、自軍ラッシュフェイズ中、手札の「ディスクアニマル」のカード（オペレーションでもユニットでも）を捨札にして、これを自軍ラッシュエリアに出せる（既知の不具合: CARD-XG3-058【蘇る雷】の起動がない）（出典: atwiki/page-1922「自分の手札から特徴「ディスクアニマル」を持つカードを1枚選び捨札にしてもよい。そうしたとき、これを自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(useRef(board({ discard: [inst("XG3-058", "z")], hand: [inst("SPEC-DISC-OP", "da"), inst("TST-OP", "op")] }), "XG3-058:z"), ["SPEC-DISC-OP:da"]);
    expect(zoneOf(s, "player1", "SPEC-DISC-OP:da")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-058:z")).toBe("rush");
  });

  it("XG3-058:【蘇る雷】— 手札に「ディスクアニマル」のカードがなければ出せない（出典: atwiki/page-1922）", () => {
    expect(refsOf(board({ discard: [inst("XG3-058", "z")], hand: [inst("TST-OP", "op")] }), "XG3-058:z")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-059 仮面ライダー轟鬼", () => {
  const TEXT = "※レジスト 【轟く二刀】「SP1」このユニットがリリース状態なら、このターン、これはアタックとストライクを1度ずつ行ってもよい。";

  it("XG3-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-1923「SP：！」「CN：3」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-059", TEXT);
    expectStats("XG3-059", { name: "仮面ライダー轟鬼", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG3-059", ["NR"]);
  });

  resistTests("XG3-059", "atwiki/page-1923");

  const nc = () => line(["TST-UNIT-0:a", "TST-UNIT-0:b", "XG3-059:t"], {}, { battle: [inst("TST-UNIT-0", "e")] });

  it("XG3-059:【轟く二刀】— 3番目に出れば（NC）「SP1」。1番目なら SP なし（出典: atwiki/page-1923「【轟く二刀】「SP1」」・R-CN-02）", () => {
    expect(spOf(nc(), "player1", "XG3-059:t")).toBe(1);
    expect(spOf(line(["XG3-059:t"]), "player1", "XG3-059:t")).toBe(0);
  });

  it.fails("XG3-059:【轟く二刀】— リリース状態なら、アタックしたあとにストライクもできる（既知の不具合: CARD-XG3-059 アタックのあとストライクできない）（出典: atwiki/page-1923「このターン、これはアタックとストライクを1度ずつ行ってもよい」）", () => {
    const s = resolveAll(settle(attack(nc(), "XG3-059:t", "TST-UNIT-0:e")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(canStrike(s, "XG3-059:t")).toBe(true);
  });

  it.fails("XG3-059:【轟く二刀】— リリース状態なら、ストライクしたあとにアタックもできる（既知の不具合: CARD-XG3-059 ストライクのあとアタックできない）（出典: atwiki/page-1923「アタックとストライクを1度ずつ」）", () => {
    const s = resolveAll(settle(strike(nc(), "XG3-059:t")));
    expect(s.players.player2.damage).toBe(1);
    expect(targetsOf(s, "XG3-059:t")).toContain("TST-UNIT-0:e");
  });
});

// ===========================================================================
describe("XG3-060 仮面ライダー天鬼", () => {
  const TEXT =
    "【助ける仲間】自分の手札から特徴「ディスクアニマル」を持つオペレーションカードを1枚選び、自軍ラッシュエリアに出してもよい。そうしたとき、そのカードは「BP500」「SP1/3」のSユニットとして扱い、本来のテキストを失うかわりに次のテキストを得る⇒本来の特徴に「猛士」を持つ自軍ユニットがユニットでなくなるとき、これを捨札にして、そのユニットをその場に留める。";

  it("XG3-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-1924「CN：1」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-060", TEXT);
    expectStats("XG3-060", { name: "仮面ライダー天鬼", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: 1, features: ["仮面ライダー", "女", "猛士"] });
    expectRarityIn("XG3-060", ["N"]);
  });

  /** 1番目に出る（NC）。手札: ディスクアニマルのオペレーション・ディスクアニマルのユニット・通常のオペレーション。 */
  const nc = () => line(["XG3-060:a"], { hand: [inst("SPEC-DISC-OP", "da"), inst("SPEC-DISC-UNIT", "du"), inst("TST-OP", "op")] });

  it.fails("XG3-060:【助ける仲間】— 1番目に出れば（NC）、手札の特徴「ディスクアニマル」を持つオペレーションカードを選べる（ユニットカード・通常のオペレーションは選べない。任意）（既知の不具合: CARD-XG3-060【助ける仲間】の選択が開かない）（出典: atwiki/page-1924「自分の手札から特徴「ディスクアニマル」を持つオペレーションカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-060");
    expect(choiceIds(s)).toEqual(["SPEC-DISC-OP:da"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG3-060:【助ける仲間】— 出したカードは自軍ラッシュエリアの BP500・SP1/3 の S ユニットとして扱う（Q2: 本来の BP が500）（既知の不具合: CARD-XG3-060）（出典: atwiki/page-1924「そのカードは「BP500」「SP1/3」のSユニットとして扱い」・Q2「本来のＢＰが５００として扱う」）", () => {
    const s = resolveAll(nc(), ["SPEC-DISC-OP:da"]);
    expect(zoneOf(s, "player1", "SPEC-DISC-OP:da")).toBe("rush");
    expect(bpOf(s, "player1", "SPEC-DISC-OP:da")).toBe(500);
  });

  it.fails("XG3-060:【助ける仲間】— 出したディスクアニマルは、本来の特徴「猛士」の自軍ユニット（天鬼）が撃破されるとき、かわりに捨札になり、そのユニットはその場に留まる（既知の不具合: CARD-XG3-060）（出典: atwiki/page-1924「本来の特徴に「猛士」を持つ自軍ユニットがユニットでなくなるとき、これを捨札にして、そのユニットをその場に留める」・カード評価「ラッシュしたディスクアニマルの特徴「猛士」を持つユニットを守る効果は強制発動する」）", () => {
    let s = resolveAll(nc(), ["SPEC-DISC-OP:da"]);
    expect(zoneOf(s, "player1", "SPEC-DISC-OP:da")).toBe("rush");
    s = { ...s, activePlayer: "player2", players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-7", "atk")] } } };
    s = resolveAll(settle(attack(s, "TST-UNIT-7:atk", "XG3-060:a", "player2")));
    expect(zoneOf(s, "player1", "XG3-060:a")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-DISC-OP:da")).toBe("discard");
  });

  it("XG3-060:【助ける仲間】— 1番目以外に出たとき（NC 不成立）は発動しない（出典: atwiki/page-1924「CN：1」・R-CN-02）", () => {
    const s = resolveAll(line(["TST-UNIT-0:f", "XG3-060:a"], { hand: [inst("SPEC-DISC-OP", "da")] }));
    expect(zoneOf(s, "player1", "SPEC-DISC-OP:da")).toBe("hand");
  });
});

// ===========================================================================
describe("XG3-061 仮面ライダーガタックMF", () => {
  const TEXT =
    "※これはアタックされるときBP+2000される。 【キャストオフ】これをラッシュしたとき、OTを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒自軍山札を見て「仮面ライダーガタックRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG3-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-1925「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-061", TEXT);
    expectStats("XG3-061", { name: "仮面ライダーガタックMF", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG3-061", ["N"]);
  });

  it("XG3-061: ※ アタックされるときは BP+2000（5000）され、BP4000 のユニットとのバトルに勝つ（出典: atwiki/page-1925「これはアタックされるときBP+2000される」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { battle: [inst("XG3-061", "m")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E4000", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    expect(bpOf(s0, "player1", "XG3-061:m")).toBe(3000);
    const s = resolveAll(settle(attack(s0, "SPEC-E4000:atk", "XG3-061:m", "player2")));
    expect(lastBattleBps(s)?.defender).toBe(5000);
    expect(zoneOf(s, "player1", "XG3-061:m")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E4000:atk")).toBe("discard");
  });

  /** 自軍山札: ガタックRF・ほかのユニット。OT のコマンド2つ（1つはラッシュでホールド）。 */
  const rushed = (cmd = releasedCat("OT", 2)) =>
    rushFromHand(board({ hand: [inst("XG3-061", "m")], power: powerCards(7), command: cmd, deck: [inst("XG3-062", "rf"), inst("TST-UNIT-0", "u"), ...deckCards(3)] }), "player1", "XG3-061:m").state;

  it("XG3-061:【キャストオフ】— ラッシュしたとき、OT を持つ自軍コマンドを1つホールドして発動できる（任意）（出典: atwiki/page-1925「OTを持つ自軍コマンドを1つホールドして次の効果を発動できる」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG3-061");
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-061:【キャストオフ】— 自軍山札から「仮面ライダーガタックRF」を選んで自軍ラッシュエリアに出す（追加条件でこれをパワーゾーンに送ってもよい。ほかのカードは選べない）（出典: atwiki/page-1925「自軍山札を見て「仮面ライダーガタックRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと」・Q1）", () => {
    let s = useRef(rushed(), "XG3-061:m");
    expect(choiceIds(s)).toEqual(["XG3-062:rf"]);
    s = resolveAll(s, ["XG3-062:rf", "XG3-061:m"]);
    expect(zoneOf(s, "player1", "XG3-062:rf")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
  });

  it("XG3-061:【キャストオフ】— リリース状態の OT のコマンドがほかになければ発動できない（出典: atwiki/page-1925「OTを持つ自軍コマンドを1つホールドして」）", () => {
    const s = rushed(releasedCat("OT", 1));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-061");
    expect(zoneOf(s, "player1", "XG3-062:rf")).toBe("deck");
  });
});

// ===========================================================================
describe("XG3-062 仮面ライダーガタックRF", () => {
  const TEXT =
    "※レジスト ※これはアタックされる以外では相手に選ばれない。 【ライダーキック】自軍ターン中、これがバトルエリアに出たとき、必要パワーの数字が「1」「2」「3」のオモテ向きの自軍パワーがそれぞれあれば、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("XG3-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-2002「必要パワー：7-」「追加条件：自軍「仮面ライダーガタックMF」1体をパワーゾーンに送れば必要パワー0になる」「レアリティ：レア」）", () => {
    expectCatalogText("XG3-062", TEXT);
    expectStats("XG3-062", { name: "仮面ライダーガタックRF", category: "OT", size: "S", bp: 3500, sp: undefined, powerCost: "7-", comboNumber: undefined, features: ["仮面ライダー", "男", "加速"], rushCondition: "zord_down_send_to_power" });
    expectRarityIn("XG3-062", ["R"]);
  });

  it("XG3-062: 追加条件 — 自軍「仮面ライダーガタックMF」（XG3-061）1体をパワーゾーンに送れば必要パワー0でラッシュできる（出典: atwiki/page-2002「追加条件」）", () => {
    const s = board({ hand: [inst("XG3-062", "rf")], rush: [inst("XG3-061", "mf")], command: releasedCat("OT", 1), power: [] });
    const r = rushVia(s, "player1", "XG3-062:rf", (a) => a.zordMaterialInstanceId === "XG3-061:mf");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "XG3-062:rf")).toBe("rush");
    expect(zoneOf(t, "player1", "XG3-061:mf")).toBe("power");
  });

  it("XG3-062: 必要パワー7- — 「仮面ライダーガタックMF」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: atwiki/page-2002・R-ADD-02）", () => {
    const mk = (n: number) => board({ hand: [inst("XG3-062", "rf")], command: releasedCat("OT", 1), power: powerCards(n) });
    expect(canStartRush(mk(6), "player1", "XG3-062:rf")).toBe(false);
    expect(rushFromHand(mk(7), "player1", "XG3-062:rf").ok).toBe(true);
  });

  resistTests("XG3-062", "atwiki/page-2002");

  it("XG3-062: ※ アタックされる以外では相手に選ばれない（敵軍の RS-481 天空神【ホバリング】の候補にならない）（出典: atwiki/page-2002「これはアタックされる以外では相手に選ばれない」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("XG3-062", "rf"), inst("TST-UNIT-0", "s")], deck: deckCards(3) }, player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") } }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
  });

  const power123 = (third = faceUp("SPEC-C3", "p3")) => [faceUp("SPEC-C1", "p1"), faceUp("SPEC-C2", "p2"), third];
  const entered = (power = power123()) => enter(battle({ rush: [inst("XG3-062", "rf")], power }, { battle: [inst("TST-UNIT-0", "e"), inst("TST-UNIT-2", "m")] }), "XG3-062:rf");

  it("XG3-062:【ライダーキック】— 自軍ターン中にバトルエリアに出たとき、必要パワー1・2・3 のオモテ向きの自軍パワーがあれば、敵軍バトルエリアの S ユニットを選べる（M は選べない。任意）（出典: atwiki/page-2002「必要パワーの数字が「1」「2」「3」のオモテ向きの自軍パワーがそれぞれあれば、敵軍バトルエリアからSユニットを1体選び」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG3-062");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-062:【ライダーキック】— 選んだユニットを持ち主のパワーゾーンに送る（出典: atwiki/page-2002「持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(entered(), ["TST-UNIT-0:e"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("power");
  });

  it("XG3-062:【ライダーキック】— 必要パワー3 のパワーがウラ向き（ダメージ）なら発動しない（出典: atwiki/page-2002「オモテ向きの自軍パワーがそれぞれあれば」）", () => {
    const s = resolveAll(entered(power123(faceDown("SPEC-C3", "p3"))));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  it.todo("XG3-062:【ライダーキック】— 敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-2002「自軍ターン中、」）— 敵軍ターン中にこれをバトルエリアに出す手順を用意できない（相手の効果で出させようとしても、※「アタックされる以外では相手に選ばれない」でこれを選べない）");
});

void legal;
void skip;
