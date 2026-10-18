/**
 * カード別スペック: RK-218〜RK-224（ザ・マスクドライダーEXP vol.3 ピーコックアンデッド〜京介変身体）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない（rider_1〜4・rider.html を検索）。
 *     atwiki に転載された公式 Q&A（RK-218 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-05、R-KW-RESIST、R-ADD 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの:
 *  - RK-218 Q1（ピーコックアンデッドで満たした XG5-056 の追加条件ではガンマジンでドローできない）— cardSpec/RS8-538-559.d.test.ts RS-558
 *    （atwiki/page-1186 Q5 と同じ問い。本バッチで it.todo から実テストにした）
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  NOSP_ATTACKER,
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  deckWithTen,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  holdOnField,
  inst,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  rcRideOff,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  rushed,
  skip,
  spOf,
  st,
  sUnit,
  toTurnEnd,
  zordDownTests,
  zoneOf,
} from "./RK11-211-231.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, powerCost: 3 });
const E5000M = sUnit("SPEC-E5000M", { bp: 5000, powerCost: 3, size: "M" });
/** 特徴「アンデッド」を持つ S ユニット（SP「－」）。 */
const UNDEAD = sUnit("SPEC-UNDEAD", { category: "DA", bp: 1000, sp: undefined, features: ["アンデッド"] });
/** 特徴「猛士」を持つ S ユニット。 */
const TAKESHI = sUnit("SPEC-TAKESHI", { category: "MA", bp: 1000, features: ["仮面ライダー", "猛士"] });
const OP_MA = { id: "SPEC-OPMA", name: "SPEC-OPMA", type: "operation", category: "MA", rarity: "N", expansion: "card-spec", powerCost: 1 } as never;
const EXTRA = [PLAIN_VEHICLE, NOSP_ATTACKER, C1, C2, C3, M2, E5000, E5000M, UNDEAD, TAKESHI, OP_MA];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

