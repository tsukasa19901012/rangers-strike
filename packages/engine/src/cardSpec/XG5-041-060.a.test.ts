/**
 * カード別スペック: XG5-041〜XG5-047（クロスギャザー XG5 ザ・チケットブレイカー ゴセイイエロー〜キューユソウル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。本範囲のカードページに atwiki 転載の公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. atwiki のキーワードのページ（page-1290 スクラム・page-1291 タクス・page-2250 リード）・docs/rules/*.md の一般ルール
 *     （R-KW-SCRUM-01・R-KW-CALL-01・R-KW-RESIST-01・R-RUSH-20）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  attackTargets,
  attackUntilRegister,
  bpOf,
  canActivateField,
  canEnter,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  endPhase,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  beltUsed,
  faceUp,
  fill,
  activateField,
  inst,
  leadMaTests,
  passEntry,
  passTurnTo,
  payableFor,
  pick,
  pickAll,
  powerCards,
  registerOffered,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  st,
  sUnit,
  taxMaTests,
  wingTests,
  zoneOf,
} from "./XG5-041-060.helpers";

const CN3 = sUnit("SPEC-CN3", { category: "WB", bp: 1000, comboNumber: 3 } as never);
const MA_UNIT = sUnit("SPEC-MA-UNIT", { category: "MA", bp: 1000, powerCost: 2 });
const BIG = sUnit("SPEC-BIG", { category: "WB", bp: 25000, size: "L" });
const EXTRA = [CN3, MA_UNIT];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

const handN = (n: number) => Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `h${i}`));

// ===========================================================================
describe("XG5-041 ゴセイイエロー", () => {
  const TEXT =
    "※レジスト ※リードMA 【兄妹の絆】これは次の相手ターン終了時まで、次の能力を得る⇒「BP+3000｣「スクラム」（自分の手札が1枚以下なら、追加で次の能力を得る⇒これはアタックされる以外では相手に選ばれない）";

  it("XG5-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-2232）", () => {
    expectCatalogText("XG5-041", TEXT);
    expectMultiStats("XG5-041", { name: "ゴセイイエロー", category: ["WB", "MA"], size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: 2, features: ["イエロー", "女"] });
    expectRarityIn("XG5-041", ["N"]);
  });

  it("XG5-041: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2232「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-041", "y")] }, "XG5-041:y"))).toBe(true);
  });

  leadMaTests("XG5-041", "atwiki/page-2232");

  /** 1番目に TST-UNIT-0、2番目にゴセイイエロー、3番目に CN3 のユニット。相手のラッシュエリアに TST-UNIT-7 と XG5-037 ゴセイレッド。 */
  const lined = (hand = 2) => {
    let s = battle(
      { hand: handN(hand), battle: fill(1), rush: [inst("XG5-041", "y"), inst("SPEC-CN3", "c3")] },
      { rush: [inst("TST-UNIT-7", "atk"), inst("XG5-037", "gr")] },
    );
    s = passEntry(settle(enter(s, "XG5-041:y")));
    return passEntry(settle(enter(s, "SPEC-CN3:c3")));
  };

  it("XG5-041: NC【兄妹の絆】— 2番目に出れば BP+3000（BP4000）（出典: atwiki/page-2232「「BP+3000｣」・CN：2）", () => {
    expect(bpOf(lined(), "player1", "XG5-041:y")).toBe(4000);
  });

  it("XG5-041: NC【兄妹の絆】— 次の相手ターン中も BP4000 のまま（出典: atwiki/page-2232「次の相手ターン終了時まで」）", () => {
    const s = passTurnTo(lined(), "player2", "battle");
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "XG5-041:y")).toBe(4000);
  });

  it("XG5-041: NC【兄妹の絆】—「スクラム」— 次の相手ターン、次に CN3 のユニットが並んでいれば、これはアタックされない（出典: atwiki/page-2232「「スクラム」」・atwiki/page-1290・R-KW-SCRUM-01）", () => {
    let s = passTurnTo(lined(), "player2", "battle");
    s = enter(s, "TST-UNIT-7:atk", "player2");
    const t = attackTargets(s, "TST-UNIT-7:atk", "player2");
    expect(t).toContain("SPEC-CN3:c3");
    expect(t).not.toContain("XG5-041:y");
  });

  it("XG5-041: NC が成立しなければ（1番目）BP は上がらない（出典: atwiki/page-2232「CN：2」）", () => {
    const s = enter(battle({ rush: [inst("XG5-041", "y")] }), "XG5-041:y");
    expect(bpOf(s, "player1", "XG5-041:y")).toBe(1000);
  });

  it("XG5-041: NC【兄妹の絆】— 自分の手札が1枚以下なら、相手の効果に選ばれない（相手の XG5-037【レッドブレイク】の候補に入らない）（出典: atwiki/page-2232「これはアタックされる以外では相手に選ばれない」）", () => {
    let s = passTurnTo(lined(1), "player2", "battle");
    s = enter(s, "XG5-037:gr", "player2");
    expectChoiceFrom(s, "player2", "XG5-037");
    expect(choiceIds(s)).not.toContain("XG5-041:y");
  });

  it("XG5-041: NC【兄妹の絆】— 手札が2枚なら、相手の効果に選ばれる（出典: atwiki/page-2232「自分の手札が1枚以下なら」）", () => {
    let s = passTurnTo(lined(2), "player2", "battle");
    s = enter(s, "XG5-037:gr", "player2");
    expectChoiceFrom(s, "player2", "XG5-037");
    expect(choiceIds(s)).toContain("XG5-041:y");
  });
});

