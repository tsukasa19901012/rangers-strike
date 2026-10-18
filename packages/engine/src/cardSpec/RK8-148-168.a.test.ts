/**
 * カード別スペック: RK-148〜RK-154（ザ・マスクドライダーEXP vol.2 デンライナーレッコウ〜ジーク）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-150・RK-154 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-TGT-01、R-BP-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-150 公式Q&A（「ラッシュしたとき」がモーフより先）の一般則 — rulesSpec/07-morph.test.ts R-KW-MORPH-01（本範囲では RK-150 そのもので確かめる）
 *  - RK-154 公式Q&A（ゴーマ16世・サイクロン号と重なってもジークの「BP500」が優先）— rulesSpec/05-bp-strike-damage.test.ts R-BP-01
 *  - RK-154・RK-157 ※「バトルエリアに出たとき撃破される」— rules/imaginDestroyOnEnter.test.ts
 *  - faq-rider-2 RK-140 欄の「RK-152 仮面ライダー電王PF」の【一本釣り】は RK-061 電王RF の誤記（電王PF に【一本釣り】はない）— cardSpec/RK7-127-147.b.test.ts RK-140 で照合済み
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  KW_MORPH,
  PLAIN_VEHICLE,
  attack,
  bpOf,
  canConfirm,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  endTurnKeep,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  fill,
  inst,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  registerOffered,
  attackUntilRegister,
  releasedCat,
  resolveAll,
  returnAll,
  riding,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RK8-148-168.helpers";

const EM_MECHA = sUnit("SPEC-EM-MECHA", { bp: 5000, powerCost: 3, size: "M", features: ["メカ"] });
const EM_PLAIN = sUnit("SPEC-EM-PLAIN", { bp: 5000, powerCost: 3, size: "M", features: ["男"] });
const EM_DA = sUnit("SPEC-EM-DA", { category: "DA", bp: 5000, powerCost: 3, size: "M", features: ["男"] });
const EL = sUnit("SPEC-EL", { bp: 8000, powerCost: "7+" as never, size: "L" });
const ES = sUnit("SPEC-ES", { bp: 1000, powerCost: 1 });
const B3000 = sUnit("SPEC-B3000", { bp: 3000, powerCost: 3 });
const B3500 = sUnit("SPEC-B3500", { bp: 3500, powerCost: 3 });
const B2000M = sUnit("SPEC-B2000M", { bp: 2000, powerCost: 3, size: "M" });
const B4000 = sUnit("SPEC-B4000", { bp: 4000, powerCost: 4 });
const B500 = sUnit("SPEC-B500", { bp: 500, sp: undefined });
const VEHICLE_UNIT = sUnit("SPEC-VEH-UNIT", { bp: 3000, powerCost: 3, features: ["車両"] });
const IMAGIN = sUnit("SPEC-IMAGIN", { category: "OT", bp: 1000, features: ["イマジン"] });
const MORPH = sUnit("SPEC-MORPH", { bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const MORPH_TARGET = sUnit("SPEC-MORPH-T", { bp: 6000, powerCost: 5, features: ["仮面ライダー", "男"] });
const EXTRA = [PLAIN_VEHICLE, EM_MECHA, EM_PLAIN, EM_DA, EL, ES, B3000, B3500, B2000M, B4000, B500, VEHICLE_UNIT, IMAGIN, MORPH, MORPH_TARGET];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-148 デンライナーレッコウ", () => {
  const TEXT =
    "【フロントアックス】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからMユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、戻したユニットが特徴「メカ」を持っていなければ、持ち主のパワーゾーンへ送る。";

  it("RK-148: カタログ本文・スペックが出典と一致（出典: atwiki/page-674）", () => {
    expectCatalogText("RK-148", TEXT);
    expectStats("RK-148", { name: "デンライナーレッコウ", category: "OT", size: "M", bp: 5000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-148", ["N"]);
  });

  const enemy = { battle: [inst("SPEC-EM-MECHA", "mm"), inst("SPEC-EM-PLAIN", "mp"), inst("SPEC-ES", "s"), inst("SPEC-EL", "l")], rush: [inst("SPEC-EM-PLAIN", "rm")] };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => enter(board({ rush: [inst("RK-148", "rk")] }, p2), "RK-148:rk");

  it.fails("RK-148: 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの M ユニットだけから1体選べる（S・L・ラッシュエリアは対象外。任意）（出典: atwiki/page-674「敵軍バトルエリアからMユニットを1体選び、…戻してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-148");
    expect(choiceIds(s)).toEqual(["SPEC-EM-MECHA:mm", "SPEC-EM-PLAIN:mp"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-148: 特徴「メカ」を持つ M ユニットは敵軍ラッシュエリアに戻る（パワーゾーンには送らない）（出典: atwiki/page-674「敵軍ラッシュエリアに戻してもよい。そうしたとき、戻したユニットが特徴「メカ」を持っていなければ」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-EM-MECHA:mm"));
    expect(zoneOf(s, "player2", "SPEC-EM-MECHA:mm")).toBe("rush");
  });

  it.fails("RK-148: 特徴「メカ」を持たない M ユニットは、戻したうえで持ち主のパワーゾーンへ送られる（出典: atwiki/page-674「持ち主のパワーゾーンへ送る」・カード評価「特徴にメカを持たないWBのMユニットに対して効果がある」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-EM-PLAIN:mp"));
    expect(zoneOf(s, "player2", "SPEC-EM-PLAIN:mp")).toBe("power");
  });

  it.fails("RK-148: 戻さなければ何も起きない（出典: atwiki/page-674「戻してもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player2", "SPEC-EM-MECHA:mm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM-PLAIN:mp")).toBe("battle");
  });

  it("RK-148: 敵軍バトルエリアに M ユニットがいなければ選択は開かない（出典: atwiki/page-674）", () => {
    const s = entered({ battle: [inst("SPEC-ES", "s")], rush: [inst("SPEC-EM-PLAIN", "rm")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-148");
  });

  it("RK-148: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-674「自軍ターン中、」）", () => {
    // 敵軍（player2）が RK-139【俺はかーなーり強い】を発動し、player1 がラッシュエリアのレッコウを選んでバトルエリアに出す。
    let s = enemyTurn({ rush: [inst("RK-148", "rk")] }, { battle: [inst("SPEC-EM-PLAIN", "mp")], rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] });
    s = rcRideOff(s, "RK-139:af", "SPEC-VEHICLE:v", "player2");
    s = pick(s, "RK-148:rk");
    expect(zoneOf(s, "player1", "RK-148:rk")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-148");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-EM-PLAIN:mp")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-149 デンライナーイカヅチ", () => {
  const TEXT =
    "【巨龍形態】これが自軍バトルエリアにある間、このユニットから「デンライナーゴウカ、デンライナーイスルギ、デンライナーレッコウ」の順にコンビネーションしたとき、本来のBPが3000以下の敵軍ユニットをすべて撃破する。";

  it("RK-149: カタログ本文・スペックが出典と一致（出典: atwiki/page-675）", () => {
    expectCatalogText("RK-149", TEXT);
    expectStats("RK-149", { name: "デンライナーイカヅチ", category: "OT", size: "M", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: undefined, features: ["メカ", "車両", "ドラゴン"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-149", ["N"]);
  });

  const enemy = {
    battle: [inst("SPEC-B3000", "b3"), inst("SPEC-B3500", "b35")],
    rush: [inst("SPEC-B2000M", "m2"), inst("SPEC-B4000", "b4"), ...riding(inst("SPEC-VEHICLE", "ev"), inst("SPEC-ES", "es"))],
  };
  /** イカヅチ・ゴウカ・イスルギの順に並べ、4番目にレッコウを出す。 */
  const fourth = (battle = [inst("RK-149", "ik"), inst("RK-060", "gk"), inst("RK-147", "is")], p2: Partial<GameState["players"]["player2"]> = enemy) =>
    enter(board({ battle, rush: [inst("RK-148", "rk")], hand: [] }, p2), "RK-148:rk");

  it.fails("RK-149: イカヅチ→ゴウカ→イスルギ→レッコウの順に並んだとき、本来の BP が3000以下の敵軍ユニットをすべて（バトル・ラッシュエリアを問わず）撃破する（出典: atwiki/page-675・カード評価「ラッシュエリアまで含む複数を対象とした除去効果」）", () => {
    const s = resolveAll(fourth());
    expect(zoneOf(s, "player2", "SPEC-B3000:b3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B2000M:m2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-ES:es")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B3500:b35")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-B4000:b4")).toBe("rush");
  });

  it.fails("RK-149: 判定は本来の BP（ビークルにライドして BP が上がっていても、印刷の BP1000 なら撃破）（出典: atwiki/page-675「本来のBPが3000以下」）", () => {
    const s = resolveAll(fourth(undefined, { rush: riding(inst("RK-024", "cy"), inst("SPEC-B3000", "r3")) }));
    expect(zoneOf(s, "player2", "SPEC-B3000:r3")).toBe("discard");
  });

  it("RK-149: 自軍ユニットは撃破しない（出典: atwiki/page-675「敵軍ユニットをすべて」）", () => {
    const s = resolveAll(fourth([inst("RK-149", "ik"), inst("RK-060", "gk"), inst("RK-147", "is")], { battle: [inst("SPEC-B3000", "b3")] }));
    expect(zoneOf(s, "player1", "RK-148:rk")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-147:is")).toBe("battle");
  });

  it("RK-149: 並び順が違えば（イカヅチ→イスルギ→ゴウカ→レッコウ）撃破しない（出典: atwiki/page-675「…の順にコンビネーションしたとき」・カード評価「並び順は異なるので注意」）", () => {
    const s = resolveAll(fourth([inst("RK-149", "ik"), inst("RK-147", "is"), inst("RK-060", "gk")]));
    expect(zoneOf(s, "player2", "SPEC-B3000:b3")).toBe("battle");
  });

  it("RK-149: イカヅチから始まっていなければ（間に別のユニット）撃破しない（出典: atwiki/page-675「このユニットから」）", () => {
    const s = resolveAll(fourth([inst("RK-149", "ik"), inst("TST-UNIT-0", "x"), inst("RK-060", "gk"), inst("RK-147", "is")]));
    expect(zoneOf(s, "player2", "SPEC-B3000:b3")).toBe("battle");
  });

  it("RK-149: イカヅチがバトルエリアになければ、ゴウカ→イスルギ→レッコウと並んでも撃破しない（出典: atwiki/page-675「これが自軍バトルエリアにある間」）", () => {
    const s = resolveAll(fourth([inst("RK-060", "gk"), inst("RK-147", "is")]));
    expect(zoneOf(s, "player2", "SPEC-B3000:b3")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-150 ゼロライナードリル", () => {
  const TEXT =
    "【掘削】これをラッシュしたとき、敵軍パワーゾーンのダメージ以外のカードの枚数を数えてから、そのカードをすべて捨札にしてもよい。そうしたとき、数えた枚数と同じ枚数になるまで敵軍捨札からカードを選び、敵軍パワーゾーンにオモテ向きで置く。";

  it("RK-150: カタログ本文・スペックが出典と一致（出典: atwiki/page-676）", () => {
    expectCatalogText("RK-150", TEXT);
    expectStats("RK-150", { name: "ゼロライナードリル", category: "OT", size: "M", bp: 4000, sp: undefined, powerCost: "3+", comboNumber: undefined, features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-150", ["NR"]);
  });

  const rushed = (p2: Partial<GameState["players"]["player2"]>) => {
    const s = rushPhase({ hand: [inst("RK-150", "dr")], rush: [inst("TST-UNIT-0", "mat")], command: releasedCat("OT", 1), power: powerCards(3) }, p2);
    const r = rushFromHand(s, "player1", "RK-150:dr", { materials: ["TST-UNIT-0:mat"] });
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const enemy = {
    power: [faceUp("SPEC-ES", "p1"), faceUp("SPEC-B3000", "p2"), faceDown("SPEC-B4000", "dmg")],
    discard: [inst("SPEC-EM-PLAIN", "d1"), inst("SPEC-EL", "d2"), inst("TST-OP", "d3")],
  };

  it.fails("RK-150: ラッシュしたとき、敵軍パワーゾーンのカードを捨札にするかを選べる（任意）（出典: atwiki/page-676「すべて捨札にしてもよい」）", () => {
    const s = rushed(enemy);
    expectChoiceFrom(s, "player1", "RK-150");
    expect(canConfirm(s)).toBe(true);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-150: 捨札にすると、ダメージ以外のカード（2枚）がすべて捨札になり、ダメージは残る（出典: atwiki/page-676「ダメージ以外のカードの枚数を数えてから、そのカードをすべて捨札にしてもよい」）", () => {
    const s = confirm(rushed(enemy));
    expect(zoneOf(s, "player2", "SPEC-ES:p1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B3000:p2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-B4000:dmg")).toBe("power");
  });

  it.fails("RK-150: その後、敵軍捨札（捨札にしたばかりのカードを含む）から自分がカードを選ぶ（選ばないことはできない）（出典: atwiki/page-676「数えた枚数と同じ枚数になるまで敵軍捨札からカードを選び」）", () => {
    const s = confirm(rushed(enemy));
    expectChoiceFrom(s, "player1", "RK-150");
    expect(choiceIds(s)).toEqual(["SPEC-B3000:p2", "SPEC-EL:d2", "SPEC-EM-PLAIN:d1", "SPEC-ES:p1", "TST-OP:d3"].sort());
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-150: 数えた枚数（2枚）になるまで選び、選んだカードは敵軍パワーゾーンにオモテ向きで置かれる（出典: atwiki/page-676「敵軍パワーゾーンにオモテ向きで置く」）", () => {
    let s = pick(confirm(rushed(enemy)), "SPEC-EL:d2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-150");
    s = resolveAll(pick(s, "TST-OP:d3"));
    expect(zoneOf(s, "player2", "SPEC-EL:d2")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP:d3")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-EL:d2")?.faceDown ?? false).toBe(false);
    expect(zoneOf(s, "player2", "SPEC-EM-PLAIN:d1")).toBe("discard");
    expect(s.players.player2.power).toHaveLength(3);
  });

  it.fails("RK-150: 捨札にしなければ何も起きない（出典: atwiki/page-676「捨札にしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(rushed(enemy)));
    expect(zoneOf(s, "player2", "SPEC-ES:p1")).toBe("power");
    expect(s.players.player2.power).toHaveLength(3);
  });

  it("RK-150: 敵軍パワーゾーンにダメージ以外のカードがなければ選択は開かない（出典: atwiki/page-676「ダメージ以外のカードの枚数を数えてから」）", () => {
    const s = rushed({ power: [faceDown("SPEC-B4000", "dmg")], discard: [inst("SPEC-ES", "d1")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-150");
  });

  // faq-rider-2 RK-150 Q「はい、できます。「ラッシュしたとき」とある…効果が、「ラッシュされたとき」とあるモーフより先に発動します。」
  it.fails("RK-150: 公式Q&A — 相手のモーフより先に【掘削】を解決し、モーフの置き換え先になるパワーゾーンのオモテ向きのカードを捨札にできる（出典: grnrngr/faq-rider-2 RK-150 Q）", () => {
    let s = rushed({ rush: [inst("SPEC-MORPH", "m")], power: [faceUp("SPEC-MORPH-T", "t")] });
    expectChoiceFrom(s, "player1", "RK-150");
    s = confirm(s);
    expect(zoneOf(s, "player2", "SPEC-MORPH-T:t")).toBe("discard");
  });

  it.todo(
    "RK-150: コミュニティQ&A — 敵軍捨札が0枚で、敵軍パワーゾーンに「相手に選ばれない」カードがあるときは、捨札にしたカードを選び直せず敵軍のパワーが減る（出典: atwiki/page-676 コメント欄）— ゾーンにあるカードに「相手に選ばれない」が効くか（faq-rider-1 は効かない、atwiki・faq-card-3 RS-149 Q1 は効く）がユーザー確認待ち（問い a）のため",
  );
});

// ===========================================================================
describe("RK-151 ゼロライナーナギナタ", () => {
  it("RK-151: カタログ本文（なし）・スペックが出典と一致（出典: atwiki/page-677）", () => {
    expectCatalogText("RK-151", "なし");
    expectStats("RK-151", { name: "ゼロライナーナギナタ", category: "OT", size: "M", bp: 3000, sp: 1, powerCost: "7+", comboNumber: undefined, features: ["メカ", "車両", "航空機"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-151", ["N"]);
  });

  it("RK-151: 必要パワー7+ — 自軍 S ユニットを1体パワーゾーンに送り、パワー7でラッシュできる（6ではラッシュできない）（出典: atwiki/page-677「必要パワー：7+」「追加条件：自軍Sユニットを1体パワーゾーンに送る」）", () => {
    const mk = (n: number) => rushPhase({ hand: [inst("RK-151", "ng")], rush: [inst("TST-UNIT-0", "mat")], command: releasedCat("OT", 1), power: powerCards(n) });
    expect(canStartRush(mk(6), "player1", "RK-151:ng")).toBe(false);
    const r = rushFromHand(mk(7), "player1", "RK-151:ng", { materials: ["TST-UNIT-0:mat"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-151:ng")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:mat")).toBe("power");
  });

  it("RK-151: SP1 — 先頭でバトルエリアに出ればストライクできる（出典: atwiki/page-677「SP：1」）", () => {
    const s = enter(board({ rush: [inst("RK-151", "ng")] }), "RK-151:ng");
    expect(canStrike(s, "RK-151:ng")).toBe(true);
  });
});

// ===========================================================================
describe("RK-152 仮面ライダー電王PF", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい。 ※これは、自軍パワーゾーンのオモテ向きのカードのうち、特徴「イマジン」を持つユニットカード1枚につきBP+1000され、BP3000以上なら「SP1/4」になる。";

  it("RK-152: カタログ本文・スペックが出典と一致（出典: atwiki/page-633）", () => {
    expectCatalogText("RK-152", TEXT);
    expectStats("RK-152", { name: "仮面ライダー電王PF", category: "OT", size: "S", bp: 500, sp: "special", powerCost: 0, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-152", ["N"]);
  });

  it("RK-152: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-633「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-152", "pf")] }, "RK-152:pf"))).toBe(true);
  });

  const imagins = (n: number) => Array.from({ length: n }, (_, i) => faceUp("SPEC-IMAGIN", `im${i}`));

  it("RK-152: ※ 自軍パワーゾーンのオモテ向きの「イマジン」のユニットカード1枚につき BP+1000（2枚で BP2500。ラッシュエリアにあるときも）（出典: atwiki/page-633「特徴「イマジン」を持つユニットカード1枚につきBP+1000され」）", () => {
    expect(bpOf(board({ rush: [inst("RK-152", "pf")], power: imagins(2) }), "player1", "RK-152:pf")).toBe(2500);
    expect(bpOf(board({ rush: [inst("RK-152", "pf")], power: [] }), "player1", "RK-152:pf")).toBe(500);
  });

  it("RK-152: ※ ダメージ（ウラ向き）のイマジン・イマジン以外のカード・敵軍パワーゾーンのイマジンは数えない（出典: atwiki/page-633「自軍パワーゾーンのオモテ向きのカードのうち、特徴「イマジン」を持つユニットカード」）", () => {
    const s = board({ rush: [inst("RK-152", "pf")], power: [faceDown("SPEC-IMAGIN", "dm"), faceUp("SPEC-ES", "x"), ...powerCards(2)] }, { power: imagins(2) });
    expect(bpOf(s, "player1", "RK-152:pf")).toBe(500);
  });

  it("RK-152: ※ BP3000以上（イマジン3枚で BP3500）なら「SP1/4」— 先頭でストライクできる（出典: atwiki/page-633「BP3000以上なら「SP1/4」になる」）", () => {
    const s = enter(board({ rush: [inst("RK-152", "pf")], power: imagins(3) }), "RK-152:pf");
    expect(bpOf(s, "player1", "RK-152:pf")).toBe(3500);
    expect(spOf(s, "player1", "RK-152:pf")).toBe(1);
    expect(canStrike(s, "RK-152:pf")).toBe(true);
  });

  it.fails("RK-152: ※ 「SP1/4」なので2番目ではストライクできない（出典: atwiki/page-633「SP1/4」）", () => {
    const s = enter(board({ battle: fill(1), rush: [inst("RK-152", "pf")], power: imagins(3) }), "RK-152:pf");
    expect(spOf(s, "player1", "RK-152:pf")).toBe(0);
  });

  it("RK-152: ※ BP3000未満（イマジン2枚で BP2500）なら SP を持たず、先頭でもストライクできない（出典: atwiki/page-633「SP：！」「BP3000以上なら」）", () => {
    const s = enter(board({ rush: [inst("RK-152", "pf")], power: imagins(2) }), "RK-152:pf");
    expect(spOf(s, "player1", "RK-152:pf")).toBe(0);
    expect(canStrike(s, "RK-152:pf")).toBe(false);
  });
});

// ===========================================================================
describe("RK-153 仮面ライダーガオウ", () => {
  const TEXT =
    "※これは、敵軍ユニットを撃破したターンにしかバトルエリアに出られない。 【車両強奪】これが自軍ラッシュエリアにある間、自分がターンを終えるとき、敵軍バトルエリアから特徴「車両」を持つユニットを1体選んでもよい。そうしたとき、次の相手のターン、相手はスタートフェイズにバトルエリアのユニットをラッシュエリアに戻すとき、選ばれたユニットをラッシュエリアに戻すことはできない。";

  it("RK-153: カタログ本文・スペックが出典と一致（出典: atwiki/page-705）", () => {
    expectCatalogText("RK-153", TEXT);
    expectStats("RK-153", { name: "仮面ライダーガオウ", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: 6, comboNumber: undefined, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-153", ["R"]);
  });

  it.fails("RK-153: ※ 敵軍ユニットを撃破していないターンはバトルエリアに出られない（出典: atwiki/page-705「敵軍ユニットを撃破したターンにしかバトルエリアに出られない」）", () => {
    const s = board({ rush: [inst("RK-153", "ga")] }, { battle: [inst("SPEC-B500", "e")] });
    expect(canEnter(s, "RK-153:ga")).toBe(false);
  });

  it("RK-153: ※ そのターンに敵軍ユニットをアタックで撃破すれば、バトルエリアに出られる（出典: atwiki/page-705）", () => {
    let s = board({ battle: [inst("TST-UNIT-0", "a")], rush: [inst("RK-153", "ga")] }, { battle: [inst("SPEC-B500", "e")] });
    s = resolveAll(attack(s, "TST-UNIT-0:a", "SPEC-B500:e"));
    expect(zoneOf(s, "player2", "SPEC-B500:e")).toBe("discard");
    expect(canEnter(s, "RK-153:ga")).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-VEH-UNIT", "vu"), inst("SPEC-ES", "s")], rush: [inst("SPEC-VEH-UNIT", "rv")] };
  const atEnd = (p1: Partial<GameState["players"]["player1"]> = { rush: [inst("RK-153", "ga")] }, p2: Partial<GameState["players"]["player2"]> = enemy) =>
    endTurnKeep(board(p1, p2));

  it.fails("RK-153: 【車両強奪】自軍ラッシュエリアにある間、ターンを終えるとき、敵軍バトルエリアの特徴「車両」を持つユニットを1体選べる（任意）（出典: atwiki/page-705「敵軍バトルエリアから特徴「車両」を持つユニットを1体選んでもよい」）", () => {
    const s = atEnd();
    expectChoiceFrom(s, "player1", "RK-153");
    expect(choiceIds(s)).toEqual(["SPEC-VEH-UNIT:vu"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-153: 【車両強奪】選ばれたユニットは、次の相手のスタートフェイズにラッシュエリアに戻らずバトルエリアに残る（ほかのユニットは戻る）（出典: atwiki/page-705「選ばれたユニットをラッシュエリアに戻すことはできない」）", () => {
    let s = pick(atEnd(), "SPEC-VEH-UNIT:vu");
    s = endTurnKeep(settle(s));
    expect(s.activePlayer).toBe("player2");
    s = toPhase(s, "player2", "rush");
    expect(zoneOf(s, "player2", "SPEC-VEH-UNIT:vu")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ES:s")).toBe("rush");
  });

  it.fails("RK-153: 【車両強奪】選ばなければ、相手のスタートフェイズにふつうにラッシュエリアに戻る（出典: atwiki/page-705「選んでもよい。そうしたとき」）", () => {
    let s = skip(atEnd());
    s = toPhase(endTurnKeep(settle(s)), "player2", "rush");
    expect(zoneOf(s, "player2", "SPEC-VEH-UNIT:vu")).toBe("rush");
  });

  it("RK-153: 【車両強奪】ガオウがバトルエリアにあるときは発動しない（出典: atwiki/page-705「これが自軍ラッシュエリアにある間」）", () => {
    const s = atEnd({ battle: [inst("RK-153", "ga")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-153");
  });

  it("RK-153: 【車両強奪】敵軍のターンを終えるとき（相手がターンを終えるとき）は発動しない（出典: atwiki/page-705「自分がターンを終えるとき」）", () => {
    const s = endTurnKeep(enemyTurn({ rush: [inst("RK-153", "ga")], battle: [inst("SPEC-VEH-UNIT", "mine")] }, { battle: [inst("SPEC-VEH-UNIT", "vu")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-153");
  });
});

// ===========================================================================
describe("RK-154 ジーク", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【頭が高い！】これをラッシュしたとき、敵軍Sユニットか、敵軍Mユニットを1体選んでもよい。そうしたとき、選んだユニットがSユニットなら、このターン、そのユニットはBP500になり、そのBPより高いBPになる効果はすべて無効になる。選んだユニットがMユニットなら、このターン、そのユニットはSユニットになる。";

  it("RK-154: カタログ本文・スペックが出典と一致（出典: atwiki/page-679）", () => {
    expectCatalogText("RK-154", TEXT);
    expectStats("RK-154", { name: "ジーク", category: "OT", size: "S", bp: 1000, sp: "1/4", powerCost: 3, comboNumber: undefined, features: ["イマジン"] });
    expectRarityIn("RK-154", ["N"]);
  });

  const rushed = (p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = rushPhase({ hand: [inst("RK-154", "zk")], command: releasedCat("OT", 1), power: powerCards(3), ...p1 }, p2);
    const r = rushFromHand(s, "player1", "RK-154:zk");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const enemy = { battle: [inst("SPEC-B3000", "s"), inst("SPEC-EL", "l")], rush: [inst("SPEC-EM-PLAIN", "m")] };

  it.fails("RK-154: ラッシュしたとき、敵軍の S・M ユニット（エリアを問わない。L は対象外）から1体選べる（任意）（出典: atwiki/page-679「敵軍Sユニットか、敵軍Mユニットを1体選んでもよい」・カード評価「エリアを問わない点も強い」）", () => {
    const s = rushed(enemy);
    expectChoiceFrom(s, "player1", "RK-154");
    expect(choiceIds(s)).toEqual(["SPEC-B3000:s", "SPEC-EM-PLAIN:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-154: S ユニットを選ぶと、このターン BP500 になる（出典: atwiki/page-679「このターン、そのユニットはBP500になり」）", () => {
    const s = resolveAll(pick(rushed(enemy), "SPEC-B3000:s"));
    expect(bpOf(s, "player2", "SPEC-B3000:s")).toBe(500);
  });

  it("RK-154: BP500 より高い BP になる効果は無効（RK-127 カリス〈相手の手札1枚につき BP+2000〉も BP500 のまま）（出典: atwiki/page-679「そのBPより高いBPになる効果はすべて無効になる」）", () => {
    const s = resolveAll(pick(rushed({ rush: [inst("RK-127", "ch")] }, { hand: [inst("RK-154", "zk"), ...deckCards(3, "h")] }), "RK-127:ch"));
    expect(bpOf(s, "player2", "RK-127:ch")).toBe(500);
  });

  it("RK-154: BP500 は「このターン」だけ（次のターンには元の BP に戻る）（出典: atwiki/page-679「このターン、」）", () => {
    let s = resolveAll(pick(rushed(enemy), "SPEC-B3000:s"));
    s = toPhase(endTurnKeep(settle(s)), "player2", "battle");
    expect(bpOf(s, "player2", "SPEC-B3000:s")).toBe(3000);
  });

  it.fails("RK-154: M ユニットを選ぶと、このターン S ユニットになる（BP はそのまま。RK-162 アギトGF の「DA の S ユニット」に選べる）（出典: atwiki/page-679「このターン、そのユニットはSユニットになる」・カード評価「サイズをSに変更する事で他のカードでの除去が容易に出来るようになる」）", () => {
    let s = resolveAll(pick(rushed({ battle: [inst("SPEC-EM-DA", "dm")] }, { rush: [inst("RK-162", "gf"), inst("SPEC-VEHICLE", "v")] }), "SPEC-EM-DA:dm"));
    expect(bpOf(s, "player2", "SPEC-EM-DA:dm")).toBe(5000);
    s = toPhase(s, "player1", "battle");
    s = rcRideOff(s, "RK-162:gf", "SPEC-VEHICLE:v");
    expectChoiceFrom(s, "player1", "RK-162");
    expect(choiceIds(s)).toEqual(["SPEC-EM-DA:dm"]);
  });

  it("RK-154: 選ばなければ何も起きない（出典: atwiki/page-679「選んでもよい」）", () => {
    const s = resolveAll(skip(rushed(enemy)));
    expect(bpOf(s, "player2", "SPEC-B3000:s")).toBe(3000);
  });
});
