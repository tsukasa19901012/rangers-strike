/**
 * カード別スペック: RS-160〜RS-170（第3弾「三界の獅子」ガオレンジャー・オルグ・ジャカンジャ ほか）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-3（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）
 *     ほか card_1/card_2/card_4/card_5/card_6 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { unitEffectiveCategories } from "../index";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  drain,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  passEntry,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  substitutes,
  tryAct,
  useNinja,
  zoneIds,
  zoneOf,
} from "./RS3-151-178.helpers";
import type { GameState, PlayerId } from "../types/game";

const S7000 = sUnit("SPEC-S7000", { bp: 7000, sp: undefined });
const M4000 = sUnit("SPEC-M4000", { size: "M", bp: 4000, sp: undefined });
const DA_AIR = sUnit("SPEC-DA-AIR", { category: "DA", features: ["航空機"], powerCost: 4, bp: 3000, sp: undefined });
const DA_S4 = sUnit("SPEC-DA-S4", { category: "DA", powerCost: 4, bp: 3000, sp: undefined });

/** NC 位置まで fillers を並べて、手札でなくラッシュエリアから unitId を出す。 */
function enterAt(unitId: string, position: number, opts: { activePlayer?: PlayerId; p2?: Partial<GameState["players"]["player2"]> } = {}, extra: ReturnType<typeof sUnit>[] = []) {
  let s = st(
    {
      activePlayer: opts.activePlayer ?? "player1",
      player1: { battle: fillers(position - 1), rush: [inst(unitId, "u")], deck: deckCards(3) },
      player2: { power: powerCards(3, "e"), deck: deckCards(3, "e"), ...opts.p2 },
    },
    extra,
  );
  s = enter(s, `${unitId}:u`);
  return s;
}

