/**
 * カード別スペック: RK-267〜RK-273（ザ・マスクドライダーEXP vol.4 海兵隊長ボスガン〜仮面ライダークウガRP）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-267」〜「RK-273」とカード名で検索）。atwiki に転載された公式 Q&A（RK-268 Q1・Q2、RK-271 Q1〜Q4、RK-272 Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH、R-KW-RESIST、R-ADD-02、R-CN 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-268 Q2（デスガロンの下でガタックMF を撃破したときのキラーオーの BP の参照）— cardSpec/RS4-222-242.a.test.ts RS-226
 *  - RK-271 Q1（ベリーでクウガMF を追加条件の指定ユニットとして扱う）— cardSpec/RK9-169-189.c.test.ts RK-188・cardSpec/RK2-022-042.b.test.ts RK-029
 *  - RK-271 Q2・Q3 = RK-272 Q2・Q3（闇のヤイバ＋龍星王でクウガRD がモーフできない）— cardSpec/RS5-285-305.a.test.ts RS-290・
 *    cardSpec/RS5-327-347.b.test.ts RS-339
 *  - RK-271 Q4（バトルで撃破したアポロガイストは【ライジングマイティキック】の対象にならない）— cardSpec/RK5-085-105.c.test.ts RK-099
 *    （本範囲の実装に合わせて it.todo を実テストにした）
 *  - RK-272 Q1（レッドドラスの【合体吸収】で発動した RC の効果を無効にできる）— cardSpec/RK9-169-189.c.test.ts RK-185（同上）
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import { validateDeckEntries } from "@rangers-strike/cards";
import { fillerEntries } from "../rulesSpec/01-helpers";
import {
  PLAIN_VEHICLE,
  accept,
  act,
  attack,
  canStrike,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  damageOf,
  deckCards,
  enemyBoard,
  enemyRcRideOff,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  inst,
  legal,
  morphCandidates,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  rcRideOff,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  rushFromHand,
  rushVia,
  canStartRush,
  settle,
  skip,
  st,
  strike,
  sUnit,
  targetsOf,
  zoneOf,
  canAttack,
} from "./RK13-253-273.helpers";

const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const CN1 = sUnit("SPEC-CN1", { bp: 1000, powerCost: 1, comboNumber: 1 });
const AMADAM = sUnit("SPEC-AMADAM", { category: "MA", bp: 1000, features: ["アマダム"] });
const NONAMADAM = sUnit("SPEC-NONAMADAM", { category: "MA", bp: 1000, features: ["仮面ライダー"] });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const NOSP1000 = sUnit("SPEC-NOSP1000", { bp: 1000, sp: undefined });
const OWN2000 = sUnit("SPEC-OWN2000", { bp: 2000 });
const OWN5000 = sUnit("SPEC-OWN5000", { bp: 5000 });
const EXTRA = [PLAIN_VEHICLE, ENEMY0, CN1, AMADAM, NONAMADAM, E1000, E2000, E3500, E5000, EM2000, NOSP1000, OWN2000, OWN5000];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const boosted = (cardId: string, suf: string, bpModifier: number): CardInstance => ({ ...inst(cardId, suf), bpModifier });

/** アタック後、レジストの提示か反応の終わりまで進める（レジストはパスしない）。 */
function untilRegister(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 6 && !legal(n).some((a) => a.type === "use_register"); i++) {
    const p = legal(n).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
    if (!p) break;
    n = act(n, p);
  }
  return n;
}
const registerFor = (s: GameState, playerId: "player1" | "player2") => legal(s).some((a) => a.type === "use_register" && a.playerId === playerId);

