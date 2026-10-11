/**
 * カード別スペック: RS-670〜RS-676（第9弾「蒼九の翼」ティライン〜シンケンピンク）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-card-9
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_9.html。
 *      カード別 Q&A は無く、キーワード「ウイング」「ブラスト」の公式 Q&A のみ）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-TGT-01、R-KW-RESIST-* 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  enter,
  enterKeep,
  expectCatalogText,
  expectStats,
  inst,
  releasedCat,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  rarityOf,
  registerOffered,
  resolveAll,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPowerOnDestroyTests,
  zoneOf,
} from "./RS9-670-690.helpers";

// ===========================================================================
describe("RS-670 ティライン", () => {
  const TEXT = "※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。";
  const PAGE = "atwiki/page-1444";

  it("RS-670: カタログ本文・スペックが出典と一致（出典: atwiki/page-1444）", () => {
    expectCatalogText("RS-670", TEXT);
    expectStats("RS-670", { name: "ティライン", category: "OT", size: "M", bp: 3000, sp: undefined, powerCost: 2, features: ["車両", "恐竜", "炎神"] });
    // 「レアリティ：ノーマル」
    expect(rarityOf("RS-670")).toBe("N");
  });

  toPowerOnDestroyTests("RS-670", PAGE);
});

// ===========================================================================
describe("RS-671 ケライン", () => {
  const TEXT = "※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンに置いてもよい。";
  const PAGE = "atwiki/page-1445";

  it("RS-671: カタログ本文・スペックが出典と一致（出典: atwiki/page-1445）", () => {
    expectCatalogText("RS-671", TEXT);
    expectStats("RS-671", { name: "ケライン", category: "OT", size: "M", bp: 2000, sp: undefined, powerCost: 1, features: ["車両", "恐竜", "炎神"] });
    expect(rarityOf("RS-671")).toBe("N");
  });

  toPowerOnDestroyTests("RS-671", PAGE);
});

// ===========================================================================
describe("RS-672 ゴローダーGT", () => {
  const TEXT =
    "※自分か相手のLユニットがあれば、これはLユニットになり、BP+2000される。 【ゴローダーアタック！】これがカード名に「ゴーオン」または「エンジンオー」を含むユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたユニットのBP以下のBPを持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに置く。";
  const PAGE = "atwiki/page-1521";
  const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
  const E4500 = sUnit("SPEC-E4500", { bp: 4500 });
  const E3000M = sUnit("SPEC-E3000M", { bp: 3000, size: "M" });

  it("RS-672: カタログ本文・スペックが出典と一致（出典: atwiki/page-1521「CN：R」）", () => {
    expectCatalogText("RS-672", TEXT);
    expectStats("RS-672", { name: "ゴローダーGT", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: "R", features: ["メカ"] });
  });

  it("RS-672: レアリティはレア（出典: atwiki/page-1521「レアリティ：レア」）", () => {
    expect(rarityOf("RS-672")).toBe("R");
  });

  it("RS-672: ※ 敵軍に L ユニットがあれば BP+2000（4000）される（出典: atwiki/page-1521「自分か相手のLユニットがあれば…BP+2000される」）", () => {
    const s = p1Battle({ rush: [inst("RS-672", "g")] }, { rush: [inst("TST-UNIT-7", "L")] });
    expect(bpOf(s, "player1", "RS-672:g")).toBe(4000);
  });

  it("RS-672: ※ 自軍に L ユニットがあっても BP+2000 される（出典: atwiki/page-1521「自分か相手の」）", () => {
    const s = p1Battle({ rush: [inst("RS-672", "g"), inst("TST-UNIT-7", "L")] });
    expect(bpOf(s, "player1", "RS-672:g")).toBe(4000);
  });

  it("RS-672: ※ どちらにも L ユニットがなければ BP2000 のまま（出典: atwiki/page-1521「Lユニットがあれば」）", () => {
    const s = p1Battle({ rush: [inst("RS-672", "g"), inst("TST-UNIT-2", "M")] }, { rush: [inst("TST-UNIT-2", "eM")] });
    expect(bpOf(s, "player1", "RS-672:g")).toBe(2000);
  });

  it("RS-672: ※ L ユニットがあれば L ユニットになる — 「Sユニット」を選ぶ敵軍の効果に選ばれない（出典: atwiki/page-1521「これはLユニットになり」）", () => {
    // 敵軍（player2）のシンケンレッド（RS-674）NC【烈火大斬刀】は「DAを持つ敵軍Sユニット」を選ぶ。ゴローダーGT はカテゴリ OT なので
    // 代わりに天空神（RS-481【ホバリング】敵軍ラッシュエリアからSユニットを1体選び、持ち主の手札に戻してもよい）を使う。
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-672", "g"), inst("TST-UNIT-7", "L"), inst("TST-UNIT-0", "s")], deck: deckCards(3) },
      player2: { rush: [inst("RS-481", "tk")], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-481:tk" });
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
  });

  /** ゴーオンレッド（RS-508、BP4000）→ ゴローダーGT の順に出す。 */
  const fromGoOn = (p2: Parameters<typeof p1Battle>[1], left = "RS-508:red") => {
    const [lid, lsuf] = left.split(":") as [string, string];
    const s = p1Battle({ rush: [inst(lid, lsuf), inst("RS-672", "g")], command: releasedCat("OT", 3) }, p2, [E4000, E4500, E3000M]);
    // 左隣のユニット自身の「バトルエリアに出たとき」の効果（エンジンオー【ゴーオンソード】等）は先に解決しておく。
    const t = passEntry(resolveAll(enter(s, left)));
    return act(t, { type: "move_to_battle", playerId: "player1", instanceId: "RS-672:g" });
  };

  it("RS-672: 【ゴローダーアタック！】「ゴーオン」を含むユニット（ゴーオンレッド BP4000）からコンビネーションすると、BP4000 以下の敵軍ユニットを選べる（ラッシュエリアも含む）（出典: atwiki/page-1521・R-TGT-01）", () => {
    const s = fromGoOn({ battle: [inst("SPEC-E4000", "b4000"), inst("SPEC-E4500", "b4500")], rush: [inst("SPEC-E3000M", "r3000")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-672");
    expect(choiceIds(s)).toEqual(["SPEC-E3000M:r3000", "SPEC-E4000:b4000"]);
  });

  it("RS-672: 【ゴローダーアタック！】選んだ敵軍ユニットは持ち主のパワーゾーンに置かれる（出典: atwiki/page-1521「持ち主のパワーゾーンに置く」）", () => {
    const s = resolveAll(pick(fromGoOn({ battle: [inst("SPEC-E4000", "b4000")] }), "SPEC-E4000:b4000"));
    expect(zoneOf(s, "player2", "SPEC-E4000:b4000")).toBe("power");
  });

  it("RS-672: 【ゴローダーアタック！】「発動できる」— 発動しないこともできる（出典: atwiki/page-1521「次の効果を発動できる」）", () => {
    let s = fromGoOn({ battle: [inst("SPEC-E4000", "b4000")] });
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-E4000:b4000")).toBe("battle");
  });

  it("RS-672: 【ゴローダーアタック！】「エンジンオー」を含むユニット（エンジンオー BP13000）からでも発動し、BP13000 以下を選べる（出典: atwiki/page-1521）", () => {
    const s = fromGoOn({ battle: [inst("SPEC-E4500", "b4500"), inst("TST-UNIT-7", "big")] }, "RS-515:eo");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-672");
    expect(choiceIds(s)).toEqual(["SPEC-E4500:b4500", "TST-UNIT-7:big"]);
  });

  it("RS-672: 【ゴローダーアタック！】名前に「ゴーオン」「エンジンオー」を含まないユニットからでは発動しない（出典: atwiki/page-1521「カード名に「ゴーオン」または「エンジンオー」を含むユニットから」）", () => {
    const s = fromGoOn({ battle: [inst("SPEC-E4000", "b4000")] }, "TST-UNIT-0:x");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-672");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E4000:b4000")).toBe("battle");
  });

  it("RS-672: 【ゴローダーアタック！】1番目に出た（左隣がない）ときは発動しない（出典: atwiki/page-1521・atwiki ジョイントコンビネーション「R」は右に並べる）", () => {
    const s = enterKeep(p1Battle({ rush: [inst("RS-672", "g")] }, { battle: [inst("SPEC-E4000", "b4000")] }, [E4000]), ["RS-672:g"]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-672");
  });
});

