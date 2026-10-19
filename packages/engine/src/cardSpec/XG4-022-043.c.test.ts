/**
 * cardSpec XG4-038〜XG4-043（モウギュウダイオー〜ゴセイレッド）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attackUntilRegister,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  endTurnKeep,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  inst,
  isDamage,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  registerOffered,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  scrumTests,
  settle,
  spOf,
  sUnit,
  taxTests,
  wingTests,
  zoneOf,
} from "./XG4-022-043.helpers";

const E_C0 = sUnit("SPEC-E-C0", { bp: 1000, powerCost: 0, sp: undefined });
const E_C2 = sUnit("SPEC-E-C2", { bp: 1000, powerCost: 2, sp: undefined });
const E_C2P = sUnit("SPEC-E-C2P", { bp: 1000, powerCost: "2+", sp: undefined });
const E_C3 = sUnit("SPEC-E-C3", { bp: 1000, powerCost: 3, sp: undefined });
const E_M2 = sUnit("SPEC-E-M2", { bp: 1000, powerCost: 2, size: "M", sp: undefined });
const EXTRA = [E_C0, E_C2, E_C2P, E_C3, E_M2];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const ids = (cards: { instanceId: string }[]) => cards.map((c) => c.instanceId);

// ===========================================================================
describe("XG4-038 モウギュウダイオー", () => {
  const TEXT =
    "【猛牛大回転砲】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒必要パワーの数字が2以下の敵軍Sユニットすべてを、持ち主の山札の下に好きな順で戻す。";

  it("XG4-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-2147）", () => {
    expectCatalogText("XG4-038", TEXT);
    expectUnit("XG4-038", { name: "モウギュウダイオー", category: "MA", size: "L", bp: 8000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["侍", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG4-038", ["R"]);
  });

  it("XG4-038: 追加条件 — 自軍「牛折神」1体を捨札にしてラッシュできる（牛折神はバトルエリアにいてもよい）（出典: atwiki/page-2147「追加条件：自軍「牛折神」1体を捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-038", "mg")], battle: [inst("XG4-037", "us")], command: releasedCat("MA", 1), power: powerCards(6) }), "player1", "XG4-038:mg");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-038:mg")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-037:us")).toBe("discard");
  });

  it("XG4-038: 追加条件 — 「牛折神」がいなければラッシュできない（出典: atwiki/page-2147）", () => {
    expect(canStartRush(board({ hand: [inst("XG4-038", "mg")], command: releasedCat("MA", 1), power: powerCards(6) }), "player1", "XG4-038:mg")).toBe(false);
  });

  const ENEMY = () => ({
    battle: [inst("SPEC-E-C0", "c0"), inst("SPEC-E-C3", "c3")],
    rush: [inst("SPEC-E-C2", "c2"), inst("SPEC-E-C2P", "c2p"), inst("SPEC-E-M2", "m2")],
    deck: deckCards(3, "e"),
  });
  const entered = () => settle(enterNow(battle({ rush: [inst("XG4-038", "mg")] }, ENEMY()), "XG4-038:mg"));

  it.fails("XG4-038:【猛牛大回転砲】— 自軍ターン中にバトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-2147「次の効果を発動できる」）（既知の不具合: CARD-XG4-038 【猛牛大回転砲】の選択が開かない（敵軍 S ユニットが山札の下に戻らない））", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-038");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-038:【猛牛大回転砲】— 発動すると、必要パワーの数字が2以下の敵軍 S ユニットすべて（どのエリアでも。2+ も含む）が持ち主の山札の下に戻る。3 の S ユニットと M ユニットは残る（出典: atwiki/page-2147「必要パワーの数字が2以下の敵軍Sユニットすべてを、持ち主の山札の下に好きな順で戻す」）（既知の不具合: CARD-XG4-038 【猛牛大回転砲】の選択が開かない（敵軍 S ユニットが山札の下に戻らない））", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-038");
    s = resolveAll(confirm(s));
    for (const id of ["SPEC-E-C0:c0", "SPEC-E-C2:c2", "SPEC-E-C2P:c2p"]) expect(zoneOf(s, "player2", id)).toBe("deck");
    expect(ids(s.players.player2.deck.slice(-3)).sort()).toEqual(["SPEC-E-C0:c0", "SPEC-E-C2:c2", "SPEC-E-C2P:c2p"]);
    expect(zoneOf(s, "player2", "SPEC-E-C3:c3")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E-M2:m2")).toBe("rush");
  });

  it("XG4-038:【猛牛大回転砲】— 発動しなければ何も戻らない（出典: atwiki/page-2147「発動できる」）", () => {
    let s = entered();
    if (s.pendingEffectChoice?.sourceCardId === "XG4-038") s = resolveAll(settle(s));
    expect(zoneOf(s, "player2", "SPEC-E-C0:c0")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-039 サムライハオー", () => {
  const TEXT =
    "合体―獅子折神＋龍折神＋亀折神＋熊折神＋猿折神＋兜折神＋舵木折神＋虎折神＋海老折神＋烏賊折神＋牛折神 ※これの追加条件を満たすとき、自軍捨札に合体ユニットと同名のカードがあれば、そのユニットは捨札にしなくてもよい。 【モヂカラ大弾円】これが自軍エリアにある間、自分がターンを終えるとき、敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。";

  it("XG4-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-2125）", () => {
    expectCatalogText("XG4-039", TEXT);
    expectUnit("XG4-039", { name: "サムライハオー", category: "MA", size: "L", bp: 24000, sp: 3, powerCost: "11+", comboNumber: undefined, features: ["侍", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG4-039", ["SR"]);
  });

  // 獅子・龍・亀・熊・猿・兜・舵木・虎・海老・烏賊・牛（RS-680〜684・XG1-035・XG1-036・XG1-040・XG3-035・XG3-037・XG4-037）。
  const PARTS = ["RS-680", "RS-681", "RS-682", "RS-683", "RS-684", "XG1-035", "XG1-036", "XG1-040", "XG3-035", "XG3-037", "XG4-037"];
  const parts = (except: string[] = []) => PARTS.filter((p) => !except.includes(p)).map((p, i) => inst(p, `p${i}`));
  const rb = (field: ReturnType<typeof inst>[], discard: ReturnType<typeof inst>[] = []) =>
    board({ hand: [inst("XG4-039", "sh")], rush: field.slice(0, 6), battle: field.slice(6), discard, command: releasedCat("MA", 1), power: powerCards(11) });

  it("XG4-039: 合体 — 11体の折神をすべて捨札にしてラッシュできる（出典: atwiki/page-2125「合体―獅子折神＋…＋牛折神」）", () => {
    const r = rushFromHand(rb(parts()), "player1", "XG4-039:sh");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-039:sh")).toBe("rush");
    expect(s.players.player1.discard.length).toBeGreaterThanOrEqual(11);
  });

  it("XG4-039: 合体 — 1体（亀折神）が欠けていて捨札にもなければラッシュできない（出典: atwiki/page-2125）", () => {
    expect(canStartRush(rb(parts(["RS-682"])), "player1", "XG4-039:sh")).toBe(false);
  });

  it.fails("XG4-039: ※ — 自軍捨札に亀折神と同名のカードがあれば、亀折神は場になくてもラッシュできる（出典: atwiki/page-2125「自軍捨札に合体ユニットと同名のカードがあれば、そのユニットは捨札にしなくてもよい」）（既知の不具合: CARD-XG4-039 捨札の同名カードで合体素材を代えられず、【モヂカラ大弾円】もターン終了時に働かない）", () => {
    const s = rb(parts(["RS-682"]), [inst("RS-682", "dk")]);
    expect(canStartRush(s, "player1", "XG4-039:sh")).toBe(true);
    const r = rushFromHand(s, "player1", "XG4-039:sh");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XG4-039:sh")).toBe("rush");
  });

  it("XG4-039: ※ — 必要パワー11は満たさなければならない（パワー10では不可）（出典: atwiki/page-2125「必要パワー：11+」）", () => {
    const s = board({ hand: [inst("XG4-039", "sh")], rush: parts().slice(0, 6), battle: parts().slice(6), command: releasedCat("MA", 1), power: powerCards(10) });
    expect(canStartRush(s, "player1", "XG4-039:sh")).toBe(false);
  });

  const ending = () =>
    endTurnKeep(battle({ rush: [inst("XG4-039", "sh")] }, { battle: [inst("SPEC-E-C3", "b")], rush: [inst("SPEC-E-M2", "r")], deck: deckCards(3, "e") }));

  it.fails("XG4-039:【モヂカラ大弾円】— 自分がターンを終えるとき、敵軍ユニット（どのエリアでも）を1体選ぶ（任意ではない）（出典: atwiki/page-2125「自分がターンを終えるとき、敵軍ユニットを1体選び」）（既知の不具合: CARD-XG4-039 捨札の同名カードで合体素材を代えられず、【モヂカラ大弾円】もターン終了時に働かない）", () => {
    const s = ending();
    expectChoiceFrom(s, "player1", "XG4-039");
    expect(choiceIds(s)).toEqual(["SPEC-E-C3:b", "SPEC-E-M2:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG4-039:【モヂカラ大弾円】— 選んだユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-2125「持ち主のパワーゾーンにダメージにして置く」）（既知の不具合: CARD-XG4-039 捨札の同名カードで合体素材を代えられず、【モヂカラ大弾円】もターン終了時に働かない）", () => {
    let s = ending();
    expectChoiceFrom(s, "player1", "XG4-039");
    s = resolveAll(pick(s, "SPEC-E-M2:r"));
    expect(isDamage(s, "player2", "SPEC-E-M2:r")).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG4-040 ゴセイグレート", () => {
  const TEXT =
    "合体―ゴセイドラゴン（またはゴセイレッド）＋ゴセイフェニックス（またはゴセイピンク）＋ゴセイスネーク（またはゴセイブラック）＋ゴセイタイガー（またはゴセイイエロー）＋ゴセイシャーク（またはゴセイブルー） ※ウイング ※ブラスト 【天装合体】これをラッシュしたとき、ウイングを持たない敵軍ユニットを1体選び持ち主のパワーゾーンにダメージにして置く。";

  it("XG4-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-2107）", () => {
    expectCatalogText("XG4-040", TEXT);
    expectUnit("XG4-040", { name: "ゴセイグレート", category: ["WB", "MA"], size: "L", bp: 18000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["魔法", "獣", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG4-040", ["NR"]);
  });

  // ゴセイレッド XG4-043・ゴセイピンク XG4-045・ゴセイブラック XG4-044・ゴセイイエロー XG4-041・ゴセイブルー XG4-042。
  const PARTS = ["XG4-043", "XG4-045", "XG4-044", "XG4-041", "XG4-042"];
  const cmd = () => [...releasedCat("WB", 1), ...releasedCat("MA", 1)];
  const ENEMY = () => ({ battle: [inst("SPEC-E-C3", "b")], rush: [inst("SPEC-E-M2", "r"), inst("XG4-043", "w")], deck: deckCards(3, "e") });
  const rb = (rush = PARTS.map((p, i) => inst(p, `g${i}`)), extra: Partial<GameState["players"]["player1"]> = {}) =>
    board({ hand: [inst("XG4-040", "gg")], rush, command: cmd(), power: powerCards(6), ...extra }, ENEMY());

  it("XG4-040: 合体 — ゴセイレッド・ピンク・ブラック・イエロー・ブルーを捨札にしてラッシュできる（出典: atwiki/page-2107「合体―ゴセイドラゴン（またはゴセイレッド）＋…」）", () => {
    const r = rushFromHand(rb(), "player1", "XG4-040:gg");
    expect(r.ok, r.error).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "XG4-040:gg")).toBe("rush");
    for (let i = 0; i < 5; i++) expect(zoneOf(s, "player1", `${PARTS[i]}:g${i}`)).toBe("discard");
  });

  it("XG4-040: 合体 — 1体（ゴセイブルー）が欠けていればラッシュできない（出典: atwiki/page-2107）", () => {
    expect(canStartRush(rb(PARTS.slice(0, 4).map((p, i) => inst(p, `g${i}`))), "player1", "XG4-040:gg")).toBe(false);
  });

  it("XG4-040: ※ブラスト — 自軍ダメージ6点（残り1点）で自軍 L ユニットがなければ、合体素材なしでラッシュできる（出典: atwiki/page-2107「※ブラスト」・grnrngr/faq-card-9 ブラスト・R-KW-BLAST-01）", () => {
    const s = rb([inst("TST-UNIT-0", "s")], { damage: 6 });
    expect(canStartRush(s, "player1", "XG4-040:gg")).toBe(true);
  });

  it("XG4-040: ※ブラスト — 自軍 L ユニットがあれば・残り2点なら追加条件は無視できない（出典: grnrngr/faq-card-9 ブラスト「残りダメージ１点で、自軍Ｌユニットが１体もなければ」）", () => {
    expect(canStartRush(rb([inst("TST-UNIT-7", "l")], { damage: 6 }), "player1", "XG4-040:gg")).toBe(false);
    expect(canStartRush(rb([inst("TST-UNIT-0", "s")], { damage: 5 }), "player1", "XG4-040:gg")).toBe(false);
  });

  wingTests("XG4-040", "atwiki/page-2107");

  it.fails("XG4-040:【天装合体】— ラッシュしたとき、ウイングを持たない敵軍ユニット（どのエリア・サイズでも）を1体選ぶ（ウイングを持つユニットは選べない。任意ではない）（出典: atwiki/page-2107「ウイングを持たない敵軍ユニットを1体選び」・カード評価「エリアやサイズを問わない」）（既知の不具合: CARD-XG4-040 【天装合体】の候補がラッシュエリアのユニットだけで、ウイングを持つユニットも入る（バトルエリアのユニットを選べない））", () => {
    const r = rushFromHand(rb(), "player1", "XG4-040:gg");
    expect(r.ok, r.error).toBe(true);
    const s = r.state;
    expectChoiceFrom(s, "player1", "XG4-040");
    expect(choiceIds(s)).toEqual(["SPEC-E-C3:b", "SPEC-E-M2:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG4-040:【天装合体】— 選んだユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-2107「持ち主のパワーゾーンにダメージにして置く」）（既知の不具合: CARD-XG4-040 【天装合体】の候補がラッシュエリアのユニットだけで、ウイングを持つユニットも入る（バトルエリアのユニットを選べない））", () => {
    const r = rushFromHand(rb(), "player1", "XG4-040:gg");
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    expectChoiceFrom(s, "player1", "XG4-040");
    s = resolveAll(pick(s, "SPEC-E-C3:b"));
    expect(isDamage(s, "player2", "SPEC-E-C3:b")).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG4-041 ゴセイイエロー（XG4）", () => {
  const TEXT = "※レジスト 【ソウテンダー】自分は1枚ドローしてから、自分の手札を1枚選び捨札にする。";

  it("XG4-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-2047）", () => {
    expectCatalogText("XG4-041", TEXT);
    expectUnit("XG4-041", { name: "ゴセイイエロー", category: ["WB", "MA"], size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["イエロー", "女"] });
    expectRarityIn("XG4-041", ["N"]);
  });

  it("XG4-041: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2047 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-041", "gy")] }, "XG4-041:gy"))).toBe(true);
  });

  const nc = () => settle(ncEnter("XG4-041:gy", 0, { hand: [inst("TST-UNIT-0", "h1")], deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] }, {}, EXTRA));

  it.fails("XG4-041: NC【ソウテンダー】— 1番目に出ると1枚ドローし、その後ドローしたカードを含む手札から1枚選ぶ（任意ではない）（出典: atwiki/page-2047「自分は1枚ドローしてから、自分の手札を1枚選び捨札にする」）（既知の不具合: CARD-XG4-041 NC【ソウテンダー】がログに出るだけでドロー・捨札をしない）", () => {
    const s = nc();
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG4-041");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:h1", "TST-UNIT-0:top"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG4-041: NC — 選んだ手札は捨札になり（出典: atwiki/page-2047「捨札にする」）（既知の不具合: CARD-XG4-041 NC【ソウテンダー】がログに出るだけでドロー・捨札をしない）", () => {
    let s = nc();
    expectChoiceFrom(s, "player1", "XG4-041");
    s = resolveAll(pick(s, "TST-UNIT-0:h1"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("hand");
  });
});

// ===========================================================================
describe("XG4-042 ゴセイブルー（XG4）", () => {
  const TEXT = "※タクスMA ※スクラム 【シーイックボウガン】「SP1」";

  it("XG4-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-2051）", () => {
    expectCatalogText("XG4-042", TEXT);
    expectUnit("XG4-042", { name: "ゴセイブルー", category: ["WB", "MA"], size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 2, features: ["ブルー", "男"] });
    expectRarityIn("XG4-042", ["N"]);
  });

  taxTests("XG4-042", "MA", "atwiki/page-2051");
  scrumTests("XG4-042", 2, "atwiki/page-2051");

  it("XG4-042: NC【シーイックボウガン】— 2番目に出ると「SP1」を得る（出典: atwiki/page-2051「「SP1」」）", () => {
    expect(spOf(settle(ncEnter("XG4-042:gb", 1, {}, {}, EXTRA)), "player1", "XG4-042:gb")).toBe(1);
  });

  it("XG4-042: NC — 2番目以外（1番目）に出ても「SP1」は得ない（出典: atwiki/page-2051「CN：2」）", () => {
    expect(spOf(settle(ncEnter("XG4-042:gb", 0, {}, {}, EXTRA)), "player1", "XG4-042:gb")).toBe(0);
  });
});

// ===========================================================================
describe("XG4-043 ゴセイレッド（XG4）", () => {
  const TEXT = "※ウイング 【スカイックソード】「SP1」";

  it("XG4-043: カタログ本文・スペックが出典と一致（出典: atwiki/page-2046）", () => {
    expectCatalogText("XG4-043", TEXT);
    expectUnit("XG4-043", { name: "ゴセイレッド", category: ["WB", "MA"], size: "S", bp: 3000, sp: "special", powerCost: 1, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG4-043", ["R"]);
  });

  wingTests("XG4-043", "atwiki/page-2046");

  it("XG4-043: NC【スカイックソード】— 3番目に出ると「SP1」を得る（出典: atwiki/page-2046「「SP1」」）", () => {
    expect(spOf(settle(ncEnter("XG4-043:gr", 2, {}, {}, EXTRA)), "player1", "XG4-043:gr")).toBe(1);
  });

  it("XG4-043: NC — 3番目以外（2番目）に出ても「SP1」は得ない（出典: atwiki/page-2046「CN：3」）", () => {
    expect(spOf(settle(ncEnter("XG4-043:gr", 1, {}, {}, EXTRA)), "player1", "XG4-043:gr")).toBe(0);
  });
});
