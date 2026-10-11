/**
 * カード別スペック: RS-560〜RS-566（第8弾「究極の八神」ガオレオン〜天雷旋風神）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-560〜RS-566 は該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-565 Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）。
 *     RS-566 の Q&A（Q1・Q2）は atwiki/page-1229 の転載（公式ページの取得分に該当 Q なし）。
 *  3. docs/rules/*.md の一般ルール（R-ADD-06 合体、R-ADD-07 ホールド進入、R-KW-RESIST-01 レジスト、R-CN-02 NC 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  enterBattleByEffect,
  enterWithHold,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  resistTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS8-560-581.helpers";
import type { CardInstance, GameState } from "../types/game";

/** TST-UNIT-0（CN なし・SP1・BP1000・必要パワー0）を n 体。 */
function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

/** ダメージ n 点（damage とウラ向きパワー）。 */
function dmg(n: number, prefix = "dm") {
  return { damage: n, power: damageCards(n, prefix) };
}

const BEAST_S = sUnit("SPEC-BEAST-S", { bp: 2000, size: "S", features: ["獣"] });
const COST3 = sUnit("SPEC-COST3", { bp: 2000, size: "S", powerCost: 3 });

// ===========================================================================
/** 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」の共通テスト。 */
function holdEntryTests(id: string, page: string) {
  it(`${id}: ※ 自軍コマンドを1つホールドすればバトルエリアに出られ、そのコマンドはホールド状態になる（出典: atwiki/${page}「自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）`, () => {
    let s = st({ player1: { rush: [inst(id, "me")], command: releasedCat("WB", 1), deck: deckCards(3) } });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === `${id}:me`)).toBe(false);
    expect(canEnter(s, `${id}:me`)).toBe(true);
    s = enterWithHold(s, `${id}:me`, ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:cWB0")?.commandHeld).toBe(true);
  });

  it(`${id}: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: atwiki/${page}・R-ADD-07）`, () => {
    const s = st({ player1: { rush: [inst(id, "me")], command: [{ ...inst("TST-OP", "h"), commandHeld: true }], deck: deckCards(3) } });
    expect(canEnter(s, `${id}:me`)).toBe(false);
  });
}

/** 「SP！・CN2【…】「SP1」」の共通テスト。 */
function sp1Cn2Tests(id: string, effect: string, page: string) {
  it(`${id}: 【${effect}】「SP1」— 2番目に出ると NC が成立して SP1 になる（出典: atwiki/${page}「CN：2」「【${effect}】「SP1」」・R-CN-02）`, () => {
    const s = enterWithHold(st({ player1: { battle: fill(1), rush: [inst(id, "me")], command: releasedCat("WB", 1), deck: deckCards(3) } }), `${id}:me`, ["TST-OP:cWB0"]);
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
    expect(spOf(s, "player1", `${id}:me`)).toBe(1);
  });

  it(`${id}: 【${effect}】NC 不成立（1番目）なら SP「！」は 0（出典: atwiki/${page}「SP：！」・R-CN-02）`, () => {
    const s = enterWithHold(st({ player1: { rush: [inst(id, "me")], command: releasedCat("WB", 1), deck: deckCards(3) } }), `${id}:me`, ["TST-OP:cWB0"]);
    expect(spOf(s, "player1", `${id}:me`)).toBe(0);
  });
}

