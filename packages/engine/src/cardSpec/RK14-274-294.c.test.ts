/**
 * カード別スペック: RK-288〜RK-294（ザ・マスクドライダーEXP vol.4 仮面ライダーデルタ〜仮面ライダーサソードMF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-288」〜「RK-294」とカード名で検索。card_5.html の「デルタ」は RS-264 ジェットデルタ）。本範囲の atwiki のページに公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST・R-CN-02・R-BP-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-288〜294 とカード名で検索）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  legal,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  damageChoices,
  deckCards,
  enemyBoard,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceUp,
  inst,
  lastBattleBps,
  mount,
  nextPhase,
  p1Battle,
  passEntry,
  pick,
  pickAs,
  rcRideOff,
  registerOffered,
  releasedCat,
  releasedN,
  resolveAll,
  riding,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK14-274-294.helpers";

const KW_MORPH =
  "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const COND = sUnit("SPEC-COND", {
  bp: 1000,
  powerCost: "2+" as never,
  rushAdditionalCondition: { conditionId: "discard_hand_card", text: "自分の手札を1枚選び捨札にする", unitCount: 1 } as never,
});
const E500 = sUnit("SPEC-E500", { bp: 500, sp: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const NOSP = sUnit("SPEC-NOSP", { bp: 1000, sp: undefined });
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const M_VEHICLE = { ...PLAIN_VEHICLE, id: "SPEC-MVEHICLE", name: "SPEC-MVEHICLE", size: "M" } as unknown as CardDefinition;
const EXTRA = [PLAIN_VEHICLE, M_VEHICLE, RCU, C0, C1, M2, COND, E500, E2000, E5000, EM2000, NOSP, MORPH];

/** ストライクの反応をパスして、ダメージの支払い（選択）の手前まで進める。 */
function toPayment(s: GameState): GameState {
  let next = s;
  for (let i = 0; i < 8 && !next.pendingDamagePayment; i++) {
    const pass = legal(next).find((a) => a.type === "pass_strike_reaction" || a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
    if (!pass) break;
    next = act(next, pass);
  }
  return next;
}

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, phase: GameState["phase"] = "battle") =>
  enemyBoard(p1, p2, EXTRA, phase);

