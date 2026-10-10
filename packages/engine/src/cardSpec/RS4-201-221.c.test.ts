/**
 * カード別スペック: RS-215〜RS-221（第4弾「四雄の覚醒」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）ほか card_2/5/8 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  advanceToBattle,
  attack,
  attackTargets,
  canDecline,
  canStrike,
  choiceIds,
  confirmIfAsked,
  countS,
  decline,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  faceDownCard,
  fillers,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  settle,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RS4-201-221.helpers";
import type { GameState } from "../types/game";

const CAR = sUnit("SPEC-CAR", { features: ["車両"], bp: 1000, sp: 1 });
const MECHA = sUnit("SPEC-MECHA", { features: ["メカ"], bp: 1000 });

// ===========================================================================
describe("RS-215 皇帝バッカスフンド", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【不滅のマシン帝国】これが自軍エリアにある間、特徴「メカ」を持つ自軍ユニットがアタックされたとき、自分の手札からカードを2枚選び、捨札にしてもよい。そうしたとき、バトルは行われない。";

  it("RS-215: カタログ本文・スペックが出典と一致（出典: atwiki/page-384）", () => {
    expectCatalogText("RS-215", TEXT);
    expectStats("RS-215", {
      name: "皇帝バッカスフンド",
      category: "DA",
      size: "S",
      bp: 6000,
      sp: undefined,
      powerCost: 4,
      features: ["皇帝", "メカ", "人型"],
    });
  });

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-215: ※ 敵軍ターン中に SP1 のユニットとバトルすると勝っても撃破される（SP の無いユニット相手なら残る）（出典: atwiki/page-384）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-215", "b")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    s = settle(attack(s, "TST-UNIT-0:e", "RS-215:b", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-215:b")).toBe("discard");
    const NOSP = sUnit("SPEC-NOSP", { sp: undefined });
    let n = st({ activePlayer: "player2", player1: { battle: [inst("RS-215", "b")] }, player2: { battle: [inst("SPEC-NOSP", "e")] } }, [NOSP]);
    n = settle(attack(n, "SPEC-NOSP:e", "RS-215:b", "player2"));
    expect(zoneOf(n, "player1", "RS-215:b")).toBe("battle");
  });

  /** 敵軍ターン、自軍にバッカスフンドと target、手札 handN 枚。敵軍の BP3000 の M が target にアタックする。 */
  function attacked(target: string, handN = 2, extraBattle: ReturnType<typeof inst>[] = []): GameState {
    const s = st(
      {
        activePlayer: "player2",
        player1: {
          battle: [inst("RS-215", "b"), ...extraBattle],
          hand: Array.from({ length: handN }, (_, i) => inst("TST-OP", `h${i}`)),
        },
        player2: { battle: [inst("TST-UNIT-2", "e")] },
      },
      [MECHA],
    );
    return attack(s, "TST-UNIT-2:e", target, "player2");
  }

  // 「特徴「メカ」を持つ自軍ユニットがアタックされたとき、自分の手札からカードを2枚選び、捨札にしてもよい。そうしたとき、バトルは行われない」
  it("RS-215: メカの自軍ユニットがアタックされたとき手札を2枚捨札にするとバトルは行われない（出典: atwiki/page-384）", () => {
    let s = attacked("SPEC-MECHA:m", 2, [inst("SPEC-MECHA", "m")]);
    s = confirmIfAsked(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = settle(drain(s, "player1"));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.discard.map((c) => c.instanceId).sort()).toEqual(["TST-OP:h0", "TST-OP:h1"]);
    expect(zoneOf(s, "player1", "SPEC-MECHA:m")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e")).toBe("battle");
  });

  it("RS-215: バッカスフンド自身（特徴「メカ」）がアタックされたときも使える（出典: atwiki/page-384）", () => {
    let s = attacked("RS-215:b");
    s = settle(drain(confirmIfAsked(s, "player1"), "player1"));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(zoneOf(s, "player1", "RS-215:b")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e")).toBe("battle");
  });

  // 「捨札にしてもよい」
  it("RS-215: 捨札にしないことを選べ、そのときはバトルが行われる（出典: atwiki/page-384「捨札にしてもよい」）", () => {
    let s = attacked("SPEC-MECHA:m", 2, [inst("SPEC-MECHA", "m")]);
    expect(canDecline(s, "player1")).toBe(true);
    s = settle(decline(s, "player1"));
    expect(s.players.player1.hand).toHaveLength(2);
    expect(zoneOf(s, "player1", "SPEC-MECHA:m")).toBe("discard");
  });

  // 「特徴「メカ」を持つ自軍ユニット」・「手札からカードを2枚」— メカでない／手札1枚なら使えない（メカ・2枚なら使えることも確認）
  it("RS-215: メカでないユニットがアタックされたとき・手札が1枚のときは使えない／メカで手札2枚なら使える（出典: atwiki/page-384）", () => {
    const notMecha = settle(attacked("TST-UNIT-0:s", 2, [inst("TST-UNIT-0", "s")]));
    expect(notMecha.players.player1.hand).toHaveLength(2);
    expect(zoneOf(notMecha, "player1", "TST-UNIT-0:s")).toBe("discard");
    const oneCard = settle(attacked("SPEC-MECHA:m", 1, [inst("SPEC-MECHA", "m")]));
    expect(oneCard.players.player1.hand).toHaveLength(1);
    expect(zoneOf(oneCard, "player1", "SPEC-MECHA:m")).toBe("discard");
    const ok = confirmIfAsked(attacked("SPEC-MECHA:m", 2, [inst("SPEC-MECHA", "m")]), "player1");
    expect(ok.pendingEffectChoice?.playerId).toBe("player1");
  });
});

