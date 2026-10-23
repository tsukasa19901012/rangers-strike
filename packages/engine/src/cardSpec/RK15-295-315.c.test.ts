/**
 * カード別スペック: RK-309〜RK-315（ザ・マスクドライダーEXP vol.4 ウラタロス（2nd）〜仮面ライダーキバ飛翔態）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-309」〜「RK-315」とカード名で検索。rider_2 の「モモタロス」「ウラタロス」「キンタロス」は RK-142〜RK-145 の項、card_6 の「キバ」は
 *     RS-377 の【キバショット】）。atwiki に転載された公式 Q&A（RK-312 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST・R-CN-02・R-ADD-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 *
 * 既存の照合と重なるもの: なし（RK-310 は RK12-232-252.b の RK-240 の照合で候補のカードとして使われるだけ）。
 * RK-312 Q1 は RK10-190-210.b の RK-203 の it.todo だったものをここ（RK-312）に移した。RK-316 キバットバットⅢ世の照合（RK16-316-335）が済んだので、
 * RK-312 Q1・Q2 は実テストにした（RK-316 Q1 は RK-312 Q2 と同じ問い）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  enemyRushes,
  legal,
  pickAs,
  accept,
  attack,
  attackTargets,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  endTurn,
  enemyBoard,
  enemyEnter,
  enter,
  enteredInEnemyTurn,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  fill,
  inst,
  morphCandidates,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  toPhase,
  unitActions,
  zordDownTests,
  zoneOf,
} from "./RK15-295-315.helpers";

const KW_MORPH =
  "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";
const FEMALE3 = sUnit("SPEC-FEMALE3", { bp: 1000, powerCost: 3, features: ["女"] });
const FEMALE4 = sUnit("SPEC-FEMALE4", { bp: 1000, powerCost: 4, features: ["女"] });
const FEMALE3M = sUnit("SPEC-FEMALE3M", { bp: 1000, powerCost: 3, size: "M", features: ["女"] });
const FEMALE_COND = sUnit("SPEC-FEMALE-COND", {
  bp: 1000,
  powerCost: "2+" as never,
  features: ["女"],
  rushAdditionalCondition: { conditionId: "discard_hand_card", text: "自分の手札を1枚選び捨札にする", unitCount: 1 } as never,
});
const MALE3 = sUnit("SPEC-MALE3", { bp: 1000, powerCost: 3, features: ["男"] });
const FEMALE_ATK = sUnit("SPEC-FEMALE-ATK", { bp: 1000, sp: 1, features: ["女"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const MAOU = sUnit("SPEC-MAOU", { category: "MA", bp: 1000, powerCost: 1, features: ["魔皇力"] });
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const MORPH2 = sUnit("SPEC-MORPH2", { category: "WB", bp: 3000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
/** 特徴が RK-312 仮面ライダーキバDF と完全一致する S ユニット（モーフを持たない。RK-316 があればモーフを得る）。 */
const KIBA_LIKE = sUnit("SPEC-KIBA-LIKE", { category: "MA", bp: 2000, powerCost: 1, sp: 1, features: ["仮面ライダー", "男", "魔皇力"] });
const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const OP_RESIDENT = { id: "SPEC-RES", name: "SPEC-RES", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 1 } as unknown as CardDefinition;
const EXTRA = [PLAIN_VEHICLE, FEMALE3, FEMALE4, FEMALE3M, FEMALE_COND, MALE3, FEMALE_ATK, C1, C2, C3, M2, MAOU, MORPH, MORPH2, OP_RESIDENT, KIBA_LIKE, ENEMY0];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-309 ウラタロス（2nd）", () => {
  const TEXT =
    "【僕に釣られてみる？】自軍パワーゾーンのオモテ向きのカードから、必要パワーを満たしている特徴「女」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい（ただし追加条件は満たすこと）。この効果でラッシュしたユニットは、このターン、バトルエリアに出られない。";

  it("RK-309: カタログ本文・スペックが出典と一致（出典: atwiki/page-1280）", () => {
    expectCatalogText("RK-309", TEXT);
    expectStats("RK-309", { name: "ウラタロス", category: "OT", size: "S", bp: 1000, sp: "1/4", powerCost: 1, comboNumber: 3, features: ["イマジン", "2nd"] });
    expectRarityIn("RK-309", ["N"]);
  });

  const power = [faceUp("SPEC-FEMALE3", "f3"), faceUp("SPEC-FEMALE4", "f4"), faceUp("SPEC-FEMALE3M", "fm")];
  const fish = (p = power) => ncEnter("RK-309:ur", 2, { power: p }, {}, EXTRA);

  it("RK-309: 【僕に釣られてみる？】NC（3番目）— 自軍パワーゾーンのオモテ向きの、必要パワーを満たしている（パワーゾーンのカード枚数以下の）特徴「女」を持つ S ユニットのカードを1枚選べる（任意。パワー3枚なら必要パワー4は対象外。M ユニットも対象外）（出典: atwiki/page-1280「必要パワーを満たしている特徴「女」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい」・コメント欄「パワーを満たしていることを確認してからラッシュ」）", () => {
    const s = fish();
    expectChoiceFrom(s, "player1", "RK-309");
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE3:f3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-309: ウラ向きのカード（ダメージ）と「女」を持たないユニットのカードは選べない（出典: atwiki/page-1280「オモテ向きのカードから」「特徴「女」を持つ」）", () => {
    const s = fish([faceDown("SPEC-FEMALE3", "fd"), faceUp("SPEC-MALE3", "m3"), faceUp("SPEC-FEMALE3", "f3")]);
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE3:f3"]);
  });

  it("RK-309: パワーゾーンのカードが4枚以上なら必要パワー4の「女」も選べる（そのカード自身も数える）（出典: atwiki/page-1280 コメント欄「特徴「女」を持つユニットがパワーゾーンにいるときの数でしょうかねぇ？／合ってるよ」）", () => {
    const s = fish([faceUp("SPEC-FEMALE4", "f4"), ...powerCards(3)]);
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE4:f4"]);
  });

  it("RK-309: 選んだカードは自軍ラッシュエリアに出て、このターンはバトルエリアに出られない（出典: atwiki/page-1280「この効果でラッシュしたユニットは、このターン、バトルエリアに出られない」）", () => {
    const s = resolveAll(pick(fish(), "SPEC-FEMALE3:f3"));
    expect(zoneOf(s, "player1", "SPEC-FEMALE3:f3")).toBe("rush");
    expect(canEnter(s, "SPEC-FEMALE3:f3")).toBe(false);
  });

  it("RK-309: NC が成立しなければ（2番目）何も起きない（出典: atwiki/page-1280「CN：3」・R-CN-02）", () => {
    const s = ncEnter("RK-309:ur", 1, { power }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-309");
  });

  it("RK-309: 追加条件を持つ「女」のユニットは、追加条件を満たして出す（「自分の手札を1枚捨札にする」を実行する）（出典: atwiki/page-1280「（ただし追加条件は満たすこと）」・コメント欄「追加条件を満たしてラッシュ可能」）", () => {
    let s = ncEnter("RK-309:ur", 2, { power: [faceUp("SPEC-FEMALE-COND", "fc"), ...powerCards(1)], hand: [inst("TST-OP", "h0")] }, {}, EXTRA);
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE-COND:fc"]);
    s = resolveAll(pick(s, "SPEC-FEMALE-COND:fc"), ["TST-OP:h0"]);
    expect(zoneOf(s, "player1", "SPEC-FEMALE-COND:fc")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
  });

  it("RK-309: 追加条件を満たせない「女」のユニット（捨札にする手札がない）は選べない（出典: atwiki/page-1280「（ただし追加条件は満たすこと）」）", () => {
    const s = ncEnter("RK-309:ur", 2, { power: [faceUp("SPEC-FEMALE-COND", "fc"), ...powerCards(1)], hand: [] }, {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-309");
  });
});

// ===========================================================================
describe("RK-310 モモタロス（2nd）", () => {
  const TEXT = "※レジスト ※これは特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される。 【最後までクライマックスだぜ！】「SP1」";

  it("RK-310: カタログ本文・スペックが出典と一致（出典: atwiki/page-1279）", () => {
    expectCatalogText("RK-310", TEXT);
    expectStats("RK-310", { name: "モモタロス", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 4, features: ["イマジン", "2nd"] });
    expectRarityIn("RK-310", ["R"]);
  });

  it("RK-310: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1279「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-310", "mo")] }, "RK-310:mo"))).toBe(true);
  });

  it("RK-310: ※ 特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される（出典: atwiki/page-1279「※これは特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-310", "mo")] }, { battle: [inst("SPEC-FEMALE-ATK", "f")] }), "SPEC-FEMALE-ATK:f", "RK-310:mo", "player2"));
    expect(zoneOf(s, "player2", "SPEC-FEMALE-ATK:f")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-310:mo")).toBe("discard");
  });

  it("RK-310: 「女」を持たないユニットとのバトルに勝てば残る（出典: atwiki/page-1279）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-310", "mo")] }, { battle: [inst("TST-UNIT-0", "a")] }), "TST-UNIT-0:a", "RK-310:mo", "player2"));
    expect(zoneOf(s, "player1", "RK-310:mo")).toBe("battle");
  });

  it("RK-310: 【最後までクライマックスだぜ！】NC（4番目）で「SP1」になりストライクできる（出典: atwiki/page-1279「【最後までクライマックスだぜ！】「SP1」」「CN：4」）", () => {
    const s = ncEnter("RK-310:mo", 3, {}, {}, EXTRA);
    expect(spOf(s, "player1", "RK-310:mo")).toBe(1);
    expect(canStrike(s, "RK-310:mo")).toBe(true);
  });

  it("RK-310: NC 不成立（3番目）なら SP はない（出典: atwiki/page-1279「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RK-310:mo", 2, {}, {}, EXTRA);
    expect(spOf(s, "player1", "RK-310:mo")).toBe(0);
  });
});

