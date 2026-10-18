/**
 * カード別スペック: RK-316〜RK-322（ザ・マスクドライダーEXP vol.4 キバットバットⅢ世〜仮面ライダーレイ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-316」〜「RK-322」とカード名（キバット・シュードラン・イクサ・サガ・レイ）で検索。card_9 の RS-613 Q1 は atwiki/page-1249 Q1 と同じ問い）。
 *     atwiki に転載された公式 Q&A（RK-316 Q1・RK-321 Q1・RK-322 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-02・R-KW-MORPH・R-KW-RESIST）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - RK-316【フエッスル】のモーフ付与（自軍の「魔皇力」S ユニットだけ・自身は得ない・相手のキバットでは得ない）は rulesSpec/07-morph.test.ts。
 *  - RK-316 Q1（RK-312 がモーフでバトルエリアに出るときもコマンドを2つホールドする）は RK-312 Q2 と同じ問いで、RK15-295-315.c の RK-312 で照合する
 *    （以前は it.todo だった）。
 *  - RK-322 Q1（RS-613 ダイヤジャック【ダイヤソード】は【ブリザードクロー・エクスキュージョン】の後の BP7000 まで撃破できる）は
 *    RS9-605-626.b の RS-613 で照合済み。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  KW_MORPH,
  PLAIN_VEHICLE,
  accept,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSelfRush,
  canSkip,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enemyBoard,
  enemyRushes,
  enter,
  enteredInEnemyTurn,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  heldUnit,
  inst,
  morphCandidates,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  rcRideOff,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  riding,
  rushFromHand,
  rushed,
  selfRush,
  settle,
  skip,
  st,
  strike,
  sUnit,
  withStacked,
  zoneOf,
} from "./RK16-316-335.helpers";

const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3P = sUnit("SPEC-C3P", { bp: 1000, powerCost: "3+" as never });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C9 = sUnit("SPEC-C9", { bp: 1000, powerCost: 9 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const DRAGON = sUnit("SPEC-DRAGON", { bp: 1000, powerCost: 1, features: ["ドラゴン"] });
/** 特徴が RK-312 仮面ライダーキバDF と完全一致する S ユニット（モーフを持たない。RK-316 があればモーフを得る）。 */
const MAOU = sUnit("SPEC-MAOU", { category: "MA", bp: 1000, powerCost: 1, features: ["仮面ライダー", "男", "魔皇力"] });
const MAOU_M = sUnit("SPEC-MAOU-M", { category: "MA", bp: 1000, powerCost: 1, size: "M", features: ["仮面ライダー", "男", "魔皇力"] });
/** モーフを持つ S ユニットと、その置き換え先（特徴が完全一致）。 */
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const TGT = sUnit("SPEC-TGT", { category: "WB", bp: 6000, powerCost: 5, features: ["仮面ライダー", "男"] });
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, C0, C1, C2, C3, C3P, C4, C9, M2, ENEMY0, DRAGON, MAOU, MAOU_M, MORPH, TGT];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-316 キバットバットⅢ世", () => {
  const TEXT =
    "【フエッスル】これが自軍エリアにある間、特徴「魔皇力」を持つ自軍Sユニットは、次の能力を得る⇒※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";

  it("RK-316: カタログ本文・スペックが出典と一致（出典: atwiki/page-1346）", () => {
    expectCatalogText("RK-316", TEXT);
    expectStats("RK-316", { name: "キバットバットⅢ世", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 4, features: ["キバット族"] });
    expectRarityIn("RK-316", ["N"]);
  });

  it("RK-316: 【フエッスル】自軍の「魔皇力」の S ユニットはモーフを得て、特徴が完全一致する自軍コマンドゾーンのカード（RK-312）と置き換えられる（出典: atwiki/page-1346「特徴「魔皇力」を持つ自軍Sユニットは、次の能力を得る⇒※モーフ」）", () => {
    const s = enemyRushes({ rush: [inst("RK-316", "kb"), inst("SPEC-MAOU", "k")], command: [inst("RK-312", "df")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-312:df"]);
    const t = pickAs(s, "player1", "RK-312:df");
    expect(zoneOf(t, "player1", "RK-312:df")).toBe("rush");
    expect(zoneOf(t, "player1", "SPEC-MAOU:k")).toBe("command");
  });

  it("RK-316: 【フエッスル】「魔皇力」を持っていても M ユニットはモーフを得ない（出典: atwiki/page-1346「特徴「魔皇力」を持つ自軍Sユニットは」）", () => {
    const s = enemyRushes({ rush: [inst("RK-316", "kb"), inst("SPEC-MAOU-M", "km")], command: [inst("SPEC-MAOU-M", "t")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual([]);
  });
});

// ===========================================================================
describe("RK-317 シュードラン", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ポッドバッティング】これが自軍エリアにある間、モーフの効果で自軍コマンドゾーンか自軍パワーゾーンのオモテ向きのカードからユニットカードを選ぶとき、DAを持つ自軍コマンドを2つ（自軍エリアに｢キャッスルドラン｣があれば1つ）ホールドしてもよい。そうしたとき、かわりに自軍捨札から選んでもよい。";

  it("RK-317: カタログ本文・スペックが出典と一致（出典: atwiki/page-1389）", () => {
    expectCatalogText("RK-317", TEXT);
    expectStats("RK-317", { name: "シュードラン", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["獣", "ドラゴン"] });
    expectRarityIn("RK-317", ["N"]);
  });

  it("RK-317: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（リリース状態のコマンドがなければ出られず、あればホールドして出る）（出典: atwiki/page-1389「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-317", "sd")] }), "RK-317:sd")).toBe(false);
    const s0 = board({ rush: [inst("RK-317", "sd")], command: releasedCat("WB", 1) });
    expect(canEnter(s0, "RK-317:sd")).toBe(true);
    const s = enterWithHold(s0, "RK-317:sd", ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", "RK-317:sd")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBe(true);
  });

  /** 敵軍のラッシュに対して、自軍のモーフ（SPEC-MORPH）の置き換え先を選ぶ場面。捨札に置き換え先（SPEC-TGT）がある。 */
  const pod = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enemyRushes(
      { rush: [inst("RK-317", "sd"), inst("SPEC-MORPH", "m")], discard: [inst("SPEC-TGT", "dt")], command: releasedCat("DA", 2), ...p1 },
      "SPEC-ENEMY0:e",
      EXTRA,
    );

  it.fails("RK-317: 【ポッドバッティング】DA を持つリリース状態の自軍コマンドが2つあれば、モーフの置き換え先を自軍捨札からも選べる（出典: atwiki/page-1389「DAを持つ自軍コマンドを2つ…ホールドしてもよい。そうしたとき、かわりに自軍捨札から選んでもよい」・カード評価「捨札のカードもモーフで置き換えることができる」）", () => {
    expect(morphCandidates(pod())).toEqual(["SPEC-TGT:dt"]);
  });

  it.fails("RK-317: 捨札のカードを選ぶと DA のコマンドを2つホールドし、選んだカードと置き換える（置き換えられたユニットは捨札に行く）（出典: atwiki/page-1389・R-KW-MORPH-01）", () => {
    const s = pickAs(pod(), "player1", "SPEC-TGT:dt");
    expect(zoneOf(s, "player1", "SPEC-TGT:dt")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-MORPH:m")).toBe("discard");
    expect(cardIn(s, "player1", "TST-OP-DA:cDA0")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-OP-DA:cDA1")?.commandHeld).toBe(true);
  });

  it.fails("RK-317: コマンドゾーンの置き換え先を選んだときはホールドしない（捨札から選ぶときだけ）（出典: atwiki/page-1389「ホールドしてもよい。そうしたとき、かわりに」）", () => {
    const s0 = pod({ command: [...releasedCat("DA", 2), inst("SPEC-TGT", "ct")] });
    expect(morphCandidates(s0)).toEqual(["SPEC-TGT:ct", "SPEC-TGT:dt"]);
    const s = pickAs(s0, "player1", "SPEC-TGT:ct");
    expect(zoneOf(s, "player1", "SPEC-TGT:ct")).toBe("rush");
    expect(cardIn(s, "player1", "TST-OP-DA:cDA0")?.commandHeld ?? false).toBe(false);
  });

  it("RK-317: DA を持つリリース状態のコマンドが1つ（ほかは WB）では捨札から選べない（出典: atwiki/page-1389「DAを持つ自軍コマンドを2つ」）", () => {
    expect(morphCandidates(pod({ command: [...releasedCat("DA", 1), ...releasedCat("WB", 1)] }))).toEqual([]);
  });

  it.fails("RK-317: 自軍エリアに「キャッスルドラン」があれば、DA のコマンド1つで捨札から選べる（出典: atwiki/page-1389「自軍エリアに｢キャッスルドラン｣があれば1つ」）", () => {
    const s0 = pod({ rush: [inst("RK-317", "sd"), inst("SPEC-MORPH", "m"), inst("RK-238", "cd")], command: releasedCat("DA", 1) });
    expect(morphCandidates(s0)).toEqual(["SPEC-TGT:dt"]);
    const s = pickAs(s0, "player1", "SPEC-TGT:dt");
    expect(zoneOf(s, "player1", "SPEC-TGT:dt")).toBe("rush");
    expect(cardIn(s, "player1", "TST-OP-DA:cDA0")?.commandHeld).toBe(true);
  });

  it("RK-317: シュードランが自軍エリアになければ捨札からは選べない（出典: atwiki/page-1389「これが自軍エリアにある間」）", () => {
    expect(morphCandidates(pod({ rush: [inst("SPEC-MORPH", "m")] }))).toEqual([]);
  });
});

