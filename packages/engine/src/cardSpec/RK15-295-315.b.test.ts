/**
 * カード別スペック: RK-302〜RK-308（ザ・マスクドライダーEXP vol.4 スコルピオワーム〜リュウタロス（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-302」〜「RK-308」とカード名で検索。rider_1・rider_2・card_6 の「電王」「リュウタロス」は RK-061・RK-062・RK-140・RK-145・RK-152・RK-168 の項）。
 *     atwiki に転載された公式 Q&A（RK-304 Q1・RK-305 Q1・Q2・RK-306 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH・R-CN-02・R-TGT-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 *
 * 既存の照合と重なるもの: RK-304 Q1・RK-305 Q1・RK-306 Q1（RK-193 ズー【パームニードル】がモーフより先に発動する）は RK10-190-210.a の RK-193 で
 * 照合済みのため重ねない。RK-303 のデッキ枚数（好きな枚数・RK-137 と同名）は rulesSpec/01-overview-deck R-DECK-03 で、RK-306 と RK-062 の同名は
 * R-DECK-04 で照合済み。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  canEndPhase,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  enemyBoard,
  enemyEnter,
  enemyRushes,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  held,
  heldUnit,
  inst,
  morphCandidates,
  ncEnter,
  p1Battle,
  pick,
  pickAll,
  pickAs,
  powerCards,
  rcRideOff,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  unitActions,
  zoneOf,
} from "./RK15-295-315.helpers";

const KW_MORPH =
  "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 1000, powerCost: 1, features: ["怪人"] });
const WORM = sUnit("SPEC-WORM", { category: "DA", bp: 1000, powerCost: 1, features: ["ワーム"] });
const MALE = sUnit("SPEC-MALE", { bp: 1000, powerCost: 1, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 1000, powerCost: 1, features: ["女"] });
const NOFEAT = sUnit("SPEC-NOFEAT", { bp: 1000, powerCost: 1, features: [] });
const BEAST = sUnit("SPEC-BEAST", { bp: 1000, powerCost: 1, features: ["獣"] });
const DA1 = sUnit("SPEC-DA1", { category: "DA", bp: 1000, powerCost: 1 });
const DA3 = sUnit("SPEC-DA3", { category: "DA", bp: 1000, powerCost: 3 });
const WB3 = sUnit("SPEC-WB3", { category: "WB", bp: 1000, powerCost: 3 });
const DA3M = sUnit("SPEC-DA3M", { category: "DA", bp: 1000, powerCost: 3, size: "M" });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, sp: 1 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, sp: 1 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 1000, powerCost: 1, features: ["仮面ライダー", "男", "DEN-O", "2nd"] });
const BEAST_OP = { id: "SPEC-BEAST-OP", name: "SPEC-BEAST-OP", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 1, features: ["獣"] } as unknown as CardDefinition;
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const EXTRA = [PLAIN_VEHICLE, RCU, ENEMY0, KAIJIN, WORM, MALE, FEMALE, NOFEAT, BEAST, DA1, DA3, WB3, DA3M, C3, C4, E2000, E3000, E3500, E4000, E5000, EM2000, DENO, BEAST_OP, MORPH];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

/** 電王（2nd）の※モーフの共通テスト（特徴「仮面ライダー／男／DEN-O／2nd」が完全一致する電王（2nd）と置き換えられる）。 */
function denOMorphTests(id: string, partnerId: string, page: string): void {
  it(`${id}: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍パワーゾーンのオモテ向きのユニットカード（${partnerId}）と置き換えられる（出典: ${page}「（モーフできるユニット）」・R-KW-MORPH-02）`, () => {
    let s = enemyRushes({ battle: [inst(id, "d")], power: [faceUp(partnerId, "p"), faceUp("SPEC-MALE", "x")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual([`${partnerId}:p`]);
    s = settle(pickAs(s, "player1", `${partnerId}:p`));
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("battle");
    expect(zoneOf(s, "player1", `${id}:d`)).toBe("power");
  });
}

// ===========================================================================
describe("RK-302 スコルピオワーム", () => {
  const TEXT =
    "【ワームの頂点に立つ男】これが自軍エリアにある間、特徴「ワーム」または特徴「怪人」を持つ敵軍ユニットはアタックもストライクも出来ない。また、敵軍ターン中、これが撃破されたとき、特徴「ワーム」または特徴「怪人」を持つすべてのユニットを撃破する。";

  it("RK-302: カタログ本文・スペックが出典と一致（出典: atwiki/page-1342）", () => {
    expectCatalogText("RK-302", TEXT);
    expectStats("RK-302", { name: "スコルピオワーム", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: "4+", features: ["ワーム", "怪人", "男", "加速"], rushCondition: "discard_name_contains_unit" });
    expectRarityIn("RK-302", ["NR"]);
  });

  it("RK-302: 追加条件 — カード名に「仮面ライダーサソード」を含む自軍ユニット（サソードMF）1体を捨札にしてラッシュできる（出典: atwiki/page-1342「追加条件：カード名に「仮面ライダーサソード」を含む自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-302", "sw")], rush: [inst("RK-294", "mf")], power: powerCards(4), command: releasedCat("DA", 1) }), "player1", "RK-302:sw", { materials: ["RK-294:mf"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-302:sw")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-294:mf")).toBe("discard");
  });

  const enemyEnters = (unit: string, own: Partial<GameState["players"]["player1"]> = { battle: [inst("RK-302", "sw"), inst("SPEC-NOFEAT", "t")] }) =>
    enemyEnter(enemyTurn(own, { rush: [inst(unit, "e")] }), `${unit}:e`);

  it("RK-302: 【ワームの頂点に立つ男】これが自軍エリアにある間、特徴「怪人」を持つ敵軍ユニットはアタックもストライクもできない（出典: atwiki/page-1342「特徴「ワーム」または特徴「怪人」を持つ敵軍ユニットはアタックもストライクも出来ない」）", () => {
    const s = enemyEnters("SPEC-KAIJIN");
    expect(unitActions(s, "SPEC-KAIJIN:e")).toEqual([]);
  });

  it("RK-302: 特徴「ワーム」を持つ敵軍ユニットもアタック・ストライクできない（出典: atwiki/page-1342）", () => {
    const s = enemyEnters("SPEC-WORM");
    expect(unitActions(s, "SPEC-WORM:e")).toEqual([]);
  });

  it("RK-302: これが自軍ラッシュエリアにあっても働く（出典: atwiki/page-1342「これが自軍エリアにある間」）", () => {
    const s = enemyEnters("SPEC-KAIJIN", { rush: [inst("RK-302", "sw")], battle: [inst("SPEC-NOFEAT", "t")] });
    expect(unitActions(s, "SPEC-KAIJIN:e")).toEqual([]);
  });

  it("RK-302: 「ワーム」「怪人」を持たない敵軍ユニットはアタック・ストライクできる（出典: atwiki/page-1342）", () => {
    const s = enemyEnters("SPEC-MALE");
    expect(canStrike(s, "SPEC-MALE:e", "player2")).toBe(true);
    expect(attackTargets(s, "SPEC-MALE:e", "player2")).toContain("SPEC-NOFEAT:t");
  });

  const destroyedByEnemy = () =>
    resolveAll(
      attack(
        enemyTurn({ battle: [inst("RK-302", "sw"), inst("SPEC-KAIJIN", "ok")], rush: [inst("SPEC-WORM", "ow"), inst("SPEC-MALE", "om")] }, { battle: [inst("TST-UNIT-7", "atk"), inst("SPEC-KAIJIN", "ek")], rush: [inst("SPEC-WORM", "ew"), inst("SPEC-MALE", "em")] }),
        "TST-UNIT-7:atk",
        "RK-302:sw",
        "player2",
      ),
    );

  it("RK-302: 敵軍ターン中に撃破されたとき、特徴「ワーム」または「怪人」を持つすべてのユニット（自軍・敵軍、エリアを問わない）を撃破する（出典: atwiki/page-1342「敵軍ターン中、これが撃破されたとき、特徴「ワーム」または特徴「怪人」を持つすべてのユニットを撃破する」・カード評価「両軍の怪人かワームを持つユニットをすべて巻き添え」）", () => {
    const s = destroyedByEnemy();
    expect(zoneOf(s, "player1", "RK-302:sw")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:ok")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-WORM:ow")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-KAIJIN:ek")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WORM:ew")).toBe("discard");
  });

  it("RK-302: 「ワーム」「怪人」を持たないユニットは撃破されない（出典: atwiki/page-1342）", () => {
    const s = destroyedByEnemy();
    expect(zoneOf(s, "player1", "SPEC-MALE:om")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-MALE:em")).toBe("rush");
  });

  it("RK-302: 自軍ターン中に撃破されたときは何も起きない（出典: atwiki/page-1342「敵軍ターン中、これが撃破されたとき」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-302", "sw")], rush: [inst("SPEC-KAIJIN", "ok")] }, { battle: [inst("TST-UNIT-7", "big")], rush: [inst("SPEC-KAIJIN", "ek")] }), "RK-302:sw", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-302:sw")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:ok")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-KAIJIN:ek")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-303 ワームサナギ体", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【擬態の解除】これが自分の手札にある間、敵軍ターン中、特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき、捨札になったユニットカード1枚につき、自分の手札から「ワームサナギ体」のカードを1枚選び、自軍ラッシュエリアに出してもよい。";

  it("RK-303: カタログ本文・スペックが出典と一致（出典: atwiki/page-1278）", () => {
    expectCatalogText("RK-303", TEXT);
    expectStats("RK-303", { name: "ワームサナギ体", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, features: ["ワーム", "怪人"] });
    expectRarityIn("RK-303", ["N"]);
  });

  const killed = (unit: string, hand: ReturnType<typeof inst>[] = [inst("RK-303", "s1")]) => attackedInEnemyTurn({ battle: [inst(unit, "v")], hand }, `${unit}:v`, {}, "TST-UNIT-7:atk", EXTRA);

  it("RK-303: 【擬態の解除】手札にある間、敵軍ターン中に特徴「男」を持つ自軍ユニットが撃破されて捨札になったとき、手札の「ワームサナギ体」を1枚選び自軍ラッシュエリアに出せる（任意）（出典: atwiki/page-1278「自分の手札から「ワームサナギ体」のカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    let s = killed("SPEC-MALE");
    expectChoiceFrom(s, "player1", "RK-303");
    expect(choiceIds(s)).toEqual(["RK-303:s1"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "RK-303:s1"));
    expect(zoneOf(s, "player1", "RK-303:s1")).toBe("rush");
  });

  it("RK-303: 特徴「女」を持つ自軍ユニットでも出せる（出典: atwiki/page-1278「特徴「男」または「女」を持つ自軍ユニット」）", () => {
    expectChoiceFrom(killed("SPEC-FEMALE"), "player1", "RK-303");
  });

  it("RK-303: 出さないことも選べる（出典: atwiki/page-1278「出してもよい」）", () => {
    const s = resolveAll(skip(killed("SPEC-MALE")));
    expect(zoneOf(s, "player1", "RK-303:s1")).toBe("hand");
  });

  it("RK-303: 同名の RK-137 ワームサナギ体（2弾）のカードも選べる（出典: atwiki/page-1278「「ワームサナギ体」のカード」・カード評価「ワームサナギ体の2ndカード的なもの」）", () => {
    const s = killed("SPEC-MALE", [inst("RK-303", "s1"), inst("RK-137", "old")]);
    expect(choiceIds(s)).toEqual(["RK-137:old", "RK-303:s1"]);
  });

  it("RK-303: 「男」「女」を持たない自軍ユニットが撃破されたときは発動しない（出典: atwiki/page-1278）", () => {
    const s = killed("SPEC-NOFEAT");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-303");
    expect(zoneOf(s, "player1", "RK-303:s1")).toBe("hand");
  });

  it("RK-303: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-1278「敵軍ターン中」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("SPEC-MALE", "v")], hand: [inst("RK-303", "s1")] }, { battle: [inst("TST-UNIT-7", "big")] }), "SPEC-MALE:v", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-MALE:v")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-303:s1")).toBe("hand");
  });

  it("RK-303: 撃破されたユニットカード1枚につき1枚だけ出せる（手札に2枚あっても、1体の撃破では1枚）（出典: atwiki/page-1278「捨札になったユニットカード1枚につき、…1枚選び」）", () => {
    const s = resolveAll(killed("SPEC-MALE", [inst("RK-303", "s1"), inst("RK-303", "s2")]), ["RK-303:s1", "RK-303:s2"]);
    expect([zoneOf(s, "player1", "RK-303:s1"), zoneOf(s, "player1", "RK-303:s2")].sort()).toEqual(["hand", "rush"]);
  });
});

