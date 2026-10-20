/**
 * カード別スペック: XG5-028〜XG5-034（クロスギャザー XG5 ザ・チケットブレイカー バーニングレジェンドダイボイジャー〜シンケンレッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。本範囲のカードページに atwiki 転載の公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）。作品名はカードページの「作品：」行
 *  3. docs/rules/*.md の一般ルール（R-ADD-06・R-KW-WING-01・R-KW-RESIST-01・R-CN-06）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  endTurn,
  enter,
  enterKeep,
  exiled,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectRarityIn,
  expectStats,
  fill,
  inst,
  nextPhase,
  passEntry,
  passTurnTo,
  pick,
  pickAll,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushOffered,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  toTurnEnd,
  wingTests,
  zoneOf,
  skipFrom,
} from "./XG5-021-040.helpers";

const C3 = sUnit("SPEC-C3", { bp: 3000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 3000, powerCost: 4 });
const E500 = sUnit("SPEC-E500", { bp: 500 });
const EM = sUnit("SPEC-EM", { bp: 1000, size: "M" });
const RED = sUnit("SPEC-RED", { category: "WB", bp: 1000, features: ["レッド"] });
const BLUE = sUnit("SPEC-BLUE", { category: "WB", bp: 1000, features: ["ブルー"] });
const YELLOW = sUnit("SPEC-YELLOW", { category: "WB", bp: 1000, features: ["イエロー"] });
const M_PLAIN = sUnit("SPEC-M-PLAIN", { category: "WB", bp: 3000, size: "M", sp: undefined });
const M_MECHA = sUnit("SPEC-M-MECHA", { category: "WB", bp: 3000, size: "M", sp: undefined, features: ["メカ"] });
const S_PLAIN = sUnit("SPEC-S-PLAIN", { category: "WB", bp: 3000, sp: undefined });
const SAMURAI = sUnit("SPEC-SAMURAI", { category: "MA", bp: 1000, features: ["侍"] });
const SAMURAI_M = sUnit("SPEC-SAMURAI-M", { category: "MA", bp: 3000, size: "M", features: ["侍"] });
const U1 = sUnit("SPEC-U1", { bp: 1000, powerCost: 1 });
const DA1 = sUnit("SPEC-DA1", { category: "DA", bp: 1000, powerCost: 1 });
const COND1 = sUnit("SPEC-COND1", {
  bp: 4000,
  powerCost: "1+",
  rushAdditionalCondition: { conditionId: "send_s_unit_to_discard", text: "自軍Sユニットを1体捨札にする", unitCount: 1 },
} as never);
const OP1 = { id: "SPEC-OP1", name: "SPEC-OP1", type: "operation", category: "MA", rarity: "N", expansion: "card-spec", powerCost: 1 } as never;
const EXTRA = [C3, C4, E500, EM, RED, BLUE, YELLOW, M_PLAIN, M_MECHA, S_PLAIN, SAMURAI, SAMURAI_M, U1, DA1, COND1, OP1];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-028 バーニングレジェンドダイボイジャー", () => {
  const TEXT =
    "【スーパーサーティーセンタイソウル】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒作品名に「戦隊」を含む、DAを持たない自軍捨札の枚数を数え、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。";

  it("XG5-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-2237）", () => {
    expectCatalogText("XG5-028", TEXT);
    expectMultiStats("XG5-028", { name: "バーニングレジェンドダイボイジャー", category: ["MA", "ET"], size: "XL", bp: 20000, sp: 1, powerCost: "7+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG5-028", ["R"]);
  });

  it("XG5-028: 追加条件 — 自軍「ダイボイジャー」1体を捨札にし、パワー7でラッシュできる（出典: atwiki/page-2237「追加条件：自軍「ダイボイジャー」1体を捨札にする」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-028", "bl")], rush: [inst("XG5-019", "dv")], power: powerCards(7), command: [...releasedCat("MA", 1), ...releasedCat("ET", 1)] }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-028:bl", { materials: ["XG5-019:dv"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-028:bl")).toBe("rush");
    expect(zoneOf(s, "player1", "XG5-019:dv")).toBe("discard");
  });

  // 作品（atwiki「作品：」行）: RS-063 轟轟戦隊ボウケンジャー・RS-163 百獣戦隊ガオレンジャー・XG5-001 大戦隊ゴーグルファイブ（数える）、
  // RK-023 仮面ライダー（「戦隊」を含まない）、XG5-011 救急戦隊ゴーゴーファイブ（DA を持つ）→ 3枚。
  const DISCARD = () => [inst("RS-063", "a"), inst("RS-163", "b"), inst("XG5-001", "c"), inst("RK-023", "d"), inst("XG5-011", "e")];
  const enters = (p2: Partial<GameState["players"]["player2"]> = { rush: [inst("SPEC-C3", "e3"), inst("SPEC-C4", "e4")] }) =>
    enter(battle({ rush: [inst("XG5-028", "bl")], discard: DISCARD() }, p2), "XG5-028:bl");

  it("XG5-028:【スーパーサーティーセンタイソウル】— 自軍ターン中にバトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-2237「次の効果を発動できる」）", () => {
    const s = enters();
    expectChoiceFrom(s, "player1", "XG5-028");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-028:【スーパーサーティーセンタイソウル】— 作品名に「戦隊」を含み DA を持たない自軍捨札の枚数（3枚）以下の必要パワーの数字を持つ敵軍ユニットを選び、持ち主のパワーゾーンにダメージにして置く（必要パワー4は選べない）（出典: atwiki/page-2237「作品名に「戦隊」を含む、DAを持たない自軍捨札の枚数を数え、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く」・カード評価「初の作品名を参照するカード」）", () => {
    let s = enters();
    if (s.pendingEffectChoice?.kind === "confirm") s = accept(s);
    expect(choiceIds(s)).toEqual(["SPEC-C3:e3"]);
    s = resolveAll(pick(s, "SPEC-C3:e3"));
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C3:e3")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG5-028:【スーパーサーティーセンタイソウル】— 敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-2237「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { deck: deckCards(5), rush: [inst("XG5-028", "bl")], discard: DISCARD() }, player2: { deck: deckCards(5, "e"), rush: [inst("SPEC-C3", "e3")] } }, EXTRA);
    expect(canEnter(s0, "XG5-028:bl")).toBe(false);
  });
});

// ===========================================================================
describe("XG5-029 ゲキファイヤー", () => {
  const TEXT =
    "合体―ゲキレッドまたはゲキゴリラ＋ゲキブルーまたはゲキガゼル＋ゲキイエローまたはゲキペンギン 【頑頑ナックル落とし】これがアタックして敵軍ユニットをバトルで撃破するたび、自分コマンドを1つ選びホールドしてもよい。そうしたとき、このターン、これはBP+2000され、追加でアタックかストライクを行ってもよい。";

  it("XG5-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-2281）", () => {
    expectCatalogText("XG5-029", TEXT);
    expectMultiStats("XG5-029", { name: "ゲキファイヤー", category: ["WB", "MA"], size: "L", bp: 12000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["激気", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG5-029", ["SR"]);
  });

  it("XG5-029: 合体 — ゲキゴリラ・ゲキガゼル・ゲキペンギンを捨札にし、パワー6でラッシュできる（出典: atwiki/page-2281「合体―ゲキレッドまたはゲキゴリラ＋ゲキブルーまたはゲキガゼル＋ゲキイエローまたはゲキペンギン」・R-ADD-06）", () => {
    const parts = [inst("XG5-030", "g"), inst("XG5-031", "z"), inst("XG5-032", "p")];
    const s0 = rushBoard({ hand: [inst("XG5-029", "gf")], rush: parts, power: powerCards(6), command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)] }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-029:gf", { materials: parts.map((c) => c.instanceId) });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-029:gf")).toBe("rush");
    for (const c of parts) expect(zoneOf(s, "player1", c.instanceId)).toBe("discard");
  });

  /** バトルエリアのゲキファイヤーが敵軍の E500 にアタックして撃破する。 */
  const won = () =>
    settle(attack(battle({ battle: [inst("XG5-029", "gf")], command: [released("TST-OP", "c1"), released("TST-OP-MA", "c2")] }, { battle: [inst("SPEC-E500", "a"), inst("SPEC-E500", "b")] }), "XG5-029:gf", "SPEC-E500:a"));

  it("XG5-029:【頑頑ナックル落とし】— アタックして敵軍ユニットをバトルで撃破したとき、自軍コマンドを1つ選んでホールドするかを選べる（任意）（出典: atwiki/page-2281「これがアタックして敵軍ユニットをバトルで撃破するたび、自分コマンドを1つ選びホールドしてもよい」）", () => {
    const s = won();
    expect(zoneOf(s, "player2", "SPEC-E500:a")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-029");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:c2", "TST-OP:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-029:【頑頑ナックル落とし】— ホールドすれば、このターン BP+2000 され、追加でアタックかストライクを行える（出典: atwiki/page-2281「このターン、これはBP+2000され、追加でアタックかストライクを行ってもよい」）", () => {
    const s = settle(pick(won(), "TST-OP:c1"));
    expect(bpOf(s, "player1", "XG5-029:gf")).toBe(14000);
    expect(targetsOf(s, "XG5-029:gf")).toEqual(["SPEC-E500:b"]);
    expect(canStrike(s, "XG5-029:gf")).toBe(true);
  });

  it("XG5-029:【頑頑ナックル落とし】— ホールドしなければ追加でアタックできない（出典: atwiki/page-2281「そうしたとき」）", () => {
    let s = won();
    if (s.pendingEffectChoice?.sourceCardId === "XG5-029") s = settle(skip(s));
    expect(targetsOf(s, "XG5-029:gf")).toEqual([]);
    expect(bpOf(s, "player1", "XG5-029:gf")).toBe(12000);
  });
});

