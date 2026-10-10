/**
 * カード別スペック: RS-179〜RS-187（第4弾「四雄の覚醒」オペレーション）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）
 *     ほか card_1/card_2/card_3/card_5/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canUseCard,
  cardIn,
  declineEffect,
  deckCards,
  enter,
  expectCatalogText,
  expectOpStats,
  fillers,
  inst,
  legalOfType,
  lineUp,
  pickEffect,
  playOp,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  useCard,
  zoneOf,
} from "./RS4-179-200.helpers";
import type { GameState } from "../types/game";

const YELLOW_M = sUnit("SPEC-YELLOW-M", { size: "M", category: "WB", bp: 3000, features: ["イエロー"] });

// ===========================================================================
describe("RS-179 恐竜やのカレー", () => {
  const TEXT = "※常駐（場に配置して、離れるまで効果が有効になる）特徴「イエロー」を持つ自軍SユニットはBP＋2000される。";

  it("RS-179: カタログ本文・スペックが出典と一致（出典: atwiki/page-39）", () => {
    expectCatalogText("RS-179", TEXT);
    expectOpStats("RS-179", { name: "恐竜やのカレー", category: "WB", powerCost: 2 });
  });

  // 「※常駐（場に配置して、離れるまで効果が有効になる）」
  it("RS-179: ※常駐 — ラッシュフェイズに使うと常駐置き場（operation）に配置され、効果が有効になる（出典: atwiki/page-39）", () => {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-179", "c")], command: releasedN(1), power: powerCards(2), rush: [inst("RS-189", "k")] },
    });
    expect(bpOf(s, "player1", "RS-189:k")).toBe(3000);
    const r = playOp(s, "player1", "RS-179:c");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-179:c")).toBe("operation");
    expect(bpOf(r.state, "player1", "RS-189:k")).toBe(5000);
  });

  it("RS-179: 必要パワー2 — パワー1枚では使えない（出典: atwiki/page-39）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-179", "c")], command: releasedN(1), power: powerCards(1) } });
    expect(canUseCard(s, "player1", "RS-179:c")).toBe(false);
  });

  // 「特徴「イエロー」を持つ自軍SユニットはBP＋2000される」
  it("RS-179: バトルエリア・ラッシュエリアの「イエロー」の自軍 S ユニットが BP+2000 される（出典: atwiki/page-39）", () => {
    const s = st({
      player1: { operation: [inst("RS-179", "c")], battle: [inst("RS-189", "k")], rush: [inst("RS-208", "kirin")] },
    });
    expect(bpOf(s, "player1", "RS-189:k")).toBe(5000);
    expect(bpOf(s, "player1", "RS-208:kirin")).toBe(5000);
  });

  it("RS-179: 「イエロー」以外の S ユニット・「イエロー」の M ユニット・敵軍の「イエロー」は上がらない（出典: atwiki/page-39「特徴「イエロー」を持つ自軍Sユニット」）", () => {
    const s = st(
      {
        player1: {
          operation: [inst("RS-179", "c")],
          battle: [inst("RS-190", "mido"), inst("SPEC-YELLOW-M", "ym"), inst("RS-189", "k")],
        },
        player2: { battle: [inst("RS-189", "ek")] },
      },
      [YELLOW_M],
    );
    expect(bpOf(s, "player1", "RS-189:k")).toBe(5000);
    expect(bpOf(s, "player1", "RS-190:mido")).toBe(3000);
    expect(bpOf(s, "player1", "SPEC-YELLOW-M:ym")).toBe(3000);
    expect(bpOf(s, "player2", "RS-189:ek")).toBe(3000);
  });

  it("RS-179: 敵軍ターン中も有効（ターンの指定がない）（出典: atwiki/page-39）", () => {
    const s = st({ activePlayer: "player2", player1: { operation: [inst("RS-179", "c")], battle: [inst("RS-189", "k")] } });
    expect(bpOf(s, "player1", "RS-189:k")).toBe(5000);
  });

  // grnrngr/faq-card-3「BP１０００になっている「RS-208 キリンレンジャー」自身も手札に戻りますか？」「はい、手札に戻ります。」
  // 既知の不具合: CARD-RS-208 【天時星・時間返し】（return_all_bp2000_hand）が未実装で、ゴーマ16世の下でカレーにより BP1000 になったキリンレンジャーが手札に戻らない（BP の「－」反転自体は適用済み）
  it.fails("RS-179: 敵軍にゴーマ16世があるとき、カレーで BP1000 になったキリンレンジャー自身も天時星・時間返しで手札に戻る（出典: grnrngr/faq-card-3 RS-179 Q1・atwiki/page-39 Q1）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-179", "c")], rush: [...fillers(3), inst("RS-208", "kirin")], deck: deckCards(3) },
      player2: { battle: [inst("RS-210", "g16")], deck: deckCards(3, "e") },
    });
    s = lineUp(s, ["TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-0:fill2"]);
    s = enter(s, "RS-208:kirin");
    expect(bpOf(s, "player1", "RS-208:kirin")).toBe(1000);
    s = pickEffect(s, "player1");
    expect(zoneOf(s, "player1", "RS-208:kirin")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-180 ライドラプター", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自軍コマンドをホールドしてSユニットをラッシュしたとき、次の効果を発動できる⇒自分の手札から「WB」のSユニットのカードを1枚選び、コマンドをホールドせずにラッシュする。ただし、ラッシュのための必要パワーと追加条件は満たすこと。この効果でラッシュしたユニットは、このターン、バトルエリアに出られない。";

  /** ライドラプター配置・リリース状態コマンド1つ・手札に WB の S ユニット2体。 */
  function raptor(extraHand: ReturnType<typeof inst>[] = [], power = 3): GameState {
    return st({
      phase: "rush",
      turn: 3,
      player1: {
        operation: [inst("RS-180", "rap")],
        hand: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), ...extraHand],
        command: releasedN(1),
        power: powerCards(power),
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });
  }

  it("RS-180: カタログ本文・スペックが出典と一致（出典: atwiki/page-377）", () => {
    expectCatalogText("RS-180", TEXT);
    expectOpStats("RS-180", { name: "ライドラプター", category: "WB", powerCost: 2 });
  });

  it("RS-180: ※常駐 — 使うと常駐置き場に配置される（出典: atwiki/page-377）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-180", "c")], command: releasedN(1), power: powerCards(2) } });
    const r = playOp(s, "player1", "RS-180:c");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-180:c")).toBe("operation");
  });

  // 「自軍コマンドをホールドしてSユニットをラッシュしたとき、次の効果を発動できる⇒…コマンドをホールドせずにラッシュする」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装（Sユニットをラッシュしても追加ラッシュの選択が出ない）
  it.fails("RS-180: コマンドをホールドして S ユニットをラッシュしたとき、手札の「WB」の S ユニットをホールドせずにラッシュできる（出典: atwiki/page-377）", () => {
    const r = rushFromHand(raptor(), "player1", "TST-UNIT-0:a");
    expect(r.ok).toBe(true);
    const s = pickEffect(r.state, "player1", ["TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // 「発動できる」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装（発動するかどうかの選択自体が出ない）
  it.fails("RS-180: 発動は任意 — 選択が出て、発動しなければ手札の S ユニットは手札に残る（出典: atwiki/page-377「発動できる」）", () => {
    const r = rushFromHand(raptor(), "player1", "TST-UNIT-0:a");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-180");
    const s = declineEffect(r.state, "player1");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("rush");
  });

  // 「手札から「WB」のSユニットのカードを1枚選び」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装
  it.fails("RS-180: 選べるのは「WB」の S ユニットのカードだけ（WB の S は選べ、DA の S・WB の M は選べない）（出典: atwiki/page-377）", () => {
    const r = rushFromHand(raptor([inst("RS-188", "da"), inst("TST-UNIT-2", "m")]), "player1", "TST-UNIT-0:a");
    const p = r.state.pendingEffectChoice;
    expect(p?.validInstanceIds ?? []).toContain("TST-UNIT-0:b");
    expect(p?.validInstanceIds ?? []).not.toContain("RS-188:da");
    expect(p?.validInstanceIds ?? []).not.toContain("TST-UNIT-2:m");
  });

  // 「ただし、ラッシュのための必要パワーと追加条件は満たすこと」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装
  it.fails("RS-180: 必要パワーは満たす必要がある（パワー0の S は出せ、必要パワー3の S はパワー2では出せない）（出典: atwiki/page-377）", () => {
    const WB_S3 = sUnit("SPEC-WB-S3", { powerCost: 3 });
    const s0 = st(
      {
        phase: "rush",
        turn: 3,
        player1: {
          operation: [inst("RS-180", "rap")],
          hand: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("SPEC-WB-S3", "c3")],
          command: releasedN(1),
          power: powerCards(2),
          deck: deckCards(3),
        },
      },
      [WB_S3],
    );
    const r = rushFromHand(s0, "player1", "TST-UNIT-0:a");
    const p = r.state.pendingEffectChoice;
    expect(p?.validInstanceIds ?? []).toContain("TST-UNIT-0:b");
    expect(p?.validInstanceIds ?? []).not.toContain("SPEC-WB-S3:c3");
  });

  // 「この効果でラッシュしたユニットは、このターン、バトルエリアに出られない」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装
  it.fails("RS-180: この効果でラッシュしたユニットはそのターンのバトルフェイズにバトルエリアに出られない（通常ラッシュした方は出られる）（出典: atwiki/page-377）", () => {
    const r = rushFromHand(raptor(), "player1", "TST-UNIT-0:a");
    let s = pickEffect(r.state, "player1", ["TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("rush");
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.phase).toBe("battle");
    const entries = legalOfType(s, "move_to_battle").map((a) => a.instanceId);
    expect(entries).toContain("TST-UNIT-0:a");
    expect(entries).not.toContain("TST-UNIT-0:b");
  });

  // 「自軍コマンドをホールドしてSユニットをラッシュしたとき」— M ユニットのラッシュでは発動しない。
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装（S ユニット側の発動も確認できない）
  it.fails("RS-180: M ユニットをラッシュしても発動せず、続けて S ユニットをラッシュしたときは発動する（出典: atwiki/page-377「Sユニットをラッシュしたとき」）", () => {
    const s0 = st({
      phase: "rush",
      turn: 3,
      player1: {
        operation: [inst("RS-180", "rap")],
        hand: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")],
        command: releasedN(2),
        power: powerCards(3),
        deck: deckCards(3),
      },
    });
    const r = rushFromHand(s0, "player1", "TST-UNIT-2:m");
    expect(r.ok).toBe(true);
    let s = pickEffect(r.state, "player1", ["TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("hand");
    const r2 = rushFromHand(s, "player1", "TST-UNIT-0:a");
    s = pickEffect(r2.state, "player1", ["TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("rush");
  });

  // atwiki/page-377 Q1「自軍ユニットのコールの効果でユニットをラッシュしました。…発動することはできますか？」「はい、できます。」
  // 既知の不具合: CARD-RS-180 常駐の誘発効果が未実装（コールでホールドしたラッシュでも発動しない）
  it.fails("RS-180: コール（ユニットをコマンドとしてホールド）でラッシュしたときも発動できる（出典: atwiki/page-377 Q1）", () => {
    const s0 = st({
      phase: "rush",
      turn: 3,
      player1: {
        operation: [inst("RS-180", "rap")],
        rush: [inst("RS-600", "silver")],
        hand: [inst("RS-200", "ot"), inst("TST-UNIT-0", "b")],
        command: [],
        power: powerCards(3),
        deck: deckCards(3),
      },
    });
    let s = act(s0, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-200:ot" });
    if (s.pendingRush) s = act(s, { type: "pass_rush_reaction", playerId: "player2" });
    expect(zoneOf(s, "player1", "RS-200:ot")).toBe("rush");
    s = pickEffect(s, "player1", ["TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-181 破邪百獣剣", () => {
  const TEXT = "ナンバーを持たないSユニットを、敵軍コマンドゾーンのカテゴリの数まで好きな数選び撃破する。";

  /** 敵軍コマンドゾーンのカテゴリ数 = cats。 */
  function blade(cats: string[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
    return st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-181", "c")], command: releasedN(1), power: powerCards(5), deck: deckCards(3), ...p1 },
      player2: { command: cats.map((id, i) => released(id, `ec${i}`)), deck: deckCards(3, "e"), ...p2 },
    });
  }

  it("RS-181: カタログ本文・スペックが出典と一致（出典: atwiki/page-378）", () => {
    expectCatalogText("RS-181", TEXT);
    expectOpStats("RS-181", { name: "破邪百獣剣", category: "WB", powerCost: 5 });
  });

  it("RS-181: ナンバーを持たない S ユニットを選んで撃破できる（ナンバーを持つ S・M ユニットは選べない）（出典: atwiki/page-378）", () => {
    const s = blade(["TST-OP"], {}, { battle: [inst("RS-188", "e1"), inst("RS-189", "num"), inst("RS-195", "m")] });
    const r = playOp(s, "player1", "RS-181:c");
    expect(r.ok).toBe(true);
    const valid = r.state.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain("RS-188:e1");
    expect(valid).not.toContain("RS-189:num");
    expect(valid).not.toContain("RS-195:m");
    const n = act(r.state, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-188:e1" });
    expect(zoneOf(settle(n), "player2", "RS-188:e1")).toBe("discard");
  });

  // 「敵軍コマンドゾーンのカテゴリの数まで好きな数選び」
  // 既知の不具合: CARD-RS-181 カテゴリ数（zoneCategoryDestroyLimit）が使われず、1体選んだ時点で効果が終わる
  it.fails("RS-181: 敵軍コマンドゾーンのカテゴリが2つなら2体まで選んで撃破できる（出典: atwiki/page-378）", () => {
    const s = blade(["TST-OP", "TST-OP-ET", "TST-OP-ET"], {}, { battle: [inst("RS-188", "e1"), inst("TST-UNIT-0", "e2")], rush: [inst("RS-188", "e3")] });
    let n = playOp(s, "player1", "RS-181:c").state;
    n = pickEffect(n, "player1", ["RS-188:e1", "TST-UNIT-0:e2"]);
    n = settle(n);
    expect(zoneOf(n, "player2", "RS-188:e1")).toBe("discard");
    expect(zoneOf(n, "player2", "TST-UNIT-0:e2")).toBe("discard");
    expect(zoneOf(n, "player2", "RS-188:e3")).toBe("rush");
  });

  it("RS-181: カテゴリが1つなら1体まで（2体目は選べない）（出典: atwiki/page-378）", () => {
    const s = blade(["TST-OP", "TST-OP"], {}, { battle: [inst("RS-188", "e1"), inst("TST-UNIT-0", "e2")] });
    let n = playOp(s, "player1", "RS-181:c").state;
    n = pickEffect(n, "player1", ["RS-188:e1", "TST-UNIT-0:e2"]);
    n = settle(n);
    expect(zoneOf(n, "player2", "RS-188:e1")).toBe("discard");
    expect(zoneOf(n, "player2", "TST-UNIT-0:e2")).toBe("battle");
  });

  it("RS-181: 「好きな数」— 0体（選ばない）でもよい（出典: atwiki/page-378）", () => {
    const s = blade(["TST-OP"], {}, { battle: [inst("RS-188", "e1")] });
    let n = playOp(s, "player1", "RS-181:c").state;
    n = declineEffect(n, "player1");
    expect(zoneOf(n, "player2", "RS-188:e1")).toBe("battle");
    expect(n.pendingEffectChoice).toBeUndefined();
  });

  // 一般ルール R-TGT-04「対象に自軍・敵軍の指定がなければ、自分のユニット（自身を含む）も選べる」
  // 既知の不具合: CARD-RS-181 候補が敵軍ユニットだけで、自軍のナンバーを持たない S ユニットを選べない
  it.fails("RS-181: 自軍のナンバーを持たない S ユニットも選べる（出典: R-TGT-04・atwiki/page-378「Sユニット」）", () => {
    const s = blade(["TST-OP"], { battle: [inst("RS-188", "own")] }, { battle: [inst("RS-188", "e1")] });
    const r = playOp(s, "player1", "RS-181:c");
    expect(r.state.pendingEffectChoice?.validInstanceIds ?? []).toContain("RS-188:own");
  });

  // grnrngr/faq-card-4 RS-181 Q1「先にユニットを可能な数まで選んでから１体ずつ撃破してください。」
  // 既知の不具合: CARD-RS-181 1体選んだ時点で撃破して終わるため「先に全部選ぶ」手順にならない
  it.fails("RS-181: 先に可能な数まで選んでから1体ずつ撃破する（2体目を選ぶまで1体目は撃破されない）（出典: grnrngr/faq-card-4 RS-181 Q1・R-TGT-03）", () => {
    const s = blade(["TST-OP", "TST-OP-ET"], {}, { battle: [inst("RS-188", "e1"), inst("TST-UNIT-0", "e2")] });
    let n = playOp(s, "player1", "RS-181:c").state;
    n = act(n, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-188:e1" });
    expect(zoneOf(n, "player2", "RS-188:e1")).toBe("battle");
    expect(n.pendingEffectChoice?.validInstanceIds ?? []).toContain("TST-UNIT-0:e2");
  });

  // grnrngr/faq-card-4 RS-181 Q2「「ＲＣ」もナンバーに含まれますので、選ぶことはできません。」
  // 既知の不具合: CARD-RS-181 ナンバー「RC」の S ユニット（仮面ライダー1号）を「ナンバーを持たない」として選べてしまう
  it.fails("RS-181: ナンバーに「RC」を持つ S ユニットは選べない（出典: grnrngr/faq-card-4 RS-181 Q2）", () => {
    const s = blade(["TST-OP"], {}, { battle: [inst("RK-023", "rc"), inst("TST-UNIT-0", "e2")] });
    const r = playOp(s, "player1", "RS-181:c");
    const valid = r.state.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain("TST-UNIT-0:e2");
    expect(valid).not.toContain("RK-023:rc");
  });
});

// ===========================================================================
describe("RS-182 ジャイアントローラー", () => {
  const TEXT = "自軍Sユニットを1体選ぶ。このターン、選んだユニットとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く。";

  /** バトルエリアの自軍 S（キレンジャー BP3000）を選んでジャイアントローラーを使い、バトルフェイズへ。 */
  function rolled(p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}): GameState {
    let s = st({
      phase: "rush",
      turn: 3,
      player1: {
        hand: [inst("RS-182", "c")],
        command: releasedN(2, "TST-OP-MA"),
        power: powerCards(6),
        battle: [inst("RS-189", "k")],
        deck: deckCards(3),
        ...p1,
      },
      player2: { deck: deckCards(5, "e"), ...p2 },
    });
    s = playOp(s, "player1", "RS-182:c").state;
    s = pickEffect(s, "player1", ["RS-189:k"]);
    return { ...s, phase: "battle" };
  }

  it("RS-182: カタログ本文・スペックが出典と一致（出典: atwiki/page-379）", () => {
    expectCatalogText("RS-182", TEXT);
    expectOpStats("RS-182", { name: "ジャイアントローラー", category: "MA", powerCost: 6 });
  });

  // 一般ルール R-TGT-01「「ユニット」はユニットとして扱われているもの（ラッシュエリア・バトルエリア）」、R-RUSHPH-01（使えるのはラッシュフェイズ）
  // 既知の不具合: CARD-RS-182 選べる候補がバトルエリアだけで、ラッシュフェイズに通常いるラッシュエリアの自軍 S ユニットを選べず不発になる
  it.fails("RS-182: ラッシュエリアの自軍 S ユニットを選べる（出典: atwiki/page-379「自軍Sユニットを1体選ぶ」・R-TGT-01）", () => {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-182", "c")], command: releasedN(2, "TST-OP-MA"), power: powerCards(6), rush: [inst("RS-189", "k"), inst("TST-UNIT-2", "m")] },
    });
    const r = playOp(s, "player1", "RS-182:c");
    expect(r.ok).toBe(true);
    const valid = r.state.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain("RS-189:k");
    expect(valid).not.toContain("TST-UNIT-2:m");
  });

  it("RS-182: 選べるのは自軍の S ユニットだけ（M・敵軍のユニットは候補にない）（出典: atwiki/page-379）", () => {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-182", "c")], command: releasedN(2, "TST-OP-MA"), power: powerCards(6), battle: [inst("RS-189", "k"), inst("TST-UNIT-2", "m")] },
      player2: { battle: [inst("TST-UNIT-0", "e")] },
    });
    const r = playOp(s, "player1", "RS-182:c");
    expect(r.state.pendingEffectChoice?.validInstanceIds).toEqual(["RS-189:k"]);
  });

  // 「選んだユニットとバトルしたユニットは、撃破されて捨札になったとき、持ち主のパワーゾーンにダメージにして置く」
  // 既知の不具合: CARD-RS-182 撃破されたユニットが捨札を経由せずオモテ向きでパワーゾーンに置かれ、ダメージ（ウラ向き・ダメージ数+1）にならない
  it.fails("RS-182: 選んだユニットとバトルして撃破されたユニットは、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-379）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-0", "e1")] });
    s = settle(attack(s, "RS-189:k", "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:e1")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  // 既知の不具合: CARD-RS-182 選んだユニット側のバトルでもダメージにならない（上記）ため、対比が成立しない
  it.fails("RS-182: 選んでいないユニットとのバトルで撃破されたユニットは通常どおり捨札になり、選んだユニットとのバトルではダメージになる（出典: atwiki/page-379「選んだユニットとバトルしたユニットは」）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] }, { battle: [inst("RS-189", "k"), inst("RS-190", "other")] });
    s = settle(attack(s, "RS-190:other", "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
    s = settle(attack(s, "RS-189:k", "TST-UNIT-0:e2"));
    expect(s.players.player2.damage).toBe(1);
  });

  // atwiki/page-379 カード評価「効果の対象が「バトルしたユニット」で持ち主の記載がない」— 選んだユニット自身ではなく相手のユニットが対象。
  // 既知の不具合: CARD-RS-182 選んだユニット自身もバトルで撃破されるとパワーゾーンに置かれる（捨札にならない）
  it.fails("RS-182: 選んだユニット自身がバトルで撃破されてもダメージにはならない（出典: atwiki/page-379「選んだユニットとバトルしたユニット」）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-2", "big")] });
    s = settle(attack(s, "RS-189:k", "TST-UNIT-2:big"));
    expect(zoneOf(s, "player1", "RS-189:k")).toBe("discard");
    expect(s.players.player1.power.some((c) => c.instanceId === "RS-189:k")).toBe(false);
    expect(s.players.player1.damage).toBe(0);
  });

  // 「このターン」— 次のターンには効果が残らない（R-TURN-04）。
  // 既知の不具合: CARD-RS-182 使用ターンにもダメージにならない（上記）ため、ターンの区切りを確認できない
  it.fails("RS-182: 効果は「このターン」だけ — 使用ターンはダメージになり、次の敵軍ターンにバトルした相手は捨札になる（出典: atwiki/page-379・R-TURN-04）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-0", "e0")], rush: [inst("TST-UNIT-0", "e1")] });
    s = settle(attack(s, "RS-189:k", "TST-UNIT-0:e0"));
    expect(s.players.player2.damage).toBe(1);
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = { ...s, activePlayer: "player2", phase: "battle", turn: 4 };
    s = enter(s, "TST-UNIT-0:e1", "player2");
    s = settle(attack(s, "TST-UNIT-0:e1", "RS-189:k", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  // grnrngr/faq-card-4 RS-182 Q1「「撃破されて捨札になったとき」の条件を満たさないため、ダメージとしては置かれません。」
  it("RS-182: 撃破された敵軍ユニットがカウンター（ダイノガッツ）で捨札に送られなかった場合はダメージにならない（出典: grnrngr/faq-card-4 RS-182 Q1・R-DESTROY-02）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-0", "e1")], hand: [inst("RS-027", "guts")], command: releasedN(1, "TST-OP", "ew") });
    s = attack(s, "RS-189:k", "TST-UNIT-0:e1");
    expect(canUseCard(s, "player2", "RS-027:guts")).toBe(true);
    s = settle(useCard(s, "player2", "RS-027:guts"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
    expect(s.players.player2.power.some((c) => c.instanceId === "TST-UNIT-0:e1")).toBe(false);
  });

  // grnrngr/faq-card-4 RS-182 Q2（grnrngr/faq-card-2 にも同じ Q）「撃破されたユニットはダメージにはならず、持ち主のパワーゾーンにオモテ向きに置かれます。」
  it("RS-182: 敵軍ラッシュエリアにレスキューファイターがあれば、撃破された WB の M ユニットはダメージにならずオモテ向きでパワーゾーンに置かれる（出典: grnrngr/faq-card-4 RS-182 Q2・R-REPL-02）", () => {
    const WB_M = sUnit("SPEC-WB-M", { size: "M", category: "WB", bp: 2000 });
    let s = st(
      {
        phase: "rush",
        turn: 3,
        player1: { hand: [inst("RS-182", "c")], command: releasedN(2, "TST-OP-MA"), power: powerCards(6), battle: [inst("RS-189", "k")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-WB-M", "m")], rush: [inst("RS-089", "rescue")], deck: deckCards(3, "e") },
      },
      [WB_M],
    );
    s = pickEffect(playOp(s, "player1", "RS-182:c").state, "player1", ["RS-189:k"]);
    s = settle(attack({ ...s, phase: "battle" }, "RS-189:k", "SPEC-WB-M:m"));
    const card = s.players.player2.power.find((c) => c.instanceId === "SPEC-WB-M:m");
    expect(card).toBeDefined();
    expect(card?.faceDown ?? false).toBe(false);
    expect(s.players.player2.damage).toBe(0);
  });

  // grnrngr/faq-card-4 RS-182 Q3「「RS-052 爆竜トリケラトプス」が捨札になるだけです。」
  // 既知の不具合: CARD-RS-182 ジャイアントローラーの対象とバトルすると撃破先が「パワーゾーン」に置き換わり、【超シールド進化】の窓が開かない
  it.fails("RS-182: 相手が爆竜トリケラトプスをかわりに捨札にしたら、トリケラトプスは捨札になるだけでダメージにならない（出典: grnrngr/faq-card-4 RS-182 Q3・R-REPL-01）", () => {
    let s = rolled({ battle: [inst("TST-UNIT-0", "e1"), inst("RS-052", "tri")], power: powerCards(3, "ep") });
    s = attack(s, "RS-189:k", "TST-UNIT-0:e1");
    expect(legalOfType(s, "use_super_shield")).toHaveLength(1);
    s = settle(act(s, { type: "use_super_shield", playerId: "player2" }));
    expect(zoneOf(s, "player2", "RS-052:tri")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });

  // grnrngr/faq-rider-1「効果の対象が適切であるかどうかのチェックは、効果の対象を選ぶときにだけ行われます。」
  it.todo(
    "RS-182: 選んだ後で J パワーにより L ユニットになっても効果は無効にならない（出典: grnrngr/faq-rider-1 RS-182・RK-013 の Q）— RK-013 J パワーで自軍 S ユニットを重ねる手順が公開 API で成立しない（使用しても重ねが起きない）ため状況を作れない",
  );
});

// ===========================================================================
describe("RS-183 黒子ロボの記憶操作", () => {
  const TEXT =
    "この効果は、自分が行ったあとで相手も行う⇒3枚までドローする。そして、以下の手順を3回行う。自分の手札を相手に見せずに1枚選ばせ、選ばれたカードを自軍山札の上に戻す。ただし、自軍コマンドを1つホールドすれば戻さなくてもよい。";

  /** 使用後の状態（MA のコマンド1つで支払い、リリース状態のコマンドが spare 個残る）。 */
  function kuroko(spare = 0, p1Deck = 5, p2Deck = 5): GameState {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: {
        hand: [inst("RS-183", "c"), inst("TST-OP", "h1"), inst("TST-OP", "h2")],
        command: [released("TST-OP-MA", "pay"), ...releasedN(spare, "TST-OP", "sp")],
        power: powerCards(2),
        deck: deckCards(p1Deck),
      },
      player2: { hand: [inst("TST-OP", "oh1")], deck: deckCards(p2Deck, "e") },
    });
    let n = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-183:c" });
    if (n.pendingCommandPayment) {
      n = act(n, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-MA:pay"] });
    }
    return n;
  }
  const draw = (s: GameState, p: "player1" | "player2") => act(s, { type: "resolve_effect_choice", playerId: p, instanceId: "draw" });
  const stop = (s: GameState, p: "player1" | "player2") => act(s, { type: "skip_effect_choice", playerId: p });
  /** 「自軍コマンドを1つホールドすれば戻さなくてもよい」— 指定コマンドをホールドする。 */
  const holdCmd = (s: GameState, cmd: string) =>
    act(s, { type: "initiate_command_payment", playerId: "player1", kind: "effect_hold", sourceInstanceId: cmd });

  it("RS-183: カタログ本文・スペックが出典と一致（出典: atwiki/page-42）", () => {
    expectCatalogText("RS-183", TEXT);
    expectOpStats("RS-183", { name: "黒子ロボの記憶操作", category: "MA", powerCost: 2 });
  });

  // 「3枚までドローする。そして、以下の手順を3回行う。…選ばれたカードを自軍山札の上に戻す」
  it("RS-183: 3枚ドローし、その後手札を3回山札の上に戻す（自分が行ったあとで相手も行う）（出典: atwiki/page-42）", () => {
    let s = kuroko();
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = draw(draw(draw(s, "player1"), "player1"), "player1");
    // 手札 2 + 3 − 3 = 2、山札 5 − 3 + 3 = 5
    expect(s.players.player1.hand).toHaveLength(2);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = draw(draw(draw(s, "player2"), "player2"), "player2");
    expect(s.players.player2.hand).toHaveLength(1);
    expect(s.players.player2.deck).toHaveLength(5);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.activePlayer).toBe("player1");
  });

  // 「ただし、自軍コマンドを1つホールドすれば戻さなくてもよい」
  it("RS-183: 自軍コマンドを1つホールドすれば、その回は山札に戻さなくてよい（出典: atwiki/page-42）", () => {
    let s = kuroko(1);
    s = stop(s, "player1");
    expect(s.pendingEffectChoice?.kind).toBe("select_command");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-OP:sp0"]);
    s = holdCmd(s, "TST-OP:sp0");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:sp0")?.commandHeld).toBe(true);
    // 1回はホールドで回避、残り2回は戻す: 手札 2 − 2 = 0
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(7);
  });

  it("RS-183: ホールドは任意 — ホールドせずに戻すこともできる（出典: atwiki/page-42「戻さなくてもよい」）", () => {
    let s = kuroko(1);
    s = stop(s, "player1");
    s = stop(s, "player1");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:sp0")?.commandHeld ?? false).toBe(false);
  });

  // grnrngr/faq-card-4 RS-183 Q1「はい、０～２枚のドローも可能です。」
  it("RS-183: 0〜2枚のドローも可能（出典: grnrngr/faq-card-4 RS-183 Q1）", () => {
    let s = kuroko();
    s = stop(draw(s, "player1"), "player1");
    // 1枚だけドロー: 手札 2 + 1 = 3 から 3 回戻す
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(7);
  });

  // grnrngr/faq-card-4 RS-183 Q2「はい、３回のままです。」
  it("RS-183: ドローを0枚にしても戻す手順は3回のまま（出典: grnrngr/faq-card-4 RS-183 Q2）", () => {
    let s = kuroko();
    s = stop(s, "player1");
    // 手札 2 枚しかないので 2 枚戻り、3 回目は手札がない
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(7);
  });

  // grnrngr/faq-card-4 RS-183 Q3「自分と相手のドローの枚数は同じである必要はありません。」
  it("RS-183: 自分が3枚ドローしても相手は0〜2枚にできる（出典: grnrngr/faq-card-4 RS-183 Q3）", () => {
    let s = kuroko();
    s = draw(draw(draw(s, "player1"), "player1"), "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = stop(s, "player2");
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.players.player2.deck).toHaveLength(6);
  });

  // grnrngr/faq-card-4 RS-183 Q4「山札にカードを残すようにドローすることで、ゲームに負けてしまうことを回避できます。」
  it("RS-183: 山札が3枚以下でも、山札を残すようにドローすれば負けない（その後の戻す手順は必ず3回）（出典: grnrngr/faq-card-4 RS-183 Q4・R-WIN-04）", () => {
    let s = kuroko(0, 2, 5);
    s = stop(draw(s, "player1"), "player1");
    expect(s.winner).toBeNull();
    // 手札 2 + 1 = 3 を3回戻す
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  // grnrngr/faq-card-4 RS-183 Q5「手札は相手に選ばせる前にシャッフルすることが可能」
  it.todo(
    "RS-183: 手札は相手に選ばせる前にシャッフルしてよい（出典: grnrngr/faq-card-4 RS-183 Q5）— エンジンは「見せずに選ばせる」を無作為抽出で表し、手札の並び順という概念がないため検証できない",
  );

  // grnrngr/faq-card-4 RS-183 Q6「はい、手札に戻ります。」
  it("RS-183: ホールドして戻さなかったカードは手札に残る（出典: grnrngr/faq-card-4 RS-183 Q6）", () => {
    let s = kuroko(3);
    s = stop(s, "player1");
    for (const id of ["TST-OP:sp0", "TST-OP:sp1", "TST-OP:sp2"]) s = holdCmd(s, id);
    expect(s.players.player1.hand.map((c) => c.instanceId).sort()).toEqual(["TST-OP:h1", "TST-OP:h2"]);
    expect(s.players.player1.deck).toHaveLength(5);
  });
});

// ===========================================================================
describe("RS-184 マジパンチ", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる）BP8000以下の敵軍ユニットにストライクされたとき発動できる⇒ストライクしてきた敵軍ユニットを持ち主の手札に戻す。そのとき、敵軍のストライクは無効になる。";

  /** 敵軍ターン：敵軍の striker（BP bp）が自軍にストライクしてきた直後。 */
  function struck(bp: number, extraHand: ReturnType<typeof inst>[] = []): GameState {
    const STRIKER = sUnit("SPEC-STRIKER", { bp, sp: 1 });
    let s = st(
      {
        turn: 4,
        activePlayer: "player2",
        player1: { hand: [inst("RS-184", "c"), ...extraHand], command: releasedN(4, "TST-OP-MA"), power: powerCards(5), deck: deckCards(5) },
        player2: { battle: [inst("SPEC-STRIKER", "s")], deck: deckCards(5, "e") },
      },
      [STRIKER],
    );
    s = strike(s, "SPEC-STRIKER:s", "player2");
    return s;
  }

  it("RS-184: カタログ本文・スペックが出典と一致（出典: atwiki/page-311）", () => {
    expectCatalogText("RS-184", TEXT);
    expectOpStats("RS-184", { name: "マジパンチ", category: "MA", powerCost: 5 });
  });

  // 「BP8000以下の敵軍ユニットにストライクされたとき発動できる⇒ストライクしてきた敵軍ユニットを持ち主の手札に戻す。そのとき、敵軍のストライクは無効になる」
  // 既知の不具合: CARD-RS-184 ストライクされたときにカウンターとして使う窓が開かない（未実装）
  it.fails("RS-184: BP8000以下の敵軍ユニットにストライクされたとき使え、そのユニットを手札に戻しストライクを無効にする（出典: atwiki/page-311）", () => {
    let s = struck(8000);
    expect(canUseCard(s, "player1", "RS-184:c")).toBe(true);
    s = settle(useCard(s, "player1", "RS-184:c"));
    expect(zoneOf(s, "player2", "SPEC-STRIKER:s")).toBe("hand");
    expect(s.players.player1.damage).toBe(0);
  });

  // 「BP8000以下の」
  // 既知の不具合: CARD-RS-184 カウンターの窓が開かない（未実装）
  it.fails("RS-184: BP9000 のユニットのストライクには使えない（BP8000 のユニットには使える）（出典: atwiki/page-311「BP8000以下」）", () => {
    expect(canUseCard(struck(8000), "player1", "RS-184:c")).toBe(true);
    expect(canUseCard(struck(9000), "player1", "RS-184:c")).toBe(false);
  });

  // 既知の不具合: CARD-RS-184 カウンターの窓が開かない（未実装）— 「使える状況で使わない」選択を確認できない
  it.fails("RS-184: 使える状況でも使わなければストライクはそのまま通りダメージを受ける（出典: atwiki/page-311「発動できる」）", () => {
    expect(canUseCard(struck(3000), "player1", "RS-184:c")).toBe(true);
    const s = settle(struck(3000));
    expect(s.players.player1.damage).toBe(1);
    expect(zoneOf(s, "player1", "RS-184:c")).toBe("hand");
  });

  // 「※カウンター（これは敵軍ターン中にのみ使用できる）」・ユーザー決定（※カウンターは敵軍ターン中のみ）
  // 既知の不具合: CARD-RS-184 カウンターの窓が開かない（未実装）— 敵軍ターン中に使えることを確認できない
  it.fails("RS-184: ※カウンター — 敵軍ターン中は使えるが、自軍ラッシュフェイズには使えない（出典: atwiki/page-311・R-CTR-01）", () => {
    expect(canUseCard(struck(3000), "player1", "RS-184:c")).toBe(true);
    const own = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-184", "c")], command: releasedN(2, "TST-OP-MA"), power: powerCards(5) } });
    expect(canUseCard(own, "player1", "RS-184:c")).toBe(false);
  });

  // 既知の不具合: CARD-RS-184 カウンターの窓が開かない（未実装）— ストライク側で使えることを確認できない
  it.fails("RS-184: ストライクされたときは使えるが、アタックされたときには使えない（出典: atwiki/page-311「ストライクされたとき」）", () => {
    expect(canUseCard(struck(3000), "player1", "RS-184:c")).toBe(true);
    let s = st({
      turn: 4,
      activePlayer: "player2",
      player1: { hand: [inst("RS-184", "c")], command: releasedN(2, "TST-OP-MA"), power: powerCards(5), battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "a")], deck: deckCards(3, "e") },
    });
    s = attack(s, "TST-UNIT-2:a", "TST-UNIT-0:d", "player2");
    expect(canUseCard(s, "player1", "RS-184:c")).toBe(false);
  });

  // grnrngr/faq-card-4 RS-184 Q1（grnrngr/faq-card-1 にも同じ Q）「はい、できます。」
  // 既知の不具合: CARD-RS-184 カウンターの窓が開かない（未実装）
  it.fails("RS-184: 1回のストライクに対してマジパンチを同時に2枚使える（出典: grnrngr/faq-card-4 RS-184 Q1・R-CTR-02）", () => {
    let s = struck(3000, [inst("RS-184", "c2")]);
    s = useCard(s, "player1", "RS-184:c");
    expect(canUseCard(s, "player1", "RS-184:c2")).toBe(true);
    s = settle(useCard(s, "player1", "RS-184:c2"));
    expect(zoneOf(s, "player1", "RS-184:c")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-184:c2")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-185 カーナビック", () => {
  const TEXT = "相手の手札を見て、カウンターのオペレーションカードがあれば1枚選び、持ち主のパワーゾーンにダメージにして置く。";

  function navi(oppHand: ReturnType<typeof inst>[]): GameState {
    return st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-185", "c")], command: releasedN(1, "TST-OP-OT"), power: powerCards(3), deck: deckCards(3) },
      player2: { hand: oppHand, deck: deckCards(3, "e") },
    });
  }

  it("RS-185: カタログ本文・スペックが出典と一致（出典: atwiki/page-389）", () => {
    expectCatalogText("RS-185", TEXT);
    expectOpStats("RS-185", { name: "カーナビック", category: "OT", powerCost: 3 });
  });

  // 「相手の手札を見て、カウンターのオペレーションカードがあれば1枚選び、持ち主のパワーゾーンにダメージにして置く」
  // 既知の不具合: CARD-RS-185 効果が未実装（使っても相手の手札のカウンターが動かない）
  it.fails("RS-185: 相手の手札のカウンターのオペレーションカードを1枚選び、相手のパワーゾーンにダメージ（ウラ向き）として置く（出典: atwiki/page-389）", () => {
    const r = playOp(navi([inst("RS-184", "x"), inst("TST-OP", "y")]), "player1", "RS-185:c");
    expect(r.ok).toBe(true);
    const s = pickEffect(r.state, "player1", ["RS-184:x"]);
    expect(zoneOf(s, "player2", "RS-184:x")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "RS-184:x")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP:y")).toBe("hand");
  });

  // 「カウンターのオペレーションカードがあれば」・R-RUSHPH-01（通常のオペレーションはラッシュフェイズに使う）
  // 既知の不具合: CARD-RS-185 効果が未実装 — カウンターがある場合との対比が成立しない
  it.fails("RS-185: カウンターでないカードは選べず、カウンターでないカードしかなければ何も置かれない（出典: atwiki/page-389「カウンターのオペレーションカードがあれば」）", () => {
    const withCounter = playOp(navi([inst("RS-184", "x"), inst("TST-OP", "y2")]), "player1", "RS-185:c").state;
    expect(withCounter.pendingEffectChoice?.validInstanceIds).toEqual(["RS-184:x"]);
    const r = playOp(navi([inst("TST-OP", "y")]), "player1", "RS-185:c");
    expect(r.ok).toBe(true);
    const s = pickEffect(r.state, "player1", ["TST-OP:y"]);
    expect(zoneOf(s, "player2", "TST-OP:y")).toBe("hand");
    expect(s.players.player2.damage).toBe(0);
  });

  // カーナビックはカウンターではないので、自軍ラッシュフェイズに使える（R-RUSHPH-01）。
  // 既知の不具合: CARD-RS-185 効果種別が counter 扱いで、自軍ラッシュフェイズの合法手に使用が出ない
  it.fails("RS-185: ※カウンターではない — 自軍ラッシュフェイズに使える（出典: atwiki/page-389・R-RUSHPH-01）", () => {
    const s = navi([inst("RS-184", "x")]);
    expect(canUseCard(s, "player1", "RS-185:c")).toBe(true);
  });
});

