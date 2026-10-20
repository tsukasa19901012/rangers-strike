/**
 * カード別スペック: RS-340〜RS-347（第5弾「五龍の逆鱗」ゲキレッド〜スーパーフォーメーション）
 *  RS-340〜RS-343 は atwiki で「五龍の激鱗」表記、RS-347 は「四雄の覚醒」初出（五龍の逆鱗スターターに再収録、SR-002 と同一カード）。
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（RS-318 の Q に RS-345 が登場）、
 *     faq-card-6（RS-422 の Q に RS-340 が登場）、faq-card-8（RS-565 / RS-569 の Q に RS-347 が登場）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import {
  attack,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  DEFS,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  lastBattleBps,
  pick,
  playOp,
  powerCards,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
  zordDownTests,
} from "./RS5-327-347.helpers";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";

const L5 = sUnit("SPEC-L5", { size: "L", bp: 5000, sp: undefined });
const M2 = sUnit("SPEC-M2", { size: "M", bp: 2000, sp: undefined });

/** player1 のバトルフェイズ: battle（先に出ているユニット）の次に id を出す。 */
function enterAfter(id: string, battle: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}, extra = [L5, M2]) {
  const s = st({ player1: { battle, rush: [inst(id, "x")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
  return enter(s, `${id}:x`);
}

// ===========================================================================
/** ゲキレッド（RS-340 / RS-343 は同一テキスト）。 */
function gekiRedTests(id: string, page: string) {
  const TEXT = "【ゲキヌンチャク】「SP1」特徴「獣」を持つユニットからコンビネーションするとき、このターン、これはBP＋2000される。";

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, TEXT);
    expectStats(id, {
      name: "ゲキレッド",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["レッド", "男"],
    });
  });

  it(`${id}: 【ゲキヌンチャク】2番目に出て NC が成立すると「SP1」になりストライクできる（出典: ${page}「CN：2」）`, () => {
    const s = enterAfter(id, fillers(1));
    expect(spOf(s, "player1", `${id}:x`)).toBe(1);
    expect(canStrike(s, `${id}:x`)).toBe(true);
  });

  it(`${id}: NC が成立していない（3番目）ときは SP！のまま（出典: ${page}「SP：！」）`, () => {
    const s = enterAfter(id, fillers(2));
    expect(spOf(s, "player1", `${id}:x`)).toBe(0);
    expect(canStrike(s, `${id}:x`)).toBe(false);
  });

  it(`${id}: 【ゲキヌンチャク】特徴「獣」を持つユニット（ギガゼール）からコンビネーションしたとき、このターン BP+2000 され、次のターンには元に戻る（出典: ${page}「このターン、これはBP＋2000される」）`, () => {
    let s = enterAfter(id, [inst("RK-119", "beast")], { battle: [inst("TST-UNIT-2", "e")] });
    expect(bpOf(s, "player1", `${id}:x`)).toBe(5000);
    s = settle(attack(s, `${id}:x`, "TST-UNIT-2:e"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
    s = endTurn(s);
    expect(bpOf(s, "player1", `${id}:x`)).toBe(3000);
  });

  it(`${id}: 特徴「獣」を持たないユニットからコンビネーションしたときは BP+2000 されない（出典: ${page}「特徴「獣」を持つユニットから」）`, () => {
    const s = enterAfter(id, fillers(1));
    expect(bpOf(s, "player1", `${id}:x`)).toBe(3000);
  });

  it(`${id}: NC が成立していない（3番目）ときは「獣」のユニットの次に出ても BP+2000 されない（出典: ${page}・R-CN-02）`, () => {
    const s = enterAfter(id, [inst("TST-UNIT-0", "f"), inst("RK-119", "beast")]);
    expect(bpOf(s, "player1", `${id}:x`)).toBe(3000);
  });
}

describe("RS-340 ゲキレッド", () => {
  gekiRedTests("RS-340", "atwiki/page-45");

  // grnrngr/faq-card-6 RS-422 Q1「はい、できます。」（ゲキレッド（S）＋ゲキチーター（M）＋ゲキジャガー（M）でゲキトージャ）
  it("RS-340: 公式Q&A — ゲキレッド（S）＋ゲキチーター（M）＋ゲキジャガー（M）のようにサイズが揃っていなくても、ゲキトージャの追加条件を満たしてラッシュできる（出典: grnrngr/faq-card-6 RS-422 Q1）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-422", "gt")], rush: [inst("RS-340", "r"), inst("RS-424", "c"), inst("RS-425", "j")], command: releasedCat("WB", 1), power: powerCards(6), deck: deckCards(3) },
    });
    const r = rushFromHand(s, "player1", "RS-422:gt");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-422:gt")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-340:r")).toBe("discard");
  });
});

