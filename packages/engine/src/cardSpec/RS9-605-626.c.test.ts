/**
 * カード別スペック: RS-620〜RS-626（第9弾「蒼九の翼」ジェットガルーダ〜ギャラクシーメガ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-9（カード別 Q&A なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。Q&A なし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01、R-ZONE-08、R-TIME-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  canStartRush,
  canWing,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  enterBattleByEffect,
  enterSeq,
  expectCatalogText,
  expectRarity,
  expectStats,
  fill,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  zoneOf,
} from "./RS9-605-626.helpers";

const BP5000 = sUnit("SPEC-BP5000", { bp: 5000 });
const NOSP = sUnit("SPEC-NOSP", { sp: undefined });
const SILVER_NOSP_S = sUnit("SPEC-SILVER-NOSP", { category: "ET", sp: undefined, features: ["シルバー"] });

// ===========================================================================
describe("RS-620 ジェットガルーダ", () => {
  const TEXT = "【ガルーダクロー】これをラッシュしたとき、敵軍パワーゾーンからダメージ以外のカードを1枚選び、持ち主の山札の上に戻してもよい。";

  it("RS-620: カタログ本文・スペックが出典と一致（出典: atwiki/page-1458）", () => {
    expectCatalogText("RS-620", TEXT);
    expectStats("RS-620", { name: "ジェットガルーダ", category: "OT", size: "L", bp: 10000, sp: 1, powerCost: "7+", features: ["メカ", "人型", "航空機"], rushCondition: "discard_named_unit" });
  });

  // 既知の不具合: CARD-RS-620 カタログのレアリティが N（atwiki はノーマルレア）
  it.fails("RS-620: レアリティ — ノーマルレア（出典: atwiki/page-1458）", () => {
    expectRarity("RS-620", "NR");
  });

  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-620", "jg")], rush: [inst("RS-621", "bg")], command: releasedCat("OT", 1), power: powerCards(7), deck: deckCards(3), ...p1 },
      player2: { power: [inst("TST-P", "ep1"), { ...inst("TST-P", "ed"), faceDown: true }, inst("TST-OP", "ep2")], deck: deckCards(3, "e") },
    });
  const rushIt = (s: GameState) => {
    const r = rushFromHand(s, "player1", "RS-620:jg", { materials: ["RS-621:bg"] });
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-620: 追加条件 — 自軍「バードガルーダ」1体を捨札にしてラッシュできる（出典: atwiki/page-1458）", () => {
    const s = rushIt(board());
    expect(zoneOf(s, "player1", "RS-620:jg")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-621:bg")).toBe("discard");
  });

  it("RS-620: 追加条件 — 自軍に「バードガルーダ」がなければラッシュできない（出典: atwiki/page-1458）", () => {
    expect(canStartRush(board({ rush: [inst("TST-UNIT-0", "x")] }), "player1", "RS-620:jg")).toBe(false);
  });

  // 既知の不具合: CARD-RS-620 【ガルーダクロー】が候補のない確認（confirm）を開くだけで、敵軍パワーゾーンのカードを選べない
  it.fails("RS-620: 【ガルーダクロー】敵軍パワーゾーンのダメージ以外のカードを1枚選び、敵軍山札の上に戻す（出典: atwiki/page-1458）", () => {
    let s = rushIt(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-620");
    expect(choiceIds(s)).toEqual(["TST-OP:ep2", "TST-P:ep1"]);
    s = resolveAll(pick(s, "TST-P:ep1"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-P:ep1");
    expect(s.players.player2.power).toHaveLength(2);
  });

  it("RS-620: 【ガルーダクロー】ダメージ（ウラ向き）のカードは戻さない（出典: atwiki/page-1458「ダメージ以外のカード」）", () => {
    let s = rushIt(board());
    if (s.pendingEffectChoice?.sourceCardId === "RS-620") {
      expect(choiceIds(s)).not.toContain("TST-P:ed");
      s = s.pendingEffectChoice.kind === "confirm" ? confirm(s) : s;
    }
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-P:ed")).toBe("power");
  });

  it("RS-620: 【ガルーダクロー】任意 — 戻さなければ敵軍パワーゾーンはそのまま（出典: atwiki/page-1458「戻してもよい」）", () => {
    let s = rushIt(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-620");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player2.power).toHaveLength(3);
    expect(s.players.player2.deck).toHaveLength(3);
  });
});

// ===========================================================================
describe("RS-621 バードガルーダ", () => {
  const TEXT = "※ウイング 【ダイヤブリザード】 これをラッシュしたとき、敵軍ユニットを本来のBPが8000以下になるように好きな数選び、持ち主のパワーゾーンに送ってもよい。";

  it("RS-621: カタログ本文・スペックが出典と一致（出典: atwiki/page-1459）", () => {
    expectCatalogText("RS-621", TEXT);
    expectStats("RS-621", { name: "バードガルーダ", category: "OT", size: "L", bp: 5000, sp: undefined, powerCost: "6+", features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_discard" });
  });

  it("RS-621: レアリティ — ノーマル（出典: atwiki/page-1459）", () => {
    expectRarity("RS-621", "N");
  });

  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-621", "bg")], rush: fill(3), command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3), ...p1 },
        player2: {
          battle: [inst("TST-UNIT-2", "e3"), { ...inst("SPEC-BP5000", "e5"), bpModifier: 4000 }, inst("TST-UNIT-7", "e13")],
          rush: [inst("TST-UNIT-0", "er")],
          deck: deckCards(3, "e"),
        },
      },
      [BP5000],
    );
  const rushIt = (s: GameState) => {
    const r = rushFromHand(s, "player1", "RS-621:bg");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-621: 追加条件 — 自軍 S ユニット3体を捨札にしてラッシュできる（出典: atwiki/page-1459）", () => {
    const s = rushIt(board());
    expect(zoneOf(s, "player1", "RS-621:bg")).toBe("rush");
    expect(s.players.player1.discard).toHaveLength(3);
  });

  it("RS-621: 追加条件 — 自軍 S ユニットが2体ではラッシュできない（出典: atwiki/page-1459「Sユニットを3体」）", () => {
    expect(canStartRush(board({ rush: fill(2) }), "player1", "RS-621:bg")).toBe(false);
  });

  it("RS-621: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドしてアタックできる（出典: atwiki/page-1459・R-KW-WING-01）", () => {
    const s = st({ player1: { rush: [inst("RS-621", "bg")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    expect(canWing(s, "RS-621:bg")).toBe(true);
  });

  // 既知の不具合: CARD-RS-621 【ダイヤブリザード】の候補が自分自身（バードガルーダ）になっていて、敵軍ユニットを選べない
  it.fails("RS-621: 【ダイヤブリザード】本来の BP の合計が8000以下になるように敵軍ユニット（BP3000＋本来 BP5000）を選び、持ち主のパワーゾーンに送る（出典: atwiki/page-1459）", () => {
    let s = rushIt(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-621");
    expect(choiceIds(s)).toEqual(["SPEC-BP5000:e5", "TST-UNIT-0:er", "TST-UNIT-2:e3"]);
    s = pick(s, "TST-UNIT-2:e3");
    s = pick(s, "SPEC-BP5000:e5");
    if (s.pendingEffectChoice?.sourceCardId === "RS-621") s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e3")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-BP5000:e5")).toBe("power");
    expect(zoneOf(s, "player2", "TST-UNIT-7:e13")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-621 【ダイヤブリザード】が敵軍ユニットを候補にしない
  it.fails("RS-621: 【ダイヤブリザード】合計が8000を超える組み合わせは選べない（BP3000＋BP5000 を選んだ後に BP1000 は追加できない）（出典: atwiki/page-1459「本来のBPが8000以下になるように」）", () => {
    let s = rushIt(board());
    s = pick(pick(s, "TST-UNIT-2:e3"), "SPEC-BP5000:e5");
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:er");
  });

  // 既知の不具合: CARD-RS-621 【ダイヤブリザード】の候補が自分自身で、選ぶと自軍のバードガルーダが自軍パワーゾーンに送られる
  it.fails("RS-621: 【ダイヤブリザード】自軍のユニットは送らない（出典: atwiki/page-1459「敵軍ユニットを」）", () => {
    const s = resolveAll(rushIt(board()), ["RS-621:bg"]);
    expect(zoneOf(s, "player1", "RS-621:bg")).toBe("rush");
  });

  it("RS-621: 【ダイヤブリザード】任意 — 送らなければ敵軍ユニットはそのまま（出典: atwiki/page-1459「送ってもよい」）", () => {
    let s = rushIt(board());
    if (s.pendingEffectChoice?.sourceCardId === "RS-621") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(s.players.player2.battle).toHaveLength(3);
    expect(s.players.player2.rush).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-622 グリフォーザー", () => {
  const TEXT = "※ウイング 【グリフォカリバー4世】このユニットは、敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-622: カタログ本文・スペックが出典と一致（出典: atwiki/page-1487）", () => {
    expectCatalogText("RS-622", TEXT);
    expectStats("RS-622", { name: "グリフォーザー", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 5, features: ["男"] });
  });

  // 既知の不具合: CARD-RS-622 カタログのレアリティが N（atwiki はレア）
  it.fails("RS-622: レアリティ — レア（出典: atwiki/page-1487）", () => {
    expectRarity("RS-622", "R");
  });

  const board = (zone: "battle" | "rush") =>
    st({ player1: { [zone]: [inst("RS-622", "g")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") } });

  it("RS-622: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドしてアタックできる（出典: atwiki/page-1487・R-KW-WING-01）", () => {
    expect(canWing(board("rush"), "RS-622:g")).toBe(true);
  });

  // 既知の不具合: CARD-RS-622 【グリフォカリバー4世】が DSL スタブで NC（trigger: nc）扱いになっており、CN を持たないので常に無効
  it.fails("RS-622: 【グリフォカリバー4世】バトルエリアから敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1487）", () => {
    expect(targetsOf(board("battle"), "RS-622:g")).toEqual(["TST-UNIT-0:e1", "TST-UNIT-0:er"]);
  });

  it("RS-622: 【グリフォカリバー4世】を持たないユニットは敵軍ラッシュエリアにアタックできない（出典: R-ATK 一般則との対比）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-2", "m")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") } });
    expect(targetsOf(s, "TST-UNIT-2:m")).toEqual(["TST-UNIT-0:e1"]);
  });
});

// ===========================================================================
describe("RS-623 ツバサマル", () => {
  const TEXT =
    "※ウイング 【翼合体】 自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒※ウイング、BP+2000";

  it("RS-623: カタログ本文・スペックが出典と一致（出典: atwiki/page-1460）", () => {
    expectCatalogText("RS-623", TEXT);
    expectStats("RS-623", { name: "ツバサマル", category: "MA", size: "M", bp: 3000, sp: undefined, powerCost: 4, features: ["忍者", "獣"] });
  });

  it("RS-623: レアリティ — ノーマル（出典: atwiki/page-1460）", () => {
    expectRarity("RS-623", "N");
  });

  it("RS-623: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドしてアタックできる（出典: atwiki/page-1460・R-KW-WING-01）", () => {
    const s = st({ player1: { rush: [inst("RS-623", "t")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    expect(canWing(s, "RS-623:t")).toBe(true);
  });

  const rushBoard = (rush: ReturnType<typeof inst>[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-623", "t")], rush, command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
  const rushIt = (s: GameState) => {
    const r = rushFromHand(s, "player1", "RS-623:t");
    expect(r.ok).toBe(true);
    return r.state;
  };
  /** 翼合体でジェットイカロス（L・ET）に重ねる。 */
  const stacked = () => resolveAll(pick(rushIt(rushBoard([inst("RS-618", "L")])), "RS-618:L"));

  it("RS-623: 【翼合体】DA を持たない自軍 L ユニット（ジェットイカロス）に重ねると、そのユニットは BP+2000 される（出典: atwiki/page-1460）", () => {
    const s = stacked();
    expect(zoneOf(s, "player1", "RS-618:L")).toBe("rush");
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["RS-618:L"]);
    expect(bpOf(s, "player1", "RS-618:L")).toBe(8000);
  });

  it("RS-623: 【翼合体】重ねたユニットは ※ウイング を得る（自軍バトルフェイズにウイングを発動できる）（出典: atwiki/page-1460「次の能力を得る⇒※ウイング」）", () => {
    let s = stacked();
    s = { ...s, phase: "battle" };
    expect(canWing(s, "RS-618:L")).toBe(true);
  });

  it("RS-623: 【翼合体】候補は DA を持たない自軍 L ユニットだけ（DA の L・M ユニットは選べない）（出典: atwiki/page-1460「DAを持たない自軍Lユニット」）", () => {
    const s = rushIt(rushBoard([inst("RS-618", "L"), inst("RS-586", "da"), inst("TST-UNIT-2", "m")]));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-623");
    expect(choiceIds(s)).toEqual(["RS-618:L"]);
  });

  it("RS-623: 【翼合体】任意 — 重ねなければツバサマルはユニットのまま（出典: atwiki/page-1460「重ねてもよい」）", () => {
    let s = rushIt(rushBoard([inst("RS-618", "L")]));
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-623:t")).toBe("rush");
    expect(bpOf(s, "player1", "RS-618:L")).toBe(6000);
  });

  // 既知の不具合: CARD-RS-623 重ねたユニットが撃破されて捨札になるとき、重ねていたツバサマルがどのゾーンにも残らず消える
  it.fails("RS-623: 【翼合体】重ねたユニットが撃破されてユニットでなくなるとき、ツバサマルも捨札になる（出典: atwiki/page-1460「重ねたユニットがユニットでなくなるとき捨札になる」）", () => {
    const s = stacked();
    // 敵軍ターン。ラッシュエリアのジェットイカロスはアタックされないので、重ねた状態のままバトルエリアに置いて組み直す
    const host = s.players.player1.rush.find((c) => c.instanceId === "RS-618:L")!;
    let t = attackedInEnemyTurn({ battle: [host] }, "RS-618:L", { battle: [inst("TST-UNIT-7", "atk"), inst("TST-UNIT-7", "atk2")] });
    t = resolveAll(t);
    expect(zoneOf(t, "player1", "RS-618:L")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-623:t")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-623 【翼合体】がツバサマルをラッシュしたときにしか発動せず、自軍ラッシュフェイズ中に後から出た L ユニットには重ねられない
  it.fails("RS-623: 【翼合体】ラッシュエリアにいるツバサマルは、自軍ラッシュフェイズ中ならいつでも（後からラッシュした L ユニットにも）重ねられる（出典: atwiki/page-1460「自軍ラッシュフェイズ中」）", () => {
    const s = st({ phase: "rush", player1: { rush: [inst("RS-623", "t"), inst("RS-618", "L")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => "unitInstanceId" in a && a.unitInstanceId === "RS-623:t")).toBe(true);
  });
});

// ===========================================================================
describe("RS-624 メガウインガー・ファイターモード", () => {
  const TEXT =
    "【ウインガーキャノン】 自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアのユニットが4体なら、次の効果を発動できる⇒敵軍バトルエリアの追加条件を持たないユニットをすべて持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RS-624: カタログ本文・スペックが出典と一致（出典: atwiki/page-1491）", () => {
    expectCatalogText("RS-624", TEXT);
    expectStats("RS-624", { name: "メガウインガー・ファイターモード", category: "ET", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  // 既知の不具合: CARD-RS-624 カタログのレアリティが N（atwiki はレア）
  it.fails("RS-624: レアリティ — レア（出典: atwiki/page-1491）", () => {
    expectRarity("RS-624", "R");
  });

  it("RS-624: 追加条件 — 自軍「メガウインガー・フライヤーモード」1体を捨札にしてラッシュできる（出典: atwiki/page-1491）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-624", "f")], rush: [inst("RS-625", "fl")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-624:f", { materials: ["RS-625:fl"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-625:fl")).toBe("discard");
    expect(canStartRush({ ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [] } } }, "player1", "RS-624:f")).toBe(false);
  });

  const enemyBattle = (n: number) => [inst("TST-UNIT-0", "a"), inst("TST-UNIT-2", "b"), inst("RS-619", "c"), inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "x")].slice(0, n);
  const board = (n: number, enemyCommand: ReturnType<typeof inst>[] = []) =>
    st({ player1: { rush: [inst("RS-624", "f")], deck: deckCards(3) }, player2: { battle: enemyBattle(n), command: enemyCommand, deck: deckCards(3, "e") } });

  // 既知の不具合: CARD-RS-624 【ウインガーキャノン】が未実装（grant_effect_generic のターン修飾子を登録するだけ）
  it.fails("RS-624: 【ウインガーキャノン】敵軍バトルエリアが4体なら、追加条件を持たないユニットをすべて持ち主のコマンドゾーンにホールド状態で置く（追加条件を持つジェットマシンは残る）（出典: atwiki/page-1491）", () => {
    let s = enterSeq(board(4), ["RS-624:f"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-624");
    s = resolveAll(s, ["RS-624:f"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("command");
    expect(zoneOf(s, "player2", "TST-UNIT-2:b")).toBe("command");
    expect(zoneOf(s, "player2", "TST-UNIT-0:d")).toBe("command");
    expect(cardIn(s, "player2", "TST-UNIT-0:a")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "RS-619:c")).toBe("battle");
  });

  it("RS-624: 【ウインガーキャノン】敵軍バトルエリアが3体・5体なら発動しない（出典: atwiki/page-1491「ユニットが4体なら」）", () => {
    for (const n of [3, 5]) {
      const s = resolveAll(enterSeq(board(n), ["RS-624:f"]));
      expect(s.players.player2.battle).toHaveLength(n);
    }
  });

  // 既知の不具合: CARD-RS-624 【ウインガーキャノン】が未実装
  it.fails("RS-624: 【ウインガーキャノン】敵軍コマンドゾーンが置ききれない（4枚あり残り1枚分）なら、置けないユニットは捨札にする（出典: atwiki/page-1491「置けなければ捨札にする」・R-ZONE-08）", () => {
    const s = resolveAll(enterSeq(board(4, Array.from({ length: 4 }, (_, i) => inst("TST-OP", `ec${i}`))), ["RS-624:f"]), ["RS-624:f"]);
    const moved = ["TST-UNIT-0:a", "TST-UNIT-2:b", "TST-UNIT-0:d"].map((id) => zoneOf(s, "player2", id));
    expect(moved.filter((z) => z === "command")).toHaveLength(1);
    expect(moved.filter((z) => z === "discard")).toHaveLength(2);
  });

  // 既知の不具合: CARD-RS-624 【ウインガーキャノン】が未実装（任意の選択自体が開かない）
  it.fails("RS-624: 【ウインガーキャノン】任意 — 発動しないこともできる（出典: atwiki/page-1491「発動できる」）", () => {
    let s = enterSeq(board(4), ["RS-624:f"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player2.battle).toHaveLength(4);
  });

  it("RS-624: 【ウインガーキャノン】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1491「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-624", "f")], deck: deckCards(3) }, player2: { battle: enemyBattle(4), deck: deckCards(3, "e") } });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-624:f"));
    expect(s.players.player2.battle).toHaveLength(4);
  });
});

