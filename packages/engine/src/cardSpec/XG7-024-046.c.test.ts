/**
 * カード別スペック: XG7-040〜XG7-046（クロスギャザー ザ・ベストパートナー 仮面ライダー電王LF×モモタロス〜仮面ライダーオーズ・サゴーゾコンボ）
 *
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. 公式 FAQ・エラッタ・公式 Q&A — grnrngr の FAQ・08-errata.md には載っていない。XG7-041 は atwiki に公式 Q&A（Q1〜Q4）の転記がある。
 *  2. atwiki のカードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）の本文・Q&A。
 *  3. 一般ルール（docs/rules/*.md）、atwiki のカード評価・コメント。
 *
 * エンジンが出典と違う／効果が無いところは、出典どおりの期待値のまま it.fails（既知の不具合: CARD-XG7-NNN）にしている。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  act,
  actionsMentioning,
  attack,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceFromCard,
  choiceIds,
  crossTests,
  deckCards,
  endTurn,
  enter,
  enterHold,
  enemyTurnOf,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  extraHoldTests,
  inst,
  isHeld,
  leadTests,
  legal,
  morphCandidates,
  p1Battle,
  pick,
  played,
  powerCards,
  releasedCat,
  resolveAll,
  ridingPair,
  rushFromHand,
  rushOpen,
  rushPhaseOf,
  selfRush,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  tryAct,
  vehicleCard,
  zoneOf,
} from "./XG7-024-046.helpers";

const V = vehicleCard("SPEC-V", { features: ["メカ"] });
const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const E_WB = sUnit("SPEC-E-WB", { category: "WB", bp: 1000, sp: undefined });
const E_DA = sUnit("SPEC-E-DA", { category: "DA", bp: 1000, sp: undefined });
const E_MA = sUnit("SPEC-E-MA", { category: "MA", bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { category: "WB", bp: 3000, size: "M", sp: undefined });
const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "OT", bp: 1000 });
const C1 = sUnit("SPEC-C1", { category: "WB", bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const C9 = sUnit("SPEC-C9", { category: "WB", bp: 1000, powerCost: 9 });
const ET2 = sUnit("SPEC-ET2", { category: "ET", bp: 1000, powerCost: 2 });
const S2 = sUnit("SPEC-S2", { category: "MA", bp: 2000, powerCost: 2 });
const S2COND = sUnit("SPEC-S2COND", { category: "WB", bp: 2000, powerCost: "2+", rushAdditionalCondition: { conditionId: "hold_extra_command", text: "追加で自軍コマンドを1つホールドする", unitCount: 1 } } as never);
const M2 = sUnit("SPEC-M2", { category: "WB", bp: 3000, size: "M", powerCost: 2 });
const S3 = sUnit("SPEC-S3", { category: "WB", bp: 2000, powerCost: 3 });
const LOST = sUnit("SPEC-LOST", { category: "ET", bp: 2000, powerCost: 3, features: ["ロストドライバー"] });
const OOO = sUnit("SPEC-OOO", { category: "WB", bp: 2000, powerCost: 3, features: ["仮面ライダー", "男", "オーズドライバー"] });
const OOO_X = sUnit("SPEC-OOO-X", { category: "WB", bp: 2000, powerCost: 3, features: ["仮面ライダー", "男"] });
const EXTRA = [V, ENEMY, E_WB, E_DA, E_MA, E_M, ACCEL, PLAIN, C1, C3, C9, ET2, S2, S2COND, M2, S3, LOST, OOO, OOO_X];

const released = (id: string, suf: string): CardInstance => ({ ...inst(id, suf), commandHeld: false });

// ===========================================================================
describe("XG7-040 仮面ライダー電王LF×モモタロス", () => {
  const TEXT =
    "※クロス1 【ダブルアクション】これが自分の手札にある間、敵軍ユニットがバトルエリアに出たとき、自軍ユニットが1体もなければ、OTの自軍コマンドを2つホールドしてから、これを自軍バトルエリアに出してもよい。そうしたとき、敵軍バトルエリアのSユニットをすべて持ち主のパワーゾーンに送る。";

  it("XG7-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-2438）", () => {
    expectCatalogText("XG7-040", TEXT);
    expectUnitStats("XG7-040", { name: "仮面ライダー電王LF×モモタロス", category: "OT", size: "S", bp: 6000, sp: "1/4", powerCost: "6+", comboNumber: undefined, features: ["仮面ライダー", "男", "イマジン", "DEN-O"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-040", ["R"]);
  });

  crossTests("XG7-040", "atwiki/page-2438");
  extraHoldTests("XG7-040", ["OT"], "6+", "atwiki/page-2438");

  /** 敵軍ターン、敵軍ユニット（SPEC-ENEMY）がバトルエリアに出た直後。 */
  const entered = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(
      enemyTurnOf(
        { hand: [inst("XG7-040", "lf")], command: releasedCat("OT", 2, "ot"), ...p1 },
        { rush: [inst("SPEC-ENEMY", "e")], battle: [inst("SPEC-E-WB", "b"), inst("SPEC-E-M", "m")] },
        EXTRA,
      ),
      "SPEC-ENEMY:e",
      "player2",
    );
  const offered = (s: GameState) => choiceFromCard(s, "XG7-040") || actionsMentioning(s, "XG7-040:lf").length > 0;

  it("XG7-040: 【ダブルアクション】手札にある間、敵軍ユニットがバトルエリアに出たとき、自軍ユニットが1体もなければ、出すかを選べる（出典: atwiki/page-2438「自軍ユニットが1体もなければ、…これを自軍バトルエリアに出してもよい」）", () => {
    expect(offered(entered())).toBe(true);
  });

  it("XG7-040: 【ダブルアクション】自軍ユニットがいれば出せない（出典: atwiki/page-2438「自軍ユニットが1体もなければ」）", () => {
    expect(offered(entered({ rush: [inst("SPEC-PLAIN", "p")] }))).toBe(false);
  });

  it("XG7-040: 【ダブルアクション】OT の自軍コマンドが1つしかなければ出せない（出典: atwiki/page-2438「OTの自軍コマンドを2つホールドしてから」）", () => {
    expect(offered(entered({ command: releasedCat("OT", 1, "ot") }))).toBe(false);
  });

  it("XG7-040: 【ダブルアクション】敵軍ターン中なので、XG7-059 トリガー・ドーパントのコマンドは OT として数えない（OT 1つ＋トリガーでは出せない）（出典: atwiki/page-2438・atwiki/page-2379「自軍ターン中、OTが追加される」）", () => {
    expect(offered(entered({ command: [...releasedCat("OT", 1, "ot"), inst("XG7-059", "tg")] }))).toBe(false);
  });

  it("XG7-040: 【ダブルアクション】出したとき、OT のコマンド2つがホールドされ、敵軍バトルエリアの S ユニットをすべて持ち主のパワーゾーンに送る（M ユニットは残る）（出典: atwiki/page-2438「敵軍バトルエリアのSユニットをすべて持ち主のパワーゾーンに送る」）", () => {
    let s = entered();
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG7-040:lf"));
    if (a) s = act(s, a);
    s = resolveAll(s, ["XG7-040:lf", "confirm"]);
    expect(zoneOf(s, "player1", "XG7-040:lf")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld).length).toBe(2);
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E-WB:b")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("battle");
  });
});