/** 敵軍ターン中に、敵軍の RK-139 ゼロノスAF【俺はかーなーり強い】（RC）で自軍ラッシュエリアの id をバトルエリアに出させる。 */
function enteredInEnemyTurn(id: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  let s = enemyTurn({ ...p1, rush: [inst(id.split(":")[0]!, id.split(":")[1]!), ...(p1.rush ?? [])] }, { ...p2, rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v"), ...(p2.rush ?? [])] });
  s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
  s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
  return pick(s, id);
}

// ===========================================================================
describe("RK-218 ピーコックアンデッド", () => {
  const TEXT =
    "※これが自分の手札にある間、自分が「仮面ライダーギャレンJF」をラッシュするとき、これを捨札にすれば、自軍「仮面ライダーギャレン」1体を捨札にしたことにできる。 【下級アンデッドを操る者】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから、特徴｢アンデッド｣を持つ自軍ユニットを1体選んでも良い。そうしたとき、選んだユニットは、このターン「SP1」になり、ターンを終えるとき撃破される。";

  it("RK-218: カタログ本文・スペックが出典と一致（出典: atwiki/page-945）", () => {
    expectCatalogText("RK-218", TEXT);
    expectStats("RK-218", { name: "ピーコックアンデッド", category: "DA", size: "S", bp: 3500, sp: undefined, powerCost: 5, features: ["アンデッド", "獣"] });
    expectRarityIn("RK-218", ["N"]);
  });

  it("RK-218: ※ 手札にあるこれを捨札にすれば、「仮面ライダーギャレン」を捨札にしたことにして、RK-210 仮面ライダーギャレンJF を必要パワー0でラッシュできる（出典: atwiki/page-945「これを捨札にすれば、自軍「仮面ライダーギャレン」1体を捨札にしたことにできる」）", () => {
    const s0 = rushPhase({ hand: [inst("RK-210", "gj"), inst("RK-218", "pc")], command: releasedCat("WB", 1), power: [] });
    const r = rushVia(s0, "player1", "RK-210:gj", (a) => a.zordMaterialInstanceId === "RK-218:pc");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-210:gj")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-218:pc")).toBe("discard");
  });

  /** XG5-056 仮面ライダーギャレンJF（3+。追加条件「自軍「仮面ライダーギャレン」1体を捨札にする」）を、手札のピーコックアンデッドを捨札にしてラッシュする。 */
  const xg5Rush = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushFromHand(rushPhase({ hand: [inst("XG5-056", "gj"), inst("RK-218", "pc")], command: releasedCat("WB", 1), power: powerCards(3), ...p1 }), "player1", "XG5-056:gj", { materials: ["RK-218:pc"] });

  it("RK-218: ※ XG5-056 仮面ライダーギャレンJF（追加条件「自軍「仮面ライダーギャレン」1体を捨札にする」）も、手札のこれを捨札にしてラッシュできる（出典: atwiki/page-945 Q1「「XG5-056 仮面ライダーギャレンJF」の追加条件を満たすときに「RK-218 ピーコックアンデッド」を捨札にすることでラッシュしました」）", () => {
    const r = xg5Rush();
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG5-056:gj")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-218:pc")).toBe("discard");
  });


  const enemy = {};
  const entered = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ rush: [inst("RK-218", "pc"), inst("RK-219", "ar"), inst("SPEC-UNDEAD", "un"), inst("SPEC-C1", "c")], battle: [inst("SPEC-UNDEAD", "ub")], ...p1 }, enemy), "RK-218:pc");

  it("RK-218: 【下級アンデッドを操る者】自軍ターン中、バトルエリアに出たとき、自軍ラッシュエリアの特徴「アンデッド」を持つ自軍ユニットから1体選べる（任意。バトルエリアのユニットは対象外）（出典: atwiki/page-945「自軍ラッシュエリアから、特徴｢アンデッド｣を持つ自軍ユニットを1体選んでも良い」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-218");
    expect(choiceIds(s)).toEqual(["RK-219:ar", "SPEC-UNDEAD:un"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-218: 選んだユニット（SP「－」のアルビローチ）は、このターン「SP1」になる（出典: atwiki/page-945「選んだユニットは、このターン「SP1」になり」）", () => {
    const s = resolveAll(pick(entered(), "RK-219:ar"));
    expect(spOf(s, "player1", "RK-219:ar")).toBe(1);
  });

  it("RK-218: 選んだユニットは、ターンを終えるとき撃破される（出典: atwiki/page-945「ターンを終えるとき撃破される」）", () => {
    let s = passEntry(resolveAll(pick(entered(), "RK-219:ar")));
    s = resolveAll(toTurnEnd(s));
    expect(zoneOf(s, "player1", "RK-219:ar")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-UNDEAD:un")).toBe("rush");
  });

  it("RK-218: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-945「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-218:pc", { rush: [inst("RK-219", "ar")] });
    expect(zoneOf(s, "player1", "RK-218:pc")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-218");
  });
});

// ===========================================================================
describe("RK-219 アルビローチ", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RK-219: カタログ本文・スペックが出典と一致（出典: atwiki/page-946）", () => {
    expectCatalogText("RK-219", TEXT);
    expectStats("RK-219", { name: "アルビローチ", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 3, features: ["アンデッド", "昆虫"] });
    expectRarityIn("RK-219", ["N"]);
  });

  it("RK-219: ※ デッキに好きな枚数（10枚）入れられる（出典: atwiki/page-946「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RK-219", "アルビローチ")).toBe(true);
  });
});

