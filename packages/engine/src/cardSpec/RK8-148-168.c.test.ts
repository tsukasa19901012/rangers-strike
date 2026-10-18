/**
 * カード別スペック: RK-162〜RK-168（ザ・マスクドライダーEXP vol.2 仮面ライダーアギトGF〜仮面ライダー電王CF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RK166 のカテゴリ訂正・R-ERR-RK168 の解釈の指定）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-166・RK-168・SK-002 欄の RK-164 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-KW-RC-01、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-166 公式Q&A Q1（ライド中にレジストでホールドされてもライドしたまま）— rulesSpec/07-resist.test.ts R-KW-RESIST-04
 *  - RK-166 公式Q&A Q2（カテゴリはアーステクノロジーのみ）— rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK166
 *  - RK-166 公式Q&A Q4（コマンドゾーンから戻るとリリース状態）— rulesSpec/02-zones.test.ts R-ZONE-04・cardSpec/RK1-001-021.b.test.ts RK-008
 *  - RK-168【てんこもりだぜ！】とキンタロス（Q1・Q2）— rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK168
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  fill,
  heldUnit,
  inst,
  mount,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOff,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RK8-148-168.helpers";

const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 5000, size: "M", powerCost: 3 });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000 });
const B1500 = sUnit("SPEC-B1500", { bp: 1500 });
const B2000 = sUnit("SPEC-B2000", { bp: 2000 });
const B2500M = sUnit("SPEC-B2500M", { bp: 2500, size: "M", powerCost: 3 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, sp: undefined });
const EM = sUnit("SPEC-EM", { bp: 5000, size: "M", powerCost: 3 });
const EXTRA = [PLAIN_VEHICLE, DA_S, DA_M, WB_S, B1500, B2000, B2500M, E3000, EM];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-162 仮面ライダーアギトGF", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ライダーキック】敵軍バトルエリアから、カテゴリにDAを持つ敵軍Sユニットを1体選び撃破する。";

  it("RK-162: カタログ本文・スペックが出典と一致（出典: atwiki/page-692）", () => {
    expectCatalogText("RK-162", TEXT);
    expectStats("RK-162", { name: "仮面ライダーアギトGF", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("RK-162", ["SR"]);
  });

  it("RK-162: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-692「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-162", "gf")] }, "RK-162:gf"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-DA-S", "ds"), inst("SPEC-WB-S", "ws"), inst("SPEC-DA-M", "dm")], rush: [inst("SPEC-DA-S", "rs")] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-162", "gf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-162:gf", "SPEC-VEHICLE:v");

  it("RK-162: RC — 敵軍バトルエリアの、カテゴリに DA を持つ S ユニットだけから1体選ぶ（ラッシュエリア・DA でない・M は対象外。選ばないことはできない）（出典: atwiki/page-692「敵軍バトルエリアから、カテゴリにDAを持つ敵軍Sユニットを1体選び撃破する」・カード評価「ラッシュエリアのDAのユニットも対象に取れるようになったディケイド アギトGF」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-162");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:ds"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-162: RC — 選んだユニットを撃破する（出典: atwiki/page-692「撃破する」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-DA-S:ds"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:ds")).toBe("discard");
  });

  it("RK-162: RC — 敵軍バトルエリアに DA の S ユニットがいなければ何も起きない（出典: atwiki/page-692）", () => {
    const s = settle(rc({ battle: [inst("SPEC-WB-S", "ws")], rush: [inst("SPEC-DA-S", "rs")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-162");
    expect(zoneOf(s, "player2", "SPEC-DA-S:rs")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-163 オルタナティブ・ゼロ", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【無意識の記憶力】敵軍捨札からユニットカードを1枚選んでもよい。そうしたとき、選んだカードと同じカード名の敵軍ユニットを1体選び、撃破する。";

  it("RK-163: カタログ本文・スペックが出典と一致（出典: atwiki/page-650）", () => {
    expectCatalogText("RK-163", TEXT);
    expectStats("RK-163", { name: "オルタナティブ・ゼロ", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 5, comboNumber: "RC", features: ["男", "ミラーライダー", "加速"] });
    expectRarityIn("RK-163", ["SR"]);
  });

  it("RK-163: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-650「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-163", "az")] }, "RK-163:az"))).toBe(true);
  });

  it("RK-163: ※ ライドオフしたときはストライクできない（出典: atwiki/page-650「※これはライドオフしたときストライクできない」）", () => {
    const s = settle(rcRideOff(board({ battle: fill(1), rush: [inst("RK-163", "az"), inst("SPEC-VEHICLE", "v")] }), "RK-163:az", "SPEC-VEHICLE:v"));
    expect(canStrike(s, "RK-163:az")).toBe(false);
  });

  const enemy = {
    battle: [inst("SPEC-EM", "m1"), inst("SPEC-B2000", "b1")],
    rush: [inst("SPEC-B2000", "b2")],
    discard: [inst("SPEC-EM", "dm"), inst("SPEC-B2000", "db"), inst("TST-OP", "dop"), inst("SPEC-B1500", "dx")],
  };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-163", "az"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-163:az", "SPEC-VEHICLE:v");

  it("RK-163: RC — 敵軍捨札のユニットカードから1枚選べる（オペレーションは対象外。任意）（出典: atwiki/page-650「敵軍捨札からユニットカードを1枚選んでもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-163");
    expect(choiceIds(s)).toEqual(["SPEC-B1500:dx", "SPEC-B2000:db", "SPEC-EM:dm"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-163: RC — 選んだカードと同じカード名の敵軍ユニット（エリア・サイズを問わない）から1体選ぶ（選ばないことはできない）（出典: atwiki/page-650「選んだカードと同じカード名の敵軍ユニットを1体選び、撃破する」・カード評価「サイズ、エリア問わず撃破」）", () => {
    const s = pick(rc(), "SPEC-B2000:db");
    expectChoiceFrom(s, "player1", "RK-163");
    expect(choiceIds(s)).toEqual(["SPEC-B2000:b1", "SPEC-B2000:b2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-163: RC — 選んだ敵軍ユニットを撃破する（M ユニットでも）（出典: atwiki/page-650「撃破する」）", () => {
    let s = pick(rc(), "SPEC-EM:dm");
    if (s.pendingEffectChoice?.sourceCardId === "RK-163") s = pick(s, "SPEC-EM:m1");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-EM:m1")).toBe("discard");
  });

  it("RK-163: RC — 同じカード名の敵軍ユニットがいなければ何も撃破しない（出典: atwiki/page-650「同じカード名の敵軍ユニット」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-B1500:dx"));
    expect(zoneOf(s, "player2", "SPEC-B2000:b1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM:m1")).toBe("battle");
  });

  it("RK-163: RC — 選ばなければ何も起きない（出典: atwiki/page-650「選んでもよい」）", () => {
    const s = resolveAll(skip(rc()));
    expect(zoneOf(s, "player2", "SPEC-B2000:b1")).toBe("battle");
  });

  // atwiki/page-650 Q1「はい、撃破されます。また、…の場合でも同様です。」
  it("RK-163: Q&A — 敵軍捨札の XG1-068 ディケイド クウガMF（「仮面ライダークウガMF」として使える）を選ぶと、敵軍ラッシュエリアの RK-029 仮面ライダークウガMF を撃破できる（出典: atwiki/page-650 Q1）", () => {
    let s = pick(rc({ rush: [inst("RK-029", "k")], discard: [inst("XG1-068", "d")] }), "XG1-068:d");
    expect(choiceIds(s)).toEqual(["RK-029:k"]);
    s = resolveAll(pick(s, "RK-029:k"));
    expect(zoneOf(s, "player2", "RK-029:k")).toBe("discard");
  });

  it("RK-163: Q&A — 逆に、敵軍捨札の RK-029 を選んで、敵軍ラッシュエリアの XG1-068 を撃破できる（出典: atwiki/page-650 Q1「…の場合でも同様です」）", () => {
    let s = pick(rc({ rush: [inst("XG1-068", "k")], discard: [inst("RK-029", "d")] }), "RK-029:d");
    expect(choiceIds(s)).toEqual(["XG1-068:k"]);
    s = resolveAll(pick(s, "XG1-068:k"));
    expect(zoneOf(s, "player2", "XG1-068:k")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-164 仮面ライダー1号（THE FIRST）", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ライダーパンチ】このターン、これはBP+2000される。さらに、このユニットがホールド状態なら、このターン、これは「SP1」になる。";

  it("RK-164: カタログ本文・スペックが出典と一致（出典: atwiki/page-663）", () => {
    expectCatalogText("RK-164", TEXT);
    expectStats("RK-164", { name: "仮面ライダー1号（THE FIRST）", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-164", ["SR"]);
  });

  it("RK-164: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-663「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-164", "n1")] }, "RK-164:n1"))).toBe(true);
  });

  /** 2番目に、1号をビークルにライドさせて出しライドオフする（RC 発動）。 */
  const rc = (held: boolean) =>
    settle(rcRideOff(board({ battle: fill(1), rush: [held ? heldUnit("RK-164", "n1") : inst("RK-164", "n1"), inst("SPEC-VEHICLE", "v")] }), "RK-164:n1", "SPEC-VEHICLE:v"));

  it("RK-164: RC — このターン BP+2000（BP5000）（出典: atwiki/page-663「このターン、これはBP+2000される」）", () => {
    expect(bpOf(rc(false), "player1", "RK-164:n1")).toBe(5000);
  });

  it("RK-164: RC — リリース状態なら SP は変わらない（SP1/5 の2番目はストライクできない）（出典: atwiki/page-663「このユニットがホールド状態なら」）", () => {
    const s = rc(false);
    expect(spOf(s, "player1", "RK-164:n1")).toBe(0);
    expect(canStrike(s, "RK-164:n1")).toBe(false);
  });

  it("RK-164: RC — ホールド状態なら、このターン「SP1」になる（2番目でもストライクで1点）（出典: atwiki/page-663「さらに、このユニットがホールド状態なら、このターン、これは「SP1」になる」・カード評価「仮面ライダーカイザやウエイクアップ！のホールドを利用したい」）", () => {
    const s = rc(true);
    expect(bpOf(s, "player1", "RK-164:n1")).toBe(5000);
    expect(spOf(s, "player1", "RK-164:n1")).toBe(1);
  });

  it("RK-164: ライドせずに出たときは RC が発動しない（BP3000 のまま）（出典: atwiki/page-663「CN：RC」・R-KW-RC-01）", () => {
    const s = settle(enter(board({ rush: [inst("RK-164", "n1")] }), "RK-164:n1"));
    expect(bpOf(s, "player1", "RK-164:n1")).toBe(3000);
  });

  it.todo(
    "RK-164: 公式Q&A（相互参照）— SK-002 仮面ライダーV3【ダブルタイフーン】では「RK-164 仮面ライダー1号（THE FIRST）」をホールドして RC を発動できない（括弧書きもカード名に含む）（出典: grnrngr/faq-rider-2 SK-002 Q2）— SK-002 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-165 仮面ライダー電王WF", () => {
  const TEXT =
    "【恩返し】敵軍ターン中、これが撃破されて捨札になったとき次の効果を発動できる⇒自軍パワーゾーンからダメージになっているカードを1枚選び、オモテにする。このとき、オモテにしたカードが「ジーク」なら、そのカードを捨札にしてこの効果をもう一度発動できる。";

  it("RK-165: カタログ本文・スペックが出典と一致（出典: atwiki/page-681）", () => {
    expectCatalogText("RK-165", TEXT);
    expectStats("RK-165", { name: "仮面ライダー電王WF", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-165", ["SR"]);
  });

  const power = [faceDown("TST-UNIT-0", "d1"), faceDown("RK-154", "zk"), faceDown("RK-154", "zk2"), faceUp("TST-P", "up")];
  const destroyed = (p = power) => attackedInEnemyTurn({ battle: [inst("RK-165", "wf")], power: p }, "RK-165:wf");

  it("RK-165: 敵軍ターン中に撃破されて捨札になったとき、自軍パワーゾーンのダメージ（ウラ向き）のカードから1枚選べる（任意）（出典: atwiki/page-681「自軍パワーゾーンからダメージになっているカードを1枚選び、オモテにする」「発動できる」）", () => {
    const s = destroyed();
    expect(zoneOf(s, "player1", "RK-165:wf")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-165");
    expect(choiceIds(s)).toEqual(["RK-154:zk", "RK-154:zk2", "TST-UNIT-0:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-165: 選んだカードはオモテになる（パワーゾーンに残る。ジークでなければ1回で終わる）（出典: atwiki/page-681「オモテにする」）", () => {
    const s = settle(pick(destroyed(), "TST-UNIT-0:d1"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d1")).toBe("power");
    expect(cardIn(s, "player1", "TST-UNIT-0:d1")?.faceDown ?? false).toBe(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-165");
    expect(cardIn(s, "player1", "RK-154:zk")?.faceDown).toBe(true);
  });

  it("RK-165: オモテにしたカードが「ジーク」なら、それを捨札にして、もう一度ダメージを1枚選べる（出典: atwiki/page-681「オモテにしたカードが「ジーク」なら、そのカードを捨札にしてこの効果をもう一度発動できる」）", () => {
    const s = pick(destroyed(), "RK-154:zk");
    expect(zoneOf(s, "player1", "RK-154:zk")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-165");
    expect(choiceIds(s)).toEqual(["RK-154:zk2", "TST-UNIT-0:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-165: 2回目もジークなら続けて発動でき、最大で（ジーク2枚＋1枚）3枚オモテにできる（出典: atwiki/page-681・カード評価「1回に最大で4点回復することができる」）", () => {
    let s = pick(pick(destroyed(), "RK-154:zk"), "RK-154:zk2");
    expect(zoneOf(s, "player1", "RK-154:zk2")).toBe("discard");
    s = settle(pick(s, "TST-UNIT-0:d1"));
    expect(cardIn(s, "player1", "TST-UNIT-0:d1")?.faceDown ?? false).toBe(false);
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(0);
  });

  it("RK-165: 発動しなければダメージはそのまま（出典: atwiki/page-681「発動できる」）", () => {
    const s = settle(skip(destroyed()));
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(3);
  });

  it("RK-165: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-681「敵軍ターン中、」）", () => {
    let s = board({ battle: [inst("RK-165", "wf")], power }, { battle: [inst("TST-UNIT-7", "big")] });
    s = settle(attack(s, "RK-165:wf", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-165:wf")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-165");
  });

  it("RK-165: ダメージがなければ選択は開かない（出典: atwiki/page-681「ダメージになっているカードを1枚選び」）", () => {
    const s = destroyed([faceUp("TST-P", "up")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-165");
  });
});

// ===========================================================================
describe("RK-166 仮面ライダーG3", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) ※これはホールド状態のときビークルにライドできない。 【GM-01】ホールド状態の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く（置けなければこの効果は発動できない)。";

  it("RK-166: カタログ本文・スペックが出典と一致（出典: atwiki/page-636）", () => {
    expectCatalogText("RK-166", TEXT);
    expectStats("RK-166", { name: "仮面ライダーG3", category: "ET", size: "S", bp: 1000, sp: "1/5", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "メカ", "男", "警察"] });
    expectRarityIn("RK-166", ["R"]);
  });

  it("RK-166: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-636「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-166", "g3")] }, "RK-166:g3"))).toBe(true);
  });

  it("RK-166: ※ ホールド状態のときはビークルにライドできない（リリース状態ならライドできる）（出典: atwiki/page-636「※これはホールド状態のときビークルにライドできない」）", () => {
    expect(canMount(board({ rush: [heldUnit("RK-166", "g3"), inst("SPEC-VEHICLE", "v")] }), "RK-166:g3", "SPEC-VEHICLE:v")).toBe(false);
    expect(canMount(board({ rush: [inst("RK-166", "g3"), inst("SPEC-VEHICLE", "v")] }), "RK-166:g3", "SPEC-VEHICLE:v")).toBe(true);
  });

  const enemy = { battle: [heldUnit("SPEC-WB-S", "hb"), inst("SPEC-WB-S", "rb"), heldUnit("SPEC-EM", "hm")], rush: [heldUnit("SPEC-DA-S", "hr")], command: [] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-166", "g3"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-166:g3", "SPEC-VEHICLE:v");

  it("RK-166: RC — ホールド状態の敵軍 S ユニット（エリアを問わない）だけから1体選ぶ（リリース状態・M は対象外。選ばないことはできない）（出典: atwiki/page-636「ホールド状態の敵軍Sユニットを1体選び」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-166");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:hr", "SPEC-WB-S:hb"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-166: RC — 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-636「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-DA-S:hr"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:hr")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-DA-S:hr")?.commandHeld).toBe(true);
  });

  it("RK-166: RC — 敵軍コマンドゾーンに置けない（5枚ある）ときは発動しない（出典: atwiki/page-636「置けなければこの効果は発動できない」）", () => {
    const s = settle(rc({ ...enemy, command: releasedCat("WB", 5, "ec") }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-166");
    expect(zoneOf(s, "player2", "SPEC-WB-S:hb")).toBe("battle");
  });

  // faq-rider-2 RK-166 Q3「はい、できます。」
  it("RK-166: 公式Q&A — ホールド状態の敵軍 S ユニットがいなくても、ライドオフできる（出典: grnrngr/faq-rider-2 RK-166 Q3）", () => {
    let s = board({ rush: [inst("RK-166", "g3"), inst("SPEC-VEHICLE", "v")] }, { battle: [inst("SPEC-WB-S", "rb")] });
    s = settle(rideOff(mount(s, "RK-166:g3", "SPEC-VEHICLE:v"), true));
    expect(zoneOf(s, "player1", "RK-166:g3")).toBe("battle");
    expect(cardIn(s, "player1", "RK-166:g3")?.mountedOnInstanceId).toBeUndefined();
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-166");
  });
});

// ===========================================================================
describe("RK-167 仮面ライダーカイザ", () => {
  const TEXT =
    "※これは、これ以外の自軍Sユニットを１体ホールドしなければバトルエリアに出られない。 【カイザブレイガン】BPの下三桁が500の敵軍Sユニットを1体選び撃破する。（この効果は「サイドバッシャーBM」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RK-167: カタログ本文・スペックが出典と一致（出典: atwiki/page-664）", () => {
    expectCatalogText("RK-167", TEXT);
    expectStats("RK-167", { name: "仮面ライダーカイザ", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-167", ["R"]);
  });

  it("RK-167: ※ ほかに自軍 S ユニットがなければバトルエリアに出られない（ライドしても出られない）（出典: atwiki/page-664「これ以外の自軍Sユニットを１体ホールドしなければバトルエリアに出られない」）", () => {
    const s = board({ rush: [inst("RK-167", "kz"), inst("SPEC-VEHICLE", "v"), inst("SPEC-EM", "m")] });
    expect(canEnter(s, "RK-167:kz")).toBe(false);
    expect(canMount(s, "RK-167:kz", "SPEC-VEHICLE:v")).toBe(false);
  });

  it("RK-167: ※ 出るときは、これ以外のリリース状態の自軍 S ユニット（エリアを問わない）から1体選んでホールドする（ホールド状態のものは選べない。選ばないことはできない）（出典: atwiki/page-664・コメント欄「ホールドするのはユニット」）", () => {
    let s = board({ battle: [inst("TST-UNIT-0", "b")], rush: [inst("RK-167", "kz"), inst("TST-UNIT-0", "r"), heldUnit("TST-UNIT-0", "h"), inst("SPEC-EM", "m")] });
    s = enter(s, "RK-167:kz");
    expectChoiceFrom(s, "player1", "RK-167");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:b", "TST-UNIT-0:r"]);
    expect(canSkip(s)).toBe(false);
    s = settle(pick(s, "TST-UNIT-0:r"));
    expect(zoneOf(s, "player1", "RK-167:kz")).toBe("battle");
    expect(cardIn(s, "player1", "TST-UNIT-0:r")?.commandHeld).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-B1500", "b15"), inst("SPEC-B2000", "b20"), inst("SPEC-B2500M", "m25")], rush: [inst("SPEC-B1500", "r15")] };
  /** カイザをビークルにライドさせて出し（ホールドするユニットを選び）、ライドオフする。 */
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) => {
    let s = mount(board({ rush: [inst("RK-167", "kz"), inst("SPEC-VEHICLE", "v"), inst("TST-UNIT-0", "o")] }, p2), "RK-167:kz", "SPEC-VEHICLE:v");
    if (s.pendingEffectChoice?.sourceCardId === "RK-167" && s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:o")) s = pick(s, "TST-UNIT-0:o");
    return rideOff(s, true);
  };

  it("RK-167: RC — BP の下三桁が500の敵軍 S ユニット（エリアを問わない）だけから1体選ぶ（M は対象外。選ばないことはできない）（出典: atwiki/page-664「BPの下三桁が500の敵軍Sユニットを1体選び撃破する」・カード評価「ラッシュエリアにも効果が届く」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-167");
    expect(choiceIds(s)).toEqual(["SPEC-B1500:b15", "SPEC-B1500:r15"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-167: RC — 選んだユニットを撃破する（出典: atwiki/page-664「撃破する」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-B1500:r15"));
    expect(zoneOf(s, "player2", "SPEC-B1500:r15")).toBe("discard");
  });

  it("RK-167: サイドバッシャーBM の次にライドせずに出たときも【カイザブレイガン】を発動する（出典: atwiki/page-664「「サイドバッシャーBM」からコンビネーションするときはナンバーに関係なく発動する」）", () => {
    let s = board({ battle: [inst("RK-121", "bm")], rush: [inst("RK-167", "kz"), inst("TST-UNIT-0", "o")] }, enemy);
    s = enter(s, "RK-167:kz");
    if (s.pendingEffectChoice?.sourceCardId === "RK-167" && s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:o")) s = pick(s, "TST-UNIT-0:o");
    expectChoiceFrom(s, "player1", "RK-167");
    expect(choiceIds(s)).toEqual(["SPEC-B1500:b15", "SPEC-B1500:r15"]);
  });

  it("RK-167: サイドバッシャーBM の次でなく、ライドもせずに出たときは発動しない（出典: atwiki/page-664・R-KW-RC-01）", () => {
    let s = board({ rush: [inst("RK-167", "kz"), inst("TST-UNIT-0", "o")] }, enemy);
    s = enter(s, "RK-167:kz");
    if (s.pendingEffectChoice?.sourceCardId === "RK-167" && s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-0:o")) s = pick(s, "TST-UNIT-0:o");
    s = settle(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-167");
    expect(zoneOf(s, "player2", "SPEC-B1500:b15")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-168 仮面ライダー電王CF", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【てんこもりだぜ！】自軍ターン中、これがバトルエリアに出たとき、パワーゾーンでオモテ向きになっている「モモタロス」「ウラタロス」「キンタロス」「リュウタロス」のカードを捨札にしたときに発動する効果は、捨札にせずに発動できる。";

  it("RK-168: カタログ本文・スペックが出典と一致（出典: atwiki/page-682）", () => {
    expectCatalogText("RK-168", TEXT);
    expectStats("RK-168", { name: "仮面ライダー電王CF", category: "OT", size: "S", bp: 5000, sp: "1/4", powerCost: "4+", comboNumber: undefined, features: ["仮面ライダー", "男", "DEN-O"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-168", ["R"]);
  });

  it("RK-168: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-682「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-168", "cf")] }, "RK-168:cf"))).toBe(true);
  });

  it("RK-168: 追加条件 — 自軍「仮面ライダー電王PF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-682「追加条件：自軍「仮面ライダー電王PF」1体をパワーゾーンに送る」）", () => {
    const s = rushPhase({ hand: [inst("RK-168", "cf")], rush: [inst("RK-152", "pf")], command: releasedCat("OT", 1), power: powerCards(4) });
    const r = rushFromHand(s, "player1", "RK-168:cf", { materials: ["RK-152:pf"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-168:cf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-152:pf")).toBe("power");
  });

  it("RK-168: 追加条件 — 電王PF 以外の S ユニットはパワーゾーンに送れない（電王PF がいなければラッシュできない）（出典: atwiki/page-682「自軍「仮面ライダー電王PF」1体」）", () => {
    const s = rushPhase({ hand: [inst("RK-168", "cf")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("OT", 1), power: powerCards(4) });
    expect(canStartRush(s, "player1", "RK-168:cf")).toBe(false);
  });

  it("RK-168: 【てんこもりだぜ！】モモタロスの効果を捨札にせずに発動でき、電王CF は「SP1」になる（モモタロスはパワーゾーンに残る）（出典: atwiki/page-682・カード評価「モモタロスの効果を使ってストライクしたり」・grnrngr/faq-rider-2 RK-168 Q2「1枚につき1度ずつ、捨札にせずに発動できる」）", () => {
    let s = enter(board({ battle: fill(1), rush: [inst("RK-168", "cf")], power: [faceUp("RK-142", "mo")] }, { battle: [inst("SPEC-E3000", "e")] }), "RK-168:cf");
    for (let i = 0; i < 4 && s.pendingEffectChoice; i++) s = s.pendingEffectChoice.validInstanceIds.includes("RK-142:mo") ? pick(s, "RK-142:mo") : settle(s);
    s = settle(s);
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("power");
    expect(spOf(s, "player1", "RK-168:cf")).toBe(1);
  });
});

