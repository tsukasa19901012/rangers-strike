/**
 * カード別スペック: XG5-068〜XG5-074（クロスギャザー XG5 ザ・チケットブレイカー 仮面ライダーナイトサバイブ〜仮面ライダーキバ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG5-074 Q1〜Q3
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-MORPH-01・R-KW-CALL-01・R-KW-RESIST-01・R-KW-PERM-01）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 * RC はビークル XG5-080 マシンディケイダーにライドして出てライドオフしたときで確かめる（R-KW-RC-01）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  endPhase,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectRarityIn,
  faceUp,
  fill,
  inst,
  leadMaTests,
  leadTestsFor,
  legal,
  morphCandidates,
  passEntry,
  payableFor,
  pick,
  powerCards,
  rcOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rushBoard,
  settle,
  spOf,
  st,
  sUnit,
  tryAct,
  wingTests,
  zoneOf,
} from "./XG5-061-080.helpers";

const LOW = sUnit("SPEC-LOW", { category: "WB", bp: 1000 });
const ATK_S = sUnit("SPEC-ATK-S", { category: "WB", bp: 3000 });
const ATK_M = sUnit("SPEC-ATK-M", { category: "WB", bp: 3000, size: "M" });
const DA_NOSP = sUnit("SPEC-DA-NOSP", { category: "DA", bp: 1000, sp: undefined, powerCost: 2 });
const DA_SP = sUnit("SPEC-DA-SP", { category: "DA", bp: 1000, sp: 1, powerCost: 2 });
const DA_CARD = sUnit("SPEC-DA-CARD", { category: "DA", bp: 1000 });
const EXTRA = [LOW, ATK_S, ATK_M, DA_NOSP, DA_SP, DA_CARD];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

/** rider をラッシュエリアの XG5-080 にライドさせて出し、ライドオフする。 */
const rc = (rider: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => {
  const [cid, suf] = rider.split(":") as [string, string];
  return rcOff(battle({ ...p1, rush: [inst("XG5-080", "md"), inst(cid, suf), ...(p1.rush ?? [])] }, p2), rider, "XG5-080:md");
};

// ===========================================================================
describe("XG5-068 仮面ライダーナイトサバイブ", () => {
  const TEXT =
    "※ウイング ※リードWB 【戦い続ける覚悟】常駐しているオペレーションカードを1枚選び捨札にしてもよい。そうしたとき、そのカードの持ち主は次のようにする⇒ウラ向きのパワーを1枚選び捨札にするか、オモテ向きのパワーを1枚選びダメージにするかを選ぶ。";

  it("XG5-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-2229）", () => {
    expectCatalogText("XG5-068", TEXT);
    expectMultiStats("XG5-068", { name: "仮面ライダーナイトサバイブ", category: ["WB"], size: "S", bp: 6000, sp: "1/2", powerCost: 7, comboNumber: "RC", features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"] });
    expectRarityIn("XG5-068", ["SR"]);
  });

  wingTests("XG5-068", "atwiki/page-2229");
  leadTestsFor("XG5-068", "WB", "atwiki/page-2229");

  // 敵軍常駐置き場に RK-021 クロックアップ、敵軍パワーゾーンにオモテ向き1枚・ダメージ1枚。
  const ENEMY = () => ({ operation: [inst("RK-021", "cu")], power: [faceUp("TST-P", "up"), { ...inst("TST-P", "dn"), faceDown: true }] });

  it("XG5-068: RC【戦い続ける覚悟】— ライドオフしたとき、常駐しているオペレーションカード（両軍）を選んで捨札にできる（任意）（出典: atwiki/page-2229「常駐しているオペレーションカードを1枚選び捨札にしてもよい」）", () => {
    const s = rc("XG5-068:ns", { operation: [inst("RK-078", "own")] }, ENEMY());
    expectChoiceFrom(s, "player1", "XG5-068");
    expect([...choiceIds(s)].sort()).toEqual(["RK-021:cu", "RK-078:own"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-068: RC【戦い続ける覚悟】— 捨札にしたとき、そのカードの持ち主（相手）がウラ向きのパワーを捨札にするかオモテ向きのパワーをダメージにするかを選ぶ（出典: atwiki/page-2229「そのカードの持ち主は次のようにする⇒ウラ向きのパワーを1枚選び捨札にするか、オモテ向きのパワーを1枚選びダメージにするかを選ぶ」）", () => {
    let s = pick(rc("XG5-068:ns", {}, ENEMY()), "RK-021:cu");
    expect(zoneOf(s, "player2", "RK-021:cu")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveAll(s);
    const dn = zoneOf(s, "player2", "TST-P:dn") === "discard";
    const up = cardIn(s, "player2", "TST-P:up")?.faceDown === true;
    expect(dn || up).toBe(true);
  });
});

// ===========================================================================
/** 「※このユニットは、リードMAを持つ自軍ユニットがあればBP+1000される。」の共通テスト。 */
function leadBonusTests(id: string, bp: number, page: string) {
  it(`${id}: ※ — リードMA を持つ自軍ユニット（XG5-071）があれば BP+1000（BP${bp + 1000}）、なければ BP${bp}（出典: ${page}「リードMAを持つ自軍ユニットがあればBP+1000される」）`, () => {
    expect(bpOf(battle({ battle: [inst(id, "x")], rush: [inst("XG5-071", "h")] }), "player1", `${id}:x`)).toBe(bp + 1000);
    expect(bpOf(battle({ battle: [inst(id, "x")], rush: [inst("TST-UNIT-0", "o")] }), "player1", `${id}:x`)).toBe(bp);
  });
}

describe("XG5-069 キハダガニ", () => {
  const TEXT =
    "※このユニットは、リードMAを持つ自軍ユニットがあればBP+1000される。 【待ち伏せ】敵軍ターン中、これがSユニットとのバトルで撃破されて捨札になったとき、これとバトルしたユニットを、持ち主の山札の下に戻してもよい。";

  it("XG5-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-2214）", () => {
    expectCatalogText("XG5-069", TEXT);
    expectMultiStats("XG5-069", { name: "キハダガニ", category: ["MA"], size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["ディスクアニマル"] });
    expectRarityIn("XG5-069", ["N"]);
  });

  leadBonusTests("XG5-069", 1000, "atwiki/page-2214");

  /** 敵軍ターン、敵軍の attacker（BP3000）が自軍バトルエリアのキハダガニにアタックして撃破する。 */
  const destroyed = (attacker: string) =>
    settle2(attack(st({ activePlayer: "player2", player1: { battle: [inst("XG5-069", "k")], deck: deckCards(5) }, player2: { battle: [inst(attacker, "atk")], deck: deckCards(5, "e") } }, EXTRA), `${attacker}:atk`, "XG5-069:k", "player2"));

  it("XG5-069:【待ち伏せ】— 敵軍ターン中、S ユニットとのバトルで撃破されて捨札になったとき、バトルしたユニットを持ち主の山札の下に戻すかを選べる（任意）（出典: atwiki/page-2214「これとバトルしたユニットを、持ち主の山札の下に戻してもよい」）", () => {
    const s = destroyed("SPEC-ATK-S");
    expect(zoneOf(s, "player1", "XG5-069:k")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG5-069");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-069:【待ち伏せ】— 戻せば、バトルしたユニットは持ち主の山札の一番下になる（出典: atwiki/page-2214「持ち主の山札の下に戻してもよい」）", () => {
    const s = resolveAll(destroyed("SPEC-ATK-S"));
    const deck = s.players.player2.deck;
    expect(deck[deck.length - 1]?.instanceId).toBe("SPEC-ATK-S:atk");
  });

  it("XG5-069:【待ち伏せ】— M ユニットとのバトルで撃破されたときは発動しない（出典: atwiki/page-2214「Sユニットとのバトルで」）", () => {
    const s = destroyed("SPEC-ATK-M");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-069");
    expect(zoneOf(s, "player2", "SPEC-ATK-M:atk")).toBe("battle");
  });
});

/** バトル・離場の反応ウィンドウをパスする（効果の選択は残す）。 */
function settle2(s: GameState): GameState {
  let n = s;
  for (let i = 0; i < 6; i++) {
    const p = legal(n).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction" || a.type === "pass_register");
    if (!p) break;
    const r = tryAct(n, p);
    if (!r.ok) break;
    n = r.state;
  }
  return n;
}

describe("XG5-070 ニビイロヘビ", () => {
  const TEXT =
    "※このユニットは、リードMAを持つ自軍ユニットがあればBP+1000される。 【偵察】これが自軍エリアにある間、敵軍SユニットがＮＣまたはＲＣまたはＪＣの効果を発動させたとき、その効果を実行する前に、これをホールドしてもよい。そうしたとき、そのNCまたはRCまたはJCの効果を無効にする。";

  it("XG5-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-2215）", () => {
    expectCatalogText("XG5-070", TEXT);
    expectMultiStats("XG5-070", { name: "ニビイロヘビ", category: ["MA"], size: "S", bp: 500, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["ディスクアニマル"] });
    expectRarityIn("XG5-070", ["N"]);
  });

  leadBonusTests("XG5-070", 500, "atwiki/page-2215");

  /** 敵軍ターン、敵軍の XG5-037 ゴセイレッド（CN1）が1番目に出て NC【レッドブレイク】を発動させる。 */
  const enemyNc = () =>
    enter(st({ activePlayer: "player2", player1: { rush: [inst("XG5-070", "n")], battle: [inst("TST-UNIT-0", "o")], deck: deckCards(5) }, player2: { rush: [inst("XG5-037", "gr")], deck: deckCards(5, "e") } }, EXTRA), "XG5-037:gr", "player2");

  it("XG5-070:【偵察】— 敵軍 S ユニットが NC の効果を発動させたとき、実行する前に、これをホールドするかを選べる（任意）（出典: atwiki/page-2215「その効果を実行する前に、これをホールドしてもよい」）", () => {
    const s = enemyNc();
    expectChoiceFrom(s, "player1", "XG5-070");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-070:【偵察】— ホールドすれば、その NC の効果は無効になる（【レッドブレイク】の選択は開かない）（出典: atwiki/page-2215「そうしたとき、そのNCまたはRCまたはJCの効果を無効にする」）", () => {
    const s = resolveAll(enemyNc(), []);
    expect(cardIn(s, "player1", "XG5-070:n")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "TST-UNIT-0:o")).toBe("battle");
  });
});

// ===========================================================================
describe("XG5-071 仮面ライダー響鬼", () => {
  const TEXT =
    "※レジスト ※リードMA 【鍛えてます】このユニットよりBPの低い自軍ユニットがあれば、このターン、これは次の能力を得る⇒BP+1000され、このターンを終えるときホールド状態ならリリースしてもよい。";

  it("XG5-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-2264）", () => {
    expectCatalogText("XG5-071", TEXT);
    expectMultiStats("XG5-071", { name: "仮面ライダー響鬼", category: ["MA"], size: "S", bp: 3000, sp: "1/3", powerCost: 3, comboNumber: 1, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG5-071", ["R"]);
  });

  it("XG5-071: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2264「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-071", "r")] }, "XG5-071:r"))).toBe(true);
  });

  leadMaTests("XG5-071", "atwiki/page-2264");

  it("XG5-071: NC【鍛えてます】— 1番目に出たとき、これより BP の低い自軍ユニットがあれば、このターン BP+1000（BP4000）（出典: atwiki/page-2264「このユニットよりBPの低い自軍ユニットがあれば、このターン、これは次の能力を得る⇒BP+1000」）", () => {
    const s = enter(battle({ rush: [inst("XG5-071", "h"), inst("SPEC-LOW", "l")] }), "XG5-071:h");
    expect(bpOf(s, "player1", "XG5-071:h")).toBe(4000);
  });

  it("XG5-071: NC【鍛えてます】— BP の低い自軍ユニットがなければ上がらない（出典: atwiki/page-2264「このユニットよりBPの低い自軍ユニットがあれば」）", () => {
    const s = enter(battle({ rush: [inst("XG5-071", "h"), inst("XG5-073", "d")] }), "XG5-071:h");
    expect(bpOf(s, "player1", "XG5-071:h")).toBe(3000);
  });

  it("XG5-071: NC が成立しなければ（2番目）上がらない（出典: atwiki/page-2264「CN：1」）", () => {
    const s = enter(battle({ battle: fill(1), rush: [inst("XG5-071", "h")] }), "XG5-071:h");
    expect(bpOf(s, "player1", "XG5-071:h")).toBe(3000);
  });
});

// ===========================================================================
describe("XG5-072 仮面ライダー威吹鬼", () => {
  const TEXT =
    "※リードMA 【挫けぬ疾風】敵軍山札をシャッフルしてもよい。そうしたとき、敵軍山札の上から3枚をオモテにし、その中にDAを持つカードがあれば、このユニットをリリースする。その後、オモテにしたカードを山札の上に好きな順で戻す。";

  it("XG5-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-2278）", () => {
    expectCatalogText("XG5-072", TEXT);
    expectMultiStats("XG5-072", { name: "仮面ライダー威吹鬼", category: ["MA"], size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG5-072", ["R"]);
  });

  leadMaTests("XG5-072", "atwiki/page-2278");

  it("XG5-072: RC【挫けぬ疾風】— ライドオフしたとき、発動するか（敵軍山札をシャッフルするか）を選べる（任意）（出典: atwiki/page-2278「敵軍山札をシャッフルしてもよい」）", () => {
    const s = rc("XG5-072:ib");
    expectChoiceFrom(s, "player1", "XG5-072");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-072: RC【挫けぬ疾風】— オモテにするのは敵軍山札の上3枚で、そのあと敵軍山札の上に戻る（敵軍山札の枚数は変わらず、自軍山札は動かない）（出典: atwiki/page-2278「敵軍山札の上から3枚をオモテにし…オモテにしたカードを山札の上に好きな順で戻す」）", () => {
    const s0 = rc("XG5-072:ib", {}, { deck: [inst("SPEC-DA-CARD", "e0"), ...deckCards(5, "e")] });
    const own = s0.players.player1.deck.map((c) => c.instanceId);
    const s = resolveAll(s0);
    expect(s.players.player2.deck.length).toBe(6);
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(own);
    expect(s0.pendingEffectChoice?.validInstanceIds.every((id) => !own.includes(id))).toBe(true);
  });

  it.todo("XG5-072: RC【挫けぬ疾風】— オモテにした中に DA を持つカードがあれば、これをリリースする（出典: atwiki/page-2278「その中にDAを持つカードがあれば、このユニットをリリースする」）— ライドオフ（RC）するときこのユニットはリリース状態で出るため、ホールド状態からのリリースを公開 API で組めない");
});

// ===========================================================================
describe("XG5-073 仮面ライダー電王SF", () => {
  const TEXT =
    "※モーフ ※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【俺の必殺技】自分の手札を1枚捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る。";

  it("XG5-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-2243）", () => {
    expectCatalogText("XG5-073", TEXT);
    expectMultiStats("XG5-073", { name: "仮面ライダー電王SF", category: ["OT"], size: "S", bp: 3000, sp: 1, powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("XG5-073", ["NR"]);
  });

  it("XG5-073: ※モーフ — 敵軍ユニットが通常の手段でラッシュされたとき、特徴が完全に同じオモテ向きのユニットカード（RK-061 仮面ライダー電王RF）と置き換えられる（出典: atwiki/page-2243「※モーフ」・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("XG5-073", "den")], power: [faceUp("RK-061", "rf"), faceUp("RK-056", "z")] }, "TST-UNIT-0:x");
    expect(morphCandidates(s)).toEqual(["RK-061:rf"]);
  });

  it("XG5-073: ※ — 敵軍バトルエリアにユニットがあればストライクできず、なければできる（出典: atwiki/page-2243「敵軍バトルエリアにユニットがあるとき、これはストライクできない」）", () => {
    expect(canStrike(enter(battle({ rush: [inst("XG5-073", "den")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG5-073:den"), "XG5-073:den")).toBe(false);
    expect(canStrike(enter(battle({ rush: [inst("XG5-073", "den")] }, { rush: [inst("TST-UNIT-0", "e")] }), "XG5-073:den"), "XG5-073:den")).toBe(true);
  });

  // 手札: TST-UNIT-2（必要パワー2）。敵軍: TST-UNIT-2（2）・TST-UNIT-0（0）。
  const fired = () => rc("XG5-073:den", { hand: [inst("TST-UNIT-2", "h")] }, { rush: [inst("TST-UNIT-2", "e2"), inst("TST-UNIT-0", "e0")] });

  it("XG5-073: RC【俺の必殺技】— ライドオフしたとき、自分の手札を1枚選んで捨札にできる（任意）（出典: atwiki/page-2243「自分の手札を1枚捨札にしてもよい」）", () => {
    const s = fired();
    expectChoiceFrom(s, "player1", "XG5-073");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-073: RC【俺の必殺技】— 捨札にしたカードと同じ必要パワーの数字（2）の敵軍ユニットを選び、持ち主のパワーゾーンに送る（出典: atwiki/page-2243「捨札にしたカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る」）", () => {
    let s = pick(fired(), "TST-UNIT-2:h");
    expect(zoneOf(s, "player1", "TST-UNIT-2:h")).toBe("discard");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:e2"]);
    s = resolveAll(pick(s, "TST-UNIT-2:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("power");
  });
});

// ===========================================================================
describe("XG5-074 仮面ライダーキバ", () => {
  const TEXT =
    "※モーフ ※コールDA 【ファンガイアの王】これをホールドしてDAを持つユニットをラッシュしたとき、このターン中、そのユニットは次の効果を得る⇒BP+3000され、本来のSPが空欄なら「SP1/3」になる。";

  it("XG5-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-2245）", () => {
    expectCatalogText("XG5-074", TEXT);
    expectMultiStats("XG5-074", { name: "仮面ライダーキバ", category: ["MA"], size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("XG5-074", ["NR"]);
  });

  it("XG5-074: ※モーフ — 敵軍ユニットが通常の手段でラッシュされたとき、特徴が完全に同じオモテ向きのユニットカード（XG5-053 仮面ライダーキバEF）と置き換えられる（出典: atwiki/page-2245「※モーフ」・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("XG5-074", "kv")], power: [faceUp("XG5-053", "ef"), faceUp("RK-056", "z")] }, "TST-UNIT-0:x");
    expect(morphCandidates(s)).toEqual(["XG5-053:ef"]);
  });

  it("XG5-074: ※コールDA — 自軍ラッシュエリアのこれを、DA のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-2245「※コールDA」・R-KW-CALL-01）", () => {
    const s = rushBoard({ hand: [inst("SPEC-DA-NOSP", "u")], rush: [inst("XG5-074", "kv")], command: releasedCat("DA", 1), power: powerCards(3) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-DA-NOSP:u")).toContain("XG5-074:kv");
  });

  /** これをホールドして手札の DA のユニット id をラッシュし、バトルフェイズに1番目に出す。 */
  const rushedWithKiva = (id: string) => {
    const s0 = rushBoard({ hand: [inst(id, "u")], rush: [inst("XG5-074", "kv"), ...fill(2)], command: releasedCat("DA", 1), power: powerCards(3) }, {}, EXTRA);
    const start = tryAct(s0, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: `${id}:u` } as never);
    expect(start.ok, start.error).toBe(true);
    const paid = tryAct(start.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["XG5-074:kv"] } as never);
    expect(paid.ok, paid.error).toBe(true);
    return resolveAll(paid.state);
  };

  it("XG5-074: 支払いの合法手に「これをホールドする」選び方がある（先頭のコマンドだけを出すと、画面からはこれを選べない）", () => {
    const s0 = rushBoard({ hand: [inst("SPEC-DA-NOSP", "u")], rush: [inst("XG5-074", "kv"), ...fill(2)], command: releasedCat("DA", 1), power: powerCards(3) }, {}, EXTRA);
    const start = tryAct(s0, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-DA-NOSP:u" } as never);
    expect(start.ok, start.error).toBe(true);
    const choices = legal(start.state)
      .filter((a) => a.type === "resolve_command_payment")
      .map((a) => (a as { commandInstanceIds: string[] }).commandInstanceIds.join(","));
    expect(choices).toContain("XG5-074:kv");
    expect(choices.length).toBeGreaterThanOrEqual(2);
  });

  it("XG5-074:【ファンガイアの王】— これをホールドして DA のユニットをラッシュしたとき、このターン、そのユニットは BP+3000（出典: atwiki/page-2245「そのユニットは次の効果を得る⇒BP+3000され」）", () => {
    const s = rushedWithKiva("SPEC-DA-NOSP");
    expect(cardIn(s, "player1", "XG5-074:kv")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", "SPEC-DA-NOSP:u")).toBe(4000);
  });

  it("XG5-074:【ファンガイアの王】— 本来の SP が空欄なら「SP1/3」になる（3番目に出れば SP1）（出典: atwiki/page-2245「本来のSPが空欄なら「SP1/3」になる」）", () => {
    let s = settle(endPhase(rushedWithKiva("SPEC-DA-NOSP")));
    s = passEntry(settle(enter(s, "TST-UNIT-0:f0")));
    s = passEntry(settle(enter(s, "TST-UNIT-0:f1")));
    s = enter(s, "SPEC-DA-NOSP:u");
    expect(spOf(s, "player1", "SPEC-DA-NOSP:u")).toBe(1);
  });

  it.todo("XG5-074: 公式Q&A — RS-010 プリズムパワー・RS-519 インフェルシアの花嫁・RS-170 エージェント・アブレラの効果のためにホールドしたときは【ファンガイアの王】にならない（出典: atwiki/page-2245 Q1〜Q3「いいえ、そのようにはなりません」）— 常駐・他のカードの効果でホールドする盤面が本範囲の公開 API の手順で組めず、テストできない");
});