// ===========================================================================
describe("XG5-042 ゴセイマシン", () => {
  const TEXT =
    "※このカードの追加条件は、自軍捨札にリードを持つSユニットのカードが5枚以上あるとき、次のように変更される⇒追加で自軍コマンドを2つホールドする。 【天装合体】自軍ラッシュフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自分の手札から「ゴセイグレート」のカードを1枚選び、自軍ラッシュエリアに出してもよい。";

  it("XG5-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-2204）", () => {
    expectCatalogText("XG5-042", TEXT);
    expectMultiStats("XG5-042", { name: "ゴセイマシン", category: ["WB", "MA"], size: "SC", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["魔法", "獣"], rushCondition: "send_s_unit_to_discard" });
    expectRarityIn("XG5-042", ["N"]);
  });

  const CMD = () => [...releasedCat("WB", 1), ...releasedCat("MA", 2)];

  it("XG5-042: 追加条件 — 自軍 S ユニット5体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-2204「追加条件：自軍Sユニット5体を捨札にする」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-042", "m")], rush: fill(5), power: powerCards(5), command: CMD() }), "player1", "XG5-042:m");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-042:m")).toBe("rush");
    for (let i = 0; i < 5; i++) expect(zoneOf(s, "player1", `TST-UNIT-0:f${i}`)).toBe("discard");
  });

  // リードを持つ S ユニットのカード: XG5-037〜041（いずれも ※リードMA）。
  const LEADS = (n: number) => ["XG5-037", "XG5-038", "XG5-039", "XG5-040", "XG5-041"].slice(0, n).map((id, i) => inst(id, `l${i}`));

  it("XG5-042: ※ — 自軍捨札にリードを持つ S ユニットのカードが5枚あれば、追加条件は「追加で自軍コマンドを2つホールドする」になり、S ユニットがなくてもラッシュできる（コマンドを3つホールド）（出典: atwiki/page-2204「次のように変更される⇒追加で自軍コマンドを2つホールドする」）", () => {
    const r = rushFromHand(rushBoard({ hand: [inst("XG5-042", "m")], discard: LEADS(5), power: powerCards(5), command: CMD() }), "player1", "XG5-042:m");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-042:m")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld).length).toBe(3);
  });

  it("XG5-042: ※ — リードを持つ S ユニットのカードが4枚なら、S ユニットがなければラッシュできない（出典: atwiki/page-2204「5枚以上あるとき」）", () => {
    const s = rushBoard({ hand: [inst("XG5-042", "m")], discard: LEADS(4), power: powerCards(5), command: CMD() });
    const r = rushFromHand(s, "player1", "XG5-042:m");
    expect(r.ok && zoneOf(r.state, "player1", "XG5-042:m") === "rush").toBe(false);
  });

  it("XG5-042:【天装合体】— 自軍ラッシュフェイズ中、自軍エリアのこれを捨札にでき、そうしたとき手札の「ゴセイグレート」（XG4-040）を自軍ラッシュエリアに出せる（出典: atwiki/page-2204「自軍ラッシュフェイズ中、このユニットを捨札にしてもよい。そうしたとき、自分の手札から「ゴセイグレート」のカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    let s = rushBoard({ hand: [inst("XG4-040", "gg")], rush: [inst("XG5-042", "m")] });
    expect(canActivateField(s, "XG5-042:m")).toBe(true);
    s = activateField(s, "XG5-042:m");
    expect(zoneOf(s, "player1", "XG5-042:m")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-042");
    s = resolveAll(pick(s, "XG4-040:gg"));
    expect(zoneOf(s, "player1", "XG4-040:gg")).toBe("rush");
  });

  it("XG5-042:【天装合体】— 自軍バトルフェイズ中は発動できない（出典: atwiki/page-2204「自軍ラッシュフェイズ中」）", () => {
    const s = battle({ hand: [inst("XG4-040", "gg")], rush: [inst("XG5-042", "m")] });
    expect(canActivateField(s, "XG5-042:m")).toBe(false);
  });
});

