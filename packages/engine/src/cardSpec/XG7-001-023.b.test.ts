/**
 * カード別スペック: XG7-009〜XG7-016（クロスギャザー ザ・ベストパートナー タイムレッド〜黒獅子リオ×スーパーゲキレッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に本範囲のカードの項はない（「XG7-」とカード名で検索）。
 *     atwiki に転載された公式 Q&A（XG7-016 Q1）、atwiki/page-2393（クロス）Q2（XG7-011 の並び順）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CROSS・R-KW-CALL・R-KW-TAKUS・R-KW-WING・R-ADD-06 合体）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG7-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマル」を SR／R／N として照合する。
 */
import { describe, expect, it } from "vitest";
import { activate, onlyActivateOrSkip } from "./revealGate.helpers";
import type { CardInstance, GameState } from "../types/game";
import {
  attack,
  attackedInEnemyTurn,
  bpOf,
  callTests,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  crossTests,
  deckCards,
  deckOf,
  enemyTurnOf,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  extraHoldTests,
  fill,
  inst,
  logged,
  ncBoard,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseOf,
  settle,
  skip,
  spOf,
  sUnit,
  takusTests,
  targetsOf,
  wingTests,
  zoneOf,
} from "./XG7-001-023.helpers";

const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const BIG = sUnit("SPEC-BIG", { category: "WB", bp: 9000, sp: undefined });
const OWN_L = sUnit("SPEC-OWN-L", { category: "WB", bp: 8000, size: "L", powerCost: 5 });
const OT_L = sUnit("SPEC-OT-L", { category: "OT", bp: 8000, size: "L", powerCost: 5 });
const OT_L2 = sUnit("SPEC-OT-L2", { category: "OT", bp: 8000, size: "L", powerCost: 5 });
const C2 = sUnit("SPEC-C2", { category: "WB", bp: 1000, powerCost: 2 });
const C0 = sUnit("SPEC-C0", { category: "WB", bp: 1000, powerCost: 0 });
const C5 = sUnit("SPEC-C5", { category: "WB", bp: 1000, powerCost: 5 });
const C6 = sUnit("SPEC-C6", { category: "WB", bp: 1000, powerCost: 6 });
const C2M = sUnit("SPEC-C2M", { category: "WB", bp: 3000, powerCost: 2, size: "M" });
const C3 = sUnit("SPEC-C3", { category: "WB", bp: 1000, powerCost: 3 });
const NINJA = sUnit("SPEC-NINJA", { category: "MA", bp: 1000, features: ["忍者"] });
const E_S = sUnit("SPEC-E-S", { category: "WB", bp: 1000 });
const E_M = sUnit("SPEC-E-M", { category: "WB", bp: 3000, size: "M" });
const E1000 = sUnit("SPEC-E1000", { category: "WB", bp: 1000 });
const E2000 = sUnit("SPEC-E2000", { category: "WB", bp: 2000 });
const E3000 = sUnit("SPEC-E3000", { category: "WB", bp: 3000 });
const E4000 = sUnit("SPEC-E4000", { category: "WB", bp: 4000 });
const E9000M = sUnit("SPEC-E9000M", { category: "WB", bp: 9000, size: "M" });
const S_WB3000 = sUnit("SPEC-S-WB3000", { category: "WB", bp: 3000 });
const S_DA2000 = sUnit("SPEC-S-DA2000", { category: "DA", bp: 2000 });
const S_WBDA = sUnit("SPEC-S-WBDA", { category: ["WB", "DA"] as unknown as "WB", bp: 2000 });
const M_WB5000 = sUnit("SPEC-M-WB5000", { category: "WB", bp: 5000, size: "M" });
const WB_M5 = sUnit("SPEC-WB-M5", { category: "WB", bp: 5000, size: "M", powerCost: 5 });
const WB_M4P = sUnit("SPEC-WB-M4P", { category: "WB", bp: 5000, size: "M", powerCost: "4+" });
const WB_M6 = sUnit("SPEC-WB-M6", { category: "WB", bp: 6000, size: "M", powerCost: 6 });
const WB_S3 = sUnit("SPEC-WB-S3", { category: "WB", bp: 3000, powerCost: 3 });
const MA_M3 = sUnit("SPEC-MA-M3", { category: "MA", bp: 5000, size: "M", powerCost: 3 });
const EXTRA = [C0, ENEMY, BIG, OWN_L, OT_L, OT_L2, C2, C5, C6, C2M, C3, NINJA, E_S, E_M, E1000, E2000, E3000, E4000, E9000M, S_WB3000, S_DA2000, S_WBDA, M_WB5000, WB_M5, WB_M4P, WB_M6, WB_S3, MA_M3];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG7-009 タイムレッド", () => {
  const TEXT =
    "※これをラッシュしたとき、次の効果を発動できる⇒自軍山札を見て「Vコマンダー」のカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。【受け継いだもの】これは自軍Lユニットがあれば、敵軍ユニットにアタックされない。また、このユニットと隣り合うOTを持つLユニットはアタックされる以外では相手に選ばれない。";

  it("XG7-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-2449）", () => {
    expectCatalogText("XG7-009", TEXT);
    expectUnitStats("XG7-009", { name: "タイムレッド", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["レッド", "男", "加速", "Vコマンダー"] });
    expectRarityIn("XG7-009", ["SR"]);
  });

  const rushed = (deck: CardInstance[]) => {
    const r = rushFromHand(rushPhaseOf({ hand: [inst("XG7-009", "tr")], command: releasedCat("OT", 1), power: powerCards(4), deck }, {}, EXTRA), "player1", "XG7-009:tr");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG7-009: ※ラッシュしたとき — 自軍山札の「Vコマンダー」のカード（RS-249）から1枚選べる。特徴「Vコマンダー」を持つだけの別名のカードは選べない（発動は任意）（出典: atwiki/page-2449「自軍山札を見て「Vコマンダー」のカードを1枚選び」「次の効果を発動できる」）", () => {
    const s = rushed([inst("RS-249", "vc"), inst("XG7-009", "other"), ...deckCards(3)]);
    expectChoiceFrom(s, "player1", "XG7-009");
    expect(canSkip(s)).toBe(true);
    // 発動するかを先に選ぶ（rules/revealGate.ts）。発動すると選べる
    expect(onlyActivateOrSkip(s)).toBe(true);
    expect(choiceIds(activate(s))).toEqual(["RS-249:vc"]);
  });

  it("XG7-009: ※ 発動しなければ山札はシャッフルされない（ユーザー報告 2026-10-28「任意効果で処理が先に動くもの」の横展開。以前は見送ってもシャッフルした）（出典: atwiki/page-2449「次の効果を発動できる」）", () => {
    const deck = [inst("RS-249", "vc"), ...deckCards(5)];
    const s = resolveAll(skip(rushed(deck)));
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
  });

  it("XG7-009: ※ 山札に「Vコマンダー」が無くても、発動するかを聞く（以前は聞かずにシャッフルした）。発動しなければ山札はそのまま（出典: atwiki/page-2449「次の効果を発動できる⇒…その後、山札をシャッフルする」）", () => {
    const deck = deckCards(6);
    const s = rushed(deck);
    expectChoiceFrom(s, "player1", "XG7-009");
    expect(onlyActivateOrSkip(s)).toBe(true);
    expect(resolveAll(skip(s)).players.player1.deck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
    // 発動すれば、選ぶカードが無いまま効果を終える（山札はシャッフル）
    const done = activate(s);
    expect(done.pendingEffectChoice?.sourceCardId).not.toBe("XG7-009");
    expect(done.players.player1.deck).toHaveLength(6);
  });

  it("XG7-009: ※ 選んだカードを相手に見せてから手札に加える（出典: atwiki/page-2449「相手に見せてから手札に加える」）", () => {
    const s = resolveAll(activate(rushed([inst("RS-249", "vc"), ...deckCards(3)])), ["RS-249:vc"]);
    expect(zoneOf(s, "player1", "RS-249:vc")).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(logged(s, "reveal")).toBe(true);
  });

  it.todo("XG7-009: ※ 選んだ後に山札をシャッフルする（出典: atwiki/page-2449「その後、山札をシャッフルする」）— シャッフルの結果は乱数で、公開 API から並びが変わったことを確かめる手段がない");

  const attackedBoard = (p1Battle: CardInstance[], p1Rush: CardInstance[] = []) =>
    enemyTurnOf({ battle: p1Battle, rush: p1Rush }, { battle: [inst("SPEC-BIG", "atk")] }, EXTRA);

  it("XG7-009: 【受け継いだもの】自軍 L ユニットがあれば、敵軍ユニットにアタックされない（出典: atwiki/page-2449「これは自軍Lユニットがあれば、敵軍ユニットにアタックされない」）", () => {
    const s = attackedBoard([inst("XG7-009", "tr")], [inst("SPEC-OWN-L", "l")]);
    expect(targetsOf(s, "SPEC-BIG:atk", "player2")).not.toContain("XG7-009:tr");
  });

  it("XG7-009: 【受け継いだもの】自軍 L ユニットがなければアタックされる（出典: atwiki/page-2449）", () => {
    const s = attackedBoard([inst("XG7-009", "tr")]);
    expect(targetsOf(s, "SPEC-BIG:atk", "player2")).toContain("XG7-009:tr");
  });

  it("XG7-009: 【受け継いだもの】隣り合う OT の L ユニットは、敵軍ユニットの効果（RS-155 ガオバイソン【鋼の角】）に選ばれない。隣り合わない OT の L ユニットは選ばれる（出典: atwiki/page-2449「このユニットと隣り合うOTを持つLユニットはアタックされる以外では相手に選ばれない」）", () => {
    let s = enemyTurnOf(
      { battle: [inst("SPEC-OT-L", "adj"), inst("XG7-009", "tr"), inst("SPEC-ENEMY", "mid"), inst("SPEC-OT-L2", "far")], damage: 6, power: Array.from({ length: 6 }, (_, i) => ({ ...inst("TST-P", `d${i}`), faceDown: true })) },
      { rush: [inst("RS-155", "bs")], command: releasedCat("WB", 1) },
      EXTRA,
    );
    s = enterHold(s, "RS-155:bs", "player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-155");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-OT-L2:far");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("SPEC-OT-L:adj");
  });

  it("XG7-009: 【受け継いだもの】隣り合う OT の L ユニットもアタックはされる（出典: atwiki/page-2449「アタックされる以外では」）", () => {
    const s = attackedBoard([inst("SPEC-OT-L", "adj"), inst("XG7-009", "tr")]);
    expect(targetsOf(s, "SPEC-BIG:atk", "player2")).toContain("SPEC-OT-L:adj");
  });
});

