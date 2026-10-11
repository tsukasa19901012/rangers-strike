/**
 * カード別スペック: RS-627〜RS-633（第9弾「蒼九の翼」メガシップ〜メガシルバー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS633 読み替え）、grnrngr/faq-card-9
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_9.html。
 *      カード別 Q&A は無く、キーワード「ウイング」「ブラスト」の公式 Q&A のみ）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写しは pages/1529.txt＝RS-633 のみ）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-KW-WING-*、R-KW-RESIST-* 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackUntilRegister,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enterBattleByEffect,
  enterSeq,
  enterKeep,
  expectCatalogText,
  expectStats,
  fill,
  heldN,
  inst,
  p1Battle,
  pick,
  powerCards,
  rarityOf,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  bpOf,
  st,
  sUnit,
  toPhase,
  wingTests,
  zoneOf,
  held,
} from "./RS9-627-647.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E1000 = sUnit("SPEC-E1000", { bp: 1000 });

// ===========================================================================
describe("RS-627 メガシップ", () => {
  const TEXT =
    "※このカードの追加条件は、自軍捨札にウイングを持つSユニットのカードが5枚以上あるとき、次のように変更される⇒追加で自軍コマンドを2つホールドする。 【シールドシステム】これが自軍エリアにある間、自軍ラッシュエリアにあるBP1000以下のユニットは相手に選ばれない。";
  const PAGE = "atwiki/page-1462";
  const WINGS = ["RS-628", "RS-629", "RS-630", "RS-631", "RS-632"];

  it("RS-627: カタログ本文・スペックが出典と一致（出典: atwiki/page-1462）", () => {
    expectCatalogText("RS-627", TEXT);
    expectStats("RS-627", {
      name: "メガシップ",
      category: "ET",
      size: "L",
      bp: 7000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "母艦"],
      rushCondition: "send_s_unit_to_discard",
    });
    expect(rarityOf("RS-627")).toBe("N");
  });

  it("RS-627: 追加条件 — 自軍Sユニットを5体捨札にすればラッシュできる（出典: atwiki/page-1462「追加条件：自軍Sユニットを5体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-627", "m")], rush: fill(5), command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-627:m");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-627:m")).toBe("rush");
    expect(t.players.player1.discard.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
  });

  it("RS-627: 追加条件 — 自軍Sユニットが4体ではラッシュできない（出典: atwiki/page-1462「5体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-627", "m")], rush: fill(4), command: releasedCat("ET", 3), power: powerCards(4), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-627:m")).toBe(false);
  });

  // 既知の不具合: CARD-RS-627 追加条件の変更（捨札にウイングSが5枚以上→コマンド2つホールド）が未実装
  it.fails("RS-627: ※ 自軍捨札にウイングを持つSユニットが5枚以上あれば、追加で自軍コマンドを2つホールドしてラッシュできる（Sユニットは捨札にしない）（出典: atwiki/page-1462 ※・コメント「コマンドを２枚ホールドすることでのみラッシュが可能」）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-627", "m")],
        rush: fill(5),
        discard: WINGS.map((w, i) => inst(w, `d${i}`)),
        command: releasedCat("ET", 3),
        power: powerCards(4),
        deck: deckCards(3),
      },
    });
    const r = rushFromHand(s, "player1", "RS-627:m");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-627:m")).toBe("rush");
    expect(t.players.player1.rush.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(5);
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  // 既知の不具合: CARD-RS-627 追加条件の変更が未実装
  it.fails("RS-627: ※ 変更後はSユニットがいなくても、リリース状態のコマンド3つ（カテゴリ1＋追加2）でラッシュできる（出典: atwiki/page-1462 ※「次のように変更される⇒追加で自軍コマンドを2つホールドする」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-627", "m")], discard: WINGS.map((w, i) => inst(w, `d${i}`)), command: releasedCat("ET", 3), power: powerCards(4), deck: deckCards(3) },
    });
    expect(canStartRush(s, "player1", "RS-627:m")).toBe(true);
  });

  it("RS-627: ※ 変更後はリリース状態のコマンドが2つ（追加分が1つ不足）ではラッシュできない（出典: atwiki/page-1462 ※「追加で自軍コマンドを2つホールドする」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-627", "m")], discard: WINGS.map((w, i) => inst(w, `d${i}`)), command: releasedCat("ET", 2), power: powerCards(4), deck: deckCards(3) },
    });
    expect(canStartRush(s, "player1", "RS-627:m")).toBe(false);
  });

  it("RS-627: ※ 捨札のウイング持ちSユニットが4枚なら追加条件は変更されない（コマンドだけではラッシュできない）（出典: atwiki/page-1462 ※「5枚以上あるとき」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-627", "m")], discard: WINGS.slice(0, 4).map((w, i) => inst(w, `d${i}`)), command: releasedCat("ET", 3), power: powerCards(4), deck: deckCards(3) },
    });
    expect(canStartRush(s, "player1", "RS-627:m")).toBe(false);
  });

  /**
   * 敵軍（player2）が自軍バトルフェイズに天空神（RS-481。【ホバリング】自軍ターン中、これがバトルエリアに出たとき、
   * 敵軍ラッシュエリアからSユニットを1体選び、持ち主の手札に戻してもよい）をバトルエリアに出し、player1 のラッシュエリアの S ユニットを選ぶ。
   */
  const hoveringAgainst = (p1: Partial<Parameters<typeof p1Battle>[0]>) =>
    act(
      st(
        {
          activePlayer: "player2",
          player1: { deck: deckCards(3), ...p1 },
          player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") },
        },
        [E2000, E1000],
      ),
      { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" },
    );

  it("RS-627: 【シールドシステム】メガシップがラッシュエリアにある間、自軍ラッシュエリアの BP1000 以下のユニットは相手の効果に選ばれない（出典: atwiki/page-1462）", () => {
    const s = hoveringAgainst({ rush: [inst("RS-627", "m"), inst("SPEC-E1000", "low"), inst("SPEC-E2000", "high")] });
    expect(choiceIds(s)).toEqual(["SPEC-E2000:high"]);
  });

  it("RS-627: 【シールドシステム】BP1000 ちょうどは守られ、BP2000 は守られない（出典: atwiki/page-1462「BP1000以下」）", () => {
    const s = hoveringAgainst({ rush: [inst("RS-627", "m"), inst("RS-628", "pink"), inst("SPEC-E2000", "high")] });
    expect(choiceIds(s)).not.toContain("RS-628:pink");
    expect(choiceIds(s)).toContain("SPEC-E2000:high");
  });

  // 既知の不具合: CARD-RS-627 【シールドシステム】がメガシップのラッシュエリア在籍時しか働かない（バトルエリアにいると無効）
  it.fails("RS-627: 【シールドシステム】メガシップがバトルエリアにあっても働く（出典: atwiki/page-1462「これが自軍エリアにある間」）", () => {
    const s = hoveringAgainst({ battle: [inst("RS-627", "m")], rush: [inst("SPEC-E1000", "low"), inst("SPEC-E2000", "high")] });
    expect(choiceIds(s)).toEqual(["SPEC-E2000:high"]);
  });

  it("RS-627: 【シールドシステム】メガシップが自軍エリアになければ BP1000 以下のユニットも選ばれる（出典: atwiki/page-1462「これが自軍エリアにある間」）", () => {
    const s = hoveringAgainst({ rush: [inst("SPEC-E1000", "low")], discard: [inst("RS-627", "m")] });
    expect(choiceIds(s)).toEqual(["SPEC-E1000:low"]);
  });

  it("RS-627: 【シールドシステム】守るのは自軍（メガシップの持ち主）のユニットだけ（出典: atwiki/page-1462「自軍ラッシュエリアにある」）", () => {
    // player2 の場にあるメガシップは、player1 のラッシュエリアのユニットを守らない。
    const s = act(
      st(
        { activePlayer: "player2", player1: { rush: [inst("SPEC-E1000", "low")], deck: deckCards(3) }, player2: { rush: [inst("RS-481", "tk"), inst("RS-627", "m")], deck: deckCards(3, "e") } },
        [E1000],
      ),
      { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" },
    );
    expect(choiceIds(s)).toEqual(["SPEC-E1000:low"]);
  });

  it.todo(
    "RS-627: 【シールドシステム】自分の効果では選べる（「相手に選ばれない」）— 自軍ラッシュエリアの BP1000 以下のユニットを任意に選ぶ自軍の効果を本範囲のカードで組めず、汎用のテスト用カードもないため保留",
  );
});

