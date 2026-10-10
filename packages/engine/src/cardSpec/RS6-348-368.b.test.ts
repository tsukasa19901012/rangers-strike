/**
 * カード別スペック: RS-354〜RS-360（第6弾「紅き六戦士の帰還」デンジレッド〜ヘドリアン女王）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6（RS-358/359/360 の Q&A、RS-375 の Q に RS-356 が登場、
 *     RS-404 の Q に RS-360 が登場）、grnrngr/faq-card-8（RS-558 の Q に RS-359 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhase,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RS6-348-368.helpers";
import type { CardInstance, GameState } from "../types/game";

const B1500 = sUnit("SPEC-B1500", { bp: 1500, sp: undefined });
const M3000 = sUnit("SPEC-M3000", { bp: 3000, sp: undefined, size: "M" });
const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });
const SPECS = [B1500, M3000, NOSP];

/** player1 のバトルフェイズ: n 体の後に id を出す（n+1 番目）。 */
function enterAt(id: string, n: number, p2: Partial<GameState["players"]["player2"]> = {}) {
  const s = st({ player1: { battle: fillers(n), rush: [inst(id, "x")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, SPECS);
  return enter(s, `${id}:x`);
}

// ===========================================================================
describe("RS-354 デンジレッド", () => {
  const TEXT = "【デンジパンチ】敵軍バトルエリアから、BPの下三桁が500の敵軍ユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";
  const enemy = { battle: [inst("SPEC-B1500", "a"), inst("TST-UNIT-0", "b"), inst("RS-358", "c")], rush: [inst("SPEC-B1500", "r")] };

  it("RS-354: カタログ本文・スペックが出典と一致（出典: atwiki/page-548）", () => {
    expectCatalogText("RS-354", TEXT);
    expectStats("RS-354", { name: "デンジレッド", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 3, features: ["レッド", "男"] });
  });

  it("RS-354: SP「－」なのでストライクできない（出典: atwiki/page-548「SP：－」）", () => {
    const s = enterAt("RS-354", 2);
    expect(spOf(s, "player1", "RS-354:x")).toBe(0);
    expect(canStrike(s, "RS-354:x")).toBe(false);
  });

  // 既知の不具合: CARD-RS-354 【デンジパンチ】の候補が自軍バトルエリアのユニットになり、BP下三桁500の条件も見ていない
  it.fails("RS-354: 【デンジパンチ】3番目に出て NC が成立すると、敵軍バトルエリアの BP 下三桁500 の敵軍ユニットだけを選べる（ラッシュエリア・自軍は不可）（出典: atwiki/page-548）", () => {
    const s = enterAt("RS-354", 2, enemy);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-354");
    expect(choiceIds(s)).toEqual(["RS-358:c", "SPEC-B1500:a"]);
  });

  // 既知の不具合: CARD-RS-354 【デンジパンチ】の候補が自軍バトルエリアのユニットになり、BP下三桁500の条件も見ていない
  it.fails("RS-354: 【デンジパンチ】選んだユニットを持ち主（敵軍）のパワーゾーンに送る（出典: atwiki/page-548「持ち主のパワーゾーンに送って」）", () => {
    let s = enterAt("RS-354", 2, enemy);
    s = resolveAll(pick(s, "SPEC-B1500:a"));
    expect(zoneOf(s, "player2", "SPEC-B1500:a")).toBe("power");
    expect(s.players.player1.battle).toHaveLength(3);
  });

  // 既知の不具合: CARD-RS-354 【デンジパンチ】が任意（「送ってもよい」）になっていない
  it.fails("RS-354: 【デンジパンチ】「送ってもよい」— 送らないことも選べる（出典: atwiki/page-548「送ってもよい」）", () => {
    const s = enterAt("RS-354", 2, enemy);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-354: NC が成立しない（2番目）ときは【デンジパンチ】は発動しない（出典: atwiki/page-548「CN：3」・R-CN-02）", () => {
    const s = enterAt("RS-354", 1, enemy);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-B1500:a")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-355 デンジブルー", () => {
  const TEXT = "【ブルースクリューキック】敵軍バトルエリアから、BPの合計が6000になるように隣り合う2体のSユニットを選び、持ち主のパワーゾーンに送ってもよい。";

  it("RS-355: カタログ本文・スペックが出典と一致（出典: atwiki/page-547）", () => {
    expectCatalogText("RS-355", TEXT);
    expectStats("RS-355", { name: "デンジブルー", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 2, features: ["ブルー", "男"] });
  });

  // 敵軍バトルエリア: [デンジレッド3000, バルパンサー3000, 1000, デンジレッド3000] — 隣り合う S の合計6000 は (a,b) だけ
  const enemy = { battle: [inst("RS-354", "a"), inst("RS-363", "b"), inst("TST-UNIT-0", "c"), inst("RS-354", "d")] };

  // 既知の不具合: CARD-RS-355 【ブルースクリューキック】の候補が自軍バトルエリアのユニット1体になり、隣接・合計6000の条件を見ていない
  it.fails("RS-355: 【ブルースクリューキック】2番目に出て NC が成立すると、BP合計6000の隣り合う敵軍 S ユニット2体を持ち主のパワーゾーンに送る（出典: atwiki/page-547）", () => {
    let s = enterAt("RS-355", 1, enemy);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-355");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:fill0");
    expect(choiceIds(s)).not.toContain("RS-355:x");
    s = resolveAll(s, ["RS-354:a", "RS-363:b"]);
    expect(zoneOf(s, "player2", "RS-354:a")).toBe("power");
    expect(zoneOf(s, "player2", "RS-363:b")).toBe("power");
    expect(zoneOf(s, "player2", "TST-UNIT-0:c")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-354:d")).toBe("battle");
  });

  it("RS-355: 【ブルースクリューキック】隣り合っていない2体（合計6000）は選べない — 隣り合う組がなければ何も送られない（出典: atwiki/page-547「隣り合う2体」）", () => {
    const s = resolveAll(enterAt("RS-355", 1, { battle: [inst("RS-354", "a"), inst("TST-UNIT-0", "c"), inst("RS-354", "d")] }), ["RS-354:a", "RS-354:d"]);
    expect(zoneOf(s, "player2", "RS-354:a")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-354:d")).toBe("battle");
  });

  it("RS-355: 【ブルースクリューキック】M ユニットを含む組（合計6000）は選べない（出典: atwiki/page-547「2体のSユニット」）", () => {
    const s = resolveAll(enterAt("RS-355", 1, { battle: [inst("RS-354", "a"), inst("SPEC-M3000", "m")] }), ["RS-354:a", "SPEC-M3000:m"]);
    expect(zoneOf(s, "player2", "RS-354:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-M3000:m")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-355 【ブルースクリューキック】が任意（「送ってもよい」）になっていない
  it.fails("RS-355: 【ブルースクリューキック】「送ってもよい」— 送らないことも選べる（出典: atwiki/page-547「送ってもよい」）", () => {
    const s = enterAt("RS-355", 1, enemy);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-355: NC が成立しない（3番目）ときは発動しない（出典: atwiki/page-547「CN：2」・R-CN-02）", () => {
    const s = enterAt("RS-355", 2, enemy);
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-356 デンジイエロー", () => {
  const TEXT = "【ハンマーパンチ】次の相手ターン、必要パワーの数字が3以下の敵軍ユニットは、ターンが終わるまでバトルエリアに出られない。";

  it("RS-356: カタログ本文・スペックが出典と一致（出典: atwiki/page-544）", () => {
    expectCatalogText("RS-356", TEXT);
    expectStats("RS-356", { name: "デンジイエロー", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 5, features: ["イエロー", "男"] });
  });

  /** 5番目（NC）または4番目に出し、相手ターンのバトルフェイズまで進める。 */
  const nextEnemyTurn = (n: number, enemyRush: CardInstance[], enemyExtra: Partial<GameState["players"]["player2"]> = {}) => {
    let s = enterAt("RS-356", n, { rush: enemyRush, ...enemyExtra });
    s = endTurn(s);
    return toPhase(s, "player2", "battle");
  };

  it("RS-356: 【ハンマーパンチ】次の相手ターン、必要パワー3以下の敵軍ユニットはバトルエリアに出られない（出典: atwiki/page-544）", () => {
    const s = nextEnemyTurn(4, [inst("TST-UNIT-2", "c2"), inst("RS-354", "c3")]);
    expect(canEnter(s, "TST-UNIT-2:c2", "player2")).toBe(false);
    expect(canEnter(s, "RS-354:c3", "player2")).toBe(false);
  });

  it("RS-356: 【ハンマーパンチ】必要パワー4以上の敵軍ユニットは出られる（出典: atwiki/page-544「3以下の」）", () => {
    const s = nextEnemyTurn(4, [inst("RS-361", "c5")]);
    expect(canEnter(s, "RS-361:c5", "player2")).toBe(true);
  });

  it("RS-356: 【ハンマーパンチ】効果は次の相手ターンだけで、その次の相手ターンには出られる（出典: atwiki/page-544「次の相手ターン、…ターンが終わるまで」）", () => {
    let s = nextEnemyTurn(4, [inst("TST-UNIT-2", "c2")]);
    s = toPhase(endTurn(endTurn(s)), "player2", "battle");
    expect(canEnter(s, "TST-UNIT-2:c2", "player2")).toBe(true);
  });

  it("RS-356: NC が成立しない（4番目）ときは制限は生じない（出典: atwiki/page-544「CN：5」・R-CN-02）", () => {
    const s = nextEnemyTurn(3, [inst("TST-UNIT-2", "c2")]);
    expect(canEnter(s, "TST-UNIT-2:c2", "player2")).toBe(true);
  });

  // grnrngr/faq-card-6 RS-375 Q「いいえ、効果を及ぼしません。ラッシュされて「ユニット」として扱われているものは「ユニットカード」を対象にした効果を受けません。」
  it("RS-356: 公式Q&A — レッドレーサー（2nd）の「ユニットカードの必要パワーの数字は1増える」はラッシュ済みのユニットには及ばず、必要パワー3のユニットはやはり出られない（出典: grnrngr/faq-card-6 RS-375 Q）", () => {
    const s = nextEnemyTurn(4, [inst("RS-354", "c3"), inst("RS-375", "rr")]);
    expect(canEnter(s, "RS-354:c3", "player2")).toBe(false);
  });
});

// ===========================================================================
describe("RS-357 デンジグリーン", () => {
  const TEXT = "【グリーンスピンキック】「SP1」";

  it("RS-357: カタログ本文・スペックが出典と一致（出典: atwiki/page-545）", () => {
    expectCatalogText("RS-357", TEXT);
    expectStats("RS-357", { name: "デンジグリーン", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: 1, comboNumber: 4, features: ["グリーン", "男", "警察"] });
  });

  it("RS-357: 【グリーンスピンキック】4番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-545「CN：4」）", () => {
    const s = enterAt("RS-357", 3);
    expect(spOf(s, "player1", "RS-357:x")).toBe(1);
    expect(canStrike(s, "RS-357:x")).toBe(true);
  });

  it("RS-357: NC が成立しない（3番目）ときは SP！のままストライクできない（出典: atwiki/page-545「SP：！」）", () => {
    const s = enterAt("RS-357", 2);
    expect(spOf(s, "player1", "RS-357:x")).toBe(0);
    expect(canStrike(s, "RS-357:x")).toBe(false);
  });
});

// ===========================================================================
describe("RS-358 デンジピンク", () => {
  const TEXT = "【デンジサンダー投げ】相手は自分自身のラッシュエリアからSユニットを1体選び、可能ならバトルエリアに出す。";

  it("RS-358: カタログ本文・スペックが出典と一致（出典: atwiki/page-546）", () => {
    expectCatalogText("RS-358", TEXT);
    expectStats("RS-358", { name: "デンジピンク", category: "OT", size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: 1, features: ["ピンク", "女"] });
  });

  it("RS-358: 【デンジサンダー投げ】1番目に出て NC が成立すると、相手が自分自身のラッシュエリアから S ユニットを選ぶ（M は不可・見送り不可）（出典: atwiki/page-546「相手は自分自身のラッシュエリアからSユニットを1体選び」）", () => {
    const s = enterAt("RS-358", 0, { rush: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-2", "m"), inst("RS-357", "b")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["RS-357:b", "TST-UNIT-0:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-358: 【デンジサンダー投げ】選ばれたユニットは敵軍バトルエリアに出る（出典: atwiki/page-546「可能ならバトルエリアに出す」）", () => {
    let s = enterAt("RS-358", 0, { rush: [inst("TST-UNIT-0", "a"), inst("RS-357", "b")] });
    s = resolveAll(pick(s, "RS-357:b"));
    expect(zoneOf(s, "player2", "RS-357:b")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("rush");
  });

  it("RS-358: 相手のラッシュエリアに S ユニットがなければ何も起きない（出典: atwiki/page-546「可能なら」）", () => {
    const s = enterAt("RS-358", 0, { rush: [inst("TST-UNIT-2", "m")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("rush");
  });

  it("RS-358: NC が成立しない（2番目）ときは発動しない（出典: atwiki/page-546「CN：1」・R-CN-02）", () => {
    const s = enterAt("RS-358", 1, { rush: [inst("TST-UNIT-0", "a")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("rush");
  });

  it("RS-358: 公式Q&A — 「バトルエリアに出られない」ユニット（タック）を選べば、結果としてバトルエリアに出さずに済ませられる（出典: grnrngr/faq-card-6 RS-358 Q1「はい、できます」）", () => {
    let s = enterAt("RS-358", 0, { rush: [inst("RS-223", "tack"), inst("TST-UNIT-0", "a")] });
    expect(choiceIds(s)).toContain("RS-223:tack");
    s = resolveAll(pick(s, "RS-223:tack"));
    expect(zoneOf(s, "player2", "RS-223:tack")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("rush");
    expect(s.players.player2.battle).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-359 デンジ犬アイシー", () => {
  const TEXT =
    "※これはバトルエリアに出られない。【最後の手段】これが自軍ラッシュエリアにある間、自分がOTのLユニットをラッシュするとき、これを捨札にして次の効果を発動できる⇒自軍山札から、そのLユニットの追加条件を満たすために必要なユニットのカードを1枚選び捨札にすれば、必要なユニットの1体を捨札にしたことにできる。その後、山札をシャッフルする。";

  it("RS-359: カタログ本文・スペックが出典と一致（出典: atwiki/page-549）", () => {
    expectCatalogText("RS-359", TEXT);
    expectStats("RS-359", { name: "デンジ犬アイシー", category: "OT", size: "S", bp: 500, sp: undefined, powerCost: 5, features: ["メカ"] });
  });

  it("RS-359: ※ バトルエリアに出られない（出典: atwiki/page-549「※これはバトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-359", "ic")], deck: deckCards(5) } });
    expect(canEnter(s, "RS-359:ic")).toBe(false);
  });

  const daidenjin = (p1: Partial<GameState["players"]["player1"]>) =>
    rushPhase({ hand: [inst("RS-352", "dd")], command: releasedCat("OT", 1), power: powerCards(7), ...p1 });

  // 既知の不具合: CARD-RS-359 【最後の手段】が未実装（山札のカードで追加条件を満たせない）
  it.fails("RS-359: 【最後の手段】自軍ラッシュエリアにあるとき、これを捨札にし、山札の「デンジファイター」を捨札にしてダイデンジン（OT の L）の追加条件を満たせる（出典: atwiki/page-549）", () => {
    const s = daidenjin({ rush: [inst("RS-359", "ic")], deck: [inst("TST-OP", "o"), inst("RS-353", "f")] });
    expect(canStartRush(s, "player1", "RS-352:dd")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-352:dd", { materials: ["RS-353:f"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state, ["RS-353:f"]);
    expect(zoneOf(t, "player1", "RS-352:dd")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-359:ic")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-353:f")).toBe("discard");
  });

  it("RS-359: アイシーがいなければ、山札にデンジファイターがあってもダイデンジンはラッシュできない（出典: atwiki/page-549「これが自軍ラッシュエリアにある間」）", () => {
    const s = daidenjin({ rush: [inst("TST-UNIT-0", "f0")], deck: [inst("RS-353", "f")] });
    expect(canStartRush(s, "player1", "RS-352:dd")).toBe(false);
  });

  it("RS-359: OT 以外の L ユニットのラッシュには使えない（出典: atwiki/page-549「OTのLユニット」）", () => {
    const WBL = sUnit("SPEC-WBL", {
      size: "L",
      bp: 9000,
      powerCost: "5+",
      rushAdditionalCondition: { conditionId: "discard_named_unit", text: "自軍「デンジファイター」1体を捨札にする", partnerName: "デンジファイター", unitCount: 1 } as never,
    });
    const s = rushPhase({ hand: [inst("SPEC-WBL", "w")], rush: [inst("RS-359", "ic")], command: releasedCat("WB", 1), power: powerCards(5), deck: [inst("RS-353", "f")] }, {}, [WBL]);
    expect(canStartRush(s, "player1", "SPEC-WBL:w")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-359 Q1「はい、できます。」
  // 既知の不具合: CARD-RS-359 【最後の手段】が未実装
  it.fails("RS-359: 公式Q&A — アイシー2体を捨札にし、山札のバイオジェット1号・2号を1枚ずつ捨札にしてバイオロボをラッシュできる（出典: grnrngr/faq-card-6 RS-359 Q1）", () => {
    const s = rushPhase({
      hand: [inst("RS-127", "bio")],
      rush: [inst("RS-359", "i1"), inst("RS-359", "i2")],
      command: releasedCat("OT", 1),
      power: powerCards(6),
      deck: [inst("RS-128", "j1"), inst("RS-129", "j2")],
    });
    expect(canStartRush(s, "player1", "RS-127:bio")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-127:bio", { materials: ["RS-128:j1", "RS-129:j2"] });
    const t = resolveAll(r.state, ["RS-128:j1", "RS-129:j2"]);
    expect(zoneOf(t, "player1", "RS-127:bio")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-359:i1")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-359:i2")).toBe("discard");
  });

  it("RS-359: 公式Q&A — ラッシュエリアから捨札にするのと同じユニット（バイオジェット1号）のカードを山札から選んでも、そのLユニットはラッシュできない（出典: grnrngr/faq-card-6 RS-359 Q2「いいえ、それはできません」）", () => {
    const s = rushPhase({
      hand: [inst("RS-127", "bio")],
      rush: [inst("RS-359", "i1"), inst("RS-128", "j1")],
      command: releasedCat("OT", 1),
      power: powerCards(6),
      deck: [inst("RS-128", "j1d")],
    });
    expect(canStartRush(s, "player1", "RS-127:bio")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-359 Q3/Q6「はい、できます。」
  it("RS-359: 公式Q&A — Vコマンダーで山札から出す Vレックスロボの追加条件（Vレックス）を、【最後の手段】で山札の Vレックスを捨札にして満たせる（出典: grnrngr/faq-card-6 RS-359 Q3・Q6）", () => {
    const s = rushPhase({
      hand: [inst("RS-249", "vc")],
      rush: [inst("RS-359", "ic")],
      command: releasedCat("OT", 1),
      power: powerCards(5),
      deck: [inst("RS-301", "vrr"), inst("RS-302", "vr")],
    });
    const r = playOp(s, "player1", "RS-249:vc", "RS-301:vrr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state, ["RS-301:vrr", "RS-302:vr"]);
    expect(zoneOf(t, "player1", "RS-301:vrr")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-302:vr")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-359:ic")).toBe("discard");
  });

  it.todo("RS-359: 公式Q&A — 山札を見た後で、ラッシュするLユニットと捨札にするカードを変更できる（ダイデンジン → バイオロボ）（出典: grnrngr/faq-card-6 RS-359 Q4）— 【最後の手段】が未実装で、ラッシュ対象の変更手順も API にない");
  it.todo("RS-359: 公式Q&A — 手順の巻き戻しでラッシュエリアから捨札にしたユニットは戻るが、アイシーは戻らない（出典: grnrngr/faq-card-6 RS-359 Q5）— 【最後の手段】が未実装で、巻き戻し手順も API にない");
  it.todo("RS-359: 公式Q&A — 異次元からの翼でセイクウオーをラッシュするときも【最後の手段】を使える（出典: grnrngr/faq-card-6 RS-359 Q7）— 【最後の手段】が未実装");
  it.todo("RS-359: 公式Q&A — アイシーの効果で OT の L ユニットをラッシュしたとき、ガンマジンの効果でドローできない（出典: grnrngr/faq-card-8 RS-558 Q「いいえ、できません」）— 【最後の手段】が未実装で前提が作れない");
});

// ===========================================================================
describe("RS-360 ヘドリアン女王", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。【宇宙で一番美しいのは誰？】これが自軍ラッシュエリアにある間、相手は次の制限を受ける⇒自分自身のターンを終えるとき、特徴「女」を持つ自分自身のユニットを1体選び撃破する。";

  it("RS-360: カタログ本文・スペックが出典と一致（出典: atwiki/page-601）", () => {
    expectCatalogText("RS-360", TEXT);
    expectStats("RS-360", { name: "ヘドリアン女王", category: "DA", size: "S", bp: 6000, sp: undefined, powerCost: 4, features: ["女王", "ベーダー一族", "女"] });
  });

  it("RS-360: ※ 敵軍ターン中、SP1 以上のユニットとバトルするとバトルに勝っても撃破される（出典: atwiki/page-601「バトルに勝っても撃破される」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-360", "hq")], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-0", "a")], deck: deckCards(5, "e") } }, SPECS);
    s = resolveAll(settle(attack(s, "TST-UNIT-0:a", "RS-360:hq", "player2")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-360:hq")).toBe("discard");
  });

  it("RS-360: ※ SP のないユニットとのバトルなら勝って残る（出典: atwiki/page-601「SP1以上のユニットと」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-360", "hq")], deck: deckCards(5) }, player2: { battle: [inst("SPEC-NOSP", "a")], deck: deckCards(5, "e") } }, SPECS);
    s = resolveAll(settle(attack(s, "SPEC-NOSP:a", "RS-360:hq", "player2")));
    expect(zoneOf(s, "player1", "RS-360:hq")).toBe("battle");
  });

  it("RS-360: ※ 自軍ターン中に SP1 のユニットにアタックして勝っても撃破されない（出典: atwiki/page-601「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-360", "hq")], deck: deckCards(5) }, player2: { battle: [inst("TST-UNIT-0", "a")], deck: deckCards(5, "e") } }, SPECS);
    s = resolveAll(settle(attack(s, "RS-360:hq", "TST-UNIT-0:a")));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-360:hq")).toBe("battle");
  });

  /** 相手（player2）のターンを終える。 */
  const enemyTurnEnd = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, SPECS);
    return endTurn(s);
  };

  it("RS-360: 【宇宙で一番美しいのは誰？】自軍ラッシュエリアにある間、相手は自分のターンを終えるとき、特徴「女」の自分のユニットを1体選び撃破する（出典: atwiki/page-601）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("RS-360", "hq")], deck: deckCards(5) }, player2: { battle: [inst("RS-358", "w1"), inst("TST-UNIT-0", "m")], rush: [inst("RS-358", "w2")], deck: deckCards(5, "e") } }, SPECS);
    s = settle(s);
    s = act(s, legal(s).find((a) => a.type === "end_phase")!);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["RS-358:w1", "RS-358:w2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-358:w2"));
    expect(zoneOf(s, "player2", "RS-358:w2")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-358:w1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:m")).toBe("battle");
  });

  it("RS-360: 相手に特徴「女」のユニットがなければ何も撃破されない（出典: atwiki/page-601「特徴「女」を持つ自分自身のユニット」）", () => {
    const s = enemyTurnEnd({ rush: [inst("RS-360", "hq")] }, { battle: [inst("TST-UNIT-0", "m")] });
    expect(zoneOf(s, "player2", "TST-UNIT-0:m")).toBe("battle");
  });

  it("RS-360: ヘドリアン女王がバトルエリアにある（ラッシュエリアにない）ときは制限は生じない（出典: atwiki/page-601「自軍ラッシュエリアにある間」）", () => {
    const s = enemyTurnEnd({ battle: [inst("RS-360", "hq")] }, { battle: [inst("RS-358", "w1")] });
    expect(zoneOf(s, "player2", "RS-358:w1")).toBe("battle");
  });

  it("RS-360: 制限を受けるのは相手だけ — 自分がターンを終えても自軍の「女」は撃破されない（出典: atwiki/page-601「相手は次の制限を受ける」）", () => {
    let s = st({ player1: { rush: [inst("RS-360", "hq")], battle: [inst("RS-358", "own")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, SPECS);
    s = endTurn(s);
    expect(zoneOf(s, "player1", "RS-358:own")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-360:hq")).toBe("rush");
  });

  // grnrngr/faq-card-6 RS-360 Q1「はい、2体になります。」
  it("RS-360: 公式Q&A — 自軍ラッシュエリアにヘドリアン女王が2体あれば、相手がターンを終えるときに撃破する「女」は2体になる（出典: grnrngr/faq-card-6 RS-360 Q1）", () => {
    const s = resolveAll(enemyTurnEnd({ rush: [inst("RS-360", "h1"), inst("RS-360", "h2")] }, { battle: [inst("RS-358", "w1"), inst("RS-358", "w2"), inst("RS-358", "w3")] }));
    expect(s.players.player2.discard.filter((c) => c.cardId === "RS-358")).toHaveLength(2);
    expect(s.players.player2.battle.filter((c) => c.cardId === "RS-358")).toHaveLength(1);
  });

  it("RS-360: 公式Q&A（マーフィーK9）— 特徴「メカ」を持たないヘドリアン女王を選び、山札から特徴「メカ」を持つ「ヘドリアン女王（2nd）」を手札に加えられる（出典: grnrngr/faq-card-6 RS-404 Q2「はい、できます」）", () => {
    let s = rushPhase(
      { hand: [inst("RS-404", "k9")], rush: [inst("RS-360", "hq")], command: releasedCat("OT", 1), power: powerCards(1), deck: [inst("TST-OP", "o"), inst("SR-004", "hq2")] },
    );
    const r = rushFromHand(s, "player1", "RS-404:k9");
    expect(r.ok).toBe(true);
    s = resolveAll(r.state, ["RS-360:hq", "SR-004:hq2"]);
    expect(zoneOf(s, "player1", "SR-004:hq2")).toBe("hand");
  });
});

// 未使用警告の回避（共通ヘルパーの一部はこのファイルで使わない）
void skip;