// ===========================================================================
describe("RS-216 暴走皇帝エグゾス", () => {
  const TEXT =
    "※自分がターンを終えるとき、特徴「車両」を持つ自軍ユニットがなければ、このユニットを自軍山札に戻してシャッフルする。【大宇宙ハイウェイ計画】これが自軍エリアにある間、特徴「車両」を持つすべてのユニットは、毎ターン、可能ならバトルエリアに出る。";

  it("RS-216: カタログ本文・スペックが出典と一致（出典: atwiki/page-385）", () => {
    expectCatalogText("RS-216", TEXT);
    expectStats("RS-216", {
      name: "暴走皇帝エグゾス",
      category: "DA",
      size: "L",
      bp: 8000,
      sp: 1,
      powerCost: 6,
      features: ["皇帝", "男"],
    });
  });

  // 「※自分がターンを終えるとき、特徴「車両」を持つ自軍ユニットがなければ、このユニットを自軍山札に戻してシャッフルする」
  it("RS-216: ※ 自軍に「車両」ユニットが無ければターン終了時に自軍山札に戻る（出典: atwiki/page-385）", () => {
    let s = st({ player1: { battle: [inst("RS-216", "x")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = endTurn(s);
    expect(zoneOf(s, "player1", "RS-216:x")).toBe("deck");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RS-216: ※ 自軍ラッシュエリアに「車両」ユニットがあれば場に残る（敵軍の車両は数えない）（出典: atwiki/page-385「特徴「車両」を持つ自軍ユニット」）", () => {
    let own = st({ player1: { battle: [inst("RS-216", "x")], rush: [inst("SPEC-CAR", "c")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [CAR]);
    own = endTurn(own);
    expect(zoneOf(own, "player1", "RS-216:x")).toBe("battle");
    let enemyOnly = st({ player1: { battle: [inst("RS-216", "x")], deck: deckCards(3) }, player2: { rush: [inst("SPEC-CAR", "ec")], deck: deckCards(3, "e") } }, [CAR]);
    enemyOnly = endTurn(enemyOnly);
    expect(zoneOf(enemyOnly, "player1", "RS-216:x")).toBe("deck");
  });

  it("RS-216: ※ 相手がターンを終えるときは戻らない（出典: atwiki/page-385「自分がターンを終えるとき」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-216", "x")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = endTurn(s);
    expect(s.activePlayer).toBe("player1");
    expect(zoneOf(s, "player1", "RS-216:x")).not.toBe("deck");
  });

  // 「特徴「車両」を持つすべてのユニットは、毎ターン、可能ならバトルエリアに出る」
  it("RS-216: 自軍の「車両」ユニットはバトルエリアに出るまでバトルフェイズを終えられない（出典: atwiki/page-385）", () => {
    const s = st({ player1: { battle: [inst("RS-216", "x")], rush: [inst("SPEC-CAR", "c")] } }, [CAR]);
    const types = legal(s).map((a) => a.type);
    expect(types).toContain("move_to_battle");
    expect(types).not.toContain("end_phase");
  });

  it("RS-216: 敵軍の「車両」ユニットも敵軍ターンにバトルエリアに出なければならない（出典: atwiki/page-385「すべてのユニット」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("RS-216", "x")] }, player2: { rush: [inst("SPEC-CAR", "ec")] } }, [CAR]);
    const types = legal(s).map((a) => a.type);
    expect(types).toContain("move_to_battle");
    expect(types).not.toContain("end_phase");
  });

  it("RS-216: エグゾスが場に無ければ「車両」ユニットを出さずにバトルフェイズを終えられる（出典: atwiki/page-385「これが自軍エリアにある間」）", () => {
    const s = st({ player1: { rush: [inst("SPEC-CAR", "c")] } }, [CAR]);
    expect(legal(s).map((a) => a.type)).toContain("end_phase");
  });

  // faq-card-8 RS-580 Q「はい、その通りです。」（エグゾスとン・マが相討ち：ン・マのテキストを実行してから両方が捨札になる）
  it("RS-216: 公式Q&A — 敵軍エグゾスとの相討ちでは、ン・マのテキスト（捨札を山札に戻す）を実行してから両方が捨札になる（出典: grnrngr/faq-card-8 RS-580）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-580", "nma")], discard: [inst("TST-OP", "old1")], deck: deckCards(3) },
      player2: { battle: [inst("RS-216", "x")], discard: [inst("TST-OP", "old2")], deck: deckCards(3, "e") },
    });
    s = attack(s, "RS-216:x", "RS-580:nma", "player2");
    for (let i = 0; i < 6; i++) {
      const p = s.pendingEffectChoice;
      if (!p) break;
      s = p.kind === "confirm" ? act(s, { type: "confirm_effect_choice", playerId: p.playerId }) : pick(s, p.playerId, p.validInstanceIds[0]!);
    }
    s = settle(s);
    expect(s.players.player1.discard.map((c) => c.instanceId)).toEqual(["RS-580:nma"]);
    expect(s.players.player2.discard.map((c) => c.instanceId)).toEqual(["RS-216:x"]);
    expect(zoneOf(s, "player1", "TST-OP:old1")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-OP:old2")).toBe("deck");
  });

  // faq-card-5 RS-310 Q「はい、できます。」（ターン終了時、ゴウライビートルの撃破判定より先にエグゾスの判定を行える）
  it("RS-216: 公式Q&A — ターン終了時、BP8000 以上のゴウライビートルが撃破される前にエグゾスの判定を行えば場に残る（出典: grnrngr/faq-card-5 RS-310）", () => {
    let s = st({
      player1: { battle: [inst("RS-216", "x"), inst("RS-310", "beetle")], damage: 3, power: Array.from({ length: 3 }, (_, i) => faceDownCard("TST-P", `d${i}`)), deck: deckCards(3) },
      player2: { damage: 3, power: Array.from({ length: 3 }, (_, i) => faceDownCard("TST-P", `ed${i}`)), deck: deckCards(3, "e") },
    });
    for (let i = 0; i < 10 && s.activePlayer === "player1"; i++) {
      const p = s.pendingEffectChoice;
      if (p && p.playerId === "player1") {
        const exodus = p.validInstanceIds.find((id) => id.includes("RS-216"));
        s = pick(s, "player1", exodus ?? p.validInstanceIds[0]!);
        continue;
      }
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = act(s, end);
    }
    expect(zoneOf(s, "player1", "RS-310:beetle")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-216:x")).not.toBe("deck");
  });

  it.todo(
    "RS-216: 公式Q&A — 【噛みつき】で S ユニットになっているライジンゴーがあれば、ターン終了時エグゾスは山札に戻らない（出典: atwiki/page-385 Q2）— XG3-103 の【噛みつき】（範囲外カード）の手順に依存する",
  );
});