// ===========================================================================
describe("RS-628 メガピンク", () => {
  const TEXT =
    "※ウイング 【メガキャプチャー】このターン、次に自軍コマンドゾーンにカードが置かれたとき、相手は自分自身のコマンドを1つ選び手札に戻す。";
  const PAGE = "atwiki/page-1432";

  it("RS-628: カタログ本文・スペックが出典と一致（出典: atwiki/page-1432）", () => {
    expectCatalogText("RS-628", TEXT);
    expectStats("RS-628", { name: "メガピンク", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["ピンク", "女"] });
    expect(rarityOf("RS-628")).toBe("N");
  });

  wingTests("RS-628", PAGE);

  /** メガピンク（NC は1番目）→ フィラー → メガブルー 3番目（NC【メガトマホーク】で手札のカードを自軍コマンドゾーンに置く）。 */
  const capture = (pinkPos: 1 | 2) => {
    const order = pinkPos === 1 ? ["RS-628:p", "TST-UNIT-0:f0", "RS-630:b"] : ["TST-UNIT-0:f0", "RS-628:p", "RS-630:b"];
    const s = p1Battle(
      { rush: [inst("RS-628", "p"), inst("RS-630", "b"), ...fill(1, "f")], command: releasedCat("ET", 1), hand: [inst("TST-OP", "h0")] },
      { command: [released("TST-OP", "e1"), held("TST-OP", "e2")] },
    );
    let t = enterSeq(s, order.slice(0, 2));
    t = act(t, { type: "move_to_battle", playerId: "player1", instanceId: "RS-630:b" });
    // メガブルーの NC（任意）で手札のカードを自軍コマンドゾーンに置く。
    expect(t.pendingEffectChoice?.sourceCardId).toBe("RS-630");
    return pick(t, "TST-OP:h0");
  };

  // 既知の不具合: CARD-RS-628 【メガキャプチャー】が未実装（opponent_must パターンの本文に一致する処理がなく何もしない）
  it.fails("RS-628: 【メガキャプチャー】NC（1番目）— このターン次に自軍コマンドゾーンにカードが置かれたとき、相手が自分のコマンドを1つ選び手札に戻す（出典: atwiki/page-1432）", () => {
    const s = capture(1);
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("command");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP:e1", "TST-OP:e2"]);
  });

  // 既知の不具合: CARD-RS-628 【メガキャプチャー】が未実装（opponent_must パターンの本文に一致する処理がなく何もしない）
  it.fails("RS-628: 【メガキャプチャー】強制 — 相手は戻さないことを選べず、選んだコマンドが相手の手札に戻る（出典: atwiki/page-1432「相手は自分自身のコマンドを1つ選び手札に戻す」）", () => {
    let s = capture(1);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-OP:e2"));
    expect(zoneOf(s, "player2", "TST-OP:e2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:e1")).toBe("command");
  });

  it("RS-628: 【メガキャプチャー】NC が成立しない（2番目）と、自軍コマンドゾーンにカードが置かれても相手のコマンドは戻らない（出典: R-CN-02）", () => {
    const s = resolveAll(capture(2));
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("command");
    expect(s.players.player2.command).toHaveLength(2);
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-629 メガイエロー", () => {
  const TEXT =
    "※ウイング 【メガスリング】リリース状態の自軍コマンドを1つ選び、山札の上に戻してもよい。そうしたとき、このターン、敵軍ラッシュエリアのSユニットはBP-1500される。（BP0以下になったユニットは撃破される）";
  const PAGE = "atwiki/page-1430";
  const E_M = sUnit("SPEC-EM", { bp: 1000, size: "M" });

  it("RS-629: カタログ本文・スペックが出典と一致（出典: atwiki/page-1430）", () => {
    expectCatalogText("RS-629", TEXT);
    expectStats("RS-629", { name: "メガイエロー", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: 2, features: ["イエロー", "女"] });
    expect(rarityOf("RS-629")).toBe("N");
  });

  wingTests("RS-629", PAGE);

  const board = (cmd = [released("TST-OP-ET", "r1"), held("TST-OP-ET", "h1")], filler = 1) =>
    enterSeq(
      p1Battle(
        { rush: [inst("RS-629", "y")], battle: fill(filler), command: cmd, deck: [inst("TST-OP", "top0"), ...deckCards(3)] },
        { rush: [inst("TST-UNIT-0", "s1000"), inst("SPEC-E2000", "s2000"), inst("SPEC-EM", "m")], battle: [inst("SPEC-E2000", "b")] },
        [E2000, E_M],
      ),
      ["RS-629:y"],
    );

  it("RS-629: 【メガスリング】NC（2番目）— 選べるのはリリース状態の自軍コマンドだけで、選ばないこともできる（出典: atwiki/page-1430「リリース状態の自軍コマンドを1つ選び、山札の上に戻してもよい」）", () => {
    const s = board();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-629");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:r1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-629: 【メガスリング】戻したコマンドは山札の上に置かれ、このターン敵軍ラッシュエリアのSユニットは BP-1500、BP0 以下は撃破（出典: atwiki/page-1430）", () => {
    const s = resolveAll(pick(board(), "TST-OP-ET:r1"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP-ET:r1");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1000")).toBe("discard");
    expect(bpOf(s, "player2", "SPEC-E2000:s2000")).toBe(500);
    // M ユニット・敵軍バトルエリアのユニットは対象外
    expect(bpOf(s, "player2", "SPEC-EM:m")).toBe(1000);
    expect(bpOf(s, "player2", "SPEC-E2000:b")).toBe(2000);
  });

  it("RS-629: 【メガスリング】戻さなければ敵軍の BP は変わらない（出典: atwiki/page-1430「そうしたとき」）", () => {
    const s = resolveAll(skip(board()));
    expect(zoneOf(s, "player1", "TST-OP-ET:r1")).toBe("command");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1000")).toBe("rush");
    expect(bpOf(s, "player2", "SPEC-E2000:s2000")).toBe(2000);
  });

  it("RS-629: 【メガスリング】リリース状態の自軍コマンドがなければ何も起きない（出典: atwiki/page-1430「リリース状態の自軍コマンドを1つ選び」）", () => {
    const s = resolveAll(board([held("TST-OP-ET", "h1")]));
    expect(zoneOf(s, "player1", "TST-OP-ET:h1")).toBe("command");
    expect(bpOf(s, "player2", "SPEC-E2000:s2000")).toBe(2000);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1000")).toBe("rush");
  });

  it("RS-629: 【メガスリング】NC が成立しない（3番目）と選択も BP 修正もない（出典: R-CN-02）", () => {
    const s = board(undefined, 2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-629");
    const t = resolveAll(s);
    expect(bpOf(t, "player2", "SPEC-E2000:s2000")).toBe(2000);
  });
});

// ===========================================================================
describe("RS-630 メガブルー", () => {
  const TEXT =
    "※ウイング 【メガトマホーク】自軍コマンドが3つ以下なら、自分の手札からカードを1枚選び、自軍コマンドゾーンにホールド状態で置いてもよい。そうしたとき、このターン、これは次の能力を得る⇒SP1";
  const PAGE = "atwiki/page-1429";

  it("RS-630: カタログ本文・スペックが出典と一致（出典: atwiki/page-1429）", () => {
    expectCatalogText("RS-630", TEXT);
    expectStats("RS-630", { name: "メガブルー", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 3, features: ["ブルー", "男"] });
    expect(rarityOf("RS-630")).toBe("N");
  });

  wingTests("RS-630", PAGE);

  const board = (cmdCount: number, filler = 2, hand = [inst("TST-OP", "h0"), inst("TST-UNIT-0", "h1")]) =>
    enterSeq(
      p1Battle({ rush: [inst("RS-630", "b")], battle: fill(filler), command: releasedCat("ET", cmdCount), hand }),
      ["RS-630:b"],
    );

  it("RS-630: 【メガトマホーク】NC（3番目）・コマンド3つ — 手札のカードを1枚選んでもよく（任意）、候補は手札のカード（出典: atwiki/page-1429）", () => {
    const s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-630");
    expect(choiceIds(s)).toEqual(["TST-OP:h0", "TST-UNIT-0:h1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-630: 【メガトマホーク】選んだカードは自軍コマンドゾーンにホールド状態で置かれ、このターン SP1 になりストライクできる（出典: atwiki/page-1429「そうしたとき、このターン、これは次の能力を得る⇒SP1」）", () => {
    const s = resolveAll(pick(board(3), "TST-UNIT-0:h1"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h1")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-0:h1")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "RS-630:b")).toBe(1);
    expect(canStrike(s, "RS-630:b")).toBe(true);
  });

  it("RS-630: 【メガトマホーク】置かなければ SP1 を得ない（SP！のまま）（出典: atwiki/page-1429「そうしたとき」）", () => {
    const s = resolveAll(skip(board(3)));
    expect(s.players.player1.hand).toHaveLength(2);
    expect(spOf(s, "player1", "RS-630:b")).toBe(0);
    expect(canStrike(s, "RS-630:b")).toBe(false);
  });

  it("RS-630: 【メガトマホーク】自軍コマンドが4つなら発動しない（出典: atwiki/page-1429「自軍コマンドが3つ以下なら」）", () => {
    const s = board(4);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-630");
    const t = resolveAll(s);
    expect(t.players.player1.hand).toHaveLength(2);
    expect(t.players.player1.command).toHaveLength(4);
    expect(spOf(t, "player1", "RS-630:b")).toBe(0);
  });

  it("RS-630: 【メガトマホーク】ホールド状態のコマンドも数に含む（リリース2・ホールド2＝4つなら発動しない）（出典: atwiki/page-1429「自軍コマンドが3つ以下なら」）", () => {
    const s = resolveAll(
      enterSeq(p1Battle({ rush: [inst("RS-630", "b")], battle: fill(2), command: [...releasedCat("ET", 2), ...heldN(2, "TST-OP-ET")], hand: [inst("TST-OP", "h0")] }), ["RS-630:b"]),
    );
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("hand");
  });

  it("RS-630: 【メガトマホーク】NC が成立しない（4番目）と発動せず SP！のまま（出典: R-CN-02）", () => {
    const s = board(3, 3);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-630");
    const t = resolveAll(s);
    expect(t.players.player1.hand).toHaveLength(2);
    expect(spOf(t, "player1", "RS-630:b")).toBe(0);
  });
});

// ===========================================================================
describe("RS-631 メガブラック", () => {
  const TEXT = "※ウイング 【サテライトサーチ】自軍コマンドが3つ以下なら、自軍山札の上から1枚ひいて自軍コマンドゾーンにホールド状態で置いてもよい。";
  const PAGE = "atwiki/page-1431";

  it("RS-631: カタログ本文・スペックが出典と一致（出典: atwiki/page-1431）", () => {
    expectCatalogText("RS-631", TEXT);
    expectStats("RS-631", { name: "メガブラック", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["ブラック", "男"] });
  });

  it("RS-631: レアリティはノーマルレア（出典: atwiki/page-1431「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-631")).toBe("NR");
  });

  wingTests("RS-631", PAGE);

  const board = (cmdCount: number, filler = 3) =>
    enterSeq(
      p1Battle({ rush: [inst("RS-631", "k")], battle: fill(filler), command: releasedCat("ET", cmdCount), deck: [inst("TST-UNIT-0", "top"), ...deckCards(3)] }),
      ["RS-631:k"],
    );

  // 既知の不具合: CARD-RS-631 【サテライトサーチ】で山札の上のカードを選んでも山札に残り、コマンドゾーンに置かれない（scry_self_deck_top の「見て残す」処理になっている）
  it.fails("RS-631: 【サテライトサーチ】NC（4番目）・コマンド3つ — 山札の上の1枚を自軍コマンドゾーンにホールド状態で置ける（出典: atwiki/page-1431）", () => {
    let s = board(3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-631");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s, ["TST-UNIT-0:top"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-0:top")?.commandHeld).toBe(true);
    expect(s.players.player1.command).toHaveLength(4);
  });

  it("RS-631: 【サテライトサーチ】任意 — 置かないこともでき、山札は変わらない（出典: atwiki/page-1431「置いてもよい」）", () => {
    const s = resolveAll(skip(board(3)));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-UNIT-0:top");
    expect(s.players.player1.command).toHaveLength(3);
  });

  it("RS-631: 【サテライトサーチ】自軍コマンドが4つなら発動しない（出典: atwiki/page-1431「自軍コマンドが3つ以下なら」）", () => {
    const s = resolveAll(board(4), ["TST-UNIT-0:top"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("deck");
    expect(s.players.player1.command).toHaveLength(4);
  });

  it("RS-631: 【サテライトサーチ】NC が成立しない（5番目）と発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(board(3, 4), ["TST-UNIT-0:top"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:top")).toBe("deck");
  });
});

// ===========================================================================
describe("RS-632 メガレッド", () => {
  const TEXT = "※レジスト ※ウイング 【ドリルセイバー】「SP1」";
  const PAGE = "atwiki/page-1418";

  it("RS-632: カタログ本文・スペックが出典と一致（出典: atwiki/page-1418）", () => {
    expectCatalogText("RS-632", TEXT);
    expectStats("RS-632", { name: "メガレッド", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: 5, features: ["レッド", "男"] });
  });

  it("RS-632: レアリティはレア（出典: atwiki/page-1418「レアリティ：レア」）", () => {
    expect(rarityOf("RS-632")).toBe("R");
  });

  wingTests("RS-632", PAGE);

  it("RS-632: 【ドリルセイバー】NC（5番目）で SP1 になりストライクできる（出典: atwiki/page-1418「【ドリルセイバー】「SP1」」）", () => {
    const s = enterKeep(p1Battle({ rush: [inst("RS-632", "r")], battle: fill(4) }), ["RS-632:r"]);
    expect(spOf(s, "player1", "RS-632:r")).toBe(1);
    expect(canStrike(s, "RS-632:r")).toBe(true);
  });

  it("RS-632: 【ドリルセイバー】NC が成立しない（4番目）と SP！のままストライクできない（出典: R-CN-02）", () => {
    const s = enterKeep(p1Battle({ rush: [inst("RS-632", "r")], battle: fill(3) }), ["RS-632:r"]);
    expect(spOf(s, "player1", "RS-632:r")).toBe(0);
    expect(canStrike(s, "RS-632:r")).toBe(false);
  });

  it("RS-632: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストできる（出典: atwiki/page-1418「※レジスト」・R-KW-RESIST-01）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-632", "r")] }, "RS-632:r");
    expect(registerOffered(s)).toBe(true);
  });

  it("RS-632: ※レジスト — ウイングでホールドしている（ホールド状態の）ときはレジストできない（出典: R-KW-RESIST-04「リリース状態でなければ使えない」）", () => {
    const s = attackUntilRegister({ battle: [held("RS-632", "r")] }, "RS-632:r");
    expect(registerOffered(s)).toBe(false);
  });
});

