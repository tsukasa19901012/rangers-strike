/**
 * カード別スペック: XG3-091〜XG3-097（クロスギャザー ザ・Wインパクト ジースタッグ〜キャプテントンボーグ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. 公式FAQ・エラッタ: grnrngr の公式FAQ・docs/rules/08-errata.md に本範囲のカードの項はない。
 *     atwiki 転載の公式 Q&A: XG3-097 Q1・Q2（page-1949。XG-045 イカファイア【墨攻撃】との順番。テストはしていない）。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md）
 *  3. docs/rules/*.md の一般ルール（RC・NC・ゾードダウン R-ADD-02）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  endTurnKeep,
  enter,
  expectCatalogText,
  expectRarityIn,
  expectUnitStats,
  heldUnit,
  inst,
  lastBattleBps,
  lineUp,
  PLAIN_VEHICLE,
  powerCards,
  rcEnter,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  st,
  sUnit,
  zordDownTests,
  zoneOf,
} from "./XG3-084-103.helpers";

const INS = sUnit("SPEC-INS", { category: "MA", bp: 1000, features: ["昆虫"] });
const BP5 = sUnit("SPEC-BP5", { bp: 5000 });
const L5 = sUnit("SPEC-L5", { bp: 5000, size: "L" });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3M = sUnit("SPEC-C3M", { bp: 3000, powerCost: 3, size: "M" });
const MECHA = sUnit("SPEC-MECHA", { bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { bp: 3000, size: "M", features: ["メカ"] });
/** キャプテンルーレット用: アタック側（必要パワー5・特徴2つ・BP1000）とアタックされる側（必要パワー2・特徴1つ・BP5000）。 */
const ROU_A = sUnit("SPEC-ROU-A", { bp: 1000, powerCost: 5, features: ["メカ", "男"] });
const ROU_D = sUnit("SPEC-ROU-D", { bp: 5000, powerCost: 2, features: ["メカ"] });
const EXTRA = [INS, BP5, L5, C2, C3, C3M, MECHA, MECHA_M, ROU_A, ROU_D, PLAIN_VEHICLE];

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;
const board = (p1: P1 = {}, p2: P2 = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: P1 = {}, p2: P2 = {}) => st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const rc = (rider: string, p1: P1 = {}, p2: P2 = {}) => rcEnter(rider, p1, p2, EXTRA);
const line = (ids: string[], p1: P1 = {}, p2: P2 = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-091 ジースタッグ", () => {
  it("XG3-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-1944「BP：4000」「SP：－」「CN：RC」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-091",
      "【パルセイバー】これが敵軍ユニットにアタックするとき、バトルの前にバトル相手のユニットのBPを-2000してもよい。（BP0以下になったユニットは撃破される）（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）",
    );
    expectUnitStats("XG3-091", { name: "ジースタッグ", category: ["WB", "ET"], size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: "RC", features: ["メカ", "昆虫", "グリーン", "男"] });
    expectRarityIn("XG3-091", ["N"]);
  });

  it.fails("XG3-091:【パルセイバー】— RC したこれが BP5000 の敵軍ユニットにアタックするとき、バトルの前に BP-2000（3000）でき、バトルに勝つ（既知の不具合: CARD-XG3-091 BP が下がらない）（出典: atwiki/page-1944「バトルの前にバトル相手のユニットのBPを-2000してもよい」・コメント欄「ＢＰ5500までのユニットに殴り勝てる」）", () => {
    let s = resolveAll(rc("XG3-091:gs", {}, { battle: [inst("SPEC-BP5", "b5")] }));
    s = resolveAll(settle(attack(s, "XG3-091:gs", "SPEC-BP5:b5")), ["SPEC-BP5:b5"]);
    expect(lastBattleBps(s)?.defender).toBe(3000);
    expect(zoneOf(s, "player2", "SPEC-BP5:b5")).toBe("discard");
    expect(zoneOf(s, "player1", "XG3-091:gs")).toBe("battle");
  });

  it.fails("XG3-091:【パルセイバー】— BP0 以下になったユニット（BP1000）はバトルの前に撃破される（既知の不具合: CARD-XG3-091）（出典: atwiki/page-1944「（BP0以下になったユニットは撃破される）」）", () => {
    let s = resolveAll(rc("XG3-091:gs", {}, { battle: [inst("TST-UNIT-0", "x")] }));
    s = resolveAll(settle(attack(s, "XG3-091:gs", "TST-UNIT-0:x")), ["TST-UNIT-0:x"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
    expect(lastBattleBps(s)).toBeNull();
  });

  it.fails("XG3-091:【パルセイバー】— 特徴「昆虫」を持つユニット（SPEC-INS）からコンビネーションすれば、RC でなくても BP-2000 できる（既知の不具合: CARD-XG3-091）（出典: atwiki/page-1944「この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する」）", () => {
    const s = resolveAll(settle(attack(line(["SPEC-INS:i", "XG3-091:gs"], {}, { battle: [inst("SPEC-BP5", "b5")] }), "XG3-091:gs", "SPEC-BP5:b5")), ["SPEC-BP5:b5"]);
    expect(lastBattleBps(s)?.defender).toBe(3000);
  });

  it("XG3-091:【パルセイバー】— RC でも「昆虫」からのコンビネーションでもなければ BP は下がらない（BP4000 で BP5000 に負ける）（出典: atwiki/page-1944「（CN：RC）」）", () => {
    const s = resolveAll(settle(attack(line(["TST-UNIT-0:u", "XG3-091:gs"], {}, { battle: [inst("SPEC-BP5", "b5")] }), "XG3-091:gs", "SPEC-BP5:b5")));
    expect(lastBattleBps(s)).toEqual({ attacker: 4000, defender: 5000 });
    expect(zoneOf(s, "player1", "XG3-091:gs")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-092 レッドル", () => {
  it("XG3-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-1945「BP：500」「SP：1/5」「必要パワー：0」「CN：RC」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-092",
      "【セイバーマグナム】自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールドしたコマンドの必要パワーの数字を見て、その数字と同じ必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び撃破する。（この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）",
    );
    expectUnitStats("XG3-092", { name: "レッドル", category: ["WB", "ET"], size: "S", bp: 500, sp: "1/5", powerCost: 0, comboNumber: "RC", features: ["メカ", "昆虫", "レッド", "女"] });
    expectRarityIn("XG3-092", ["N"]);
  });

  const myCommands: P1 = { command: [inst("SPEC-C2", "c2"), inst("SPEC-C3", "c3")] };
  const enemies: P2 = { battle: [inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2"), inst("SPEC-C3M", "m3")], rush: [inst("SPEC-C3", "r3")] };

  it.fails("XG3-092:【セイバーマグナム】— RC で、自軍コマンド（必要パワー3のカード）をホールドすれば、敵軍バトルエリアの必要パワー3の S ユニットを撃破する（ラッシュエリア・M は撃破しない）（既知の不具合: CARD-XG3-092 選択が開かない）（出典: atwiki/page-1945「ホールドしたコマンドの必要パワーの数字を見て、その数字と同じ必要パワーの数字を持つSユニットを敵軍バトルエリアから1体選び撃破する」）", () => {
    const s = resolveAll(rc("XG3-092:rd", myCommands, enemies), ["SPEC-C3:c3", "SPEC-C3:e3"]);
    expect(cardIn(s, "player1", "SPEC-C3:c3")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C3M:m3")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C3:r3")).toBe("rush");
  });

  it.fails("XG3-092:【セイバーマグナム】— 特徴「昆虫」を持つユニットからコンビネーションすれば、RC でなくても発動する（既知の不具合: CARD-XG3-092）（出典: atwiki/page-1945「この効果は特徴「昆虫」を持つユニットからコンビネーションするときはナンバーに関係なく発動する」）", () => {
    const s = resolveAll(line(["SPEC-INS:i", "XG3-092:rd"], myCommands, enemies), ["SPEC-C2:c2", "SPEC-C2:e2"]);
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("XG3-093 ビーファイターミン", () => {
  it("XG3-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-1946「BP：3000」「SP：－」「必要パワー：0」「CN：1」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-093", "【ソニックプレッシャー】このターン、これが敵軍Sユニットにアタックするとき、バトルの前にバトル相手のユニットをホールドしてもよい。");
    expectUnitStats("XG3-093", { name: "ビーファイターミン", category: ["WB", "ET"], size: "S", bp: 3000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["メカ", "昆虫", "男"] });
    expectRarityIn("XG3-093", ["N"]);
  });

  it("XG3-093:【ソニックプレッシャー】— 1番目に出たターン（NC1）、敵軍 S ユニットにアタックするとき、バトルの前にそのユニットをホールドできる（任意）（出典: atwiki/page-1946「バトルの前にバトル相手のユニットをホールドしてもよい」・カード評価「レジスト潰しに便利」）", () => {
    const s0 = attack(line(["XG3-093:mn"], {}, { battle: [inst("SPEC-BP5", "b5")] }), "XG3-093:mn", "SPEC-BP5:b5");
    expect(choiceIds(s0)).toEqual(["SPEC-BP5:b5"]);
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(s0, ["SPEC-BP5:b5"]);
    expect(cardIn(s, "player2", "SPEC-BP5:b5")?.commandHeld).toBe(true);
  });

  it("XG3-093:【ソニックプレッシャー】— 2番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-1946「CN：1」）", () => {
    const s = attack(line(["TST-UNIT-0:a", "XG3-093:mn"], {}, { battle: [inst("SPEC-BP5", "b5")] }), "XG3-093:mn", "SPEC-BP5:b5");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG3-093");
  });
});

// ===========================================================================
describe("XG3-094 カブタック", () => {
  it("XG3-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-1947「BP：500」「SP：－」「必要パワー：2」「レアリティ：ノーマル」）", () => {
    expectCatalogText("XG3-094", "【友情】このユニットは、これ以外の自軍バトルエリアのSユニット1体につきBP+1000される。");
    expectUnitStats("XG3-094", { name: "カブタック", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["メカ"] });
    expectRarityIn("XG3-094", ["N"]);
  });

  it.fails("XG3-094:【友情】— これ以外の自軍バトルエリアの S ユニット1体につき BP+1000（S 2体で 2500。M・ラッシュエリア・敵軍のユニットは数えない）（既知の不具合: CARD-XG3-094 BP が上がらない）（出典: atwiki/page-1947「これ以外の自軍バトルエリアのSユニット1体につきBP+1000される」）", () => {
    const s = battle(
      { battle: [inst("XG3-094", "kt"), inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-0", "r")] },
      { battle: [inst("TST-UNIT-0", "e")] },
    );
    expect(bpOf(s, "player1", "XG3-094:kt")).toBe(2500);
  });

  it("XG3-094:【友情】— ほかの自軍 S ユニットがいなければ BP500（出典: atwiki/page-1947「BP：500」）", () => {
    expect(bpOf(battle({ battle: [inst("XG3-094", "kt")] }), "player1", "XG3-094:kt")).toBe(500);
  });
});

// ===========================================================================
describe("XG3-095 カブタックSM", () => {
  it("XG3-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-2001「BP：5500」「SP：1」「必要パワー：7-」「レアリティ：スーパーレア」）", () => {
    expectCatalogText(
      "XG3-095",
      "※これが自軍エリアにある間、自分がターンを終えるとき、自軍コマンドゾーンか自軍捨札の「カブタック」のカードとこれを置き換える。置き換えられなければこれを捨札にする。 【ビリットショック】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアから、本来のBPが8000以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ敵軍コマンドを1つ選び、捨札にしてから置く。",
    );
    expectUnitStats("XG3-095", { name: "カブタックSM", category: "ET", size: "S", bp: 5500, sp: 1, powerCost: "7-", comboNumber: undefined, features: ["メカ", "人型", "スーパーモード"], rushCondition: "zord_down_send_to_command_or_discard" });
    expectRarityIn("XG3-095", ["SR"]);
  });

  zordDownTests("XG3-095", "XG3-094", "カブタック", "atwiki/page-2001「追加条件：自軍「カブタック」1体をコマンドゾーンに送るか捨札にすれば必要パワー0になる」", "ET");

  it("XG3-095: 追加条件 — 「カブタック」をコマンドゾーンに送っても必要パワー0でラッシュできる（出典: atwiki/page-2001「コマンドゾーンに送るか捨札にすれば必要パワー0になる」）", () => {
    const r = rushVia(board({ hand: [inst("XG3-095", "sm")], rush: [inst("XG3-094", "kt")], power: [], command: releasedCat("ET", 1) }), "player1", "XG3-095:sm", (a) => a.zordMaterialInstanceId === "XG3-094:kt" && a.zordMaterialDestination === "command");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG3-095:sm")).toBe("rush");
    expect(zoneOf(s, "player1", "XG3-094:kt")).toBe("command");
  });

  it.fails("XG3-095: ※ 自分がターンを終えるとき、自軍コマンドゾーンの「カブタック」と置き換える（カブタックがこれのいた場所へ、これはコマンドゾーンへ）（既知の不具合: CARD-XG3-095 置き換えない）（出典: atwiki/page-2001「自軍コマンドゾーンか自軍捨札の「カブタック」のカードとこれを置き換える」）", () => {
    const s = resolveAll(endTurnKeep(battle({ battle: [inst("XG3-095", "sm")], command: [inst("XG3-094", "kc")] })), ["XG3-094:kc"]);
    expect(zoneOf(s, "player1", "XG3-094:kc")).toBe("battle");
    expect(zoneOf(s, "player1", "XG3-095:sm")).toBe("command");
  });

  it.fails("XG3-095: ※ 置き換えられる「カブタック」がなければ、ターンを終えるときこれを捨札にする（既知の不具合: CARD-XG3-095 残ったまま）（出典: atwiki/page-2001「置き換えられなければこれを捨札にする」）", () => {
    const s = resolveAll(endTurnKeep(battle({ battle: [inst("XG3-095", "sm")] })));
    expect(zoneOf(s, "player1", "XG3-095:sm")).toBe("discard");
  });

  const entered = () =>
    enter(battle({ rush: [inst("XG3-095", "sm")] }, { battle: [inst("SPEC-BP5", "b5"), inst("SPEC-L5", "l5"), inst("TST-UNIT-7", "l")], rush: [inst("SPEC-BP5", "r5")], command: [inst("TST-OP", "ec")] }), "XG3-095:sm");

  it.fails("XG3-095:【ビリットショック】— 自軍ターン中にバトルエリアに出たとき、敵軍バトルエリアの本来の BP8000 以下のユニット（サイズを問わない）から選ぶ（BP13000・ラッシュエリアは選べない）（既知の不具合: CARD-XG3-095 BP13000 のユニットも候補になる）（出典: atwiki/page-2001「敵軍バトルエリアから、本来のBPが8000以下のユニットを1体選び」・コメント欄「サイズ無視」）", () => {
    expect(choiceIds(entered()).sort()).toEqual(["SPEC-BP5:b5", "SPEC-L5:l5"]);
  });

  it("XG3-095:【ビリットショック】— 選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-2001「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(entered(), ["SPEC-L5:l5"]);
    expect(zoneOf(s, "player2", "SPEC-L5:l5")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-L5:l5")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-OP:ec")).toBe("command");
  });
  it.fails("XG3-095:【ビリットショック】— 敵軍コマンドゾーンが5枚で置けなければ、敵軍コマンドを1つ選んで捨札にしてから置く（既知の不具合: CARD-XG3-095 敵軍コマンドを捨札にしない）（出典: atwiki/page-2001「置けなければ敵軍コマンドを1つ選び、捨札にしてから置く」・R-ZONE-08 コマンドゾーンは5枚まで）", () => {
    const full = [0, 1, 2, 3, 4].map((i) => inst("TST-OP", `ec${i}`));
    const s0 = enter(battle({ rush: [inst("XG3-095", "sm")] }, { battle: [inst("SPEC-BP5", "b5")], command: full }), "XG3-095:sm");
    const s = resolveAll(s0, ["SPEC-BP5:b5", "TST-OP:ec2"]);
    expect(zoneOf(s, "player2", "TST-OP:ec2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP5:b5")).toBe("command");
    expect(s.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("XG3-096 ミミーナ", () => {
  it("XG3-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-1948「BP：500」「SP：－」「必要パワー：2」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-096",
      "※これをラッシュしたとき、「ミミーナ」以外のリリース状態の自軍Sユニットを1体選び、可能ならホールドする。 【修理サービス】これをラッシュしたとき、自軍捨札から特徴「メカ」を持つSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く。置けなければこの効果は発動しない。",
    );
    expectUnitStats("XG3-096", { name: "ミミーナ", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("XG3-096", ["N"]);
  });

  const rushed = () => {
    const r = rushFromHand(
      board({
        hand: [inst("XG3-096", "mm")],
        rush: [inst("TST-UNIT-0", "u"), inst("XG3-096", "m2"), inst("TST-UNIT-2", "mu"), heldUnit("TST-UNIT-0", "hu")],
        discard: [inst("SPEC-MECHA", "dm"), inst("SPEC-MECHA-M", "dmm"), inst("TST-UNIT-0", "dx")],
        power: powerCards(2),
        command: releasedCat("ET", 1),
      }),
      "player1",
      "XG3-096:mm",
    );
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };

  it.fails("XG3-096: ※ ラッシュしたとき、「ミミーナ」以外のリリース状態の自軍 S ユニット（TST-UNIT-0:u だけ）を1体選んでホールドする（既知の不具合: CARD-XG3-096 ※がない）（出典: atwiki/page-1948「「ミミーナ」以外のリリース状態の自軍Sユニットを1体選び、可能ならホールドする」）", () => {
    const s = resolveAll(rushed(), ["TST-UNIT-0:u", "SPEC-MECHA:dm"]);
    expect(cardIn(s, "player1", "TST-UNIT-0:u")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "XG3-096:m2")?.commandHeld).toBeFalsy();
  });

  it.fails("XG3-096:【修理サービス】— ラッシュしたとき、自軍捨札の特徴「メカ」を持つ S ユニットのカード（M・「メカ」でないカードは選べない）を自軍コマンドゾーンにホールド状態で置く（既知の不具合: CARD-XG3-096 候補が絞られず、選んだカードが動かない）（出典: atwiki/page-1948「自軍捨札から特徴「メカ」を持つSユニットのカードを1枚選び、自軍コマンドゾーンにホールド状態で置く」）", () => {
    let s = rushed();
    for (let i = 0; i < 3 && s.pendingEffectChoice && !choiceIds(s).includes("SPEC-MECHA:dm"); i++) s = resolveAll(s, ["TST-UNIT-0:u"], 1);
    expect(choiceIds(s)).toEqual(["SPEC-MECHA:dm"]);
    s = resolveAll(s, ["SPEC-MECHA:dm"]);
    expect(zoneOf(s, "player1", "SPEC-MECHA:dm")).toBe("command");
    expect(cardIn(s, "player1", "SPEC-MECHA:dm")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("XG3-097 キャプテントンボーグ", () => {
  it("XG3-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-1949「BP：2000」「SP：－」「必要パワー：3」「レアリティ：ノーマル」）", () => {
    expectCatalogText(
      "XG3-097",
      "【キャプテンルーレット】これが自軍エリアにある間、すべてのユニットは次の能力を得る⇒同じサイズのユニットにアタックするとき、バトルの前に自分自身の山札の上から1枚をオモテにする。オモテにしたカードの必要パワーの数字が「1」か「3」か「5」なら必要パワーの数字、「2」か「4」か「6」なら特徴の数、それ以外ならBPを参照し、お互いにその数字でバトルする。その後、オモテにしたカードは山札の下に戻す。",
    );
    expectUnitStats("XG3-097", { name: "キャプテントンボーグ", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("XG3-097", ["N"]);
  });

  /** 自軍 SPEC-ROU-A（必要パワー5・特徴2・BP1000）が敵軍 SPEC-ROU-D（必要パワー2・特徴1・BP5000）にアタックする。top は自軍山札の上。 */
  const roulette = (top: string, defender = "SPEC-ROU-D:d") =>
    resolveAll(settle(attack(line(["SPEC-ROU-A:a"], { rush: [inst("XG3-097", "cp")], deck: [inst(top.split(":")[0]!, top.split(":")[1]!), ...deckCards(3)] }, { battle: [inst(defender.split(":")[0]!, defender.split(":")[1]!)] }), "SPEC-ROU-A:a", defender)));

  it.fails("XG3-097:【キャプテンルーレット】— 山札の上が必要パワー3のカードなら必要パワーの数字（5 対 2）でバトルし、アタック側が勝つ。オモテにしたカードは山札の下へ（既知の不具合: CARD-XG3-097 BP でバトルする）（出典: atwiki/page-1949「「1」か「3」か「5」なら必要パワーの数字…を参照し、お互いにその数字でバトルする。その後、オモテにしたカードは山札の下に戻す」）", () => {
    const s = roulette("SPEC-C3:top");
    expect(zoneOf(s, "player2", "SPEC-ROU-D:d")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-ROU-A:a")).toBe("battle");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-C3:top");
  });

  it.fails("XG3-097:【キャプテンルーレット】— 山札の上が必要パワー2のカードなら特徴の数（2 対 1）でバトルし、アタック側が勝つ（既知の不具合: CARD-XG3-097）（出典: atwiki/page-1949「「2」か「4」か「6」なら特徴の数」）", () => {
    const s = roulette("SPEC-C2:top");
    expect(zoneOf(s, "player2", "SPEC-ROU-D:d")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-ROU-A:a")).toBe("battle");
  });

  it("XG3-097:【キャプテンルーレット】— 山札の上が必要パワー0のカードなら BP（1000 対 5000）でバトルする（出典: atwiki/page-1949「それ以外ならBPを参照し」）", () => {
    const s = roulette("TST-UNIT-0:top");
    expect(lastBattleBps(s)).toEqual({ attacker: 1000, defender: 5000 });
    expect(zoneOf(s, "player1", "SPEC-ROU-A:a")).toBe("discard");
  });

  it("XG3-097:【キャプテンルーレット】— サイズが違うユニット（L）へのアタックでは発動せず、BP でバトルする（山札の上は動かない）（出典: atwiki/page-1949「同じサイズのユニットにアタックするとき」）", () => {
    const s = roulette("SPEC-C3:top", "SPEC-L5:l");
    expect(lastBattleBps(s)).toEqual({ attacker: 1000, defender: 5000 });
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-C3:top");
  });
});
