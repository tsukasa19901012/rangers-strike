/**
 * カード別スペック: PR-020〜PR-023（プロモーションカード タイムレッド〜シュリケンジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr/faq-card-plomo には本範囲の項はない。
 *     本文が元カード（RS-218・RS-436・RS-508・RS-483）と同じ（PR-021 は「WB」が「ワイルドビースト」と書かれているだけ）なので、元カードの公式Q&A（faq-card-7 RS-436）を同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-BA-04・R-BTL-01・R-KW-PERM-01）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS4-201-221.c・RS7-432-452.a・RS7-495-515.b・RS7-474-494.b）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attackTargets,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  drain,
  enter,
  enterBattleByEffect,
  enterNext,
  expectCatalogText,
  expectOp,
  expectUnit,
  fillers,
  inst,
  legal,
  pick,
  playOp,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhase,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./PR-015-027.helpers";

const COST4 = sUnit("SPEC-C4", { name: "必要パワー4", powerCost: 4 });
const GEKI_S = sUnit("SPEC-GEKI", { name: "激気S", features: ["激気"], powerCost: 4 });
const GEKI_M = sUnit("SPEC-GEKIM", { name: "激気M", features: ["激気"], powerCost: 4, size: "M" } as never);
const WBM3 = sUnit("SPEC-WBM3", { name: "WB M3", size: "M", powerCost: 3, sp: undefined } as never);
const WBM4 = sUnit("SPEC-WBM4", { name: "WB M4", size: "M", powerCost: 4, sp: undefined } as never);
const ETM1 = sUnit("SPEC-ETM1", { name: "ET M1", size: "M", powerCost: 1, category: "ET", sp: undefined } as never);
const BP6000 = sUnit("SPEC-6000", { bp: 6000 });
const BREAKER = sUnit("SPEC-BREAKER", { bp: 6000, text: "これがユニットを撃破したとき、相手に1点ダメージを与える。" } as never);
const EXTRA = [COST4, GEKI_S, GEKI_M, WBM3, WBM4, ETM1, BP6000, BREAKER];

// ===========================================================================
describe("PR-020 タイムレッド", () => {
  it("PR-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-980）", () => {
    expectCatalogText("PR-020", "【アサルトベクター】「SP1」相手は自分自身のパワーゾーンのダメージ以外のカードを見て、カテゴリの数が2つ以上あれば、1つになるまでダメージ以外のカードを捨札にする。");
    expectUnit("PR-020", { name: "タイムレッド", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: 4, features: ["レッド", "男", "加速"], rarity: "PR" });
  });

  const faceDownCard = (cardId: string, suffix: string): CardInstance => ({ ...inst(cardId, suffix), faceDown: true });
  const timeRed = (position: number, enemyPower: CardInstance[]) => enterNext("PR-020", fillers(position - 1), { power: enemyPower, deck: deckCards(3, "e") });
  const MIXED = () => [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2"), inst("TST-OP-MA", "ma"), inst("TST-OP-DA", "da"), faceDownCard("TST-OP-OT", "dmg")];
  const nonDamageCategories = (s: GameState) => new Set(s.players.player2.power.filter((c) => !c.faceDown).map((c) => String(s.definitions[c.cardId]?.category)));

  it("PR-020: NC（4番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-980「CN：4」）", () => {
    let s = drain(timeRed(4, [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2")]), "player2");
    expect(canStrike(s, "PR-020:x")).toBe(true);
    s = settle(strike(s, "PR-020:x"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("PR-020: 【アサルトベクター】相手のダメージ以外のパワーが ET×2・MA・DA なら、相手が選んで1カテゴリになるまで捨札にする（ダメージはそのまま）（出典: atwiki/page-980）", () => {
    let s = timeRed(4, MIXED());
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = drain(s, "player2", ["TST-OP-MA:ma", "TST-OP-DA:da"]);
    expect(nonDamageCategories(s).size).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP-ET:et1")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP-MA:ma")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-DA:da")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-OT:dmg")).toBe("power");
  });

  it("PR-020: 【アサルトベクター】ダメージ以外が1カテゴリなら捨札にしない（出典: atwiki/page-980「カテゴリの数が2つ以上あれば」）", () => {
    const one = drain(timeRed(4, [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2"), faceDownCard("TST-OP-OT", "dmg")]), "player2");
    expect(one.players.player2.power).toHaveLength(3);
  });

  it("PR-020: NC 不成立（1番目）では捨札にしない（出典: atwiki/page-980・R-CN-02）", () => {
    expect(drain(timeRed(1, MIXED()), "player2").players.player2.discard).toHaveLength(0);
  });
});

// ===========================================================================
describe("PR-021 激気", () => {
  it("PR-021: カタログ本文・スペックが出典と一致（「ワイルドビースト」「Ｓユニット」の表記のまま）（出典: atwiki/page-979）", () => {
    expectCatalogText(
      "PR-021",
      "※常駐（場に配置して、離れるまで効果が有効になる） 自軍バトルフェイズ中、特徴「激気」を持つ自軍Ｓユニットがバトルエリアに出たとき、次の効果を発動できる ⇒バトルエリアに出たユニットの必要パワーの数字よりも、必要パワーの数字が小さいワイルドビーストのMユニットのカードを、自分の手札から1枚選び、自軍ラッシュエリアに出す。",
    );
    expectOp("PR-021", { name: "激気", category: "WB", powerCost: 0, rarity: "PR" });
  });

  it("PR-021: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-979「※常駐」）", () => {
    const r = playOp(rushPhase({ hand: [inst("PR-021", "gk")], command: releasedCat("WB", 1) }), "player1", "PR-021:gk");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "PR-021:gk")).toBe("operation");
  });

  const hand = () => [inst("RS-425", "gj"), inst("SPEC-WBM3", "m3"), inst("SPEC-WBM4", "m4"), inst("SPEC-ETM1", "et"), inst("TST-UNIT-0", "s")];
  const entered = (unit = "SPEC-GEKI", p2: Partial<GameState["players"]["player2"]> = {}) =>
    act(
      st({ player1: { operation: [inst("PR-021", "gk")], rush: [inst(unit, "x")], hand: hand(), deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA),
      { type: "move_to_battle", playerId: "player1", instanceId: `${unit}:x` },
    );

  it("PR-021: 自軍バトルフェイズに特徴「激気」の自軍 S ユニットが出たとき、それより必要パワーの小さい WB の M ユニットのカードだけを手札から選べる（出典: atwiki/page-979）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-021");
    expect(choiceIds(s)).toEqual(["RS-425:gj", "SPEC-WBM3:m3"]);
  });

  it("PR-021: 選んだ WB の M ユニットは自軍ラッシュエリアに出る（発動しないことも選べる）（出典: atwiki/page-979「次の効果を発動できる」「自軍ラッシュエリアに出す」）", () => {
    const s = entered();
    expect(canSkip(s)).toBe(true);
    expect(zoneOf(resolveAll(pick(s, "SPEC-WBM3:m3")), "player1", "SPEC-WBM3:m3")).toBe("rush");
  });

  it("PR-021: 公式Q&A（RS-436 と同じ本文）— この効果で出すとき、M ユニットの追加条件を満たす必要はない（ゲキジャガーを捨札なしで出せる）（出典: grnrngr/faq-card-7 RS-436 Q1）", () => {
    const s = resolveAll(pick(entered("SPEC-GEKI", { battle: [inst("TST-UNIT-0", "e0")], damage: 3, power: powerCards(3, "ep").map((c) => ({ ...c, faceDown: true })) }), "RS-425:gj"), []);
    expect(zoneOf(s, "player1", "RS-425:gj")).toBe("rush");
    expect(s.players.player1.discard).toHaveLength(0);
  });

  it("PR-021: 公式Q&A（RS-436 と同じ本文）— この効果で出した M ユニットの「ラッシュしたとき」の効果は発動する（ゲキジャガー【転転弾】）（出典: grnrngr/faq-card-7 RS-436 Q2）", () => {
    const s = pick(entered("SPEC-GEKI", { battle: [inst("TST-UNIT-0", "e0")], damage: 3, power: powerCards(3, "ep").map((c) => ({ ...c, faceDown: true })) }), "RS-425:gj");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-425");
  });

  it("PR-021: 激気の M ユニット・激気を持たない S ユニットが出ても発動しない（出典: atwiki/page-979「特徴「激気」を持つ自軍Ｓユニット」）", () => {
    expect(entered("SPEC-GEKIM").pendingEffectChoice?.sourceCardId).not.toBe("PR-021");
    expect(entered("SPEC-C4").pendingEffectChoice?.sourceCardId).not.toBe("PR-021");
  });

  it("PR-021: 敵軍ターン中に激気の S ユニットが出ても発動しない（出典: atwiki/page-979「自軍バトルフェイズ中」）", () => {
    const s = st({ activePlayer: "player2", player1: { operation: [inst("PR-021", "gk")], rush: [inst("SPEC-GEKI", "x")], hand: hand(), deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);
    const t = enterBattleByEffect(s, "player1", "SPEC-GEKI:x");
    expect(t.pendingEffectChoice?.sourceCardId).not.toBe("PR-021");
    expect(zoneOf(t, "player1", "SPEC-WBM3:m3")).toBe("hand");
  });
});

// ===========================================================================
describe("PR-022 ゴーオンレッド", () => {
  const ID = "PR-022";
  const at = (position: number, p2: Partial<GameState["players"]["player2"]> = {}) => enterNext(ID, fillers(position - 1), { deck: deckCards(3, "e"), ...p2 }, EXTRA, { deck: deckCards(3) });

  it("PR-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-976）", () => {
    expectCatalogText(ID, "※これは毎ターン、可能ならバトルエリアに出る。 ※これはアタックすることができない。 【ロードサーベル】「SP1」敵軍バトルエリアからユニットを1体選んでもよい。そうしたとき、このユニットと選んだユニットでバトルする。");
    expectUnit(ID, { name: "ゴーオンレッド", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 1, comboNumber: 4, features: ["レッド", "男"], rarity: "PR" });
  });

  it("PR-022: ※ 毎ターン、可能ならバトルエリアに出る — 自軍ラッシュエリアにある間はバトルフェイズを終えられない（出典: atwiki/page-976・R-BA-04）", () => {
    const s = st({ player1: { rush: [inst(ID, "me"), inst("TST-UNIT-0", "o")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
    expect(canEnter(s, `${ID}:me`)).toBe(true);
  });

  it("PR-022: ※ アタックすることができない（敵軍ユニットがいてもアタック先がない）（出典: atwiki/page-976「※これはアタックすることができない」）", () => {
    expect(attackTargets(at(1, { battle: [inst("TST-UNIT-0", "e1")] }), `${ID}:x`)).toEqual([]);
  });

  it("PR-022: 【ロードサーベル】4番目に出て NC が成立すると「SP1」になり、ストライクできる（出典: atwiki/page-976）", () => {
    const s = at(4);
    expect(spOf(s, "player1", `${ID}:x`)).toBe(1);
    expect(canStrike(s, `${ID}:x`)).toBe(true);
  });

  it("PR-022: 【ロードサーベル】敵軍バトルエリアのユニット（ラッシュエリアは選べない）を1体選び、このユニットとバトルする（BP4000 対 BP1000 で撃破）（出典: atwiki/page-976）", () => {
    let s = at(4, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "er")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe(ID);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player1", `${ID}:x`)).toBe("battle");
  });

  it("PR-022: 【ロードサーベル】BP6000 のユニットを選んでバトルすると、ゴーオンレッドが撃破される（出典: atwiki/page-976・R-BTL-01）", () => {
    let s = at(4, { battle: [inst("SPEC-6000", "e6")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe(ID);
    s = resolveAll(pick(s, "SPEC-6000:e6"));
    expect(zoneOf(s, "player1", `${ID}:x`)).toBe("discard");
  });

  it("PR-022: 【ロードサーベル】のバトルはアタックではない — 勝ったあとも「SP1」でストライクできる（出典: atwiki/page-976「※これはアタックすることができない」・RS-508 のカード評価）", () => {
    let s = at(4, { battle: [inst("TST-UNIT-0", "e1")] });
    s = resolveAll(pick(s, "TST-UNIT-0:e1"));
    expect(cardIn(s, "player1", `${ID}:x`)?.battleActed).toBeFalsy();
    expect(canStrike(s, `${ID}:x`)).toBe(true);
  });

  it("PR-022: 【ロードサーベル】「選んでもよい」— 見送れる／1番目（NC 不成立）ならバトルの選択も SP もない（出典: atwiki/page-976・R-CN-02）", () => {
    const s = at(4, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe(ID);
    expect(canSkip(s)).toBe(true);
    const first = at(1, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(spOf(first, "player1", `${ID}:x`)).toBe(0);
  });
});

// ===========================================================================
describe("PR-023 シュリケンジャー", () => {
  it("PR-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-1139）", () => {
    expectCatalogText("PR-023", "【宇宙統一忍者流】自軍ターン中、これがバトルエリアに出たとき、敵軍ラッシュエリアから、ナンバーに数字を持つSユニットを1体選んでも良い。そうしたとき、選んだユニットのＮＣの効果を、このユニットの効果として発動する。");
    expectUnit("PR-023", { name: "シュリケンジャー", category: "MA", size: "S", bp: 5000, sp: undefined, powerCost: "3+", features: ["グリーン", "男", "忍者"], rushCondition: "discard_feature_unit", rarity: "PR" });
  });

  it("PR-023: 追加条件 — 特徴「男」を持つ自軍ユニット1体を捨札にしてラッシュできる（「男」がいなければできない）（出典: atwiki/page-1139「追加条件：特徴「男」を持つ自軍ユニット1体を捨札にする」）", () => {
    const r = rushFromHand(st({ phase: "rush", player1: { hand: [inst("PR-023", "sj")], rush: [inst("RS-099", "man")], command: releasedCat("MA", 1), power: powerCards(3), deck: deckCards(3) } }), "player1", "PR-023:sj");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "PR-023:sj")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-099:man")).toBe("discard");
    const none = st({ phase: "rush", player1: { hand: [inst("PR-023", "sj")], rush: [inst("RS-059", "woman")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "PR-023:sj")).toBe(false);
  });

  const shuri = (activePlayer: "player1" | "player2" = "player1") => {
    const s0 = st({
      activePlayer,
      player1: { rush: [inst("PR-023", "sj")], deck: deckCards(5) },
      player2: { battle: [inst("RS-059", "bblue")], rush: [inst("RS-059", "blue"), inst("RS-099", "red"), inst("TST-UNIT-0", "nonum"), inst("RS-153", "eagle")], deck: deckCards(5, "e") },
    });
    return activePlayer === "player1" ? enter(s0, "PR-023:sj") : enterBattleByEffect(s0, "player1", "PR-023:sj");
  };

  it("PR-023: 【宇宙統一忍者流】敵軍ラッシュエリアの、ナンバーに数字を持つ S ユニットだけを選べる（出典: atwiki/page-1139）", () => {
    const s = shuri();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-023");
    expect(choiceIds(s)).toEqual(["RS-059:blue", "RS-099:red"]);
  });

  it("PR-023: 【宇宙統一忍者流】選んだユニットの NC 効果をこのユニットの効果として発動する（マジブルー → 自分が1枚ドロー）（出典: atwiki/page-1139）", () => {
    const s = resolveAll(pick(shuri(), "RS-059:blue"));
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("PR-023: 【宇宙統一忍者流】「選んでも良い」— 選ばなければ何も起きない（出典: atwiki/page-1139）", () => {
    let s = shuri();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-023");
    expect(canSkip(s)).toBe(true);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("PR-023: 【宇宙統一忍者流】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1139「自軍ターン中」）", () => {
    const s = shuri("player2");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PR-023");
    expect(s.players.player1.hand).toHaveLength(0);
  });
});
