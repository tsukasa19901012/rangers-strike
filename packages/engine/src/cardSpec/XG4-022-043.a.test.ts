/**
 * カード別スペック: XG4-022〜XG4-030（クロスギャザー ザ・ジェットアクセル シュリケンジャー（XG4）〜ゲキチョッパー（XG4））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-XG4-023 シュリケンジャーFM の読み替え）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に XG のカードの項はない
 *     （「XG4-」とカード名で検索。card_1・card_5・rider_1 にあるのは RS-325 天空勇者マジシャインの項だけで、XG4-026 とは本文が違う）。
 *     atwiki に転載された公式 Q&A（atwiki/page-2045 にある XG4-023 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG4-NNN.md。XG4-023 はライブ写し pages/2145.txt もある）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-KW-RESIST-01・R-KW-RC-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG4-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attackUntilRegister,
  canConfirm,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  confirm,
  deckCards,
  enterNow,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  faceDown,
  faceUp,
  heldN,
  inst,
  mount,
  mountAndRideOff,
  ncEnter,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  reanimateTests,
  registerOffered,
  released,
  resolveAll,
  returnAll,
  ridingPair,
  rushBoard,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./XG4-022-043.helpers";

const MECHA = sUnit("SPEC-MECHA", { category: "MA", bp: 1000, features: ["メカ"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "MA", bp: 1000 });
const E_S = sUnit("SPEC-E-S", { bp: 1000 });
const E_S2 = sUnit("SPEC-E-S2", { bp: 2000 });
const E_M = sUnit("SPEC-E-M", { bp: 3000, size: "M" });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C3M = sUnit("SPEC-C3M", { bp: 3000, powerCost: 3, size: "M" });
const B4000 = sUnit("SPEC-B4000", { bp: 4000 });
const B4500 = sUnit("SPEC-B4500", { bp: 4500 });
const B4000M = sUnit("SPEC-B4000M", { bp: 4000, size: "M" });
const MAGIC = sUnit("SPEC-MAGIC", { category: "MA", bp: 2000, features: ["魔法"] });
const MAGIC_M = sUnit("SPEC-MAGIC-M", { category: "MA", bp: 3000, size: "M", features: ["魔法"] });
const GEKI_M4 = sUnit("SPEC-GEKI-M4", { category: "WB", bp: 4000, size: "M", powerCost: 4, features: ["激気"] });
const GEKI_M5 = sUnit("SPEC-GEKI-M5", { category: "WB", bp: 5000, size: "M", powerCost: 3, features: ["激気"] });
const GEKI_S = sUnit("SPEC-GEKI-S", { category: "WB", bp: 3000, features: ["激気"] });
const E9000 = sUnit("SPEC-E9000", { bp: 9000 });
const E9500 = sUnit("SPEC-E9500", { bp: 9500 });
const EXTRA = [MECHA, PLAIN, E_S, E_S2, E_M, C2, C3, C4, C3M, B4000, B4500, B4000M, MAGIC, MAGIC_M, GEKI_M4, GEKI_M5, GEKI_S, E9000, E9500];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
/** 「次の効果を発動できる」等の確認型の選択が開いていれば発動を選ぶ。 */
const yes = (s: GameState) => (s.pendingEffectChoice && canConfirm(s) && choiceIds(s).length === 0 ? confirm(s) : s);

