/**
 * カード別スペック: RS-327〜RS-332（第5弾「五龍の逆鱗」天空聖者ブレイジェル〜マジライオン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか card_6（RS-420 の Q に RS-328/RS-329 が登場）の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  attack,
  attackTargets,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  drain,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  pick,
  reanimateTests,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS5-327-347.helpers";
import type { CardInstance, GameState } from "../types/game";

const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });
const SPECS = [NOSP];

// ===========================================================================
describe("RS-327 天空聖者ブレイジェル", () => {
  const TEXT =
    "【フェイタルブレイドの伝授】これが自軍ラッシュエリアにある間、特徴「レッド」を持つ自軍ユニットが敵軍ユニットを撃破するたび、自分は1枚ドローする。";

  it("RS-327: カタログ本文・スペックが出典と一致（出典: atwiki/page-488）", () => {
    expectCatalogText("RS-327", TEXT);
    expectStats("RS-327", {
      name: "天空聖者ブレイジェル",
      category: "MA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: "5+",
      features: ["男", "魔法", "天空聖者"],
      rushCondition: "discard_named_unit",
    });
  });

  // 「追加条件：自軍捨札に「魔導騎士ウルザード」がある」— 捨札にあることが条件（捨札にするコストではない）。
  const rushState = (p1: Partial<GameState["players"]["player1"]>) =>
    st({ phase: "rush", player1: { hand: [inst("RS-327", "bz")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3), ...p1 } });

  it.fails("RS-327: 追加条件 — 自軍捨札に「魔導騎士ウルザード」があればラッシュでき、そのウルザードは捨札に残る（出典: atwiki/page-488「自軍捨札に「魔導騎士ウルザード」がある」・評価欄「捨札になっていればよい」）", () => {
    // 既知の不具合: CARD-RS-327 追加条件を「場のウルザードを捨札にする」として扱い、捨札にあるだけではラッシュできない
    const s = rushState({ discard: [inst("RS-115", "u")] });
    expect(canStartRush(s, "player1", "RS-327:bz")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-327:bz");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-327:bz")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-115:u")).toBe("discard");
  });

  it.fails("RS-327: 追加条件 — ウルザードが自軍ラッシュエリアにあっても捨札になければラッシュできない（場のウルザードを捨札にすることでは満たせない）（出典: atwiki/page-488「自軍捨札に…がある」）", () => {
    // 既知の不具合: CARD-RS-327 場のウルザードを捨札にしてラッシュできてしまう
    const s = rushState({ rush: [inst("RS-115", "u")] });
    expect(canStartRush(s, "player1", "RS-327:bz")).toBe(false);
  });

  it("RS-327: 追加条件 — ウルザードがどこにもなければラッシュできない（出典: atwiki/page-488）", () => {
    expect(canStartRush(rushState({}), "player1", "RS-327:bz")).toBe(false);
  });

  it("RS-327: 敵軍の捨札にあるウルザードでは追加条件を満たさない（出典: atwiki/page-488「自軍捨札」）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-327", "bz")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) },
      player2: { discard: [inst("RS-115", "eu")] },
    });
    expect(canStartRush(s, "player1", "RS-327:bz")).toBe(false);
  });

  /** player1 のバトルフェイズ: ブレイジェル（zone）と、アタッカー（attackerId）、敵軍バトルエリアに TST-UNIT-0。 */
  function redAttack(attackerId: string, opts: { zone?: "rush" | "battle" | "none" } = {}) {
    const zone = opts.zone ?? "rush";
    const bz = zone === "none" ? [] : [inst("RS-327", "bz")];
    let s = st(
      {
        player1: { rush: zone === "rush" ? bz : [], battle: [inst(attackerId, "atk"), ...(zone === "battle" ? bz : [])], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
      },
      SPECS,
    );
    const h0 = s.players.player1.hand.length;
    s = settle(attack(s, `${attackerId}:atk`, "TST-UNIT-0:e"));
    return { s, drew: s.players.player1.hand.length - h0 };
  }

  it.fails("RS-327: 自軍ラッシュエリアにある間、特徴「レッド」の自軍ユニット（デカレッド）がバトルで敵軍ユニットを撃破すると1枚ドローする（出典: atwiki/page-488「撃破するたび、自分は1枚ドローする」）", () => {
    // 既知の不具合: CARD-RS-327 【フェイタルブレイドの伝授】が未実装（DSL スタブが NC トリガーになっており発動しない）
    const { s, drew } = redAttack("RS-106");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(drew).toBe(1);
  });

  it.fails("RS-327: 「撃破するたび」— レッドの自軍ユニットが効果（デカレッドSWAT【Dリボルバー】）で敵軍ユニットを撃破しても1枚ドローする（出典: atwiki/page-488「撃破するたび」）", () => {
    // 既知の不具合: CARD-RS-327 【フェイタルブレイドの伝授】が未実装
    let s = st({
      player1: { rush: [inst("RS-327", "bz"), inst("RS-345", "sw")], deck: deckCards(5) },
      player2: { rush: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
    });
    const h0 = s.players.player1.hand.length;
    s = resolveAll(enter(s, "RS-345:sw"), ["TST-UNIT-0:e"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player1.hand.length - h0).toBe(1);
  });

  it.fails("RS-327: 「撃破するたび」— 同じターンにレッドの自軍ユニット2体がそれぞれ撃破すれば合計2枚ドローする（出典: atwiki/page-488・評価欄「複数体撃破…ドローエンジン」）", () => {
    // 既知の不具合: CARD-RS-327 【フェイタルブレイドの伝授】が未実装
    let s = st({
      player1: { rush: [inst("RS-327", "bz")], battle: [inst("RS-106", "r1"), inst("RS-057", "r2")], deck: deckCards(5) },
      player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], deck: deckCards(5, "e") },
    });
    const h0 = s.players.player1.hand.length;
    s = settle(attack(s, "RS-106:r1", "TST-UNIT-0:e1"));
    s = settle(attack(s, "RS-057:r2", "TST-UNIT-0:e2"));
    expect(s.players.player1.hand.length - h0).toBe(2);
  });

  it("RS-327: 特徴「レッド」を持たない自軍ユニットが撃破してもドローしない（出典: atwiki/page-488「特徴「レッド」を持つ自軍ユニット」）", () => {
    const { s, drew } = redAttack("TST-UNIT-0");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(drew).toBe(0);
  });

  it("RS-327: ブレイジェルが自軍バトルエリアにある（ラッシュエリアにない）ときはドローしない（出典: atwiki/page-488「これが自軍ラッシュエリアにある間」）", () => {
    const { s, drew } = redAttack("RS-106", { zone: "battle" });
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(drew).toBe(0);
  });

  it("RS-327: レッドの自軍ユニットが撃破されたとき（敵軍ユニットを撃破していない）はドローしない（出典: atwiki/page-488「敵軍ユニットを撃破するたび」）", () => {
    let s = st({
      player1: { rush: [inst("RS-327", "bz")], battle: [inst("RS-106", "r")], deck: deckCards(5) },
      player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(5, "e") },
    });
    const h0 = s.players.player1.hand.length;
    s = settle(attack(s, "RS-106:r", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RS-106:r")).toBe("discard");
    expect(s.players.player1.hand.length - h0).toBe(0);
  });
});