// ===========================================================================
describe("RS-625 メガウインガー・フライヤーモード", () => {
  const TEXT =
    "※ウイング 【シルバー専用機】 これをラッシュしたとき、この追加条件で捨札にしたカードを見て、SPが空欄でなかったなら、このターン、これは次の能力を得る⇒BP+2000、「SP1」";

  it("RS-625: カタログ本文・スペックが出典と一致（出典: atwiki/page-1461）", () => {
    expectCatalogText("RS-625", TEXT);
    expectStats("RS-625", { name: "メガウインガー・フライヤーモード", category: "ET", size: "L", bp: 4000, sp: "special", powerCost: "4+", features: ["メカ", "航空機"], rushCondition: "discard_feature_unit" });
  });

  it("RS-625: レアリティ — ノーマル（出典: atwiki/page-1461）", () => {
    expectRarity("RS-625", "N");
  });

  const board = (material: ReturnType<typeof inst>) =>
    st({ phase: "rush", player1: { hand: [inst("RS-625", "fl")], rush: [material], command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [SILVER_NOSP_S]);
  const rushWith = (material: ReturnType<typeof inst>) => {
    const r = rushFromHand(board(material), "player1", "RS-625:fl", { materials: [material.instanceId] });
    expect(r.ok).toBe(true);
    return resolveAll(r.state);
  };

  it("RS-625: 追加条件 — 特徴「シルバー」の自軍 S ユニット（メガシルバー）を捨札にしてラッシュできる（出典: atwiki/page-1461）", () => {
    const s = rushWith(inst("RS-633", "sv"));
    expect(zoneOf(s, "player1", "RS-625:fl")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-633:sv")).toBe("discard");
  });

  it("RS-625: 追加条件 — 「シルバー」を持たない S ユニットでは満たせない（出典: atwiki/page-1461「特徴「シルバー」を持つ自軍Sユニット」）", () => {
    expect(canStartRush(board(inst("TST-UNIT-0", "x")), "player1", "RS-625:fl")).toBe(false);
  });

  it("RS-625: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドしてアタックできる（出典: atwiki/page-1461・R-KW-WING-01）", () => {
    const s = st({ player1: { rush: [inst("RS-625", "fl")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    expect(canWing(s, "RS-625:fl")).toBe(true);
  });

  // 既知の不具合: CARD-RS-625 【シルバー専用機】が働かない（追加条件で捨札にしたカードを記録しておらず、SP「！」のメガシルバーでも BP+2000・SP1 にならない）
  it.fails("RS-625: 【シルバー専用機】捨札にしたカードの SP が空欄でない（メガシルバー SP！）なら、このターン BP+2000・SP1（出典: atwiki/page-1461）", () => {
    const s = rushWith(inst("RS-633", "sv"));
    expect(bpOf(s, "player1", "RS-625:fl")).toBe(6000);
    expect(spOf(s, "player1", "RS-625:fl")).toBe(1);
  });

  it("RS-625: 【シルバー専用機】捨札にしたカードの SP が空欄（－）なら BP4000・SP0 のまま（出典: atwiki/page-1461「SPが空欄でなかったなら」）", () => {
    const s = rushWith(inst("SPEC-SILVER-NOSP", "sv"));
    expect(bpOf(s, "player1", "RS-625:fl")).toBe(4000);
    expect(spOf(s, "player1", "RS-625:fl")).toBe(0);
  });

  it.todo("RS-625: 【シルバー専用機】BP+2000・SP1 は「このターン」だけ（出典: atwiki/page-1461）— 効果自体が働かず、ターン経過後の解除を観測できないため");
});

// ===========================================================================
describe("RS-626 ギャラクシーメガ", () => {
  const TEXT =
    "【メガシールド】敵軍ターン中、これが撃破されたとき、次の効果から1つ選び発動できる⇒ ◎敵軍ユニットを1体選び撃破する。 ◎自軍捨札からウイングを持つSユニットのカードを5枚まで選び、自軍ラッシュエリアに出す。";

  it("RS-626: カタログ本文・スペックが出典と一致（出典: atwiki/page-1525）", () => {
    expectCatalogText("RS-626", TEXT);
    expectStats("RS-626", { name: "ギャラクシーメガ", category: "ET", size: "L", bp: 9000, sp: 1, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  // 既知の不具合: CARD-RS-626 カタログのレアリティが N（atwiki はスーパーレア）
  it.fails("RS-626: レアリティ — スーパーレア（出典: atwiki/page-1525）", () => {
    expectRarity("RS-626", "SR");
  });

  it("RS-626: 追加条件 — 自軍「メガシップ」1体を捨札にしてラッシュできる（なければ不可）（出典: atwiki/page-1525）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-626", "gm")], rush: [inst("RS-627", "ms")], command: releasedCat("ET", 1), power: powerCards(7), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-626:gm", { materials: ["RS-627:ms"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-627:ms")).toBe("discard");
    expect(canStartRush({ ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [inst("TST-UNIT-0", "x")] } } }, "player1", "RS-626:gm")).toBe(false);
  });

  const wingS = () => [inst("RS-622", "w1"), inst("RS-628", "w2"), inst("RS-629", "w3"), inst("RS-631", "w4"), inst("RS-622", "w5"), inst("RS-628", "w6")];
  /** 敵軍ターン、BP13000 の攻撃役にアタックされて撃破される。 */
  const destroyed = (discard: ReturnType<typeof inst>[] = wingS()) =>
    attackedInEnemyTurn({ battle: [inst("RS-626", "gm")], discard }, "RS-626:gm", { battle: [inst("TST-UNIT-7", "atk"), inst("TST-UNIT-0", "x")] });

  // 既知の不具合: CARD-RS-626 【メガシールド】が未実装（撃破されても選択が開かない）
  it.fails("RS-626: 【メガシールド】敵軍ターン中に撃破されたとき、◎敵軍ユニットを1体選び撃破するを選べる（出典: atwiki/page-1525）", () => {
    let s = destroyed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-626");
    s = resolveAll(s, ["TST-UNIT-0:x"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-626 【メガシールド】が未実装
  it.fails("RS-626: 【メガシールド】◎自軍捨札のウイングを持つ S ユニットを5枚まで選び自軍ラッシュエリアに出す（6枚あっても5枚まで）（出典: atwiki/page-1525「5枚まで選び」）", () => {
    let s = destroyed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-626");
    s = resolveAll(s, ["RS-622:w1", "RS-628:w2", "RS-629:w3", "RS-631:w4", "RS-622:w5", "RS-628:w6"]);
    expect(s.players.player1.rush).toHaveLength(5);
  });

  // 既知の不具合: CARD-RS-626 【メガシールド】が未実装
  it.fails("RS-626: 【メガシールド】ウイングを持たない S ユニット・ウイングを持つ M ユニット（バリブルーン）は出せない（出典: atwiki/page-1525「ウイングを持つSユニットのカード」）", () => {
    let s = destroyed([inst("TST-UNIT-0", "nw"), inst("RS-611", "m"), inst("RS-622", "w1")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-626");
    s = resolveAll(s, ["RS-622:w1", "TST-UNIT-0:nw", "RS-611:m"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:nw")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-611:m")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-626 【メガシールド】が未実装（任意の選択自体が開かない）
  it.fails("RS-626: 【メガシールド】任意 — どちらも発動しないことを選べる（出典: atwiki/page-1525「1つ選び発動できる」）", () => {
    let s = destroyed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-626");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("battle");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RS-626: 【メガシールド】自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-1525「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-626", "gm")], discard: wingS(), deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "big"), inst("TST-UNIT-0", "x")], deck: deckCards(3, "e") } });
    s = resolveAll(passEntry(s));
    const r = legal(s).find((a) => a.type === "battle" && a.attackerInstanceId === "RS-626:gm" && a.defenderInstanceId === "TST-UNIT-7:big");
    expect(r).toBeDefined();
    s = resolveAll(act(s, r!), ["TST-UNIT-0:x"]);
    expect(zoneOf(s, "player1", "RS-626:gm")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("battle");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RS-626: 【メガシールド】撃破されずに残ったときは発動しない（出典: atwiki/page-1525「これが撃破されたとき」）", () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("RS-626", "gm")], discard: wingS() }, "RS-626:gm", { battle: [inst("SPEC-NOSP", "atk"), inst("TST-UNIT-0", "x")] }, "SPEC-NOSP:atk", [NOSP]),
      ["TST-UNIT-0:x"],
    );
    expect(zoneOf(s, "player1", "RS-626:gm")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("battle");
    expect(s.players.player1.rush).toHaveLength(0);
  });
});

