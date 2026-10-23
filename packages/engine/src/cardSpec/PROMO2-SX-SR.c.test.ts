/**
 * カード別スペック: SR-001〜SR-008（レンジャーズストライクのシークレットレア ガオキング〜ビッグワン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ:
 *     card_6.html（SR-004 Q・SR-005 Q）、card_8.html（RS-558 Q3 の SR-007）。atwiki に転載された公式 Q&A: atwiki/page-388 SR-002 Q1、page-811 SR-006 Q1、page-1235 SR-007 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-SR-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06・R-KW-RESIST・R-KW-TAKUS-01・R-POW-02 等）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-SR-NNN …」）で残す。
 * レアリティは atwiki の「シークレットレア」を SC として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - SR-004 Q（RS-385 グリーンホバーで置く ET のカードはリリース状態で置いた後ホールドになる）— cardSpec/RS6-369-389.c.test.ts RS-385
 *  - SR-004 を RS-404 マーフィーK9【追跡】で山札から加える Q — cardSpec/RS6-390-410.c.test.ts RS-404
 *  - SR-005 Q（RS-375 レッドレーサー（2nd）で捨札にしたカードの必要パワーが1増える）— cardSpec/RS6-369-389.a.test.ts RS-375
 *  - SR-007 を RS-558 ガンマジンの横でラッシュしてもドローしない Q — cardSpec/RS8-538-559.d.test.ts RS-558
 *  - SR-002 と同じカード RS-347 の細かい照合（ホールド状態のカードは使えない・このターンだけ・XG3-006 の Q1・RS-565/RS-569 の Q）— cardSpec/RS5-327-347.c.test.ts RS-347
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  DEFS,
  act,
  attack,
  attackTargets,
  attackUntilRegister,
  battleBoard,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enemyBattle,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  fill,
  inst,
  lastBattleBps,
  legal,
  pick,
  playOp,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  rushBoardWith,
  rushFromHand,
  sUnit,
  settle,
  spOf,
  st,
  zoneOf,
  zordDownTests,
} from "./PROMO2-SX-SR.helpers";

const ET_M = sUnit("SPEC-ET-M", { category: "ET", size: "M", bp: 2000 });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: 1 });
const E1000NS = sUnit("SPEC-E1000-NS", { bp: 1000, sp: undefined });
const E7000 = sUnit("SPEC-E7000", { bp: 7000, sp: 1 });
const C1 = sUnit("SPEC-C1", { powerCost: 1, bp: 1000 });
const C2 = sUnit("SPEC-C2", { powerCost: 2, bp: 1000 });
const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", bp: 1000, sp: undefined });
const featureCmd = (id: string, features: string[]) => sUnit(id, { category: "ET", features });
const RED = featureCmd("SPEC-F-RED", ["レッド"]);
const BLUE = featureCmd("SPEC-F-BLUE", ["ブルー"]);
const GREEN = featureCmd("SPEC-F-GREEN", ["グリーン"]);
const PINK = featureCmd("SPEC-F-PINK", ["ピンク"]);
const NONE = featureCmd("SPEC-F-NONE", ["男"]);
const EXTRA: CardDefinition[] = [ET_M, E1000, E1000NS, E7000, C1, C2, ET_NOSP, RED, BLUE, GREEN, PINK, NONE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => battleBoard(EXTRA, p1, p2);
const enemyTurn = (p1: P1 = {}, p2: P2 = {}) => enemyBattle(EXTRA, p1, p2);
const rushPhase = (p1: P1 = {}, p2: P2 = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("SR-001 ガオキング", () => {
  const TEXT = "合体―ガオライオン＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー【天地轟鳴アニマルハート】このユニットは、自軍バトルエリアにある「WB」のMユニット1体につきBP＋2000される。";

  it("SR-001: カタログ本文・スペックが出典と一致（SC 版の効果名は【天地轟鳴アニマルハート】）（出典: atwiki/page-17「（SC版：【天地轟鳴アニマルハート】）」）", () => {
    expectCatalogText("SR-001", TEXT);
    expectUnitStats("SR-001", { name: "ガオキング", category: "WB", size: "L", bp: 14000, sp: 1, powerCost: "6+", features: ["獣", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("SR-001", ["SC"]);
  });

  it("SR-001: 合体ユニット5体（RS-152〜156）をすべて捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-17「合体―ガオライオン＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー」・R-ADD-06）", () => {
    const five = ["RS-152", "RS-153", "RS-154", "RS-155", "RS-156"].map((id) => inst(id, "m"));
    const mk = (rush: CardInstance[]) => rushPhase({ hand: [inst("SR-001", "k")], rush, command: releasedN(2), power: powerCards(6) });
    expect(canStartRush(mk(five.slice(0, 4)), "player1", "SR-001:k")).toBe(false);
    const r = rushFromHand(mk(five), "player1", "SR-001:k");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SR-001:k")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("SR-001: 必要パワー6+ — パワー5ではラッシュできない（出典: atwiki/page-17「必要パワー：6+」）", () => {
    const five = ["RS-152", "RS-153", "RS-154", "RS-155", "RS-156"].map((id) => inst(id, "m"));
    expect(rushFromHand(rushPhase({ hand: [inst("SR-001", "k")], rush: five, command: releasedN(2), power: powerCards(5) }), "player1", "SR-001:k").ok).toBe(false);
  });

  it("SR-001: 【天地轟鳴アニマルハート】自軍バトルエリアの WB の M ユニット1体につき BP+2000（2体で18000）。ET の M・ラッシュエリアの M は数えない（出典: atwiki/page-17「自軍バトルエリアにある「WB」のMユニット1体につき」）", () => {
    expect(bpOf(board({ battle: [inst("SR-001", "k"), inst("RS-153", "e"), inst("RS-156", "t")] }), "player1", "SR-001:k")).toBe(18000);
    expect(bpOf(board({ battle: [inst("SR-001", "k"), inst("SPEC-ET-M", "m")], rush: [inst("RS-153", "r")] }), "player1", "SR-001:k")).toBe(14000);
  });

  it("SR-001: 【天地轟鳴アニマルハート】ターンの指定がないので敵軍ターン中も BP が上がる（出典: atwiki/page-17）", () => {
    expect(bpOf(enemyTurn({ battle: [inst("SR-001", "k"), inst("RS-153", "e")] }), "player1", "SR-001:k")).toBe(16000);
  });
});

// ===========================================================================
describe("SR-002 スーパーフォーメーション", () => {
  const TEXT =
    "このターン、5体以上の合体ユニットを必要とする特徴「メカ」を持つユニットのカードをラッシュするとき、追加条件を満たすために次のようにしてもよい⇒自軍コマンドゾーンのリリース状態のカードから、合体ユニットに足りない分のユニットと同じ名前のカードを捨札にする。";

  it("SR-002: カタログ本文・スペックが出典と一致（オペレーション・ET・必要パワー6）（出典: atwiki/page-388）", () => {
    expectCatalogText("SR-002", TEXT);
    const d = DEFS["SR-002"]!;
    expect(d.name).toBe("スーパーフォーメーション");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("ET");
    expect(d.powerCost).toBe(6);
  });

  it("SR-002: レアリティはシークレットレア（SC）（出典: atwiki/page-388「レアリティ：シークレットレア」「収録：四雄の覚醒」。ノーマルは五龍の逆鱗スターターの RS-347）", () => {
    expectRarityIn("SR-002", ["SC"]);
  });

  /** ビクトリーロボ（RS-382、5体合体）。自軍ラッシュエリアにレッドラダー・グリーンホバー、コマンドゾーン（リリース）に残り3体と同じ名前のカード。 */
  const victory = (withSF: boolean) =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-382", "vr"), ...(withSF ? [inst("SR-002", "sf")] : [])],
        rush: ["RS-383", "RS-385"].map((id) => inst(id, "f")),
        command: [...releasedCat("ET", 2), ...["RS-384", "RS-386", "RS-387"].map((id) => released(id, "c"))],
        power: powerCards(7),
        deck: deckCards(3),
      },
    });

  it("SR-002: 使わなければ、コマンドゾーンのカードで合体ユニットの不足分を補えない（出典: atwiki/page-388「このターン、…次のようにしてもよい」）", () => {
    expect(canStartRush(victory(false), "player1", "RS-382:vr")).toBe(false);
  });

  it("SR-002: 使ったターン、自軍コマンドゾーンのリリース状態の同名カードで不足分（3体）を補ってビクトリーロボをラッシュでき、そのカードは捨札になる（出典: atwiki/page-388「自軍コマンドゾーンのリリース状態のカードから、合体ユニットに足りない分のユニットと同じ名前のカードを捨札にする」）", () => {
    const u = playOp(victory(true), "player1", "SR-002:sf");
    expect(u.ok, u.error).toBe(true);
    const r = rushFromHand(resolveAll(u.state), "player1", "RS-382:vr");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-382:vr")).toBe("rush");
    for (const id of ["RS-384:c", "RS-386:c", "RS-387:c", "RS-383:f", "RS-385:f"]) expect(zoneOf(t, "player1", id)).toBe("discard");
  });
});

