/**
 * カード別スペック: RS-582〜RS-589（第8弾「究極の八神」魔導神官メーミィ〜クエスター・ガイ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-582〜RS-589 は該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-582 の Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-ADD-02、R-TGT-02 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { pickRushCategoryPayment } from "../ai/helpers";
import {
  act,
  attack,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  inst,
  legal,
  tryAct,
  pick,
  powerCards,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  unitIn,
  useCard,
  zoneOf,
  zordDownTests,
  enterBattleByEffect,
  damageCards,
} from "./RS8-582-604.helpers";

/** 敵軍（player2）ターン中、defender にアタックできる player2 のユニット。 */
function attackersOf(s: GameState, defender: string, playerId: PlayerId = "player2"): string[] {
  return legal(s)
    .filter(
      (a): a is Extract<GameAction, { type: "battle" }> =>
        a.type === "battle" && a.playerId === playerId && a.defenderInstanceId === defender,
    )
    .map((a) => a.attackerInstanceId)
    .sort();
}

const BP3000 = sUnit("SPEC-BP3000", { bp: 3000, sp: 1 });
const BP3500 = sUnit("SPEC-BP3500", { bp: 3500, sp: 1 });
const M_UNIT = sUnit("SPEC-M", { size: "M", bp: 1000 });
const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });

