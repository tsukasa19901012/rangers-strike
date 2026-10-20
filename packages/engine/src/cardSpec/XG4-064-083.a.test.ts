/**
 * cardSpec XG4-064〜XG4-070（リボルギャリー〜クレイドール・ドーパント）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  canMount,
  canSkip,
  canStartRush,
  canWing,
  choiceIds,
  confirm,
  deckCards,
  destroyedInEnemyBattle,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  lastBattleBps,
  morphTests,
  p1Battle,
  pick,
  pickThrough,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resident,
  resolveAll,
  ridingPair,
  rushBoard,
  rushFromHand,
  settle,
  sUnit,
  zoneOf,
} from "./XG4-064-083.helpers";

const DD = sUnit("SPEC-DD", { category: "WB", bp: 1000, sp: undefined, features: ["ダブルドライバー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000, sp: undefined, features: ["男"] });
const RIDER = sUnit("SPEC-RIDER", { category: "MA", bp: 2000, sp: undefined, comboNumber: "RC" });
const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_C2 = sUnit("SPEC-E-C2", { bp: 1000, powerCost: 2, sp: undefined });
const E_C3 = sUnit("SPEC-E-C3", { bp: 1000, powerCost: 3, sp: undefined });
const E_5000 = sUnit("SPEC-E-5000", { bp: 5000, sp: undefined });
const BEAST_CMD = sUnit("SPEC-BEAST", { category: "DA", bp: 1000, features: ["獣"] });
const EXTRA = [DD, PLAIN, RIDER, E_S, E_C2, E_C3, E_5000, BEAST_CMD];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-064 リボルギャリー", () => {
  const TEXT =
    "【リボルバーハンガー】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる⇒自軍コマンドゾーンから、カテゴリを2つ以上持つビークルカードを1枚選び、カテゴリを2つ以上持つ自軍ビークル1体と置き換える。ただし、必要パワーと追加条件は満たすこと。";

  it("XG4-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-2116）", () => {
    expectCatalogText("XG4-064", TEXT);
    expectUnit("XG4-064", { name: "リボルギャリー", category: "ET", size: "M", bp: 4000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["メカ", "車両"] });
    expectRarityIn("XG4-064", ["NR"]);
  });

  // 場の XG4-066 マシンハードスプラッシャー（MA/DA）を、コマンドゾーンの XG4-065 マシンハードタービュラー（WB/DA・必要パワー4）と置き換える。
  const entered = (power = 4) =>
    settle(enterNow(battle({ rush: [inst("XG4-064", "rg"), inst("XG4-066", "sp")], command: [released("XG4-065", "tb")], power: powerCards(power) }), "XG4-064:rg"));

  it("XG4-064:【リボルバーハンガー】— 自軍ターン中にバトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-2116「次の効果を発動できる」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-064");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-064:【リボルバーハンガー】— 発動すると、コマンドゾーンのカテゴリ2つ以上のビークルカードと、カテゴリ2つ以上の自軍ビークルが置き換わる（出典: atwiki/page-2116「自軍コマンドゾーンから、カテゴリを2つ以上持つビークルカードを1枚選び、カテゴリを2つ以上持つ自軍ビークル1体と置き換える」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-064");
    s = resolveAll(pickThrough(s, "XG4-064", ["XG4-065:tb", "XG4-066:sp"]));
    expect(zoneOf(s, "player1", "XG4-065:tb")).toBe("rush");
    expect(zoneOf(s, "player1", "XG4-066:sp")).toBe("command");
  });

  it("XG4-064:【リボルバーハンガー】— 出すビークルの必要パワーを満たさなければ置き換えられない（パワー3で必要パワー4のビークル）（出典: atwiki/page-2116「ただし、必要パワーと追加条件は満たすこと」）", () => {
    let s = entered(3);
    if (s.pendingEffectChoice?.sourceCardId === "XG4-064") s = pickThrough(s, "XG4-064", ["XG4-065:tb", "XG4-066:sp"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG4-065:tb")).toBe("command");
    expect(zoneOf(s, "player1", "XG4-066:sp")).toBe("rush");
  });
});

// ===========================================================================
describe("XG4-065 マシンハードタービュラー", () => {
  const TEXT = "※特徴「ダブルドライバー」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。 【飛行】これにライドしているユニットは次の能力を得る⇒「ウイング」";

  it("XG4-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-2040）", () => {
    expectCatalogText("XG4-065", TEXT);
    expectVehicle("XG4-065", { name: "マシンハードタービュラー", category: ["WB", "DA"], powerCost: 4, size: "S", features: ["メカ", "車両", "航空機"] });
    expectRarityIn("XG4-065", ["R"]);
  });

  it("XG4-065: ※ — 特徴「ダブルドライバー」を持つ S ユニットは RC がなくてもライドできる（持たないユニットはライドできない）（出典: atwiki/page-2040「ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const s = battle({ rush: [inst("XG4-065", "tb"), inst("SPEC-DD", "d"), inst("SPEC-PLAIN", "p")] });
    expect(canMount(s, "SPEC-DD:d", "XG4-065:tb")).toBe(true);
    expect(canMount(s, "SPEC-PLAIN:p", "XG4-065:tb")).toBe(false);
  });

  it("XG4-065:【飛行】— これにライドしているユニットは「ウイング」を得る（自軍バトルフェイズにラッシュエリアで発動できる）（出典: atwiki/page-2040「これにライドしているユニットは次の能力を得る⇒「ウイング」」）", () => {
    const s = battle({ rush: ridingPair("SPEC-RIDER", "r", "XG4-065", "tb") }, { battle: [inst("SPEC-E-S", "e")] });
    expect(canWing(s, "SPEC-RIDER:r")).toBe(true);
  });

  it("XG4-065:【飛行】— ライドしていないユニットは「ウイング」を得ない（出典: atwiki/page-2040「これにライドしているユニットは」）", () => {
    const s = battle({ rush: [inst("XG4-065", "tb"), inst("SPEC-RIDER", "r")] }, { battle: [inst("SPEC-E-S", "e")] });
    expect(canWing(s, "SPEC-RIDER:r")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-066 マシンハードスプラッシャー", () => {
  const TEXT =
    "※これにライドしているユニットは、アタックするときBP+1500される。 【水中魚雷】これをラッシュしたとき、敵軍山札の上から3枚をオモテにしてよい。そうしたとき、オモテにしたカードをそれぞれ持ち主の山札の下に好きな順で戻す。";

  it("XG4-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-2095）", () => {
    expectCatalogText("XG4-066", TEXT);
    expectVehicle("XG4-066", { name: "マシンハードスプラッシャー", category: ["MA", "DA"], powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-066", ["N"]);
  });

  it("XG4-066: ※ — ライドしているユニットはアタックするとき BP+1500（BP2000 が BP3500 でバトルする）（出典: atwiki/page-2095「これにライドしているユニットは、アタックするときBP+1500される」）", () => {
    const s = settle(attack(battle({ battle: ridingPair("SPEC-RIDER", "r", "XG4-066", "sp") }, { battle: [inst("SPEC-E-5000", "t")] }), "SPEC-RIDER:r", "SPEC-E-5000:t"));
    expect(lastBattleBps(s)?.attacker).toBe(3500);
  });

  const rushed = () => {
    const r = rushFromHand(
      board({ hand: [inst("XG4-066", "sp")], command: [...releasedCat("MA", 1), ...releasedCat("DA", 1)], power: powerCards(3) }, { deck: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3"), inst("TST-UNIT-0", "e4"), inst("TST-UNIT-0", "e5")] }),
      "player1",
      "XG4-066:sp",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG4-066:【水中魚雷】— ラッシュしたとき、敵軍山札の上から3枚をオモテにするかを選べる（任意）（出典: atwiki/page-2095「敵軍山札の上から3枚をオモテにしてよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-066");
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-066:【水中魚雷】— オモテにすると、その3枚は敵軍山札の下に戻る（4枚目が一番上になる）（出典: atwiki/page-2095「オモテにしたカードをそれぞれ持ち主の山札の下に好きな順で戻す」）", () => {
    let s = rushed();
    expectChoiceFrom(s, "player1", "XG4-066");
    s = resolveAll(pickThrough(confirm(s), "XG4-066", ["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:e3"]));
    const deck = s.players.player2.deck.map((c) => c.instanceId);
    expect(deck[0]).toBe("TST-UNIT-0:e4");
    expect(deck.slice(-3).sort()).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:e3"]);
  });
});

// ===========================================================================
describe("XG4-067 仮面ライダーW・LM", () => {
  const TEXT =
    "※モーフ ※レジスト 【メタルシャフト】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアからホールド状態の敵軍Sユニットを1体選び、持ち主の山札の上に戻してもよい。";

  it("XG4-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-2117）", () => {
    expectCatalogText("XG4-067", TEXT);
    expectUnit("XG4-067", { name: "仮面ライダーW・LM", category: "MA", size: "S", bp: 2000, sp: "1/3", powerCost: "3+", comboNumber: undefined, features: ["仮面ライダー", "男", "ダブルドライバー"], rushCondition: "state_gate" });
    expectRarityIn("XG4-067", ["NR"]);
  });

  it("XG4-067: 追加条件 — 特徴「メカ」を持つ自軍コマンドがあればラッシュできる（なければできない）（出典: atwiki/page-2117「追加条件：特徴「メカ」を持つ自軍コマンドがある」）（既知の不具合: CARD-XG4-067 追加条件「特徴「メカ」を持つ自軍コマンドがある」がオペレーションカードしか数えず、ユニットカードのコマンドではラッシュできない）", () => {
    const mk = (withMecha: boolean) =>
      board({ hand: [inst("XG4-067", "lm")], command: [...releasedCat("MA", 1), ...(withMecha ? [released("XG4-064", "mc")] : [])], power: powerCards(3) });
    expect(canStartRush(mk(false), "player1", "XG4-067:lm")).toBe(false);
    const r = rushFromHand(mk(true), "player1", "XG4-067:lm");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG4-067:lm")).toBe("rush");
  });

  morphTests("XG4-067", "XG4-068", "XG4-073", "atwiki/page-2117");

  it("XG4-067: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2117 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-067", "lm")] }, "XG4-067:lm"))).toBe(true);
  });

  const entered = () =>
    settle(enterNow(battle({ rush: [inst("XG4-067", "lm")] }, { rush: [{ ...inst("SPEC-E-S", "h"), commandHeld: true }, inst("SPEC-E-S", "r")], battle: [{ ...inst("SPEC-E-S", "b"), commandHeld: true }], deck: deckCards(3, "e") }), "XG4-067:lm"));

  it("XG4-067:【メタルシャフト】— 自軍ターン中にバトルエリアに出たとき、敵軍ラッシュエリアのホールド状態の S ユニットから1体選べる（リリース状態・バトルエリアのユニットは選べない。任意）（出典: atwiki/page-2117「敵軍ラッシュエリアからホールド状態の敵軍Sユニットを1体選び…戻してもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-067");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-067:【メタルシャフト】— 選んだユニットは持ち主の山札の一番上に戻る（出典: atwiki/page-2117「持ち主の山札の上に戻してもよい」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-067");
    s = resolveAll(pick(s, "SPEC-E-S:h"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-E-S:h");
  });
});

// ===========================================================================
describe("XG4-068 仮面ライダーW・CT", () => {
  const TEXT =
    "※モーフ 【トリガーマグナム】自軍ターン中、これがバトルエリアに出たとき、必要パワーの数字が3以下の常駐しているオペレーションを1つ選び、持ち主のゾーンに送ってもよい。";

  it("XG4-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-2136）", () => {
    expectCatalogText("XG4-068", TEXT);
    expectUnit("XG4-068", { name: "仮面ライダーW・CT", category: ["ET", "OT"], size: "S", bp: 2000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRarityIn("XG4-068", ["SR"]);
  });

  morphTests("XG4-068", "XG4-067", "XG4-073", "atwiki/page-2136");

  // RK-075 ミラーワールド（必要パワー0）・RK-078 クロックアップ（必要パワー4）を常駐させる。
  const entered = () =>
    settle(enterNow(battle({ rush: [inst("XG4-068", "ct")], operation: [resident("RK-075", "own")] }, { operation: [resident("RK-075", "en"), resident("RK-078", "cu")], deck: deckCards(3, "e") }), "XG4-068:ct"));

  it("XG4-068:【トリガーマグナム】— 自軍ターン中にバトルエリアに出たとき、必要パワー3以下の常駐オペレーション（自軍・敵軍）から1つ選べる（必要パワー4は選べない。任意）（出典: atwiki/page-2136「必要パワーの数字が3以下の常駐しているオペレーションを1つ選び」・カード評価「自軍常駐も対象にできる」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-068");
    expect(choiceIds(s)).toEqual(["RK-075:en", "RK-075:own"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-068:【トリガーマグナム】— 選んだ常駐は持ち主のゾーン（パワーゾーンかコマンドゾーン）に送られる（出典: atwiki/page-2136「持ち主のゾーンに送ってもよい」・カード評価「パワーだけでなくコマンドにも常駐を飛ばせる」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-068");
    s = resolveAll(pickThrough(pick(s, "RK-075:en"), "XG4-068", ["power"]));
    expect(["power", "command"]).toContain(zoneOf(s, "player2", "RK-075:en"));
  });

  it("XG4-068:【トリガーマグナム】— 送り先（持ち主のパワーゾーンかコマンドゾーン）は効果を使った側（自軍）が選ぶ。パワーゾーンならオモテ向き、コマンドゾーンならリリース状態で敵軍のゾーンに送られる（出典: 利用者の決定 2026-10-20・questions-all.md U-13）", () => {
    const s = pick(entered(), "RK-075:en");
    expectChoiceFrom(s, "player1", "XG4-068");
    expect(choiceIds(s)).toEqual(["command", "power"]);
    const p = resolveAll(pick(s, "power"));
    expect(zoneOf(p, "player2", "RK-075:en")).toBe("power");
    expect(p.players.player2.power.find((c) => c.instanceId === "RK-075:en")?.faceDown).not.toBe(true);
    const c = resolveAll(pick(s, "command"));
    expect(zoneOf(c, "player2", "RK-075:en")).toBe("command");
    expect(c.players.player2.command.find((x) => x.instanceId === "RK-075:en")?.commandHeld).not.toBe(true);
  });

  it("XG4-068:【トリガーマグナム】— 持ち主（敵軍）のコマンドゾーンが5枚なら、送り先はパワーゾーンだけ（オモテ向き）（出典: 利用者の決定 2026-10-20・questions-all.md U-13）", () => {
    let s = settle(
      enterNow(
        battle({ rush: [inst("XG4-068", "ct")] }, { operation: [resident("RK-075", "en")], command: Array.from({ length: 5 }, (_, i) => released("TST-OP", `fc${i}`)), deck: deckCards(3, "e") }),
        "XG4-068:ct",
      ),
    );
    s = pick(s, "RK-075:en");
    expectChoiceFrom(s, "player1", "XG4-068");
    expect(choiceIds(s)).toEqual(["power"]);
    s = resolveAll(pick(s, "power"));
    expect(zoneOf(s, "player2", "RK-075:en")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "RK-075:en")?.faceDown).not.toBe(true);
    expect(s.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("XG4-069 仮面ライダーW・FJ（XG4）", () => {
  const TEXT =
    "※モーフ 【ショルダー・ファング】これがバトルエリアに出たとき、特徴「獣」または「恐竜」を持つ自軍コマンドを1つ選び、ホールドしてもよい。そうしたとき、必要パワーの数字が同じ敵軍Sユニットを3体まで選びホールドする。";

  it("XG4-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-2043）", () => {
    expectCatalogText("XG4-069", TEXT);
    expectUnit("XG4-069", { name: "仮面ライダーW・FJ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: "3+", comboNumber: undefined, features: ["仮面ライダー", "男", "ダブルドライバー"], rushCondition: "state_gate" });
    expectRarityIn("XG4-069", ["R"]);
  });

  it("XG4-069: 追加条件 — 特徴「獣」または「恐竜」を持つ自軍コマンドがあればラッシュできる（なければできない）（出典: atwiki/page-2043「追加条件：特徴「獣」または「恐竜」を持つ自軍コマンドがある」）（既知の不具合: CARD-XG4-069 追加条件「特徴「獣」または「恐竜」を持つ自軍コマンドがある」がオペレーションカードしか数えず、ユニットカードのコマンドではラッシュできない）", () => {
    const mk = (withBeast: boolean) =>
      board({ hand: [inst("XG4-069", "fj")], command: [...releasedCat("DA", 1), ...(withBeast ? [released("SPEC-BEAST", "bc")] : [])], power: powerCards(3) });
    expect(canStartRush(mk(false), "player1", "XG4-069:fj")).toBe(false);
    const r = rushFromHand(mk(true), "player1", "XG4-069:fj");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG4-069:fj")).toBe("rush");
  });

  morphTests("XG4-069", "XG4-067", "XG4-073", "atwiki/page-2043");

  const entered = () =>
    settle(enterNow(battle({ rush: [inst("XG4-069", "fj")], command: [released("SPEC-BEAST", "bc"), ...releasedCat("DA", 1)] }, { battle: [inst("SPEC-E-C2", "a"), inst("SPEC-E-C3", "c")], rush: [inst("SPEC-E-C2", "b")], deck: deckCards(3, "e") }), "XG4-069:fj"));

  it("XG4-069:【ショルダー・ファング】— バトルエリアに出たとき、特徴「獣」「恐竜」を持つ自軍コマンドから1つ選んでホールドできる（任意）（出典: atwiki/page-2043「特徴「獣」または「恐竜」を持つ自軍コマンドを1つ選び、ホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG4-069");
    expect(canSkip(s)).toBe(true);
    if (choiceIds(s).length > 0) expect(choiceIds(s)).toEqual(["SPEC-BEAST:bc"]);
  });

  it("XG4-069:【ショルダー・ファング】— ホールドすると、必要パワーの数字が同じ敵軍 S ユニットを3体まで（1〜2体でもよい）選びホールドする（出典: atwiki/page-2043「必要パワーの数字が同じ敵軍Sユニットを3体まで選びホールドする」・同 Q1・Q2「3体までの任意の数を選びホールドすることができます」）", () => {
    let s = entered();
    expectChoiceFrom(s, "player1", "XG4-069");
    s = resolveAll(pickThrough(s, "XG4-069", ["SPEC-BEAST:bc", "SPEC-E-C2:a", "SPEC-E-C2:b"]));
    const held = (id: string) => [...s.players.player2.battle, ...s.players.player2.rush].find((c) => c.instanceId === id)?.commandHeld === true;
    expect(s.players.player1.command.find((c) => c.instanceId === "SPEC-BEAST:bc")?.commandHeld).toBe(true);
    expect(held("SPEC-E-C2:a")).toBe(true);
    expect(held("SPEC-E-C2:b")).toBe(true);
    expect(held("SPEC-E-C3:c")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-070 クレイドール・ドーパント", () => {
  const TEXT = "【不死身のドーパント】敵軍ターン中、これが撃破されて捨札になるとき、捨札にするかわりに持ち主の山札に戻してシャッフルする。";

  it("XG4-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-2084）", () => {
    expectCatalogText("XG4-070", TEXT);
    expectUnit("XG4-070", { name: "クレイドール・ドーパント", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["怪人", "女", "ドーパント"] });
    expectRarityIn("XG4-070", ["N"]);
  });

  it("XG4-070:【不死身のドーパント】— 敵軍ターン中に撃破されると、捨札にならず持ち主の山札に戻る（強制）（出典: atwiki/page-2084「捨札にするかわりに持ち主の山札に戻してシャッフルする」・カード評価「効果の発動が強制」）", () => {
    const s = resolveAll(settle(destroyedInEnemyBattle(inst("XG4-070", "cd"), {}, {}, EXTRA)));
    expect(zoneOf(s, "player1", "XG4-070:cd")).toBe("deck");
  });

  it("XG4-070:【不死身のドーパント】— 自軍ターン中に撃破されたときは捨札になる（出典: atwiki/page-2084「敵軍ターン中」）", () => {
    const s = resolveAll(settle(attack(battle({ battle: [inst("XG4-070", "cd")] }, { battle: [inst("SPEC-E-5000", "t")] }), "XG4-070:cd", "SPEC-E-5000:t")));
    expect(zoneOf(s, "player1", "XG4-070:cd")).toBe("discard");
  });
});