// ===========================================================================
describe("RK-267 海兵隊長ボスガン", () => {
  const TEXT = "※これはBP2000以下のユニットにアタックできない。 【怪魔稲妻剣】このユニットとバトルして撃破された敵軍ユニットは、レジストを発動する事ができない。";

  it("RK-267: カタログ本文・スペックが出典と一致（出典: atwiki/page-1363）", () => {
    expectCatalogText("RK-267", TEXT);
    expectStats("RK-267", { name: "海兵隊長ボスガン", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 2, features: ["クライシス帝国", "男"] });
    expectRarityIn("RK-267", ["N"]);
  });

  it("RK-267: ※ BP2000 以下のユニットにアタックできない（出典: atwiki/page-1363「これはBP2000以下のユニットにアタックできない」）", () => {
    const s = board({ battle: [inst("RK-267", "bg")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-EM2000", "m")] });
    expect(targetsOf(s, "RK-267:bg")).toEqual(["SPEC-E3500:b"]);
  });

  it.fails("RK-267: 【怪魔稲妻剣】これがアタックしてバトルで撃破した敵軍ユニット（RK-262 ロボライダー）は、レジストを発動できない（出典: atwiki/page-1363・カード評価「レジスト持ちを一回のバトルで撃破できる」）", () => {
    let s = untilRegister(attack(board({ battle: [boosted("RK-267", "bg", 1000)] }, { battle: [inst("RK-262", "rb")] }), "RK-267:bg", "RK-262:rb"));
    expect(registerFor(s, "player2")).toBe(false);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "RK-262:rb")).toBe("discard");
  });

  it.fails("RK-267: 敵軍ターンにこれにアタックしてバトルで撃破された敵軍ユニットも、レジストを発動できない（出典: atwiki/page-1363「このユニットとバトルして撃破された敵軍ユニットは」）", () => {
    let s = untilRegister(attack(enemyTurn({ battle: [boosted("RK-267", "bg", 1000)] }, { battle: [inst("RK-262", "rb")] }), "RK-262:rb", "RK-267:bg", "player2"));
    expect(registerFor(s, "player2")).toBe(false);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "RK-262:rb")).toBe("discard");
  });

  it("RK-267: ほかの自軍ユニットとのバトルで撃破された敵軍ユニットはレジストを発動できる（出典: atwiki/page-1363「このユニットとバトルして」）", () => {
    const s = untilRegister(attack(board({ battle: [inst("RK-267", "bg"), inst("TST-UNIT-7", "big")] }, { battle: [inst("RK-262", "rb")] }), "TST-UNIT-7:big", "RK-262:rb"));
    expect(registerFor(s, "player2")).toBe(true);
  });
});

