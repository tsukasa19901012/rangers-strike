/**
 * cardSpec XG4-051〜XG4-057（マックジャバー〜仮面ライダー龍騎サバイブ）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activate,
  attackUntilRegister,
  bpOf,
  canActivate,
  canConfirm,
  canMount,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  destroyedInEnemyBattle,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  faceDown,
  holdEnterTests,
  inst,
  isExiled,
  mount,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  spOf,
  sUnit,
  swapTests,
  vehicleCard,
  zoneOf,
} from "./XG4-044-063.helpers";

const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_6000 = sUnit("SPEC-E-6000", { bp: 6000, sp: undefined });
const E_7000 = sUnit("SPEC-E-7000", { bp: 7000, sp: undefined });
const RIDER = sUnit("SPEC-RIDER", { category: "MA", bp: 1000, sp: undefined, features: ["仮面ライダー", "男"] });
const NONRIDER = sUnit("SPEC-NONRIDER", { category: "MA", bp: 1000, sp: undefined, features: ["男"] });
const D_WB = sUnit("SPEC-D-WB", { category: "WB", bp: 1000 });
const D_MA = sUnit("SPEC-D-MA", { category: "MA", bp: 1000 });
const SURVIVE = sUnit("SPEC-SURVIVE", { category: "WB", bp: 1000, sp: undefined, features: ["サバイブ"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000, sp: undefined, features: ["男"] });
const BIKE = vehicleCard("SPEC-BIKE", { category: "WB" });
const EXTRA = [E_S, E_6000, E_7000, RIDER, NONRIDER, D_WB, D_MA, SURVIVE, PLAIN, BIKE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-051 マックジャバー", () => {
  const TEXT =
    "※自軍ターン開始時、自分の手札から「アクロバッター」か「ロボイザー」のカードを1枚選び、これと置き換えてもよい。 【液化】自軍ラッシュフェイズ中、このビークルを捨札にしてもよい。そうしたとき、自分は1枚ドローする。";

  it("XG4-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-2056）", () => {
    expectCatalogText("XG4-051", TEXT);
    expectVehicle("XG4-051", { name: "マックジャバー", category: "MA", powerCost: 1, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("XG4-051", ["N"]);
  });

  swapTests("XG4-051", ["XG4-049", "XG4-050"], "TST-UNIT-0", "atwiki/page-2056");

  it("XG4-051:【液化】— 自軍ラッシュフェイズ中、これを捨札にして1枚ドローできる（出典: atwiki/page-2056「このビークルを捨札にしてもよい。そうしたとき、自分は1枚ドローする」）", () => {
    const s0 = board({ rush: [inst("XG4-051", "mj")], deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] });
    expect(canActivate(s0, "XG4-051:mj")).toBe(true);
    const s = resolveAll(activate(s0, "XG4-051:mj"));
    expect(zoneOf(s, "player1", "XG4-051:mj")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("hand");
  });

  it("XG4-051:【液化】— 自軍バトルフェイズには使えない（出典: atwiki/page-2056「自軍ラッシュフェイズ中」）", () => {
    expect(canActivate(battle({ rush: [inst("XG4-051", "mj")] }), "XG4-051:mj")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-052 仮面ライダークウガUF（XG4）", () => {
  const TEXT =
    "※レジスト ※これは手札または常駐置場からしかラッシュできない。 【空我】敵軍バトルエリアのユニットが1体だけなら、敵軍バトルエリアのユニットを持ち主のパワーゾーンにダメージにして置く。そうしたとき、これを捨札にする。";

  it("XG4-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-2148）", () => {
    expectCatalogText("XG4-052", TEXT);
    expectUnit("XG4-052", { name: "仮面ライダークウガUF", category: "MA", size: "S", bp: 6000, sp: "1/3", powerCost: 7, comboNumber: 1, features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("XG4-052", ["SR"]);
  });

  it("XG4-052: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2148 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-052", "ku")] }, "XG4-052:ku"))).toBe(true);
  });

  it("XG4-052: ※ — 手札からはラッシュできる（出典: atwiki/page-2148「これは手札または常駐置場からしかラッシュできない」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-052", "ku")], command: releasedCat("MA", 1), power: powerCards(7) }), "player1", "XG4-052:ku");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG4-052:ku")).toBe("rush");
  });

  it.todo("XG4-052: ※ — 手札・常駐置場以外（山札・コマンドゾーン・捨札・モーフ）からはラッシュできない（出典: atwiki/page-2148・カード評価「仮面ライダーディケイドCFの効果や仮面ライダークウガDF（XG4）からのモーフでは出せない」）（未対応の理由: 手札以外からラッシュさせるカードの効果と組み合わせた盤面がこのバッチの範囲で組めない）");

  it("XG4-052: NC【空我】— 1番目に出て、敵軍バトルエリアのユニットが1体だけなら、そのユニットが持ち主のパワーゾーンにダメージとして置かれ、これは捨札になる（出典: atwiki/page-2148「敵軍バトルエリアのユニットが1体だけなら…ダメージにして置く。そうしたとき、これを捨札にする」）", () => {
    const s = resolveAll(settle(ncEnter("XG4-052:ku", 0, {}, { battle: [inst("SPEC-E-7000", "one")], deck: deckCards(3, "e") }, EXTRA)));
    expect(zoneOf(s, "player2", "SPEC-E-7000:one")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player1", "XG4-052:ku")).toBe("discard");
  });

  it("XG4-052: NC【空我】— 敵軍バトルエリアのユニットが2体なら何もしない（これも残る）（出典: atwiki/page-2148「1体だけなら」）", () => {
    const s = resolveAll(settle(ncEnter("XG4-052:ku", 0, {}, { battle: [inst("SPEC-E-7000", "a"), inst("SPEC-E-S", "b")], deck: deckCards(3, "e") }, EXTRA)));
    expect(zoneOf(s, "player2", "SPEC-E-7000:a")).toBe("battle");
    expect(zoneOf(s, "player1", "XG4-052:ku")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-053 仮面ライダーアギトSHF（XG4）", () => {
  const TEXT =
    "※レジスト 【AGITΩ】これが自分の手札にある間、敵軍ターン中、特徴「仮面ライダー」を持つ自軍ユニットがユニットでなくなり、自軍ユニットが1体もなくなったとき、MAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、これを自軍ラッシュエリアに出す。その後、自分は1枚ドローする。";

  it("XG4-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-2111）", () => {
    expectCatalogText("XG4-053", TEXT);
    expectUnit("XG4-053", { name: "仮面ライダーアギトSHF", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("XG4-053", ["NR"]);
  });

  it("XG4-053: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2111 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-053", "ag")] }, "XG4-053:ag"))).toBe(true);
  });

  const lost = (victim = "SPEC-RIDER", others: ReturnType<typeof inst>[] = []) =>
    settle(destroyedInEnemyBattle(inst(victim, "v"), { hand: [inst("XG4-053", "ag")], command: releasedCat("MA", 1), rush: others, deck: [inst("TST-UNIT-0", "top"), ...deckCards(4)] }, {}, EXTRA));

  it("XG4-053:【AGITΩ】— 敵軍ターン中、最後の自軍ユニット（「仮面ライダー」）がいなくなると、MA のコマンドをホールドするかを選べる（任意）（出典: atwiki/page-2111「MAを持つ自軍コマンドを1つホールドしてもよい」）", () => {
    const s = lost();
    expectChoiceFrom(s, "player1", "XG4-053");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-053:【AGITΩ】— ホールドすると、これが自軍ラッシュエリアに出て、その後1枚ドローする（出典: atwiki/page-2111「そうしたとき、これを自軍ラッシュエリアに出す。その後、自分は1枚ドローする」）", () => {
    let s = lost();
    expectChoiceFrom(s, "player1", "XG4-053");
    s = resolveAll(choiceIds(s).length > 0 ? pick(s, choiceIds(s)[0]!) : confirm(s));
    expect(zoneOf(s, "player1", "XG4-053:ag")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("hand");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("XG4-053: 公式Q&A — いなくなった最後のユニットが「仮面ライダー」でなければ発動しない（出典: atwiki/page-2111 Q1「特徴「仮面ライダー」を持つ自軍ユニットがユニットでなくなり、その結果として自軍ユニットが1体もなくなったときのみ」）", () => {
    expect(lost("SPEC-NONRIDER").pendingEffectChoice?.sourceCardId).not.toBe("XG4-053");
  });

  it("XG4-053:【AGITΩ】— ほかの自軍ユニットが残っていれば発動しない（出典: atwiki/page-2111「自軍ユニットが1体もなくなったとき」）", () => {
    expect(lost("SPEC-RIDER", [inst("TST-UNIT-0", "r")]).pendingEffectChoice?.sourceCardId).not.toBe("XG4-053");
  });
});

// ===========================================================================
describe("XG4-054 仮面ライダーブレイドKF（XG4）", () => {
  const TEXT =
    "※レジスト 【ストレートフラッシュ】自軍ターン中、これがバトルエリアに出たとき、自軍捨札を5枚選びゲームから除外してもよい。そうしたとき、 本来のBPが6000以下の敵軍ユニットを1体選び撃破する。その後、除外したカードのカテゴリがすべて同じなら、このターン、これは「SP1」になる。";

  it("XG4-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-2134）", () => {
    expectCatalogText("XG4-054", TEXT);
    expectUnit("XG4-054", { name: "仮面ライダーブレイドKF", category: "WB", size: "S", bp: 5000, sp: "1/2", powerCost: 6, comboNumber: undefined, features: ["アンデッド", "仮面ライダー", "男"] });
    expectRarityIn("XG4-054", ["SR"]);
  });

  it("XG4-054: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2134 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-054", "bk")] }, "XG4-054:bk"))).toBe(true);
  });

  const same = () => Array.from({ length: 5 }, (_, i) => inst("SPEC-D-WB", `d${i}`));
  const mixed = () => [...Array.from({ length: 4 }, (_, i) => inst("SPEC-D-WB", `d${i}`)), inst("SPEC-D-MA", "d4")];
  const entered = (discard: ReturnType<typeof inst>[]) =>
    settle(enterNow(battle({ rush: [inst("XG4-054", "bk")], discard }, { battle: [inst("SPEC-E-6000", "a"), inst("SPEC-E-7000", "b")], deck: deckCards(3, "e") }), "XG4-054:bk"));
  /** 除外する捨札を選ぶ（選択の形がカード選択でも確認でも進める）。 */
  const exileAll = (s: GameState, discard: ReturnType<typeof inst>[]) => {
    let n = s;
    for (const c of discard) if (n.pendingEffectChoice?.sourceCardId === "XG4-054" && n.pendingEffectChoice.validInstanceIds.includes(c.instanceId)) n = pick(n, c.instanceId);
    if (n.pendingEffectChoice?.sourceCardId === "XG4-054" && choiceIds(n).every((id) => !id.startsWith("SPEC-E-")) && canConfirm(n)) n = confirm(n);
    return n;
  };

  it("XG4-054:【ストレートフラッシュ】— 自軍ターン中にバトルエリアに出たとき、自軍捨札5枚を除外するかを選べる（任意）（出典: atwiki/page-2134「自軍捨札を5枚選びゲームから除外してもよい」）", () => {
    const s = entered(same());
    expectChoiceFrom(s, "player1", "XG4-054");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-054:【ストレートフラッシュ】— 除外すると、本来の BP が6000以下の敵軍ユニットを1体選び撃破する（BP7000 は選べない）（出典: atwiki/page-2134「本来のBPが6000以下の敵軍ユニットを1体選び撃破する」）", () => {
    let s = exileAll(entered(same()), same());
    for (const c of same()) expect(isExiled(s, "player1", c.instanceId)).toBe(true);
    expectChoiceFrom(s, "player1", "XG4-054");
    expect(choiceIds(s)).toEqual(["SPEC-E-6000:a"]);
    s = resolveAll(pick(s, "SPEC-E-6000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-6000:a")).toBe("discard");
  });

  it("XG4-054:【ストレートフラッシュ】— 除外したカードのカテゴリがすべて同じなら、このターン「SP1」になる（出典: atwiki/page-2134「除外したカードのカテゴリがすべて同じなら、このターン、これは「SP1」になる」）", () => {
    let s = exileAll(entered(same()), same());
    expectChoiceFrom(s, "player1", "XG4-054");
    s = resolveAll(pick(s, "SPEC-E-6000:a"));
    expect(spOf(s, "player1", "XG4-054:bk")).toBe(1);
  });

  it("XG4-054:【ストレートフラッシュ】— カテゴリが混ざっていれば「SP1」にならない（1番目なので分数 SP も0）（出典: atwiki/page-2134「すべて同じなら」）", () => {
    let s = exileAll(entered(mixed()), mixed());
    expectChoiceFrom(s, "player1", "XG4-054");
    s = resolveAll(pick(s, "SPEC-E-6000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-6000:a")).toBe("discard");
    expect(spOf(s, "player1", "XG4-054:bk")).toBe(0);
  });

  it("XG4-054:【ストレートフラッシュ】— 自軍捨札が4枚しかなければ発動できない（出典: atwiki/page-2134「自軍捨札を5枚選び」）", () => {
    const s = entered(same().slice(0, 4));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-054");
  });
});

