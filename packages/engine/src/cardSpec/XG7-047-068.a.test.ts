/**
 * カード別スペック: XG7-047〜XG7-054（クロスギャザー ザ・ベストパートナー 仮面ライダーオーズ・タカキリーター〜オーズドライバー）
 *
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. 公式 FAQ・エラッタ・公式 Q&A — grnrngr の FAQ・08-errata.md には載っていない。XG7-049・XG7-054 は atwiki に公式 Q&A の転記がある。
 *  2. atwiki のカードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md）の本文・Q&A。
 *  3. 一般ルール（docs/rules/*.md）、atwiki のカード評価・コメント。
 *
 * エンジンが出典と違う／効果が無いところは、出典どおりの期待値のまま it.fails（既知の不具合: CARD-XG7-NNN）にしている。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  DEFS,
  act,
  attack,
  bpOf,
  breakerTests,
  canActivate,
  canSkip,
  canStartRush,
  choiceIds,
  crossTests,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  extraHoldTests,
  inst,
  lastBattleBps,
  leadTests,
  legal,
  morphTests,
  p1Battle,
  played,
  powerCards,
  rcRideOff,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseOf,
  rushVia,
  settle,
  spOf,
  st,
  sUnit,
  targetsOf,
  vehicleCard,
  wingTests,
  zoneOf,
} from "./XG7-047-068.helpers";

const V = vehicleCard("SPEC-V", { features: ["メカ"] });
const E_S = sUnit("SPEC-E-S", { category: "WB", bp: 3000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { category: "WB", bp: 3000, size: "M", sp: undefined });
const E_BIG = sUnit("SPEC-E-BIG", { category: "WB", bp: 6000, sp: undefined });
const ATK3000 = sUnit("SPEC-ATK3000", { category: "WB", bp: 3000 });
const ATK2500 = sUnit("SPEC-ATK2500", { category: "WB", bp: 2500 });
const OOO_U = sUnit("SPEC-OOO-U", { category: "WB", bp: 1000, powerCost: 2, features: ["オーズドライバー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const EXTRA = [V, E_S, E_M, E_BIG, ATK3000, ATK2500, OOO_U, PLAIN];

// ===========================================================================
describe("XG7-047 仮面ライダーオーズ・タカキリーター", () => {
  const TEXT = "※モーフ 【カマキリソード】これは敵軍Sユニットにアタックするとき、BP+5000される。";

  it("XG7-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-2422）", () => {
    expectCatalogText("XG7-047", TEXT);
    expectUnitStats("XG7-047", { name: "仮面ライダーオーズ・タカキリーター", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-047", ["N"]);
  });

  morphTests("XG7-047", "atwiki/page-2422");

  const hit = (target: string) => settle(attack(p1Battle({ battle: [inst("XG7-047", "tk")] }, { battle: [inst(target, "e")] }, EXTRA), "XG7-047:tk", `${target}:e`));

  it.fails("XG7-047: 【カマキリソード】敵軍 S ユニットにアタックするとき BP+5000（5500）（出典: atwiki/page-2422「敵軍Sユニットにアタックするとき、BP+5000される」） — 既知の不具合: CARD-XG7-047 【カマキリソード】（敵軍 S ユニットへのアタックで BP+5000）が未実装", () => {
    const s = hit("SPEC-E-S");
    expect(lastBattleBps(s)?.attacker).toBe(5500);
    expect(zoneOf(s, "player2", "SPEC-E-S:e")).toBe("discard");
  });

  it("XG7-047: 【カマキリソード】敵軍 M ユニットにアタックするときは BP500 のまま（出典: atwiki/page-2422「敵軍Sユニット」）", () => {
    expect(lastBattleBps(hit("SPEC-E-M"))?.attacker).toBe(500);
  });

  it("XG7-047: 【カマキリソード】アタック宣言のときは BP500 なので、「BP3000以上のユニットにアタックされない」XG7-051 にもアタックできる（出典: atwiki/page-2422 カード評価「「アタックするとき」に発動する効果はアタック宣言した後に発動する。…アタックすることができる」）", () => {
    const s = p1Battle({ battle: [inst("XG7-047", "tk")] }, { battle: [inst("XG7-051", "rt")] }, EXTRA);
    expect(targetsOf(s, "XG7-047:tk")).toContain("XG7-051:rt");
  });
});

// ===========================================================================
describe("XG7-048 仮面ライダーオーズ・ガタトラバ", () => {
  const TEXT = "※モーフ 【クワガタホーン】敵軍バトルエリアのユニットがSユニットだけなら、このターン、これは「SP1」になる。";

  it("XG7-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-2383「SP：！」「CN：RC」）", () => {
    expectCatalogText("XG7-048", TEXT);
    expectUnitStats("XG7-048", { name: "仮面ライダーオーズ・ガタトラバ", category: "WB", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-048", ["N"]);
  });

  morphTests("XG7-048", "atwiki/page-2383");

  const horn = (enemyBattle: string[]) =>
    resolveAll(settle(rcRideOff(p1Battle({ rush: [inst("XG7-048", "gt"), inst("SPEC-V", "v")] }, { battle: enemyBattle.map((id, i) => inst(id, `e${i}`)) }, EXTRA), "XG7-048:gt", "SPEC-V:v")));

  it("XG7-048: 【クワガタホーン】RC（ライドオフ）— 敵軍バトルエリアのユニットが S ユニットだけなら、このターン SP1（出典: atwiki/page-2383「敵軍バトルエリアのユニットがSユニットだけなら、このターン、これは「SP1」になる」）", () => {
    expect(spOf(horn(["SPEC-E-S", "SPEC-E-S"]), "player1", "XG7-048:gt")).toBe(1);
  });

  it("XG7-048: 【クワガタホーン】敵軍バトルエリアに M ユニットがいれば SP1 にならない（出典: atwiki/page-2383「Sユニットだけなら」）", () => {
    expect(spOf(horn(["SPEC-E-S", "SPEC-E-M"]), "player1", "XG7-048:gt")).not.toBe(1);
  });

  it("XG7-048: 【クワガタホーン】敵軍バトルエリアにユニットがいなければ SP1 にならない（出典: atwiki/page-2383 カード評価「敵軍バトルエリアにユニットがいない場合は発動できない」）", () => {
    expect(spOf(horn([]), "player1", "XG7-048:gt")).not.toBe(1);
  });
});

// ===========================================================================
describe("XG7-049 仮面ライダーオーズ・ガタキリバコンボ", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 ※これはカード名に「ガタ」を含む自軍ユニット1体につきBP+500される。 【分身体】これを手札からラッシュしたとき、自軍山札の上から2枚をオモテにして、その中から「仮面ライダーオーズ・ガタキリバコンボ」のカードをすべて自軍ラッシュエリアに出し、それ以外は捨札にする。";

  it("XG7-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-2398）", () => {
    expectCatalogText("XG7-049", TEXT);
    expectUnitStats("XG7-049", { name: "仮面ライダーオーズ・ガタキリバコンボ", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-049", ["N"]);
  });

  it.todo("XG7-049: ※ デッキに好きな枚数入れてよい（XG6-056 が1枚でも入っていれば同名は3枚まで — atwiki/page-2398 Q1）— デッキ構築の枚数チェックは公開エンジン API（createTestState / applyAction / getLegalActions）の外で、ここでは確かめられない");

  it.fails("XG7-049: ※「ガタ」を含む自軍ユニット1体につき BP+500 — これだけなら自身を数えて BP1000（出典: atwiki/page-2398「カード名に「ガタ」を含む自軍ユニット1体につきBP+500される」・カード評価「自身の効果で実質BP1000になる」） — 既知の不具合: CARD-XG7-049 「ガタ」を含む自軍ユニットの数による BP+500 が未実装", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG7-049", "g")] }, {}, EXTRA), "player1", "XG7-049:g")).toBe(1000);
  });

  it.fails("XG7-049: ※ ラッシュエリアの XG7-048 ガタトラバも数える（BP1500。「ガタ」を含まない SPEC-PLAIN は数えない）（出典: atwiki/page-2398・関連カード（カード名に「ガタ」を含むユニット）仮面ライダーオーズ・ガタトラバ） — 既知の不具合: CARD-XG7-049 「ガタ」を含む自軍ユニットの数による BP+500 が未実装", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG7-049", "g")], rush: [inst("XG7-048", "gt"), inst("SPEC-PLAIN", "p")] }, {}, EXTRA), "player1", "XG7-049:g")).toBe(1500);
  });

  const split = (deck = [inst("XG7-049", "d1"), inst("TST-OP", "d2"), inst("XG7-049", "d3")]) =>
    resolveAll(rushFromHand(rushPhaseOf({ hand: [inst("XG7-049", "g")], command: releasedCat("WB", 1), power: powerCards(4), deck }, {}, EXTRA), "player1", "XG7-049:g").state);

  it.fails("XG7-049: 【分身体】手札からラッシュしたとき、山札の上から2枚のうち「ガタキリバコンボ」をすべてラッシュエリアに出し、それ以外は捨札（3枚目は山札に残る）（出典: atwiki/page-2398「その中から「仮面ライダーオーズ・ガタキリバコンボ」のカードをすべて自軍ラッシュエリアに出し、それ以外は捨札にする」） — 既知の不具合: CARD-XG7-049 【分身体】が本文と違う（山札の上2枚から選ばせ、「ガタキリバコンボ」を出さない）", () => {
    const s = split();
    expect(zoneOf(s, "player1", "XG7-049:d1")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:d2")).toBe("discard");
    expect(zoneOf(s, "player1", "XG7-049:d3")).toBe("deck");
  });

  it.fails("XG7-049: 【分身体】2枚とも「ガタキリバコンボ」なら2枚とも出る（出典: atwiki/page-2398「すべて」） — 既知の不具合: CARD-XG7-049 【分身体】が本文と違う（山札の上2枚から選ばせ、「ガタキリバコンボ」を出さない）", () => {
    const s = split([inst("XG7-049", "d1"), inst("XG7-049", "d2"), inst("TST-OP", "d3")]);
    expect(zoneOf(s, "player1", "XG7-049:d1")).toBe("rush");
    expect(zoneOf(s, "player1", "XG7-049:d2")).toBe("rush");
  });
});

// ===========================================================================
describe("XG7-050 仮面ライダーオーズ・タトバコンボ×仮面ライダーバース", () => {
  const TEXT =
    "※クロス1 ※リードET 【行けますって、俺達が力を合わせれば】自軍ターン中、これとコンビネーションする、ナンバーに「L」または「R」を持つETのユニットのJCの効果は、これがJCの対象外でも発動できる。";

  it("XG7-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-2392）", () => {
    expectCatalogText("XG7-050", TEXT);
    expectUnitStats("XG7-050", { name: "仮面ライダーオーズ・タトバコンボ×仮面ライダーバース", category: ["WB", "ET"], size: "S", bp: 4000, sp: "1/2", powerCost: "4+", comboNumber: undefined, features: ["仮面ライダー", "男"], rushCondition: "hold_extra_command" });
    expectRarityIn("XG7-050", ["SR"]);
  });

  crossTests("XG7-050", "atwiki/page-2392");
  extraHoldTests("XG7-050", ["WB", "ET"], "4+", "atwiki/page-2392");
  leadTests("XG7-050", "ET", "atwiki/page-2392");

  it.todo("XG7-050: 【行けますって、俺達が力を合わせれば】これとコンビネーションする ET の R ユニット（RS-172 ゴーゴーショベル等）の JC の効果は、これが L でなくても発動できる — 本物の L ユニット RS-171 ゴーゴードリルの次に RS-172 を出しても JC の効果の選択が開かず（JC の効果が未接続）、比べる組み合わせを作れない（出典: atwiki/page-2392）");
});

// ===========================================================================
describe("XG7-051 仮面ライダーオーズ・ラトラーターコンボ", () => {
  const TEXT =
    "※モーフ ※これは毎ターン、可能ならバトルエリア に出る。 ※これはBP3000以上のユニットにアタックされない。 【ライオディアス】 これをラッシュしたとき、自軍捨札を好きな枚数選びゲームから除外してもよい。そうしたとき、選んだ枚数と同じ数だけ相手は自分自身の捨札を選びゲームから除外する。";

  it("XG7-051: カタログ本文・スペックが出典と一致（出典: atwiki/page-2397）", () => {
    expectCatalogText("XG7-051", TEXT);
    expectUnitStats("XG7-051", { name: "仮面ライダーオーズ・ラトラーターコンボ", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 3, comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-051", ["N"]);
  });

  morphTests("XG7-051", "atwiki/page-2397");

  it("XG7-051: ※ 毎ターン、可能ならバトルエリアに出る — 出さないまま自軍バトルフェイズを終えられない（出す順番は問わない。XG7-questions の前提）（出典: atwiki/page-2397「※これは毎ターン、可能ならバトルエリアに出る」・rules/05-battle-strike-damage R-BA-04）", () => {
    const s = p1Battle({ rush: [inst("SPEC-PLAIN", "p"), inst("XG7-051", "rt")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.type === "end_phase" && a.playerId === "player1")).toBe(false);
  });

  it("XG7-051: ※ BP3000 以上のユニットにはアタックされない（出典: atwiki/page-2397「※これはBP3000以上のユニットにアタックされない」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG7-051", "rt")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-ATK3000", "a")], deck: deckCards(3, "e") } }, EXTRA);
    expect(targetsOf(s, "SPEC-ATK3000:a", "player2")).not.toContain("XG7-051:rt");
  });

  it("XG7-051: ※ BP2500 のユニットにはアタックされる（出典: atwiki/page-2397「BP3000以上」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG7-051", "rt")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-ATK2500", "a")], deck: deckCards(3, "e") } }, EXTRA);
    expect(targetsOf(s, "SPEC-ATK2500:a", "player2")).toContain("XG7-051:rt");
  });

  const lion = () =>
    rushFromHand(
      rushPhaseOf({ hand: [inst("XG7-051", "rt")], command: releasedCat("WB", 1), power: powerCards(3), discard: [inst("TST-OP", "m0"), inst("TST-OP", "m1"), inst("TST-OP", "m2")] }, { discard: [inst("TST-OP", "e0"), inst("TST-OP", "e1"), inst("TST-OP", "e2")] }, EXTRA),
      "player1",
      "XG7-051:rt",
    ).state;

  it.fails("XG7-051: 【ライオディアス】ラッシュしたとき、自軍捨札を好きな枚数選んで除外できる（任意）（出典: atwiki/page-2397「自軍捨札を好きな枚数選びゲームから除外してもよい」） — 既知の不具合: CARD-XG7-051 【ライオディアス】（両者の捨札の除外）が未実装", () => {
    const s = lion();
    expectChoiceFrom(s, "player1", "XG7-051");
    expect(choiceIds(s)).toEqual(["TST-OP:m0", "TST-OP:m1", "TST-OP:m2"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-051: 【ライオディアス】2枚除外したとき、相手は自分自身の捨札を2枚選んで除外する（出典: atwiki/page-2397「選んだ枚数と同じ数だけ相手は自分自身の捨札を選びゲームから除外する」・カード評価「除外するカードはそれぞれの持ち主が決める」） — 既知の不具合: CARD-XG7-051 【ライオディアス】（両者の捨札の除外）が未実装", () => {
    const s = resolveAll(lion(), ["TST-OP:m0", "TST-OP:m1", "confirm", "TST-OP:e0", "TST-OP:e1"]);
    expect((s.players.player1.exile ?? []).map((c) => c.instanceId).sort()).toEqual(["TST-OP:m0", "TST-OP:m1"]);
    expect((s.players.player2.exile ?? []).length).toBe(2);
    expect(s.players.player2.discard).toHaveLength(1);
  });
});

// ===========================================================================
describe("XG7-052 仮面ライダーオーズ・タジャドルコンボ", () => {
  const TEXT =
    "※ブレイカー ※ウイング ※これは、ウイングでアタックするときBP+2000される。 【タジャスピナー】これが自軍エリアにある間、WBを持つ自軍コマンドが3つ以上あれば、自軍バトルフェイズごとに1度だけ、敵軍Sユニットを1体選び、これとバトルさせてもよい。（敵軍捨札が7枚以上あれば、敵軍Sユニットを1体選ぶかわりに、敵軍ユニットを1体選んでもよい）";

  it("XG7-052: カタログ本文・スペックが出典と一致（出典: atwiki/page-2426）", () => {
    expectCatalogText("XG7-052", TEXT);
    expectUnitStats("XG7-052", { name: "仮面ライダーオーズ・タジャドルコンボ", category: "WB", size: "S", bp: 4500, sp: "1/2", powerCost: "7-", comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("XG7-052", ["SR"]);
  });

  breakerTests("XG7-052", "atwiki/page-2426", EXTRA);
  wingTests("XG7-052", "atwiki/page-2426");

  it("XG7-052: 追加条件 — 特徴「オーズドライバー」を持つ自軍ユニット1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-2426「追加条件：特徴「オーズドライバー」を持つ自軍ユニット1体を捨札にすれば必要パワー0になる」）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-052", "tj")], rush: [inst("SPEC-OOO-U", "o")], command: releasedCat("WB", 1), power: [] }, {}, EXTRA);
    const r = rushVia(s, "player1", "XG7-052:tj", (a) => a.zordMaterialInstanceId === "SPEC-OOO-U:o");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "XG7-052:tj")).toBe("rush");
    expect(zoneOf(t, "player1", "SPEC-OOO-U:o")).toBe("discard");
  });

  it("XG7-052: 必要パワー7- — 「オーズドライバー」のユニットがなければパワー7が要る（6ではラッシュできない）（出典: atwiki/page-2426「必要パワー：7-」）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-052", "tj")], rush: [inst("SPEC-PLAIN", "p")], command: releasedCat("WB", 1), power: powerCards(6) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "XG7-052:tj")).toBe(false);
  });

  it.fails("XG7-052: ※ ウイングでアタックするとき BP+2000（6500 で BP6000 の敵軍ユニットを撃破）（出典: atwiki/page-2426「ウイングでアタックするときBP+2000される」） — 既知の不具合: CARD-XG7-052 ウイングでアタックするときの BP+2000 が未実装", () => {
    let s = p1Battle({ rush: [inst("XG7-052", "tj")] }, { battle: [inst("SPEC-E-BIG", "e")] }, EXTRA);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG7-052:tj" });
    s = settle(attack(s, "XG7-052:tj", "SPEC-E-BIG:e"));
    expect(lastBattleBps(s)?.attacker).toBe(6500);
    expect(zoneOf(s, "player2", "SPEC-E-BIG:e")).toBe("discard");
  });

  it("XG7-052: ※ バトルエリアからの通常のアタックでは BP4500 のまま（出典: atwiki/page-2426「ウイングでアタックするとき」）", () => {
    const s = settle(attack(enter(p1Battle({ rush: [inst("XG7-052", "tj")] }, { battle: [inst("SPEC-E-S", "e")] }, EXTRA), "XG7-052:tj"), "XG7-052:tj", "SPEC-E-S:e"));
    expect(lastBattleBps(s)?.attacker).toBe(4500);
  });

  it.fails("XG7-052: 【タジャスピナー】WB の自軍コマンドが3つ以上あれば、自軍バトルフェイズに起動できる（出典: atwiki/page-2426「WBを持つ自軍コマンドが3つ以上あれば、自軍バトルフェイズごとに1度だけ」） — 既知の不具合: CARD-XG7-052 【タジャスピナー】（起動してバトルさせる）が未実装", () => {
    const s = p1Battle({ rush: [inst("XG7-052", "tj")], command: releasedCat("WB", 3, "w") }, { rush: [inst("SPEC-E-S", "e")] }, EXTRA);
    expect(canActivate(s, "XG7-052:tj")).toBe(true);
  });

  it("XG7-052: 【タジャスピナー】WB の自軍コマンドが2つなら起動できない（出典: atwiki/page-2426「3つ以上あれば」）", () => {
    const s = p1Battle({ rush: [inst("XG7-052", "tj")], command: releasedCat("WB", 2, "w") }, { rush: [inst("SPEC-E-S", "e")] }, EXTRA);
    expect(canActivate(s, "XG7-052:tj")).toBe(false);
  });
});

// ===========================================================================
describe("XG7-053 仮面ライダーオーズ・シャウタコンボ", () => {
  const TEXT =
    "※モーフ ※リードET ※これは、自分と相手の手札1枚につきBP+500される。 【水中からの強襲】自軍ターン中、これをラッシュしたとき、自軍捨札からナンバーにRCを持つカードを1枚選び、ゲームから除外してもよい。そうしたとき、そのカードのRCの効果を、このユニットの効果として発動する。";

  it("XG7-053: カタログ本文・スペックが出典と一致（出典: atwiki/page-2431）", () => {
    expectCatalogText("XG7-053", TEXT);
    expectUnitStats("XG7-053", { name: "仮面ライダーオーズ・シャウタコンボ", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRarityIn("XG7-053", ["SR"]);
  });

  morphTests("XG7-053", "atwiki/page-2431");
  leadTests("XG7-053", "ET", "atwiki/page-2431");

  it.fails("XG7-053: ※ 自分と相手の手札1枚につき BP+500（自分2枚＋相手3枚で 3000）（出典: atwiki/page-2431「自分と相手の手札1枚につきBP+500される」） — 既知の不具合: CARD-XG7-053 手札の枚数による BP+500 が未実装", () => {
    const s = p1Battle({ battle: [inst("XG7-053", "sh")], hand: [inst("TST-OP", "h0"), inst("TST-OP", "h1")] }, { hand: [inst("TST-OP", "e0"), inst("TST-OP", "e1"), inst("TST-OP", "e2")] }, EXTRA);
    expect(bpOf(s, "player1", "XG7-053:sh")).toBe(3000);
  });

  const assault = () =>
    rushFromHand(rushPhaseOf({ hand: [inst("XG7-053", "sh")], command: releasedCat("WB", 1), power: powerCards(5), discard: [inst("XG7-032", "rc"), inst("SPEC-PLAIN", "p")] }, {}, EXTRA), "player1", "XG7-053:sh").state;

  it.fails("XG7-053: 【水中からの強襲】自軍ターン中、ラッシュしたとき、自軍捨札からナンバーに RC を持つカードを1枚選んで除外できる（任意）（出典: atwiki/page-2431「自軍捨札からナンバーにRCを持つカードを1枚選び、ゲームから除外してもよい」） — 既知の不具合: CARD-XG7-053 【水中からの強襲】（捨札の RC カードの効果を使う）が未実装", () => {
    const s = assault();
    expectChoiceFrom(s, "player1", "XG7-053");
    expect(choiceIds(s)).toEqual(["XG7-032:rc"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-053: 【水中からの強襲】除外したとき、そのカード（XG7-032【ライダーダブルキック】）の RC の効果をこれの効果として発動する（このターン BP+2000）（出典: atwiki/page-2431「そのカードのRCの効果を、このユニットの効果として発動する」） — 既知の不具合: CARD-XG7-053 【水中からの強襲】（捨札の RC カードの効果を使う）が未実装", () => {
    const s = resolveAll(assault(), ["XG7-032:rc"]);
    expect((s.players.player1.exile ?? []).map((c) => c.instanceId)).toContain("XG7-032:rc");
    // 手札0枚・相手手札0枚なので本来は BP500。+2000 で 2500。
    expect(bpOf(s, "player1", "XG7-053:sh")).toBe(2500);
  });
});

// ===========================================================================
describe("XG7-054 オーズドライバー", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒ ◎自分の手札から本来の特徴に「オーズドライバー」を持つカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。 ◎このターン、次に自分が手札から使用するカードの必要パワーの数字は、3少なくなる。";

  it("XG7-054: カタログ本文・スペックが出典と一致（出典: atwiki/page-2404）", () => {
    expectCatalogText("XG7-054", TEXT);
    const d = DEFS["XG7-054"]!;
    expect(d.name).toBe("オーズドライバー");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("WB");
    expect(d.powerCost).toBe(3);
    expectRarityIn("XG7-054", ["N"]);
  });

  const used = (hand = [inst("XG7-047", "tk"), inst("XG7-053", "sh")]) =>
    played(rushPhaseOf({ hand: [inst("XG7-054", "od"), ...hand], command: releasedCat("WB", 2), power: powerCards(3) }, {}, EXTRA), "XG7-054:od");

  it.fails("XG7-054: 使うと、2つの効果から1つを選ぶ（出典: atwiki/page-2404「次の効果から1つ選び発動する」） — 既知の不具合: CARD-XG7-054 効果の選択（◎1 手札から出す・◎2 必要パワー-3）が未実装（使っても何も起きない）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG7-054");
    expect(choiceIds(s).length).toBe(2);
  });

  it.fails("XG7-054: ◎1 手札の本来の特徴に「オーズドライバー」を持つカード（必要パワー5の XG7-053）を、パワー3でも自軍ラッシュエリアに出せる（出典: atwiki/page-2404「自分の手札から本来の特徴に「オーズドライバー」を持つカードを1枚選び、自軍ラッシュエリアに出してもよい」） — 既知の不具合: CARD-XG7-054 効果の選択（◎1 手札から出す・◎2 必要パワー-3）が未実装（使っても何も起きない）", () => {
    let s = used();
    const first = choiceIds(s)[0];
    if (first) s = resolveAll(s, [first, "XG7-053:sh"]);
    expect(zoneOf(s, "player1", "XG7-053:sh")).toBe("rush");
  });

  it.fails("XG7-054: ◎2 このターン、次に手札から使うカードの必要パワーが3少なくなる（パワー3で必要パワー5の XG7-053 をラッシュできる）（出典: atwiki/page-2404「次に自分が手札から使用するカードの必要パワーの数字は、3少なくなる」） — 既知の不具合: CARD-XG7-054 効果の選択（◎1 手札から出す・◎2 必要パワー-3）が未実装（使っても何も起きない）", () => {
    let s = used();
    const second = choiceIds(s)[1];
    if (second) s = resolveAll(s, [second]);
    expect(canStartRush(s, "player1", "XG7-053:sh")).toBe(true);
  });
});
