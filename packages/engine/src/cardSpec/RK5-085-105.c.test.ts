/**
 * カード別スペック: RK-099〜RK-105（ザ・マスクドライダーEXP vol.2 アポロガイスト〜仮面ライダーアギトSF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-105 の Q&A、RK-166 欄の RK-100 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。RK-099・RK-104 の Q&A は atwiki に転載された公式 Q&A）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-REG、R-CN-04、R-END-01、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマルレア／レア」を NR／R として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-080 超変身に重ねたカードの扱い（毎ターン重ねられる）— rulesSpec/03-turn.test.ts R-START-06・cardSpec/RK4-064-084.c.test.ts RK-080
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackTargets,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  enter,
  enterKeep,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  heldCount,
  inst,
  lastBattleBps,
  legal,
  mount,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rideOff,
  settle,
  skip,
  spOf,
  st,
  stackedOn,
  sUnit,
  toTurnEnd,
  zoneOf,
} from "./RK5-085-105.helpers";

const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 2000, features: ["怪人"] });
const KAIJIN_M = sUnit("SPEC-KAIJIN-M", { category: "DA", bp: 4000, size: "M", features: ["怪人"] });
const NON = sUnit("SPEC-NON", { category: "DA", bp: 2000, features: ["男"] });
const NINJA = sUnit("SPEC-NINJA", { bp: 5000, features: ["忍者"] });
const ATK5000 = sUnit("SPEC-ATK5000", { bp: 5000 });
const ATK3000 = sUnit("SPEC-ATK3000", { bp: 3000 });
const E_COST0 = sUnit("SPEC-E0", { bp: 1000, powerCost: 0 });
const E_COST1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E_COST2 = sUnit("SPEC-E2", { bp: 2000, powerCost: 2 });
const E_COST3 = sUnit("SPEC-E3", { bp: 3000, powerCost: 3 });
const E_COST5 = sUnit("SPEC-E5", { bp: 5000, powerCost: 5 });
const E_COST2_M = sUnit("SPEC-E2M", { bp: 3000, powerCost: 2, size: "M" });
const POLICE = sUnit("SPEC-POLICE", { category: "MA", bp: 1000, features: ["警察"] });
const KAIZO_S = sUnit("SPEC-KAIZO", { category: "ET", bp: 2000, powerCost: 2, features: ["改造人間"] });
const KAIZO_S5 = sUnit("SPEC-KAIZO5", { category: "ET", bp: 5000, powerCost: 5, features: ["改造人間"] });
const KAIZO_M = sUnit("SPEC-KAIZO-M", { category: "ET", bp: 5000, powerCost: 2, size: "M", features: ["改造人間"] });
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 2000, comboNumber: "RC" });
const EXTRA = [KAIJIN, KAIJIN_M, NON, NINJA, ATK5000, ATK3000, E_COST0, E_COST1, E_COST2, E_COST3, E_COST5, E_COST2_M, POLICE, KAIZO_S, KAIZO_S5, KAIZO_M, RIDER, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const released = (id: string, suffix: string): CardInstance => ({ ...inst(id, suffix), commandHeld: false });
const held = (id: string, suffix: string): CardInstance => ({ ...inst(id, suffix), commandHeld: true });

// ===========================================================================
describe("RK-099 アポロガイスト", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【怪人の監視権限】これが自軍エリアにある間、特徴「怪人」を持つ自軍ユニットはBP+1000される。また、自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("RK-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-698）", () => {
    expectCatalogText("RK-099", TEXT);
    expectStats("RK-099", { name: "アポロガイスト", category: "DA", size: "S", bp: 4000, sp: "special", powerCost: 3, features: ["GOD", "男", "改造人間"] });
    expectRarityIn("RK-099", ["R"]);
  });

  it("RK-099: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-698「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-099", "ap")] }, "RK-099:ap"))).toBe(true);
  });

  it("RK-099: これが自軍エリアにある間、特徴「怪人」を持つ自軍ユニット（バトルエリア・ラッシュエリア、M ユニットも）は BP+1000 される（出典: atwiki/page-698「特徴「怪人」を持つ自軍ユニットはBP+1000される」）", () => {
    const s = board({ battle: [inst("SPEC-KAIJIN", "k")], rush: [inst("RK-099", "ap"), inst("SPEC-KAIJIN-M", "km")] });
    expect(bpOf(s, "player1", "SPEC-KAIJIN:k")).toBe(3000);
    expect(bpOf(s, "player1", "SPEC-KAIJIN-M:km")).toBe(5000);
  });

  it("RK-099: 「怪人」を持たないユニット（これ自身も）・敵軍の「怪人」は BP が変わらない（出典: atwiki/page-698「特徴「怪人」を持つ自軍ユニット」）", () => {
    const s = board({ battle: [inst("RK-099", "ap"), inst("SPEC-NON", "n")] }, { battle: [inst("SPEC-KAIJIN", "ek")] });
    expect(bpOf(s, "player1", "SPEC-NON:n")).toBe(2000);
    expect(bpOf(s, "player1", "RK-099:ap")).toBe(4000);
    expect(bpOf(s, "player2", "SPEC-KAIJIN:ek")).toBe(2000);
  });

  it("RK-099: 2体あれば BP+2000 される（出典: atwiki/page-698 カード評価「重複するため出した分だけBP+1000される」）", () => {
    const s = board({ battle: [inst("SPEC-KAIJIN", "k")], rush: [inst("RK-099", "ap"), inst("RK-099", "ap2")] });
    expect(bpOf(s, "player1", "SPEC-KAIJIN:k")).toBe(4000);
  });

  const enterApollo = (rush: CardInstance[]) => enter(board({ rush: [inst("RK-099", "ap"), ...rush] }, { battle: [inst("SPEC-E1", "e")] }), "RK-099:ap");

  it("RK-099: 自軍ターン中にバトルエリアに出たとき、自軍ラッシュエリアの「怪人」のユニットを1体選んで捨札にするかを選べる（任意）（出典: atwiki/page-698「自軍ラッシュエリアから特徴「怪人」を持つユニットを1体選び、捨札にしてもよい」）", () => {
    const s = enterApollo([inst("SPEC-KAIJIN", "k"), inst("SPEC-KAIJIN-M", "km"), inst("SPEC-NON", "n")]);
    expectChoiceFrom(s, "player1", "RK-099");
    expect(choiceIds(s)).toEqual(["SPEC-KAIJIN-M:km", "SPEC-KAIJIN:k"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-099: 捨札にすると、このターン、これは「SP1」になる（出典: atwiki/page-698「そうしたとき、このターン、これは「SP1」になる」）", () => {
    const s = settle(pick(enterApollo([inst("SPEC-KAIJIN", "k")]), "SPEC-KAIJIN:k"));
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:k")).toBe("discard");
    expect(spOf(s, "player1", "RK-099:ap")).toBe(1);
  });

  it("RK-099: 捨札にしなければ「SP1」にならない（SP「！」のまま）（出典: atwiki/page-698「SP：！」）", () => {
    const s = settle(skip(enterApollo([inst("SPEC-KAIJIN", "k")])));
    expect(zoneOf(s, "player1", "SPEC-KAIJIN:k")).toBe("rush");
    expect(spOf(s, "player1", "RK-099:ap")).toBe(0);
  });

  it.todo(
    "RK-099: 公式Q&A — アポロガイストがいるとき【神出鬼没の疾風】でラッシュしたサイクロン・ドーパントのリード ET で宏のオルゴール時計を発動できる（出典: atwiki/page-698 Q1）— XG7-055 サイクロン・ドーパントは本範囲外のカードで、その効果の照合がまだのため",
  );
  // atwiki/page-698 Q2 = atwiki/page-1399 Q4「いいえ、なりません。バトルで撃破されたユニットはすでに「撃破」されており、その状態からさらに効果などで重複して撃破されることはありません。」
  it("RK-099: 公式Q&A — クウガRM の RC で撃破されたアポロガイストは、すでにバトルで撃破されているので【ライジングマイティキック】の効果での撃破の対象にならない（レジストで留まれば場に残り、BP がそれ以下の他の S ユニットだけが撃破される）（出典: atwiki/page-698 Q2・atwiki/page-1399 Q4）", () => {
    let s = rcRideOff(board({ rush: [inst("RK-271", "rm"), inst("SPEC-VEHICLE", "v")] }, { battle: [inst("RK-099", "ap"), inst("SPEC-E2", "e2")] }), "RK-271:rm", "SPEC-VEHICLE:v");
    s = resolveAll(s);
    s = attack(s, "RK-271:rm", "RK-099:ap");
    for (let i = 0; i < 6 && !registerOffered(s, "player2"); i++) {
      const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!p) break;
      s = act(s, p);
    }
    expect(registerOffered(s, "player2")).toBe(true);
    s = resolveAll(act(s, { type: "use_register", playerId: "player2" }));
    expect(zoneOf(s, "player2", "RK-099:ap")).toBe("battle");
    expect(cardIn(s, "player2", "RK-099:ap")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E2:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-100 仮面ライダーZX", () => {
  const TEXT =
    "【虚像投影装置】自軍コマンドゾーンのリリース状態のカードから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。";

  it("RK-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-654）", () => {
    expectCatalogText("RK-100", TEXT);
    expectStats("RK-100", { name: "仮面ライダーZX", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "メカ", "忍者"] });
    expectRarityIn("RK-100", ["R"]);
  });

  const projector = (command: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-100", "zx"), inst("SPEC-VEHICLE", "v")], command, power: powerCards(4), ...p1 }), "RK-100:zx", "SPEC-VEHICLE:v");

  it("RK-100: RC — 自軍コマンドゾーンのリリース状態の、特徴「改造人間」を持つ S ユニットのカードだけを選べる（任意）（出典: atwiki/page-654「リリース状態のカードから、特徴「改造人間」を持つSユニットのカードを1枚選び」）", () => {
    const s = projector([released("SPEC-KAIZO", "k"), held("SPEC-KAIZO", "h"), released("SPEC-KAIZO-M", "m"), released("SPEC-NON", "n")]);
    expectChoiceFrom(s, "player1", "RK-100");
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:k"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-100: RC — 必要パワーを満たさないカード（必要パワー5・パワー4枚）は選べない（出典: atwiki/page-654「ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = projector([released("SPEC-KAIZO5", "k5"), released("SPEC-KAIZO", "k")]);
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:k"]);
  });

  it("RK-100: RC — 追加条件を満たせないカード（狼男: 自軍「ゾル大佐」がない）は選べない（出典: atwiki/page-654「追加条件は満たすこと」）", () => {
    const s = projector([released("RK-092", "wo"), released("SPEC-KAIZO", "k")], { power: powerCards(5) });
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:k"]);
  });

  // 公式 Q（RK-166 欄）「リリース状態で置かれます。ユニットはユニットでなくなった時点で、ユニットとして持っていた情報はすべて失われる」
  it("RK-100: RC — 選んだカードは自軍ラッシュエリアにリリース状態で出る（出典: atwiki/page-654「自軍ラッシュエリアに出してもよい」・grnrngr/faq-rider-2 RK-166 Q「リリース状態で置かれます」）", () => {
    const s = resolveAll(pick(projector([released("SPEC-KAIZO", "k")]), "SPEC-KAIZO:k"));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("rush");
    expect(cardIn(s, "player1", "SPEC-KAIZO:k")?.commandHeld ?? false).toBe(false);
  });

  it("RK-100: RC — 出さなければコマンドゾーンに残る（出典: atwiki/page-654「出してもよい」）", () => {
    const s = settle(skip(projector([released("SPEC-KAIZO", "k")])));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("command");
  });
});

// ===========================================================================
describe("RK-101 タイガーロイド", () => {
  const TEXT =
    "【タイガーボンバー】これが自軍バトルエリアにある間、敵軍ターン中、敵軍バトルエリアの特徴「忍者」を持たないユニットは、アタックするとき、バトルの前にBP-3000される。（BP0以下になったユニットは撃破される）この効果は重複しない。";

  it("RK-101: カタログ本文・スペックが出典と一致（出典: atwiki/page-641）", () => {
    expectCatalogText("RK-101", TEXT);
    expectStats("RK-101", { name: "タイガーロイド", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, features: ["バダン", "怪人", "男", "改造人間"] });
    expectRarityIn("RK-101", ["NR"]);
  });

  /** 敵軍（player2）の attacker が自軍の target にアタックする（反応はパス）。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]>, target: string, attacker: string) => {
    const [aid, suf] = attacker.split(":") as [string, string];
    return resolveAll(attack(enemyTurn(p1, { battle: [inst(aid, suf)] }), attacker, target, "player2"));
  };

  it("RK-101: これが自軍バトルエリアにある間、敵軍ターン中にアタックする敵軍ユニットは、バトルの前に BP-3000 される（5000 → 2000）（出典: atwiki/page-641「アタックするとき、バトルの前にBP-3000される」）", () => {
    const s = attacked({ battle: [inst("RK-101", "tg")] }, "RK-101:tg", "SPEC-ATK5000:a");
    expect(lastBattleBps(s)).toEqual({ attacker: 2000, defender: 500 });
  });

  it("RK-101: BP0 以下になったユニットは撃破され、バトルは行われない（出典: atwiki/page-641「（BP0以下になったユニットは撃破される）」）", () => {
    const s = attacked({ battle: [inst("RK-101", "tg")] }, "RK-101:tg", "SPEC-ATK3000:a");
    expect(zoneOf(s, "player2", "SPEC-ATK3000:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-101:tg")).toBe("battle");
  });

  it("RK-101: タイガーロイド以外の自軍ユニットがアタックされるときも効く（出典: atwiki/page-641・カード評価「他のユニットがアタックされる際にも効果がある」）", () => {
    const s = attacked({ battle: [inst("RK-101", "tg"), inst("SPEC-NON", "n")] }, "SPEC-NON:n", "SPEC-ATK5000:a");
    expect(lastBattleBps(s)).toEqual({ attacker: 2000, defender: 2000 });
  });

  it("RK-101: 特徴「忍者」を持つユニットは BP が下がらない（出典: atwiki/page-641「特徴「忍者」を持たないユニットは」）", () => {
    const s = attacked({ battle: [inst("RK-101", "tg")] }, "RK-101:tg", "SPEC-NINJA:a");
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 500 });
  });

  it("RK-101: 2体あっても BP-3000 だけ（重複しない）（出典: atwiki/page-641「この効果は重複しない」）", () => {
    const s = attacked({ battle: [inst("RK-101", "tg"), inst("RK-101", "tg2")] }, "RK-101:tg", "SPEC-ATK5000:a");
    expect(lastBattleBps(s)).toEqual({ attacker: 2000, defender: 500 });
  });

  it("RK-101: 自軍ラッシュエリアにあるときは効かない（出典: atwiki/page-641「これが自軍バトルエリアにある間」）", () => {
    const s = attacked({ battle: [inst("SPEC-NON", "n")], rush: [inst("RK-101", "tg")] }, "SPEC-NON:n", "SPEC-ATK5000:a");
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 2000 });
  });

  it("RK-101: 自軍ターンに自軍ユニットがアタックするときは効かない（出典: atwiki/page-641「敵軍ターン中、敵軍バトルエリアの」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-101", "tg"), inst("SPEC-ATK5000", "own")] }, { battle: [inst("SPEC-NON", "e")] }), "SPEC-ATK5000:own", "SPEC-NON:e"));
    expect(lastBattleBps(s)).toEqual({ attacker: 5000, defender: 2000 });
  });
});

// ===========================================================================
describe("RK-102 仮面ライダークウガDF", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【スプラッシュドラゴン】敵軍常駐置き場のカード枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主の手札に戻してもよい（敵軍常駐置き場にカードが1枚も無ければ0と数える）。";

  it("RK-102: カタログ本文・スペックが出典と一致（出典: atwiki/page-688）", () => {
    expectCatalogText("RK-102", TEXT);
    expectStats("RK-102", { name: "仮面ライダークウガDF", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("RK-102", ["NR"]);
  });

  it("RK-102: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-688「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-102", "df")] }, "RK-102:df"))).toBe(true);
  });

  const splash = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-102", "df"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-102:df", "SPEC-VEHICLE:v");
  const enemy = { battle: [inst("SPEC-E0", "c0"), inst("SPEC-E2M", "m"), inst("SPEC-E3", "c3")], rush: [inst("SPEC-E1", "c1"), inst("SPEC-E2", "c2")] };

  it("RK-102: RC — 敵軍常駐置き場のカード枚数（常駐に重ねたカードも数える）以下の必要パワーの敵軍ユニットを、エリア・サイズを問わず選べる（任意）（出典: atwiki/page-688「敵軍常駐置き場のカード枚数以下の必要パワーの数字を持つ敵軍ユニットを1体選び」・カード評価「常駐置き場に複数枚カードを置くライダーパス」「サイズとエリアを選ばない」）", () => {
    const s = splash({ ...enemy, operation: [resident("RK-022", "rp", [inst("TST-UNIT-0", "s1")])] });
    expectChoiceFrom(s, "player1", "RK-102");
    expect(choiceIds(s)).toEqual(["SPEC-E0:c0", "SPEC-E1:c1", "SPEC-E2:c2", "SPEC-E2M:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-102: RC — 敵軍常駐置き場にカードがなければ 0 と数え、必要パワー0 のユニットだけを選べる（出典: atwiki/page-688「（敵軍常駐置き場にカードが1枚も無ければ0と数える）」）", () => {
    expect(choiceIds(splash(enemy))).toEqual(["SPEC-E0:c0"]);
  });

  it("RK-102: RC — 選んだユニットは持ち主の手札に戻る（出典: atwiki/page-688「持ち主の手札に戻してもよい」）", () => {
    const s = resolveAll(pick(splash({ ...enemy, operation: [resident("RK-022", "rp", [inst("TST-UNIT-0", "s1")])] }), "SPEC-E2M:m"));
    expect(zoneOf(s, "player2", "SPEC-E2M:m")).toBe("hand");
  });
});

// ===========================================================================
describe("RK-103 仮面ライダークウガPF", () => {
  const TEXT =
    "※自分がターンを終えるとき、自軍常駐置き場に配置されている「超変身」の上に、このユニットを重ねて置いてもよい。 【ブラストペガサス】これは、特徴「警察」を持つ自軍ユニットからコンビネーションするときBP+3000され、敵軍ラッシュエリアのユニットにアタックできる。";

  it("RK-103: カタログ本文・スペックが出典と一致（出典: atwiki/page-689）", () => {
    expectCatalogText("RK-103", TEXT);
    expectStats("RK-103", { name: "仮面ライダークウガPF", category: "MA", size: "S", bp: 500, sp: "1/3", powerCost: 2, features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("RK-103", ["NR"]);
  });

  it("RK-103: ※ 自分がターンを終えるとき、自軍常駐置き場に「超変身」があれば、このユニットを重ねて置くかを選べる（任意）（出典: atwiki/page-689「「超変身」の上に、このユニットを重ねて置いてもよい」）", () => {
    const s = toTurnEnd(board({ battle: [inst("RK-103", "pf")], operation: [resident("RK-080", "ch")] }), "RK-103");
    expectChoiceFrom(s, "player1", "RK-103");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-103: ※ 重ねると、このユニットは「超変身」に重なる（場から離れる）（出典: atwiki/page-689）", () => {
    const s = toTurnEnd(confirm(toTurnEnd(board({ battle: [inst("RK-103", "pf")], operation: [resident("RK-080", "ch")] }), "RK-103")));
    expect(stackedOn(s, "player1", "RK-080:ch")).toEqual(["RK-103:pf"]);
    // 重ねたカードは常駐の下にあり、場（バトル・ラッシュ）にも他のゾーンにもない。
    expect(zoneOf(s, "player1", "RK-103:pf")).toBeNull();
  });

  it("RK-103: ※ 重ねなければ場に残る（出典: atwiki/page-689「重ねて置いてもよい」）", () => {
    const s = toTurnEnd(skip(toTurnEnd(board({ battle: [inst("RK-103", "pf")], operation: [resident("RK-080", "ch")] }), "RK-103")));
    expect(stackedOn(s, "player1", "RK-080:ch")).toEqual([]);
    expect(zoneOf(s, "player1", "RK-103:pf")).toBe("battle");
  });

  it("RK-103: ※ 自軍常駐置き場に「超変身」がなければ発動しない（出典: atwiki/page-689「自軍常駐置き場に配置されている「超変身」の上に」）", () => {
    const s = toTurnEnd(board({ battle: [inst("RK-103", "pf")] }), "RK-103");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-103");
  });

  it("RK-103: 【ブラストペガサス】特徴「警察」を持つ自軍ユニットからコンビネーションするとき BP+3000 され、敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-689「特徴「警察」を持つ自軍ユニットからコンビネーションするときBP+3000され、敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = enterKeep(board({ rush: [inst("SPEC-POLICE", "po"), inst("RK-103", "pf")] }, { battle: [inst("SPEC-E1", "b")], rush: [inst("SPEC-E2", "r")] }), ["SPEC-POLICE:po", "RK-103:pf"]);
    expect(bpOf(s, "player1", "RK-103:pf")).toBe(3500);
    expect(attackTargets(s, "RK-103:pf").sort()).toEqual(["SPEC-E1:b", "SPEC-E2:r"]);
  });

  it("RK-103: 【ブラストペガサス】「警察」でないユニットからコンビネーションしたときは BP も変わらず、ラッシュエリアにアタックできない（出典: atwiki/page-689）", () => {
    const s = enterKeep(board({ rush: [inst("SPEC-NON", "n"), inst("RK-103", "pf")] }, { battle: [inst("SPEC-E1", "b")], rush: [inst("SPEC-E2", "r")] }), ["SPEC-NON:n", "RK-103:pf"]);
    expect(bpOf(s, "player1", "RK-103:pf")).toBe(500);
    expect(attackTargets(s, "RK-103:pf")).toEqual(["SPEC-E1:b"]);
  });
});

// ===========================================================================
describe("RK-104 仮面ライダークウガTF", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） ※これは自軍コマンドを2つホールドしなければバトルエリアに出られない。";

  it("RK-104: カタログ本文・スペックが出典と一致（出典: atwiki/page-687）", () => {
    expectCatalogText("RK-104", TEXT);
    expectStats("RK-104", { name: "仮面ライダークウガTF", category: "MA", size: "S", bp: 5000, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "アマダム"] });
    expectRarityIn("RK-104", ["R"]);
  });

  it("RK-104: ※ 自軍コマンドを2つホールドしてバトルエリアに出る（出典: atwiki/page-687「これは自軍コマンドを2つホールドしなければバトルエリアに出られない」）", () => {
    const s = enterWithHold(board({ rush: [inst("RK-104", "tf")], command: releasedCat("WB", 3) }), "RK-104:tf", ["TST-OP:cWB0", "TST-OP:cWB1"]);
    expect(zoneOf(s, "player1", "RK-104:tf")).toBe("battle");
    expect(heldCount(s)).toBe(2);
  });

  it("RK-104: ※ リリース状態の自軍コマンドが1つしかなければバトルエリアに出られない（出典: atwiki/page-687）", () => {
    expect(canEnter(board({ rush: [inst("RK-104", "tf")], command: releasedCat("WB", 1) }), "RK-104:tf")).toBe(false);
  });

  it("RK-104: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-687「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-104", "tf")] }, "RK-104:tf"))).toBe(true);
  });

  it.todo(
    "RK-104: 公式Q&A — グレートタイタン【タイタンノバ】の「カード名に「タイタン」を含む自軍コマンド」に、ルビに「タイタン」を含むこのカードを選べる（出典: atwiki/page-687 Q1）— XG6-010 グレートタイタンは本範囲外のカードで、その効果の照合がまだのため",
  );
});

// ===========================================================================
describe("RK-105 仮面ライダーアギトSF", () => {
  const TEXT =
    "※これはライド中、BP+1000される。 【ハルバードスピン】敵軍ユニットを、必要パワーの数字の合計が3になるまで好きな数選び、持ち主の山札に戻してシャッフルしてもよい。";

  it("RK-105: カタログ本文・スペックが出典と一致（出典: atwiki/page-690）", () => {
    expectCatalogText("RK-105", TEXT);
    expectStats("RK-105", { name: "仮面ライダーアギトSF", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("RK-105", ["NR"]);
  });

  it("RK-105: ※ ライド中は BP+1000 される（ライドしていなければ 2000）（出典: atwiki/page-690「※これはライド中、BP+1000される」）", () => {
    expect(bpOf(board({ battle: [inst("SPEC-VEHICLE", "v"), { ...inst("RK-105", "sf"), mountedOnInstanceId: "SPEC-VEHICLE:v" }] }), "player1", "RK-105:sf")).toBe(3000);
    expect(bpOf(board({ battle: [inst("RK-105", "sf")] }), "player1", "RK-105:sf")).toBe(2000);
  });

  const spin = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-105", "sf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-105:sf", "SPEC-VEHICLE:v");
  const enemy = { battle: [inst("SPEC-E2", "c2"), inst("SPEC-E2M", "m"), inst("SPEC-E0", "c0")], rush: [inst("SPEC-E1", "c1"), inst("SPEC-E3", "c3"), inst("TST-UNIT-0", "z")] };

  it("RK-105: RC — 必要パワーの数字が3以下の敵軍ユニットを、エリア・サイズを問わず選べる（任意）（出典: atwiki/page-690「敵軍ユニットを、必要パワーの数字の合計が3になるまで好きな数選び」・カード評価「ラッシュエリアにも効果が届く」）", () => {
    const s = spin({ ...enemy, rush: [...enemy.rush, inst("SPEC-E5", "c5")] });
    expectChoiceFrom(s, "player1", "RK-105");
    expect(choiceIds(s)).toEqual(["SPEC-E0:c0", "SPEC-E1:c1", "SPEC-E2:c2", "SPEC-E2M:m", "SPEC-E3:c3", "TST-UNIT-0:z"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-105: RC — 選んだ数字の合計が3を超えるユニットは続けて選べない（必要パワー2 を選ぶと、残りは1以下だけ）（出典: atwiki/page-690「必要パワーの数字の合計が3になるまで」）", () => {
    const s = pick(spin(enemy), "SPEC-E2:c2");
    expect(choiceIds(s)).toEqual(["SPEC-E0:c0", "SPEC-E1:c1", "TST-UNIT-0:z"]);
  });

  it("RK-105: RC — 選んだユニットは持ち主の山札に戻ってシャッフルされる。必要パワー0 のユニットはいくつでも選べる（出典: atwiki/page-690「持ち主の山札に戻してシャッフルしてもよい」・カード評価「必要パワー0のユニットは何枚選んでも0なので好きなだけ選べる」）", () => {
    let s = pick(pick(pick(spin(enemy), "SPEC-E3:c3"), "SPEC-E0:c0"), "TST-UNIT-0:z");
    s = resolveAll(s.pendingEffectChoice ? confirm(s) : s);
    expect(zoneOf(s, "player2", "SPEC-E3:c3")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E0:c0")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:z")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E1:c1")).toBe("rush");
  });

  // 公式 Q「はい、できます。」
  it("RK-105: 公式Q&A — 選んだユニットの必要パワーの合計が3に足りなくても、選び終えて山札に戻せる（出典: grnrngr/faq-rider-2 RK-105 Q）", () => {
    const s = resolveAll(confirm(pick(spin(enemy), "SPEC-E1:c1")));
    expect(zoneOf(s, "player2", "SPEC-E1:c1")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E2:c2")).toBe("battle");
  });

  it("RK-105: RC — 選ばなければ何も戻さない（出典: atwiki/page-690「戻してシャッフルしてもよい」）", () => {
    const s = settle(skip(spin(enemy)));
    expect(s.players.player2.deck).toHaveLength(5);
  });
});

// 未使用の import を避けるための参照。
void act;
void mount;
void rideOff;
