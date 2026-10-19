/**
 * cardSpec XG4-058〜XG4-063（オートバジンBM〜仮面ライダースカル）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-XG4-062）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  deckCards,
  enemyBoard,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  holdEnterTests,
  inst,
  lastBattleBps,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  st,
  sUnit,
  targetsOf,
  taxTests,
  wingTests,
  zoneOf,
} from "./XG4-044-063.helpers";

const OWN_S = sUnit("SPEC-OWN-S", { category: "ET", bp: 1000, sp: undefined });
const OWN_M = sUnit("SPEC-OWN-M", { category: "ET", bp: 1000, size: "M", sp: undefined });
const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { bp: 1000, size: "M", sp: undefined });
const E_ACCEL = sUnit("SPEC-E-ACCEL", { bp: 1000, sp: undefined, features: ["加速"] });
const E_1500 = sUnit("SPEC-E-1500", { bp: 1500, sp: undefined });
const E_2000 = sUnit("SPEC-E-2000", { bp: 2000, sp: undefined });
const E_5000 = sUnit("SPEC-E-5000", { bp: 5000, sp: undefined });
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 1000, sp: undefined, comboNumber: "RC" });
const EXTRA = [OWN_S, OWN_M, E_S, E_M, E_ACCEL, E_1500, E_2000, E_5000, RIDER];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-058 オートバジンBM（XG4）", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【忠実な愛機】これが自軍バトルエリアの最後に並んでいる間、これ以外の自軍Sユニットはアタックされない。";

  it("XG4-058: カタログ本文・スペックが出典と一致（出典: atwiki/page-2114）", () => {
    expectCatalogText("XG4-058", TEXT);
    expectUnit("XG4-058", { name: "オートバジンBM", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: 4, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("XG4-058", ["N"]);
  });

  holdEnterTests("XG4-058", "ET", "atwiki/page-2114");

  const attacked = (battleArea: ReturnType<typeof inst>[]) =>
    st({ activePlayer: "player2", player1: { battle: battleArea, deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }, EXTRA);

  it.fails("XG4-058:【忠実な愛機】— 自軍バトルエリアの最後に並んでいる間、これ以外の自軍 S ユニットはアタックされない（M ユニットとこれ自身はアタックされる）（出典: atwiki/page-2114「これ以外の自軍Sユニットはアタックされない」）（既知の不具合: CARD-XG4-058 【忠実な愛機】が働かず、ほかの自軍 S ユニットもアタックされる）", () => {
    expect(targetsOf(attacked([inst("SPEC-OWN-S", "b"), inst("SPEC-OWN-M", "m"), inst("XG4-058", "bm")]), "TST-UNIT-7:atk", "player2")).toEqual(["SPEC-OWN-M:m", "XG4-058:bm"]);
  });

  it("XG4-058:【忠実な愛機】— 最後に並んでいなければ守らない（出典: atwiki/page-2114「最後に並んでいる間」）", () => {
    expect(targetsOf(attacked([inst("XG4-058", "bm"), inst("SPEC-OWN-S", "b")]), "TST-UNIT-7:atk", "player2")).toContain("SPEC-OWN-S:b");
  });
});

// ===========================================================================
describe("XG4-059 オートバジンVM（XG4）", () => {
  const TEXT =
    "【自律変形】敵軍バトルフェイズ開始時、このビークルを自軍コマンドゾーンに送ってもよい。そうしたとき、自軍コマンドゾーンから「オートバジンBM」のカードを1枚選び、自軍バトルエリアの最後に出す。";

  it("XG4-059: カタログ本文・スペックが出典と一致（出典: atwiki/page-2085）", () => {
    expectCatalogText("XG4-059", TEXT);
    expectVehicle("XG4-059", { name: "オートバジンVM", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-059", ["NR"]);
  });

  /** 敵軍（player2）のラッシュフェイズを終えて、敵軍バトルフェイズを始める。 */
  const enemyBattleStart = (command: ReturnType<typeof inst>[]) =>
    settle(nextPhase(enemyBoard({ rush: [inst("XG4-059", "vm")], battle: [inst("SPEC-OWN-S", "b")], command }, {}, EXTRA, "rush")));

  it.fails("XG4-059:【自律変形】— 敵軍バトルフェイズ開始時、これを自軍コマンドゾーンに送るかを選べる（任意）（出典: atwiki/page-2085「敵軍バトルフェイズ開始時、このビークルを自軍コマンドゾーンに送ってもよい」）（既知の不具合: CARD-XG4-059 【自律変形】が敵軍バトルフェイズ開始時に働かない）", () => {
    const s = enemyBattleStart([released("XG4-058", "bm")]);
    expectChoiceFrom(s, "player1", "XG4-059");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-059:【自律変形】— 送ると、自軍コマンドゾーンの「オートバジンBM」が自軍バトルエリアの最後に出る（BM の「ホールドしなければ出られない」は BM 自身のホールドで満たせる）（出典: atwiki/page-2085「自軍コマンドゾーンから「オートバジンBM」のカードを1枚選び、自軍バトルエリアの最後に出す」・atwiki/page-2114 Q1「はい、できます」）（既知の不具合: CARD-XG4-059 【自律変形】が敵軍バトルフェイズ開始時に働かない）", () => {
    let s = enemyBattleStart([released("XG4-058", "bm")]);
    expectChoiceFrom(s, "player1", "XG4-059");
    s = settle(confirm(s));
    if (s.pendingEffectChoice?.sourceCardId === "XG4-059" && choiceIds(s).includes("XG4-058:bm")) s = settle(pick(s, "XG4-058:bm"));
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG4-059:vm")).toBe("command");
    expect(s.players.player1.battle.at(-1)?.instanceId).toBe("XG4-058:bm");
  });

  it("XG4-059: 公式Q&A — 自軍コマンドゾーンにカードが5枚あると、これを送れないので処理が中断する（BM は出ない）（出典: atwiki/page-2085 Q1「「このビークルを自軍コマンドゾーンに送ってもよい」が実行できないため、処理が中断されます」）", () => {
    let s = enemyBattleStart([released("XG4-058", "bm"), ...releasedCat("ET", 4)]);
    if (s.pendingEffectChoice?.sourceCardId === "XG4-059") s = settle(confirm(s));
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG4-059:vm")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-058:bm")).toBe("command");
  });
});

