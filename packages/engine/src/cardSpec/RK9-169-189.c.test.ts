/**
 * カード別スペック: RK-183〜RK-189（ザ・マスクドライダーEXP vol.3 仮面ライダーZO〜ジェイクロッサー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない（rider_1〜4・rider.html を検索）。
 *     atwiki に転載された公式 Q&A（RK-183 Q1・RK-185 Q1・RK-188 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-KW-RC-01、R-BP-01・R-BP-02、R-ADD-06 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-186【Jパンチ】（ホールドする数を選ぶ・超力と同時に使えるが重複しない）— attackHoldBonus.test.ts（atwiki/page-915 コメント欄の回答と同じ）
 *  - RK-184「※これはホールド状態の時SP1になる」— 本ファイルで確かめる（既存の実装 rules/legend3/fieldEffects.ts）
 *  - RK-183 Q1（超電子ダイナモ）— cardSpec/RK1-001-021.a.test.ts RK-005（本バッチで it.todo から実テストにした）
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canConfirm,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  fill,
  heldUnit,
  inst,
  lastBattleBps,
  legal,
  mount,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  reanimateTests,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./RK9-169-189.helpers";

const E1000 = sUnit("SPEC-E1000", { bp: 1000, powerCost: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, powerCost: 3 });
const E9000 = sUnit("SPEC-E9000", { bp: 9000, powerCost: 5 });
const KAMEN_E = sUnit("SPEC-KAMEN", { bp: 2000, powerCost: 2, features: ["仮面ライダー", "男"] });
const KAMEN_M = sUnit("SPEC-KAMEN-M", { bp: 5000, powerCost: 4, size: "M", features: ["仮面ライダー"] });
const MECHA = sUnit("SPEC-MECHA", { category: "DA", bp: 1000, powerCost: 1, features: ["メカ"] });
const DA_L = sUnit("SPEC-DA-L", { category: "DA", bp: 9000, powerCost: "7+" as never, size: "L" });
const WB_L = sUnit("SPEC-WB-L", { category: "WB", bp: 9000, powerCost: "7+" as never, size: "L" });
const DA_L_FUSION = sUnit("SPEC-DA-L-FUSION", {
  category: "DA",
  bp: 9000,
  powerCost: "7+" as never,
  size: "L",
  rushAdditionalCondition: { conditionId: "discard_fusion_unit", text: "自軍合体ユニットを捨札にする" },
} as never);
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000, powerCost: 1 });
const RC_E = rcUnit("SPEC-RC-E", { category: "ET", bp: 1000 });
const EXTRA = [PLAIN_VEHICLE, E1000, E2000, E3500, E9000, KAMEN_E, KAMEN_M, MECHA, DA_L, WB_L, DA_L_FUSION, DA_S, RC_E];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

const hasExtraAttack = (s: GameState, attacker: string) => legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === attacker);

// ===========================================================================
describe("RK-183 仮面ライダーZO", () => {
  const TEXT =
    "【ZOキック】これは、アタックしてバトルに勝つたび、追加でアタックできる。ただし、これはバトルを終えるたび、このターン、BP-1000される。（BP0以下になったユニットは撃破される）";

  it("RK-183: カタログ本文・スペックが出典と一致（出典: atwiki/page-1000）", () => {
    expectCatalogText("RK-183", TEXT);
    expectStats("RK-183", { name: "仮面ライダーZO", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-183", ["SR"]);
  });

  const enemy = { battle: [inst("SPEC-E1000", "a"), inst("SPEC-E1000", "b"), inst("SPEC-E1000", "c"), inst("SPEC-E1000", "d"), inst("SPEC-E1000", "e")] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) => settle(rcRideOff(board({ rush: [inst("RK-183", "zo"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-183:zo", "SPEC-VEHICLE:v"));

  it("RK-183: RC — アタックしてバトルに勝ったら、追加でアタックできる（出典: atwiki/page-1000「これは、アタックしてバトルに勝つたび、追加でアタックできる」）", () => {
    const s = resolveAll(attack(rc(), "RK-183:zo", "SPEC-E1000:a"));
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(hasExtraAttack(s, "RK-183:zo")).toBe(true);
  });

  it("RK-183: RC — バトルを終えるたび、このターン BP-1000 される（出典: atwiki/page-1000「これはバトルを終えるたび、このターン、BP-1000される」）", () => {
    let s = resolveAll(attack(rc(), "RK-183:zo", "SPEC-E1000:a"));
    expect(bpOf(s, "player1", "RK-183:zo")).toBe(3000);
    s = resolveAll(attack(s, "RK-183:zo", "SPEC-E1000:b"));
    expect(bpOf(s, "player1", "RK-183:zo")).toBe(2000);
  });

  it("RK-183: RC — BP が0以下になると撃破される（4回バトルすると BP0）（出典: atwiki/page-1000「（BP0以下になったユニットは撃破される）」・R-BP-02）", () => {
    let s = rc();
    for (const id of ["a", "b", "c", "d"]) s = resolveAll(attack(s, "RK-183:zo", `SPEC-E1000:${id}`));
    expect(zoneOf(s, "player1", "RK-183:zo")).toBe("discard");
  });

  it("RK-183: RC を発動していなければ、追加でアタックできず BP も下がらない（出典: atwiki/page-1000・R-KW-RC-01）", () => {
    let s = board({ rush: [inst("RK-183", "zo")] }, enemy);
    s = resolveAll(attack(enter(s, "RK-183:zo"), "RK-183:zo", "SPEC-E1000:a"));
    expect(hasExtraAttack(s, "RK-183:zo")).toBe(false);
    expect(bpOf(s, "player1", "RK-183:zo")).toBe(4000);
  });

  it("RK-183: RC — バトルに負けた（勝てなかった）ときは追加でアタックできない（出典: atwiki/page-1000「バトルに勝つたび」）", () => {
    const s = resolveAll(attack(rc({ battle: [inst("SPEC-E9000", "big")] }), "RK-183:zo", "SPEC-E9000:big"));
    expect(hasExtraAttack(s, "RK-183:zo")).toBe(false);
  });

  it("RK-183: 新1号の RC で「BP8000 になる」ときは、バトルを終えても BP は下がらない（出典: atwiki/page-1000 カード評価「BPが固定になるのでデメリットでアタックするたびに-1000される事も無い」・コメント欄・R-BP-01）", () => {
    let s = rcRideOff(board({ rush: [inst("RK-175", "s1"), inst("SPEC-VEHICLE", "v1"), inst("RK-183", "zo"), inst("SPEC-VEHICLE", "v2")] }, enemy), "RK-175:s1", "SPEC-VEHICLE:v1");
    s = passEntry(settle(s));
    s = settle(act(act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-183:zo", vehicleInstanceId: "SPEC-VEHICLE:v2" }), { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }));
    expect(bpOf(s, "player1", "RK-183:zo")).toBe(8000);
    s = resolveAll(attack(s, "RK-183:zo", "SPEC-E1000:a"));
    expect(bpOf(s, "player1", "RK-183:zo")).toBe(8000);
    expect(hasExtraAttack(s, "RK-183:zo")).toBe(true);
  });
});

// ===========================================================================
describe("RK-184 ドラス", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） ※これはホールド状態の時SP1になる。 【生命維持プール】これが自軍エリアにある間、これがホールド状態になったとき、自軍常駐置き場からカードを1枚選び捨札にしてもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、これをリリースする。";

  it("RK-184: カタログ本文・スペックが出典と一致（出典: atwiki/page-1001）", () => {
    expectCatalogText("RK-184", TEXT);
    expectStats("RK-184", { name: "ドラス", category: "DA", size: "S", bp: 5000, sp: "special", powerCost: "4+", features: ["メカ", "怪人"], rushCondition: "discard_feature_unit" });
    expectRarityIn("RK-184", ["SR"]);
  });

  it("RK-184: 追加条件 — 特徴「メカ」を持つ自軍ユニットを1体捨札にしてラッシュする（出典: atwiki/page-1001「追加条件：特徴「メカ」を持つ自軍ユニットを1体捨札にする」）", () => {
    const base = (rush: ReturnType<typeof inst>[]) => rushPhase({ hand: [inst("RK-184", "dr")], rush, command: releasedCat("DA", 1), power: powerCards(4) });
    expect(canStartRush(base([inst("TST-UNIT-0", "f")]), "player1", "RK-184:dr")).toBe(false);
    const r = rushFromHand(base([inst("SPEC-MECHA", "m")]), "player1", "RK-184:dr");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-184:dr")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-MECHA:m")).toBe("discard");
  });

  it("RK-184: ※ ホールド状態のとき SP1 になる（リリース状態ではストライクしても0）（出典: atwiki/page-1001「※これはホールド状態の時SP1になる」）", () => {
    const held = board({ battle: [heldUnit("RK-184", "dr")] });
    expect(spOf(held, "player1", "RK-184:dr")).toBe(1);
    const free = board({ battle: [inst("RK-184", "dr")] });
    expect(spOf(free, "player1", "RK-184:dr")).toBe(0);
  });

  it("RK-184: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-1001「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-184", "dr")] }, "RK-184:dr"))).toBe(true);
  });

  /** 敵軍ターンにアタックされ、レジストでホールドした直後。 */
  const registered = (operation = [resident("TST-OP", "res"), { ...resident("TST-OP", "fd"), faceDown: true }]) => {
    const s = attackUntilRegister({ battle: [inst("RK-184", "dr")], operation }, "RK-184:dr");
    const use = legal(s).find((a) => a.type === "use_register" && a.playerId === "player1");
    expect(use).toBeDefined();
    return act(s, use!);
  };

  it("RK-184: 【生命維持プール】ホールド状態になったとき（敵軍ターンのレジストでも）、自軍常駐置き場のカード（ウラ向きを含む）から1枚選んでもよい（出典: atwiki/page-1001「これがホールド状態になったとき、自軍常駐置き場からカードを1枚選び捨札にしてもよい（ウラ向きのカードはウラ向きのまま選ぶ）」・コメント欄「ターンが指定されていないので可能」）", () => {
    const s = registered();
    expect(cardIn(s, "player1", "RK-184:dr")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-184");
    expect(choiceIds(s)).toEqual(["TST-OP:fd", "TST-OP:res"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-184: 【生命維持プール】捨札にしたら、これをリリースする（出典: atwiki/page-1001「そうしたとき、これをリリースする」）", () => {
    const s = resolveAll(pick(registered(), "TST-OP:fd"));
    expect(zoneOf(s, "player1", "TST-OP:fd")).toBe("discard");
    expect(cardIn(s, "player1", "RK-184:dr")?.commandHeld).toBeFalsy();
  });

  it("RK-184: 【生命維持プール】自軍常駐置き場にカードがなければ発動しない（出典: atwiki/page-1001）", () => {
    const s = registered([]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-184");
  });
});

// ===========================================================================
describe("RK-185 レッドドラス", () => {
  const TEXT =
    "※これをラッシュしたとき、特徴「仮面ライダー」を持つ敵軍Sユニットを1体選び、持ち主の山札の下に戻す。 【合体吸収】自軍ターン中、これがバトルエリアに出たとき、敵軍山札の下から1枚ひいてオモテにしてもよい。オモテにしたカードがＲＣを持つユニットカードなら、このターン、これはSP1になり、オモテにしたカードのRCの効果をこのユニットの効果として発動する。その後、オモテにしたカードは持ち主の山札の下に戻す。";

  it("RK-185: カタログ本文・スペックが出典と一致（出典: atwiki/page-1048）", () => {
    expectCatalogText("RK-185", TEXT);
    expectStats("RK-185", { name: "レッドドラス", category: "DA", size: "S", bp: 6000, sp: "special", powerCost: "5+", features: ["メカ", "怪人"], rushCondition: "discard_named_unit" });
    expectRarityIn("RK-185", ["SR"]);
  });

  const rushed = (p2: Partial<GameState["players"]["player2"]>) => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-185", "rd")], rush: [inst("RK-184", "dr")], command: releasedCat("DA", 1), power: powerCards(5) }, p2), "player1", "RK-185:rd");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-185: 追加条件 — 自軍「ドラス」1体を捨札にしてラッシュする（出典: atwiki/page-1048「追加条件：自軍「ドラス」1体を捨札にする」）", () => {
    const s = resolveAll(rushed({}));
    expect(zoneOf(s, "player1", "RK-185:rd")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-184:dr")).toBe("discard");
  });

  it("RK-185: ※ ラッシュしたとき、特徴「仮面ライダー」を持つ敵軍 S ユニットから1体選ぶ（エリアを問わない。M・仮面ライダーでないものは対象外。選ばないことはできない）（出典: atwiki/page-1048「※これをラッシュしたとき、特徴「仮面ライダー」を持つ敵軍Sユニットを1体選び」）", () => {
    const s = rushed({ battle: [inst("SPEC-KAMEN", "k1"), inst("SPEC-KAMEN-M", "km")], rush: [inst("SPEC-KAMEN", "k2"), inst("SPEC-E1000", "x")] });
    expectChoiceFrom(s, "player1", "RK-185");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN:k1", "SPEC-KAMEN:k2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-185: ※ 選んだユニットを持ち主の山札の下に戻す（出典: atwiki/page-1048「持ち主の山札の下に戻す」）", () => {
    const s = resolveAll(pick(rushed({ battle: [inst("SPEC-KAMEN", "k1")] }), "SPEC-KAMEN:k1"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-KAMEN:k1");
  });

  /** 自軍バトルフェイズにレッドドラスを出した直後（敵軍山札の下が bottom）。 */
  const entered = (bottom: ReturnType<typeof inst>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(board({ rush: [inst("RK-185", "rd")] }, { deck: [...deckCards(3, "e"), bottom], ...p2 }), "RK-185:rd");

  it("RK-185: 【合体吸収】自軍ターン中、バトルエリアに出たとき、敵軍山札の下から1枚ひいてオモテにするかを選べる（任意）（出典: atwiki/page-1048「敵軍山札の下から1枚ひいてオモテにしてもよい」）", () => {
    const s = entered(inst("RK-176", "bot"));
    expectChoiceFrom(s, "player1", "RK-185");
    expect(canConfirm(s)).toBe(true);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-185: 【合体吸収】オモテにしたカードが RC を持つユニットカードなら、このターン SP1 になり、その RC の効果をこのユニットの効果として発動する（RK-176 新2号の【ライダーキック】）（出典: atwiki/page-1048「このターン、これはSP1になり、オモテにしたカードのRCの効果をこのユニットの効果として発動する」）", () => {
    const s = confirm(entered(inst("RK-176", "bot"), { battle: [inst("SPEC-E9000", "big")] }));
    expectChoiceFrom(s, "player1", "RK-176");
    expect(choiceIds(s)).toEqual(["SPEC-E9000:big"]);
    const done = resolveAll(pick(s, "SPEC-E9000:big"));
    expect(zoneOf(done, "player2", "SPEC-E9000:big")).toBe("command");
    expect(spOf(done, "player1", "RK-185:rd")).toBe(1);
  });

  it("RK-185: 【合体吸収】その後、オモテにしたカードは持ち主の山札の下に戻す（出典: atwiki/page-1048「その後、オモテにしたカードは持ち主の山札の下に戻す」）", () => {
    const s = resolveAll(confirm(entered(inst("RK-176", "bot"), { battle: [inst("SPEC-E9000", "big")] })));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("RK-176:bot");
  });

  it("RK-185: 【合体吸収】RC を持たないカードなら SP1 にならず、カードは山札の下に戻る（出典: atwiki/page-1048「RCを持つユニットカードなら」）", () => {
    const s = resolveAll(confirm(entered(inst("SPEC-E1000", "bot"))));
    expect(spOf(s, "player1", "RK-185:rd")).toBe(0);
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-E1000:bot");
  });

  // atwiki/page-1048 Q1 = atwiki/page-1370 Q1「はい、「RK-185 レッドドラス」はRCの効果を自身の効果として発動していますので、【ライジングスプラッシュドラゴン】で無効にすることができます。（2010/10/25修正）」
  it("RK-185: 公式Q&A — 【合体吸収】で発動した RC の効果は、RK-272 仮面ライダークウガRD【ライジングスプラッシュドラゴン】で無効にできる（新2号の【ライダーキック】で選ばれるはずの敵軍ユニットが残る）（出典: atwiki/page-1048 Q1（2010/10/25修正）・atwiki/page-1370 Q1）", () => {
    let s = confirm(entered(inst("RK-176", "bot"), { battle: [inst("SPEC-E9000", "big")], rush: [inst("RK-272", "rd")], hand: [inst("TST-OP", "eh")] }));
    expectChoiceFrom(s, "player2", "RK-272");
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:eh" }));
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:eh");
    expect(zoneOf(s, "player2", "SPEC-E9000:big")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-186 仮面ライダーJ", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【Jパンチ】これがアタックするとき、自軍コマンドを好きな数ホールドしてもよい。そうしたとき、このターン、これはホールドしたコマンド1つにつきBP+1000される。";

  it("RK-186: カタログ本文・スペックが出典と一致（出典: atwiki/page-915）", () => {
    expectCatalogText("RK-186", TEXT);
    expectStats("RK-186", { name: "仮面ライダーJ", category: "MA", size: "S", bp: 1000, sp: "1/3", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-186", ["NR"]);
  });

  it("RK-186: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-915「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-186", "j")] }, "RK-186:j"))).toBe(true);
  });
});

// ===========================================================================
describe("RK-187 仮面ライダーJ ジャンボフォーメーション", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーJ」のカードを1枚選び、自軍ラッシュエリアに出す。 【ジャンボライダーキック】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、追加条件に「自軍合体ユニットを捨札にする」と表記されていないDAを持つ敵軍Lユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-187: カタログ本文・スペックが出典と一致（出典: atwiki/page-1086）", () => {
    expectCatalogText("RK-187", TEXT);
    expectStats("RK-187", { name: "仮面ライダーJジャンボフォーメーション", category: "MA", size: "L", bp: 5500, sp: undefined, powerCost: "7-", features: ["仮面ライダー", "男", "人型"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-187", ["R"]);
  });

  zordDownTests("RK-187", "RK-186", "仮面ライダーJ", "atwiki/page-1086", "MA");
  reanimateTests("RK-187", "RK-186", "仮面ライダーJ", "atwiki/page-1086");

  const enemy = { battle: [inst("SPEC-DA-L", "dl"), inst("SPEC-WB-L", "wl"), inst("SPEC-DA-L-FUSION", "fl"), inst("SPEC-DA-S", "ds")], rush: [inst("SPEC-DA-L", "rl")] };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => enter(board({ rush: [inst("RK-187", "jj")] }, p2), "RK-187:jj");

  it("RK-187: 【ジャンボライダーキック】自軍ターン中、バトルエリアに出たとき、敵軍バトルエリアの DA を持つ L ユニット（追加条件が「自軍合体ユニットを捨札にする」でないもの）から1体選べる（任意）（出典: atwiki/page-1086「追加条件に「自軍合体ユニットを捨札にする」と表記されていないDAを持つ敵軍Lユニットを1体選び」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-187");
    expect(choiceIds(s)).toEqual(["SPEC-DA-L:dl"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-187: 【ジャンボライダーキック】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1086「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-DA-L:dl"));
    expect(zoneOf(s, "player2", "SPEC-DA-L:dl")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-DA-L:dl")?.faceDown).toBe(true);
  });

  it("RK-187: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-1086「自軍ターン中、」）", () => {
    let s = enemyTurn({ rush: [inst("RK-187", "jj")] }, { ...enemy, rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] });
    s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
    s = pick(s, "RK-187:jj");
    expect(zoneOf(s, "player1", "RK-187:jj")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-187");
  });
});

// ===========================================================================
describe("RK-188 ベリー", () => {
  const TEXT =
    "【地空人のエージェント】これが自軍エリアにある間、敵軍ターン中、自軍Sユニットがアタックされたとき、次の効果を発動できる⇒自分の手札の必要パワーに「－」を持つユニットカードから、アタックされたSユニットが追加条件で指定されているカードを1枚選び、自軍バトルエリアに出してもよい（このとき出したユニットの効果は発動しない）。そうしたとき、アタックされたユニットを捨札にして、かわりにバトルエリアに出したユニットでバトルする。";

  it("RK-188: カタログ本文・スペックが出典と一致（出典: atwiki/page-916）", () => {
    expectCatalogText("RK-188", TEXT);
    expectStats("RK-188", { name: "ベリー", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 0, features: ["昆虫"] });
    expectRarityIn("RK-188", ["NR"]);
  });

  /** 敵軍ターン、player2 の BP9000 が player1 の target にアタックした直後。 */
  const attacked = (target: ReturnType<typeof inst>, hand: ReturnType<typeof inst>[], berry = true, p2: Partial<GameState["players"]["player2"]> = {}) => {
    const s = enemyTurn({ battle: [target], rush: berry ? [inst("RK-188", "be")] : [], hand }, { battle: [inst("SPEC-E9000", "atk"), inst("SPEC-DA-L", "edl")], ...p2 });
    return attack(s, "SPEC-E9000:atk", target.instanceId, "player2");
  };

  it("RK-188: 敵軍ターン中、自軍 S ユニットがアタックされたとき、手札の必要パワーに「－」を持つユニットカードのうち、アタックされたユニットを追加条件で指定しているカードを選べる（任意）（出典: atwiki/page-916「アタックされたSユニットが追加条件で指定されているカードを1枚選び、自軍バトルエリアに出してもよい」）", () => {
    const s = attacked(inst("RK-186", "j"), [inst("RK-187", "jj"), inst("XP-008", "vf"), inst("TST-UNIT-0", "h")]);
    expectChoiceFrom(s, "player1", "RK-188");
    expect(choiceIds(s)).toEqual(["RK-187:jj"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-188: 選んだカードを自軍バトルエリアに出し、アタックされたユニットを捨札にして、かわりに出したユニットでバトルする（BP9000 にアタックされた RK-187 が撃破される）（出典: atwiki/page-916「アタックされたユニットを捨札にして、かわりにバトルエリアに出したユニットでバトルする」）", () => {
    const s = pick(attacked(inst("RK-186", "j"), [inst("RK-187", "jj")]), "RK-187:jj");
    expect(zoneOf(s, "player1", "RK-186:j")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-187:jj")).toBe("discard");
    expect(lastBattleBps(s)?.defender).toBe(5500);
    expect(zoneOf(s, "player2", "SPEC-E9000:atk")).toBe("battle");
  });

  it("RK-188: 出したユニットの効果は発動しない（RK-187【ジャンボライダーキック】の選択は開かない）（出典: atwiki/page-916「（このとき出したユニットの効果は発動しない）」）", () => {
    const s = pick(attacked(inst("RK-186", "j"), [inst("RK-187", "jj")]), "RK-187:jj");
    expect(s.pendingEffectChoice?.effectId).not.toBe("rk187_jumbo_rider_kick");
    expect(s.log.some((l) => l.includes("rk187_jumbo_rider_kick"))).toBe(false);
  });

  it("RK-188: ベリーが自軍エリアになければ選択は開かない（出典: atwiki/page-916「これが自軍エリアにある間」）", () => {
    const s = attacked(inst("RK-186", "j"), [inst("RK-187", "jj")], false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-188");
  });

  // atwiki/page-916 Q1「はい、できます。その場合は、「RK-029 仮面ライダークウガMF」を『「RK-271 仮面ライダークウガRM」の追加条件として指定されたユニット』と考えて頂いて構いません。」
  it("RK-188: 公式Q&A — 特徴で指定する追加条件（RK-271 クウガRM「特徴「アマダム」を持つ自軍ユニット」）でも、アタックされた RK-029 クウガMF を指定されたユニットとして出せる（出典: atwiki/page-916 Q1・atwiki/page-217 Q1）", () => {
    const s = attacked(inst("RK-029", "mf"), [inst("RK-271", "rm")]);
    expectChoiceFrom(s, "player1", "RK-188");
    expect(choiceIds(s)).toEqual(["RK-271:rm"]);
  });

  // atwiki/page-916 Q2「はい、できます。合体ユニットのうちの1体だけであっても「追加条件で指定されたユニット」ですので…捨札にする必要があるのは「アタックされたユニット」だけ」
  it("RK-188: 公式Q&A — 合体ユニットのうち1体（XG2-069 NEW電王SF・RK-146 デネブ）がアタックされたときも XP-008 NEW電王VF を出せ、捨札にするのはアタックされたユニットだけ（出典: atwiki/page-916 Q2）", () => {
    let s = attacked(inst("RK-146", "dn"), [inst("XP-008", "vf")]);
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, battle: [...s.players.player1.battle, inst("XG2-069", "sf")] } } };
    expectChoiceFrom(s, "player1", "RK-188");
    expect(choiceIds(s)).toEqual(["XP-008:vf"]);
    s = settle(pick(s, "XP-008:vf"));
    expect(zoneOf(s, "player1", "RK-146:dn")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-069:sf")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-189 ジェイクロッサー", () => {
  const TEXT = "【地空人の精霊パワー】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つまで選び、リリースしてもよい。";

  it("RK-189: カタログ本文・スペックが出典と一致（出典: atwiki/page-914）", () => {
    expectCatalogText("RK-189", TEXT);
    expectVehicleStats("RK-189", { name: "ジェイクロッサー", category: "MA", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-189", ["N"]);
  });

  const heldCmd = (n: number) => Array.from({ length: n }, (_, i) => ({ ...inst("TST-OP", `h${i}`), commandHeld: true }));
  const entered = (command = heldCmd(3)) => mount(board({ rush: [inst("RK-189", "jc"), inst("SPEC-RC-E", "r")], command }), "SPEC-RC-E:r", "RK-189:jc");

  it("RK-189: 自軍ターン中、バトルエリアに出たとき、ホールド状態の自軍コマンドから選んでリリースできる（任意）（出典: atwiki/page-914「自軍コマンドを2つまで選び、リリースしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-189");
    expect(choiceIds(s)).toEqual(["TST-OP:h0", "TST-OP:h1", "TST-OP:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-189: 2つまで選んでリリースする（3つ目は選べない）（出典: atwiki/page-914「2つまで選び」）", () => {
    let s = pick(entered(), "TST-OP:h0");
    s = pick(s, "TST-OP:h2");
    s = settle(s);
    const cmd = (id: string) => cardIn(s, "player1", id)?.commandHeld;
    expect(cmd("TST-OP:h0")).toBeFalsy();
    expect(cmd("TST-OP:h2")).toBeFalsy();
    expect(cmd("TST-OP:h1")).toBe(true);
  });

  it("RK-189: 1つだけ選んでリリースしてもよい（出典: atwiki/page-914「2つまで」）", () => {
    let s = pick(entered(), "TST-OP:h1");
    if (s.pendingEffectChoice?.sourceCardId === "RK-189") s = canConfirm(s) ? confirm(s) : skip(s);
    s = settle(s);
    expect(cardIn(s, "player1", "TST-OP:h1")?.commandHeld).toBeFalsy();
    expect(cardIn(s, "player1", "TST-OP:h0")?.commandHeld).toBe(true);
  });

});