// ===========================================================================
describe("XG5-030 ゲキゴリラ", () => {
  const TEXT = "※レジスト 【ゴリゴリ波】これをラッシュしたとき、敵軍Sユニットか敵軍コマンドを敵軍ダメージの数まで選びホールドしてもよい。";

  it("XG5-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-2198）", () => {
    expectCatalogText("XG5-030", TEXT);
    expectMultiStats("XG5-030", { name: "ゲキゴリラ", category: ["WB", "MA"], size: "M", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["激気"], rushCondition: "state_gate" });
    expectRarityIn("XG5-030", ["N"]);
  });

  it("XG5-030: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2198「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-030", "g")] }, "XG5-030:g"))).toBe(true);
  });

  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushBoard({ hand: [inst("XG5-030", "g")], rush: [inst("SPEC-RED", "r")], power: powerCards(5), command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)], ...p1 }, p2, EXTRA);

  it("XG5-030: 追加条件 — 特徴「レッド」を持つ自軍ユニットがあればラッシュでき、なければラッシュできない（出典: atwiki/page-2198「追加条件：特徴「レッド」を持つ自軍ユニットがある」）", () => {
    expect(rushOffered(board(), "XG5-030:g")).toBe(true);
    expect(rushOffered(board({ rush: [inst("SPEC-BLUE", "b")] }), "XG5-030:g")).toBe(false);
  });

  const ENEMY = () => ({
    damage: 2,
    power: damageCards(2, "ed"),
    rush: [inst("SPEC-E500", "s1"), inst("SPEC-EM", "m")],
    battle: [inst("SPEC-E500", "s2")],
    command: [released("TST-OP", "c1")],
  });

  it("XG5-030:【ゴリゴリ波】— ラッシュしたとき、敵軍 S ユニットか敵軍コマンドから選べる（M ユニットは選べない。任意）（出典: atwiki/page-2198「敵軍Sユニットか敵軍コマンドを敵軍ダメージの数まで選びホールドしてもよい」）", () => {
    const r = rushFromHand(board({}, ENEMY()), "player1", "XG5-030:g");
    expect(r.ok, r.error).toBe(true);
    const s = r.state;
    expectChoiceFrom(s, "player1", "XG5-030");
    expect(choiceIds(s)).toEqual(["SPEC-E500:s1", "SPEC-E500:s2", "TST-OP:c1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-030:【ゴリゴリ波】— 敵軍ダメージの数（2）まで選んでホールドする（出典: atwiki/page-2198「敵軍ダメージの数まで選びホールドしてもよい」）", () => {
    const r = rushFromHand(board({}, ENEMY()), "player1", "XG5-030:g");
    let s = pickAll(r.state, ["SPEC-E500:s1", "TST-OP:c1"]);
    s = resolveAll(s, []);
    expect(cardIn(s, "player2", "SPEC-E500:s1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-OP:c1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-E500:s2")?.commandHeld ?? false).toBe(false);
  });

  it("XG5-030:【ゴリゴリ波】— 敵軍ダメージが0なら何も選ばない（出典: atwiki/page-2198「敵軍ダメージの数まで」）", () => {
    const r = rushFromHand(board({}, { ...ENEMY(), damage: 0, power: [] }), "player1", "XG5-030:g");
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("XG5-030");
  });
});

// ===========================================================================
describe("XG5-031 ゲキガゼル", () => {
  const TEXT = "【ガゼル脚】このユニットからコンビネーションする特徴「メカ」を持たないMユニットは、BP+3000され「SP1/2」になり、アタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする。";

  it("XG5-031: カタログ本文・スペックが出典と一致（出典: atwiki/page-2199）", () => {
    expectCatalogText("XG5-031", TEXT);
    expectMultiStats("XG5-031", { name: "ゲキガゼル", category: ["WB", "MA"], size: "M", bp: 4000, sp: undefined, powerCost: "3+", comboNumber: "L", features: ["激気"], rushCondition: "state_gate" });
    expectRarityIn("XG5-031", ["N"]);
  });

  it("XG5-031: 追加条件 — 特徴「ブルー」を持つ自軍ユニットがあればラッシュでき、なければラッシュできない（出典: atwiki/page-2199「追加条件：特徴「ブルー」を持つ自軍ユニットがある」）", () => {
    const mk = (other: string) => rushBoard({ hand: [inst("XG5-031", "z")], rush: [inst(other, "o")], power: powerCards(3), command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)] }, {}, EXTRA);
    expect(rushOffered(mk("SPEC-BLUE"), "XG5-031:z")).toBe(true);
    expect(rushOffered(mk("SPEC-RED"), "XG5-031:z")).toBe(false);
  });

  /** 1番目にゲキガゼル、2番目に next。 */
  const combo = (next: string) => enterKeep(battle({ rush: [inst("XG5-031", "z"), inst(next.split(":")[0]!, next.split(":")[1]!)] }, { battle: [inst("SPEC-E500", "e")] }), ["XG5-031:z", next]);

  it("XG5-031:【ガゼル脚】— ゲキガゼルからコンビネーションする「メカ」を持たない M ユニットは BP+3000 され「SP1/2」になる（2番目なので SP1）（出典: atwiki/page-2199「このユニットからコンビネーションする特徴「メカ」を持たないMユニットは、BP+3000され「SP1/2」になり」）", () => {
    const s = combo("SPEC-M-PLAIN:m");
    expect(bpOf(s, "player1", "SPEC-M-PLAIN:m")).toBe(6000);
    expect(spOf(s, "player1", "SPEC-M-PLAIN:m")).toBe(1);
  });

  it("XG5-031:【ガゼル脚】— そのユニットはアタックかストライクを選ぶとき、敵軍ユニットにアタックできるならアタックしなければならない（ストライクを選べない）（出典: atwiki/page-2199「アタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする」・カード評価「ストライクは制限される」）", () => {
    const s = combo("SPEC-M-PLAIN:m");
    expect(spOf(s, "player1", "SPEC-M-PLAIN:m")).toBe(1); // 前提: 「SP1/2」になっている（ならなければストライクできないのは SP がないため）
    expect(targetsOf(s, "SPEC-M-PLAIN:m")).toEqual(["SPEC-E500:e"]);
    expect(canStrike(s, "SPEC-M-PLAIN:m")).toBe(false);
  });

  it("XG5-031:【ガゼル脚】—「メカ」を持つ M ユニット・S ユニットには効かない（出典: atwiki/page-2199「特徴「メカ」を持たないMユニットは」）", () => {
    expect(bpOf(combo("SPEC-M-MECHA:m"), "player1", "SPEC-M-MECHA:m")).toBe(3000);
    expect(bpOf(combo("SPEC-S-PLAIN:s"), "player1", "SPEC-S-PLAIN:s")).toBe(3000);
  });
});

