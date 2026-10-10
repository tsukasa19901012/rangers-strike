/**
 * カード別スペック: RS-320〜RS-326（第5弾「五龍の逆鱗」デカスワン〜魔法猫スモーキー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）ほか card_1〜4・card_6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries } from "@rangers-strike/cards";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  pick,
  powerCards,
  released,
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RS5-306-326.helpers";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";

const M_UNIT = sUnit("SPEC-M", { size: "M", bp: 3000, sp: 1 });
const L_16K = sUnit("SPEC-L16K", { size: "L", bp: 16000, sp: 1, powerCost: "7+" });
const L_17K = sUnit("SPEC-L17K", { size: "L", bp: 17000, sp: 1, powerCost: "7+" });
const MA_M_COND = sUnit("SPEC-M-COND", {
  size: "M",
  bp: 5000,
  powerCost: "3+",
  rushAdditionalCondition: { conditionId: "send_s_unit_to_discard", text: "自軍Sユニットを1体捨札にする", unitCount: 1 },
} as Partial<ReturnType<typeof sUnit>>);
const SPECS = [M_UNIT, L_16K, L_17K, MA_M_COND];

/** 合法手のうち、指定インスタンスを source/instance として使うものを返す（使えなければ undefined）。 */
function actionUsing(s: GameState, playerId: PlayerId, instanceId: string): GameAction | undefined {
  return legal(s).find((a) => {
    const r = a as unknown as Record<string, unknown>;
    if (["move_to_battle", "battle", "strike", "end_phase"].includes(String(r.type))) return false;
    return r.playerId === playerId && (r.sourceInstanceId === instanceId || r.instanceId === instanceId || r.substituteInstanceId === instanceId);
  });
}

/** 指定インスタンスを使う合法手を実行し、続くコマンド支払いを先頭から済ませる。 */
function useVia(s: GameState, playerId: PlayerId, instanceId: string): GameState {
  const a = actionUsing(s, playerId, instanceId);
  if (!a) throw new Error(`no legal action using ${instanceId}`);
  return act(s, a);
}