// ===========================================================================
describe("XG4-060 仮面ライダーファイズBF（XG4）", () => {
  const TEXT =
    "※ウイング 【フォトンブレイカー】これがBPの下三桁が500のユニットにアタックしてバトルに勝ったとき、追加でアタックしてもよい。（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）";

  it("XG4-060: カタログ本文・スペックが出典と一致（出典: atwiki/page-2115）", () => {
    expectCatalogText("XG4-060", TEXT);
    expectUnit("XG4-060", { name: "仮面ライダーファイズBF", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "ブラスターフォーム"] });
    expectRarityIn("XG4-060", ["NR"]);
  });

  wingTests("XG4-060", "atwiki/page-2115");

  /** ラッシュエリアでウイングを発動し、target にアタックする。 */
  const wingAttack = (target: string) => {
    const s = battle({ rush: [inst("XG4-060", "fz")] }, { battle: [inst(target, "t"), inst("SPEC-E-S", "next")], deck: deckCards(3, "e") });
    return settle(attack(act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-060:fz" }), "XG4-060:fz", `${target}:t`));
  };

  it.fails("XG4-060:【フォトンブレイカー】— ウイングで BP の下三桁が500（BP1500）のユニットにアタックして勝つと、ラッシュエリアから追加でアタックできる（出典: atwiki/page-2115「追加でアタックしてもよい」・同 Q2「【フォトンブレイカー】の効果により、追加でアタックできます」）（既知の不具合: CARD-XG4-060 【フォトンブレイカー】の追加アタックができない）", () => {
    const s = wingAttack("SPEC-E-1500");
    expect(zoneOf(s, "player2", "SPEC-E-1500:t")).toBe("discard");
    expect(targetsOf(s, "XG4-060:fz")).toContain("SPEC-E-S:next");
  });

  it("XG4-060:【フォトンブレイカー】— 下三桁が500でない（BP2000）ユニットに勝っても追加でアタックできない（出典: atwiki/page-2115「BPの下三桁が500のユニットに」）", () => {
    const s = wingAttack("SPEC-E-2000");
    expect(zoneOf(s, "player2", "SPEC-E-2000:t")).toBe("discard");
    expect(targetsOf(s, "XG4-060:fz")).toEqual([]);
  });
});

// ===========================================================================
describe("XG4-061 仮面ライダーアクセル", () => {
  const TEXT =
    "【エンジンブレード】これをラッシュしたとき、特徴「加速」を持たない敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG4-061: カタログ本文・スペックが出典と一致（出典: atwiki/page-2138）", () => {
    expectCatalogText("XG4-061", TEXT);
    expectUnit("XG4-061", { name: "仮面ライダーアクセル", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男", "アクセルドライバー"] });
    expectRarityIn("XG4-061", ["SR"]);
  });

  const rushed = (enemyCommand: ReturnType<typeof inst>[] = []) => {
    const r = rushFromHand(
      board({ hand: [inst("XG4-061", "ac")], command: releasedCat("ET", 1), power: powerCards(3) }, { battle: [inst("SPEC-E-S", "b"), inst("SPEC-E-M", "m")], rush: [inst("SPEC-E-S", "r"), inst("SPEC-E-ACCEL", "a")], command: enemyCommand }),
      "player1",
      "XG4-061:ac",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it.fails("XG4-061:【エンジンブレード】— ラッシュしたとき、「加速」を持たない敵軍 S ユニット（どのエリアでも）を1体選ぶ（M ユニット・「加速」を持つユニットは選べない。任意ではない）（出典: atwiki/page-2138「特徴「加速」を持たない敵軍Sユニットを1体選び」）（既知の不具合: CARD-XG4-061 【エンジンブレード】の候補に M ユニット・「加速」を持つユニットが入る）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-061");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:b", "SPEC-E-S:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-061:【エンジンブレード】— 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-2138「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    let s = rushed();
    expectChoiceFrom(s, "player1", "XG4-061");
    s = resolveAll(pick(s, "SPEC-E-S:b"));
    expect(zoneOf(s, "player2", "SPEC-E-S:b")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "SPEC-E-S:b")?.commandHeld).toBe(true);
  });

  it("XG4-061:【エンジンブレード】— 敵軍コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-2138「置けなければ捨札にする」）", () => {
    let s = rushed(releasedCat("WB", 5));
    expectChoiceFrom(s, "player1", "XG4-061");
    s = resolveAll(pick(s, "SPEC-E-S:b"));
    expect(zoneOf(s, "player2", "SPEC-E-S:b")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-062 仮面ライダーアクセル バイクフォーム", () => {
  // 読み替え後の本文（R-ERR-XG4-062・atwiki/page-2139 Q1）。
  const TEXT =
    "※これは、ライドされていなくてもバトルエリアに出ることができる。 【アクセルメモリ】ライドされているこのビークルがバトルエリアにある間、特徴「加速」を持たない敵軍Sユニットは次の制限を受ける⇒自分自身のコマンドを1つホールドしなければバトルエリアに出られない。";

  it("XG4-062: カタログ本文（読み替え後）・スペックが出典と一致（出典: atwiki/page-2139・R-ERR-XG4-062）", () => {
    expectCatalogText("XG4-062", TEXT);
    expectVehicle("XG4-062", { name: "仮面ライダーアクセル バイクフォーム", category: "ET", powerCost: "4+", size: "S", features: ["仮面ライダー", "男", "車両", "アクセルドライバー"] });
    expectRarityIn("XG4-062", ["R"]);
  });

  it("XG4-062: 追加条件 — 自軍「仮面ライダーアクセル」1体をコマンドゾーンに送るか捨札にしてラッシュできる（出典: atwiki/page-2139「追加条件：自軍「仮面ライダーアクセル」1体をコマンドゾーンに送るか捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG4-062", "bf")], rush: [inst("XG4-061", "ac")], command: releasedCat("ET", 1), power: powerCards(4) }), "player1", "XG4-062:bf");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG4-062:bf")).toBe("rush");
    expect(["command", "discard"]).toContain(zoneOf(s, "player1", "XG4-061:ac"));
  });

  it("XG4-062: 追加条件 — 「仮面ライダーアクセル」がいなければラッシュできない（出典: atwiki/page-2139）", () => {
    expect(canStartRush(board({ hand: [inst("XG4-062", "bf")], command: releasedCat("ET", 1), power: powerCards(4) }), "player1", "XG4-062:bf")).toBe(false);
  });

  it.fails("XG4-062: ※ — ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-2139「これは、ライドされていなくてもバトルエリアに出ることができる」）（既知の不具合: CARD-XG4-062 ライドされていないビークルがバトルエリアに出られない）", () => {
    const s0 = battle({ rush: [inst("XG4-062", "bf")] });
    expect(canEnter(s0, "XG4-062:bf")).toBe(true);
    expect(zoneOf(settle(enter(s0, "XG4-062:bf")), "player1", "XG4-062:bf")).toBe("battle");
  });

  /** 敵軍（player2）バトルフェイズ。自軍バトルエリアにこれ（ライドされているか）。 */
  const guarded = (ridden: boolean, enemyCommand: ReturnType<typeof inst>[]) =>
    enemyBoard(
      { battle: ridden ? ridingPair("SPEC-RIDER", "r", "XG4-062", "bf") : [inst("XG4-062", "bf")] },
      { rush: [inst("SPEC-E-S", "e"), inst("SPEC-E-ACCEL", "a"), inst("SPEC-E-M", "m")], command: enemyCommand },
      EXTRA,
    );

  it("XG4-062:【アクセルメモリ】— ライドされてバトルエリアにある間、「加速」を持たない敵軍 S ユニットは、自分自身のコマンドをホールドできなければバトルエリアに出られない（「加速」を持つ S ユニット・M ユニットは出られる）（出典: R-ERR-XG4-062「自分自身のコマンドを1つホールドしなければバトルエリアに出られない」・atwiki/page-2139 Q1）", () => {
    const s = guarded(true, []);
    expect(canEnter(s, "SPEC-E-S:e", "player2")).toBe(false);
    expect(canEnter(s, "SPEC-E-ACCEL:a", "player2")).toBe(true);
    expect(canEnter(s, "SPEC-E-M:m", "player2")).toBe(true);
  });

  it("XG4-062:【アクセルメモリ】— 敵軍は自分自身のコマンドを1つホールドしてバトルエリアに出られる（出典: R-ERR-XG4-062）", () => {
    const s = guarded(true, releasedCat("WB", 1));
    expect(canEnter(s, "SPEC-E-S:e", "player2")).toBe(true);
    expect(s.players.player2.command).toHaveLength(1);
  });

  it("XG4-062:【アクセルメモリ】— ライドされていなければ制限はない（出典: atwiki/page-2139「ライドされているこのビークルが」）", () => {
    expect(canEnter(guarded(false, []), "SPEC-E-S:e", "player2")).toBe(true);
  });
});

