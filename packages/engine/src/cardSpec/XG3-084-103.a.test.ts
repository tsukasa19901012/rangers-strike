/**
 * カード別スペック: XG3-084〜XG3-090（クロスギャザー ザ・Wインパクト 大甲神カブテリオス〜スーパーブルービート）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. 公式FAQ・エラッタ: 本範囲のカードの項はない（grnrngr の公式FAQ・docs/rules/08-errata.md・atwiki 転載の公式 Q&A のいずれにもない）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・RC・ゾードアップ／ゾードダウン R-ADD-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackersOf,
  bpOf,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  cmds,
  deckCards,
  enemyAttackOn,
  enemyBoard,
  enter,
  exiled,
  expectCatalogText,
  expectRarityIn,
  expectUnitStats,
  heldUnit,
  inst,
  lineUp,
  PLAIN_VEHICLE,
  powerCards,
  rcEnter,
  reanimateTests,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushKeepReaction,
  rushVia,
  settle,
  skip,
  st,
  sUnit,
  useRef,
  zoneOf,
} from "./XG3-084-103.helpers";

const INS = sUnit("SPEC-INS", { category: "MA", bp: 1000, features: ["昆虫"] });
const INS_M = sUnit("SPEC-INS-M", { category: "MA", bp: 3000, size: "M", features: ["昆虫"] });
const BP5 = sUnit("SPEC-BP5", { bp: 5000 });
const BP6 = sUnit("SPEC-BP6", { bp: 6000 });
const L5 = sUnit("SPEC-L5", { bp: 5000, size: "L" });
const MECHA = sUnit("SPEC-MECHA", { bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { bp: 3000, size: "M", features: ["メカ"] });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const EXTRA = [INS, INS_M, BP5, BP6, L5, MECHA, MECHA_M, C3, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const rc = (rider: string, p1: P1 = {}, p2: P2 = {}) => rcEnter(rider, p1, p2, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

/** 「6+」・追加条件「特徴「昆虫」を持つ自軍Sユニット1体を捨札にする」の共通テスト。 */
function insectZordUpTests(id: string, page: string, cat: "MA" | "DA") {
  const mk = (rush: P1["rush"], power = 6) => board({ hand: [inst(id, "z")], rush, power: powerCards(power), command: releasedCat(cat, 1) });

  it(`${id}: 追加条件 — 特徴「昆虫」を持つ自軍 S ユニット1体を捨札にし、パワー6でラッシュできる（出典: ${page}「必要パワー：6+」「追加条件：特徴「昆虫」を持つ自軍Sユニット1体を捨札にする」）`, () => {
    const r = rushFromHand(mk([inst("SPEC-INS", "i")]), "player1", `${id}:z`, { materials: ["SPEC-INS:i"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:z`)).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-INS:i")).toBe("discard");
  });

  it(`${id}: 追加条件 — 「昆虫」の S ユニットがいなければ（「昆虫」でない S・「昆虫」の M だけでは）ラッシュできない（出典: ${page}「特徴「昆虫」を持つ自軍Sユニット1体」）`, () => {
    expect(canStartRush(mk([inst("TST-UNIT-0", "u"), inst("SPEC-INS-M", "m")]), "player1", `${id}:z`)).toBe(false);
  });

  it(`${id}: 必要パワー6 — パワー5ではラッシュできない（出典: ${page}「必要パワー：6+」）`, () => {
    expect(canStartRush(mk([inst("SPEC-INS", "i")], 5), "player1", `${id}:z`)).toBe(false);
  });
}

// ===========================================================================
describe("XG3-084 大甲神カブテリオス", () => {
  it("XG3-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-1939「種類：Lユニット」「BP：5000」「SP：1」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText(
      "XG3-084",
      "※レジスト 【ビッグフレア】自軍ターン中、これがバトルエリアに出たとき、WBを持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき、本来のBPが5000以下の敵軍ユニットを1体選び撃破する。",
    );
    expectUnitStats("XG3-084", { name: "大甲神カブテリオス", category: "MA", size: "L", bp: 5000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["昆虫", "人型"], rushCondition: "discard_feature_unit" });
    expectRarityIn("XG3-084", ["NR"]);
  });

  resistTests("XG3-084", "atwiki/page-1939");
  insectZordUpTests("XG3-084", "atwiki/page-1939", "MA");

  const entered = (command = [...releasedCat("WB", 1), ...releasedCat("MA", 1)]) =>
    enter(battle({ rush: [inst("XG3-084", "kb")], command }, { battle: [inst("SPEC-BP5", "a"), inst("SPEC-BP6", "b"), inst("SPEC-L5", "l")], rush: [inst("SPEC-BP5", "r")] }), "XG3-084:kb");

  it("XG3-084:【ビッグフレア】— 発動するかは任意（見送れば撃破もコマンドのホールドもない）（出典: atwiki/page-1939「WBを持つ自軍コマンドを1つ選びホールドしてもよい」）", () => {
    const s0 = entered();
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "SPEC-BP5:a")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBeFalsy();
  });

  it("XG3-084:【ビッグフレア】— WB のコマンドをホールドすれば、敵軍ラッシュエリアの本来の BP5000 のユニットも撃破できる（出典: atwiki/page-1939「本来のBPが5000以下の敵軍ユニットを1体選び撃破する」・カード評価「サイズ、エリア無視で本来値でユニットを撃破できる」）", () => {
    const s = resolveAll(entered(), ["TST-OP:cWB0", "SPEC-BP5:r"]);
    expect(zoneOf(s, "player2", "SPEC-BP5:r")).toBe("discard");
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-OP-MA:cMA0")?.commandHeld).toBeFalsy();
  });

  it("XG3-084:【ビッグフレア】— 本来の BP5000 の L ユニットも撃破できる（出典: atwiki/page-1939 カード評価「サイズ、エリア無視」）", () => {
    const s = resolveAll(entered(), ["TST-OP:cWB0", "SPEC-L5:l"]);
    expect(zoneOf(s, "player2", "SPEC-L5:l")).toBe("discard");
  });

  it("XG3-084:【ビッグフレア】— 本来の BP が6000のユニットは撃破できない（出典: atwiki/page-1939「本来のBPが5000以下」）", () => {
    const s = resolveAll(entered(), ["TST-OP:cWB0", "SPEC-BP6:b"]);
    expect(zoneOf(s, "player2", "SPEC-BP6:b")).toBe("battle");
  });

  it("XG3-084:【ビッグフレア】— WB を持つ自軍コマンドがなければ（MA だけ）発動できない（出典: atwiki/page-1939「WBを持つ自軍コマンドを1つ選びホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(entered(releasedCat("MA", 1)), ["SPEC-BP5:a"]);
    expect(zoneOf(s, "player2", "SPEC-BP5:a")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-085 邪甲神クワガタイタン", () => {
  it("XG3-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-1940「種類：Lユニット」「BP：5000」「SP：1」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-085", "※レジスト 【タイタニックフレア】自軍ターン中、このユニットは、WBを持つ自軍コマンド1つにつきBP+1000される。");
    expectUnitStats("XG3-085", { name: "邪甲神クワガタイタン", category: "DA", size: "L", bp: 5000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["昆虫", "人型"], rushCondition: "discard_feature_unit" });
    expectRarityIn("XG3-085", ["NR"]);
  });

  resistTests("XG3-085", "atwiki/page-1940");
  insectZordUpTests("XG3-085", "atwiki/page-1940", "DA");

  it("XG3-085:【タイタニックフレア】— 自軍ターン中、WB を持つ自軍コマンド1つにつき BP+1000（リリース1・ホールド1で 7000。DA のコマンドは数えない）（出典: atwiki/page-1940「WBを持つ自軍コマンド1つにつきBP+1000される」・カード評価「最大BP10000になる」）", () => {
    const s = battle({ battle: [inst("XG3-085", "kw")], command: [...releasedCat("WB", 1), heldUnit("TST-OP", "hw"), ...releasedCat("DA", 1)] });
    expect(bpOf(s, "player1", "XG3-085:kw")).toBe(7000);
  });

  it("XG3-085:【タイタニックフレア】— 敵軍ターン中は BP5000 のまま（出典: atwiki/page-1940「自軍ターン中」・カード評価「BPが上昇するのは自軍ターン中のみ」）", () => {
    const s = enemyBoard({ battle: [inst("XG3-085", "kw")], command: releasedCat("WB", 2) }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG3-085:kw")).toBe(5000);
  });
});

// ===========================================================================
describe("XG3-086 冷血鎧将ムカデリンガー", () => {
  it("XG3-086: カタログ本文・スペックが出典と一致（出典: atwiki/page-1941「BP：3000」「SP：1/2」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-086",
      "※レジスト 【ハンドレットフィーラー】これが自軍バトルエリアにある間、相手が自分自身のリリース状態のSユニットをバトルエリアに出すために選んだとき、そのユニットの必要パワーの数字を見て、自軍捨札から同じ必要パワーの数字を持つカードを1枚選びゲームから除外してもよい。そうしたとき、そのユニットをホールドする。",
    );
    expectUnitStats("XG3-086", { name: "冷血鎧将ムカデリンガー", category: ["WB", "DA"], size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: undefined, features: ["昆虫", "人型"] });
    expectRarityIn("XG3-086", ["N"]);
  });

  resistTests("XG3-086", "atwiki/page-1941");

  const enemyEnters = (discard: P1["discard"]) =>
    enter(enemyBoard({ battle: [inst("XG3-086", "mk")], discard }, { rush: [inst("SPEC-C3", "e3")] }, EXTRA), "SPEC-C3:e3", "player2");

  it("XG3-086:【ハンドレットフィーラー】— 相手がリリース状態の S ユニット（必要パワー3）をバトルエリアに出すために選んだとき、自軍捨札の必要パワー3のカードを除外して、そのユニットをホールドできる（出典: atwiki/page-1941「自軍捨札から同じ必要パワーの数字を持つカードを1枚選びゲームから除外してもよい。そうしたとき、そのユニットをホールドする」）", () => {
    const s0 = enemyEnters([inst("SPEC-C3", "d3"), inst("TST-UNIT-2", "d2")]);
    expect(choiceIds(s0)).toEqual(["SPEC-C3:d3"]);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(s0, ["SPEC-C3:d3"]);
    expect(exiled(s, "player1")).toEqual(["SPEC-C3:d3"]);
    expect(zoneOf(s, "player1", "SPEC-C3:d3")).toBeNull();
    expect(cardIn(s, "player2", "SPEC-C3:e3")?.commandHeld).toBe(true);
  });

  it("XG3-086:【ハンドレットフィーラー】— 自軍捨札に同じ必要パワーのカードがなければ何も起きない（出典: atwiki/page-1941「同じ必要パワーの数字を持つカード」）", () => {
    const s = enemyEnters([inst("TST-UNIT-2", "d2")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-086");
    expect(zoneOf(s, "player1", "TST-UNIT-2:d2")).toBe("discard");
    expect(cardIn(s, "player2", "SPEC-C3:e3")?.commandHeld).toBeFalsy();
  });
});

// ===========================================================================
describe("XG3-087 魔剣鎧将キルマンティス", () => {
  it("XG3-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-1942「BP：2000」「SP：－」「必要パワー：0」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-087",
      "※敵軍ターン中、これとバトルしたSユニットは、バトルに勝っても撃破される。 【フェリンガースナイプ】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから特徴「メカ」または「昆虫」を持つSユニットを1体選びホールドしてもよい。",
    );
    expectUnitStats("XG3-087", { name: "魔剣鎧将キルマンティス", category: ["WB", "DA"], size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["昆虫", "人型"] });
    expectRarityIn("XG3-087", ["N"]);
  });

  it("XG3-087: ※ 敵軍ターン中、これとバトルした S ユニット（BP5000）はバトルに勝っても撃破される（出典: atwiki/page-1942「これとバトルしたSユニットは、バトルに勝っても撃破される」）", () => {
    const s = resolveAll(settle(enemyAttackOn({ battle: [inst("XG3-087", "km")] }, "XG3-087:km", "SPEC-BP5:atk", {}, EXTRA)));
    expect(zoneOf(s, "player1", "XG3-087:km")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP5:atk")).toBe("discard");
  });

  it("XG3-087: ※ L ユニット（TST-UNIT-7）は勝てば撃破されない（出典: atwiki/page-1942「これとバトルしたSユニットは」）", () => {
    const s = resolveAll(settle(enemyAttackOn({ battle: [inst("XG3-087", "km")] }, "XG3-087:km", "TST-UNIT-7:atk", {}, EXTRA)));
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("battle");
  });

  it("XG3-087: ※ 自軍ターン中にこれがアタックして負けても、相手の S ユニットは撃破されない（出典: atwiki/page-1942「敵軍ターン中、」）", () => {
    const s = resolveAll(settle(attack(line(["XG3-087:km"], {}, { battle: [inst("SPEC-BP5", "e")] }), "XG3-087:km", "SPEC-BP5:e")));
    expect(zoneOf(s, "player1", "XG3-087:km")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP5:e")).toBe("battle");
  });

  it("XG3-087:【フェリンガースナイプ】— 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの特徴「メカ」か「昆虫」を持つ S ユニットを1体選びホールドできる（ラッシュエリア・M・ほかの特徴は選べない。任意）（出典: atwiki/page-1942「敵軍バトルエリアから特徴「メカ」または「昆虫」を持つSユニットを1体選びホールドしてもよい」）", () => {
    const s0 = enter(
      battle({ rush: [inst("XG3-087", "km")] }, { battle: [inst("SPEC-MECHA", "m"), inst("SPEC-INS", "i"), inst("TST-UNIT-0", "x"), inst("SPEC-MECHA-M", "mm")], rush: [inst("SPEC-MECHA", "rm")] }),
      "XG3-087:km",
    );
    expect(choiceIds(s0).sort()).toEqual(["SPEC-INS:i", "SPEC-MECHA:m"]);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(s0, ["SPEC-MECHA:m"]);
    expect(cardIn(s, "player2", "SPEC-MECHA:m")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG3-088 変幻鎧将ビーザック", () => {
  it("XG3-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-1943「BP：1000」「SP：－」「必要パワー：1」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-088",
      "※これは敵軍Sユニットにアタックされない。 【ハードックショッカー】これが自軍の手札にある間、レジストまたはウイングを持つ敵軍Sユニットがラッシュされたとき、DAを持つ自軍コマンドを1つホールドしてから、これを自軍ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットをホールドする。",
    );
    expectUnitStats("XG3-088", { name: "変幻鎧将ビーザック", category: ["WB", "DA"], size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["昆虫", "人型"] });
    expectRarityIn("XG3-088", ["N"]);
  });

  it("XG3-088: ※ 敵軍 S ユニットにアタックされない（L ユニットにはアタックされる）（出典: atwiki/page-1943「これは敵軍Sユニットにアタックされない」）", () => {
    const s = enemyBoard({ battle: [inst("XG3-088", "bz"), inst("TST-UNIT-0", "o")] }, { battle: [inst("TST-UNIT-0", "atk"), inst("TST-UNIT-7", "l")] }, EXTRA);
    expect(attackersOf(s, "XG3-088:bz")).toEqual(["TST-UNIT-7:l"]);
    expect(attackersOf(s, "TST-UNIT-0:o")).toEqual(["TST-UNIT-0:atk", "TST-UNIT-7:l"]);
  });

  const enemyRushes = (rusher: string, p2: P2) =>
    rushKeepReaction(enemyBoard({ hand: [inst("XG3-088", "bz")], command: releasedCat("DA", 1) }, { hand: [inst(rusher.split(":")[0]!, rusher.split(":")[1]!)], ...p2 }, EXTRA, "rush"), "player2", rusher);

  it("XG3-088:【ハードックショッカー】— レジストを持つ敵軍 S ユニット（XG3-089）がラッシュされたとき、DA のコマンドをホールドして手札のこれを自軍ラッシュエリアに出し、そのユニットをホールドできる（出典: atwiki/page-1943「DAを持つ自軍コマンドを1つホールドしてから、これを自軍ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットをホールドする」）", () => {
    const s0 = enemyRushes("XG3-089:bb", { command: cmds("WB", "ET"), power: powerCards(4) });
    const s = resolveAll(useRef(s0, "XG3-088:bz"));
    expect(zoneOf(s, "player1", "XG3-088:bz")).toBe("rush");
    expect(cardIn(s, "player1", "TST-OP-DA:cDA0")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "XG3-089:bb")?.commandHeld).toBe(true);
  });

  it("XG3-088:【ハードックショッカー】— レジストもウイングも持たない敵軍ユニットがラッシュされたときは出せない（出典: atwiki/page-1943「レジストまたはウイングを持つ敵軍Sユニット」）", () => {
    const s = enemyRushes("TST-UNIT-0:x", { command: releasedCat("WB", 1) });
    expect(refsOf(s, "XG3-088:bz")).toEqual([]);
  });
});

// ===========================================================================
describe("XG3-089 ブルービート", () => {
  it("XG3-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-1973「BP：3000」「SP：1/2」「CN：RC」「レアリティ：レア」）", () => {
    expectCatalogText(
      "XG3-089",
      "※レジスト 【スティンガードリル】敵軍バトルエリアから、レジストを持つSユニットを1体選び撃破してもよい。（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）",
    );
    expectUnitStats("XG3-089", { name: "ブルービート", category: ["WB", "ET"], size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["メカ", "昆虫", "ブルー", "男"] });
    expectRarityIn("XG3-089", ["R"]);
  });

  resistTests("XG3-089", "atwiki/page-1973");

  const enemies: P2 = { battle: [inst("XG3-086", "mk"), inst("TST-UNIT-0", "x"), inst("SPEC-INS", "i")], rush: [inst("XG3-086", "mk2")] };

  it("XG3-089:【スティンガードリル】— RC で、敵軍バトルエリアのレジストを持つ S ユニットだけを選べる（ラッシュエリア・レジストのないユニットは選べない。任意）（出典: atwiki/page-1973「敵軍バトルエリアから、レジストを持つSユニットを1体選び撃破してもよい」）", () => {
    const s = rc("XG3-089:bb", {}, enemies);
    expect(choiceIds(s)).toEqual(["XG3-086:mk"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-089:【スティンガードリル】— 選んだレジストのユニット（XG3-086）を撃破する（出典: atwiki/page-1973「撃破してもよい」）", () => {
    const s = resolveAll(rc("XG3-089:bb", {}, enemies), ["XG3-086:mk"]);
    expect(zoneOf(s, "player2", "XG3-086:mk")).toBe("discard");
    expect(zoneOf(s, "player2", "XG3-086:mk2")).toBe("rush");
  });

  it("XG3-089:【スティンガードリル】— 特徴「昆虫」を持つユニット（SPEC-INS）からコンビネーションすれば、RC でなくても発動する（出典: atwiki/page-1973「この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する」）", () => {
    const s = resolveAll(line(["SPEC-INS:i", "XG3-089:bb"], {}, enemies), ["XG3-086:mk"]);
    expect(zoneOf(s, "player2", "XG3-086:mk")).toBe("discard");
  });

  it("XG3-089:【スティンガードリル】— 「昆虫」でないユニットからコンビネーションしても（RC でなければ）発動しない（出典: atwiki/page-1973「（CN：RC）」）", () => {
    const s = resolveAll(line(["TST-UNIT-0:u", "XG3-089:bb"], {}, enemies), ["XG3-086:mk"]);
    expect(zoneOf(s, "player2", "XG3-086:mk")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-090 スーパーブルービート", () => {
  it("XG3-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-1958「BP：5500」「SP：1/2」「必要パワー：7-」「レアリティ：スーパーレア」）", () => {
    expectCatalogText(
      "XG3-090",
      "※レジスト ※これが撃破されて捨札になったとき、自軍捨札から「ブルービート」のカードを1枚選び、自軍ラッシュエリアに出す。 【スーパーファイナルブロー】 これをラッシュしたとき、次の効果を発動できる⇒ユニット1体につきBP2000として、特徴「昆虫」を持つ自軍ユニットの数分のBPを計算し、そのBP以下の敵軍ユニットを1体選び撃破する。",
    );
    expectUnitStats("XG3-090", { name: "スーパーブルービート", category: ["WB", "ET"], size: "S", bp: 5500, sp: "1/2", powerCost: "7-", comboNumber: undefined, features: ["メカ", "昆虫", "ブルー", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG3-090", ["SR"]);
  });

  resistTests("XG3-090", "atwiki/page-1958");

  const zordDown = (p2: P2 = {}, rush: P1["rush"] = []) =>
    rushVia(board({ hand: [inst("XG3-090", "sb")], rush: [inst("XG3-089", "bb"), ...rush], power: [], command: cmds("WB", "ET") }, p2), "player1", "XG3-090:sb", (a) => a.zordMaterialInstanceId === "XG3-089:bb");

  it("XG3-090: 追加条件 — 自軍「ブルービート」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1958「追加条件：自軍「ブルービート」1体を捨札にすれば必要パワー0になる」）", () => {
    const r = zordDown();
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG3-090:sb")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-089:bb")).toBe("discard");
  });

  it("XG3-090: 必要パワー7- — 「ブルービート」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: atwiki/page-1958「必要パワー：7-」・R-ADD-02）", () => {
    const mk = (n: number) => board({ hand: [inst("XG3-090", "sb")], power: powerCards(n), command: cmds("WB", "ET") });
    expect(canStartRush(mk(6), "player1", "XG3-090:sb")).toBe(false);
    expect(rushFromHand(mk(7), "player1", "XG3-090:sb").ok).toBe(true);
  });

  reanimateTests("XG3-090", "XG3-089", "ブルービート", "atwiki/page-1958「これが撃破されて捨札になったとき、自軍捨札から「ブルービート」のカードを1枚選び、自軍ラッシュエリアに出す」");

  /** 「昆虫」の自軍ユニット: これ・SPEC-INS ×2（計3 → BP6000）。 */
  const enemies: P2 = { battle: [inst("SPEC-BP6", "b6"), inst("TST-UNIT-7", "l")], rush: [inst("SPEC-BP5", "r5")] };

  it("XG3-090:【スーパーファイナルブロー】— ラッシュしたとき、「昆虫」の自軍ユニット（これを含め3体）× BP2000 = 6000 以下の敵軍ユニット（サイズ・エリアを問わない）を選べる（任意）（出典: atwiki/page-1958「ユニット1体につきBP2000として、特徴「昆虫」を持つ自軍ユニットの数分のBPを計算し、そのBP以下の敵軍ユニットを1体選び撃破する」・カード評価「サイズを指定されていない」）", () => {
    const r = zordDown(enemies, [inst("SPEC-INS", "i1"), inst("SPEC-INS", "i2")]);
    expect(r.ok, r.error).toBe(true);
    expect(choiceIds(r.state).sort()).toEqual(["SPEC-BP5:r5", "SPEC-BP6:b6"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it("XG3-090:【スーパーファイナルブロー】— 選んだ BP6000 のユニットを撃破する（出典: atwiki/page-1958「1体選び撃破する」）", () => {
    const r = zordDown(enemies, [inst("SPEC-INS", "i1"), inst("SPEC-INS", "i2")]);
    const s = resolveAll(r.state, ["SPEC-BP6:b6"]);
    expect(zoneOf(s, "player2", "SPEC-BP6:b6")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:l")).toBe("battle");
  });
});