// ===========================================================================
describe("RK-311 キンタロス（2nd）", () => {
  const TEXT = "※これは自軍ユニットの数が敵軍ユニットの数より多いときアタックできない。 【俺の強さにお前が泣いた】次の相手ターン、バトルエリアに出た敵軍Sユニットは、可能ならこれにアタックする。";

  it("RK-311: カタログ本文・スペックが出典と一致（出典: atwiki/page-1281）", () => {
    expectCatalogText("RK-311", TEXT);
    expectStats("RK-311", { name: "キンタロス", category: "OT", size: "S", bp: 5000, sp: undefined, powerCost: 2, comboNumber: 5, features: ["イマジン", "2nd"] });
    expectRarityIn("RK-311", ["N"]);
  });

  it("RK-311: ※ 自軍ユニットの数が敵軍ユニットの数より多いときアタックできない（出典: atwiki/page-1281「※これは自軍ユニットの数が敵軍ユニットの数より多いときアタックできない」）", () => {
    const s = enter(board({ rush: [inst("RK-311", "kt"), inst("TST-UNIT-0", "x")] }, { battle: [inst("SPEC-C1", "e")] }), "RK-311:kt");
    expect(attackTargets(s, "RK-311:kt")).toEqual([]);
  });

  it("RK-311: ※ 同数ならアタックできる（出典: atwiki/page-1281 コメント欄「同数であれば「自軍ユニットの数が敵軍ユニットの数より多い」にあたらないので、アタックすることができます」）", () => {
    const s = enter(board({ rush: [inst("RK-311", "kt")] }, { battle: [inst("SPEC-C1", "e")] }), "RK-311:kt");
    expect(attackTargets(s, "RK-311:kt")).toEqual(["SPEC-C1:e"]);
  });

  it("RK-311: ※ ビークルはユニットの数に数えない（ビークルを含めると多いが、ユニットだけなら同数）（出典: atwiki/page-1281「自軍ユニットの数」）", () => {
    const s = enter(board({ rush: [inst("RK-311", "kt"), inst("SPEC-VEHICLE", "v")] }, { battle: [inst("SPEC-C1", "e")] }), "RK-311:kt");
    expect(attackTargets(s, "RK-311:kt")).toEqual(["SPEC-C1:e"]);
  });

  /** player1 がキンタロスを n 番目に出してターンを終え、player2 のバトルフェイズで SPEC-C1:e を出す。 */
  const nextEnemyTurn = (fillers: number, enemyUnit = "SPEC-C1") => {
    let s = ncEnter("RK-311:kt", fillers, {}, { rush: [inst(enemyUnit, "e")] }, EXTRA);
    s = endTurn(resolveAll(s));
    s = toPhase(s, "player2", "battle");
    return enemyEnter(s, `${enemyUnit}:e`);
  };

  it("RK-311: 【俺の強さにお前が泣いた】NC（5番目）— 次の相手ターン、バトルエリアに出た敵軍 S ユニットはこれにアタックしなければならない（ほかへのアタック・ストライク・何もしないは選べない）（出典: atwiki/page-1281「次の相手ターン、バトルエリアに出た敵軍Sユニットは、可能ならこれにアタックする」・コメント欄「「何もしない」と「ストライク」を選択できない／そうです」）", () => {
    const s = nextEnemyTurn(4);
    const acts = unitActions(s, "SPEC-C1:e");
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.type === "battle" && a.defenderInstanceId === "RK-311:kt")).toBe(true);
  });

  it("RK-311: NC が成立しなければ（4番目）次の相手ターンの敵軍ユニットは自由に行動できる（出典: atwiki/page-1281「CN：5」・R-CN-02）", () => {
    const s = nextEnemyTurn(3);
    expect(unitActions(s, "SPEC-C1:e").some((a) => a.type === "strike")).toBe(true);
  });

  it("RK-311: 敵軍の M ユニットは制限を受けない（出典: atwiki/page-1281「敵軍Sユニットは」）", () => {
    const s = nextEnemyTurn(4, "SPEC-M2");
    expect(unitActions(s, "SPEC-M2:e").some((a) => a.type === "strike")).toBe(true);
  });
});

