/**
 * カード別スペック: RS-432〜RS-438（第7弾「七忍の炎陣」オペレーション: 隠流マキビシ〜炎神ソウル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_7.html。RS-436 Q1・Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     と、他カードのページに載る Q&A（page-1254 RK-277 / page-2334 XG6-018 / page-1761 XG2-052 /
 *     page-1665 XG1-028 / page-1824 XG2-017）
 *  3. docs/rules/*.md の一般ルール（R-ZONE-12 常駐置き場は1枚、R-CTR-01 カウンター、R-TIME-01 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attack,
  attackedInEnemyTurn,
  canSkip,
  canStartRush,
  canUseCard,
  choiceIds,
  confirm,
  deckCards,
  enter,
  expectCatalogText,
  fillers,
  inst,
  nextPhase,
  pick,
  playOp,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  skip,
  sUnit,
  st,
  stackedOn,
  strike,
  useCard,
  zoneOf,
} from "./RS7-432-452.helpers";
import type { CardInstance, GameState } from "../types/game";

type P = Partial<GameState["players"]["player1"]>;

/** 特徴「忍者」の S ユニット（BP1000・SP1）。 */
const NINJA = sUnit("SPEC-NIN", { name: "忍者ユニット", features: ["忍者"], category: "MA" });
/** 必要パワー4 の WB S ユニット。 */
const COST4 = sUnit("SPEC-C4", { name: "必要パワー4", powerCost: 4 });
/** ET の S ユニット（SP1）。 */
const ETS = sUnit("SPEC-ETS", { name: "ETストライカー", category: "ET" });
/** 特徴「激気」の WB S ユニット（必要パワー4）。 */
const GEKI_S = sUnit("SPEC-GEKI", { name: "激気S", features: ["激気"], powerCost: 4 });
/** 特徴「激気」の WB M ユニット（必要パワー4）。 */
const GEKI_M = sUnit("SPEC-GEKIM", { name: "激気M", features: ["激気"], powerCost: 4, size: "M" });
const WBM3 = sUnit("SPEC-WBM3", { name: "WB M3", size: "M", powerCost: 3, sp: undefined });
const WBM4 = sUnit("SPEC-WBM4", { name: "WB M4", size: "M", powerCost: 4, sp: undefined });
const ETM1 = sUnit("SPEC-ETM1", { name: "ET M1", size: "M", powerCost: 1, category: "ET", sp: undefined });
const SPECS = [NINJA, COST4, ETS, GEKI_S, GEKI_M, WBM3, WBM4, ETM1];

function stx(o: Parameters<typeof st>[0] = {}) {
  return st(o, SPECS);
}

