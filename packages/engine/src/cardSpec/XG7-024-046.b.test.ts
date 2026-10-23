/**
 * カード別スペック: XG7-032〜XG7-039（クロスギャザー ザ・ベストパートナー 仮面ライダー新2号×仮面ライダー新1号〜GOD SPEED LOVE）
 *
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. 公式 FAQ・エラッタ・公式 Q&A — 本範囲のカードは grnrngr の FAQ・08-errata.md に載っていない。
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
  activateResident,
  attack,
  bpOf,
  breakerTests,
  canActivate,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  crossTests,
  damageOf,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  extraHoldTests,
  faceUpResident,
  inst,
  isHeld,
  lastBattleBps,
  legal,
  ncBoard,
  p1Battle,
  passEntry,
  pick,
  played,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rushVia,
  rushPhaseOf,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  vehicleCard,
  zoneOf,
} from "./XG7-024-046.helpers";

const V = vehicleCard("SPEC-V", { features: ["メカ"] });
const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const E3000 = sUnit("SPEC-E3000", { category: "WB", bp: 3000, sp: undefined });
const E_DA = sUnit("SPEC-E-DA", { category: "DA", bp: 4000, sp: undefined });
const E_SP = sUnit("SPEC-E-SP", { category: "WB", bp: 4000, sp: "1/5" } as never);
const E_NOSP = sUnit("SPEC-E-NOSP", { category: "WB", bp: 4000, sp: undefined });
const E1500 = sUnit("SPEC-E1500", { category: "WB", bp: 1500, sp: undefined });
const E1000 = sUnit("SPEC-E1000", { category: "WB", bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { category: "WB", bp: 3000, size: "M", sp: undefined });
const WB_C = sUnit("SPEC-WB-C", { category: "WB", bp: 1000 });
const WB_C2 = sUnit("SPEC-WB-C2", { category: "WB", bp: 1000 });
const MA_C = sUnit("SPEC-MA-C", { category: "MA", bp: 1000 });
const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const EXTRA = [V, ENEMY, E3000, E_DA, E_SP, E_NOSP, E1500, E1000, E_M, WB_C, WB_C2, MA_C, ACCEL];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG7-032 仮面ライダー新2号×仮面ライダー新1号", () => {
  const TEXT =
    "※クロス1 ※ブレイカー ※これは「仮面ライダー1号」または「仮面ライダー2号」としてつかえる。 【ライダーダブルキック】SP1 このターン、これはBP+2000される。また、これがアタックするとき、バトル相手のユニットのBPをカードに表記された本来の値としてバトルし、自分が次の行動を宣言するまで、すべての敵軍ユニットはホールドすることができない。";

  it("XG7-032: カタログ本文・スペックが出典と一致（出典: atwiki/page-2388）", () => {
    expectCatalogText("XG7-032", TEXT);
    expectUnitStats("XG7-032", { name: "仮面ライダー新2号×仮面ライダー新1号", category: "ET", size: "S", bp: 6000, sp: "1/5", powerCost: "5+", comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-032", ["SR"]);
  });

  crossTests("XG7-032", "atwiki/page-2388");
  extraHoldTests("XG7-032", ["ET"], "5+", "atwiki/page-2388");
  breakerTests("XG7-032", "atwiki/page-2388", EXTRA);

  /** 自軍バトルフェイズ、XG7-032 をビークルにライドさせて出し、ライドオフ（RC）する。 */
  const rc = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(settle(rcRideOff(p1Battle({ rush: [inst("XG7-032", "x"), inst("SPEC-V", "v")] }, p2, EXTRA), "XG7-032:x", "SPEC-V:v")));

  it("XG7-032: 【ライダーダブルキック】RC（ライドオフ）— このターン SP1 になり、BP+2000（8000）（出典: atwiki/page-2388「【ライダーダブルキック】SP1 このターン、これはBP+2000される」・rules/07-keywords R-KW-RC-01）", () => {
    const s = rc();
    expect(spOf(s, "player1", "XG7-032:x")).toBe(1);
    expect(bpOf(s, "player1", "XG7-032:x")).toBe(8000);
  });

  it("XG7-032: 【ライダーダブルキック】ライドせずに出たときは発動しない（BP6000 のまま）（出典: rules/07-keywords R-KW-RC-01「RC は…ライドオフしたときに発動」）", () => {
    const s = resolveAll(enter(p1Battle({ rush: [inst("XG7-032", "x")] }, {}, EXTRA), "XG7-032:x"));
    expect(bpOf(s, "player1", "XG7-032:x")).toBe(6000);
  });

  it("XG7-032: 【ライダーダブルキック】アタックするとき、バトル相手の BP は本来の値（BP3000 に +6000 されている敵軍ユニットとも 3000 でバトルする）（出典: atwiki/page-2388「バトル相手のユニットのBPをカードに表記された本来の値としてバトルし」）", () => {
    const s = settle(attack(rc({ battle: [{ ...inst("SPEC-E3000", "e"), bpModifier: 6000 }] }), "XG7-032:x", "SPEC-E3000:e"));
    expect(lastBattleBps(s)?.defender).toBe(3000);
    expect(zoneOf(s, "player2", "SPEC-E3000:e")).toBe("discard");
  });

  it("XG7-032: 【ライダーダブルキック】アタックしたバトルでは、敵軍ユニットはホールドできない（レジストの XG7-026 は撃破されてもレジストを使えない）（出典: atwiki/page-2388「すべての敵軍ユニットはホールドすることができない」・カード評価「レジストやリードからのカウンターを防ぐ」）", () => {
    const s = attack(rc({ battle: [inst("XG7-026", "e")] }), "XG7-032:x", "XG7-026:e");
    expect(registerOffered(settleUntilRegister(s), "player2")).toBe(false);
  });

  /** バトルの反応ウィンドウだけをパスし、レジストの提示で止める。 */
  function settleUntilRegister(s0: GameState): GameState {
    let s = s0;
    for (let i = 0; i < 10; i++) {
      if (legal(s).some((a) => a.type === "use_register")) return s;
      const p = legal(s).find((a) => a.type === "pass_battle_reaction");
      if (!p) return s;
      s = settle(s, 1);
    }
    return s;
  }

  it.todo("XG7-032: ※「仮面ライダー1号」または「仮面ライダー2号」としてつかえる — XG1-044 仮面ライダーV3（自軍捨札に「1号」のカードと「2号」のカードがあればコマンドゾーンから出せる）で確かめたいが、本物の RK-023 仮面ライダー1号＋RK-073 仮面ライダー2号でも XG1-044 を出す合法手が出ず（XG1-044 の効果が未接続）、名前の置き換えを確かめる組み合わせを作れない（出典: atwiki/page-2388・カード評価「これ1枚で2枚分として扱うことはできない」）");
});