// ===========================================================================
describe("RS-582 魔導神官メーミィ", () => {
  const TEXT =
    "【メー・メガロ】これが自軍エリアにある間、自分がカウンターを持つオペレーションの効果を発動して、そのカードが捨札になったとき、そのカードと同じカード名のカードを、自軍山札を見て1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。";

  /** 敵軍（player2）ラッシュ直後、player1 が疾風流超忍法（RS-247。カウンター）を構えている状況。 */
  const enemyRush = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({
      activePlayer: "player2",
      phase: "rush",
      pendingRush: { rusherPlayerId: "player2", rushedInstanceId: "TST-UNIT-0:r", phasePlayerId: "player2" },
      player1: {
        rush: [inst("RS-582", "m")],
        hand: [inst("RS-247", "c")],
        power: powerCards(5),
        command: releasedCat("MA", 2),
        deck: [inst("RS-247", "k1"), inst("TST-OP", "x"), inst("RS-247", "k2")],
        ...p1,
      },
      player2: { rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") },
    } as Parameters<typeof st>[0]);

  it("RS-582: カタログ本文・スペックが出典と一致（出典: atwiki/page-1196）", () => {
    expectCatalogText("RS-582", TEXT);
    expectStats("RS-582", {
      name: "魔導神官メーミィ",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["男", "魔法"],
    });
  });

  it("RS-582: 【メー・メガロ】自分がカウンター（疾風流超忍法）を発動して捨札になったとき、山札から同名カードを1枚選び手札に加えられる（出典: atwiki/page-1196）", () => {
    let s = useCard(enemyRush(), "player1", "RS-247:c");
    expect(zoneOf(s, "player1", "RS-247:c")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-582");
    s = resolveAll(pick(s, "RS-247:k2"));
    expect(zoneOf(s, "player1", "RS-247:k2")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-247:k1")).toBe("deck");
  });

  it("RS-582: 【メー・メガロ】選べるのは同じカード名のカードだけ（出典: atwiki/page-1196「そのカードと同じカード名のカードを」）", () => {
    const s = useCard(enemyRush(), "player1", "RS-247:c");
    expect(choiceIds(s)).toEqual(["RS-247:k1", "RS-247:k2"]);
  });

  it("RS-582: 【メー・メガロ】任意 — 加えないこともでき、そのとき山札のカードは手札に来ない（出典: atwiki/page-1196「手札に加えてもよい」）", () => {
    let s = useCard(enemyRush(), "player1", "RS-247:c");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-582");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("RS-582: 【メー・メガロ】メーミィがバトルエリアにあっても発動する（出典: atwiki/page-1196「これが自軍エリアにある間」）", () => {
    let s = useCard(enemyRush({ rush: [], battle: [inst("RS-582", "m")] }), "player1", "RS-247:c");
    s = resolveAll(s, ["RS-247:k1"]);
    expect(zoneOf(s, "player1", "RS-247:k1")).toBe("hand");
  });

  it("RS-582: 【メー・メガロ】メーミィが自軍エリアになければ、カウンターが捨札になっても手札に加えない（出典: atwiki/page-1196「これが自軍エリアにある間」）", () => {
    const s = resolveAll(useCard(enemyRush({ rush: [], discard: [inst("RS-582", "m")] }), "player1", "RS-247:c"));
    expect(zoneOf(s, "player1", "RS-247:c")).toBe("discard");
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("RS-582: 【メー・メガロ】相手がカウンターを発動したときは発動しない（出典: atwiki/page-1196「自分がカウンターを持つオペレーションの効果を発動して」）", () => {
    // player1 のラッシュに player2 が疾風流超忍法を使う。player1 の場にメーミィ、山札に疾風流超忍法。
    let s = st({
      activePlayer: "player1",
      phase: "rush",
      pendingRush: { rusherPlayerId: "player1", rushedInstanceId: "TST-UNIT-0:mine", phasePlayerId: "player1" },
      player1: { rush: [inst("RS-582", "m"), inst("TST-UNIT-0", "mine")], deck: [inst("RS-247", "k1"), inst("TST-OP", "x")] },
      player2: { hand: [inst("RS-247", "c")], power: powerCards(5), command: releasedCat("MA", 2), deck: deckCards(3, "e") },
    } as Parameters<typeof st>[0]);
    s = resolveAll(useCard(s, "player2", "RS-247:c"));
    expect(zoneOf(s, "player2", "RS-247:c")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-247:k1")).toBe("deck");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-582: Q&A — 巨大化爆弾は使用時に捨札にならない（重ねたままラッシュエリアに出る）ので、その時点では手札に加えない（出典: grnrngr/faq-card-8 RS-582 Q1「すぐに捨札になったときだけです」）", () => {
    // 巨大化爆弾（RS-255）は「怪人」の自軍ユニットが撃破されて捨札になったときに使う。ボンベバンキ（RS-603）は特徴「怪人」。
    let s = attackedInEnemyTurn(
      {
        battle: [inst("RS-603", "kaijin")],
        rush: [inst("RS-582", "m")],
        hand: [inst("RS-255", "bomb")],
        power: powerCards(5),
        command: releasedCat("DA", 2),
        deck: [inst("RS-255", "k1"), inst("TST-OP", "x")],
      },
      "RS-603:kaijin",
    );
    try {
      s = useCard(s, "player1", "RS-255:bomb");
    } catch {
      // 巨大化爆弾を使えない場合でも、メーミィで山札の巨大化爆弾が手札に来ないことは変わらない
    }
    s = resolveAll(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-582");
    expect(zoneOf(s, "player1", "RS-255:k1")).toBe("deck");
  });

  it.todo(
    "RS-582: Q&A — 巨大化爆弾に重ねたユニットが後で撃破されて巨大化爆弾が捨札になったときも手札に加えない（出典: grnrngr/faq-card-8 RS-582 Q1「いいえ、できません」）— 重ねたユニットを敵軍ターンにバトルエリアで撃破させる状況を公開 API で組めないため",
  );

  it.todo("RS-582: 【メー・メガロ】その後、山札をシャッフルする（出典: atwiki/page-1196）— シャッフル結果は乱数に依存し、公開 API で確かめられないため");
});

// ===========================================================================
describe("RS-583 ボウケンレッドHM（ハッピーモード）", () => {
  const TEXT =
    "※タクスET（これがバトルエリアの4番目にある間、これの次に並ぶETを持つSユニットは「SP1」を得る） 【災いを受け止める覚悟】これが自軍エリアにある間、相手によってこれ以外の自軍ユニットが選ばれたとき、このユニットが選ぶ対象として適切なら、このターン中に一度だけ、選ばれたユニットの代わりに、このユニットが選ばれたことにしてもよい。";
  const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", sp: undefined, bp: 1000 });
  const WB_NOSP = sUnit("SPEC-WB-NOSP", { category: "WB", sp: undefined, bp: 1000 });
  const ET_M = sUnit("SPEC-ET-M", { category: "ET", sp: undefined, size: "M", bp: 1000 });

  const taxis = (before: number, next: string) =>
    enterSeq(
      st({ player1: { battle: fill(before), rush: [inst("RS-583", "hm"), inst(next, "n")], deck: deckCards(3) } }, [ET_NOSP, WB_NOSP, ET_M]),
      ["RS-583:hm", `${next}:n`],
    );

  it("RS-583: カタログ本文・スペックが出典と一致（出典: atwiki/page-1211。カード名の（ハッピーモード）はルビ）", () => {
    expectCatalogText("RS-583", TEXT);
    expectStats("RS-583", {
      name: "ボウケンレッドHM",
      category: "ET",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 2,
      features: ["レッド", "男", "ハッピーモード"],
    });
  });

  it("RS-583: ※タクスET — 4番目にあるとき、次（5番目）に並ぶ ET の S ユニットは SP1 を得る（出典: atwiki/page-1211）", () => {
    const s = taxis(3, "SPEC-ET-NOSP");
    expect(spOf(s, "player1", "SPEC-ET-NOSP:n")).toBe(1);
  });

  it("RS-583: ※タクスET — 3番目にあるときは次のユニットは SP1 を得ない（出典: atwiki/page-1211「4番目にある間」）", () => {
    const s = taxis(2, "SPEC-ET-NOSP");
    expect(spOf(s, "player1", "SPEC-ET-NOSP:n")).toBe(0);
  });

  it("RS-583: ※タクスET — 次に並ぶのが ET を持たないユニットなら SP1 を得ない（出典: atwiki/page-1211「ETを持つSユニット」）", () => {
    const s = taxis(3, "SPEC-WB-NOSP");
    expect(spOf(s, "player1", "SPEC-WB-NOSP:n")).toBe(0);
  });

  it("RS-583: ※タクスET — 次に並ぶのが ET の M ユニットなら SP1 を得ない（出典: atwiki/page-1211「ETを持つSユニット」）", () => {
    const s = taxis(3, "SPEC-ET-M");
    expect(spOf(s, "player1", "SPEC-ET-M:n")).toBe(0);
  });

  // アタックの対象も「選ぶ」もの（grnrngr/faq-card-1 RS-026 Q1「アタックされる以外では相手に選ばれない」の裏返し）。
  it("RS-583: 【災いを受け止める覚悟】相手が他の自軍ユニットをアタック対象に選んだとき、代わりにこのユニットが選ばれたことにできる（出典: atwiki/page-1211）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-583", "hm"), inst("TST-UNIT-0", "ally")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "TST-UNIT-0:ally" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-583");
    s = resolveAll(s, ["RS-583:hm"]);
    expect(zoneOf(s, "player1", "RS-583:hm")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("battle");
  });

  it("RS-583: 【災いを受け止める覚悟】このユニットがラッシュエリアにある（アタックの対象として適切でない）ときは代わりにならない（出典: atwiki/page-1211「このユニットが選ぶ対象として適切なら」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-583", "hm")], battle: [inst("TST-UNIT-0", "ally")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    s = resolveAll(attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:ally", "player2"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-583:hm")).toBe("rush");
  });

  it("RS-583: 【災いを受け止める覚悟】このターン中に一度だけ — 2回目のアタックでは代わりにならない（出典: atwiki/page-1211「このターン中に一度だけ」）", () => {
    // 1回目: BP 負けしない攻撃役（SP－・BP1000 → HM の BP500 を撃破）ではなく、HM が生き残るよう SP－ BP100 で殴る
    const WEAK = sUnit("SPEC-WEAK", { sp: undefined, bp: 100 });
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-583", "hm"), inst("TST-UNIT-0", "a1"), inst("TST-UNIT-0", "a2")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-WEAK", "w"), inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      [WEAK],
    );
    s = act(s, { type: "battle", playerId: "player2", attackerInstanceId: "SPEC-WEAK:w", defenderInstanceId: "TST-UNIT-0:a1" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-583");
    s = resolveAll(s, ["RS-583:hm"]);
    expect(zoneOf(s, "player1", "RS-583:hm")).toBe("battle");
    s = act(s, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "TST-UNIT-0:a2" });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-583");
  });

  it("RS-583: 【災いを受け止める覚悟】任意 — 代わらなければ選ばれたユニットがそのままバトルする（出典: atwiki/page-1211「選ばれたことにしてもよい」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-583", "hm"), inst("TST-UNIT-0", "ally")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    s = act(s, { type: "battle", playerId: "player2", attackerInstanceId: "TST-UNIT-7:atk", defenderInstanceId: "TST-UNIT-0:ally" });
    if (s.pendingEffectChoice?.sourceCardId === "RS-583") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-583:hm")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-584 ボウケンブラックAT（アクセルテクター）", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「ボウケンブラック」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【闇を振り払う心】自軍パワーのオモテ向きのカードと自軍コマンドゾーンのカードにDA持つカードが1枚もなければ、これは「SP1」になる。また、DAを持つ敵軍ユニットがあれば、これはBP＋3000される。";

  it("RS-584: カタログ本文・スペックが出典と一致（出典: atwiki/page-1212）", () => {
    expectCatalogText("RS-584", TEXT);
    expectStats("RS-584", {
      name: "ボウケンブラックAT",
      category: "ET",
      size: "S",
      bp: 3500,
      sp: "special",
      powerCost: "7-",
      features: ["ブラック", "男", "アクセルテクター"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-584", "RS-063", "ボウケンブラック", "atwiki/page-1212", "ET");
  reanimateTests("RS-584", "RS-063", "ボウケンブラック", "atwiki/page-1212");

  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      player1: { battle: [inst("RS-584", "at")], command: releasedCat("ET", 1), power: powerCards(2), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });

  it("RS-584: 【闇を振り払う心】自軍パワーのオモテ向きと自軍コマンドゾーンに DA のカードがなければ SP1（出典: atwiki/page-1212）", () => {
    expect(spOf(board(), "player1", "RS-584:at")).toBe(1);
  });

  it("RS-584: 【闇を振り払う心】自軍コマンドゾーンに DA のカードがあれば SP1 にならない（出典: atwiki/page-1212「1枚もなければ」）", () => {
    expect(spOf(board({ command: [...releasedCat("ET", 1), ...releasedCat("DA", 1)] }), "player1", "RS-584:at")).toBe(0);
  });

  it("RS-584: 【闇を振り払う心】自軍パワーのオモテ向きのカードに DA があれば SP1 にならない（出典: atwiki/page-1212「自軍パワーのオモテ向きのカード」）", () => {
    expect(spOf(board({ power: [inst("TST-OP-DA", "pda")] }), "player1", "RS-584:at")).toBe(0);
  });

  it("RS-584: 【闇を振り払う心】DA のカードがダメージ（ウラ向き）なら数えず SP1 になる（出典: atwiki/page-1212「オモテ向きのカード」）", () => {
    expect(spOf(board({ power: [{ ...inst("TST-OP-DA", "pda"), faceDown: true }] }), "player1", "RS-584:at")).toBe(1);
  });

  it("RS-584: 【闇を振り払う心】DA を持つ敵軍ユニット（ラッシュエリアでも）があれば BP+3000（出典: atwiki/page-1212「DAを持つ敵軍ユニットがあれば、これはBP＋3000される」）", () => {
    expect(bpOf(board({}, { rush: [inst("RS-604", "da")] }), "player1", "RS-584:at")).toBe(6500);
  });

  it("RS-584: 【闇を振り払う心】DA を持つ敵軍ユニットがなければ BP3500 のまま（出典: atwiki/page-1212）", () => {
    expect(bpOf(board({}, { rush: [inst("TST-UNIT-0", "wb")] }), "player1", "RS-584:at")).toBe(3500);
  });

  it("RS-584: 【闇を振り払う心】自軍の DA ユニットは BP+3000 の条件にならない（出典: atwiki/page-1212「敵軍ユニット」）", () => {
    expect(bpOf(board({ rush: [inst("RS-604", "own")] }), "player1", "RS-584:at")).toBe(3500);
  });
});

// ===========================================================================
describe("RS-585 ボウケンシルバー（2nd）", () => {
  const TEXT =
    "【サガスピアー】自軍ターン中、これがバトルエリアに出たとき、自軍か敵軍の山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの中にSPが空欄でないユニットカードがあれば、このターン、これは「SP1」になる。その後、オモテにしたカードは、その持ち主が相手に見せずに好きな順で山札の上に戻す。";
  const NOSP_DECK = () => [inst("TST-OP", "o1"), inst("SPEC-NOSP", "n1"), inst("TST-OP", "o2"), inst("TST-UNIT-0", "deep")];
  const SP_DECK = () => [inst("TST-OP", "o1"), inst("TST-UNIT-0", "u1"), inst("TST-OP", "o2"), inst("TST-OP", "deep")];
  const board = (own: ReturnType<typeof inst>[], enemy: ReturnType<typeof inst>[] = deckCards(3, "e")) =>
    st({ player1: { rush: [inst("RS-585", "sv")], deck: own }, player2: { deck: enemy } }, [NOSP]);

  it("RS-585: カタログ本文・スペックが出典と一致（出典: atwiki/page-1141）", () => {
    expectCatalogText("RS-585", TEXT);
    expectStats("RS-585", {
      name: "ボウケンシルバー",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 4,
      features: ["シルバー", "男", "2nd"],
    });
  });

  it("RS-585: 【サガスピアー】自軍山札の上3枚に SP が空欄でないユニットがあれば SP1、カードは山札の上に戻る（出典: atwiki/page-1141）", () => {
    let s = enterSeq(board(SP_DECK()), ["RS-585:sv"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-585");
    s = resolveAll(pick(s, "deck_own"));
    expect(spOf(s, "player1", "RS-585:sv")).toBe(1);
    expect(s.players.player1.deck.slice(0, 3).map((c) => c.instanceId).sort()).toEqual(["TST-OP:o1", "TST-OP:o2", "TST-UNIT-0:u1"]);
    expect(s.players.player1.deck[3]?.instanceId).toBe("TST-OP:deep");
  });

  it("RS-585: 【サガスピアー】上3枚に SP が空欄でないユニットがなければ（SP－のユニット・オペレーションだけ）SP1 にならない（出典: atwiki/page-1141「SPが空欄でないユニットカードがあれば」）", () => {
    const s = resolveAll(pick(enterSeq(board(NOSP_DECK()), ["RS-585:sv"]), "deck_own"));
    expect(spOf(s, "player1", "RS-585:sv")).toBe(0);
  });

  it("RS-585: 【サガスピアー】4枚目にある SP 持ちのユニットは見ない（出典: atwiki/page-1141「山札の上から3枚」）", () => {
    const s = resolveAll(pick(enterSeq(board(NOSP_DECK()), ["RS-585:sv"]), "deck_own"));
    expect(s.players.player1.deck[3]?.instanceId).toBe("TST-UNIT-0:deep");
    expect(spOf(s, "player1", "RS-585:sv")).toBe(0);
  });

  it("RS-585: 【サガスピアー】SP が「！」のユニットも空欄ではないので SP1 になる（出典: atwiki/page-1141「SPが空欄でない」）", () => {
    const s = resolveAll(pick(enterSeq(board([inst("TST-OP", "o1"), inst("RS-585", "bang"), inst("TST-OP", "o2")]), ["RS-585:sv"]), "deck_own"));
    expect(spOf(s, "player1", "RS-585:sv")).toBe(1);
  });

  it("RS-585: 【サガスピアー】敵軍の山札を選んでもよく、SP 持ちがあれば SP1、敵軍のカードは敵軍山札の上に戻る（出典: atwiki/page-1141「自軍か敵軍の山札」）", () => {
    const s = resolveAll(
      pick(enterSeq(board(NOSP_DECK(), [inst("TST-OP", "e1"), inst("TST-UNIT-0", "eu"), inst("TST-OP", "e2"), inst("TST-OP", "e3")]), ["RS-585:sv"]), "deck_enemy"),
    );
    expect(spOf(s, "player1", "RS-585:sv")).toBe(1);
    expect(s.players.player2.deck.slice(0, 3).map((c) => c.instanceId).sort()).toEqual(["TST-OP:e1", "TST-OP:e2", "TST-UNIT-0:eu"]);
  });

  it("RS-585: 【サガスピアー】戻す順は持ち主（敵軍の山札なら相手）が番号を付けて選ぶ（1番が一番上）（出典: atwiki/page-1141「その持ち主が…好きな順で山札の上に戻す」）", () => {
    let s = pick(enterSeq(board(NOSP_DECK(), [inst("TST-OP", "e1"), inst("TST-UNIT-0", "eu"), inst("TST-OP", "e2"), inst("TST-OP", "e3")]), ["RS-585:sv"]), "deck_enemy");
    expect(s.pendingEffectChoice?.effectId).toBe("deck_top_order");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = pick(pick(s, "TST-OP:e2"), "TST-UNIT-0:eu");
    s = resolveAll(pick(s, "order_done"));
    expect(s.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:e2", "TST-UNIT-0:eu", "TST-OP:e1", "TST-OP:e3"]);
    expect(spOf(s, "player1", "RS-585:sv")).toBe(1);
  });

  it("RS-585: 【サガスピアー】任意 — オモテにしなければ SP1 にならない（出典: atwiki/page-1141「オモテにしてもよい」）", () => {
    let s = enterSeq(board(SP_DECK()), ["RS-585:sv"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(spOf(s, "player1", "RS-585:sv")).toBe(0);
  });

  it("RS-585: 【サガスピアー】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1141「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-585", "sv")], deck: SP_DECK() }, player2: { deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-585:sv");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-585");
    expect(spOf(s, "player1", "RS-585:sv")).toBe(0);
  });
});

// ===========================================================================
describe("RS-586 巨神ゴードム", () => {
  const TEXT =
    "※これは自軍捨札に特徴「戦闘員」を持つカードが7枚以上無ければバトルエリアに出られない。 【魔神に不足する物】これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札からDAを持つユニットカードをラッシュするとき、そのパワーを満たすために次のようにしてもよい⇒必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする。";
  const grunts = (n: number, prefix = "g") => Array.from({ length: n }, (_, i) => inst("RS-604", `${prefix}${i}`));

  it("RS-586: カタログ本文・スペックが出典と一致（出典: atwiki/page-1221）", () => {
    expectCatalogText("RS-586", TEXT);
    expectStats("RS-586", {
      name: "巨神ゴードム",
      category: "DA",
      size: "L",
      bp: 8000,
      sp: 1,
      powerCost: 2,
      features: ["人型"],
    });
  });

  it("RS-586: ※ 自軍捨札に「戦闘員」のカードが7枚あればバトルエリアに出られる（出典: atwiki/page-1221）", () => {
    const s = st({ player1: { rush: [inst("RS-586", "gd")], discard: grunts(7), deck: deckCards(3) } });
    expect(canEnter(s, "RS-586:gd")).toBe(true);
  });

  it("RS-586: ※ 自軍捨札の「戦闘員」が6枚ならバトルエリアに出られない（出典: atwiki/page-1221「7枚以上無ければ」）", () => {
    const s = st({ player1: { rush: [inst("RS-586", "gd")], discard: [...grunts(6), inst("TST-UNIT-0", "x")], deck: deckCards(3) } });
    expect(canEnter(s, "RS-586:gd")).toBe(false);
  });

  it("RS-586: ※ 敵軍捨札の「戦闘員」は数えない（出典: atwiki/page-1221「自軍捨札に」）", () => {
    const s = st({ player1: { rush: [inst("RS-586", "gd")], discard: grunts(3), deck: deckCards(3) }, player2: { discard: grunts(7, "eg") } });
    expect(canEnter(s, "RS-586:gd")).toBe(false);
  });

  // ケガレシア（RS-602。DA・必要パワー3）を、パワー1＋場の「戦闘員」2体を捨札にしてラッシュする。
  const rushBoard = (p1: Partial<GameState["players"]["player1"]>) =>
    st({ phase: "rush", player1: { hand: [inst("RS-602", "k")], command: releasedCat("DA", 1), power: powerCards(1), deck: deckCards(3), ...p1 } });

  it("RS-586: 【魔神に不足する物】足りない必要パワー2の分、場の「戦闘員」ユニット2体を捨札にして DA ユニットをラッシュできる（出典: atwiki/page-1221）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(2)] });
    const r = rushFromHand(s, "player1", "RS-602:k");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-602:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-604:g0")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-604:g1")).toBe("discard");
  });

  it("RS-586: 【魔神に不足する物】捨札の「戦闘員」カードは「ユニット」ではないので、場に「戦闘員」がいなければパワー不足のままラッシュできない（出典: atwiki/page-1221「特徴「戦闘員」を持つユニットを捨札にする」）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd")], discard: grunts(5) });
    expect(canStartRush(s, "player1", "RS-602:k")).toBe(false);
  });

  it("RS-586: 【魔神に不足する物】DA を持たないユニットのラッシュには使えない（出典: atwiki/page-1221「DAを持つユニットカード」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-583", "red")], rush: [inst("RS-586", "gd"), ...grunts(2)], discard: grunts(5, "dg"), command: releasedCat("ET", 1), power: powerCards(1), deck: deckCards(3) },
    });
    expect(canStartRush(s, "player1", "RS-583:red")).toBe(false);
  });

  it("RS-586: 【魔神に不足する物】ゴードムが自軍エリアになければ使えない（出典: atwiki/page-1221「これが自軍エリアにある間」）", () => {
    const s = rushBoard({ rush: grunts(2), discard: [inst("RS-586", "gd"), ...grunts(5, "dg")] });
    expect(canStartRush(s, "player1", "RS-602:k")).toBe(false);
  });

  /** ケガレシアのラッシュの宣言（コマンドの支払いの開始）のうち、捨札にする「戦闘員」を godom で選んだもの。 */
  const godomInits = (s: GameState) =>
    legal(s).filter(
      (a): a is Extract<ReturnType<typeof legal>[number], { type: "initiate_command_payment" }> =>
        a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-602:k",
    );
  const payAndRush = (s: GameState, init: ReturnType<typeof godomInits>[number]) => {
    let r = tryAct(s, init);
    expect(r.ok).toBe(true);
    const p = r.state.pendingCommandPayment!;
    r = tryAct(r.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    return r;
  };

  it("RS-586: 【魔神に不足する物】「戦闘員」のユニットが足りない数より多ければ、どれを捨札にするかプレイヤーが選べる（選んだユニットだけが捨札になる）（出典: atwiki/page-1221「必要パワーに足りない数だけ、特徴「戦闘員」を持つユニットを捨札にする」）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(3)] });
    const inits = godomInits(s);
    const choices = inits.map((a) => [...(a.godomDiscardInstanceIds ?? [])].sort().join(","));
    expect(choices.sort()).toEqual(["RS-604:g0,RS-604:g1", "RS-604:g0,RS-604:g2", "RS-604:g1,RS-604:g2"]);
    const pick = inits.find((a) => a.godomDiscardInstanceIds?.includes("RS-604:g0") && a.godomDiscardInstanceIds.includes("RS-604:g2"))!;
    const r = payAndRush(s, pick);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-602:k")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-604:g0")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-604:g2")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-604:g1")).toBe("rush");
  });

  it("RS-586: 【魔神に不足する物】候補が多いのに捨札にするユニットを選ばずにラッシュを宣言することはできない（自動では選ばない）（出典: atwiki/page-1221）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(3)] });
    const r = tryAct(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-602:k" });
    expect(r.ok).toBe(false);
  });

  it("RS-586: 【魔神に不足する物】足りない数と違う数の「戦闘員」や、「戦闘員」でないユニットは選べない（出典: atwiki/page-1221「必要パワーに足りない数だけ」）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(3), inst("TST-UNIT-0", "x")] });
    const base = { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-602:k" } as const;
    expect(tryAct(s, { ...base, godomDiscardInstanceIds: ["RS-604:g0"] }).ok).toBe(false);
    expect(tryAct(s, { ...base, godomDiscardInstanceIds: ["RS-604:g0", "RS-604:g1", "RS-604:g2"] }).ok).toBe(false);
    expect(tryAct(s, { ...base, godomDiscardInstanceIds: ["RS-604:g0", "TST-UNIT-0:x"] }).ok).toBe(false);
    expect(tryAct(s, { ...base, godomDiscardInstanceIds: ["RS-604:g0", "RS-604:g1"] }).ok).toBe(true);
  });

  it("RS-586: 【魔神に不足する物】CPU は BP の低い「戦闘員」のユニットを捨札にする組を選ぶ（出典: atwiki/page-1221）", () => {
    const SMALL = sUnit("SPEC-GRUNT-S", { category: "DA", bp: 500, features: ["戦闘員"] });
    const BIG = sUnit("SPEC-GRUNT-L", { category: "DA", bp: 6000, features: ["戦闘員"] });
    const s = st(
      { phase: "rush", player1: { hand: [inst("RS-602", "k")], command: releasedCat("DA", 1), power: powerCards(2), deck: deckCards(3), rush: [inst("RS-586", "gd"), inst(BIG.id, "big"), inst(SMALL.id, "small")] } },
      [SMALL, BIG],
    );
    const choice = pickRushCategoryPayment(s, "player1", legal(s));
    expect(choice?.type === "initiate_command_payment" && choice.godomDiscardInstanceIds).toEqual(["SPEC-GRUNT-S:small"]);
  });

  it("RS-586: 【魔神に不足する物】CPU は合法手から捨札にする「戦闘員」の組を選んでラッシュする（出典: atwiki/page-1221）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(3)] });
    const init = godomInits(s)[0]!;
    expect(init.godomDiscardInstanceIds).toHaveLength(2);
    const r = payAndRush(s, init);
    expect(zoneOf(r.state, "player1", "RS-602:k")).toBe("rush");
    expect(r.state.players.player1.discard.filter((c) => c.cardId === "RS-604")).toHaveLength(2);
  });

  it("RS-586: 【魔神に不足する物】パワーが足りていれば戦闘員を捨札にしなくてもラッシュできる（任意）（出典: atwiki/page-1221「してもよい」）", () => {
    const s = rushBoard({ rush: [inst("RS-586", "gd"), ...grunts(2)], power: powerCards(3) });
    const r = rushFromHand(s, "player1", "RS-602:k");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-604:g0")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-604:g1")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-587 怒りの鬼神　ガイ", () => {
  const TEXT =
    "※これはBP3000以下のユニットにアタックされない。 【激しい闘争心】これ以外の自軍Sユニットを1体選び撃破してもよい。そうしたとき、相手は自分自身のユニットを1体選び撃破する。";

  it("RS-587: カタログ本文・スペックが出典と一致（出典: atwiki/page-1197）", () => {
    expectCatalogText("RS-587", TEXT);
    expectStats("RS-587", {
      name: "怒りの鬼神　ガイ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 1,
      features: ["アシュ", "男"],
    });
  });

  const enemyTurn = () =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-587", "g")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP3000", "a"), inst("SPEC-BP3500", "b")], deck: deckCards(3, "e") },
      },
      [BP3000, BP3500],
    );

  it("RS-587: ※ BP3000 のユニットにはアタックされない（出典: atwiki/page-1197）", () => {
    expect(attackersOf(enemyTurn(), "RS-587:g")).toEqual(["SPEC-BP3500:b"]);
  });

  it("RS-587: ※ BP3500 のユニットにはアタックされる（出典: atwiki/page-1197「BP3000以下」）", () => {
    expect(attackersOf(enemyTurn(), "RS-587:g")).toContain("SPEC-BP3500:b");
  });

  const ncBoard = (nth = 1) =>
    st(
      {
        player1: { battle: fill(nth - 1, "own"), rush: [inst("RS-587", "g"), inst("TST-UNIT-0", "ally"), inst("SPEC-M", "m")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "e2")], deck: deckCards(3, "e") },
      },
      [M_UNIT],
    );

  it("RS-587: 【激しい闘争心】NC（1番目）— 他の自軍 S ユニットを撃破すると、相手は自分自身のユニットを1体選び撃破する（出典: atwiki/page-1197）", () => {
    let s = enterSeq(ncBoard(), ["RS-587:g"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-587");
    s = pick(s, "TST-UNIT-0:ally");
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveAll(pick(s, "TST-UNIT-0:e2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-587: 【激しい闘争心】選べるのはこれ以外の自軍 S ユニット（M ユニット・ガイ自身は選べない）（出典: atwiki/page-1197「これ以外の自軍Sユニット」）", () => {
    const s = enterSeq(ncBoard(), ["RS-587:g"]);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ally"]);
  });

  it("RS-587: 【激しい闘争心】任意 — 撃破しなければ相手もユニットを撃破しない（出典: atwiki/page-1197「撃破してもよい。そうしたとき」）", () => {
    let s = enterSeq(ncBoard(), ["RS-587:g"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("rush");
  });

  it("RS-587: 【激しい闘争心】NC が成立しない（2番目）ときは発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(ncBoard(2), ["RS-587:g"]));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ally")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-588 大いなる獣　レイ", () => {
  const TEXT =
    "※これはBP3000以下のユニットにアタックされない。 【術魂】相手の手札を見てもよい。そうしたとき、ＮＣを持つSユニットのカードがあれば1枚選び、そのNCの効果をこのユニットの効果として発動する。（この効果は「怒りの鬼神　ガイ」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RS-588: カタログ本文・スペックが出典と一致（出典: atwiki/page-1198）", () => {
    expectCatalogText("RS-588", TEXT);
    expectStats("RS-588", {
      name: "大いなる獣　レイ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 5,
      features: ["アシュ", "男"],
    });
  });

  it("RS-588: ※ BP3000 のユニットにはアタックされない（BP3500 にはアタックされる）（出典: atwiki/page-1198）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-588", "r")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP3000", "a"), inst("SPEC-BP3500", "b")], deck: deckCards(3, "e") },
      },
      [BP3000, BP3500],
    );
    expect(attackersOf(s, "RS-588:r")).toEqual(["SPEC-BP3500:b"]);
  });

  // 相手の手札にマジブルー（RS-059。NC【未来予知】自分は1枚ドローする）。
  const board = (before: ReturnType<typeof inst>[]) =>
    st({
      player1: { battle: before, rush: [inst("RS-588", "r")], hand: [], deck: deckCards(5) },
      player2: { hand: [inst("RS-059", "blue"), inst("TST-OP", "eo")], deck: deckCards(3, "e") },
    });

  it("RS-588: 【術魂】NC（5番目）— 相手の手札の NC を持つ S ユニット（マジブルー）を選び、その NC（1枚ドロー）をこのユニットの効果として発動する（出典: atwiki/page-1198）", () => {
    let s = enterSeq(board(fill(4)), ["RS-588:r"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-588");
    s = resolveAll(s, ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(1);
    expect(zoneOf(s, "player2", "RS-059:blue")).toBe("hand");
  });

  // ユーザー決定（2026-10-19）「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」（docs/rules/README.md §5.7 j）。
  it("RS-588: 【術魂】相手の手札を見て選ぶので、「相手に選ばれない」を持つ NC の S ユニット（XG3-066 仮面ライダーサソードRF）は選べない（出典: ユーザー決定 2026-10-19「ゾーンだけでなく手札等からでも面（オモテ）状態のカードから選ぶ場合は「相手に選ばれない」が効く」「クエスターレイ等の相手の手札を見て選ぶ場合も指しています」）", () => {
    const b = board(fill(4));
    const s0 = { ...b, players: { ...b.players, player2: { ...b.players.player2, hand: [inst("XG3-066", "sa"), ...b.players.player2.hand] } } };
    let s = enterSeq(s0, ["RS-588:r"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-588");
    s = pick(s, "RS-588:r");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-588");
    expect(choiceIds(s)).toEqual(["RS-059:blue"]);
  });

  it("RS-588: 【術魂】「怒りの鬼神　ガイ」の次（2番目）ならナンバーに関係なく発動する（出典: atwiki/page-1198「ナンバーに関係なく発動する」）", () => {
    const s = resolveAll(enterSeq(board([inst("RS-587", "gai")]), ["RS-588:r"]), ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(1);
  });

  it("RS-588: 【術魂】「怒りの鬼神　ガイ」以外の次で、ナンバーも合わない（2番目）なら発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(board(fill(1)), ["RS-588:r"]), ["RS-059:blue"]);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-588: 【術魂】任意 — 相手の手札を見ないこともできる（出典: atwiki/page-1198「見てもよい」）", () => {
    let s = enterSeq(board(fill(4)), ["RS-588:r"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-588");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-588: 【術魂】相手の手札に NC を持つ S ユニットがなければ何も発動しない（出典: atwiki/page-1198「あれば」）", () => {
    const s0 = st({
      player1: { battle: fill(4), rush: [inst("RS-588", "r")], deck: deckCards(5) },
      player2: { hand: [inst("TST-OP", "eo"), inst("TST-UNIT-0", "nocn")], deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterSeq(s0, ["RS-588:r"]));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player2.hand).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-589 クエスター・ガイ", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【グレイブラスター】これ以外の自軍Sユニットを1体選びホールドしてもよい。そうしたとき、相手は自分自身のユニットを1体選び撃破する。";

  it("RS-589: カタログ本文・スペックが出典と一致（出典: atwiki/page-1199）", () => {
    expectCatalogText("RS-589", TEXT);
    expectStats("RS-589", {
      name: "クエスター・ガイ",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: "4+",
      comboNumber: 1,
      features: ["アシュ", "男", "クエスター"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-589: 追加条件 — 自軍「怒りの鬼神　ガイ」1体を捨札にしてラッシュできる（出典: atwiki/page-1199）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-589", "q")], rush: [inst("RS-587", "g")], command: releasedCat("DA", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-589:q", { materials: ["RS-587:g"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-589:q")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-587:g")).toBe("discard");
  });

  it("RS-589: 追加条件 — 自軍に「怒りの鬼神　ガイ」がなければ（敵軍にあっても）ラッシュできない（出典: atwiki/page-1199「自軍「怒りの鬼神　ガイ」」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-589", "q")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("DA", 1), power: powerCards(4), deck: deckCards(3) },
      player2: { rush: [inst("RS-587", "eg")] },
    });
    expect(canStartRush(s, "player1", "RS-589:q")).toBe(false);
  });

  it("RS-589: ※ 敵軍ターン中、SP1 のユニットにアタックされてバトルに勝っても撃破される（出典: atwiki/page-1199）", () => {
    // TST-UNIT-0 は SP1・BP1000。クエスター・ガイ（BP6000）はバトルに勝つ。
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst("RS-589", "q")] }, "RS-589:q", {}, "TST-UNIT-0:atk"),
    );
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-589:q")).toBe("discard");
  });

  it("RS-589: ※ SP－（SP0）のユニットとのバトルなら勝てば残る（出典: atwiki/page-1199「「SP1」以上のユニット」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-589", "q")] }, "RS-589:q", {}, "SPEC-NOSP:atk", [NOSP]));
    expect(zoneOf(s, "player1", "RS-589:q")).toBe("battle");
  });

  it("RS-589: ※ 自軍ターン中に SP1 のユニットにアタックして勝てば残る（出典: atwiki/page-1199「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-589", "q")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    s = resolveAll(attack(s, "RS-589:q", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-589:q")).toBe("battle");
  });

  const ncBoard = (nth = 1) =>
    st(
      {
        player1: { battle: fill(nth - 1, "own"), rush: [inst("RS-589", "q"), inst("TST-UNIT-0", "ally"), inst("SPEC-M", "m")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-0", "e2")], deck: deckCards(3, "e") },
      },
      [M_UNIT],
    );

  it("RS-589: 【グレイブラスター】NC（1番目）— 他の自軍 S ユニットをホールドすると、相手は自分自身のユニットを1体選び撃破する（出典: atwiki/page-1199）", () => {
    let s = enterSeq(ncBoard(), ["RS-589:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-589");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ally"]);
    s = pick(s, "TST-UNIT-0:ally");
    expect(s.players.player1.rush.find((c) => c.instanceId === "TST-UNIT-0:ally")?.commandHeld).toBe(true);
    s = resolveAll(s, ["TST-UNIT-0:e1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
  });

  it("RS-589: 【グレイブラスター】任意 — ホールドしなければ相手もユニットを撃破しない（出典: atwiki/page-1199「ホールドしてもよい。そうしたとき」）", () => {
    let s = enterSeq(ncBoard(), ["RS-589:q"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("rush");
  });

  it("RS-589: 【グレイブラスター】NC が成立しない（2番目）ときは発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(ncBoard(2), ["RS-589:q"]));
    expect(s.players.player1.rush.find((c) => c.instanceId === "TST-UNIT-0:ally")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("rush");
  });
});

// 未使用警告よけ（共通ヘルパーの一部はこのファイルでは使わない）
void [destroyedInEnemyTurn, released, settle, unitIn, damageCards];