// ===========================================================================
describe("XG7-041 仮面ライダーW・CJGX", () => {
  const TEXT =
    "※これが自軍エリアにある間、自分がターンを終えるとき、これをゲームから除外する。 【黄金の希望】これを手札からラッシュしたとき、自軍コマンドをすべて捨札にする。そうしたとき、捨札にしたコマンドと同じカテゴリを持つ敵軍Sユニットをすべて撃破する。その後、自軍捨札が敵軍捨札より多ければ、これはSP2になる。";

  it("XG7-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-2443）", () => {
    expectCatalogText("XG7-041", TEXT);
    expectUnitStats("XG7-041", { name: "仮面ライダーW・CJGX", category: "ET", size: "S", bp: 9000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["仮面ライダー", "ゴールド", "男", "ダブルドライバー"], rushCondition: "discard_feature_unit" });
    expectRarityIn("XG7-041", ["SR"]);
  });

  const gold = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushPhaseOf(
      { hand: [inst("XG7-041", "gx")], rush: [inst("XG2-043", "cj")], command: [...releasedCat("ET", 1, "et"), ...releasedCat("DA", 1, "da")], power: powerCards(6), ...p1 },
      { battle: [inst("SPEC-E-DA", "d")], rush: [inst("SPEC-E-MA", "a"), inst("SPEC-E-WB", "w")], ...p2 },
      EXTRA,
    );

  it("XG7-041: 追加条件 — 特徴「ダブルドライバー」を持つ自軍ユニット（XG2-043 仮面ライダーW・CJ）1体を捨札にしてラッシュする（出典: atwiki/page-2443「追加条件：特徴「ダブルドライバー」を持つ自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(gold(), "player1", "XG7-041:gx");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG7-041:gx")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-043:cj")).toBe("discard");
  });

  it("XG7-041: 追加条件 — 「ダブルドライバー」を持つ自軍ユニットがなければラッシュできない（出典: atwiki/page-2443）", () => {
    expect(canStartRush(gold({ rush: [inst("SPEC-PLAIN", "p")] }), "player1", "XG7-041:gx")).toBe(false);
  });

  it("XG7-041: 【黄金の希望】手札からラッシュしたとき、自軍コマンドをすべて捨札にし、そのカテゴリ（ET・DA）を持つ敵軍 S ユニットをエリアを問わずすべて撃破する（MA・WB のユニットは残る）（出典: atwiki/page-2443「自軍コマンドをすべて捨札にする。そうしたとき、捨札にしたコマンドと同じカテゴリを持つ敵軍Sユニットをすべて撃破する」）", () => {
    const s = resolveAll(rushFromHand(gold(), "player1", "XG7-041:gx").state);
    expect(s.players.player1.command).toHaveLength(0);
    expect(zoneOf(s, "player1", "TST-OP-ET:et0")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-DA:d")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-MA:a")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E-WB:w")).toBe("rush");
  });

  it("XG7-041: 【黄金の希望】その後、自軍捨札（コマンド2枚＋XG2-043 で3枚）が敵軍捨札（撃破した1枚）より多ければ SP2 になる（出典: atwiki/page-2443「自軍捨札が敵軍捨札より多ければ、これはSP2になる」）", () => {
    const s = resolveAll(rushFromHand(gold(), "player1", "XG7-041:gx").state);
    expect(spOf(s, "player1", "XG7-041:gx")).toBe(2);
  });

  it("XG7-041: 【黄金の希望】自軍捨札が敵軍捨札より多くなければ SP1 のまま（出典: atwiki/page-2443・Q1「捨札の枚数を参照するのは、その効果を発動して解決するときだけ」）", () => {
    const s = resolveAll(rushFromHand(gold({}, { discard: [inst("TST-OP", "x0"), inst("TST-OP", "x1"), inst("TST-OP", "x2")] }), "player1", "XG7-041:gx").state);
    expect(spOf(s, "player1", "XG7-041:gx")).toBe(1);
  });

  it("XG7-041: ※ 自軍エリアにある間、自分がターンを終えるとき、これをゲームから除外する（出典: atwiki/page-2443「自分がターンを終えるとき、これをゲームから除外する」）", () => {
    const s = endTurn(p1Battle({ battle: [inst("XG7-041", "gx")] }, {}, EXTRA));
    expect((s.players.player1.exile ?? []).map((c) => c.instanceId)).toContain("XG7-041:gx");
  });
});