describe("RS-343 ゲキレッド", () => {
  gekiRedTests("RS-343", "atwiki/page-45（RS-340 と同一ページ）");

  it("RS-343: RS-340 と同名カードなので、デッキには合わせて3枚までしか入れられない（出典: atwiki/page-45・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-340", count: 2 }, { cardId: "RS-343", count: 2 }, { cardId: "RS-338", count: 36 }]);
    expect(r.errors.some((e) => e.includes("ゲキレッド"))).toBe(true);
    const ok = validateDeckEntries([{ cardId: "RS-340", count: 2 }, { cardId: "RS-343", count: 1 }, { cardId: "RS-338", count: 37 }]);
    expect(ok.errors.filter((e) => e.includes("ゲキレッド"))).toEqual([]);
  });
});

// ===========================================================================
describe("RS-341 ゲキブルー", () => {
  it("RS-341: カタログ本文・スペックが出典と一致（出典: atwiki/page-36）", () => {
    expectCatalogText("RS-341", "【ゲキトンファー】「SP1」");
    expectStats("RS-341", {
      name: "ゲキブルー",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: "special",
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "男"],
    });
  });

  it("RS-341: 【ゲキトンファー】2番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-36「CN：2」「「SP1」」）", () => {
    const s = enterAfter("RS-341", fillers(1));
    expect(spOf(s, "player1", "RS-341:x")).toBe(1);
    expect(canStrike(s, "RS-341:x")).toBe(true);
  });

  it("RS-341: NC が成立していない（1番目）ときは SP！のまま（ストライクできない）（出典: atwiki/page-36「SP：！」）", () => {
    const s = enterAfter("RS-341", []);
    expect(spOf(s, "player1", "RS-341:x")).toBe(0);
    expect(canStrike(s, "RS-341:x")).toBe(false);
  });
});