// ===========================================================================
describe("RK-312 仮面ライダーキバDF", () => {
  const TEXT =
    "※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。 【ドッガ・サンダースラップ】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアから、自分の手札の枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。";

  it("RK-312: カタログ本文・スペックが出典と一致（出典: atwiki/page-1365）", () => {
    expectCatalogText("RK-312", TEXT);
    expectStats("RK-312", { name: "仮面ライダーキバDF", category: "MA", size: "S", bp: 5000, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("RK-312", ["R"]);
  });

  it("RK-312: ※ 自軍コマンドを2つホールドしなければバトルエリアに出られない（リリース状態のコマンドが1つでは出られない）（出典: atwiki/page-1365「※これは自軍コマンドを2つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-312", "df")], command: releasedCat("WB", 1) }), "RK-312:df")).toBe(false);
    expect(canEnter(board({ rush: [inst("RK-312", "df")], command: releasedCat("WB", 2) }), "RK-312:df")).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C2", "a"), inst("SPEC-C3", "b"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] };
  const slap = (hand = deckCards(2, "h"), p2: Partial<GameState["players"]["player2"]> = enemy) => {
    const s = board({ rush: [inst("RK-312", "df")], command: releasedCat("WB", 2), hand }, p2);
    return enterWithHold(s, "RK-312:df", ["TST-OP:cWB0", "TST-OP:cWB1"]);
  };

  it("RK-312: 【ドッガ・サンダースラップ】自軍ターン中に出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-1365「このユニットをホールドしてもよい」）", () => {
    const s = slap();
    expectChoiceFrom(s, "player1", "RK-312");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-312: ホールドすると、敵軍バトルエリアの、自分の手札の枚数（2）以下の必要パワーの S ユニットから1体選ぶ（強制。M・ラッシュエリアは対象外）（出典: atwiki/page-1365「敵軍バトルエリアから、自分の手札の枚数以下の必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する」）", () => {
    const s = accept(slap());
    expect(cardIn(s, "player1", "RK-312:df")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-C2:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-312: 選んだユニットは撃破される（出典: atwiki/page-1365「撃破する」）", () => {
    const s = resolveAll(pick(accept(slap()), "SPEC-C2:a"));
    expect(zoneOf(s, "player2", "SPEC-C2:a")).toBe("discard");
  });

  it("RK-312: ホールドしなければ何もしない（出典: atwiki/page-1365「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(slap()));
    expect(cardIn(s, "player1", "RK-312:df")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player2", "SPEC-C2:a")).toBe("battle");
  });

  it("RK-312: 公式Q&A — 【ドッガ・サンダースラップ】で敵軍 RK-203 ファイズAF を撃破し、捨札からラッシュされたファイズに対して、RK-316【フエッスル】で得たモーフで出たばかりのキバDF を置き換えると、置き換えたユニットはアタック・ストライクできる（出典: atwiki/page-1365 Q1・atwiki/page-873 Q1「置き換える元のユニットが、まだアタックやストライクを行っていないのであれば、置き換えた後のユニットもアタックやストライクを行うことができます」）", () => {
    let s = board(
      { rush: [inst("RK-312", "df"), inst("RK-316", "kb")], command: [...releasedCat("WB", 2), inst("SPEC-KIBA-LIKE", "k2")], hand: deckCards(7, "h") },
      { battle: [inst("RK-203", "af")], discard: [inst("RK-064", "fz")] },
    );
    s = enterWithHold(s, "RK-312:df", ["TST-OP:cWB0", "TST-OP:cWB1"]);
    s = pick(accept(s), "RK-203:af");
    for (let i = 0; i < 8 && morphCandidates(s).length === 0; i++) {
      const p = s.pendingEffectChoice;
      if (p && p.playerId === "player2" && p.validInstanceIds[0]) {
        s = pickAs(s, "player2", p.validInstanceIds[0]);
        continue;
      }
      const pass = legal(s).find((a) => a.type === "pass_leave_reaction" || a.type === "pass_rush_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(zoneOf(s, "player2", "RK-064:fz")).toBe("rush");
    expect(morphCandidates(s)).toEqual(["SPEC-KIBA-LIKE:k2"]);
    s = pickAs(s, "player1", "SPEC-KIBA-LIKE:k2");
    expect(zoneOf(s, "player1", "SPEC-KIBA-LIKE:k2")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-312:df")).toBe("command");
    expect(canStrike(s, "SPEC-KIBA-LIKE:k2")).toBe(true);
  });

  /** 敵軍のラッシュに対し、自軍バトルエリアの「魔皇力」の S ユニット（RK-316 でモーフを得る）をコマンドゾーンの RK-312 と置き換える場面。 */
  const morphIntoBattle = (command = releasedCat("WB", 2)) =>
    enemyRushes({ rush: [inst("RK-316", "kb")], battle: [inst("SPEC-KIBA-LIKE", "k")], command: [inst("RK-312", "df"), ...command] }, "SPEC-ENEMY0:e", EXTRA);

  it("RK-312: 公式Q&A — RK-316【フエッスル】で得たモーフでバトルエリアに出るときも、自軍コマンドを2つホールドする（出典: atwiki/page-1365 Q2・atwiki/page-1346 Q1「はい、コマンドをホールドしてください」）", () => {
    const s0 = morphIntoBattle();
    expect(morphCandidates(s0)).toEqual(["RK-312:df"]);
    const s = pickAs(s0, "player1", "RK-312:df");
    expect(zoneOf(s, "player1", "RK-312:df")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-OP:cWB1")?.commandHeld).toBe(true);
  });

  it("RK-312: リリース状態の自軍コマンドが1つしかなければ、モーフでバトルエリアに出ることはできない（置き換え先の候補にならない）（出典: atwiki/page-1365「※これは自軍コマンドを2つホールドしなければバトルエリアに出られない」・Q2）", () => {
    expect(morphCandidates(morphIntoBattle(releasedCat("WB", 1)))).toEqual([]);
  });
});

// ===========================================================================
describe("RK-313 仮面ライダーキバDGBKF", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーキバ」を1体選び、自軍ラッシュエリアに出す。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ダークネスムーンブレイク】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-313: カタログ本文・スペックが出典と一致（出典: atwiki/page-1247）", () => {
    expectCatalogText("RK-313", TEXT);
    expectStats("RK-313", { name: "仮面ライダーキバDGBKF", category: "MA", size: "S", bp: 4500, sp: "1/3", powerCost: "7-", features: ["仮面ライダー", "男", "魔皇力"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-313", ["R"]);
  });

  zordDownTests("RK-313", "RK-245", "仮面ライダーキバ", "atwiki/page-1247", "MA");
  reanimateTests("RK-313", "RK-245", "仮面ライダーキバ", "atwiki/page-1247");

  it("RK-313: ※ 名前に「仮面ライダーキバ」を含むだけのカード（キバDF）は出せない（出典: atwiki/page-1247 コメント欄「『仮面ライダーキバDF』など名前に仮面ライダーキバが入っていたら出せますか？／それは無理です」）", () => {
    const s = attackUntilRegister({ battle: [inst("RK-313", "dg")], discard: [inst("RK-312", "df")] }, "RK-313:dg");
    const t = resolveAll(settle(s));
    expect(zoneOf(t, "player1", "RK-312:df")).toBe("discard");
  });

  it("RK-313: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1247・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-313", "dg")] }, "RK-313:dg"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  const entered = () => enter(board({ rush: [inst("RK-313", "dg")] }, enemy), "RK-313:dg");

  it("RK-313: 【ダークネスムーンブレイク】自軍ターン中に出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-1247「このユニットをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-313");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-313: ホールドすると、敵軍 S ユニット（エリアを問わない。M は対象外）から1体選び、持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1247「敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = accept(entered());
    expect(cardIn(s, "player1", "RK-313:dg")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:r"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-C2:r"));
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C2:r")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-313: ホールドしなければ何もしない（出典: atwiki/page-1247「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RK-314 仮面ライダーキバEF", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【モンスターフィーバー】自軍ターン中、これがバトルエリアに出るとき、自分の手札から特徴「魔皇力」を持つ、追加条件を持たないSユニットのカードを1枚選び相手に見せてもよい。そうしたとき、そのユニットカードの効果名を持つ効果を、このユニットの効果として発動する。";

  it("RK-314: カタログ本文・スペックが出典と一致（出典: atwiki/page-1260）", () => {
    expectCatalogText("RK-314", TEXT);
    expectStats("RK-314", { name: "仮面ライダーキバEF", category: "MA", size: "S", bp: 5000, sp: "1/3", powerCost: "6+", features: ["仮面ライダー", "男", "魔皇力"], rushCondition: "discard_feature_unit" });
    expectRarityIn("RK-314", ["SR"]);
  });

  it("RK-314: 追加条件 — 特徴「魔皇力」を持つ自軍ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1260「追加条件：特徴「魔皇力」を持つ自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-314", "ef")], rush: [inst("SPEC-MAOU", "k")], power: powerCards(6), command: releasedCat("MA", 1) }), "player1", "RK-314:ef", { materials: ["SPEC-MAOU:k"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-314:ef")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-MAOU:k")).toBe("discard");
  });

  it("RK-314: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1260・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-314", "ef")] }, "RK-314:ef"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  const fever = (hand = [inst("RK-245", "kb"), inst("RK-246", "gf"), inst("RK-313", "dg"), inst("RK-315", "hs"), inst("SPEC-C1", "x")], p2: Partial<GameState["players"]["player2"]> = enemy) =>
    enter(board({ rush: [inst("RK-314", "ef")], hand }, p2), "RK-314:ef");

  it("RK-314: 【モンスターフィーバー】自軍ターン中に出るとき、手札の特徴「魔皇力」を持つ、追加条件を持たない S ユニットのカードを1枚選べる（任意。必要パワーに「+」「-」のあるキバDGBKF・飛翔態は対象外）（出典: atwiki/page-1260「自分の手札から特徴「魔皇力」を持つ、追加条件を持たないSユニットのカードを1枚選び相手に見せてもよい」・コメント欄「追加条件無しの制限がなければDGBKにも対応出来たのに」）", () => {
    const s = fever();
    expectChoiceFrom(s, "player1", "RK-314");
    expect(choiceIds(s)).toEqual(["RK-245:kb", "RK-246:gf"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-314: キバ（RK-245）を見せると、その【ダークネスムーンブレイク】をこのユニットの効果として発動する（このユニットをホールドして敵軍 S ユニットをダメージにする）。見せたカードは手札に残る（出典: atwiki/page-1260「そのユニットカードの効果名を持つ効果を、このユニットの効果として発動する」・カード評価「手札にある仮面ライダーキバなどの効果を使うことができる」）", () => {
    let s = pick(fever(), "RK-245:kb");
    expect(zoneOf(s, "player1", "RK-245:kb")).toBe("hand");
    s = accept(s);
    expect(cardIn(s, "player1", "RK-314:ef")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:r"]);
    s = resolveAll(pick(s, "SPEC-C2:r"));
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-314: キバGF（RK-246）を見せると【ガルル・ハウリングスラッシュ】を発動する（相手の手札の枚数以下の必要パワーの、敵軍バトルエリアの S ユニット）（出典: atwiki/page-1260・atwiki/page-959）", () => {
    const s = accept(pick(fever(undefined, { ...enemy, battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b")], hand: deckCards(1, "eh") }), "RK-246:gf"));
    expect(choiceIds(s)).toEqual(["SPEC-C1:a"]);
  });

  it("RK-314: 見せなければ何も起きない（出典: atwiki/page-1260「見せてもよい」）", () => {
    const s = resolveAll(skip(fever()));
    expect(cardIn(s, "player1", "RK-314:ef")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-314: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出るときは発動しない（出典: atwiki/page-1260「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-314:ef", { hand: [inst("RK-245", "kb")] }, { battle: [inst("SPEC-C1", "a")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-314:ef")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-314");
  });

  it.todo(
    "RK-314: 【モンスターフィーバー】で XG 以降の「魔皇力」のカード（XG3-072 キバーラ【誘いの罠】・XG5-077 キバーラ【ソニックスタッブ】など）の効果を発動する（出典: atwiki/page-1260）— 本範囲では、効果名を持つ効果をほかのユニットの効果として発動する処理を RK-237・RK-245・RK-246・RK-312 だけ実装した（ほかのカードは候補にしない）",
  );
});

// ===========================================================================
describe("RK-315 仮面ライダーキバ飛翔態", () => {
  const TEXT = "【飛翔する翼】これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("RK-315: カタログ本文・スペックが出典と一致（出典: atwiki/page-1248）", () => {
    expectCatalogText("RK-315", TEXT);
    expectStats("RK-315", { name: "仮面ライダーキバ飛翔態", category: "MA", size: "S", bp: 9000, sp: 1, powerCost: "6+", features: ["仮面ライダー", "男", "魔皇力", "ファンガイア"], rushCondition: "discard_named_unit" });
    expectRarityIn("RK-315", ["SR"]);
  });

  it("RK-315: 追加条件 — 自軍「仮面ライダーキバEF」1体を捨札にしてラッシュできる（出典: atwiki/page-1248「追加条件：自軍「仮面ライダーキバEF」1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-315", "hs")], rush: [inst("RK-314", "ef")], power: powerCards(6), command: releasedCat("MA", 1) }), "player1", "RK-315:hs", { materials: ["RK-314:ef"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-315:hs")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-314:ef")).toBe("discard");
  });

  it("RK-315: 【飛翔する翼】敵軍ラッシュエリアのユニットにアタックできる（バトルエリアの何番目に出ても）（出典: atwiki/page-1248「これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = enter(board({ battle: fill(1), rush: [inst("RK-315", "hs")] }, { battle: [inst("SPEC-C1", "b")], rush: [inst("SPEC-C2", "r")] }), "RK-315:hs");
    expect(targetsOf(s, "RK-315:hs")).toEqual(["SPEC-C1:b", "SPEC-C2:r"]);
  });

  it("RK-315: 印刷の SP1 でストライクできる（出典: atwiki/page-1248「SP：1」）", () => {
    const s = enter(board({ battle: fill(2), rush: [inst("RK-315", "hs")] }), "RK-315:hs");
    expect(canStrike(s, "RK-315:hs")).toBe(true);
  });
});