// ===========================================================================
describe("XG5-032 ゲキペンギン", () => {
  const TEXT = "※ウイング 【ジェットボード】自分がターンを終えるとき、このユニットがバトルエリアにあれば、自軍ラッシュエリアに戻してもよい。";

  it("XG5-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-2200）", () => {
    expectCatalogText("XG5-032", TEXT);
    expectMultiStats("XG5-032", { name: "ゲキペンギン", category: ["WB", "MA"], size: "M", bp: 3000, sp: undefined, powerCost: "2+", comboNumber: undefined, features: ["激気"], rushCondition: "state_gate" });
    expectRarityIn("XG5-032", ["N"]);
  });

  it("XG5-032: 追加条件 — 特徴「イエロー」を持つ自軍ユニットがあればラッシュでき、なければラッシュできない（出典: atwiki/page-2200「追加条件：特徴「イエロー」を持つ自軍ユニットがある」）", () => {
    const mk = (other: string) => rushBoard({ hand: [inst("XG5-032", "p")], rush: [inst(other, "o")], power: powerCards(2), command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)] }, {}, EXTRA);
    expect(rushOffered(mk("SPEC-YELLOW"), "XG5-032:p")).toBe(true);
    expect(rushOffered(mk("SPEC-RED"), "XG5-032:p")).toBe(false);
  });

  wingTests("XG5-032", "atwiki/page-2200");

  it("XG5-032:【ジェットボード】— 自分がターンを終えるとき、バトルエリアにあれば自軍ラッシュエリアに戻すかを選べる（任意）（出典: atwiki/page-2200「自分がターンを終えるとき、このユニットがバトルエリアにあれば、自軍ラッシュエリアに戻してもよい」）", () => {
    const s = toTurnEnd(battle({ battle: [inst("XG5-032", "p")] }), "XG5-032");
    expectChoiceFrom(s, "player1", "XG5-032");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-032:【ジェットボード】— 戻すことを選べば自軍ラッシュエリアに戻り、相手のターンにはラッシュエリアにいる（出典: atwiki/page-2200・カード評価「ラッシュエリアに戻り安全を確保する」）", () => {
    let s = toTurnEnd(battle({ battle: [inst("XG5-032", "p")] }), "XG5-032");
    s = settle(accept(s));
    s = toTurnEnd(s);
    expect(zoneOf(s, "player1", "XG5-032:p")).toBe("rush");
  });

  it("XG5-032:【ジェットボード】— 戻さなければバトルエリアに残る（出典: atwiki/page-2200「戻してもよい」）", () => {
    let s = toTurnEnd(battle({ battle: [inst("XG5-032", "p")] }), "XG5-032");
    s = toTurnEnd(skipFrom(s, "XG5-032"));
    expect(zoneOf(s, "player1", "XG5-032:p")).toBe("battle");
  });

  it("XG5-032:【ジェットボード】— ラッシュエリアにあるときは何も起きない（出典: atwiki/page-2200「このユニットがバトルエリアにあれば」）", () => {
    const s = toTurnEnd(battle({ rush: [inst("XG5-032", "p")] }), "XG5-032");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-032");
  });
});