// ===========================================================================
describe("XG4-055 ドラグランザー（XG4）", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。";

  it("XG4-055: カタログ本文・スペックが出典と一致（出典: atwiki/page-2077）", () => {
    expectCatalogText("XG4-055", TEXT);
    expectUnit("XG4-055", { name: "ドラグランザー", category: "WB", size: "S", bp: 7000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["ミラーモンスター", "獣", "ドラゴン"] });
    expectRarityIn("XG4-055", ["N"]);
  });

  holdEnterTests("XG4-055", "WB", "atwiki/page-2077");
});

// ===========================================================================
describe("XG4-056 ドラグランザー（バイク形態）", () => {
  const TEXT =
    "※自分が「ドラグランザー」をラッシュしたとき、自軍エリアに「ドラグランザー（バイク形態）」があれば1体選び手札に戻す。 ※特徴「サバイブ」を持つ自軍Sユニットは、RCを持っていなくてもこのビークルにライドすることができ、ライド中BP＋1500される。";

  it("XG4-056: カタログ本文・スペックが出典と一致（出典: atwiki/page-2080）", () => {
    expectCatalogText("XG4-056", TEXT);
    expectVehicle("XG4-056", { name: "ドラグランザー（バイク形態）", category: "WB", powerCost: "5+", size: "S", features: ["ミラーモンスター", "獣", "車両", "ドラゴン"] });
    expectRarityIn("XG4-056", ["N"]);
  });

  it.fails("XG4-056: 追加条件 — 自軍「ドラグランザー」1体を手札に戻してラッシュできる（出典: atwiki/page-2080「追加条件：自軍「ドラグランザー」1体を手札に戻す」）（既知の不具合: CARD-XG4-056 「ドラグランザー」を手札に戻す追加条件でラッシュできない）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-056", "bk")], rush: [inst("XG4-055", "dr")], command: releasedCat("WB", 1), power: powerCards(5) }), "player1", "XG4-056:bk");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-056:bk")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-055:dr")).toBe("hand");
  });

  it("XG4-056: 追加条件 — 「ドラグランザー」がいなければラッシュできない（出典: atwiki/page-2080）", () => {
    expect(canStartRush(board({ hand: [inst("XG4-056", "bk")], command: releasedCat("WB", 1), power: powerCards(5) }), "player1", "XG4-056:bk")).toBe(false);
  });

  it("XG4-056: ※ — 自分が「ドラグランザー」をラッシュしたとき、自軍エリアの「ドラグランザー（バイク形態）」を1体選び手札に戻す（出典: atwiki/page-2080「自軍エリアに「ドラグランザー（バイク形態）」があれば1体選び手札に戻す」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-055", "dr")], rush: [inst("XG4-056", "bk")], command: releasedCat("WB", 1), power: powerCards(5) }), "player1", "XG4-055:dr");
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    if (s.pendingEffectChoice?.sourceCardId === "XG4-056") {
      expect(choiceIds(s)).toEqual(["XG4-056:bk"]);
      expect(canSkip(s)).toBe(false);
      s = pick(s, "XG4-056:bk");
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG4-055:dr")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-056:bk")).toBe("hand");
  });

  it("XG4-056: ※ — 特徴「サバイブ」を持つ自軍 S ユニットは RC がなくてもライドできる（「サバイブ」も RC も持たないユニットはライドできない）（出典: atwiki/page-2080「RCを持っていなくてもこのビークルにライドすることができ」）", () => {
    const s = battle({ rush: [inst("XG4-056", "bk"), inst("SPEC-SURVIVE", "sv"), inst("SPEC-PLAIN", "p")] });
    expect(canMount(s, "SPEC-SURVIVE:sv", "XG4-056:bk")).toBe(true);
    expect(canMount(s, "SPEC-PLAIN:p", "XG4-056:bk")).toBe(false);
  });

  it("XG4-056: ※ — ライド中 BP+1500（出典: atwiki/page-2080「ライド中BP＋1500される」）", () => {
    const s = settle(mount(battle({ rush: [inst("XG4-056", "bk"), inst("SPEC-SURVIVE", "sv")] }), "SPEC-SURVIVE:sv", "XG4-056:bk"));
    expect(bpOf(s, "player1", "SPEC-SURVIVE:sv")).toBe(2500);
  });
});