// ===========================================================================
describe("RK-220 アルビノジョーカー", () => {
  const TEXT =
    "※これは自軍ラッシュエリアの特徴「アンデッド」を持つユニットを1体捨札にしなければバトルエリアに出られない。 【アンデッドを従える者】これが自軍エリアにある間、自軍ラッシュフェイズ中、自軍｢アルビローチ｣をラッシュしたとき次の効果を発動できる⇒自軍「アルビローチ」の数を数えて、その数と同じ必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";

  it("RK-220: カタログ本文・スペックが出典と一致（出典: atwiki/page-947）", () => {
    expectCatalogText("RK-220", TEXT);
    expectStats("RK-220", { name: "アルビノジョーカー", category: "DA", size: "S", bp: 6500, sp: 1, powerCost: "4+", features: ["アンデッド"], rushCondition: "discard_named_unit" });
    expectRarityIn("RK-220", ["NR"]);
  });

  it("RK-220: 追加条件 — 自軍「仮面ライダーグレイブ」1体を捨札にして、パワー4でラッシュできる（出典: atwiki/page-947「必要パワー：4+」「追加条件：自軍｢仮面ライダーグレイブ｣1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-220", "aj")], rush: [inst("RK-213", "gr")], command: releasedCat("DA", 1), power: powerCards(4) }), "player1", "RK-220:aj", { materials: ["RK-213:gr"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-220:aj")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-213:gr")).toBe("discard");
  });

  it("RK-220: 「仮面ライダーグレイブ」がいなければラッシュできない（出典: atwiki/page-947「追加条件」）", () => {
    expect(canStartRush(rushPhase({ hand: [inst("RK-220", "aj")], command: releasedCat("DA", 1), power: powerCards(4) }), "player1", "RK-220:aj")).toBe(false);
  });

  it("RK-220: ※ 自軍ラッシュエリアに特徴「アンデッド」を持つほかのユニットがなければバトルエリアに出られない（出典: atwiki/page-947「捨札にしなければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-220", "aj"), inst("SPEC-C1", "c")], battle: [inst("SPEC-UNDEAD", "ub")] }), "RK-220:aj")).toBe(false);
  });

  it("RK-220: ※ 自軍ラッシュエリアの「アンデッド」を1体捨札にしてバトルエリアに出られる（出典: atwiki/page-947）", () => {
    let s = board({ rush: [inst("RK-220", "aj"), inst("SPEC-UNDEAD", "un")] });
    expect(canEnter(s, "RK-220:aj")).toBe(true);
    s = resolveAll(enter(s, "RK-220:aj"), ["SPEC-UNDEAD:un"]);
    // 捨札にしたあと、あらためてバトルエリアに出す（RK-032 アナザーアギトの※と同じ手続き。cardSpec/RK2-022-042.b.test.ts）。
    if (zoneOf(s, "player1", "RK-220:aj") === "rush") s = enter(s, "RK-220:aj");
    expect(zoneOf(s, "player1", "RK-220:aj")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-UNDEAD:un")).toBe("discard");
  });

  const enemy = { battle: [inst("SPEC-C2", "b"), inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  /** アルビノジョーカーとアルビローチ1体が自軍ラッシュエリアにあり、手札のアルビローチをラッシュする（場のアルビローチは2体になる）。 */
  const roach = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rushed(rushPhase({ hand: [inst("RK-219", "h")], rush: [inst("RK-220", "aj"), inst("RK-219", "r1")], command: releasedCat("DA", 1), power: powerCards(3), ...p1 }, p2), "RK-219:h");

  it("RK-220: 【アンデッドを従える者】自軍ラッシュフェイズ中、自軍「アルビローチ」をラッシュしたとき、発動するかを選べ、自軍「アルビローチ」の数（2）と同じ必要パワーの数字を持つ敵軍ユニット（サイズ・エリアを問わない）から1体選ぶ（出典: atwiki/page-947「その数と同じ必要パワーの数字を持つ敵軍ユニットを1体選び撃破する」）", () => {
    const s = roach();
    expectChoiceFrom(s, "player1", "RK-220");
    expect(choiceIds(s)).toEqual(["SPEC-C2:b", "SPEC-C2:r", "SPEC-M2:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-220: 選んだユニットを撃破する（出典: atwiki/page-947「1体選び撃破する」）", () => {
    const s = resolveAll(pick(roach(), "SPEC-M2:m"));
    expect(zoneOf(s, "player2", "SPEC-M2:m")).toBe("discard");
  });

  it("RK-220: アルビローチ以外のユニットをラッシュしても発動しない（出典: atwiki/page-947「自軍｢アルビローチ｣をラッシュしたとき」）", () => {
    const s = rushed(rushPhase({ hand: [inst("SPEC-C1", "h")], rush: [inst("RK-220", "aj"), inst("RK-219", "r1")], command: releasedCat("WB", 1), power: powerCards(3) }, enemy), "SPEC-C1:h");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-220");
  });

  it("RK-220: アルビノジョーカーが場になければ発動しない（出典: atwiki/page-947「これが自軍エリアにある間」）", () => {
    const s = roach({ rush: [inst("RK-219", "r1")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-220");
  });
});

// ===========================================================================
/** 「「SP1」になり、このターンを終えるときホールド状態なら、リリースしてもよい」の共通テスト。after は能力を得た直後の state。 */
function sp1ReleaseTests(id: string, page: string, after: () => GameState) {
  it(`${id}: このターン「SP1」になる（出典: ${page}「このターン、これは次の能力を得る⇒「SP1」になり」）`, () => {
    expect(spOf(after(), "player1", `${id}:me`)).toBe(1);
  });

  it(`${id}: このターンを終えるときホールド状態なら、リリースするかを選べ（任意）、選ぶとリリース状態になる（出典: ${page}「このターンを終えるときホールド状態なら、リリースしてもよい」）`, () => {
    let s = toTurnEnd(holdOnField(passEntry(after()), "player1", `${id}:me`), id);
    expectChoiceFrom(s, "player1", id);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(confirm(s));
    expect(cardIn(s, "player1", `${id}:me`)?.commandHeld ?? false).toBe(false);
  });

  it(`${id}: ターンを終えるときリリース状態なら何もしない（出典: ${page}「ホールド状態なら」）`, () => {
    const s = toTurnEnd(passEntry(after()), id);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
  });
}

describe("RK-221 仮面ライダー響鬼", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨て札にするかわりにこれをホールドしてその場に留めてもよい） 【音撃打・火炎連打】自分の手札からオペレーションカードを1枚選び、捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを終えるときホールド状態なら、リリースしてもよい。";

  it("RK-221: カタログ本文・スペックが出典と一致（出典: atwiki/page-955）", () => {
    expectCatalogText("RK-221", TEXT);
    expectStats("RK-221", { name: "仮面ライダー響鬼", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: 1, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-221", ["SR"]);
  });

  it("RK-221: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-955「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-221", "me")] }, "RK-221:me"))).toBe(true);
  });

  const nc = (hand = [inst("TST-OP", "op"), inst("SPEC-C1", "u")]) => ncEnter("RK-221:me", 0, { hand }, {}, EXTRA);

  it("RK-221: 【音撃打・火炎連打】NC — 手札のオペレーションカード（ユニットカードは対象外）から1枚選んで捨札にできる（任意）（出典: atwiki/page-955「自分の手札からオペレーションカードを1枚選び、捨札にしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-221");
    expect(choiceIds(s)).toEqual(["TST-OP:op"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-221: 選んだオペレーションカードは捨札になる（出典: atwiki/page-955）", () => {
    const s = resolveAll(pick(nc(), "TST-OP:op"));
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
  });

  it("RK-221: 手札にオペレーションカードがなければ発動しない（出典: atwiki/page-955）", () => {
    const s = nc([inst("SPEC-C1", "u")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-221");
  });

  it("RK-221: 捨札にしなければ SP は変わらない（1番目の SP1/3 は SP なし）（出典: atwiki/page-955「そうしたとき」）", () => {
    const s = resolveAll(skip(nc()));
    expect(spOf(s, "player1", "RK-221:me")).toBe(0);
  });

  sp1ReleaseTests("RK-221", "atwiki/page-955", () => resolveAll(pick(nc(), "TST-OP:op")));
});

describe("RK-222 仮面ライダー響鬼紅", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨て札にするかわりにこれをホールドしてその場に留めてもよい） ※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダー響鬼」のカードを1枚選び、自軍ラッシュエリアに出す。 【音撃打・灼熱真紅の型】MAを持つコマンドを2つホールドしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを終えるときホールド状態なら、リリースしてもよい。";

  it("RK-222: カタログ本文・スペックが出典と一致（出典: atwiki/page-874）", () => {
    expectCatalogText("RK-222", TEXT);
    expectStats("RK-222", { name: "仮面ライダー響鬼紅", category: "MA", size: "S", bp: 4500, sp: "1/3", powerCost: "7-", comboNumber: 1, features: ["仮面ライダー", "男", "猛士"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-222", ["SR"]);
  });

  it("RK-222: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-874「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-222", "me")] }, "RK-222:me"))).toBe(true);
  });

  zordDownTests("RK-222", "RK-221", "仮面ライダー響鬼", "atwiki/page-874", "MA");
  reanimateTests("RK-222", "RK-221", "仮面ライダー響鬼", "atwiki/page-874");

  const nc = (command = [...releasedCat("MA", 2, "ma"), ...releasedCat("WB", 1)]) => ncEnter("RK-222:me", 0, { command }, {}, EXTRA);

  it("RK-222: 【音撃打・灼熱真紅の型】NC — MA を持つリリース状態のコマンドを2つホールドできる（任意。MA 以外は対象外）（出典: atwiki/page-874「MAを持つコマンドを2つホールドしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-222");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:ma0", "TST-OP-MA:ma1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-222: 2つ選ぶと、選んだ MA のコマンドがホールド状態になる（出典: atwiki/page-874）", () => {
    const s = resolveAll(pick(pick(nc(), "TST-OP-MA:ma0"), "TST-OP-MA:ma1"));
    expect(s.players.player1.command.filter((c) => c.commandHeld).map((c) => c.instanceId).sort()).toEqual(["TST-OP-MA:ma0", "TST-OP-MA:ma1"]);
  });

  it("RK-222: MA のリリース状態のコマンドが1つしかなければ発動しない（出典: atwiki/page-874「2つホールドしてもよい」）", () => {
    const s = nc([...releasedCat("MA", 1, "ma"), ...releasedCat("WB", 2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-222");
  });

  sp1ReleaseTests("RK-222", "atwiki/page-874", () => resolveAll(pick(pick(nc(), "TST-OP-MA:ma0"), "TST-OP-MA:ma1")));
});

// ===========================================================================
describe("RK-223 仮面ライダー威吹鬼", () => {
  const TEXT =
    "【音撃射・疾風一閃】自軍山札の上から3枚をオモテにしてもよい。そうしたとき、敵軍山札の上から3枚をオモテにする。そして、オモテにしたカードの中から「SP1」を持つSユニットのカードをすべて捨札にし、それ以外を持ち主の山札に戻してシャッフルする。（この効果は、特徴「猛士」を持つユニットからコンビネーションする時、ナンバーに関係なく発動する）";

  it("RK-223: カタログ本文・スペックが出典と一致（出典: atwiki/page-1087）", () => {
    expectCatalogText("RK-223", TEXT);
    expectStats("RK-223", { name: "仮面ライダー威吹鬼", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-223", ["SR"]);
  });

  // 自軍山札: SP1 の S ユニット・SP1 の L ユニット・オペレーション、その下に1枚。敵軍山札: SP1 の S ユニット・SP「－」の S ユニット・オペレーション、その下に1枚。
  const decks = {
    p1: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-7", "l1"), inst("TST-OP", "o1"), inst("TST-UNIT-0", "rest")],
    p2: [inst("TST-UNIT-0", "es"), inst("SPEC-UNDEAD", "en"), inst("TST-OP", "eo"), inst("TST-UNIT-0", "erest")],
  };
  const rc = () =>
    rcRideOff(board({ rush: [inst("RK-223", "ib"), inst("SPEC-VEHICLE", "v")], deck: decks.p1 }, { deck: decks.p2 }), "RK-223:ib", "SPEC-VEHICLE:v");

  it("RK-223: 【音撃射・疾風一閃】RC — 自軍山札の上から3枚をオモテにするかを選べる（任意）（出典: atwiki/page-1087「自軍山札の上から3枚をオモテにしてもよい」・R-KW-RC-01）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-223");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-223: オモテにすると、自軍・敵軍の山札の上から3枚のうち「SP1」を持つ S ユニットのカードをすべて捨札にし、それ以外（L ユニット・SP なし・オペレーション）は持ち主の山札に戻す（出典: atwiki/page-1087「「SP1」を持つSユニットのカードをすべて捨札にし、それ以外を持ち主の山札に戻してシャッフルする」）", () => {
    const s = resolveAll(confirm(rc()));
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:es")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-7:l1")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-OP:o1")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-UNDEAD:en")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-OP:eo")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-UNIT-0:rest")).toBe("deck");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(s.players.player2.deck).toHaveLength(3);
  });

  it("RK-223: オモテにしなければ何も起きない（出典: atwiki/page-1087「オモテにしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(rc()));
    expect(s.players.player1.deck).toHaveLength(4);
    expect(s.players.player2.deck).toHaveLength(4);
  });

  it("RK-223: （）書き — 特徴「猛士」を持つユニットの次にライドせずに出ても発動する（出典: atwiki/page-1087「（この効果は、特徴「猛士」を持つユニットからコンビネーションする時、ナンバーに関係なく発動する）」・R-CN-05）", () => {
    let s = board({ rush: [inst("SPEC-TAKESHI", "tk"), inst("RK-223", "ib")], deck: decks.p1 }, { deck: decks.p2 });
    s = passEntry(enter(s, "SPEC-TAKESHI:tk"));
    s = enter(s, "RK-223:ib");
    expectChoiceFrom(s, "player1", "RK-223");
  });

  it("RK-223: （）書き — 「猛士」を持たないユニットの次にライドせずに出ても発動しない（出典: atwiki/page-1087）", () => {
    let s = board({ rush: [inst("SPEC-C1", "c"), inst("RK-223", "ib")], deck: decks.p1 }, { deck: decks.p2 });
    s = passEntry(enter(s, "SPEC-C1:c"));
    s = enter(s, "RK-223:ib");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-223");
  });

  it.todo(
    "RK-223: ユニットでないときに条件つきで SP1 になるカード（XG4 仮面ライダー龍騎サバイブ等）をオモテにしたとき（出典: atwiki/page-1087 カード評価「SP1になる条件を満たしていれば効果の対象になる」）— 本範囲外のカードの条件の判定が要り、山札の上のカードで条件を確かめる手段がない",
  );
});

