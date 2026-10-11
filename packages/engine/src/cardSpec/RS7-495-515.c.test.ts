/**
 * カード別スペック: RS-509〜RS-515（第7弾「七忍の炎陣」ゴーオンブルー〜エンジンオー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7（該当 Q なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）。
 *     RS-515 は atwiki コメント欄「現物を確認したところ「次の効果を得る」ではなく「次の効果を発動できる」だったので修正しました」の修正後本文。
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-ADD-06、R-DMG-02、R-ZONE-09、R-RES-06 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
  cardIn,
} from "./RS7-495-515.helpers";
import type { CardInstance, GameState } from "../types/game";

function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

const M_COST1 = sUnit("SPEC-M1", { size: "M", powerCost: 1 });

/** n 番目に出す（先に TST-UNIT-0 を n-1 体並べる）。 */
function enterAt(
  id: string,
  pos: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
): GameState {
  return enter(
    st(
      { player1: { battle: fill(pos - 1), rush: [inst(id, "me")], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } },
      [M_COST1],
    ),
    `${id}:me`,
  );
}

// ===========================================================================
describe("RS-509 ゴーオンブルー", () => {
  const TEXT =
    "【ガレージランチャー】自軍パワーゾーンのオモテ向きのカードからオペレーションカードを1枚選び、自分の手札に加えても良い。そうしたとき、このターン、これは「SP1」になる。";

  it("RS-509: カタログ本文・スペックが出典と一致（出典: atwiki/page-758）", () => {
    expectCatalogText("RS-509", TEXT);
    expectStats("RS-509", {
      name: "ゴーオンブルー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 1,
      comboNumber: 2,
      features: ["ブルー", "男"],
    });
  });

  /** 自軍パワー: オモテのオペレーション op0、ウラ（ダメージ）のオペレーション dm0、オモテのユニットカード pu0。 */
  const ownPower = (): CardInstance[] => [inst("TST-OP", "op0"), { ...inst("TST-OP", "dm0"), faceDown: true }, inst("TST-UNIT-2", "pu0")];

  it("RS-509: 【ガレージランチャー】2番目に出て NC が成立すると、自軍パワーゾーンのオモテ向きのオペレーションカードだけを選べる（出典: atwiki/page-758「自軍パワーゾーンのオモテ向きのカードからオペレーションカードを1枚選び」）", () => {
    const s = enterAt("RS-509", 2, { power: ownPower(), damage: 1 });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-509");
    expect(choiceIds(s)).toEqual(["TST-OP:op0"]);
  });

  it("RS-509: 【ガレージランチャー】選んだオペレーションカードを手札に加え、そうしたとき「SP1」になる（出典: atwiki/page-758「手札に加えても良い。そうしたとき、このターン、これは「SP1」になる」）", () => {
    const s = resolveAll(pick(enterAt("RS-509", 2, { power: ownPower(), damage: 1 }), "TST-OP:op0"));
    expect(zoneOf(s, "player1", "TST-OP:op0")).toBe("hand");
    expect(spOf(s, "player1", "RS-509:me")).toBe(1);
    expect(zoneOf(s, "player1", "RS-509:me")).toBe("battle");
  });

  it("RS-509: 【ガレージランチャー】「加えても良い」— 見送れて、そのときは「SP1」にならない（出典: atwiki/page-758）", () => {
    let s = enterAt("RS-509", 2, { power: ownPower(), damage: 1 });
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-OP:op0")).toBe("power");
    expect(spOf(s, "player1", "RS-509:me")).toBe(0);
  });

  it("RS-509: 【ガレージランチャー】オモテ向きのオペレーションカードがなければ何も選ばず、「SP1」にもならない（出典: atwiki/page-758「そうしたとき」・R-RES-06）", () => {
    const s = enterAt("RS-509", 2, { power: [inst("TST-UNIT-2", "pu0"), { ...inst("TST-OP", "dm0"), faceDown: true }], damage: 1 });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(spOf(s, "player1", "RS-509:me")).toBe(0);
  });

  it("RS-509: 【ガレージランチャー】1番目に出たとき（NC 不成立）は発動せず SP もない（出典: atwiki/page-758・R-CN-02）", () => {
    const s = enterAt("RS-509", 1, { power: ownPower(), damage: 1 });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(spOf(s, "player1", "RS-509:me")).toBe(0);
    expect(zoneOf(s, "player1", "TST-OP:op0")).toBe("power");
  });
});