// ===========================================================================
describe("XG7-033 仮面ライダーV3×ライダーマン", () => {
  const TEXT =
    "※クロス1 ※レジスト 【復讐の果てに得たもの】これが自軍バトルエリアからラッシュエリアに戻ったとき、これをホールドしてもよい。そうしたとき、敵軍ラッシュエリアからユニットを1体選び、可能ならバトルエリアに出す。";

  it("XG7-033: カタログ本文・スペックが出典と一致（出典: atwiki/page-2427）", () => {
    expectCatalogText("XG7-033", TEXT);
    expectUnitStats("XG7-033", { name: "仮面ライダーV3×ライダーマン", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: "3+", comboNumber: undefined, features: ["仮面ライダー", "男", "改造人間"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-033", ["R"]);
  });

  crossTests("XG7-033", "atwiki/page-2427");
  extraHoldTests("XG7-033", ["ET"], "3+", "atwiki/page-2427");

  it("XG7-033: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-2427「※レジスト」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG7-033", "v")], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") } }, EXTRA);
    let t = attack(s, "TST-UNIT-7:atk", "XG7-033:v", "player2");
    for (let i = 0; i < 10 && !registerOffered(t); i++) {
      const p = legal(t).find((a) => a.type === "pass_battle_reaction");
      if (!p) break;
      t = settle(t, 1);
    }
    expect(registerOffered(t)).toBe(true);
  });

  /** 敵軍ターンを終え、自軍スタートフェイズでバトルエリアのユニットをラッシュエリアに戻す。 */
  const returned = (p2Rush: CardInstance[] = [inst("SPEC-ENEMY", "r1"), inst("SPEC-E-M", "rm")]) => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("XG7-033", "v")], deck: deckCards(5) }, player2: { rush: p2Rush, deck: deckCards(5, "e") } }, EXTRA);
    s = endTurn(s);
    const back = legal(s).find((a) => a.type === "return_all_battle_to_rush" && a.playerId === "player1");
    return back ? act(s, back) : s;
  };

  it("XG7-033: 【復讐の果てに得たもの】自軍バトルエリアからラッシュエリアに戻ったとき、これをホールドするかを選べる（任意）（出典: atwiki/page-2427「これをホールドしてもよい」）", () => {
    const s = returned();
    expect(zoneOf(s, "player1", "XG7-033:v")).toBe("rush");
    expectChoiceFrom(s, "player1", "XG7-033");
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-033: 【復讐の果てに得たもの】ホールドしたとき、敵軍ラッシュエリアのユニット（サイズを問わない）を1体選び、バトルエリアに出す（出典: atwiki/page-2427「敵軍ラッシュエリアからユニットを1体選び、可能ならバトルエリアに出す」）", () => {
    const s = resolveAll(returned(), ["XG7-033:v", "SPEC-E-M:rm"]);
    expect(isHeld(s, "player1", "XG7-033:v")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E-M:rm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ENEMY:r1")).toBe("rush");
  });
});

