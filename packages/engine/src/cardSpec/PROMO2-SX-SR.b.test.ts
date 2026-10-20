/**
 * カード別スペック: SX-006〜SX-010（クロスギャザーのシークレットレア 仮面ライダーG電王〜仮面ライダーオーズ・タトバコンボ×仮面ライダーW・CJ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に SX の項はない。atwiki に転載された公式 Q&A: atwiki/page-2357 SX-008 Q1・Q2、
 *     atwiki/page-2250 リード Q3（SX-008 をリードで使う）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-SX-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-BREAKER-01〜03・R-KW-READ-01・R-KW-TAKUS-01・R-KW-CROSS-01・R-CAT-02・R-POW-02）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-SX-NNN …」）で残す。
 * レアリティは atwiki の「シークレットレア」を SC として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - SX-008 Q2（RS-325 天空勇者マジシャインでコマンドゾーンの SX-008 を発動すると解決に失敗する）— cardSpec/RS5-306-326.c.test.ts RS-325 の it.todo
 *  - SX-010 のクロス1 の細かい数え方（CN・分数 SP の分母が減る、タクスは並び順のまま、2体分にはならない）— rulesSpec/07-scrum-takus-cross.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  PLAIN_VEHICLE,
  act,
  bpOf,
  battleBoard,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  enterSeq,
  exiled,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  fill,
  firstOptionWhere,
  inst,
  legal,
  payableFor,
  pick,
  powerCards,
  reanimateTests,
  releasedCat,
  resolveAll,
  rushBoardWith,
  rushFromHand,
  sUnit,
  skip,
  spOf,
  useOpHolding,
  wingTests,
  zoneOf,
  zordDownTests,
} from "./PROMO2-SX-SR.helpers";

const C2 = sUnit("SPEC-C2", { powerCost: 2, bp: 1000 });
const C4 = sUnit("SPEC-C4", { powerCost: 4, bp: 1000 });
const C5 = sUnit("SPEC-C5", { powerCost: 5, bp: 1000 });
const C7M = sUnit("SPEC-C7M", { powerCost: "7-", bp: 1000 });
const L9 = sUnit("SPEC-L9", { powerCost: 9, bp: 9000, size: "L" });
const VC5 = { ...PLAIN_VEHICLE, id: "SPEC-VC5", name: "SPEC-VC5", powerCost: 5 } as unknown as CardDefinition;
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });
const NOSP = sUnit("SPEC-NOSP", { category: "OT", bp: 1000, sp: undefined });
const OT_NOSP = sUnit("SPEC-OT-NOSP", { category: "OT", bp: 1000, sp: undefined });
const EXTRA: CardDefinition[] = [C2, C4, C5, C7M, L9, VC5, E1000, NOSP, OT_NOSP];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => battleBoard(EXTRA, p1, p2);
const rushPhase = (p1: P1 = {}, p2: P2 = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("SX-006 仮面ライダーG電王", () => {
  const TEXT = "【時間警察の使者】これをラッシュしたとき、必要パワーを満たしていないSユニットとSビークルを可能な限りすべて選び、捨札にする。";

  it("SX-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-2269）", () => {
    expectCatalogText("SX-006", TEXT);
    expectUnitStats("SX-006", { name: "仮面ライダーG電王", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 3, features: ["仮面ライダー", "男", "GDEN-O", "警察"] });
    expectRarityIn("SX-006", ["SC"]);
  });

  /**
   * 自軍パワー3・敵軍パワー4。自軍ラッシュエリア: 必要パワー5（満たさない）・2（満たす）。
   * 敵軍バトルエリア: 必要パワー5・7-（満たさない）・4（満たす）の S ユニット、必要パワー5 の S ビークル、必要パワー9 の L ユニット。
   */
  const rushed = (p2extra: CardInstance[] = [], commands: { p1?: CardInstance[]; p2?: CardInstance[] } = {}) => {
    const s = rushPhase(
      { hand: [inst("SX-006", "g")], rush: [inst("SPEC-C5", "o5"), inst("SPEC-C2", "o2")], power: powerCards(3), command: [...releasedCat("OT", 1), ...(commands.p1 ?? [])] },
      {
        battle: [inst("SPEC-C5", "e5"), inst("SPEC-C7M", "e7"), inst("SPEC-C4", "e4"), inst("SPEC-VC5", "v5"), inst("SPEC-L9", "l9"), ...p2extra],
        power: powerCards(4, "ep"),
        command: commands.p2 ?? [],
      },
    );
    const r = rushFromHand(s, "player1", "SX-006:g");
    expect(r.ok, r.error).toBe(true);
    return resolveAll(r.state);
  };

  it("SX-006: 【時間警察の使者】ラッシュしたとき、必要パワーを満たしていない S ユニット・S ビークルを敵味方を問わずすべて捨札にする（出典: atwiki/page-2269「必要パワーを満たしていないSユニットとSビークルを可能な限りすべて選び、捨札にする」・カード評価「敵味方関係なくすべて捨札にする」）", () => {
    const s = rushed();
    expect(zoneOf(s, "player1", "SPEC-C5:o5")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C5:e5")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C7M:e7")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VC5:v5")).toBe("discard");
  });

  it("SX-006: 【時間警察の使者】必要パワーを満たしているユニット（自軍の必要パワー2・敵軍の必要パワー4・G電王自身）と L ユニットは残る（出典: atwiki/page-2269「必要パワーを満たしていない」「Sユニット」・R-POW-02）", () => {
    const s = rushed();
    expect(zoneOf(s, "player1", "SPEC-C2:o2")).toBe("rush");
    expect(zoneOf(s, "player1", "SX-006:g")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C4:e4")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-L9:l9")).toBe("battle");
  });

  it("SX-006: 【時間警察の使者】持ち主のパワーには、相手のコマンドゾーンのマルチカテゴリのカードで増える分も数える — 自軍コマンドゾーンにマルチカテゴリ（XG2-043 ET／DA）1枚で敵軍パワー5になり、敵軍の必要パワー5のユニット・ビークルは残る（7- は捨札）（出典: 利用者の決定 2026-10-20・questions-all.md U-3「マルチカテゴリ等の考慮も追加」・R-POW-01）", () => {
    const s = rushed([], { p1: [{ ...inst("XG2-043", "mc"), commandHeld: false }] });
    expect(zoneOf(s, "player2", "SPEC-C5:e5")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-VC5:v5")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C7M:e7")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C5:o5")).toBe("discard");
  });

  it("SX-006: 【時間警察の使者】敵軍コマンドゾーンのマルチカテゴリ2枚で自軍パワー5になり、自軍の必要パワー5のユニットは残る（出典: 利用者の決定 2026-10-20・questions-all.md U-3・R-POW-01）", () => {
    const s = rushed([], { p2: [{ ...inst("XG2-043", "m1"), commandHeld: false }, { ...inst("XG2-043", "m2"), commandHeld: false }] });
    expect(zoneOf(s, "player1", "SPEC-C5:o5")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C5:e5")).toBe("discard");
  });

  it("SX-006: 【時間警察の使者】「選び」なので、選ばれないユニット（敵軍のブレイカー SX-007 スーパーゴセイレッド、必要パワー7-）は残る（出典: atwiki/page-2269 コメント「「可能な限り」「選び」だから…場に残る」・R-KW-BREAKER-03）", () => {
    const s = rushed([inst("SX-007", "sg")]);
    expect(zoneOf(s, "player2", "SX-007:sg")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C5:e5")).toBe("discard");
  });

  it("SX-006: 【時間警察の使者】ラッシュではなくバトルエリアに出ただけでは発動しない（出典: atwiki/page-2269「これをラッシュしたとき」）", () => {
    const s = resolveAll(enter(board({ rush: [inst("SX-006", "g")], power: powerCards(3) }, { battle: [inst("SPEC-C5", "e5")], power: powerCards(4, "ep") }), "SX-006:g"));
    expect(zoneOf(s, "player2", "SPEC-C5:e5")).toBe("battle");
  });
});