// ===========================================================================
describe("XG4-022 シュリケンジャー（XG4）", () => {
  const TEXT = "【ニンジャミセン】これが自軍ラッシュエリアにある間、特徴「メカ」を持つ自軍ユニットがバトルエリアに出たとき、自軍コマンドを1つ選びリリースしてもよい。";

  it("XG4-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-2045）", () => {
    expectCatalogText("XG4-022", TEXT);
    expectUnit("XG4-022", { name: "シュリケンジャー", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["グリーン", "男", "忍者"] });
    expectRarityIn("XG4-022", ["R"]);
  });

  const entered = (unit: string) =>
    enterNow(battle({ rush: [inst("XG4-022", "sj"), inst(unit.split(":")[0]!, unit.split(":")[1]!)], command: [...heldN(2), released("TST-OP", "rc")] }), unit);

  it("XG4-022:【ニンジャミセン】— これが自軍ラッシュエリアにある間、特徴「メカ」を持つ自軍ユニットがバトルエリアに出たとき、ホールド状態の自軍コマンドから1つ選べる（任意）（出典: atwiki/page-2045「自軍コマンドを1つ選びリリースしてもよい」）", () => {
    const s = entered("SPEC-MECHA:m");
    expectChoiceFrom(s, "player1", "XG4-022");
    expect(choiceIds(s)).toEqual(["TST-OP:hc0", "TST-OP:hc1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-022:【ニンジャミセン】— 選んだコマンドはリリース状態になる（出典: atwiki/page-2045「リリースしてもよい」・カード評価「コマンド確保」）", () => {
    const s = resolveAll(pick(entered("SPEC-MECHA:m"), "TST-OP:hc0"));
    expect(cardIn(s, "player1", "TST-OP:hc0")?.commandHeld).toBe(false);
    expect(cardIn(s, "player1", "TST-OP:hc1")?.commandHeld).toBe(true);
  });

  it("XG4-022:【ニンジャミセン】— 「メカ」を持たないユニットが出たときは発動しない（出典: atwiki/page-2045「特徴「メカ」を持つ自軍ユニット」）", () => {
    expect(entered("SPEC-PLAIN:p").pendingEffectChoice?.sourceCardId).not.toBe("XG4-022");
  });

  it("XG4-022:【ニンジャミセン】— これがバトルエリアにあるときは発動しない（出典: atwiki/page-2045「これが自軍ラッシュエリアにある間」）", () => {
    const s = enterNow(battle({ battle: [inst("XG4-022", "sj")], rush: [inst("SPEC-MECHA", "m")], command: heldN(2) }), "SPEC-MECHA:m");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-022");
  });
});

// ===========================================================================
describe("XG4-023 シュリケンジャーFM（XG4）", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「シュリケンジャー」のカードを1枚選び、自軍ラッシュエリアに出す。 【超忍法・秘打千本ノック】自軍コマンドを好きな数選び、自分の手札に戻してもよい。そうしたとき、相手は、戻した数と同じ数まで可能な限り自分自身のラッシュエリアのSユニットを選び、持ち主の山札の下に好きな順番で戻す。";

  it("XG4-023: カタログ本文（読み替え後）・スペックが出典と一致（出典: atwiki/page-2145「修正後は以下」・R-ERR-XG4-023）", () => {
    expectCatalogText("XG4-023", TEXT);
    expectUnit("XG4-023", { name: "シュリケンジャーFM", category: "MA", size: "S", bp: 3500, sp: 1, powerCost: "7-", comboNumber: 1, features: ["グリーン", "男", "忍者"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG4-023", ["R"]);
  });

  zordDownTests("XG4-023", "XG4-022", "シュリケンジャー", "atwiki/page-2145", "MA");
  reanimateTests("XG4-023", "XG4-022", "シュリケンジャー", "atwiki/page-2145");

  const ENEMY = () => ({ rush: [inst("SPEC-E-S", "a"), inst("SPEC-E-S2", "b"), inst("SPEC-E-S", "c"), inst("SPEC-E-M", "m")], battle: [inst("SPEC-E-S", "bt")], deck: deckCards(3, "e") });
  const nc = (p2 = ENEMY()) => ncEnter("XG4-023:fm", 0, { command: [released("TST-OP", "c1"), released("TST-OP-MA", "c2"), ...heldN(1)] }, p2, EXTRA);

  it("XG4-023: NC【超忍法・秘打千本ノック】— 1番目に出ると、自軍コマンド（ホールド状態を含む）を好きな数選べる（0個でもよい）（出典: atwiki/page-2145「自軍コマンドを好きな数選び、自分の手札に戻してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-023");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:c2", "TST-OP:c1", "TST-OP:hc0"]);
    expect(canSkip(s) || canConfirm(s)).toBe(true);
  });

  it("XG4-023: NC — 戻したコマンドは自分の手札に入り、相手は戻した数（2）だけ自分のラッシュエリアの S ユニットを選んで山札の下に戻す（M ユニット・バトルエリアは選べない）（出典: atwiki/page-2145「相手は、戻した数と同じ数まで可能な限り自分自身のラッシュエリアのSユニットを選び、持ち主の山札の下に好きな順番で戻す」・atwiki/page-2045 Q1）", () => {
    let s = pick(pick(nc(), "TST-OP:c1"), "TST-OP:hc0");
    if (canConfirm(s)) s = confirm(s);
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:hc0")).toBe("hand");
    expect(choicePlayer(s)).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E-S2:b", "SPEC-E-S:a", "SPEC-E-S:c"]);
    s = resolveAll(pickAs(pickAs(s, "player2", "SPEC-E-S:a"), "player2", "SPEC-E-S2:b"));
    expect(zoneOf(s, "player2", "SPEC-E-S:a")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E-S2:b")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E-S:c")).toBe("rush");
    expect(s.players.player2.deck.slice(-2).map((c) => c.instanceId).sort()).toEqual(["SPEC-E-S2:b", "SPEC-E-S:a"]);
  });

  it("XG4-023: NC — 2体以上戻すときは、相手が番号を付けて山札の下の順を選ぶ（出典: atwiki/page-2145「持ち主の山札の下に好きな順番で戻す」）", () => {
    let s = pick(pick(nc(), "TST-OP:c1"), "TST-OP:hc0");
    if (canConfirm(s)) s = confirm(s);
    s = pickAs(pickAs(s, "player2", "SPEC-E-S:a"), "player2", "SPEC-E-S2:b");
    expect(choicePlayer(s)).toBe("player2");
    expect(s.pendingEffectChoice?.effectId).toBe("deck_bottom_order");
    s = pickAs(s, "player2", "SPEC-E-S2:b");
    s = resolveAll(pickAs(s, "player2", "order_done"));
    expect(s.players.player2.deck.slice(-2).map((c) => c.instanceId)).toEqual(["SPEC-E-S2:b", "SPEC-E-S:a"]);
  });

  it("XG4-023: 公式Q&A — 2つ戻したら、相手は1体だけを選ぶことはできない（可能な限り戻した数だけ選ぶ）（出典: atwiki/page-2045 Q1「戻したコマンドの数まで可能な限り相手はSユニットを戻さなければなりません」）", () => {
    let s = pick(pick(nc(), "TST-OP:c1"), "TST-OP-MA:c2");
    if (canConfirm(s)) s = confirm(s);
    s = pickAs(s, "player2", "SPEC-E-S:a");
    expect(choicePlayer(s)).toBe("player2");
    expect(canSkip(s)).toBe(false);
    expect(canConfirm(s)).toBe(false);
  });

  it("XG4-023: NC — 相手のラッシュエリアの S ユニットが戻した数より少なければ、いるだけ全部戻す（出典: atwiki/page-2145「可能な限り」）", () => {
    let s = pick(pick(nc({ rush: [inst("SPEC-E-S", "a"), inst("SPEC-E-M", "m")], battle: [], deck: deckCards(3, "e") }), "TST-OP:c1"), "TST-OP-MA:c2");
    if (canConfirm(s)) s = confirm(s);
    s = resolveAll(s, ["SPEC-E-S:a"]);
    expect(zoneOf(s, "player2", "SPEC-E-S:a")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-E-M:m")).toBe("rush");
  });

  it("XG4-023: NC — コマンドを戻さなければ相手は何も戻さない（出典: atwiki/page-2145「してもよい。そうしたとき」）", () => {
    let s = nc();
    s = canSkip(s) ? skip(s) : confirm(s);
    s = resolveAll(s);
    expect(s.players.player1.command).toHaveLength(3);
    expect(zoneOf(s, "player2", "SPEC-E-S:a")).toBe("rush");
  });
});

// ===========================================================================
describe("XG4-025 デカブレイク（XG4）", () => {
  const TEXT =
    "【必殺拳ソニックハンマー】 オモテ向きの自軍パワーの枚数を数えてもよい。そうしたき、敵軍バトルエリアから、その数以下の必要パワーの数字を持つ敵軍ユニットを１体選び持ち主のパワーゾーンに送る。（この効果は、ライドオフしたときナンバーに関係なく発動する）";

  it("XG4-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-2142。本文の「そうしたき」は原文どおり）", () => {
    expectCatalogText("XG4-025", TEXT);
    expectUnit("XG4-025", { name: "デカブレイク", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 5, comboNumber: 6, features: ["男", "警察", "特キョウ"] });
    expectRarityIn("XG4-025", ["R"]);
  });

  const POWER = () => [faceUp("TST-P", "u1"), faceUp("TST-P", "u2"), faceUp("TST-P", "u3"), faceDown("TST-P", "d1"), faceDown("TST-P", "d2")];
  const ENEMY = () => ({ battle: [inst("SPEC-C2", "c2"), inst("SPEC-C3", "c3"), inst("SPEC-C4", "c4"), inst("SPEC-C3M", "c3m")], rush: [inst("SPEC-C2", "r2")], power: [] });
  const nc = () => yes(ncEnter("XG4-025:db", 5, { power: POWER() }, ENEMY(), EXTRA));

  it("XG4-025: NC【必殺拳ソニックハンマー】— 6番目に出ると、オモテ向きの自軍パワー（3枚。ウラ向きのダメージは数えない）以下の必要パワーの数字を持つ敵軍バトルエリアのユニット（サイズを問わない）から1体選ぶ（ラッシュエリアは選べない）（出典: atwiki/page-2142「オモテ向きの自軍パワーの枚数を数えてもよい。そうしたき、敵軍バトルエリアから、その数以下の必要パワーの数字を持つ敵軍ユニットを１体選び」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-025");
    expect(choiceIds(s)).toEqual(["SPEC-C2:c2", "SPEC-C3:c3", "SPEC-C3M:c3m"]);
  });

  it("XG4-025: NC — 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-2142「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-C3:c3"));
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("power");
  });

  it("XG4-025: ライドオフしたとき — ナンバーに関係なく発動する（RS-406 マシンボクサーにライドして出てライドオフ）（出典: atwiki/page-2142「（この効果は、ライドオフしたときナンバーに関係なく発動する）」・atwiki RS-406「特徴「警察」を持つ自軍Sユニットは、ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    let s = battle({ rush: [inst("XG4-025", "db"), inst("RS-406", "mb")], power: POWER() }, ENEMY());
    expect(canMount(s, "XG4-025:db", "RS-406:mb")).toBe(true);
    s = yes(mountAndRideOff(s, "XG4-025:db", "RS-406:mb"));
    expectChoiceFrom(s, "player1", "XG4-025");
    expect(choiceIds(s)).toEqual(["SPEC-C2:c2", "SPEC-C3:c3", "SPEC-C3M:c3m"]);
  });

  it("XG4-025: NC 不成立（5番目）なら発動しない（出典: atwiki/page-2142「CN：6」・R-CN-02）", () => {
    const s = ncEnter("XG4-025:db", 4, { power: POWER() }, ENEMY(), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-025");
  });
});

