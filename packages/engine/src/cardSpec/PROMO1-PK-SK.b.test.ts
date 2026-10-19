/**
 * カード別スペック: PK-008〜PK-014（プロモーションカード ライダーマン〜仮面ライダーキバEF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「PK-」とカード名で検索:
 *     PK の項はない。同じ本文のカードの項は rider_1 RK-074 Q1・rider_2 SK-002 Q1・Q2・rider_3「RK-240 クライマックス刑事」（RK-242 の誤記）。
 *     atwiki に転載された公式 Q&A: atwiki/page-762 RK-242 Q1（RK-242 と PK-011 を2枚同時に常駐させたとき。2010/10/25修正）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAG-01・R-KW-RC-01・R-KW-RESIST・R-ADD-02 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PK-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションカード」を PR として照合する。
 *
 * 公式どうしの食い違い（ユーザー決定済み）:
 *  - RK-242 Q1（atwiki/page-762「同名のタッグ…を２枚同時に常駐させていれば、両方の効果をそれぞれ発動することができます。(2010/10/25修正)」）と
 *    grnrngr/faq-rider-3「１度だけしか発動することはできません」。ユーザー決定（2026-10-19。README §5.7 i）で atwiki の修正後を採る。
 *    Q1 の例そのもの（RK-242 と PK-011）を PK-011 で確かめる。
 *
 * 本範囲のカードは元のカード（RK-074・SK-002・RK-239・RK-242・RK-333・RK-252・RK-314）と同じ本文か、言い回しだけが違う再録。
 * 元のカードの照合と同じ内容を PK の ID で確かめ直す。元のカードの公式 Q&A の盤面（RK-239 Q1 など）は元のカードの照合で済んでいるので重ねない。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  accept,
  act,
  activateResident,
  attackUntilRegister,
  attackersOf,
  battleBoard,
  canActivateResident,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enemyBattle,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  featuresOf,
  heldUnit,
  inst,
  legal,
  nextPhase,
  pick,
  played,
  powerCards,
  rcRideOff,
  reanimateTests,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushBoardWith,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  v3Tests,
  zeroCostTests,
  zoneOf,
} from "./PROMO1-PK-SK.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const EM3000 = sUnit("SPEC-EM3000", { bp: 3000, size: "M", powerCost: 3 });
const EM_BIG = sUnit("SPEC-EM-BIG", { bp: 9000, size: "M" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "ET", bp: 2000, features: ["仮面ライダー", "男"] });
const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const C6 = sUnit("SPEC-C6", { bp: 1000, powerCost: 6 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const M5 = sUnit("SPEC-M5", { bp: 1000, powerCost: 5, size: "M" });
const IMAGIN = sUnit("SPEC-IMAGIN", { category: "OT", bp: 1000, features: ["イマジン"] });
const MAOU = sUnit("SPEC-MAOU", { category: "MA", bp: 1000, powerCost: 1, features: ["魔皇力"] });
const advent = (id: string, cost: number) =>
  ({ id, name: id, type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: cost, features: ["アドベントカード"] }) as unknown as CardDefinition;
const ADV2 = advent("SPEC-ADV2", 2);
const ADV3 = advent("SPEC-ADV3", 3);
const OP4 = { id: "SPEC-OP4", name: "SPEC-OP4", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 4 } as unknown as CardDefinition;
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, E2000, EM3000, EM_BIG, KAMEN, MALE, C1, C2, C4, C5, C6, M2, M5, IMAGIN, MAOU, ADV2, ADV3, OP4];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => battleBoard(EXTRA, p1, p2);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBattle(EXTRA, p1, p2);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("PK-008 ライダーマン", () => {
  const TEXT =
    "※これ以外の特徴「仮面ライダー」を持つユニットが自軍バトルエリアにあれば、これは敵軍Sユニットにアタックされない。 【カギ爪アーム】これが自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアからSユニットを1体選び、可能ならバトルエリアに出してもよい。";

  it("PK-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-973）", () => {
    expectCatalogText("PK-008", TEXT);
    expectStats("PK-008", { name: "ライダーマン", category: "ET", size: "S", bp: 1000, sp: "1/5", powerCost: 2, features: ["仮面ライダー", "男"] });
    expectRarityIn("PK-008", ["PR"]);
  });

  it("PK-008: ※ ほかの「仮面ライダー」のユニットが自軍バトルエリアにあれば、敵軍 S ユニットにアタックされない（M ユニットにはアタックされる）（出典: atwiki/page-973）", () => {
    const s = enemyTurn({ battle: [inst("PK-008", "rm"), inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-EM-BIG", "m")] });
    expect(attackersOf(s, "PK-008:rm")).toEqual(["SPEC-EM-BIG:m"]);
  });

  it("PK-008: ※ ほかの「仮面ライダー」がいなければ（ラッシュエリアにいるだけでは）アタックされる（出典: atwiki/page-973「自軍バトルエリアにあれば」）", () => {
    const s = enemyTurn({ battle: [inst("PK-008", "rm"), inst("SPEC-MALE", "x")], rush: [inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E2000", "a")] });
    expect(attackersOf(s, "PK-008:rm")).toEqual(["SPEC-E2000:a"]);
  });

  // grnrngr/faq-rider-1 RK-074 Q1「はい、間違いありません。」（同じ本文の RK-074 の項）
  it("PK-008: 公式Q&A（同じ本文の RK-074）— ライダーマン（PK-008 と RK-074）が2体なら、お互いが「これ以外の仮面ライダー」になり、どちらもアタックされない（出典: grnrngr/faq-rider-1 RK-074 Q1）", () => {
    const s = enemyTurn({ battle: [inst("PK-008", "a"), inst("RK-074", "b")] }, { battle: [inst("SPEC-E2000", "x")] });
    expect(attackersOf(s, "PK-008:a")).toEqual([]);
    expect(attackersOf(s, "RK-074:b")).toEqual([]);
  });

  /** 自軍スタートフェイズにバトルエリアのライダーマンをラッシュエリアに戻す（カギ爪アームの選択は残す）。 */
  const returned = (p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({ phase: "start", activePlayer: "player1", player1: { battle: [inst("PK-008", "rm")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
    const ret = legal(s).find((a) => a.type === "return_all_battle_to_rush" && !("instanceId" in a && a.instanceId));
    return act(s, ret!);
  };

  it.fails("PK-008: 【カギ爪アーム】自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアの S ユニットを1体選べる（M は対象外。任意）（出典: atwiki/page-973）— 既知の不具合: CARD-PK-008 【カギ爪アーム】が発動しない（同じ盤面で RK-074 は発動する）", () => {
    const s = returned({ rush: [inst("SPEC-E2000", "a"), inst("SPEC-EM3000", "m")] });
    expect(zoneOf(s, "player1", "PK-008:rm")).toBe("rush");
    expectChoiceFrom(s, "player1", "PK-008");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PK-008: 【カギ爪アーム】選んだユニットは敵軍バトルエリアに出る（出典: atwiki/page-973「可能ならバトルエリアに出してもよい」）— 既知の不具合: CARD-PK-008 【カギ爪アーム】が発動しない（同じ盤面で RK-074 は発動する）", () => {
    const s = settle(pick(returned({ rush: [inst("SPEC-E2000", "a")] }), "SPEC-E2000:a"));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });

  it.fails("PK-008: 【カギ爪アーム】出さなくてもよい（出典: atwiki/page-973「出してもよい」）— 既知の不具合: CARD-PK-008 【カギ爪アーム】が発動しない（同じ盤面で RK-074 は発動する）", () => {
    const s = settle(skip(returned({ rush: [inst("SPEC-E2000", "a")] })));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("rush");
  });
});

// ===========================================================================
describe("PK-009 仮面ライダーV3", () => {
  v3Tests(
    "PK-009",
    "atwiki/page-963",
    "PR",
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ダブルタイフーン】自軍コマンドゾーンから「仮面ライダー1号」か「仮面ライダー2号」のカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたユニットカードのＲＣの効果を、このユニットの効果として発動する。",
  );
});

// ===========================================================================
describe("PK-010 ウエイクアップ！", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍バトルフェイズ中、ホールド状態の自軍Sユニットがバトルエリアに出たとき、『自軍Sユニットを1体選びホールドする』を実行してもよい。そうしたとき、バトルエリアに出たユニットをリリースする。";

  it("PK-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-983）", () => {
    expectCatalogText("PK-010", TEXT);
    expectOpStats("PK-010", { name: "ウエイクアップ！", category: "MA", powerCost: 3 });
    expectRarityIn("PK-010", ["PR"]);
  });

  const wake = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ operation: [resident("PK-010", "wu")], rush: [heldUnit("SPEC-KAMEN", "h"), inst("SPEC-C1", "r"), inst("SPEC-M2", "m")], battle: [inst("SPEC-C2", "b")], ...p1 }), "SPEC-KAMEN:h");

  it.fails("PK-010: 自軍バトルフェイズ中、ホールド状態の自軍 S ユニットがバトルエリアに出たとき、太字部分『自軍Sユニットを1体選びホールドする』を実行するかを選べる（任意。リリース状態の自軍 S ユニットから選ぶ。M は対象外）（出典: atwiki/page-983）— 既知の不具合: CARD-PK-010 ホールド状態の自軍 S ユニットが出ても発動しない（同じ盤面で RK-239 は発動する）", () => {
    const s = wake();
    expect(zoneOf(s, "player1", "SPEC-KAMEN:h")).toBe("battle");
    expectChoiceFrom(s, "player1", "PK-010");
    expect(choiceIds(s)).toEqual(["SPEC-C1:r", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PK-010: 選んだユニットをホールドし、バトルエリアに出たユニットをリリースする（出典: atwiki/page-983「そうしたとき、バトルエリアに出たユニットをリリースする」）— 既知の不具合: CARD-PK-010 発動しない", () => {
    const s = resolveAll(pick(wake(), "SPEC-C1:r"));
    expect(cardIn(s, "player1", "SPEC-C1:r")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld ?? false).toBe(false);
  });

  it.fails("PK-010: 実行しなければ、出たユニットはホールド状態のまま（出典: atwiki/page-983「実行してもよい」）— 既知の不具合: CARD-PK-010 発動しない（選択が開かない）", () => {
    const s = resolveAll(skip(wake()));
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld).toBe(true);
  });

  it.fails("PK-010: ※タッグ — 太字部分のかわりに、他の自軍のタッグの常駐（PK-011 クライマックス刑事）の太字部分『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行して、出たユニットをリリースできる（出典: atwiki/page-983「太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる」・R-KW-TAG-01）— 既知の不具合: CARD-PK-010 発動しない", () => {
    let s = wake({ operation: [resident("PK-010", "wu"), resident("PK-011", "cx")], power: [faceUp("TST-P", "pw0")] });
    expectChoiceFrom(s, "player1", "PK-010");
    expect(choiceIds(s)).toEqual(["PK-010:wu", "PK-011:cx"]);
    s = pick(s, "PK-011:cx");
    s = resolveAll(pick(s, "TST-P:pw0"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-P:pw0");
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld ?? false).toBe(false);
  });

  it("PK-010: リリース状態の自軍 S ユニットが出たときは発動しない（出典: atwiki/page-983「ホールド状態の自軍Sユニットがバトルエリアに出たとき」）", () => {
    const s = enter(board({ operation: [resident("PK-010", "wu")], rush: [inst("SPEC-KAMEN", "h"), inst("SPEC-C1", "r")] }), "SPEC-KAMEN:h");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PK-010");
  });

  it("PK-010: ホールド状態の M ユニットが出たときは発動しない（出典: atwiki/page-983「ホールド状態の自軍Sユニットが」）", () => {
    const s = enter(board({ operation: [resident("PK-010", "wu")], rush: [heldUnit("SPEC-M2", "hm"), inst("SPEC-C1", "r")] }), "SPEC-M2:hm");
    expect(zoneOf(s, "player1", "SPEC-M2:hm")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PK-010");
  });

  it("PK-010: 自軍ラッシュフェイズには起動できない（出典: atwiki/page-983「自軍バトルフェイズ中、」）", () => {
    expect(canActivateResident(rushPhase({ operation: [resident("PK-010", "wu")], rush: [inst("SPEC-C1", "r")] }), "PK-010:wu")).toBe(false);
  });
});

// ===========================================================================
describe("PK-011 クライマックス刑事", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズごとに1度だけ、『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行してもよい。そうしたとき、このターン、特徴「イマジン」を持つ自軍ユニットは、「これはバトルエリアに出たとき撃破される」と書かれていても、そのテキストは無効になり、特徴「警察」を追加される。";

  it("PK-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-984）", () => {
    expectCatalogText("PK-011", TEXT);
    expectOpStats("PK-011", { name: "クライマックス刑事", category: "OT", powerCost: 0 });
    expectRarityIn("PK-011", ["PR"]);
  });

  const cxBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase(
      { operation: [resident("PK-011", "cx")], power: [faceUp("TST-P", "up"), faceDown("TST-P", "dn")], rush: [inst("PK-007", "mo"), inst("SPEC-IMAGIN", "im"), inst("SPEC-C1", "c")], ...p1 },
      { rush: [inst("SPEC-IMAGIN", "eim")] },
    );
  const used = () => resolveAll(pick(activateResident(cxBoard(), "PK-011:cx"), "TST-P:up"));
  const pickOwnBold = (s: GameState, opId: string) => (s.pendingEffectChoice?.effectId === "tag_bold_pick" ? pick(s, opId) : s);

  it.fails("PK-011: 自軍ラッシュフェイズに、太字部分『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行できる（任意。ウラ向きのカードは選べない）（出典: atwiki/page-984「自軍ラッシュフェイズごとに1度だけ、…を実行してもよい」）— 既知の不具合: CARD-PK-011 常駐から起動できない（同じ盤面で RK-242 は起動できる）", () => {
    const s0 = cxBoard();
    expect(canActivateResident(s0, "PK-011:cx")).toBe(true);
    const s = activateResident(s0, "PK-011:cx");
    expectChoiceFrom(s, "player1", "PK-011");
    expect(choiceIds(s)).toEqual(["TST-P:up"]);
  });

  it.fails("PK-011: 選んだオモテ向きのパワーは自軍山札の上に戻る（出典: atwiki/page-984）— 既知の不具合: CARD-PK-011 常駐から起動できない", () => {
    const s = used();
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-P:up");
  });

  it.fails("PK-011: そうしたとき、このターン、特徴「イマジン」を持つ自軍ユニットに特徴「警察」が追加される（敵軍のイマジンには追加されない）（出典: atwiki/page-984「特徴「警察」を追加される」）— 既知の不具合: CARD-PK-011 常駐から起動できない", () => {
    const s = used();
    expect(featuresOf(s, "player1", "SPEC-IMAGIN:im")).toContain("警察");
    expect(featuresOf(s, "player1", "SPEC-C1:c")).not.toContain("警察");
    expect(featuresOf(s, "player2", "SPEC-IMAGIN:eim")).not.toContain("警察");
  });

  it.fails("PK-011: そうしたとき、このターン、自軍のイマジンの「これはバトルエリアに出たとき撃破される」は無効になる（PK-007 モモタロスがバトルエリアに残る）（出典: atwiki/page-984「そのテキストは無効になり」）— 既知の不具合: CARD-PK-011 常駐から起動できない", () => {
    const s = enter(nextPhase(used()), "PK-007:mo");
    expect(zoneOf(s, "player1", "PK-007:mo")).toBe("battle");
  });

  it("PK-011: 実行しなければ、PK-007 モモタロスはバトルエリアに出たとき撃破される（出典: atwiki/page-984「そうしたとき」・atwiki/page-966 PK-007 本文）", () => {
    const s = resolveAll(enter(nextPhase(cxBoard()), "PK-007:mo"));
    expect(zoneOf(s, "player1", "PK-007:mo")).toBe("discard");
  });

  it.fails("PK-011: 自軍ラッシュフェイズごとに1度だけ（同じラッシュフェイズに2回目は実行できない）。自軍バトルフェイズには実行できない（出典: atwiki/page-984「自軍ラッシュフェイズごとに1度だけ」）— 既知の不具合: CARD-PK-011 常駐から起動できない", () => {
    const s = used();
    expect(canActivateResident(s, "PK-011:cx")).toBe(false);
    expect(canActivateResident(nextPhase(cxBoard()), "PK-011:cx")).toBe(false);
  });

  it("PK-011: オモテ向きの自軍パワーがなければ（他のタッグもなければ）実行できない（出典: atwiki/page-984）", () => {
    expect(canActivateResident(cxBoard({ power: [faceDown("TST-P", "dn")] }), "PK-011:cx")).toBe(false);
  });

  // atwiki/page-762 RK-242 Q1「同名のタッグオペレーションカードである「RK-242 クライマックス刑事」と「PK-011 クライマックス刑事」を２枚同時に常駐させていれば、
  // 両方の効果をそれぞれ発動することができます。(2010/10/25修正)」・ユーザー決定（2026-10-19。README §5.7 i）
  it.fails("PK-011: 公式Q&A — RK-242 と PK-011（同名のタッグ）を2枚同時に常駐させていれば、1度のラッシュフェイズに両方の太字部分の効果をそれぞれ発動できる（出典: atwiki/page-762 Q1（2010/10/25修正）・ユーザー決定 2026-10-19「両方の効果をそれぞれ発動することができる」）— 既知の不具合: CARD-PK-011 PK-011 を常駐から起動できない（RK-242 は起動できる）", () => {
    let s = cxBoard({ operation: [resident("RK-242", "rk"), resident("PK-011", "cx")], power: [faceUp("TST-P", "up"), faceUp("TST-P", "up2")] });
    s = resolveAll(pick(pickOwnBold(activateResident(s, "RK-242:rk"), "RK-242:rk"), "TST-P:up"));
    expect(canActivateResident(s, "RK-242:rk")).toBe(false);
    expect(canActivateResident(s, "PK-011:cx")).toBe(true);
    s = resolveAll(pick(pickOwnBold(activateResident(s, "PK-011:cx"), "PK-011:cx"), "TST-P:up2"));
    expect(zoneOf(s, "player1", "TST-P:up")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-P:up2")).toBe("deck");
    expect(canActivateResident(s, "PK-011:cx")).toBe(false);
  });
});

// ===========================================================================
describe("PK-012 仮面ライダー龍騎サバイブ", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダー龍騎」を1体選び、自軍ラッシュエリアに出す。 【ドラグバイザーツバイ】自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい。そうしたとき選んだカードの必要パワーの数字を合計して、その合計以下の必要パワーの数字を持つ敵軍ユニットを1体撃破する";

  it("PK-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-1140）", () => {
    expectCatalogText("PK-012", TEXT);
    expectStats("PK-012", { name: "仮面ライダー龍騎サバイブ", category: "WB", size: "S", bp: 6500, sp: "1/2", powerCost: "10-", comboNumber: "RC", features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("PK-012", ["PR"]);
  });

  zeroCostTests("PK-012", "PK-001", "仮面ライダー龍騎（PK-001）", 10, "WB", "atwiki/page-1140「追加条件：自軍「仮面ライダー龍騎」を1体捨札にすれば必要パワー0になる」");
  reanimateTests("PK-012", "RK-033", "仮面ライダー龍騎", "atwiki/page-1140");

  const enemy = { battle: [inst("SPEC-C5", "c5"), inst("SPEC-C4", "c4"), inst("SPEC-M5", "m5")], rush: [inst("SPEC-C2", "r2"), inst("SPEC-C6", "r6")] };
  const visor = (discard = [inst("SPEC-ADV2", "a2"), inst("SPEC-ADV3", "a3"), inst("SPEC-OP4", "o4")]) =>
    rcRideOff(board({ rush: [inst("PK-012", "sv"), inst("SPEC-VEHICLE", "v")], discard }, enemy), "PK-012:sv", "SPEC-VEHICLE:v");

  it.fails("PK-012: 【ドラグバイザーツバイ】RC — 自軍捨札の特徴「アドベントカード」を持つカードを選べる（任意）（出典: atwiki/page-1140「自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい」）— 既知の不具合: CARD-PK-012 【ドラグバイザーツバイ】が発動しない（同じ盤面で RK-333 は発動する）", () => {
    const s = visor();
    expectChoiceFrom(s, "player1", "PK-012");
    expect(choiceIds(s)).toEqual(["SPEC-ADV2:a2", "SPEC-ADV3:a3"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PK-012: 2枚選ぶと必要パワーの合計（5）以下の敵軍ユニット（エリア・サイズを問わない）から1体選び撃破する（強制）（出典: atwiki/page-1140「その合計以下の必要パワーの数字を持つ敵軍ユニットを1体撃破する」）— 既知の不具合: CARD-PK-012 【ドラグバイザーツバイ】が発動しない", () => {
    let s = pick(pick(visor(), "SPEC-ADV2:a2"), "SPEC-ADV3:a3");
    expectChoiceFrom(s, "player1", "PK-012");
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2", "SPEC-C4:c4", "SPEC-C5:c5", "SPEC-M5:m5"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-M5:m5"));
    expect(zoneOf(s, "player2", "SPEC-M5:m5")).toBe("discard");
  });

  it.fails("PK-012: 1枚だけ選んで確定してもよい（合計2）（出典: atwiki/page-1140「2枚まで」）— 既知の不具合: CARD-PK-012 【ドラグバイザーツバイ】が発動しない", () => {
    const s = confirm(pick(visor(), "SPEC-ADV2:a2"));
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2"]);
  });

  it.fails("PK-012: 選ばなければ何も起きない（出典: atwiki/page-1140「選んでもよい。そうしたとき」）— 既知の不具合: CARD-PK-012 【ドラグバイザーツバイ】の選択が開かない", () => {
    expect(zoneOf(resolveAll(skip(visor())), "player2", "SPEC-C2:r2")).toBe("rush");
  });

  it("PK-012: ライドオフせずに出たとき（RC が発動しない）は何も起きない（出典: atwiki/page-1140「CN：RC」）", () => {
    const s = enter(board({ rush: [inst("PK-012", "sv")], discard: [inst("SPEC-ADV2", "a2")] }, enemy), "PK-012:sv");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PK-012");
  });
});

// ===========================================================================
describe("PK-013 変身音叉 音角", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒ ◎自分の手札から、｢仮面ライダー響鬼｣のカードを1枚選び、自軍ラッシュエリアに出してもよい。 ◎敵軍山札の上から1枚をオモテにする。このカードを使用したコマンドが特徴に｢ディスクアニマル｣を持つカードなら自分は1枚ドローする。その後、オモテにしたカードを山札に戻す。";

  it("PK-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-1093）", () => {
    expectCatalogText("PK-013", TEXT);
    expectOpStats("PK-013", { name: "変身音叉 音角", category: "MA", powerCost: 2 });
    expectRarityIn("PK-013", ["PR"]);
  });

  const HAND = [inst("RK-221", "hb"), inst("XG2-063", "hb2"), inst("RK-222", "kurenai")];
  const used = (command: CardInstance[] = releasedCat("MA", 1)) =>
    played(rushPhase({ hand: [inst("PK-013", "ok"), ...HAND], command, power: powerCards(2) }), "PK-013:ok");

  it.fails("PK-013: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: atwiki/page-1093「次の効果から1つ選び発動する」）— 既知の不具合: CARD-PK-013 効果の選択が開かない（同じ盤面で RK-252 は開く。本文の言い回しが RK-252 と違う）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "PK-013");
    expect(choiceIds(s)).toEqual(["hibiki_rush", "reveal_draw"]);
  });

  it.fails("PK-013: ◎1つ目 — 手札の「仮面ライダー響鬼」のカード（RK-221・XG2-063。響鬼紅は対象外）から1枚選べる（任意）（出典: atwiki/page-1093「自分の手札から、｢仮面ライダー響鬼｣のカードを1枚選び、自軍ラッシュエリアに出してもよい」）— 既知の不具合: CARD-PK-013 効果の選択が開かない", () => {
    const s = pick(used(), "hibiki_rush");
    expectChoiceFrom(s, "player1", "PK-013");
    expect(choiceIds(s)).toEqual(["RK-221:hb", "XG2-063:hb2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PK-013: ◎1つ目 — 選んだ「仮面ライダー響鬼」は自軍ラッシュエリアに出る（出典: atwiki/page-1093）— 既知の不具合: CARD-PK-013 効果の選択が開かない", () => {
    const s = resolveAll(pick(pick(used(), "hibiki_rush"), "RK-221:hb"));
    expect(zoneOf(s, "player1", "RK-221:hb")).toBe("rush");
    expect(zoneOf(s, "player1", "PK-013:ok")).toBe("discard");
  });

  it.fails("PK-013: ◎2つ目 — 使用したコマンドが特徴「ディスクアニマル」を持つ（XG5-069 キハダガニ）なら、自分は1枚ドローし、オモテにした敵軍山札の上のカードは山札（の上）に戻る（出典: atwiki/page-1093「このカードを使用したコマンドが特徴に｢ディスクアニマル｣を持つカードなら自分は1枚ドローする。その後、オモテにしたカードを山札に戻す」）— 既知の不具合: CARD-PK-013 効果の選択が開かない", () => {
    const s = resolveAll(pick(used([inst("XG5-069", "disk")]), "reveal_draw"));
    expect(cardIn(s, "player1", "XG5-069:disk")?.commandHeld).toBe(true);
    expect(s.players.player1.hand).toHaveLength(4);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e0");
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it.fails("PK-013: ◎2つ目 — 使用したコマンドが「ディスクアニマル」を持たなければドローしない（出典: atwiki/page-1093）— 既知の不具合: CARD-PK-013 効果の選択が開かない", () => {
    const s = resolveAll(pick(used(), "reveal_draw"));
    expect(s.players.player1.hand).toHaveLength(3);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e0");
  });
});

// ===========================================================================
describe("PK-014 仮面ライダーキバEF", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【モンスターフィーバー】自軍ターン中、これがバトルエリアに出るとき、自分の手札から特徴「魔皇力」を持つ、追加条件を持たないSユニットのカードを1枚選び相手に見せてもよい。そうしたとき、そのユニットの効果名を持つ効果を、このユニットの効果として発動する。";

  it("PK-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-1395）", () => {
    expectCatalogText("PK-014", TEXT);
    expectStats("PK-014", { name: "仮面ライダーキバEF", category: "MA", size: "S", bp: 5000, sp: "1/3", powerCost: "6+", features: ["仮面ライダー", "男", "魔皇力"], rushCondition: "discard_feature_unit" });
    expectRarityIn("PK-014", ["PR"]);
  });

  it("PK-014: 追加条件 — 特徴「魔皇力」を持つ自軍ユニット1体を捨札にしてラッシュできる（出典: atwiki/page-1395「追加条件：特徴「魔皇力」を持つ自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("PK-014", "ef")], rush: [inst("SPEC-MAOU", "k")], power: powerCards(6), command: releasedCat("MA", 1) }), "player1", "PK-014:ef", { materials: ["SPEC-MAOU:k"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PK-014:ef")).toBe("rush");
    expect(zoneOf(r.state, "player1", "SPEC-MAOU:k")).toBe("discard");
  });

  it("PK-014: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1395・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("PK-014", "ef")] }, "PK-014:ef"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  const fever = (hand = [inst("RK-245", "kb"), inst("RK-246", "gf"), inst("RK-313", "dg"), inst("RK-315", "hs"), inst("SPEC-C1", "x")]) =>
    enter(board({ rush: [inst("PK-014", "ef")], hand }, enemy), "PK-014:ef");

  it.fails("PK-014: 【モンスターフィーバー】自軍ターン中に出るとき、手札の特徴「魔皇力」を持つ、追加条件を持たない S ユニットのカードを1枚選べる（任意。必要パワーに「+」「-」のあるキバDGBKF・飛翔態は対象外）（出典: atwiki/page-1395「自分の手札から特徴「魔皇力」を持つ、追加条件を持たないSユニットのカードを1枚選び相手に見せてもよい」）— 既知の不具合: CARD-PK-014 【モンスターフィーバー】が発動しない（同じ盤面で RK-314 は発動する）", () => {
    const s = fever();
    expectChoiceFrom(s, "player1", "PK-014");
    expect(choiceIds(s)).toEqual(["RK-245:kb", "RK-246:gf"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PK-014: キバ（RK-245）を見せると、その【ダークネスムーンブレイク】をこのユニットの効果として発動する（このユニットをホールドして敵軍 S ユニットをダメージにする）。見せたカードは手札に残る（出典: atwiki/page-1395「そのユニットの効果名を持つ効果を、このユニットの効果として発動する」）— 既知の不具合: CARD-PK-014 【モンスターフィーバー】が発動しない", () => {
    let s = pick(fever(), "RK-245:kb");
    expect(zoneOf(s, "player1", "RK-245:kb")).toBe("hand");
    s = accept(s);
    expect(cardIn(s, "player1", "PK-014:ef")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:r"]);
    s = resolveAll(pick(s, "SPEC-C2:r"));
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("PK-014: 見せなければ何も起きない（出典: atwiki/page-1395「見せてもよい」）— 既知の不具合: CARD-PK-014 【モンスターフィーバー】の選択が開かない", () => {
    const s = resolveAll(skip(fever()));
    expect(cardIn(s, "player1", "PK-014:ef")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("PK-014: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出るときは発動しない（出典: atwiki/page-1395「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("PK-014:ef", { hand: [inst("RK-245", "kb")] }, { battle: [inst("SPEC-C1", "a")] }, EXTRA);
    expect(zoneOf(s, "player1", "PK-014:ef")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PK-014");
  });
});
