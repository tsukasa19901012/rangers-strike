/**
 * カード別スペック: RK-253〜RK-259（ザ・マスクドライダーEXP vol.4 親子の絆〜ジェネラルシャドウ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-253」〜「RK-259」とカード名で検索）。atwiki に転載された公式 Q&A（RK-253 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAG-01、R-KW-RESIST、R-RIDE 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-253〜259 とカード名で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  accept,
  activateResident,
  attack,
  attackUntilRegister,
  attackersOf,
  bpOf,
  canActivateResident,
  canMount,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  damageOf,
  deckCards,
  enemyBoard,
  enemyRcRideOff,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceUp,
  featuresOf,
  inst,
  mount,
  nextPhase,
  p1Battle,
  pick,
  pickAs,
  rcRideOff,
  registerOffered,
  releasedN,
  resident,
  resolveAll,
  riding,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toTurnEnd,
  zoneOf,
} from "./RK13-253-273.helpers";

const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const C6 = sUnit("SPEC-C6", { bp: 1000, powerCost: 6 });
const C7 = sUnit("SPEC-C7", { bp: 1000, powerCost: 7 });
const C7M = sUnit("SPEC-C7M", { bp: 1000, powerCost: "7-" } as never);
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "WB", bp: 1000, features: ["女"] });
const FEMALE_M = sUnit("SPEC-FEMALE-M", { category: "WB", bp: 1000, features: ["女"], size: "M" });
const MALE = sUnit("SPEC-MALE", { category: "WB", bp: 1000, features: ["男"] });
const IMAGIN = sUnit("SPEC-IMAGIN", { category: "OT", bp: 1000, features: ["イマジン"] });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const E6000 = sUnit("SPEC-E6000", { bp: 6000, sp: 1 });
const E7000 = sUnit("SPEC-E7000", { bp: 7000, sp: 1 });
const NOSP2000 = sUnit("SPEC-NOSP2000", { bp: 2000, sp: undefined });
const SPX2000 = sUnit("SPEC-SPX2000", { bp: 2000, sp: "special" } as never);
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const EXTRA = [
  PLAIN_VEHICLE, C0, C1, C2, C3, C4, C5, C6, C7, C7M, M2, RCU, KAMEN, FEMALE, FEMALE_M, MALE, IMAGIN,
  E1000, E2000, E5000, E6000, E7000, NOSP2000, SPX2000, EM2000,
];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-253 親子の絆", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズごとに1度だけ、『相手は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す』を実行してもよい。そうしたとき、自分は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す。";

  it("RK-253: カタログ本文・スペックが出典と一致（出典: atwiki/page-1376）", () => {
    expectCatalogText("RK-253", TEXT);
    expectOpStats("RK-253", { name: "親子の絆", category: "MA", powerCost: 3 });
    expectRarityIn("RK-253", ["N"]);
  });

  const okBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushPhase({ operation: [resident("RK-253", "ok")], hand: [inst("SPEC-C1", "h1")], ...p1 }, { hand: [inst("SPEC-C2", "eh")], ...p2 });

  it.fails("RK-253: 自軍ラッシュフェイズに、太字部分『相手は1枚ドローしてから自分自身の手札を1枚選び、自分自身の山札の下に戻す』を実行できる — 相手は1枚ドローしてから、手札（ドローしたカードを含む）から1枚選ぶ（出典: atwiki/page-1376）", () => {
    const s0 = okBoard();
    expect(canActivateResident(s0, "RK-253:ok")).toBe(true);
    const s = activateResident(s0, "RK-253:ok");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
    expectChoiceFrom(s, "player2", "RK-253");
    expect(choiceIds(s)).toEqual(["SPEC-C2:eh", "TST-OP:e0"]);
  });

  // atwiki/page-1376 Q1「いいえ、できません。」
  it.fails("RK-253: 公式Q&A — 相手は太字部分の実行を拒否できない（相手の選択は見送れない）（出典: atwiki/page-1376 Q1）", () => {
    const s = activateResident(okBoard(), "RK-253:ok");
    expect(choicePlayer(s)).toBe("player2");
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-253: 相手が選んだカードは相手の山札の下に戻る（出典: atwiki/page-1376「自分自身の山札の下に戻す」）", () => {
    const s = pickAs(activateResident(okBoard(), "RK-253:ok"), "player2", "SPEC-C2:eh");
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-C2:eh");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
  });

  it.fails("RK-253: そうしたとき、自分は1枚ドローしてから、自分の手札（ドローしたカードを含む）から1枚選ぶ（見送れない）（出典: atwiki/page-1376「そうしたとき、自分は1枚ドローしてから自分自身の手札を1枚選び」）", () => {
    const s = pickAs(activateResident(okBoard(), "RK-253:ok"), "player2", "SPEC-C2:eh");
    expect(zoneOf(s, "player1", "TST-OP:dk0")).toBe("hand");
    expectChoiceFrom(s, "player1", "RK-253");
    expect(choiceIds(s)).toEqual(["SPEC-C1:h1", "TST-OP:dk0"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-253: 自分が選んだカードは自分の山札の下に戻る（出典: atwiki/page-1376「自分自身の山札の下に戻す」）", () => {
    let s = pickAs(activateResident(okBoard(), "RK-253:ok"), "player2", "SPEC-C2:eh");
    s = resolveAll(pick(s, "SPEC-C1:h1"));
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-C1:h1");
    expect(zoneOf(s, "player1", "TST-OP:dk0")).toBe("hand");
  });

  it.fails("RK-253: 自軍ラッシュフェイズごとに1度だけ（同じラッシュフェイズに2回目は実行できない）（出典: atwiki/page-1376「自軍ラッシュフェイズごとに1度だけ」）", () => {
    let s = pickAs(activateResident(okBoard(), "RK-253:ok"), "player2", "SPEC-C2:eh");
    s = resolveAll(pick(s, "SPEC-C1:h1"));
    expect(canActivateResident(s, "RK-253:ok")).toBe(false);
  });

  it("RK-253: 自軍バトルフェイズには実行できない（出典: atwiki/page-1376「自軍ラッシュフェイズごとに」）", () => {
    expect(canActivateResident(nextPhase(okBoard()), "RK-253:ok")).toBe(false);
  });

  it.fails("RK-253: ※タッグ — 太字部分のかわりに、他の自軍のタッグの常駐（RK-242 クライマックス刑事）の太字部分『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行して、そうしたときの「自分は1枚ドローしてから…山札の下に戻す」を行える（出典: atwiki/page-1376 本文・カード評価「クライマックス刑事のテキストと置き換えると、手札1枚でパワーゾーンのカード1枚を確実に回収できる」・R-KW-TAG-01）", () => {
    let s = activateResident(okBoard({ operation: [resident("RK-253", "ok"), resident("RK-242", "cx")], power: [faceUp("TST-P", "up")] }), "RK-253:ok");
    expectChoiceFrom(s, "player1", "RK-253");
    expect(choiceIds(s)).toEqual(["RK-242:cx", "RK-253:ok"]);
    s = pick(pick(s, "RK-242:cx"), "TST-P:up");
    // パワーゾーンのカードは山札の上に戻り、続く「1枚ドロー」で手札に入る。相手はドローしない。
    expect(zoneOf(s, "player1", "TST-P:up")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("deck");
    expectChoiceFrom(s, "player1", "RK-253");
    s = resolveAll(pick(s, "SPEC-C1:h1"));
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-C1:h1");
  });

  it.fails("RK-253: ※タッグ — 他の自軍のタッグの常駐（RK-242 クライマックス刑事）が、太字部分のかわりにこれの太字部分（相手のドローと山札の下に戻す）を実行して、その常駐の「そうしたとき」以降を行える（出典: atwiki/page-1376 カード評価「タッグのテキスト置き換えとしても非常に優秀。相手は手札を入れ替えるのみだが、こちらは強力なタッグオペレーションの効果を使える」・R-KW-TAG-01）", () => {
    let s = activateResident(okBoard({ operation: [resident("RK-242", "cx"), resident("RK-253", "ok")], rush: [inst("SPEC-IMAGIN", "im")] }), "RK-242:cx");
    expect(choiceIds(s)).toContain("RK-253:ok");
    s = pick(s, "RK-253:ok");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("hand");
    expect(choicePlayer(s)).toBe("player2");
    s = resolveAll(pickAs(s, "player2", "SPEC-C2:eh"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-C2:eh");
    // RK-242 の「そうしたとき」以降（自軍のイマジンに「警察」）。親子の絆の「自分は1枚ドロー」は行わない。
    expect(featuresOf(s, "player1", "SPEC-IMAGIN:im")).toContain("警察");
    expect(zoneOf(s, "player1", "TST-OP:dk0")).toBe("deck");
  });
});

// ===========================================================================
describe("RK-254 仮面ライダーストロンガー", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ストロンガー電キック】このターン、これはBP+2000される。さらに、このユニットのBPがすべてのユニットのBPとくらべて一番高ければ、このターン、これはSP1になる。";

  it("RK-254: カタログ本文・スペックが出典と一致（出典: atwiki/page-1398）", () => {
    expectCatalogText("RK-254", TEXT);
    expectStats("RK-254", { name: "仮面ライダーストロンガー", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-254", ["SR"]);
  });

  it("RK-254: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1398・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-254", "st")] }, "RK-254:st"))).toBe(true);
  });

  const kick = (p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) =>
    resolveAll(rcRideOff(board({ rush: [inst("RK-254", "st"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-254:st", "SPEC-VEHICLE:v"));
  /** 印刷 SP「！」のままの SP（比較用。RC を発動していないストロンガー）。 */
  const baseSp = () => spOf(board({ battle: [inst("RK-254", "st")] }), "player1", "RK-254:st");

  it.fails("RK-254: 【ストロンガー電キック】RC — このターン、BP+2000（6000）され、BP がすべてのユニットの中で一番高ければ「SP1」になる（出典: atwiki/page-1398）", () => {
    const s = kick({ battle: [inst("SPEC-E5000", "e")] });
    expect(bpOf(s, "player1", "RK-254:st")).toBe(6000);
    expect(spOf(s, "player1", "RK-254:st")).toBe(1);
  });

  it("RK-254: BP+2000 した後の BP より高い敵軍ユニットがいれば「SP1」にならない（BP+2000 だけ）（出典: atwiki/page-1398「このユニットのBPがすべてのユニットのBPとくらべて一番高ければ」）", () => {
    const s = kick({ battle: [inst("SPEC-E7000", "e")] });
    expect(bpOf(s, "player1", "RK-254:st")).toBe(6000);
    expect(spOf(s, "player1", "RK-254:st")).toBe(baseSp());
  });

  it("RK-254: 比べるのは「すべてのユニット」— 自軍ラッシュエリアのユニットの BP の方が高くても「SP1」にならない（出典: atwiki/page-1398「すべてのユニット」・カード評価「すべてのユニットと比べて最大でなければ発動できない」）", () => {
    const s = kick({}, { rush: [inst("RK-254", "st"), inst("SPEC-VEHICLE", "v"), inst("SPEC-E7000", "own")] });
    expect(spOf(s, "player1", "RK-254:st")).toBe(baseSp());
  });

  it.fails("RK-254: BP が同じユニットがいるだけなら「一番高い」として「SP1」になる（出典: atwiki/page-1398 カード評価「BPが同値のユニットがいる場合もSP1になる」）", () => {
    const s = kick({ battle: [inst("SPEC-E6000", "e")] });
    expect(spOf(s, "player1", "RK-254:st")).toBe(1);
  });

  it("RK-254: ライドオフしなければ（RC が発動しなければ）BP は 4000 のまま（出典: atwiki/page-1398「CN：RC」）", () => {
    const s = enter(board({ rush: [inst("RK-254", "st")] }), "RK-254:st");
    expect(bpOf(s, "player1", "RK-254:st")).toBe(4000);
  });
});