// ===========================================================================
describe("XG7-034 仮面ライダーストロンガー×電波人間タックル", () => {
  const TEXT = "※クロス1 ※これはビークルにライドできる。 【天が呼ぶ、地が呼ぶ、人が呼ぶ】これは、DAを持つかSPが空欄ではないユニットにアタックするとき、BP+2000される。";

  it("XG7-034: カタログ本文・スペックが出典と一致（出典: atwiki/page-2384。atwiki のレアリティ欄が空欄のためレアリティは照合しない）", () => {
    expectCatalogText("XG7-034", TEXT);
    expectUnitStats("XG7-034", { name: "仮面ライダーストロンガー×電波人間タックル", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: "2+", comboNumber: undefined, features: ["仮面ライダー", "男", "女", "改造人間"], rushCondition: "hold_extra_command" });
  });

  crossTests("XG7-034", "atwiki/page-2384");
  extraHoldTests("XG7-034", ["ET"], "2+", "atwiki/page-2384");

  it("XG7-034: ※ビークルにライドできる（出典: atwiki/page-2384「※これはビークルにライドできる」）", () => {
    expect(canMount(p1Battle({ rush: [inst("XG7-034", "s"), inst("SPEC-V", "v")] }, {}, EXTRA), "XG7-034:s", "SPEC-V:v")).toBe(true);
  });

  const hit = (target: string) => settle(attack(enter(p1Battle({ rush: [inst("XG7-034", "s")] }, { battle: [inst(target, "e")] }, EXTRA), "XG7-034:s"), "XG7-034:s", `${target}:e`));

  it("XG7-034: 【天が呼ぶ…】DA を持つユニットにアタックするとき BP+2000（5000）（出典: atwiki/page-2384「DAを持つ…ユニットにアタックするとき、BP+2000される」）", () => {
    expect(lastBattleBps(hit("SPEC-E-DA"))?.attacker).toBe(5000);
  });

  it("XG7-034: 【天が呼ぶ…】SP が空欄ではない（SP1/5）ユニットにアタックするとき BP+2000（5000）（出典: atwiki/page-2384「SPが空欄ではないユニット」）", () => {
    expect(lastBattleBps(hit("SPEC-E-SP"))?.attacker).toBe(5000);
  });

  it("XG7-034: 【天が呼ぶ…】DA を持たず SP が空欄のユニットにアタックするときは BP3000 のまま（出典: atwiki/page-2384）", () => {
    expect(lastBattleBps(hit("SPEC-E-NOSP"))?.attacker).toBe(3000);
  });
});

