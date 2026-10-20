/**
 * カード別スペック: RK-176〜RK-182（ザ・マスクドライダーEXP vol.3 仮面ライダー新2号〜Zブリンガー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない（rider_1〜4・rider.html を検索）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-KW-RC-01、R-CN-05、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  attackersOf,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  heldUnit,
  inst,
  legal,
  mount,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RK9-169-189.helpers";

const E4000 = sUnit("SPEC-E4000", { bp: 4000, powerCost: 4 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, powerCost: 3 });
const E4000M = sUnit("SPEC-E4000M", { bp: 4000, powerCost: 4, size: "M" });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E2500 = sUnit("SPEC-E2500", { bp: 2500, powerCost: 2 });
const E9000 = sUnit("SPEC-E9000", { bp: 9000, powerCost: 5 });
const E9000M = sUnit("SPEC-E9000M", { bp: 9000, powerCost: 5, size: "M" });
const L_UNIT = sUnit("SPEC-L", { bp: 2000, powerCost: "7+" as never, size: "L" });
const B500 = sUnit("SPEC-B500", { bp: 500, powerCost: 1, sp: undefined });
const ET_RIDER = rcUnit("SPEC-ET-RIDER", { category: "ET", bp: 1000 });
const WB_RIDER = rcUnit("SPEC-WB-RIDER", { category: "WB", bp: 1000 });
const MULTI_RIDER = rcUnit("SPEC-MULTI-RIDER", { category: ["WB", "MA"] as never, bp: 1000 });
const RIDER3 = rcUnit("SPEC-RIDER3", { category: "ET", bp: 3000 });
const NORC = sUnit("SPEC-NORC", { category: "DA", bp: 1000 });
const WB_VEHICLE = { ...PLAIN_VEHICLE, id: "SPEC-WB-VEHICLE", name: "SPEC-WB-VEHICLE", category: "WB" } as typeof PLAIN_VEHICLE;
const MA_VEHICLE = { ...PLAIN_VEHICLE, id: "SPEC-MA-VEHICLE", name: "SPEC-MA-VEHICLE", category: "MA" } as typeof PLAIN_VEHICLE;
const AMAZON_LIKE = sUnit("SPEC-ATK2000", { bp: 3000, powerCost: 1 });
const EXTRA = [PLAIN_VEHICLE, WB_VEHICLE, MA_VEHICLE, E4000, E3500, E4000M, E2000, E2500, E9000, E9000M, L_UNIT, B500, ET_RIDER, WB_RIDER, MULTI_RIDER, RIDER3, NORC, AMAZON_LIKE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-176 仮面ライダー新2号", () => {
  const TEXT =
    "※これは「仮面ライダー2号」としてつかえる。 【ライダーキック】敵軍バトルエリアから、BP4000以上の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。（この効果は「仮面ライダー1号」からコンビネーションするときは、ナンバーに関係なく発動する）";

  it("RK-176: カタログ本文・スペックが出典と一致（出典: atwiki/page-1085）", () => {
    expectCatalogText("RK-176", TEXT);
    expectStats("RK-176", { name: "仮面ライダー新2号", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: 6, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-176", ["R"]);
  });

  const enemy = { battle: [inst("SPEC-E4000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-E4000M", "m")], rush: [inst("SPEC-E4000", "r")] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-176", "s2"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-176:s2", "SPEC-VEHICLE:v");

  it("RK-176: RC — 敵軍バトルエリアの、BP4000以上の S ユニットだけから1体選ぶ（ラッシュエリア・BP3500・M は対象外。選ばないことはできない）（出典: atwiki/page-1085「敵軍バトルエリアから、BP4000以上の敵軍Sユニットを1体選び」・カード評価「バトルエリア限定」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-176");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-176: RC — 選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1085「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-E4000:a"));
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-E4000:a")?.commandHeld).toBe(true);
  });

  it("RK-176: RC — 持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1085「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(rc({ ...enemy, command: releasedCat("WB", 5) }), "SPEC-E4000:a"));
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("discard");
  });

  it("RK-176: （）書き — 「仮面ライダー1号」（RK-023）の次にライドせずに出ても【ライダーキック】を発動する（出典: atwiki/page-1085「（この効果は「仮面ライダー1号」からコンビネーションするときは、ナンバーに関係なく発動する）」）", () => {
    let s = board({ rush: [inst("RK-023", "s1"), inst("RK-176", "s2")] }, enemy);
    s = passEntry(enter(s, "RK-023:s1"));
    s = enter(s, "RK-176:s2");
    expectChoiceFrom(s, "player1", "RK-176");
  });

  it("RK-176: （）書き — 「仮面ライダー1号」として使える RK-175 仮面ライダー新1号の次でも発動する（出典: atwiki/page-1085・RK-175「※これは「仮面ライダー1号」としてつかえる」・カード評価「1号（新1号含む）からのコンビネーションならば、ビークル無しで能力の発動が可能」）", () => {
    let s = board({ rush: [inst("RK-175", "s1"), inst("RK-176", "s2")] }, enemy);
    s = passEntry(enter(s, "RK-175:s1"));
    s = enter(s, "RK-176:s2");
    expectChoiceFrom(s, "player1", "RK-176");
  });

  it("RK-176: （）書き — 1号以外のユニットの次にライドせずに出たときは発動しない（出典: atwiki/page-1085）", () => {
    let s = board({ rush: [inst("TST-UNIT-0", "f"), inst("RK-176", "s2")] }, enemy);
    s = passEntry(enter(s, "TST-UNIT-0:f"));
    s = enter(s, "RK-176:s2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-176");
  });

  it("RK-176: ※ 「仮面ライダー2号」として使える — RK-163 オルタナティブ・ゼロで敵軍捨札の「仮面ライダー2号」を選べば、同じカード名として新2号を撃破できる（出典: atwiki/page-1085「※これは「仮面ライダー2号」としてつかえる」・atwiki/page-650 Q1「として使える」カードの扱い）", () => {
    let s = rcRideOff(board({ rush: [inst("RK-163", "az"), inst("SPEC-VEHICLE", "v")] }, { battle: [inst("RK-176", "es2")], discard: [inst("RK-073", "d2")] }), "RK-163:az", "SPEC-VEHICLE:v");
    s = pick(s, "RK-073:d2");
    expectChoiceFrom(s, "player1", "RK-163");
    expect(choiceIds(s)).toEqual(["RK-176:es2"]);
  });
});

// ===========================================================================
describe("RK-177 蜂女", () => {
  const TEXT =
    "【催眠音波】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒自分自身のラッシュフェイズを終えるとき、そのターン中にラッシュした自分自身のSユニットをホールドするかしないかを選ぶ。ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない。";

  it("RK-177: カタログ本文・スペックが出典と一致（出典: atwiki/page-909）", () => {
    expectCatalogText("RK-177", TEXT);
    expectStats("RK-177", { name: "蜂女", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["ショッカー", "怪人", "女", "改造人間"] });
    expectRarityIn("RK-177", ["NR"]);
  });

  /** 自軍ラッシュフェイズに TST-UNIT-0:new をラッシュしてから、ラッシュフェイズを終える。 */
  const rushThenEnd = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => {
    const r = rushFromHand(rushPhase({ hand: [inst("TST-UNIT-0", "new")], command: releasedCat("WB", 1), ...p1 }, p2), "player1", "TST-UNIT-0:new");
    expect(r.ok, r.error).toBe(true);
    const end = legal(settle(r.state)).find((a) => a.type === "end_phase");
    expect(end).toBeDefined();
    return act(settle(r.state), end!);
  };

  it("RK-177: 【催眠音波】自軍ラッシュフェイズを終えるとき、そのターンにラッシュした自軍 S ユニットをホールドするかを選ぶ（前からいたユニット・M ユニットは対象外）（出典: atwiki/page-909「自分自身のラッシュフェイズを終えるとき、そのターン中にラッシュした自分自身のSユニットをホールドするかしないかを選ぶ」）", () => {
    const s = rushThenEnd({ rush: [inst("RK-177", "hb"), inst("TST-UNIT-0", "old"), inst("TST-UNIT-2", "m")] });
    expectChoiceFrom(s, "player1", "RK-177");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:new"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-177: ホールドすることを選んだユニットはホールドされ、バトルエリアに出られる（出典: atwiki/page-909・コメント欄「出なくてもいい」）", () => {
    let s = pick(rushThenEnd({ rush: [inst("RK-177", "hb")] }), "TST-UNIT-0:new");
    s = toPhase(settle(s), "player1", "battle");
    expect(s.phase).toBe("battle");
    expect(cardIn(s, "player1", "TST-UNIT-0:new")?.commandHeld).toBe(true);
    expect(canEnter(s, "TST-UNIT-0:new")).toBe(true);
  });

  it("RK-177: ホールドしないことを選んだユニットは、そのターン中バトルエリアに出られない（出典: atwiki/page-909「ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない」）", () => {
    let s = skip(rushThenEnd({ rush: [inst("RK-177", "hb")] }));
    s = toPhase(settle(s), "player1", "battle");
    expect(s.phase).toBe("battle");
    expect(cardIn(s, "player1", "TST-UNIT-0:new")?.commandHeld).toBeFalsy();
    expect(canEnter(s, "TST-UNIT-0:new")).toBe(false);
  });

  it("RK-177: 相手の蜂女でも、自分のラッシュフェイズを終えるときに選ぶ（出典: atwiki/page-909「自分も相手も次の制限を受ける」）", () => {
    const s = rushThenEnd({}, { battle: [inst("RK-177", "ehb")] });
    expectChoiceFrom(s, "player1", "RK-177");
  });

  it("RK-177: 蜂女が場を離れれば、ホールドしなかったユニットも出られるようになる（出典: atwiki/page-909 コメント欄「「自軍エリアにある間」って書いてあるから、蜂女除去できればホールドしてなくても出せる」）", () => {
    let s = skip(rushThenEnd({ rush: [inst("RK-177", "hb")] }));
    s = toPhase(settle(s), "player1", "battle");
    const removed: GameState = { ...s, players: { ...s.players, player1: { ...s.players.player1, rush: s.players.player1.rush.filter((c) => c.cardId !== "RK-177") } } };
    expect(canEnter(removed, "TST-UNIT-0:new")).toBe(true);
  });

  it("RK-177: 蜂女がなければ選ばずにバトルフェイズに進む（出典: atwiki/page-909「これが自軍エリアにある間」）", () => {
    const s = rushThenEnd();
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-177");
    expect(s.phase).toBe("battle");
  });

  it.todo(
    "RK-177: ラッシュしたターンにコール等ですでにホールドされた S ユニットは「ホールドできない」ので出られないか、2体目の蜂女の制限はどう数えるか（出典: atwiki/page-909 コメント欄の質問）— 確かな回答がない（「そうなるんじゃないかな」のみ）ため",
  );
});