// ===========================================================================
describe("RS-633 メガシルバー", () => {
  // R-ERR-RS633（公式 Q&A A1 の読み替え）後の本文。
  const TEXT =
    "※自軍スタートフェイズを終えるとき、このユニットがリリース状態ならホールドし、ホールド状態なら捨札にする。 【シルバーブレイザー】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+2000 され、これがホールド状態なら「SP1」 になる。";

  it("RS-633: カタログ本文（読み替え後）・スペックが出典と一致（出典: docs/rules/08-errata.md R-ERR-RS633、atwiki/page-1529 Q1/A1）", () => {
    expectCatalogText("RS-633", TEXT);
    expectStats("RS-633", { name: "メガシルバー", category: "ET", size: "S", bp: 5000, sp: "special", powerCost: 5, comboNumber: undefined, features: ["シルバー", "男"] });
  });

  it("RS-633: レアリティはスーパーレア（出典: atwiki/page-1529「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-633")).toBe("SR");
  });

  /** player2 のターン中から player1 のスタートフェイズを終えてラッシュフェイズへ進める。 */
  const throughStart = (silver: ReturnType<typeof inst>, zone: "rush" | "battle" | "hand" = "rush") => {
    const s = st({
      activePlayer: "player2",
      phase: "end",
      player1: { [zone]: [silver], deck: deckCards(8), command: releasedCat("ET", 2) },
      player2: { deck: deckCards(8, "e") },
    } as Parameters<typeof st>[0]);
    return toPhase(s, "player1", "charge");
  };

  it("RS-633: ※ 自軍スタートフェイズを終えるとき、リリース状態ならホールドする（出典: R-ERR-RS633）", () => {
    const s = throughStart(inst("RS-633", "sv"));
    expect(zoneOf(s, "player1", "RS-633:sv")).toBe("rush");
    expect(cardIn(s, "player1", "RS-633:sv")?.commandHeld).toBe(true);
  });

  it("RS-633: Q&A — リリース状態からホールドされた直後に改めて状態を確認して捨札になることはない（出典: atwiki/page-1529 Q1/A1「いいえ、なりません」「自軍ターン中に一度だけ状態を確認する」）", () => {
    const s = throughStart(inst("RS-633", "sv"));
    expect(zoneOf(s, "player1", "RS-633:sv")).not.toBe("discard");
  });

  it("RS-633: ※ 自軍スタートフェイズを終えるとき、ホールド状態なら捨札にする（出典: R-ERR-RS633）", () => {
    const s = throughStart(held("RS-633", "sv"));
    expect(zoneOf(s, "player1", "RS-633:sv")).toBe("discard");
  });

  it("RS-633: ※ ユニットでない（手札にある）ときは適用されない（出典: atwiki/page-1529 A1「このテキストは…ユニットであるときに適用されるもの」）", () => {
    const s = throughStart(inst("RS-633", "sv"), "hand");
    expect(zoneOf(s, "player1", "RS-633:sv")).toBe("hand");
  });

  it("RS-633: ※ 敵軍スタートフェイズでは何もしない（出典: R-ERR-RS633「自軍スタートフェイズを終えるとき」）", () => {
    // player1 のメガシルバー（リリース・ホールド両方）を置いたまま、player2（敵軍）のスタートフェイズを終える。
    const s = st({
      activePlayer: "player1",
      phase: "end",
      player1: { rush: [inst("RS-633", "sv"), held("RS-633", "sh")], deck: deckCards(8) },
      player2: { deck: deckCards(8, "e") },
    });
    const t = toPhase(s, "player2", "charge");
    expect(zoneOf(t, "player1", "RS-633:sv")).toBe("rush");
    expect(cardIn(t, "player1", "RS-633:sv")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(t, "player1", "RS-633:sh")).toBe("rush");
  });

  const blazer = (silverHeld: boolean) =>
    act(
      p1Battle({ rush: [silverHeld ? held("RS-633", "sv") : inst("RS-633", "sv")], command: [released("TST-OP-ET", "c1"), held("TST-OP-ET", "c2")] }),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-633:sv" },
    );

  it("RS-633: 【シルバーブレイザー】自軍ターンにバトルエリアに出たとき、自軍コマンド（リリース・ホールドを問わない）を1つ選んで手札に戻してもよい（出典: R-ERR-RS633・atwiki/page-1529 カード評価「手札に戻すコマンドカードの状態は指定されていない」）", () => {
    const s = blazer(false);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-633");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:c1", "TST-OP-ET:c2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-633: 【シルバーブレイザー】戻すとこのターン BP+2000。リリース状態なら SP1 にならない（出典: R-ERR-RS633「これがホールド状態なら「SP1」になる」）", () => {
    const s = resolveAll(pick(blazer(false), "TST-OP-ET:c2"));
    expect(zoneOf(s, "player1", "TST-OP-ET:c2")).toBe("hand");
    expect(bpOf(s, "player1", "RS-633:sv")).toBe(7000);
    expect(spOf(s, "player1", "RS-633:sv")).toBe(0);
  });

  it("RS-633: 【シルバーブレイザー】ホールド状態で出て戻すと BP+2000 され SP1 になる（出典: R-ERR-RS633）", () => {
    const s = resolveAll(pick(blazer(true), "TST-OP-ET:c1"));
    expect(bpOf(s, "player1", "RS-633:sv")).toBe(7000);
    expect(spOf(s, "player1", "RS-633:sv")).toBe(1);
  });

  it.todo(
    "RS-633: 【シルバーブレイザー】ホールド状態で SP1 になったメガシルバーがストライクできるか — R-HOLD-03 が [未確定]（ホールド中のユニットのアタック・ストライクの明文なし）のため検証しない",
  );

  it("RS-633: 【シルバーブレイザー】戻さなければ BP・SP は変わらない（出典: R-ERR-RS633「そうしたとき」）", () => {
    const s = resolveAll(skip(blazer(true)));
    expect(s.players.player1.command).toHaveLength(2);
    expect(bpOf(s, "player1", "RS-633:sv")).toBe(5000);
    expect(spOf(s, "player1", "RS-633:sv")).toBe(0);
  });

  it("RS-633: 【シルバーブレイザー】BP+2000 は「このターン」だけ（次のターンには 5000 に戻る）（出典: R-ERR-RS633「このターン」・R-TURN-04）", () => {
    let s = resolveAll(pick(blazer(false), "TST-OP-ET:c1"));
    s = toPhase(s, "player2", "charge");
    const sv = cardIn(s, "player1", "RS-633:sv");
    expect(sv).toBeDefined();
    expect(bpOf(s, "player1", "RS-633:sv")).toBe(5000);
  });

  it("RS-633: 【シルバーブレイザー】敵軍ターン中にバトルエリアに出たときは発動しない（出典: R-ERR-RS633「自軍ターン中」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-633", "sv")], command: [released("TST-OP-ET", "c1")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-633:sv"));
    expect(zoneOf(s, "player1", "TST-OP-ET:c1")).toBe("command");
    expect(bpOf(s, "player1", "RS-633:sv")).toBe(5000);
  });
});
