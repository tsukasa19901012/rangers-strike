/**
 * カード別スペック: RM-036〜RM-042（スペシャルメタルエディション 暴魂チューボ〜蝶忍 紅牙）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜3・rider.html）に本範囲のカードの項はない
 *     （「RM-036」〜「RM-042」とカード名で検索）。本範囲のカードページに atwiki 転載の公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-CN-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／ノーマルレア／ノーマル」を SR／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  activate,
  attack,
  attackedInEnemyTurn,
  attackUntilRegister,
  canActivate,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  heldN,
  inst,
  lastBattleBps,
  mount,
  ncEnter,
  opCard,
  pick,
  pickAs,
  powerCards,
  registerOffered,
  releasedCat,
  reanimateTests,
  resolveAll,
  rideOff,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zordDownTests,
  zoneOf,
  PLAIN_VEHICLE,
} from "./RM2-022-042.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const ES = sUnit("SPEC-ES", { bp: 1000 });
const EM = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 1000, features: ["怪人"] });
const KAIJIN_M = sUnit("SPEC-KAIJIN-M", { category: "DA", bp: 3000, size: "M", features: ["怪人"] });
const NOT_KAIJIN = sUnit("SPEC-NOT-KAIJIN", { category: "DA", bp: 1000, features: ["男"] });
const DA_MECHA = sUnit("SPEC-DA-MECHA", { category: "DA", bp: 1000, features: ["メカ"] });
const DA_PLAIN = sUnit("SPEC-DA-PLAIN", { category: "DA", bp: 1000, features: ["男"] });
const ET_MECHA = sUnit("SPEC-ET-MECHA", { category: "ET", bp: 1000, features: ["メカ"] });
const DA_MECHA_M = sUnit("SPEC-DA-MECHA-M", { category: "DA", bp: 3000, size: "M", features: ["メカ"] });
const NAMED_A = sUnit("SPEC-NAMED-A", { name: "なまえA", bp: 1000 });
const NAMED_A2 = sUnit("SPEC-NAMED-A2", { name: "なまえA", bp: 3000, size: "M" });
const NAMED_B = sUnit("SPEC-NAMED-B", { name: "なまえB", bp: 1000 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C4P = sUnit("SPEC-C4P", { bp: 1000, powerCost: "4+" as never });
const C4M = sUnit("SPEC-C4M", { bp: 3000, powerCost: 4, size: "M" });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const OP3 = opCard("SPEC-OP3", 3);
const OP1 = opCard("SPEC-OP1", 1);
const EXTRA = [E2000, E4000, ES, EM, KAIJIN, KAIJIN_M, NOT_KAIJIN, DA_MECHA, DA_PLAIN, ET_MECHA, DA_MECHA_M, NAMED_A, NAMED_A2, NAMED_B, C4, C4P, C4M, C3, OP3, OP1, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battleBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RM-036 暴魂チューボ", () => {
  const TEXT =
    "※これはアタックされるときBP+3000される。 【剣の使い手】これとバトルする敵軍ユニットのBPが本来のBPでなかったなら、そのバトルで敵軍ユニットを撃破したとき、相手に1点ダメージを与える。";

  it("RM-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-847）", () => {
    expectCatalogText("RM-036", TEXT);
    expectStats("RM-036", { name: "暴魂チューボ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["ヨロイ軍団", "男"] });
    expectRarityIn("RM-036", ["N"]);
  });

  it("RM-036: ※ — アタックされるとき BP+3000（BP6000 でバトルする）（出典: atwiki/page-847「これはアタックされるときBP+3000される」）", () => {
    expect(lastBattleBps(attackedInEnemyTurn({ battle: [inst("RM-036", "cb")] }, "RM-036:cb", {}, "TST-UNIT-7:atk", EXTRA))?.defender).toBe(6000);
  });

  /** 自軍バトルフェイズ、チューボを出して enemy にアタックする。 */
  const attacked = (enemy: CardInstance) => resolveAll(attack(enter(battleBoard({ rush: [inst("RM-036", "cb")] }, { battle: [enemy] }), "RM-036:cb"), "RM-036:cb", enemy.instanceId));

  it.fails("RM-036:【剣の使い手】— バトルする敵軍ユニットの BP が本来の BP でなく（BP-500 されている）、そのバトルで撃破したとき、相手に1点ダメージ（出典: atwiki/page-847「これとバトルする敵軍ユニットのBPが本来のBPでなかったなら、そのバトルで敵軍ユニットを撃破したとき、相手に1点ダメージを与える」）", () => {
    const s = attacked({ ...inst("SPEC-E2000", "e"), bpModifier: -500 });
    expect(zoneOf(s, "player2", "SPEC-E2000:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RM-036:【剣の使い手】— 本来の BP のままの敵軍ユニットを撃破してもダメージはない（出典: atwiki/page-847「本来のBPでなかったなら」）", () => {
    const s = attacked(inst("SPEC-E2000", "e"));
    expect(zoneOf(s, "player2", "SPEC-E2000:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it.fails("RM-036:【剣の使い手】— 敵軍ターンにアタックされたバトルでも、BP が本来の BP でない（BP+1000 されている）アタック側を撃破すれば相手に1点ダメージ（出典: atwiki/page-847「これとバトルする」・カード評価「アタックされた時にBPが上がるため」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RM-036", "cb")] }, "RM-036:cb", { battle: [{ ...inst("SPEC-E4000", "atk"), bpModifier: 1000 }] }, "SPEC-E4000:atk", EXTRA));
    expect(zoneOf(s, "player2", "SPEC-E4000:atk")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("RM-037 凱聖ゲルドリング", () => {
  const TEXT =
    "【手段を選ばぬ策略】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい。そうしたとき、相手の手札を見ないで1枚選ぶ。相手は選ばれたカードを自分自身の山札の上に戻すか、自分自身のパワーゾーンに置くか、自分自身のコマンドゾーンにホールド状態で置くかを選ぶ。";

  it("RM-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-848）", () => {
    expectCatalogText("RM-037", TEXT);
    expectStats("RM-037", { name: "凱聖ゲルドリング", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["モンスター軍団", "怪人", "男"], rushCondition: "opponent_draw" });
    expectRarityIn("RM-037", ["N"]);
  });

  it("RM-037: 追加条件 — ラッシュすると相手が1枚ドローする（出典: atwiki/page-848「相手に1枚ドローさせる」）", () => {
    const r = rushFromHand(board({ hand: [inst("RM-037", "h")], command: releasedCat("DA", 1), power: powerCards(4) }), "player1", "RM-037:h");
    expect(r.ok, r.error).toBe(true);
    expect(resolveAll(r.state).players.player2.hand).toHaveLength(1);
  });

  const ENEMY_HAND = [inst("TST-OP", "h1"), inst("TST-UNIT-0", "h2")];
  const entered = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(
      battleBoard({ rush: [inst("RM-037", "gd"), inst("SPEC-KAIJIN", "k"), inst("SPEC-KAIJIN-M", "km"), inst("SPEC-NOT-KAIJIN", "n")] }, { hand: ENEMY_HAND, ...p2 }),
      "RM-037:gd",
    );

  it.fails("RM-037:【手段を選ばぬ策略】— 自軍ターン中にバトルエリアに出たとき、自軍ラッシュエリアの「怪人」を持つユニット（サイズを問わない）から1体選べる（任意）（出典: atwiki/page-848「自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-037");
    expect(choiceIds(s)).toEqual(["SPEC-KAIJIN-M:km", "SPEC-KAIJIN:k"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-037:【手段を選ばぬ策略】— 選んだ「怪人」を捨札にすると、相手の手札から1枚選ぶ（出典: atwiki/page-848「そうしたとき、相手の手札を見ないで1枚選ぶ」）", () => {
    const s = pick(entered(), "SPEC-KAIJIN:k");
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:k")).toBe("discard");
    expectChoiceFrom(s, "player1", "RM-037");
    expect(choiceIds(s)).toEqual(["TST-OP:h1", "TST-UNIT-0:h2"]);
  });

  it.fails("RM-037:【手段を選ばぬ策略】— 相手が、選ばれたカードを山札の上・パワーゾーン・コマンドゾーン（ホールド状態）のどこに置くかを選ぶ（出典: atwiki/page-848「相手は選ばれたカードを自分自身の山札の上に戻すか、自分自身のパワーゾーンに置くか、自分自身のコマンドゾーンにホールド状態で置くかを選ぶ」）", () => {
    const s = pick(pick(entered(), "SPEC-KAIJIN:k"), "TST-UNIT-0:h2");
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["deck_top", "to_command", "to_power"]);
  });

  it.fails("RM-037:【手段を選ばぬ策略】— 山札の上・パワーゾーン・コマンドゾーンのどれを選んでも、そのとおりに置かれる（出典: atwiki/page-848）", () => {
    const chosen = () => pick(pick(entered(), "SPEC-KAIJIN:k"), "TST-UNIT-0:h2");
    const top = settle(pickAs(chosen(), "player2", "deck_top"));
    expect(top.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-0:h2");
    const power = settle(pickAs(chosen(), "player2", "to_power"));
    expect(zoneOf(power, "player2", "TST-UNIT-0:h2")).toBe("power");
    expect(cardIn(power, "player2", "TST-UNIT-0:h2")?.faceDown ?? false).toBe(false);
    const command = settle(pickAs(chosen(), "player2", "to_command"));
    expect(zoneOf(command, "player2", "TST-UNIT-0:h2")).toBe("command");
    expect(cardIn(command, "player2", "TST-UNIT-0:h2")?.commandHeld).toBe(true);
  });

  it.fails("RM-037:【手段を選ばぬ策略】— 相手のコマンドゾーンが5枚ならコマンドゾーンは選べない（出典: atwiki/page-848・R-ZONE-08（コマンドゾーンは5枚まで））", () => {
    const s = pick(pick(entered({ command: heldN(5, "TST-OP", "ec") }), "SPEC-KAIJIN:k"), "TST-UNIT-0:h2");
    expect(choiceIds(s)).toEqual(["deck_top", "to_power"]);
  });

  it.todo(
    "RM-037:【手段を選ばぬ策略】—「相手の手札を見ないで1枚選ぶ」（手札の中身を見せずに選ばせる）— エンジンの公開 API は相手の手札のカードを instanceId で選ぶだけで、選ぶ側に中身を見せないことは web の表示の照合でしか確かめられない",
  );

  it.fails("RM-037:【手段を選ばぬ策略】— 見送れば「怪人」は捨札にならず、相手の手札も変わらない（出典: atwiki/page-848「捨札にしてもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:k")).toBe("rush");
    expect(s.players.player2.hand).toHaveLength(ENEMY_HAND.length);
  });
});

// ===========================================================================
describe("RM-038 凱聖バルスキー", () => {
  const TEXT =
    "【部下の修理と改造】 これが自軍エリアにある間、自軍ラッシュフェイズ中、DAを持つ自軍コマンドを3つホールドしてもよい。そうしたとき、自軍捨札からDAを持ち特徴「メカ」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出す。";

  it("RM-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-849）", () => {
    expectCatalogText("RM-038", TEXT);
    expectStats("RM-038", { name: "凱聖バルスキー", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["戦闘ロボット軍団", "メカ", "人型"], rushCondition: "opponent_draw" });
    expectRarityIn("RM-038", ["NR"]);
  });

  const DISCARD = [inst("SPEC-DA-MECHA", "dm"), inst("SPEC-DA-PLAIN", "dp"), inst("SPEC-ET-MECHA", "em"), inst("SPEC-DA-MECHA-M", "mm")];
  const rushPhase = (command = releasedCat("DA", 3), p1: Partial<GameState["players"]["player1"]> = {}) => board({ rush: [inst("RM-038", "bs")], command, discard: DISCARD, ...p1 });

  it.fails("RM-038:【部下の修理と改造】— 自軍ラッシュフェイズ中、DA の自軍コマンドを3つホールドして発動できる（出典: atwiki/page-849「自軍ラッシュフェイズ中、DAを持つ自軍コマンドを3つホールドしてもよい」・カード評価「自分はラッシュエリアに引きこもっていても効果を発動できる」）", () => {
    const s = rushPhase();
    expect(canActivate(s, "RM-038:bs")).toBe(true);
    const t = activate(s, "RM-038:bs");
    expect(t.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it.fails("RM-038:【部下の修理と改造】— 自軍捨札の、DA で「メカ」を持つ S ユニットのカードから1枚選ぶ（DA でないもの・「メカ」でないもの・M ユニットは選べない）（出典: atwiki/page-849「自軍捨札からDAを持ち特徴「メカ」を持つSユニットのカードを1枚選び」）", () => {
    const s = activate(rushPhase(), "RM-038:bs");
    expectChoiceFrom(s, "player1", "RM-038");
    expect(choiceIds(s)).toEqual(["SPEC-DA-MECHA:dm"]);
  });

  it.fails("RM-038:【部下の修理と改造】— 選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-849「自軍ラッシュエリアに出す」・カード評価「厄介な効果をもつユニットを再利用できる」）", () => {
    const s = resolveAll(pick(activate(rushPhase(), "RM-038:bs"), "SPEC-DA-MECHA:dm"));
    expect(zoneOf(s, "player1", "SPEC-DA-MECHA:dm")).toBe("rush");
  });

  it("RM-038:【部下の修理と改造】— DA の自軍コマンドが3つなければ発動できない（出典: atwiki/page-849「DAを持つ自軍コマンドを3つ」）", () => {
    expect(canActivate(rushPhase([...releasedCat("DA", 2), ...releasedCat("WB", 2)]), "RM-038:bs")).toBe(false);
  });

  it("RM-038:【部下の修理と改造】— 自軍バトルフェイズには発動できない（出典: atwiki/page-849「自軍ラッシュフェイズ中」）", () => {
    expect(canActivate(battleBoard({ rush: [inst("RM-038", "bs")], command: releasedCat("DA", 3), discard: DISCARD }), "RM-038:bs")).toBe(false);
  });

  it.fails("RM-038:【部下の修理と改造】— 回数の制限はなく、DA のコマンドがあれば同じラッシュフェイズにもう一度発動できる（出典: atwiki/page-849 本文（「1度だけ」の限定がない）・カード評価「コマンドを3つも使用する都合上」）", () => {
    const s = resolveAll(pick(activate(rushPhase(releasedCat("DA", 6), { discard: [...DISCARD, inst("SPEC-DA-MECHA", "dm2")] }), "RM-038:bs"), "SPEC-DA-MECHA:dm"));
    expect(canActivate(s, "RM-038:bs")).toBe(true);
  });
});

// ===========================================================================
describe("RM-039 ジライヤ第二装着", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ジライヤ」のカードを1枚選び、自軍ラッシュエリアに出す。 【十文字斬り】自軍ターン中、これがバトルエリアに出たとき、敵軍捨札からユニットカードを1枚選んでもよい。そうしたとき、選んだユニットカードと同じカード名の敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RM-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-872）", () => {
    expectCatalogText("RM-039", TEXT);
    expectStats("RM-039", { name: "ジライヤ第二装着", category: "MA", size: "S", bp: 4500, sp: "1/3", powerCost: "7-", comboNumber: undefined, features: ["戸隠流", "男", "忍者", "パワープロテクター"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RM-039", ["SR"]);
  });

  zordDownTests("RM-039", "PM-001", "ジライヤ", "atwiki/page-872", "MA");
  reanimateTests("RM-039", "PM-001", "ジライヤ", "atwiki/page-872");

  const entered = () =>
    enter(
      battleBoard(
        { rush: [inst("RM-039", "jr")] },
        { discard: [inst("SPEC-NAMED-A", "da"), inst("SPEC-NAMED-B", "db"), inst("TST-OP", "op")], rush: [inst("SPEC-NAMED-A", "ra")], battle: [inst("SPEC-NAMED-A2", "ba"), inst("SPEC-ES", "x")] },
      ),
      "RM-039:jr",
    );

  it.fails("RM-039:【十文字斬り】— 自軍ターン中にバトルエリアに出たとき、敵軍捨札のユニットカードから1枚選べる（オペレーションは選べない。任意）（出典: atwiki/page-872「敵軍捨札からユニットカードを1枚選んでもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RM-039");
    expect(choiceIds(s)).toEqual(["SPEC-NAMED-A:da", "SPEC-NAMED-B:db"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-039:【十文字斬り】— 選んだユニットカードと同じカード名の敵軍ユニット（エリア・サイズを問わない）から1体選ぶ（出典: atwiki/page-872「選んだユニットカードと同じカード名の敵軍ユニットを1体選び」・カード評価「サイズに影響されないのでＬユニットであっても問答無用。さらにラッシュエリアにも届く」）", () => {
    const s = pick(entered(), "SPEC-NAMED-A:da");
    expectChoiceFrom(s, "player1", "RM-039");
    expect(choiceIds(s)).toEqual(["SPEC-NAMED-A2:ba", "SPEC-NAMED-A:ra"]);
  });

  it.fails("RM-039:【十文字斬り】— 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる。捨札のカードは捨札に残る（出典: atwiki/page-872「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(pick(entered(), "SPEC-NAMED-A:da"), "SPEC-NAMED-A:ra"));
    expect(zoneOf(s, "player2", "SPEC-NAMED-A:ra")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-NAMED-A:ra")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-NAMED-A:da")).toBe("discard");
  });

  it.fails("RM-039:【十文字斬り】— 同じカード名の敵軍ユニットがいなければ何も起きない（出典: atwiki/page-872「そうしたとき、選んだユニットカードと同じカード名の敵軍ユニットを」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-NAMED-B:db"));
    expect(damageOf(s, "player2")).toBe(0);
    expect(s.players.player2.battle).toHaveLength(2);
  });
});

// ===========================================================================
describe("RM-040 姫忍　恵美破", () => {
  const TEXT = "【忍法花吹雪】「SP1」カテゴリまたは特徴の追加されている敵軍Sユニットを1体選び、持ち主の山札の下に戻してもよい。";

  it("RM-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-852）", () => {
    expectCatalogText("RM-040", TEXT);
    expectStats("RM-040", { name: "姫忍　恵美破", category: "MA", size: "S", bp: 500, sp: "special", powerCost: 2, comboNumber: 3, features: ["戸隠流", "女", "忍者"] });
    expectRarityIn("RM-040", ["N"]);
  });

  const ADDED = [
    // 特徴を追加された敵軍 S ユニット（RM-002 赤射「特徴に「レッド」を追加する」を敵軍が使った状態）。
    { kind: "rule", ruleId: "kirigakure_features", scope: "turn", payload: { instanceId: "SPEC-ES:f", features: ["レッド"] }, sourceCardId: "RM-002" },
    // カテゴリを追加された敵軍 S ユニット（RS-524 呉越同舟）。
    { kind: "rule", ruleId: "rs524_added_category", scope: "turn", payload: { instanceId: "SPEC-ES:c", category: "OT" }, sourceCardId: "RS-524" },
    // 特徴を追加された敵軍 M ユニット。
    { kind: "rule", ruleId: "kirigakure_features", scope: "turn", payload: { instanceId: "SPEC-EM:m", features: ["レッド"] }, sourceCardId: "RM-002" },
  ];
  /** 自軍バトルフェイズ、フィラー fillerCount 体の後に恵美破を出す。 */
  const ncEntered = (fillerCount = 2) =>
    ncEnter("RM-040:e", fillerCount, {}, {
      battle: [inst("SPEC-ES", "f"), inst("SPEC-ES", "c"), inst("SPEC-EM", "m"), inst("RS-535", "cd")],
      rush: [inst("SPEC-ES", "plain")],
      modifiers: ADDED as never,
    }, EXTRA);

  it("RM-040: NC【忍法花吹雪】— ナンバーコンビネーションで「SP1」を得る（出典: atwiki/page-852「「SP1」」・カード評価「ストライカー」）", () => {
    let s = ncEntered();
    if (s.pendingEffectChoice?.sourceCardId === "RM-040") s = skip(s);
    expect(spOf(settle(s), "player1", "RM-040:e")).toBe(1);
  });

  it.fails("RM-040: NC【忍法花吹雪】— カテゴリか特徴が追加されている敵軍 S ユニット（エリアを問わない）から1体選べる（M ユニット・何も追加されていない S ユニットは選べない。任意）（出典: atwiki/page-852「カテゴリまたは特徴の追加されている敵軍Sユニットを1体選び、持ち主の山札の下に戻してもよい」・カード評価「エリアに左右されない除去能力」）", () => {
    const s = ncEntered();
    expectChoiceFrom(s, "player1", "RM-040");
    expect(choiceIds(s)).toEqual(["RS-535:cd", "SPEC-ES:c", "SPEC-ES:f"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-040: NC【忍法花吹雪】— 選んだユニットは持ち主の山札の一番下に戻る（出典: atwiki/page-852「持ち主の山札の下に戻してもよい」）", () => {
    const s = resolveAll(pick(ncEntered(), "SPEC-ES:f"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-ES:f");
  });

  it("RM-040: NC【忍法花吹雪】— ナンバーコンビネーションしなければ（バトルエリアの1番目）発動しない（出典: atwiki/page-852・R-CN-01）", () => {
    const s = ncEntered(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-040");
    expect(spOf(settle(s), "player1", "RM-040:e")).toBe(0);
  });
});

// ===========================================================================
describe("RM-041 城忍　フクロウ男爵", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【アイアム偽者などノーサンキュー】敵軍ユニットを1体選んでもよい。そうしたとき、選んだユニットと同じカード名の敵軍ユニットが、選んだユニット以外にあれば、選んだユニットを持ち主のパワーゾーンにダメージにして置く。";

  it("RM-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-853）", () => {
    expectCatalogText("RM-041", TEXT);
    expectStats("RM-041", { name: "城忍　フクロウ男爵", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: "RC", features: ["男", "忍者"] });
    expectRarityIn("RM-041", ["NR"]);
  });

  it("RM-041: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-853 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RM-041", "fk")] }, "RM-041:fk"))).toBe(true);
  });

  /** 自軍バトルフェイズ、フクロウ男爵が SPEC-VEHICLE にライドして出てライドオフする（RC の選択まで）。 */
  const rc = () =>
    rideOff(
      mount(
        battleBoard({ rush: [inst("RM-041", "fk"), inst("SPEC-VEHICLE", "v")] }, { rush: [inst("SPEC-NAMED-A", "ra"), inst("SPEC-NAMED-B", "rb")], battle: [inst("SPEC-NAMED-A2", "ba")] }),
        "RM-041:fk",
        "SPEC-VEHICLE:v",
      ),
      true,
    );

  it.fails("RM-041: RC【アイアム偽者などノーサンキュー】— 敵軍ユニット（エリア・サイズを問わない）から1体選べる（任意）（出典: atwiki/page-853「敵軍ユニットを1体選んでもよい」・カード評価「エリア・サイズを問わずダメージに送る強力な除去」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RM-041");
    expect(choiceIds(s)).toEqual(["SPEC-NAMED-A2:ba", "SPEC-NAMED-A:ra", "SPEC-NAMED-B:rb"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-041: RC — 選んだユニットと同じカード名の敵軍ユニットがほかにあれば、選んだユニットを持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-853「選んだユニット以外にあれば、選んだユニットを持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-NAMED-A2:ba"));
    expect(zoneOf(s, "player2", "SPEC-NAMED-A2:ba")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-NAMED-A2:ba")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-NAMED-A:ra")).toBe("rush");
  });

  it.fails("RM-041: RC — 同じカード名の敵軍ユニットがほかになければ何も起きない（出典: atwiki/page-853「選んだユニット以外にあれば」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-NAMED-B:rb"));
    expect(zoneOf(s, "player2", "SPEC-NAMED-B:rb")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-042 蝶忍　紅牙", () => {
  const TEXT =
    "【妖魔忍法乱れ蝶】自分の手札からカードを2枚選び相手に見せてもよい。そうしたとき、見せた2枚のカードの必要パワーの数字を合計して、その合計と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RM-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-850）", () => {
    expectCatalogText("RM-042", TEXT);
    expectStats("RM-042", { name: "蝶忍　紅牙", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 4, features: ["妖魔一族", "女", "忍者"] });
    expectRarityIn("RM-042", ["N"]);
  });

  const HAND = [inst("SPEC-OP3", "h3"), inst("SPEC-OP1", "h1"), inst("TST-P", "h0")];
  const ncEntered = (hand: CardInstance[] = HAND, fillerCount = 3) =>
    ncEnter("RM-042:k", fillerCount, { hand }, { rush: [inst("SPEC-C4", "c4"), inst("SPEC-C4M", "m4"), inst("SPEC-C3", "c3")], battle: [inst("SPEC-C4P", "c4p")] }, EXTRA);

  it.fails("RM-042: NC【妖魔忍法乱れ蝶】— 自分の手札から2枚選べる（任意）（出典: atwiki/page-850「自分の手札からカードを2枚選び相手に見せてもよい」）", () => {
    const s = ncEntered();
    expectChoiceFrom(s, "player1", "RM-042");
    expect(choiceIds(s)).toEqual(["SPEC-OP1:h1", "SPEC-OP3:h3", "TST-P:h0"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RM-042: NC — 2枚の必要パワーの数字の合計（3+1=4）と同じ必要パワーの数字の敵軍 S ユニット（エリアを問わない。「4+」も4）から1体選ぶ。見せたカードは手札に残る（出典: atwiki/page-850「見せた2枚のカードの必要パワーの数字を合計して、その合計と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び」・カード評価「エリアを問わず、追加条件を持つユニットも除去出来る」）", () => {
    const s = pick(pick(ncEntered(), "SPEC-OP3:h3"), "SPEC-OP1:h1");
    expectChoiceFrom(s, "player1", "RM-042");
    expect(choiceIds(s)).toEqual(["SPEC-C4:c4", "SPEC-C4P:c4p"]);
    expect(s.players.player1.hand).toHaveLength(HAND.length);
  });

  it.fails("RM-042: NC — 選んだユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-850「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(pick(pick(ncEntered(), "SPEC-OP3:h3"), "SPEC-OP1:h1"), "SPEC-C4:c4"));
    expect(zoneOf(s, "player2", "SPEC-C4:c4")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C4:c4")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RM-042: NC — 手札が1枚しかなければ発動しない（出典: atwiki/page-850「カードを2枚選び」）", () => {
    const s = ncEntered([inst("SPEC-OP3", "h3")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-042");
  });
});