// ===========================================================================
describe("RK-178 仮面ライダーアマゾン", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） ※これはライドオフしたときストライクできない。 【大切断】敵軍バトルエリアから、このユニットのBP以下のBPを持つユニットを1体選び撃破してもよい。";

  it("RK-178: カタログ本文・スペックが出典と一致（出典: atwiki/page-952）", () => {
    expectCatalogText("RK-178", TEXT);
    expectStats("RK-178", { name: "仮面ライダーアマゾン", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-178", ["SR"]);
  });

  it("RK-178: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-952「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-178", "am")] }, "RK-178:am"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E2500", "b"), inst("SPEC-L", "l")], rush: [inst("SPEC-E2000", "r")] };
  const rc = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-178", "am"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-178:am", "SPEC-VEHICLE:v");

  it("RK-178: ※ ライドオフしたときはストライクできない（出典: atwiki/page-952「※これはライドオフしたときストライクできない」）", () => {
    const s = settle(rc({ battle: fill(1) }, { battle: [] }));
    expect(canStrike(s, "RK-178:am")).toBe(false);
  });

  it("RK-178: RC【大切断】敵軍バトルエリアから、このユニットの BP（2000）以下の BP を持つユニットを1体選ぶ（サイズを問わない。ラッシュエリアは対象外。任意）（出典: atwiki/page-952「敵軍バトルエリアから、このユニットのBP以下のBPを持つユニットを1体選び撃破してもよい」・コメント欄「大切断の利点はサイズ問わないこと」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-178");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a", "SPEC-L:l"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-178: RC【大切断】選んだユニットを撃破する（出典: atwiki/page-952「撃破してもよい」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-L:l"));
    expect(zoneOf(s, "player2", "SPEC-L:l")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-179 ジャングラー", () => {
  const TEXT =
    "【体当たり攻撃】自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを1体選んでもよい。そうしたとき、選んだユニットの持つカテゴリと、選んだユニットがライドしているビークルの持つカテゴリが違うなら、そのビークルを捨札にした後で、選んだユニットを撃破する。";

  it("RK-179: カタログ本文・スペックが出典と一致（出典: atwiki/page-912）", () => {
    expectCatalogText("RK-179", TEXT);
    expectVehicleStats("RK-179", { name: "ジャングラー", category: "WB", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-179", ["N"]);
  });

  /** 敵軍: ET のライダーが ET ビークル（同じ）に、WB のライダーが ET ビークル（違う）にライド。 */
  const enemy = {
    battle: [
      inst("SPEC-VEHICLE", "same"),
      { ...inst("SPEC-ET-RIDER", "sr"), mountedOnInstanceId: "SPEC-VEHICLE:same" },
      inst("SPEC-VEHICLE", "diff"),
      { ...inst("SPEC-WB-RIDER", "dr"), mountedOnInstanceId: "SPEC-VEHICLE:diff" },
      inst("TST-UNIT-0", "free"),
    ],
  };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => mount(board({ rush: [inst("RK-179", "jg"), inst("SPEC-ET-RIDER", "me")] }, p2), "SPEC-ET-RIDER:me", "RK-179:jg");

  it("RK-179: 自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍 S ユニットから1体選べる（ライドしていないユニットは対象外。任意）（出典: atwiki/page-912「ライド中の敵軍Sユニットを1体選んでもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-179");
    expect(choiceIds(s)).toEqual(["SPEC-ET-RIDER:sr", "SPEC-WB-RIDER:dr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-179: 選んだユニットのカテゴリとビークルのカテゴリが違えば、ビークルを捨札にした後でユニットを撃破する（出典: atwiki/page-912「そのビークルを捨札にした後で、選んだユニットを撃破する」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-WB-RIDER:dr"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:diff")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WB-RIDER:dr")).toBe("discard");
  });

  it("RK-179: カテゴリが同じなら何も起きない（出典: atwiki/page-912「カテゴリが違うなら」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-ET-RIDER:sr"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:same")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ET-RIDER:sr")).toBe("battle");
  });

  it("RK-179: マルチカテゴリのユニットは、カテゴリが1つでもビークルと合っていれば撃破しない（出典: atwiki/page-912 カード評価「カテゴリが一つでも合っていれば【体当たり攻撃】の対象にならない」）", () => {
    const multi = { battle: [inst("SPEC-MA-VEHICLE", "mv"), { ...inst("SPEC-MULTI-RIDER", "mr"), mountedOnInstanceId: "SPEC-MA-VEHICLE:mv" }] };
    const s = resolveAll(pick(entered(multi), "SPEC-MULTI-RIDER:mr"));
    expect(zoneOf(s, "player2", "SPEC-MULTI-RIDER:mr")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-MA-VEHICLE:mv")).toBe("battle");
  });

});