// ===========================================================================
describe("RS-320 デカスワン", () => {
  const TEXT =
    "【スワンイリュージョン】これが自軍ラッシュエリアにある間、敵軍ターン中、敵軍Sユニットにストライクされてダメージを受けたとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。";

  it("RS-320: カタログ本文・スペックが出典と一致（出典: atwiki/page-426）", () => {
    expectCatalogText("RS-320", TEXT);
    expectStats("RS-320", {
      name: "デカスワン",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      features: ["女", "警察"],
    });
  });

  /** 敵軍（player2）ターン：striker が自軍にストライクした後。デカスワンは swanZone に置く。 */
  function struck(striker: string, swanZone: "rush" | "battle" = "rush") {
    let s = st(
      {
        activePlayer: "player2",
        player1: { [swanZone]: [inst("RS-320", "sw")], power: powerCards(3) },
        player2: { battle: [inst(striker, "a")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    s = settle(strike(s, `${striker}:a`, "player2"));
    expect(s.players.player1.damage).toBe(1);
    return s;
  }

  // 「敵軍Sユニットにストライクされてダメージを受けたとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない」
  // 既知の不具合: CARD-RS-320 【スワンイリュージョン】が未実装（ストライクされた後も敵軍ラッシュエリアのユニットがバトルエリアに出られる）
  it.fails("RS-320: 敵軍ターン中に敵軍 S ユニットにストライクされてダメージを受けると、敵軍ラッシュエリアのユニットはそのターン バトルエリアに出られない（出典: atwiki/page-426）", () => {
    const s = struck("TST-UNIT-0");
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(false);
  });

  it("RS-320: ストライクしたのが敵軍 M ユニットなら制限はかからない（出典: atwiki/page-426「敵軍Sユニットにストライクされて」）", () => {
    const s = struck("SPEC-M");
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(true);
  });

  it("RS-320: デカスワンが自軍ラッシュエリアにない（バトルエリアにある）ときは制限はかからない（出典: atwiki/page-426「これが自軍ラッシュエリアにある間」）", () => {
    const s = struck("TST-UNIT-0", "battle");
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(true);
  });

  it("RS-320: ストライクされる前は、敵軍ラッシュエリアのユニットはバトルエリアに出られる（出典: atwiki/page-426「ダメージを受けたとき」）", () => {
    const s = st({ activePlayer: "player2", player1: { rush: [inst("RS-320", "sw")], power: powerCards(3) }, player2: { battle: [inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e") } });
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(true);
  });
});

// ===========================================================================
describe("RS-321 アーナロイド", () => {
  it("RS-321: カタログ本文・スペックが出典と一致（出典: atwiki/page-430）", () => {
    expectCatalogText("RS-321", "※このカードはデッキに好きな枚数入れてもよい。");
    expectStats("RS-321", {
      name: "アーナロイド",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 1,
      features: ["メカ", "戦闘員"],
    });
  });

  // 「※このカードはデッキに好きな枚数入れてもよい。」
  it("RS-321: デッキに4枚以上（12枚）入れてもデッキ構築エラーにならない（出典: atwiki/page-430・R-DECK-03）", () => {
    const filler = allCardsCatalog.cards
      .filter((c) => c.type === "operation" && c.id.startsWith("RS-0"))
      .slice(0, 20)
      .map((c) => ({ cardId: c.id, count: 1 }));
    const ok = validateDeckEntries([{ cardId: "RS-321", count: 12 }, ...filler], allCardsCatalog, { minSize: 1 });
    expect(ok.errors.filter((e) => e.includes("アーナロイド"))).toEqual([]);
  });

  it("RS-321: パワー1・DA コマンド1つのホールドでラッシュできる（出典: atwiki/page-430「必要パワー：1」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-321", "h")], command: [released("TST-OP-DA", "c")], power: powerCards(1) } });
    expect(canStartRush(s, "player1", "RS-321:h")).toBe(true);
  });
});

// ===========================================================================
describe("RS-322 ベン・G", () => {
  const TEXT =
    "【人身略取】自軍ターン中、これがバトルエリアに出たとき、自分の手札から追加条件を持つMユニットのカードを1枚選び捨札にしてもよい。そうしたとき、相手は自分自身がそのカードの持ち主であるかのように、そのカードの追加条件を可能なら満たす。";

  it("RS-322: カタログ本文・スペックが出典と一致（出典: atwiki/page-431）", () => {
    expectCatalogText("RS-322", TEXT);
    expectStats("RS-322", {
      name: "ベン・G",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      features: ["メカ", "男"],
    });
  });

  function benEnters(hand: ReturnType<typeof inst>[], enemy: Partial<GameState["players"]["player2"]>) {
    const s = st(
      {
        player1: { rush: [inst("RS-322", "b")], hand },
        player2: { deck: deckCards(5, "e"), ...enemy },
      },
      SPECS,
    );
    return enter(s, "RS-322:b");
  }

  // 「自分の手札から追加条件を持つMユニットのカードを1枚選び捨札にしてもよい。そうしたとき、相手は…そのカードの追加条件を可能なら満たす」
  it("RS-322: 出たとき手札の追加条件を持つ M ユニットを捨札にすると、相手がその追加条件（自軍 S ユニットを1体捨札）を満たす（出典: atwiki/page-431）", () => {
    let s = benEnters([inst("RS-311", "m")], { rush: [inst("TST-UNIT-0", "er")], battle: [inst("TST-UNIT-0", "eb")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = pick(s, "RS-311:m");
    expect(zoneOf(s, "player1", "RS-311:m")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:eb", "TST-UNIT-0:er"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "TST-UNIT-0:er");
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
    expect(s.activePlayer).toBe("player1");
  });

  // 「追加条件を持つMユニットのカード」
  it("RS-322: 選べるのは追加条件を持つ M ユニットのカードだけ（追加条件なしの M・S ユニット・オペレーションは選べない）（出典: atwiki/page-431）", () => {
    const s = benEnters([inst("RS-311", "m"), inst("SPEC-M", "plainm"), inst("TST-UNIT-0", "s"), inst("TST-OP", "op")], { rush: [inst("TST-UNIT-0", "er")] });
    expect(choiceIds(s)).toEqual(["RS-311:m"]);
  });

  // 「捨札にしてもよい」
  it("RS-322: 捨札にしないことを選べ、その場合は何も起きない（出典: atwiki/page-431「捨札にしてもよい」）", () => {
    let s = benEnters([inst("RS-311", "m")], { rush: [inst("TST-UNIT-0", "er")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-311:m")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
  });

  it("RS-322: 手札に追加条件を持つ M ユニットがなければ発動しない（出典: atwiki/page-431）", () => {
    const s = benEnters([inst("SPEC-M", "plainm")], { rush: [inst("TST-UNIT-0", "er")] });
    expect(s.pendingEffectChoice).toBeFalsy();
  });

  // faq-card-5 RS-322 Q1「いいえ、送る必要はありません。「可能なら満たす」ということは、満たすことができない場合は、満たす必要がないことになります。」
  it("RS-322: 公式Q&A — 相手の S ユニットが1体しかなく、バイオジェット2号（S ユニット3体）の追加条件を満たせなければ何も送らない（出典: grnrngr/faq-card-5 RS-322 Q1）", () => {
    let s = benEnters([inst("RS-129", "bj")], { rush: [inst("TST-UNIT-0", "er")] });
    s = pick(s, "RS-129:bj");
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:er")).toBe("rush");
    expect(s.players.player2.power).toEqual([]);
  });

  // faq-card-3 RS-322 Q（= atwiki Q2）「いいえ、その必要はありません。」（バイオジェット2号の※は実行しない）
  it("RS-322: 公式Q&A — 相手がバイオジェット2号の追加条件を満たしても、バイオジェット2号の※（パワーを捨札）は実行しない（出典: grnrngr/faq-card-3 RS-322・atwiki/page-431 Q2）", () => {
    let s = benEnters([inst("RS-129", "bj")], {
      rush: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")],
      power: powerCards(2, "ep"),
    });
    s = pick(s, "RS-129:bj");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player2"; i++) s = pick(s, choiceIds(s)[0]!);
    expect(["TST-UNIT-0:e1", "TST-UNIT-0:e2", "TST-UNIT-0:e3"].map((id) => zoneOf(s, "player2", id))).toEqual(["power", "power", "power"]);
    expect(zoneOf(s, "player2", "TST-P:ep0")).toBe("power");
    expect(zoneOf(s, "player2", "TST-P:ep1")).toBe("power");
    expect(s.players.player2.discard).toEqual([]);
  });

  // faq-card-5 RS-322 Q3（= faq-card-2 RS-260）「はい、その通りです。」（母艦の効果を使えるなら、S ユニットがなくても満たさなければならない）
  it("RS-322: 公式Q&A — 相手に S ユニットがなくても、バイオドラゴン（母艦）の効果で満たせるなら満たさなければならない（OT コマンドをホールドする）（出典: grnrngr/faq-card-5 RS-322 Q3・R-ADD-08）", () => {
    let s = benEnters([inst("RS-129", "bj")], {
      rush: [inst("RS-260", "dragon")],
      command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2"), released("TST-OP-OT", "o3")],
    });
    s = pick(s, "RS-129:bj");
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player2"; i++) s = pick(s, choiceIds(s)[0]!);
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  it.todo("RS-322: 公式Q&A — ライド中の宇宙刑事ギャバンしか S ユニットがないとき、チェイスを発動しても追加条件は満たせるものとして効果を続行する（出典: atwiki/page-431 Q4）— チェイス（R-KW-CHASE-01）とライド状態を含む場作りが RS-322 の範囲外のカード（RM-018・ビークル）の実装に依存するため");
  it.todo("RS-322: 公式Q&A — 仮面ライダーディケイドCF の「その場に留まる」効果を発動しても追加条件は満たせるものとして効果を続行する（出典: atwiki/page-431 Q5）— XG2-042 の留まる効果（オモテ向きパワーの捨札）に依存し、このカード範囲で場を作れないため");
  it.todo("RS-322: 公式Q&A — 仮面ライダークウガUF は【凄まじき戦士】で場に留まり、追加条件は満たせるものとして効果を続行する（出典: atwiki/page-431 Q6）— SK-004 の重ねたカードの状態を公開 API で用意できないため");
  it.todo("RS-322: 敵軍ターン中にバトルエリアに出たときは【人身略取】は発動しない（出典: atwiki/page-431「自軍ターン中」）— 敵軍ターン中に自軍ユニットをバトルエリアへ出す手段が公開 API に無いため");
});

// ===========================================================================
describe("RS-323 マジグリーン・マッスル", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「マジグリーン」のカードがあれば1枚選び、自軍ラッシュエリアに出す。【マジ・マージ】このユニットからコンビネーションするSユニットは、敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-323: カタログ本文・スペックが出典と一致（出典: atwiki/page-484）", () => {
    expectCatalogText("RS-323", TEXT);
    expectStats("RS-323", {
      name: "マジグリーン・マッスル",
      category: "MA",
      size: "S",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 1,
      features: ["グリーン", "男", "魔法"],
      rushCondition: "zord_down_discard_named",
    });
  });

  // 「必要パワー：7-」「追加条件：自軍「マジグリーン」1体を捨札にすれば必要パワー0になる」
  it("RS-323: 自軍のマジグリーンを捨札にすればパワー0でラッシュできる（出典: atwiki/page-484・R-ADD-02）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-323", "h")], rush: [inst("RS-061", "g")], power: [], command: [released("TST-OP-MA", "c")] } });
    const r = rushVia(s, "player1", "RS-323:h", (a) => a.zordMaterialInstanceId === "RS-061:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-323:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-061:g")).toBe("discard");
  });

  it("RS-323: マジグリーンがいなければ、パワーが7未満ではラッシュできず、7以上ならラッシュできる（出典: atwiki/page-484「必要パワー：7-」・R-ADD-02）", () => {
    const ng = st({ phase: "rush", player1: { hand: [inst("RS-323", "h")], power: powerCards(6), command: [released("TST-OP-MA", "c")] } });
    expect(rushFromHand(ng, "player1", "RS-323:h").ok).toBe(false);
    const ok = st({ phase: "rush", player1: { hand: [inst("RS-323", "h")], power: powerCards(7), command: [released("TST-OP-MA", "c")] } });
    expect(rushFromHand(ok, "player1", "RS-323:h").ok).toBe(true);
  });

  /** 敵軍（player2）ターン：BP13000 の敵軍ユニットがバトルエリアのマッスルにアタックして撃破する。 */
  function muscleDestroyed(discard: ReturnType<typeof inst>[]) {
    const s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-323", "mg")], discard },
      player2: { battle: [inst("TST-UNIT-7", "eb")], deck: deckCards(3, "e") },
    });
    return attack(s, "TST-UNIT-7:eb", "RS-323:mg", "player2");
  }

  // 「※これが撃破されて捨札になったとき、自軍捨札に「マジグリーン」のカードがあれば1枚選び、自軍ラッシュエリアに出す。」
  it("RS-323: 撃破されて捨札になったとき、自軍捨札のマジグリーンを1枚選んで自軍ラッシュエリアに出す（マジグリーン以外は選べない）（出典: atwiki/page-484）", () => {
    let s = muscleDestroyed([inst("RS-061", "g"), inst("RS-058", "y")]);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-323:mg")).toBe("discard");
    if (s.pendingEffectChoice?.playerId === "player1") {
      expect(choiceIds(s)).toEqual(["RS-061:g"]);
      expect(canSkip(s)).toBe(false);
      s = pick(s, "RS-061:g");
    }
    expect(zoneOf(s, "player1", "RS-061:g")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-058:y")).toBe("discard");
  });

  it("RS-323: 自軍捨札にマジグリーンがなければ何も出さない（出典: atwiki/page-484「…があれば」）", () => {
    const s = settle(muscleDestroyed([inst("RS-058", "y")]));
    expect(zoneOf(s, "player1", "RS-323:mg")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-058:y")).toBe("discard");
    expect(s.players.player1.rush).toEqual([]);
  });

  it("RS-323: 撃破されずに場を離れた（手札に戻った）ときは発動しない（出典: atwiki/page-484「撃破されて捨札になったとき」）", () => {
    let s = st({
      player1: { battle: fillers(3), rush: [inst("RS-308", "blue")] },
      player2: { rush: [inst("RS-323", "mg")], discard: [inst("RS-061", "g")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-308:blue");
    s = pick(s, "RS-323:mg");
    expect(zoneOf(s, "player2", "RS-323:mg")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-061:g")).toBe("discard");
  });

  // 「【マジ・マージ】このユニットからコンビネーションするSユニットは、敵軍ラッシュエリアのユニットにアタックできる。」
  // 既知の不具合: CARD-RS-323 【マジ・マージ】が未実装（次にコンビネーションした S ユニットが敵軍ラッシュエリアにアタックできない）
  it.fails("RS-323: 1番目に出て NC が成立すると、このユニットからコンビネーションした S ユニットは敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-484「CN：1」）", () => {
    let s = st({
      player1: { rush: [inst("RS-323", "mg"), inst("TST-UNIT-0", "next")] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-323:mg");
    s = settle(attack(s, "RS-323:mg", "TST-UNIT-0:eb"));
    s = enter(s, "TST-UNIT-0:next");
    expect(attackTargets(s, "TST-UNIT-0:next")).toContain("TST-UNIT-0:er");
  });

  it("RS-323: 1番目以外で出たとき（NC 不成立）は、次の S ユニットは敵軍ラッシュエリアにアタックできない（出典: atwiki/page-484「CN：1」・R-CN-02）", () => {
    let s = st({
      player1: { battle: fillers(1), rush: [inst("RS-323", "mg"), inst("TST-UNIT-0", "next")] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-323:mg");
    s = settle(attack(s, "RS-323:mg", "TST-UNIT-0:eb"));
    s = enter(s, "TST-UNIT-0:next");
    expect(attackTargets(s, "TST-UNIT-0:next")).not.toContain("TST-UNIT-0:er");
  });

  it("RS-323: マッスル自身は（【マジ・マージ】で）敵軍ラッシュエリアにアタックできるようにはならない（出典: atwiki/page-484「このユニットからコンビネーションするSユニットは」）", () => {
    let s = st({
      player1: { rush: [inst("RS-323", "mg")] },
      player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-323:mg");
    expect(attackTargets(s, "RS-323:mg")).toEqual(["TST-UNIT-0:eb"]);
  });
});

// ===========================================================================
describe("RS-324 マジマザー", () => {
  const TEXT =
    "【ジルマ・マジュナ】これが自軍ラッシュエリアにある間、次の効果を発動できる⇒敵軍ターン中、自軍ユニットが撃破されたとき、これをかわりに捨札にしてもよい。そうしたとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない。";

  it("RS-324: カタログ本文・スペックが出典と一致（出典: atwiki/page-486）", () => {
    expectCatalogText("RS-324", TEXT);
    expectStats("RS-324", {
      name: "マジマザー",
      category: "MA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      features: ["ホワイト", "女", "魔法"],
    });
  });

  /** 敵軍（player2）ターン：BP3000 の敵軍ユニットが自軍 TST-UNIT-0（BP1000）にアタックした直後。 */
  function motherCase(mothers = [inst("RS-324", "mm")], p2: Partial<GameState["players"]["player2"]> = {}) {
    const s = st({
      activePlayer: "player2",
      player1: { rush: mothers, battle: [inst("TST-UNIT-0", "v")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], rush: [inst("TST-UNIT-0", "r")], deck: deckCards(3, "e"), ...p2 },
    });
    return attack(s, "TST-UNIT-2:eb", "TST-UNIT-0:v", "player2");
  }

  // 「敵軍ターン中、自軍ユニットが撃破されたとき、これをかわりに捨札にしてもよい。そうしたとき、敵軍ラッシュエリアのユニットは、その敵軍ターン中バトルエリアに出られない」
  // 既知の不具合: CARD-RS-324 【ジルマ・マジュナ】が未実装（撃破時に身代わりの選択が出ない）
  it.fails("RS-324: 敵軍ターン中に自軍ユニットが撃破されるとき、かわりにマジマザーを捨札にでき、敵軍ラッシュエリアのユニットはそのターン バトルエリアに出られない（出典: atwiki/page-486）", () => {
    let s = motherCase();
    s = settle(useVia(s, "player1", "RS-324:mm"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-324:mm")).toBe("discard");
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(false);
  });

  // 「してもよい」
  // 既知の不具合: CARD-RS-324 【ジルマ・マジュナ】が未実装
  it.fails("RS-324: 使わないことを選べ、その場合はユニットは撃破され、敵軍ユニットはバトルエリアに出られる（出典: atwiki/page-486「捨札にしてもよい」）", () => {
    let s = motherCase();
    expect(actionUsing(s, "player1", "RS-324:mm")).toBeDefined();
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-324:mm")).toBe("rush");
    expect(canEnter(s, "TST-UNIT-0:r", "player2")).toBe(true);
  });

  it("RS-324: 自軍ターン中に自軍ユニットが撃破されても使えない（出典: atwiki/page-486「敵軍ターン中」）", () => {
    let s = st({
      player1: { rush: [inst("RS-324", "mm")], battle: [inst("TST-UNIT-0", "v")] },
      player2: { battle: [inst("TST-UNIT-2", "eb")], deck: deckCards(3, "e") },
    });
    s = attack(s, "TST-UNIT-0:v", "TST-UNIT-2:eb");
    expect(actionUsing(s, "player1", "RS-324:mm")).toBeUndefined();
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:v")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-324:mm")).toBe("rush");
  });

  // faq-card-5 RS-324 Q1「いいえ、それはできません。…ひとつのタイミングに対して1つしか発動できません。」
  // 既知の不具合: CARD-RS-324 【ジルマ・マジュナ】が未実装
  it.fails("RS-324: 公式Q&A — マジマザーが2体あっても、1回の撃破に対して2体とも捨札にすることはできない（出典: grnrngr/faq-card-5 RS-324 Q1）", () => {
    let s = motherCase([inst("RS-324", "m1"), inst("RS-324", "m2")]);
    s = useVia(s, "player1", "RS-324:m1");
    expect(actionUsing(s, "player1", "RS-324:m2")).toBeUndefined();
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-324:m1")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-324:m2")).toBe("rush");
  });

  // faq-card-5 RS-324 Q2「いいえ。そのターンにラッシュされたユニットはすべて効果対象になりますので、…発動した以降にラッシュされたユニットであってもバトルエリアに出ることはできません。」
  // 既知の不具合: CARD-RS-324 【ジルマ・マジュナ】が未実装
  it.fails("RS-324: 公式Q&A — 発動した後に敵軍がラッシュしたユニットも、そのターン バトルエリアに出られない（出典: grnrngr/faq-card-5 RS-324 Q2）", () => {
    let s = motherCase(undefined, { hand: [inst("TST-UNIT-0", "late")], command: [released("TST-OP", "c")] });
    s = settle(useVia(s, "player1", "RS-324:mm"));
    // 発動より後に敵軍ラッシュエリアへ置かれたユニット（発動後にラッシュされたユニットに相当）も出られない。
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, rush: [...s.players.player2.rush, inst("TST-UNIT-0", "late")], hand: [] } } };
    expect(canEnter(s, "TST-UNIT-0:late", "player2")).toBe(false);
  });

  // faq-card-5 RS-324 Q3「はい、できます。」（ゴーマ16世で BP0 以下になって撃破されるユニットにも使える）
  // 既知の不具合: CARD-RS-324 【ジルマ・マジュナ】が未実装
  it.fails("RS-324: 公式Q&A — 敵軍ターン中、気力の BP 修正がゴーマ16世で反転し BP0 以下で撃破されるユニットにも使える（出典: grnrngr/faq-card-5 RS-324 Q3・R-BP-02）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { rush: [inst("RS-324", "mm"), inst("RS-306", "red")], operation: [inst("RS-017", "kiryoku")], command: [released("TST-OP-MA", "c1"), released("TST-OP-MA", "c2"), released("TST-OP-MA", "c3")] },
      player2: { hand: [inst("RS-210", "goma")], command: [released("TST-OP-DA", "dc")], power: powerCards(4, "ep"), deck: deckCards(3, "e") },
    });
    s = rushFromHand(s, "player2", "RS-210:goma").state;
    expect(actionUsing(s, "player1", "RS-324:mm")).toBeDefined();
    s = settle(useVia(s, "player1", "RS-324:mm"));
    expect(zoneOf(s, "player1", "RS-324:mm")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-325 天空勇者マジシャイン", () => {
  const TEXT =
    "【マジチケット】これが自軍ラッシュエリアにある間、自軍コマンドゾーンにあるオペレーションカードの効果を、そのコマンドをホールドして手札から使用するかのように発動できる（必要パワーとタイミングは満たすこと）。発動したカードは、捨札になるときリリース状態の自軍コマンドをかわりに1つ捨札にすればコマンドゾーンに留まる。";

  it("RS-325: カタログ本文・スペックが出典と一致（出典: atwiki/page-485）", () => {
    expectCatalogText("RS-325", TEXT);
    expectStats("RS-325", {
      name: "天空勇者マジシャイン",
      category: "MA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["男", "魔法", "天空聖者"],
    });
  });

  /** 自軍ラッシュフェイズ：コマンドゾーンにリリース状態のオーラパワー（MA・必要パワー2）。 */
  function shine(opts: { shineZone?: "rush" | "battle" | "none"; power?: number; command?: ReturnType<typeof inst>[] } = {}) {
    const zone = opts.shineZone ?? "rush";
    return st({
      phase: "rush",
      player1: {
        rush: [...(zone === "rush" ? [inst("RS-325", "ms")] : []), inst("TST-UNIT-0", "target")],
        battle: zone === "battle" ? [inst("RS-325", "ms")] : [],
        command: opts.command ?? [released("RS-011", "aura"), released("TST-OP-MA", "spare")],
        power: powerCards(opts.power ?? 3),
        damage: 1,
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });
  }

  // 「自軍コマンドゾーンにあるオペレーションカードの効果を、そのコマンドをホールドして手札から使用するかのように発動できる」
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装（コマンドゾーンのオペレーションを使う合法手がない）
  it.fails("RS-325: 自軍ラッシュエリアにある間、コマンドゾーンのオペレーション（オーラパワー）をそのコマンドをホールドして発動できる（出典: atwiki/page-485）", () => {
    let s = shine();
    s = useVia(s, "player1", "RS-011:aura");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:target")) s = pick(s, "TST-UNIT-0:target");
    expect(bpOf(s, "player1", "TST-UNIT-0:target")).toBe(3000);
    expect(s.players.player1.command.find((c) => c.instanceId === "RS-011:aura")?.commandHeld ?? true).toBe(true);
  });

  it("RS-325: マジシャインがラッシュエリアにない（バトルエリアにある・いない）ときはコマンドゾーンのオペレーションは使えない（出典: atwiki/page-485「これが自軍ラッシュエリアにある間」）", () => {
    expect(actionUsing(shine({ shineZone: "battle" }), "player1", "RS-011:aura")).toBeUndefined();
    expect(actionUsing(shine({ shineZone: "none" }), "player1", "RS-011:aura")).toBeUndefined();
  });

  it("RS-325: 必要パワーを満たさなければ使えない（パワー1でオーラパワー（必要パワー2）は不可）（出典: atwiki/page-485「必要パワーとタイミングは満たすこと」）", () => {
    expect(actionUsing(shine({ power: 1 }), "player1", "RS-011:aura")).toBeUndefined();
  });

  // 「発動したカードは、捨札になるときリリース状態の自軍コマンドをかわりに1つ捨札にすればコマンドゾーンに留まる」
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装
  it.fails("RS-325: 発動したカードが捨札になるとき、リリース状態の自軍コマンドをかわりに1つ捨札にすればコマンドゾーンに留まる（出典: atwiki/page-485）", () => {
    let s = shine();
    s = useVia(s, "player1", "RS-011:aura");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:target")) s = pick(s, "TST-UNIT-0:target");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-OP-MA:spare")) s = pick(s, "TST-OP-MA:spare");
    expect(zoneOf(s, "player1", "RS-011:aura")).toBe("command");
    expect(zoneOf(s, "player1", "TST-OP-MA:spare")).toBe("discard");
  });

  // 「かわりに1つ捨札にすれば」— 任意
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装
  it.fails("RS-325: かわりに捨札にしないことを選べば、発動したカードは捨札になる（出典: atwiki/page-485「捨札にすれば」）", () => {
    let s = shine();
    s = useVia(s, "player1", "RS-011:aura");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:target")) s = pick(s, "TST-UNIT-0:target");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-011:aura")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP-MA:spare")).toBe("command");
  });

  // faq-card-5 RS-325 Q4・Q6（atwiki Q4・Q6）「使いたいオペレーションカード自体をホールドして使用することができます。それとは別にコマンドをホールドする必要はありません。」
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装
  it.fails("RS-325: 公式Q&A — 使うオペレーションカード自体をホールドすればよく、同じカテゴリの別のコマンドをホールドする必要はない（出典: grnrngr/faq-card-5 RS-325 Q4・Q6）", () => {
    let s = shine({ command: [released("RS-011", "aura")] });
    s = useVia(s, "player1", "RS-011:aura");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:target")) s = pick(s, "TST-UNIT-0:target");
    expect(bpOf(s, "player1", "TST-UNIT-0:target")).toBe(3000);
  });

  // atwiki/page-485 Q1「いいえ、そのようにはなりません。…実際には手札から使用していないので、…該当しません。」
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装
  it.fails("RS-325: 公式Q&A — マジチケットで発動したオーズドライバーの「次に手札から使用するカード」の軽減は、続けてマジチケットで発動するカードには適用されない（出典: atwiki/page-485 Q1）", () => {
    let s = shine({ power: 0, command: [released("XG7-054", "ooo"), released("RS-011", "aura")] });
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, power: powerCards(3) } } };
    s = useVia(s, "player1", "XG7-054:ooo");
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, power: powerCards(1) } } };
    expect(actionUsing(s, "player1", "RS-011:aura")).toBeUndefined();
  });

  it.todo("RS-325: 公式Q&A — マジチケットでオーズドライバーを2回発動すると、次に手札から使用するカードの必要パワーは6少なくなる（出典: atwiki/page-485 Q2）— XG7-054 の選択式効果（2つ目の◎）の選び方と「次に手札から使用するカード」の軽減をこのカード範囲で検証する手段が無いため（マジチケット自体も未実装）");

  // faq-card-5 RS-325 Q3「その手順では「RS-255 巨大化爆弾」が捨札になるタイミングがありませんので…ラッシュエリアに留まります。…かわりとして…捨札にするということはできません。」
  it.todo("RS-325: 公式Q&A — マジチケットで巨大化爆弾を使いユニットを重ねてラッシュエリアに出したとき、コマンドを捨札にしなくても巨大化爆弾はラッシュエリアに留まり、かわりに捨札にすることもできない（出典: grnrngr/faq-card-5 RS-325 Q3）— 巨大化爆弾は※カウンター（敵軍ターン中のみ・ユーザー決定）で「怪人」の撃破に応じる手順を要し、マジチケット未実装のため場を作れない");

  // faq-card-5 RS-325 Q5「はい、発動します。」
  // 既知の不具合: CARD-RS-325 【マジチケット】が未実装
  it.fails("RS-325: 公式Q&A — 相手がマジチケットでオペレーションの効果を発動すると、自軍ジェットシーカーの【ラウンドレーダー】は発動する（出典: grnrngr/faq-card-5 RS-325 Q5・faq-card-5 RS-265）", () => {
    let s = shine();
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, rush: [inst("RS-265", "seeker")], power: powerCards(3, "ep") } } };
    s = useVia(s, "player1", "RS-011:aura");
    if (s.pendingEffectChoice?.validInstanceIds.includes("TST-UNIT-0:target")) s = pick(s, "TST-UNIT-0:target");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
  });

  it.todo("RS-325: 公式Q&A — マジチケットで使ったオーラパワーに相手がゴルゴムの仕業を使い無効にされて捨札になるときも、リリース状態のコマンドをかわりに捨札にしてコマンドゾーンに留められる（出典: grnrngr/faq-card-1 RS-011・atwiki/page-485 Q7）— ゴルゴムの仕業は※カウンター（敵軍ターン中のみ）で、マジチケット未実装のため使用宣言の場を作れない");
  it.todo("RS-325: 公式Q&A — マジチケットで超・電王トリロジーを発動すると、使用のためにホールドしたコマンドが存在しないとして効果の解決に失敗し、捨札になる（出典: atwiki/page-485 Q8）— SX-008 のカテゴリ別効果の解決をこのカード範囲で検証する手段が無く、マジチケットも未実装のため");
});

