/**
 * カード別スペック: RS-333〜RS-339（第5弾「五龍の逆鱗」レジェンドマジレッド〜闇のヤイバ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか card_4（RS-205 の Q）・card_6（RS-364 / RS-407 の Q）の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import {
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  lastBattleBps,
  NOSP_ATTACKER,
  pick,
  powerCards,
  raw,
  reanimateTests,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  tryAct,
  zoneOf,
  zordDownTests,
} from "./RS5-327-347.helpers";
import type { CardInstance, GameState } from "../types/game";

/** player1 のバトルフェイズに、pos 番目として id を出す（敵軍は p2）。 */
function enterAt(id: string, pos: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
  const s = st({
    player1: { battle: fillers(pos - 1), rush: [inst(id, "x")], deck: deckCards(5), ...p1 },
    player2: { deck: deckCards(5, "e"), ...p2 },
  });
  return enter(s, `${id}:x`);
}

// ===========================================================================
describe("RS-333 レジェンドマジレッド", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジボルト】「SP1」これはアタックするとき、リリース状態の自軍コマンド1つにつきBP＋1000される。";

  it("RS-333: カタログ本文・スペックが出典と一致（出典: atwiki/page-494）", () => {
    expectCatalogText("RS-333", TEXT);
    expectStats("RS-333", {
      name: "レジェンドマジレッド",
      category: "MA",
      size: "S",
      bp: 4500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 3,
      features: ["レッド", "男", "魔法", "レジェンドフォーム"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-333", "RS-057", "マジレッド", "atwiki/page-494", "MA");
  reanimateTests("RS-333", "RS-057", "マジレッド", "atwiki/page-494");

  it("RS-333: ※ マジファイヤーバードの追加条件で捨札になった（撃破されていない）ときは発動しない（出典: atwiki/page-494「撃破されて捨札になったとき」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-331", "fb")], rush: [inst("RS-333", "lr")], discard: [inst("RS-057", "mr")], command: releasedCat("MA", 1), power: powerCards(4), deck: deckCards(3) },
    });
    const r = rushFromHand(s0, "player1", "RS-331:fb");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-333:lr")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-057:mr")).toBe("discard");
  });

  it("RS-333: 【マジボルト】3番目に出て NC が成立すると「SP1」になりストライクできる（出典: atwiki/page-494「CN：3」「「SP1」」・R-CN-02）", () => {
    const s = enterAt("RS-333", 3);
    expect(spOf(s, "player1", "RS-333:x")).toBe(1);
    expect(canStrike(s, "RS-333:x")).toBe(true);
  });

  it("RS-333: NC が成立していない（2番目）ときは SP！のまま（ストライクできない）（出典: atwiki/page-494「SP：！」）", () => {
    const s = enterAt("RS-333", 2);
    expect(spOf(s, "player1", "RS-333:x")).toBe(0);
    expect(canStrike(s, "RS-333:x")).toBe(false);
  });

  const cmds = () => [...releasedCat("MA", 3), held("TST-OP-MA", "h")];

  it("RS-333: 【マジボルト】NC 成立時、アタックするときリリース状態の自軍コマンド1つにつき BP+1000（リリース3・ホールド1 → 7500）（出典: atwiki/page-494）", () => {
    let s = enterAt("RS-333", 3, { command: cmds() }, { battle: [inst("TST-UNIT-7", "e")] });
    s = settle(attack(s, "RS-333:x", "TST-UNIT-7:e"));
    expect(lastBattleBps(s)?.attacker).toBe(7500);
  });

  it("RS-333: NC が成立していなければアタックしても BP は上がらない（出典: atwiki/page-494・R-CN-02）", () => {
    let s = enterAt("RS-333", 2, { command: cmds() }, { battle: [inst("TST-UNIT-7", "e")] });
    s = settle(attack(s, "RS-333:x", "TST-UNIT-7:e"));
    expect(lastBattleBps(s)?.attacker).toBe(4500);
  });

  it("RS-333: アタックしていないとき（ラッシュ・バトルエリアで待機中）の BP は 4500 のまま（出典: atwiki/page-494「これはアタックするとき」）", () => {
    const s = enterAt("RS-333", 3, { command: cmds() });
    expect(bpOf(s, "player1", "RS-333:x")).toBe(4500);
  });
});

