/**
 * カード別スペック: RK-071〜RK-077（ザ・マスクドライダーEXP vol.1 仮面ライダーキックホッパー〜ラウズカード）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-074 の Q&A、RK-016・RK-017 欄（RK-075・RK-076 と同じカード）、
 *     RK-061 欄の RK-073 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。RK-075〜RK-077 は RK-016〜RK-018 と同じページ（page-176・197・177））
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-01、R-KW-PERM-01、R-START-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「レア／メモリアルレア／ノーマル」を R／MR／N として照合する。
 *
 * RK-075 ミラーワールド・RK-076 ミッションメモリー・RK-077 ラウズカードは RK-016・RK-017・RK-018 と同名・同文の再録（スターター版）。
 * 同じカードとして同じ処理になることを、RK-016〜018 の照合（cardSpec/RK1-001-021.c.test.ts）の主な項目を ID を替えて確かめる。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-072【ワイルドショット】がビークルを選ばない — dsl/targetSelectors.test.ts
 *  - RK-073 の RC がミッションメモリーでライドしないでも発動する（BP7000）— cardSpec/RK1-001-021.c.test.ts RK-017
 *  - RK-076 / RK-017 Q1（コマンドゾーンに置くタイミング）・RK-075 / RK-016 Q5（ギンガベリック）— RK1-001-021.c.test.ts の it.todo と同じ理由で未照合
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  activateResident,
  attack,
  attackersOf,
  bpOf,
  canActivateResident,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  fill,
  inst,
  legal,
  nextPhase,
  p1Battle,
  passEntry,
  pick,
  played,
  powerCards,
  rcRideOff,
  released,
  releasedCat,
  resident,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  stackedOn,
  sUnit,
  zoneOf,
} from "./RK4-064-084.helpers";

const E2000 = sUnit("SPEC-E2000", { bp: 2000, powerCost: 2 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000, powerCost: 3 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, powerCost: 3 });
const EM3000 = sUnit("SPEC-EM3000", { bp: 3000, size: "M", powerCost: 3 });
const COST1 = sUnit("SPEC-COST1", { bp: 1000, powerCost: 1 });
const COST2 = sUnit("SPEC-COST2", { bp: 1000, powerCost: 2 });
const COST3 = sUnit("SPEC-COST3", { bp: 1000, powerCost: 3 });
const COST2_M = sUnit("SPEC-COST2-M", { bp: 1000, powerCost: 2, size: "M" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "ET", bp: 2000, features: ["仮面ライダー", "男"] });
const KAMEN_M = sUnit("SPEC-KAMEN-M", { category: "ET", bp: 2000, size: "M", features: ["仮面ライダー"] });
const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "MA", size: "M", bp: 3000, features: ["男"] });
const MIRROR = sUnit("SPEC-MIRROR", { category: "WB", bp: 1000 });
const S5000 = sUnit("SPEC-S5000", { bp: 5000 });
const M5000 = sUnit("SPEC-M5000", { bp: 5000, size: "M" });
const EM_BIG = sUnit("SPEC-EM-BIG", { bp: 9000, size: "M" });
const EXTRA = [E2000, E3000, E3500, EM3000, COST1, COST2, COST3, COST2_M, KAMEN, KAMEN_M, MALE, MALE_M, MIRROR, S5000, M5000, EM_BIG, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-071 仮面ライダーキックホッパー", () => {
  const TEXT =
    "【ライダーキック】敵軍ラッシュエリアのSユニットの数を数えて、その数と同じ必要パワーの数字を持つ敵軍Sユニットがあれば1体選び、持ち主のパワーゾーンに送る。";

  it("RK-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-165）", () => {
    expectCatalogText("RK-071", TEXT);
    expectStats("RK-071", { name: "仮面ライダーキックホッパー", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 4, comboNumber: 2, features: ["仮面ライダー", "男", "加速"] });
    expectRarityIn("RK-071", ["R"]);
  });

  /** キックホッパーを position 番目に出す。敵軍ラッシュエリアの S は2体（必要パワー1・3）と M（必要パワー2）、バトルエリアに必要パワー2の S・M。 */
  const kicked = (position: number, p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(
      board(
        { battle: fill(position - 1), rush: [inst("RK-071", "kh")] },
        { rush: [inst("SPEC-COST1", "r1"), inst("SPEC-COST3", "r3"), inst("SPEC-COST2-M", "rm")], battle: [inst("SPEC-COST2", "b2"), inst("SPEC-EM3000", "bm")], ...p2 },
      ),
      "RK-071:kh",
    );

  it.fails("RK-071: NC（2番目）— 敵軍ラッシュエリアの S ユニットの数（2）と同じ必要パワーの数字を持つ敵軍 S ユニットを1体選ぶ（バトルエリアも対象・M は対象外。選ばないことはできない）（出典: atwiki/page-165）", () => {
    const s = kicked(2);
    expectChoiceFrom(s, "player1", "RK-071");
    expect(choiceIds(s)).toEqual(["SPEC-COST2:b2"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-071: 選んだユニットは持ち主のパワーゾーンに（オモテ向きで）送られる（出典: atwiki/page-165「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(kicked(2), "SPEC-COST2:b2"));
    expect(zoneOf(s, "player2", "SPEC-COST2:b2")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-COST2:b2")?.faceDown ?? false).toBe(false);
  });

  it("RK-071: その数と同じ必要パワーの数字の敵軍 S ユニットがなければ何もしない（出典: atwiki/page-165「…があれば」）", () => {
    const s = kicked(2, { battle: [inst("SPEC-EM3000", "bm")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-071");
  });

  it("RK-071: NC が成立しなければ（1番目）発動しない（出典: atwiki/page-165「CN：2」・R-CN-01）", () => {
    const s = kicked(1);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-071");
  });
});

// ===========================================================================
describe("RK-072 仮面ライダー電王GF", () => {
  const TEXT = "【ワイルドショット】敵軍ラッシュエリアから、カードに表記された本来のBPが3000以下のユニットを1体選び撃破する。";

  it("RK-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-168）", () => {
    expectCatalogText("RK-072", TEXT);
    expectStats("RK-072", { name: "仮面ライダー電王GF", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-072", ["R"]);
  });

  const shot = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-072", "gf"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-072:gf", "SPEC-VEHICLE:v");

  it("RK-072: RC — 敵軍ラッシュエリアの、本来の BP が 3000 以下のユニットを1体選ぶ（M ユニットも対象・バトルエリアは対象外。選ばないことはできない）（出典: atwiki/page-168）", () => {
    const s = shot({ rush: [inst("SPEC-E3000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-EM3000", "m")], battle: [inst("SPEC-E2000", "x")] });
    expectChoiceFrom(s, "player1", "RK-072");
    expect(choiceIds(s)).toEqual(["SPEC-E3000:a", "SPEC-EM3000:m"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-072: RC — 選んだユニットを撃破する（出典: atwiki/page-168「1体選び撃破する」）", () => {
    const s = resolveAll(pick(shot({ rush: [inst("SPEC-E3000", "a"), inst("SPEC-EM3000", "m")] }), "SPEC-EM3000:m"));
    expect(zoneOf(s, "player2", "SPEC-EM3000:m")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("rush");
  });

  it("RK-072: ライドしないで出たときは発動しない（出典: atwiki/page-168「CN：ＲＣ」・R-KW-RC-01）", () => {
    const s = enter(board({ rush: [inst("RK-072", "gf")] }, { rush: [inst("SPEC-E3000", "a")] }), "RK-072:gf");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-072");
  });
});

// ===========================================================================
describe("RK-073 仮面ライダー2号", () => {
  const TEXT = "※これはラッシュしたターンにバトルエリアに出られない。 【力の2号】このターン、これはBP+2000される。";

  it("RK-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-208）", () => {
    expectCatalogText("RK-073", TEXT);
    expectStats("RK-073", { name: "仮面ライダー2号", category: "ET", size: "S", bp: 5000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-073", ["R"]);
  });

  it("RK-073: ※ ラッシュしたターンはバトルエリアに出られない（出典: atwiki/page-208）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-073", "n2")], power: powerCards(3), command: releasedCat("ET", 1) }), "player1", "RK-073:n2");
    expect(r.ok, r.error).toBe(true);
    const s = nextPhase(settle(r.state));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-073:n2")).toBe(false);
  });

  it("RK-073: ※ 前のターンからラッシュエリアにあれば出られる（出典: atwiki/page-208「ラッシュしたターンに」）", () => {
    expect(canEnter(board({ rush: [inst("RK-073", "n2")] }), "RK-073:n2")).toBe(true);
  });

  it("RK-073: 【力の2号】（RC）ライドオフすると、このターン BP+2000（7000）（出典: atwiki/page-208）", () => {
    const s = settle(rcRideOff(board({ rush: [inst("RK-073", "n2"), inst("SPEC-VEHICLE", "v")] }), "RK-073:n2", "SPEC-VEHICLE:v"));
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(7000);
  });

  it("RK-073: 【力の2号】の BP+2000 は「このターン」だけ — 敵軍ターンには 5000 に戻る（出典: atwiki/page-208「このターン、」）", () => {
    const s = endTurn(passEntry(settle(rcRideOff(board({ rush: [inst("RK-073", "n2"), inst("SPEC-VEHICLE", "v")] }), "RK-073:n2", "SPEC-VEHICLE:v"))));
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(5000);
  });

  // 公式 Q（RK-061 欄）「いいえ、できません。正しく処理を実行できないものを対象に選ぶことはできません。」
  it("RK-073: 公式Q&A — 敵軍の電王RF【一本釣り】は、パワーゾーンの仮面ライダー2号を選べない（出典: grnrngr/faq-rider-1 RK-061 Q1・atwiki/page-166 Q1）", () => {
    const s = rcRideOff(
      board({ rush: [inst("RK-061", "rf"), inst("SPEC-VEHICLE", "v")] }, { power: [inst("RK-073", "n2"), inst("SPEC-E2000", "p")] }),
      "RK-061:rf",
      "SPEC-VEHICLE:v",
    );
    expect(choiceIds(s)).toEqual(["SPEC-E2000:p"]);
  });
});

// ===========================================================================
describe("RK-074 ライダーマン", () => {
  const TEXT =
    "※これ以外の特徴「仮面ライダー」を持つユニットが自軍バトルエリアにあれば、これは敵軍Sユニットにアタックされない。 【カギ爪アーム】これが自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアからSユニットを1体選び、可能ならバトルエリアに出してもよい。";

  it("RK-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-131）", () => {
    expectCatalogText("RK-074", TEXT);
    expectStats("RK-074", { name: "ライダーマン", category: "ET", size: "S", bp: 1000, sp: "1/5", powerCost: 2, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-074", ["R"]);
  });

  it("RK-074: ※ ほかの「仮面ライダー」のユニットが自軍バトルエリアにあれば、敵軍 S ユニットにアタックされない（M ユニットにはアタックされる）（出典: atwiki/page-131）", () => {
    const s = enemyTurn({ battle: [inst("RK-074", "rm"), inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E2000", "a"), inst("SPEC-EM-BIG", "m")] });
    expect(attackersOf(s, "RK-074:rm")).toEqual(["SPEC-EM-BIG:m"]);
  });

  it("RK-074: ※ ほかの「仮面ライダー」がいなければ（ラッシュエリアにいるだけでは）アタックされる（出典: atwiki/page-131「自軍バトルエリアにあれば」）", () => {
    const s = enemyTurn({ battle: [inst("RK-074", "rm"), inst("SPEC-MALE", "x")], rush: [inst("SPEC-KAMEN", "k")] }, { battle: [inst("SPEC-E2000", "a")] });
    expect(attackersOf(s, "RK-074:rm")).toEqual(["SPEC-E2000:a"]);
  });

  // 公式 Q1「はい、間違いありません。」
  it("RK-074: 公式Q&A — ライダーマンが2体なら、お互いが「これ以外の仮面ライダー」になり、どちらもアタックされない（出典: grnrngr/faq-rider-1 RK-074 Q1・atwiki/page-131 Q1）", () => {
    const s = enemyTurn({ battle: [inst("RK-074", "a"), inst("RK-074", "b")] }, { battle: [inst("SPEC-E2000", "x")] });
    expect(attackersOf(s, "RK-074:a")).toEqual([]);
    expect(attackersOf(s, "RK-074:b")).toEqual([]);
  });

  /** 自軍スタートフェイズにバトルエリアのライダーマンをラッシュエリアに戻す（カギ爪アームの選択は残す）。 */
  const returned = (p2: Partial<GameState["players"]["player2"]>) => {
    const s = st({ phase: "start", activePlayer: "player1", player1: { battle: [inst("RK-074", "rm")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
    const ret = legal(s).find((a) => a.type === "return_all_battle_to_rush" && !("instanceId" in a && a.instanceId));
    return act(s, ret!);
  };

  it.fails("RK-074: 【カギ爪アーム】自軍バトルエリアからラッシュエリアに戻るとき、敵軍ラッシュエリアの S ユニットを1体選べる（M は対象外。任意）（出典: atwiki/page-131）", () => {
    const s = returned({ rush: [inst("SPEC-E2000", "a"), inst("SPEC-EM3000", "m")] });
    expect(zoneOf(s, "player1", "RK-074:rm")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-074");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-074: 【カギ爪アーム】選んだユニットは敵軍バトルエリアに出る（出典: atwiki/page-131「可能ならバトルエリアに出してもよい」）", () => {
    const s = settle(pick(returned({ rush: [inst("SPEC-E2000", "a")] }), "SPEC-E2000:a"));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });

  it.fails("RK-074: 【カギ爪アーム】出さなくてもよい（出典: atwiki/page-131「出してもよい」）", () => {
    const s = settle(skip(returned({ rush: [inst("SPEC-E2000", "a")] })));
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("rush");
  });

  it.todo(
    "RK-074: 【カギ爪アーム】効果でラッシュエリアに戻るとき（がんがんじい等）も発動する（出典: atwiki/page-131 カード評価「がんがんじいの能力と組み合わせたコンボ」）— 出典がカード評価（非公式の感想）だけで、エンジンの効果によるバトルエリアからの戻しの照合は本範囲外のため",
  );
});

// ===========================================================================
describe("RK-075 ミラーワールド（RK-016 の再録）", () => {
  const TEXT =
    "※常駐 自軍ラッシュフェイズに自軍Sユニットをこれにオモテ向きに重ねてもよい。これが常駐置き場を離れるとき、重ねたカードはすべて手札に加える。これに重ねたカードと同じカード名の自軍ユニットは、次の能力を得る⇒相手は自分自身のコマンドを1つホールドしなければ、このユニットを選べない。アタックするには、さらに2つホールドしなければならない。";

  const mirror = (stacked: CardInstance[]) => resident("RK-075", "mw", stacked);
  /** 敵軍（player2）バトルフェイズ。player1 はミラーワールドに SPEC-MIRROR を重ねている。 */
  const defended = (stacked: CardInstance[], enemyCommands: number) =>
    enemyTurn(
      { operation: [mirror(stacked)], battle: [inst("SPEC-MIRROR", "u"), inst("TST-UNIT-0", "x")] },
      { battle: [inst("TST-UNIT-7", "atk")], command: releasedCat("WB", enemyCommands, "e") },
    );

  it("RK-075: カタログ本文・スペックが出典と一致（RK-016 と同文）（出典: atwiki/page-176）", () => {
    expectCatalogText("RK-075", TEXT);
    expectOpStats("RK-075", { name: "ミラーワールド", category: "WB", powerCost: 0 });
    expectRarityIn("RK-075", ["MR", "N"]);
  });

  it("RK-075: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-176・R-KW-PERM-01）", () => {
    const s = played(rushPhase({ hand: [inst("RK-075", "mw")], command: releasedCat("WB", 1) }), "RK-075:mw");
    expect(zoneOf(resolveAll(s), "player1", "RK-075:mw")).toBe("operation");
  });

  it.fails("RK-075: 自軍ラッシュフェイズに、自軍 S ユニットをこれにオモテ向きに重ねられる（出典: atwiki/page-176）", () => {
    let s = rushPhase({ operation: [mirror([])], rush: [inst("SPEC-MIRROR", "a"), inst("SPEC-MALE-M", "m")] });
    expect(canActivateResident(s, "RK-075:mw")).toBe(true);
    s = activateResident(s, "RK-075:mw");
    expect(choiceIds(s)).toEqual(["SPEC-MIRROR:a"]);
    s = resolveAll(pick(s, "SPEC-MIRROR:a"));
    expect(stackedOn(s, "player1", "RK-075:mw")).toEqual(["SPEC-MIRROR:a"]);
  });

  it.fails("RK-075: 重ねたカードと同名の自軍ユニットにアタックするには、相手はコマンドを3つ（1つ＋さらに2つ）ホールドしなければならない（出典: atwiki/page-176）", () => {
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 2), "SPEC-MIRROR:u")).toEqual([]);
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 3), "SPEC-MIRROR:u")).toEqual(["TST-UNIT-7:atk"]);
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk")], 0), "TST-UNIT-0:x")).toEqual(["TST-UNIT-7:atk"]);
  });

  it.fails("RK-075: 公式Q&A — 同名のカードを2枚重ねると重複し、アタックには6つのホールドが必要なのでアタックできない（出典: atwiki/page-176 Q3・Q5・grnrngr/faq-rider-1 RK-016 Q3）", () => {
    expect(attackersOf(defended([inst("SPEC-MIRROR", "stk"), inst("SPEC-MIRROR", "stk2")], 5), "SPEC-MIRROR:u")).toEqual([]);
  });

  it.fails("RK-075: 公式Q&A — 相手の効果で選ぶには、相手は自分自身のコマンドを1つホールドしなければならない（音撃で選ぶとき）（出典: atwiki/page-176 Q1・grnrngr/faq-rider-1 RS-288 Q）", () => {
    const base = (cmd: number) =>
      played(
        st(
          {
            phase: "rush",
            player1: { hand: [inst("RK-019", "og")], command: releasedCat("MA", 1 + cmd), power: powerCards(4), deck: deckCards(5) },
            player2: { operation: [mirror([inst("SPEC-MIRROR", "stk")])], battle: [inst("SPEC-MIRROR", "u"), inst("TST-UNIT-0", "x")], deck: deckCards(5, "e") },
          },
          EXTRA,
        ),
        "RK-019:og",
      );
    expect(choiceIds(base(0))).toEqual(["TST-UNIT-0:x"]);
    expect(choiceIds(base(1))).toEqual(["SPEC-MIRROR:u", "TST-UNIT-0:x"]);
  });

  it.fails("RK-075: 常駐置き場を離れるとき、重ねたカードはすべて手札に加える（出典: atwiki/page-176・R-KW-PERM-01）", () => {
    let s = rushPhase({ operation: [mirror([inst("SPEC-MIRROR", "stk")])], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", "RK-075:mw")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MIRROR:stk")).toBe("hand");
  });

  it.fails("RK-075: 公式Q&A — 同名の S ユニットが J パワーで L ユニットになっても、能力は続く（出典: atwiki/page-176 Q2・grnrngr/faq-rider-1 RK-016 Q2）", () => {
    const s = enemyTurn(
      { operation: [mirror([inst("SPEC-MIRROR", "stk")])], battle: [{ ...inst("SPEC-MIRROR", "u"), stackedCards: [inst("RK-013", "jp")] }] },
      { battle: [inst("TST-UNIT-7", "atk")], command: releasedCat("WB", 2, "e") },
    );
    expect(attackersOf(s, "SPEC-MIRROR:u")).toEqual([]);
  });
});

// ===========================================================================
describe("RK-076 ミッションメモリー（RK-017 の再録）", () => {
  const TEXT =
    "ＲＣを持つ自軍Sユニットを1体選ぶ。選んだユニットは、このターン、バトルエリアに出たとき、ライドオフしなくてもその効果を発動できる。その後、このカードを自軍コマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  const mmBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({ hand: [inst("RK-076", "mm")], rush: [inst("RK-073", "n2"), inst("SPEC-MALE-M", "m")], command: releasedCat("ET", 1), power: powerCards(2), ...p1 });
  const memorized = (p1: Partial<GameState["players"]["player1"]> = {}) => resolveAll(played(mmBoard(p1), "RK-076:mm"), ["RK-073:n2"]);

  it("RK-076: カタログ本文・スペックが出典と一致（RK-017 と同文）（出典: atwiki/page-197）", () => {
    expectCatalogText("RK-076", TEXT);
    expectOpStats("RK-076", { name: "ミッションメモリー", category: "ET", powerCost: 2 });
    expectRarityIn("RK-076", ["MR", "N"]);
  });

  it.fails("RK-076: 選べるのは RC を持つ自軍 S ユニットだけ（出典: atwiki/page-197）", () => {
    const s = played(mmBoard({ rush: [inst("RK-073", "n2"), inst("SPEC-MALE", "x"), inst("SPEC-MALE-M", "m")] }), "RK-076:mm");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-076");
    expect(choiceIds(s)).toEqual(["RK-073:n2"]);
  });

  it.fails("RK-076: その後、このカードは自軍コマンドゾーンにホールド状態で置かれ、置けなければ捨札にする（出典: atwiki/page-197）", () => {
    const s = memorized();
    expect(zoneOf(s, "player1", "RK-076:mm")).toBe("command");
    expect(cardIn(s, "player1", "RK-076:mm")?.commandHeld).toBe(true);
    const full = memorized({ command: [...releasedCat("ET", 1), ...releasedCat("WB", 4)] });
    expect(zoneOf(full, "player1", "RK-076:mm")).toBe("discard");
  });

  it.fails("RK-076: 公式Q&A — RC を持つユニットを選べなくても使え、コマンドゾーンに置く（出典: atwiki/page-197 Q2・Q6・grnrngr/faq-rider-1 RK-017 Q2・Q6）", () => {
    const s = resolveAll(played(mmBoard({ rush: [inst("SPEC-MALE", "x")] }), "RK-076:mm"));
    expect(zoneOf(s, "player1", "RK-076:mm")).toBe("command");
  });

  // faq-rider-1 RK-017 欄の Q「「RK-076　ミッションメモリー」の効果は、選んだ自軍ユニットがビークルにライドしなくても発動しますか？」「はい、発動します。」
  it.fails("RK-076: 公式Q&A — 選んだユニットはライドしないでバトルエリアに出ても RC の効果を発動する（仮面ライダー2号 BP7000）（出典: grnrngr/faq-rider-1 RK-017 Q5（RK-076 の Q）・atwiki/page-197 Q5）", () => {
    const s = enter(nextPhase(memorized()), "RK-073:n2");
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(7000);
  });

  it.fails("RK-076: 公式Q&A — ライドしたまま RC の効果を発動したら、その後ライドオフして2重に発動できない（BP9000 にはならない）（出典: atwiki/page-197 Q3・Q4・grnrngr/faq-rider-1 RK-017 Q3・Q4）", () => {
    let s = nextPhase(memorized({ rush: [inst("RK-073", "n2"), inst("SPEC-VEHICLE", "v")] }));
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RK-073:n2", vehicleInstanceId: "SPEC-VEHICLE:v" });
    const stay = legal(s).find((a) => a.type === "resolve_ride_off_choice" && a.rideOff === false);
    if (stay) s = act(s, stay);
    s = resolveAll(s);
    expect(bpOf(s, "player1", "RK-073:n2")).toBe(7000);
    expect(legal(s).some((a) => a.type === "resolve_ride_off_choice" && a.rideOff === true)).toBe(false);
  });

  it("RK-076: 「このターン」選んだユニットだけ — 選んでいないユニットはライドしないで出ても RC を発動しない（出典: atwiki/page-197「選んだユニットは、このターン、」）", () => {
    const s = enter(nextPhase(memorized({ rush: [inst("RK-073", "n2"), inst("RK-073", "other")] })), "RK-073:other");
    expect(bpOf(s, "player1", "RK-073:other")).toBe(5000);
  });
});

// ===========================================================================
describe("RK-077 ラウズカード（RK-018 の再録）", () => {
  const TEXT =
    "自軍ラッシュエリアからSユニットを1体選ぶ。そして自軍捨札からSユニットのカードを1枚選ぶ。そうしたとき、このターン、ラッシュエリアから選んだSユニットのBPに、捨札から選んだユニットカードのBPを「＋」する。";

  const rcBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({
      hand: [inst("RK-077", "rc")],
      rush: [inst("TST-UNIT-0", "u"), inst("SPEC-MALE-M", "m")],
      battle: [inst("TST-UNIT-0", "b")],
      discard: [inst("SPEC-S5000", "d5"), inst("SPEC-M5000", "dm")],
      command: releasedCat("WB", 1),
      power: powerCards(2),
      ...p1,
    });

  it("RK-077: カタログ本文・スペックが出典と一致（RK-018 と同文）（出典: atwiki/page-177）", () => {
    expectCatalogText("RK-077", TEXT);
    expectOpStats("RK-077", { name: "ラウズカード", category: "WB", powerCost: 2 });
    expectRarityIn("RK-077", ["MR", "N"]);
  });

  it.fails("RK-077: 自軍ラッシュエリアの S ユニット → 自軍捨札の S ユニットのカードの順に選ぶ（バトルエリア・M は選べない）（出典: atwiki/page-177）", () => {
    let s = played(rcBoard(), "RK-077:rc");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-077");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    s = pick(s, "TST-UNIT-0:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-077");
    expect(choiceIds(s)).toEqual(["SPEC-S5000:d5"]);
  });

  it.fails("RK-077: このターン、ラッシュエリアから選んだユニットの BP に、捨札から選んだカードの BP を＋する（1000＋5000＝6000）（出典: atwiki/page-177）", () => {
    const s = resolveAll(pick(pick(played(rcBoard(), "RK-077:rc"), "TST-UNIT-0:u"), "SPEC-S5000:d5"));
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(6000);
    expect(zoneOf(s, "player1", "SPEC-S5000:d5")).toBe("discard");
  });

  it("RK-077: 捨札に S ユニットのカードがなければ（「そうしたとき」）BP は変わらない（出典: atwiki/page-177「そうしたとき、」）", () => {
    const s = resolveAll(played(rcBoard({ discard: [inst("SPEC-M5000", "dm")] }), "RK-077:rc"), ["TST-UNIT-0:u"]);
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(1000);
  });
});

// 未使用の import を避けるための参照。
void attack;
void released;
void KAMEN_M;