// ===========================================================================
describe("RS-217 SSスタタンゾ", () => {
  const TEXT = "【家出したくなるガソリン】バトルエリアにある特徴「車両」を持つユニットを1体選び、持ち主の山札の下に戻してもよい。";

  it("RS-217: カタログ本文・スペックが出典と一致（出典: atwiki/page-386）", () => {
    expectCatalogText("RS-217", TEXT);
    expectStats("RS-217", {
      name: "SSスタタンゾ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 2,
      features: ["怪人", "男"],
    });
  });

  function statanzo(position: number): GameState {
    const s = st(
      {
        player1: { battle: fillers(position - 1), rush: [inst("RS-217", "s")], deck: deckCards(2) },
        player2: { battle: [inst("SPEC-CAR", "eCar")], rush: [inst("SPEC-CAR", "eRushCar")], deck: deckCards(2, "e") },
      },
      [CAR],
    );
    return enter(s, "RS-217:s");
  }

  // 「バトルエリアにある特徴「車両」を持つユニットを1体選び、持ち主の山札の下に戻してもよい」
  // 既知の不具合: CARD-RS-217 【家出したくなるガソリン】でユニットを選べず、山札の下に戻らない
  it.fails("RS-217: NC（2番目）で敵軍バトルエリアの「車両」ユニットを持ち主の山札の下に戻す（ラッシュエリアの車両は選べない）（出典: atwiki/page-386）", () => {
    let s = statanzo(2);
    s = confirmIfAsked(s, "player1");
    expect(choiceIds(s)).toEqual(["SPEC-CAR:eCar"]);
    s = pick(s, "player1", "SPEC-CAR:eCar");
    expect(zoneOf(s, "player2", "SPEC-CAR:eCar")).toBe("deck");
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-CAR:eCar");
    expect(zoneOf(s, "player2", "SPEC-CAR:eRushCar")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-217 【家出したくなるガソリン】でユニットを選べず、山札の下に戻らない
  it.fails("RS-217: 自軍バトルエリアの「車両」も選べ、自分の山札の下に戻る（出典: atwiki/page-386「持ち主の山札の下」）", () => {
    let s = st(
      { player1: { battle: [inst("SPEC-CAR", "ownCar")], rush: [inst("RS-217", "s")], deck: deckCards(2) }, player2: { deck: deckCards(2, "e") } },
      [CAR],
    );
    s = confirmIfAsked(enter(s, "RS-217:s"), "player1");
    expect(choiceIds(s)).toEqual(["SPEC-CAR:ownCar"]);
    s = pick(s, "player1", "SPEC-CAR:ownCar");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-CAR:ownCar");
  });

  // 「戻してもよい」
  // 既知の不具合: CARD-RS-217 【家出したくなるガソリン】でユニットを選べず、山札の下に戻らない
  it.fails("RS-217: 戻さないことを選べる（出典: atwiki/page-386「戻してもよい」）", () => {
    let s = statanzo(2);
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(zoneOf(s, "player2", "SPEC-CAR:eCar")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-217 【家出したくなるガソリン】でユニットを選べず、山札の下に戻らない
  it.fails("RS-217: NC 不成立（1番目）では選べない／2番目なら選べる（出典: atwiki/page-386、R-CN-02）", () => {
    const first = statanzo(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(first, "player2", "SPEC-CAR:eCar")).toBe("battle");
    expect(choiceIds(confirmIfAsked(statanzo(2), "player1"))).toEqual(["SPEC-CAR:eCar"]);
  });
});

// ===========================================================================
describe("RS-218 タイムレッド", () => {
  const TEXT =
    "【アサルトベクター】「SP1」相手は自分自身のパワーゾーンのダメージ以外のカードを見て、カテゴリの数が2つ以上あれば、1つになるまでダメージ以外のカードを捨札にする。";

  it("RS-218: カタログ本文・スペックが出典と一致（出典: atwiki/page-415）", () => {
    expectCatalogText("RS-218", TEXT);
    expectStats("RS-218", {
      name: "タイムレッド",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 4,
      comboNumber: 4,
      features: ["レッド", "男", "加速"],
    });
  });

  function timeRed(position: number, enemyPower: ReturnType<typeof inst>[]): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-218", "r")] },
      player2: { power: enemyPower, deck: deckCards(3, "e") },
    });
    return enter(s, "RS-218:r");
  }
  const MIXED = () => [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2"), inst("TST-OP-MA", "ma"), inst("TST-OP-DA", "da"), faceDownCard("TST-OP-OT", "dmg")];
  const nonDamageCategories = (s: GameState) =>
    new Set(s.players.player2.power.filter((c) => !c.faceDown).map((c) => String(s.definitions[c.cardId]?.category)));

  it("RS-218: NC（4番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-415）", () => {
    let s = drain(timeRed(4, [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2")]), "player2");
    expect(canStrike(s, "RS-218:r")).toBe(true);
    s = settle(strike(s, "RS-218:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「相手は自分自身のパワーゾーンのダメージ以外のカードを見て、カテゴリの数が2つ以上あれば、1つになるまでダメージ以外のカードを捨札にする」
  it("RS-218: 相手のダメージ以外のパワーが ET×2・MA・DA なら、相手が選んで1カテゴリになるまで捨札にする（ダメージはそのまま）（出典: atwiki/page-415）", () => {
    let s = timeRed(4, MIXED());
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = drain(s, "player2", ["TST-OP-MA:ma", "TST-OP-DA:da"]);
    expect(nonDamageCategories(s).size).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP-ET:et1")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP-ET:et2")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP-MA:ma")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-DA:da")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-OT:dmg")).toBe("power");
    expect(s.players.player2.damage).toBe(0);
  });

  // 「カテゴリの数が2つ以上あれば」— 1カテゴリなら何もしない（2つ以上なら捨札にすることも確認）
  it("RS-218: ダメージ以外が1カテゴリ（ダメージは別カテゴリ）なら捨札にしない／2カテゴリ以上なら捨札にする（出典: atwiki/page-415「カテゴリの数が2つ以上あれば」）", () => {
    const one = drain(timeRed(4, [inst("TST-OP-ET", "et1"), inst("TST-OP-ET", "et2"), faceDownCard("TST-OP-OT", "dmg")]), "player2");
    expect(one.players.player2.power).toHaveLength(3);
    const many = drain(timeRed(4, MIXED()), "player2");
    expect(many.players.player2.discard.length).toBeGreaterThan(0);
  });

  it("RS-218: NC 不成立（1番目）では捨札にしない／4番目なら捨札にする（出典: atwiki/page-415、R-CN-02）", () => {
    const first = drain(timeRed(1, MIXED()), "player2");
    expect(first.players.player2.discard).toHaveLength(0);
    const fourth = drain(timeRed(4, MIXED()), "player2");
    expect(nonDamageCategories(fourth).size).toBe(1);
  });
});

// ===========================================================================
describe("RS-219 タイムブルー", () => {
  const TEXT =
    "【スピニングスラッシュ】「SP1」敵軍Sユニットの数が自軍Sユニットの数より4体以上多いとき、次の効果を発動できる⇒自軍Sユニットと同じ数になるまで、敵軍Sユニットを選び撃破する。";

  it("RS-219: カタログ本文・スペックが出典と一致（出典: atwiki/page-411）", () => {
    expectCatalogText("RS-219", TEXT);
    expectStats("RS-219", {
      name: "タイムブルー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["ブルー", "男", "加速"],
    });
  });

  /** 自軍 S は4体（フィラー3＋タイムブルー）。敵軍 S は enemyS 体（バトル5・残りラッシュ）と M 1体。 */
  function timeBlue(position: number, enemyS: number, enemyRushExtra: ReturnType<typeof inst>[] = []): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-219", "b"), ...fillers(4 - position, "ownR")] },
      player2: {
        battle: fillers(Math.min(enemyS, 5), "eb"),
        rush: [...fillers(Math.max(enemyS - 5 - enemyRushExtra.length, 0), "er"), ...enemyRushExtra, inst("TST-UNIT-2", "em")],
        power: powerCards(3, "e"),
        deck: deckCards(3, "e"),
      },
    });
    return enter(s, "RS-219:b");
  }

  it("RS-219: NC（4番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-411）", () => {
    let s = timeBlue(4, 2);
    expect(canStrike(s, "RS-219:b")).toBe(true);
    s = settle(strike(s, "RS-219:b"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「自軍Sユニットと同じ数になるまで、敵軍Sユニットを選び撃破する」
  // faq-card-4 RS-219 Q4「はい、その通りです。」（X＜Y なら1体選び撃破、を X＝Y になるまで繰り返す）
  it("RS-219: 敵軍 S が4体以上多い（8対4）とき発動し、自軍 S と同じ4体になるまで敵軍 S を選んで撃破する（M は対象外）（出典: atwiki/page-411・grnrngr/faq-card-4 RS-219 Q4）", () => {
    let s = timeBlue(4, 8);
    expect(countS(s, "player1")).toBe(4);
    expect(countS(s, "player2")).toBe(8);
    s = confirmIfAsked(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).not.toContain("TST-UNIT-2:em");
    s = settle(drain(s, "player1"));
    expect(countS(s, "player2")).toBe(4);
    expect(s.players.player2.discard).toHaveLength(4);
    expect(zoneOf(s, "player2", "TST-UNIT-2:em")).toBe("rush");
  });

  it("RS-219: 差が3体（7対4）では発動しない／4体なら発動する（出典: atwiki/page-411「4体以上多いとき」）", () => {
    const three = settle(drain(confirmIfAsked(timeBlue(4, 7), "player1"), "player1"));
    expect(countS(three, "player2")).toBe(7);
    const four = settle(drain(confirmIfAsked(timeBlue(4, 8), "player1"), "player1"));
    expect(countS(four, "player2")).toBe(4);
  });

  // 「次の効果を発動できる」
  it("RS-219: 発動しないことを選べる（出典: atwiki/page-411「発動できる」）", () => {
    let s = timeBlue(4, 8);
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(countS(s, "player2")).toBe(8);
  });

  it("RS-219: NC 不成立（1番目）では発動しない／4番目なら発動する（出典: atwiki/page-411、R-CN-02）", () => {
    const first = settle(drain(confirmIfAsked(timeBlue(1, 8), "player1"), "player1"));
    expect(countS(first, "player2")).toBe(8);
    const fourth = settle(drain(confirmIfAsked(timeBlue(4, 8), "player1"), "player1"));
    expect(countS(fourth, "player2")).toBe(4);
  });

  // faq-card-4 RS-219 Q1「先に撃破する対象をすべて選んでから、選んだユニットを１体ずつ撃破するようにしてください」
  // faq-card-4 RS-219 Q3「必ず同じ数になるまで選び、撃破してください」
  it("RS-219: 公式Q&A — 4体すべて選び終えるまで撃破されず、途中で止められない（出典: grnrngr/faq-card-4 RS-219 Q1・Q3）", () => {
    let s = confirmIfAsked(timeBlue(4, 8), "player1");
    const targets = ["TST-UNIT-0:eb0", "TST-UNIT-0:eb1", "TST-UNIT-0:eb2", "TST-UNIT-0:eb3"];
    for (const id of targets.slice(0, 3)) {
      s = pick(s, "player1", id);
      expect(canDecline(s, "player1")).toBe(false);
    }
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb0")).toBe("battle");
    s = settle(pick(s, "player1", targets[3]!));
    for (const id of targets) expect(zoneOf(s, "player2", id)).toBe("discard");
  });

  // faq-card-4 RS-219 Q2（faq-card-2 にも転載）「「RS-116 マンドラ坊や」が撃破された瞬間に手札に戻ります。…撃破の処理を継続して実行してください」
  it("RS-219: 公式Q&A — 対象に選んだマンドラ坊やが撃破された瞬間タイムブルーは手札に戻り、場に残る他の対象の撃破は続ける（出典: grnrngr/faq-card-4 RS-219 Q2・faq-card-2）", () => {
    const WITCH = sUnit("SPEC-MAGIC", { features: ["魔法"], bp: 1000 });
    let s = st(
      {
        player1: { battle: fillers(3), rush: [inst("RS-219", "b")] },
        player2: {
          battle: [inst("SPEC-MAGIC", "w0"), inst("SPEC-MAGIC", "w1"), inst("SPEC-MAGIC", "w2"), inst("SPEC-MAGIC", "w3"), inst("SPEC-MAGIC", "w4")],
          rush: [inst("RS-116", "mandora"), inst("SPEC-MAGIC", "w5"), inst("SPEC-MAGIC", "w6")],
          power: powerCards(3, "e"),
          deck: deckCards(3, "e"),
        },
      },
      [WITCH],
    );
    s = confirmIfAsked(enter(s, "RS-219:b"), "player1");
    s = settle(pick(s, "player1", "RS-116:mandora", "SPEC-MAGIC:w0", "SPEC-MAGIC:w1", "SPEC-MAGIC:w2"));
    expect(zoneOf(s, "player1", "RS-219:b")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-116:mandora")).toBe("discard");
    for (const id of ["SPEC-MAGIC:w0", "SPEC-MAGIC:w1", "SPEC-MAGIC:w2"]) expect(zoneOf(s, "player2", id)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-220 タイムグリーン", () => {
  const TEXT = "【反射バリア】次の相手ターン、自軍Sユニットとバトルした敵軍Sユニットは、バトルに勝っても撃破される。";

  it("RS-220: カタログ本文・スペックが出典と一致（出典: atwiki/page-412）", () => {
    expectCatalogText("RS-220", TEXT);
    expectStats("RS-220", {
      name: "タイムグリーン",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 5,
      features: ["グリーン", "男", "加速"],
    });
  });

  const BIG_S = sUnit("SPEC-BIG-S", { bp: 6000, sp: undefined });
  const BIG_M = sUnit("SPEC-BIG-M", { bp: 6000, size: "M", sp: undefined });

  /** 自軍ターンにタイムグリーンを position 番目に出し、相手のバトルフェイズへ。自軍バトルエリアに M も置く。 */
  function toEnemyBattle(position: number): GameState {
    let s = st(
      {
        player1: { battle: [...fillers(position - 1)], rush: [inst("RS-220", "g"), inst("TST-UNIT-2", "myM")], deck: deckCards(5) },
        player2: { rush: [inst("SPEC-BIG-S", "bs"), inst("SPEC-BIG-M", "bm"), inst("SPEC-BIG-S", "bs2")], power: powerCards(3, "e"), deck: deckCards(5, "e") },
      },
      [BIG_S, BIG_M],
    );
    s = passEntry(enter(s, "RS-220:g"));
    s = passEntry(enter(s, "TST-UNIT-2:myM"));
    s = endTurn(s);
    return advanceToBattle(s, "player2");
  }

  // 「次の相手ターン、自軍Sユニットとバトルした敵軍Sユニットは、バトルに勝っても撃破される」
  // 既知の不具合: CARD-RS-220 【反射バリア】が適用されず、自軍 S ユニットとバトルして勝った敵軍 S ユニットが撃破されない
  it.fails("RS-220: NC（5番目）の次の相手ターン、自軍 S とバトルして勝った敵軍 S は撃破される（出典: atwiki/page-412）", () => {
    let s = toEnemyBattle(5);
    s = enter(s, "SPEC-BIG-S:bs", "player2");
    s = settle(attack(s, "SPEC-BIG-S:bs", "TST-UNIT-0:fill0", "player2"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:fill0")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BIG-S:bs")).toBe("discard");
  });

  // 「自軍Sユニットとバトルした敵軍Sユニット」— 敵軍 M・自軍 M とのバトルには及ばない（S 同士なら撃破されることも確認）
  // 既知の不具合: CARD-RS-220 【反射バリア】が適用されず、自軍 S ユニットとバトルして勝った敵軍 S ユニットが撃破されない
  it.fails("RS-220: 敵軍 M が勝っても・敵軍 S が自軍 M に勝っても撃破されない／S 同士なら撃破される（出典: atwiki/page-412）", () => {
    let s = toEnemyBattle(5);
    s = enter(s, "SPEC-BIG-M:bm", "player2");
    s = settle(attack(s, "SPEC-BIG-M:bm", "TST-UNIT-0:fill0", "player2"));
    expect(zoneOf(s, "player2", "SPEC-BIG-M:bm")).toBe("battle");
    s = enter(s, "SPEC-BIG-S:bs", "player2");
    s = settle(attack(s, "SPEC-BIG-S:bs", "TST-UNIT-2:myM", "player2"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:myM")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BIG-S:bs")).toBe("battle");
    s = enter(s, "SPEC-BIG-S:bs2", "player2");
    s = settle(attack(s, "SPEC-BIG-S:bs2", "TST-UNIT-0:fill1", "player2"));
    expect(zoneOf(s, "player2", "SPEC-BIG-S:bs2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-220 【反射バリア】が適用されず、自軍 S ユニットとバトルして勝った敵軍 S ユニットが撃破されない
  it.fails("RS-220: NC 不成立（1番目）なら勝った敵軍 S は残る／5番目なら撃破される（出典: atwiki/page-412、R-CN-02）", () => {
    let first = toEnemyBattle(1);
    first = enter(first, "SPEC-BIG-S:bs", "player2");
    first = settle(attack(first, "SPEC-BIG-S:bs", "RS-220:g", "player2"));
    expect(zoneOf(first, "player2", "SPEC-BIG-S:bs")).toBe("battle");
    let fifth = toEnemyBattle(5);
    fifth = enter(fifth, "SPEC-BIG-S:bs", "player2");
    fifth = settle(attack(fifth, "SPEC-BIG-S:bs", "RS-220:g", "player2"));
    expect(zoneOf(fifth, "player2", "SPEC-BIG-S:bs")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-221 タイムイエロー", () => {
  const TEXT =
    "【グラップファイター】敵軍バトルエリアにあるSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアに、戻したユニット以外のユニットがあれば1体選び、戻したユニットとバトルさせる。戻したユニット以外にユニットが無ければ、相手に1点ダメージを与える。";

  it("RS-221: カタログ本文・スペックが出典と一致（出典: atwiki/page-413）", () => {
    expectCatalogText("RS-221", TEXT);
    expectStats("RS-221", {
      name: "タイムイエロー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 3,
      features: ["イエロー", "男", "加速"],
    });
  });

  function timeYellow(position: number, enemyRush: ReturnType<typeof inst>[]): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-221", "y")], power: powerCards(2), deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "eb"), inst("TST-UNIT-2", "ebm")], rush: enemyRush, power: powerCards(2, "e"), deck: deckCards(3, "e") },
    });
    return enter(s, "RS-221:y");
  }

  // 「敵軍バトルエリアにあるSユニットを1体選び、敵軍ラッシュエリアに戻してもよい。そうしたとき、敵軍ラッシュエリアに、戻したユニット以外のユニットがあれば1体選び、戻したユニットとバトルさせる」
  it("RS-221: NC（3番目）で敵軍バトルエリアの S をラッシュエリアに戻し、ラッシュエリアの他のユニットとバトルさせる（M は選べない）（出典: atwiki/page-413）", () => {
    let s = timeYellow(3, [inst("TST-UNIT-2", "er")]);
    s = confirmIfAsked(s, "player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:eb"]);
    s = pick(s, "player1", "TST-UNIT-0:eb");
    if (s.pendingEffectChoice?.playerId === "player1") s = pick(s, "player1", "TST-UNIT-2:er");
    s = settle(s);
    // BP1000 の S と BP3000 の M のバトル → S が撃破される
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:er")).toBe("rush");
    expect(s.players.player1.damage).toBe(0);
    expect(s.players.player2.damage).toBe(0);
  });

  // 「戻したユニット以外にユニットが無ければ、相手に1点ダメージを与える」
  it("RS-221: 敵軍ラッシュエリアに他のユニットが無ければ相手に1点ダメージ（自分にはダメージなし）（出典: atwiki/page-413）", () => {
    let s = timeYellow(3, []);
    s = confirmIfAsked(s, "player1");
    s = settle(pick(s, "player1", "TST-UNIT-0:eb"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("rush");
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });

  // 「戻してもよい」
  it("RS-221: 戻さないことを選べ、そのときはバトルもダメージも無い（出典: atwiki/page-413「戻してもよい」）", () => {
    let s = timeYellow(3, []);
    expect(canDecline(s, "player1")).toBe(true);
    s = settle(decline(s, "player1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
    expect(s.players.player1.damage).toBe(0);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-221: NC 不成立（1番目）では何も起きない／3番目なら選べる（出典: atwiki/page-413、R-CN-02）", () => {
    const first = settle(timeYellow(1, []));
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(first.players.player1.damage).toBe(0);
    expect(first.players.player2.damage).toBe(0);
    expect(choiceIds(confirmIfAsked(timeYellow(3, []), "player1"))).toEqual(["TST-UNIT-0:eb"]);
  });

  // faq-card-5 RS-256 Q「はい、その通りです。」（タイムイエロー等の効果で敵軍ユニット同士をバトルさせて撃破したとき、闇の戒律の「敵軍ユニットを撃破するたび」を満たす）
  it("RS-221: 公式Q&A — グラップファイターで敵軍ユニット同士をバトルさせて撃破すると、闇の戒律の重ねたカードを手札に加えられる（出典: grnrngr/faq-card-5 RS-256）", () => {
    let s = st({
      player1: {
        battle: fillers(2),
        rush: [inst("RS-221", "y")],
        operation: [inst("RS-256", "law")],
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-2", "er")], power: powerCards(2, "e"), deck: deckCards(3, "e") },
    });
    const law = s.players.player1.operation[0]!;
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, operation: [{ ...law, stackedCards: [inst("TST-OP", "stacked")] } as typeof law] } } };
    s = confirmIfAsked(enter(s, "RS-221:y"), "player1");
    s = pick(s, "player1", "TST-UNIT-0:eb");
    if (s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.validInstanceIds.includes("TST-UNIT-2:er")) s = pick(s, "player1", "TST-UNIT-2:er");
    s = settle(drain(s, "player1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stacked")).toBe("hand");
  });
});

void attackTargets;