// ===========================================================================
describe("RK-255 電波人間タックル（2nd）", () => {
  const TEXT =
    "※特徴「仮面ライダー」を持つユニットが自軍バトルエリアにあれば、これは敵軍Sユニットにアタックされない。 【ウルトラサイクロン】このユニットを捨札にして、次の効果を発動してもよい⇒敵軍バトルエリアから必要パワーの数字が3以下のユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ敵軍コマンドを1つ選び、捨札にしてから置く。";

  it("RK-255: カタログ本文・スペックが出典と一致（出典: atwiki/page-1345）", () => {
    expectCatalogText("RK-255", TEXT);
    expectStats("RK-255", { name: "電波人間タックル（2nd）", category: "ET", size: "S", bp: 1000, sp: "1/5" as never, powerCost: 2, comboNumber: "RC", features: ["女", "改造人間", "2nd"] });
    expectRarityIn("RK-255", ["N"]);
  });

  const guarded = (p1Battle: GameState["players"]["player1"]["battle"], p1Rush: GameState["players"]["player1"]["rush"] = []) =>
    enemyTurn({ battle: p1Battle, rush: p1Rush }, { battle: [inst("SPEC-E2000", "s"), inst("SPEC-EM2000", "m")] });

  it("RK-255: ※ 特徴「仮面ライダー」を持つユニットが自軍バトルエリアにあれば、敵軍 S ユニットにアタックされない（M ユニットにはアタックされる）（出典: atwiki/page-1345）", () => {
    const s = guarded([inst("SPEC-KAMEN", "k"), inst("RK-255", "tk")]);
    expect(attackersOf(s, "RK-255:tk")).toEqual(["SPEC-EM2000:m"]);
  });

  it("RK-255: ※ 自軍バトルエリアに「仮面ライダー」のユニットがなければ（ラッシュエリアにいるだけでも）アタックされる（出典: atwiki/page-1345「自軍バトルエリアにあれば」）", () => {
    expect(attackersOf(guarded([inst("RK-255", "tk")]), "RK-255:tk")).toEqual(["SPEC-E2000:s", "SPEC-EM2000:m"]);
    expect(attackersOf(guarded([inst("RK-255", "tk")], [inst("SPEC-KAMEN", "k")]), "RK-255:tk")).toEqual(["SPEC-E2000:s", "SPEC-EM2000:m"]);
  });

  const cycloneEnemy = { battle: [inst("SPEC-C3", "c3"), inst("SPEC-C4", "c4"), inst("SPEC-M2", "m2")], rush: [inst("SPEC-C1", "r1")], command: releasedN(2, "TST-OP", "ec") };
  const cyclone = (p2: Partial<GameState["players"]["player2"]> = cycloneEnemy) =>
    rcRideOff(board({ rush: [inst("RK-255", "tk"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-255:tk", "SPEC-VEHICLE:v");

  it.fails("RK-255: 【ウルトラサイクロン】RC — 発動するかを選べ（任意）、選べるのは必要パワーの数字が3以下の敵軍バトルエリアのユニット（サイズを問わない。ラッシュエリアは対象外）（出典: atwiki/page-1345「発動してもよい⇒敵軍バトルエリアから必要パワーの数字が3以下のユニットを1体選び」）", () => {
    const s = cyclone();
    expectChoiceFrom(s, "player1", "RK-255");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3", "SPEC-M2:m2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-255: 発動すると、このユニットは捨札になり、選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1345「このユニットを捨札にして」「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(cyclone(), "SPEC-M2:m2"));
    expect(zoneOf(s, "player1", "RK-255:tk")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-M2:m2")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-M2:m2")?.commandHeld).toBe(true);
  });

  it("RK-255: 発動しなければ、このユニットはバトルエリアに残る（出典: atwiki/page-1345「発動してもよい」）", () => {
    const s = resolveAll(skip(cyclone()));
    expect(zoneOf(s, "player1", "RK-255:tk")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("battle");
  });

  it.fails("RK-255: 敵軍のコマンドが5つで置けなければ、敵軍コマンドを1つ選んで捨札にしてから置く（出典: atwiki/page-1345「置けなければ敵軍コマンドを1つ選び、捨札にしてから置く」）", () => {
    let s = pick(cyclone({ ...cycloneEnemy, command: releasedN(5, "TST-OP", "ec") }), "SPEC-C3:c3");
    expectChoiceFrom(s, "player1", "RK-255");
    expect(choiceIds(s)).toEqual(releasedN(5, "TST-OP", "ec").map((c) => c.instanceId).sort());
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-OP:ec2"));
    expect(zoneOf(s, "player2", "TST-OP:ec2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:c3")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-C3:c3")?.commandHeld).toBe(true);
    expect(s.players.player2.command).toHaveLength(5);
  });
});

// ===========================================================================
describe("RK-256 カブトロー", () => {
  const TEXT =
    "【カブトローサンダー】 自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからSPが空欄でないSユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットはBP－1000される。（BP0以下になったユニットは撃破される）";

  it("RK-256: カタログ本文・スペックが出典と一致（出典: atwiki/page-1357）", () => {
    expectCatalogText("RK-256", TEXT);
    expectVehicleStats("RK-256", { name: "カブトロー", category: "ET", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-256", ["N"]);
  });

  const enemy = { battle: [inst("SPEC-E2000", "a"), inst("SPEC-NOSP2000", "n"), inst("SPEC-SPX2000", "x"), inst("SPEC-EM2000", "m"), inst("SPEC-E1000", "low")], rush: [inst("SPEC-E2000", "r")] };
  const thunder = (p2: Partial<GameState["players"]["player2"]> = enemy) => mount(board({ rush: [inst("SPEC-RCU", "r"), inst("RK-256", "kb")] }, p2), "SPEC-RCU:r", "RK-256:kb");

  it.fails("RK-256: 【カブトローサンダー】自軍ターン中にバトルエリアに出たとき、SP が空欄でない敵軍バトルエリアの S ユニットから1体選べる（任意。SP「－」・M・ラッシュエリアは対象外。SP「！」は空欄ではない）（出典: atwiki/page-1357「敵軍バトルエリアからSPが空欄でないSユニットを1体選んでもよい」・カード評価「SPが空欄でないSユニットという制約」）", () => {
    const s = thunder();
    expectChoiceFrom(s, "player1", "RK-256");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:low", "SPEC-E2000:a", "SPEC-SPX2000:x"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-256: 選んだユニットは、このターン、BP－1000される（出典: atwiki/page-1357「このターン、選んだユニットはBP－1000される」）", () => {
    const s = settle(pick(thunder(), "SPEC-E2000:a"));
    expect(bpOf(s, "player2", "SPEC-E2000:a")).toBe(1000);
  });

  it.fails("RK-256: BP0 以下になったユニットは撃破される（出典: atwiki/page-1357「（BP0以下になったユニットは撃破される）」・カード評価「BP1000までならバトルを挟まずに撃破できる」）", () => {
    const s = settle(pick(thunder(), "SPEC-E1000:low"));
    expect(zoneOf(s, "player2", "SPEC-E1000:low")).toBe("discard");
  });

  it.fails("RK-256: 選ばなければ何も起きない（出典: atwiki/page-1357「選んでもよい」）", () => {
    const s = settle(skip(thunder()));
    expect(bpOf(s, "player2", "SPEC-E2000:a")).toBe(2000);
    expect(zoneOf(s, "player2", "SPEC-E1000:low")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-257 テントロー", () => {
  const TEXT =
    "※特徴「女」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる。 ※これにライドしているユニットはBP+500される。 【高性能レーダー】 ライドされている「カブトロー」からこのビークルがコンビネーションしている間、これにライドしているユニットは次の能力を得る⇒敵軍ユニットにアタックされない。";

  it("RK-257: カタログ本文・スペックが出典と一致（出典: atwiki/page-1358）", () => {
    expectCatalogText("RK-257", TEXT);
    expectVehicleStats("RK-257", { name: "テントロー", category: "ET", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-257", ["N"]);
  });

  it("RK-257: ※ 特徴「女」を持つ S ユニットは RC を持っていなくてもライドできる（「女」でも M ユニット、「女」を持たない RC なしの S ユニットはライドできない）（出典: atwiki/page-1358「特徴「女」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる」）", () => {
    const s = board({ rush: [inst("RK-257", "tt"), inst("SPEC-FEMALE", "f"), inst("SPEC-FEMALE-M", "fm"), inst("SPEC-MALE", "m")] });
    expect(canMount(s, "SPEC-FEMALE:f", "RK-257:tt")).toBe(true);
    expect(canMount(s, "SPEC-FEMALE-M:fm", "RK-257:tt")).toBe(false);
    expect(canMount(s, "SPEC-MALE:m", "RK-257:tt")).toBe(false);
  });

  it("RK-257: ※ これにライドしているユニットは BP+500 される（出典: atwiki/page-1358「これにライドしているユニットはBP+500される」）", () => {
    const s = board({ battle: riding(inst("RK-257", "tt"), inst("SPEC-FEMALE", "f")) });
    expect(bpOf(s, "player1", "SPEC-FEMALE:f")).toBe(1500);
  });

  /** 敵軍ターン。自軍バトルエリアは「ライドされたカブトロー」→「ライドされたテントロー」の順。 */
  const radar = (kabutoro = riding(inst("RK-256", "kb"), inst("SPEC-RCU", "r"))) =>
    enemyTurn({ battle: [...kabutoro, ...riding(inst("RK-257", "tt"), inst("SPEC-FEMALE", "f"))] }, { battle: [inst("SPEC-E5000", "s"), inst("SPEC-EM2000", "m")] });

  it.fails("RK-257: 【高性能レーダー】ライドされているカブトローからこれがコンビネーションしている間、これにライドしているユニットは敵軍ユニット（S・M とも）にアタックされない（出典: atwiki/page-1358）", () => {
    expect(attackersOf(radar(), "SPEC-FEMALE:f")).toEqual([]);
  });

  it("RK-257: 前に並ぶのがライドされていないカブトローなら、ライドしているユニットはアタックされる（出典: atwiki/page-1358「ライドされている「カブトロー」から」）", () => {
    expect(attackersOf(radar([inst("RK-256", "kb")]), "SPEC-FEMALE:f")).toEqual(["SPEC-E5000:s", "SPEC-EM2000:m"]);
  });

  it("RK-257: 前にカブトローがいなければ、ライドしているユニットはアタックされる（出典: atwiki/page-1358「「カブトロー」からこのビークルがコンビネーションしている間」）", () => {
    expect(attackersOf(radar(riding(inst("SPEC-VEHICLE", "v"), inst("SPEC-RCU", "r"))), "SPEC-FEMALE:f")).toEqual(["SPEC-E5000:s", "SPEC-EM2000:m"]);
  });
});

// ===========================================================================
describe("RK-258 ドクターケイト", () => {
  const TEXT =
    "【猛毒腐食液】このターン、特徴「女」を持つ敵軍ユニットを1体以上撃破して捨札にしたなら、自分がターンを終えるとき、相手に1点ダメージを与えてもよい。";

  it("RK-258: カタログ本文・スペックが出典と一致（出典: atwiki/page-1256）", () => {
    expectCatalogText("RK-258", TEXT);
    expectStats("RK-258", { name: "ドクターケイト", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["デルザー軍団", "女", "改造人間"] });
    expectRarityIn("RK-258", ["N"]);
  });

  /** 自軍ターンに、自軍の BP13000 のユニットで敵軍の target を撃破する（ケイトは自軍ラッシュエリア）。 */
  const killed = (target: string, p1: Partial<GameState["players"]["player1"]> = {}) => {
    const [cid, suf] = target.split(":") as [string, string];
    return settle(attack(board({ rush: [inst("RK-258", "kt")], battle: [inst("TST-UNIT-7", "big")], ...p1 }, { battle: [inst(cid, suf)] }), "TST-UNIT-7:big", target));
  };

  it.fails("RK-258: 【猛毒腐食液】このターン、特徴「女」を持つ敵軍ユニットを撃破して捨札にしたなら、自分がターンを終えるとき、相手に1点ダメージを与えるかを選べる（任意）（出典: atwiki/page-1256）", () => {
    const s = toTurnEnd(killed("SPEC-FEMALE:ef"), "RK-258");
    expect(zoneOf(s, "player2", "SPEC-FEMALE:ef")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-258");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-258: 与えると、相手は1点ダメージを受ける（出典: atwiki/page-1256「相手に1点ダメージを与えてもよい」）", () => {
    const s = settle(accept(toTurnEnd(killed("SPEC-FEMALE:ef"), "RK-258")));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RK-258: 与えないことも選べる（出典: atwiki/page-1256「与えてもよい」）", () => {
    const s = settle(skip(toTurnEnd(killed("SPEC-FEMALE:ef"), "RK-258")));
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-258: 撃破したのが「女」を持たない敵軍ユニットなら発動しない（出典: atwiki/page-1256「特徴「女」を持つ敵軍ユニットを」）", () => {
    const s = toTurnEnd(killed("SPEC-MALE:em"), "RK-258");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-258");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-258: このターンに撃破していなければ発動しない（出典: atwiki/page-1256「このターン、…撃破して捨札にしたなら」）", () => {
    const s = toTurnEnd(board({ rush: [inst("RK-258", "kt")] }, { battle: [inst("SPEC-FEMALE", "ef")] }), "RK-258");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-258");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RK-259 ジェネラルシャドウ", () => {
  const TEXT =
    "【トランプ占い】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から1枚をオモテにする。そして、オモテにしたカードの必要パワーの数字を見て、その数字が「1」「3」「5」のどれかなら、このターン、これはBP+4000され、「2」「4」「6」のどれかなら、相手は1枚ドローしてもよい。「7」以上なら、このターン、これは「SP1」になる。その後、オモテにしたカードは山札の下に戻す。";

  it("RK-259: カタログ本文・スペックが出典と一致（出典: atwiki/page-1258）", () => {
    expectCatalogText("RK-259", TEXT);
    expectStats("RK-259", { name: "ジェネラルシャドウ", category: "DA", size: "S", bp: 4000, sp: "special", powerCost: 4, features: ["デルザー軍団", "男", "改造人間"] });
    expectRarityIn("RK-259", ["N"]);
  });

  /** 自軍山札の上を top にして、ジェネラルシャドウをバトルエリアに出す。 */
  const tarot = (top: string) => {
    const [cid, suf] = top.split(":") as [string, string];
    return enter(board({ rush: [inst("RK-259", "gs")], deck: [inst(cid, suf), ...deckCards(4)] }), "RK-259:gs");
  };
  const baseSp = () => spOf(board({ battle: [inst("RK-259", "gs")] }), "player1", "RK-259:gs");

  for (const [n, id] of [[1, "SPEC-C1:t"], [3, "SPEC-C3:t"], [5, "SPEC-C5:t"]] as const) {
    it.fails(`RK-259: 【トランプ占い】オモテにしたカードの必要パワーの数字が「${n}」なら、このターン、BP+4000（8000）され、そのカードは山札の下に戻る（出典: atwiki/page-1258）`, () => {
      const s = resolveAll(tarot(id));
      expect(bpOf(s, "player1", "RK-259:gs")).toBe(8000);
      expect(s.players.player1.deck.at(-1)?.instanceId).toBe(id);
      expect(s.players.player1.deck).toHaveLength(5);
    });
  }

  for (const [n, id] of [[2, "SPEC-C2:t"], [4, "SPEC-C4:t"], [6, "SPEC-C6:t"]] as const) {
    it.fails(`RK-259: 必要パワーの数字が「${n}」なら、相手は1枚ドローするかを選べる（相手の任意。BP は変わらない）（出典: atwiki/page-1258「相手は1枚ドローしてもよい」）`, () => {
      const s = tarot(id);
      expectChoiceFrom(s, "player2", "RK-259");
      expect(canSkip(s)).toBe(true);
      const drew = settle(accept(s));
      expect(drew.players.player2.hand).toHaveLength(1);
      expect(bpOf(drew, "player1", "RK-259:gs")).toBe(4000);
      expect(drew.players.player1.deck.at(-1)?.instanceId).toBe(id);
    });
  }

  it.fails("RK-259: 相手がドローしないことを選べば、相手の手札は増えない（出典: atwiki/page-1258「ドローしてもよい」）", () => {
    const s = settle(skip(tarot("SPEC-C2:t")));
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it.fails("RK-259: 必要パワーの数字が「7」以上なら、このターン「SP1」になる（「7-」の数字は7）（出典: atwiki/page-1258「「7」以上なら、このターン、これは「SP1」になる」・R-ADD-02）", () => {
    const s = resolveAll(tarot("SPEC-C7:t"));
    expect(spOf(s, "player1", "RK-259:gs")).toBe(1);
    expect(bpOf(s, "player1", "RK-259:gs")).toBe(4000);
    const t = resolveAll(tarot("SPEC-C7M:t"));
    expect(spOf(t, "player1", "RK-259:gs")).toBe(1);
  });

  it.fails("RK-259: 必要パワーの数字が「0」なら何も起きず、そのカードは山札の下に戻る（出典: atwiki/page-1258（0 は挙げられていない））", () => {
    const s = resolveAll(tarot("SPEC-C0:t"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(bpOf(s, "player1", "RK-259:gs")).toBe(4000);
    expect(spOf(s, "player1", "RK-259:gs")).toBe(baseSp());
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-C0:t");
  });

  it("RK-259: 敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1258「自軍ターン中、」）", () => {
    // 敵軍（player2）の RK-139 ゼロノスAF【俺はかーなーり強い】（RC）で、自軍ラッシュエリアのジェネラルシャドウを出させる。
    let s = enemyTurn({ rush: [inst("RK-259", "gs")], deck: [inst("SPEC-C1", "t"), ...deckCards(4)] }, { rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] });
    s = enemyRcRideOff(s, "RK-139:af", "SPEC-VEHICLE:v");
    s = resolveAll(pickAs(s, "player1", "RK-259:gs"));
    expect(zoneOf(s, "player1", "RK-259:gs")).toBe("battle");
    expect(bpOf(s, "player1", "RK-259:gs")).toBe(4000);
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-C1:t");
  });
});