// ===========================================================================
describe("RS-186 プロバイダーベース", () => {
  const TEXT =
    "自軍山札を見て、Sユニット以外の特徴「メカ」を持つユニットのカードを5枚まで選び、相手に見せる。その後、山札をシャッフルし、選んだカードを好きな順で山札の上に戻す。";

  function base(deck: ReturnType<typeof inst>[]): GameState {
    return st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-186", "c")], command: releasedN(1, "TST-OP-OT"), power: powerCards(3), deck },
    });
  }

  it("RS-186: カタログ本文・スペックが出典と一致（出典: atwiki/page-390）", () => {
    expectCatalogText("RS-186", TEXT);
    expectOpStats("RS-186", { name: "プロバイダーベース", category: "OT", powerCost: 3 });
  });

  // 「Sユニット以外の特徴「メカ」を持つユニットのカードを5枚まで選び…選んだカードを好きな順で山札の上に戻す」
  // 既知の不具合: CARD-RS-186 効果が未実装（使っても山札が変化しない）
  it.fails("RS-186: S ユニット以外の「メカ」のユニットカードを選び、山札の上に置く（出典: atwiki/page-390）", () => {
    const deck = [inst("TST-OP", "d0"), inst("TST-OP", "d1"), inst("TST-OP", "d2"), inst("RS-196", "mob"), inst("RS-194", "robo")];
    let s = playOp(base(deck), "player1", "RS-186:c").state;
    s = pickEffect(s, "player1", ["RS-196:mob", "RS-194:robo"]);
    const top2 = s.players.player1.deck.slice(0, 2).map((c) => c.instanceId).sort();
    expect(top2).toEqual(["RS-194:robo", "RS-196:mob"]);
    expect(s.players.player1.deck).toHaveLength(5);
  });

  // 「Sユニット以外の特徴「メカ」を持つユニット」・「5枚まで」
  // 既知の不具合: CARD-RS-186 効果が未実装
  it.fails("RS-186: 選べるのは S 以外の「メカ」のユニットだけ（メカの S・メカでない M・オペレーションは選べない）（出典: atwiki/page-390）", () => {
    const deck = [inst("RS-188", "meka_s"), inst("TST-UNIT-2", "m"), inst("TST-OP", "op"), inst("RS-196", "mob")];
    const s = playOp(base(deck), "player1", "RS-186:c").state;
    const valid = s.pendingEffectChoice?.validInstanceIds ?? [];
    expect(valid).toContain("RS-196:mob");
    expect(valid).not.toContain("RS-188:meka_s");
    expect(valid).not.toContain("TST-UNIT-2:m");
    expect(valid).not.toContain("TST-OP:op");
  });

  // 既知の不具合: CARD-RS-186 効果が未実装
  it.fails("RS-186: 「5枚まで」— 6枚あっても5枚までしか山札の上に置けない（出典: atwiki/page-390）", () => {
    const deck = ["a", "b", "c", "d", "e", "f"].map((x) => inst("RS-196", x));
    let s = playOp(base([inst("TST-OP", "z"), ...deck]), "player1", "RS-186:c").state;
    s = pickEffect(s, "player1", deck.map((c) => c.instanceId));
    const top5 = s.players.player1.deck.slice(0, 5).map((c) => c.cardId);
    expect(top5).toEqual(Array(5).fill("RS-196"));
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // grnrngr/faq-card-4 RS-186 Q1「戻す順番は相手に伝える必要はありません。」
  it.todo(
    "RS-186: 山札の上に戻す順番は相手に伝える必要はない（出典: grnrngr/faq-card-4 RS-186 Q1）— エンジンに公開情報／非公開情報の区別（相手への開示）がなく検証できない",
  );
});