// ===========================================================================
describe("XG7-010 ガオレッド×ガオライオン", () => {
  const TEXT = "※クロス1 ※これは「ガオライオン」としてつかえる。【獅子、吼える！！】このターン、これはBP+5000される。";

  it("XG7-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-2413）", () => {
    expectCatalogText("XG7-010", TEXT);
    expectUnitStats("XG7-010", { name: "ガオレッド×ガオライオン", category: "WB", size: "M", bp: 6000, sp: undefined, powerCost: "5+", comboNumber: 5, features: ["レッド", "男", "獣"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-010", ["N"]);
  });

  crossTests("XG7-010", "atwiki/page-2413");
  extraHoldTests("XG7-010", ["WB"], "5+", "atwiki/page-2413");

  it("XG7-010: ※「ガオライオン」としてつかえる — RS-151 ガオキングの合体ユニット（ガオライオン＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー）のガオライオンにできる（出典: atwiki/page-2413「※これは「ガオライオン」としてつかえる」・関連カード（合体ユニット）ガオキング「ガオライオンorガオレッド×ガオライオン」）", () => {
    const five = ["XG7-010", "RS-153", "RS-154", "RS-155", "RS-156"].map((id) => inst(id, "m"));
    const s = rushPhaseOf({ hand: [inst("RS-151", "k")], rush: five, command: releasedCat("WB", 2), power: powerCards(6) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "RS-151:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-151:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-010:m")).toBe("discard");
  });

  it("XG7-010: 【獅子、吼える！！】NC（5番目）— このターン BP+5000（11000）（出典: atwiki/page-2413「このターン、これはBP+5000される」）", () => {
    expect(bpOf(resolveAll(nc("XG7-010:g", 4)), "player1", "XG7-010:g")).toBe(11000);
  });

  it("XG7-010: NC にならない並び（4番目）では BP6000 のまま（出典: atwiki/page-2413「CN：5」）", () => {
    expect(bpOf(resolveAll(nc("XG7-010:g", 3)), "player1", "XG7-010:g")).toBe(6000);
  });
});

// ===========================================================================
describe("XG7-011 ハリケンレッド", () => {
  const TEXT =
    "※ウイング 【ジャイロ手裏剣】これのバトルエリアでの並び順を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主の山札の上に戻してもよい。（この効果は、特徴「忍者」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する）";

  it("XG7-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-2414）", () => {
    expectCatalogText("XG7-011", TEXT);
    expectUnitStats("XG7-011", { name: "ハリケンレッド", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 5, features: ["レッド", "男", "忍者"] });
    expectRarityIn("XG7-011", ["N"]);
  });

  wingTests("XG7-011", "atwiki/page-2414");

  const enemy = { battle: [inst("SPEC-C5", "c5"), inst("SPEC-C6", "c6")], rush: [inst("SPEC-C2M", "c2m")], deck: deckCards(3, "e") };

  it("XG7-011: 【ジャイロ手裏剣】NC（5番目）— 並び順（5）以下の必要パワーの数字を持つ敵軍ユニット（エリア・サイズを問わない）から1体選べる（任意）（出典: atwiki/page-2414「その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び」）", () => {
    const s = nc("XG7-011:h", 4, {}, enemy);
    expectChoiceFrom(s, "player1", "XG7-011");
    expect(choiceIds(s)).toEqual(["SPEC-C2M:c2m", "SPEC-C5:c5"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-011: 【ジャイロ手裏剣】選んだユニットを持ち主の山札の上に戻す（出典: atwiki/page-2414「持ち主の山札の上に戻してもよい」）", () => {
    const s = resolveAll(nc("XG7-011:h", 4, {}, enemy), ["SPEC-C5:c5"]);
    expect(deckOf(s, "player2")[0]).toBe("SPEC-C5:c5");
  });

  it("XG7-011: 【ジャイロ手裏剣】特徴「忍者」を持つユニットからコンビネーションすると、ナンバーに関係なく（2番目でも）発動し、並び順2以下の必要パワーのユニットだけが候補（出典: atwiki/page-2414「（この効果は、特徴「忍者」を持つユニットからコンビネーションするとき、ナンバーに関係なく発動する）」）", () => {
    const s = ncBoard("XG7-011:h", 0, { battle: [inst("SPEC-NINJA", "nj")] }, enemy, EXTRA);
    expectChoiceFrom(s, "player1", "XG7-011");
    expect(choiceIds(s)).toEqual(["SPEC-C2M:c2m"]);
  });

  it("XG7-011: 忍者でないユニットからコンビネーションしても、5番目以外では発動しない（出典: atwiki/page-2414「CN：5」）", () => {
    const s = nc("XG7-011:h", 1, {}, enemy);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-011");
  });

  it("XG7-011: クロス1 の S ユニット2体の右に出ると CN3 として NC が成立し、並び順は3番目として数える（必要パワー3以下）（出典: atwiki/page-2393 Q2「３番目になります」）", () => {
    const s = ncBoard("XG7-011:h", 0, { battle: [inst("SX-010", "x1"), inst("SX-010", "x2")] }, { battle: [inst("SPEC-C3", "c3"), inst("SPEC-C5", "c5")], deck: deckCards(3, "e") }, EXTRA);
    expectChoiceFrom(s, "player1", "XG7-011");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3"]);
  });
});

// ===========================================================================
describe("XG7-012 アバレッド×爆竜ティラノサウルス", () => {
  const TEXT =
    "※クロス1 ※これは「爆竜ティラノサウルス」としてつかえる。【荒ぶるダイノガッツ】これが自軍バトルエリアにある間、1ターンごとに1度だけ、次の効果を発動できる⇒自軍ユニットが撃破されたとき、そのユニットを捨札にするかわりに、自軍山札の上からそのユニットの必要パワーの数字と同じ枚数を捨札にして、その場に留めてもよい。";

  it("XG7-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-2387）", () => {
    expectCatalogText("XG7-012", TEXT);
    expectUnitStats("XG7-012", { name: "アバレッド×爆竜ティラノサウルス", category: "WB", size: "M", bp: 5000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["レッド", "男", "恐竜"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-012", ["R"]);
  });

  crossTests("XG7-012", "atwiki/page-2387");
  extraHoldTests("XG7-012", ["WB"], "4+", "atwiki/page-2387");

  it("XG7-012: ※「爆竜ティラノサウルス」としてつかえる — RS-050 アバレンオーの合体ユニット（爆竜ティラノサウルス＋爆竜トリケラトプス＋爆竜プテラノドン）にできる（出典: atwiki/page-2387・カード評価「アバレンオーの合体素材…として使うことができる」）", () => {
    const three = ["XG7-012", "RS-052", "RS-053"].map((id) => inst(id, "m"));
    const s = rushPhaseOf({ hand: [inst("RS-050", "k")], rush: three, command: releasedCat("WB", 2), power: powerCards(7) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "RS-050:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-050:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-012:m")).toBe("discard");
  });

  const guts = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    attackedInEnemyTurn({ battle: [inst("XG7-012", "ab"), inst("SPEC-C2", "u")], deck: deckCards(5), ...p1 }, "SPEC-C2:u", p2, "TST-UNIT-7:atk", EXTRA);

  it("XG7-012: 【荒ぶるダイノガッツ】これが自軍バトルエリアにある間、自軍ユニットが撃破されたとき、発動するかを選べる（任意）（出典: atwiki/page-2387「次の効果を発動できる⇒…その場に留めてもよい」）", () => {
    const s = guts();
    expectChoiceFrom(s, "player1", "XG7-012");
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-012: 【荒ぶるダイノガッツ】発動すると、自軍山札の上から必要パワーの数字（2）と同じ枚数を捨札にして、撃破されたユニットはその場に留まる（出典: atwiki/page-2387「自軍山札の上からそのユニットの必要パワーの数字と同じ枚数を捨札にして、その場に留めて」）", () => {
    const s = resolveAll(guts());
    expect(zoneOf(s, "player1", "SPEC-C2:u")).toBe("battle");
    expect(s.players.player1.deck).toHaveLength(3);
    expect(s.players.player1.discard.map((c) => c.instanceId).sort()).toEqual(["TST-OP:dk0", "TST-OP:dk1"]);
  });

  it("XG7-012: 【荒ぶるダイノガッツ】必要パワー0のユニットは、山札を0枚捨札にしてその場に留まれる（山札が0枚でもよい）（出典: 利用者の決定 2026-10-20・questions-all.md U-9「一旦0枚捨てて留まる」）", () => {
    const s0 = attackedInEnemyTurn({ battle: [inst("XG7-012", "ab"), inst("SPEC-C0", "u0")], deck: [] }, "SPEC-C0:u0", {}, "TST-UNIT-7:atk", EXTRA);
    expectChoiceFrom(s0, "player1", "XG7-012");
    const s = resolveAll(s0);
    expect(zoneOf(s, "player1", "SPEC-C0:u0")).toBe("battle");
    expect(s.players.player1.discard.filter((c) => c.instanceId.startsWith("TST-OP:dk"))).toHaveLength(0);
  });

  it("XG7-012: 【荒ぶるダイノガッツ】1ターンに1度だけ — 同じターンに2体目が撃破されたときは発動できない（出典: atwiki/page-2387「1ターンごとに1度だけ」）", () => {
    let s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("XG7-012", "ab"), inst("SPEC-C2", "u"), inst("SPEC-C3", "u2")], deck: deckCards(8) }, "SPEC-C2:u", { battle: [inst("TST-UNIT-7", "atk"), inst("SPEC-BIG", "b2")] }, "TST-UNIT-7:atk", EXTRA),
    );
    s = settle(attack(s, "SPEC-BIG:b2", "SPEC-C3:u2", "player2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-012");
    expect(zoneOf(resolveAll(s), "player1", "SPEC-C3:u2")).toBe("discard");
  });

  it("XG7-012: 【荒ぶるダイノガッツ】これがラッシュエリアにいるときは発動しない（出典: atwiki/page-2387「これが自軍バトルエリアにある間」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SPEC-C2", "u")], rush: [inst("XG7-012", "ab")], deck: deckCards(5) }, "SPEC-C2:u", {}, "TST-UNIT-7:atk", EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG7-012");
  });
});

// ===========================================================================
describe("XG7-013 デカブルー×デカレッド", () => {
  const TEXT =
    "※クロス1 ※タクスOT 【ファイヤーソウル・クールブレイン】これがアタックするとき、敵軍ラッシュエリアからSユニットを1体選び撃破してもよい。（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）";

  it("XG7-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-2450）", () => {
    expectCatalogText("XG7-013", TEXT);
    expectUnitStats("XG7-013", { name: "デカブルー×デカレッド", category: "OT", size: "S", bp: 4000, sp: undefined, powerCost: "3+", comboNumber: 1, features: ["レッド", "ブルー", "男", "警察"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-013", ["SR"]);
  });

  crossTests("XG7-013", "atwiki/page-2450");
  extraHoldTests("XG7-013", ["OT"], "3+", "atwiki/page-2450");
  takusTests("XG7-013", "OT", "atwiki/page-2450");

  const attackAfter = (fillers: number) => {
    let s = nc("XG7-013:d", fillers, {}, { battle: [inst("SPEC-ENEMY", "e")], rush: [inst("SPEC-E-S", "rs"), inst("SPEC-E-M", "rm")] });
    s = resolveAll(s);
    return settle(attack(s, "XG7-013:d", "SPEC-ENEMY:e"));
  };

  it("XG7-013: 【ファイヤーソウル・クールブレイン】NC（1番目）— アタックするとき、敵軍ラッシュエリアの S ユニットから1体選べる（任意。M は選べない）（出典: atwiki/page-2450「これがアタックするとき、敵軍ラッシュエリアからSユニットを1体選び撃破してもよい」）", () => {
    const s = attackAfter(0);
    expectChoiceFrom(s, "player1", "XG7-013");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:rs"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-013: 【ファイヤーソウル・クールブレイン】選んだユニットを撃破する（出典: atwiki/page-2450）", () => {
    const s = resolveAll(attackAfter(0), ["SPEC-E-S:rs"]);
    expect(zoneOf(s, "player2", "SPEC-E-S:rs")).toBe("discard");
  });

  it("XG7-013: 【ファイヤーソウル・クールブレイン】2番目にコンビネーションしたときもナンバーに関係なく発動する（出典: atwiki/page-2450「（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）」）", () => {
    expectChoiceFrom(attackAfter(1), "player1", "XG7-013");
  });

  it("XG7-013: 【ファイヤーソウル・クールブレイン】3番目（NC にならない）でアタックしても発動しない（出典: atwiki/page-2450「CN：1」）", () => {
    expect(attackAfter(2).pendingEffectChoice?.sourceCardId).not.toBe("XG7-013");
  });
});

// ===========================================================================
describe("XG7-014 マジレッド", () => {
  const TEXT =
    "※コールMA ※これは「マジフェニックス」としてつかえる。【ジルマ・マジーロ】「SP1」敵軍バトルエリアからSユニットを1体選び、持ち主の手札に戻してもよい。そうしたとき、戻したユニット以下のBPを持つ敵軍ユニットを1体選び撃破する。";

  it("XG7-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-2416）", () => {
    expectCatalogText("XG7-014", TEXT);
    expectUnitStats("XG7-014", { name: "マジレッド", category: "MA", size: "S", bp: 2000, sp: "special", powerCost: 2, comboNumber: 3, features: ["レッド", "男", "魔法"] });
    expectRarityIn("XG7-014", ["N"]);
  });

  callTests("XG7-014", "MA", "atwiki/page-2416");

  it("XG7-014: ※「マジフェニックス」としてつかえる — RS-070 マジキングの合体ユニット（マジフェニックス＋マジガルーダ＋マジマーメイド＋マジフェアリー＋マジタウロス）にできる（出典: atwiki/page-2416・関連カード（合体ユニット1）マジキング「マジフェニックス or … マジレッド（XG7）」）", () => {
    const five = ["XG7-014", "RS-058", "RS-059", "RS-060", "RS-061"].map((id) => inst(id, "m"));
    const s = rushPhaseOf({ hand: [inst("RS-070", "k")], rush: five, command: releasedCat("MA", 2), power: powerCards(7) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "RS-070:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-070:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG7-014:m")).toBe("discard");
  });

  const enemy = { battle: [inst("SPEC-E3000", "s3"), inst("SPEC-E1000", "s1"), inst("SPEC-E9000M", "m9")], rush: [inst("SPEC-E2000", "r2"), inst("SPEC-E4000", "r4")] };
  const magic = () => nc("XG7-014:mr", 2, {}, enemy);

  it("XG7-014: 【ジルマ・マジーロ】「SP1」— NC（3番目）で SP1（出典: atwiki/page-2416「【ジルマ・マジーロ】「SP1」」）", () => {
    expect(spOf(resolveAll(magic()), "player1", "XG7-014:mr")).toBe(1);
  });

  it("XG7-014: 【ジルマ・マジーロ】NC — 敵軍バトルエリアの S ユニットから1体選べる（任意。M・ラッシュエリアは選べない）（出典: atwiki/page-2416「敵軍バトルエリアからSユニットを1体選び、持ち主の手札に戻してもよい」）", () => {
    const s = magic();
    expectChoiceFrom(s, "player1", "XG7-014");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:s1", "SPEC-E3000:s3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-014: 【ジルマ・マジーロ】戻したユニットは持ち主の手札へ。続けて、そのユニット以下の BP を持つ敵軍ユニット（エリア・サイズを問わない）から1体を選び撃破する（見送れない）（出典: atwiki/page-2416「そうしたとき、戻したユニット以下のBPを持つ敵軍ユニットを1体選び撃破する」・カード評価「2枚目に選ぶユニットはエリア・サイズを問わない」）", () => {
    let s = pick(magic(), "SPEC-E3000:s3");
    expect(zoneOf(s, "player2", "SPEC-E3000:s3")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG7-014");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:s1", "SPEC-E2000:r2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E2000:r2"));
    expect(zoneOf(s, "player2", "SPEC-E2000:r2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-015 ボウケンレッド", () => {
  const TEXT = "※タクスET 【ボウケンジャーになれ】自軍捨札から、DAを持たないSユニットのカードを1枚選んでもよい。そうしたとき、このターン、これは選んだカードのBPが「+」され、クロス1を得る。";

  it("XG7-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-2415）", () => {
    expectCatalogText("XG7-015", TEXT);
    expectUnitStats("XG7-015", { name: "ボウケンレッド", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["レッド", "男"] });
    expectRarityIn("XG7-015", ["N"]);
  });

  takusTests("XG7-015", "ET", "atwiki/page-2415");

  const discard = () => [inst("SPEC-S-WB3000", "wb"), inst("SPEC-S-DA2000", "da"), inst("SPEC-S-WBDA", "wbda"), inst("SPEC-M-WB5000", "m")];
  const bouken = () => nc("XG7-015:br", 0, { discard: discard(), rush: [inst("XG1-007", "cd")] });

  it("XG7-015: 【ボウケンジャーになれ】NC — 自軍捨札の、DA を持たない S ユニットのカードから1枚選べる（任意。DA を持つもの・M は選べない）（出典: atwiki/page-2415「自軍捨札から、DAを持たないSユニットのカードを1枚選んでもよい」）", () => {
    const s = bouken();
    expectChoiceFrom(s, "player1", "XG7-015");
    expect(choiceIds(s)).toEqual(["SPEC-S-WB3000:wb"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-015: 【ボウケンジャーになれ】このターン、選んだカードの BP が加わる（4000＋3000）。選んだカードは捨札に残る（出典: atwiki/page-2415「選んだカードのBPが「+」され」）", () => {
    const s = resolveAll(bouken(), ["SPEC-S-WB3000:wb"]);
    expect(bpOf(s, "player1", "XG7-015:br")).toBe(7000);
    expect(zoneOf(s, "player1", "SPEC-S-WB3000:wb")).toBe("discard");
  });

  it("XG7-015: 【ボウケンジャーになれ】このターン、クロス1を得る（右に出た CN3 の XG1-007 が2番目で NC）（出典: atwiki/page-2415「クロス1を得る」）", () => {
    let s = resolveAll(bouken(), ["SPEC-S-WB3000:wb"]);
    s = enter(passEntry(s), "XG1-007:cd");
    expect(canStrike(s, "XG1-007:cd")).toBe(true);
  });

  it("XG7-015: 【ボウケンジャーになれ】選ばなければ BP は変わらない（出典: atwiki/page-2415「選んでもよい。そうしたとき」）", () => {
    expect(bpOf(resolveAll(skip(bouken())), "player1", "XG7-015:br")).toBe(4000);
  });
});

// ===========================================================================
describe("XG7-016 黒獅子リオ×スーパーゲキレッド", () => {
  const TEXT =
    "※クロス1 ※コールWB ※自軍Lユニットが無ければ、これは「ゲキレッド+黒獅子リオ」として使える。【俺達の道】自分の手札から、必要パワーの数字が5以下のWBのMユニットのカードを2枚まで選び、自軍ラッシュエリアに出してもよい。（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）";

  it("XG7-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-2452）", () => {
    expectCatalogText("XG7-016", TEXT);
    expectUnitStats("XG7-016", { name: "黒獅子リオ×スーパーゲキレッド", category: ["WB", "DA"], size: "S", bp: 5000, sp: "1/2", powerCost: "5+", comboNumber: 1, features: ["レッド", "男", "激気", "臨気"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-016", ["SR"]);
  });

  crossTests("XG7-016", "atwiki/page-2452");
  callTests("XG7-016", "WB", "atwiki/page-2452");
  extraHoldTests("XG7-016", ["WB", "DA"], "5+", "atwiki/page-2452");

  const superGeki = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    attackedInEnemyTurn({ battle: [inst("RS-426", "sg")], discard: [inst("XG7-016", "rio")], ...p1 }, "RS-426:sg", {}, "TST-UNIT-7:atk", EXTRA);

  it("XG7-016: ※ 自軍 L ユニットがなければ「ゲキレッド」として使える — RS-426 スーパーゲキレッドが撃破されて捨札になったとき、自軍捨札のこれをラッシュエリアに出せる（出典: atwiki/page-2452 Q1「はい、できます」）", () => {
    const s = resolveAll(superGeki(), ["XG7-016:rio"]);
    expect(zoneOf(s, "player1", "XG7-016:rio")).toBe("rush");
  });

  it("XG7-016: ※ 自軍 L ユニットがあれば「ゲキレッド」として使えない（RS-426 で出せない）（出典: atwiki/page-2452「※自軍Lユニットが無ければ」）", () => {
    const s = resolveAll(superGeki({ rush: [inst("SPEC-OWN-L", "l")] }), ["XG7-016:rio"]);
    expect(zoneOf(s, "player1", "XG7-016:rio")).toBe("discard");
  });

  const hand = () => [inst("SPEC-WB-M5", "m5"), inst("SPEC-WB-M4P", "m4"), inst("SPEC-WB-M6", "m6"), inst("SPEC-WB-S3", "s3"), inst("SPEC-MA-M3", "ma")];

  it("XG7-016: 【俺達の道】NC（1番目）— 手札の、必要パワーの数字が5以下の WB の M ユニットのカードから2枚まで選べる（任意）（出典: atwiki/page-2452「必要パワーの数字が5以下のWBのMユニットのカードを2枚まで選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = nc("XG7-016:rio", 0, { hand: hand() });
    expectChoiceFrom(s, "player1", "XG7-016");
    expect(choiceIds(s)).toEqual(["SPEC-WB-M4P:m4", "SPEC-WB-M5:m5"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG7-016: 【俺達の道】選んだ2枚を自軍ラッシュエリアに出す（必要パワー・コマンドは問わない）（出典: atwiki/page-2452）", () => {
    const s = resolveAll(nc("XG7-016:rio", 0, { hand: hand() }), ["SPEC-WB-M5:m5", "SPEC-WB-M4P:m4"]);
    expect(zoneOf(s, "player1", "SPEC-WB-M5:m5")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-WB-M4P:m4")).toBe("rush");
  });

  it("XG7-016: 【俺達の道】2番目にコンビネーションしたときもナンバーに関係なく発動する（出典: atwiki/page-2452「（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）」）", () => {
    expectChoiceFrom(nc("XG7-016:rio", 1, { hand: hand() }), "player1", "XG7-016");
  });

  it("XG7-016: 【俺達の道】3番目では発動しない（出典: atwiki/page-2452「CN：1」）", () => {
    expect(nc("XG7-016:rio", 2, { hand: hand() }).pendingEffectChoice?.sourceCardId).not.toBe("XG7-016");
  });
});

void canStartRush;
void p1Battle;
void fill;
void attack;