// ===========================================================================
describe("RS-560 ガオレオン", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【轟く咆哮】これが自軍エリアにある間、特徴「獣」を持つ自軍Mユニットは、自軍捨札に同じカード名のユニットカードがあれば、BP+1000される。";
  const LION = "RS-152"; // ガオライオン（M・WB・獣・BP5000）

  it("RS-560: カタログ本文・スペックが出典と一致（出典: atwiki/page-1180）", () => {
    expectCatalogText("RS-560", TEXT);
    expectStats("RS-560", { name: "ガオレオン", category: "WB", size: "M", bp: 4000, sp: undefined, powerCost: 3, features: ["獣"] });
  });

  holdEntryTests("RS-560", "page-1180");

  it("RS-560: 【轟く咆哮】自軍捨札に同名のユニットカードがある「獣」の自軍 M ユニット（ガオライオン）は BP+1000（出典: atwiki/page-1180「自軍捨札に同じカード名のユニットカードがあれば、BP+1000される」）", () => {
    const s = st({ player1: { battle: [inst(LION, "l")], rush: [inst("RS-560", "le")], discard: [inst(LION, "d")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(6000);
  });

  it("RS-560: 【轟く咆哮】自軍捨札に同名カードがなければ BP は変わらない（出典: atwiki/page-1180「…があれば」）", () => {
    const s = st({ player1: { battle: [inst(LION, "l")], rush: [inst("RS-560", "le")], discard: [inst("RS-153", "d")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(5000);
  });

  it("RS-560: 【轟く咆哮】敵軍捨札の同名カードは数えない（出典: atwiki/page-1180「自軍捨札に」）", () => {
    const s = st({ player1: { battle: [inst(LION, "l")], rush: [inst("RS-560", "le")], deck: deckCards(3) }, player2: { discard: [inst(LION, "ed")], deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(5000);
  });

  it("RS-560: 【轟く咆哮】ガオレオンが自軍エリアになければ（捨札）効果はない（出典: atwiki/page-1180「これが自軍エリアにある間」）", () => {
    const s = st({ player1: { battle: [inst(LION, "l")], discard: [inst(LION, "d"), inst("RS-560", "le")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(5000);
  });

  it("RS-560: 【轟く咆哮】バトルエリアのガオレオンでも有効（出典: atwiki/page-1180「自軍エリア」）", () => {
    const s = st({ player1: { battle: [{ ...inst("RS-560", "le"), commandHeld: true }, inst(LION, "l")], discard: [inst(LION, "d")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(6000);
  });

  it("RS-560: 【轟く咆哮】敵軍ターン中も有効（出典: atwiki/page-1180「これが自軍エリアにある間」— ターンの限定なし）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst(LION, "l")], rush: [inst("RS-560", "le")], discard: [inst(LION, "d")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", `${LION}:l`)).toBe(6000);
  });

  it("RS-560: 【轟く咆哮】特徴「獣」を持たない M ユニット（風雷丸）は対象外（出典: atwiki/page-1180「特徴「獣」を持つ」）", () => {
    const s = st({ player1: { battle: [inst("RS-568", "f")], rush: [inst("RS-560", "le")], discard: [inst("RS-568", "d")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-568:f")).toBe(4000);
  });

  it("RS-560: 【轟く咆哮】「獣」でも S ユニットは対象外（出典: atwiki/page-1180「自軍Mユニット」）", () => {
    const s = st({ player1: { battle: [inst("SPEC-BEAST-S", "b")], rush: [inst("RS-560", "le")], discard: [inst("SPEC-BEAST-S", "d")], deck: deckCards(3) } }, [BEAST_S]);
    expect(bpOf(s, "player1", "SPEC-BEAST-S:b")).toBe(2000);
  });

  it("RS-560: 【轟く咆哮】敵軍の「獣」M ユニットは対象外（出典: atwiki/page-1180「自軍Mユニット」）", () => {
    const s = st({ player1: { rush: [inst("RS-560", "le")], deck: deckCards(3) }, player2: { battle: [inst(LION, "el")], discard: [inst(LION, "ed")], deck: deckCards(3, "e") } });
    expect(bpOf(s, "player2", `${LION}:el`)).toBe(5000);
  });

  it("RS-560: 【轟く咆哮】ガオレオン自身も「獣」の M ユニットなので、捨札に同名カードがあれば BP+1000（出典: atwiki/page-1180）", () => {
    const s = st({ player1: { battle: [{ ...inst("RS-560", "le"), commandHeld: true }], discard: [inst("RS-560", "d")], deck: deckCards(3) } });
    expect(bpOf(s, "player1", "RS-560:le")).toBe(5000);
  });
});

// ===========================================================================
describe("RS-561 ガオコンドル", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【吹き荒らす翼】「SP1」";

  it("RS-561: カタログ本文・スペックが出典と一致（出典: atwiki/page-1184）", () => {
    expectCatalogText("RS-561", TEXT);
    expectStats("RS-561", { name: "ガオコンドル", category: "WB", size: "M", bp: 3000, sp: "special", powerCost: 4, comboNumber: 2, features: ["獣"] });
  });

  holdEntryTests("RS-561", "page-1184");
  resistTests("RS-561", "page-1184");
  sp1Cn2Tests("RS-561", "吹き荒らす翼", "page-1184");
});

// ===========================================================================
describe("RS-562 ガオソーシャーク", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※これは敵軍バトルエリアのユニットにアタックできない。 ※これは自軍捨札にあるユニットカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-562: カタログ本文・スペックが出典と一致（出典: atwiki/page-1182）", () => {
    expectCatalogText("RS-562", TEXT);
    expectStats("RS-562", { name: "ガオソーシャーク", category: "WB", size: "M", bp: 4000, sp: undefined, powerCost: 1, features: ["獣"] });
  });

  holdEntryTests("RS-562", "page-1182");

  const shark = (discard: CardInstance[], enemy: { battle?: CardInstance[]; rush?: CardInstance[]; discard?: CardInstance[] }) =>
    st(
      {
        player1: { battle: [{ ...inst("RS-562", "sh"), commandHeld: true }], discard, deck: deckCards(3) },
        player2: { deck: deckCards(3, "e"), ...enemy },
      },
      [COST3],
    );

  it("RS-562: ※ 敵軍バトルエリアのユニットにはアタックできない（出典: atwiki/page-1182「これは敵軍バトルエリアのユニットにアタックできない」）", () => {
    const s = shark([inst("TST-UNIT-0", "d")], { battle: [inst("TST-UNIT-0", "eb")] });
    expect(attackTargets(s, "RS-562:sh")).not.toContain("TST-UNIT-0:eb");
  });

  // 既知の不具合: CARD-RS-562 敵軍ラッシュエリアのユニットにアタックできる※が未実装（アタック先がまったくない）
  it.fails("RS-562: ※ 自軍捨札のユニットカードと同じ必要パワーの数字を持つ敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1182）", () => {
    const s = shark([inst("TST-UNIT-2", "d")], { rush: [inst("TST-UNIT-2", "er2"), inst("TST-UNIT-0", "er0")] });
    expect(attackTargets(s, "RS-562:sh").sort()).toEqual(["TST-UNIT-2:er2"]);
  });

  it("RS-562: ※ 必要パワーの数字が一致しない敵軍ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-1182「同じ必要パワーの数字を持つ」）", () => {
    const s = shark([inst("TST-UNIT-0", "d")], { rush: [inst("TST-UNIT-2", "er2")] });
    expect(attackTargets(s, "RS-562:sh")).toEqual([]);
  });

  it("RS-562: ※ 自軍捨札のオペレーションカードの必要パワーは参照しない（出典: atwiki/page-1182「自軍捨札にあるユニットカードの」）", () => {
    // TST-OP（オペレーション・必要パワー3）だけが捨札にある。敵軍ラッシュエリアに必要パワー3のユニット。
    const s = shark([inst("TST-OP", "d")], { rush: [inst("SPEC-COST3", "er3")] });
    expect(attackTargets(s, "RS-562:sh")).toEqual([]);
  });

  it("RS-562: ※ 敵軍捨札のユニットカードは参照しない（出典: atwiki/page-1182「自軍捨札」）", () => {
    const s = shark([], { rush: [inst("TST-UNIT-2", "er2")], discard: [inst("TST-UNIT-2", "ed")] });
    expect(attackTargets(s, "RS-562:sh")).toEqual([]);
  });

  // 既知の不具合: CARD-RS-562 敵軍ラッシュエリアのユニットにアタックできる※が未実装（アタック先がまったくない）
  it.fails("RS-562: ※ 必要パワー「7+」は数字 7 として一致を判定する（出典: atwiki/page-1182「必要パワーの数字」・R-ADD-01）", () => {
    const s = shark([inst("TST-UNIT-7", "d")], { rush: [inst("TST-UNIT-7", "er7")] });
    expect(attackTargets(s, "RS-562:sh")).toEqual(["TST-UNIT-7:er7"]);
  });
});

// ===========================================================================
describe("RS-563 ガオバッファロー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【突き上げる角】自軍ターン中、これがバトルエリアに出たとき、敵軍ユニットを1体選びホールドしてもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。";

  it("RS-563: カタログ本文・スペックが出典と一致（出典: atwiki/page-1183）", () => {
    expectCatalogText("RS-563", TEXT);
    expectStats("RS-563", { name: "ガオバッファロー", category: "WB", size: "M", bp: 6000, sp: undefined, powerCost: 5, features: ["獣"] });
  });

  holdEntryTests("RS-563", "page-1183");

  const entered = (enemy: Partial<GameState["players"]["player2"]>, mine: Partial<GameState["players"]["player1"]> = {}) =>
    enterWithHold(
      st({ player1: { rush: [inst("RS-563", "bf")], command: releasedCat("WB", 1), deck: deckCards(3), ...mine }, player2: { deck: deckCards(3, "e"), ...enemy } }),
      "RS-563:bf",
      ["TST-OP:cWB0"],
    );

  // 既知の不具合: CARD-RS-563 敵軍ラッシュエリアのユニットが候補には入るが、合法手として選べない
  it.fails("RS-563: 【突き上げる角】候補は必要パワーの数字が敵軍ダメージ以下の敵軍ユニット（ラッシュエリアを含む・等しい数字も可）（出典: atwiki/page-1183「必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない」）", () => {
    const s = entered({ battle: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-2", "e2")], rush: [inst("TST-UNIT-0", "r0"), inst("TST-UNIT-7", "e7")], ...dmg(2) });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-563");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0", "TST-UNIT-0:r0", "TST-UNIT-2:e2"]);
    // 合法手としても選べる
    for (const id of ["TST-UNIT-0:e0", "TST-UNIT-0:r0", "TST-UNIT-2:e2"]) {
      expect(legal(s).some((a) => a.type === "resolve_effect_choice" && a.instanceId === id)).toBe(true);
    }
  });

  // 既知の不具合: CARD-RS-563 選んだユニットをその場でホールドせず、敵軍コマンドゾーンに（ホールド状態で）移してしまう
  it.fails("RS-563: 【突き上げる角】選んだ敵軍バトルエリアのユニットをホールドする（出典: atwiki/page-1183「敵軍ユニットを1体選びホールドしてもよい」）", () => {
    let s = entered({ battle: [inst("TST-UNIT-0", "e0")], ...dmg(2) });
    s = pick(s, "TST-UNIT-0:e0");
    expect(s.players.player2.battle.find((c) => c.instanceId === "TST-UNIT-0:e0")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-563 敵軍ラッシュエリアのユニットを選べない（候補には入るが合法手にならない）
  it.fails("RS-563: 【突き上げる角】敵軍ラッシュエリアのユニットも選んでホールドできる（出典: atwiki/page-1183「敵軍ユニットを1体選び」— 場所の限定なし）", () => {
    let s = entered({ battle: [inst("TST-UNIT-7", "e7")], rush: [inst("TST-UNIT-0", "r0")], ...dmg(1) });
    s = pick(s, "TST-UNIT-0:r0");
    expect(s.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-0:r0")?.commandHeld).toBe(true);
  });

  it("RS-563: 【突き上げる角】任意 — ホールドしないことを選べる（出典: atwiki/page-1183「ホールドしてもよい」）", () => {
    let s = entered({ battle: [inst("TST-UNIT-0", "e0")], ...dmg(2) });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player2.battle[0]?.commandHeld ?? false).toBe(false);
  });

  it("RS-563: 【突き上げる角】敵軍ダメージ0なら必要パワー2のユニットは選べない（出典: atwiki/page-1183「…以下のユニットしか選べない」）", () => {
    const s = entered({ battle: [inst("TST-UNIT-2", "e2")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.battle[0]?.commandHeld ?? false).toBe(false);
  });

  it("RS-563: 【突き上げる角】参照するのは敵軍ダメージで、自軍ダメージではない（出典: atwiki/page-1183「敵軍ダメージの点数」）", () => {
    const s = entered({ battle: [inst("TST-UNIT-2", "e2")] }, { ...dmg(5), power: damageCards(5) });
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-563: 【突き上げる角】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1183「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-563", "bf")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e0")], ...dmg(2), deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-563:bf");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.battle[0]?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("RS-564 ガオジャガー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【引き裂く爪】「SP1」";

  it("RS-564: カタログ本文・スペックが出典と一致（出典: atwiki/page-1185）", () => {
    expectCatalogText("RS-564", TEXT);
    expectStats("RS-564", { name: "ガオジャガー", category: "WB", size: "M", bp: 4000, sp: "special", powerCost: 5, comboNumber: 2, features: ["獣"] });
  });

  holdEntryTests("RS-564", "page-1185");
  resistTests("RS-564", "page-1185");
  sp1Cn2Tests("RS-564", "引き裂く爪", "page-1185");
});

// ===========================================================================
describe("RS-565 轟雷旋風神", () => {
  const TEXT =
    "合体―風雷丸＋旋風神（またはハリケンホーク＋ハリケンレオン＋ハリケンドルフィン）＋轟雷神（またはゴウライビートル＋ゴウライスタッグ） 【ローリングサンダーハリケーン】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアのSユニットをすべて持ち主の手札に戻してもよい。そうしたとき、相手は自分自身の手札からカードを1枚選び、自分自身の山札に戻してシャッフルする。";

  it("RS-565: カタログ本文・スペックが出典と一致（追加条件「自軍合体ユニットを捨札にする」）（出典: atwiki/page-1187）", () => {
    expectCatalogText("RS-565", TEXT);
    expectStats("RS-565", { name: "轟雷旋風神", category: "MA", size: "L", bp: 19000, sp: 2, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
  });

  const rushState = (materials: string[], power = 7) =>
    st({ phase: "rush", player1: { hand: [inst("RS-565", "gs")], rush: materials.map((id) => inst(id, "m")), command: releasedCat("MA", 2), power: powerCards(power), deck: deckCards(3) } });

  it("RS-565: 合体 — 風雷丸＋旋風神＋轟雷神を捨札にしてラッシュできる（出典: atwiki/page-1187「合体―風雷丸＋旋風神…＋轟雷神…」・R-ADD-06）", () => {
    const r = rushFromHand(rushState(["RS-568", "RS-095", "RS-309"]), "player1", "RS-565:gs");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-565:gs")).toBe("rush");
    for (const m of ["RS-568:m", "RS-095:m", "RS-309:m"]) expect(zoneOf(t, "player1", m)).toBe("discard");
  });

  it("RS-565: 合体 — 旋風神のかわりにハリケンホーク＋ハリケンレオン＋ハリケンドルフィン、轟雷神のかわりにゴウライビートル＋ゴウライスタッグでもよい（出典: atwiki/page-1187「（または…）」）", () => {
    const r = rushFromHand(rushState(["RS-568", "RS-096", "RS-097", "RS-098", "RS-310", "RS-311"]), "player1", "RS-565:gs");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-565:gs")).toBe("rush");
  });

  it("RS-565: 合体 — 風雷丸がいなければラッシュできない（出典: atwiki/page-1187・R-ADD-06）", () => {
    expect(canStartRush(rushState(["RS-095", "RS-309"]), "player1", "RS-565:gs")).toBe(false);
  });

  it("RS-565: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-1187「必要パワー：7+」）", () => {
    expect(canStartRush(rushState(["RS-568", "RS-095", "RS-309"], 6), "player1", "RS-565:gs")).toBe(false);
  });

  const entered = () =>
    enter(
      st({
        player1: { rush: [inst("RS-565", "gs")], deck: deckCards(3) },
        player2: {
          rush: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2"), inst("TST-UNIT-2", "m")],
          battle: [inst("TST-UNIT-0", "b")],
          hand: [inst("TST-OP", "h")],
          deck: deckCards(3, "e"),
        },
      }),
      "RS-565:gs",
    );

  it("RS-565: 【ローリングサンダーハリケーン】任意 — 戻すかどうかを選べる（出典: atwiki/page-1187「すべて持ち主の手札に戻してもよい」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-565");
    expect(canSkip(s)).toBe(true);
    const t = skip(s);
    expect(zoneOf(t, "player2", "TST-UNIT-0:s1")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-565 【ローリングサンダーハリケーン】が「敵軍バトルエリアのユニット1体を選ぶ」効果になっており、敵軍ラッシュエリアの S ユニットをすべて戻さず、相手の手札→山札もない
  it.fails("RS-565: 【ローリングサンダーハリケーン】敵軍ラッシュエリアの S ユニットをすべて手札に戻し、相手が手札から1枚選んで山札に戻す（M ユニット・バトルエリアの S ユニットは残る）（出典: atwiki/page-1187）", () => {
    let s = entered();
    // 戻す（任意効果の承認）
    const accept = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
    expect(accept).toBeDefined();
    s = act(s, accept!);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s2")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b")).toBe("battle");
    // 「相手は自分自身の手札からカードを1枚選び」— 選ぶのは相手
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = pick(s, "TST-OP:h");
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("deck");
    expect(s.players.player2.hand).toHaveLength(2);
    expect(s.players.player2.deck).toHaveLength(4);
  });

  it("RS-565: 【ローリングサンダーハリケーン】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1187「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-565", "gs")], deck: deckCards(3) }, player2: { rush: [inst("TST-UNIT-0", "s1")], deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-565:gs");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("rush");
  });

  // grnrngr/faq-card-8 RS-565 Q1「5体合体以上の組み合わせを選択すれば、…対象にすることは可能です」
  it("RS-565: 公式Q&A — 5体以上の組み合わせ（風雷丸＋ハリケン3体＋ゴウライ2体）を選べばスーパーフォーメーションの対象になる（出典: grnrngr/faq-card-8 RS-565 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-565", "gs"), inst("RS-347", "sf")],
        rush: [inst("RS-568", "f"), inst("RS-096", "f"), inst("RS-097", "f")],
        command: [...releasedCat("ET", 1), ...releasedCat("MA", 1), released("RS-098", "c"), released("RS-310", "c"), released("RS-311", "c")],
        power: powerCards(7),
        deck: deckCards(3),
      },
    });
    const sf = playOp(s, "player1", "RS-347:sf");
    expect(sf.ok).toBe(true);
    s = resolveAll(sf.state);
    const r = rushFromHand(s, "player1", "RS-565:gs");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-565:gs")).toBe("rush");
    for (const id of ["RS-098:c", "RS-310:c", "RS-311:c"]) expect(zoneOf(t, "player1", id)).toBe("discard");
  });

  // grnrngr/faq-card-8 RS-565 Q1「「RS-568 風雷丸」「RS-095 旋風神」「RS-309 轟雷神」を捨札にするだけでは3体合体としかみなされません」
  it("RS-565: 公式Q&A — 風雷丸・旋風神・轟雷神（3体合体の組み合わせ）をコマンドゾーンから補うことはできない（出典: grnrngr/faq-card-8 RS-565 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-565", "gs"), inst("RS-347", "sf")],
        command: [...releasedCat("ET", 1), ...releasedCat("MA", 1), released("RS-568", "c"), released("RS-095", "c"), released("RS-309", "c")],
        power: powerCards(7),
        deck: deckCards(3),
      },
    });
    const sf = playOp(s, "player1", "RS-347:sf");
    expect(sf.ok).toBe(true);
    s = resolveAll(sf.state);
    expect(canStartRush(s, "player1", "RS-565:gs")).toBe(false);
  });

  // RS-565 Q2・Q3 は RS-568 風雷丸【各々方、合体で御座る！】の Q（RS-568 の describe で扱う）。
});

// ===========================================================================
describe("RS-566 天雷旋風神", () => {
  const TEXT =
    "合体―トライコンドル＋旋風神（またはハリケンホーク＋ハリケンレオン＋ハリケンドルフィン）＋轟雷神（またはゴウライビートル＋ゴウライスタッグ）＋天空神（または天空神・飛行モード） 【絶対究極奥義アルティマストーム】これをラッシュしたとき、これ以外のすべてのユニットと、すべてのコマンドゾーンのカードを持ち主の山札に戻してシャッフルする。";

  it("RS-566: カタログ本文・スペックが出典と一致（追加条件「自軍合体ユニットを捨札にする」）（出典: atwiki/page-1229）", () => {
    expectCatalogText("RS-566", TEXT);
    expectStats("RS-566", { name: "天雷旋風神", category: "MA", size: "L", bp: 21000, sp: 3, powerCost: "8+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
  });

  const rushState = (materials: string[], power = 8) =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-566", "tr")],
        rush: [...materials.map((id) => inst(id, "m")), inst("TST-UNIT-0", "own")],
        battle: [inst("TST-UNIT-0", "ob")],
        command: releasedCat("MA", 2),
        power: powerCards(power),
        deck: deckCards(3),
      },
      player2: { rush: [inst("TST-UNIT-0", "er")], battle: [inst("TST-UNIT-2", "eb")], command: releasedCat("WB", 2, "ec"), deck: deckCards(3, "e") },
    });

  it("RS-566: 合体 — トライコンドル＋旋風神＋轟雷神＋天空神を捨札にしてラッシュできる（出典: atwiki/page-1229・R-ADD-06）", () => {
    const r = rushFromHand(rushState(["RS-567", "RS-095", "RS-309", "RS-481"]), "player1", "RS-566:tr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-566:tr")).toBe("rush");
    for (const m of ["RS-567:m", "RS-095:m", "RS-309:m", "RS-481:m"]) expect(zoneOf(t, "player1", m)).toBe("discard");
  });

  it("RS-566: 合体 — 天空神のかわりに天空神・飛行モードでもよい（出典: atwiki/page-1229「天空神（または天空神・飛行モード）」）", () => {
    const r = rushFromHand(rushState(["RS-567", "RS-095", "RS-309", "RS-482"]), "player1", "RS-566:tr");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-566:tr")).toBe("rush");
  });

  it("RS-566: 合体 — トライコンドルがいなければラッシュできない（出典: atwiki/page-1229・R-ADD-06）", () => {
    expect(canStartRush(rushState(["RS-095", "RS-309", "RS-481"]), "player1", "RS-566:tr")).toBe(false);
  });

  it("RS-566: 必要パワー8+ — パワー7ではラッシュできない（出典: atwiki/page-1229「必要パワー：8+」）", () => {
    expect(canStartRush(rushState(["RS-567", "RS-095", "RS-309", "RS-481"], 7), "player1", "RS-566:tr")).toBe(false);
  });

  // 既知の不具合: CARD-RS-566 【絶対究極奥義アルティマストーム】が未実装（ログだけ出て、ユニットもコマンドも山札に戻らない）
  it.fails("RS-566: 【絶対究極奥義アルティマストーム】ラッシュしたとき、これ以外のすべてのユニットとすべてのコマンドゾーンのカードを持ち主の山札に戻す（出典: atwiki/page-1229）", () => {
    const r = rushFromHand(rushState(["RS-567", "RS-095", "RS-309", "RS-481"]), "player1", "RS-566:tr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(t.players.player1.rush.map((c) => c.instanceId)).toEqual(["RS-566:tr"]);
    expect(t.players.player1.battle).toHaveLength(0);
    expect(t.players.player1.command).toHaveLength(0);
    expect(t.players.player2.rush).toHaveLength(0);
    expect(t.players.player2.battle).toHaveLength(0);
    expect(t.players.player2.command).toHaveLength(0);
    for (const id of ["TST-UNIT-0:own", "TST-UNIT-0:ob"]) expect(zoneOf(t, "player1", id)).toBe("deck");
    for (const id of ["TST-UNIT-0:er", "TST-UNIT-2:eb", "TST-OP:ec0"]) expect(zoneOf(t, "player2", id)).toBe("deck");
  });

  it("RS-566: 【絶対究極奥義アルティマストーム】天雷旋風神自身は戻らない（出典: atwiki/page-1229「これ以外のすべてのユニット」）", () => {
    const r = rushFromHand(rushState(["RS-567", "RS-095", "RS-309", "RS-481"]), "player1", "RS-566:tr");
    expect(zoneOf(resolveAll(r.state), "player1", "RS-566:tr")).toBe("rush");
  });

  it.todo(
    "RS-566: Q&A — 山札に戻す順番はターンプレイヤーが決める（出典: atwiki/page-1229 Q1「はい、その通りです。」）— 【アルティマストーム】が未実装で、戻す順番を選ぶ公開 API がないため",
  );
  it.todo(
    "RS-566: Q&A — コマンドから先に戻せば敵軍ゴーゴーファイヤーの【プロジェットカノン】、ユニットから先に戻せばダイノガッツを相手は使える（出典: atwiki/page-1229 Q2「はい、どちらの場合も可能です。」）— 【アルティマストーム】が未実装で、戻す順番と途中の反応ウィンドウを公開 API で作れないため",
  );
});

