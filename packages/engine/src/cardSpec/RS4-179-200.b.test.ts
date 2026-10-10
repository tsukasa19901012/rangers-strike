/**
 * カード別スペック: RS-188〜RS-193（第4弾「四雄の覚醒」アチャとコチャ／ゴレンジャー／ダイナマン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4（RS-191 の Q）、grnrngr/faq-rider-2（RS-191 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-01〜07 ナンバーコンビネーション、R-STK-02 SP「！」等）
 * CN を持つユニットの【効果】はナンバーコンビネーション（NC）の効果で、バトルエリアに出たときの並び順が CN と一致したときだけ発動する（R-CN-02）。
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canStrike,
  cardIn,
  damagedPower,
  declineEffect,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legalOfType,
  lineUp,
  pickEffect,
  powerCards,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  substitutes,
  useNinja,
  zoneOf,
} from "./RS4-179-200.helpers";
import type { CardInstance, GameState } from "../types/game";

const fillIds = (n: number) => Array.from({ length: n }, (_, i) => `TST-UNIT-0:fill${i}`);

/** 自軍バトルフェイズ：fillers を before 体並べてから unit を出した直後（pendingBattleEntry）。 */
function atPosition(
  unit: CardInstance,
  before: number,
  p2: Partial<GameState["players"]["player2"]> = {},
  p1: Partial<GameState["players"]["player1"]> = {},
  extra: Parameters<typeof st>[1] = [],
): GameState {
  let s = st(
    {
      turn: 3,
      player1: { rush: [...fillers(before), unit], deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    extra,
  );
  s = lineUp(s, fillIds(before));
  return enter(s, unit.instanceId);
}

// ===========================================================================
describe("RS-188 アチャとコチャ", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍パワーゾーンのカードが7枚以上なら、6枚になるまでダメージ以外のカードを捨札にする。【地球征服宣告書】これが自軍エリアにある間、自軍パワーゾーンのカードが12枚以上あれば、特徴「メカ」を持つすべての自軍Sユニットは「SP1」になる。";
  const MEKA_S = sUnit("SPEC-MEKA-S", { features: ["メカ"], sp: undefined, bp: 1000 });
  const PLAIN_S = sUnit("SPEC-PLAIN-S", { features: ["男"], sp: undefined, bp: 1000 });

  function rushAcha(power: CardInstance[]): GameState {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-188", "a")], command: releasedN(1, "TST-OP-DA"), power, damage: power.filter((c) => c.faceDown).length },
    });
    const r = rushFromHand(s, "player1", "RS-188:a");
    expect(r.ok).toBe(true);
    return r.state;
  }

  it("RS-188: カタログ本文・スペックが出典と一致（出典: atwiki/page-121）", () => {
    expectCatalogText("RS-188", TEXT);
    expectStats("RS-188", {
      name: "アチャとコチャ",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      features: ["メカ", "人型"],
    });
  });

  // 「※これをラッシュしたとき、自軍パワーゾーンのカードが7枚以上なら、6枚になるまでダメージ以外のカードを捨札にする」
  it("RS-188: ※ ラッシュしたときパワーゾーンが8枚なら、ダメージ以外のカードを2枚捨札にして6枚にする（ダメージは捨てられない）（出典: atwiki/page-121）", () => {
    let s = rushAcha([...powerCards(7), ...damagedPower(1)]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("TST-P:dmg0");
    s = pickEffect(s, "player1", ["TST-P:pw0", "TST-P:pw1"]);
    expect(s.players.player1.power).toHaveLength(6);
    expect(s.players.player1.discard.map((c) => c.instanceId).sort()).toEqual(["TST-P:pw0", "TST-P:pw1"]);
    expect(s.players.player1.power.some((c) => c.instanceId === "TST-P:dmg0")).toBe(true);
    expect(s.players.player1.damage).toBe(1);
  });

  it("RS-188: ※ パワーゾーンが6枚以下なら何も捨てない（出典: atwiki/page-121「7枚以上なら」）", () => {
    const s = rushAcha(powerCards(6));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.power).toHaveLength(6);
    expect(s.players.player1.discard).toHaveLength(0);
  });

  it("RS-188: ※ ちょうど7枚なら1枚捨てて6枚にする（出典: atwiki/page-121「7枚以上なら、6枚になるまで」）", () => {
    let s = rushAcha(powerCards(7));
    s = pickEffect(s, "player1", ["TST-P:pw3"]);
    expect(s.players.player1.power).toHaveLength(6);
    expect(zoneOf(s, "player1", "TST-P:pw3")).toBe("discard");
  });

  // 「【地球征服宣告書】これが自軍エリアにある間、自軍パワーゾーンのカードが12枚以上あれば、特徴「メカ」を持つすべての自軍Sユニットは「SP1」になる」
  // 既知の不具合: CARD-RS-188 【地球征服宣告書】が未実装（パワーゾーン12枚以上でも「メカ」の S ユニットが SP1 にならない）
  it.fails("RS-188: パワーゾーン12枚以上なら、「メカ」の自軍 S ユニット（SP 空欄）が SP1 になりストライクできる（出典: atwiki/page-121）", () => {
    let s = st(
      { turn: 3, player1: { rush: [inst("RS-188", "a"), inst("SPEC-MEKA-S", "mk")], power: powerCards(12), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } },
      [MEKA_S],
    );
    s = enter(s, "SPEC-MEKA-S:mk");
    expect(canStrike(s, "SPEC-MEKA-S:mk")).toBe(true);
    s = settle(strike(s, "SPEC-MEKA-S:mk"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 既知の不具合: CARD-RS-188 【地球征服宣告書】が未実装（パワーゾーン12枚以上でも「メカ」の S ユニットが SP1 にならない）
  it.fails("RS-188: アチャとコチャ自身も「メカ」の S ユニットなので SP1 になる（出典: atwiki/page-121「すべての自軍Sユニット」）", () => {
    let s = st({ turn: 3, player1: { rush: [inst("RS-188", "a")], power: powerCards(12), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = enter(s, "RS-188:a");
    expect(canStrike(s, "RS-188:a")).toBe(true);
  });

  // 既知の不具合: CARD-RS-188 【地球征服宣告書】が未実装（パワーゾーン12枚以上でも「メカ」の S ユニットが SP1 にならない）
  it.fails("RS-188: パワーゾーン11枚では SP1 にならずストライクできない（12枚ならできる）（出典: atwiki/page-121「12枚以上あれば」）", () => {
    const mk = (n: number) =>
      enter(
        st({ turn: 3, player1: { rush: [inst("RS-188", "a"), inst("SPEC-MEKA-S", "mk")], power: powerCards(n), deck: deckCards(3) } }, [MEKA_S]),
        "SPEC-MEKA-S:mk",
      );
    expect(canStrike(mk(11), "SPEC-MEKA-S:mk")).toBe(false);
    expect(canStrike(mk(12), "SPEC-MEKA-S:mk")).toBe(true);
  });

  // 既知の不具合: CARD-RS-188 【地球征服宣告書】が未実装（パワーゾーン12枚以上でも「メカ」の S ユニットが SP1 にならない）
  it.fails("RS-188: 「メカ」を持たない S ユニット・敵軍の「メカ」S ユニットは SP1 にならない（同じ状況の自軍「メカ」S はなる）（出典: atwiki/page-121「特徴「メカ」を持つすべての自軍Sユニット」）", () => {
    let m = st(
      { turn: 3, player1: { rush: [inst("RS-188", "a"), inst("SPEC-MEKA-S", "mk")], power: powerCards(12), deck: deckCards(3) } },
      [MEKA_S],
    );
    m = enter(m, "SPEC-MEKA-S:mk");
    expect(canStrike(m, "SPEC-MEKA-S:mk")).toBe(true);
    let s = st(
      {
        turn: 3,
        player1: { rush: [inst("RS-188", "a"), inst("SPEC-PLAIN-S", "pl")], power: powerCards(12), deck: deckCards(3) },
        player2: { rush: [inst("SPEC-MEKA-S", "emk")], power: powerCards(3, "ep"), deck: deckCards(3, "e") },
      },
      [MEKA_S, PLAIN_S],
    );
    s = enter(s, "SPEC-PLAIN-S:pl");
    expect(canStrike(s, "SPEC-PLAIN-S:pl")).toBe(false);
    // 敵軍側から見ても（敵軍ターン）SP1 にならない
    let e = st(
      {
        turn: 4,
        activePlayer: "player2",
        player1: { rush: [inst("RS-188", "a")], power: powerCards(12), deck: deckCards(3) },
        player2: { rush: [inst("SPEC-MEKA-S", "emk")], deck: deckCards(3, "e") },
      },
      [MEKA_S],
    );
    e = enter(e, "SPEC-MEKA-S:emk", "player2");
    expect(canStrike(e, "SPEC-MEKA-S:emk", "player2")).toBe(false);
  });

  // 既知の不具合: CARD-RS-188 【地球征服宣告書】が未実装（パワーゾーン12枚以上でも「メカ」の S ユニットが SP1 にならない）
  it.fails("RS-188: アチャとコチャが自軍エリアになければ（捨札にあっても）SP1 にならない（ラッシュエリアにあればなる）（出典: atwiki/page-121「これが自軍エリアにある間」）", () => {
    let m = st(
      { turn: 3, player1: { rush: [inst("RS-188", "a"), inst("SPEC-MEKA-S", "mk")], power: powerCards(12), deck: deckCards(3) } },
      [MEKA_S],
    );
    m = enter(m, "SPEC-MEKA-S:mk");
    expect(canStrike(m, "SPEC-MEKA-S:mk")).toBe(true);
    let s = st(
      { turn: 3, player1: { rush: [inst("SPEC-MEKA-S", "mk")], discard: [inst("RS-188", "a")], power: powerCards(12), deck: deckCards(3) } },
      [MEKA_S],
    );
    s = enter(s, "SPEC-MEKA-S:mk");
    expect(canStrike(s, "SPEC-MEKA-S:mk")).toBe(false);
  });
});

// ===========================================================================
describe("RS-189 キレンジャー", () => {
  const TEXT =
    "【キーステッカー】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。（この効果は特徴「ピンク」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";
  const PINK_S = sUnit("SPEC-PINK-S", { features: ["ピンク"], bp: 1000 });
  /** 敵軍：カレー（自軍の「イエロー」S が BP+2000）で BP5000 になったキレンジャー。 */
  const boostedEnemy = { operation: [inst("RS-179", "cur")], battle: [inst("RS-189", "ek")] };

  it("RS-189: カタログ本文・スペックが出典と一致（出典: atwiki/page-391）", () => {
    expectCatalogText("RS-189", TEXT);
    expectStats("RS-189", {
      name: "キレンジャー",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 2,
      features: ["イエロー", "男"],
    });
  });

  // 「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
  it("RS-189: NC（2番目）— アタックするとき敵軍ユニットの BP を本来の値（3000）としてバトルし、相打ちになる（出典: atwiki/page-391）", () => {
    let s = atPosition(inst("RS-189", "k"), 1, boostedEnemy);
    expect(bpOf(s, "player2", "RS-189:ek")).toBe(5000);
    s = settle(attack(s, "RS-189:k", "RS-189:ek"));
    expect(zoneOf(s, "player2", "RS-189:ek")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-189:k")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-189 【キーステッカー】が NC の成立に関係なく（1番目でも、ピンク以外からの3番目でも）発動する
  it.fails("RS-189: NC が成立していない（1番目）ときは修正後の BP（5000）でバトルし、キレンジャーが負ける（出典: atwiki/page-391・R-CN-02）", () => {
    let s = atPosition(inst("RS-189", "k"), 0, boostedEnemy);
    s = settle(attack(s, "RS-189:k", "RS-189:ek"));
    expect(zoneOf(s, "player1", "RS-189:k")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-189:ek")).toBe("battle");
  });

  // 「（この効果は特徴「ピンク」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」
  it("RS-189: 「ピンク」のユニットからコンビネーションするときは3番目でも発動する（出典: atwiki/page-391）", () => {
    let s = st(
      {
        turn: 3,
        player1: { rush: [inst("TST-UNIT-0", "f"), inst("SPEC-PINK-S", "pk"), inst("RS-189", "k")], deck: deckCards(3) },
        player2: { ...boostedEnemy, deck: deckCards(3, "e") },
      },
      [PINK_S],
    );
    s = lineUp(s, ["TST-UNIT-0:f", "SPEC-PINK-S:pk"]);
    s = enter(s, "RS-189:k");
    s = settle(attack(s, "RS-189:k", "RS-189:ek"));
    expect(zoneOf(s, "player2", "RS-189:ek")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-189 【キーステッカー】が NC の成立に関係なく（1番目でも、ピンク以外からの3番目でも）発動する
  it.fails("RS-189: 「ピンク」でないユニットからの3番目では発動しない（出典: atwiki/page-391）", () => {
    let s = atPosition(inst("RS-189", "k"), 2, boostedEnemy);
    s = settle(attack(s, "RS-189:k", "RS-189:ek"));
    expect(zoneOf(s, "player2", "RS-189:ek")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-189:k")).toBe("discard");
  });

  // 「これがアタックするとき」— 敵軍ユニットにアタックされたバトルには及ばない。
  it("RS-189: NC が成立していても、敵軍ターンにアタックされたバトルでは本来の値にならない（出典: atwiki/page-391「これがアタックするとき」）", () => {
    let s = atPosition(inst("RS-189", "k"), 1, boostedEnemy);
    expect(cardIn(s, "player1", "RS-189:k")).toBeDefined();
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    s = { ...s, activePlayer: "player2", turn: 4 };
    s = settle(attack(s, "RS-189:ek", "RS-189:k", "player2"));
    expect(zoneOf(s, "player1", "RS-189:k")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-189:ek")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-190 ミドレンジャー", () => {
  const TEXT =
    "【ミドメラン】これがアタックするとき、相手はカウンターを発動できない。（この効果は特徴「イエロー」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";
  /** 敵軍：隠流忍術（RS-018）を使える（MA コマンド・パワー4）。 */
  const ninjaEnemy = {
    hand: [inst("RS-018", "nin")],
    command: releasedN(2, "TST-OP-MA", "ec"),
    power: powerCards(4, "ep"),
    battle: [inst("TST-UNIT-0", "d"), inst("TST-UNIT-0", "sub")],
  };

  it("RS-190: カタログ本文・スペックが出典と一致（出典: atwiki/page-392）", () => {
    expectCatalogText("RS-190", TEXT);
    expectStats("RS-190", {
      name: "ミドレンジャー",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 3,
      features: ["グリーン", "男"],
    });
  });

  // 「これがアタックするとき、相手はカウンターを発動できない」
  // 既知の不具合: CARD-RS-190 【ミドメラン】が効かない（NC 成立時も相手が隠流忍術を使える）
  it.fails("RS-190: NC（3番目）— アタックしたとき相手は隠流忍術を使えず、NC 不成立（1番目）なら使える（出典: atwiki/page-392・R-CTR-03）", () => {
    let nc = atPosition(inst("RS-190", "m"), 2, ninjaEnemy);
    nc = attack(nc, "RS-190:m", "TST-UNIT-0:d");
    expect(substitutes(nc, "RS-018:nin")).toHaveLength(0);

    let plain = atPosition(inst("RS-190", "m"), 0, ninjaEnemy);
    plain = attack(plain, "RS-190:m", "TST-UNIT-0:d");
    expect(substitutes(plain, "RS-018:nin")).toContain("TST-UNIT-0:sub");
    plain = settle(useNinja(plain, "RS-018:nin", "TST-UNIT-0:sub"));
    expect(zoneOf(plain, "player2", "TST-UNIT-0:sub")).toBe("discard");
    expect(zoneOf(plain, "player2", "TST-UNIT-0:d")).toBe("battle");
  });

  // 「（この効果は特徴「イエロー」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」
  // 既知の不具合: CARD-RS-190 【ミドメラン】が効かない（NC 成立時も相手が隠流忍術を使える）
  it.fails("RS-190: 「イエロー」のユニット（キレンジャー）からコンビネーションするときは2番目でも発動する（出典: atwiki/page-392）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RS-189", "k"), inst("RS-190", "m")], deck: deckCards(3) },
      player2: { ...ninjaEnemy, deck: deckCards(3, "e") },
    });
    s = lineUp(s, ["RS-189:k"]);
    s = enter(s, "RS-190:m");
    s = attack(s, "RS-190:m", "TST-UNIT-0:d");
    expect(substitutes(s, "RS-018:nin")).toHaveLength(0);
  });

  // 既知の不具合: CARD-RS-190 【ミドメラン】が効かない（NC 成立時も相手が隠流忍術を使える）
  it.fails("RS-190: 「イエロー」でないユニットからの2番目では発動しない（3番目の NC なら発動する）（出典: atwiki/page-392）", () => {
    let s = atPosition(inst("RS-190", "m"), 1, ninjaEnemy);
    s = attack(s, "RS-190:m", "TST-UNIT-0:d");
    expect(substitutes(s, "RS-018:nin")).toContain("TST-UNIT-0:sub");
    let nc = atPosition(inst("RS-190", "m"), 2, ninjaEnemy);
    nc = attack(nc, "RS-190:m", "TST-UNIT-0:d");
    expect(substitutes(nc, "RS-018:nin")).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-191 ダイナレッド", () => {
  const TEXT = "【ダイナ剣・夢の翼】「SP1」これはアタックとストライクを1度ずつ行ってもよい。";

  it("RS-191: カタログ本文・スペックが出典と一致（出典: atwiki/page-393）", () => {
    expectCatalogText("RS-191", TEXT);
    expectStats("RS-191", {
      name: "ダイナレッド",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  // 「「SP1」」
  it("RS-191: NC（5番目）で SP1 になり、ストライクで1点ダメージを与える（出典: atwiki/page-393・R-STK-02）", () => {
    let s = atPosition(inst("RS-191", "r"), 4);
    expect(canStrike(s, "RS-191:r")).toBe(true);
    s = settle(strike(s, "RS-191:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-191: NC 不成立（1番目）では SP「！」のままでストライクできない（出典: atwiki/page-393・R-STK-02）", () => {
    const s = atPosition(inst("RS-191", "r"), 0);
    expect(canStrike(s, "RS-191:r")).toBe(false);
  });

  // 「これはアタックとストライクを1度ずつ行ってもよい」
  // 既知の不具合: CARD-RS-191 「アタックとストライクを1度ずつ」が未実装（SP1 付与のみ。アタック後にストライクできない）
  it.fails("RS-191: NC 成立時、アタックした後にストライクもできる（出典: atwiki/page-393）", () => {
    let s = atPosition(inst("RS-191", "r"), 4, { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "RS-191:r", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player1", "RS-191:r")).toBe("battle");
    expect(canStrike(s, "RS-191:r")).toBe(true);
    s = settle(strike(s, "RS-191:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 既知の不具合: CARD-RS-191 「アタックとストライクを1度ずつ」が未実装（ストライク後にアタックできない）
  it.fails("RS-191: NC 成立時、ストライクした後にアタックもできる（出典: atwiki/page-393）", () => {
    let s = atPosition(inst("RS-191", "r"), 4, { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(strike(s, "RS-191:r"));
    expect(s.players.player2.damage).toBe(1);
    expect(legalOfType(s, "battle").map((a) => a.attackerInstanceId)).toContain("RS-191:r");
  });

  // 既知の不具合: CARD-RS-191 「アタックとストライクを1度ずつ」が未実装（ストライク後のアタックも出ない）
  it.fails("RS-191: 1度ずつまで — ストライクの後はアタックはできるが、2回目のストライクはできない（出典: atwiki/page-393「1度ずつ」）", () => {
    let s = atPosition(inst("RS-191", "r"), 4, { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(strike(s, "RS-191:r"));
    expect(legalOfType(s, "battle").map((a) => a.attackerInstanceId)).toContain("RS-191:r");
    expect(canStrike(s, "RS-191:r")).toBe(false);
  });

  // grnrngr/faq-card-4 RS-191 Q1「ナンバーコンビネーションを発動している時点でSP1になっていますので、SP1以上のユニットとして扱われます。」
  // 既知の不具合: CARD-RS-191 ストライク後にアタックできない（「1度ずつ」未実装）
  it.fails("RS-191: ストライクした後でアタックした帝王アトンは、SP1 以上のユニットとのバトルとして勝っても撃破される（出典: grnrngr/faq-card-4 RS-191 Q1）", () => {
    let s = atPosition(inst("RS-191", "r"), 4, { battle: [inst("RS-198", "aton")] });
    s = settle(strike(s, "RS-191:r"));
    s = settle(attack(s, "RS-191:r", "RS-198:aton"));
    expect(zoneOf(s, "player2", "RS-198:aton")).toBe("discard");
  });

  it("RS-191: NC で SP1 のダイナレッドにアタックされた帝王アトンは、勝っても撃破される（SP1 以上として扱われる）（出典: grnrngr/faq-card-4 RS-191 Q1・R-BTL-03）", () => {
    let s = atPosition(inst("RS-191", "r"), 4, { battle: [inst("RS-198", "aton")] });
    s = settle(attack(s, "RS-191:r", "RS-198:aton"));
    expect(zoneOf(s, "player2", "RS-198:aton")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-191:r")).toBe("discard");
  });

  // grnrngr/faq-rider-2「ナンバーコンビネーションは発動していないため、ストライクの後にアタックすることは出来ない」
  it.todo(
    "RS-191: ゾル大佐の効果で SP1 になった（5番目でない）ダイナレッドはストライクの後にアタックできない（出典: grnrngr/faq-rider-2 RS-191・RS-203 の Q）— 大帝ラー・デウスの【デウス遺伝子】で特徴「戦闘員」を追加する状況を公開 API で組めず、さらにエンジンは NC 成立時の「1度ずつ」自体が未実装のため対比が成立しない",
  );
});

// ===========================================================================
describe("RS-192 ダイナブルー", () => {
  const TEXT = "【アタックボード】自分がターンを終えるとき、このユニットがバトルエリアにあればラッシュエリアに戻してもよい。";

  it("RS-192: カタログ本文・スペックが出典と一致（出典: atwiki/page-394）", () => {
    expectCatalogText("RS-192", TEXT);
    expectStats("RS-192", {
      name: "ダイナブルー",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  // 「自分がターンを終えるとき、このユニットがバトルエリアにあればラッシュエリアに戻してもよい」
  it("RS-192: NC（3番目）— 自分がターンを終えるとき、バトルエリアにあればラッシュエリアに戻せる（出典: atwiki/page-394）", () => {
    let s = atPosition(inst("RS-192", "b"), 2);
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    s = act(s, { type: "end_phase", playerId: "player1" });
    s = pickEffect(s, "player1");
    expect(zoneOf(s, "player1", "RS-192:b")).toBe("rush");
  });

  // 「戻してもよい」
  it("RS-192: 戻すかは任意 — 選択が出て、断ればバトルエリアに残る（出典: atwiki/page-394「戻してもよい」）", () => {
    let s = atPosition(inst("RS-192", "b"), 2);
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-192");
    s = declineEffect(s, "player1");
    expect(zoneOf(s, "player1", "RS-192:b")).toBe("battle");
  });

  it("RS-192: NC 不成立（1番目）なら戻せない（NC 成立なら戻せる）（出典: atwiki/page-394・R-CN-02）", () => {
    let plain = atPosition(inst("RS-192", "b"), 0);
    plain = act(plain, { type: "pass_battle_entry", playerId: "player1" });
    plain = pickEffect(act(plain, { type: "end_phase", playerId: "player1" }), "player1");
    expect(zoneOf(plain, "player1", "RS-192:b")).toBe("battle");
    let nc = atPosition(inst("RS-192", "b"), 2);
    nc = act(nc, { type: "pass_battle_entry", playerId: "player1" });
    nc = pickEffect(act(nc, { type: "end_phase", playerId: "player1" }), "player1");
    expect(zoneOf(nc, "player1", "RS-192:b")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-193 ダイナピンク", () => {
  const TEXT =
    "【フラワーカーニバル】敵軍コマンドゾーンのリリース状態のカードをすべて持ち主の手札に戻す。その後、自分がターンを終えるとき、相手は自分自身の手札から好きな枚数を自分自身のコマンドゾーンに置く。";
  const enemyCmd = { command: [...releasedN(2, "TST-OP", "er"), held("TST-OP", "eh")] };

  it("RS-193: カタログ本文・スペックが出典と一致（出典: atwiki/page-395）", () => {
    expectCatalogText("RS-193", TEXT);
    expectStats("RS-193", {
      name: "ダイナピンク",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 0,
      comboNumber: 2,
      features: ["ピンク", "女"],
    });
  });

  // 「敵軍コマンドゾーンのリリース状態のカードをすべて持ち主の手札に戻す」
  it("RS-193: NC（2番目）— 敵軍コマンドゾーンのリリース状態のカードをすべて手札に戻す（ホールド状態は残る）（出典: atwiki/page-395）", () => {
    const s = atPosition(inst("RS-193", "p"), 1, enemyCmd);
    expect(s.players.player2.hand.map((c) => c.instanceId).sort()).toEqual(["TST-OP:er0", "TST-OP:er1"]);
    expect(s.players.player2.command.map((c) => c.instanceId)).toEqual(["TST-OP:eh"]);
  });

  // 「その後、自分がターンを終えるとき、相手は自分自身の手札から好きな枚数を自分自身のコマンドゾーンに置く」
  it("RS-193: 自分がターンを終えるとき、相手は手札から好きな枚数（1枚だけでもよい）をコマンドゾーンに置く（出典: atwiki/page-395）", () => {
    let s = atPosition(inst("RS-193", "p"), 1, enemyCmd);
    expect(s.players.player2.hand).toHaveLength(2);
    s = act(s, { type: "pass_battle_entry", playerId: "player1" });
    s = act(s, { type: "end_phase", playerId: "player1" });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:er0" });
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player2"; i++) s = declineEffect(s, "player2");
    expect(zoneOf(s, "player2", "TST-OP:er0")).toBe("command");
    expect(zoneOf(s, "player2", "TST-OP:er1")).toBe("hand");
  });

  it("RS-193: NC 不成立（1番目）ならコマンドは戻らない（NC 成立なら戻る）（出典: atwiki/page-395・R-CN-02）", () => {
    const plain = atPosition(inst("RS-193", "p"), 0, enemyCmd);
    expect(plain.players.player2.command).toHaveLength(3);
    const nc = atPosition(inst("RS-193", "p"), 1, enemyCmd);
    expect(nc.players.player2.command).toHaveLength(1);
  });
});