// ===========================================================================
describe("RK-268 デスガロン", () => {
  const TEXT =
    "※敵軍ターン中、これがバトルで撃破されて捨札になったとき、これとバトルしたユニットを持ち主のコマンドゾーンかパワーゾーンに置いてもよい。（コマンドゾーンに置けるカードは通常5枚まで） 【分析能力】 これが自軍バトルエリアにある間、すべてのバトルは本来のBPで行う。";

  it("RK-268: カタログ本文・スペックが出典と一致（出典: atwiki/page-1349）", () => {
    expectCatalogText("RK-268", TEXT);
    expectStats("RK-268", { name: "デスガロン", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 1, features: ["クライシス帝国", "メカ", "人型"] });
    expectRarityIn("RK-268", ["NR"]);
  });

  /** 敵軍ターンに、敵軍の BP13000 のユニットにアタックされてデスガロンが撃破される。 */
  const destroyed = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    settle(attack(enemyTurn({ battle: [inst("RK-268", "dg")] }, { battle: [inst("TST-UNIT-7", "atk")], command: releasedN(2, "TST-OP", "ec"), ...p2 }), "TST-UNIT-7:atk", "RK-268:dg", "player2"));

  // atwiki/page-1349 Q1「その効果を発動した場合は、コマンドゾーンかパワーゾーン、好きな方を選んで置いてください。」
  it.fails("RK-268: ※ 敵軍ターン中にバトルで撃破されて捨札になったとき、これとバトルしたユニットを持ち主のコマンドゾーンかパワーゾーンに置くかを選べる（任意。置き先は好きな方）（出典: atwiki/page-1349・Q1）", () => {
    const s = destroyed();
    expect(zoneOf(s, "player1", "RK-268:dg")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-268");
    expect(choiceIds(s)).toEqual(["command", "power"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-268: コマンドゾーンを選ぶと、バトルしたユニットは持ち主のコマンドゾーンに置かれる（出典: atwiki/page-1349「持ち主のコマンドゾーンかパワーゾーンに置いてもよい」）", () => {
    const s = resolveAll(pick(destroyed(), "command"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("command");
  });

  it.fails("RK-268: パワーゾーンを選ぶと、バトルしたユニットは持ち主のパワーゾーンに置かれる（出典: atwiki/page-1349・Q1）", () => {
    const s = resolveAll(pick(destroyed(), "power"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("power");
  });

  // atwiki/page-1349 Q1「ただし、コマンドがすでに5つある場合は、それ以上置くこと出来ないため、強制的にパワーゾーンを選んだことになります。」
  it.fails("RK-268: 公式Q&A — 持ち主のコマンドがすでに5つなら、パワーゾーンしか選べない（出典: atwiki/page-1349 Q1）", () => {
    const s = destroyed({ command: releasedN(5, "TST-OP", "ec") });
    expectChoiceFrom(s, "player1", "RK-268");
    expect(choiceIds(s)).toEqual(["power"]);
  });

  it.fails("RK-268: 置かないことも選べる（バトルしたユニットは場に残る）（出典: atwiki/page-1349「置いてもよい」）", () => {
    const s = resolveAll(skip(destroyed()));
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("battle");
  });

  it("RK-268: 自軍ターン中にバトルで撃破されたときは発動しない（出典: atwiki/page-1349「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-268", "dg")] }, { battle: [inst("TST-UNIT-7", "big")] }), "RK-268:dg", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-268:dg")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("battle");
  });

  it.fails("RK-268: 【分析能力】これが自軍バトルエリアにある間、バトルは本来の BP で行う（BP+3000 された自軍の BP1000 のユニットは、BP2000 の敵軍ユニットに負ける）（出典: atwiki/page-1349「すべてのバトルは本来のBPで行う」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-268", "dg"), boosted("SPEC-OWN2000", "o", 3000)] }, { battle: [inst("SPEC-E3500", "e")] }), "SPEC-OWN2000:o", "SPEC-E3500:e"));
    expect(zoneOf(s, "player1", "SPEC-OWN2000:o")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3500:e")).toBe("battle");
  });

  it.fails("RK-268: 【分析能力】敵軍ユニットの BP の増加もバトルでは使われない（敵軍ターンのバトルにも及ぶ）（出典: atwiki/page-1349「すべてのバトル」・カード評価「BP増強カードのメタカード」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-268", "dg"), inst("SPEC-OWN2000", "o")] }, { battle: [boosted("SPEC-E1000", "e", 5000)] }), "SPEC-E1000:e", "SPEC-OWN2000:o", "player2"));
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-OWN2000:o")).toBe("battle");
  });

  it("RK-268: ラッシュエリアにあるときは【分析能力】は働かない（出典: atwiki/page-1349「これが自軍バトルエリアにある間」）", () => {
    const s = resolveAll(attack(board({ rush: [inst("RK-268", "dg")], battle: [boosted("SPEC-OWN2000", "o", 3000)] }, { battle: [inst("SPEC-E3500", "e")] }), "SPEC-OWN2000:o", "SPEC-E3500:e"));
    expect(zoneOf(s, "player2", "SPEC-E3500:e")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-269 シャドームーン（2nd）", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。 ※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【シャドーセイバー】 自軍ターン中、これがアタックしてバトルに勝ったとき、追加でアタックかストライクを行ってもよい。ただし、このユニットの追加のアタックまたはストライクは、1ターンに1度だけとする。";

  it("RK-269: カタログ本文・スペックが出典と一致（出典: atwiki/page-1283）", () => {
    expectCatalogText("RK-269", TEXT);
    expectStats("RK-269", { name: "シャドームーン（2nd）", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: 5, features: ["男", "改造人間", "2nd"] });
    expectRarityIn("RK-269", ["SR"]);
  });

  it("RK-269: ※ 敵軍ターン中、SP1 以上のユニットとバトルしたときは、バトルに勝っても撃破される（出典: atwiki/page-1283）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-E1000:e", "RK-269:sm", "player2"));
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-269:sm")).toBe("discard");
  });

  it("RK-269: ※ SP が空欄のユニットとのバトルに勝てば撃破されない（出典: atwiki/page-1283「SP1以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-NOSP1000", "e")] }), "SPEC-NOSP1000:e", "RK-269:sm", "player2"));
    expect(zoneOf(s, "player1", "RK-269:sm")).toBe("battle");
  });

  it("RK-269: ※ 自軍ターン中は、SP1 以上のユニットとのバトルに勝っても撃破されない（出典: atwiki/page-1283「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E1000", "e")] }), "RK-269:sm", "SPEC-E1000:e"));
    expect(zoneOf(s, "player1", "RK-269:sm")).toBe("battle");
  });

  it("RK-269: ※ 敵軍バトルエリアにユニットがあるときはストライクできない（なければできる）（出典: atwiki/page-1283「敵軍バトルエリアにユニットがあるとき、これはストライクできない」）", () => {
    expect(canStrike(board({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E5000", "e")] }), "RK-269:sm")).toBe(false);
    expect(canStrike(board({ battle: [inst("RK-269", "sm")] }, { rush: [inst("SPEC-E5000", "e")] }), "RK-269:sm")).toBe(true);
  });

  it.fails("RK-269: 【シャドーセイバー】自軍ターン中、アタックしてバトルに勝ったとき、追加でアタックできる（出典: atwiki/page-1283「追加でアタックかストライクを行ってもよい」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E1000", "a"), inst("SPEC-E2000", "b")] }), "RK-269:sm", "SPEC-E1000:a"));
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(canAttack(s, "RK-269:sm", "SPEC-E2000:b")).toBe(true);
  });

  it.fails("RK-269: 勝って敵軍バトルエリアのユニットがいなくなれば、追加でストライクできる（出典: atwiki/page-1283「追加でアタックかストライクを」）", () => {
    let s = resolveAll(attack(board({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E1000", "a")] }), "RK-269:sm", "SPEC-E1000:a"));
    expect(canStrike(s, "RK-269:sm")).toBe(true);
    s = settle(strike(s, "RK-269:sm"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RK-269: 追加のアタック・ストライクは1ターンに1度だけ（追加のアタックで勝っても、さらにアタック・ストライクはできない）（出典: atwiki/page-1283「このユニットの追加のアタックまたはストライクは、1ターンに1度だけとする」）", () => {
    let s = resolveAll(attack(board({ battle: [inst("RK-269", "sm")] }, { battle: [inst("SPEC-E1000", "a"), inst("SPEC-E2000", "b"), inst("SPEC-E1000", "c")] }), "RK-269:sm", "SPEC-E1000:a"));
    s = resolveAll(attack(s, "RK-269:sm", "SPEC-E2000:b"));
    expect(zoneOf(s, "player2", "SPEC-E2000:b")).toBe("discard");
    expect(canAttack(s, "RK-269:sm", "SPEC-E1000:c")).toBe(false);
    expect(canStrike(s, "RK-269:sm")).toBe(false);
  });
});

// ===========================================================================
describe("RK-270 チャップ", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【偵察】 自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアの「チャップ」が3体なら、敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、そのカードを山札の上に戻すか、下に戻すか選択する。";

  it("RK-270: カタログ本文・スペックが出典と一致（出典: atwiki/page-1390）", () => {
    expectCatalogText("RK-270", TEXT);
    expectStats("RK-270", { name: "チャップ", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, features: ["クライシス帝国", "戦闘員"] });
    expectRarityIn("RK-270", ["N"]);
  });

  it("RK-270: ※ デッキに好きな枚数入れてもよい（10枚入れても枚数制限のエラーにならない）（出典: atwiki/page-1390「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    const entries = [{ cardId: "RK-270", count: 10 }, ...fillerEntries(30, ["チャップ"])];
    expect(validateDeckEntries(entries).errors.filter((e) => e.includes("枚まで"))).toEqual([]);
  });

  const scout = (others = 2) =>
    enter(board({ battle: Array.from({ length: others }, (_, i) => inst("RK-270", `b${i}`)), rush: [inst("RK-270", "new")] }), "RK-270:new");

  it("RK-270: 【偵察】自軍ターン中に出たとき、自軍バトルエリアの「チャップ」が3体（これを含む）なら、敵軍山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-1390「…3体なら、敵軍山札の上から1枚をオモテにしてもよい」）", () => {
    const s = scout();
    expectChoiceFrom(s, "player1", "RK-270");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-270: オモテにしたら、そのカードを敵軍山札の上に戻すか下に戻すかを選ぶ — 下を選ぶと山札の下へ（出典: atwiki/page-1390「そのカードを山札の上に戻すか、下に戻すか選択する」）", () => {
    let s = accept(scout());
    expectChoiceFrom(s, "player1", "RK-270");
    expect(choiceIds(s)).toEqual(["deck_bottom", "deck_top"]);
    expect(canSkip(s)).toBe(false);
    s = settle(pick(s, "deck_bottom"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("TST-OP:e0");
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e1");
  });

  it.fails("RK-270: 上を選ぶと、そのカードは山札の上に戻る（出典: atwiki/page-1390）", () => {
    const s = settle(pick(accept(scout()), "deck_top"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e0");
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it.fails("RK-270: 自軍バトルエリアの「チャップ」が2体なら発動しない（出典: atwiki/page-1390「自軍バトルエリアの「チャップ」が3体なら」）", () => {
    const s = scout(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-270");
  });

  it.todo(
    "RK-270: 自軍バトルエリアの「チャップ」が4体以上のとき（4体目が出たとき）に発動するか（出典: atwiki/page-1390「「チャップ」が3体なら」）— 「3体なら」がちょうど3体か3体以上かを決める出典がない（atwiki のカード評価は「3枚並ばないと効果が発動しない」とだけ書く）",
  );
});

// ===========================================================================
describe("RK-271 仮面ライダークウガRM", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい） 【ライジングマイティキック】これがバトルで敵軍ユニットを撃破したとき、これが撃破した敵軍ユニットのBP以下のBPを持つ、自分と相手のバトルエリアのSユニットをすべて撃破する。";

  it("RK-271: カタログ本文・スペックが出典と一致（atwiki の名前の読み（ライジングマイティ）はカタログにない）（出典: atwiki/page-1399）", () => {
    expectCatalogText("RK-271", TEXT);
    expectStats("RK-271", { name: "仮面ライダークウガRM", category: "MA", size: "S", bp: 4500, sp: "1/3" as never, powerCost: "7-", comboNumber: "RC", features: ["仮面ライダー", "男", "アマダム", "ライジング"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-271", ["SR"]);
  });

  it("RK-271: 追加条件 — 特徴「アマダム」を持つ自軍ユニット1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1399「追加条件：特徴「アマダム」を持つ自軍ユニット1体を捨札にすれば必要パワー0になる」）", () => {
    const s = rushPhase({ hand: [inst("RK-271", "rm")], rush: [inst("SPEC-AMADAM", "a")], command: releasedCat("MA", 1), power: [] });
    const r = rushVia(s, "player1", "RK-271:rm", (a) => a.zordMaterialInstanceId === "SPEC-AMADAM:a");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RK-271:rm")).toBe("rush");
    expect(zoneOf(t, "player1", "SPEC-AMADAM:a")).toBe("discard");
  });

  it("RK-271: 必要パワー7- — 「アマダム」のユニットがいなければ、パワー6ではラッシュできず、7ならできる（出典: atwiki/page-1399・R-ADD-02）", () => {
    const mk = (n: number) => rushPhase({ hand: [inst("RK-271", "rm")], rush: [inst("SPEC-NONAMADAM", "x")], command: releasedCat("MA", 1), power: powerCards(n) });
    expect(canStartRush(mk(6), "player1", "RK-271:rm")).toBe(false);
    const r = rushFromHand(mk(7), "player1", "RK-271:rm");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-271:rm")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-NONAMADAM:x")).toBe("rush");
  });

  it("RK-271: ※モーフ — 特徴が完全一致する自軍コマンドゾーンのユニットカード（クウガRD）と置き換えられる（出典: atwiki/page-1399・「モーフできるユニット」）", () => {
    const s = enemyRushes({ battle: [inst("RK-271", "rm")], command: [released("RK-272", "rd")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-272:rd"]);
  });

  /** RC を発動したクウガRM が、敵軍の target にアタックする。 */
  const kick = (target: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => {
    let s = rcRideOff(board({ rush: [inst("RK-271", "rm"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-271:rm", "SPEC-VEHICLE:v");
    s = resolveAll(s);
    return resolveAll(attack(s, "RK-271:rm", target));
  };
  const field = { battle: [inst("SPEC-E3500", "t"), inst("SPEC-E2000", "a"), inst("SPEC-E5000", "b"), inst("SPEC-EM2000", "m")], rush: [inst("SPEC-E1000", "r")] };

  it.fails("RK-271: 【ライジングマイティキック】RC — これがバトルで敵軍ユニット（BP3500）を撃破したとき、自分と相手のバトルエリアの、BP3500 以下の S ユニットをすべて撃破する（自軍のユニットも。M・ラッシュエリア・BP の高いユニットは残る）（出典: atwiki/page-1399）", () => {
    const s = kick("SPEC-E3500:t", { battle: [inst("SPEC-OWN2000", "o"), inst("SPEC-OWN5000", "o5")] }, field);
    expect(zoneOf(s, "player2", "SPEC-E3500:t")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-OWN2000:o")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5000:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM2000:m")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E1000:r")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-OWN5000:o5")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-271:rm")).toBe("battle");
  });

  it("RK-271: ライドオフせずに（RC が発動せずに）出たときは、バトルで撃破しても何も起きない（出典: atwiki/page-1399「CN：RC」・Q4「RCを発動し、…撃破しました」）", () => {
    let s = enter(board({ rush: [inst("RK-271", "rm")] }, field), "RK-271:rm");
    s = resolveAll(attack(resolveAll(s), "RK-271:rm", "SPEC-E3500:t"));
    expect(zoneOf(s, "player2", "SPEC-E3500:t")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-272 仮面ライダークウガRD", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい） 【ライジングスプラッシュドラゴン】これが自軍エリアにある間、敵軍ユニットがＮＣまたはＲＣの効果を発動させたとき、その効果を実行する前に、自分の手札からカードを1枚選び自軍山札の上に戻してもよい。そうしたとき、そのNCまたはRCの効果を無効にする。";

  it("RK-272: カタログ本文・スペックが出典と一致（atwiki の名前の読み（ライジングドラゴン）はカタログにない）（出典: atwiki/page-1370）", () => {
    expectCatalogText("RK-272", TEXT);
    expectStats("RK-272", { name: "仮面ライダークウガRD", category: "MA", size: "S", bp: 3500, sp: "1/3" as never, powerCost: "7-", features: ["仮面ライダー", "男", "アマダム", "ライジング"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-272", ["NR"]);
  });

  it("RK-272: ※モーフ — 特徴が完全一致する自軍コマンドゾーンのユニットカード（クウガRP）と置き換えられる（出典: atwiki/page-1370・「モーフできるユニット」）", () => {
    const s = enemyRushes({ rush: [inst("RK-272", "rd")], command: [released("RK-273", "rp")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-273:rp"]);
  });

  /** 敵軍ターンに、敵軍の RK-139 ゼロノスAF が RC【俺はかーなーり強い】（相手は自分のラッシュエリアのユニットを選びバトルエリアに出す）を発動する。 */
  const enemyRc = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enemyRcRideOff(enemyTurn({ rush: [inst("RK-272", "rd"), inst("SPEC-E1000", "u")], hand: [inst("TST-OP", "h")], ...p1 }, { rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] }), "RK-139:af", "SPEC-VEHICLE:v");

  it.fails("RK-272: 【ライジングスプラッシュドラゴン】敵軍ユニットが RC の効果を発動したとき、その効果を実行する前に、自分の手札から1枚選ぶか（任意）を選べる（出典: atwiki/page-1370「その効果を実行する前に、自分の手札からカードを1枚選び自軍山札の上に戻してもよい」）", () => {
    const s = enemyRc();
    expectChoiceFrom(s, "player1", "RK-272");
    expect(choiceIds(s)).toEqual(["TST-OP:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-272: 選んだカードは自軍山札の上に戻り、その RC の効果は無効になる（ゼロノスAF の効果で自軍ラッシュエリアのユニットを出さない）（出典: atwiki/page-1370「そうしたとき、そのNCまたはRCの効果を無効にする」）", () => {
    const s = resolveAll(pick(enemyRc(), "TST-OP:h"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP:h");
    expect(zoneOf(s, "player1", "SPEC-E1000:u")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-272:rd")).toBe("rush");
  });

  it.fails("RK-272: 戻さなければ、RC の効果はそのまま実行される（出典: atwiki/page-1370「戻してもよい」）", () => {
    const s = skip(enemyRc());
    expectChoiceFrom(s, "player1", "RK-139");
    expect(choiceIds(s)).toEqual(["RK-272:rd", "SPEC-E1000:u"]);
  });

  it("RK-272: 自分の手札がなければ選べず、RC の効果が実行される（出典: atwiki/page-1370「自分の手札からカードを1枚選び」）", () => {
    const s = enemyRc({ hand: [] });
    expectChoiceFrom(s, "player1", "RK-139");
  });

  it.fails("RK-272: 敵軍ユニットが NC の効果を発動したときも、手札を1枚山札の上に戻して無効にできる（RS-059 マジブルー【未来予知】のドローが起きない）（出典: atwiki/page-1370「敵軍ユニットがＮＣまたはＲＣの効果を発動させたとき」）", () => {
    let s = enemyTurn({ rush: [inst("RK-272", "rd")], hand: [inst("TST-OP", "h")] }, { battle: [inst("SPEC-CN1", "c1")], rush: [inst("RS-059", "mb")] });
    s = enter(s, "RS-059:mb", "player2");
    expectChoiceFrom(s, "player1", "RK-272");
    s = resolveAll(pick(s, "TST-OP:h"));
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP:h");
  });

  it.fails("RK-272: NC の効果を無効にしなければ、そのまま実行される（マジブルーはドローする）（出典: atwiki/page-1370「戻してもよい」）", () => {
    let s = enemyTurn({ rush: [inst("RK-272", "rd")], hand: [inst("TST-OP", "h")] }, { battle: [inst("SPEC-CN1", "c1")], rush: [inst("RS-059", "mb")] });
    s = resolveAll(skip(enter(s, "RS-059:mb", "player2")));
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RK-272: 自軍ユニットの RC の効果には発動しない（出典: atwiki/page-1370「敵軍ユニットが」）", () => {
    const s = rcRideOff(board({ rush: [inst("RK-272", "rd"), inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")], hand: [inst("TST-OP", "h")] }, { rush: [inst("SPEC-E1000", "eu")] }), "RK-139:af", "SPEC-VEHICLE:v");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-272");
  });
});

// ===========================================================================
describe("RK-273 仮面ライダークウガRP", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい） 【ライジングブラストペガサス】自軍ラッシュエリアのSユニットを1体以上選び手札に戻してもよい。そうしたとき、相手は次のどちらかを選び行う⇒◎手札に戻したユニットの数まで自分自身のユニットを可能な限り選び撃破する。◎自分自身のユニットを1体選びダメージにする。";

  it("RK-273: カタログ本文・スペックが出典と一致（atwiki の名前の読み（ライジングペガサス）はカタログにない）（出典: atwiki/page-1277）", () => {
    expectCatalogText("RK-273", TEXT);
    expectStats("RK-273", { name: "仮面ライダークウガRP", category: "MA", size: "S", bp: 2500, sp: undefined, powerCost: "7-", comboNumber: "RC", features: ["仮面ライダー", "男", "アマダム", "ライジング"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-273", ["N"]);
  });

  it("RK-273: ※モーフ — 特徴が完全一致する自軍コマンドゾーンのユニットカード（クウガRM）と置き換えられる（出典: atwiki/page-1277・「モーフできるユニット」）", () => {
    const s = enemyRushes({ battle: [inst("RK-273", "rp")], command: [released("RK-271", "rm")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-271:rm"]);
  });

  const enemy = { battle: [inst("SPEC-E1000", "a"), inst("SPEC-EM2000", "m")], rush: [inst("SPEC-E5000", "b")] };
  const pegasus = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-273", "rp"), inst("SPEC-VEHICLE", "v"), inst("SPEC-OWN2000", "x"), inst("SPEC-OWN2000", "y"), inst("SPEC-EM2000", "om")] }, p2), "RK-273:rp", "SPEC-VEHICLE:v");
  /** x（と y）を手札に戻した後の、相手の選択。 */
  const returned = (ids: string[], p2: Partial<GameState["players"]["player2"]> = enemy) => {
    let s = pegasus(p2);
    for (const id of ids) s = pick(s, id);
    if (s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.sourceCardId === "RK-273") s = confirm(s);
    return s;
  };

  it.fails("RK-273: 【ライジングブラストペガサス】RC — 自軍ラッシュエリアの S ユニットを1体以上選べる（任意。M は対象外）（出典: atwiki/page-1277「自軍ラッシュエリアのSユニットを1体以上選び手札に戻してもよい」）", () => {
    const s = pegasus();
    expectChoiceFrom(s, "player1", "RK-273");
    expect(choiceIds(s)).toEqual(["SPEC-OWN2000:x", "SPEC-OWN2000:y"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-273: 選んだユニットは手札に戻り、相手は「撃破する」か「ダメージにする」かを選ぶ（出典: atwiki/page-1277「そうしたとき、相手は次のどちらかを選び行う」）", () => {
    const s = returned(["SPEC-OWN2000:x"]);
    expect(zoneOf(s, "player1", "SPEC-OWN2000:x")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-OWN2000:y")).toBe("rush");
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["damage", "destroy"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-273: ◎撃破 — 相手は手札に戻したユニットの数（2）まで自分のユニット（サイズ・エリアを問わない）を選び撃破する（出典: atwiki/page-1277「手札に戻したユニットの数まで自分自身のユニットを可能な限り選び撃破する」）", () => {
    let s = pickAs(returned(["SPEC-OWN2000:x", "SPEC-OWN2000:y"]), "player2", "destroy");
    expectChoiceFrom(s, "player2", "RK-273");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:a", "SPEC-E5000:b", "SPEC-EM2000:m"]);
    s = pickAs(s, "player2", "SPEC-EM2000:m");
    s = pickAs(s, "player2", "SPEC-E5000:b");
    if (s.pendingEffectChoice?.sourceCardId === "RK-273") s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-EM2000:m")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("battle");
  });

  it.fails("RK-273: ◎撃破 —「可能な限り」: 手札に戻した数より相手のユニットが少なければ、すべて撃破する（出典: atwiki/page-1277「可能な限り選び撃破する」）", () => {
    let s = pickAs(returned(["SPEC-OWN2000:x", "SPEC-OWN2000:y"], { battle: [inst("SPEC-E1000", "a")] }), "player2", "destroy");
    if (s.pendingEffectChoice?.sourceCardId === "RK-273" && s.pendingEffectChoice.playerId === "player2") s = pickAs(s, "player2", "SPEC-E1000:a");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
  });

  it.fails("RK-273: ◎ダメージ — 相手は自分のユニットを1体選び、ダメージにする（パワーゾーンにウラ向き）（出典: atwiki/page-1277「自分自身のユニットを1体選びダメージにする」）", () => {
    let s = pickAs(returned(["SPEC-OWN2000:x", "SPEC-OWN2000:y"]), "player2", "damage");
    expectChoiceFrom(s, "player2", "RK-273");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:a", "SPEC-E5000:b", "SPEC-EM2000:m"]);
    s = resolveAll(pickAs(s, "player2", "SPEC-E5000:b"));
    expect(zoneOf(s, "player2", "SPEC-E5000:b")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E5000:b")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("battle");
  });

  it("RK-273: 手札に戻さなければ何も起きない（出典: atwiki/page-1277「手札に戻してもよい」）", () => {
    const s = resolveAll(skip(pegasus()));
    expect(zoneOf(s, "player1", "SPEC-OWN2000:x")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("battle");
  });
});
