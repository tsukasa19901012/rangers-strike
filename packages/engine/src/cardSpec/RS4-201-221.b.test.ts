/**
 * カード別スペック: RS-208〜RS-214（第4弾「四雄の覚醒」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）ほか card_1/2/3/5・rider_2 の相互参照
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
  canDecline,
  canEnter,
  canStrike,
  choiceIds,
  confirmIfAsked,
  countS,
  decline,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  heldN,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  substitutes,
  toPhase,
  useNinja,
  zoneOf,
} from "./RS4-201-221.helpers";
import type { GameState } from "../types/game";

// ===========================================================================
describe("RS-208 キリンレンジャー", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。【天時星・時間返し】BP2000以下の自軍ユニットをすべて手札に戻してもよい。そうしたとき、もう一度自軍ラッシュフェイズからやり直す。";

  it("RS-208: カタログ本文・スペックが出典と一致（出典: atwiki/page-119）", () => {
    expectCatalogText("RS-208", TEXT);
    expectStats("RS-208", {
      name: "キリンレンジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 4,
      features: ["イエロー", "男"],
    });
  });

  // 「※これはラッシュしたターンにバトルエリアに出られない」
  // 既知の不具合: CARD-RS-208 ラッシュしたターンでもバトルエリアに出られてしまう
  it.fails("RS-208: ※ ラッシュしたターンのバトルフェイズにはバトルエリアに出られない（出典: atwiki/page-119）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-208", "k")], power: powerCards(3), command: releasedN(1, "TST-OP-MA") } });
    const r = rushFromHand(s, "player1", "RS-208:k");
    expect(r.ok).toBe(true);
    const battle = toPhase(r.state, "player1", "battle");
    expect(zoneOf(battle, "player1", "RS-208:k")).toBe("rush");
    expect(canEnter(battle, "RS-208:k")).toBe(false);
  });

  it("RS-208: ※ ラッシュしたターン以外ならバトルエリアに出られる（出典: atwiki/page-119）", () => {
    let s = st({ player1: { rush: [inst("RS-208", "k")] } });
    expect(canEnter(s, "RS-208:k")).toBe(true);
    s = enter(s, "RS-208:k");
    expect(zoneOf(s, "player1", "RS-208:k")).toBe("battle");
  });

  /** キリンを4番目に出す。自軍: バトルにフィラー（BP1000）2体と M（BP3000）、ラッシュに BP1000 の S と BP3000 の S。 */
  function kirinAt4(extra: { operation?: ReturnType<typeof inst>[]; enemyBattle?: ReturnType<typeof inst>[]; command?: ReturnType<typeof inst>[] } = {}): GameState {
    const s = st({
      player1: {
        battle: [...fillers(2), inst("TST-UNIT-2", "m3000")],
        rush: [inst("RS-208", "k"), inst("TST-UNIT-0", "rLow"), inst("RS-211", "rHigh")],
        operation: extra.operation ?? [],
        command: extra.command ?? [],
        deck: deckCards(5),
      },
      player2: { battle: extra.enemyBattle ?? [], power: powerCards(3, "e"), deck: deckCards(5, "e") },
    });
    return enter(s, "RS-208:k");
  }

  // 「BP2000以下の自軍ユニットをすべて手札に戻してもよい。そうしたとき、もう一度自軍ラッシュフェイズからやり直す」
  // faq-card-4 RS-208 Q7「手札に戻るＢＰ２０００以下の自軍ユニット以外は、そのまま残ります」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: NC（4番目）で BP2000 以下の自軍ユニットをすべて手札に戻し、自軍ラッシュフェイズからやり直す（BP3000 のユニットは残る）（出典: atwiki/page-119・grnrngr/faq-card-4 RS-208 Q7）", () => {
    let s = kirinAt4();
    s = confirmIfAsked(s, "player1");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:rLow")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-2:m3000")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-211:rHigh")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-208:k")).toBe("battle");
    expect(s.activePlayer).toBe("player1");
    expect(s.phase).toBe("rush");
  });

  // 「手札に戻してもよい」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: 手札に戻さないことを選べ、そのときはやり直さない（出典: atwiki/page-119「戻してもよい」）", () => {
    let s = kirinAt4();
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("battle");
    expect(s.phase).toBe("battle");
  });

  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: NC 不成立（1番目）では発動しない／4番目なら発動する（出典: atwiki/page-119、R-CN-02）", () => {
    const first = confirmIfAsked(enter(st({ player1: { rush: [inst("RS-208", "k"), inst("TST-UNIT-0", "rLow")] } }), "RS-208:k"), "player1");
    expect(zoneOf(first, "player1", "TST-UNIT-0:rLow")).toBe("rush");
    expect(first.phase).toBe("battle");
    const fourth = confirmIfAsked(kirinAt4(), "player1");
    expect(fourth.phase).toBe("rush");
  });

  // faq-card-4 RS-208 Q1「その「RS-208 キリンレンジャー」はアタックもストライクも行うことはできません」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: 公式Q&A — 時間返しを発動したキリンレンジャーはアタックもストライクもできない（出典: grnrngr/faq-card-4 RS-208 Q1）", () => {
    let s = confirmIfAsked(kirinAt4({ enemyBattle: [inst("TST-UNIT-0", "e")] }), "player1");
    expect(s.phase).toBe("rush");
    expect(canStrike(s, "RS-208:k")).toBe(false);
    expect(attackTargets(s, "RS-208:k")).toEqual([]);
    s = toPhase(s, "player1", "battle");
    expect(canStrike(s, "RS-208:k")).toBe(false);
    expect(attackTargets(s, "RS-208:k")).toEqual([]);
  });

  // faq-card-4 RS-208 Q5（faq-card-3 にも転載）「はい、手札に戻ります。」（カレー＋敵軍ゴーマ16世で BP1000 のキリン自身）
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: 公式Q&A — 自軍カレーと敵軍ゴーマ16世で BP1000 になったキリンレンジャー自身も手札に戻る（出典: grnrngr/faq-card-4 RS-208 Q5・faq-card-3）", () => {
    let s = kirinAt4({ operation: [inst("RS-179", "cur")], enemyBattle: [inst("RS-210", "goma")] });
    expect(bpOf(s, "player1", "RS-208:k")).toBe(1000);
    s = confirmIfAsked(s, "player1");
    expect(zoneOf(s, "player1", "RS-208:k")).toBe("hand");
  });

  // faq-card-4 RS-208 Q6「ホールドされているコマンドはそのままになります」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: 公式Q&A — やり直したラッシュフェイズでもホールドされたコマンドはそのまま（出典: grnrngr/faq-card-4 RS-208 Q6）", () => {
    let s = kirinAt4({ command: [...heldN(2, "TST-OP-MA"), ...releasedN(1, "TST-OP-MA")] });
    s = confirmIfAsked(s, "player1");
    expect(s.phase).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  // faq-card-4 RS-208 Q8「ラッシュしたユニットやバトルやストライクの結果はそのままに、ラッシュフェイズから再開できる」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】が発動しない（手札に戻す・ラッシュフェイズからやり直す処理が無い）
  it.fails("RS-208: 公式Q&A — それまでのストライクの結果（敵軍ダメージ）はそのまま残る（出典: grnrngr/faq-card-4 RS-208 Q8）", () => {
    let s = st({
      player1: { battle: [inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-0", "b"), inst("RS-208", "k")], deck: deckCards(5) },
      player2: { power: powerCards(3, "e"), deck: deckCards(5, "e") },
    });
    s = settle(strike(s, "TST-UNIT-0:a"));
    expect(s.players.player2.damage).toBe(1);
    s = passEntry(enter(s, "TST-UNIT-2:m"));
    s = passEntry(enter(s, "TST-UNIT-0:b"));
    s = confirmIfAsked(enter(s, "RS-208:k"), "player1");
    expect(s.phase).toBe("rush");
    expect(s.players.player2.damage).toBe(1);
  });

  it.todo(
    "RS-208: 公式Q&A — やり直すとき「バトルフェイズを終えるとき」の効果（ブルースワロー等）は発動する（出典: grnrngr/faq-card-4 RS-208 Q2）— 時間返し自体が未実装で、かつ BP2000 以下のブルースワローは時間返しで手札に戻るため、範囲内のカードで観測可能な組み立てができない",
  );
  it.todo(
    "RS-208: 公式Q&A — やり直したラッシュフェイズでシーロンの光を再び発動できる（出典: grnrngr/faq-card-4 RS-208 Q3）— RS-013 のカード本文がカタログに無く（text 未収録）、起動手順を確認できない",
  );
  it.todo(
    "RS-208: 公式Q&A — 猫だましで出したダイボウケンを素材にしたスーパーダイボウケンはターン終了時に捨札にならない（出典: grnrngr/faq-card-4 RS-208 Q4・faq-card-2/5）— RS-326・RS-236 の合体ラッシュ手順に依存し、時間返しが未実装のため組み立てられない",
  );
  it.todo(
    "RS-208: atwiki Q&A — 【語る背中】の装甲響鬼はやり直したラッシュフェイズの終了時にも再び発動する（出典: atwiki/page-119 Q9）— XG5-050 は範囲外の弾のカードで、時間返しも未実装",
  );
});

