/**
 * カード別スペック: RK-323〜RK-329（ザ・マスクドライダーEXP vol.4 マシンキバー〜仮面ライダーアーク）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-323」〜「RK-329」とカード名（マシンキバー・ブロンブースター・パワードイクサー・獣人態・怪人態・アーク）で検索）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-STK-03・R-RIDE）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-323〜329 とカード名で検索。dsl/featureKeywords.test.ts の RK-323 は DSL のキーワード名だけ、
 * rkHashStub.test.ts の RK-326 は DSL stub の形だけを見ている）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  NOSP_ATTACKER,
  PLAIN_VEHICLE,
  accept,
  activate,
  attack,
  canActivate,
  canMount,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enemyBoard,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  heldUnit,
  inst,
  mount,
  p1Battle,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rideOff,
  riding,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  toTurnEnd,
  zoneOf,
} from "./RK16-316-335.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3P = sUnit("SPEC-C3P", { bp: 1000, powerCost: "3+" as never });
const M3 = sUnit("SPEC-M3", { bp: 1000, powerCost: 3, size: "M" });
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const MAOU = sUnit("SPEC-MAOU", { category: "MA", bp: 1000, powerCost: 1, features: ["仮面ライダー", "男", "魔皇力"] });
const MAOU5 = sUnit("SPEC-MAOU5", { category: "MA", bp: 5000, powerCost: 1, sp: 1, features: ["仮面ライダー", "男", "魔皇力"] });
const PLAIN = sUnit("SPEC-PLAIN", { bp: 1000, powerCost: 1, features: ["男"] });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, sp: undefined, powerCost: 1 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, sp: undefined, powerCost: 1 });
const E4000M = sUnit("SPEC-E4000M", { bp: 4000, sp: undefined, powerCost: 1, size: "M" });
const B500 = sUnit("SPEC-B500", { bp: 500, sp: undefined, powerCost: 1 });
const B7000 = sUnit("SPEC-B7000", { bp: 7000, sp: undefined, powerCost: 1 });
const EM = sUnit("SPEC-EM", { bp: 1000, sp: undefined, powerCost: 1, size: "M" });
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, NOSP_ATTACKER, C1, C3, C3P, M3, RCU, MAOU, MAOU5, PLAIN, E4000, E3000, E4000M, B500, B7000, EM];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

/** 「※特徴「魔皇力」を持つ自軍Sユニットは、RCを持っていなくてもこのビークルにライドできる。」の共通テスト。 */
function maouRideTests(id: string, page: string): void {
  it(`${id}: ※ RC を持たない「魔皇力」の S ユニットがライドできる（出典: ${page}「特徴「魔皇力」を持つ自軍Sユニットは、RCを持っていなくてもこのビークルにライドできる」）`, () => {
    expect(canMount(board({ rush: [inst("SPEC-MAOU", "k"), inst(id, "v")] }), "SPEC-MAOU:k", `${id}:v`)).toBe(true);
  });

  it(`${id}: ※ RC も「魔皇力」も持たないユニットはライドできない（出典: ${page}・R-RIDE（ライドは RC を持つユニット））`, () => {
    expect(canMount(board({ rush: [inst("SPEC-PLAIN", "p"), inst(id, "v")] }), "SPEC-PLAIN:p", `${id}:v`)).toBe(false);
  });
}