// ===========================================================================
describe("RS-432 隠流マキビシ", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） ストライクされたとき発動できる⇒相手がバトルフェイズを終えるとき、そのバトルフェイズ中に自分の受けたダメージが2点以上なら、敵軍バトルエリアのSユニットをすべて撃破する。";

  it("RS-432: カタログ本文・スペックが出典と一致（出典: atwiki/page-736）", () => {
    expectCatalogText("RS-432", TEXT);
    const s = stx();
    const d = s.definitions["RS-432"]!;
    expect(d.name).toBe("隠流マキビシ");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("MA");
    expect(d.powerCost).toBe(2);
  });

  /** 敵軍（player2）バトルフェイズ。敵軍バトルエリア: S ストライカー2体・M ユニット1体、ラッシュエリアに S。 */
  const enemyBattle = (p1: P = {}) =>
    stx({
      activePlayer: "player2",
      player1: { hand: [inst("RS-432", "mk")], command: releasedCat("MA", 1), power: powerCards(2), deck: deckCards(8), ...p1 },
      player2: {
        battle: [inst("TST-UNIT-0", "s1"), inst("TST-UNIT-0", "s2"), inst("TST-UNIT-2", "m")],
        rush: [inst("TST-UNIT-0", "r")],
        deck: deckCards(5, "e"),
      },
    });
  const enemyStrike = (s: GameState, id: string) => act(s, { type: "strike", playerId: "player2", instanceId: id });

  // 既知の不具合: CARD-RS-432 ストライクされてもカウンターを使う窓が開かず（ダメージ支払いだけが合法手）、隠流マキビシを使えない
  it.fails("RS-432: ※カウンター — 敵軍ターン中、ストライクされたときに使用できる（出典: atwiki/page-736「ストライクされたとき発動できる」・R-CTR-01）", () => {
    const s = enemyStrike(enemyBattle(), "TST-UNIT-0:s1");
    expect(canUseCard(s, "player1", "RS-432:mk")).toBe(true);
  });

  it("RS-432: ※カウンター — ストライクされていない（アタックされた）ときは使用できない（出典: atwiki/page-736「ストライクされたとき」）", () => {
    const s = act(
      stx({
        activePlayer: "player2",
        player1: { hand: [inst("RS-432", "mk")], battle: [inst("TST-UNIT-0", "mine")], command: releasedCat("MA", 1), power: powerCards(2), deck: deckCards(8) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(5, "e") },
      }),
      { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "TST-UNIT-0:mine" },
    );
    expect(canUseCard(s, "player1", "RS-432:mk")).toBe(false);
  });

  it("RS-432: ※カウンター — 自軍ターン中は使用できない（出典: atwiki/page-736「これは敵軍ターン中にのみ使用できる」）", () => {
    const s = stx({
      player1: { hand: [inst("RS-432", "mk")], battle: [inst("TST-UNIT-0", "mine")], command: releasedCat("MA", 1), power: powerCards(2), deck: deckCards(8) },
      player2: { deck: deckCards(5, "e") },
    });
    expect(canUseCard(s, "player1", "RS-432:mk")).toBe(false);
    expect(canUseCard(strike(s, "TST-UNIT-0:mine"), "player1", "RS-432:mk")).toBe(false);
  });

  // 既知の不具合: CARD-RS-432 ストライクされても隠流マキビシを使えず（本文もスタブ）、相手のバトルフェイズ終了時に何も撃破しない
  it.fails("RS-432: 相手がバトルフェイズを終えるとき、そのバトルフェイズに受けたダメージが2点以上なら敵軍バトルエリアの S ユニットをすべて撃破する（M・ラッシュエリアは残る）（出典: atwiki/page-736）", () => {
    let s = enemyStrike(enemyBattle(), "TST-UNIT-0:s1");
    s = settle(useCard(s, "player1", "RS-432:mk"));
    s = settle(enemyStrike(s, "TST-UNIT-0:s2"));
    expect(s.players.player1.power.filter((c) => c.faceDown).length).toBeGreaterThanOrEqual(2);
    s = resolveAll(nextPhase(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-432 ストライクされても隠流マキビシを使えない（使ったうえでの「2点以上なら」の条件を確かめられない）
  it.fails("RS-432: 受けたダメージが1点だけなら、バトルフェイズを終えても何も撃破しない（出典: atwiki/page-736「2点以上なら」）", () => {
    let s = enemyStrike(enemyBattle(), "TST-UNIT-0:s1");
    s = settle(useCard(s, "player1", "RS-432:mk"));
    s = resolveAll(nextPhase(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s2")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-432 ストライクされても隠流マキビシを使えない
  it.fails("RS-432: 使ったカウンターは捨札になる（出典: atwiki/page-736「※カウンター」・R-CARD-02）", () => {
    let s = enemyStrike(enemyBattle(), "TST-UNIT-0:s1");
    s = settle(useCard(s, "player1", "RS-432:mk"));
    expect(zoneOf(s, "player1", "RS-432:mk")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-433 ネコマル", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 自軍ラッシュフェイズ中、自分が特徴「忍者」を持つユニットをラッシュしたとき、自分の手札からカードを好きな枚数選び、自軍山札の下に好きな順で戻してもよい。そうしたとき、戻した枚数と同じ枚数をドローする。";

  it("RS-433: カタログ本文・スペックが出典と一致（出典: atwiki/page-737）", () => {
    expectCatalogText("RS-433", TEXT);
    const d = stx().definitions["RS-433"]!;
    expect(d.name).toBe("ネコマル");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("MA");
    expect(d.powerCost).toBe(0);
  });

  const rushPhase = (hand: CardInstance[]) =>
    stx({
      phase: "rush",
      player1: {
        operation: [inst("RS-433", "nk")],
        hand,
        command: [...releasedCat("MA", 1), ...releasedCat("WB", 1)],
        power: powerCards(3),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });

  // 既知の不具合: CARD-RS-433 常駐の本文がスタブ（grant_keyword resident のみ）で、忍者をラッシュしても手札を戻す選択が出ない
  it.fails("RS-433: 自軍ラッシュフェイズに特徴「忍者」のユニットをラッシュしたとき、手札から選んだカードを山札の下に戻し、同じ枚数ドローする（出典: atwiki/page-737）", () => {
    const r = rushFromHand(rushPhase([inst("SPEC-NIN", "n"), inst("TST-OP", "h1"), inst("TST-OP", "h2")]), "player1", "SPEC-NIN:n");
    expect(r.ok).toBe(true);
    let s = r.state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-433");
    expect(choiceIds(s)).toEqual(["TST-OP:h1", "TST-OP:h2"]);
    s = resolveAll(confirm(pick(s, "TST-OP:h1")));
    const deck = s.players.player1.deck.map((c) => c.instanceId);
    expect(deck[deck.length - 1]).toBe("TST-OP:h1");
    expect(s.players.player1.hand.map((c) => c.instanceId).sort()).toEqual(["TST-OP:dk0", "TST-OP:h2"]);
  });

  // 既知の不具合: CARD-RS-433 常駐の本文がスタブで、「戻してもよい」の選択自体が出ない
  it.fails("RS-433: 「戻してもよい」— 見送ることができ、手札・山札は変わらない（出典: atwiki/page-737「戻してもよい」）", () => {
    const r = rushFromHand(rushPhase([inst("SPEC-NIN", "n"), inst("TST-OP", "h1")]), "player1", "SPEC-NIN:n");
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-433");
    expect(canSkip(r.state)).toBe(true);
    const s = resolveAll(skip(r.state));
    expect(s.players.player1.hand.map((c) => c.instanceId)).toEqual(["TST-OP:h1"]);
    expect(s.players.player1.deck).toHaveLength(5);
  });

  it("RS-433: 特徴「忍者」を持たないユニットをラッシュしても発動しない（出典: atwiki/page-737「特徴「忍者」を持つユニットをラッシュしたとき」）", () => {
    const r = rushFromHand(rushPhase([inst("TST-UNIT-2", "u"), inst("TST-OP", "h1")]), "player1", "TST-UNIT-2:u");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-433");
    expect(r.state.players.player1.hand.map((c) => c.instanceId)).toEqual(["TST-OP:h1"]);
  });
});

// ===========================================================================
describe("RS-434 ライフバード", () => {
  const TEXT =
    "※常駐 カテゴリにETを持つ自軍ユニットがストライクしてダメージを与えたとき、自軍捨札からSユニットのカードを相手に1枚選ばせてもよい。そうしたとき、相手の選んだユニットカードを自分の手札に加える。";

  it("RS-434: カタログ本文・スペックが出典と一致（出典: atwiki/page-746）", () => {
    expectCatalogText("RS-434", TEXT);
    const d = stx().definitions["RS-434"]!;
    expect(d.name).toBe("ライフバード");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("ET");
    expect(d.powerCost).toBe(2);
  });

  const struck = (striker: string) => {
    let s = stx({
      player1: {
        operation: [inst("RS-434", "lb")],
        rush: [inst(striker, "x")],
        discard: [inst("TST-UNIT-0", "d1"), inst("RS-441", "d2"), inst("TST-UNIT-2", "dm"), inst("TST-OP", "dop")],
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    s = enter(s, `${striker}:x`);
    return settle(strike(s, `${striker}:x`));
  };

  // 既知の不具合: CARD-RS-434 常駐の本文がスタブで、ET ユニットがストライクしてダメージを与えても何も起きない
  it.fails("RS-434: ET の自軍ユニットがストライクしてダメージを与えたとき、相手が自軍捨札の S ユニットのカードから1枚選び、それを自分の手札に加える（出典: atwiki/page-746）", () => {
    let s = struck("SPEC-ETS");
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(1);
    // 「選ばせてもよい」の確認（自分）→ 相手が選ぶ
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      s = s.pendingEffectChoice.validInstanceIds.length > 0 ? pick(s, s.pendingEffectChoice.validInstanceIds[0]!) : confirm(s);
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["RS-441:d2", "TST-UNIT-0:d1"]);
    s = resolveAll(pick(s, "TST-UNIT-0:d1"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d1")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-441:d2")).toBe("discard");
  });

  it("RS-434: ET を持たないユニットのストライクでは発動しない（出典: atwiki/page-746「カテゴリにETを持つ自軍ユニット」）", () => {
    const s = struck("TST-UNIT-0");
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(1);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "TST-UNIT-0:d1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-441:d2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-434 常駐の本文がスタブで、「選ばせてもよい」の選択自体が出ない
  it.fails("RS-434: 「選ばせてもよい」— 自分は見送ることができ、捨札は変わらない（出典: atwiki/page-746「相手に1枚選ばせてもよい」）", () => {
    const s = struck("SPEC-ETS");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-435 アレ", () => {
  const TEXT =
    "※常駐 敵軍ターン中、特徴「忍者」を持つ自軍ユニットが撃破されて捨札になったとき、そのユニットカードをこれに重ねてもよい。自軍ラッシュフェイズ中、自分のユニットカードの必要パワーの数字は、これに重ねたカード1枚につき1少なくなる。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になり、重ねた枚数と同じ数だけ自軍ユニットを選び撃破する。";

  it("RS-435: カタログ本文・スペックが出典と一致（出典: atwiki/page-753）", () => {
    expectCatalogText("RS-435", TEXT);
    const d = stx().definitions["RS-435"]!;
    expect(d.name).toBe("アレ");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("DA");
    expect(d.powerCost).toBe(0);
  });

  const destroyed = (unit: string) =>
    attackedInEnemyTurn({ battle: [inst(unit, "u")], operation: [inst("RS-435", "are")] }, `${unit}:u`, {}, "TST-UNIT-7:atk", SPECS);

  // 既知の不具合: CARD-RS-435 常駐の本文がスタブで、敵軍ターン中に忍者が撃破されて捨札になっても重ねる選択が出ない
  it.fails("RS-435: 敵軍ターン中、特徴「忍者」の自軍ユニットが撃破されて捨札になったとき、そのカードをこれに重ねられる（出典: atwiki/page-753）", () => {
    let s = destroyed("SPEC-NIN");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-435");
    s = resolveAll(pick(s, "SPEC-NIN:u"));
    expect(stackedOn(s, "player1", "RS-435:are").map((c) => c.instanceId)).toEqual(["SPEC-NIN:u"]);
    expect(zoneOf(s, "player1", "SPEC-NIN:u")).toBeNull();
  });

  // 既知の不具合: CARD-RS-435 常駐の本文がスタブで、「重ねてもよい」の選択自体が出ない
  it.fails("RS-435: 「重ねてもよい」— 見送れば捨札のまま（出典: atwiki/page-753「重ねてもよい」）", () => {
    const s = destroyed("SPEC-NIN");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-435");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(zoneOf(t, "player1", "SPEC-NIN:u")).toBe("discard");
    expect(stackedOn(t, "player1", "RS-435:are")).toHaveLength(0);
  });

  it("RS-435: 特徴「忍者」を持たないユニットが撃破されても重ねない（出典: atwiki/page-753「特徴「忍者」を持つ自軍ユニット」）", () => {
    const s = resolveAll(destroyed("TST-UNIT-0"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
    expect(stackedOn(s, "player1", "RS-435:are")).toHaveLength(0);
  });

  it("RS-435: 自軍ターン中に忍者が撃破されても重ねない（出典: atwiki/page-753「敵軍ターン中、」）", () => {
    let s = stx({
      player1: { battle: [inst("SPEC-NIN", "u")], operation: [inst("RS-435", "are")], deck: deckCards(5) },
      player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(5, "e") },
    });
    s = resolveAll(attack(s, "SPEC-NIN:u", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-NIN:u")).toBe("discard");
    expect(stackedOn(s, "player1", "RS-435:are")).toHaveLength(0);
  });

  const withStack = (n: number): CardInstance => ({
    ...inst("RS-435", "are"),
    stackedCards: Array.from({ length: n }, (_, i) => inst("SPEC-NIN", `st${i}`)),
  });

  // 既知の不具合: CARD-RS-435 重ねたカードによる必要パワーの軽減が実装されていない
  it.fails("RS-435: 自軍ラッシュフェイズ中、重ねたカード1枚につき自分のユニットカードの必要パワーが1少なくなる（2枚重ね: 必要パワー4 をパワー2でラッシュできる）（出典: atwiki/page-753）", () => {
    const s = stx({
      phase: "rush",
      player1: { operation: [withStack(2)], hand: [inst("SPEC-C4", "c")], command: releasedCat("WB", 1), power: powerCards(2), deck: deckCards(5) },
    });
    expect(canStartRush(s, "player1", "SPEC-C4:c")).toBe(true);
  });

  it("RS-435: 軽減は重ねた枚数ぶんだけ（2枚重ね: 必要パワー4 はパワー1ではラッシュできない。パワー4ならできる）（出典: atwiki/page-753「1枚につき1少なくなる」）", () => {
    const mk = (n: number) =>
      stx({
        phase: "rush",
        player1: { operation: [withStack(2)], hand: [inst("SPEC-C4", "c")], command: releasedCat("WB", 1), power: powerCards(n), deck: deckCards(5) },
      });
    expect(canStartRush(mk(1), "player1", "SPEC-C4:c")).toBe(false);
    expect(canStartRush(mk(4), "player1", "SPEC-C4:c")).toBe(true);
  });

  it("RS-435: 相手のユニットカードの必要パワーは少なくならない（出典: atwiki/page-753「自分のユニットカードの必要パワー」）", () => {
    const s = stx({
      activePlayer: "player2",
      phase: "rush",
      player1: { operation: [withStack(2)], deck: deckCards(5) },
      player2: { hand: [inst("SPEC-C4", "c")], command: releasedCat("WB", 1, "e"), power: powerCards(2, "ep"), deck: deckCards(5, "e") },
    });
    expect(canStartRush(s, "player2", "SPEC-C4:c")).toBe(false);
  });

  /** 自軍ラッシュフェイズに激気（常駐・WB・必要パワー0）を配置して、アレを常駐置き場から離す（R-ZONE-12）。 */
  const replaceAre = (n: number, units: CardInstance[]) => {
    const s = stx({
      phase: "rush",
      player1: { operation: [withStack(n)], hand: [inst("RS-436", "gk")], rush: units, command: releasedCat("WB", 1), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    const r = playOp(s, "player1", "RS-436:gk");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-435: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（出典: atwiki/page-753「重ねたカードはすべて捨札になり」）", () => {
    const s = resolveAll(replaceAre(2, [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-0", "c")]));
    expect(zoneOf(s, "player1", "RS-435:are")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-NIN:st0")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-NIN:st1")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-435 常駐置き場を離れるときに、重ねた枚数と同じ数の自軍ユニットを撃破しない
  it.fails("RS-435: 常駐置き場を離れるとき、重ねた枚数と同じ数（2体）だけ自軍ユニットを選び撃破する（出典: atwiki/page-753「重ねた枚数と同じ数だけ自軍ユニットを選び撃破する」）", () => {
    let s = replaceAre(2, [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-0", "c")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-435");
    expect(canSkip(s)).toBe(false);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c"]);
    s = resolveAll(s, ["TST-UNIT-0:a", "TST-UNIT-0:b"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:b")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:c")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-435 常駐置き場を離れるときに自軍ユニットを撃破しない
  it.fails("RS-435: 自軍ユニットが重ねた枚数より少なければ、いるユニットをすべて撃破する（出典: atwiki/page-753「重ねた枚数と同じ数だけ…撃破する」）", () => {
    const s = resolveAll(replaceAre(3, [inst("TST-UNIT-0", "a")]));
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-435 必要パワーの軽減が実装されていない（ン・ダグバ・ゼバ 9+ をパワー5ではラッシュできない）。
  // あわせて RK-277 側も、常駐置き場に重ねたカードを追加条件「常駐置き場のカードを4枚選び捨札にする」に数えない（パワー9でも不可）
  it.fails("RS-435: 4枚重ねたアレがあれば「ン・ダグバ・ゼバ」の必要パワーは4少なくなり、パワー5でもラッシュを始められる（出典: atwiki/page-753 Q1・page-1254 Q1「はい、その通りです。「必要パワーを満たしているかの確認」→「追加条件を実行」の順で処理します」）", () => {
    const s = stx({
      phase: "rush",
      player1: { operation: [withStack(4)], hand: [inst("RK-277", "dg")], command: releasedCat("DA", 1), power: powerCards(5), deck: deckCards(5) },
    });
    expect(canStartRush(s, "player1", "RK-277:dg")).toBe(true);
    const r = rushVia(s, "player1", "RK-277:dg");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RK-277:dg")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-436 激気", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 自軍バトルフェイズ中、特徴「激気」を持つ自軍Sユニットがバトルエリアに出たとき、次の効果を発動できる ⇒バトルエリアに出たユニットの必要パワーの数字よりも、必要パワーの数字が小さいWBのMユニットのカードを、自分の手札から1枚選び、自軍ラッシュエリアに出す。";

  it("RS-436: カタログ本文・スペックが出典と一致（出典: atwiki/page-515）", () => {
    expectCatalogText("RS-436", TEXT);
    const d = stx().definitions["RS-436"]!;
    expect(d.name).toBe("激気");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("WB");
    expect(d.powerCost).toBe(0);
  });

  const hand = () => [inst("RS-425", "gj"), inst("SPEC-WBM3", "m3"), inst("SPEC-WBM4", "m4"), inst("SPEC-ETM1", "et"), inst("TST-UNIT-0", "s")];
  /** 自軍バトルフェイズに、激気（常駐）を配置した状態で unit をバトルエリアに出す。 */
  const entered = (unit = "SPEC-GEKI", p2: P = {}) =>
    act(
      stx({
        player1: { operation: [inst("RS-436", "gk")], rush: [inst(unit, "x")], hand: hand(), deck: deckCards(5) },
        player2: { deck: deckCards(5, "e"), ...p2 },
      }),
      { type: "move_to_battle", playerId: "player1", instanceId: `${unit}:x` },
    );

  // 既知の不具合: CARD-RS-436 常駐の本文がスタブで、激気の S ユニットがバトルエリアに出ても選択が出ない
  it.fails("RS-436: 自軍バトルフェイズに特徴「激気」の自軍 S ユニットが出たとき、それより必要パワーの小さい WB の M ユニットのカードだけを手札から選べる（出典: atwiki/page-515）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(choiceIds(s)).toEqual(["RS-425:gj", "SPEC-WBM3:m3"]);
  });

  // 既知の不具合: CARD-RS-436 常駐の本文がスタブで、M ユニットをラッシュエリアに出せない
  it.fails("RS-436: 選んだ WB の M ユニットは自軍ラッシュエリアに出る（出典: atwiki/page-515「自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-WBM3:m3"));
    expect(zoneOf(s, "player1", "SPEC-WBM3:m3")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-436 常駐の本文がスタブで、「発動できる」の選択自体が出ない
  it.fails("RS-436: 「発動できる」— 発動しないことを選べる（出典: atwiki/page-515「次の効果を発動できる」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-436");
    expect(canSkip(s)).toBe(true);
    expect(zoneOf(resolveAll(skip(s)), "player1", "SPEC-WBM3:m3")).toBe("hand");
  });

  // 既知の不具合: CARD-RS-436 常駐の本文がスタブで、追加条件のある M ユニット（ゲキジャガー）も出せない
  it.fails("RS-436: この効果で出すとき、M ユニットの追加条件を満たす必要はない（ゲキジャガーを捨札なしで出せる）（出典: grnrngr/faq-card-7 RS-436 Q1「いいえ、その場合は追加条件を満たす必要はありません」）", () => {
    const s = resolveAll(pick(entered("SPEC-GEKI", { battle: [inst("TST-UNIT-0", "e0")], damage: 3, power: powerCards(3, "ep").map((c) => ({ ...c, faceDown: true })) }), "RS-425:gj"), []);
    expect(zoneOf(s, "player1", "RS-425:gj")).toBe("rush");
    expect(s.players.player1.discard).toHaveLength(0);
  });

  // 既知の不具合: CARD-RS-436 常駐の本文がスタブで、出したゲキジャガーの「ラッシュしたとき」【転転弾】も発動しない
  it.fails("RS-436: この効果で出した M ユニットの「ラッシュしたとき」の効果は発動する（ゲキジャガー【転転弾】の選択が出る）（出典: grnrngr/faq-card-7 RS-436 Q2「はい、発動します」）", () => {
    const s = pick(entered("SPEC-GEKI", { battle: [inst("TST-UNIT-0", "e0")], damage: 3, power: powerCards(3, "ep").map((c) => ({ ...c, faceDown: true })) }), "RS-425:gj");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-425");
    expect(choiceIds(s)).toContain("TST-UNIT-0:e0");
  });

  it("RS-436: 激気の M ユニットが出ても発動しない（出典: atwiki/page-515「特徴「激気」を持つ自軍Sユニット」）", () => {
    const s = entered("SPEC-GEKIM");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-436");
    expect(zoneOf(resolveAll(s), "player1", "SPEC-WBM3:m3")).toBe("hand");
  });

  it("RS-436: 特徴「激気」を持たない S ユニットが出ても発動しない（出典: atwiki/page-515）", () => {
    const s = entered("SPEC-C4");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-436");
  });

  it("RS-436: 敵軍ターン中に激気の S ユニットが出ても発動しない（出典: atwiki/page-515「自軍バトルフェイズ中」）", () => {
    const s = stx({
      activePlayer: "player2",
      player1: { operation: [inst("RS-436", "gk")], rush: [inst("SPEC-GEKI", "x")], hand: hand(), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    const t = enterBattleByEffect(s, "player1", "SPEC-GEKI:x");
    expect(t.pendingEffectChoice?.sourceCardId).not.toBe("RS-436");
    expect(zoneOf(t, "player1", "SPEC-WBM3:m3")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-437 白熱する実況", () => {
  const TEXT =
    "※常駐 自分がLユニットをラッシュしたとき、その追加条件で捨札にした合体ユニットのカードがあれば、すべてウラ向きにしてそのLユニットの下に重ねる。そのLユニットは、ユニットでなくなるとき下に重ねたウラ向きのカードを1枚捨札にすれば、その場に留まる。 これが常駐置き場を離れるとき、自軍Lユニットの下にウラ向きに重ねたカードがあれば、すべて捨札にする。";

  it("RS-437: カタログ本文・スペックが出典と一致（出典: atwiki/page-764）", () => {
    expectCatalogText("RS-437", TEXT);
    const d = stx().definitions["RS-437"]!;
    expect(d.name).toBe("白熱する実況");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("WB");
    expect(d.powerCost).toBe(4);
  });

  const under = (s: GameState, id: string): CardInstance[] => {
    const u = [...s.players.player1.rush, ...s.players.player1.battle].find((c) => c.instanceId === id);
    return u?.stackedCards ?? [];
  };

  /** 白熱する実況を配置し、爆竜トップゲイラー＋爆竜ステゴスライドンを捨札にしてキラーオー（合体）をラッシュする。 */
  const rushKiller = () => {
    const s = stx({
      phase: "rush",
      player1: {
        operation: [inst("RS-437", "jk")],
        rush: [inst("RS-227", "tg"), inst("RS-228", "sg")],
        hand: [inst("RS-226", "ko")],
        command: releasedCat("WB", 1),
        power: powerCards(6),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-226:ko");
    expect(r.ok).toBe(true);
    return resolveAll(r.state);
  };

  it("RS-437: （前提）キラーオーは合体ユニット2体を捨札にしてラッシュできる（出典: atwiki/page-764・R-ADD-06）", () => {
    const s = rushKiller();
    expect(zoneOf(s, "player1", "RS-226:ko")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-437 常駐の本文がスタブで、追加条件で捨札にした合体ユニットのカードが L ユニットの下に重ならない
  it.fails("RS-437: L ユニットをラッシュしたとき、追加条件で捨札にした合体ユニットのカードをすべてウラ向きにしてその L ユニットの下に重ねる（出典: atwiki/page-764）", () => {
    const s = rushKiller();
    expect(zoneOf(s, "player1", "RS-227:tg")).toBeNull();
    expect(zoneOf(s, "player1", "RS-228:sg")).toBeNull();
    const st2 = under(s, "RS-226:ko");
    expect(st2.map((c) => c.instanceId).sort()).toEqual(["RS-227:tg", "RS-228:sg"]);
    expect(st2.every((c) => c.faceDown)).toBe(true);
  });

  it("RS-437: 合体ユニットでない追加条件（自軍 S ユニット5体を捨札にする）で捨札にしたカードは重ねない（出典: atwiki/page-764「その追加条件で捨札にした合体ユニットのカード」）", () => {
    const s = stx({
      phase: "rush",
      player1: {
        operation: [inst("RS-437", "jk")],
        rush: fillers(5),
        hand: [inst("RS-440", "bf")],
        command: releasedCat("ET", 1),
        power: powerCards(6),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-440:bf");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-440:bf")).toBe("rush");
    expect(t.players.player1.discard).toHaveLength(5);
    expect(under(t, "RS-440:bf")).toHaveLength(0);
  });

  const stackedKiller = (): CardInstance => ({
    ...inst("RS-226", "ko"),
    stackedCards: [
      { ...inst("RS-227", "tg"), faceDown: true },
      { ...inst("RS-228", "sg"), faceDown: true },
    ],
  });

  // 既知の不具合: CARD-RS-437 下に重ねたウラ向きのカードを捨札にしてその場に留まる処理が実装されていない
  it.fails("RS-437: 下にウラ向きのカードを重ねた L ユニットは、ユニットでなくなるとき（バトルで撃破されるとき）そのカードを1枚捨札にすればその場に留まる（出典: atwiki/page-764「その場に留まる」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [stackedKiller()], operation: [inst("RS-437", "jk")] }, "RS-226:ko", {}, "TST-UNIT-7:atk", SPECS),
    );
    expect(zoneOf(s, "player1", "RS-226:ko")).toBe("battle");
    expect(under(s, "RS-226:ko")).toHaveLength(1);
    expect(s.players.player1.discard).toHaveLength(1);
  });

  it("RS-437: 下にカードを重ねていない L ユニットは、撃破されればそのまま捨札になる（出典: atwiki/page-764）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("RS-226", "ko")], operation: [inst("RS-437", "jk")] }, "RS-226:ko", {}, "TST-UNIT-7:atk", SPECS),
    );
    expect(zoneOf(s, "player1", "RS-226:ko")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-437 常駐置き場を離れても、L ユニットの下のウラ向きのカードが捨札にならない
  it.fails("RS-437: これが常駐置き場を離れるとき、自軍 L ユニットの下にウラ向きに重ねたカードをすべて捨札にする（出典: atwiki/page-764「すべて捨札にする」・R-ZONE-12）", () => {
    const s = stx({
      phase: "rush",
      player1: { operation: [inst("RS-437", "jk")], rush: [stackedKiller()], hand: [inst("RS-436", "gk")], command: releasedCat("WB", 1), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    const r = playOp(s, "player1", "RS-436:gk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-437:jk")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-227:tg")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-228:sg")).toBe("discard");
    expect(under(t, "RS-226:ko")).toHaveLength(0);
    expect(zoneOf(t, "player1", "RS-226:ko")).toBe("rush");
  });

  it.todo(
    "RS-437: 自軍 L ユニットがない状態でアバレキラーを捨札にしてキラーオーをラッシュしても、アバレキラーは重ねられない（出典: atwiki/page-764 Q1・page-2334 Q3「いいえ、それはできません」）— XG6-018 アバレキラーがカタログ未収録のため",
  );
  it.todo(
    "RS-437: ユナイトベントで重ねた順番は『ユニット→実況のウラ向き5枚→ユナイトベント→ウラ向き2枚』（出典: atwiki/page-764 Q2・page-1761 Q1）— XG2-052 ユナイトベントがカタログ未収録のため",
  );
  it.todo(
    "RS-437: ユナイトベントの「ユニットでなくなるとき」を先に解決すれば、実況で重ねたカードもすべて捨札になる（出典: atwiki/page-764 Q3・page-1761 Q2「はい、その通りです」）— XG2-052 がカタログ未収録のため",
  );
  it.todo(
    "RS-437: 実況の「ユニットでなくなるとき」を先に解決すれば、ユナイトベントで重ねたカードから捨札にするカードを選べる（出典: atwiki/page-764 Q4・page-1761 Q3「はい、できます」）— XG2-052 がカタログ未収録のため",
  );
  it.todo(
    "RS-437: ユナイトベントの BP 修正が参照するウラ向きのカードには実況で重ねたカードも含まれる（出典: atwiki/page-764 Q5・page-1761 Q4「はい、その通りです」）— XG2-052 がカタログ未収録のため",
  );
  it.todo(
    "RS-437: アバレンオージが実況の効果で留まった場合、【アバレンオーになりかけだから…】のその後の処理は無効（出典: atwiki/page-1665 Q1「はい、「XG-028 アバレンオージ」はその場に留まります」）— XG1-028 がカタログ未収録のため",
  );
  it.todo(
    "RS-437: 大連王【大王剣・疾風怒濤】で撃破した DA の L ユニットが実況で留まった場合、パワーゾーンにダメージとして置く処理は発動しない（出典: atwiki/page-1824 Q1）— XG2-017 大連王がカタログ未収録のため",
  );
});

// ===========================================================================
describe("RS-438 炎神ソウル", () => {
  const TEXT = "このカードを自軍パワーゾーンに置く。その後、自軍パワーゾーンのオモテ向きのカードからユニットカードを1枚選び、手札に加えてもよい。";

  it("RS-438: カタログ本文・スペックが出典と一致（出典: atwiki/page-755）", () => {
    expectCatalogText("RS-438", TEXT);
    const d = stx().definitions["RS-438"]!;
    expect(d.name).toBe("炎神ソウル");
    expect(d.type).toBe("operation");
    expect(d.category).toBe("OT");
    expect(d.powerCost).toBe(2);
  });

  const played = () => {
    const s = stx({
      phase: "rush",
      player1: {
        hand: [inst("RS-438", "es")],
        command: releasedCat("OT", 1),
        power: [...powerCards(2), inst("TST-UNIT-0", "pu"), { ...inst("TST-UNIT-2", "pd"), faceDown: true }],
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    const r = playOp(s, "player1", "RS-438:es");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-438: このカードは使用後、捨札ではなく自軍パワーゾーンに（オモテ向きで）置かれる（出典: atwiki/page-755「このカードを自軍パワーゾーンに置く」）", () => {
    const s = resolveAll(played(), ["__none__"]);
    expect(zoneOf(s, "player1", "RS-438:es")).toBe("power");
    expect(s.players.player1.power.find((c) => c.instanceId === "RS-438:es")?.faceDown ?? false).toBe(false);
  });

  // 既知の不具合: CARD-RS-438 「その後、…ユニットカードを1枚選び、手札に加えてもよい」が DSL から落ちている
  it.fails("RS-438: その後、自軍パワーゾーンのオモテ向きのユニットカードだけを選べる（ウラ向き・オペレーションは選べない）（出典: atwiki/page-755「オモテ向きのカードからユニットカードを1枚選び」）", () => {
    const s = played();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-438");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:pu"]);
  });

  // 既知の不具合: CARD-RS-438 パワーゾーンのユニットカードを手札に加える処理が実装されていない
  it.fails("RS-438: 選んだユニットカードは手札に加わる（出典: atwiki/page-755「手札に加えてもよい」）", () => {
    const s = resolveAll(pick(played(), "TST-UNIT-0:pu"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:pu")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-438:es")).toBe("power");
  });

  it("RS-438: 「手札に加えてもよい」— 加えなくてもよい（パワーゾーンのユニットカードはそのまま）（出典: atwiki/page-755「加えてもよい」）", () => {
    let s = played();
    if (s.pendingEffectChoice) {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:pu")).toBe("power");
    expect(zoneOf(s, "player1", "TST-UNIT-2:pd")).toBe("power");
  });
});
