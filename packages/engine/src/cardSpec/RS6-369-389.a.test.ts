/**
 * カード別スペック: RS-369〜RS-375（第6弾「紅き六戦士の帰還」ブルーマスク〜レッドレーサー（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html）、
 *     grnrngr/faq-card-8 の RS-374 Q（RS-600 ゴーオンシルバーの項）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  featUnit,
  kibaShot,
  fillers,
  inst,
  legal,
  offeredTo,
  pick,
  powerCards,
  reanimateTests,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toEndOfTurn,
  zoneOf,
  zordDownTests,
} from "./RS6-369-389.helpers";
import type { GameState } from "../types/game";

const FEMALE = featUnit("SPEC-FEMALE", ["女"]);
const MALE = featUnit("SPEC-MALE", ["男"]);
const SPECS = [FEMALE, MALE];

/** player1 のバトルフェイズに id を (cn-1) 体の後ろ（cn 番目）に出す。 */
function ncEnter(
  id: string,
  cn: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
) {
  const s = st(
    {
      player1: { rush: [inst(id, "x")], battle: fillers(cn - 1), deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

// ===========================================================================
describe("RS-369 ブルーマスク", () => {
  const TEXT =
    "【双手剣】SP1 相手は自分自身のラッシュエリアからユニットを1体選ぶ（自軍ダメージが4点以上あれば自分が選ぶ）。このターン、このユニットは、選んだユニットにアタックできる。";

  it("RS-369: カタログ本文・スペックが出典と一致（出典: atwiki/page-565）", () => {
    expectCatalogText("RS-369", TEXT);
    expectStats("RS-369", {
      name: "ブルーマスク",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  // 「【双手剣】SP1」— SP！のユニットは NC 成立で SP1 になる（R-CN-02）。
  it("RS-369: 【双手剣】NC 成立（3番目に出る）で SP1 になり、ストライクできる（出典: atwiki/page-565「【双手剣】SP1」）", () => {
    const s = ncEnter("RS-369", 3);
    expect(spOf(s, "player1", "RS-369:x")).toBe(1);
    expect(canStrike(s, "RS-369:x")).toBe(true);
  });

  it("RS-369: NC 不成立（1番目に出る）なら SP はなく、ストライクできない（出典: atwiki/page-565「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-369", 1);
    expect(spOf(s, "player1", "RS-369:x")).toBe(0);
    expect(canStrike(s, "RS-369:x")).toBe(false);
  });

  it("RS-369: 【双手剣】自軍ダメージ3点以下なら、相手が自分自身のラッシュエリアからユニットを1体選ぶ（出典: atwiki/page-565「相手は自分自身のラッシュエリアからユニットを1体選ぶ」）", () => {
    const s = ncEnter("RS-369", 3, { power: damageCards(3) }, { rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-2", "r2")], battle: [inst("TST-UNIT-0", "b")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:r1", "TST-UNIT-2:r2"]);
  });

  it("RS-369: 【双手剣】自軍ダメージ4点以上なら自分が選ぶ（出典: atwiki/page-565「自軍ダメージが4点以上あれば自分が選ぶ」）", () => {
    const s = ncEnter("RS-369", 3, { power: damageCards(4) }, { rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-2", "r2")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:r1", "TST-UNIT-2:r2"]);
  });

  it("RS-369: 【双手剣】このターン、選んだ敵軍ラッシュエリアのユニットにアタックでき、選ばなかったものにはアタックできない（出典: atwiki/page-565「このユニットは、選んだユニットにアタックできる」）", () => {
    let s = ncEnter("RS-369", 3, { power: damageCards(4) }, { rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-2", "r2")] });
    s = pick(s, "TST-UNIT-2:r2");
    expect(attackTargets(s, "RS-369:x")).toContain("TST-UNIT-2:r2");
    expect(attackTargets(s, "RS-369:x")).not.toContain("TST-UNIT-0:r1");
  });

  it("RS-369: NC 不成立なら敵軍ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-565・R-CN-02）", () => {
    const s = ncEnter("RS-369", 1, { power: damageCards(4) }, { rush: [inst("TST-UNIT-0", "r1")] });
    expect(attackTargets(s, "RS-369:x")).not.toContain("TST-UNIT-0:r1");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-370 ブラックマスク", () => {
  const TEXT =
    "※これは、特徴「女」を持つ敵軍ユニットがあるときストライクできない（この制限は自軍ダメージが4点以上あれば無効になる）。 【マスキーロッド】SP1";

  it("RS-370: カタログ本文・スペックが出典と一致（出典: atwiki/page-566）", () => {
    expectCatalogText("RS-370", TEXT);
    expectStats("RS-370", {
      name: "ブラックマスク",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 1,
      comboNumber: 3,
      features: ["ブラック", "男"],
    });
  });

  it.fails("RS-370: 【マスキーロッド】NC 成立（3番目）で SP1 になり、特徴「女」の敵軍ユニットがなければストライクできる（出典: atwiki/page-566「【マスキーロッド】SP1」）", () => {
    // 既知の不具合: CARD-RS-370 3番目に出ても NC が成立せず（ログなし）SP1 にならない
    const s = ncEnter("RS-370", 3, {}, { battle: [inst("SPEC-MALE", "m")] });
    expect(spOf(s, "player1", "RS-370:x")).toBe(1);
    expect(canStrike(s, "RS-370:x")).toBe(true);
  });

  it("RS-370: NC 不成立（1番目）ならストライクできない（出典: atwiki/page-566「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-370", 1);
    expect(canStrike(s, "RS-370:x")).toBe(false);
  });

  it("RS-370: ※ 特徴「女」を持つ敵軍ユニット（バトルエリア）があるとき、NC が成立してもストライクできない（出典: atwiki/page-566「特徴「女」を持つ敵軍ユニットがあるときストライクできない」）", () => {
    const s = ncEnter("RS-370", 3, {}, { battle: [inst("SPEC-FEMALE", "f")] });
    expect(canStrike(s, "RS-370:x")).toBe(false);
  });

  it("RS-370: ※ 特徴「女」を持つ敵軍ユニットがラッシュエリアにあってもストライクできない（出典: atwiki/page-566「敵軍ユニットがあるとき」— エリアを問わない）", () => {
    const s = ncEnter("RS-370", 3, {}, { rush: [inst("SPEC-FEMALE", "f")] });
    expect(canStrike(s, "RS-370:x")).toBe(false);
  });

  it.fails("RS-370: ※ 自軍ダメージが4点以上なら制限は無効になり、「女」の敵軍ユニットがいてもストライクできる（出典: atwiki/page-566「この制限は自軍ダメージが4点以上あれば無効になる」）", () => {
    // 既知の不具合: CARD-RS-370 NC が成立せず SP1 にならないため、ストライクできない
    const s = ncEnter("RS-370", 3, { power: damageCards(4) }, { battle: [inst("SPEC-FEMALE", "f")] });
    expect(canStrike(s, "RS-370:x")).toBe(true);
  });

  it.fails("RS-370: ※ 自軍の「女」のユニットは制限に関係しない — 敵軍に「女」がなく自軍に「女」がいれば、NC 成立でストライクできる（出典: atwiki/page-566「特徴「女」を持つ敵軍ユニット」）", () => {
    // 既知の不具合: CARD-RS-370 3番目に出ても NC が成立せず SP1 にならない
    const s = ncEnter("RS-370", 3, { battle: [inst("SPEC-FEMALE", "own"), ...fillers(1)] });
    expect(canStrike(s, "RS-370:x")).toBe(true);
  });
});

// ===========================================================================
describe("RS-371 ピンクマスク", () => {
  const TEXT =
    "【マスキーリボン】追加条件を持たない敵軍ユニットを、自軍ダメージの数まで選び持ち主の手札に戻す。その後、自分がターンを終えるとき、相手は自分自身の手札からユニットカードを好きな枚数選び、自分自身のラッシュエリアに出してもよい（ただし、必要パワーと追加条件は満たすこと）。このとき、出したユニットの効果は発動しない。";

  it("RS-371: カタログ本文・スペックが出典と一致（出典: atwiki/page-567）", () => {
    expectCatalogText("RS-371", TEXT);
    expectStats("RS-371", {
      name: "ピンクマスク",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 2,
      features: ["ピンク", "女"],
    });
  });

  it("RS-371: 【マスキーリボン】NC 成立（2番目）で、追加条件を持たない敵軍バトルエリアのユニットを選んで持ち主の手札に戻せる（出典: atwiki/page-567）", () => {
    let s = ncEnter("RS-371", 2, { power: damageCards(1) }, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(choiceIds(s)).toContain("TST-UNIT-0:e1");
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
  });

  it.fails("RS-371: 【マスキーリボン】敵軍ラッシュエリアのユニットも選べる（出典: atwiki/page-567「追加条件を持たない敵軍ユニット」— エリアを問わない。評価欄「エリアもサイズも問わない」）", () => {
    // 既知の不具合: CARD-RS-371 候補が敵軍バトルエリアに限られ、ラッシュエリアのユニットを選べない
    const s = ncEnter("RS-371", 2, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-2", "r1")] });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-2:r1"]);
  });

  it.fails("RS-371: 【マスキーリボン】追加条件を持つ敵軍ユニット（ファイブレッドFT）は選べない（出典: atwiki/page-567「追加条件を持たない」・grnrngr/faq-card-6 RS-430 Q「追加条件の記述欄に記述のあるものはすべて「追加条件を持つ」」）", () => {
    // 既知の不具合: CARD-RS-371 追加条件を持つユニット（必要パワー「7-」のファイブレッドFT）も候補に入る
    const s = ncEnter("RS-371", 2, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1"), inst("RS-373", "ft")] });
    expect(choiceIds(s)).toContain("TST-UNIT-0:e1");
    expect(choiceIds(s)).not.toContain("RS-373:ft");
  });

  it.fails("RS-371: 【マスキーリボン】自軍ダメージの数まで（2点なら2体）手札に戻せる（出典: atwiki/page-567「自軍ダメージの数まで選び」）", () => {
    // 既知の不具合: CARD-RS-371 自軍ダメージに関係なく1体しか選べない
    let s = ncEnter("RS-371", 2, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "e2"), inst("TST-UNIT-0", "e3")] });
    s = pick(s, "TST-UNIT-0:e1");
    s = pick(s, "TST-UNIT-2:e2");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e3")).toBe("battle");
  });

  it.fails("RS-371: 【マスキーリボン】自軍ダメージが0点なら1体も戻せない（出典: atwiki/page-567「自軍ダメージの数まで」）", () => {
    // 既知の不具合: CARD-RS-371 自軍ダメージ0でも1体選べる
    const s = ncEnter("RS-371", 2, {}, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(choiceIds(s)).toEqual([]);
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-371: NC 不成立（1番目）なら【マスキーリボン】は発動しない（出典: atwiki/page-567「CN：2」・R-CN-02）", () => {
    const s = ncEnter("RS-371", 1, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  // grnrngr/faq-card-6 RS-371「その場合は、任意の数を選んで戻させることができます。」
  it("RS-371: 公式Q&A — ダメージ5点・候補3体でも、任意の数（1体）だけ選んで戻すことができる（出典: grnrngr/faq-card-6 RS-371 Q）", () => {
    let s = ncEnter("RS-371", 2, { power: damageCards(5) }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], rush: [inst("TST-UNIT-0", "r1")] });
    s = pick(s, "TST-UNIT-0:e1");
    if (s.pendingEffectChoice?.sourceCardId === "RS-371" && legal(s).some((a) => a.type === "confirm_effect_choice")) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r1")).toBe("rush");
  });

  it.fails("RS-371: 公式Q&A — ダメージ5点・候補3体（ラッシュエリア含む）なら3体すべて戻すこともできる（出典: grnrngr/faq-card-6 RS-371 Q「任意の数を選んで戻させることができます」）", () => {
    // 既知の不具合: CARD-RS-371 1体しか選べず、ラッシュエリアのユニットも選べない
    let s = ncEnter("RS-371", 2, { power: damageCards(5) }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], rush: [inst("TST-UNIT-0", "r1")] });
    s = pick(pick(pick(s, "TST-UNIT-0:e1"), "TST-UNIT-0:e2"), "TST-UNIT-0:r1");
    s = resolveAll(s);
    expect(s.players.player2.hand.map((c) => c.instanceId).sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:r1"]);
  });

  it("RS-371: 【マスキーリボン】の選択は任意（「まで」）— 1体も戻さないことを選べる（出典: atwiki/page-567「自軍ダメージの数まで選び」・grnrngr/faq-card-6 RS-371 Q「任意の数」）", () => {
    let s = ncEnter("RS-371", 2, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it.fails("RS-371: 【マスキーリボン】その後、自分がターンを終えるとき、相手は手札のユニットカードを自分自身のラッシュエリアに出せる（出典: atwiki/page-567「自分がターンを終えるとき、相手は…ラッシュエリアに出してもよい」・評価欄コメント「自軍エンドフェイズに」）", () => {
    // 既知の不具合: CARD-RS-371 ターン終了時に相手が手札からラッシュエリアに出す処理がない
    let s = ncEnter("RS-371", 2, { power: damageCards(1) }, { battle: [inst("TST-UNIT-0", "e1")], power: powerCards(3) });
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    s = toEndOfTurn(s);
    expect(offeredTo(s, "player2", "TST-UNIT-0:e1")).toBe(true);
    s = pick(s, "TST-UNIT-0:e1");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("rush");
  });

  it("RS-371: 【マスキーリボン】の後、ターン終了時に相手が出さないこともできる（任意）（出典: atwiki/page-567「出してもよい」）", () => {
    let s = ncEnter("RS-371", 2, { power: damageCards(1) }, { battle: [inst("TST-UNIT-0", "e1")], power: powerCards(3) });
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    s = toEndOfTurn(s);
    if (s.pendingEffectChoice?.playerId === "player2") s = skip(s);
    s = toEndOfTurn(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("hand");
  });

  it.fails("RS-371: 【マスキーリボン】ターン終了時に出すユニットは必要パワーを満たすこと — パワーが足りないユニットカードは出せない（出典: atwiki/page-567「ただし、必要パワーと追加条件は満たすこと」）", () => {
    // 既知の不具合: CARD-RS-371 ターン終了時に相手が手札からラッシュエリアに出す処理がない（出せるユニットの候補が出ない）
    let s = ncEnter("RS-371", 2, { power: damageCards(2) }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-2", "e2")], power: powerCards(1) });
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    s = toEndOfTurn(s);
    expect(offeredTo(s, "player2", "TST-UNIT-0:e1")).toBe(true);
    s = ncEnter("RS-371", 2, { power: damageCards(1) }, { battle: [inst("TST-UNIT-2", "e2")], power: powerCards(1) });
    s = resolveAll(pick(s, "TST-UNIT-2:e2"));
    s = toEndOfTurn(s);
    // TST-UNIT-2 は必要パワー2。パワー1では出せない。
    expect(offeredTo(s, "player2", "TST-UNIT-2:e2")).toBe(false);
  });

  it.todo(
    "RS-371: 【マスキーリボン】ターン終了時に出したユニットの「ラッシュしたとき」の効果は発動しない（出典: atwiki/page-567「このとき、出したユニットの効果は発動しない」）— ターン終了時に相手が出す処理自体がエンジンになく、駆動できない",
  );
});

// ===========================================================================
describe("RS-372 X1マスク", () => {
  const TEXT = "【チェンジパワー】これは自軍ダメージ1点につきBP＋1000され、自分がターンを終えるときBP8000以上なら撃破される。";

  it("RS-372: カタログ本文・スペックが出典と一致（出典: atwiki/page-568）", () => {
    expectCatalogText("RS-372", TEXT);
    expectStats("RS-372", {
      name: "X1マスク",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 2,
      comboNumber: undefined,
      features: ["グリーン", "男"],
    });
  });

  it("RS-372: 【チェンジパワー】自軍ダメージ1点につき BP+1000（ダメージ3点で BP4000）（出典: atwiki/page-568「自軍ダメージ1点につきBP＋1000され」）", () => {
    const s = st({ player1: { battle: [inst("RS-372", "x")], power: damageCards(3) } });
    expect(bpOf(s, "player1", "RS-372:x")).toBe(4000);
  });

  it("RS-372: 【チェンジパワー】ラッシュエリアにあっても自軍ダメージで BP が上がる（出典: atwiki/page-568「これは…BP＋1000され」— 条件にエリアの限定がない）", () => {
    const s = st({ player1: { rush: [inst("RS-372", "x")], power: damageCards(2) } });
    expect(bpOf(s, "player1", "RS-372:x")).toBe(3000);
  });

  it("RS-372: 【チェンジパワー】敵軍ダメージは数えない（自軍ダメージ0なら BP1000）（出典: atwiki/page-568「自軍ダメージ」）", () => {
    const s = st({ player1: { battle: [inst("RS-372", "x")] }, player2: { power: damageCards(5, "ed") } });
    expect(bpOf(s, "player1", "RS-372:x")).toBe(1000);
  });

  it("RS-372: 【チェンジパワー】自分がターンを終えるとき BP8000 以上（ダメージ7点）なら撃破される（出典: atwiki/page-568「自分がターンを終えるときBP8000以上なら撃破される」）", () => {
    let s = st({ player1: { battle: [inst("RS-372", "x")], power: damageCards(7), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = toEndOfTurn(s);
    expect(zoneOf(s, "player1", "RS-372:x")).toBe("discard");
  });

  it("RS-372: 【チェンジパワー】BP7000（ダメージ6点）ならターン終了時に撃破されない（出典: atwiki/page-568「BP8000以上なら」）", () => {
    let s = st({ player1: { battle: [inst("RS-372", "x")], power: damageCards(6), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = toEndOfTurn(s);
    expect(zoneOf(s, "player1", "RS-372:x")).not.toBe("discard");
  });

  it("RS-372: 【チェンジパワー】相手のターンの終わりには撃破されない（出典: atwiki/page-568「自分がターンを終えるとき」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("RS-372", "x")], power: damageCards(7), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = toEndOfTurn(s);
    expect(zoneOf(s, "player1", "RS-372:x")).toBe("rush");
  });

  // grnrngr/faq-card-6 RS-372「はい、その通りです。」
  it("RS-372: 公式Q&A — 他の効果で BP8000 以上になった場合もターン終了時に撃破される（出典: grnrngr/faq-card-6 RS-372 Q）", () => {
    let s = st({ player1: { battle: [{ ...inst("RS-372", "x"), bpModifier: 7000 }], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", "RS-372:x")).toBe(8000);
    s = toEndOfTurn(s);
    expect(zoneOf(s, "player1", "RS-372:x")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-373 ファイブレッドFT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「ファイブレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【ファイブテクター】これが自軍ラッシュエリアにある間、相手にストライクされたとき、これをバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい。そうしたとき、そのストライクは無効になる。";

  it("RS-373: カタログ本文・スペックが出典と一致（出典: atwiki/page-540）", () => {
    expectCatalogText("RS-373", TEXT);
    expectStats("RS-373", {
      name: "ファイブレッドFT",
      category: "ET",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: undefined,
      features: ["レッド", "男", "ファイブテクター"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-373", "RS-272", "ファイブレッド", "atwiki/page-540", "ET");
  reanimateTests("RS-373", "RS-272", "ファイブレッド", "atwiki/page-540");

  function struck(p1: Partial<GameState["players"]["player1"]> = {}) {
    const s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-373", "ft")], deck: deckCards(5), ...p1 },
      player2: { battle: [inst("TST-UNIT-0", "s")], deck: deckCards(5, "e") },
    });
    return act(s, { type: "strike", playerId: "player2", instanceId: "TST-UNIT-0:s" });
  }

  it.fails("RS-373: 【ファイブテクター】自軍ラッシュエリアにある間、相手にストライクされたとき、これをバトルエリアに出してストライクしてきたユニットとバトルでき、ストライクは無効になる（出典: atwiki/page-540）", () => {
    // 既知の不具合: CARD-RS-373 ストライクされたときに【ファイブテクター】の選択が出ず、ストライクがそのまま通る
    let s = struck();
    expect(offeredTo(s, "player1", "RS-373:ft")).toBe(true);
    const a = legal(s).find((x) => x.playerId === "player1" && Object.values(x).includes("RS-373:ft"))!;
    s = resolveAll(act(s, a));
    expect(zoneOf(s, "player1", "RS-373:ft")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("discard");
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(0);
  });

  it("RS-373: 【ファイブテクター】は任意 — 使わなければストライクは通りダメージを受ける（出典: atwiki/page-540「バトルしてもよい」）", () => {
    const s = settle(struck());
    expect(zoneOf(s, "player1", "RS-373:ft")).toBe("rush");
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
  });

  it("RS-373: 【ファイブテクター】自軍ラッシュエリアにないとき（手札）は発動しない（出典: atwiki/page-540「これが自軍ラッシュエリアにある間」）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { hand: [inst("RS-373", "ft")], deck: deckCards(5) },
      player2: { battle: [inst("TST-UNIT-0", "s")], deck: deckCards(5, "e") },
    });
    const t = act(s, { type: "strike", playerId: "player2", instanceId: "TST-UNIT-0:s" });
    expect(offeredTo(t, "player1", "RS-373:ft")).toBe(false);
  });
});

// ===========================================================================
describe("RS-374 魔女バンドーラ", () => {
  const TEXT =
    "※これはアタックすることができない。 【ドーラ魔法】これが自軍ラッシュエリアにある間、相手は次の制限を受ける⇒コマンドをホールドして、特徴「魔法」、または｢恐竜｣を持つユニットをラッシュしたとき、そのホールドしたコマンドを捨札にする。";

  it("RS-374: カタログ本文・スペックが出典と一致（出典: atwiki/page-602）", () => {
    expectCatalogText("RS-374", TEXT);
    expectStats("RS-374", {
      name: "魔女バンドーラ",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: undefined,
      powerCost: 2,
      comboNumber: undefined,
      features: ["女", "魔法"],
    });
  });

  it("RS-374: ※ アタックすることができない（出典: atwiki/page-602「※これはアタックすることができない」）", () => {
    let s = st({ player1: { rush: [inst("RS-374", "b")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    s = enter(s, "RS-374:b");
    expect(zoneOf(s, "player1", "RS-374:b")).toBe("battle");
    expect(attackTargets(s, "RS-374:b")).toEqual([]);
  });

  const rushVs = (handId: string, cmds: ReturnType<typeof releasedCat>, bandoraZone: "rush" | "battle" | "own" = "rush") =>
    rushFromHand(
      st({
        phase: "rush",
        player1: { hand: [inst(handId, "u")], command: cmds, power: powerCards(4), deck: deckCards(3), rush: bandoraZone === "own" ? [inst("RS-374", "b")] : [] },
        player2: { rush: bandoraZone === "rush" ? [inst("RS-374", "b")] : [], battle: bandoraZone === "battle" ? [inst("RS-374", "b")] : [] },
      }),
      "player1",
      `${handId}:u`,
    );

  it("RS-374: 【ドーラ魔法】相手がコマンドをホールドして特徴「魔法」のユニットをラッシュしたとき、そのホールドしたコマンドを捨札にする（出典: atwiki/page-602）", () => {
    const r = rushVs("RS-374", releasedCat("DA", 2));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-374:u")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP-DA:cDA0")).toBe("discard");
    expect(zoneOf(r.state, "player1", "TST-OP-DA:cDA1")).toBe("command");
  });

  it("RS-374: 【ドーラ魔法】特徴「恐竜」のユニット（守護獣プテラノドン）でもホールドしたコマンドを捨札にする（出典: atwiki/page-602「特徴「魔法」、または｢恐竜｣」）", () => {
    const r = rushVs("RS-039", releasedCat("WB", 2));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-039:u")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP:cWB0")).toBe("discard");
  });

  it("RS-374: 【ドーラ魔法】「魔法」「恐竜」を持たないユニットなら捨札にしない（出典: atwiki/page-602）", () => {
    const r = rushVs("RS-378", releasedCat("WB", 2));
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-OP:cWB0")).toBe("command");
  });

  it("RS-374: 【ドーラ魔法】バンドーラがバトルエリアにあるとき（ラッシュエリアにないとき）は制限を受けない（出典: atwiki/page-602「これが自軍ラッシュエリアにある間」）", () => {
    const r = rushVs("RS-039", releasedCat("WB", 2), "battle");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-OP:cWB0")).toBe("command");
  });

  it("RS-374: 【ドーラ魔法】制限を受けるのは相手だけ — 自軍ラッシュエリアのバンドーラは自分のラッシュに影響しない（出典: atwiki/page-602「相手は次の制限を受ける」）", () => {
    const r = rushVs("RS-039", releasedCat("WB", 2), "own");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-OP:cWB0")).toBe("command");
  });

  // grnrngr/faq-card-6 RS-374 Q1「いいえ、捨札にはなりません。…自軍コマンドも敵軍コマンドもホールドを行っておりません」
  it.todo(
    "RS-374: 公式Q&A — タックの効果で（敵軍コマンドをリリースして）ホールドしたことにした恐竜ユニットのラッシュでは、何も捨札にならない（出典: grnrngr/faq-card-6 RS-374 Q1）— RS-223 タックの「ホールドしたことにできる」を選ぶ合法手がエンジンにない（rsCatchall の汎用キーワードのみ）ため駆動できない",
  );

  // grnrngr/faq-card-6 RS-374 Q2「いいえ、捨札にはなりません。…「RS-249 Vコマンダー」の効果によってであり」
  it("RS-374: 公式Q&A — Vコマンダーの効果で恐竜ユニットをラッシュしても、Vコマンダーの使用でホールドしたコマンドは捨札にならない（出典: grnrngr/faq-card-6 RS-374 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: { hand: [inst("RS-249", "vc")], command: releasedCat("OT", 2), power: powerCards(5), deck: [inst("RS-039", "pt"), ...deckCards(3)] },
      player2: { rush: [inst("RS-374", "b")] },
    });
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-249:vc");
    expect(pay).toBeDefined();
    s = act(s, pay!);
    s = resolveAll(s, ["RS-039:pt"]);
    expect(zoneOf(s, "player1", "RS-039:pt")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP-OT:cOT0")).toBe("command");
  });

  // grnrngr/faq-card-8 RS-600「はい、捨札になります。」
  it("RS-374: 公式Q&A — ゴーオンシルバーの「コールOT」でホールドして Vレックス（恐竜）をラッシュすると、ゴーオンシルバーが捨札になる（出典: grnrngr/faq-card-8 RS-600 Q）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-302", "vr")], rush: [inst("RS-600", "gs")], command: [], power: powerCards(5), deck: deckCards(3) },
      player2: { rush: [inst("RS-374", "b")] },
    });
    const r = rushFromHand(s, "player1", "RS-302:vr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-302:vr")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-600:gs")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-375 レッドレーサー（2nd）", () => {
  const TEXT =
    "※これが自軍エリアにある間、自分のユニットカードの必要パワーの数字は1増える。 【ツインソード・ツインカムクラッシュ】「SP1」 敵軍バトルエリアから、本来のBPが2000か、必要パワーの数字が2か、ナンバーが2のユニットを1体選び、撃破してもよい。";

  it("RS-375: カタログ本文・スペックが出典と一致（出典: atwiki/page-552）", () => {
    expectCatalogText("RS-375", TEXT);
    expectStats("RS-375", {
      name: "レッドレーサー（2nd）",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 1,
      comboNumber: 4,
      features: ["レッド", "男", "2nd"],
    });
  });

  const rushCost2 = (power: number, where: "rush" | "battle" | "hand" | "none" = "rush") =>
    st({
      phase: "rush",
      player1: {
        rush: where === "rush" ? [inst("RS-375", "rr")] : [],
        battle: where === "battle" ? [inst("RS-375", "rr")] : [],
        hand: [inst("TST-UNIT-2", "u"), ...(where === "hand" ? [inst("RS-375", "rr")] : [])],
        command: releasedCat("WB", 1),
        power: powerCards(power),
        deck: deckCards(3),
      },
    });

  it("RS-375: ※ 自軍エリアにある間、自分の手札のユニットカードの必要パワーは1増える（必要パワー2のユニットはパワー2ではラッシュできない）（出典: atwiki/page-552）", () => {
    expect(canStartRush(rushCost2(2), "player1", "TST-UNIT-2:u")).toBe(false);
  });

  it("RS-375: ※ 必要パワーが1増えてもパワー3あればラッシュできる（出典: atwiki/page-552）", () => {
    const r = rushFromHand(rushCost2(3), "player1", "TST-UNIT-2:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-2:u")).toBe("rush");
  });

  it("RS-375: ※ バトルエリアにあっても（自軍エリア）必要パワーが1増える（出典: atwiki/page-552「これが自軍エリアにある間」）", () => {
    expect(canStartRush(rushCost2(2, "battle"), "player1", "TST-UNIT-2:u")).toBe(false);
  });

  it("RS-375: ※ 手札にあるだけ（自軍エリアにない）なら必要パワーは増えない（出典: atwiki/page-552「これが自軍エリアにある間」）", () => {
    expect(canStartRush(rushCost2(2, "hand"), "player1", "TST-UNIT-2:u")).toBe(true);
  });

  it("RS-375: ※ 相手のユニットカードの必要パワーは増えない（出典: atwiki/page-552「自分のユニットカード」）", () => {
    const s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { rush: [inst("RS-375", "rr")] },
      player2: { hand: [inst("TST-UNIT-2", "u")], command: releasedCat("WB", 1, "ec"), power: powerCards(2, "ep"), deck: deckCards(3, "e") },
    });
    expect(canStartRush(s, "player2", "TST-UNIT-2:u")).toBe(true);
  });

  // 【ツインソード・ツインカムクラッシュ】
  function twin(enemyBattle: ReturnType<typeof inst>[], cn = 4) {
    return ncEnter("RS-375", cn, {}, { battle: enemyBattle, rush: [inst("TST-UNIT-2", "er")] });
  }
  const BP2000 = sUnit("SPEC-BP2000", { bp: 2000, powerCost: 5 });
  const CN2 = sUnit("SPEC-CN2", { bp: 3000, powerCost: 4, comboNumber: 2 });
  const NONE = sUnit("SPEC-NONE", { bp: 3000, powerCost: 3 });

  it("RS-375: 【ツインソード・ツインカムクラッシュ】NC 成立（4番目）で SP1 になりストライクできる（出典: atwiki/page-552「「SP1」」）", () => {
    const s = twin([]);
    expect(spOf(s, "player1", "RS-375:x")).toBe(1);
    expect(canStrike(s, "RS-375:x")).toBe(true);
  });

  it("RS-375: NC 不成立（1番目）なら SP はない（出典: atwiki/page-552「SP：！」・R-CN-02）", () => {
    const s = twin([], 1);
    expect(spOf(s, "player1", "RS-375:x")).toBe(0);
  });

  it("RS-375: 【ツインソード・ツインカムクラッシュ】敵軍バトルエリアから本来のBP2000／必要パワー2／ナンバー2のユニットを選べ、どれにも当たらないものとラッシュエリアのものは選べない（出典: atwiki/page-552）", () => {
    const s0 = st(
      {
        player1: { rush: [inst("RS-375", "x")], battle: fillers(3), deck: deckCards(5) },
        player2: {
          battle: [inst("SPEC-BP2000", "a"), inst("TST-UNIT-2", "b"), inst("SPEC-CN2", "c"), inst("SPEC-NONE", "d")],
          rush: [inst("TST-UNIT-2", "er")],
          deck: deckCards(5, "e"),
        },
      },
      [BP2000, CN2, NONE],
    );
    const s = enter(s0, "RS-375:x");
    expect(choiceIds(s)).toEqual(["SPEC-BP2000:a", "SPEC-CN2:c", "TST-UNIT-2:b"]);
  });

  it("RS-375: 【ツインソード・ツインカムクラッシュ】選んだユニットを撃破する（出典: atwiki/page-552「1体選び、撃破してもよい」）", () => {
    let s = twin([inst("TST-UNIT-2", "b")]);
    s = resolveAll(pick(s, "TST-UNIT-2:b"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:b")).toBe("discard");
  });

  it("RS-375: 【ツインソード・ツインカムクラッシュ】撃破は任意（してもよい）— 撃破しないこともできる（出典: atwiki/page-552「撃破してもよい」）", () => {
    let s = twin([inst("TST-UNIT-2", "b")]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-375") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-2:b")).toBe("battle");
  });

  /** SR-005【バトライズファイヤードライブ】: パワーゾーンのカード pw を捨札にし、同じ必要パワーの敵軍 S ユニットの候補を返す。 */
  function batorize(p1extra: Partial<GameState["players"]["player1"]>, pw: ReturnType<typeof inst>, p2: Partial<GameState["players"]["player2"]>) {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("SR-005", "br")],
        rush: [inst("RS-106", "dr"), inst("RS-404", "k9"), ...(p1extra.rush ?? [])],
        command: releasedCat("OT", 2),
        power: [pw, ...powerCards(5)],
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    const r = rushFromHand(s, "player1", "SR-005:br");
    expect(r.ok).toBe(true);
    expect(choiceIds(r.state)).toContain(pw.instanceId);
    return pick(r.state, pw.instanceId);
  }

  // grnrngr/faq-card-6 RS-375 Q2/Q4「「ユニット」として扱われているものは対象になりません」
  it("RS-375: 公式Q&A — すでにラッシュされている（場の）ユニットの必要パワーは増えない（敵軍の場にレッドレーサー（2nd）がいても、場の必要パワー1のユニットは1のまま）（出典: grnrngr/faq-card-6 RS-375 Q2・Q4）", () => {
    // 必要パワー1の TST-OP-ET を捨札にして、必要パワー1の敵軍 S ユニット（敵軍の場の RS-375 自身と RS-370）を撃破候補にできる。
    const s = batorize({}, inst("TST-OP-ET", "pw1"), { battle: [inst("RS-375", "eb"), inst("RS-370", "e1")], rush: [inst("RS-375", "er")] });
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["RS-375:eb", "RS-370:e1"]));
  });

  it.todo(
    "RS-375: 公式Q&A — ダイデンジン【ダイデンジンブーメラン】で参照するパワーゾーンのカードの必要パワーも1増える（出典: grnrngr/faq-card-6 RS-375 Q1）— パワーゾーンのカードの必要パワーを参照する効果を発生させるには相手の効果でパワーゾーンのカードを離れさせる必要があり、RS-352 の処理経路が本ファイルの範囲を超えて複雑なため、RS-352 のスペックで扱う",
  );

  // grnrngr/faq-card-6 RS-375 Q3「はい、コマンドゾーンのカードにも効果を及ぼします。」
  it.fails("RS-375: 公式Q&A — ギンガグリーン【キバショット】で参照するコマンドゾーンのカードの必要パワーも1増える（出典: grnrngr/faq-card-6 RS-375 Q3）", () => {
    // 既知の不具合: CARD-RS-375 必要パワー+1 が適用されない（また CARD-RS-377 【キバショット】の発動手段がない）
    // 敵軍（player2）の場にレッドレーサー（2nd）。player2 がホールドしたコマンド TST-UNIT-2（必要パワー2→3）を参照し、
    // 必要パワー3の敵軍 S ユニット（RS-369）が撃破候補で、必要パワー2（RS-372）は候補でない。
    const s = kibaShot(inst("TST-UNIT-2", "cmd"), { rush: [inst("RS-375", "rr")], battle: [inst("RS-369", "c3"), inst("RS-372", "c2")] });
    expect(choiceIds(s)).toContain("RS-369:c3");
    expect(choiceIds(s)).not.toContain("RS-372:c2");
  });

  // grnrngr/faq-card-6 RS-375 Q5「パワーゾーンにある「RS-375　レッドレーサー」のカードの必要パワーだけが１増えている」
  it("RS-375: 公式Q&A — 自軍エリアのレッドレーサー（2nd）自身（ユニット）の必要パワーは増えない（出典: grnrngr/faq-card-6 RS-375 Q5）", () => {
    // 敵軍（player2）の場に RS-375 が1体、敵軍パワーゾーンにも RS-375。場の RS-375 は必要パワー1のまま → 必要パワー1で撃破候補になる。
    const s = batorize({}, inst("TST-OP-ET", "pw1"), { battle: [inst("RS-375", "eb")], power: [inst("RS-375", "epw")] });
    expect(choiceIds(s)).toContain("RS-375:eb");
  });

  it("RS-375: 公式Q&A — 自軍エリアにレッドレーサー（2nd）があると、パワーゾーンから捨札にしたカードの必要パワーは1増えたものとして参照する（SR-005【バトライズファイヤードライブ】）（出典: grnrngr/faq-card-6 SR-005 Q「はい、その通りです」・RS-375 Q1/Q5）", () => {
    // 自軍ラッシュエリアに RS-375。パワーゾーンの RS-375 のカード（必要パワー1→2）を捨札にすると、必要パワー2の敵軍 S ユニットが候補で、1は候補でない。
    const s = batorize({ rush: [inst("RS-375", "rr")] }, inst("RS-375", "pw"), { battle: [inst("TST-UNIT-0", "c0"), inst("RS-372", "c2"), inst("RS-370", "c1")] });
    expect(choiceIds(s)).toContain("RS-372:c2");
    expect(choiceIds(s)).not.toContain("RS-370:c1");
  });

  it("RS-375: 公式Q&A の対照 — 自軍エリアにレッドレーサー（2nd）がなければ、パワーゾーンの RS-375 のカードは必要パワー1として参照する（出典: grnrngr/faq-card-6 SR-005 Q の対照・atwiki/page-552「これが自軍エリアにある間」）", () => {
    const s = batorize({}, inst("RS-375", "pw"), { battle: [inst("RS-372", "c2"), inst("RS-370", "c1")] });
    expect(choiceIds(s)).toContain("RS-370:c1");
    expect(choiceIds(s)).not.toContain("RS-372:c2");
  });
});
