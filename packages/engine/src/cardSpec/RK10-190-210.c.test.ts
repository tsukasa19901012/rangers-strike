/**
 * カード別スペック: RK-204〜RK-210（ザ・マスクドライダーEXP vol.3 仮面ライダーオーガ〜仮面ライダーギャレンJF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2（RK-086 欄の RK-204 の Q&A・RK-160 欄の RK-205 の Q&A）・
 *     grnrngr/faq-rider-3（RK-205 欄・RK-208 欄）（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html・rider_3.html）。
 *     atwiki に転載された公式 Q&A（RK-204 Q1〜Q3・RK-205 Q1・RK-206 Q1・RK-208 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの:
 *  - RK-086 Q2（アカネタカとオーガ）— cardSpec/RK5-085-105.a.test.ts RK-086（本バッチで it.todo から実テストにした）
 *  - RK-160 Q1（サイガでシザーズジャガーがコマンドゾーンに送られた）— cardSpec/RK8-148-168.b.test.ts RK-160（同上）
 *  - RK-064 Q1（ウルフオルフェノクと巨大化爆弾）— cardSpec/RK4-064-084.a.test.ts RK-064（同上）
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  NOSP_ATTACKER,
  accept,
  act,
  attack,
  attackedInEnemyTurn,
  boardOf,
  canAttackAny,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  chargePower,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  heldUnit,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushed,
  settle,
  skip,
  strike,
  sUnit,
  targetsOf,
  toPhase,
  toTurnEnd,
  zordDownTests,
  zoneOf,
} from "./RK10-190-210.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C7 = sUnit("SPEC-C7", { bp: 1000, powerCost: "7+" as never, size: "L" });
const M1 = sUnit("SPEC-M1", { bp: 1000, powerCost: 1, size: "M" });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const EXTRA = [NOSP_ATTACKER, C1, C2, C3, C7, M1, M2];

const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("rush", "player1", p1, p2, EXTRA);
const battlePhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("battle", "player1", p1, p2, EXTRA);
const enemyPhase = (phase: GameState["phase"], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf(phase, "player2", p1, p2, EXTRA);

// ===========================================================================
describe("RK-204 仮面ライダーオーガ", () => {
  const TEXT =
    "【オーガ・ストラッシュ】これが自軍エリアにある間、敵軍ターン中、ストライク以外の方法でダメージを受けたなら、ダメージを受けた後、DAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、相手に1点ダメージを与える。";

  it("RK-204: カタログ本文・スペックが出典と一致（出典: atwiki/page-1077）", () => {
    expectCatalogText("RK-204", TEXT);
    expectStats("RK-204", { name: "仮面ライダーオーガ", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 4, features: ["仮面ライダー", "男", "皇帝"] });
    expectRarityIn("RK-204", ["SR"]);
  });

  /** 敵軍（player2）のチャージフェイズ、player2 の RK-169 ゼロノスVF【グランドストライク】（パワーが8枚になったとき相手に1点ダメージ）で自分（player1）がダメージを受ける。 */
  const grandStrike = (p1: Partial<GameState["players"]["player1"]>) => {
    let s = enemyPhase("charge", { battle: [inst("RK-204", "og")], ...p1 }, { rush: [inst("RK-169", "vf")], hand: [inst("TST-OP", "h")], power: powerCards(7, "ep") });
    s = chargePower(s, "TST-OP:h", "player2");
    expectChoiceFrom(s, "player2", "RK-169");
    return settle(accept(s));
  };

  it("RK-204: 【オーガ・ストラッシュ】敵軍ターン中、ストライク以外の方法（効果）でダメージを受けた後、DA の自軍コマンドを1つホールドするかを選べる（任意）（出典: atwiki/page-1077「ストライク以外の方法でダメージを受けたなら、ダメージを受けた後、DAを持つ自軍コマンドを1つホールドしてもよい」）", () => {
    const s = grandStrike({ command: [...releasedCat("DA", 1), released("TST-OP", "wb")] });
    expect(damageOf(s, "player1")).toBe(1);
    expectChoiceFrom(s, "player1", "RK-204");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-204: ホールドすると相手に1点ダメージを与える（出典: atwiki/page-1077「そうしたとき、相手に1点ダメージを与える」）", () => {
    const s = settle(accept(grandStrike({ command: releasedCat("DA", 1) })));
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-204: DA のリリース状態の自軍コマンドがなければ発動しない（出典: atwiki/page-1077「DAを持つ自軍コマンドを1つホールドしてもよい」）", () => {
    const s = grandStrike({ command: [released("TST-OP", "wb")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-204");
  });

  it("RK-204: ストライクされてダメージを受けたときは発動しない（出典: atwiki/page-1077「ストライク以外の方法で」）", () => {
    let s = enemyPhase("battle", { battle: [inst("RK-204", "og")], command: releasedCat("DA", 1) }, { battle: [inst("TST-UNIT-0", "st")] });
    s = settle(strike(s, "TST-UNIT-0:st", "player2"));
    expect(damageOf(s, "player1")).toBe(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-204");
  });

  // atwiki/page-1077 Q2「いいえ、そのようにはなりません。複数の「RK-204 仮面ライダーオーガ」の効果を発動する場合は、1体につきコマンドを1つホールドする必要があります。」
  it("RK-204: 公式Q&A — 2体あっても1回のホールドで与えるダメージは1点（2体目を発動するにはもう1つホールドが要る）（出典: atwiki/page-1077 Q2）", () => {
    let s = grandStrike({ battle: [inst("RK-204", "og"), inst("RK-204", "og2")], command: releasedCat("DA", 1) });
    s = resolveAll(accept(s));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-204: 公式Q&A — 2体あり DA のコマンドが2つあれば、それぞれホールドして2点与えられる（出典: atwiki/page-1077 Q2「1体につきコマンドを1つホールドする」）", () => {
    let s = grandStrike({ battle: [inst("RK-204", "og"), inst("RK-204", "og2")], command: releasedCat("DA", 2) });
    s = settle(accept(s));
    expectChoiceFrom(s, "player1", "RK-204");
    s = settle(accept(s));
    expect(damageOf(s, "player2")).toBe(2);
  });

  // atwiki/page-1077 Q3「はい、できます。一度に複数点のダメージを受けた場合も、ダメージ1点ごとにつき「RK-204 仮面ライダーオーガ」の効果を発動することができます。」
  it("RK-204: 公式Q&A — 一度に2点のダメージ（RS-084 VRVロボ【必勝合体】）を受けたら、1点ごとに発動できる（出典: atwiki/page-1077 Q3）", () => {
    const PARTS = ["RS-085", "RS-086", "RS-087", "RS-088", "RS-089"];
    let s = enemyPhase(
      "rush",
      { battle: [inst("RK-204", "og")], command: releasedCat("DA", 2) },
      { hand: [inst("RS-084", "vrv")], rush: PARTS.map((id) => inst(id, "p")), command: [released("TST-OP-OT", "ot")], power: powerCards(8, "ep") },
    );
    s = settle(rushed(s, "RS-084:vrv", "player2", PARTS.map((id) => `${id}:p`)));
    expect(damageOf(s, "player1")).toBe(2);
    expectChoiceFrom(s, "player1", "RK-204");
    s = settle(accept(s));
    expectChoiceFrom(s, "player1", "RK-204");
    s = settle(accept(s));
    expect(damageOf(s, "player2")).toBe(2);
  });
});

// ===========================================================================
describe("RK-205 仮面ライダーサイガ", () => {
  const TEXT =
    "※これは、自分がターンを終えるときラッシュエリアにあれば手札に戻してもよい。 【フライングアタッカー】これはラッシュしたときバトルエリアに出してもよい。そうしたとき、これをラッシュするためにホールドしたコマンドの必要パワーの数字を見て、その数字と同じ必要パワーの数字を持つ敵軍Sユニット1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。このとき、これはアタックもストライクもできない。";

  it("RK-205: カタログ本文・スペックが出典と一致（出典: atwiki/page-956）", () => {
    expectCatalogText("RK-205", TEXT);
    expectStats("RK-205", { name: "仮面ライダーサイガ", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 4, features: ["仮面ライダー", "男", "メカ", "皇帝"] });
    expectRarityIn("RK-205", ["R"]);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-C3", "b"), inst("SPEC-M1", "m")], rush: [inst("SPEC-C1", "r")] };
  /** 必要パワー1の ET コマンド（TST-OP-ET）をホールドしてサイガをラッシュした直後。 */
  const afterRush = (p2: Partial<GameState["players"]["player2"]> = enemy, command = releasedCat("ET", 1)) =>
    rushed(rushPhase({ hand: [inst("RK-205", "sg")], command, power: powerCards(4) }, p2), "RK-205:sg");

  it("RK-205: 【フライングアタッカー】ラッシュしたとき、バトルエリアに出すかを選べる（任意）（出典: atwiki/page-956「これはラッシュしたときバトルエリアに出してもよい」）", () => {
    const s = afterRush();
    expectChoiceFrom(s, "player1", "RK-205");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-205: 出すと、ホールドしたコマンドの必要パワーの数字（1）と同じ必要パワーの敵軍 S ユニットから1体選ぶ（エリアを問わない。M は対象外）（出典: atwiki/page-956「その数字と同じ必要パワーの数字を持つ敵軍Sユニット1体選び」）", () => {
    const s = accept(afterRush());
    expect(zoneOf(s, "player1", "RK-205:sg")).toBe("battle");
    expectChoiceFrom(s, "player1", "RK-205");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:r"]);
  });

  it("RK-205: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-956「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(accept(afterRush()), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C1:a")?.commandHeld).toBe(true);
  });

  it("RK-205: コマンドゾーンが満杯で置けなければ捨札にする（出典: atwiki/page-956「置けなければ捨札にする」）", () => {
    const full = Array.from({ length: COMMAND_ZONE_MAX }, (_, i) => released("TST-OP", `ec${i}`));
    const s = resolveAll(pick(accept(afterRush({ ...enemy, command: full })), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("discard");
  });

  it("RK-205: バトルエリアに出したターンはアタックもストライクもできない（出典: atwiki/page-956「このとき、これはアタックもストライクもできない」）", () => {
    let s = resolveAll(pick(accept(afterRush()), "SPEC-C1:a"));
    s = passEntry(toPhase(s, "player1", "battle"));
    expect(canStrike(s, "RK-205:sg")).toBe(false);
    expect(canAttackAny(s, "RK-205:sg")).toBe(false);
  });

  it("RK-205: 出さなければラッシュエリアに残る（出典: atwiki/page-956「出してもよい」）", () => {
    const s = settle(skip(afterRush()));
    expect(zoneOf(s, "player1", "RK-205:sg")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-205: ※ 自分がターンを終えるときラッシュエリアにあれば、手札に戻すかを選べる（出典: atwiki/page-956「※これは、自分がターンを終えるときラッシュエリアにあれば手札に戻してもよい」）", () => {
    let s = toTurnEnd(battlePhase({ rush: [inst("RK-205", "sg")] }), "RK-205");
    expectChoiceFrom(s, "player1", "RK-205");
    s = settle(accept(s));
    expect(zoneOf(s, "player1", "RK-205:sg")).toBe("hand");
  });
});

// ===========================================================================
describe("RK-206 ウルフオルフェノク", () => {
  const TEXT =
    "※これはアタックすることができない。 ※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーファイズ」のカードを1枚選び、自軍ラッシュエリアに出す。 【望まない争い】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒アタックを1度でも行った場合、そのターン中はアタックすることができない。また、ストライクを1度でも行った場合、そのターン中はストライクすることができない。";

  it("RK-206: カタログ本文・スペックが出典と一致（出典: atwiki/page-926）", () => {
    expectCatalogText("RK-206", TEXT);
    expectStats("RK-206", { name: "ウルフオルフェノク", category: "MA", size: "S", bp: 6500, sp: "1/3", powerCost: "7-", features: ["オルフェノク", "怪人", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-206", ["NR"]);
  });

  zordDownTests("RK-206", "RK-064", "仮面ライダーファイズ", "atwiki/page-926", "MA");
  reanimateTests("RK-206", "RK-064", "仮面ライダーファイズ", "atwiki/page-926");

  it("RK-206: ※ アタックすることができない（出典: atwiki/page-926「※これはアタックすることができない」）", () => {
    const s = battlePhase({ battle: [inst("RK-206", "wo")] }, { battle: [inst("TST-UNIT-0", "e")] });
    expect(canAttackAny(s, "RK-206:wo")).toBe(false);
  });

  it("RK-206: 【望まない争い】自分は、アタックを1度行ったら、そのターン中ほかのユニットもアタックできない（出典: atwiki/page-926「アタックを1度でも行った場合、そのターン中はアタックすることができない」）", () => {
    let s = battlePhase({ rush: [inst("RK-206", "wo")], battle: [inst("TST-UNIT-7", "a1"), inst("TST-UNIT-7", "a2")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] });
    expect(targetsOf(s, "TST-UNIT-7:a2")).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    s = settle(attack(s, "TST-UNIT-7:a1", "TST-UNIT-0:e1"));
    expect(targetsOf(s, "TST-UNIT-7:a2")).toEqual([]);
  });

  it("RK-206: 【望まない争い】ストライクを1度行ったら、そのターン中ほかのユニットもストライクできない（出典: atwiki/page-926「ストライクを1度でも行った場合、そのターン中はストライクすることができない」）", () => {
    let s = battlePhase({ rush: [inst("RK-206", "wo")], battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2")] });
    expect(canStrike(s, "TST-UNIT-0:s2")).toBe(true);
    s = settle(strike(s, "TST-UNIT-0:s1"));
    expect(canStrike(s, "TST-UNIT-0:s2")).toBe(false);
  });

  it("RK-206: 【望まない争い】相手も同じ制限を受ける（敵軍ターンのアタック）（出典: atwiki/page-926「自分も相手も次の制限を受ける」）", () => {
    let s = enemyPhase("battle", { rush: [inst("RK-206", "wo")], battle: [inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2")] }, { battle: [inst("TST-UNIT-7", "a1"), inst("TST-UNIT-7", "a2")] });
    s = settle(attack(s, "TST-UNIT-7:a1", "TST-UNIT-0:d1", "player2"));
    expect(targetsOf(s, "TST-UNIT-7:a2", "player2")).toEqual([]);
  });

  it("RK-206: 【望まない争い】ウルフオルフェノクがなければ2回目のアタックもできる（出典: atwiki/page-926「これが自軍エリアにある間」）", () => {
    let s = battlePhase({ battle: [inst("TST-UNIT-7", "a1"), inst("TST-UNIT-7", "a2")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] });
    s = settle(attack(s, "TST-UNIT-7:a1", "TST-UNIT-0:e1"));
    expect(targetsOf(s, "TST-UNIT-7:a2")).toEqual(["TST-UNIT-0:e2"]);
  });
});

// ===========================================================================
describe("RK-207 ホースオルフェノク激情態", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ホースオルフェノク格闘態」のカードを1枚選びラッシュエリアに出す。 【悲哀と絶望】これをラッシュしたとき、ホールド状態のユニットをすべて撃破する。そうして3体撃破するたび、相手に1点ダメージを与える。";

  it("RK-207: カタログ本文・スペックが出典と一致（出典: atwiki/page-927）", () => {
    expectCatalogText("RK-207", TEXT);
    expectStats("RK-207", { name: "ホースオルフェノク激情態", category: "DA", size: "S", bp: 5500, sp: undefined, powerCost: "7-", features: ["オルフェノク", "怪人", "男"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-207", ["NR"]);
  });

  zordDownTests("RK-207", "RK-122", "ホースオルフェノク格闘態", "atwiki/page-927", "DA");
  reanimateTests("RK-207", "RK-122", "ホースオルフェノク格闘態", "atwiki/page-927");

  const afterRush = (p1Held: number, p2Held: number) =>
    settle(
      rushed(
        rushPhase(
          { hand: [inst("RK-207", "ho")], rush: [inst("TST-UNIT-0", "free"), ...Array.from({ length: p1Held }, (_, i) => heldUnit("TST-UNIT-0", `h${i}`))], command: releasedCat("DA", 1), power: powerCards(7) },
          { battle: [inst("TST-UNIT-0", "efree"), ...Array.from({ length: p2Held }, (_, i) => heldUnit("TST-UNIT-2", `eh${i}`))] },
        ),
        "RK-207:ho",
      ),
    );

  it("RK-207: 【悲哀と絶望】ラッシュしたとき、自軍・敵軍のホールド状態のユニットをすべて撃破する（リリース状態のユニットは残る）（出典: atwiki/page-927「ホールド状態のユニットをすべて撃破する」・カード評価「自軍、敵軍問わず」）", () => {
    const s = afterRush(1, 2);
    expect(zoneOf(s, "player1", "TST-UNIT-0:h0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:eh0")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:eh1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:free")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:efree")).toBe("battle");
  });

  it("RK-207: 3体撃破するたび相手に1点ダメージ（3体で1点）（出典: atwiki/page-927「そうして3体撃破するたび、相手に1点ダメージを与える」）", () => {
    expect(damageOf(afterRush(1, 2), "player2")).toBe(1);
  });

  it("RK-207: 6体撃破すれば2点、2体なら0点（出典: atwiki/page-927「3体撃破するたび」）", () => {
    expect(damageOf(afterRush(3, 3), "player2")).toBe(2);
    expect(damageOf(afterRush(1, 1), "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RK-208 クレインオルフェノク激情態", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「クレインオルフェノク」のカードを1枚選び、自軍ラッシュエリアに出す。 【迎撃の毒矢】これが自軍ラッシュエリアにある間、効果に「ラッシュしたとき」とある敵軍ユニットが手札からラッシュされたとき、その効果を実行する前に、これをバトルエリアに出してもよい。そうしたとき、その効果は無効になる。その後、そのユニットとこのユニットでバトルする。";

  it("RK-208: カタログ本文・スペックが出典と一致（出典: atwiki/page-928）", () => {
    expectCatalogText("RK-208", TEXT);
    expectStats("RK-208", { name: "クレインオルフェノク激情態", category: "DA", size: "S", bp: 4500, sp: undefined, powerCost: "7-", features: ["オルフェノク", "怪人", "女"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-208", ["NR"]);
  });

  zordDownTests("RK-208", "RK-123", "クレインオルフェノク", "atwiki/page-928", "DA");
  reanimateTests("RK-208", "RK-123", "クレインオルフェノク", "atwiki/page-928");

  /** 敵軍（player2）のラッシュフェイズ、player2 が手札の cardId（ラッシュしたときの効果を持つ）をラッシュした直後。 */
  const enemyRush = (cardId: string, cat: "WB" | "ET" | "DA", power: number, p1: Partial<GameState["players"]["player1"]> = { rush: [inst("RK-208", "cr")] }, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushed(enemyPhase("rush", { hand: fill(3, "ph"), ...p1 }, { hand: [inst(cardId, "er")], command: releasedCat(cat, 1), power: powerCards(power, "ep"), ...p2 }), `${cardId}:er`, "player2");

  // atwiki/page-928 Q1・grnrngr/faq-rider-3 RK-205/RK-208「相手が効果の発動を宣言した後であれば、発動できます。その場合、「RK-205 仮面ライダーサイガ」はラッシュエリアに留まります。」
  it("RK-208: 公式Q&A — 相手がサイガ【フライングアタッカー】の発動を宣言した後に、クレインをバトルエリアに出せる（任意）（出典: grnrngr/faq-rider-3 RK-205・RK-208 Q1・atwiki/page-928 Q1）", () => {
    let s = enemyRush("RK-205", "ET", 4);
    expectChoiceFrom(s, "player2", "RK-205");
    s = accept(s);
    expectChoiceFrom(s, "player1", "RK-208");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-208: 公式Q&A — クレインを出すと【フライングアタッカー】は無効になり（サイガはラッシュエリアに留まる）、サイガとクレインでバトルする（出典: grnrngr/faq-rider-3 RK-205 Q1・atwiki/page-956 Q1・atwiki/page-928「その効果は無効になる。その後、そのユニットとこのユニットでバトルする」）", () => {
    let s = accept(enemyRush("RK-205", "ET", 4, { rush: [inst("RK-208", "cr")], battle: [inst("SPEC-C1", "a")] }));
    s = resolveAll(accept(s));
    expect(zoneOf(s, "player1", "RK-208:cr")).toBe("battle");
    expect(zoneOf(s, "player2", "RK-205:er")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-208: クレインを出さなければ、相手の効果はそのまま実行される（出典: atwiki/page-928「出してもよい」）", () => {
    let s = accept(enemyRush("RK-205", "ET", 4, { rush: [inst("RK-208", "cr")], battle: [inst("SPEC-C1", "a")] }));
    s = skip(s);
    expect(zoneOf(s, "player2", "RK-205:er")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-208:cr")).toBe("rush");
  });

  // atwiki/page-928 Q2「相手が効果の発動を宣言した後になります。…「発動」の宣言がなければ、その効果は実行されませんので、「実行する前」という…タイミングが存在しないことになるからです。」
  it("RK-208: 公式Q&A — 相手が効果を発動しなければ（見送れば）クレインは出せない（出典: grnrngr/faq-rider-3 RK-208 Q2・atwiki/page-928 Q2）", () => {
    const s = settle(skip(enemyRush("RK-205", "ET", 4)));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-208");
    expect(zoneOf(s, "player1", "RK-208:cr")).toBe("rush");
  });

  it("RK-208: 強制の「ラッシュしたとき」（ホースオルフェノク激情態【悲哀と絶望】）は、実行する前にクレインを出せ、出せば無効になってバトルする（出典: atwiki/page-928「その効果を実行する前に…その効果は無効になる。その後、そのユニットとこのユニットでバトルする」・grnrngr/faq-rider-3 RK-208 Q2「「発動」の宣言がなければ、その効果は実行されません」— 強制の効果は宣言を待たず発動する）", () => {
    let s = enemyRush("RK-207", "DA", 7, { rush: [inst("RK-208", "cr"), heldUnit("TST-UNIT-0", "h")] });
    expectChoiceFrom(s, "player1", "RK-208");
    s = resolveAll(accept(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-208:cr")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-207:er")).toBe("rush");
  });

  it("RK-208: 強制の効果の前の窓で出さなければ、その効果はそのまま実行される（出典: atwiki/page-928「出してもよい」）", () => {
    let s = enemyRush("RK-207", "DA", 7, { rush: [inst("RK-208", "cr"), heldUnit("TST-UNIT-0", "h")] });
    expectChoiceFrom(s, "player1", "RK-208");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-208:cr")).toBe("rush");
  });

  it("RK-208: 「ラッシュしたとき」の効果を持たない敵軍ユニットのラッシュには出せない（出典: atwiki/page-928「効果に「ラッシュしたとき」とある敵軍ユニット」）", () => {
    const s = settle(enemyRush("SPEC-C1", "WB", 1));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-208");
  });

  it("RK-208: クレインがバトルエリアにあるときは出せない（出典: atwiki/page-928「これが自軍ラッシュエリアにある間」）", () => {
    let s = enemyRush("RK-205", "ET", 4, { battle: [inst("RK-208", "cr")] });
    s = accept(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-208");
  });

  it("RK-208: 相手のクレインオルフェノク激情態（効果の文中に「ラッシュしたとき」があるが発動のタイミングではない）のラッシュには出せない（出典: atwiki/page-928 カード評価「発動タイミングは「ラッシュしたとき」ではないため…対象にできない」・コメント欄）", () => {
    const s = settle(enemyRush("RK-208", "DA", 7));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-208");
  });
});

// ===========================================================================
describe("RK-209 エラスモテリウムオルフェノク", () => {
  const TEXT =
    "※これは自軍コマンドを5つホールドしなければバトルエリアに出られない。ただし、ホールドする数は相手の手札1枚につき1少なくなる。 【檻から放たれた脅威】自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアのSユニットをすべてホールドしてもよい。そうしたとき、ホールドしたユニットの数以下の必要パワーの数字を持つ敵軍ユニットをすべて撃破する。";

  it("RK-209: カタログ本文・スペックが出典と一致（出典: atwiki/page-929）", () => {
    expectCatalogText("RK-209", TEXT);
    expectStats("RK-209", { name: "エラスモテリウムオルフェノク", category: "DA", size: "M", bp: 7500, sp: 1, powerCost: 6, features: ["オルフェノク", "獣"] });
    expectRarityIn("RK-209", ["N"]);
  });

  it("RK-209: ※ 相手の手札3枚なら、自軍コマンドを2つホールドしてバトルエリアに出られる（出典: atwiki/page-929「5つホールドしなければ…ホールドする数は相手の手札1枚につき1少なくなる」）", () => {
    let s = battlePhase({ rush: [inst("RK-209", "el")], command: releasedCat("DA", 2) }, { hand: fill(3, "eh") });
    expect(canEnter(s, "RK-209:el")).toBe(true);
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: "RK-209:el" });
    expect(zoneOf(s, "player1", "RK-209:el")).toBe("battle");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("RK-209: ※ 相手の手札3枚でリリース状態のコマンドが1つなら出られない（出典: atwiki/page-929）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-209", "el")], command: releasedCat("DA", 1) }, { hand: fill(3, "eh") }), "RK-209:el")).toBe(false);
  });

  it("RK-209: ※ 相手の手札が5枚以上ならホールドせずに出られる（出典: atwiki/page-929 カード評価「相手の手札が多ければ軽減可能なので、状況によってはノーリスクで前に出せる」）", () => {
    const s = battlePhase({ rush: [inst("RK-209", "el")] }, { hand: fill(5, "eh") });
    expect(canEnter(s, "RK-209:el")).toBe(true);
    expect(zoneOf(enter(s, "RK-209:el"), "player1", "RK-209:el")).toBe("battle");
  });

  /** 自軍バトルエリアに S ユニット n 体がある状態で、相手の手札5枚（ホールド不要）でエラスモを出した直後。 */
  const entered = (n: number, p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(
      battlePhase(
        { battle: fill(n, "mine"), rush: [inst("RK-209", "el")] },
        { hand: fill(5, "eh"), battle: [inst("SPEC-C1", "a"), inst("SPEC-C3", "b"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r"), inst("SPEC-C7", "l")], ...p2 },
      ),
      "RK-209:el",
    );

  it("RK-209: 【檻から放たれた脅威】自軍ターン中、バトルエリアに出たとき、自軍バトルエリアの S ユニットをすべてホールドするかを選べる（任意）（出典: atwiki/page-929「自軍バトルエリアのSユニットをすべてホールドしてもよい」）", () => {
    const s = entered(2);
    expectChoiceFrom(s, "player1", "RK-209");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-209: ホールドすると、ホールドした数（2）以下の必要パワーを持つ敵軍ユニットをすべて撃破する（サイズ・エリアを問わない）（出典: atwiki/page-929「ホールドしたユニットの数以下の必要パワーの数字を持つ敵軍ユニットをすべて撃破する」・カード評価「サイズもエリアも問わない除去」）", () => {
    const s = resolveAll(accept(entered(2)));
    expect(s.players.player1.battle.filter((c) => c.instanceId.startsWith("TST-UNIT-0:mine")).every((c) => c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-M2:m")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C7:l")).toBe("rush");
  });

  it("RK-209: ホールドしなければ何も撃破しない（出典: atwiki/page-929「ホールドしてもよい。そうしたとき」）", () => {
    const s = settle(skip(entered(2)));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-209: 自軍バトルエリアに S ユニットがなければ（0体はホールドできない）発動しない（出典: atwiki/page-929 コメント欄「０枚ホールドなんて行動はありません。最低１枚はホールドしないと効果は発動しません」）", () => {
    const s = settle(entered(0));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-209");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-210 仮面ライダーギャレンJF", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーギャレン」のカードを1枚選び、自軍ラッシュエリアに出す。 【バーニングショット】自軍ターン中、これがバトルエリアに出たとき、自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字が番号順（例：0、1、2や3、4、5など）に揃うなら、敵軍Sユニットを1体選び撃破する。";

  it("RK-210: カタログ本文・スペックが出典と一致（出典: atwiki/page-1079）", () => {
    expectCatalogText("RK-210", TEXT);
    expectStats("RK-210", { name: "仮面ライダーギャレンJF", category: "WB", size: "S", bp: 4500, sp: "1/2", powerCost: "7-", features: ["仮面ライダー", "男", "ジャックフォーム"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-210", ["SR"]);
  });

  zordDownTests("RK-210", "RK-126", "仮面ライダーギャレン", "atwiki/page-1079", "WB");
  reanimateTests("RK-210", "RK-126", "仮面ライダーギャレン", "atwiki/page-1079");

  const enemy = { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "r")] };
  const entered = (hand: ReturnType<typeof inst>[], p2: Partial<GameState["players"]["player2"]> = enemy) =>
    enter(battlePhase({ rush: [inst("RK-210", "jf")], hand }, p2), "RK-210:jf");
  const HAND = [inst("SPEC-C3", "h3"), inst("SPEC-C1", "h1"), inst("SPEC-C2", "h2"), inst("SPEC-C7", "h7")];
  /** 手札から ids の3枚を選んで見せる。 */
  const show = (s0: GameState, ids: string[]) => {
    let s = s0;
    for (const id of ids) if (s.pendingEffectChoice?.sourceCardId === "RK-210" && s.pendingEffectChoice.validInstanceIds.includes(id)) s = pick(s, id);
    if (s.pendingEffectChoice?.sourceCardId === "RK-210" && legal(s).some((a) => a.type === "confirm_effect_choice") && !s.pendingEffectChoice.validInstanceIds.some((x) => x.startsWith("TST-UNIT"))) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    return s;
  };

  it("RK-210: 【バーニングショット】自軍ターン中、バトルエリアに出たとき、手札を3枚選んで見せるかを選べる（任意）（出典: atwiki/page-1079「自分の手札を3枚選び、相手に見せてもよい」）", () => {
    const s = entered(HAND);
    expectChoiceFrom(s, "player1", "RK-210");
    expect(choiceIds(s)).toEqual(HAND.map((c) => c.instanceId).sort());
    expect(canSkip(s)).toBe(true);
  });

  it("RK-210: 見せた3枚の必要パワーの数字が番号順（1・2・3。並びは問わない）に揃えば、敵軍 S ユニットを1体選び撃破する（M は対象外）（出典: atwiki/page-1079「見せたカードの必要パワーの数字が番号順…に揃うなら、敵軍Sユニットを1体選び撃破する」）", () => {
    let s = show(entered(HAND), ["SPEC-C3:h3", "SPEC-C1:h1", "SPEC-C2:h2"]);
    expectChoiceFrom(s, "player1", "RK-210");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:r"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-0:r"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(4);
  });

  it("RK-210: 番号順に揃わなければ（1・2・7）撃破しない（出典: atwiki/page-1079「番号順に揃うなら」）", () => {
    const s = settle(show(entered(HAND), ["SPEC-C1:h1", "SPEC-C2:h2", "SPEC-C7:h7"]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-210");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("battle");
  });

  it("RK-210: 手札が3枚未満なら見せられない（出典: atwiki/page-1079「自分の手札を3枚選び」）", () => {
    const s = settle(entered([inst("SPEC-C1", "h1"), inst("SPEC-C2", "h2")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-210");
  });
});