// ===========================================================================
describe("RS-328 魔法鉄神トラベリオン", () => {
  const TEXT =
    "【デストラクションファイヤー】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドの数よりも敵軍ユニットの数が多ければ、次の効果を発動できる⇒相手は自分自身のユニットを1体選び、自分自身の山札に戻してシャッフルする。";

  it("RS-328: カタログ本文・スペックが出典と一致（出典: atwiki/page-489）", () => {
    expectCatalogText("RS-328", TEXT);
    expectStats("RS-328", {
      name: "魔法鉄神トラベリオン",
      category: "MA",
      size: "L",
      bp: 6000,
      sp: 1,
      powerCost: "5+",
      features: ["魔法", "メカ", "人型"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-328: 追加条件 — 自軍「トラベリオンエクスプレス」1体を捨札にしてラッシュできる（出典: atwiki/page-489）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-328", "tr")], rush: [inst("RS-329", "ex")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-328:tr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-328:tr")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-329:ex")).toBe("discard");
  });

  it("RS-328: 追加条件 — 自軍エリアに「トラベリオンエクスプレス」がなければラッシュできない（出典: atwiki/page-489）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-328", "tr")], rush: fillers(2), command: releasedCat("MA", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-328:tr")).toBe(false);
  });

  /** player1 のバトルフェイズにトラベリオンを出す。自軍コマンド ownCommands 枚、敵軍ユニット enemyUnits 体（ラッシュエリア）。 */
  function enterTravelion(ownCommands: number, enemyUnits: number) {
    const s = st({
      player1: { rush: [inst("RS-328", "tr")], command: releasedCat("MA", ownCommands), deck: deckCards(5) },
      player2: { rush: Array.from({ length: enemyUnits }, (_, i) => inst("TST-UNIT-0", `e${i}`)), deck: deckCards(5, "e") },
    });
    return enter(s, "RS-328:tr");
  }
  const enemyUnitsLeft = (s: GameState) => s.players.player2.rush.length + s.players.player2.battle.length;

  it("RS-328: 敵軍ユニット（3体）が自軍コマンド（2つ）より多いとき、発動すると相手が自分自身のユニットを1体選び、相手の山札に戻す（出典: atwiki/page-489）", () => {
    let s = enterTravelion(2, 3);
    // 発動を選ぶ（自分）→ 相手が自分自身のユニットを選ぶ
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1"; i++) s = drain(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0", "TST-UNIT-0:e1", "TST-UNIT-0:e2"]);
    s = resolveAll(s, ["TST-UNIT-0:e1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("deck");
    expect(enemyUnitsLeft(s)).toBe(2);
  });

  it("RS-328: 「発動できる」— 発動しないことを選べる（敵軍ユニットはそのまま）（出典: atwiki/page-489「次の効果を発動できる」）", () => {
    let s = enterTravelion(2, 3);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(enemyUnitsLeft(s)).toBe(3);
  });

  it("RS-328: 敵軍ユニットの数が自軍コマンドの数と同じ（2体と2つ）なら発動しない（出典: atwiki/page-489「自軍コマンドの数よりも敵軍ユニットの数が多ければ」）", () => {
    const s = resolveAll(enterTravelion(2, 2));
    expect(enemyUnitsLeft(s)).toBe(2);
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it.todo("RS-328: 「自軍ターン中」以外（敵軍ターン中）にバトルエリアに出たときは発動しない — 敵軍ターン中に自軍トラベリオンをバトルエリアに出す公開手段がテスト環境で用意できない（出典: atwiki/page-489「自軍ターン中」）");

  // grnrngr/faq-card-6 RS-420 Q「いいえ、発動しません。…追加条件に「自軍合体ユニットを捨札にする」と書かれていないユニットをラッシュした際には発動しません。」
  it.fails("RS-328: 公式Q&A — 大剣人ズバーンがあっても、トラベリオンエクスプレスを捨札にしてトラベリオンをラッシュしたとき【ズバズバンキック】は発動しない（出典: grnrngr/faq-card-6 RS-420 Q1）", () => {
    // 既知の不具合: CARD-RS-420 合体ユニットでない追加条件（RS-328 のエクスプレス）でも【ズバズバンキック】が発動する
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-328", "tr")], rush: [inst("RS-329", "ex"), inst("RS-420", "zb")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-328:tr");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-420");
    expect(zoneOf(resolveAll(r.state), "player2", "TST-UNIT-0:e1")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-329 トラベリオンエクスプレス", () => {
  const TEXT =
    "※これはアタックすることができない。【マルデヨーナ世界往復切符】自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアからSユニットを1体選び、自軍山札の下に戻してから1枚ドローする。";

  it("RS-329: カタログ本文・スペックが出典と一致（出典: atwiki/page-490）", () => {
    expectCatalogText("RS-329", TEXT);
    expectStats("RS-329", {
      name: "トラベリオンエクスプレス",
      category: "MA",
      size: "L",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["魔法", "メカ", "車両"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  it("RS-329: 追加条件 — 自軍Sユニットを1体捨札にしてラッシュできる（出典: atwiki/page-490）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-329", "ex")], rush: [inst("TST-UNIT-0", "s")], command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-329:ex");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-329:ex")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-329: 追加条件 — 自軍Sユニットがなければ（Mユニットだけでは）ラッシュできない（出典: atwiki/page-490「自軍Sユニットを1体捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-329", "ex")], rush: [inst("TST-UNIT-2", "m")], command: releasedCat("MA", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-329:ex")).toBe(false);
  });

  it("RS-329: ※ アタックすることができない（出典: atwiki/page-490「※これはアタックすることができない。」）", () => {
    const s = st({ player1: { battle: [inst("RS-329", "ex")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") } });
    expect(attackTargets(s, "RS-329:ex")).toEqual([]);
  });

  // grnrngr/faq-card-5 RS-329 Q1「はい、ストライクすることができます。」
  it("RS-329: 公式Q&A — 行えないのはアタックだけで、何らかの手段で SP を得ていればストライクできる（出典: grnrngr/faq-card-5 RS-329 Q1・atwiki/page-490 Q1）", () => {
    const ex = { ...inst("RS-329", "ex"), spModifier: 1 } as CardInstance;
    const s = st({ player1: { battle: [ex], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(spOf(s, "player1", "RS-329:ex")).toBe(1);
    expect(canStrike(s, "RS-329:ex")).toBe(true);
  });

  it("RS-329: SP がない（印刷「－」）ままではストライクできない（出典: atwiki/page-490「SP：－」）", () => {
    const s = st({ player1: { battle: [inst("RS-329", "ex")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(canStrike(s, "RS-329:ex")).toBe(false);
  });

  /** バトルエリアに battle を置いた状態でエクスプレスを出す。 */
  function enterExpress(battle: CardInstance[]) {
    const s = st({ player1: { rush: [inst("RS-329", "ex")], battle, deck: deckCards(5) }, player2: { deck: deckCards(3, "e") } });
    return enter(s, "RS-329:ex");
  }

  it("RS-329: 【マルデヨーナ世界往復切符】自軍バトルエリアのSユニットを1体選び自軍山札の下に戻し、その後1枚ドローする（出典: atwiki/page-490）", () => {
    let s = enterExpress([inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")]);
    const h0 = s.players.player1.hand.length;
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b"]);
    s = pick(s, "TST-UNIT-0:b");
    const deck = s.players.player1.deck.map((c) => c.instanceId);
    expect(deck[deck.length - 1]).toBe("TST-UNIT-0:b");
    expect(s.players.player1.hand.length - h0).toBe(1);
    expect(s.players.player1.hand.some((c) => c.instanceId === "TST-OP:dk0")).toBe(true);
    expect(zoneOf(s, "player1", "RS-329:ex")).toBe("battle");
  });

  it("RS-329: 選べるのは自軍バトルエリアのSユニットだけ（Mユニット・自軍ラッシュエリアのSユニット・自身は選べない）（出典: atwiki/page-490「自軍バトルエリアからSユニットを1体選び」）", () => {
    const s = st({
      player1: { rush: [inst("RS-329", "ex"), inst("TST-UNIT-0", "inRush")], battle: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-0", "s")], deck: deckCards(5) },
      player2: { battle: [inst("TST-UNIT-0", "enemy")], deck: deckCards(3, "e") },
    });
    const t = enter(s, "RS-329:ex");
    expect(choiceIds(t)).toEqual(["TST-UNIT-0:s"]);
  });

  it("RS-329: 強制効果 — 選ばないことはできない（出典: atwiki/page-490「1体選び、…戻してから1枚ドローする」・R-CN-02 と同様「～してもよい」がない）", () => {
    const s = enterExpress([inst("TST-UNIT-0", "a")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-329");
    expect(canSkip(s)).toBe(false);
  });

  it.todo("RS-329: 「自軍ターン中」以外（敵軍ターン中）にバトルエリアに出たときは発動しない — 敵軍ターン中に自軍エクスプレスをバトルエリアに出す公開手段がテスト環境で用意できない（出典: atwiki/page-490「自軍ターン中」）");
});

// ===========================================================================
describe("RS-330 マジレジェンド", () => {
  const TEXT =
    "合体―マジファイヤーバード＋マジライオン【ファイヤートルネード】これをラッシュしたとき、敵軍ユニットと敵軍コマンドゾーンのカードを、すべて持ち主の山札に戻してシャッフルする。";

  it("RS-330: カタログ本文・スペックが出典と一致（出典: atwiki/page-491）", () => {
    expectCatalogText("RS-330", TEXT);
    expectStats("RS-330", {
      name: "マジレジェンド",
      category: "MA",
      size: "L",
      bp: 21000,
      sp: 2,
      powerCost: "6+",
      features: ["魔法", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const legendRush = (rush: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-330", "ml")], rush, command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) },
      player2: { deck: deckCards(2, "e"), ...p2 },
    });

  it("RS-330: 追加条件 — 合体ユニット（マジファイヤーバード＋マジライオン）を捨札にしてラッシュできる（出典: atwiki/page-491「合体―マジファイヤーバード＋マジライオン」）", () => {
    const r = rushFromHand(legendRush([inst("RS-331", "fb"), inst("RS-332", "li")]), "player1", "RS-330:ml");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-330:ml")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-331:fb")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-332:li")).toBe("discard");
  });

  it("RS-330: 追加条件 — 合体ユニットが片方（マジライオン）しかなければラッシュできない（出典: atwiki/page-491）", () => {
    expect(canStartRush(legendRush([inst("RS-332", "li"), inst("TST-UNIT-2", "m")]), "player1", "RS-330:ml")).toBe(false);
  });

  it.fails("RS-330: 【ファイヤートルネード】ラッシュしたとき、敵軍ユニット（ラッシュエリア・バトルエリア）と敵軍コマンドゾーンのカードをすべて持ち主の山札に戻す（出典: atwiki/page-491）", () => {
    // 既知の不具合: CARD-RS-330 【ファイヤートルネード】が敵軍バトルエリアのユニット1体を選んで山札に戻すだけで、ラッシュエリアのユニットとコマンドゾーンのカードが残る
    const r = rushFromHand(
      legendRush([inst("RS-331", "fb"), inst("RS-332", "li")], {
        rush: [inst("TST-UNIT-0", "er")],
        battle: [inst("TST-UNIT-0", "eb")],
        command: [...releasedCat("WB", 1, "erc"), { ...inst("TST-OP", "ehc"), commandHeld: true }],
      }),
      "player1",
      "RS-330:ml",
    );
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    const p2 = s.players.player2;
    expect(p2.rush).toHaveLength(0);
    expect(p2.battle).toHaveLength(0);
    expect(p2.command).toHaveLength(0);
    expect(p2.deck).toHaveLength(2 + 4);
    for (const id of ["TST-UNIT-0:er", "TST-UNIT-0:eb", "TST-OP:erc0", "TST-OP:ehc"]) expect(zoneOf(s, "player2", id)).toBe("deck");
  });

  it("RS-330: 【ファイヤートルネード】自軍のユニットとコマンドは山札に戻らない（出典: atwiki/page-491「敵軍ユニットと敵軍コマンドゾーンのカード」）", () => {
    const r = rushFromHand(
      legendRush([inst("RS-331", "fb"), inst("RS-332", "li"), inst("TST-UNIT-0", "own")], { rush: [inst("TST-UNIT-0", "er")] }),
      "player1",
      "RS-330:ml",
    );
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "TST-UNIT-0:own")).toBe("rush");
    expect(s.players.player1.command).toHaveLength(1);
  });

  it("RS-330: 敵軍に何もなければ【ファイヤートルネード】で何も起きずラッシュは完了する（出典: atwiki/page-491）", () => {
    const r = rushFromHand(legendRush([inst("RS-331", "fb"), inst("RS-332", "li")]), "player1", "RS-330:ml");
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-330:ml")).toBe("rush");
    expect(s.players.player2.deck).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-331 マジファイヤーバード", () => {
  const TEXT = "※これが撃破されて捨札になったとき、自軍捨札に「レジェンドマジレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。";

  it("RS-331: カタログ本文・スペックが出典と一致（出典: atwiki/page-492）", () => {
    expectCatalogText("RS-331", TEXT);
    expectStats("RS-331", {
      name: "マジファイヤーバード",
      category: "MA",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["魔法"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-331: 追加条件 — 自軍「レジェンドマジレッド」1体を捨札にしてラッシュできる（出典: atwiki/page-492）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-331", "fb")], rush: [inst("RS-333", "lr")], command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-331:fb");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-331:fb")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-333:lr")).toBe("discard");
  });

  it("RS-331: 追加条件 — 「レジェンドマジレッド」がいなければラッシュできない（「マジレッド」では満たせない）（出典: atwiki/page-492）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-331", "fb")], rush: [inst("RS-057", "mr")], command: releasedCat("MA", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-331:fb")).toBe(false);
  });

  reanimateTests("RS-331", "RS-333", "レジェンドマジレッド", "atwiki/page-492");

  it("RS-331: ※ 追加条件で捨札になった（撃破されていない）ときは発動しない — マジレジェンドの素材として捨札になっても自軍捨札のレジェンドマジレッドは出ない（出典: atwiki/page-492「撃破されて捨札になったとき」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-330", "ml")], rush: [inst("RS-331", "fb"), inst("RS-332", "li")], discard: [inst("RS-333", "lr")], command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s0, "player1", "RS-330:ml");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-331:fb")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-333:lr")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-332 マジライオン", () => {
  const TEXT =
    "合体―レジェンドマジイエロー＋レジェンドマジブルー＋レジェンドマジピンク＋レジェンドマジグリーン※これが撃破されて捨札になったとき、このユニットの合体に必要なユニットのカードが自軍捨札にあれば、それぞれ1枚ずつ選び、自軍ラッシュエリアに出す。";
  const PARTS = ["RS-334", "RS-335", "RS-336", "RS-337"];

  it("RS-332: カタログ本文・スペックが出典と一致（出典: atwiki/page-493）", () => {
    expectCatalogText("RS-332", TEXT);
    expectStats("RS-332", {
      name: "マジライオン",
      category: "MA",
      size: "M",
      bp: 9000,
      sp: 1,
      powerCost: "5+",
      features: ["魔法"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const lionRush = (rush: CardInstance[]) =>
    st({ phase: "rush", player1: { hand: [inst("RS-332", "li")], rush, command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) } });

  it("RS-332: 追加条件 — 合体ユニット4体（レジェンドマジイエロー＋ブルー＋ピンク＋グリーン）を捨札にしてラッシュできる（出典: atwiki/page-493）", () => {
    const r = rushFromHand(lionRush(PARTS.map((p) => inst(p, "m"))), "player1", "RS-332:li");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-332:li")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(s, "player1", `${p}:m`)).toBe("discard");
  });

  it("RS-332: 追加条件 — 1体（レジェンドマジグリーン）欠けていればラッシュできない（出典: atwiki/page-493）", () => {
    expect(canStartRush(lionRush(PARTS.slice(0, 3).map((p) => inst(p, "m"))), "player1", "RS-332:li")).toBe(false);
  });

  it("RS-332: ※ 撃破されて捨札になったとき、合体に必要なユニットのカード（4種）を自軍捨札からそれぞれ1枚ずつ自軍ラッシュエリアに出す（出典: atwiki/page-493）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-332", "li")], discard: [...PARTS.map((p) => inst(p, "d")), inst("TST-UNIT-0", "o")] }, "RS-332:li");
    expect(zoneOf(s, "player1", "RS-332:li")).toBe("discard");
    for (const p of PARTS) expect(zoneOf(s, "player1", `${p}:d`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:o")).toBe("discard");
  });

  it("RS-332: ※ 「それぞれ1枚ずつ」— 同じカードが2枚あっても1枚だけ出し、捨札にない種類は出さない（出典: atwiki/page-493「それぞれ1枚ずつ選び」）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-332", "li")], discard: [inst("RS-334", "y1"), inst("RS-334", "y2"), inst("RS-336", "pk")] }, "RS-332:li");
    expect(s.players.player1.rush.filter((c) => c.cardId === "RS-334")).toHaveLength(1);
    expect(zoneOf(s, "player1", "RS-336:pk")).toBe("rush");
    expect(s.players.player1.rush).toHaveLength(2);
  });

  it("RS-332: ※ 自軍捨札に合体に必要なユニットのカードがなければ何も出さない（出典: atwiki/page-493「…が自軍捨札にあれば」）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst("RS-332", "li")], discard: [inst("TST-UNIT-0", "o")] }, "RS-332:li");
    expect(zoneOf(s, "player1", "RS-332:li")).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RS-332: ※ マジレジェンドの素材として捨札になった（撃破されていない）ときは発動しない（出典: atwiki/page-493「撃破されて捨札になったとき」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-330", "ml")], rush: [inst("RS-331", "fb"), inst("RS-332", "li")], discard: PARTS.map((p) => inst(p, "d")), command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s0, "player1", "RS-330:ml");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    for (const p of PARTS) expect(zoneOf(s, "player1", `${p}:d`)).toBe("discard");
  });
});