// ===========================================================================
describe("XG4-063 仮面ライダースカル", () => {
  const TEXT = "※タクスET 【お前の罪を数えろ】これは自軍捨札にSユニットのカードが5枚以上あるとき、次の効果を得る⇒アタックするときBP+3000される。";

  it("XG4-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-2124）", () => {
    expectCatalogText("XG4-063", TEXT);
    expectUnit("XG4-063", { name: "仮面ライダースカル", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["仮面ライダー", "男", "ロストドライバー"] });
    expectRarityIn("XG4-063", ["R"]);
  });

  taxTests("XG4-063", "ET", "atwiki/page-2124");

  const attacked = (n: number) =>
    settle(
      attack(
        battle({ battle: [inst("XG4-063", "sk")], discard: Array.from({ length: n }, (_, i) => inst("SPEC-OWN-S", `d${i}`)) }, { battle: [inst("SPEC-E-5000", "t")], deck: deckCards(3, "e") }),
        "XG4-063:sk",
        "SPEC-E-5000:t",
      ),
    );

  it.fails("XG4-063:【お前の罪を数えろ】— 自軍捨札に S ユニットのカードが5枚以上あれば、アタックするとき BP+3000（BP6000 で BP5000 に勝つ）（出典: atwiki/page-2124「アタックするときBP+3000される」）（既知の不具合: CARD-XG4-063 【お前の罪を数えろ】の BP+3000 が働かない）", () => {
    const s = attacked(5);
    expect(lastBattleBps(s)?.attacker).toBe(6000);
    expect(zoneOf(s, "player2", "SPEC-E-5000:t")).toBe("discard");
  });

  it("XG4-063:【お前の罪を数えろ】— 4枚なら BP は上がらない（出典: atwiki/page-2124「5枚以上あるとき」）", () => {
    expect(lastBattleBps(attacked(4))?.attacker).toBe(3000);
  });
});