// ===========================================================================
describe("SR-003 アームドティラノレンジャー", () => {
  const TEXT = "【龍撃剣＆獣奏剣】自軍ターン中、これは自軍捨札にある特徴「恐竜」を持つカード1枚につきBP＋1000される。これはBP8000以上のとき「SP1」になる。";
  const DINOS = (n: number) => ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"].slice(0, n).map((id) => inst(id, "d"));

  it("SR-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-46）", () => {
    expectCatalogText("SR-003", TEXT);
    expectUnitStats("SR-003", { name: "アームドティラノレンジャー", category: "WB", size: "S", bp: 4000, sp: "special", powerCost: "5+", comboNumber: 4, features: ["レッド", "男", "獣奏剣"], rushCondition: "discard_named_unit" });
    expectRarityIn("SR-003", ["SC"]);
  });

  it("SR-003: 追加条件 — 自軍捨札に「ドラゴンレンジャー」（RS-289）があるとき、自軍「ティラノレンジャー」（RS-081）1体を捨札にしてラッシュできる（出典: atwiki/page-46「自軍捨札に「ドラゴンレンジャー」があるとき、自軍「ティラノレンジャー」1体を捨札にする」）", () => {
    const r = rushFromHand(
      rushPhase({ hand: [inst("SR-003", "at")], rush: [inst("RS-081", "ty")], discard: [inst("RS-289", "dr")], power: powerCards(5), command: releasedCat("WB", 1) }),
      "player1",
      "SR-003:at",
    );
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SR-003:at")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-081:ty")).toBe("discard");
  });

  it("SR-003: 追加条件 — 自軍捨札に「ドラゴンレンジャー」がなければ、ティラノレンジャーがいてもラッシュできない（出典: atwiki/page-46「自軍捨札に「ドラゴンレンジャー」があるとき」）", () => {
    expect(canStartRush(rushPhase({ hand: [inst("SR-003", "at")], rush: [inst("RS-081", "ty")], power: powerCards(5), command: releasedCat("WB", 1) }), "player1", "SR-003:at")).toBe(false);
  });

  it("SR-003: 【龍撃剣＆獣奏剣】自軍ターン中、自軍捨札の「恐竜」のカード1枚につき BP+1000（3枚で7000）。恐竜でないカード・敵軍捨札は数えない（出典: atwiki/page-46「自軍捨札にある特徴「恐竜」を持つカード1枚につきBP＋1000」）", () => {
    const s = board({ battle: [inst("SR-003", "at")], discard: [...DINOS(3), inst("TST-UNIT-0", "x")] }, { discard: DINOS(2) });
    expect(bpOf(s, "player1", "SR-003:at")).toBe(7000);
  });

  it("SR-003: 【龍撃剣＆獣奏剣】BP8000 以上（恐竜4枚）なら「SP1」になりストライクできる。7000 ではストライクできない（出典: atwiki/page-46「これはBP8000以上のとき「SP1」になる」）", () => {
    const s4 = enter(board({ rush: [inst("SR-003", "at")], discard: DINOS(4) }), "SR-003:at");
    expect(bpOf(s4, "player1", "SR-003:at")).toBe(8000);
    expect(canStrike(s4, "SR-003:at")).toBe(true);
    const s3 = enter(board({ rush: [inst("SR-003", "at")], discard: DINOS(3) }), "SR-003:at");
    expect(canStrike(s3, "SR-003:at")).toBe(false);
  });

  it("SR-003: 【龍撃剣＆獣奏剣】敵軍ターン中は BP が上がらない（4000）（出典: atwiki/page-46「自軍ターン中、」）", () => {
    expect(bpOf(enemyTurn({ battle: [inst("SR-003", "at")], discard: DINOS(4) }), "player1", "SR-003:at")).toBe(4000);
  });
});