// ===========================================================================
describe("RK-323 マシンキバー", () => {
  const TEXT =
    "※特徴「魔皇力」を持つ自軍Sユニットは、RCを持っていなくてもこのビークルにライドできる。 【シャドウベール】自分がターンを終えるとき、これにライドしているユニットがホールド状態ならば、そのユニットをリリースしてもよい。";

  it("RK-323: カタログ本文・スペックが出典と一致（出典: atwiki/page-1348）", () => {
    expectCatalogText("RK-323", TEXT);
    expectVehicleStats("RK-323", { name: "マシンキバー", category: "MA", powerCost: 3, size: "S", features: ["メカ", "車両", "魔皇力"] });
    expectRarityIn("RK-323", ["N"]);
  });

  maouRideTests("RK-323", "atwiki/page-1348");

  const veil = (rider = heldUnit("SPEC-MAOU", "k")) => toTurnEnd(board({ battle: riding(inst("RK-323", "v"), rider) }), "RK-323");

  it.fails("RK-323: 【シャドウベール】自分がターンを終えるとき、ライドしているユニットがホールド状態ならリリースするかを選べる（任意）（出典: atwiki/page-1348「自分がターンを終えるとき、これにライドしているユニットがホールド状態ならば、そのユニットをリリースしてもよい」）", () => {
    const s = veil();
    expectChoiceFrom(s, "player1", "RK-323");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-323: リリースを選ぶと、ライドしているユニットはリリース状態になる（出典: atwiki/page-1348・カード評価「乗りっぱなしにすることで毎ターン能力の発動が可能になる」）", () => {
    const s = resolveAll(accept(veil()));
    expect(cardIn(s, "player1", "SPEC-MAOU:k")?.commandHeld ?? false).toBe(false);
  });

  it.fails("RK-323: リリースしなければホールド状態のまま（出典: atwiki/page-1348「リリースしてもよい」）", () => {
    const s = resolveAll(skip(veil()));
    expect(cardIn(s, "player1", "SPEC-MAOU:k")?.commandHeld).toBe(true);
  });

  it("RK-323: ライドしているユニットがリリース状態なら何も起きない（出典: atwiki/page-1348「ホールド状態ならば」）", () => {
    const s = veil(inst("SPEC-MAOU", "k"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-323");
  });

  it("RK-323: 相手がターンを終えるときは発動しない（出典: atwiki/page-1348「自分がターンを終えるとき」）", () => {
    const s = toTurnEnd(enemyTurn({ battle: riding(inst("RK-323", "v"), heldUnit("SPEC-MAOU", "k")) }), "RK-323");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-323");
    expect(cardIn(s, "player1", "SPEC-MAOU:k")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RK-324 ブロンブースター", () => {
  const TEXT =
    "※特徴「魔皇力」を持つ自軍Sユニットは、RCを持っていなくてもこのビークルにライドできる。 【凄いのが来るぜ！】これにライドしているユニットがBP4000以上の敵軍Sユニットを撃破して捨札にしたとき、捨札にしたそのユニットカードを持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-324: カタログ本文・スペックが出典と一致（出典: atwiki/page-1356）", () => {
    expectCatalogText("RK-324", TEXT);
    expectVehicleStats("RK-324", { name: "ブロンブースター", category: "MA", powerCost: "4+", size: "S", features: ["メカ", "車両", "魔皇力"] });
    expectRarityIn("RK-324", ["N"]);
  });

  it("RK-324: 追加条件 — 自軍ビークル1体を捨札にしてラッシュできる（出典: atwiki/page-1356「追加条件：自軍ビークル1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-324", "bb")], rush: [inst("SPEC-VEHICLE", "v")], power: powerCards(4), command: releasedCat("MA", 1) }), "player1", "RK-324:bb", { materials: ["SPEC-VEHICLE:v"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-324:bb")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-VEHICLE:v")).toBe("discard");
  });

  maouRideTests("RK-324", "atwiki/page-1356");

  const boost = (enemy = "SPEC-E4000:e") => {
    const [cid, suf] = enemy.split(":") as [string, string];
    return resolveAll(attack(board({ battle: riding(inst("RK-324", "v"), inst("SPEC-MAOU5", "k")) }, { battle: [inst(cid, suf)] }), "SPEC-MAOU5:k", enemy), [], 0);
  };

  it.fails("RK-324: 【凄いのが来るぜ！】ライドしているユニットが BP4000 以上の敵軍 S ユニットを撃破して捨札にしたとき、そのカードをダメージにするかを選べる（任意）（出典: atwiki/page-1356「捨札にしたそのユニットカードを持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = boost();
    expectChoiceFrom(s, "player1", "RK-324");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-324: 置くと、撃破したカードは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1356）", () => {
    const s = resolveAll(accept(boost()));
    expect(zoneOf(s, "player2", "SPEC-E4000:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E4000:e")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RK-324: 置かなければ捨札のまま（出典: atwiki/page-1356「置いてもよい」）", () => {
    const s = resolveAll(skip(boost()));
    expect(zoneOf(s, "player2", "SPEC-E4000:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-324: BP4000 未満の敵軍ユニットを撃破したときは発動しない（出典: atwiki/page-1356「BP4000以上の敵軍Sユニット」）", () => {
    const s = boost("SPEC-E3000:e");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-324");
    expect(zoneOf(s, "player2", "SPEC-E3000:e")).toBe("discard");
  });

  it("RK-324: M ユニットを撃破したときは発動しない（出典: atwiki/page-1356「敵軍Sユニット」）", () => {
    const s = boost("SPEC-E4000M:e");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-324");
  });
});

// ===========================================================================
describe("RK-325 パワードイクサー", () => {
  const TEXT =
    "※これにライドしているユニットは、「仮面ライダーイクサBM」なら「SP1」になる。 【イクサポッド】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンからカードを1枚選び、自軍山札の上か下に戻してもよい。そうしたとき、戻したカードの必要パワーの数字と同じ必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RK-325: カタログ本文・スペックが出典と一致（出典: atwiki/page-1347）", () => {
    expectCatalogText("RK-325", TEXT);
    expectVehicleStats("RK-325", { name: "パワードイクサー", category: "ET", powerCost: 4, size: "S", features: ["メカ", "ドラゴン"] });
    expectRarityIn("RK-325", ["N"]);
  });

  it.fails("RK-325: ※ ライドしている「仮面ライダーイクサBM」は「SP1」になる（1番目に並んで分数 SP「1/5」が働かなくても）（出典: atwiki/page-1347「「仮面ライダーイクサBM」なら「SP1」になる」・R-STK-03）", () => {
    const s = board({ battle: riding(inst("RK-325", "v"), inst("RK-319", "bm")) });
    expect(spOf(s, "player1", "RK-319:bm")).toBe(1);
    expect(canStrike(s, "RK-319:bm")).toBe(true);
  });

  it("RK-325: ※ ほかのビークルにライドしたイクサBM は1番目では SP がない（出典: atwiki/page-1347・R-STK-03「分母の数字と同じ順番に並んでいれば」）", () => {
    const s = board({ battle: riding(inst("SPEC-VEHICLE", "v"), inst("RK-319", "bm")) });
    expect(spOf(s, "player1", "RK-319:bm")).toBe(0);
  });

  it("RK-325: ※ イクサBM 以外のユニットは SP1 にならない（出典: atwiki/page-1347「「仮面ライダーイクサBM」なら」）", () => {
    const s = board({ battle: riding(inst("RK-325", "v"), inst("SPEC-NOSP", "n")) });
    expect(spOf(s, "player1", "SPEC-NOSP:n")).toBe(0);
  });

  const enemy = { battle: [inst("SPEC-C3", "e3"), inst("SPEC-C3P", "e3p"), inst("SPEC-C1", "e1"), inst("SPEC-M3", "m3")], rush: [inst("SPEC-C3", "r3")] };
  const pod = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    mount(board({ rush: [inst("SPEC-RCU", "r"), inst("RK-325", "v")], command: [inst("SPEC-C3", "c3"), inst("SPEC-C1", "c1")], deck: deckCards(3), ...p1 }, enemy), "SPEC-RCU:r", "RK-325:v");

  it.fails("RK-325: 【イクサポッド】自軍ターン中にライドされてバトルエリアに出たとき、自軍コマンドゾーンのカードを1枚選べる（任意）（出典: atwiki/page-1347「自軍コマンドゾーンからカードを1枚選び、自軍山札の上か下に戻してもよい」）", () => {
    const s = pod();
    expectChoiceFrom(s, "player1", "RK-325");
    expect(choiceIds(s)).toEqual(["SPEC-C1:c1", "SPEC-C3:c3"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-325: 選んだカードは山札の上か下を選んで戻す（下を選ぶと山札の一番下）（出典: atwiki/page-1347「自軍山札の上か下に戻して」）", () => {
    let s = pick(pod(), "SPEC-C3:c3");
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
    s = pick(s, "deck_bottom");
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("deck");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-C3:c3");
  });

  it.fails("RK-325: 戻すと、戻したカードと同じ必要パワーの数字（3。「3+」も含む）の敵軍バトルエリアの S ユニットから1体選ぶ（強制。M・ラッシュエリアは対象外）（出典: atwiki/page-1347「戻したカードの必要パワーの数字と同じ必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び」）", () => {
    const s = pick(pick(pod(), "SPEC-C3:c3"), "deck_top");
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-C3:c3");
    expectChoiceFrom(s, "player1", "RK-325");
    expect(choiceIds(s)).toEqual(["SPEC-C3:e3", "SPEC-C3P:e3p"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-325: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1347「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(pick(pick(pod(), "SPEC-C3:c3"), "deck_top"), "SPEC-C3P:e3p"));
    expect(zoneOf(s, "player2", "SPEC-C3P:e3p")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C3P:e3p")?.commandHeld).toBe(true);
  });

  it.fails("RK-325: 戻さなければ何も起きない（出典: atwiki/page-1347「戻してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(pod()));
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("battle");
  });

  it.fails("RK-325: ライドオフの選択はイクサポッドの後に行う（ライドしたまま残れる）（出典: atwiki/page-1347・R-RIDE）", () => {
    const s = rideOff(resolveAll(skip(pod())), false);
    expect(cardIn(s, "player1", "SPEC-RCU:r")?.mountedOnInstanceId).toBe("RK-325:v");
  });
});

// ===========================================================================
/** 【X フエッスル】「自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒…」の共通テスト。 */
function fuessleTests(id: string, kibaId: string, kibaName: string, otherA: string, otherB: string, page: string): void {
  const self = `${id}:g`;
  const deck = () => [inst(kibaId, "k1"), inst("RK-313", "dg"), inst("SPEC-C1", "x")];
  const base = (p1: Partial<GameState["players"]["player1"]> = {}) => rushPhase({ rush: [inst(id, "g")], deck: deck(), ...p1 });

  it.fails(`${id}: 自軍ラッシュフェイズ中、このユニットを捨札にして発動でき、自軍山札の「${kibaName}」を選べる（任意）（出典: ${page}「このユニットを捨札にして次の効果を発動できる⇒自軍山札を見て「${kibaName}」のカードを1枚か…選び」）`, () => {
    const s0 = base();
    expect(canActivate(s0, self)).toBe(true);
    const s = activate(s0, self);
    expect(zoneOf(s, "player1", self)).toBe("discard");
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([`${kibaId}:k1`]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails(`${id}: 選んだカードは必要パワーを満たさなくても自軍ラッシュエリアに出る（出典: ${page}「自軍ラッシュエリアに出してもよい」・カード評価「パワーを無視して」）`, () => {
    const s = resolveAll(pick(activate(base(), self), `${kibaId}:k1`));
    expect(zoneOf(s, "player1", `${kibaId}:k1`)).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(2);
  });

  it.fails(`${id}: 自軍捨札に「${otherA}」と「${otherB}」があれば「仮面ライダーキバDGBKF」も選べる（出典: ${page}「自軍捨札に「${otherA}」と「${otherB}」があれば「仮面ライダーキバDGBKF」のカードを1枚」）`, () => {
    const others = ["RK-326", "RK-327", "RK-328"].filter((c) => c !== id).map((c) => inst(c, "d"));
    const s = activate(base({ discard: others }), self);
    expect(choiceIds(s)).toEqual(["RK-313:dg", `${kibaId}:k1`].sort());
    const t = resolveAll(pick(s, "RK-313:dg"));
    expect(zoneOf(t, "player1", "RK-313:dg")).toBe("rush");
  });

  it.fails(`${id}: 出さなければ山札のまま（このユニットは捨札）（出典: ${page}「出してもよい」）`, () => {
    const s = resolveAll(skip(activate(base(), self)));
    expect(zoneOf(s, "player1", `${kibaId}:k1`)).toBe("deck");
    expect(zoneOf(s, "player1", self)).toBe("discard");
  });

  it(`${id}: 自軍バトルフェイズには発動できない（出典: ${page}「自軍ラッシュフェイズ中」）`, () => {
    expect(canActivate(board({ rush: [inst(id, "g")], deck: deck() }), self)).toBe(false);
  });
}

describe("RK-326 ガルル獣人態", () => {
  const TEXT =
    "【ガルルフエッスル】自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍山札を見て「仮面ライダーキバGF」のカードを1枚か、自軍捨札に「バッシャー獣人態」と「ドッガ怪人態」があれば「仮面ライダーキバDGBKF」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  it("RK-326: カタログ本文・スペックが出典と一致（出典: atwiki/page-1351）", () => {
    expectCatalogText("RK-326", TEXT);
    expectStats("RK-326", { name: "ガルル獣人態", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["ウルフェン族", "怪人", "男"] });
    expectRarityIn("RK-326", ["N"]);
  });

  fuessleTests("RK-326", "RK-246", "仮面ライダーキバGF", "バッシャー獣人態", "ドッガ怪人態", "atwiki/page-1351");
});

describe("RK-327 バッシャー獣人態", () => {
  const TEXT =
    "※このユニットはホールド状態のとき、敵軍ユニットにアタックされない。 【バッシャーフエッスル】自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍山札を見て「仮面ライダーキバBF」のカードを1枚か、自軍捨札に「ガルル獣人態」と「ドッガ怪人態」があれば「仮面ライダーキバDGBKF」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  it("RK-327: カタログ本文・スペックが出典と一致（出典: atwiki/page-1352）", () => {
    expectCatalogText("RK-327", TEXT);
    expectStats("RK-327", { name: "バッシャー獣人態", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["マーマン族", "怪人", "男"] });
    expectRarityIn("RK-327", ["N"]);
  });

  it.fails("RK-327: ※ ホールド状態のとき敵軍ユニットにアタックされない（リリース状態ならアタックされる）（出典: atwiki/page-1352「※このユニットはホールド状態のとき、敵軍ユニットにアタックされない」）", () => {
    const heldS = enemyTurn({ battle: [heldUnit("RK-327", "bs")] }, { battle: [inst("TST-UNIT-0", "a")] });
    expect(targetsOf(heldS, "TST-UNIT-0:a", "player2")).toEqual([]);
    const rel = enemyTurn({ battle: [inst("RK-327", "bs")] }, { battle: [inst("TST-UNIT-0", "a")] });
    expect(targetsOf(rel, "TST-UNIT-0:a", "player2")).toEqual(["RK-327:bs"]);
  });

  fuessleTests("RK-327", "RK-237", "仮面ライダーキバBF", "ガルル獣人態", "ドッガ怪人態", "atwiki/page-1352");
});

describe("RK-328 ドッガ怪人態", () => {
  const TEXT =
    "【ドッガフエッスル】自軍ラッシュフェイズ中、このユニットを捨札にして次の効果を発動できる⇒自軍山札を見て「仮面ライダーキバDF」のカードを1枚か、自軍捨札に「ガルル獣人態」と「バッシャー獣人態」があれば「仮面ライダーキバDGBKF」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  it("RK-328: カタログ本文・スペックが出典と一致（出典: atwiki/page-1353）", () => {
    expectCatalogText("RK-328", TEXT);
    expectStats("RK-328", { name: "ドッガ怪人態", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 3, features: ["フランケン", "怪人", "男"] });
    expectRarityIn("RK-328", ["N"]);
  });

  fuessleTests("RK-328", "RK-312", "仮面ライダーキバDF", "ガルル獣人態", "バッシャー獣人態", "atwiki/page-1353");
});

// ===========================================================================
describe("RK-329 仮面ライダーアーク", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 ※敵軍ユニットがSユニットだけなら、これは「SP1」になる。 【巨体の威圧】自軍ターン中、これがバトルエリアに出たとき、BPの一番低いユニットを１体選び撃破する。ただし、BPの一番低いユニットが自軍と敵軍にある場合は、自軍ユニットの中から選ぶこと。";

  it("RK-329: カタログ本文・スペックが出典と一致（出典: atwiki/page-1410）", () => {
    expectCatalogText("RK-329", TEXT);
    expectStats("RK-329", { name: "仮面ライダーアーク", category: "DA", size: "S", bp: 6000, sp: "special", powerCost: 6, features: ["仮面ライダー", "男", "レジェンドルガ"] });
    expectRarityIn("RK-329", ["SR"]);
  });

  it("RK-329: ※ 敵軍ターン中、「SP1」のユニットとバトルしたときは勝っても撃破される（出典: atwiki/page-1410「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-329", "ak")] }, { battle: [inst("TST-UNIT-0", "a")] }), "TST-UNIT-0:a", "RK-329:ak", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-329:ak")).toBe("discard");
  });

  it("RK-329: ※ SP のないユニットとのバトルに勝てば残る（出典: atwiki/page-1410「「SP1」以上のユニット」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-329", "ak")] }, { battle: [inst("SPEC-NOSP", "a")] }), "SPEC-NOSP:a", "RK-329:ak", "player2"));
    expect(zoneOf(s, "player1", "RK-329:ak")).toBe("battle");
  });

  it("RK-329: ※ 自軍ターン中に SP1 のユニットとバトルして勝てば残る（出典: atwiki/page-1410「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-329", "ak")] }, { battle: [inst("TST-UNIT-0", "a")] }), "RK-329:ak", "TST-UNIT-0:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-329:ak")).toBe("battle");
  });

  it("RK-329: ※ 敵軍ユニットが S ユニットだけなら「SP1」になりストライクできる（出典: atwiki/page-1410「※敵軍ユニットがSユニットだけなら、これは「SP1」になる」）", () => {
    const s = board({ battle: [inst("RK-329", "ak")] }, { battle: [inst("SPEC-C1", "a")] });
    expect(spOf(s, "player1", "RK-329:ak")).toBe(1);
  });

  it("RK-329: ※ 敵軍に M ユニットがいれば SP はない（出典: atwiki/page-1410「Sユニットだけなら」）", () => {
    const s = board({ battle: [inst("RK-329", "ak")] }, { battle: [inst("SPEC-C1", "a")], rush: [inst("SPEC-EM", "m")] });
    expect(spOf(s, "player1", "RK-329:ak")).toBe(0);
  });

  const press = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(board({ rush: [inst("RK-329", "ak")], ...p1 }, { battle: [inst("SPEC-B500", "b1"), inst("TST-UNIT-0", "u")], rush: [inst("SPEC-B500", "b2")], ...p2 }), "RK-329:ak");

  it.fails("RK-329: 【巨体の威圧】自軍ターン中に出たとき、BP の一番低いユニット（エリア・サイズを問わない）から1体選ぶ（強制）（出典: atwiki/page-1410「BPの一番低いユニットを１体選び撃破する」・カード評価「ラッシュエリアのユニットをサイズを問わずに撃破できる」）", () => {
    const s = press();
    expectChoiceFrom(s, "player1", "RK-329");
    expect(choiceIds(s)).toEqual(["SPEC-B500:b1", "SPEC-B500:b2"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-329: 選んだユニットは撃破される（出典: atwiki/page-1410「撃破する」）", () => {
    const s = resolveAll(pick(press(), "SPEC-B500:b2"));
    expect(zoneOf(s, "player2", "SPEC-B500:b2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B500:b1")).toBe("battle");
  });

  it.fails("RK-329: BP の一番低いユニットが自軍と敵軍の両方にあれば、自軍ユニットから選ぶ（出典: atwiki/page-1410「BPの一番低いユニットが自軍と敵軍にある場合は、自軍ユニットの中から選ぶこと」）", () => {
    const s = press({ battle: [inst("SPEC-B500", "own")] });
    expect(choiceIds(s)).toEqual(["SPEC-B500:own"]);
  });

  it.fails("RK-329: ほかのユニットの BP がすべて高ければ、これ自身が一番低いユニットとして撃破される（出典: atwiki/page-1410「BPの一番低いユニットを１体選び」（このユニットを除くとは書かれていない））", () => {
    const s = resolveAll(press({}, { battle: [inst("SPEC-B7000", "h")], rush: [] }));
    expect(zoneOf(s, "player1", "RK-329:ak")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B7000:h")).toBe("battle");
  });

  it("RK-329: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1410「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-329:ak", {}, { battle: [inst("SPEC-B500", "b1")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-329:ak")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-329");
    expect(zoneOf(s, "player2", "SPEC-B500:b1")).toBe("battle");
  });
});