// ===========================================================================
describe("XG7-042 仮面ライダークウガ×仮面ライダーディケイド", () => {
  const TEXT =
    "※クロス1 ※これは「仮面ライダーディケイド」または「仮面ライダークウガ」としてつかえる。 【ライダー大戦の世界】これが自軍エリアにある間、自分がターンを終えるとき、次の効果を発動できる⇒自軍山札の上から5枚をオモテにして、その中から1枚を選び手札に加える。その後、残りのカードとこのユニットを好きな順で山札の下に戻す。";

  it("XG7-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-2439）", () => {
    expectCatalogText("XG7-042", TEXT);
    expectUnitStats("XG7-042", { name: "仮面ライダークウガ×仮面ライダーディケイド", category: ["MA", "OT"], size: "S", bp: 4000, sp: undefined, powerCost: "1+", comboNumber: undefined, features: ["仮面ライダー", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-042", ["R"]);
  });

  crossTests("XG7-042", "atwiki/page-2439");
  extraHoldTests("XG7-042", ["MA", "OT"], "1+", "atwiki/page-2439");

  it.todo("XG7-042: ※「仮面ライダークウガ」としてつかえる — XG2-074 クウガゴウラム（追加条件: 自軍「仮面ライダークウガ」1体を手札に戻す）で確かめたいが、本物の XG2-073 仮面ライダークウガがいても XG2-074 をラッシュする合法手が出ず、名前の置き換えを確かめる組み合わせを作れない（出典: atwiki/page-2439「※これは「仮面ライダーディケイド」または「仮面ライダークウガ」としてつかえる」）");

  it.todo("XG7-042: ※「仮面ライダーディケイド」としてつかえる — XG1-076 ディケイドライバー（山札から「仮面ライダーディケイド」のカードを出す）で確かめたいが、本物の XG1-077 仮面ライダーディケイドでも山札から選ぶ選択が開かず（XG1-076 の効果が未接続）、組み合わせを作れない（出典: atwiki/page-2439・関連カード ディケイドライバー）");

  /** 自軍バトルフェイズを終えてターンを終える（山札6枚: k0〜k5）。 */
  const ending = () => endTurn(p1Battle({ battle: [inst("XG7-042", "kd")], deck: deckCards(6, "k") }, {}, EXTRA));

  /** 「次の効果を発動できる」の確認で発動する（rules/revealGate.ts）。 */
  const activate = (s: GameState) => act(s, { type: "confirm_effect_choice", playerId: "player1" });

  it("XG7-042: 【ライダー大戦の世界】自分がターンを終えるとき、発動するかを選べ、山札の上から5枚の中から1枚を選ぶ（出典: atwiki/page-2439「自軍山札の上から5枚をオモテにして、その中から1枚を選び手札に加える」）", () => {
    const s = ending();
    expectChoiceFrom(s, "player1", "XG7-042");
    expect(activate(s).pendingEffectChoice?.validInstanceIds).toEqual(["TST-OP:k0", "TST-OP:k1", "TST-OP:k2", "TST-OP:k3", "TST-OP:k4"]);
  });

  it("XG7-042: 【ライダー大戦の世界】発動を選ぶ前は山札の上5枚を選べず、発動する・しないだけを選ぶ（ユーザー報告 2026-10-28「効果の発動を選ぶ前に山札の上のカードを見ることができてしまう」）", () => {
    const s = ending();
    expect(s.pendingEffectChoice?.revealGate).toBe(true);
    expect(legal(s).map((a) => a.type).sort()).toEqual(["confirm_effect_choice", "skip_effect_choice"]);
    expect(tryAct(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:k2" }).ok).toBe(false);
    // 発動すると5枚から選び、もう見送れない
    const opened = activate(s);
    expect(opened.pendingEffectChoice?.revealGate).toBeUndefined();
    expect(legal(opened).some((a) => a.type === "skip_effect_choice")).toBe(false);
  });

  it("XG7-042: 【ライダー大戦の世界】発動しなければ山札もこのユニットもそのまま（出典: atwiki/page-2439「次の効果を発動できる」）", () => {
    const s = resolveAll(skip(ending()));
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-OP:k0", "TST-OP:k1", "TST-OP:k2", "TST-OP:k3", "TST-OP:k4", "TST-OP:k5"]);
    expect(zoneOf(s, "player1", "XG7-042:kd")).toBe("battle");
  });

  it("XG7-042: 【ライダー大戦の世界】選んだ1枚を手札に加え、残り4枚とこのユニットを山札の下に戻す（出典: atwiki/page-2439「残りのカードとこのユニットを好きな順で山札の下に戻す」）", () => {
    const s = resolveAll(activate(ending()), ["TST-OP:k2"]);
    expect(zoneOf(s, "player1", "TST-OP:k2")).toBe("hand");
    expect(zoneOf(s, "player1", "XG7-042:kd")).toBe("deck");
    const deck = s.players.player1.deck.map((c) => c.instanceId);
    expect(deck.slice(0, 1)).toEqual(["TST-OP:k5"]);
  });

  it("XG7-042: 【ライダー大戦の世界】残り4枚とこのユニットを山札の下に戻す順を1枚ずつ選べる（出典: atwiki/page-2439「残りのカードとこのユニットを好きな順で山札の下に戻す」）", () => {
    let s = activate(settle(endTurn(p1Battle({ battle: [inst("XG7-042", "kd")], deck: deckCards(6, "k") }, {}, EXTRA))));
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:k2" });
    expect(s.pendingEffectChoice?.effectId).toBe("deck_bottom_order");
    expect(s.pendingEffectChoice?.optional).toBe(false);
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual(["TST-OP:k0", "TST-OP:k1", "TST-OP:k3", "TST-OP:k4", "XG7-042:kd"]);
    // 選んだ順に番号が付き、残り1枚には最後の番号が付く。確定するまで山札の並びは変えない
    for (const id of ["TST-OP:k1", "TST-OP:k3"]) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual(["TST-OP:k1", "TST-OP:k3"]);
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("order_reset");
    // 番号の付いたカードをもう一度選ぶと番号が外れ、後ろの番号が詰まる
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:k1" });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual(["TST-OP:k3"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:k1" });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual(["TST-OP:k3", "TST-OP:k1"]);
    // 選び直すと番号がすべて外れる
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "order_reset" });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual([]);
    for (const id of ["XG7-042:kd", "TST-OP:k4", "TST-OP:k0", "TST-OP:k3"]) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual(["XG7-042:kd", "TST-OP:k4", "TST-OP:k0", "TST-OP:k3", "TST-OP:k1"]);
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["order_done", "XG7-042:kd", "TST-OP:k4", "TST-OP:k0", "TST-OP:k3", "TST-OP:k1", "order_reset"]);
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "order_done" }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-OP:k5", "XG7-042:kd", "TST-OP:k4", "TST-OP:k0", "TST-OP:k3", "TST-OP:k1"]);
    expect(s.players.player1.hand.map((c) => c.instanceId)).toContain("TST-OP:k2");
  });
});

