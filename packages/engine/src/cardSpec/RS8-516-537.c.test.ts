/**
 * カード別スペック: RS-533〜RS-537（第8弾「究極の八神」チェンジマン S ユニット）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-533 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-KW-SCRUM-01、R-KW-TAXIS、R-KW-RESIST-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  attackTargets,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  passEntry,
  pick,
  resolveAll,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  registerTests,
} from "./RS8-516-537.helpers";
import type { GameState } from "../types/game";

/** 敵軍（player2）ターン: player1 のバトルエリアに [unit, next] を並べ、unit がアタックされないか。 */
function scrumProtected(unit: string, next: number | null): boolean {
  const NEXT = sUnit("SPEC-SCRUM-NEXT", { comboNumber: next ?? undefined });
  const battle = [inst(unit, "sc"), ...(next !== null ? [inst("SPEC-SCRUM-NEXT", "nx")] : [])];
  const s = st({ activePlayer: "player2", player1: { battle, deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }, [NEXT]);
  return !attackTargets(s, "TST-UNIT-7:atk", "player2").includes(`${unit}:sc`);
}

/** タクスMA の共通テスト（2番目にあるとき、次に並ぶ MA の S ユニットが SP1 を得る）。 */
function taxisTests(id: string, page: string) {
  const MA_BLANK = sUnit("SPEC-MA-BLANK", { category: "MA", sp: undefined });
  const WB_BLANK = sUnit("SPEC-WB-BLANK", { category: "WB", sp: undefined });
  const MA_M = sUnit("SPEC-MA-MBLANK", { category: "MA", sp: undefined, size: "M" });
  const line = (before: number, next: string) =>
    enterSeq(st({ player1: { battle: fill(before), rush: [inst(id, "tx"), inst(next, "n")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [MA_BLANK, WB_BLANK, MA_M]), [`${id}:tx`, `${next}:n`]);

  it(`${id}: ※タクスMA — これが2番目にある間、次（3番目）に並ぶ MA の S ユニット（SP 空欄）は SP1 を得る（出典: ${page}「※タクスMA」）`, () => {
    expect(spOf(line(1, "SPEC-MA-BLANK"), "player1", "SPEC-MA-BLANK:n")).toBe(1);
  });

  it(`${id}: ※タクスMA — MA を持たない S ユニット・MA の M ユニットは SP1 を得ない（出典: ${page}「MAを持つSユニット」）`, () => {
    expect(spOf(line(1, "SPEC-WB-BLANK"), "player1", "SPEC-WB-BLANK:n")).toBe(0);
    expect(spOf(line(1, "SPEC-MA-MBLANK"), "player1", "SPEC-MA-MBLANK:n")).toBe(0);
  });

  it(`${id}: ※タクスMA — これが2番目でない（1番目）ときは次のユニットは SP1 を得ない（出典: ${page}「これがバトルエリアの2番目にある間」）`, () => {
    expect(spOf(line(0, "SPEC-MA-BLANK"), "player1", "SPEC-MA-BLANK:n")).toBe(0);
  });
}

/** 自軍バトルフェイズ: fillers の後に id を position 番目に出す。 */
function ncAt(
  id: string,
  position: number,
  p2: Partial<GameState["players"]["player2"]> = {},
  p1: Partial<GameState["players"]["player1"]> = {},
  extra: Parameters<typeof st>[1] = [],
) {
  const s = st({ player1: { battle: fill(position - 1), rush: [inst(id, "x")], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, extra);
  return enter(s, `${id}:x`);
}

const COST1 = sUnit("SPEC-COST1", { powerCost: 1, bp: 2000 });
const COST2 = sUnit("SPEC-COST2", { powerCost: 2, bp: 2000 });
const COST1_M = sUnit("SPEC-COST1-M", { powerCost: 1, size: "M" });
const DRAGON = sUnit("SPEC-DRAGON", { features: ["ドラゴン"] });
const EXTRA = [COST1, COST2, COST1_M, DRAGON];

// ===========================================================================
describe("RS-533 チェンジフェニックス", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない） 【フェニックスファイヤー】このターン、敵軍ユニットを持ち主のパワーゾーンにダメージにして置くたび、自分は1枚ドローしてもよい。";

  /** 自軍バトルフェイズ: フェニックス（1番目・NC）→ 2・3番目 → チェンジグリフォン（4番目・NC。手札1枚なので必要パワー1の敵軍 S をダメージにする）。 */
  const combo = (withPhoenix = true) => {
    const rush = [...(withPhoenix ? [inst("RS-533", "ph")] : [inst("TST-UNIT-0", "np")]), ...fill(2), inst("RS-536", "gr")];
    let s = st(
      { player1: { rush, hand: [inst("TST-OP", "h0")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-COST1", "e1")], deck: deckCards(3, "e") } },
      EXTRA,
    );
    s = enter(s, rush[0]!.instanceId);
    // エンジンは NC で敵軍ユニットをダメージにする選択を誤って出す（下の it.fails 参照）。ここでは見送って先へ進む。
    if (s.pendingEffectChoice?.sourceCardId === "RS-533") s = skip(s);
    s = enterSeq(s, rush.slice(1, 3).map((c) => c.instanceId));
    s = resolveAll(s);
    s = enter(passEntry(s), "RS-536:gr");
    // グリフォンの選択で敵軍 S ユニットをダメージにする。
    if (s.pendingEffectChoice?.validInstanceIds.includes("SPEC-COST1:e1")) s = pick(s, "SPEC-COST1:e1");
    return s;
  };

  it("RS-533: カタログ本文・スペックが出典と一致（出典: atwiki/page-1160）", () => {
    expectCatalogText("RS-533", TEXT);
    expectStats("RS-533", { name: "チェンジフェニックス", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 1, comboNumber: 1, features: ["ピンク", "女"] });
  });

  it("RS-533: ※スクラム — CN2 のユニットが次に並んでいる間はアタックされず、いなければアタックされうる（出典: atwiki/page-1160・R-KW-SCRUM-01）", () => {
    expect(scrumProtected("RS-533", 2)).toBe(true);
    expect(scrumProtected("RS-533", null)).toBe(false);
    expect(scrumProtected("RS-533", 3)).toBe(false);
  });

  it("RS-533: 対照 — 【フェニックスファイヤー】がなければ、敵軍ユニットをダメージにしてもドローしない（出典: atwiki/page-1160）", () => {
    const s = resolveAll(combo(false));
    expect(zoneOf(s, "player2", "SPEC-COST1:e1")).toBe("power");
    expect(s.players.player1.hand).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-533 【フェニックスファイヤー】が未実装（ダメージにして置いてもドローの機会がない）
  it.fails("RS-533: 【フェニックスファイヤー】（NC）のターン中、敵軍ユニットを持ち主のパワーゾーンにダメージにして置くと1枚ドローできる（出典: atwiki/page-1160「このターン、敵軍ユニットを持ち主のパワーゾーンにダメージにして置くたび、自分は1枚ドローしてもよい」）", () => {
    let s = combo();
    expect(zoneOf(s, "player2", "SPEC-COST1:e1")).toBe("power");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-533");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s, ["TST-OP:dk0"]);
    expect(s.players.player1.hand).toHaveLength(2);
  });

  it("RS-533: 【フェニックスファイヤー】「ドローしてもよい」— ドローしないことを選べる（出典: atwiki/page-1160）", () => {
    let s = combo();
    if (s.pendingEffectChoice?.sourceCardId === "RS-533") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  // 既知の不具合: CARD-RS-533 NC が「敵軍ユニットを1体選びダメージにして置く」効果として実装されている（本文にない除去）
  it.fails("RS-533: 【フェニックスファイヤー】自体は敵軍ユニットをダメージにしない（NC で敵軍ユニットを選ぶ選択は出ない）（出典: atwiki/page-1160「このターン、敵軍ユニットを…ダメージにして置くたび、自分は1枚ドローしてもよい」）", () => {
    const s = ncAt("RS-533", 1, { battle: [inst("SPEC-COST1", "e1")] }, {}, EXTRA);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("SPEC-COST1:e1");
    expect(zoneOf(resolveAll(s, ["SPEC-COST1:e1"]), "player2", "SPEC-COST1:e1")).toBe("battle");
  });

  it("RS-533: NC — 1番目以外（2番目）に出たときは【フェニックスファイヤー】を発動しない（出典: R-CN-02）", () => {
    const s = ncAt("RS-533", 2);
    expect(s.log.some((l) => l.includes("number_combo") && l.includes("RS-533"))).toBe(false);
  });

  it.todo(
    "RS-533: Q&A — 【フェニックスファイヤー】を発動したターンに冥府神トードの【魂のコレクション】で敵軍 S ユニットをダメージにして置けばドローできる（出典: grnrngr/faq-card-8 RS-533 Q「はい、可能です」）— 【フェニックスファイヤー】自体が未実装（上の it.fails）で、トードとの組み合わせでもドローの機会が生じない（RS6-411-431 の RS-416 todo と同じ）",
  );
});

// ===========================================================================
describe("RS-534 チェンジペガサス", () => {
  const TEXT =
    "※タクスMA（これがバトルエリアの2番目にある間、これの次に並ぶMAを持つSユニットは「SP1」を得る） 【ペガサスイナズマスパーク】これは敵軍ラッシュエリアのホールド状態のユニットにアタックできる。";

  it("RS-534: カタログ本文・スペックが出典と一致（出典: atwiki/page-1161）", () => {
    expectCatalogText("RS-534", TEXT);
    expectStats("RS-534", { name: "チェンジペガサス", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["ブルー", "男"] });
  });

  taxisTests("RS-534", "atwiki/page-1161");

  const p2 = (): Partial<GameState["players"]["player2"]> => ({
    rush: [held("TST-UNIT-0", "eh"), inst("TST-UNIT-0", "er"), held("TST-UNIT-2", "ehm")],
    battle: [inst("TST-UNIT-0", "eb")],
  });

  it("RS-534: 【ペガサスイナズマスパーク】（NC・2番目）敵軍ラッシュエリアのホールド状態のユニット（サイズ不問）にアタックできる。リリース状態のユニットにはアタックできない（出典: atwiki/page-1161「敵軍ラッシュエリアのホールド状態のユニットにアタックできる」）", () => {
    const s = resolveAll(ncAt("RS-534", 2, p2()));
    const targets = attackTargets(s, "RS-534:x");
    expect(targets).toContain("TST-UNIT-0:eh");
    expect(targets).toContain("TST-UNIT-2:ehm");
    expect(targets).toContain("TST-UNIT-0:eb");
    expect(targets).not.toContain("TST-UNIT-0:er");
  });

  // 既知の不具合: CARD-RS-534 NC が成立していなくても敵軍ラッシュエリアのホールド状態のユニットにアタックできる
  it.fails("RS-534: NC — 2番目以外（3番目）では敵軍ラッシュエリアのユニットにアタックできない（出典: R-CN-02）", () => {
    const s = resolveAll(ncAt("RS-534", 3, p2()));
    const targets = attackTargets(s, "RS-534:x");
    expect(targets).not.toContain("TST-UNIT-0:eh");
    expect(targets).toContain("TST-UNIT-0:eb");
  });
});

// ===========================================================================
describe("RS-535 チェンジドラゴン", () => {
  const TEXT =
    "※レジスト ※これは自軍バトルエリアにある間、特徴「ドラゴン」が追加される。 【ドラゴンアタック】特徴「ドラゴン」を持つ自軍ユニットが1体以上あれば、その数と同じ必要パワーの数字を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RS-535: カタログ本文・スペックが出典と一致（出典: atwiki/page-1222）", () => {
    expectCatalogText("RS-535", TEXT);
    expectStats("RS-535", { name: "チェンジドラゴン", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: 3, features: ["レッド", "男"] });
  });

  registerTests("RS-535", "atwiki/page-1222");

  const enemy = (): Partial<GameState["players"]["player2"]> => ({
    battle: [inst("SPEC-COST1", "b1"), inst("SPEC-COST2", "b2")],
    rush: [inst("SPEC-COST1-M", "r1m")],
  });

  // 既知の不具合: CARD-RS-535 【ドラゴンアタック】が未実装（NC のログだけで何も起きない）
  it.fails("RS-535: 【ドラゴンアタック】（NC・3番目）自軍バトルエリアのこれ自身が「ドラゴン」として数えられ（1体）、必要パワー1の敵軍ユニット（エリア・サイズ不問）を選べる（出典: atwiki/page-1222「これは自軍バトルエリアにある間、特徴「ドラゴン」が追加される」「その数と同じ必要パワーの数字を持つ敵軍ユニット」）", () => {
    const s = ncAt("RS-535", 3, enemy(), {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-535");
    expect(choiceIds(s)).toEqual(["SPEC-COST1-M:r1m", "SPEC-COST1:b1"]);
  });

  // 既知の不具合: CARD-RS-535 【ドラゴンアタック】が未実装
  it.fails("RS-535: 【ドラゴンアタック】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1222「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(ncAt("RS-535", 3, enemy(), {}, EXTRA), "SPEC-COST1:b1"));
    expect(zoneOf(s, "player2", "SPEC-COST1:b1")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-COST1:b1")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // 既知の不具合: CARD-RS-535 【ドラゴンアタック】が未実装
  it.fails("RS-535: 【ドラゴンアタック】自軍に特徴「ドラゴン」のユニットがもう1体いれば数は2になり、必要パワー2の敵軍ユニットを選ぶ（出典: atwiki/page-1222「その数と同じ」）", () => {
    const s = ncAt("RS-535", 3, enemy(), { battle: [inst("SPEC-DRAGON", "dr"), ...fill(1)] }, EXTRA);
    expect(choiceIds(s)).toEqual(["SPEC-COST2:b2"]);
  });

  // 既知の不具合: CARD-RS-535 【ドラゴンアタック】が未実装（選択が出ない）
  it.fails("RS-535: 【ドラゴンアタック】「置いてもよい」— 見送れる（出典: atwiki/page-1222）", () => {
    const s0 = ncAt("RS-535", 3, enemy(), {}, EXTRA);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "SPEC-COST1:b1")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-535: NC — 3番目以外（2番目）では【ドラゴンアタック】は発動しない（出典: R-CN-02）", () => {
    const s = ncAt("RS-535", 2, enemy(), {}, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-535");
  });
});

// ===========================================================================
describe("RS-536 チェンジグリフォン", () => {
  const TEXT =
    "【グリフォンマグマギャラクシィ】自分の手札が1枚以上あれば、その枚数と同じ数の必要パワーの数字を持つ敵軍バトルエリアのSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";
  const enemy = (): Partial<GameState["players"]["player2"]> => ({
    battle: [inst("SPEC-COST1", "b1"), inst("SPEC-COST2", "b2"), inst("SPEC-COST1-M", "b1m")],
    rush: [inst("SPEC-COST1", "r1")],
  });
  const hand = (n: number) => ({ hand: deckCards(n, "hd") });

  it("RS-536: カタログ本文・スペックが出典と一致（出典: atwiki/page-1162）", () => {
    expectCatalogText("RS-536", TEXT);
    expectStats("RS-536", { name: "チェンジグリフォン", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 4, features: ["ブラック", "男"] });
  });

  // 既知の不具合: CARD-RS-536 候補が「手札の枚数と同じ必要パワー」に絞られていない（必要パワー2も候補）
  it.fails("RS-536: 【グリフォンマグマギャラクシィ】（NC・4番目）手札1枚なら、必要パワー1の敵軍バトルエリアの S ユニットだけを選べる（ラッシュエリア・M ユニットは不可）（出典: atwiki/page-1162「その枚数と同じ数の必要パワーの数字を持つ敵軍バトルエリアのSユニット」）", () => {
    const s = ncAt("RS-536", 4, enemy(), hand(1), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-536");
    expect(choiceIds(s)).toEqual(["SPEC-COST1:b1"]);
  });

  it("RS-536: 【グリフォンマグマギャラクシィ】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1162）", () => {
    const s = resolveAll(pick(ncAt("RS-536", 4, enemy(), hand(1), EXTRA), "SPEC-COST1:b1"));
    expect(zoneOf(s, "player2", "SPEC-COST1:b1")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-COST1:b1")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // 既知の不具合: CARD-RS-536 候補が手札の枚数で絞られていない
  it.fails("RS-536: 【グリフォンマグマギャラクシィ】手札2枚なら必要パワー2の S ユニットを選ぶ（出典: atwiki/page-1162「その枚数と同じ数」）", () => {
    const s = ncAt("RS-536", 4, enemy(), hand(2), EXTRA);
    expect(choiceIds(s)).toEqual(["SPEC-COST2:b2"]);
  });

  // 既知の不具合: CARD-RS-536 手札0枚でも発動する
  it.fails("RS-536: 【グリフォンマグマギャラクシィ】手札が0枚なら発動しない（出典: atwiki/page-1162「自分の手札が1枚以上あれば」）", () => {
    const s = ncAt("RS-536", 4, { ...enemy(), battle: [inst("SPEC-COST1", "b1")] }, hand(0), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-536");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-COST1:b1")).toBe("battle");
  });

  it("RS-536: 【グリフォンマグマギャラクシィ】「置いてもよい」— 見送れる（出典: atwiki/page-1162）", () => {
    const s0 = ncAt("RS-536", 4, enemy(), hand(1), EXTRA);
    expect(canSkip(s0)).toBe(true);
    expect(zoneOf(resolveAll(skip(s0)), "player2", "SPEC-COST1:b1")).toBe("battle");
  });

  it("RS-536: NC — 4番目以外（3番目）では発動しない（出典: R-CN-02）", () => {
    const s = ncAt("RS-536", 3, enemy(), hand(1), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-536");
  });
});

// ===========================================================================
describe("RS-537 チェンジマーメイド", () => {
  const TEXT =
    "※タクスMA（これがバトルエリアの2番目にある間、これの次に並ぶMAを持つSユニットは「SP1」を得る） 【マーメイドタイフーンウェーブ】ホールド状態のSユニットをすべて持ち主の手札に戻してもよい。";

  it("RS-537: カタログ本文・スペックが出典と一致（出典: atwiki/page-1163）", () => {
    expectCatalogText("RS-537", TEXT);
    expectStats("RS-537", { name: "チェンジマーメイド", category: "MA", size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: 5, features: ["ホワイト", "女"] });
  });

  taxisTests("RS-537", "atwiki/page-1163");

  const field = () =>
    ncAt(
      "RS-537",
      5,
      { rush: [held("TST-UNIT-0", "eh"), inst("TST-UNIT-0", "er"), held("TST-UNIT-2", "ehm")], battle: [held("TST-UNIT-0", "ebh")] },
      { rush: [inst("RS-537", "x"), held("TST-UNIT-0", "mh")], battle: [held("TST-UNIT-0", "mbh"), ...fill(3)] },
    );

  // 既知の不具合: CARD-RS-537 「すべて」ではなく敵軍バトルエリアのユニットを1体選んで戻すだけ（自軍・ラッシュエリアのホールド S が戻らない）
  it.fails("RS-537: 【マーメイドタイフーンウェーブ】（NC・5番目）自軍・敵軍のホールド状態の S ユニット（ラッシュエリア・バトルエリア）をすべて持ち主の手札に戻す。リリース状態・M ユニットは戻らない（出典: atwiki/page-1163「ホールド状態のSユニットをすべて持ち主の手札に戻してもよい」）", () => {
    let s = field();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-537");
    s = resolveAll(s, ["RS-537:x"]);
    for (const id of ["TST-UNIT-0:eh", "TST-UNIT-0:ebh"]) expect(zoneOf(s, "player2", id)).toBe("hand");
    for (const id of ["TST-UNIT-0:mh", "TST-UNIT-0:mbh"]) expect(zoneOf(s, "player1", id)).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-2:ehm")).toBe("rush");
  });

  it("RS-537: 【マーメイドタイフーンウェーブ】「戻してもよい」— 見送れば何も戻らない（出典: atwiki/page-1163）", () => {
    const s0 = field();
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:mh")).toBe("rush");
  });

  it("RS-537: NC — 5番目以外（4番目）では発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(ncAt("RS-537", 4, { rush: [held("TST-UNIT-0", "eh")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh")).toBe("rush");
  });
});