// ===========================================================================
describe("RS-209 ホウオウレンジャー", () => {
  const TEXT =
    "【天風星・一文字竜巻】「SP1」自軍ラッシュエリアのSユニットを、敵軍Sユニットの数まで好きな数選び、手札に戻してもよい。そうしたとき、自分が手札に戻した数と同じ数、相手は自分自身のSユニットを選び手札に戻す。";

  it("RS-209: カタログ本文・スペックが出典と一致（出典: atwiki/page-120）", () => {
    expectCatalogText("RS-209", TEXT);
    expectStats("RS-209", {
      name: "ホウオウレンジャー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["ピンク", "女"],
    });
  });

  function houou(position: number, enemyS = 2): GameState {
    const s = st({
      player1: {
        battle: fillers(position - 1),
        rush: [inst("RS-209", "r"), inst("TST-UNIT-0", "own1"), inst("TST-UNIT-0", "own2"), inst("TST-UNIT-0", "own3"), inst("TST-UNIT-2", "ownM")],
      },
      player2: {
        battle: fillers(enemyS, "e"),
        rush: [inst("TST-UNIT-2", "em")],
        power: powerCards(3, "e"),
        deck: deckCards(3, "e"),
      },
    });
    return enter(s, "RS-209:r");
  }

  it("RS-209: NC（3番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-120）", () => {
    let s = houou(3);
    s = decline(s, "player1");
    expect(canStrike(s, "RS-209:r")).toBe(true);
    s = settle(strike(s, "RS-209:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「自軍ラッシュエリアのSユニットを、敵軍Sユニットの数まで好きな数選び、手札に戻してもよい。そうしたとき、自分が手札に戻した数と同じ数、相手は自分自身のSユニットを選び手札に戻す」
  it("RS-209: 自軍ラッシュエリアの S を2体手札に戻すと、相手が自分の S を2体選んで手札に戻す（出典: atwiki/page-120）", () => {
    let s = houou(3);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "player1", "TST-UNIT-0:own1", "TST-UNIT-0:own2");
    expect(zoneOf(s, "player1", "TST-UNIT-0:own1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:own2")).toBe("hand");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0", "TST-UNIT-0:e1"]);
    s = pick(s, "player2", "TST-UNIT-0:e0", "TST-UNIT-0:e1");
    expect(s.players.player2.hand.map((c) => c.instanceId).sort()).toEqual(["TST-UNIT-0:e0", "TST-UNIT-0:e1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:em")).toBe("rush");
  });

  it("RS-209: 選べるのは自軍ラッシュエリアの S だけ（バトルエリアのユニット・M は選べない）（出典: atwiki/page-120「自軍ラッシュエリアのSユニット」）", () => {
    const s = houou(3);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:own1", "TST-UNIT-0:own2", "TST-UNIT-0:own3"]);
  });

  it("RS-209: 戻せるのは敵軍 S ユニットの数（2体）まで（出典: atwiki/page-120「敵軍Sユニットの数まで」）", () => {
    let s = houou(3, 2);
    expect(s.pendingEffectChoice?.selectCount).toBe(2);
    s = pick(s, "player1", "TST-UNIT-0:own1", "TST-UNIT-0:own2");
    expect(zoneOf(s, "player1", "TST-UNIT-0:own3")).toBe("rush");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
  });

  it("RS-209: 1体だけ戻すと相手も1体だけ戻す（好きな数）（出典: atwiki/page-120「好きな数」「同じ数」）", () => {
    let s = houou(3, 2);
    s = pick(s, "player1", "TST-UNIT-0:own1");
    s = decline(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = drain(s, "player2");
    expect(s.players.player2.hand).toHaveLength(1);
    expect(countS(s, "player2")).toBe(1);
  });

  it("RS-209: 戻さないことを選べ、そのときは相手も戻さない（出典: atwiki/page-120「戻してもよい」）", () => {
    let s = houou(3);
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-209: NC 不成立（1番目）では効果を使えない／3番目なら使える（出典: atwiki/page-120、R-CN-02）", () => {
    const first = houou(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(canStrike(first, "RS-209:r")).toBe(false);
    expect(houou(3).pendingEffectChoice?.playerId).toBe("player1");
  });

  // faq-card-4 RS-209 Q1「いいえ、ＳＰ１のままです。…ＮＣの効果を発動させた時点で、そのターン中はＳＰ１になっています」
  it("RS-209: 公式Q&A — 相手がコロンを手札に戻してナンバーが変わっても SP1 のまま（出典: grnrngr/faq-card-4 RS-209 Q1）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-209", "r"), inst("TST-UNIT-0", "own1")] },
      player2: { battle: fillers(1, "e"), rush: [inst("RS-140", "colon")], power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-209:r");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "player1", "TST-UNIT-0:own1");
    if (s.pendingEffectChoice?.playerId === "player1") s = decline(s, "player1");
    s = pick(s, "player2", "RS-140:colon");
    expect(zoneOf(s, "player2", "RS-140:colon")).toBe("hand");
    expect(canStrike(s, "RS-209:r")).toBe(true);
    s = settle(strike(s, "RS-209:r"));
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("RS-210 ゴーマ16世", () => {
  const TEXT =
    "【大地動転の玉】これが自軍エリアにある間、ナンバーを持つすべてのSユニットは、BPが「＋」されるかわりにBPが「－」される。（BP0以下になったユニットは撃破される）";

  it("RS-210: カタログ本文・スペックが出典と一致（出典: atwiki/page-107）", () => {
    expectCatalogText("RS-210", TEXT);
    expectStats("RS-210", {
      name: "ゴーマ16世",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 4,
      features: ["皇帝", "ゴーマ族", "男"],
    });
  });

  // 「ナンバーを持つすべてのSユニットは、BPが「＋」されるかわりにBPが「－」される」
  it("RS-210: 自軍のナンバーを持つ S（キリンレンジャー、イエロー）はカレーの＋2000が－2000になり BP1000（出典: atwiki/page-107）", () => {
    const s = st({ player1: { battle: [inst("RS-210", "g"), inst("RS-208", "k")], operation: [inst("RS-179", "cur")] } });
    expect(bpOf(s, "player1", "RS-208:k")).toBe(1000);
  });

  it("RS-210: 敵軍のナンバーを持つ S にも適用される（出典: atwiki/page-107「すべてのSユニット」）", () => {
    const s = st({ player1: { battle: [inst("RS-210", "g")] }, player2: { battle: [inst("RS-208", "k")], operation: [inst("RS-179", "cur")] } });
    expect(bpOf(s, "player2", "RS-208:k")).toBe(1000);
  });

  // 「ナンバーを持つ」— ナンバーの無い S は＋のまま
  it("RS-210: ナンバーを持たない S は＋のまま、ナンバーを持つ S は－になる（出典: atwiki/page-107「ナンバーを持つ」）", () => {
    const NO_CN_YELLOW = { id: "SPEC-YELLOW-NOCN", name: "SPEC-YELLOW-NOCN", type: "unit", category: "MA", rarity: "N", expansion: "card-spec", powerCost: 0, bp: 1000, size: "S", features: ["イエロー"] } as const;
    const s = st(
      { player1: { battle: [inst("RS-210", "g"), inst("SPEC-YELLOW-NOCN", "n"), inst("RS-208", "k")], operation: [inst("RS-179", "cur")] } },
      [NO_CN_YELLOW as never],
    );
    expect(bpOf(s, "player1", "SPEC-YELLOW-NOCN:n")).toBe(3000);
    expect(bpOf(s, "player1", "RS-208:k")).toBe(1000);
  });

  // 「（BP0以下になったユニットは撃破される）」
  it("RS-210: BP0 以下になったユニットは撃破される（BP1000 のイエローフォーにカレーで－1000）（出典: atwiki/page-107）", () => {
    let s = st({
      phase: "rush",
      player1: { rush: [inst("RS-201", "y")], hand: [inst("RS-210", "g")], operation: [inst("RS-179", "cur")], power: powerCards(4), command: releasedN(1, "TST-OP-DA") },
    });
    const r = rushFromHand(s, "player1", "RS-210:g");
    expect(r.ok).toBe(true);
    s = settle(r.state);
    expect(zoneOf(s, "player1", "RS-201:y")).toBe("discard");
  });

  it("RS-210: ゴーマ16世が場に無ければカレーは＋2000のまま（出典: atwiki/page-107「これが自軍エリアにある間」）", () => {
    const s = st({ player1: { battle: [inst("RS-208", "k")], operation: [inst("RS-179", "cur")] } });
    expect(bpOf(s, "player1", "RS-208:k")).toBe(5000);
  });

  it.todo(
    "RS-210: 公式Q&A — 疾風流超忍法で山札の上に戻されても【大地動転の玉】は発動する（出典: grnrngr/faq-card-4 RS-210 Q1・faq-card-1）— RS-026 のカード本文がカタログに無く（text 未収録）、カウンター手順を確認できない",
  );
  it.todo(
    "RS-210: 公式Q&A — ゴーマ16世がある状態で BP3000 以下のユニットに巨大化爆弾を使うと撃破される（出典: grnrngr/faq-card-5 RS-255）— 巨大化爆弾の重ねて再ラッシュする手順（範囲外カード）に依存し、大地動転の玉も未実装",
  );
  it.todo(
    "RS-210: 公式Q&A — 気力で＋されていた自軍ユニットが敵軍ターン中のゴーマ16世ラッシュで BP0 以下になったときマジマザーの効果を使える（出典: grnrngr/faq-card-5）— RS-324 の撃破置換の手順（範囲外カード）に依存し、大地動転の玉も未実装",
  );
  it.todo(
    "RS-210: 公式Q&A — ジーク【頭が高い！】とゴーマ16世が重なるときはジークが優先される（出典: grnrngr/faq-rider_2）— RK-154・RK-024 のライド手順（範囲外カード）に依存し、大地動転の玉も未実装",
  );
});

// ===========================================================================
describe("RS-211 オーブルー", () => {
  const TEXT =
    "【稲妻超力トンファ】自軍ターン中、これがバトルでユニットを撃破したとき、相手は自分自身のコマンドゾーンからカードを1枚選び、自分自身のパワーゾーンにダメージにして置く。";

  it("RS-211: カタログ本文・スペックが出典と一致（出典: atwiki/page-112）", () => {
    expectCatalogText("RS-211", TEXT);
    expectStats("RS-211", {
      name: "オーブルー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  function ohBlueAttack(position: number): GameState {
    let s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-211", "b")] },
      player2: { battle: [inst("TST-UNIT-0", "e")], command: [inst("TST-OP-DA", "c1"), held("TST-OP-MA", "c2")], power: powerCards(2, "e") },
    });
    s = enter(s, "RS-211:b");
    return attack(s, "RS-211:b", "TST-UNIT-0:e");
  }

  // 「これがバトルでユニットを撃破したとき、相手は自分自身のコマンドゾーンからカードを1枚選び、自分自身のパワーゾーンにダメージにして置く」
  it("RS-211: NC（3番目）でバトルに勝つと、相手が自分のコマンドを1枚選び自分のパワーゾーンにダメージ（ウラ向き）として置く（出典: atwiki/page-112）", () => {
    let s = ohBlueAttack(3);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:c1", "TST-OP-MA:c2"]);
    expect(canDecline(s, "player2")).toBe(false);
    s = pick(s, "player2", "TST-OP-MA:c2");
    expect(s.players.player2.damage).toBe(1);
    const placed = s.players.player2.power.find((c) => c.instanceId === "TST-OP-MA:c2");
    expect(placed?.faceDown).toBe(true);
    expect(zoneOf(s, "player2", "TST-OP-DA:c1")).toBe("command");
  });

  it("RS-211: NC 不成立（1番目）ではバトルに勝っても何も起きない／3番目なら起きる（出典: atwiki/page-112、R-CN-02）", () => {
    const first = ohBlueAttack(1);
    expect(zoneOf(first, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(first.players.player2.command).toHaveLength(2);
    expect(ohBlueAttack(3).pendingEffectChoice?.playerId).toBe("player2");
  });

  // 「自軍ターン中」— 敵軍ターン中にバトルで撃破しても発動しない（自軍ターンに発動することも確認）
  it("RS-211: 敵軍ターン中にアタックされて撃破したときは発動しない（出典: atwiki/page-112「自軍ターン中」）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-211", "b")], deck: deckCards(5) },
      player2: { rush: [inst("TST-UNIT-0", "e")], command: [inst("TST-OP-DA", "c1")], power: powerCards(2, "e"), deck: deckCards(5, "e") },
    });
    s = passEntry(enter(s, "RS-211:b"));
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = enter(s, "TST-UNIT-0:e", "player2");
    s = settle(attack(s, "TST-UNIT-0:e", "RS-211:b", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.command).toHaveLength(1);
    expect(s.players.player2.damage).toBe(0);
  });

  // faq-card-4 RS-211 Q1「「RS-018 隠流忍術」を発動した相手が、自分自身のコマンドゾーンからカードを１枚選び、自分自身のパワーゾーンにダメージにして置きます」
  it("RS-211: 公式Q&A — 隠流忍術で自軍ユニットとバトルさせられて撃破しても、相手が自分のコマンドをダメージにする（出典: grnrngr/faq-card-4 RS-211 Q1・faq-card-1）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-211", "b")] },
      player2: {
        battle: [inst("TST-UNIT-2", "e")],
        hand: [inst("RS-018", "n")],
        command: [...releasedN(2, "TST-OP-MA", "ma"), inst("TST-OP-DA", "da")],
        power: powerCards(5, "e"),
      },
    });
    s = enter(s, "RS-211:b");
    s = attack(s, "RS-211:b", "TST-UNIT-2:e");
    expect(substitutes(s, "RS-018:n")).toContain("TST-UNIT-0:fill0");
    s = useNinja(s, "RS-018:n", "TST-UNIT-0:fill0");
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = pick(s, "player2", "TST-OP-DA:da");
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP-DA:da")).toBe("power");
  });
});