// ===========================================================================
describe("RS-160 ガオレッド", () => {
  it("RS-160: カタログ本文・スペックが出典と一致（出典: atwiki/page-603）", () => {
    expectCatalogText("RS-160", "【ブレイジングファイヤー】「SP1」自軍ターン中、このユニットはBP+2000される。");
    expectStats("RS-160", {
      name: "ガオレッド",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["レッド", "男"],
    });
  });

  // CN2「【ブレイジングファイヤー】「SP1」自軍ターン中、このユニットはBP+2000される。」
  it("RS-160: CN2 — 2番目に出ると「SP1」になりストライクで1点与える（出典: atwiki/page-603）", () => {
    let s = enterAt("RS-160", 2);
    expect(canStrike(s, "RS-160:u")).toBe(true);
    s = settle(strike(s, "RS-160:u"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-160: CN2 — 2番目に出ると自軍ターン中 BP+2000（4000）（出典: atwiki/page-603）", () => {
    const s = enterAt("RS-160", 2);
    expect(bpOf(s, "player1", "RS-160:u")).toBe(4000);
  });

  // R-CN-02：NC の効果は並び順が CN と一致したときだけ。atwiki/page-603「NCでBPを＋にできるが、ストライクとの2択」
  it.fails("RS-160: 2番目以外（1番目）に出たときは BP+2000 されない（NC 不成立）（出典: atwiki/page-603・R-CN-02）", () => {
    // 既知の不具合: CARD-RS-160 【ブレイジングファイヤー】の BP+2000 が NC 成立を問わず自軍ターン中は常に適用される
    const s = enterAt("RS-160", 1);
    expect(canStrike(s, "RS-160:u")).toBe(false);
    expect(bpOf(s, "player1", "RS-160:u")).toBe(2000);
  });

  it("RS-160: 敵軍ターン中は BP+2000 されない（出典: atwiki/page-603「自軍ターン中」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [inst("TST-UNIT-0", "f"), inst("RS-160", "u")] } });
    expect(bpOf(s, "player1", "RS-160:u")).toBe(2000);
  });
});

// ===========================================================================
describe("RS-161 ガオイエロー", () => {
  it("RS-161: カタログ本文・スペックが出典と一致（出典: atwiki/page-344）", () => {
    expectCatalogText("RS-161", "【ノーブルスラッシュ】「SP1」");
    expectStats("RS-161", {
      name: "ガオイエロー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["イエロー", "男"],
    });
  });

  it("RS-161: CN2 — 2番目に出ると「SP1」になりストライクで1点与える（出典: atwiki/page-344）", () => {
    let s = enterAt("RS-161", 2);
    expect(canStrike(s, "RS-161:u")).toBe(true);
    s = settle(strike(s, "RS-161:u"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-161: 1番目に出たときは「SP！」のままでストライクできない（出典: atwiki/page-344・R-CN-02）", () => {
    expect(canStrike(enterAt("RS-161", 1), "RS-161:u")).toBe(false);
  });
});

// ===========================================================================
describe("RS-162 ガオブルー", () => {
  it("RS-162: カタログ本文・スペックが出典と一致（出典: atwiki/page-345）", () => {
    expectCatalogText("RS-162", "【サージングチョッパー】自軍ターン中、Sユニットとバトルするとき、このユニットはBP+5000される。");
    expectStats("RS-162", {
      name: "ガオブルー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  // CN3「自軍ターン中、Sユニットとバトルするとき、このユニットはBP+5000される」
  it("RS-162: CN3 — 3番目に出て S ユニット（BP7000）とバトルすると BP8000 で勝つ（出典: atwiki/page-345）", () => {
    let s = enterAt("RS-162", 3, { p2: { battle: [inst("SPEC-S7000", "e")] } }, [S7000]);
    s = settle(attack(s, "RS-162:u", "SPEC-S7000:e"));
    expect(zoneOf(s, "player2", "SPEC-S7000:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-162:u")).toBe("battle");
  });

  it("RS-162: M ユニット（BP4000）とのバトルでは BP+5000 されず負ける（出典: atwiki/page-345「Sユニットとバトルするとき」）", () => {
    let s = enterAt("RS-162", 3, { p2: { battle: [inst("SPEC-M4000", "e")] } }, [M4000]);
    s = settle(attack(s, "RS-162:u", "SPEC-M4000:e"));
    expect(zoneOf(s, "player1", "RS-162:u")).toBe("discard");
  });

  it.fails("RS-162: 3番目以外（1番目）に出たときは NC 不成立で BP+5000 されない（出典: atwiki/page-345・R-CN-02）", () => {
    // 既知の不具合: CARD-RS-162 【サージングチョッパー】が NC 成立を問わず自軍ターン中のアタックで常に BP+5000 される
    let s = enterAt("RS-162", 1, { p2: { battle: [inst("SPEC-S7000", "e")] } }, [S7000]);
    s = settle(attack(s, "RS-162:u", "SPEC-S7000:e"));
    expect(zoneOf(s, "player1", "RS-162:u")).toBe("discard");
  });

  it("RS-162: 敵軍ターン中に S ユニットにアタックされたときは BP+5000 されない（出典: atwiki/page-345「自軍ターン中」）", () => {
    // BP1000 のアタッカーには BP3000 のままでも勝つため、BP4000 の S を使う
    const S4 = sUnit("SPEC-S4000", { bp: 4000 });
    let s = st({ player1: { battle: [inst("SPEC-S4000", "a")] }, player2: { battle: fillers(2, "e").concat([inst("RS-162", "blue")]) } }, [S4]);
    s = settle(attack(s, "SPEC-S4000:a", "RS-162:blue"));
    expect(zoneOf(s, "player2", "RS-162:blue")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-163 ガオブラック", () => {
  it("RS-163: カタログ本文・スペックが出典と一致（出典: atwiki/page-346）", () => {
    expectCatalogText("RS-163", "【アイアンブロークン】自軍ターン中、このユニットはBP+3000される。");
    expectStats("RS-163", {
      name: "ガオブラック",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 4,
      features: ["ブラック", "男"],
    });
  });

  it("RS-163: CN4 — 4番目に出ると自軍ターン中 BP+3000（6000）（出典: atwiki/page-346）", () => {
    const s = enterAt("RS-163", 4);
    expect(bpOf(s, "player1", "RS-163:u")).toBe(6000);
  });

  it.fails("RS-163: 4番目以外（1番目）に出たときは NC 不成立で BP+3000 されない（出典: atwiki/page-346・R-CN-02）", () => {
    // 既知の不具合: CARD-RS-163 【アイアンブロークン】が NC 成立を問わず自軍ターン中は常に BP+3000 される
    const s = enterAt("RS-163", 1);
    expect(bpOf(s, "player1", "RS-163:u")).toBe(3000);
  });

  it("RS-163: 敵軍ターン中は BP+3000 されない（出典: atwiki/page-346「自軍ターン中」）", () => {
    const s = st({ activePlayer: "player2", player1: { battle: [...fillers(3), inst("RS-163", "u")] } });
    expect(bpOf(s, "player1", "RS-163:u")).toBe(3000);
  });
});

// ===========================================================================
describe("RS-164 ガオホワイト", () => {
  it("RS-164: カタログ本文・スペックが出典と一致（出典: atwiki/page-347）", () => {
    expectCatalogText("RS-164", "【白虎十文字斬り】「SP1」");
    expectStats("RS-164", {
      name: "ガオホワイト",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 2,
      comboNumber: 2,
      features: ["ホワイト", "女"],
    });
  });

  it("RS-164: CN2 — 2番目に出ると「SP1」になりストライクで1点与える（出典: atwiki/page-347）", () => {
    let s = enterAt("RS-164", 2);
    expect(canStrike(s, "RS-164:u")).toBe(true);
    s = settle(strike(s, "RS-164:u"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-164: 1番目に出たときは「SP！」のままでストライクできない（出典: atwiki/page-347・R-CN-02）", () => {
    expect(canStrike(enterAt("RS-164", 1), "RS-164:u")).toBe(false);
  });
});

// ===========================================================================
describe("RS-165 狼鬼", () => {
  it("RS-165: カタログ本文・スペックが出典と一致（出典: atwiki/page-337）", () => {
    expectCatalogText(
      "RS-165",
      "※これは自分の手札からカードを2枚選んで捨札にしなければバトルエリアに出られない。【ムーンライトソニック】これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる。",
    );
    expectStats("RS-165", {
      name: "狼鬼",
      category: "DA",
      size: "S",
      bp: 5000,
      sp: 1,
      powerCost: 4,
      features: ["デュークオルグ", "男"],
    });
  });

  // 「※これは自分の手札からカードを2枚選んで捨札にしなければバトルエリアに出られない」
  it("RS-165: ※ 手札を2枚選んで捨札にしてバトルエリアに出る（出典: atwiki/page-337）", () => {
    let s = st({ player1: { rush: [inst("RS-165", "w")], hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2"), inst("TST-OP", "h3")] } });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-165:w" });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP:h1", "TST-OP:h2", "TST-OP:h3"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:h1" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:h3" });
    if (zoneOf(s, "player1", "RS-165:w") !== "battle") s = enter(s, "RS-165:w");
    expect(zoneOf(s, "player1", "RS-165:w")).toBe("battle");
    expect(zoneIds(s, "player1", "hand")).toEqual(["TST-OP:h2"]);
    expect(zoneIds(s, "player1", "discard")).toEqual(expect.arrayContaining(["TST-OP:h1", "TST-OP:h3"]));
  });

  it("RS-165: ※ 手札が1枚以下なら出られない（出典: atwiki/page-337）", () => {
    const s = st({ player1: { rush: [inst("RS-165", "w")], hand: [inst("TST-OP", "h1")] } });
    expect(canEnter(s, "RS-165:w")).toBe(false);
  });

  // 「これはアタックするとき、敵軍ラッシュエリアのユニットにアタックできる」
  it("RS-165: 敵軍ラッシュエリアのユニット（S・M）とバトルエリアのユニットにアタックできる（出典: atwiki/page-337）", () => {
    const s = st({
      player1: { battle: [inst("RS-165", "w")] },
      player2: { rush: [inst("TST-UNIT-0", "rs"), inst("TST-UNIT-2", "rm")], battle: [inst("TST-UNIT-0", "bs")] },
    });
    const targets = attackTargets(s, "RS-165:w");
    expect(targets).toEqual(expect.arrayContaining(["TST-UNIT-0:rs", "TST-UNIT-2:rm", "TST-UNIT-0:bs"]));
  });

  it("RS-165: ラッシュエリアのユニットにアタックして勝てば撃破する（出典: atwiki/page-337）", () => {
    let s = st({ player1: { battle: [inst("RS-165", "w")] }, player2: { rush: [inst("TST-UNIT-2", "rm")] } });
    s = settle(attack(s, "RS-165:w", "TST-UNIT-2:rm"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:rm")).toBe("discard");
  });

  /** 敵軍（player2）のデカグリーン（CN3）で、player1 の狼鬼をバトルエリアに引き出す。 */
  function pulledByGreen(hand: ReturnType<typeof inst>[]) {
    let s = st({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-108", "green")], deck: deckCards(3, "e") },
      player1: { rush: [inst("RS-165", "w")], hand, deck: deckCards(3) },
    });
    s = enter(s, "RS-108:green", "player2");
    const pick = tryAct(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-165:w" });
    if (pick.ok) s = pick.state;
    if (s.pendingEffectChoice?.playerId === "player2" && legalOfType(s, "confirm_effect_choice").length > 0) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player2" });
    }
    s = settle(s);
    for (let i = 0; i < 3 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const p = legal(s).find((a) => a.type === "resolve_effect_choice" && a.playerId === "player1");
      if (!p) break;
      s = act(s, p);
    }
    return s;
  }

  // faq-card-3 RS-165 Q1「手札を２枚捨札にして「RS-165 狼鬼」をバトルエリアに出さなければなりません」
  it("RS-165: 公式Q&A — 敵軍デカグリーンで引き出されたとき、手札が2枚以上なら2枚捨ててバトルエリアに出る（出典: grnrngr/faq-card-3 RS-165 Q1）", () => {
    const s = pulledByGreen([inst("TST-OP", "h1"), inst("TST-OP", "h2")]);
    expect(zoneOf(s, "player1", "RS-165:w")).toBe("battle");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // 同「手札が１枚以下であれば、「RS-165 狼鬼」はラッシュエリアに留まります」
  it("RS-165: 公式Q&A — 手札が1枚以下ならラッシュエリアに留まる（出典: grnrngr/faq-card-3 RS-165 Q1）", () => {
    const s = pulledByGreen([inst("TST-OP", "h1")]);
    expect(zoneOf(s, "player1", "RS-165:w")).toBe("rush");
    expect(s.players.player1.hand).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-166 ガインガイン", () => {
  it("RS-166: カタログ本文・スペックが出典と一致（出典: atwiki/page-338）", () => {
    expectCatalogText("RS-166", "※これはバトルエリアにあるとき、カテゴリに「MA」が追加される。");
    expectStats("RS-166", {
      name: "ガインガイン",
      category: "DA",
      size: "L",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "人型"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体捨札にする」
  it("RS-166: 追加条件（自軍 S ユニットを1体捨札にする）を満たしてラッシュでき、S がなければラッシュできない（出典: atwiki/page-338）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) =>
      st({ phase: "rush", player1: { hand: [inst("RS-166", "g")], rush, command: releasedN(2, "TST-OP-DA", "da"), power: powerCards(4) } });
    expect(canStartRush(mk([inst("TST-UNIT-2", "m")]), "player1", "RS-166:g")).toBe(false);
    const r = rushFromHand(mk([inst("TST-UNIT-0", "s")]), "player1", "RS-166:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-166:g")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  // 「※これはバトルエリアにあるとき、カテゴリに「MA」が追加される」
  it("RS-166: ※ バトルエリアでは DA に MA が追加され、ラッシュエリアでは DA のみ（出典: atwiki/page-338）", () => {
    const g = inst("RS-166", "g");
    const inBattle = st({ player1: { battle: [g] } });
    expect(unitEffectiveCategories(inBattle, "player1", g, "battle")).toEqual(expect.arrayContaining(["DA", "MA"]));
    const inRush = st({ player1: { rush: [g] } });
    expect(unitEffectiveCategories(inRush, "player1", g, "rush")).not.toContain("MA");
  });

  // faq-card-3 RS-166 Q1「はい、「SP1」になります。」
  it.fails("RS-166: 公式Q&A — MA のトータスハンマーからコンビネーションさせると「SP1」になりストライクで1点与える（出典: grnrngr/faq-card-3 RS-166 Q1・faq-card-4 RS-224）", () => {
    // 既知の不具合: CARD-RS-166 トータスハンマー（RS-224）からの JC が成立せず（ログなし）、ガインガインが「SP1」にならない（MA の L ユニット一般でも同じ）
    let s = st({
      player1: { battle: [inst("RS-224", "th")], rush: [inst("RS-166", "g")], deck: deckCards(3) },
      player2: { power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-166:g");
    expect(canStrike(s, "RS-166:g")).toBe(true);
    s = settle(strike(s, "RS-166:g"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-166: トータスハンマーがなければ「SP」は空欄のままでストライクできない（出典: atwiki/page-338「SP：－」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-0", "f")], rush: [inst("RS-166", "g")] } });
    expect(canStrike(enter(s, "RS-166:g"), "RS-166:g")).toBe(false);
  });

  it.todo(
    "RS-166: 公式Q&A（RS-364 側）— バトルエリアで DA と MA を持つガインガインがいてもヘルサターン総統【黒き太陽神への忠誠】の「自軍ユニットがすべてDAなら」は満たす（出典: grnrngr/faq-card-6 RS-364 Q）— RS-364 の効果の適用（BP8000以上の DA の ※ホールド付与）を観測する手段が RS-364 側の仕様検証になり、本カードの範囲外",
  );
});

// ===========================================================================
describe("RS-167 爆竜バキケロナグルス", () => {
  it("RS-167: カタログ本文・スペックが出典と一致（出典: atwiki/page-94）", () => {
    expectCatalogText(
      "RS-167",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【爆竜必殺バキバキパンチ】このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒アタックしてバトルに勝つたび、追加でアタックできる（ストライクはできない）。",
    );
    expectStats("RS-167", {
      name: "爆竜バキケロナグルス",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      comboNumber: "L" as never,
      features: ["恐竜"],
    });
  });

  it("RS-167: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-94）", () => {
    const none = st({ player1: { rush: [inst("RS-167", "b")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-167:b")).toBe(false);
  });

  /** バキケロ（左）→ L ユニット（右）。 */
  function bakiThen(lId: string, p2: Partial<GameState["players"]["player2"]>, extra: ReturnType<typeof sUnit>[] = []) {
    let s = st(
      {
        player1: { rush: [inst("RS-167", "b"), inst(lId, "L")], command: [released("TST-OP", "c")], deck: deckCards(3) },
        player2: { power: powerCards(3, "e"), deck: deckCards(3, "e"), ...p2 },
      },
      extra,
    );
    s = passEntry(enterWithHold(s, "RS-167:b", ["TST-OP:c"]));
    s = enter(s, `${lId}:L`);
    return s;
  }

  // 「アタックしてバトルに勝つたび、追加でアタックできる」
  it.fails("RS-167: JC した同カテゴリの L ユニットは、アタックしてバトルに勝つたびに追加でアタックできる（2回勝てば3回目も）（出典: atwiki/page-94）", () => {
    // 既知の不具合: CARD-RS-167 JC は成立（joint_combo_l ログ）するが、L ユニットがバトルに勝っても追加でアタックできない（得た能力の判定が「左隣の L サイズのユニット」を見ており並びと逆）
    let s = bakiThen("TST-UNIT-7", { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")] });
    s = settle(attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e1"));
    expect(attackTargets(s, "TST-UNIT-7:L")).toContain("TST-UNIT-0:e2");
    s = settle(attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e2"));
    expect(attackTargets(s, "TST-UNIT-7:L")).toContain("TST-UNIT-0:e3");
  });

  // 「（ストライクはできない）」
  it("RS-167: 追加のアタック権ではストライクできない（出典: atwiki/page-94「ストライクはできない」）", () => {
    let s = bakiThen("TST-UNIT-7", { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] });
    s = settle(attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e1"));
    expect(canStrike(s, "TST-UNIT-7:L")).toBe(false);
  });

  it("RS-167: バトルに負けた（引き分けを含まない、相手が残る）ときは追加でアタックできない（出典: atwiki/page-94「バトルに勝つたび」）", () => {
    const BIG = sUnit("SPEC-BIG20", { size: "L", bp: 20000 });
    let s = bakiThen("TST-UNIT-7", { battle: [inst("SPEC-BIG20", "big"), inst("TST-UNIT-0", "e2")] }, [BIG]);
    s = settle(attack(s, "TST-UNIT-7:L", "SPEC-BIG20:big"));
    expect(zoneOf(s, "player1", "TST-UNIT-7:L")).toBe("discard");
    expect(attackTargets(s, "TST-UNIT-7:L")).toEqual([]);
  });

  it("RS-167: カテゴリが違う（ET）L ユニットは能力を得ない（出典: atwiki/page-94「同カテゴリのLユニット」）", () => {
    const ETL = sUnit("SPEC-ET-L", { size: "L", category: "ET", bp: 13000 });
    let s = bakiThen("SPEC-ET-L", { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] }, [ETL]);
    s = settle(attack(s, "SPEC-ET-L:L", "TST-UNIT-0:e1"));
    expect(attackTargets(s, "SPEC-ET-L:L")).toEqual([]);
  });

  it("RS-167: バキケロがいなければ L ユニットは1回しかアタックできない（出典: atwiki/page-94）", () => {
    let s = st({ player1: { rush: [inst("TST-UNIT-7", "L")] }, player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] } });
    s = enter(s, "TST-UNIT-7:L");
    s = settle(attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e1"));
    expect(attackTargets(s, "TST-UNIT-7:L")).toEqual([]);
  });

  // faq-card-3 RS-167 Q1「一度発動すれば「RS-167 爆竜バキケロナグルス」が撃破されても有効のままになります」
  it.fails("RS-167: 公式Q&A — L ユニットのアタックに隠流忍術でバキケロが選ばれ撃破されても、能力は有効のまま（勝てば追加でアタックできる）（出典: grnrngr/faq-card-3 RS-167 Q1）", () => {
    // 既知の不具合: CARD-RS-167 追加アタックの能力自体が L ユニットに付かない（上記と同じ原因）
    let s = bakiThen("TST-UNIT-7", {
      battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")],
      hand: [inst("RS-018", "n")],
      command: releasedN(2, "TST-OP-MA", "ma"),
      power: powerCards(5, "e"),
    });
    s = attack(s, "TST-UNIT-7:L", "TST-UNIT-0:e1");
    s = settle(useNinja(s, "RS-018:n", "RS-167:b"));
    expect(zoneOf(s, "player1", "RS-167:b")).toBe("discard");
    expect(attackTargets(s, "TST-UNIT-7:L")).toContain("TST-UNIT-0:e1");
  });
});

// ===========================================================================
describe("RS-168 爆竜ディメノコドン", () => {
  it("RS-168: カタログ本文・スペックが出典と一致（出典: atwiki/page-95）", () => {
    expectCatalogText(
      "RS-168",
      "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【爆竜必殺クロスサンダー】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒BP5000以下のユニットを自軍と敵軍の場から1体ずつ選んで撃破する。",
    );
    expectStats("RS-168", {
      name: "爆竜ディメノコドン",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      comboNumber: "R" as never,
      features: ["恐竜"],
    });
  });

  it("RS-168: ※ コマンドを1つホールドしなければ出られない（出典: atwiki/page-95）", () => {
    const none = st({ player1: { rush: [inst("RS-168", "d")], command: [held("TST-OP", "h")] } });
    expect(canEnter(none, "RS-168:d")).toBe(false);
  });

  const BP6 = sUnit("SPEC-BP6000", { bp: 6000 });

  /** L ユニット（左）→ ディメノ（右）。 */
  function lThenDimeno(lId: string, extra: ReturnType<typeof sUnit>[] = []) {
    let s = st(
      {
        player1: {
          battle: [inst(lId, "L")],
          rush: [inst("RS-168", "d"), inst("TST-UNIT-0", "ownR"), inst("SPEC-BP6000", "own6")],
          command: [released("TST-OP", "c")],
        },
        player2: { battle: [inst("TST-UNIT-2", "eB"), inst("SPEC-BP6000", "e6")], rush: [inst("TST-UNIT-0", "eR")] },
      },
      [BP6, ...extra],
    );
    s = enterWithHold(s, "RS-168:d", ["TST-OP:c"]);
    return s;
  }

  // 「BP5000以下のユニットを自軍と敵軍の場から1体ずつ選んで撃破する」
  it("RS-168: 同カテゴリの L ユニットからコンビネーションすると、BP5000 以下の自軍・敵軍のユニットを1体ずつ選んで撃破する（出典: atwiki/page-95）", () => {
    let s = lThenDimeno("TST-UNIT-7");
    expect(s.pendingEffectChoice?.effectId).toBe("cross_thunder");
    const first = choiceIds(s);
    expect(first).not.toContain("SPEC-BP6000:own6");
    expect(first).not.toContain("SPEC-BP6000:e6");
    s = drain(s, "player1", ["TST-UNIT-0:ownR", "TST-UNIT-2:eB"]);
    if (s.pendingEffectChoice?.playerId === "player1" && legalOfType(s, "confirm_effect_choice").length > 0) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:ownR")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:eB")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:eR")).toBe("rush");
  });

  it("RS-168: 効果を発動しない（任意）こともできる（出典: atwiki/page-95「次の効果を発動できる」）", () => {
    let s = lThenDimeno("TST-UNIT-7");
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(zoneOf(s, "player1", "TST-UNIT-0:ownR")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-2:eB")).toBe("battle");
  });

  it("RS-168: カテゴリが違う（ET）L ユニットからでは発動しない（出典: atwiki/page-95「同カテゴリのLユニット」）", () => {
    const ETL = sUnit("SPEC-ET-L", { size: "L", category: "ET", bp: 13000 });
    const s = lThenDimeno("SPEC-ET-L", [ETL]);
    expect(s.pendingEffectChoice?.effectId).not.toBe("cross_thunder");
  });

  it("RS-168: 左隣が L ユニットでなければ発動しない（出典: atwiki/page-95「Lユニットからコンビネーションする」）", () => {
    const s = lThenDimeno("TST-UNIT-2");
    expect(s.pendingEffectChoice?.effectId).not.toBe("cross_thunder");
  });
});

// ===========================================================================
describe("RS-169 ファンクラッシャー", () => {
  it("RS-169: カタログ本文・スペックが出典と一致（出典: atwiki/page-339）", () => {
    expectCatalogText("RS-169", "【地球資源吸収】これをラッシュしたとき、リリース状態の自軍コマンドがあれば、すべて自軍山札の上に好きな順で戻す。");
    expectStats("RS-169", {
      name: "ファンクラッシャー",
      category: "DA",
      size: "L",
      bp: 5000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ"],
      rushCondition: "send_s_unit_to_discard",
    });
  });

  function rushFan(command: ReturnType<typeof inst>[], rush: ReturnType<typeof inst>[] = [inst("TST-UNIT-0", "s")]) {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-169", "f")], rush, command, power: powerCards(6), deck: [inst("TST-OP", "deck0")] },
    });
    return rushFromHand(s, "player1", "RS-169:f");
  }

  // 「リリース状態の自軍コマンドがあれば、すべて自軍山札の上に好きな順で戻す」
  it("RS-169: ラッシュしたとき、リリース状態の自軍コマンドをすべて山札の上に戻す（ホールド状態は残る）（出典: atwiki/page-339）", () => {
    const r = rushFan([released("TST-OP-DA", "da"), released("TST-OP", "w1"), released("TST-OP", "w2"), held("TST-OP", "h")]);
    expect(r.ok).toBe(true);
    let s = r.state;
    for (let i = 0; i < 6 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      const a = legal(s).find((x) => (x.type === "resolve_effect_choice" || x.type === "confirm_effect_choice") && x.playerId === "player1");
      if (!a) break;
      s = act(s, a);
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-169:f")).toBe("rush");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player1", "TST-OP:w1")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-OP:w2")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-OP:h")).toBe("command");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-OP:deck0");
  });

  it.todo(
    "RS-169: 戻す順番は自分で選ぶ（出典: atwiki/page-339「好きな順で戻す」）— 公開アクションで順番を指定する手段（並べ替えの選択）がエンジンに無い",
  );

  it.todo(
    "RS-169: 公式Q&A — 山札に戻す順番は相手にも公開する（出典: grnrngr/faq-card-3 RS-169 Q1・RS-137）— 公開・非公開の情報管理（UI 表示）であり、エンジンの状態遷移として観測できない",
  );

  // faq-card-3 RS-169 Q2「はい、できます。ユニットをラッシュするときは、「必要パワー」を満たしていることを確認してから、「追加条件」があればそれを満たす」
  it("RS-169: 公式Q&A — アブレラで必要パワー不足を補い、そのアブレラを追加条件で捨札にしてラッシュできる（出典: grnrngr/faq-card-3 RS-169 Q2）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-169", "f")],
        rush: [inst("RS-170", "ab")],
        power: powerCards(4),
        command: releasedN(4, "TST-OP-DA", "d"),
      },
    });
    const r = rushFromHand(s0, "player1", "RS-169:f", { materials: ["RS-170:ab"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-169:f")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-170:ab")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-170 エージェント・アブレラ", () => {
  it("RS-170: カタログ本文・スペックが出典と一致（出典: atwiki/page-340）", () => {
    expectCatalogText(
      "RS-170",
      "※これは自軍ターン中、バトルエリアに出られない。【闇の取引】これが自軍ラッシュエリアにあるとき、自分がラッシュする「DA」のユニットの必要パワーを満たすために、次のようにしてもよい⇒必要パワーに足りない数だけ、自軍コマンドをホールドする。",
    );
    expectStats("RS-170", {
      name: "エージェント・アブレラ",
      category: "DA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 2,
      features: ["商人", "男"],
    });
  });

  // 「※これは自軍ターン中、バトルエリアに出られない」
  it("RS-170: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-340）", () => {
    const s = st({ player1: { rush: [inst("RS-170", "ab")], command: releasedN(2) } });
    expect(canEnter(s, "RS-170:ab")).toBe(false);
  });

  it("RS-170: ※ 敵軍ターン中なら（デカグリーンで引き出されて）バトルエリアに出る（出典: atwiki/page-340「自軍ターン中」）", () => {
    let s = st({
      activePlayer: "player2",
      player2: { battle: fillers(2, "e"), rush: [inst("RS-108", "green")], deck: deckCards(3, "e") },
      player1: { rush: [inst("RS-170", "ab")], deck: deckCards(3) },
    });
    s = enter(s, "RS-108:green", "player2");
    expect(choiceIds(s)).toContain("RS-170:ab");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RS-170:ab" });
    if (s.pendingEffectChoice?.playerId === "player2" && legalOfType(s, "confirm_effect_choice").length > 0) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player2" });
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-170:ab")).toBe("battle");
  });

  function daRush(opts: { power: number; commands: ReturnType<typeof inst>[]; abreraZone?: "rush" | "battle" | "none"; unit?: string }) {
    const unit = opts.unit ?? "SPEC-DA-S4";
    const zone = opts.abreraZone ?? "rush";
    return st(
      {
        phase: "rush",
        player1: {
          hand: [inst(unit, "u")],
          rush: zone === "rush" ? [inst("RS-170", "ab")] : [],
          battle: zone === "battle" ? [inst("RS-170", "ab")] : [],
          power: powerCards(opts.power),
          command: opts.commands,
        },
      },
      [DA_S4, DA_AIR],
    );
  }

  // 「必要パワーに足りない数だけ、自軍コマンドをホールドする」
  it("RS-170: ラッシュエリアにあれば、必要パワー4の DA ユニットをパワー2枚＋足りない2つ分のコマンドのホールドでラッシュできる（出典: atwiki/page-340）", () => {
    const s0 = daRush({ power: 2, commands: releasedN(3, "TST-OP-DA", "d") });
    const r = rushFromHand(s0, "player1", "SPEC-DA-S4:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "SPEC-DA-S4:u")).toBe("rush");
    // カテゴリ使用の1つ＋不足分2つ
    expect(r.state.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(3);
  });

  it("RS-170: 不足分をホールドできるリリース状態のコマンドがなければラッシュできない（出典: atwiki/page-340「足りない数だけ」）", () => {
    const s0 = daRush({ power: 2, commands: releasedN(2, "TST-OP-DA", "d") });
    expect(rushFromHand(s0, "player1", "SPEC-DA-S4:u").ok).toBe(false);
  });

  it("RS-170: アブレラがラッシュエリアになければ（バトルエリア）補えない（出典: atwiki/page-340「これが自軍ラッシュエリアにあるとき」）", () => {
    const s0 = daRush({ power: 2, commands: releasedN(3, "TST-OP-DA", "d"), abreraZone: "battle" });
    expect(rushFromHand(s0, "player1", "SPEC-DA-S4:u").ok).toBe(false);
  });

  it("RS-170: DA 以外のユニットの必要パワーは補えない（出典: atwiki/page-340「「DA」のユニット」）", () => {
    const WB4 = sUnit("SPEC-WB-S4", { powerCost: 4 });
    const s0 = st(
      { phase: "rush", player1: { hand: [inst("SPEC-WB-S4", "u")], rush: [inst("RS-170", "ab")], power: powerCards(2), command: releasedN(3, "TST-OP", "w") } },
      [WB4],
    );
    expect(rushFromHand(s0, "player1", "SPEC-WB-S4:u").ok).toBe(false);
  });

  it("RS-170: 必要パワーを満たしていれば、補わずに（コマンドをカテゴリ分だけホールドして）ラッシュできる（出典: atwiki/page-340「してもよい」）", () => {
    const s0 = daRush({ power: 4, commands: releasedN(3, "TST-OP-DA", "d") });
    const r = rushFromHand(s0, "player1", "SPEC-DA-S4:u");
    expect(r.ok).toBe(true);
    expect(r.state.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // faq-card-3 RS-170 Q1（faq-card-5 RS-296 にも同じ Q）「必要パワーを満たしていなくてもラッシュエリアに出すことができます」
  it("RS-170: 公式Q&A — アブレラで補ってラッシュした航空機ユニットと同名のユニットを、バラクティカで必要パワー不足のままラッシュエリアに出せる（出典: grnrngr/faq-card-3 RS-170 Q1）", () => {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("SPEC-DA-AIR", "a1"), inst("SPEC-DA-AIR", "a2")],
          rush: [inst("RS-296", "bara"), inst("RS-170", "ab")],
          power: powerCards(3),
          command: releasedN(3, "TST-OP-DA", "d"),
        },
      },
      [DA_AIR],
    );
    const r = rushFromHand(s, "player1", "SPEC-DA-AIR:a1");
    expect(r.ok).toBe(true);
    s = drain(r.state, "player1", ["SPEC-DA-AIR:a2"]);
    s = settle(s);
    expect(zoneOf(s, "player1", "SPEC-DA-AIR:a1")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-DA-AIR:a2")).toBe("rush");
  });

  // faq-card-3 RS-170 Q2「はい、できます。」（シーロンの光）
  it("RS-170: 公式Q&A — シーロンの光で選ばれた DA ユニットの必要パワー不足をアブレラで補える（出典: grnrngr/faq-card-3 RS-170 Q2）", () => {
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("SPEC-DA-AIR", "a1")],
          rush: [inst("RS-170", "ab")],
          operation: [inst("RS-013", "sh")],
          power: powerCards(3),
          command: releasedN(2, "TST-OP-DA", "d"),
        },
        player2: { hand: [] },
      },
      [DA_AIR],
    );
    s = act(s, { type: "shiron_light", playerId: "player1", operationInstanceId: "RS-013:sh" });
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "SPEC-DA-AIR:a1" });
    s = act(s, { type: "confirm_shiron_reveal", playerId: "player2" });
    let r = tryAct(s, { type: "rush", playerId: "player1", instanceId: "SPEC-DA-AIR:a1" });
    if (!r.ok) r = rushFromHand(s, "player1", "SPEC-DA-AIR:a1");
    expect(r.ok).toBe(true);
    s = r.state;
    for (let i = 0; i < 4 && s.pendingCommandPayment?.playerId === "player1"; i++) {
      const p = s.pendingCommandPayment;
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    expect(zoneOf(s, "player1", "SPEC-DA-AIR:a1")).toBe("rush");
    // シーロンの光はカテゴリのホールドを求めない（atwiki/page-254）ので、ホールドは不足分の1つだけ
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // faq-card-3 RS-170 Q3（= RS-169 Q2）
  it("RS-170: 公式Q&A — ファンクラッシャーの不足パワーをアブレラで補い、そのアブレラを追加条件で捨札にできる（出典: grnrngr/faq-card-3 RS-170 Q3）", () => {
    const s0 = st({
      phase: "rush",
      player1: { hand: [inst("RS-169", "f")], rush: [inst("RS-170", "ab")], power: powerCards(4), command: releasedN(4, "TST-OP-DA", "d") },
    });
    const r = rushFromHand(s0, "player1", "RS-169:f", { materials: ["RS-170:ab"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-170:ab")).toBe("discard");
  });

  // faq-card-3 RS-170 Q4「「RS-170 エージェント・アブレラ」の効果を得る為にホールドされたものなので…該当しない」
  it.todo(
    "RS-170: 公式Q&A — 闇の取引でホールドしたコマンドの中の仮面ライダーキバ（XG5-074）では【ファンガイアの王】は発動しない（出典: grnrngr/faq-card-3 RS-170 Q4）— ※モーフ・※コールDA を持つ XG5-074 をコマンドとしてホールドさせる支払い手順（どのコマンドを闇の取引分に充てるか）を公開 API で指定できない",
  );
});

void [bpOf, substitutes, sUnit];