// ===========================================================================
describe("XG7-035 ヨロイ騎士", () => {
  const TEXT = "【結束するデルザー改造魔人】自軍捨札を1枚選び、ゲームから除外してもよい。そうしたとき、このターン、これはクロス1を得る。その後、クロス1を持つ敵軍Sユニットを1体選び撃破する。";

  it("XG7-035: カタログ本文・スペックが出典と一致（出典: atwiki/page-2421）", () => {
    expectCatalogText("XG7-035", TEXT);
    expectUnitStats("XG7-035", { name: "ヨロイ騎士", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 2, features: ["デルザー軍団", "メカ", "男", "改造人間"] });
    expectRarityIn("XG7-035", ["N"]);
  });

  const yoroi = () => nc("XG7-035:y", 1, { discard: [inst("TST-OP", "d0")] }, { battle: [inst("XG7-026", "x"), inst("SPEC-ENEMY", "e")], rush: [inst("XG7-033", "xr")] });

  it("XG7-035: 【結束するデルザー改造魔人】NC（2番目）— 自軍捨札から1枚選んで除外するかを選べる（任意）（出典: atwiki/page-2421「自軍捨札を1枚選び、ゲームから除外してもよい」）", () => {
    const s = yoroi();
    expectChoiceFrom(s, "player1", "XG7-035");
    expect(choiceIds(s)).toEqual(["TST-OP:d0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-035: 【結束するデルザー改造魔人】除外したとき、クロス1 を持つ敵軍 S ユニット（エリアを問わない）を1体選び撃破する（クロス1 を持たない SPEC-ENEMY は選べない）（出典: atwiki/page-2421「その後、クロス1を持つ敵軍Sユニットを1体選び撃破する」）", () => {
    let s = pick(yoroi(), "TST-OP:d0");
    expect((s.players.player1.exile ?? []).map((c) => c.instanceId)).toContain("TST-OP:d0");
    expectChoiceFrom(s, "player1", "XG7-035");
    expect(choiceIds(s)).toEqual(["XG7-026:x", "XG7-033:xr"]);
    s = resolveAll(pick(s, "XG7-033:xr"));
    expect(zoneOf(s, "player2", "XG7-033:xr")).toBe("discard");
  });

  it("XG7-035: 【結束するデルザー改造魔人】除外しなければ撃破もしない（出典: atwiki/page-2421「そうしたとき、…その後、…撃破する」）", () => {
    const s = resolveAll(skip(yoroi()));
    expect(zoneOf(s, "player2", "XG7-026:x")).toBe("battle");
    expect(zoneOf(s, "player2", "XG7-033:xr")).toBe("rush");
  });

  it("XG7-035: 【結束するデルザー改造魔人】除外したとき、このターン、これはクロス1 を得る — 続けて右に出た SP1/4 のユニット（3番目）が SP1 になる（分母が1少なくなる）（出典: atwiki/page-2421「このターン、これはクロス1を得る」・atwiki/page-2393 規定文）", () => {
    const FRAC = sUnit("SPEC-XFRAC4", { sp: "1/4", bp: 1000 } as never);
    let s = resolveAll(pick(ncBoard("XG7-035:y", 1, { discard: [inst("TST-OP", "d0")], rush: [inst("SPEC-XFRAC4", "f")] }, {}, [...EXTRA, FRAC]), "TST-OP:d0"));
    s = resolveAll(enter(passEntry(s), "SPEC-XFRAC4:f"));
    expect(spOf(s, "player1", "SPEC-XFRAC4:f")).toBe(1);
  });
});

// ===========================================================================
describe("XG7-036 仮面ライダーナイト×仮面ライダー龍騎", () => {
  const TEXT =
    "※これは「仮面ライダー龍騎」または「仮面ライダーナイト」としてつかえる。 【戦わなければ生き残れない】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、SP1/2、コールWB、リードWB、クロス1のどれか1つを宣言してもよい。そうしたとき、このターン、これは宣言した能力を得る。";

  it("XG7-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-2436「SP：！」）", () => {
    expectCatalogText("XG7-036", TEXT);
    expectUnitStats("XG7-036", { name: "仮面ライダーナイト×仮面ライダー龍騎", category: "WB", size: "S", bp: 4000, sp: "special", powerCost: "4+", comboNumber: undefined, features: ["仮面ライダー", "男", "ミラーライダー"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-036", ["R"]);
  });

  extraHoldTests("XG7-036", ["WB"], "4+", "atwiki/page-2436");

  it("XG7-036: ※「仮面ライダー龍騎」としてつかえる — XG2-080 リュウキドラグレッダーの追加条件（自軍「仮面ライダー龍騎」1体を手札に戻す）に使える（出典: atwiki/page-2436「※これは「仮面ライダー龍騎」…としてつかえる」・関連カード リュウキドラグレッダー）", () => {
    const s = rushPhaseOf({ hand: [inst("XG2-080", "dr")], rush: [inst("XG7-036", "n")], command: releasedCat("WB", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushVia(s, "player1", "XG2-080:dr", (a) => JSON.stringify(a).includes("XG7-036:n"));
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "XG2-080:dr")).toBe("rush");
    expect(zoneOf(t, "player1", "XG7-036:n")).toBe("hand");
  });

  it("XG7-036: ※「仮面ライダーナイト」としてつかえる — RK-279 仮面ライダーナイトサバイブのゾードダウン（自軍「仮面ライダーナイト」を捨札にすれば必要パワー0）に使える（出典: atwiki/page-2436・関連カード 仮面ライダーナイトサバイブ）", () => {
    const s = rushPhaseOf({ hand: [inst("RK-279", "ns")], rush: [inst("XG7-036", "n")], command: releasedCat("WB", 1), power: [] }, {}, EXTRA);
    const r = rushVia(s, "player1", "RK-279:ns", (a) => a.zordMaterialInstanceId === "XG7-036:n");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RK-279:ns")).toBe("rush");
    expect(zoneOf(t, "player1", "XG7-036:n")).toBe("discard");
  });

  it("XG7-036: 【戦わなければ生き残れない】自軍ラッシュフェイズに、能力の宣言を起動できる（出典: atwiki/page-2436「自軍ラッシュフェイズごとに1度だけ、…どれか1つを宣言してもよい」）", () => {
    expect(canActivate(rushPhaseOf({ rush: [inst("XG7-036", "n")] }, {}, EXTRA), "XG7-036:n")).toBe(true);
  });

  it("XG7-036: 【戦わなければ生き残れない】自軍バトルフェイズには宣言できない（出典: atwiki/page-2436「自軍ラッシュフェイズごとに」）", () => {
    expect(canActivate(p1Battle({ battle: [inst("XG7-036", "n")] }, {}, EXTRA), "XG7-036:n")).toBe(false);
  });

  it("XG7-036: 【戦わなければ生き残れない】宣言は自軍ラッシュフェイズごとに1度だけ — 宣言したあとは同じラッシュフェイズにもう起動できない（出典: atwiki/page-2436「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = rushPhaseOf({ rush: [inst("XG7-036", "n")] }, {}, EXTRA);
    const opened = act(s, { type: "activate_field_unit_ability", playerId: "player1", unitInstanceId: "XG7-036:n" });
    const declared = act(opened, { type: "resolve_effect_choice", playerId: "player1", instanceId: "cross1" });
    expect(declared.pendingEffectChoice).toBeFalsy();
    expect(canActivate(declared, "XG7-036:n")).toBe(false);
  });
});

// ===========================================================================
describe("XG7-037 仮面ライダーカイザ×仮面ライダーファイズ", () => {
  const TEXT =
    "※クロス1 ※これがアタックして、BPの下三桁が500の敵軍Sユニットを撃破したとき、相手に1点ダメージを与える。 【紅と金】自軍ターン中、これがバトルエリアに出たとき、次の効果を2回まで発動できる⇒自分の手札を1枚選び、自軍コマンドゾーンにホールド状態で置く。そうしたとき、敵軍ユニットを1体選び、このターン、BP-1500する。";

  it("XG7-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-2428）", () => {
    expectCatalogText("XG7-037", TEXT);
    expectUnitStats("XG7-037", { name: "仮面ライダーカイザ×仮面ライダーファイズ", category: "ET", size: "S", bp: 5000, sp: undefined, powerCost: "3+", comboNumber: undefined, features: ["仮面ライダー", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-037", ["SR"]);
  });

  crossTests("XG7-037", "atwiki/page-2428");
  extraHoldTests("XG7-037", ["ET"], "3+", "atwiki/page-2428");

  /** バトルエリアにいる XG7-037 が target にアタックする（【紅と金】は絡めない）。 */
  const kaixa = (target: string) => settle(attack(p1Battle({ battle: [inst("XG7-037", "k")] }, { battle: [inst(target, "e")] }, EXTRA), "XG7-037:k", `${target}:e`));

  it("XG7-037: ※ アタックして BP の下三桁が500（BP1500）の敵軍 S ユニットを撃破したとき、相手に1点ダメージ（出典: atwiki/page-2428「BPの下三桁が500の敵軍Sユニットを撃破したとき、相手に1点ダメージを与える」）", () => {
    const s = kaixa("SPEC-E1500");
    expect(zoneOf(s, "player2", "SPEC-E1500:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG7-037: ※ 下三桁が000（BP1000）の敵軍ユニットを撃破してもダメージはない（出典: atwiki/page-2428）", () => {
    const s = kaixa("SPEC-E1000");
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  const red = () =>
    enter(p1Battle({ rush: [inst("XG7-037", "k")], hand: [inst("TST-OP", "h0"), inst("TST-OP", "h1"), inst("TST-OP", "h2")], command: releasedCat("ET", 1, "c") }, { battle: [inst("SPEC-E3000", "a"), inst("SPEC-E-M", "m")] }, EXTRA), "XG7-037:k");

  it("XG7-037: 【紅と金】自軍ターン中、バトルエリアに出たとき、手札を1枚選ぶ（任意）（出典: atwiki/page-2428「次の効果を2回まで発動できる⇒自分の手札を1枚選び」）", () => {
    const s = red();
    expectChoiceFrom(s, "player1", "XG7-037");
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-037: 【紅と金】選んだ手札を自軍コマンドゾーンにホールド状態で置き、敵軍ユニット（サイズを問わない）を1体選びこのターン BP-1500（出典: atwiki/page-2428「自軍コマンドゾーンにホールド状態で置く。そうしたとき、敵軍ユニットを1体選び、このターン、BP-1500する」・カード評価「サイズを無視してBPを下げる」）", () => {
    const s = resolveAll(red(), ["TST-OP:h0", "SPEC-E-M:m", "__none__"]);
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("command");
    expect(cardIn(s, "player1", "TST-OP:h0")?.commandHeld).toBe(true);
    expect(bpOf(s, "player2", "SPEC-E-M:m")).toBe(1500);
  });

  it("XG7-037: 【紅と金】2回まで発動できる（2回目で別の手札を置き、BP3000 の敵軍ユニットを BP1500 に）（出典: atwiki/page-2428「次の効果を2回まで発動できる」）", () => {
    let s = pick(pick(pick(red(), "TST-OP:h0"), "SPEC-E-M:m"), "TST-OP:h1");
    s = resolveAll(pick(s, "SPEC-E3000:a"));
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("command");
    expect(bpOf(s, "player2", "SPEC-E3000:a")).toBe(1500);
    expect(zoneOf(s, "player1", "TST-OP:h2")).toBe("hand");
  });
});

// ===========================================================================
describe("XG7-038 仮面ライダーギャレン×仮面ライダーブレイド", () => {
  const U28 = "（出典: 利用者の決定 2026-10-20・questions-all.md U-28）";
  const TEXT =
    "※クロス1 ※これはビークルにライドできる。 【ライトニングブラスト&バーニングスマッシュ】自軍ターン中、これがバトルエリアに出たとき、自分の手札を2枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードのカテゴリが同じなら、敵軍Sユニットを1体選び撃破する。";

  it("XG7-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-2437）", () => {
    expectCatalogText("XG7-038", TEXT);
    expectUnitStats("XG7-038", { name: "仮面ライダーギャレン×仮面ライダーブレイド", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: "0+", comboNumber: undefined, features: ["仮面ライダー", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-038", ["R"]);
  });

  crossTests("XG7-038", "atwiki/page-2437");
  extraHoldTests("XG7-038", ["WB"], "0+", "atwiki/page-2437");

  it("XG7-038: ※ビークルにライドできる（出典: atwiki/page-2437「※これはビークルにライドできる」）", () => {
    expect(canMount(p1Battle({ rush: [inst("XG7-038", "g"), inst("SPEC-V", "v")] }, {}, EXTRA), "XG7-038:g", "SPEC-V:v")).toBe(true);
  });

  const blast = (hand: CardInstance[]) =>
    enter(p1Battle({ rush: [inst("XG7-038", "g")], hand }, { battle: [inst("SPEC-E3000", "b")], rush: [inst("SPEC-ENEMY", "r"), inst("SPEC-E-M", "m")] }, EXTRA), "XG7-038:g");

  it("XG7-038: 【ライトニングブラスト&バーニングスマッシュ】自軍ターン中、バトルエリアに出たとき、手札を2枚選んで見せるかを選べる（任意）（出典: atwiki/page-2437「自分の手札を2枚選び、相手に見せてもよい」）", () => {
    const s = blast([inst("SPEC-WB-C", "w1"), inst("SPEC-WB-C2", "w2")]);
    expectChoiceFrom(s, "player1", "XG7-038");
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-038: 【ライトニングブラスト&バーニングスマッシュ】見せたとき、敵軍 S ユニット（エリアを問わない）を1体ホールドし、見せた2枚が同じカテゴリ（WB）なら敵軍 S ユニットを1体撃破する（出典: atwiki/page-2437「敵軍Sユニットを1体選びホールドする。その後、見せたカードのカテゴリが同じなら、敵軍Sユニットを1体選び撃破する」・カード評価「エリアを問わないホールド・撃破能力」）", () => {
    let s = pick(pick(blast([inst("SPEC-WB-C", "w1"), inst("SPEC-WB-C2", "w2")]), "SPEC-WB-C:w1"), "SPEC-WB-C2:w2");
    s = resolveAll(pick(pick(s, "SPEC-ENEMY:r"), "SPEC-E3000:b"));
    expect(isHeld(s, "player2", "SPEC-ENEMY:r")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-WB-C:w1")).toBe("hand");
  });

  it("XG7-038: 【ライトニングブラスト&バーニングスマッシュ】見せた2枚のカテゴリが違えば（WB と MA）ホールドだけで撃破しない（出典: atwiki/page-2437「見せたカードのカテゴリが同じなら」）", () => {
    const s = resolveAll(blast([inst("SPEC-WB-C", "w1"), inst("SPEC-MA-C", "m1")]), ["SPEC-WB-C:w1", "SPEC-MA-C:m1", "SPEC-ENEMY:r", "SPEC-E3000:b"]);
    expect(isHeld(s, "player2", "SPEC-ENEMY:r")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("battle");
  });

  const WBDA = sUnit("SPEC-WBDA-C", { category: ["WB", "DA"] as never, bp: 1000 });
  const DAOT = sUnit("SPEC-DAOT-C", { category: ["DA", "OT"] as never, bp: 1000 });
  const MAOT = sUnit("SPEC-MAOT-C", { category: ["MA", "OT"] as never, bp: 1000 });
  const blast2 = (hand: CardInstance[]) =>
    enter(p1Battle({ rush: [inst("XG7-038", "g")], hand }, { battle: [inst("SPEC-E3000", "b")], rush: [inst("SPEC-ENEMY", "r")] }, [...EXTRA, WBDA, DAOT, MAOT]), "XG7-038:g");

  it(`XG7-038: 【ライトニングブラスト&バーニングスマッシュ】「カテゴリが同じ」はカテゴリを1つでも共有すればよい — WB／DA と DA／OT（DA を共有）を見せれば撃破する${U28}`, () => {
    let s = pick(pick(blast2([inst("SPEC-WBDA-C", "h1"), inst("SPEC-DAOT-C", "h2")]), "SPEC-WBDA-C:h1"), "SPEC-DAOT-C:h2");
    s = resolveAll(pick(pick(s, "SPEC-ENEMY:r"), "SPEC-E3000:b"));
    expect(isHeld(s, "player2", "SPEC-ENEMY:r")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("discard");
  });

  it(`XG7-038: 【ライトニングブラスト&バーニングスマッシュ】共有するカテゴリがなければ（WB／DA と MA／OT）ホールドだけで撃破しない${U28}`, () => {
    const s = resolveAll(blast2([inst("SPEC-WBDA-C", "h1"), inst("SPEC-MAOT-C", "h2")]), ["SPEC-WBDA-C:h1", "SPEC-MAOT-C:h2", "SPEC-ENEMY:r", "SPEC-E3000:b"]);
    expect(isHeld(s, "player2", "SPEC-ENEMY:r")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E3000:b")).toBe("battle");
  });
});

// ===========================================================================
describe("XG7-039 GOD SPEED LOVE", () => {
  const TEXT =
    "※常駐 ※タッグ 自軍ラッシュフェイズごとに1度だけ、『特徴「加速」を持つ自軍ユニット1体をゲームから除外する』を実行してもよい。そうしたとき、次の効果を自分、相手の順に行う⇒自分自身のパワーゾーンのカードを（ウラ向きのカードはウラ向きのまま）1枚選び、オモテにするか手札に戻す。";

  it("XG7-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-2402）", () => {
    expectCatalogText("XG7-039", TEXT);
    const d = DEFS["XG7-039"]!;
    expect(d.name).toBe("GOD SPEED LOVE");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("OT");
    expect(d.powerCost).toBe(7);
    expectRarityIn("XG7-039", ["N"]);
  });

  it("XG7-039: ※常駐 — 使うと常駐オペレーションとして場に残る（出典: atwiki/page-2402「※常駐」・rules/07-keywords R-KW-PERM-01）", () => {
    const s = resolveAll(played(rushPhaseOf({ hand: [inst("XG7-039", "gs")], command: releasedCat("OT", 1), power: powerCards(7) }, {}, EXTRA), "XG7-039:gs"));
    expect(zoneOf(s, "player1", "XG7-039:gs")).toBe("operation");
  });

  const board = () =>
    rushPhaseOf(
      { operation: [faceUpResident("XG7-039", "gs")], rush: [inst("SPEC-ACCEL", "a"), inst("SPEC-WB-C", "w")], power: [{ ...inst("TST-P", "pd"), faceDown: true }, inst("TST-P", "pu")] },
      { power: [{ ...inst("TST-P", "ed"), faceDown: true }, inst("TST-P", "eu")] },
      EXTRA,
    );

  it("XG7-039: 自軍ラッシュフェイズに起動し、特徴「加速」を持つ自軍ユニットを1体除外できる（加速を持たないユニットは選べない）（出典: atwiki/page-2402「『特徴「加速」を持つ自軍ユニット1体をゲームから除外する』を実行してもよい」）", () => {
    const s = activateResident(board(), "XG7-039:gs");
    expectChoiceFrom(s, "player1", "XG7-039");
    expect(choiceIds(s)).toEqual(["SPEC-ACCEL:a"]);
    const t = pick(s, "SPEC-ACCEL:a");
    expect((t.players.player1.exile ?? []).map((c) => c.instanceId)).toContain("SPEC-ACCEL:a");
  });

  it("XG7-039: 除外したとき、自分が自軍パワーゾーンのカード（ウラ向きも選べる）を1枚選び手札に戻し、続いて相手も自分自身のパワーゾーンから1枚選ぶ（出典: atwiki/page-2402「次の効果を自分、相手の順に行う⇒自分自身のパワーゾーンのカードを（ウラ向きのカードはウラ向きのまま）1枚選び、オモテにするか手札に戻す」）", () => {
    let s = pick(activateResident(board(), "XG7-039:gs"), "SPEC-ACCEL:a");
    expectChoiceFrom(s, "player1", "XG7-039");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-P:pd", "TST-P:pu"]));
    s = resolveAll(s, ["TST-P:pd", "hand"]);
    expect(zoneOf(s, "player1", "TST-P:pd")).toBe("hand");
    expect(s.pendingEffectChoice?.playerId ?? "none").not.toBe("player1");
  });

  it("XG7-039: ウラ向き（ダメージ）のカードをオモテにできる（出典: atwiki/page-2402「オモテにするか手札に戻す」）", () => {
    let s = pick(activateResident(board(), "XG7-039:gs"), "SPEC-ACCEL:a");
    s = resolveAll(s, ["TST-P:pd", "faceup"]);
    expect(zoneOf(s, "player1", "TST-P:pd")).toBe("power");
    expect(cardIn(s, "player1", "TST-P:pd")?.faceDown).toBe(false);
  });
});

void vehicleCard;