// ===========================================================================
describe("RS-673 ボンパー", () => {
  const TEXT =
    "※これはバトルエリアに出られない。 【炎神キャスト転送】これが自軍エリアにある間、自軍チャージフェイズ中、自軍パワーゾーンにカードを置いたとき、置いたカード以外のオモテ向きの自軍パワーから、特徴「炎神」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。";
  const PAGE = "atwiki/page-1443";
  const ENGINE_S = sUnit("SPEC-ENGINE-S", { bp: 1000, features: ["炎神"] });

  it("RS-673: カタログ本文・スペックが出典と一致（出典: atwiki/page-1443）", () => {
    expectCatalogText("RS-673", TEXT);
    expectStats("RS-673", { name: "ボンパー", category: "OT", size: "S", bp: 500, sp: undefined, powerCost: 4, features: ["メカ"] });
    expect(rarityOf("RS-673")).toBe("N");
  });

  it("RS-673: ※ バトルエリアに出られない（出典: atwiki/page-1443「※これはバトルエリアに出られない」）", () => {
    const s = p1Battle({ rush: [inst("RS-673", "b"), inst("TST-UNIT-0", "x")] });
    expect(canEnter(s, "RS-673:b")).toBe(false);
    expect(canEnter(s, "TST-UNIT-0:x")).toBe(true);
  });

  /** 自軍チャージフェイズ。パワーゾーンにオモテ向きの炎神 M（ティライン RS-670）等を置いておき、手札のカードをパワーにチャージする。 */
  const charge = (
    p1: Partial<Parameters<typeof p1Battle>[0]>,
    handCard = inst("TST-OP", "h"),
  ) => {
    const s = st({ phase: "charge", player1: { deck: deckCards(3), ...p1, hand: [handCard] }, player2: { deck: deckCards(3, "e") } }, [ENGINE_S]);
    return act(s, { type: "charge_power", playerId: "player1", instanceId: handCard.instanceId });
  };

  it("RS-673: 【炎神キャスト転送】チャージフェイズにパワーゾーンへ置いたとき、オモテ向きの自軍パワーの炎神 M ユニットを選んでよい（任意・候補は炎神 M だけ）（出典: atwiki/page-1443）", () => {
    const s = charge({
      rush: [inst("RS-673", "b")],
      power: [inst("RS-670", "ty"), inst("SPEC-ENGINE-S", "es"), inst("TST-UNIT-2", "m"), { ...inst("RS-671", "fd"), faceDown: true }],
    });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-673");
    expect(choiceIds(s)).toEqual(["RS-670:ty"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-673: 【炎神キャスト転送】選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-1443「自軍ラッシュエリアに出してもよい」）", () => {
    let s = charge({ rush: [inst("RS-673", "b")], power: [inst("RS-670", "ty")] });
    s = resolveAll(pick(s, "RS-670:ty"));
    expect(zoneOf(s, "player1", "RS-670:ty")).toBe("rush");
  });

  it("RS-673: 【炎神キャスト転送】出さないことも選べる（出典: atwiki/page-1443「出してもよい」）", () => {
    let s = charge({ rush: [inst("RS-673", "b")], power: [inst("RS-670", "ty")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-673");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-670:ty")).toBe("power");
  });

  it("RS-673: 【炎神キャスト転送】置いたカード自身は選べない（出典: atwiki/page-1443「置いたカード以外の」）", () => {
    const s = charge({ rush: [inst("RS-673", "b")], power: [] }, inst("RS-671", "h"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-673");
    expect(zoneOf(resolveAll(s), "player1", "RS-671:h")).toBe("power");
  });

  it("RS-673: 【炎神キャスト転送】ボンパーが自軍エリアになければ発動しない（出典: atwiki/page-1443「これが自軍エリアにある間」）", () => {
    const s = charge({ discard: [inst("RS-673", "b")], power: [inst("RS-670", "ty")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-673");
    expect(zoneOf(resolveAll(s), "player1", "RS-670:ty")).toBe("power");
  });

  it("RS-673: 【炎神キャスト転送】チャージフェイズ以外にパワーゾーンへカードが置かれても発動しない（出典: atwiki/page-1443「自軍チャージフェイズ中」）", () => {
    // 敵軍ターン中にケライン（RS-671）が撃破され、その ※ で自軍パワーゾーンに置かれる（チャージフェイズ以外の「パワーゾーンに置く」）。
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-671", "k")], rush: [inst("RS-673", "b")], power: [inst("RS-670", "ty")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    s = settle(act(s, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "RS-671:k" }));
    s = settle(pick(s, "place_in_power"));
    expect(zoneOf(s, "player1", "RS-671:k")).toBe("power");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-673");
    expect(zoneOf(s, "player1", "RS-670:ty")).toBe("power");
  });
});

// ===========================================================================
describe("RS-674 シンケンレッド", () => {
  const TEXT = "※レジスト 【烈火大斬刀】「SP1」 DAを持つ敵軍Sユニットを1体選び撃破する。";
  const PAGE = "atwiki/page-1421";
  const DA_S = sUnit("SPEC-DA-S", { bp: 3000, category: "DA" });
  const DA_M = sUnit("SPEC-DA-M", { bp: 3000, category: "DA", size: "M" });
  const MA_S = sUnit("SPEC-MA-S", { bp: 3000, category: "MA" });
  const DA_ET = sUnit("SPEC-DA-ET", { bp: 3000, category: ["DA", "ET"] as never });

  it("RS-674: カタログ本文・スペックが出典と一致（出典: atwiki/page-1421）", () => {
    expectCatalogText("RS-674", TEXT);
    expectStats("RS-674", { name: "シンケンレッド", category: "MA", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 3, features: ["レッド", "男", "侍"] });
  });

  it("RS-674: レアリティはスーパーレア（出典: atwiki/page-1421「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-674")).toBe("SR");
  });

  it("RS-674: ※レジスト — 敵軍ターン中にバトルで撃破されるときレジストできる（出典: atwiki/page-1421「※レジスト」・R-KW-RESIST-01）", () => {
    const s = attackUntilRegister({ battle: [inst("RS-674", "r")] }, "RS-674:r");
    expect(registerOffered(s)).toBe(true);
  });

  const board = (fillers: number) =>
    ncEnter("RS-674:r", fillers, {}, {
      battle: [inst("SPEC-DA-S", "das"), inst("SPEC-MA-S", "mas")],
      rush: [inst("SPEC-DA-M", "dam"), inst("SPEC-DA-ET", "daet")],
    }, [DA_S, DA_M, MA_S, DA_ET]);

  it("RS-674: 【烈火大斬刀】NC（3番目）— DA を持つ敵軍 S ユニットだけを選べる（ラッシュエリア・マルチカテゴリも含む）（出典: atwiki/page-1421・R-TGT-01）", () => {
    const s = board(2);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-674");
    expect(choiceIds(s)).toEqual(["SPEC-DA-ET:daet", "SPEC-DA-S:das"]);
  });

  it("RS-674: 【烈火大斬刀】強制 — 選ばないことはできず、選んだユニットは撃破される（出典: atwiki/page-1421「1体選び撃破する」）", () => {
    let s = board(2);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-DA-S:das"));
    expect(zoneOf(s, "player2", "SPEC-DA-S:das")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DA-ET:daet")).toBe("rush");
  });

  it("RS-674: 【烈火大斬刀】「SP1」— NC が成立すると SP1 になりストライクできる（出典: atwiki/page-1421「「SP1」」）", () => {
    const s = resolveAll(board(2), ["SPEC-DA-S:das"]);
    expect(spOf(s, "player1", "RS-674:r")).toBe(1);
    expect(canStrike(s, "RS-674:r")).toBe(true);
  });

  it("RS-674: 【烈火大斬刀】NC が成立しない（2番目）と撃破も SP1 もない（SP！）（出典: R-CN-02・atwiki/page-1421「SP：！」）", () => {
    const s = resolveAll(board(1));
    expect(zoneOf(s, "player2", "SPEC-DA-S:das")).toBe("battle");
    expect(spOf(s, "player1", "RS-674:r")).toBe(0);
    expect(canStrike(s, "RS-674:r")).toBe(false);
  });
});

// ===========================================================================
describe("RS-675 シンケンブルー", () => {
  const TEXT = "【ウォーターアロー】これは敵軍ラッシュエリアのユニットにアタックできる。";
  const PAGE = "atwiki/page-1425";
  const E500 = sUnit("SPEC-E500", { bp: 500 });

  it("RS-675: カタログ本文・スペックが出典と一致（出典: atwiki/page-1425）", () => {
    expectCatalogText("RS-675", TEXT);
    expectStats("RS-675", { name: "シンケンブルー", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 4, features: ["ブルー", "男", "侍"] });
  });

  it("RS-675: レアリティはノーマルレア（出典: atwiki/page-1425「レアリティ：ノーマルレア」）", () => {
    expect(rarityOf("RS-675")).toBe("NR");
  });

  const board = (fillers: number) =>
    ncEnter("RS-675:b", fillers, {}, { rush: [inst("SPEC-E500", "r")], battle: [inst("SPEC-E500", "bt")] }, [E500]);

  it("RS-675: 【ウォーターアロー】NC（4番目）— 敵軍ラッシュエリアのユニットにアタックでき、撃破できる（出典: atwiki/page-1425）", () => {
    let s = resolveAll(board(3));
    expect(attackTargets(s, "RS-675:b")).toContain("SPEC-E500:r");
    s = settle(act(s, { type: "battle", playerId: "player1", attackerInstanceId: "RS-675:b", defenderInstanceId: "SPEC-E500:r" }));
    expect(zoneOf(s, "player2", "SPEC-E500:r")).toBe("discard");
  });

  it("RS-675: 【ウォーターアロー】NC が成立しない（3番目）と敵軍ラッシュエリアにはアタックできない（出典: R-CN-02）", () => {
    const s = resolveAll(board(2));
    expect(attackTargets(s, "RS-675:b")).not.toContain("SPEC-E500:r");
    expect(attackTargets(s, "RS-675:b")).toContain("SPEC-E500:bt");
  });
});

// ===========================================================================
describe("RS-676 シンケンピンク", () => {
  const TEXT = "【ヘブンファン】「SP1」自分も相手も1枚ドローする。";
  const PAGE = "atwiki/page-1428";

  it("RS-676: カタログ本文・スペックが出典と一致（出典: atwiki/page-1428）", () => {
    expectCatalogText("RS-676", TEXT);
    expectStats("RS-676", { name: "シンケンピンク", category: "MA", size: "S", bp: 500, sp: "special", powerCost: 2, comboNumber: 3, features: ["ピンク", "女", "侍"] });
    expect(rarityOf("RS-676")).toBe("N");
  });

  const board = (fillers: number) =>
    ncEnter("RS-676:p", fillers, { deck: [inst("TST-OP", "my0"), ...deckCards(3)] }, { deck: [inst("TST-OP", "en0"), ...deckCards(3, "e")] });

  it("RS-676: 【ヘブンファン】NC（3番目）— 自分も相手も山札から1枚ドローする（出典: atwiki/page-1428「自分も相手も1枚ドローする」）", () => {
    const s = resolveAll(board(2));
    expect(zoneOf(s, "player1", "TST-OP:my0")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:en0")).toBe("hand");
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RS-676: 【ヘブンファン】「SP1」— NC が成立すると SP1 になりストライクできる（出典: atwiki/page-1428）", () => {
    const s = resolveAll(board(2));
    expect(spOf(s, "player1", "RS-676:p")).toBe(1);
    expect(canStrike(s, "RS-676:p")).toBe(true);
  });

  it("RS-676: 【ヘブンファン】NC が成立しない（4番目）とドローも SP1 もない（出典: R-CN-02）", () => {
    const s = resolveAll(board(3));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(0);
    expect(spOf(s, "player1", "RS-676:p")).toBe(0);
  });
});