// ===========================================================================
describe("XG4-057 仮面ライダー龍騎サバイブ（XG4）", () => {
  const TEXT =
    "※これは常駐置場にカードが1枚もなければ、「SP1」になる。 【叶えたい願い】上にカードが重なっている常駐オペレーションをすべて捨札にしてもよい。そうしたとき、ウラ向きの自軍パワーを1枚選び捨札にしてもよい。";

  it("XG4-057: カタログ本文・スペックが出典と一致（出典: atwiki/page-2135）", () => {
    expectCatalogText("XG4-057", TEXT);
    expectUnit("XG4-057", { name: "仮面ライダー龍騎サバイブ", category: "WB", size: "S", bp: 6000, sp: "1/2", powerCost: 7, comboNumber: "RC", features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"] });
    expectRarityIn("XG4-057", ["R"]);
  });

  it("XG4-057: ※ — 常駐置場にカードが1枚もなければ「SP1」になる（1番目にいても SP1）（出典: atwiki/page-2135「これは常駐置場にカードが1枚もなければ、「SP1」になる」）", () => {
    expect(spOf(battle({ battle: [inst("XG4-057", "ry")] }), "player1", "XG4-057:ry")).toBe(1);
  });

  it("XG4-057: ※ — 自軍の常駐置場にカードがあれば「SP1」にならない（1番目なので分数 SP も0）（出典: atwiki/page-2135「常駐置場にカードが1枚もなければ」）", () => {
    expect(spOf(battle({ battle: [inst("XG4-057", "ry")], operation: [resident("RK-078", "op")] }), "player1", "XG4-057:ry")).toBe(0);
  });

  const rc = () =>
    settle(
      rcRideOff(
        battle(
          { rush: [inst("XG4-057", "ry"), inst("SPEC-BIKE", "bk")], operation: [resident("RK-075", "mw", [faceDown("TST-P", "s1")]), resident("RK-078", "cu")], power: [...powerCards(2), faceDown("TST-P", "dmg")], damage: 1 },
          { operation: [resident("RK-075", "emw", [faceDown("TST-P", "s2")])], deck: deckCards(3, "e") },
        ),
        "XG4-057:ry",
        "SPEC-BIKE:bk",
      ),
    );

  it("XG4-057: RC【叶えたい願い】— ライドオフしたとき、上にカードが重なっている常駐オペレーション（自軍・敵軍）をすべて捨札にするかを選べる（任意）（出典: atwiki/page-2135「上にカードが重なっている常駐オペレーションをすべて捨札にしてもよい」・カード評価「常駐オペレーションをプレイヤーを問わず除去」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG4-057");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-057: RC — 捨札にすると、重なっている常駐（自軍・敵軍）だけが捨札になり、重なっていない常駐は残る。その後、ウラ向きの自軍パワーを1枚捨札にできる（出典: atwiki/page-2135「そうしたとき、ウラ向きの自軍パワーを1枚選び捨札にしてもよい」）", () => {
    let s = rc();
    expectChoiceFrom(s, "player1", "XG4-057");
    s = settle(confirm(s));
    expect(zoneOf(s, "player1", "RK-075:mw")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-075:emw")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-078:cu")).toBe("operation");
    expectChoiceFrom(s, "player1", "XG4-057");
    expect(choiceIds(s)).toEqual(["TST-P:dmg"]);
    s = resolveAll(pick(s, "TST-P:dmg"));
    expect(zoneOf(s, "player1", "TST-P:dmg")).toBe("discard");
    expect(damageOf(s, "player1")).toBe(0);
  });
});