// ===========================================================================
describe("XG7-043 仮面ライダーパンチホッパー×仮面ライダーキックホッパー", () => {
  const TEXT =
    "※クロス1 ※これはアタックされる以外では相手に選ばれない。 ※これ以外の自軍ユニットがあれば、これはBP-6000されストライクできない。 【地獄の兄弟】これが自軍パワーゾーンにある間、敵軍ターン中、特徴「加速」を持つ自軍ユニットが撃破されて捨札になったとき、これを自軍ラッシュエリアに出してもよい。";

  it("XG7-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-2451）", () => {
    expectCatalogText("XG7-043", TEXT);
    expectUnitStats("XG7-043", { name: "仮面ライダーパンチホッパー×仮面ライダーキックホッパー", category: "OT", size: "S", bp: 7000, sp: 1, powerCost: "4+", comboNumber: undefined, features: ["仮面ライダー", "男", "加速"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-043", ["SR"]);
  });

  crossTests("XG7-043", "atwiki/page-2451");
  extraHoldTests("XG7-043", ["OT"], "4+", "atwiki/page-2451");

  it("XG7-043: ※ アタックされる以外では相手に選ばれない — 相手の RS-155 ガオバイソン【鋼の角】で選べない（出典: atwiki/page-2451「※これはアタックされる以外では相手に選ばれない」）", () => {
    let s = p1Battle(
      { rush: [inst("RS-155", "bs")], command: releasedCat("WB", 1) },
      { battle: [inst("XG7-043", "h"), inst("SPEC-ENEMY", "o")], damage: 6, power: Array.from({ length: 6 }, (_, i) => ({ ...inst("TST-P", `ed${i}`), faceDown: true })) },
      EXTRA,
    );
    s = enterHold(s, "RS-155:bs");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-ENEMY:o");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("XG7-043:h");
  });

  it("XG7-043: ※ アタックの相手には選べる（出典: atwiki/page-2451「アタックされる以外では」）", () => {
    const s = p1Battle({ battle: [inst("TST-UNIT-7", "a")] }, { battle: [inst("XG7-043", "h")] }, EXTRA);
    expect(targetsOf(s, "TST-UNIT-7:a")).toContain("XG7-043:h");
  });

  it("XG7-043: ※ これ以外の自軍ユニットがあれば BP-6000（1000）され、ストライクできない（出典: atwiki/page-2451「これ以外の自軍ユニットがあれば、これはBP-6000されストライクできない」）", () => {
    const s = p1Battle({ battle: [inst("XG7-043", "h")], rush: [inst("SPEC-PLAIN", "p")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG7-043:h")).toBe(1000);
    expect(canStrike(s, "XG7-043:h")).toBe(false);
  });

  it("XG7-043: ※ 自軍ユニットがこれだけなら BP7000 でストライクできる（出典: atwiki/page-2451）", () => {
    const s = p1Battle({ battle: [inst("XG7-043", "h")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG7-043:h")).toBe(7000);
    expect(canStrike(s, "XG7-043:h")).toBe(true);
  });

  /** 敵軍ターン、自軍の加速ユニット（SPEC-ACCEL）が TST-UNIT-7 にアタックされて撃破される。 */
  const hell = (victim = "SPEC-ACCEL") => {
    const s = enemyTurnOf({ battle: [inst(victim, "v")], power: [inst("XG7-043", "pw"), ...powerCards(2)] }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA);
    return settle(attack(s, "TST-UNIT-7:atk", `${victim}:v`, "player2"), 2);
  };

  it("XG7-043: 【地獄の兄弟】自軍パワーゾーンにある間、敵軍ターン中、加速を持つ自軍ユニットが撃破されて捨札になったとき、これを自軍ラッシュエリアに出せる（出典: atwiki/page-2451「これを自軍ラッシュエリアに出してもよい」）", () => {
    let s = hell();
    expect(zoneOf(s, "player1", "SPEC-ACCEL:v")).toBe("discard");
    expect(choiceFromCard(s, "XG7-043") || actionsMentioning(s, "XG7-043:pw").length > 0).toBe(true);
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG7-043:pw"));
    if (a) s = act(s, a);
    s = resolveAll(s, ["XG7-043:pw", "confirm"]);
    expect(zoneOf(s, "player1", "XG7-043:pw")).toBe("rush");
  });

  it("XG7-043: 【地獄の兄弟】撃破されたのが加速を持たないユニットなら出せない（出典: atwiki/page-2451「特徴「加速」を持つ自軍ユニット」）", () => {
    const s = hell("SPEC-PLAIN");
    expect(choiceFromCard(s, "XG7-043") || actionsMentioning(s, "XG7-043:pw").length > 0).toBe(false);
  });
});

// ===========================================================================
describe("XG7-044 仮面ライダーアクセル×仮面ライダーW・CJ", () => {
  const TEXT =
    "※クロス1 ※リードET 【風都の護り手】これがリリース状態で自軍コマンドゾーンにある間、相手の手札以外から敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットを持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG7-044: カタログ本文・スペックが出典と一致（出典: atwiki/page-2440）", () => {
    expectCatalogText("XG7-044", TEXT);
    expectUnitStats("XG7-044", { name: "仮面ライダーアクセル×仮面ライダーW・CJ", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: "2+", comboNumber: undefined, features: ["仮面ライダー", "男", "警察"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-044", ["R"]);
  });

  crossTests("XG7-044", "atwiki/page-2440");
  extraHoldTests("XG7-044", ["ET"], "2+", "atwiki/page-2440");
  leadTests("XG7-044", "ET", "atwiki/page-2440");

  /** 敵軍ラッシュフェイズ。敵軍は RK-320 仮面ライダーライジングイクサを自身の※でコマンドゾーンからラッシュする（手札以外からのラッシュ）。 */
  const ixa = (p1Command: CardInstance[] = [released("XG7-044", "ac")], extraCmd: CardInstance[] = []) => {
    const s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { command: p1Command, deck: deckCards(5) },
        player2: { command: [inst("RK-320", "ri"), released("SPEC-C1", "k1"), released("SPEC-C9", "k9"), released("SPEC-C3", "k3"), ...extraCmd], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return selfRush(s, "command", "RK-320:ri", "player2");
  };
  const offered = (s: GameState) => choiceFromCard(s, "XG7-044") || actionsMentioning(s, "XG7-044:ac").length > 0;
  const accept = (s0: GameState) => {
    let s = s0;
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG7-044:ac"));
    if (a) s = act(s, a);
    return resolveAll(s, ["XG7-044:ac", "confirm"]);
  };

  it("XG7-044: 【風都の護り手】リリース状態で自軍コマンドゾーンにある間、相手の手札以外から敵軍 S ユニットがラッシュされたとき、これを自軍ラッシュエリアに出せる（出典: atwiki/page-2440「相手の手札以外から敵軍Sユニットがラッシュされたとき、これを自軍ラッシュエリアに出してもよい」・カード評価「自軍ターン・敵軍ターンを問わず発動可能」）", () => {
    const s = ixa();
    expect(zoneOf(s, "player2", "RK-320:ri")).toBe("rush");
    expect(offered(s)).toBe(true);
  });

  it("XG7-044: 【風都の護り手】ホールド状態でコマンドゾーンにあるときは出せない（出典: atwiki/page-2440「これがリリース状態で」）", () => {
    expect(offered(ixa([{ ...inst("XG7-044", "ac"), commandHeld: true }]))).toBe(false);
  });

  it("XG7-044: 【風都の護り手】出したとき、ラッシュされた敵軍ユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-2440「ラッシュされた敵軍ユニットを持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = accept(ixa());
    expect(zoneOf(s, "player1", "XG7-044:ac")).toBe("rush");
    expect(zoneOf(s, "player2", "RK-320:ri")).toBe("command");
    expect(cardIn(s, "player2", "RK-320:ri")?.commandHeld).toBe(true);
  });

  it("XG7-044: 【風都の護り手】持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-2440「置けなければ捨札にする」・rules/02-zones-cards コマンドゾーン5枚まで）", () => {
    const s = accept(ixa(undefined, [released("SPEC-C1", "k1b"), released("SPEC-C1", "k1c")]));
    expect(zoneOf(s, "player2", "RK-320:ri")).toBe("discard");
  });

  it("XG7-044: 【風都の護り手】手札からラッシュされたときは出せない（出典: atwiki/page-2440「相手の手札以外から」）", () => {
    const s = rushOpen(
      st({ phase: "rush", activePlayer: "player2", player1: { command: [released("XG7-044", "ac")], deck: deckCards(5) }, player2: { hand: [inst("SPEC-ENEMY", "h")], command: releasedCat("WB", 1, "ew"), deck: deckCards(5, "e") } }, EXTRA),
      "player2",
      "SPEC-ENEMY:h",
    );
    expect(offered(s)).toBe(false);
  });
});

// ===========================================================================
describe("XG7-045 ロストドライバー", () => {
  const TEXT =
    "※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、これをホールドして、自分の手札から特徴「ロストドライバー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。 ◎自軍山札を見て、これを使用するためにホールドしたコマンドと同じ必要パワーを持つSユニットのカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";

  it("XG7-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-2399）", () => {
    expectCatalogText("XG7-045", TEXT);
    const d = DEFS["XG7-045"]!;
    expect(d.name).toBe("ロストドライバー");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("ET");
    expect(d.powerCost).toBe(0);
    expectRarityIn("XG7-045", ["N"]);
  });

  /** 必要パワー2の ET のユニットカード（SPEC-ET2）をコマンドにしてロストドライバーを使う。 */
  const search = () => {
    const s0 = rushPhaseOf({ hand: [inst("XG7-045", "ld")], command: [released("SPEC-ET2", "c2")], power: [], deck: [inst("SPEC-S3", "d3"), inst("SPEC-M2", "dm"), inst("SPEC-S2", "d2"), inst("SPEC-S2COND", "d2c"), ...deckCards(2)] }, {}, EXTRA);
    return played(s0, "XG7-045:ld");
  };

  it("XG7-045: ◎ 使うためにホールドしたコマンド（必要パワー2）と同じ必要パワーの S ユニットのカードを山札から選べる（カテゴリ・追加条件は問わず、M と必要パワー3は選べない）（出典: atwiki/page-2399「これを使用するためにホールドしたコマンドと同じ必要パワーを持つSユニットのカードを1枚選び」・カード評価「追加条件やカテゴリさえも関係なくサーチできる」）", () => {
    const s = search();
    expectChoiceFrom(s, "player1", "XG7-045");
    expect(choiceIds(s)).toEqual(["SPEC-S2:d2", "SPEC-S2COND:d2c"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-045: ◎ 選んだカードを手札に加える（出典: atwiki/page-2399「相手に見せてから手札に加えてもよい」）", () => {
    const s = resolveAll(search(), ["SPEC-S2:d2"]);
    expect(zoneOf(s, "player1", "SPEC-S2:d2")).toBe("hand");
  });

  const lostBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhaseOf({ command: [released("XG7-045", "ld")], hand: [inst("SPEC-LOST", "l")], power: powerCards(3), ...p1 }, {}, EXTRA);

  it("XG7-045: ※ 自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、これをホールドして手札の「ロストドライバー」のユニットカードをラッシュエリアに出せる（出典: atwiki/page-2399「これをホールドして、自分の手札から特徴「ロストドライバー」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    let s = lostBoard();
    const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG7-045:ld") && x.type !== "end_phase");
    expect(a).toBeDefined();
    s = resolveAll(act(s, a!), ["SPEC-LOST:l"]);
    expect(zoneOf(s, "player1", "SPEC-LOST:l")).toBe("rush");
    expect(cardIn(s, "player1", "XG7-045:ld")?.commandHeld).toBe(true);
  });

  it("XG7-045: ※ 必要パワーを満たしていなければ出せない（自軍パワー2で必要パワー3）（出典: atwiki/page-2399「ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = lostBoard({ power: powerCards(2) });
    expect(legal(s).some((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG7-045:ld") && JSON.stringify(x).includes("SPEC-LOST"))).toBe(false);
  });
});

// ===========================================================================
describe("XG7-046 仮面ライダーオーズ・サゴーゾコンボ", () => {
  const TEXT = "※モーフ ※レジスト 【ゴリバゴーン】自軍ターン中、これをラッシュしたとき、ライドしている敵軍Sユニットを1体選び、撃破してもよい。";

  it("XG7-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-2441）", () => {
    expectCatalogText("XG7-046", TEXT);
    expectUnitStats("XG7-046", { name: "仮面ライダーオーズ・サゴーゾコンボ", category: "WB", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-046", ["R"]);
  });

  it("XG7-046: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカードと置き換えられる（特徴が違うものは選べない）（出典: atwiki/page-2441「※モーフ」・rules/07-keywords R-KW-MORPH-01）", () => {
    const s = rushOpen(
      st({ phase: "rush", activePlayer: "player2", player1: { battle: [inst("XG7-046", "oz")], command: [released("SPEC-OOO", "o"), released("SPEC-OOO-X", "x")], deck: deckCards(5) }, player2: { hand: [inst("SPEC-ENEMY", "h")], command: releasedCat("WB", 1, "ew"), deck: deckCards(5, "e") } }, EXTRA),
      "player2",
      "SPEC-ENEMY:h",
    );
    expect(morphCandidates(s)).toEqual(["SPEC-OOO:o"]);
  });

  it("XG7-046: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2441「※レジスト」）", () => {
    let s = attack(enemyTurnOf({ battle: [inst("XG7-046", "oz")] }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA), "TST-UNIT-7:atk", "XG7-046:oz", "player2");
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) s = settle(s, 1);
    expect(legal(s).some((a) => a.type === "use_register" && a.playerId === "player1")).toBe(true);
  });

  const gori = () =>
    rushFromHand(
      rushPhaseOf({ hand: [inst("XG7-046", "oz")], command: releasedCat("WB", 1), power: powerCards(4) }, { battle: [...ridingPair("RK-023", "r", "SPEC-V", "v"), inst("SPEC-ENEMY", "e")] }, EXTRA),
      "player1",
      "XG7-046:oz",
    ).state;

  it("XG7-046: 【ゴリバゴーン】自軍ターン中、ラッシュしたとき、ライドしている敵軍 S ユニットから1体選べる（任意。ライドしていない SPEC-ENEMY は選べない）（出典: atwiki/page-2441「ライドしている敵軍Sユニットを1体選び、撃破してもよい」）", () => {
    const s = gori();
    expectChoiceFrom(s, "player1", "XG7-046");
    expect(choiceIds(s)).toEqual(["RK-023:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-046: 【ゴリバゴーン】選んだユニットを撃破する（出典: atwiki/page-2441）", () => {
    const s = resolveAll(gori(), ["RK-023:r"]);
    expect(zoneOf(s, "player2", "RK-023:r")).toBe("discard");
  });
});

void isHeld;
void pick;
void skip;