// ===========================================================================
describe("SR-004 ヘドリアン女王（2nd）", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたとき、バトルに勝っても撃破される。 【妖魔力】これが自軍エリアにある間、相手は次の制限を受ける⇒自分自身のコマンドゾーンにOTまたはETのカードをリリース状態で置いたとき、そのカードをホールドする。";

  it("SR-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-578）", () => {
    expectCatalogText("SR-004", TEXT);
    expectUnitStats("SR-004", { name: "ヘドリアン女王", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 3, features: ["女王", "ベーダー一族", "女", "メカ", "2nd"] });
    expectRarityIn("SR-004", ["SC"]);
  });

  it("SR-004: ※ 敵軍ターン中、「SP1」のユニット（BP1000）にアタックされてバトルに勝っても撃破される（出典: atwiki/page-578「敵軍ターン中、「SP1」以上のユニットとバトルしたとき、バトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("SR-004", "hq")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-E1000:e", "SR-004:hq", "player2"));
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "SR-004:hq")).toBe("discard");
  });

  it("SR-004: ※ SP を持たないユニットとのバトルに勝ったときは撃破されない（出典: atwiki/page-578「「SP1」以上のユニットと」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("SR-004", "hq")] }, { battle: [inst("SPEC-E1000-NS", "e")] }), "SPEC-E1000-NS:e", "SR-004:hq", "player2"));
    expect(zoneOf(s, "player1", "SR-004:hq")).toBe("battle");
  });

  it("SR-004: ※ 自軍ターン中に SP1 のユニットとバトルして勝ったときは撃破されない（出典: atwiki/page-578「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("SR-004", "hq")] }, { battle: [inst("SPEC-E1000", "e")] }), "SR-004:hq", "SPEC-E1000:e"));
    expect(zoneOf(s, "player2", "SPEC-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "SR-004:hq")).toBe("battle");
  });

  /** 相手（player2）のチャージフェイズに、手札のカードをコマンドゾーンに置く。SR-004 は自軍（player1）ラッシュエリア。 */
  const charge = (cardId: string, withQueen = true) => {
    const s = st(
      {
        phase: "charge",
        activePlayer: "player2",
        player1: { rush: withQueen ? [inst("SR-004", "hq")] : [], deck: deckCards(3) },
        player2: { hand: [inst(cardId, "ch")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    return resolveAll(act(s, { type: "charge_command", playerId: "player2", instanceId: `${cardId}:ch` }));
  };
  const heldIn = (s: GameState, id: string) => s.players.player2.command.find((c) => c.instanceId === id)?.commandHeld === true;

  it("SR-004: 【妖魔力】相手がコマンドゾーンに OT・ET のカードをリリース状態で置くと、そのカードはホールドされる（出典: atwiki/page-578「自分自身のコマンドゾーンにOTまたはETのカードをリリース状態で置いたとき、そのカードをホールドする」・grnrngr/faq-card-6 SR-004 Q）", () => {
    expect(heldIn(charge("TST-OP-OT"), "TST-OP-OT:ch")).toBe(true);
    expect(heldIn(charge("TST-OP-ET"), "TST-OP-ET:ch")).toBe(true);
  });

  it("SR-004: 【妖魔力】OT・ET 以外（WB）のカードはリリース状態のまま。SR-004 がなければ OT もリリース状態のまま（出典: atwiki/page-578「OTまたはETのカード」「これが自軍エリアにある間」）", () => {
    expect(heldIn(charge("TST-OP"), "TST-OP:ch")).toBe(false);
    expect(heldIn(charge("TST-OP-OT", false), "TST-OP-OT:ch")).toBe(false);
  });

  it("SR-004: 【妖魔力】制限を受けるのは相手だけ — 自分が置く OT のカードはリリース状態のまま（出典: atwiki/page-578「相手は次の制限を受ける」）", () => {
    let s = st({ phase: "charge", player1: { rush: [inst("SR-004", "hq")], hand: [inst("TST-OP-OT", "ch")], deck: deckCards(3) } }, EXTRA);
    s = resolveAll(act(s, { type: "charge_command", playerId: "player1", instanceId: "TST-OP-OT:ch" }));
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP-OT:ch")?.commandHeld).not.toBe(true);
  });
});

// ===========================================================================
describe("SR-005 デカレッドバトライザー", () => {
  const TEXT =
    "合体―デカレッド＋マーフィーK9 ※これはアタックされるとき、BP+5000される。 【バトライズファイヤードライブ】これをラッシュしたとき、自軍パワーゾーンからカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、撃破する。";

  it("SR-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-564）", () => {
    expectCatalogText("SR-005", TEXT);
    expectUnitStats("SR-005", { name: "デカレッドバトライザー", category: "OT", size: "S", bp: 3000, sp: 1, powerCost: "5+", features: ["レッド", "男", "警察", "バトライザー"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("SR-005", ["SC"]);
  });

  const rushBr = (p2: P2 = {}) => {
    const s = rushPhase(
      { hand: [inst("SR-005", "br")], rush: [inst("RS-106", "dr"), inst("RS-404", "k9")], command: releasedCat("OT", 1), power: [inst("TST-OP-ET", "pw1"), ...powerCards(5)] },
      p2,
    );
    const r = rushFromHand(s, "player1", "SR-005:br");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("SR-005: 追加条件 — デカレッド（RS-106）とマーフィーK9（RS-404）を捨札にしてラッシュできる（出典: atwiki/page-564「合体―デカレッド＋マーフィーK9」「自軍合体ユニットを捨札にする」）", () => {
    const s = rushBr();
    expect(zoneOf(s, "player1", "SR-005:br")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-106:dr")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-404:k9")).toBe("discard");
  });

  it("SR-005: 追加条件 — マーフィーK9 がいなければラッシュできない（出典: atwiki/page-564「合体―デカレッド＋マーフィーK9」）", () => {
    expect(canStartRush(rushPhase({ hand: [inst("SR-005", "br")], rush: [inst("RS-106", "dr")], command: releasedCat("OT", 1), power: powerCards(6) }), "player1", "SR-005:br")).toBe(false);
  });

  it("SR-005: ※ アタックされるとき BP+5000（8000 で BP7000 のアタックに勝つ）（出典: atwiki/page-564「※これはアタックされるとき、BP+5000される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("SR-005", "br")] }, { battle: [inst("SPEC-E7000", "e")] }), "SPEC-E7000:e", "SR-005:br", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(8000);
    expect(zoneOf(s, "player1", "SR-005:br")).toBe("battle");
  });

  it("SR-005: ※ アタックするときは BP3000 のまま（出典: atwiki/page-564「アタックされるとき」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("SR-005", "br")] }, { battle: [inst("SPEC-E1000-NS", "e")] }), "SR-005:br", "SPEC-E1000-NS:e"));
    expect(lastBattleBps(s)?.attacker).toBe(3000);
  });

  it("SR-005: 【バトライズファイヤードライブ】ラッシュしたとき、自軍パワーゾーンのカードを1枚捨札にするかを選べる（任意）（出典: atwiki/page-564「自軍パワーゾーンからカードを1枚選び捨札にしてもよい」）", () => {
    const s = settle(rushBr({ battle: [inst("SPEC-C1", "e1")] }));
    expectChoiceFrom(s, "player1", "SR-005");
    expect(choiceIds(s)).toContain("TST-OP-ET:pw1");
    expect(canSkip(s)).toBe(true);
  });

  it("SR-005: 【バトライズファイヤードライブ】必要パワー1のカードを捨札にすると、必要パワー1の敵軍 S ユニットだけを選んで撃破する（出典: atwiki/page-564「捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、撃破する」）", () => {
    let s = pick(settle(rushBr({ battle: [inst("SPEC-C1", "e1"), inst("SPEC-C2", "e2")] })), "TST-OP-ET:pw1");
    expectChoiceFrom(s, "player1", "SR-005");
    expect(choiceIds(s)).toEqual(["SPEC-C1:e1"]);
    s = resolveAll(pick(s, "SPEC-C1:e1"));
    expect(zoneOf(s, "player1", "TST-OP-ET:pw1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("battle");
  });
});

// ===========================================================================
describe("SR-006 シュリケンジャーFM", () => {
  const TEXT =
    "【超忍法・分身魔球】これが自軍エリアにある間、自軍山札の上のカードが1枚オモテになるたび、オモテにしたカードを効果の対象にする前に次の効果を発動できる⇒オモテにしたカードを手札に加える。そして、自分の手札からカードを1枚選び相手に見せ、オモテにしたカードのかわりに効果の対象にする。";

  it("SR-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-811）", () => {
    expectCatalogText("SR-006", TEXT);
    expectUnitStats("SR-006", { name: "シュリケンジャーFM", category: "MA", size: "S", bp: 4500, sp: 1, powerCost: "7-", features: ["グリーン", "男", "忍者"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("SR-006", ["SC"]);
  });

  zordDownTests("SR-006", "RS-483", "シュリケンジャー", "atwiki/page-811「自軍「シュリケンジャー」1体を捨札にすれば必要パワー0になる」", "MA");

  /** RS-367 ゾロー兵【軍隊アリの遺伝子】で山札の上（TST-OP）をオモテにする。手札にもう1枚のゾロー兵。 */
  const zoro = () => {
    const s = rushPhase({ hand: [inst("RS-367", "z1"), inst("RS-367", "z2")], rush: [inst("SR-006", "fm")], deck: [inst("TST-OP", "top"), ...deckCards(3)], power: powerCards(1), command: releasedCat("DA", 1) });
    const r = rushFromHand(s, "player1", "RS-367:z1");
    expect(r.ok, r.error).toBe(true);
    let t = r.state;
    if (t.pendingEffectChoice?.sourceCardId === "RS-367" && t.pendingEffectChoice.validInstanceIds.includes("reveal_top")) t = pick(t, "reveal_top");
    return settle(t);
  };

  it("SR-006: 【超忍法・分身魔球】自軍山札の上がオモテになったとき（RS-367 ゾロー兵）、オモテのカードを手札に加え、手札のカードを1枚かわりに効果の対象にするかを選べる（出典: atwiki/page-811「オモテにしたカードを効果の対象にする前に次の効果を発動できる」）", () => {
    expectChoiceFrom(zoro(), "player1", "SR-006");
  });

  it("SR-006: 【超忍法・分身魔球】オモテのカード（TST-OP）は手札に加わり、手札から見せたゾロー兵が効果の対象になってラッシュエリアに出る（出典: atwiki/page-811「オモテにしたカードを手札に加える。そして、自分の手札からカードを1枚選び相手に見せ、オモテにしたカードのかわりに効果の対象にする」・RS-367「オモテにしたカードが「ゾロー兵」なら自軍ラッシュエリアに出し」）", () => {
    const s = resolveAll(zoro(), ["RS-367:z2"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-367:z2")).toBe("rush");
  });

  it("SR-006: 【超忍法・分身魔球】SR-006 が自軍エリアになければ、オモテのカード（ゾロー兵でない）はそのまま捨札になる（出典: atwiki/page-811「これが自軍エリアにある間」・RS-367「それ以外なら捨札にする」）", () => {
    const s0 = rushPhase({ hand: [inst("RS-367", "z1"), inst("RS-367", "z2")], deck: [inst("TST-OP", "top"), ...deckCards(3)], power: powerCards(1), command: releasedCat("DA", 1) });
    const r = rushFromHand(s0, "player1", "RS-367:z1");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state, ["reveal_top"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-367:z2")).toBe("hand");
  });

  it.todo("SR-006: 公式Q&A — オモテになった XG5-085 グランナスカの【ワープ】を先に発動すると、そのあと【超忍法・分身魔球】は使えない（出典: atwiki/page-811 Q1「【ワープ】の効果を発動した時点で…タイミングが過ぎている」）— 【超忍法・分身魔球】が未実装で、オモテにしたカード自身の効果と順番を比べる場面を作れない");
});

// ===========================================================================
describe("SR-007 大神龍", () => {
  const TEXT =
    "※これはアタックすることができない。 【プラズマ衝撃波】これが自軍エリアにある間、自分も相手も次のようにする⇒自分自身のスタートフェイズ中、バトルエリアのユニットをラッシュエリアに戻せない。そのかわりに、自分自身のバトルエリアのユニットを好きな数選び撃破できる。このスタートフェイズを終えるとき、自分自身のバトルエリアに「大神龍」以外のユニットが1体もなければ、これを持ち主の山札に戻してシャッフルする。";

  it("SR-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-1235）", () => {
    expectCatalogText("SR-007", TEXT);
    expectUnitStats("SR-007", { name: "大神龍", category: "MA", size: "XL", bp: 30000, sp: undefined, powerCost: "5+", features: ["ドラゴン"], rushCondition: "state_gate" });
    expectRarityIn("SR-007", ["SC"]);
  });

  it("SR-007: 追加条件 — 場のユニットが7体以上（敵味方の合計）ならラッシュでき、6体ではラッシュできない（出典: atwiki/page-1235「ユニットが7体以上ある」）", () => {
    const mk = (mine: number, theirs: number) =>
      rushPhase({ hand: [inst("SR-007", "d")], rush: fill(mine), command: releasedCat("MA", 2), power: powerCards(5) }, { battle: fill(theirs, "e") });
    expect(canStartRush(mk(3, 3), "player1", "SR-007:d")).toBe(false);
    const r = rushFromHand(mk(4, 3), "player1", "SR-007:d");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "SR-007:d")).toBe("rush");
  });

  it("SR-007: ※ アタックすることができない（バトルエリアに出ても、アタックできる敵軍ユニットがない）（出典: atwiki/page-1235「※これはアタックすることができない」）", () => {
    const s = enter(board({ rush: [inst("SR-007", "d")] }, { battle: [inst("SPEC-E1000", "e")] }), "SR-007:d");
    expect(attackTargets(s, "SR-007:d")).toEqual([]);
  });

  /** player2 のターンを終えて player1 のスタートフェイズにする。 */
  const startOf = (p1: P1, p2: P2 = {}) => endTurn(st({ activePlayer: "player2", phase: "battle", player1: { deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA));
  const canReturn = (s: GameState, playerId: "player1" | "player2" = "player1") => legal(s).some((a) => a.type === "return_all_battle_to_rush" && a.playerId === playerId);

  it("SR-007: 【プラズマ衝撃波】これが自軍エリアにあると、自軍スタートフェイズにバトルエリアのユニットをラッシュエリアに戻せない（出典: atwiki/page-1235「自分自身のスタートフェイズ中、バトルエリアのユニットをラッシュエリアに戻せない」）", () => {
    expect(canReturn(startOf({ battle: [inst("TST-UNIT-0", "b")] }))).toBe(true);
    expect(canReturn(startOf({ rush: [inst("SR-007", "d")], battle: [inst("TST-UNIT-0", "b")] }))).toBe(false);
  });

  it("SR-007: 【プラズマ衝撃波】相手も同じ — 敵軍スタートフェイズに、敵軍はバトルエリアのユニットを戻せない（出典: atwiki/page-1235「自分も相手も次のようにする」）", () => {
    const s = endTurn(st({ phase: "battle", player1: { rush: [inst("SR-007", "d")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") } }, EXTRA));
    expect(s.activePlayer).toBe("player2");
    expect(canReturn(s, "player2")).toBe(false);
  });

  it("SR-007: 【プラズマ衝撃波】そのかわりに、自軍スタートフェイズに自軍バトルエリアのユニットを好きな数選び撃破できる（出典: atwiki/page-1235「そのかわりに、自分自身のバトルエリアのユニットを好きな数選び撃破できる」）", () => {
    const s = startOf({ rush: [inst("SR-007", "d")], battle: [inst("TST-UNIT-0", "b")] });
    const offered = s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:b") || legal(s).some((a) => a.type !== "concede" && JSON.stringify(a).includes("TST-UNIT-0:b"));
    expect(offered).toBe(true);
  });

  it("SR-007: 【プラズマ衝撃波】スタートフェイズを終えるとき、自軍バトルエリアに大神龍以外のユニットがいなければ、大神龍は持ち主の山札に戻る（出典: atwiki/page-1235「自分自身のバトルエリアに「大神龍」以外のユニットが1体もなければ、これを持ち主の山札に戻してシャッフルする」）", () => {
    let s = startOf({ rush: [inst("SR-007", "d")] });
    const draw = legal(s).find((a) => a.type === "draw");
    if (draw) s = act(s, draw);
    s = resolveAll(s);
    expect(s.phase).not.toBe("start");
    expect(zoneOf(s, "player1", "SR-007:d")).toBe("deck");
  });

  it("SR-007: 【プラズマ衝撃波】バトルエリアにほかのユニットが残っていれば、大神龍は山札に戻らない（出典: atwiki/page-1235「1体もなければ」）", () => {
    let s = startOf({ rush: [inst("SR-007", "d")], battle: [inst("TST-UNIT-0", "b")] });
    for (let i = 0; i < 4 && s.phase === "start"; i++) {
      if (s.pendingEffectChoice) s = resolveAll(s);
      const draw = legal(s).find((a) => a.type === "draw");
      if (!draw) break;
      s = act(s, draw);
    }
    expect(zoneOf(s, "player1", "SR-007:d")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("battle");
  });

  /** スタートフェイズから自軍バトルフェイズまで進める（ドロー・チャージ・ラッシュは何もしない）。 */
  const toOwnBattle = (s0: GameState): GameState => {
    let s = s0;
    for (let i = 0; i < 20 && !(s.phase === "battle" && s.activePlayer === "player1"); i++) {
      if (s.pendingEffectChoice) {
        s = resolveAll(s);
        continue;
      }
      const L = legal(s);
      const a = L.find((x) => x.type === "draw") ?? L.find((x) => x.type === "skip_bonus_draw") ?? L.find((x) => x.type === "release_start_commands") ?? L.find((x) => x.type === "end_phase");
      if (!a) break;
      s = act(s, a);
    }
    return s;
  };

  it("SR-007: 公式Q&A — 【プラズマ衝撃波】で残った RS-224 トータスハンマーの次に MA の L ユニットを出すと、トータスハンマーからコンビネーションして【ロックドバスター】で SP+1 される（出典: atwiki/page-1235 Q1「効果が発動し、コンビネーションしたユニットはSP＋1されます」）", () => {
    const MA_L = sUnit("SPEC-MA-L", { category: "MA", size: "L", bp: 9000, sp: 1 });
    let s = toOwnBattle(
      endTurn(
        st(
          { activePlayer: "player2", phase: "battle", player1: { rush: [inst("SR-007", "d"), inst("SPEC-MA-L", "l")], battle: [inst("RS-224", "th")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } },
          [...EXTRA, MA_L],
        ),
      ),
    );
    expect(s.phase).toBe("battle");
    expect(zoneOf(s, "player1", "RS-224:th")).toBe("battle");
    s = enter(s, "SPEC-MA-L:l");
    expect(spOf(s, "player1", "SPEC-MA-L:l")).toBe(2);
  });

  it("SR-007: 公式Q&A — 【プラズマ衝撃波】でバトルエリアに残ったユニットは、そのバトルフェイズにアタックもストライクもできない（出典: atwiki/page-1235 Q2「いいえ、それはできません」）", () => {
    const s = toOwnBattle(startOf({ rush: [inst("SR-007", "d")], battle: [inst("SPEC-E1000", "b")] }, { battle: [inst("SPEC-E1000-NS", "e")] }));
    expect(s.phase).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-E1000:b")).toBe("battle");
    expect(attackTargets(s, "SPEC-E1000:b")).toEqual([]);
    expect(canStrike(s, "SPEC-E1000:b")).toBe(false);
  });
});

// ===========================================================================
describe("SR-008 ビッグワン", () => {
  const TEXT =
    "【ビッグ・バトン】これは、自軍コマンドゾーンにあるカードの特徴を見て、それぞれの特徴ごとに次の能力を得る⇒特徴「レッド」があればレジストを得る。特徴「ブルー」があればタクスETを得る。特徴「グリーン」があればBP7000になる。特徴「ピンク」があればSP1になる。";

  it("SR-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-1524）", () => {
    expectCatalogText("SR-008", TEXT);
    expectUnitStats("SR-008", { name: "ビッグワン", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 5, features: ["メカ", "ホワイト", "男"] });
    expectRarityIn("SR-008", ["SC"]);
  });

  const field = (command: CardInstance[]) => board({ battle: [inst("SR-008", "b1")], command });

  it("SR-008: 特徴「グリーン」のカードが自軍コマンドゾーンにあれば BP7000 になる。なければ 4000 のまま（出典: atwiki/page-1524「特徴「グリーン」があればBP7000になる」）", () => {
    expect(bpOf(field([inst("SPEC-F-GREEN", "c")]), "player1", "SR-008:b1")).toBe(7000);
    expect(bpOf(field([inst("SPEC-F-NONE", "c")]), "player1", "SR-008:b1")).toBe(4000);
  });

  it("SR-008: 特徴「ピンク」のカードがあれば「SP1」になる。なければ SP はない（出典: atwiki/page-1524「特徴「ピンク」があればSP1になる」・「SP：！」）", () => {
    expect(spOf(field([inst("SPEC-F-PINK", "c")]), "player1", "SR-008:b1")).toBe(1);
    expect(spOf(field([inst("SPEC-F-NONE", "c")]), "player1", "SR-008:b1")).toBe(0);
  });

  it("SR-008: 特徴「レッド」のカードがあればレジストを得る（バトルで撃破されたときホールドして留められる）。なければ得ない（出典: atwiki/page-1524「特徴「レッド」があればレジストを得る」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("SR-008", "b1")], command: [inst("SPEC-F-RED", "c")] }, "SR-008:b1", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
    expect(registerOffered(attackUntilRegister({ battle: [inst("SR-008", "b1")], command: [inst("SPEC-F-NONE", "c")] }, "SR-008:b1", {}, "TST-UNIT-7:atk", EXTRA))).toBe(false);
  });

  it("SR-008: 特徴「ブルー」のカードがあればタクスET を得る — これが4番目に並ぶと、5番目に出た ET の S ユニット（SP なし）が「SP1」になる（出典: atwiki/page-1524「特徴「ブルー」があればタクスETを得る」・R-KW-TAKUS-01「ETなら4」）", () => {
    const s = enter(board({ battle: [...fill(3), inst("SR-008", "b1")], rush: [inst("SPEC-ET-NOSP", "x")], command: [inst("SPEC-F-BLUE", "c")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-ET-NOSP:x");
    expect(canStrike(s, "SPEC-ET-NOSP:x")).toBe(true);
  });

  it("SR-008: 特徴「ブルー」がなければタクスET はない（5番目の ET ユニットは SP を持たない）（出典: atwiki/page-1524）", () => {
    const s = enter(board({ battle: [...fill(3), inst("SR-008", "b1")], rush: [inst("SPEC-ET-NOSP", "x")], command: [inst("SPEC-F-NONE", "c")] }, { battle: [inst("SPEC-E1000", "e")] }), "SPEC-ET-NOSP:x");
    expect(canStrike(s, "SPEC-ET-NOSP:x")).toBe(false);
  });

  it("SR-008: 特徴を3つ持つ RS-300 ワンパー1枚で、グリーン（BP7000）とピンク（SP1）の能力を同時に得る（レッドのレジストは得ない）（出典: atwiki/page-1524 カード評価「ワンパーを1枚コマンドゾーンに置くだけで特徴「レッド」以外の全ての恩恵を受けることが出来る」）", () => {
    const s = field([inst("RS-300", "c")]);
    expect(bpOf(s, "player1", "SR-008:b1")).toBe(7000);
    expect(spOf(s, "player1", "SR-008:b1")).toBe(1);
  });
});