// ===========================================================================
describe("RS-334 レジェンドマジイエロー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジイエロー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジボルト】「SP1」これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-334: カタログ本文・スペックが出典と一致（出典: atwiki/page-495）", () => {
    expectCatalogText("RS-334", TEXT);
    expectStats("RS-334", {
      name: "レジェンドマジイエロー",
      category: "MA",
      size: "S",
      bp: 3500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 3,
      features: ["イエロー", "男", "魔法", "レジェンドフォーム"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-334", "RS-058", "マジイエロー", "atwiki/page-495", "MA");
  reanimateTests("RS-334", "RS-058", "マジイエロー", "atwiki/page-495");

  const enemy = { rush: [inst("TST-UNIT-0", "er")], battle: [inst("TST-UNIT-0", "eb")] };

  it("RS-334: 【マジボルト】NC 成立時は「SP1」になり、敵軍ラッシュエリアのユニットにもアタックできる（出典: atwiki/page-495）", () => {
    const s = enterAt("RS-334", 3, {}, enemy);
    expect(spOf(s, "player1", "RS-334:x")).toBe(1);
    expect(attackTargets(s, "RS-334:x").sort()).toEqual(["TST-UNIT-0:eb", "TST-UNIT-0:er"]);
    const t = settle(attack(s, "RS-334:x", "TST-UNIT-0:er"));
    expect(zoneOf(t, "player2", "TST-UNIT-0:er")).toBe("discard");
  });

  it("RS-334: NC が成立していなければ敵軍ラッシュエリアのユニットにはアタックできず、SP！のまま（出典: atwiki/page-495・R-CN-02）", () => {
    const s = enterAt("RS-334", 2, {}, enemy);
    expect(spOf(s, "player1", "RS-334:x")).toBe(0);
    expect(attackTargets(s, "RS-334:x")).toEqual(["TST-UNIT-0:eb"]);
  });
});

// ===========================================================================
describe("RS-335 レジェンドマジブルー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジブルー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジボルト】自分は2枚までドローしてもよい。そうしたとき、相手は1枚ドローしてもよい。";

  it("RS-335: カタログ本文・スペックが出典と一致（出典: atwiki/page-496）", () => {
    expectCatalogText("RS-335", TEXT);
    expectStats("RS-335", {
      name: "レジェンドマジブルー",
      category: "MA",
      size: "S",
      bp: 3500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 2,
      features: ["ブルー", "女", "魔法", "レジェンドフォーム"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-335", "RS-059", "マジブルー", "atwiki/page-496", "MA");
  reanimateTests("RS-335", "RS-059", "マジブルー", "atwiki/page-496");

  const hands = (s: GameState) => [s.players.player1.hand.length, s.players.player2.hand.length];

  it("RS-335: 【マジボルト】NC 成立時、自分は2枚ドローでき、そうしたとき相手は1枚ドローできる（出典: atwiki/page-496）", () => {
    let s = enterAt("RS-335", 2);
    s = pick(pick(s, "draw"), "draw");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(true);
    s = pick(s, "draw");
    expect(hands(s)).toEqual([2, 1]);
  });

  it("RS-335: 相手の1枚ドローは任意（相手はドローしないことを選べる）（出典: atwiki/page-496「相手は1枚ドローしてもよい」）", () => {
    let s = enterAt("RS-335", 2);
    s = pick(pick(s, "draw"), "draw");
    s = skip(s);
    expect(hands(s)).toEqual([2, 0]);
  });

  it("RS-335: 自分はドローしないことを選べ、そのとき相手はドローできない（出典: atwiki/page-496「ドローしてもよい。そうしたとき」）", () => {
    let s = enterAt("RS-335", 2);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(hands(s)).toEqual([0, 0]);
  });

  // grnrngr/faq-card-5 RS-335 Q1「はい、その通りです。」（自分が1枚しかドローしなかった場合でも相手は1枚ドローできる）
  it("RS-335: 公式Q&A — 自分が1枚しかドローしなかった場合でも、相手は1枚ドローできる（出典: grnrngr/faq-card-5 RS-335 Q1・atwiki/page-496 Q1）", () => {
    let s = enterAt("RS-335", 2);
    s = pick(s, "draw");
    s = skip(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = pick(s, "draw");
    expect(hands(s)).toEqual([1, 1]);
  });

  it("RS-335: NC が成立していない（3番目）ときはドローの選択が出ない（出典: atwiki/page-496「CN：2」・R-CN-02）", () => {
    const s = enterAt("RS-335", 3);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(hands(s)).toEqual([0, 0]);
  });
});

// ===========================================================================
describe("RS-336 レジェンドマジピンク", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジピンク」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジボルト】追加条件を持たないユニットを1体選び、持ち主の山札の上に戻してもよい。";

  it("RS-336: カタログ本文・スペックが出典と一致（出典: atwiki/page-497）", () => {
    expectCatalogText("RS-336", TEXT);
    expectStats("RS-336", {
      name: "レジェンドマジピンク",
      category: "MA",
      size: "S",
      bp: 2500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 4,
      features: ["ピンク", "女", "魔法", "レジェンドフォーム"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-336", "RS-060", "マジピンク", "atwiki/page-497", "MA");
  reanimateTests("RS-336", "RS-060", "マジピンク", "atwiki/page-497");

  const pinkAt4 = () =>
    enterAt(
      "RS-336",
      4,
      { rush: [inst("RS-336", "x"), inst("RS-060", "ownRush")] },
      { rush: [inst("TST-UNIT-0", "er"), inst("RS-345", "swat")], battle: [inst("RS-328", "tr"), inst("TST-UNIT-0", "eb")] },
    );

  it("RS-336: 【マジボルト】追加条件を持たないユニット（敵味方・ラッシュ／バトルエリア）を選べる（出典: atwiki/page-497「追加条件を持たないユニットを1体選び」）", () => {
    const s = pinkAt4();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-336");
    expect(choiceIds(s)).toEqual(
      ["RS-060:ownRush", "TST-UNIT-0:eb", "TST-UNIT-0:er", "TST-UNIT-0:fill0", "TST-UNIT-0:fill1", "TST-UNIT-0:fill2"].sort(),
    );
  });

  // grnrngr/faq-card-5 RS-336 Q1「いいえ、含まれません。カードの「追加条件」の欄に記述があるものは「追加条件を持つ」と考えて下さい。」
  it("RS-336: 公式Q&A — 必要パワーに「－」のあるユニット（デカレッドSWAT）や「＋」のユニット（トラベリオン）は追加条件を持つので選べない（出典: grnrngr/faq-card-5 RS-336 Q1・atwiki/page-497 Q1）", () => {
    const ids = choiceIds(pinkAt4());
    expect(ids).not.toContain("RS-345:swat");
    expect(ids).not.toContain("RS-328:tr");
    expect(ids).not.toContain("RS-336:x");
  });

  it("RS-336: 選んだユニットは持ち主の山札の上に戻る（出典: atwiki/page-497「持ち主の山札の上に戻してもよい」）", () => {
    const s = pick(pinkAt4(), "TST-UNIT-0:eb");
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-0:eb");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("deck");
  });

  it("RS-336: 任意 — 戻さないことを選べる（出典: atwiki/page-497「戻してもよい」）", () => {
    let s = pinkAt4();
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it("RS-336: NC が成立していない（3番目）ときは選択が出ない（出典: atwiki/page-497「CN：4」・R-CN-02）", () => {
    const s = enterAt("RS-336", 3, {}, { battle: [inst("TST-UNIT-0", "eb")] });
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  // grnrngr/faq-card-5 RS-312 Q「いいえ、その場合は「RS-060 マジピンク」を選ぶことはできません。…「撃破したとき」が捨札になる前に割り込みますので」
  it("RS-336: 公式Q&A — カブトライジャーに撃破されたとき、【迅雷流剣技・雷撃斬】の対象は先に選ぶので、※で自軍捨札から出るマジピンクは選べない（出典: grnrngr/faq-card-5 RS-312 Q1・ユーザー決定「撃破したとき→撃破されたとき→捨札→捨札になったとき」）", () => {
    // 【雷撃斬】は CN 3 の NC の効果（atwiki/page-482「CN：3」・R-CN-02）。Q&A の前提どおり NC 成立済みのカブトライジャーでアタックする。
    let s = attackedInEnemyTurn(
      { battle: [inst("RS-336", "pk")], rush: [inst("RS-059", "mb")], discard: [inst("RS-060", "mp")] },
      "RS-336:pk",
      { battle: [{ ...inst("RS-312", "kb"), activatedNcEffects: ["kami_ken_kami_geki_zan"] }] },
      "RS-312:kb",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-312");
    expect(choiceIds(s)).toEqual(["RS-059:mb"]);
    s = resolveAll(s, ["RS-059:mb", "RS-060:mp"]);
    expect(zoneOf(s, "player1", "RS-059:mb")).toBe("power");
    expect(zoneOf(s, "player1", "RS-060:mp")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-337 レジェンドマジグリーン", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジグリーン」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジボルト】「SP1」敵軍コマンドゾーンからカードを1枚選び、持ち主の手札に戻してもよい。";

  it("RS-337: カタログ本文・スペックが出典と一致（出典: atwiki/page-498）", () => {
    expectCatalogText("RS-337", TEXT);
    expectStats("RS-337", {
      name: "レジェンドマジグリーン",
      category: "MA",
      size: "S",
      bp: 3500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 3,
      features: ["グリーン", "男", "魔法", "レジェンドフォーム"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-337", "RS-061", "マジグリーン", "atwiki/page-498", "MA");
  reanimateTests("RS-337", "RS-061", "マジグリーン", "atwiki/page-498");

  const greenAt = (pos: number) =>
    enterAt("RS-337", pos, { command: releasedCat("MA", 1, "own") }, { command: [released("TST-OP", "erel"), held("TST-OP", "ehld")] });

  it("RS-337: 【マジボルト】NC 成立時は「SP1」になる（出典: atwiki/page-498「「SP1」」）", () => {
    const s = greenAt(3);
    expect(spOf(s, "player1", "RS-337:x")).toBe(1);
  });

  it("RS-337: 【マジボルト】敵軍コマンドゾーンのカードを選ぶのは自分（レジェンドマジグリーンのプレイヤー）で、リリース・ホールドどちらも選べる（出典: atwiki/page-498「敵軍コマンドゾーンからカードを1枚選び」）", () => {
    const s = greenAt(3);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP:ehld", "TST-OP:erel"]);
  });

  it("RS-337: 選ばれた敵軍コマンドのカードは持ち主（相手）の手札に戻る（ホールド状態のカード）（出典: atwiki/page-498「持ち主の手札に戻してもよい」）", () => {
    // 選択者の不具合（上の it.fails）とは独立に、戻し先だけを確認する（選択の主体は保留中の選択に従う）。
    let s = greenAt(3);
    const p = s.pendingEffectChoice!;
    s = act(s, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: "TST-OP:ehld" });
    expect(zoneOf(s, "player2", "TST-OP:ehld")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-OP:erel")).toBe("command");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-337: 任意 — 自分は戻さないことを選べる（出典: atwiki/page-498「戻してもよい」）", () => {
    let s = greenAt(3);
    s = raw(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RS-337: NC が成立していない（2番目）ときは SP！のままで、敵軍コマンドの選択も出ない（出典: atwiki/page-498「CN：3」・R-CN-02）", () => {
    const s = greenAt(2);
    expect(spOf(s, "player1", "RS-337:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.command).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-338 ジャリュウ兵", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";
  const filler = (n: number) => ({ cardId: "RS-057", count: n });

  it("RS-338: カタログ本文・スペックが出典と一致（出典: atwiki/page-428）", () => {
    expectCatalogText("RS-338", TEXT);
    expectStats("RS-338", {
      name: "ジャリュウ兵",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 2,
      features: ["ジャリュウ一族", "恐竜", "戦闘員"],
    });
  });

  it("RS-338: ※ デッキに好きな枚数（4枚以上、例えば12枚）入れてもよい（出典: atwiki/page-428「デッキに好きな枚数入れてもよい」）", () => {
    const entries = [{ cardId: "RS-338", count: 12 }, filler(3), { cardId: "RS-058", count: 3 }, { cardId: "RS-059", count: 3 }, { cardId: "RS-060", count: 3 }, { cardId: "RS-061", count: 3 }, { cardId: "RS-106", count: 3 }, { cardId: "RS-115", count: 3 }, { cardId: "RS-126", count: 3 }, { cardId: "RS-081", count: 3 }, { cardId: "RS-205", count: 3 }];
    const r = validateDeckEntries(entries);
    expect(r.errors.filter((e) => e.includes("ジャリュウ兵"))).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("RS-338: 比較 — ※のないカード（闇のヤイバ）は4枚入れられない（出典: atwiki/page-428・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-339", count: 4 }, { cardId: "RS-338", count: 36 }]);
    expect(r.errors.some((e) => e.includes("闇のヤイバ"))).toBe(true);
  });

  it("RS-338: 必要パワー2・追加条件なしでラッシュできる（出典: atwiki/page-428「必要パワー：2」「追加条件：なし」）", () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst("RS-338", "j")], command: releasedCat("DA", 1), power: powerCards(n), deck: deckCards(3) } });
    expect(tryAct(mk(1), { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "RS-338:j" }).ok).toBe(false);
    const r = rushFromHand(mk(2), "player1", "RS-338:j");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-338:j")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-339 闇のヤイバ", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【闇への誘い】これが自軍エリアにある間、特徴「男」を持つすべてのユニットは、カテゴリに「DA」が追加される。";

  it("RS-339: カタログ本文・スペックが出典と一致（出典: atwiki/page-439）", () => {
    expectCatalogText("RS-339", TEXT);
    expectStats("RS-339", {
      name: "闇のヤイバ",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 4,
      features: ["ダークシャドウ", "男", "忍者"],
    });
  });

  it("RS-339: ※ 敵軍ターン中、「SP1」のユニットとバトルするとバトルに勝っても撃破される（出典: atwiki/page-439）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-339", "y")] }, "RS-339:y", {}, "TST-UNIT-0:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-339:y")).toBe("discard");
  });

  it("RS-339: ※ 「SP1」以上 — SP2 のユニットとバトルしてもバトルに勝って撃破される（出典: atwiki/page-439「「SP1」以上のユニット」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-339", "y")] }, "RS-339:y", {}, "TST-UNIT-2:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-339:y")).toBe("discard");
  });

  it("RS-339: ※ SP のない（「－」）ユニットとのバトルに勝ったときは撃破されない（出典: atwiki/page-439）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("RS-339", "y")] }, "RS-339:y", {}, "SPEC-NOSP:a", [NOSP_ATTACKER]));
    expect(zoneOf(s, "player1", "RS-339:y")).toBe("battle");
  });

  it("RS-339: ※ 自軍ターン中に「SP1」のユニットとバトルして勝ったときは撃破されない（出典: atwiki/page-439「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-339", "y")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    s = resolveAll(attack(s, "RS-339:y", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-339:y")).toBe("battle");
  });

  /** リュウレンジャー（RS-205、CN3）の【天火星・稲妻炎上破】で「DA」の敵軍Sユニットとして数えられるかを見る。 */
  function ryuRanger(p1Extra: CardInstance[], p2Extra: CardInstance[], p1Discard: CardInstance[] = []) {
    const s = st({
      player1: { battle: fillers(2), rush: [inst("RS-205", "ryu"), ...p1Extra], discard: p1Discard, command: releasedCat("MA", 2), deck: deckCards(5) },
      player2: { rush: [inst("RS-057", "man"), inst("RS-059", "woman"), ...p2Extra], deck: deckCards(5, "e") },
    });
    return enter(s, "RS-205:ryu");
  }

  it("RS-339: 【闇への誘い】自軍エリアにある間、特徴「男」を持つ敵軍ユニット（マジレッド）にも DA が追加される（リュウレンジャーで撃破できる）（出典: atwiki/page-439「特徴「男」を持つすべてのユニット」・grnrngr/faq-card-4 RS-205 Q3）", () => {
    let s = ryuRanger([inst("RS-339", "y")], []);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-205");
    s = pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(choiceIds(s)).toEqual(["RS-057:man"]);
    s = resolveAll(pick(s, "RS-057:man"));
    expect(zoneOf(s, "player2", "RS-057:man")).toBe("discard");
  });

  it("RS-339: 【闇への誘い】敵軍エリアのヤイバでも、特徴「男」を持つユニットに DA が追加される（出典: atwiki/page-439「すべてのユニット」・grnrngr/faq-card-5 RS-290 Q1「敵軍エリアに「RS-339 闇のヤイバ」があり」）", () => {
    let s = ryuRanger([], [inst("RS-339", "y")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-205");
    // 「DA」の敵軍 S ユニット = マジレッド（男→DA）＋ヤイバ自身 の2体まで MA コマンドをホールドできる
    expect(s.pendingEffectChoice?.selectCount).toBe(2);
    for (let i = 0; i < 2 && s.pendingEffectChoice?.effectId === "hi_honoo_ha"; i++) s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    expect(choiceIds(s)).toEqual(["RS-057:man", "RS-339:y"]);
    expect(choiceIds(s)).not.toContain("RS-059:woman");
  });

  it("RS-339: 【闇への誘い】ヤイバが自軍エリアになければ（捨札にあるだけでは）DA は追加されない（出典: atwiki/page-439「これが自軍エリアにある間」）", () => {
    const s = ryuRanger([], [], [inst("RS-339", "y")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-205");
    expect(zoneOf(s, "player2", "RS-057:man")).toBe("rush");
  });

  // grnrngr/faq-card-4 RS-205 Q3「いいえ、できません。…選ぶことのできない「RK-057 仮面ライダーザビーＲＦ」を撃破することはできません。」
  it("RS-339: 公式Q&A — ヤイバで DA が追加されたザビーRF（「相手に選ばれない」）はリュウレンジャーの効果で撃破できない（出典: grnrngr/faq-card-4 RS-205 Q3）", () => {
    let s = ryuRanger([inst("RS-339", "y")], [inst("RK-057", "zb")]);
    s = pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(choiceIds(s)).not.toContain("RK-057:zb");
    expect(choiceIds(s)).toContain("RS-057:man");
  });

  // grnrngr/faq-card-5 RS-339 Q1「カテゴリにＤＡを追加されているＳユニットも、「ＤＡのＳユニット」として扱いますので、…バトルエリアに出ることはできません。」
  it("RS-339: 公式Q&A — DA を追加された特徴「男」の S ユニットは、敵軍バトルエリアに気伝武人龍星王があるとバトルエリアに出られない（出典: grnrngr/faq-card-5 RS-339 Q1・atwiki/page-439 Q1）", () => {
    const s = st({
      player1: { rush: [inst("RS-057", "man"), inst("RS-339", "y")], deck: deckCards(3) },
      player2: { battle: [inst("RS-290", "ry")], deck: deckCards(3, "e") },
    });
    expect(canEnter(s, "RS-057:man")).toBe(false);
  });

  // grnrngr/faq-card-5 RS-290 Q1「いいえ、できません。…特徴「男」を持つ自軍ユニットはバトルエリアに出られないことになります。」
  it("RS-339: 公式Q&A — 敵軍エリアにヤイバ、敵軍バトルエリアに龍星王があるとき、特徴「男」を持つワイルドビーストの自軍 S ユニット（ゲキレッド）はバトルエリアに出られない（出典: grnrngr/faq-card-5 RS-290 Q1）", () => {
    const s = st({
      player1: { battle: fillers(1), rush: [inst("RS-340", "gr")], deck: deckCards(3) },
      player2: { battle: [inst("RS-290", "ry")], rush: [inst("RS-339", "y")], deck: deckCards(3, "e") },
    });
    expect(canEnter(s, "RS-340:gr")).toBe(false);
  });

  it("RS-339: 比較 — 龍星王があっても特徴「男」を持たない S ユニット（マジピンク）は DA が追加されないのでバトルエリアに出られる（出典: grnrngr/faq-card-5 RS-290 Q1）", () => {
    const s = st({
      player1: { rush: [inst("RS-060", "woman"), inst("RS-339", "y")], deck: deckCards(3) },
      player2: { battle: [inst("RS-290", "ry")], deck: deckCards(3, "e") },
    });
    expect(canEnter(s, "RS-060:woman")).toBe(true);
  });

  // grnrngr/faq-card-5 RS-339 Q2 / RS-318 Q「はい、発動します。」
  it("RS-339: 公式Q&A — 相手が特徴「男」のユニットをラッシュしたとき、ヤイバで DA が追加されていればドギー・クルーガー【出動指令】が発動する（出典: grnrngr/faq-card-5 RS-339 Q2・RS-318 Q・atwiki/page-439 Q2）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-057", "man")], rush: [inst("RS-339", "y")], command: releasedCat("MA", 1), power: powerCards(3), deck: deckCards(3) },
      player2: { rush: [inst("RS-318", "dg")], deck: [inst("RS-106", "top"), ...deckCards(3, "e")] },
    });
    const r = rushFromHand(s, "player1", "RS-057:man");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-318");
    expect(r.state.pendingEffectChoice?.playerId).toBe("player2");
  });

  /** 敵軍（player2）が龍星王・ヤイバを持ち、自軍（player1）がクウガRM（バトル）・RD（コマンド）を持つ状態で、敵軍が DA のユニットをラッシュする。 */
  function kuugaMorph() {
    let s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { battle: [inst("RK-271", "rm")], command: [released("RK-272", "rd")], deck: deckCards(5) },
      player2: { hand: [inst("RS-338", "j")], battle: [inst("RS-290", "ry")], rush: [inst("RS-339", "y")], command: releasedCat("DA", 1), power: powerCards(3), deck: deckCards(5, "e") },
    });
    s = raw(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: "RS-338:j" });
    if (s.pendingCommandPayment) {
      s = raw(s, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: s.pendingCommandPayment.validInstanceIds.slice(0, 1) });
    }
    return s;
  }

  // atwiki/page-439 Q3「はい、その通りです。公開情報を確認した上で、実行できないことが明確であれば、それを実行することはできません。」
  it("RS-339: Q&A — ヤイバで DA を持つ S ユニットとなるクウガRD は龍星王のためバトルエリアに出られないので、クウガRM と置き換えられず《モーフ》を使えない（出典: atwiki/page-439 Q3）", () => {
    const s = kuugaMorph();
    expect(s.pendingEffectChoice?.effectId).not.toBe("morph_replacement");
  });

  // atwiki/page-439 Q4「はい、その通りです。…実行できないことが明確であればそれを実行することはできません。」
  it("RS-339: Q&A — 同状況で《モーフ》は使えず、クウガRM はバトルエリアに、クウガRD はコマンドゾーンに残る（出典: atwiki/page-439 Q4）", () => {
    let s = kuugaMorph();
    const p = s.pendingEffectChoice;
    if (p?.effectId === "morph_replacement") s = act(s, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: "RK-272:rd" });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RK-271:rm")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-272:rd")).toBe("command");
  });

  // grnrngr/faq-card-6 RS-364 Q3「はい、発動します。」（ヤイバで DA が追加されたユニットがいても「自軍ユニットがすべて DA」）
  it("RS-339: 公式Q&A — ヤイバで DA が追加された特徴「男」のユニット（ティラノレンジャー）がいても、ヘルサターン総統の「自軍ユニットがすべてDA」は満たされ BP+3000 される（出典: grnrngr/faq-card-6 RS-364 Q3）", () => {
    const s = st({ player1: { rush: [inst("RS-364", "hs"), inst("RS-339", "y"), inst("RS-081", "ty")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", "RS-081:ty")).toBe(6000);
  });

  // grnrngr/faq-card-6 RS-364 Q1「はい、ＢＰ+３０００されてＳＰ１になります。」
  it("RS-339: 公式Q&A — ヘルサターン総統・ヤイバ・ティラノレンジャーが自軍ラッシュエリアにあり、ティラノレンジャーが NC を発動したとき、BP+3000 されて SP1 になる（出典: grnrngr/faq-card-6 RS-364 Q1）", () => {
    let s = st({
      player1: {
        battle: [inst("RS-338", "j1"), inst("RS-338", "j2"), inst("RS-338", "j3")],
        rush: [inst("RS-364", "hs"), inst("RS-339", "y"), inst("RS-081", "ty")],
        command: releasedCat("DA", 1),
        deck: deckCards(3),
      },
      player2: { command: [held("TST-OP", "h1"), held("TST-OP", "h2")], deck: deckCards(3, "e") },
    });
    // 「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれているかのように扱う
    s = enterWithHold(s, "RS-081:ty", ["TST-OP-DA:cDA0"]);
    expect(bpOf(s, "player1", "RS-081:ty")).toBe(3000 + 2000 + 3000);
    expect(spOf(s, "player1", "RS-081:ty")).toBe(1);
  });

  // grnrngr/faq-card-6 RS-407 Q1「その「アカレンジャー」はストライクすることができません。…並び順が１番目であっても５番目であっても、ストライクすることはできない」
  it("RS-339: 公式Q&A — マジエルとヤイバが自軍ラッシュエリアにあると、DA が追加されたアカレンジャー（ET）は5番目でもストライクできない（出典: grnrngr/faq-card-6 RS-407 Q1）", () => {
    let s = st({ player1: { battle: fillers(4), rush: [inst("RS-126", "aka"), inst("RS-407", "mj"), inst("RS-339", "y")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = enter(s, "RS-126:aka");
    expect(canStrike(s, "RS-126:aka")).toBe(false);
  });

  it("RS-339: 比較 — ヤイバがなければ、マジエルがあっても ET のアカレンジャーは5番目でストライクできる（出典: grnrngr/faq-card-6 RS-407 Q1・atwiki RS-407「ETなら5番目」）", () => {
    let s = st({ player1: { battle: fillers(4), rush: [inst("RS-126", "aka"), inst("RS-407", "mj")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = enter(s, "RS-126:aka");
    expect(canStrike(s, "RS-126:aka")).toBe(true);
  });
});