// ===========================================================================
describe("RK-224 京介変身体", () => {
  const TEXT =
    "【サポート】これが自軍エリアにある間、敵軍バトルエリアのSユニットは、「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれているかのように扱う。";

  it("RK-224: カタログ本文・スペックが出典と一致（出典: atwiki/page-900）", () => {
    expectCatalogText("RK-224", TEXT);
    expectStats("RK-224", { name: "京介変身体", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 3, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-224", ["N"]);
  });

  /** 自軍ターンに、自軍の attacker（SP1・BP1000 の TST-UNIT-0 など）が敵軍の defender にアタックする。 */
  const fight = (attacker: string, defender: string, kyosuke = true) => {
    const [aid, asuf] = attacker.split(":") as [string, string];
    const [did, dsuf] = defender.split(":") as [string, string];
    const s = board({ battle: [inst(aid, asuf)], rush: kyosuke ? [inst("RK-224", "ky")] : [] }, { battle: [inst(did, dsuf)] });
    return resolveAll(attack(s, attacker, defender));
  };

  it("RK-224: 【サポート】自軍ターン中、SP1 の自軍ユニットとバトルした敵軍バトルエリアの S ユニットは、バトルに勝っても撃破される（出典: atwiki/page-900「敵軍バトルエリアのSユニットは、「これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」と書かれているかのように扱う」）", () => {
    const s = fight("TST-UNIT-0:a", "SPEC-E5000:e");
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("discard");
  });

  it("RK-224: 京介変身体が場になければ、勝った敵軍ユニットは残る（出典: atwiki/page-900「これが自軍エリアにある間」）", () => {
    const s = fight("TST-UNIT-0:a", "SPEC-E5000:e", false);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
  });

  it("RK-224: SP「－」の自軍ユニットとのバトルに勝った敵軍ユニットは残る（出典: atwiki/page-900「SP1以上のユニットとバトルしたとき」）", () => {
    const s = fight("SPEC-NOSP:a", "SPEC-E5000:e");
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
  });

  it("RK-224: 敵軍の M ユニットは対象外（勝っても残る）（出典: atwiki/page-900「敵軍バトルエリアのSユニットは」）", () => {
    const s = fight("TST-UNIT-0:a", "SPEC-E5000M:e");
    expect(zoneOf(s, "player2", "SPEC-E5000M:e")).toBe("battle");
  });

  it("RK-224: 敵軍ターン中に敵軍ユニットがアタックして勝ったときは撃破されない（「敵軍ターン中」はそのユニットから見た敵軍＝自分のターン）（出典: atwiki/page-900「これは敵軍ターン中、」）", () => {
    let s = enemyTurn({ battle: [inst("TST-UNIT-0", "d")], rush: [inst("RK-224", "ky")] }, { battle: [inst("SPEC-E5000", "e")] });
    s = resolveAll(attack(s, "SPEC-E5000:e", "TST-UNIT-0:d", "player2"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
  });
});