// ===========================================================================
describe("XG5-033 シンケンレッド（志葉 薫）", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。 【封印のモヂカラ】 自軍ターン中、これがバトルエリアに出たとき、自分の手札を1枚選び相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字と同じ必要パワーの数字を持つ、追加条件を持たない敵軍ユニットを1体選び、持ち主の山札の下に戻す。（選んだユニットがDAを持つなら、山札の下に戻すかわりにゲームから除外する）";

  it("XG5-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-2170）", () => {
    expectCatalogText("XG5-033", TEXT);
    expectStats("XG5-033", { name: "シンケンレッド（志葉 薫）", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["レッド", "女", "侍"] });
    expectRarityIn("XG5-033", ["R"]);
  });

  it("XG5-033: ※ — ラッシュしたターンにはバトルエリアに出られない（出典: atwiki/page-2170「これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const s0 = rushBoard({ hand: [inst("XG5-033", "k")], power: powerCards(4), command: releasedCat("MA", 1) }, {}, EXTRA);
    const r = rushFromHand(s0, "player1", "XG5-033:k");
    expect(r.ok, r.error).toBe(true);
    expect(canEnter(nextPhase(resolveAll(r.state)), "XG5-033:k")).toBe(false);
  });

  it("XG5-033: ※ — ラッシュしたターンでなければ（前から自軍ラッシュエリアにいれば）出られる（出典: atwiki/page-2170「ラッシュしたターンに」）", () => {
    expect(canEnter(battle({ rush: [inst("XG5-033", "k")] }), "XG5-033:k")).toBe(true);
  });

  const HAND = () => [inst("SPEC-U1", "h1"), inst("SPEC-OP1", "h2"), inst("SPEC-C3", "h3")];
  const ENEMY = () => ({ rush: [inst("SPEC-U1", "e1"), inst("SPEC-DA1", "d1"), inst("SPEC-COND1", "c1"), inst("SPEC-C3", "e3")], deck: deckCards(3, "e") });
  const enters = () => enter(battle({ rush: [inst("XG5-033", "k")], hand: HAND() }, ENEMY()), "XG5-033:k");

  it("XG5-033:【封印のモヂカラ】— 自軍ターン中にバトルエリアに出たとき、手札を1枚選んで相手に見せるかを選べる（任意）（出典: atwiki/page-2170「自分の手札を1枚選び相手に見せてもよい」）", () => {
    const s = enters();
    expectChoiceFrom(s, "player1", "XG5-033");
    expect(choiceIds(s)).toEqual(["SPEC-C3:h3", "SPEC-OP1:h2", "SPEC-U1:h1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-033:【封印のモヂカラ】— 見せたカード（必要パワー1）と同じ必要パワーの数字の、追加条件を持たない敵軍ユニットから選ぶ（「1+」の追加条件持ち・必要パワー3は選べない）（出典: atwiki/page-2170「見せたカードの必要パワーの数字と同じ必要パワーの数字を持つ、追加条件を持たない敵軍ユニットを1体選び」）", () => {
    const s = pick(enters(), "SPEC-OP1:h2");
    expectChoiceFrom(s, "player1", "XG5-033");
    expect(choiceIds(s)).toEqual(["SPEC-DA1:d1", "SPEC-U1:e1"]);
  });

  it("XG5-033:【封印のモヂカラ】— 選んだユニットは持ち主の山札の下に戻る。DA を持つならゲームから除外する（出典: atwiki/page-2170「持ち主の山札の下に戻す。（選んだユニットがDAを持つなら、山札の下に戻すかわりにゲームから除外する）」）", () => {
    let s = resolveAll(pick(pick(enters(), "SPEC-U1:h1"), "SPEC-U1:e1"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-U1:e1");
    expect(zoneOf(s, "player1", "SPEC-U1:h1")).toBe("hand");
    s = resolveAll(pick(pick(enters(), "SPEC-U1:h1"), "SPEC-DA1:d1"));
    expect(exiled(s, "player2", "SPEC-DA1:d1")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-DA1:d1")).toBeNull();
  });
});

// ===========================================================================
describe("XG5-034 シンケンレッド", () => {
  const TEXT =
    "※レジスト ※これは自軍ターン中、これ以外の特徴「侍」を持つSユニット1体につきBP+2000される。 【二刀流烈火大斬刀】これがアタックして敵軍ユニットをバトルで撃破するたび、特徴「侍」を持つ自軍Sユニットを1体選びホールドしてもよい。そうしたとき、これは追加でアタックを行ってもよい。";

  it("XG5-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-2263）", () => {
    expectCatalogText("XG5-034", TEXT);
    expectStats("XG5-034", { name: "シンケンレッド", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 3, comboNumber: 1, features: ["レッド", "男", "侍"] });
    expectRarityIn("XG5-034", ["SR"]);
  });

  it("XG5-034: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2263「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-034", "s")] }, "XG5-034:s"))).toBe(true);
  });

  it("XG5-034: SP1/3 — バトルエリアの3番目にあれば SP1（出典: atwiki/page-2263「SP：1/3」・R-STK-03）", () => {
    let s = battle({ battle: fill(2), rush: [inst("XG5-034", "s")] });
    s = enter(s, "XG5-034:s");
    expect(spOf(s, "player1", "XG5-034:s")).toBe(1);
  });

  it("XG5-034: ※ — 自軍ターン中、これ以外の特徴「侍」を持つ自軍 S ユニット1体につき BP+2000（ラッシュエリア・バトルエリアとも。M ユニットは数えない）（出典: atwiki/page-2263「これ以外の特徴「侍」を持つSユニット1体につきBP+2000される」）", () => {
    const s = battle({ battle: [inst("XG5-034", "s"), inst("SPEC-SAMURAI", "a")], rush: [inst("XG5-033", "k"), inst("SPEC-SAMURAI-M", "m")] });
    expect(bpOf(s, "player1", "XG5-034:s")).toBe(6000);
  });

  it("XG5-034: ※ — 敵軍ターン中は上がらない（出典: atwiki/page-2263「これは自軍ターン中」・カード評価「BP上昇効果は自軍ターン中のみ」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG5-034", "s"), inst("SPEC-SAMURAI", "a")] } }, EXTRA);
    expect(bpOf(s, "player1", "XG5-034:s")).toBe(2000);
  });

  /** 1番目に出て敵軍の E500 にアタックして撃破する（ラッシュエリアに「侍」の S ユニット）。 */
  const won = () =>
    settle(attack(enter(battle({ rush: [inst("XG5-034", "s"), inst("SPEC-SAMURAI", "a"), inst("SPEC-SAMURAI-M", "m")] }, { battle: [inst("SPEC-E500", "x"), inst("SPEC-E500", "y")] }), "XG5-034:s"), "XG5-034:s", "SPEC-E500:x"));

  it("XG5-034: NC【二刀流烈火大斬刀】— アタックして敵軍ユニットをバトルで撃破したとき、特徴「侍」を持つ自軍 S ユニットを1体選んでホールドするかを選べる（M ユニットは選べない。任意）（出典: atwiki/page-2263「特徴「侍」を持つ自軍Sユニットを1体選びホールドしてもよい」）", () => {
    const s = won();
    expectChoiceFrom(s, "player1", "XG5-034");
    expect(choiceIds(s)).toEqual(["SPEC-SAMURAI:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-034: NC【二刀流烈火大斬刀】— ホールドすれば追加でアタックを行える（出典: atwiki/page-2263「そうしたとき、これは追加でアタックを行ってもよい」）", () => {
    const s = settle(pick(won(), "SPEC-SAMURAI:a"));
    expect(cardIn(s, "player1", "SPEC-SAMURAI:a")?.commandHeld).toBe(true);
    expect(targetsOf(s, "XG5-034:s")).toEqual(["SPEC-E500:y"]);
  });

  it("XG5-034: NC【二刀流烈火大斬刀】— ホールドしなければ追加でアタックできない（出典: atwiki/page-2263「そうしたとき」）", () => {
    let s = won();
    if (s.pendingEffectChoice?.sourceCardId === "XG5-034") s = settle(skip(s));
    expect(targetsOf(s, "XG5-034:s")).toEqual([]);
  });
});

void endTurn;
void passEntry;
void passTurnTo;
void act;