// ===========================================================================
describe("RS-510 ゴーオンイエロー", () => {
  const TEXT =
    "【レーシングバレット】自分の手札から、特徴「車両」を持つユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。そうした時、相手は置いたカードの必要パワーの数字と同じ必要パワーの数字を持つ自分自身のSユニットを1体選び、自分自身のパワーゾーンに送る。";

  it("RS-510: カタログ本文・スペックが出典と一致（出典: atwiki/page-794）", () => {
    expectCatalogText("RS-510", TEXT);
    expectStats("RS-510", {
      name: "ゴーオンイエロー",
      category: "OT",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      comboNumber: 3,
      features: ["イエロー", "女"],
    });
  });

  /** 手札: スピードル（車両・必要パワー0）、バスオン（車両・1）、TST-UNIT-2（車両なし）。敵軍: 必要パワー1の S（ゲキブルー）2体・M、0 の S。 */
  const enterYellow = (pos = 3, p2: Partial<GameState["players"]["player2"]> = {}) =>
    enterAt(
      "RS-510",
      pos,
      { hand: [inst("RS-505", "sp"), inst("RS-506", "bo"), inst("TST-UNIT-2", "x")] },
      {
        battle: [inst("RS-341", "b1"), inst("SPEC-M1", "m1")],
        rush: [inst("RS-341", "b2"), inst("TST-UNIT-0", "z0")],
        ...p2,
      },
    );

  it("RS-510: 【レーシングバレット】3番目に出て NC が成立すると、手札の特徴「車両」を持つユニットカードだけを選べる（出典: atwiki/page-794「自分の手札から、特徴「車両」を持つユニットカードを1枚選び」）", () => {
    const s = enterYellow();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-510");
    expect(choiceIds(s)).toEqual(["RS-505:sp", "RS-506:bo"]);
  });

  it("RS-510: 【レーシングバレット】バスオン（必要パワー1）を自軍パワーゾーンに置くと、相手は必要パワー1の自分の S ユニット（M は除く）を1体選び、自分のパワーゾーンに送る（出典: atwiki/page-794「相手は置いたカードの必要パワーの数字と同じ必要パワーの数字を持つ自分自身のSユニットを1体選び、自分自身のパワーゾーンに送る」）", () => {
    let s = pick(enterYellow(), "RS-506:bo");
    expect(zoneOf(s, "player1", "RS-506:bo")).toBe("power");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["RS-341:b1", "RS-341:b2"]);
    s = resolveAll(pick(s, "RS-341:b2"));
    expect(zoneOf(s, "player2", "RS-341:b2")).toBe("power");
    expect(zoneOf(s, "player2", "RS-341:b1")).toBe("battle");
  });

  it("RS-510: 【レーシングバレット】「置いてもよい」— 見送れる（出典: atwiki/page-794）", () => {
    let s = enterYellow();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-510");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-506:bo")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-341:b1")).toBe("battle");
  });

  it("RS-510: 【レーシングバレット】相手に同じ必要パワーの S ユニットがいなければ、カードを置くだけで何も送られない（出典: atwiki/page-794）", () => {
    let s = enterYellow(3, { battle: [inst("SPEC-M1", "m1")], rush: [inst("TST-UNIT-0", "z0")] });
    s = resolveAll(pick(s, "RS-506:bo"));
    expect(zoneOf(s, "player1", "RS-506:bo")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-M1:m1")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:z0")).toBe("rush");
  });

  it("RS-510: 【レーシングバレット】2番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-794・R-CN-02）", () => {
    const s = resolveAll(enterYellow(2));
    expect(zoneOf(s, "player1", "RS-506:bo")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-505:sp")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-341:b1")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-511 ゴーオングリーン", () => {
  const TEXT =
    "【マンタンガン・ロッドモード】自軍パワーゾーンのカード枚数が、敵軍パワーゾ－ンのカード枚数より少なければ、自軍山札の上から1枚ひいて、自軍パワーゾーンに置いてもよい。";

  it("RS-511: カタログ本文・スペックが出典と一致（出典: atwiki/page-795）", () => {
    expectCatalogText("RS-511", TEXT);
    expectStats("RS-511", {
      name: "ゴーオングリーン",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 2,
      features: ["グリーン", "男"],
    });
  });

  /** 自軍パワー own 枚、敵軍パワー enemy 枚（うち1枚はダメージ）で2番目に出す。自軍山札の上は TST-UNIT-7:top。 */
  const enterGreen = (own: number, enemy: number, pos = 2) =>
    enterAt(
      "RS-511",
      pos,
      { power: powerCards(own, "op"), deck: [inst("TST-UNIT-7", "top"), ...deckCards(3)] },
      { power: [...damageCards(1, "ed"), ...powerCards(enemy - 1, "ep")], damage: 1 },
    );

  it("RS-511: 【マンタンガン・ロッドモード】自軍パワー（1枚）が敵軍パワー（ダメージ込み3枚）より少なければ、山札の上から1枚ひいて自軍パワーゾーンに置ける（出典: atwiki/page-795「自軍山札の上から1枚ひいて、自軍パワーゾーンに置いてもよい」）", () => {
    let s = enterGreen(1, 3);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-511");
    s = resolveAll(s, [s.pendingEffectChoice?.validInstanceIds.find((x) => !x.startsWith("TST-UNIT-0") && x !== "RS-511:me") ?? "TST-UNIT-7:top"]);
    expect(zoneOf(s, "player1", "TST-UNIT-7:top")).toBe("power");
    expect(s.players.player1.power).toHaveLength(2);
    expect(zoneOf(s, "player1", "RS-511:me")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-UNIT-0:f0")).toBe("battle");
  });

  it("RS-511: 【マンタンガン・ロッドモード】「置いてもよい」— 見送れる（出典: atwiki/page-795）", () => {
    let s = enterGreen(1, 3);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-UNIT-7:top")).toBe("deck");
    expect(s.players.player1.power).toHaveLength(1);
  });

  it("RS-511: 【マンタンガン・ロッドモード】自軍パワーが敵軍と同じ枚数（3対3）なら何もしない（出典: atwiki/page-795「…より少なければ」）", () => {
    const s = enterGreen(3, 3);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.power).toHaveLength(3);
    expect(zoneOf(s, "player1", "RS-511:me")).toBe("battle");
  });

  it("RS-511: 【マンタンガン・ロッドモード】1番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-795・R-CN-02）", () => {
    const s = enterGreen(1, 3, 1);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.power).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-512 ゴーオンブラック", () => {
  const TEXT = "【マンタンガン】敵軍パワーゾーンのオモテ向きのカードから1枚選んでもよい。そうしたとき、選んだカードをウラ返してダメージにする。";

  it("RS-512: カタログ本文・スペックが出典と一致（出典: atwiki/page-796）", () => {
    expectCatalogText("RS-512", TEXT);
    expectStats("RS-512", {
      name: "ゴーオンブラック",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 4,
      features: ["ブラック", "男", "警察"],
    });
  });

  const enterBlack = (pos = 4, enemyPower: CardInstance[] = [...damageCards(1, "ed"), ...powerCards(2, "ep")]) =>
    enterAt("RS-512", pos, {}, { power: enemyPower, damage: enemyPower.filter((c) => c.faceDown).length });

  it("RS-512: 【マンタンガン】4番目に出て NC が成立すると、敵軍パワーゾーンのオモテ向きのカードだけを選べる（出典: atwiki/page-796「敵軍パワーゾーンのオモテ向きのカードから1枚選んでもよい」）", () => {
    const s = enterBlack();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-512");
    expect(choiceIds(s)).toEqual(["TST-P:ep0", "TST-P:ep1"]);
  });

  it("RS-512: 【マンタンガン】選んだカードをウラ返してダメージにする（敵軍ダメージ1→2）（出典: atwiki/page-796「選んだカードをウラ返してダメージにする」）", () => {
    const s = resolveAll(pick(enterBlack(), "TST-P:ep1"));
    expect(cardIn(s, "player2", "TST-P:ep1")?.faceDown).toBe(true);
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
    expect(s.players.player2.damage).toBe(2);
  });

  it("RS-512: 【マンタンガン】「選んでもよい」— 見送れる（出典: atwiki/page-796）", () => {
    let s = enterBlack();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-512: 【マンタンガン】敵軍パワーゾーンにオモテ向きのカードがなければ何も起きない（出典: atwiki/page-796）", () => {
    const s = resolveAll(enterBlack(4, damageCards(2, "ed")));
    expect(s.players.player2.damage).toBe(2);
    expect(s.players.player2.power.every((c) => c.faceDown)).toBe(true);
  });

  it("RS-512: 【マンタンガン】1番目に出たとき（NC 不成立）は発動しない（出典: atwiki/page-796・R-CN-02）", () => {
    const s = resolveAll(enterBlack(1));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-513 無敵将軍", () => {
  const TEXT =
    "合体－レッドサルダー+ホワイトカーク+ブルーロウガン+イエロークマード+ブラックガンマー 【将軍花吹雪】これをラッシュしたとき、敵軍ユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む）をすべて持ち主の山札に戻してシャッフルする。";
  // 「※これは「レッドサルダー」としてつかえる」等のニンジャ5人（RS-455〜RS-459）。
  const NINJAS = ["RS-457", "RS-458", "RS-456", "RS-459", "RS-455"];

  it("RS-513: カタログ本文・スペックが出典と一致（出典: atwiki/page-812）", () => {
    expectCatalogText("RS-513", TEXT);
    expectStats("RS-513", {
      name: "無敵将軍",
      category: "MA",
      size: "L",
      bp: 17000,
      sp: 2,
      powerCost: "7+",
      features: ["人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const rushShogun = (
    ninjas: string[] = NINJAS,
    power = 7,
    p2: Partial<GameState["players"]["player2"]> = {},
    p1: Partial<GameState["players"]["player1"]> = {},
  ) => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-513", "sg")], rush: ninjas.map((id, i) => inst(id, `n${i}`)), command: releasedCat("MA", 1), power: powerCards(power), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });
    return { s, r: rushFromHand(s, "player1", "RS-513:sg") };
  };

  it("RS-513: 追加条件（合体）— レッドサルダー〜ブラックガンマー（として使えるニンジャ5人）を捨札にしてラッシュできる（出典: atwiki/page-812「合体－…」「追加条件：自軍合体ユニットを捨札にする」・R-ADD-06）", () => {
    const { r } = rushShogun(NINJAS, 7, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(r.ok).toBe(true);
    const t = r.state;
    expect(zoneOf(t, "player1", "RS-513:sg")).toBe("rush");
    for (let i = 0; i < 5; i++) expect(zoneOf(t, "player1", `${NINJAS[i]}:n${i}`)).toBe("discard");
  });

  it("RS-513: 追加条件 — 合体ユニットが1体でも欠けていればラッシュできない（出典: atwiki/page-812・R-ADD-06「すべて自軍エリアから捨札にする」）", () => {
    const { s } = rushShogun(NINJAS.slice(0, 4));
    expect(canStartRush(s, "player1", "RS-513:sg")).toBe(false);
  });

  it("RS-513: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-812「必要パワー：7+」）", () => {
    const { s } = rushShogun(NINJAS, 6);
    expect(canStartRush(s, "player1", "RS-513:sg")).toBe(false);
  });

  const stacked = (id: string, suffix: string, under: CardInstance[]): CardInstance => ({ ...inst(id, suffix), stackedCards: under });

  it("RS-513: 【将軍花吹雪】ラッシュしたとき、敵軍ユニットの下に重ねたカード（ビークルを含む）をすべて持ち主の山札に戻す（ユニット自身は残る）（出典: atwiki/page-812「敵軍ユニットの下に重ねたカード（ユニットやビークルとして扱われているものも含む）をすべて持ち主の山札に戻してシャッフルする」）", () => {
    const { r } = rushShogun(NINJAS, 7, {
      battle: [stacked("TST-UNIT-0", "e1", [inst("RK-058", "u1")])],
      rush: [stacked("TST-UNIT-2", "e2", [inst("TST-OP", "u2")])],
    });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("rush");
    expect(cardIn(t, "player2", "TST-UNIT-0:e1")?.stackedCards ?? []).toEqual([]);
    expect(cardIn(t, "player2", "TST-UNIT-2:e2")?.stackedCards ?? []).toEqual([]);
    expect(zoneOf(t, "player2", "RK-058:u1")).toBe("deck");
    expect(zoneOf(t, "player2", "TST-OP:u2")).toBe("deck");
    expect(t.players.player2.deck).toHaveLength(5);
  });

  it("RS-513: 【将軍花吹雪】下に重ねたカードがなければ、敵軍ユニットは場に残る（出典: atwiki/page-812「敵軍ユニットの下に重ねたカード」）", () => {
    const { r } = rushShogun(NINJAS, 7, { battle: [inst("TST-UNIT-0", "e1")] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(t.players.player2.deck).toHaveLength(3);
  });

  it("RS-513: 【将軍花吹雪】自軍ユニットの下に重ねたカードは戻さない（出典: atwiki/page-812「敵軍ユニットの下に」）", () => {
    const { r } = rushShogun(NINJAS, 7, {}, { battle: [stacked("TST-UNIT-0", "own", [inst("RK-058", "ou")])] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(cardIn(t, "player1", "TST-UNIT-0:own")?.stackedCards?.map((c) => c.instanceId)).toEqual(["RK-058:ou"]);
  });

  it("RS-513: 【将軍花吹雪】「ラッシュしたとき」— ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-812「これをラッシュしたとき」）", () => {
    const s = enter(
      st({ player1: { rush: [inst("RS-513", "sg")], deck: deckCards(3) }, player2: { battle: [stacked("TST-UNIT-0", "e1", [inst("RK-058", "u1")])], deck: deckCards(3, "e") } }),
      "RS-513:sg",
    );
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(cardIn(s, "player2", "TST-UNIT-0:e1")?.stackedCards?.map((c) => c.instanceId)).toEqual(["RK-058:u1"]);
  });
});

// ===========================================================================
describe("RS-514 ゲキトージャウルフ", () => {
  const TEXT =
    "合体－ゲキバイオレットまたはゲキウルフ+ゲキレッドまたはゲキタイガー+ゲキブルーまたはゲキジャガー ※このカードの追加条件は、自軍捨札が7枚以上のとき、次のように変更される⇒自軍「ゲキバイオレット」1体を捨札にする。 【大狼狼蹴】これがストライクして、相手が山札の上からひいたカードをダメージにしたとき、相手は自分自身のユニットを1体選び撃破する。";

  it("RS-514: カタログ本文・スペックが出典と一致（出典: atwiki/page-779）", () => {
    expectCatalogText("RS-514", TEXT);
    expectStats("RS-514", {
      name: "ゲキトージャウルフ",
      category: "WB",
      size: "L",
      bp: 10000,
      sp: 1,
      powerCost: "6+",
      features: ["激気", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const mk = (rush: CardInstance[], discard = 0, power = 6) =>
    st({ phase: "rush", player1: { hand: [inst("RS-514", "w")], rush, discard: deckCards(discard, "dd"), command: releasedCat("WB", 1), power: powerCards(power), deck: deckCards(3) } });

  it("RS-514: 追加条件（合体）— ゲキバイオレット＋ゲキレッド＋ゲキブルーを捨札にしてラッシュできる（出典: atwiki/page-779「合体－ゲキバイオレットまたはゲキウルフ+ゲキレッドまたはゲキタイガー+ゲキブルーまたはゲキジャガー」）", () => {
    const r = rushFromHand(mk([inst("RS-499", "v"), inst("RS-340", "r"), inst("RS-341", "b")]), "player1", "RS-514:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-514:w")).toBe("rush");
    for (const x of ["RS-499:v", "RS-340:r", "RS-341:b"]) expect(zoneOf(r.state, "player1", x)).toBe("discard");
  });

  it("RS-514: 追加条件（合体）—「または」の側（ゲキウルフ＋ゲキタイガー＋ゲキジャガー）でもラッシュできる（出典: atwiki/page-779）", () => {
    const r = rushFromHand(mk([inst("RS-498", "w2"), inst("RS-423", "t"), inst("RS-425", "j")]), "player1", "RS-514:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-514:w")).toBe("rush");
  });

  it("RS-514: 追加条件 — 自軍捨札が6枚なら変更されず、ゲキバイオレットだけではラッシュできない（出典: atwiki/page-779「自軍捨札が7枚以上のとき」）", () => {
    expect(canStartRush(mk([inst("RS-499", "v")], 6), "player1", "RS-514:w")).toBe(false);
  });

  it("RS-514: ※ 自軍捨札が7枚以上なら、追加条件は「自軍「ゲキバイオレット」1体を捨札にする」に変わり、ゲキバイオレットだけでラッシュできる（出典: atwiki/page-779「次のように変更される⇒自軍「ゲキバイオレット」1体を捨札にする」）", () => {
    const r = rushFromHand(mk([inst("RS-499", "v")], 7), "player1", "RS-514:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-514:w")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-499:v")).toBe("discard");
  });

  it("RS-514: ※ 変更後はゲキバイオレット1体だけを捨札にする（合体の他のユニットは捨札にならない）（出典: atwiki/page-779「次のように変更される」）", () => {
    const r = rushFromHand(mk([inst("RS-499", "v"), inst("RS-340", "r"), inst("RS-341", "b")], 7), "player1", "RS-514:w");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-499:v")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-340:r")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-341:b")).toBe("rush");
  });

  it("RS-514: ※ 変更後も「ゲキバイオレット」が必要 — 捨札7枚でもゲキウルフだけではラッシュできない（出典: atwiki/page-779「自軍「ゲキバイオレット」1体」）", () => {
    expect(canStartRush(mk([inst("RS-498", "w2")], 7), "player1", "RS-514:w")).toBe(false);
  });

  /** ゲキトージャウルフを出してストライクする（敵軍パワー enemyPower、敵軍ユニット: バトル e1・ラッシュ e2）。 */
  const strikeWolf = (enemyPower: CardInstance[]) => {
    const s = st({
      player1: { rush: [inst("RS-514", "w")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("TST-UNIT-2", "e2")], power: enemyPower, deck: [inst("TST-OP", "top"), ...deckCards(4, "e")] },
    });
    let t = strike(enter(s, "RS-514:w"), "RS-514:w");
    // 相手のダメージ支払い（オモテ向きのカードがあれば先頭を選ぶ）
    for (let i = 0; i < 6 && t.pendingDamagePayment; i++) {
      const pay = legal(t).find((a) => a.type === "resolve_damage_payment");
      if (!pay) break;
      t = act(t, pay);
    }
    return t;
  };

  it("RS-514: 【大狼狼蹴】ストライクして、相手が山札の上からひいたカードをダメージにしたとき、相手は自分のユニットを1体選び撃破する（出典: atwiki/page-779「相手は自分自身のユニットを1体選び撃破する」）", () => {
    let t = settle(strikeWolf([]));
    expect(zoneOf(t, "player2", "TST-OP:top")).toBe("power");
    expect(t.pendingEffectChoice?.sourceCardId).toBe("RS-514");
    expect(t.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(t)).toEqual(["TST-UNIT-0:e1", "TST-UNIT-2:e2"]);
    t = resolveAll(pick(t, "TST-UNIT-2:e2"));
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("discard");
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });

  it("RS-514: 【大狼狼蹴】相手がオモテ向きのパワーをウラ返してダメージにしたとき（山札からひいていない）は撃破されない（出典: atwiki/page-779「相手が山札の上からひいたカードをダメージにしたとき」・R-DMG-02）", () => {
    const t = resolveAll(strikeWolf(powerCards(2, "ep")));
    expect(t.players.player2.damage).toBe(1);
    expect(zoneOf(t, "player2", "TST-OP:top")).toBe("deck");
    expect(zoneOf(t, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(zoneOf(t, "player2", "TST-UNIT-2:e2")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-515 エンジンオー", () => {
  // atwiki 本文（コメント欄の「現物を確認したところ…「次の効果を発動できる」だったので修正しました」の修正後）。
  const TEXT =
    "合体―スピードル＋バスオン＋ベアールV 【ゴーオンソード】自軍ターン中、これがバトルエリアに出たとき、次の効果を発動できる。 お互いに山札の上から1枚をオモテにし、必要パワーの数字を比べる勝負を2回繰り返す。数字の大きい方を勝ちとして、自分が2回連続で勝ったなら、このターン、これは「SP3」になる。2回連続で負けたなら、これは撃破される。その後、オモテにしたカードは、好きな順番で持ち主の山札の下に戻す。";

  it("RS-515: カタログ本文・スペックが出典と一致（出典: atwiki/page-760）", () => {
    expectCatalogText("RS-515", TEXT);
    expectStats("RS-515", {
      name: "エンジンオー",
      category: "OT",
      size: "L",
      bp: 13000,
      sp: 1,
      powerCost: "7+",
      features: ["人型", "炎神"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const mkRush = (rush: CardInstance[], power = 7) =>
    st({ phase: "rush", player1: { hand: [inst("RS-515", "e")], rush, command: releasedCat("OT", 1), power: powerCards(power), deck: deckCards(3) } });

  it("RS-515: 追加条件（合体）— スピードル＋バスオン＋ベアールV を捨札にしてラッシュできる（出典: atwiki/page-760「合体―スピードル＋バスオン＋ベアールV」・R-ADD-06）", () => {
    const r = rushFromHand(mkRush([inst("RS-505", "a"), inst("RS-506", "b"), inst("RS-507", "c")]), "player1", "RS-515:e");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-515:e")).toBe("rush");
    for (const x of ["RS-505:a", "RS-506:b", "RS-507:c"]) expect(zoneOf(r.state, "player1", x)).toBe("discard");
  });

  it("RS-515: 追加条件 — 1体欠けていればラッシュできず、パワー6でもラッシュできない（出典: atwiki/page-760「必要パワー：7+」・R-ADD-06）", () => {
    expect(canStartRush(mkRush([inst("RS-505", "a"), inst("RS-506", "b")]), "player1", "RS-515:e")).toBe(false);
    expect(canStartRush(mkRush([inst("RS-505", "a"), inst("RS-506", "b"), inst("RS-507", "c")], 6), "player1", "RS-515:e")).toBe(false);
  });

  /** 自軍バトルフェイズにエンジンオーを出す。own / enemy は山札の上2枚（必要パワーを比べる）。 */
  const enterEngine = (own: string[], enemy: string[]) =>
    enter(
      st({
        player1: { rush: [inst("RS-515", "e")], deck: [...own.map((id, i) => inst(id, `o${i}`)), ...deckCards(2, "od")] },
        player2: { deck: [...enemy.map((id, i) => inst(id, `x${i}`)), ...deckCards(2, "xd")] },
      }),
      "RS-515:e",
    );
  /** 【ゴーオンソード】の選択（発動する／順番）があれば先頭で進める。 */
  const go = (s: GameState) => resolveAll(s);

  it("RS-515: 【ゴーオンソード】自分が2回連続で勝つ（7 対 0 を2回）と、このターン「SP3」になる（出典: atwiki/page-760「自分が2回連続で勝ったなら、このターン、これは「SP3」になる」）", () => {
    const s = go(enterEngine(["TST-UNIT-7", "TST-UNIT-7"], ["TST-UNIT-0", "TST-UNIT-0"]));
    expect(spOf(s, "player1", "RS-515:e")).toBe(3);
  });

  it("RS-515: 【ゴーオンソード】2回連続で負ける（0 対 7 を2回）と、これは撃破される（出典: atwiki/page-760「2回連続で負けたなら、これは撃破される」）", () => {
    const s = go(enterEngine(["TST-UNIT-0", "TST-UNIT-0"], ["TST-UNIT-7", "TST-UNIT-7"]));
    expect(zoneOf(s, "player1", "RS-515:e")).toBe("discard");
  });

  it("RS-515: 【ゴーオンソード】1勝1敗なら SP3 にも撃破にもならない（SP1 のまま）（出典: atwiki/page-760「2回連続で」）", () => {
    const s = go(enterEngine(["TST-UNIT-7", "TST-UNIT-0"], ["TST-UNIT-0", "TST-UNIT-7"]));
    expect(zoneOf(s, "player1", "RS-515:e")).toBe("battle");
    expect(spOf(s, "player1", "RS-515:e")).toBe(1);
  });

  it("RS-515: 【ゴーオンソード】同じ数字（引き分け）は勝ちではない — 2回とも同じなら SP1 のまま（出典: atwiki/page-760「数字の大きい方を勝ちとして」）", () => {
    const s = go(enterEngine(["TST-UNIT-2", "TST-UNIT-2"], ["TST-UNIT-2", "TST-UNIT-2"]));
    expect(zoneOf(s, "player1", "RS-515:e")).toBe("battle");
    expect(spOf(s, "player1", "RS-515:e")).toBe(1);
  });

  it("RS-515: 【ゴーオンソード】オモテにしたカードは持ち主の山札の下に戻る（出典: atwiki/page-760「その後、オモテにしたカードは、好きな順番で持ち主の山札の下に戻す」）", () => {
    const s = go(enterEngine(["TST-UNIT-2", "TST-UNIT-0"], ["TST-UNIT-0", "TST-UNIT-2"]));
    const own = s.players.player1.deck.map((c) => c.instanceId);
    const enemy = s.players.player2.deck.map((c) => c.instanceId);
    expect(own.slice(0, 2)).toEqual(["TST-OP:od0", "TST-OP:od1"]);
    expect(own.slice(2).sort()).toEqual(["TST-UNIT-0:o1", "TST-UNIT-2:o0"]);
    expect(enemy.slice(0, 2)).toEqual(["TST-OP:xd0", "TST-OP:xd1"]);
    expect(enemy.slice(2).sort()).toEqual(["TST-UNIT-0:x0", "TST-UNIT-2:x1"]);
  });

  it("RS-515: 【ゴーオンソード】「発動できる」— 発動しないことを選べ、そのとき山札は動かない（出典: atwiki/page-760「次の効果を発動できる」・atwiki コメント「…「次の効果を発動できる」だったので修正しました」）", () => {
    let s = enterEngine(["TST-UNIT-7", "TST-UNIT-7"], ["TST-UNIT-0", "TST-UNIT-0"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-515");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-UNIT-7:o0");
    expect(spOf(s, "player1", "RS-515:e")).toBe(1);
  });

  it("RS-515: 【ゴーオンソード】「自軍ターン中」— 敵軍ターン中に効果でバトルエリアに出たときは発動せず、山札も動かない（出典: atwiki/page-760「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = enterBattleByEffect(
      st({
        activePlayer: "player2",
        player1: { rush: [inst("RS-515", "e")], deck: [inst("TST-UNIT-0", "o0"), inst("TST-UNIT-0", "o1")] },
        player2: { deck: [inst("TST-UNIT-7", "x0"), inst("TST-UNIT-7", "x1")] },
      }),
      "player1",
      "RS-515:e",
    );
    expect(zoneOf(s, "player1", "RS-515:e")).toBe("battle");
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["TST-UNIT-0:o0", "TST-UNIT-0:o1"]);
  });
});