// ===========================================================================
describe("SX-007 スーパーゴセイレッド", () => {
  const TEXT =
    "※ブレイカー ※ウイング ※リードMA ※これが撃破されて捨札になったとき、自軍捨札から「ゴセイレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 【スーパースカイダイナミック】敵軍Sユニットを1体選び持ち主のパワーゾーンにダメージにして置く。そうしたとき、これをリリースしてもよい。";
  const PAGE = "atwiki/page-2356";

  it("SX-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-2356）", () => {
    expectCatalogText("SX-007", TEXT);
    expectUnitStats("SX-007", { name: "スーパーゴセイレッド", category: "MA", size: "S", bp: 4500, sp: "1/3", powerCost: "7-", comboNumber: 1, features: ["レッド", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("SX-007", ["SC"]);
  });

  zordDownTests("SX-007", "XG5-037", "ゴセイレッド", `${PAGE}「自軍「ゴセイレッド」1体を捨札にすれば必要パワー0になる」`, "MA");
  wingTests("SX-007", `${PAGE}「※ウイング」`);
  reanimateTests("SX-007", "XG5-037", "ゴセイレッド", `${PAGE}「※これが撃破されて捨札になったとき、自軍捨札から「ゴセイレッド」のカードを1枚選び、自軍ラッシュエリアに出す」`);

  it("SX-007: ※ブレイカー — 同名の自軍ユニットがあるとラッシュできない（出典: atwiki/page-2356「※ブレイカー」・R-KW-BREAKER-01）", () => {
    const mk = (rush: CardInstance[]) => rushPhase({ hand: [inst("SX-007", "h")], rush, power: powerCards(7), command: releasedCat("MA", 1) });
    expect(canStartRush(mk([inst("SX-007", "f")]), "player1", "SX-007:h")).toBe(false);
    expect(canStartRush(mk([]), "player1", "SX-007:h")).toBe(true);
  });

  it("SX-007: ※ブレイカー — ブレイカーを持たない敵軍ユニット（XG5-037 ゴセイレッド【レッドブレイク】）の効果に選ばれない（出典: atwiki/page-2356「※ブレイカー」・R-KW-BREAKER-01）", () => {
    const s = enter(board({ rush: [inst("XG5-037", "gr")], hand: [] }, { battle: [inst("SX-007", "sg"), inst("SPEC-E1000", "e")] }), "XG5-037:gr");
    expectChoiceFrom(s, "player1", "XG5-037");
    expect(choiceIds(s)).toContain("SPEC-E1000:e");
    expect(choiceIds(s)).not.toContain("SX-007:sg");
  });

  it("SX-007: ※リードMA — MA のオペレーションを使うためのコマンドとしてホールドできる（出典: atwiki/page-2356「※リードMA」・R-KW-READ-01）", () => {
    const s = rushPhase({ hand: [inst("TST-OP-MA", "op")], rush: [inst("SX-007", "sg")], power: powerCards(3), command: releasedCat("MA", 1) });
    expect(payableFor(s, "TST-OP-MA:op")).toContain("SX-007:sg");
  });

  it("SX-007: 【スーパースカイダイナミック】1番目に出たとき（CN1）、敵軍 S ユニットから1体選ぶ（L ユニットは選べない）（出典: atwiki/page-2356「敵軍Sユニットを1体選び」「CN：1」）", () => {
    const s = enter(board({ rush: [inst("SX-007", "sg")] }, { battle: [inst("SPEC-E1000", "e"), inst("SPEC-L9", "l")] }), "SX-007:sg");
    expectChoiceFrom(s, "player1", "SX-007");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:e"]);
  });

  it("SX-007: 【スーパースカイダイナミック】選んだユニットは持ち主のパワーゾーンにウラ向き（ダメージ）で置かれる（出典: atwiki/page-2356「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(enter(board({ rush: [inst("SX-007", "sg")] }, { battle: [inst("SPEC-E1000", "e")] }), "SX-007:sg"), "SPEC-E1000:e"));
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E1000:e")?.faceDown).toBe(true);
  });

  it("SX-007: 【スーパースカイダイナミック】2番目に出たとき（CN が合わない）は発動しない（出典: atwiki/page-2356「CN：1」）", () => {
    let s = board({ rush: [inst("SX-007", "sg"), ...fill(1)] }, { battle: [inst("SPEC-E1000", "e")] });
    s = enterSeq(s, ["TST-UNIT-0:f0"]);
    s = enter(s, "SX-007:sg");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("SX-007");
  });

  it("SX-007: 【スーパースカイダイナミック】ホールド状態のままバトルエリアに出ても NC で発動し、置いたあと、これをリリースするかを選べる（任意）（出典: atwiki/page-2356「そうしたとき、これをリリースしてもよい」・R-HOLD-03「ホールド状態でも…バトルエリアに出る」）", () => {
    let s = enter(board({ rush: [{ ...inst("SX-007", "sg"), commandHeld: true }] }, { battle: [inst("SPEC-E1000", "e")] }), "SX-007:sg");
    expectChoiceFrom(s, "player1", "SX-007");
    s = pick(s, "SPEC-E1000:e");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("SX-007");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "release" }));
    expect(cardIn(s, "player1", "SX-007:sg")?.commandHeld ?? false).toBe(false);
  });

  it("SX-007: 【スーパースカイダイナミック】リリースしないことも選べる（ホールド状態のまま）（出典: atwiki/page-2356「リリースしてもよい」）", () => {
    let s = pick(enter(board({ rush: [{ ...inst("SX-007", "sg"), commandHeld: true }] }, { battle: [inst("SPEC-E1000", "e")] }), "SX-007:sg"), "SPEC-E1000:e");
    s = resolveAll(skip(s));
    expect(cardIn(s, "player1", "SX-007:sg")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("power");
  });

  it("SX-007: 【スーパースカイダイナミック】リリース状態で出たときは、リリースの選択は開かない（出典: atwiki/page-2356「これをリリースしてもよい」）", () => {
    const s = pick(enter(board({ rush: [inst("SX-007", "sg")] }, { battle: [inst("SPEC-E1000", "e")] }), "SX-007:sg"), "SPEC-E1000:e");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("SX-007");
  });
});