// ===========================================================================
describe("RS-326 魔法猫スモーキー", () => {
  const TEXT =
    "【究極奥義・猫だまし】自分の手札からBP16000以下のLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。この効果で出したユニットは、アタックもストライクもできず、自分がターンを終えるとき捨札になる。";

  it("RS-326: カタログ本文・スペックが出典と一致（出典: atwiki/page-487）", () => {
    expectCatalogText("RS-326", TEXT);
    expectStats("RS-326", {
      name: "魔法猫スモーキー",
      category: "MA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 3,
      features: ["魔法"],
    });
  });

  function smokey(pos: number, hand: ReturnType<typeof inst>[]) {
    const s = st(
      {
        player1: { battle: fillers(pos - 1), rush: [inst("RS-326", "sm")], hand, deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "eb")], power: powerCards(3, "ep"), deck: deckCards(3, "e") },
      },
      SPECS,
    );
    return enter(s, "RS-326:sm");
  }

  // 「自分の手札からBP16000以下のLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい」
  // 既知の不具合: CARD-RS-326 【猫だまし】が手札の L ユニットではなく敵軍ユニットを選ばせ、それをラッシュエリアに移す
  it.fails("RS-326: 3番目に出ると、手札の BP16000 以下の L ユニットを1枚選んで自軍ラッシュエリアに出す（BP17000 や M は選べない）（出典: atwiki/page-487）", () => {
    let s = smokey(3, [inst("SPEC-L16K", "l"), inst("SPEC-L17K", "big"), inst("SPEC-M", "m")]);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-L16K:l"]);
    s = pick(s, "SPEC-L16K:l");
    expect(zoneOf(s, "player1", "SPEC-L16K:l")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  // 「出してもよい」
  // 既知の不具合: CARD-RS-326 【猫だまし】の候補が手札の L ユニットにならない
  it.fails("RS-326: 出さないことを選べる（任意）（出典: atwiki/page-487「出してもよい」）", () => {
    let s = smokey(3, [inst("SPEC-L16K", "l")]);
    expect(choiceIds(s)).toEqual(["SPEC-L16K:l"]);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "SPEC-L16K:l")).toBe("hand");
  });

  // 「この効果で出したユニットは、アタックもストライクもできず、自分がターンを終えるとき捨札になる」
  // 既知の不具合: CARD-RS-326 【猫だまし】で L ユニットを出せない
  it.fails("RS-326: この効果で出した L ユニットはバトルエリアに出てもアタックもストライクもできず、ターンを終えるとき捨札になる（出典: atwiki/page-487）", () => {
    let s = smokey(3, [inst("SPEC-L16K", "l")]);
    s = pick(s, "SPEC-L16K:l");
    s = settle(s);
    s = enter(s, "SPEC-L16K:l");
    expect(attackTargets(s, "SPEC-L16K:l")).toEqual([]);
    expect(canStrike(s, "SPEC-L16K:l")).toBe(false);
    s = endTurn(s);
    expect(zoneOf(s, "player1", "SPEC-L16K:l")).toBe("discard");
  });

  it("RS-326: 3番目以外で出たとき（NC 不成立）は発動しない（出典: atwiki/page-487「CN：3」・R-CN-02）", () => {
    const s = smokey(2, [inst("SPEC-L16K", "l")]);
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player1", "SPEC-L16K:l")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-326 【猫だまし】が手札に L ユニットが無くても敵軍ユニットを候補にした選択を出す
  it.fails("RS-326: 手札に BP16000 以下の L ユニットがなければ何も起きない（敵軍ユニットには触れない）（出典: atwiki/page-487）", () => {
    const s = smokey(3, [inst("SPEC-L17K", "big")]);
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("battle");
  });

  it.todo("RS-326: 公式Q&A — 猫だましで出したダイボウケンを、天時星・時間返しでやり直したラッシュフェイズでスーパーダイボウケンの合体に使ったなら、スーパーダイボウケンはターン終了時に捨札にならない（出典: grnrngr/faq-card-2/4 RS-326）— 【猫だまし】で L ユニットを出せない（CARD-RS-326）うえ、RS-208 のやり直しと RS-236 の合体ラッシュを重ねた手順が前提になるため");
  it.todo("RS-326: 公式Q&A — 猫だましで出したタイムロボβが【チェンジフォーメーション】でタイムロボαと置き換わったなら、αは捨札にならない（出典: grnrngr/faq-card-6 RS-394）— 同上（L ユニットを出せず、RS-394/395 の置き換えと RK-026 の手順が前提になるため）");
});

void [bpOf, actionUsing];