// ===========================================================================
describe("RS-342 ゲキイエロー", () => {
  const TEXT = "【ゲキロッド】自軍ターン中、敵軍Sユニットとバトルするとき、このユニットはBP+4000される。";

  it("RS-342: カタログ本文・スペックが出典と一致（出典: atwiki/page-41）", () => {
    expectCatalogText("RS-342", TEXT);
    expectStats("RS-342", {
      name: "ゲキイエロー",
      category: "WB",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      comboNumber: 3,
      features: ["イエロー", "女"],
    });
  });

  it("RS-342: 【ゲキロッド】NC 成立時、自軍ターン中に敵軍 S ユニットとバトルするとき BP+4000（4500）される（出典: atwiki/page-41）", () => {
    let s = enterAfter("RS-342", fillers(2), { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "RS-342:x", "TST-UNIT-0:e"));
    expect(lastBattleBps(s)?.attacker).toBe(4500);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-342:x")).toBe("battle");
  });

  it("RS-342: 敵軍 M ユニットとのバトルでは BP+4000 されない（出典: atwiki/page-41「敵軍Sユニットとバトルするとき」）", () => {
    let s = enterAfter("RS-342", fillers(2), { battle: [inst("SPEC-M2", "e")] });
    s = settle(attack(s, "RS-342:x", "SPEC-M2:e"));
    expect(lastBattleBps(s)?.attacker).toBe(500);
  });

  it("RS-342: NC が成立していない（2番目）ときは敵軍 S ユニットとのバトルでも BP+4000 されない（出典: atwiki/page-41「CN：3」・R-CN-02）", () => {
    let s = enterAfter("RS-342", fillers(1), { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "RS-342:x", "TST-UNIT-0:e"));
    expect(lastBattleBps(s)?.attacker).toBe(500);
  });

  it("RS-342: 敵軍ターン中に敵軍 S ユニットにアタックされたときは BP+4000 されない（出典: atwiki/page-41「自軍ターン中」）", () => {
    let s = enterAfter("RS-342", fillers(2), { rush: [inst("TST-UNIT-0", "e")] });
    s = endTurn(s);
    s = toPhase(s, "player2", "battle");
    s = enter(s, "TST-UNIT-0:e", "player2");
    s = settle(attack(s, "TST-UNIT-0:e", "RS-342:x", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(500);
  });
});

// ===========================================================================
describe("RS-344 天空勇者ウルザードファイヤー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「天空聖者ブレイジェル」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【ブレイジングストームスラッシュ】これはアタックするときリリース状態の自軍コマンド1つにつきBP＋1000される。";

  it("RS-344: カタログ本文・スペックが出典と一致（出典: atwiki/page-499）", () => {
    expectCatalogText("RS-344", TEXT);
    expectStats("RS-344", {
      name: "天空勇者ウルザードファイヤー",
      category: "MA",
      size: "S",
      bp: 7500,
      sp: 1,
      powerCost: "6+",
      features: ["男", "魔法", "天空聖者"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-344: 追加条件 — 自軍「天空聖者ブレイジェル」1体を捨札にしてラッシュできる（出典: atwiki/page-499）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-344", "uf")], rush: [inst("RS-327", "bz")], command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-344:uf");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-344:uf")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-327:bz")).toBe("discard");
  });

  it("RS-344: 追加条件 — 自軍エリアにブレイジェルがなければラッシュできない（出典: atwiki/page-499）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-344", "uf")], rush: fillers(1), discard: [inst("RS-327", "bz")], command: releasedCat("MA", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-344:uf")).toBe(false);
  });

  reanimateTests("RS-344", "RS-327", "天空聖者ブレイジェル", "atwiki/page-499");

  const cmds = () => [...releasedCat("MA", 2), held("TST-OP-MA", "h")];

  it("RS-344: 【ブレイジングストームスラッシュ】アタックするとき、リリース状態の自軍コマンド1つにつき BP+1000（リリース2・ホールド1 → 9500）（出典: atwiki/page-499）", () => {
    let s = st({ player1: { battle: [inst("RS-344", "uf")], command: cmds(), deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "e")], deck: deckCards(3, "e") } });
    s = settle(attack(s, "RS-344:uf", "TST-UNIT-7:e"));
    expect(lastBattleBps(s)?.attacker).toBe(9500);
  });

  it("RS-344: アタックしていないとき（敵軍ターンにアタックされたとき）は BP7500 のまま（出典: atwiki/page-499「これはアタックするとき」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RS-344", "uf")], command: cmds() }, "RS-344:uf");
    expect(lastBattleBps(s)?.defender).toBe(7500);
  });
});