// ===========================================================================
describe("RK-318 仮面ライダーイクサSM", () => {
  const TEXT =
    "【ブロウクン・ファング】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから敵軍ダメージの点数以下の必要パワーの数字を持つSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。そうしたとき、このユニットがリリース状態ならホールドし、ホールド状態なら撃破する。";

  it("RK-318: カタログ本文・スペックが出典と一致（出典: atwiki/page-1385）", () => {
    expectCatalogText("RK-318", TEXT);
    expectStats("RK-318", { name: "仮面ライダーイクサSM", category: "ET", size: "S", bp: 500, sp: "1/5", powerCost: 2, features: ["仮面ライダー", "メカ", "男"] });
    expectRarityIn("RK-318", ["NR"]);
  });

  const enemy = (p2: Partial<GameState["players"]["player2"]> = {}) => ({
    battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b"), inst("SPEC-C3", "c"), inst("SPEC-M2", "m")],
    rush: [inst("SPEC-C1", "r")],
    power: damageCards(2, "ed"),
    damage: 2,
    ...p2,
  });
  const fang = (self = inst("RK-318", "sm"), p2: Partial<GameState["players"]["player2"]> = {}) => enter(board({ rush: [self] }, enemy(p2)), self.instanceId);

  it.fails("RK-318: 【ブロウクン・ファング】自軍ターン中に出たとき、敵軍バトルエリアの、敵軍ダメージ（2）以下の必要パワーの S ユニットから1体選ぶ（強制。M・ラッシュエリアは対象外）（出典: atwiki/page-1385「敵軍バトルエリアから敵軍ダメージの点数以下の必要パワーの数字を持つSユニットを1体選び」・カード評価「効果が強制的に発動する」）", () => {
    const s = fang();
    expectChoiceFrom(s, "player1", "RK-318");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-318: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれ、リリース状態のこのユニットはホールドされる（出典: atwiki/page-1385「持ち主のコマンドゾーンにホールド状態で置く」「このユニットがリリース状態ならホールドし」）", () => {
    const s = resolveAll(pick(fang(), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C2:b")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "RK-318:sm")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "RK-318:sm")).toBe("battle");
  });

  it.fails("RK-318: ホールド状態で出たときは、置いた後にこのユニットが撃破される（出典: atwiki/page-1385「ホールド状態なら撃破する」）", () => {
    const s = resolveAll(pick(fang(heldUnit("RK-318", "sm")), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("command");
    expect(zoneOf(s, "player1", "RK-318:sm")).toBe("discard");
  });

  it.fails("RK-318: 敵軍コマンドゾーンが5枚なら選んだユニットは捨札になり、このユニットはホールドされる（出典: atwiki/page-1385「置けなければ捨札にする。そうしたとき」）", () => {
    const s = resolveAll(pick(fang(undefined, { command: releasedCat("WB", 5, "ec") }), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("discard");
    expect(cardIn(s, "player1", "RK-318:sm")?.commandHeld).toBe(true);
  });

  it.fails("RK-318: 敵軍ダメージが0なら必要パワー0の S ユニットだけを選べる（出典: atwiki/page-1385「敵軍ダメージの点数以下」）", () => {
    const s = fang(undefined, { battle: [inst("SPEC-C0", "z"), inst("SPEC-C1", "a")], power: [], damage: 0 });
    expect(choiceIds(s)).toEqual(["SPEC-C0:z"]);
  });

  it("RK-318: 選べるユニットがなければ何も起きない（このユニットはホールドされない）（出典: atwiki/page-1385「そうしたとき」）", () => {
    const s = resolveAll(fang(undefined, { battle: [inst("SPEC-C3", "c")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-318");
    expect(cardIn(s, "player1", "RK-318:sm")?.commandHeld ?? false).toBe(false);
  });

  it("RK-318: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1385「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-318:sm", {}, { battle: [inst("SPEC-C1", "a")], damage: 2, power: damageCards(2, "ed") }, EXTRA);
    expect(zoneOf(s, "player1", "RK-318:sm")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-318");
  });
});

// ===========================================================================
describe("RK-319 仮面ライダーイクサBM", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍コマンドゾーンのカードを１枚選び捨札にしてもよい。そうしたとき、自軍山札を見て、必要パワーの数字が「1」か「9」か「3」のカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい。その後、山札をシャッフルする。 【イクサ・ジャッジメント】敵軍バトルエリアから、BPが本来のBPでないユニットを１体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RK-319: カタログ本文・スペックが出典と一致（出典: atwiki/page-1408）", () => {
    expectCatalogText("RK-319", TEXT);
    expectStats("RK-319", { name: "仮面ライダーイクサBM", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "メカ", "男"] });
    expectRarityIn("RK-319", ["SR"]);
  });

  const deck = () => [inst("SPEC-C2", "d2"), inst("SPEC-C1", "d1"), inst("SPEC-C9", "d9"), inst("SPEC-C3P", "d3p"), inst("SPEC-C4", "d4")];
  const rushedBm = () => rushed(rushPhase({ hand: [inst("RK-319", "bm")], command: [...releasedCat("ET", 1), released("SPEC-C4", "cmd")], power: powerCards(4), deck: deck() }), "RK-319:bm");

  it.fails("RK-319: ※ ラッシュしたとき、自軍コマンドゾーンのカードを1枚選んで捨札にできる（任意）（出典: atwiki/page-1408「自軍コマンドゾーンのカードを１枚選び捨札にしてもよい」）", () => {
    const s = rushedBm();
    expectChoiceFrom(s, "player1", "RK-319");
    expect(choiceIds(s)).toEqual(["SPEC-C4:cmd", "TST-OP-ET:cET0"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-319: 捨札にすると、自軍山札から必要パワーの数字が1・9・3のカードを選べる（「3+」も数字は3。任意）（出典: atwiki/page-1408「必要パワーの数字が「1」か「9」か「3」のカードを1枚選び…置いてもよい」）", () => {
    const s = pick(rushedBm(), "SPEC-C4:cmd");
    expect(zoneOf(s, "player1", "SPEC-C4:cmd")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-319");
    expect(choiceIds(s)).toEqual(["SPEC-C1:d1", "SPEC-C3P:d3p", "SPEC-C9:d9"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-319: 選んだカードは自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1408「自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = resolveAll(pick(pick(rushedBm(), "SPEC-C4:cmd"), "SPEC-C9:d9"));
    expect(zoneOf(s, "player1", "SPEC-C9:d9")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-C9:d9")?.commandHeld).toBe(true);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it.fails("RK-319: 捨札にしなければ何も起きない（出典: atwiki/page-1408「捨札にしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(rushedBm()));
    expect(zoneOf(s, "player1", "SPEC-C4:cmd")).toBe("command");
    expect(s.players.player1.deck).toHaveLength(5);
  });

  /** 敵軍バトルエリア: RK-332 龍騎（2nd）2体（「ドラゴン」の SPEC-DRAGON がいるので BP が本来の値でない）・SPEC-DRAGON・SPEC-C1。ラッシュエリアにも RK-332。 */
  const judge = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcRideOff(
      board(
        { rush: [inst("RK-319", "bm"), inst("SPEC-VEHICLE", "v")] },
        { battle: [inst("RK-332", "r1"), inst("RK-332", "r2"), inst("SPEC-DRAGON", "d"), inst("SPEC-C1", "a")], rush: [inst("RK-332", "rr")], ...p2 },
      ),
      "RK-319:bm",
      "SPEC-VEHICLE:v",
    );

  it.fails("RK-319: 【イクサ・ジャッジメント】RC — 敵軍バトルエリアの、BP が本来の BP でないユニットから1体選ぶ（強制。ラッシュエリア・本来の BP のユニットは対象外）（出典: atwiki/page-1408「敵軍バトルエリアから、BPが本来のBPでないユニットを１体選び」）", () => {
    const s = judge();
    expect(bpOf(s, "player2", "RK-332:r1")).toBe(4000);
    expectChoiceFrom(s, "player1", "RK-319");
    expect(choiceIds(s)).toEqual(["RK-332:r1", "RK-332:r2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-319: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1408「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(judge(), "RK-332:r2"));
    expect(zoneOf(s, "player2", "RK-332:r2")).toBe("command");
    expect(cardIn(s, "player2", "RK-332:r2")?.commandHeld).toBe(true);
  });

  it("RK-319: ライドオフせずに出たとき（RC が発動しない）は何も起きない（出典: atwiki/page-1408「CN：RC」）", () => {
    const s = enter(board({ rush: [inst("RK-319", "bm")] }, { battle: [inst("RK-332", "r1"), inst("SPEC-DRAGON", "d")] }), "RK-319:bm");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-319");
  });
});

// ===========================================================================
describe("RK-320 仮面ライダーライジングイクサ", () => {
  const TEXT =
    "※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、必要パワーの数字が「1」「9」「3」の自軍コマンドがそれぞれあれば、これを自軍ラッシュエリアに出してもよい。 【ファイナルライジングブラスト】これが自軍バトルエリアにある間、敵軍ターン中、ストライクを2回以上されてダメージを受けたとき、これをラッシュエリアに戻してもよい。そうしたとき、敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RK-320: カタログ本文・スペックが出典と一致（出典: atwiki/page-1250）", () => {
    expectCatalogText("RK-320", TEXT);
    expectStats("RK-320", { name: "仮面ライダーライジングイクサ", category: "ET", size: "S", bp: 6000, sp: 1, powerCost: "5+", features: ["仮面ライダー", "メカ", "男"], rushCondition: "discard_named_unit" });
    expectRarityIn("RK-320", ["SR"]);
  });

  const rushRi = (destination: "command" | "discard") =>
    rushFromHand(rushPhase({ hand: [inst("RK-320", "ri")], rush: [inst("RK-319", "bm")], power: powerCards(5), command: releasedCat("ET", 1) }), "player1", "RK-320:ri", { materials: ["RK-319:bm"], destination });

  it("RK-320: 追加条件 — 自軍「仮面ライダーイクサBM」をコマンドゾーンに送ってラッシュできる（出典: atwiki/page-1250「追加条件：自軍「仮面ライダーイクサBM」1体をコマンドゾーンに送るか捨札にする」）", () => {
    const r = rushRi("command");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-320:ri")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-319:bm")).toBe("command");
  });

  it("RK-320: 追加条件 — 自軍「仮面ライダーイクサBM」を捨札にしてもラッシュできる（出典: atwiki/page-1250）", () => {
    const r = rushRi("discard");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-319:bm")).toBe("discard");
  });

  const cmd = (...ids: string[]) => ids.map((id, i) => released(id, `k${i}`));

  it.fails("RK-320: ※ 自軍コマンドゾーンにある間、自軍ラッシュフェイズ中に必要パワー1・9・3の自軍コマンドがそれぞれあれば、自軍ラッシュエリアに出せる（必要パワー・ホールド・追加条件は要らない）（出典: atwiki/page-1250「これを自軍ラッシュエリアに出してもよい」・カード評価「必要パワーを無視かつコマンドのホールドや追加条件を満たす必要もない」）", () => {
    const s0 = rushPhase({ command: [inst("RK-320", "ri"), ...cmd("SPEC-C1", "SPEC-C9", "SPEC-C3")] });
    expect(canSelfRush(s0, "command", "RK-320:ri")).toBe(true);
    const s = selfRush(s0, "command", "RK-320:ri");
    expect(zoneOf(s, "player1", "RK-320:ri")).toBe("rush");
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it("RK-320: ※ 必要パワー9のコマンドがなければ出せない（出典: atwiki/page-1250「「1」「9」「3」の自軍コマンドがそれぞれあれば」）", () => {
    expect(canSelfRush(rushPhase({ command: [inst("RK-320", "ri"), ...cmd("SPEC-C1", "SPEC-C3", "SPEC-C4")] }), "command", "RK-320:ri")).toBe(false);
  });

  it("RK-320: ※ 自軍バトルフェイズには出せない（出典: atwiki/page-1250「自軍ラッシュフェイズ中」）", () => {
    expect(canSelfRush(board({ command: [inst("RK-320", "ri"), ...cmd("SPEC-C1", "SPEC-C9", "SPEC-C3")] }), "command", "RK-320:ri")).toBe(false);
  });

  /** 敵軍ターン: 敵軍のバトルエリアの SP1 のユニット2体が順にストライクする。 */
  const blastBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enemyTurn(
      { battle: [inst("RK-320", "ri")], power: powerCards(4), ...p1 },
      { battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2")], rush: [inst("SPEC-C1", "t"), inst("SPEC-M2", "tm")] },
    );
  const struck = (s: GameState, id: string) => settle(strike(s, id, "player2"));

  it("RK-320: 【ファイナルライジングブラスト】敵軍ターン中の1回目のストライクでダメージを受けても発動しない（出典: atwiki/page-1250「ストライクを2回以上されてダメージを受けたとき」）", () => {
    const s = struck(blastBoard(), "TST-UNIT-0:s1");
    expect(damageOf(s, "player1")).toBe(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-320");
  });

  it.fails("RK-320: 2回目のストライクでダメージを受けたとき、これをラッシュエリアに戻すかを選べる（任意）（出典: atwiki/page-1250「これをラッシュエリアに戻してもよい」）", () => {
    const s = struck(struck(blastBoard(), "TST-UNIT-0:s1"), "TST-UNIT-0:s2");
    expect(damageOf(s, "player1")).toBe(2);
    expectChoiceFrom(s, "player1", "RK-320");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-320: 戻すと、敵軍 S ユニット（エリアを問わない。M は対象外）を1体選び、持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1250「そうしたとき、敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    let s = accept(struck(struck(blastBoard(), "TST-UNIT-0:s1"), "TST-UNIT-0:s2"));
    expect(zoneOf(s, "player1", "RK-320:ri")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-320");
    expect(choiceIds(s)).toEqual(["SPEC-C1:t", "TST-UNIT-0:s1", "TST-UNIT-0:s2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-C1:t"));
    expect(zoneOf(s, "player2", "SPEC-C1:t")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C1:t")?.commandHeld).toBe(true);
  });

  it.fails("RK-320: 戻さなければバトルエリアに残り、何も起きない（出典: atwiki/page-1250「戻してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(struck(struck(blastBoard(), "TST-UNIT-0:s1"), "TST-UNIT-0:s2")));
    expect(zoneOf(s, "player1", "RK-320:ri")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C1:t")).toBe("rush");
  });

  it("RK-320: ラッシュエリアにあるときは発動しない（出典: atwiki/page-1250「これが自軍バトルエリアにある間」）", () => {
    const s = struck(struck(blastBoard({ battle: [], rush: [inst("RK-320", "ri")] }), "TST-UNIT-0:s1"), "TST-UNIT-0:s2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-320");
  });
});

// ===========================================================================
describe("RK-321 仮面ライダーサガ", () => {
  const TEXT =
    "※これはラッシュするとき、可能ならホールド状態で置く。 【スネーキングデスブレイク】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、敵軍Sユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む。ウラ向きのカードはウラ向きのまま選ぶ）を1枚選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-321: カタログ本文・スペックが出典と一致（出典: atwiki/page-1253）", () => {
    expectCatalogText("RK-321", TEXT);
    expectStats("RK-321", { name: "仮面ライダーサガ", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, features: ["仮面ライダー", "男", "ファンガイア"] });
    expectRarityIn("RK-321", ["SR"]);
  });

  it("RK-321: ※ 手札からラッシュするとき、ホールド状態で置く（出典: atwiki/page-1253「これはラッシュするとき、可能ならホールド状態で置く」・カード評価「ラッシュした際にホールドされる」）", () => {
    const s = resolveAll(rushed(rushPhase({ hand: [inst("RK-321", "sg")], command: releasedCat("MA", 1), power: powerCards(5) }), "RK-321:sg"));
    expect(zoneOf(s, "player1", "RK-321:sg")).toBe("rush");
    expect(cardIn(s, "player1", "RK-321:sg")?.commandHeld).toBe(true);
  });

  /**
   * 敵軍: バトルエリアに SPEC-VEHICLE にライドした SPEC-C1、ウラ向きのカードを重ねた SPEC-C2、カードを重ねた M ユニット。
   * ラッシュエリアにオモテ向きのカードを重ねた SPEC-C3。
   */
  const enemy = () => ({
    battle: [
      ...riding(inst("SPEC-VEHICLE", "v"), inst("SPEC-C1", "rider")),
      withStacked(inst("SPEC-C2", "st"), [faceDown("TST-OP", "fd")]),
      withStacked(inst("SPEC-M2", "m"), [inst("TST-OP", "mu")]),
    ],
    rush: [withStacked(inst("SPEC-C3", "rs"), [inst("TST-OP", "ru")])],
  });
  const snake = () => enter(board({ rush: [inst("RK-321", "sg")] }, enemy()), "RK-321:sg");

  it("RK-321: 【スネーキングデスブレイク】自軍ターン中、リリース状態で出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-1253「このユニットをホールドしてもよい」）", () => {
    const s = snake();
    expectChoiceFrom(s, "player1", "RK-321");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-321: ホールドすると、敵軍 S ユニットの下のカード（ライドされているビークル・重ねたカード。エリアを問わない。M の下は対象外）から1枚選ぶ（強制）（出典: atwiki/page-1253「敵軍Sユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む…）を1枚選び」・RK-323 カード評価「ライド中のユニットの天敵である…仮面ライダーサガ」）", () => {
    const s = accept(snake());
    expect(cardIn(s, "player1", "RK-321:sg")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-321");
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:v", "TST-OP:fd", "TST-OP:ru"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-321: ライドされているビークルを選ぶと、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれ、ライドしていたユニットは場に残る（出典: atwiki/page-1253「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(accept(snake()), "SPEC-VEHICLE:v"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-VEHICLE:v")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-C1:rider")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-C1:rider")?.mountedOnInstanceId).toBeUndefined();
  });

  it.fails("RK-321: ウラ向きに重ねたカードはウラ向きのまま選べ、ダメージになる（出典: atwiki/page-1253「ウラ向きのカードはウラ向きのまま選ぶ」）", () => {
    const s = resolveAll(pick(accept(snake()), "TST-OP:fd"));
    expect(zoneOf(s, "player2", "TST-OP:fd")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
    expect(cardIn(s, "player2", "SPEC-C2:st")?.stackedCards ?? []).toEqual([]);
  });

  it.fails("RK-321: ホールドしなければ何もしない（出典: atwiki/page-1253「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(snake()));
    expect(cardIn(s, "player1", "RK-321:sg")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-321: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1253「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-321:sg", {}, { battle: [withStacked(inst("SPEC-C2", "st"), [faceDown("TST-OP", "fd")])] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-321:sg")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-321");
  });

  it.todo(
    "RK-321: 公式Q&A — ターゲットに重ねた XG2-052 ユナイトベントを【スネーキングデスブレイク】で移動しても、ウラ向きに重ねたカードはターゲットの下に残る（ユニットでなくなったら捨札）（出典: atwiki/page-1253 Q1）— XG2-052 ユナイトベント（重ねたカードの上にさらに重ねる効果）が未実装（本範囲外のカード）",
  );
});

// ===========================================================================
describe("RK-322 仮面ライダーレイ", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ブリザードクロー・エクスキュージョン】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、このターン、これはBP+4000される。";

  it("RK-322: カタログ本文・スペックが出典と一致（出典: atwiki/page-1249）", () => {
    expectCatalogText("RK-322", TEXT);
    expectStats("RK-322", { name: "仮面ライダーレイ", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 3, features: ["仮面ライダー", "メカ", "男"] });
    expectRarityIn("RK-322", ["NR"]);
  });

  it("RK-322: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1249「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-322", "rei")] }, "RK-322:rei"))).toBe(true);
  });

  const blizzard = () => enter(board({ rush: [inst("RK-322", "rei")] }, { battle: [inst("SPEC-C1", "a")] }), "RK-322:rei");

  it("RK-322: 【ブリザードクロー・エクスキュージョン】自軍ターン中に出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-1249「このユニットをホールドしてもよい」）", () => {
    const s = blizzard();
    expectChoiceFrom(s, "player1", "RK-322");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-322: ホールドすると、このターン BP+4000（BP7000）（出典: atwiki/page-1249「そうしたとき、このターン、これはBP+4000される」・カード評価「BPが7000にまで上昇する」）", () => {
    const s = resolveAll(accept(blizzard()));
    expect(cardIn(s, "player1", "RK-322:rei")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", "RK-322:rei")).toBe(7000);
  });

  it("RK-322: ホールドしなければ BP は変わらない（出典: atwiki/page-1249「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(blizzard()));
    expect(cardIn(s, "player1", "RK-322:rei")?.commandHeld ?? false).toBe(false);
    expect(bpOf(s, "player1", "RK-322:rei")).toBe(3000);
  });

  it("RK-322: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1249「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-322:rei", {}, { battle: [inst("SPEC-C1", "a")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-322:rei")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-322");
  });
});