// ===========================================================================
describe("SX-008 超・電王トリロジー", () => {
  const TEXT =
    "これを使用するためにホールドしたコマンドのカテゴリごとに、次の効果を発動できる→ ◎WBなら、敵軍Sユニットを１体選び、ゲームから除外する。 ◎OTなら、自軍Sユニットを１体選ぶ。このターン、選んだユニットは「SP1」になる。 ◎MAなら、自分は３枚ドローする。";

  it("SX-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-2357）", () => {
    expectCatalogText("SX-008", TEXT);
    const d = DEFS["SX-008"]!;
    expect(d.name).toBe("超・電王トリロジー");
    expect(d.type).toBe("operation");
    expect(d.category).toEqual(["WB", "OT", "MA"]);
    expect(d.powerCost).toBe(5);
    expectRarityIn("SX-008", ["SC"]);
  });

  /** 自軍ラッシュフェイズ。コマンドゾーンに WB・OT・MA（リリース）、自軍バトルエリアに SP のない OT ユニット、敵軍に S ユニットと L ユニット。 */
  const trilogy = (p1: P1 = {}) =>
    board(
      {
        hand: [inst("SX-008", "t")],
        battle: [inst("SPEC-NOSP", "own")],
        power: powerCards(5),
        command: [...releasedCat("WB", 1), ...releasedCat("OT", 1), ...releasedCat("MA", 1)],
        deck: deckCards(6),
        ...p1,
      },
      { battle: [inst("SPEC-E1000", "e"), inst("SPEC-L9", "l")] },
    );
  const rush = (s: GameState): GameState => ({ ...s, phase: "rush" });
  const use = (cmd: string[], p1: P1 = {}) => {
    const r = useOpHolding(rush(trilogy(p1)), "SX-008:t", cmd);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("SX-008: マルチカテゴリなので、コマンドゾーンに WB・OT・MA がそろっていなければ使えない（出典: R-CAT-02・atwiki/page-2357 カード評価「前提としてコマンドに3色が揃っていなければならない」）", () => {
    const s = rush(trilogy({ command: [...releasedCat("WB", 1), ...releasedCat("MA", 1)] }));
    expect(payableFor(s, "SX-008:t")).toBeUndefined();
  });

  it("SX-008: WB のコマンドをホールドして使うと、敵軍 S ユニット（L は不可）を1体選びゲームから除外する。MA の効果（ドロー）は発動しない（出典: atwiki/page-2357「◎WBなら、敵軍Sユニットを１体選び、ゲームから除外する」「ホールドしたコマンドのカテゴリごとに」）", () => {
    let s = use(["TST-OP:cWB0"]);
    const handBefore = s.players.player1.hand.length;
    expectChoiceFrom(s, "player1", "SX-008");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:e"]);
    s = resolveAll(pick(s, "SPEC-E1000:e"));
    expect(exiled(s, "player2")).toEqual(["SPEC-E1000:e"]);
    expect(s.players.player1.hand.length).toBe(handBefore);
  });

  it("SX-008: MA のコマンドをホールドして使うと、自分は3枚ドローする（敵軍ユニットは除外されない）（出典: atwiki/page-2357「◎MAなら、自分は３枚ドローする」）", () => {
    const s = resolveAll(use(["TST-OP-MA:cMA0"]));
    expect(s.players.player1.hand.length).toBe(3);
    expect(s.players.player1.deck.length).toBe(3);
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("battle");
  });

  it("SX-008: OT のコマンドをホールドして使うと、自軍 S ユニットを1体選び、このターン「SP1」にする（出典: atwiki/page-2357「◎OTなら、自軍Sユニットを１体選ぶ。このターン、選んだユニットは「SP1」になる」）", () => {
    let s = use(["TST-OP-OT:cOT0"]);
    expectChoiceFrom(s, "player1", "SX-008");
    expect(choiceIds(s)).toContain("SPEC-NOSP:own");
    s = resolveAll(pick(s, "SPEC-NOSP:own"));
    expect(spOf(s, "player1", "SPEC-NOSP:own")).toBe(1);
  });

  it("SX-008: WB・OT・MA を持つコマンド1枚（コマンドゾーンの SX-008）をホールドして使うと、3つの効果をすべて発動できる（出典: atwiki/page-2357 カード評価「このカードか英雄タイタンをコマンドに置くと…3つのカテゴリ全ての効果を同時に発動できる」）", () => {
    const s0 = use(["SX-008:cmd"], { command: [{ ...inst("SX-008", "cmd") }] });
    const s = resolveAll(s0, ["SPEC-E1000:e", "SPEC-NOSP:own"]);
    expect(exiled(s, "player2")).toEqual(["SPEC-E1000:e"]);
    expect(spOf(s, "player1", "SPEC-NOSP:own")).toBe(1);
    expect(s.players.player1.hand.length).toBe(3);
  });

  it("SX-008: 公式Q&A — XG5-037 ゴセイレッド（WB・MA）のリードMA で使うと、MA と WB のコマンドをホールドしたとして扱われ、WB と MA の効果を発動する（出典: atwiki/page-2357 Q1「ＭＡとＷＢになります」・atwiki/page-2250 Q3）", () => {
    const s0 = use(["XG5-037:gr"], { rush: [inst("XG5-037", "gr")] });
    const s = resolveAll(s0, ["SPEC-E1000:e"]);
    expect(exiled(s, "player2")).toEqual(["SPEC-E1000:e"]);
    expect(s.players.player1.hand.length).toBe(3);
    expect(spOf(s, "player1", "SPEC-NOSP:own")).toBe(0);
  });
});

// ===========================================================================
describe("SX-009 ゴセイレッド×ゴーカイレッド", () => {
  const TEXT =
    "※クロス1 ※タクスOT 【バトンタッチ】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、これ以外の自軍Sユニットを捨札にしてもよい。そうしたとき、自軍山札を見て、捨札にしたユニットと作品名が異なるSユニットのカードを1枚選び自軍ラッシュエリアに出す（必要パワーと追加条件は満たすこと）。このとき、捨札にしたユニットの作品名が「天装戦隊ゴセイジャー」、ラッシュしたユニットの作品名が「海賊戦隊ゴーカイジャー」だったなら、敵軍Sユニットを1体選び撃破する。その後、山札をシャッフルする。";

  it("SX-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-2457）", () => {
    expectCatalogText("SX-009", TEXT);
    expectUnitStats("SX-009", { name: "ゴセイレッド×ゴーカイレッド", category: ["MA", "OT"], size: "S", bp: 4000, sp: undefined, powerCost: "0+", features: ["レッド", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("SX-009", ["SC"]);
  });

  it("SX-009: 追加条件 — コマンドを追加で1つホールドしてラッシュする（MA・OT の2つがホールドされる）。リリース状態のコマンドが1つしかなければラッシュできない（出典: atwiki/page-2457「追加で自軍コマンドを1つホールドする」）", () => {
    const mk = (command: CardInstance[]) => rushPhase({ hand: [inst("SX-009", "x")], power: [], command });
    const r = rushFromHand(mk([...releasedCat("MA", 1), ...releasedCat("OT", 1)]), "player1", "SX-009:x");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-009:x")).toBe("rush");
    expect(r.state.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(canStartRush(mk([...releasedCat("MA", 1), { ...inst("TST-OP-OT", "held"), commandHeld: true }]), "player1", "SX-009:x")).toBe(false);
  });

  it("SX-009: ※タクスOT — これが3番目に並ぶと、4番目に出た OT の S ユニット（SP なし）が「SP1」になる（出典: atwiki/page-2457「※タクスOT」・R-KW-TAKUS-01）", () => {
    let s = board({ battle: [...fill(2), inst("SX-009", "x")], rush: [inst("SPEC-OT-NOSP", "o")] }, { battle: [inst("SPEC-E1000", "e")] });
    s = enter(s, "SPEC-OT-NOSP:o");
    expect(canStrike(s, "SPEC-OT-NOSP:o")).toBe(true);
  });

  it("SX-009: ※クロス1 — これが1番目にあると、2番目に出た CN3 のユニット（XG1-007 チェンジドラゴン【チェンジソード】「SP1」）は CN2 としてナンバーコンビネーションが成立する（出典: atwiki/page-2457「※クロス1」・R-KW-CROSS-01）", () => {
    const s = enter(board({ battle: [inst("SX-009", "x")], rush: [inst("XG1-007", "cd")] }, { battle: [inst("SPEC-E1000", "e")] }), "XG1-007:cd");
    expect(canStrike(s, "XG1-007:cd")).toBe(true);
  });

  /** 自軍ラッシュフェイズ。SX-009 と XG5-037 ゴセイレッド（天装戦隊ゴセイジャー）がラッシュエリア、山札に XG7-003 ゴーカイレッド（海賊戦隊ゴーカイジャー）。 */
  const baton = () =>
    rushPhase(
      { rush: [inst("SX-009", "x"), inst("XG5-037", "gr")], power: powerCards(3), deck: [...deckCards(2), inst("XG7-003", "gk")] },
      { battle: [inst("SPEC-E1000", "e")] },
    );
  const batonAction = (s: GameState) => legal(s).find((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === "SX-009:x");

  it("SX-009: 【バトンタッチ】自軍ラッシュフェイズに起動できる（出典: atwiki/page-2457「自軍ラッシュフェイズごとに1度だけ、これ以外の自軍Sユニットを捨札にしてもよい」）", () => {
    expect(batonAction(baton())).toBeDefined();
  });

  it("SX-009: 【バトンタッチ】ゴセイジャーのユニット（XG5-037）を捨札にしてゴーカイジャーのユニット（XG7-003）をラッシュエリアに出すと、敵軍 S ユニットを1体選び撃破する（出典: atwiki/page-2457「作品名が「天装戦隊ゴセイジャー」、ラッシュしたユニットの作品名が「海賊戦隊ゴーカイジャー」だったなら、敵軍Sユニットを1体選び撃破する」）", () => {
    const a = batonAction(baton());
    expect(a).toBeDefined();
    let s = act(baton(), a!);
    s = resolveAll(s, ["XG5-037:gr", "XG7-003:gk", "SPEC-E1000:e"]);
    expect(zoneOf(s, "player1", "XG5-037:gr")).toBe("discard");
    expect(zoneOf(s, "player1", "XG7-003:gk")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
  });

  it.todo("SX-009: 【バトンタッチ】「捨札にしたユニットと作品名が異なる」— カタログに作品名のデータがなく、同じ作品のユニットを選べないことを確かめられない");
});

// ===========================================================================
describe("SX-010 仮面ライダーオーズ・タトバコンボ×仮面ライダーW・CJ", () => {
  const TEXT =
    "※クロス1 【MOVIE大戦】「SP1」 自軍捨札からクロスを持つカードを1枚選び、山札の下に戻すか、ゲームから除外してもよい。そうしたとき、山札の下に戻したなら、このターン、これはBP+4000される。ゲームから除外したなら、敵軍Sユニット1体か敵軍捨札1枚を選びゲームから除外する。";

  it("SX-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-2459）", () => {
    expectCatalogText("SX-010", TEXT);
    expectUnitStats("SX-010", { name: "仮面ライダーオーズ・タトバコンボ×仮面ライダーW・CJ", category: ["WB", "ET"], size: "S", bp: 4000, sp: "1/5", powerCost: "4+", comboNumber: 2, features: ["仮面ライダー", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("SX-010", ["SC"]);
  });

  it("SX-010: 追加条件 — WB・ET のコマンドを2つホールドしてラッシュできる（出典: atwiki/page-2459「追加で自軍コマンドを1つホールドする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("SX-010", "x")], power: powerCards(4), command: [...releasedCat("WB", 1), ...releasedCat("ET", 1)] }), "player1", "SX-010:x");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SX-010:x")).toBe("rush");
    expect(r.state.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  /** 2番目に出す（CN2）。自軍捨札にクロスを持つ SX-009 と持たない TST-UNIT-0、敵軍に S ユニットと捨札1枚。 */
  const movie = () => {
    let s = board(
      { rush: [inst("SX-010", "x"), ...fill(1)], discard: [inst("SX-009", "cr"), inst("TST-UNIT-0", "nc")], deck: deckCards(3) },
      { battle: [inst("SPEC-E1000", "e")], discard: [inst("TST-UNIT-0", "ed")] },
    );
    s = enterSeq(s, ["TST-UNIT-0:f0"]);
    return enter(s, "SX-010:x");
  };

  it("SX-010: 【MOVIE大戦】2番目に出たとき「SP1」になりストライクできる（出典: atwiki/page-2459「【MOVIE大戦】「SP1」」「CN：2」）", () => {
    let s = movie();
    if (s.pendingEffectChoice?.sourceCardId === "SX-010") s = skip(s);
    s = resolveAll(s);
    expect(canStrike(s, "SX-010:x")).toBe(true);
  });

  it("SX-010: 【MOVIE大戦】自軍捨札からクロスを持つカードだけを選べる（任意）（出典: atwiki/page-2459「自軍捨札からクロスを持つカードを1枚選び、…してもよい」）", () => {
    const s = movie();
    expectChoiceFrom(s, "player1", "SX-010");
    expect(choiceIds(s)).toEqual(["SX-009:cr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("SX-010: 【MOVIE大戦】選んだカードを山札の下に戻すと、このターン BP+4000（8000）（出典: atwiki/page-2459「山札の下に戻したなら、このターン、これはBP+4000される」）", () => {
    const s0 = movie();
    expectChoiceFrom(s0, "player1", "SX-010");
    const s1 = pick(s0, "SX-009:cr");
    const s = firstOptionWhere(s1, (t) => t.players.player1.deck.at(-1)?.instanceId === "SX-009:cr");
    expect(s).toBeDefined();
    expect(bpOf(s!, "player1", "SX-010:x")).toBe(8000);
  });

  it("SX-010: 【MOVIE大戦】選んだカードをゲームから除外すると、敵軍 S ユニット1体か敵軍捨札1枚を選びゲームから除外する（出典: atwiki/page-2459「ゲームから除外したなら、敵軍Sユニット1体か敵軍捨札1枚を選びゲームから除外する」）", () => {
    const s0 = movie();
    expectChoiceFrom(s0, "player1", "SX-010");
    const s1 = pick(s0, "SX-009:cr");
    const s = firstOptionWhere(s1, (t) => exiled(t, "player1").includes("SX-009:cr"), ["SPEC-E1000:e"]);
    expect(s).toBeDefined();
    expect(exiled(s!, "player2")).toEqual(["SPEC-E1000:e"]);
    expect(bpOf(s!, "player1", "SX-010:x")).toBe(4000);
  });
});