// ===========================================================================
describe("RS-345 デカレッドSWAT", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「デカレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【Dリボルバー】敵軍ラッシュエリアから、カードに表記された本来のBPが3000以下のユニットを1体選び、撃破する。";

  it("RS-345: カタログ本文・スペックが出典と一致（出典: atwiki/page-310）", () => {
    expectCatalogText("RS-345", TEXT);
    expectStats("RS-345", {
      name: "デカレッドSWAT",
      category: "OT",
      size: "S",
      bp: 3500,
      sp: 1,
      powerCost: "7-",
      comboNumber: 1,
      features: ["レッド", "男", "警察", "スワット"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-345", "RS-106", "デカレッド", "atwiki/page-310", "OT");
  reanimateTests("RS-345", "RS-106", "デカレッド", "atwiki/page-310");

  const enemy = { rush: [inst("TST-UNIT-0", "b1000"), inst("RS-106", "b3000"), inst("RS-344", "b7500")], battle: [inst("TST-UNIT-0", "inBattle")] };

  it("RS-345: 【Dリボルバー】NC（1番目）成立時、敵軍ラッシュエリアの本来の BP3000 以下のユニットを1体選び撃破する（BP3000 ちょうども対象、敵軍バトルエリアは対象外）（出典: atwiki/page-310）", () => {
    let s = enterAfter("RS-345", [], enemy);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-345");
    expect(choiceIds(s)).toEqual(["RS-106:b3000", "TST-UNIT-0:b1000"]);
    s = resolveAll(pick(s, "RS-106:b3000"));
    expect(zoneOf(s, "player2", "RS-106:b3000")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b1000")).toBe("rush");
  });

  it("RS-345: 【Dリボルバー】は強制（選ばないことはできない）（出典: atwiki/page-310「1体選び、撃破する」）", () => {
    const s = enterAfter("RS-345", [], enemy);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-345: NC が成立していない（2番目）ときは【Dリボルバー】は発動しない（出典: atwiki/page-310「CN：1」・R-CN-02）", () => {
    const s = resolveAll(enterAfter("RS-345", fillers(1), enemy));
    expect(s.players.player2.rush).toHaveLength(3);
  });

  it("RS-345: 敵軍ラッシュエリアに本来の BP3000 以下のユニットがなければ何も撃破しない（出典: atwiki/page-310）", () => {
    const s = resolveAll(enterAfter("RS-345", [], { rush: [inst("RS-344", "big")] }));
    expect(zoneOf(s, "player2", "RS-344:big")).toBe("rush");
  });

  // grnrngr/faq-card-5 RS-318 Q3「いいえ、含まれません。カードの「追加条件」の欄に記述があるものは「追加条件を持つ」と考えて下さい。」
  it("RS-345: 公式Q&A — 必要パワー「7-」のデカレッドSWAT は追加条件を持つので、ドギー・クルーガーでオモテにしても手札に加わる（ラッシュエリアに出ない）（出典: grnrngr/faq-card-5 RS-318 Q3）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-338", "j")], command: releasedCat("DA", 1), power: powerCards(2), deck: deckCards(3) },
      player2: { rush: [inst("RS-318", "dg")], deck: [inst("RS-345", "swat"), ...deckCards(3, "e")] },
    });
    const r = rushFromHand(s0, "player1", "RS-338:j");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-318");
    const s = resolveAll(r.state, ["reveal"]);
    expect(zoneOf(s, "player2", "RS-345:swat")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-346 バトルフィーバーロボ", () => {
  const TEXT = "【雷光剣唐竹割り】これはアタックするときBP＋2000される。これがLユニットを撃破したとき、相手に2点ダメージを与える。";

  it("RS-346: カタログ本文・スペックが出典と一致（出典: atwiki/page-473）", () => {
    expectCatalogText("RS-346", TEXT);
    expectStats("RS-346", {
      name: "バトルフィーバーロボ",
      category: "ET",
      size: "L",
      bp: 7000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-346: 追加条件 — 自軍Sユニット5体を捨札にしてラッシュできる（出典: atwiki/page-473「自軍Sユニットを5体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-346", "bf")], rush: fillers(5), command: releasedCat("ET", 1), power: powerCards(7), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-346:bf");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-346:bf")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("RS-346: 追加条件 — 自軍Sユニットが4体しかなければラッシュできない（出典: atwiki/page-473）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-346", "bf")], rush: [...fillers(4), inst("TST-UNIT-2", "m")], command: releasedCat("ET", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-346:bf")).toBe(false);
  });

  const atk = (target: string) => {
    let s = st({ player1: { battle: [inst("RS-346", "bf")], deck: deckCards(3) }, player2: { battle: [inst(target.split(":")[0]!, target.split(":")[1]!)], deck: deckCards(3, "e") } }, [L5, M2]);
    s = settle(attack(s, "RS-346:bf", target));
    return s;
  };

  it("RS-346: 【雷光剣唐竹割り】アタックするとき BP+2000（9000）される（出典: atwiki/page-473「これはアタックするときBP＋2000される」）", () => {
    const s = atk("TST-UNIT-7:e");
    expect(lastBattleBps(s)?.attacker).toBe(9000);
  });

  it("RS-346: アタックされたとき（敵軍ターン）は BP+2000 されない（出典: atwiki/page-473「アタックするとき」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RS-346", "bf")] }, "RS-346:bf");
    expect(lastBattleBps(s)?.defender).toBe(7000);
  });

  it("RS-346: アタックして L ユニット（トラベリオンエクスプレス）を撃破したとき、相手に2点ダメージを与える（出典: atwiki/page-473「これがLユニットを撃破したとき、相手に2点ダメージを与える」）", () => {
    const s = atk("RS-329:e");
    expect(zoneOf(s, "player2", "RS-329:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(2);
    expect(s.players.player1.damage).toBe(0);
  });

  it("RS-346: S ユニットを撃破したときはダメージを与えない（出典: atwiki/page-473「Lユニットを撃破したとき」）", () => {
    const s = atk("TST-UNIT-0:e");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-346: L ユニットにアタックしても撃破できなかった（負けた）ときはダメージを与えない（出典: atwiki/page-473「撃破したとき」）", () => {
    const s = atk("TST-UNIT-7:e");
    expect(zoneOf(s, "player2", "TST-UNIT-7:e")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-346: 敵軍ターン中にアタックしてきた L ユニットをバトルで撃破したときも、相手に2点ダメージを与える（出典: atwiki/page-473「これがLユニットを撃破したとき」— アタック時に限定されていない）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-346", "bf")] }, "RS-346:bf", {}, "SPEC-L5:atk", [L5]));
    expect(zoneOf(s, "player2", "SPEC-L5:atk")).toBe("discard");
    expect(s.players.player2.damage).toBe(2);
  });
});

// ===========================================================================
describe("RS-347 スーパーフォーメーション", () => {
  const TEXT =
    "このターン、5体以上の合体ユニットを必要とする特徴「メカ」を持つユニットのカードをラッシュするとき、追加条件を満たすために次のようにしてもよい⇒自軍コマンドゾーンのリリース状態のカードから、合体ユニットに足りない分のユニットと同じ名前のカードを捨札にする。";

  it("RS-347: カタログ本文・スペックが出典と一致（オペレーション・AT・必要パワー6）（出典: atwiki/page-388）", () => {
    expectCatalogText("RS-347", TEXT);
    const d = DEFS["RS-347"]!;
    expect(d.name).toBe("スーパーフォーメーション");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("ET");
    expect(d.powerCost).toBe(6);
    expect(d.rushAdditionalCondition).toBeUndefined();
  });

  /** ビクトリーロボ（RS-382、5体合体）。onField は自軍ラッシュエリア、inCommand はコマンドゾーン（リリース／ホールド）。 */
  function victoryState(onField: string[], inCommand: CardInstance[], withSF = true, extra: CardDefinition[] = []) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-382", "vr"), ...(withSF ? [inst("RS-347", "sf")] : [])],
        rush: onField.map((id) => inst(id, "f")),
        command: [...releasedCat("ET", 2), ...inCommand],
        power: powerCards(7),
        deck: deckCards(3),
      },
    }, extra);
  }
  const useSF = (s: GameState) => {
    const r = playOp(s, "player1", "RS-347:sf");
    expect(r.ok).toBe(true);
    return resolveAll(r.state);
  };

  it("RS-347: 比較 — 合体ユニット5体がすべて自軍エリアにあればビクトリーロボはラッシュできる（出典: atwiki RS-382「合体―レッドラダー＋ブルースローワー＋グリーンホバー＋イエローアーマー＋ピンクエイダー」）", () => {
    const r = rushFromHand(victoryState(["RS-383", "RS-384", "RS-385", "RS-386", "RS-387"], [], false), "player1", "RS-382:vr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-382:vr")).toBe("rush");
  });

  it("RS-347: 使わなければ、コマンドゾーンのカードで合体ユニットの不足分を補えない（出典: atwiki/page-388「このターン、…次のようにしてもよい」）", () => {
    const s = victoryState(["RS-383", "RS-385"], ["RS-384", "RS-386", "RS-387"].map((id) => released(id, "c")), false);
    expect(canStartRush(s, "player1", "RS-382:vr")).toBe(false);
  });

  it("RS-347: 使ったターン、自軍コマンドゾーンのリリース状態の同名カードで不足分（3体）を補ってビクトリーロボをラッシュでき、そのカードは捨札になる（出典: atwiki/page-388）", () => {
    let s = victoryState(["RS-383", "RS-385"], ["RS-384", "RS-386", "RS-387"].map((id) => released(id, "c")));
    s = useSF(s);
    const r = rushFromHand(s, "player1", "RS-382:vr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-382:vr")).toBe("rush");
    for (const id of ["RS-384:c", "RS-386:c", "RS-387:c", "RS-383:f", "RS-385:f"]) expect(zoneOf(t, "player1", id)).toBe("discard");
  });

  it("RS-347: ホールド状態のコマンドのカードでは不足分を補えない（出典: atwiki/page-388「リリース状態のカードから」）", () => {
    let s = victoryState(["RS-383", "RS-385"], ["RS-384", "RS-386", "RS-387"].map((id) => held(id, "c")));
    s = useSF(s);
    expect(canStartRush(s, "player1", "RS-382:vr")).toBe(false);
  });

  it("RS-347: 効果は「このターン」だけ — 次の自軍ターンには不足分を補えない（出典: atwiki/page-388「このターン」）", () => {
    let s = victoryState(["RS-383", "RS-385"], ["RS-384", "RS-386", "RS-387"].map((id) => released(id, "c")));
    s = useSF(s);
    s = endTurn(s);
    s = toPhase(s, "player1", "rush");
    expect(canStartRush(s, "player1", "RS-382:vr")).toBe(false);
  });

  // atwiki/page-388 Q1「はい、できます。」（コマンドゾーンのビクトリーウォーカー＋自軍エリアのレッドラダー・グリーンホバー）
  it("RS-347: Q&A — リリース状態のビクトリーウォーカー（ブルースローワー＋イエローアーマー＋ピンクエイダーとして使える）をコマンドゾーンから、レッドラダー・グリーンホバーを自軍エリアから捨札にしてビクトリーロボをラッシュできる（出典: atwiki/page-388 Q1）", () => {
    // XG3-006 はゲームのカード定義（allCardsCatalog）にある実カードを使う。
    let s = victoryState(["RS-383", "RS-385"], [released("XG3-006", "vw")], true);
    s = useSF(s);
    const r = rushFromHand(s, "player1", "RS-382:vr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-382:vr")).toBe("rush");
    expect(zoneOf(t, "player1", "XG3-006:vw")).toBe("discard");
  });

  // grnrngr/faq-card-8 RS-569 Q2「いいえ、できません。」（デカレンジャーロボ＋デカバイクは2体合体）
  it("RS-347: 公式Q&A — デカレンジャーロボ＋デカバイク（2体合体）としてのスーパーデカレンジャーロボには使えない（出典: grnrngr/faq-card-8 RS-569 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-569", "sd"), inst("RS-347", "sf")],
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1), released("RS-042", "c"), released("RS-570", "c")],
        power: powerCards(8),
        deck: deckCards(3),
      },
    });
    s = useSF(s);
    expect(canStartRush(s, "player1", "RS-569:sd")).toBe(false);
  });

  // grnrngr/faq-card-8 RS-569 Q1「はい、できます。」（追加条件が「合体ユニットをパワー送りにする」ユニットでも使える）
  it("RS-347: 公式Q&A — 追加条件が「合体ユニットをパワーゾーンに送る」スーパーデカレンジャーロボ（デカバイクロボ＋パトストライカー〜パトシグナーの6体合体）にも使える（出典: grnrngr/faq-card-8 RS-569 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-569", "sd"), inst("RS-347", "sf")],
        rush: [inst("RS-571", "f"), inst("RS-043", "f"), inst("RS-044", "f")],
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1), released("RS-045", "c"), released("RS-046", "c"), released("RS-047", "c")],
        power: powerCards(8),
        deck: deckCards(3),
      },
    });
    s = useSF(s);
    const r = rushFromHand(s, "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-569:sd")).toBe("rush");
  });

  // grnrngr/faq-card-8 RS-565 Q1「…5体合体以上の組み合わせを選択すれば…対象にすることは可能です。…「風雷丸」「旋風神」「轟雷神」を捨札にするだけでは3体合体としかみなされません」
  it("RS-347: 公式Q&A — 轟雷旋風神は5体以上の組み合わせ（風雷丸＋ハリケン3体＋ゴウライ2体）を選べば対象にできる（出典: grnrngr/faq-card-8 RS-565 Q1）", () => {
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
    s = useSF(s);
    const r = rushFromHand(s, "player1", "RS-565:gs");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-565:gs")).toBe("rush");
  });

  it("RS-347: 公式Q&A — 轟雷旋風神を風雷丸・旋風神・轟雷神（3体合体の組み合わせ）のコマンドゾーンのカードで補うことはできない（出典: grnrngr/faq-card-8 RS-565 Q1「3体合体としかみなされません」）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-565", "gs"), inst("RS-347", "sf")],
        command: [...releasedCat("ET", 1), ...releasedCat("MA", 1), released("RS-568", "c"), released("RS-095", "c"), released("RS-309", "c")],
        power: powerCards(7),
        deck: deckCards(3),
      },
    });
    s = useSF(s);
    expect(canStartRush(s, "player1", "RS-565:gs")).toBe(false);
  });
});