// ===========================================================================
/**
 * XG5-043〜045（○○ゴセイグレート）の共通テスト。
 * 追加条件「自軍「ゴセイグレート」または「ゴセイマシン」1体を捨札にする」と、
 * 「自軍ターン中、これがバトルエリアに出たとき、次の効果を発動する⇒自軍捨札にある○○を持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」。
 * withKw は○○を持つカード2枚、withoutKw は持たないカード1枚。敵軍: TST-UNIT-0（必要パワー0）・TST-UNIT-2（2）・TST-UNIT-7（7+）。
 */
function greatTests(id: string, page: string, cost: number, kw: string, withKw: [string, string], withoutKw: string, effect: string) {
  const CMD = () => [...releasedCat("WB", 1), ...releasedCat("MA", 1)];
  const mk = (partner: CardInstance) => rushBoard({ hand: [inst(id, "g")], rush: [partner], power: powerCards(cost), command: CMD() });

  it(`${id}: 追加条件 — 自軍「ゴセイグレート」（XG4-040）1体を捨札にし、パワー${cost}でラッシュできる（出典: ${page}「追加条件：自軍「ゴセイグレート」または「ゴセイマシン」1体を捨札にする」）`, () => {
    const r = rushFromHand(mk(inst("XG4-040", "gg")), "player1", `${id}:g`, { materials: ["XG4-040:gg"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:g`)).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-040:gg")).toBe("discard");
  });

  it(`${id}: 追加条件 —「ゴセイマシン」（XG5-042）1体を捨札にしてもラッシュできる（出典: ${page}「または「ゴセイマシン」」）`, () => {
    const r = rushFromHand(mk(inst("XG5-042", "gm")), "player1", `${id}:g`, { materials: ["XG5-042:gm"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:g`)).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-042:gm")).toBe("discard");
  });

  const entered = (discard: CardInstance[] = [inst(withKw[0], "k1"), inst(withKw[1], "k2"), inst(withoutKw, "n1")]) =>
    enter(
      battle({ rush: [inst(id, "g")], discard }, { rush: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-7", "e7")], battle: [inst("TST-UNIT-2", "e2")] }),
      `${id}:g`,
    );

  it(`${id}:【${effect}】— 自軍ターン中に出たとき、自軍捨札の${kw}を持つカードの枚数（2）以下の必要パワーの数字を持つ敵軍ユニット（エリアを問わない）を選ぶ（7+ は選べない。見送れない）（出典: ${page}「自軍捨札にある${kw}を持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び」）`, () => {
    const s = entered();
    expectChoiceFrom(s, "player1", id);
    expect([...choiceIds(s)].sort()).toEqual(["TST-UNIT-0:e0", "TST-UNIT-2:e2"]);
    expect(s.pendingEffectChoice?.optional ?? false).toBe(false);
  });

  it(`${id}:【${effect}】— 選んだユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: ${page}「持ち主のパワーゾーンにダメージにして置く」）`, () => {
    const s = resolveAll(pick(entered(), "TST-UNIT-2:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("power");
    expect(cardIn(s, "player2", "TST-UNIT-2:e2")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it(`${id}:【${effect}】— ${kw}を持つカードが自軍捨札になければ、必要パワー0 の敵軍ユニットだけを選ぶ（出典: ${page}「その数以下」）`, () => {
    const s = entered([inst(withoutKw, "n1")]);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0"]);
  });
}

describe("XG5-043 シーイックゴセイグレート", () => {
  const TEXT =
    "※タクスMA 【シーイックストライク】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動する⇒自軍捨札にあるタクスを持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";
  it("XG5-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-2242）", () => {
    expectCatalogText("XG5-043", TEXT);
    expectMultiStats("XG5-043", { name: "シーイックゴセイグレート", category: ["WB", "MA"], size: "L", bp: 18000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["魔法", "獣", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-043", ["NR"]);
  });
  taxMaTests("XG5-043", "atwiki/page-2242");
  greatTests("XG5-043", "atwiki/page-2242", 5, "タクス", ["XG5-039", "XG5-039"], "XG5-037", "シーイックストライク");
});

describe("XG5-044 ランディックゴセイグレート", () => {
  const TEXT =
    "※レジスト 【ランディックストライク】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動する⇒自軍捨札にあるレジストを持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";
  it("XG5-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-2176）", () => {
    expectCatalogText("XG5-044", TEXT);
    expectMultiStats("XG5-044", { name: "ランディックゴセイグレート", category: ["WB", "MA"], size: "L", bp: 20000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["魔法", "獣", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-044", ["NR"]);
  });
  it("XG5-044: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2176「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-044", "r")] }, "XG5-044:r", {}, "SPEC-BIG:atk", [BIG]))).toBe(true);
  });
  greatTests("XG5-044", "atwiki/page-2176", 6, "レジスト", ["XG5-030", "XG5-040"], "XG5-037", "ランディックストライク");
});

describe("XG5-045 スカイックゴセイグレート", () => {
  const TEXT =
    "※ウイング 【スカイックストライク】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動する⇒自軍捨札にあるウイングを持つカードの枚数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";
  it("XG5-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-2275）", () => {
    expectCatalogText("XG5-045", TEXT);
    expectMultiStats("XG5-045", { name: "スカイックゴセイグレート", category: ["WB", "MA"], size: "L", bp: 19000, sp: 1, powerCost: "5+", comboNumber: undefined, features: ["魔法", "獣", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-045", ["R"]);
  });
  wingTests("XG5-045", "atwiki/page-2275");
  greatTests("XG5-045", "atwiki/page-2275", 5, "ウイング", ["XG5-037", "XG5-038"], "XG5-039", "スカイックストライク");
});

// ===========================================================================
describe("XG5-046 データス", () => {
  const TEXT =
    "※コールMA ※これは自軍ターン中バトルエリアに出られない。 【マスターヘッドの加護】これが自軍エリアにある間、自軍ラッシュフェイズを終えるとき、次の効果を発動できる⇒自軍エリアにSユニットが5体以上とLユニットが1体以上あれば、自分は1枚ドローする。";

  it("XG5-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-2205）", () => {
    expectCatalogText("XG5-046", TEXT);
    expectMultiStats("XG5-046", { name: "データス", category: ["MA"], size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["人型"] });
    expectRarityIn("XG5-046", ["N"]);
  });

  it("XG5-046: ※コールMA — 自軍ラッシュエリアのこれを、MA のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-2205「※コールMA」・R-KW-CALL-01）", () => {
    const s = rushBoard({ hand: [inst("SPEC-MA-UNIT", "u")], rush: [inst("XG5-046", "d")], command: releasedCat("MA", 1, "mc"), power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-MA-UNIT:u")).toContain("XG5-046:d");
  });

  it("XG5-046: ※ — 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-2205「これは自軍ターン中バトルエリアに出られない」）", () => {
    expect(canEnter(battle({ rush: [inst("XG5-046", "d")] }), "XG5-046:d")).toBe(false);
  });

  /** 自軍ラッシュエリアにデータス・S ユニット sCount 体・L ユニット1体。ラッシュフェイズを終える。 */
  const ended = (sCount: number) => endPhase(rushBoard({ rush: [inst("XG5-046", "d"), ...fill(sCount), inst("TST-UNIT-7", "L")], deck: deckCards(5) }));

  it("XG5-046:【マスターヘッドの加護】— 自軍ラッシュフェイズを終えるとき、S ユニット5体以上（これを含む）と L ユニット1体以上があれば、発動して1枚ドローできる（出典: atwiki/page-2205「自軍ラッシュフェイズを終えるとき、次の効果を発動できる⇒…自分は1枚ドローする」・カード評価「条件のSユニットには自身も含まれる」）", () => {
    let s = ended(4);
    expectChoiceFrom(s, "player1", "XG5-046");
    s = resolveAll(s);
    expect(s.players.player1.hand.length).toBe(1);
  });

  it("XG5-046:【マスターヘッドの加護】— S ユニットが4体（これを含む）ならドローしない（出典: atwiki/page-2205「Sユニットが5体以上」）", () => {
    const s = resolveAll(ended(3));
    expect(s.players.player1.hand.length).toBe(0);
  });
});

// ===========================================================================
describe("XG5-047 キューユソウル", () => {
  const TEXT =
    "自軍パワーゾーンのダメージ以外のカードをすべて捨札にする。そうしたとき、捨札にしたカードと同じ枚数まで、自軍パワーゾーンからダメージになっているカードを選び、自軍山札の上に好きな順で戻す。";

  it("XG5-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-2206）", () => {
    expectCatalogText("XG5-047", TEXT);
    expectOpStats("XG5-047", { name: "キューユソウル", category: "OT", powerCost: 7 });
    expectRarityIn("XG5-047", ["N"]);
  });

  // 自軍パワーゾーン: オモテ向き2枚・ダメージ5枚（パワー7）。
  const POWER = () => [faceUp("TST-P", "u0"), faceUp("TST-P", "u1"), ...damageCards(5, "d")];

  it("XG5-047: 自軍パワーゾーンのダメージ以外（オモテ向き）のカードをすべて捨札にする（出典: atwiki/page-2206「自軍パワーゾーンのダメージ以外のカードをすべて捨札にする」）", () => {
    const s = resolveAll(beltUsed("XG5-047", "OT", 7, { power: POWER() }), []);
    expect(zoneOf(s, "player1", "TST-P:u0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:u1")).toBe("discard");
  });

  it("XG5-047: 捨札にした枚数（2）まで、ダメージのカードを選んで自軍山札の上に戻す（3枚目は選べない）（出典: atwiki/page-2206「捨札にしたカードと同じ枚数まで、自軍パワーゾーンからダメージになっているカードを選び、自軍山札の上に好きな順で戻す」）", () => {
    let s = beltUsed("XG5-047", "OT", 7, { power: POWER() });
    expectChoiceFrom(s, "player1", "XG5-047");
    s = resolveAll(pickAll(s, ["TST-P:d0", "TST-P:d1"]), []);
    const top = s.players.player1.deck.slice(0, 2).map((c) => c.instanceId).sort();
    expect(top).toEqual(["TST-P:d0", "TST-P:d1"]);
    expect(s.players.player1.power.filter((c) => c.faceDown).length).toBe(3);
  });

  it("XG5-047: オモテ向きのカードがなければ（すべてダメージ）、ダメージは戻らない（出典: atwiki/page-2206「そうしたとき」）", () => {
    const s = resolveAll(beltUsed("XG5-047", "OT", 7, { power: damageCards(7, "d") }));
    expect(s.players.player1.power.length).toBe(7);
  });
});