// ===========================================================================
describe("XG4-026 天空勇者マジシャイン（XG4）", () => {
  const TEXT =
    "【マジランプバスター】 これをラッシュしたとき、自軍コマンドを好きな数選びホールドしてもよい。そうしたとき、ホールドしたコマンド1つにつきBP2000として、そのBPの合計以下のBPを持つ敵軍ユニットを1体選び撃破する。";

  it("XG4-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-2146）", () => {
    expectCatalogText("XG4-026", TEXT);
    expectUnit("XG4-026", { name: "天空勇者マジシャイン", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["男", "魔法", "天空聖者"] });
    expectRarityIn("XG4-026", ["R"]);
  });

  const ENEMY = () => ({ battle: [inst("SPEC-B4000", "a"), inst("SPEC-B4500", "b")], rush: [inst("SPEC-B4000M", "m")] });
  const rushed = () => {
    const r = rushFromHand(board({ hand: [inst("XG4-026", "ms")], command: [released("TST-OP-MA", "pay"), released("TST-OP", "c1"), released("TST-OP", "c2"), released("TST-OP", "c3")], power: powerCards(4) }, ENEMY()), "player1", "XG4-026:ms");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG4-026:【マジランプバスター】— ラッシュしたとき、リリース状態の自軍コマンドを好きな数選べる（任意）（出典: atwiki/page-2146「自軍コマンドを好きな数選びホールドしてもよい」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-026");
    expect(choiceIds(s)).toEqual(["TST-OP:c1", "TST-OP:c2", "TST-OP:c3"]);
    expect(canSkip(s) || canConfirm(s)).toBe(true);
  });

  it("XG4-026:【マジランプバスター】— 2つホールドすれば BP4000 以下の敵軍ユニット（エリア・サイズを問わない）から1体選び撃破する（出典: atwiki/page-2146「ホールドしたコマンド1つにつきBP2000として、そのBPの合計以下のBPを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = pick(pick(rushed(), "TST-OP:c1"), "TST-OP:c2");
    if (canConfirm(s) && s.pendingEffectChoice?.selectedInstanceIds?.length) s = confirm(s);
    expect(cardIn(s, "player1", "TST-OP:c1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "TST-OP:c2")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "XG4-026");
    expect(choiceIds(s)).toEqual(["SPEC-B4000:a", "SPEC-B4000M:m"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-B4000M:m"));
    expect(zoneOf(s, "player2", "SPEC-B4000M:m")).toBe("discard");
  });

  it("XG4-026:【マジランプバスター】— ホールドしなければ何も撃破しない（出典: atwiki/page-2146「してもよい。そうしたとき」）", () => {
    let s = rushed();
    s = resolveAll(canSkip(s) ? skip(s) : confirm(s));
    expect(zoneOf(s, "player2", "SPEC-B4000:a")).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:c1")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG4-027 スカーペット", () => {
  const TEXT =
    "※特徴「魔法」を持つ自軍Sユニットは、自軍コマンドを1つホールドすればＲＣを持っていなくてもこのビークルにライドできる。 【魔法の絨毯】これがバトルエリアからラッシュエリアに戻るとき、このビークルにライドしているユニットを手札に戻してもよい。";

  it("XG4-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-2086）", () => {
    expectCatalogText("XG4-027", TEXT);
    expectVehicle("XG4-027", { name: "スカーペット", category: "MA", powerCost: 3, size: "S", features: ["魔法"] });
    expectRarityIn("XG4-027", ["N"]);
  });

  it("XG4-027: ※ — 特徴「魔法」を持つ自軍 S ユニットは、リリース状態の自軍コマンドがあればライドでき、ライドするとコマンドが1つホールドされる（出典: atwiki/page-2086「自軍コマンドを1つホールドすればＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    let s = battle({ rush: [inst("XG4-027", "sc"), inst("SPEC-MAGIC", "mg")], command: [released("TST-OP", "c1")] });
    expect(canMount(s, "SPEC-MAGIC:mg", "XG4-027:sc")).toBe(true);
    s = mount(s, "SPEC-MAGIC:mg", "XG4-027:sc");
    expect(cardIn(s, "player1", "TST-OP:c1")?.commandHeld).toBe(true);
  });

  it("XG4-027: ※ —「魔法」を持たない S ユニット・「魔法」の M ユニットはライドできない（出典: atwiki/page-2086「特徴「魔法」を持つ自軍Sユニット」）", () => {
    const s = battle({ rush: [inst("XG4-027", "sc"), inst("SPEC-PLAIN", "p"), inst("SPEC-MAGIC-M", "mm")], command: [released("TST-OP", "c1")] });
    expect(canMount(s, "SPEC-PLAIN:p", "XG4-027:sc")).toBe(false);
    expect(canMount(s, "SPEC-MAGIC-M:mm", "XG4-027:sc")).toBe(false);
  });

  /** 自軍スタートフェイズ、バトルエリアにスカーペットとそれにライドした「魔法」のユニットがある。 */
  const start = () => st({ phase: "start", player1: { battle: [...ridingPair("SPEC-MAGIC", "mg", "XG4-027", "sc")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);

  it("XG4-027:【魔法の絨毯】— バトルエリアからラッシュエリアに戻るとき、ライドしているユニットを手札に戻すかを選べ、戻せば手札に入る（出典: atwiki/page-2086「これがバトルエリアからラッシュエリアに戻るとき、このビークルにライドしているユニットを手札に戻してもよい」）", () => {
    let s = returnAll(start());
    expectChoiceFrom(s, "player1", "XG4-027");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(s.pendingEffectChoice?.validInstanceIds.includes("SPEC-MAGIC:mg") ? pick(s, "SPEC-MAGIC:mg") : confirm(s));
    expect(zoneOf(s, "player1", "SPEC-MAGIC:mg")).toBe("hand");
    expect(zoneOf(s, "player1", "XG4-027:sc")).toBe("rush");
  });

  it("XG4-027:【魔法の絨毯】— 戻さなければ、ライドしたままラッシュエリアに戻る（出典: atwiki/page-2086「してもよい」）", () => {
    let s = returnAll(start());
    if (s.pendingEffectChoice?.sourceCardId === "XG4-027") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-MAGIC:mg")).toBe("rush");
  });
});

// ===========================================================================
describe("XG4-029 ゲキバイオレット（XG4）", () => {
  const TEXT = "【天地転変打】「SP1」特徴「激気」を持つ自軍MユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを敵軍バトルエリアから1体選び撃破する。";

  it("XG4-029: カタログ本文・スペックが出典と一致（出典: atwiki/page-2153）", () => {
    expectCatalogText("XG4-029", TEXT);
    expectUnit("XG4-029", { name: "ゲキバイオレット", category: ["WB", "MA"], size: "S", bp: 3000, sp: "1/3", powerCost: 5, comboNumber: 2, features: ["バイオレット", "男", "激気"] });
    expectRarityIn("XG4-029", ["R"]);
  });

  const ENEMY = () => ({ battle: [inst("SPEC-E9000", "a"), inst("SPEC-E9500", "b"), inst("SPEC-E-M", "m")], rush: [inst("SPEC-E-S", "r")] });
  /** 「激気」の M ユニット（BP4000 をバトルエリアの1番目、BP5000 をラッシュエリア）と、「激気」の S ユニット（ラッシュエリア）。 */
  const nc = () => ncEnter("XG4-029:gv", 0, { battle: [inst("SPEC-GEKI-M4", "g4")], rush: [inst("SPEC-GEKI-M5", "g5"), inst("SPEC-GEKI-S", "gs")] }, ENEMY(), EXTRA);

  it("XG4-029: NC【天地転変打】— 2番目に出ると「SP1」を得る（出典: atwiki/page-2153「「SP1」」）", () => {
    let s = nc();
    for (let i = 0; i < 3 && s.pendingEffectChoice; i++) s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    expect(spOf(s, "player1", "XG4-029:gv")).toBe(1);
  });

  it("XG4-029: NC — 「激気」の自軍 M ユニット（エリアを問わない。S ユニットは数えない）の BP の合計（9000）以下の BP を持つ敵軍バトルエリアのユニットから1体選ぶ（ラッシュエリアは選べない。見送れない）（出典: atwiki/page-2153「特徴「激気」を持つ自軍MユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを敵軍バトルエリアから1体選び撃破する」・カード評価「エリアを問わない」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-029");
    expect(choiceIds(s)).toEqual(["SPEC-E-M:m", "SPEC-E9000:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-029: NC — 選んだ敵軍ユニットは撃破される（出典: atwiki/page-2153「撃破する」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-E9000:a"));
    expect(zoneOf(s, "player2", "SPEC-E9000:a")).toBe("discard");
  });
});

// ===========================================================================
describe("XG4-030 ゲキチョッパー（XG4）", () => {
  const TEXT =
    "※レジスト 【千千斬】自軍ラッシュエリアから、特徴「激気」を持つ自軍Mユニットを1体選びホールドしてもよい。そうしたとき、ホールドしたユニットの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを全て撃破する。";

  it("XG4-030: カタログ本文・スペックが出典と一致（出典: atwiki/page-2100）", () => {
    expectCatalogText("XG4-030", TEXT);
    expectUnit("XG4-030", { name: "ゲキチョッパー", category: ["WB", "MA"], size: "S", bp: 4000, sp: "1/2", powerCost: 5, comboNumber: 1, features: ["ホワイト", "男", "激気"] });
    expectRarityIn("XG4-030", ["NR"]);
  });

  it("XG4-030: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2100 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-030", "gc")] }, "XG4-030:gc"))).toBe(true);
  });

  const ENEMY = () => ({ battle: [inst("SPEC-C4", "b4"), inst("SPEC-C3", "b3")], rush: [inst("SPEC-C4", "r4"), inst("SPEC-C3M", "m3")] });
  const nc = () =>
    ncEnter("XG4-030:gc", 0, { rush: [inst("SPEC-GEKI-M4", "g4"), inst("SPEC-GEKI-S", "gs")], battle: [], command: [] }, ENEMY(), EXTRA);
  const ncWithBattleGeki = () => ncEnter("XG4-030:gc", 0, { rush: [inst("SPEC-GEKI-M4", "g4")] }, ENEMY(), EXTRA);

  it("XG4-030: NC【千千斬】— 1番目に出ると、自軍ラッシュエリアの「激気」の M ユニットから1体選べる（S ユニットは選べない。任意）（出典: atwiki/page-2100「自軍ラッシュエリアから、特徴「激気」を持つ自軍Mユニットを1体選びホールドしてもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-030");
    expect(choiceIds(s)).toEqual(["SPEC-GEKI-M4:g4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-030: NC — 選んだユニットはホールド状態になり、その必要パワーの数字（4）と同じ数字の敵軍 S ユニットがエリアを問わずすべて撃破される（M ユニット・数字が違うものは残る）（出典: atwiki/page-2100「ホールドしたユニットの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを全て撃破する」）", () => {
    const s = resolveAll(pick(ncWithBattleGeki(), "SPEC-GEKI-M4:g4"));
    expect(cardIn(s, "player1", "SPEC-GEKI-M4:g4")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-C4:b4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C4:r4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:b3")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C3M:m3")).toBe("rush");
  });

  it("XG4-030: NC — ホールドしなければ何も撃破しない（出典: atwiki/page-2100「してもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(nc()));
    expect(zoneOf(s, "player2", "SPEC-C4:b4")).toBe("battle");
  });
});