// ===========================================================================
describe("RK-288 仮面ライダーデルタ", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【デルタムーバー】このターン、敵軍バトルエリアのすべてのSユニットはBP-500される。（BP0以下になったユニットは撃破される）";

  it("RK-288: カタログ本文・スペックが出典と一致（出典: atwiki/page-1381）", () => {
    expectCatalogText("RK-288", TEXT);
    expectStats("RK-288", { name: "仮面ライダーデルタ", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-288", ["R"]);
  });

  it("RK-288: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1381・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-288", "dl")] }, "RK-288:dl"))).toBe(true);
  });

  const mover = (rc = true) => {
    const s = board(
      { rush: [inst("RK-288", "dl"), inst("SPEC-VEHICLE", "v")], battle: [inst("SPEC-E2000", "own")] },
      { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E500", "b"), inst("SPEC-EM2000", "m")], rush: [inst("SPEC-E2000", "r")] },
    );
    return resolveAll(rc ? rcRideOff(s, "RK-288:dl", "SPEC-VEHICLE:v") : mount(s, "RK-288:dl", "SPEC-VEHICLE:v"));
  };

  it("RK-288: 【デルタムーバー】RC — このターン、敵軍バトルエリアのすべての S ユニットは BP-500 される（M・ラッシュエリア・自軍のユニットは変わらない）（出典: atwiki/page-1381）", () => {
    const s = mover();
    expect(bpOf(s, "player2", "SPEC-E2000:a")).toBe(1500);
    expect(bpOf(s, "player2", "SPEC-EM2000:m")).toBe(2000);
    expect(bpOf(s, "player2", "SPEC-E2000:r")).toBe(2000);
    expect(bpOf(s, "player1", "SPEC-E2000:own")).toBe(2000);
  });

  it("RK-288: BP0 以下になったユニットは撃破される（出典: atwiki/page-1381「（BP0以下になったユニットは撃破される）」・R-BP-02）", () => {
    expect(zoneOf(mover(), "player2", "SPEC-E500:b")).toBe("discard");
  });

  it("RK-288: ライドオフしなければ（RC が発動しなければ）BP は変わらない（出典: atwiki/page-1381「CN：ＲＣ」）", () => {
    const s = mover(false);
    expect(bpOf(s, "player2", "SPEC-E2000:a")).toBe(2000);
    expect(zoneOf(s, "player2", "SPEC-E500:b")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-289 ジェットスライガー", () => {
  const TEXT =
    "【ジェットエンジン噴射】自軍ターン中、これがバトルエリアに出たとき、敵軍ビークルが2体以上あれば、ライドされていない敵軍Sビークルか、ライドされていない敵軍Mビークルを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。";

  it("RK-289: カタログ本文・スペックが出典と一致（出典: atwiki/page-1384）", () => {
    expectCatalogText("RK-289", TEXT);
    expectVehicleStats("RK-289", { name: "ジェットスライガー", category: "ET", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-289", ["N"]);
  });

  const enemyVehicles = {
    battle: [...riding(inst("SPEC-VEHICLE", "rv"), inst("SPEC-RCU", "er")), inst("SPEC-VEHICLE", "bv")],
    rush: [inst("SPEC-MVEHICLE", "mv")],
  };
  const jet = (p2: Partial<GameState["players"]["player2"]> = enemyVehicles) => mount(board({ rush: [inst("SPEC-RCU", "r"), inst("RK-289", "js")] }, p2), "SPEC-RCU:r", "RK-289:js");

  it("RK-289: 【ジェットエンジン噴射】自軍ターン中にライドされてバトルエリアに出たとき、敵軍ビークルが2体以上あれば、ライドされていない敵軍の S・M ビークル（エリアを問わない）から1体選ぶ（見送れない）（出典: atwiki/page-1384・カード評価「ラッシュエリアやＭビークルにも効果がとどく」）", () => {
    const s = jet();
    expectChoiceFrom(s, "player1", "RK-289");
    expect(choiceIds(s)).toEqual(["SPEC-MVEHICLE:mv", "SPEC-VEHICLE:bv"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-289: 選んだビークルは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1384「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = settle(pick(jet(), "SPEC-MVEHICLE:mv"));
    expect(zoneOf(s, "player2", "SPEC-MVEHICLE:mv")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-MVEHICLE:mv")?.commandHeld).toBe(true);
  });

  it("RK-289: 2体以上には、ライドされている敵軍ビークルも数える（ライドされていないビークルが1体でも発動する）（出典: atwiki/page-1384「敵軍ビークルが2体以上あれば」・カード評価「「ライドされていないビークル」が２枚である必要はない」）", () => {
    const s = jet({ battle: [...riding(inst("SPEC-VEHICLE", "rv"), inst("SPEC-RCU", "er")), inst("SPEC-VEHICLE", "bv")] });
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:bv"]);
  });

  it("RK-289: 敵軍ビークルが1体なら発動しない（出典: atwiki/page-1384「敵軍ビークルが2体以上あれば」）", () => {
    const s = jet({ battle: [inst("SPEC-VEHICLE", "bv")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-289");
  });

  it("RK-289: 敵軍のコマンドが5つで置けなければ発動しない（出典: atwiki/page-1384「置けなければこの効果は発動できない」）", () => {
    const s = jet({ ...enemyVehicles, command: releasedN(5, "TST-OP", "ec") });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-289");
    expect(zoneOf(settle(s), "player2", "SPEC-VEHICLE:bv")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-290 ロブスターオルフェノク", () => {
  const TEXT = "【末期の酒】自軍ターン中、これがバトルエリアに出たとき、相手に1枚ドローさせる。その後、相手は追加条件を持たない自分自身のSユニットを1体選び撃破する。";

  it("RK-290: カタログ本文・スペックが出典と一致（出典: atwiki/page-1361）", () => {
    expectCatalogText("RK-290", TEXT);
    expectStats("RK-290", { name: "ロブスターオルフェノク", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 3, features: ["ラッキークローバー", "オルフェノク", "怪人", "女"] });
    expectRarityIn("RK-290", ["N"]);
  });

  const champagne = (p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-C1", "a")], rush: [inst("SPEC-C0", "b"), inst("SPEC-M2", "m"), inst("SPEC-COND", "c")] }) =>
    enter(board({ rush: [inst("RK-290", "lb")] }, p2), "RK-290:lb");

  it("RK-290: 【末期の酒】自軍ターン中にバトルエリアに出たとき、相手に1枚ドローさせ、その後、相手は追加条件を持たない自分の S ユニット（エリアを問わない）から1体選ぶ（M・追加条件を持つユニットは対象外。見送れない）（出典: atwiki/page-1361・カード評価「エリア・BPに関係なく敵軍Sユニットを撃破できる」）", () => {
    const s = champagne();
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
    expectChoiceFrom(s, "player2", "RK-290");
    expect(choiceIds(s)).toEqual(["SPEC-C0:b", "SPEC-C1:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-290: 相手が選んだユニットは撃破される（出典: atwiki/page-1361「1体選び撃破する」）", () => {
    const s = resolveAll(pickAs(champagne(), "player2", "SPEC-C0:b"));
    expect(zoneOf(s, "player2", "SPEC-C0:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-290: 相手に当てはまるユニットがいなくても、ドローはさせる（出典: atwiki/page-1361「相手に1枚ドローさせる。その後」）", () => {
    const s = champagne({ rush: [inst("SPEC-M2", "m")] });
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-290");
  });
});

// ===========================================================================
describe("RK-291 ドラゴンオルフェノク魔人態", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 ※これはラッシュしたターンにバトルエリアに出られない。 【魔人の力】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-291: カタログ本文・スペックが出典と一致（出典: atwiki/page-1366）", () => {
    expectCatalogText("RK-291", TEXT);
    expectStats("RK-291", { name: "ドラゴンオルフェノク魔人態", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 5, features: ["ラッキークローバー", "オルフェノク", "怪人", "男", "ドラゴン"] });
    expectRarityIn("RK-291", ["R"]);
  });

  it("RK-291: ※ ラッシュしたターンにバトルエリアに出られない（前のターンからラッシュエリアにあれば出られる）（出典: atwiki/page-1366「これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-291", "do")], command: releasedCat("DA", 1), power: deckCards(5, "pw") }), "player1", "RK-291:do");
    expect(r.ok, r.error).toBe(true);
    const s = nextPhase(resolveAll(r.state));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-291:do")).toBe(false);
    expect(canEnter(board({ rush: [inst("RK-291", "do")] }), "RK-291:do")).toBe(true);
  });

  it("RK-291: ※ 敵軍ターン中、「SP1」以上のユニットとバトルしたときは、バトルに勝っても撃破される（出典: atwiki/page-1366）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RK-291", "do")] }, "RK-291:do", {}, "SPEC-E2000:atk", EXTRA));
    expect(zoneOf(s, "player2", "SPEC-E2000:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-291:do")).toBe("discard");
  });

  it("RK-291: ※ SP を持たないユニットとのバトルに勝ったときは残る（出典: atwiki/page-1366「「SP1」以上のユニットと」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RK-291", "do")] }, "RK-291:do", {}, "SPEC-NOSP:atk", EXTRA));
    expect(zoneOf(s, "player1", "RK-291:do")).toBe("battle");
  });

  it("RK-291: ※ 自軍ターン中に「SP1」のユニットとバトルして勝ったときは残る（出典: atwiki/page-1366「敵軍ターン中」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-291", "do")] }, { battle: [inst("SPEC-E2000", "x")] }), "RK-291:do", "SPEC-E2000:x"));
    expect(zoneOf(s, "player2", "SPEC-E2000:x")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-291:do")).toBe("battle");
  });

  const majin = () => enter(board({ rush: [inst("RK-291", "do")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-EM2000", "m")], rush: [inst("SPEC-E2000", "r")] }), "RK-291:do");

  it("RK-291: 【魔人の力】自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの S ユニットから1体選べる（任意。M・ラッシュエリアは対象外）（出典: atwiki/page-1366）", () => {
    const s = majin();
    expectChoiceFrom(s, "player1", "RK-291");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-291: 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1366「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(majin(), "SPEC-E2000:a"));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E2000:a")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("RK-291: 選ばなければ何も起きない（出典: atwiki/page-1366「置いてもよい」）", () => {
    const s = resolveAll(skip(majin()));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("RK-292 クロコダイルオルフェノク格闘態", () => {
  const TEXT =
    "※これは自軍捨札にある「クロコダイルオルフェノク格闘態」のカード1枚につきBP+3000される。 ※これはBP5000以上のとき「SP1」になる。 【三つの魂】敵軍ターン中、これが撃破されて捨札になったとき、次の効果を発動できる⇒自軍山札を見て「クロコダイルオルフェノク格闘態」のカードを1枚選び、相手に見せてから自分の手札に加えてもよい。その後、自軍山札をシャッフルする。";

  it("RK-292: カタログ本文・スペックが出典と一致（出典: atwiki/page-1360）", () => {
    expectCatalogText("RK-292", TEXT);
    expectStats("RK-292", { name: "クロコダイルオルフェノク格闘態", category: "DA", size: "S", bp: 500, sp: "special", powerCost: 2, features: ["ラッキークローバー", "オルフェノク", "怪人", "男"] });
    expectRarityIn("RK-292", ["NR"]);
  });

  it("RK-292: ※ 自軍捨札の「クロコダイルオルフェノク格闘態」1枚につき BP+3000（2枚で6500）。敵軍の捨札のものは数えない（出典: atwiki/page-1360・コメント欄「三枚捨札にあるときBPは9500」）", () => {
    const s = board({ battle: [inst("RK-292", "cr")], discard: [inst("RK-292", "d1"), inst("RK-292", "d2")] }, { discard: [inst("RK-292", "e1")] });
    expect(bpOf(s, "player1", "RK-292:cr")).toBe(6500);
    expect(bpOf(board({ battle: [inst("RK-292", "cr")] }, { discard: [inst("RK-292", "e1")] }), "player1", "RK-292:cr")).toBe(500);
  });

  it("RK-292: ※ BP5000 以上のとき「SP1」になる（捨札2枚の6500で SP1、1枚の3500では SP！のまま）（出典: atwiki/page-1360「これはBP5000以上のとき「SP1」になる」）", () => {
    expect(spOf(board({ battle: [inst("RK-292", "cr")], discard: [inst("RK-292", "d1"), inst("RK-292", "d2")] }), "player1", "RK-292:cr")).toBe(1);
    expect(spOf(board({ battle: [inst("RK-292", "cr")], discard: [inst("RK-292", "d1")] }), "player1", "RK-292:cr")).toBe(0);
  });

  it("RK-292: ※ ほかの効果で BP5000 以上になったときも「SP1」になる（出典: atwiki/page-1360・コメント欄「ラウズすれば500+4500でSP1に」）", () => {
    expect(spOf(board({ battle: [{ ...inst("RK-292", "cr"), bpModifier: 4500 }] }), "player1", "RK-292:cr")).toBe(1);
  });

  const crocDeck = [inst("TST-OP", "x0"), inst("RK-292", "k1"), inst("RK-292", "k2"), inst("TST-OP", "x3")];
  const souls = () => attackedInEnemyTurn({ battle: [inst("RK-292", "cr")], deck: crocDeck }, "RK-292:cr");

  it("RK-292: 【三つの魂】敵軍ターン中に撃破されて捨札になったとき、自軍山札の「クロコダイルオルフェノク格闘態」から1枚選んで手札に加えられる（任意）（出典: atwiki/page-1360）", () => {
    const s = souls();
    expect(zoneOf(s, "player1", "RK-292:cr")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-292");
    expect(choiceIds(s)).toEqual(["RK-292:k1", "RK-292:k2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-292: 選んだカードは手札に加わり、自軍山札はシャッフルされる（出典: atwiki/page-1360「自分の手札に加えてもよい。その後、自軍山札をシャッフルする」）", () => {
    const s = resolveAll(pick(souls(), "RK-292:k2"));
    expect(zoneOf(s, "player1", "RK-292:k2")).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("RK-292: 加えないことも選べる（出典: atwiki/page-1360「加えてもよい」）", () => {
    const s = resolveAll(skip(souls()));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RK-292: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-1360「敵軍ターン中」・カード評価「相手ターンに撃破されないと発動しない」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-292", "cr")], deck: crocDeck }, { battle: [inst("TST-UNIT-7", "big")] }), "RK-292:cr", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-292:cr")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.todo(
    "RK-292: 「相手に見せてから」手札に加える（出典: atwiki/page-1360）— 対戦画面の情報公開の問題で、エンジンはログに残すだけ",
  );
});

// ===========================================================================
describe("RK-293 センチピードオルフェノク", () => {
  const TEXT =
    "【捕縛する鞭】これが自軍バトルエリアにある間、敵軍ターン中、次の効果を発揮できる⇒敵軍ユニットがラッシュされたとき、自軍コマンドを1つホールドしてもよい。そうしたとき、相手は自分自身のコマンドを1つホールドするかしないかを選ぶ。ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない。";

  it("RK-293: カタログ本文・スペックが出典と一致（出典: atwiki/page-1362）", () => {
    expectCatalogText("RK-293", TEXT);
    expectStats("RK-293", { name: "センチピードオルフェノク", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 3, features: ["ラッキークローバー", "オルフェノク", "怪人", "男"] });
    expectRarityIn("RK-293", ["N"]);
  });

  /** 敵軍（player2）のラッシュフェイズに、player2 が手札の SPEC-C0 をラッシュする（自軍のラッシュ反応はパス）。 */
  const whip = (p1: Partial<GameState["players"]["player1"]> = { battle: [inst("RK-293", "cp")] }) => {
    const s = enemyTurn({ command: releasedN(2, "TST-OP", "mc"), ...p1 }, { hand: [inst("SPEC-C0", "eu")], command: releasedCat("WB", 3) }, "rush");
    const r = rushFromHand(s, "player2", "SPEC-C0:eu");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-293: 【捕縛する鞭】敵軍ターン中に敵軍ユニットがラッシュされたとき、リリース状態の自軍コマンドを1つ選んでホールドできる（任意）（出典: atwiki/page-1362「自軍コマンドを1つホールドしてもよい」）", () => {
    const s = whip();
    expectChoiceFrom(s, "player1", "RK-293");
    expect(choiceIds(s)).toEqual(["TST-OP:mc0", "TST-OP:mc1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-293: ホールドすると、相手は自分のコマンドを1つホールドするかしないかを選ぶ（出典: atwiki/page-1362「そうしたとき、相手は自分自身のコマンドを1つホールドするかしないかを選ぶ」）", () => {
    const s = pick(whip(), "TST-OP:mc0");
    expect(cardIn(s, "player1", "TST-OP:mc0")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player2", "RK-293");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s).length).toBeGreaterThan(0);
  });

  it("RK-293: 相手がホールドしないことを選べば、そのユニットはそのターン中バトルエリアに出られない（出典: atwiki/page-1362「ホールドしないことを選んだとき、そのユニットはそのターン中、バトルエリアに出られない」）", () => {
    let s = resolveAll(skip(pick(whip(), "TST-OP:mc0")));
    s = nextPhase(s);
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "SPEC-C0:eu", "player2")).toBe(false);
  });

  it("RK-293: 相手がコマンドを1つホールドすれば、そのユニットはバトルエリアに出られる（出典: atwiki/page-1362）", () => {
    let s = pick(whip(), "TST-OP:mc0");
    const before = s.players.player2.command.filter((c) => c.commandHeld).length;
    s = resolveAll(pickAs(s, "player2", s.pendingEffectChoice!.validInstanceIds[0]!));
    expect(s.players.player2.command.filter((c) => c.commandHeld).length).toBe(before + 1);
    s = nextPhase(s);
    expect(canEnter(s, "SPEC-C0:eu", "player2")).toBe(true);
  });

  it("RK-293: 自分がホールドしなければ、相手は何も選ばない（出典: atwiki/page-1362「そうしたとき」）", () => {
    let s = resolveAll(skip(whip()));
    expect(s.pendingEffectChoice).toBeUndefined();
    s = nextPhase(s);
    expect(canEnter(s, "SPEC-C0:eu", "player2")).toBe(true);
  });

  it("RK-293: これが自軍ラッシュエリアにあるだけなら発動しない（出典: atwiki/page-1362「これが自軍バトルエリアにある間」）", () => {
    const s = whip({ rush: [inst("RK-293", "cp")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-293");
  });

  it("RK-293: 自軍ターンに自軍ユニットをラッシュしたときは発動しない（出典: atwiki/page-1362「敵軍ターン中」「敵軍ユニットがラッシュされたとき」）", () => {
    const s = rushPhase({ battle: [inst("RK-293", "cp")], hand: [inst("SPEC-C0", "u")], command: releasedCat("WB", 2) });
    const r = rushFromHand(s, "player1", "SPEC-C0:u");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-293");
  });

  it.todo(
    "RK-293: 相手にリリース状態のコマンドがなく「ホールドする」を選べないとき、そのユニットはバトルエリアに出られないか（出典: atwiki/page-1362「ホールドするかしないかを選ぶ」）— 出典がない（エンジンはホールドできなければ「ホールドしない」を選んだものとして扱う）",
  );
});

// ===========================================================================
describe("RK-294 仮面ライダーサソードMF（マスクドフォーム）", () => {
  const TEXT =
    "※これはアタックされるときBP+4000される。 【ブラッドベセル】このターン、自軍ユニットがストライクして、相手が自分自身のパワーゾーンのカードをウラ向きにしてダメージにするとき、相手は自分自身のパワーゾーンにモーフを持つユニットカードがあれば、それを選びダメージにする。";

  it("RK-294: カタログ本文・スペックが出典と一致（カード名は atwiki の見出しの読み「（マスクドフォーム）」を除いたもの。RK-271 等と同じ）（出典: atwiki/page-1340）", () => {
    expectCatalogText("RK-294", TEXT);
    expectStats("RK-294", { name: "仮面ライダーサソードMF", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-294", ["N"]);
  });

  it("RK-294: ※ アタックされるとき BP+4000（6000）されてバトルする（出典: atwiki/page-1340「これはアタックされるときBP+4000される」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RK-294", "sw")] }, "RK-294:sw", {}, "SPEC-E5000:atk", EXTRA));
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 6000 });
    expect(zoneOf(s, "player1", "RK-294:sw")).toBe("battle");
  });

  it("RK-294: ※ アタックするときは BP+4000 されない（出典: atwiki/page-1340「アタックされるとき」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-294", "sw")] }, { battle: [inst("SPEC-E5000", "x")] }), "RK-294:sw", "SPEC-E5000:x"));
    expect(lastBattleBps(s)).toEqual({ attacker: 2000, defender: 5000 });
  });

  const enemyPower = [faceUp("SPEC-MORPH", "pm"), faceUp("TST-OP", "po")];
  /** サソードMF を（並び順 pos 番目に）出してから、TST-UNIT-0 を出してストライクする。 */
  const struck = (pos: 1 | 2) => {
    const before = pos === 2 ? [inst("SPEC-C1", "f")] : [];
    let s = board({ battle: before, rush: [inst("RK-294", "sw"), inst("TST-UNIT-0", "st")] }, { power: enemyPower });
    s = settle(passEntry(enter(s, "RK-294:sw")));
    s = enter(s, "TST-UNIT-0:st");
    return toPayment(strike(s, "TST-UNIT-0:st"));
  };

  it("RK-294: 【ブラッドベセル】NC（CN1・1番目に出た）— このターン、自軍ユニットのストライクで相手がダメージにするとき、相手はパワーゾーンのモーフを持つユニットカードを選ぶ（出典: atwiki/page-1340・R-CN-02）", () => {
    const s = struck(1);
    expect(s.pendingDamagePayment?.playerId).toBe("player2");
    expect(damageChoices(s, "player2")).toEqual(["SPEC-MORPH:pm"]);
  });

  it("RK-294: NC が成立していなければ（2番目に出た）、相手はパワーゾーンのどのカードでも選べる（出典: atwiki/page-1340「CN：1」・R-CN-02）", () => {
    const s = struck(2);
    expect(damageChoices(s, "player2")).toEqual(["SPEC-MORPH:pm", "TST-OP:po"]);
  });

  it("RK-294: 相手のパワーゾーンにモーフを持つユニットカードがなければ、どのカードでも選べる（出典: atwiki/page-1340「モーフを持つユニットカードがあれば」）", () => {
    let s = board({ rush: [inst("RK-294", "sw"), inst("TST-UNIT-0", "st")] }, { power: [faceUp("TST-OP", "po"), faceUp("SPEC-C1", "pc")] });
    s = settle(passEntry(enter(s, "RK-294:sw")));
    s = toPayment(strike(enter(s, "TST-UNIT-0:st"), "TST-UNIT-0:st"));
    expect(damageChoices(s, "player2")).toEqual(["SPEC-C1:pc", "TST-OP:po"]);
  });
});