// ===========================================================================
describe("RS-212 オーグリーン", () => {
  const TEXT =
    "【爆烈ミラージュナックル】自軍ターン中、これがバトルでユニットを撃破したとき、敵軍捨札からカードを1枚選び、敵軍パワーゾーンにダメージにして置く。（カードを選ぶとき、これが撃破したユニットが捨札になるなら捨札にしたあとで選ぶ）";

  it("RS-212: カタログ本文・スペックが出典と一致（出典: atwiki/page-113）", () => {
    expectCatalogText("RS-212", TEXT);
    expectStats("RS-212", {
      name: "オーグリーン",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 3,
      features: ["グリーン", "男"],
    });
  });

  function ohGreenAttack(position: number): GameState {
    let s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-212", "g")] },
      player2: { battle: [inst("TST-UNIT-0", "e")], discard: [inst("TST-OP-DA", "x1")], power: powerCards(2, "e") },
    });
    s = enter(s, "RS-212:g");
    return attack(s, "RS-212:g", "TST-UNIT-0:e");
  }

  // 「敵軍捨札からカードを1枚選び、敵軍パワーゾーンにダメージにして置く。（…これが撃破したユニットが捨札になるなら捨札にしたあとで選ぶ）」
  // 既知の不具合: CARD-RS-212 【爆烈ミラージュナックル】が発動しない（敵軍捨札のカードをダメージにする選択が出ない）
  it.fails("RS-212: NC（3番目）でバトルに勝つと、撃破したユニットを含む敵軍捨札から1枚選び敵軍のダメージにする（出典: atwiki/page-113）", () => {
    let s = ohGreenAttack(3);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP-DA:x1", "TST-UNIT-0:e"]);
    s = pick(s, "player1", "TST-UNIT-0:e");
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:e")?.faceDown).toBe(true);
  });

  // 既知の不具合: CARD-RS-212 【爆烈ミラージュナックル】が発動しない（敵軍捨札のカードをダメージにする選択が出ない）
  it.fails("RS-212: NC 不成立（1番目）では発動しない／3番目なら発動する（出典: atwiki/page-113、R-CN-02）", () => {
    const first = ohGreenAttack(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(first.players.player2.damage).toBe(0);
    expect(ohGreenAttack(3).pendingEffectChoice?.playerId).toBe("player1");
  });

  // 「自軍ターン中」
  // 既知の不具合: CARD-RS-212 【爆烈ミラージュナックル】が発動しない（敵軍捨札のカードをダメージにする選択が出ない）
  it.fails("RS-212: 敵軍ターン中にアタックされて撃破しても発動しない／自軍ターンなら発動する（出典: atwiki/page-113「自軍ターン中」）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-212", "g")], deck: deckCards(5) },
      player2: { rush: [inst("TST-UNIT-0", "e")], discard: [inst("TST-OP-DA", "x1")], power: powerCards(2, "e"), deck: deckCards(5, "e") },
    });
    s = passEntry(enter(s, "RS-212:g"));
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = enter(s, "TST-UNIT-0:e", "player2");
    s = settle(attack(s, "TST-UNIT-0:e", "RS-212:g", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(0);
    expect(ohGreenAttack(3).pendingEffectChoice?.playerId).toBe("player1");
  });

  // faq-card-4 RS-212 Q1「同時タイミングで発動した処理はターンプレイヤーが任意の順番で実行できます」
  // 既知の不具合: CARD-RS-212 【爆烈ミラージュナックル】が発動しない（敵軍捨札のカードをダメージにする選択が出ない）
  it.fails("RS-212: 公式Q&A — アバレッドAM を撃破したとき、ターンプレイヤーはミラージュナックルを先に処理してアバレッドをダメージにでき、AM の効果で戻らない（出典: grnrngr/faq-card-4 RS-212 Q1）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [{ ...inst("RS-212", "g"), bpSetValue: 9000 }] },
      player2: { battle: [inst("RS-230", "am")], discard: [inst("RS-054", "red")], power: powerCards(2, "e") },
    });
    s = enter(s, "RS-212:g");
    s = attack(s, "RS-212:g", "RS-230:am");
    // 同時に発生した処理の順番をターンプレイヤーが選ぶ（ミラージュナックルを先に）
    if (s.pendingEffectChoice?.kind === "simultaneous_order") {
      const mine = s.pendingEffectChoice.validInstanceIds.find((id) => id.includes("RS-212") || id.includes("baku"));
      s = pick(s, "player1", mine ?? s.pendingEffectChoice.validInstanceIds[0]!);
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toContain("RS-054:red");
    s = settle(pick(s, "player1", "RS-054:red"));
    expect(zoneOf(s, "player2", "RS-054:red")).toBe("power");
    expect(zoneOf(s, "player2", "RS-230:am")).toBe("discard");
    expect(s.players.player2.rush).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-213 オーイエロー", () => {
  const TEXT = "【炸裂超力バトン】相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる。";

  it("RS-213: カタログ本文・スペックが出典と一致（出典: atwiki/page-114）", () => {
    expectCatalogText("RS-213", TEXT);
    expectStats("RS-213", {
      name: "オーイエロー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["イエロー", "女"],
    });
  });

  function ohYellow(position: number): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-213", "y")] },
      player2: { battle: fillers(1, "e"), rush: [inst("TST-UNIT-0", "er1"), inst("TST-UNIT-0", "er2")] },
    });
    return enter(s, "RS-213:y");
  }

  // 「相手は自分自身のラッシュエリアからユニットを1体選ぶ。このターン、このユニットは、相手の選んだユニットにアタックできる」
  // 既知の不具合: CARD-RS-213 【炸裂超力バトン】で相手がラッシュエリアのユニットを選ばず、ラッシュエリアのユニットにアタックできない
  it.fails("RS-213: NC（2番目）で相手が自分のラッシュエリアから1体選び、オーイエローはそのユニットにアタックして撃破できる（選ばれなかったユニットにはアタックできない）（出典: atwiki/page-114）", () => {
    let s = ohYellow(2);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:er1", "TST-UNIT-0:er2"]);
    expect(canDecline(s, "player2")).toBe(false);
    s = pick(s, "player2", "TST-UNIT-0:er2");
    const targets = attackTargets(s, "RS-213:y");
    expect(targets).toContain("TST-UNIT-0:er2");
    expect(targets).not.toContain("TST-UNIT-0:er1");
    s = settle(attack(s, "RS-213:y", "TST-UNIT-0:er2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:er2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-213 【炸裂超力バトン】で相手がラッシュエリアのユニットを選ばず、ラッシュエリアのユニットにアタックできない
  it.fails("RS-213: NC 不成立（1番目）ではラッシュエリアのユニットにアタックできない／2番目ならできる（出典: atwiki/page-114、R-CN-02）", () => {
    const first = ohYellow(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(attackTargets(first, "RS-213:y")).toEqual(["TST-UNIT-0:e0"]);
    const second = drain(ohYellow(2), "player2");
    expect(attackTargets(second, "RS-213:y").some((id) => id.startsWith("TST-UNIT-0:er"))).toBe(true);
  });
});

// ===========================================================================
describe("RS-214 オーピンク", () => {
  const TEXT = "【閃光ミラクル気功弾】このターン、自軍Sユニットがバトルでユニットを撃破するたび、自軍コマンドを2つまで選び、リリースしてもよい。";

  it("RS-214: カタログ本文・スペックが出典と一致（出典: atwiki/page-115）", () => {
    expectCatalogText("RS-214", TEXT);
    expectStats("RS-214", {
      name: "オーピンク",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 1,
      features: ["ピンク", "女"],
    });
  });

  /** オーピンクを1番目に出し（NC）、効果を受ける。自軍コマンドは3つホールド、ラッシュに S と M の攻撃役。 */
  function pinkActive(): GameState {
    let s = st({
      player1: {
        rush: [inst("RS-214", "p"), inst("TST-UNIT-2", "m"), { ...inst("TST-UNIT-0", "s2"), bpSetValue: 5000 }],
        command: heldN(3, "TST-OP-MA"),
      },
      player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")] },
    });
    s = enter(s, "RS-214:p");
    return confirmIfAsked(s, "player1");
  }
  const heldCount = (s: GameState) => s.players.player1.command.filter((c) => c.commandHeld).length;

  // 「このターン、自軍Sユニットがバトルでユニットを撃破するたび、自軍コマンドを2つまで選び、リリースしてもよい」
  it("RS-214: NC（1番目）のあと、自軍 S がバトルでユニットを撃破するとコマンドを2つまでリリースできる（出典: atwiki/page-115）", () => {
    let s = pinkActive();
    s = attack(s, "RS-214:p", "TST-UNIT-0:e1");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = drain(s, "player1");
    expect(heldCount(s)).toBe(1);
  });

  it("RS-214: 撃破する「たび」— 2回撃破すれば2回リリースできる（出典: atwiki/page-115「撃破するたび」）", () => {
    let s = pinkActive();
    s = drain(attack(s, "RS-214:p", "TST-UNIT-0:e1"), "player1");
    expect(heldCount(s)).toBe(1);
    s = passEntry(s);
    s = enter(s, "TST-UNIT-0:s2");
    s = drain(attack(s, "TST-UNIT-0:s2", "TST-UNIT-0:e2"), "player1");
    expect(heldCount(s)).toBe(0);
  });

  // 「リリースしてもよい」
  it("RS-214: リリースしないことを選べる（出典: atwiki/page-115「リリースしてもよい」）", () => {
    let s = attack(pinkActive(), "RS-214:p", "TST-UNIT-0:e1");
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(heldCount(s)).toBe(3);
  });

  // 「自軍Sユニットが」— M ユニットが撃破してもリリースできない（S なら出来ることも確認）
  it("RS-214: 自軍 M ユニットが撃破してもリリースできない／S ならできる（出典: atwiki/page-115「自軍Sユニット」）", () => {
    let s = passEntry(pinkActive());
    s = enter(s, "TST-UNIT-2:m");
    s = attack(s, "TST-UNIT-2:m", "TST-UNIT-0:e1");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(heldCount(s)).toBe(3);
    const sKill = attack(pinkActive(), "RS-214:p", "TST-UNIT-0:e2");
    expect(sKill.pendingEffectChoice?.playerId).toBe("player1");
  });

  it("RS-214: NC 不成立（2番目）では撃破してもリリースできない／1番目ならできる（出典: atwiki/page-115、R-CN-02）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-214", "p")], command: heldN(3, "TST-OP-MA") },
      player2: { battle: [inst("TST-UNIT-0", "e1")] },
    });
    s = confirmIfAsked(enter(s, "RS-214:p"), "player1");
    s = attack(s, "RS-214:p", "TST-UNIT-0:e1");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(heldCount(s)).toBe(3);
    expect(attack(pinkActive(), "RS-214:p", "TST-UNIT-0:e1").pendingEffectChoice?.playerId).toBe("player1");
  });

  // faq-card-4 RS-214 Q1「いいえ、できません。」（※「敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される」敵軍ユニットを SP1 以上の自軍ユニットで撃破したとき）
  it("RS-214: 公式Q&A — 皇帝バッカスフンドが自身の※で撃破されてもリリースできない（通常のバトル勝利ならできる）（出典: grnrngr/faq-card-4 RS-214 Q1）", () => {
    let s = pinkActive();
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("RS-215", "bac"), ...s.players.player2.battle] } } };
    s = passEntry(s);
    s = enter(s, "TST-UNIT-0:s2");
    // SP1・BP5000 の S が BP6000 のバッカスフンドにアタックして負けるが、バッカスフンドは自身の※で撃破される
    s = attack(s, "TST-UNIT-0:s2", "RS-215:bac");
    expect(zoneOf(s, "player2", "RS-215:bac")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(heldCount(s)).toBe(3);
    expect(attack(pinkActive(), "RS-214:p", "TST-UNIT-0:e1").pendingEffectChoice?.playerId).toBe("player1");
  });
});

void act;
void legal;