// ===========================================================================
describe("RK-304 仮面ライダー電王RF（2nd）", () => {
  const TEXT = `${KW_MORPH} 【ソリッドアタック】ホールド状態の敵軍Ｓユニットを1体選び、持ち主のパワーゾーンに送っても良い。`;

  it("RK-304: カタログ本文・スペックが出典と一致（出典: atwiki/page-1272）", () => {
    expectCatalogText("RK-304", TEXT);
    expectStats("RK-304", { name: "仮面ライダー電王RF（2nd）", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O", "2nd"] });
    expectRarityIn("RK-304", ["NR"]);
  });

  denOMorphTests("RK-304", "RK-306", "atwiki/page-1272");

  const solid = (p2: Partial<GameState["players"]["player2"]> = { battle: [heldUnit("SPEC-C3", "hb"), inst("SPEC-C3", "rb"), heldUnit("SPEC-EM2000", "hm")], rush: [heldUnit("SPEC-C4", "hr")] }) =>
    rcRideOff(board({ rush: [inst("RK-304", "rf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-304:rf", "SPEC-VEHICLE:v");

  it("RK-304: 【ソリッドアタック】RC — ホールド状態の敵軍 S ユニット（エリアを問わない）から1体選べる（任意。リリース状態・M は対象外）（出典: atwiki/page-1272「ホールド状態の敵軍Ｓユニットを1体選び、持ち主のパワーゾーンに送っても良い」）", () => {
    const s = solid();
    expectChoiceFrom(s, "player1", "RK-304");
    expect(choiceIds(s)).toEqual(["SPEC-C3:hb", "SPEC-C4:hr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-304: 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-1272）", () => {
    const s = resolveAll(pick(solid(), "SPEC-C4:hr"));
    expect(zoneOf(s, "player2", "SPEC-C4:hr")).toBe("power");
  });

  it("RK-304: 送らないことも選べる（出典: atwiki/page-1272「送っても良い」）", () => {
    const s = resolveAll(skip(solid()));
    expect(zoneOf(s, "player2", "SPEC-C3:hb")).toBe("battle");
  });

  it("RK-304: ライドオフせずに出たとき（RC が発動しない）は何も起きない（出典: atwiki/page-1272「CN：RC」）", () => {
    const s = enter(board({ rush: [inst("RK-304", "rf")] }, { battle: [heldUnit("SPEC-C3", "hb")] }), "RK-304:rf");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-304");
  });
});

// ===========================================================================
describe("RK-305 仮面ライダー電王SF（2nd）", () => {
  const TEXT = `${KW_MORPH} 【俺の必殺技特別編】敵軍コマンドを2つ、1つずつ順番に選びリリースしてもよい。そうしたとき、本来のカテゴリが1つ目にリリースしたコマンドと同じで、本来の必要パワーが2つ目にリリースしたコマンドと同じ敵軍Sユニットをすべて撃破する。`;

  it("RK-305: カタログ本文・スペックが出典と一致（出典: atwiki/page-1275）", () => {
    expectCatalogText("RK-305", TEXT);
    expectStats("RK-305", { name: "仮面ライダー電王SF（2nd）", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O", "2nd"] });
    expectRarityIn("RK-305", ["R"]);
  });

  denOMorphTests("RK-305", "RK-304", "atwiki/page-1275");

  const enemy = (command = [held("TST-OP-DA", "da"), held("TST-OP", "wb"), released("TST-OP-OT", "ot")]) => ({
    command,
    battle: [inst("SPEC-DA3", "a"), inst("SPEC-DA1", "b"), inst("SPEC-WB3", "c"), inst("SPEC-DA3M", "m"), inst("RK-299", "rf")],
    rush: [inst("SPEC-DA3", "r")],
  });
  const special = (p2 = enemy()) => rcRideOff(board({ rush: [inst("RK-305", "sf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-305:sf", "SPEC-VEHICLE:v");

  it("RK-305: 【俺の必殺技特別編】RC — 敵軍のホールド状態のコマンドを1つずつ選べる（任意）（出典: atwiki/page-1275「敵軍コマンドを2つ、1つずつ順番に選びリリースしてもよい」）", () => {
    const s = special();
    expectChoiceFrom(s, "player1", "RK-305");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:da", "TST-OP:wb"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-305: 1つ目が DA・2つ目が必要パワー3 のコマンドなら、本来のカテゴリ DA・本来の必要パワー3 の敵軍 S ユニットをエリアを問わずすべて撃破する。リリースしたコマンドはリリース状態になる（出典: atwiki/page-1275「本来のカテゴリが1つ目にリリースしたコマンドと同じで、本来の必要パワーが2つ目にリリースしたコマンドと同じ敵軍Sユニットをすべて撃破する」・カード評価「エリアを問わず一気に敵軍Sユニットを除去」）", () => {
    const s = resolveAll(pickAll(special(), ["TST-OP-DA:da", "TST-OP:wb"]));
    expect(zoneOf(s, "player2", "SPEC-DA3:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DA3:r")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DA1:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-WB3:c")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-DA3M:m")).toBe("battle");
    expect(cardIn(s, "player2", "TST-OP-DA:da")?.commandHeld).not.toBe(true);
    expect(cardIn(s, "player2", "TST-OP:wb")?.commandHeld).not.toBe(true);
  });

  it("RK-305: 選ぶ順番で結果が変わる（1つ目が WB・2つ目が必要パワー1 なら、WB で必要パワー1 のユニットだけ）（出典: atwiki/page-1275「1つずつ順番に選び」）", () => {
    const s = resolveAll(pickAll(special(), ["TST-OP:wb", "TST-OP-DA:da"]));
    expect(zoneOf(s, "player2", "SPEC-DA3:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-WB3:c")).toBe("battle");
  });

  it("RK-305: ユニットを選ぶ効果ではないので、「相手に選ばれない」敵軍ユニット（ダークカブトRF。OT・必要パワー4+）も撃破される（出典: atwiki/page-1275 カード評価「対象を選ばずに撃破するという点が強み」）", () => {
    const s = resolveAll(pickAll(special(enemy([held("TST-OP-OT", "ot1"), held("SPEC-C4", "c4")])), ["TST-OP-OT:ot1", "SPEC-C4:c4"]));
    expect(zoneOf(s, "player2", "RK-299:rf")).toBe("discard");
  });

  it("RK-305: 「相手に選ばれない」を持つコマンド（敵軍コマンドゾーンのホールド状態のダークカブトRF）は選べない（出典: ユーザー決定 2026-10-19「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」・atwiki/page-1275「1つずつ順番に選び」・atwiki/page-1383「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = special(enemy([held("TST-OP-DA", "da"), held("TST-OP", "wb"), held("RK-299", "cmd")]));
    expect(choiceIds(s)).toEqual(["TST-OP-DA:da", "TST-OP:wb"]);
  });

  // 敵軍コマンドゾーンのカードに「相手に選ばれない」が効くか（公式どうしの食い違い）は、ユーザー決定（2026-10-19）で「効く」（README §5.7 j。上の照合）。


  it("RK-305: 敵軍のホールド状態のコマンドが1つしかなければ発動できない（出典: atwiki/page-1275 カード評価「発動には相手コマンドのカードが２枚ホールドされている必要があり」）", () => {
    const s = special(enemy([held("TST-OP-DA", "da"), released("TST-OP", "wb")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-305");
  });

  it.todo(
    "RK-305: 公式Q&A — ダイデンジンがあるとき、《モーフ》で自軍パワーゾーンの電王RF と置き換えても【ダイデンジンブーメラン】は発動する（出典: atwiki/page-1275 Q2・grnrngr/faq-card-6 RS-352 Q2）— RS-352 の【ダイデンジンブーメラン】が未実装（cardSpec/RS6-348-368.a の RS-352 の it.todo と同じ）",
  );
});

// ===========================================================================
describe("RK-306 仮面ライダー電王AF（2nd）", () => {
  const TEXT = `${KW_MORPH} 【ダイナミックチョップ】自軍ターン中、これがバトルエリアに出たとき、本来のBPがこのユニットのBP以下のユニットを、自軍と敵軍のユニットからそれぞれ1体ずつ選び、持ち主のパワーゾーンに送る。`;

  it("RK-306: カタログ本文・スペックが出典と一致（出典: atwiki/page-1273）", () => {
    expectCatalogText("RK-306", TEXT);
    expectStats("RK-306", { name: "仮面ライダー電王AF（2nd）", category: "OT", size: "S", bp: 4000, sp: undefined, powerCost: 6, features: ["仮面ライダー", "男", "DEN-O", "2nd"] });
    expectRarityIn("RK-306", ["N"]);
  });

  denOMorphTests("RK-306", "RK-307", "atwiki/page-1273");

  const chop = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-E4000", "a"), inst("SPEC-E5000", "b")], rush: [inst("SPEC-E2000", "r")] }) =>
    enter(board({ rush: [inst("RK-306", "af"), inst("SPEC-E3000", "o3")], battle: [inst("SPEC-E5000", "o5")], ...p1 }, p2), "RK-306:af");

  it("RK-306: 【ダイナミックチョップ】自軍ターン中に出たとき、まず本来の BP がこのユニットの BP（4000）以下の自軍ユニット（これ自身も含む。エリアを問わない）から1体選ぶ（強制）（出典: atwiki/page-1273「本来のBPがこのユニットのBP以下のユニットを、自軍と敵軍のユニットからそれぞれ1体ずつ選び」・コメント欄「こいつだけパワーに飛んでいく」）", () => {
    const s = chop();
    expectChoiceFrom(s, "player1", "RK-306");
    expect(choiceIds(s)).toEqual(["RK-306:af", "SPEC-E3000:o3"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-306: 続けて敵軍ユニットから1体選び、選んだ2体をそれぞれ持ち主のパワーゾーンに送る（ラッシュエリアのユニットも選べる）（出典: atwiki/page-1273「持ち主のパワーゾーンに送る」・カード評価「ラッシュエリアにも届く除去能力」）", () => {
    let s = pick(chop(), "SPEC-E3000:o3");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:r", "SPEC-E4000:a"]);
    s = resolveAll(pick(s, "SPEC-E2000:r"));
    expect(zoneOf(s, "player1", "SPEC-E3000:o3")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E2000:r")).toBe("power");
    expect(zoneOf(s, "player1", "RK-306:af")).toBe("battle");
  });

  // atwiki/page-1273 Q2「いいえ、それはできません。「自軍と敵軍のユニットからそれぞれ1体ずつ選び」とあるので、それを満たせなかった場合は処理が中断されます。」
  it("RK-306: 公式Q&A — このユニットの BP 以下の敵軍ユニットが1体もなければ、自軍のユニット（これ自身）だけをパワーゾーンに送ることはできない（出典: atwiki/page-1273 Q2）", () => {
    const s = resolveAll(chop({}, { battle: [inst("SPEC-E5000", "b")] }));
    expect(zoneOf(s, "player1", "RK-306:af")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-E3000:o3")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E5000:b")).toBe("battle");
  });

  it("RK-306: 敵軍ユニットは「相手に選ばれない」ものを選べない（出典: atwiki/page-1273「選び」・atwiki/page-1383「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = pick(chop({}, { battle: [inst("RK-299", "rf"), inst("SPEC-E2000", "x")] }), "SPEC-E3000:o3");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:x"]);
  });

  it("RK-306: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1273「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-306:af", { battle: [inst("SPEC-E2000", "x")] }, { battle: [inst("SPEC-E2000", "y")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-306:af")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-306");
  });
});

// ===========================================================================
describe("RK-307 仮面ライダー電王GF（2nd）", () => {
  const TEXT = `${KW_MORPH} 【ワイルドショット】敵軍ラッシュエリアから、必要パワーの数字が3以下のユニットを1体選び撃破する。`;

  it("RK-307: カタログ本文・スペックが出典と一致（出典: atwiki/page-1274）", () => {
    expectCatalogText("RK-307", TEXT);
    expectStats("RK-307", { name: "仮面ライダー電王GF（2nd）", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O", "2nd"] });
    expectRarityIn("RK-307", ["R"]);
  });

  denOMorphTests("RK-307", "RK-305", "atwiki/page-1274");

  const shot = (p2: Partial<GameState["players"]["player2"]> = { rush: [inst("SPEC-C3", "a"), inst("SPEC-C4", "b"), inst("SPEC-DA3M", "m")], battle: [inst("SPEC-C3", "x")] }) =>
    rcRideOff(board({ rush: [inst("RK-307", "gf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-307:gf", "SPEC-VEHICLE:v");

  it("RK-307: 【ワイルドショット】RC — 敵軍ラッシュエリアの必要パワー3以下のユニット（M も含む）から1体選ぶ（強制。バトルエリアは対象外）（出典: atwiki/page-1274「敵軍ラッシュエリアから、必要パワーの数字が3以下のユニットを1体選び撃破する」）", () => {
    const s = shot();
    expectChoiceFrom(s, "player1", "RK-307");
    expect(choiceIds(s)).toEqual(["SPEC-C3:a", "SPEC-DA3M:m"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-307: 選んだユニットは撃破される（出典: atwiki/page-1274「撃破する」）", () => {
    const s = resolveAll(pick(shot(), "SPEC-C3:a"));
    expect(zoneOf(s, "player2", "SPEC-C3:a")).toBe("discard");
  });

  it("RK-307: 当てはまるユニットがなければ何も起きない（出典: atwiki/page-1274・R-TGT-01）", () => {
    const s = resolveAll(shot({ rush: [inst("SPEC-C4", "b")] }));
    expect(zoneOf(s, "player2", "SPEC-C4:b")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-308 リュウタロス（2nd）", () => {
  const TEXT =
    "※これは特徴「獣」を持つユニットにアタックできない。 ※自軍ターン中、これは、敵軍バトルエリアにユニットがあれば、可能ならバトルエリアに出る。 【猫はこっち、アンタは嫌い】自軍パワーゾーンのオモテ向きのカードから、特徴「獣」を持つユニットカードを1枚選び自分の手札に戻してもよい。そうしたとき、敵軍ラッシュエリアから本来のBPが3000以下のユニットを1体選び撃破する。";

  it("RK-308: カタログ本文・スペックが出典と一致（出典: atwiki/page-1282）", () => {
    expectCatalogText("RK-308", TEXT);
    expectStats("RK-308", { name: "リュウタロス（2nd）", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 2, comboNumber: 2, features: ["イマジン", "2nd"] });
    expectRarityIn("RK-308", ["N"]);
  });

  it("RK-308: ※ 特徴「獣」を持つユニットにアタックできない（出典: atwiki/page-1282「※これは特徴「獣」を持つユニットにアタックできない」）", () => {
    const s = enter(board({ rush: [inst("RK-308", "ry")] }, { battle: [inst("SPEC-BEAST", "b"), inst("SPEC-MALE", "m")] }), "RK-308:ry");
    expect(attackTargets(s, "RK-308:ry")).toEqual(["SPEC-MALE:m"]);
  });

  it("RK-308: ※ 自軍ターン中、敵軍バトルエリアにユニットがあれば、可能ならバトルエリアに出る（出さずにバトルフェイズを終えられない）（出典: atwiki/page-1282「※自軍ターン中、これは、敵軍バトルエリアにユニットがあれば、可能ならバトルエリアに出る」）", () => {
    expect(canEndPhase(board({ rush: [inst("RK-308", "ry")] }, { battle: [inst("SPEC-MALE", "m")] }))).toBe(false);
  });

  it("RK-308: ※ 敵軍バトルエリアにユニットがなければ出なくてよい（出典: atwiki/page-1282「敵軍バトルエリアにユニットがあれば」）", () => {
    expect(canEndPhase(board({ rush: [inst("RK-308", "ry")] }, { rush: [inst("SPEC-MALE", "m")] }))).toBe(true);
  });

  const cat = (power = [faceUp("SPEC-BEAST", "pb"), faceUp("SPEC-BEAST-OP", "po"), faceUp("SPEC-MALE", "pm"), faceDown("SPEC-BEAST", "pd")], p2: Partial<GameState["players"]["player2"]> = { rush: [inst("SPEC-E3000", "a"), inst("SPEC-E3500", "b")] }) =>
    ncEnter("RK-308:ry", 1, { power }, p2, EXTRA);

  it("RK-308: 【猫はこっち、アンタは嫌い】NC（2番目）— 自軍パワーゾーンのオモテ向きの、特徴「獣」を持つユニットカードを1枚選べる（任意。オペレーション・ダメージは対象外）（出典: atwiki/page-1282「自軍パワーゾーンのオモテ向きのカードから、特徴「獣」を持つユニットカードを1枚選び自分の手札に戻してもよい」）", () => {
    const s = cat();
    expectChoiceFrom(s, "player1", "RK-308");
    expect(choiceIds(s)).toEqual(["SPEC-BEAST:pb"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-308: 戻したとき、敵軍ラッシュエリアから本来の BP が3000以下のユニットを1体選び撃破する（出典: atwiki/page-1282「そうしたとき、敵軍ラッシュエリアから本来のBPが3000以下のユニットを1体選び撃破する」）", () => {
    let s = pick(cat(), "SPEC-BEAST:pb");
    expect(zoneOf(s, "player1", "SPEC-BEAST:pb")).toBe("hand");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:a"]);
    s = resolveAll(pick(s, "SPEC-E3000:a"));
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("discard");
  });

  it("RK-308: 戻さなければ何も撃破しない（出典: atwiki/page-1282「戻してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(cat()));
    expect(zoneOf(s, "player1", "SPEC-BEAST:pb")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("rush");
  });

  it("RK-308: NC が成立しなければ（1番目）何も起きない（出典: atwiki/page-1282「CN：2」・R-CN-02）", () => {
    const s = ncEnter("RK-308:ry", 0, { power: [faceUp("SPEC-BEAST", "pb")] }, { rush: [inst("SPEC-E3000", "a")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-308");
  });

  it("RK-308: 自軍パワーゾーンに「獣」のユニットカードがなければ何も起きない（出典: atwiki/page-1282）", () => {
    const s = cat([faceUp("SPEC-MALE", "pm"), ...powerCards(1)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-308");
  });
});