// ===========================================================================
describe("RK-180 モグラ獣人", () => {
  const TEXT =
    "※これはBP2000以上の敵軍Sユニットにアタックされない。 ※これが自分の手札にある間、自軍ラッシュフェイズ中、自軍「仮面ライダーアマゾン」があれば、これを自軍ラッシュエリアに出してもよい。 【神出鬼没】敵軍ラッシュエリアからライドされていないSビークルを1体選んでもよい。そうしたとき、ライドしていない敵軍Sユニットを1体選び、選んだビークルにライドさせる。";

  it("RK-180: カタログ本文・スペックが出典と一致（出典: atwiki/page-910）", () => {
    expectCatalogText("RK-180", TEXT);
    expectStats("RK-180", { name: "モグラ獣人", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 1, comboNumber: 1, features: ["怪人", "男", "改造人間"] });
    expectRarityIn("RK-180", ["NR"]);
  });

  it("RK-180: ※ BP2000以上の敵軍 S ユニットにはアタックされない（BP1000 の S・BP9000 の M にはアタックされる）（出典: atwiki/page-910「※これはBP2000以上の敵軍Sユニットにアタックされない」）", () => {
    const s = enemyTurn({ battle: [inst("RK-180", "mg")] }, { battle: [inst("SPEC-E2000", "s2"), inst("TST-UNIT-0", "s1"), inst("SPEC-E9000M", "m")] });
    expect(attackersOf(s, "RK-180:mg")).toEqual(["SPEC-E9000M:m", "TST-UNIT-0:s1"]);
  });

  const selfRush = (s: GameState) => legal(s).some((a) => a.type === "self_rush_from_zone" && a.instanceId === "RK-180:mg");

  it("RK-180: ※ 手札にある間、自軍ラッシュフェイズ中、自軍「仮面ライダーアマゾン」があれば自軍ラッシュエリアに出せる（出典: atwiki/page-910「自軍「仮面ライダーアマゾン」があれば、これを自軍ラッシュエリアに出してもよい」）", () => {
    expect(selfRush(rushPhase({ hand: [inst("RK-180", "mg")], rush: [inst("RK-178", "am")] }))).toBe(true);
    expect(selfRush(rushPhase({ hand: [inst("RK-180", "mg")] }))).toBe(false);
  });

  /** 1番目に出して NC（CN1）を成立させる。 */
  const nc = (p2: Partial<GameState["players"]["player2"]>) => enter(board({ rush: [inst("RK-180", "mg")] }, p2), "RK-180:mg");
  const enemy = {
    rush: [inst("SPEC-VEHICLE", "free"), inst("SPEC-VEHICLE", "rid"), { ...inst("SPEC-ET-RIDER", "on"), mountedOnInstanceId: "SPEC-VEHICLE:rid" }, inst("SPEC-ET-RIDER", "r1"), inst("SPEC-NORC", "n1")],
    battle: [inst("SPEC-WB-RIDER", "b1")],
  };

  it("RK-180: NC【神出鬼没】敵軍ラッシュエリアの、ライドされていない S ビークルから1体選べる（任意）（出典: atwiki/page-910「敵軍ラッシュエリアからライドされていないSビークルを1体選んでもよい」）", () => {
    const s = nc(enemy);
    expectChoiceFrom(s, "player1", "RK-180");
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:free"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-180: NC【神出鬼没】そうしたとき、ライドしていない敵軍 S ユニット（ライドできるもの。RC を持たないユニットは対象外）を1体選ぶ（出典: atwiki/page-910「ライドしていない敵軍Sユニットを1体選び」・カード評価「RCをもってないSユニットを強制的にライドさせる事は公式の回答で出来ない」）", () => {
    const s = pick(nc(enemy), "SPEC-VEHICLE:free");
    expectChoiceFrom(s, "player1", "RK-180");
    expect(choiceIds(s)).toEqual(["SPEC-ET-RIDER:r1", "SPEC-WB-RIDER:b1"]);
  });

  it("RK-180: NC【神出鬼没】選んだユニットを選んだビークルにライドさせる（バトルエリアのユニットはラッシュエリアに戻ってライドする）（出典: atwiki/page-910「選んだビークルにライドさせる」・カード評価「選んだユニットはラッシュエリアに戻ってビークルにライドする」）", () => {
    const s = resolveAll(pick(pick(nc(enemy), "SPEC-VEHICLE:free"), "SPEC-WB-RIDER:b1"));
    expect(zoneOf(s, "player2", "SPEC-WB-RIDER:b1")).toBe("rush");
    expect(cardIn(s, "player2", "SPEC-WB-RIDER:b1")?.mountedOnInstanceId).toBe("SPEC-VEHICLE:free");
  });
});

// ===========================================================================
describe("RK-181 仮面ライダーシン", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ハイバイブネイル】自軍ターン中、これがバトルエリアに出たとき、WBを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは次の能力を得る⇒SP1/5になり、これとバトルしたSユニットは、バトルに勝っても撃破される。";

  it("RK-181: カタログ本文・スペックが出典と一致（出典: atwiki/page-761）", () => {
    expectCatalogText("RK-181", TEXT);
    expectStats("RK-181", { name: "仮面ライダーシン", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 2, features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-181", ["NR"]);
  });

  it("RK-181: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-761「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-181", "sn")] }, "RK-181:sn"))).toBe(true);
  });

  /** fillers の後にシンを出す（WB のコマンドを持つ）。 */
  const entered = (fillers = 0, p2: Partial<GameState["players"]["player2"]> = {}, command = [...releasedCat("WB", 1), ...releasedCat("ET", 1)]) =>
    enter(board({ battle: fill(fillers), rush: [inst("RK-181", "sn")], command }, p2), "RK-181:sn");

  it("RK-181: 自軍ターン中、バトルエリアに出たとき、WB を持つ自軍コマンドを1つホールドしてもよい（任意）（出典: atwiki/page-761「WBを持つ自軍コマンドを1つホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-181");
    expect(choiceIds(s)).toEqual(["TST-OP:cWB0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-181: WB を持つリリース状態の自軍コマンドがなければ発動しない（出典: atwiki/page-761）", () => {
    const s = entered(0, {}, releasedCat("ET", 2));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-181");
  });

  it("RK-181: ホールドしたら、このターン SP1/5 になる（5番目に並べば SP1）（出典: atwiki/page-761「SP1/5になり」・R-STK-03）", () => {
    const s = settle(pick(entered(4), "TST-OP:cWB0"));
    expect(spOf(s, "player1", "RK-181:sn")).toBe(1);
  });

  it("RK-181: ホールドしたら、これとバトルした S ユニットはバトルに勝っても撃破される（出典: atwiki/page-761「これとバトルしたSユニットは、バトルに勝っても撃破される」）", () => {
    let s = settle(pick(entered(0, { battle: [inst("SPEC-E9000", "big")] }), "TST-OP:cWB0"));
    s = resolveAll(attack(s, "RK-181:sn", "SPEC-E9000:big"));
    expect(zoneOf(s, "player2", "SPEC-E9000:big")).toBe("discard");
  });

  it("RK-181: バトルした相手が M ユニットなら、勝った相手は撃破されない（出典: atwiki/page-761「Sユニットは」）", () => {
    let s = settle(pick(entered(0, { battle: [inst("SPEC-E9000M", "bigm")] }), "TST-OP:cWB0"));
    s = resolveAll(attack(s, "RK-181:sn", "SPEC-E9000M:bigm"));
    expect(zoneOf(s, "player2", "SPEC-E9000M:bigm")).toBe("battle");
  });

  it("RK-181: ホールドしなければ、勝った相手は撃破されない（出典: atwiki/page-761「そうしたとき」）", () => {
    let s = settle(skip(entered(0, { battle: [inst("SPEC-E9000", "big")] })));
    s = resolveAll(attack(s, "RK-181:sn", "SPEC-E9000:big"));
    expect(zoneOf(s, "player2", "SPEC-E9000:big")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-182 Zブリンガー", () => {
  const TEXT = "【Zブリンガーアタック】これにライドしているユニットがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";

  it("RK-182: カタログ本文・スペックが出典と一致（出典: atwiki/page-913）", () => {
    expectCatalogText("RK-182", TEXT);
    expectVehicleStats("RK-182", { name: "Zブリンガー", category: "ET", powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-182", ["N"]);
  });

  /** BP+3000 された敵軍ユニット（本来 BP2000）。 */
  const enemy = { battle: [{ ...inst("SPEC-E2000", "boost"), bpModifier: 3000 }] };

  it("RK-182: これにライドしているユニットがアタックするとき、敵軍ユニットの BP を本来の値としてバトルする（BP+3000 されていても本来の2000）（出典: atwiki/page-913「敵軍ユニットのBPをカードに表記された本来の値としてバトルする」）", () => {
    let s = mount(board({ rush: [inst("RK-182", "zb"), inst("SPEC-RIDER3", "r")] }, enemy), "SPEC-RIDER3:r", "RK-182:zb");
    s = act(settle(s), { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    expect(bpOf(s, "player2", "SPEC-E2000:boost")).toBe(5000);
    s = resolveAll(attack(settle(s), "SPEC-RIDER3:r", "SPEC-E2000:boost"));
    expect(zoneOf(s, "player2", "SPEC-E2000:boost")).toBe("discard");
  });

  it("RK-182: ライドしていないユニットのアタックでは本来の値にならない（出典: atwiki/page-913「これにライドしているユニットが」）", () => {
    let s = board({ rush: [inst("SPEC-ATK2000", "a")] }, enemy);
    s = resolveAll(attack(enter(s, "SPEC-ATK2000:a"), "SPEC-ATK2000:a", "SPEC-E2000:boost"));
    expect(zoneOf(s, "player2", "SPEC-E2000:boost")).toBe("battle");
  });
});