// ===========================================================================
describe("RS-187 ゴーマ宮", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分も相手も次の制限を受ける⇒バトルフェイズ中、バトルエリアの1番目に並ぶSユニットは、可能ならアタックする。";

  it("RS-187: カタログ本文・スペックが出典と一致（出典: atwiki/page-387）", () => {
    expectCatalogText("RS-187", TEXT);
    expectOpStats("RS-187", { name: "ゴーマ宮", category: "DA", powerCost: 3 });
  });

  it("RS-187: ※常駐 — 使うと常駐置き場に配置される（出典: atwiki/page-387）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-187", "c")], command: releasedN(1, "TST-OP-DA"), power: powerCards(3) } });
    const r = playOp(s, "player1", "RS-187:c");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-187:c")).toBe("operation");
  });

  // 「バトルエリアの1番目に並ぶSユニットは、可能ならアタックする」
  it("RS-187: 1番目に並んだ S ユニットは、アタックできるならアタックしなければならない（ストライク・パス不可）（出典: atwiki/page-387）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "g")], rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "battle").map((a) => a.attackerInstanceId)).toContain("TST-UNIT-0:s");
    expect(legalOfType(s, "strike")).toHaveLength(0);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(0);
  });

  // 「自分も相手も次の制限を受ける」
  it("RS-187: 配置した側の相手（敵軍のゴーマ宮）にも制限がかかる（出典: atwiki/page-387「自分も相手も」）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { operation: [inst("RS-187", "g")], battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "strike")).toHaveLength(0);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(0);
  });

  it("RS-187: アタックできない（敵軍バトルエリアにユニットがいない）ならストライクしてよい（出典: atwiki/page-387「可能なら」）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "g")], rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "strike").map((a) => a.instanceId)).toContain("TST-UNIT-0:s");
  });

  it("RS-187: ゴーマ宮がなければ1番目の S ユニットもストライク・パスを選べる（制限は常駐の効果による）（出典: atwiki/page-387）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "strike")).toHaveLength(1);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
  });

  it("RS-187: 2番目以降に並ぶ S ユニットは制限を受けない（出典: atwiki/page-387「1番目に並ぶ」）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "g")], rush: [inst("RS-189", "a"), inst("TST-UNIT-0", "b")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "d2")], deck: deckCards(3, "e") },
    });
    // 1番目（キレンジャー BP3000）はアタックして勝ち、バトルエリアに残る
    s = settle(attack(enter(s, "RS-189:a"), "RS-189:a", "TST-UNIT-0:d"));
    expect(zoneOf(s, "player1", "RS-189:a")).toBe("battle");
    s = enter(s, "TST-UNIT-0:b");
    expect(legalOfType(s, "strike").map((a) => a.instanceId)).toContain("TST-UNIT-0:b");
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
  });

  // grnrngr/faq-card-4 RS-187 Q1「ライドオフして並び順が確定したとき２番目になっていれば、…効果を受けなくなります。」
  it("RS-187: ライドオフして2番目に並んだ S ユニットはアタックを強制されない（出典: grnrngr/faq-card-4 RS-187 Q1）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "goma")], rush: [inst("RK-031", "rider"), inst("RK-058", "zect")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "d")], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-031:rider", vehicleInstanceId: "RK-058:zect" });
    s = settle(s);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    s = settle(s);
    if (s.pendingEffectChoice) s = declineEffect(s, "player1");
    expect(s.players.player1.battle.map((c) => c.instanceId).indexOf("RK-031:rider")).toBe(1);
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
  });

  // grnrngr/faq-card-4 RS-187 Q2「はい、その通りです。」
  it("RS-187: 最初に出たのが M ユニットなら、その後に出る S ユニットは制限を受けない（出典: grnrngr/faq-card-4 RS-187 Q2）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "goma")], battle: [inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "TST-UNIT-0:s");
    expect(legalOfType(s, "pass_battle_entry")).toHaveLength(1);
    expect(legalOfType(s, "strike")).toHaveLength(1);
  });

  // grnrngr/faq-card-4 RS-187 Q3「いいえ、できません。アタックできる状態であれば、アタックしなければなりません。」
  it("RS-187: 1番目に並んだデカレッドは、アタックできるなら「アタックするかわりに」の効果を使えない（出典: grnrngr/faq-card-4 RS-187 Q3・R-ATK-05）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "goma")], rush: [inst("RS-106", "deka")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-106:deka");
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
    expect(legalOfType(s, "battle").map((a) => a.attackerInstanceId)).toContain("RS-106:deka");
  });

  it("RS-187: 1番目に並んだハリケンイエロー（CN1）も、アタックできるなら「アタックするかわりに」（舞獅子）を使えない（出典: grnrngr/faq-card-4 RS-187 Q3）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "goma")], rush: [inst("RS-100", "hy")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-100:hy");
    expect(legalOfType(s, "use_juu_kun_do")).toHaveLength(0);
    expect(legalOfType(s, "battle").map((a) => a.attackerInstanceId)).toContain("RS-100:hy");
  });

  // grnrngr/faq-rider-1「「音撃斬・雷電激震」を使ったことで、アタックすることができなくなった「RK-047 仮面ライダー轟鬼」は、「ゴーマ宮」の「可能ならアタックする」の制限を受けない」
  it("RS-187: 轟鬼（CN1）の NC 音撃斬・雷電激震は発動でき、アタックできなくなった轟鬼は強制アタックを受けない（出典: grnrngr/faq-rider-1 RS-187・RK-047 の Q）", () => {
    let s = st({
      turn: 3,
      player1: { operation: [inst("RS-187", "goma")], rush: [inst("RK-047", "todoroki")], command: releasedN(4, "TST-OP-MA"), deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "d")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RK-047:todoroki");
    s = pickEffect(s, "player1", ["TST-UNIT-0:d"]);
    // 必要パワー0 → コマンドを1つホールドして撃破
    for (let i = 0; i < 3 && s.pendingCommandPayment; i++) {
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: s.pendingCommandPayment.validInstanceIds.slice(0, s.pendingCommandPayment.totalNeeded) });
    }
    s = pickEffect(s, "player1", ["TST-OP-MA:rc0"]);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("discard");
    expect(legalOfType(s, "battle")).toHaveLength(0);
    expect(cardIn(s, "player1", "RK-047:todoroki")).toBeDefined();
  });
});

