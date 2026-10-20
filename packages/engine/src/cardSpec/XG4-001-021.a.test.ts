/**
 * カード別スペック: XG4-001〜XG4-007（クロスギャザー ザ・ジェットアクセル 牛靴仮面〜ドラゴンレンジャー（XG4））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-XG4-004 副長ゼルモダ【ワンパーの壺】の修正後テキスト）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に
 *     XG のカードの項はない（「XG4-」とカード名で検索。card_5 にあるのは RS のドラゴンレンジャーの項だけで、XG4-007 とは本文が違う）。
 *     atwiki に転載された公式 Q&A（XG4-004 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG4-NNN.md。XG4-004 はライブ写し pages/2069.txt もある）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-STK-03）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG4-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  advanceToBattle,
  attack,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  canStrike,
  canUseCard,
  cardIn,
  choiceIds,
  deckCards,
  endTurn,
  enemyTurn,
  enterKeep,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOperation,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  featuresOf,
  fill,
  inst,
  lastBattleBps,
  ncEnter,
  nextPhase,
  opUsed,
  p1Battle,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  targetsOf,
  vehicleCard,
  zoneOf,
} from "./XG4-001-021.helpers";

const GRUNT = sUnit("SPEC-GRUNT", { category: "DA", bp: 1000, features: ["戦闘員"] });
const GRUNT_V = vehicleCard("SPEC-GRUNT-V", { category: "DA", features: ["戦闘員", "車両"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "DA", bp: 1000 });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "DA", bp: 3000, size: "M" });
const ONRUSH_S = sUnit("SPEC-ONRUSH-S", { category: "DA", bp: 1000 });
const CAR_V = vehicleCard("SPEC-CAR-V", { category: "DA", features: ["車両"] });
const MECHA_V = vehicleCard("SPEC-MECHA-V", { category: "DA", features: ["メカ"] });
const COST = (n: number | string, suffix = String(n)) => sUnit(`SPEC-COST-${suffix}`, { powerCost: n, bp: 1000 });
const COSTS = [COST(0), COST(2), COST(3), COST(4), COST("7-", "7m"), COST("3+", "3p")];
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 2000 });
const WBMA_S = sUnit("SPEC-WBMA-S", { category: ["WB", "MA"], bp: 2000 } as never);
const WB_M = sUnit("SPEC-WB-M", { category: "WB", bp: 3000, size: "M" });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 2000 });
const DINO = sUnit("SPEC-DINO", { category: "WB", bp: 3000, features: ["恐竜"] });
const E_WEAK = sUnit("SPEC-E-WEAK", { bp: 500, sp: undefined });
const EXTRA = [GRUNT, GRUNT_V, PLAIN, PLAIN_M, ONRUSH_S, CAR_V, MECHA_V, ...COSTS, WB_S, WBMA_S, WB_M, MA_S, DINO, E_WEAK];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-001 牛靴仮面", () => {
  const TEXT = "【黒十字ハリケーン】このターン、このユニットは、特徴「戦闘員」を持つ自軍ユニット1体につきBP+1000され、BP8000以上のときSP2になる。";

  it("XG4-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-2102）", () => {
    expectCatalogText("XG4-001", TEXT);
    expectUnit("XG4-001", { name: "牛靴仮面", category: "DA", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 5, features: ["怪人", "男"] });
    expectRarityIn("XG4-001", ["NR"]);
  });

  /** 戦闘員 grunts 体をバトルエリアの前に、rushGrunts 体をラッシュエリアに置き、牛靴仮面を pos 番目に出す。 */
  const nc = (fillerCount: number, battleGrunts: number, rushGrunts: number, p2: Partial<GameState["players"]["player2"]> = {}) => {
    const battle = [...Array.from({ length: battleGrunts }, (_, i) => inst("SPEC-GRUNT", `b${i}`)), ...fill(fillerCount - battleGrunts)];
    return resolveAll(
      ncEnter("XG4-001:u", 0, { battle, rush: Array.from({ length: rushGrunts }, (_, i) => inst("SPEC-GRUNT", `r${i}`)) }, p2, EXTRA),
    );
  };

  it("XG4-001: NC【黒十字ハリケーン】— バトルエリアの5番目に出ると、特徴「戦闘員」を持つ自軍ユニット（ラッシュエリアを含む）1体につき BP+1000（出典: atwiki/page-2102「特徴「戦闘員」を持つ自軍ユニット1体につきBP+1000され」・R-CN-02）", () => {
    const s = nc(4, 2, 1);
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(2000 + 3000);
  });

  it("XG4-001: NC — BP8000 未満なら SP を持たない（印刷の SP は「！」）（出典: atwiki/page-2102「BP8000以上のときSP2になる」）", () => {
    const s = nc(4, 4, 1);
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(7000);
    expect(spOf(s, "player1", "XG4-001:u")).toBe(0);
  });

  it("XG4-001: NC — BP8000 以上なら SP2 になる（出典: atwiki/page-2102「BP8000以上のときSP2になる」）", () => {
    const s = nc(4, 4, 2);
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(8000);
    expect(spOf(s, "player1", "XG4-001:u")).toBe(2);
  });

  it("XG4-001: NC — 敵軍の「戦闘員」は数えない（出典: atwiki/page-2102「自軍ユニット」）", () => {
    const s = nc(4, 0, 0, { battle: [inst("SPEC-GRUNT", "e1"), inst("SPEC-GRUNT", "e2")] });
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(2000);
  });

  it("XG4-001: NC — 5番目以外に出たときは発動しない（出典: atwiki/page-2102・R-CN-02（並び順が CN と一致すると発動））", () => {
    const battle = [inst("SPEC-GRUNT", "b0"), inst("SPEC-GRUNT", "b1"), inst("SPEC-GRUNT", "b2")];
    const s = resolveAll(ncEnter("XG4-001:u", 0, { battle }, {}, EXTRA));
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(2000);
    expect(spOf(s, "player1", "XG4-001:u")).toBe(0);
  });

  it("XG4-001: NC — BP の上昇はこのターンだけ（ターンを終えると印刷の BP に戻る）（出典: atwiki/page-2102「このターン」）", () => {
    // SP2 になるとバトルエリアに出たときストライクを選べるので、ストライクせずに進めてからターンを終える。
    const s = endTurn(act(nc(4, 4, 2), { type: "pass_battle_entry", playerId: "player1" }));
    expect(bpOf(s, "player1", "XG4-001:u")).toBe(2000);
  });
});

// ===========================================================================
describe("XG4-002 テレビ仮面", () => {
  const TEXT =
    "【TV受像機】自軍山札の上から1枚をオモテにする。オモテにしたカードがSユニットのカードなら自軍ラッシュエリアに出す。このとき、出したユニットの効果は発動しない。それ以外なら捨札にする。この効果で出したユニットは、このターン、アタックもストライクもできず、このターンを終えるとき、自軍エリアにあれば捨札にする。";

  it("XG4-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-2093）", () => {
    expectCatalogText("XG4-002", TEXT);
    expectUnit("XG4-002", { name: "テレビ仮面", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["怪人", "男"] });
    expectRarityIn("XG4-002", ["N"]);
  });

  /** テレビ仮面をバトルエリアの1番目に出す（山札は top を一番上に）。 */
  const nc = (top: ReturnType<typeof inst>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(ncEnter("XG4-002:tv", 0, { deck: [top, ...deckCards(3)] }, { battle: [inst("SPEC-E-WEAK", "e")], ...p2 }, EXTRA));

  it("XG4-002: NC【TV受像機】— 1番目に出ると自軍山札の一番上をオモテにし、S ユニットのカードなら自軍ラッシュエリアに出す（出典: atwiki/page-2093「オモテにしたカードがSユニットのカードなら自軍ラッシュエリアに出す」）", () => {
    const s = nc(inst("SPEC-PLAIN", "top"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("XG4-002: NC — S ユニット以外（M ユニット・オペレーション）なら捨札にする（出典: atwiki/page-2093「それ以外なら捨札にする」）", () => {
    expect(zoneOf(nc(inst("SPEC-PLAIN-M", "top")), "player1", "SPEC-PLAIN-M:top")).toBe("discard");
    expect(zoneOf(nc(inst("TST-OP", "top")), "player1", "TST-OP:top")).toBe("discard");
  });

  it("XG4-002: NC — 出したユニットの「ラッシュしたとき」の効果は発動しない（XG4-004 副長ゼルモダ【ワンパーの壺】が開かない）（出典: atwiki/page-2093「このとき、出したユニットの効果は発動しない」）", () => {
    const s = ncEnter("XG4-002:tv", 0, { deck: [inst("XG4-004", "top"), inst("SPEC-GRUNT", "g"), ...deckCards(3)] }, {}, EXTRA);
    expect(zoneOf(s, "player1", "XG4-004:top")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-004");
  });

  it("XG4-002: NC — 出したユニットはこのターン、バトルエリアに出てもアタックもストライクもできない（出典: atwiki/page-2093「この効果で出したユニットは、このターン、アタックもストライクもできず」）", () => {
    const s = enterKeep(nc(inst("SPEC-PLAIN", "top")), ["SPEC-PLAIN:top"]);
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("battle");
    expect(targetsOf(s, "SPEC-PLAIN:top")).toEqual([]);
    expect(canStrike(s, "SPEC-PLAIN:top")).toBe(false);
  });

  it("XG4-002: NC — 出したユニットは、このターンを終えるとき自軍エリアにあれば捨札になる（出典: atwiki/page-2093「このターンを終えるとき、自軍エリアにあれば捨札にする」）", () => {
    // テレビ仮面はバトルエリアに出たところでアタックを選べるので、アタックせずに進めてからターンを終える。
    const s = endTurn(act(nc(inst("SPEC-PLAIN", "top")), { type: "pass_battle_entry", playerId: "player1" }));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("discard");
    expect(zoneOf(s, "player1", "XG4-002:tv")).not.toBe("discard");
  });

  it("XG4-002: NC — 山札が0枚なら何もしない（出典: atwiki/page-2093「自軍山札の上から1枚をオモテにする」）", () => {
    const s = resolveAll(ncEnter("XG4-002:tv", 0, { deck: [] }, {}, EXTRA));
    expect(s.players.player1.rush).toHaveLength(0);
    expect(zoneOf(s, "player1", "XG4-002:tv")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-004 副長ゼルモダ", () => {
  const TEXT =
    "※これは特徴「車両」を持つビークルにライドできる。 【ワンパーの壺】これをラッシュしたとき、次の効果を発動できる⇒自軍山札を見て特徴「戦闘員」を持つカードを2枚まで選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  it("XG4-004: カタログ本文（修正後）・スペックが出典と一致（出典: atwiki/page-2069「修正後は以下」・R-ERR-XG4-004）", () => {
    expectCatalogText("XG4-004", TEXT);
    expectUnit("XG4-004", { name: "副長ゼルモダ", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["男"] });
    expectRarityIn("XG4-004", ["N"]);
  });

  const DECK = () => [inst("SPEC-GRUNT", "g1"), inst("SPEC-PLAIN", "p"), inst("SPEC-GRUNT", "g2"), inst("SPEC-GRUNT-V", "gv"), inst("SPEC-GRUNT", "g3"), ...deckCards(2)];
  const rushed = (deck = DECK()) => {
    const r = rushFromHand(board({ hand: [inst("XG4-004", "z")], command: releasedCat("DA", 1), power: powerCards(4), deck }), "player1", "XG4-004:z");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  /** 「次の効果を発動できる」の確認が開いていれば発動を選ぶ。 */
  const activate = (s: GameState) => (s.pendingEffectChoice?.kind === "confirm" ? act(s, { type: "confirm_effect_choice", playerId: "player1" }) : s);

  it("XG4-004:【ワンパーの壺】— ラッシュしたとき、自軍山札の特徴「戦闘員」を持つカード（ユニット・ビークル）から選べる（ほかのカードは選べない。任意）（出典: atwiki/page-2069「自軍山札を見て特徴「戦闘員」を持つカードを2枚まで選び、自軍ラッシュエリアに出してもよい」・カード評価「ユニットに限らないため、ウガッツバイクもラッシュすることができる」）", () => {
    const s = activate(rushed());
    expectChoiceFrom(s, "player1", "XG4-004");
    expect(choiceIds(s)).toEqual(["SPEC-GRUNT-V:gv", "SPEC-GRUNT:g1", "SPEC-GRUNT:g2", "SPEC-GRUNT:g3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-004:【ワンパーの壺】— 2枚まで選んで自軍ラッシュエリアに出す（3枚目は出さない）（出典: atwiki/page-2069「2枚まで選び」）", () => {
    let s = activate(rushed());
    s = pick(s, "SPEC-GRUNT:g1");
    if (s.pendingEffectChoice?.sourceCardId === "XG4-004") s = pick(s, "SPEC-GRUNT:g2");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-GRUNT:g1")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-GRUNT:g2")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-GRUNT:g3")).toBe("deck");
    expect(s.players.player1.rush.filter((c) => c.cardId === "SPEC-GRUNT")).toHaveLength(2);
  });

  it("XG4-004: 公式Q&A — 山札に「戦闘員」のカードがなくても処理は中断されない（0枚選んだことにする）（出典: atwiki/page-2069 Q1）", () => {
    const s = resolveAll(rushed([inst("SPEC-PLAIN", "p"), ...deckCards(3)]));
    expect(zoneOf(s, "player1", "XG4-004:z")).toBe("rush");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("XG4-004: ※ — 特徴「車両」を持つビークルにライドできる（「車両」を持たないビークルにはライドできない）（出典: atwiki/page-2069「※これは特徴「車両」を持つビークルにライドできる」）", () => {
    const s = p1Battle({ rush: [inst("XG4-004", "z"), inst("SPEC-CAR-V", "car"), inst("SPEC-MECHA-V", "mv")] }, {}, EXTRA);
    expect(canMount(s, "XG4-004:z", "SPEC-CAR-V:car")).toBe(true);
    expect(canMount(s, "XG4-004:z", "SPEC-MECHA-V:mv")).toBe(false);
  });
});

// ===========================================================================
describe("XG4-005 バギバギルガー－", () => {
  const TEXT = "【バキバキビックサンダー】これをラッシュしたとき、必要パワーの数字が3以下の敵軍ユニットを1体選びホールドしてもよい。";

  it("XG4-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-2087。ページ名の「（マイナス）」は読みの注記）", () => {
    expectCatalogText("XG4-005", TEXT);
    expectVehicle("XG4-005", { name: "バギバギルガー－", category: "DA", powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-005", ["N"]);
  });

  const ENEMY = {
    rush: [inst("SPEC-COST-0", "a"), inst("SPEC-COST-4", "d")],
    battle: [inst("SPEC-COST-2", "b"), inst("SPEC-COST-3", "c"), inst("SPEC-COST-7m", "z"), inst("SPEC-COST-3p", "p")],
  };
  const rushed = (p2: Partial<GameState["players"]["player2"]> = ENEMY) => {
    const r = rushFromHand(board({ hand: [inst("XG4-005", "v")], command: releasedCat("DA", 1), power: powerCards(3) }, p2), "player1", "XG4-005:v");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("XG4-005:【バキバキビックサンダー】— ラッシュしたとき、必要パワーの数字が3以下の敵軍ユニット（エリアを問わない。「3+」は3）から1体選べる（任意）（出典: atwiki/page-2087「必要パワーの数字が3以下の敵軍ユニットを1体選びホールドしてもよい」・カード評価「サイズ･エリアを問わない」）", () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", "XG4-005");
    expect(choiceIds(s)).toEqual(["SPEC-COST-0:a", "SPEC-COST-2:b", "SPEC-COST-3:c", "SPEC-COST-3p:p"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG4-005:【バキバキビックサンダー】— 選んだ敵軍ユニットはホールド状態になる（出典: atwiki/page-2087「ホールドしてもよい」）", () => {
    const s = resolveAll(pick(rushed(), "SPEC-COST-3:c"));
    expect(cardIn(s, "player2", "SPEC-COST-3:c")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-COST-2:b")?.commandHeld ?? false).toBe(false);
  });

  it("XG4-005:【バキバキビックサンダー】— 見送れば何もホールドしない（出典: atwiki/page-2087「してもよい」）", () => {
    const s = resolveAll(skip(rushed()));
    for (const c of [...s.players.player2.rush, ...s.players.player2.battle]) expect(c.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG4-006 ドラゴンアーマー", () => {
  const TEXT =
    "カテゴリにWBを持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットはBP+1000され、特徴「獣奏剣」が追加される。重ねたユニットがユニットでなくなるとき、このカードを持ち主の手札に戻す。";

  it("XG4-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-2061）", () => {
    expectCatalogText("XG4-006", TEXT);
    expectOperation("XG4-006", { name: "ドラゴンアーマー", category: "WB", powerCost: 5 });
    expectRarityIn("XG4-006", ["N"]);
  });

  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => opUsed("XG4-006", "WB", 5, p1, p2, EXTRA);
  const P1 = () => ({ rush: [inst("SPEC-WB-S", "w"), inst("SPEC-WB-M", "wm"), inst("SPEC-MA-S", "m")], battle: [inst("SPEC-WBMA-S", "wm2")] });

  it("XG4-006: 選べるのはカテゴリに WB を持つ自軍 S ユニット（マルチカテゴリを含む）だけ。M ユニット・ほかのカテゴリ・敵軍のユニットは選べない（出典: atwiki/page-2061「カテゴリにWBを持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = used(P1(), { rush: [inst("SPEC-WB-S", "e")] });
    expectChoiceFrom(s, "player1", "XG4-006");
    expect(choiceIds(s)).toEqual(["SPEC-WB-S:w", "SPEC-WBMA-S:wm2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG4-006: 重ねたユニットは BP+1000 され、特徴「獣奏剣」が追加される（このカードは捨札にならない）（出典: atwiki/page-2061「このカードに重ねたユニットはBP+1000され、特徴「獣奏剣」が追加される」）", () => {
    const s = resolveAll(pick(used(P1()), "SPEC-WB-S:w"));
    expect(bpOf(s, "player1", "SPEC-WB-S:w")).toBe(3000);
    expect(featuresOf(s, "player1", "SPEC-WB-S:w")).toContain("獣奏剣");
    expect(zoneOf(s, "player1", "XG4-006:op")).not.toBe("discard");
  });

  it("XG4-006: BP+1000・「獣奏剣」は次のターン以降も続く（ターンの限定がない）（出典: atwiki/page-2061）", () => {
    const s = endTurn(resolveAll(pick(used(P1()), "SPEC-WB-S:w")));
    expect(bpOf(s, "player1", "SPEC-WB-S:w")).toBe(3000);
    expect(featuresOf(s, "player1", "SPEC-WB-S:w")).toContain("獣奏剣");
  });

  it("XG4-006: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは持ち主の手札に戻る（出典: atwiki/page-2061「重ねたユニットがユニットでなくなるとき、このカードを持ち主の手札に戻す」）", () => {
    let s = resolveAll(pick(used({ battle: [inst("SPEC-WB-S", "w")] }, { rush: [inst("TST-UNIT-7", "atk")] }), "SPEC-WB-S:w"));
    s = advanceToBattle(endTurn(s), "player2");
    // 出たところでアタックする（enterSeq は出たあとアタックせずに進めるので、アタックできなくなる）。
    s = enterKeep(s, ["TST-UNIT-7:atk"], "player2");
    s = resolveAll(attack(s, "TST-UNIT-7:atk", "SPEC-WB-S:w", "player2"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("discard");
    expect(zoneOf(s, "player1", "XG4-006:op")).toBe("hand");
  });

  it("XG4-006: 自軍に WB の S ユニットがいなくても使える（空撃ち。何も重ねない）（出典: atwiki/page-2061・R-RES-04（適正な対象がないオペレーションも使える。grnrngr/faq-index リファレンス〈オペレーション〉））", () => {
    const s = rushBoard({ hand: [inst("XG4-006", "op")], command: releasedCat("WB", 1), power: powerCards(5), rush: [inst("SPEC-MA-S", "m")] }, {}, EXTRA);
    expect(canUseCard(s, "player1", "XG4-006:op")).toBe(true);
  });
});

// ===========================================================================
describe("XG4-007 ドラゴンレンジャー（XG4）", () => {
  const TEXT =
    "※これはラッシュフェイズ中に自分のカードが捨札に置かれたターンにしかバトルエリアに出られない。 ※自分がターンを終えるとき、自軍捨札が5枚以上あれば、これを撃破する。 【獣奏剣】これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットは、アタックするときBP+2000される。";

  it("XG4-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-2132）", () => {
    expectCatalogText("XG4-007", TEXT);
    expectUnit("XG4-007", { name: "ドラゴンレンジャー", category: "WB", size: "S", bp: 6000, sp: 1, powerCost: 4, comboNumber: undefined, features: ["グリーン", "男", "獣奏剣"] });
    expectRarityIn("XG4-007", ["SR"]);
  });

  it("XG4-007: ※ — ラッシュフェイズ中に自分のカードが捨札に置かれていないターンは、バトルエリアに出られない（出典: atwiki/page-2132「ラッシュフェイズ中に自分のカードが捨札に置かれたターンにしかバトルエリアに出られない」）", () => {
    const s = nextPhase(rushBoard({ rush: [inst("XG4-007", "dr")] }, {}, EXTRA));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "XG4-007:dr")).toBe(false);
  });

  it("XG4-007: ※ — ラッシュフェイズ中にオペレーションを使って自分のカードが捨札に置かれたターンは、バトルエリアに出られる（出典: atwiki/page-2132・カード評価「通常のオペレーションでも安定はしないが可能」）", () => {
    // 使うと捨札になるオペレーションとして BK-002 ダブルタイフーン（ET・必要パワー2）を使う。
    let s = opUsed("BK-002", "ET", 2, { rush: [inst("XG4-007", "dr")] }, {}, EXTRA);
    s = resolveAll(pick(s, "scry"), ["deck_top"]);
    expect(zoneOf(s, "player1", "BK-002:op")).toBe("discard");
    s = nextPhase(s);
    expect(canEnter(s, "XG4-007:dr")).toBe(true);
  });

  it("XG4-007: ※ — 自分がターンを終えるとき、自軍捨札が5枚以上あれば撃破される（出典: atwiki/page-2132「自軍捨札が5枚以上あれば、これを撃破する」）", () => {
    const s = endTurn(p1Battle({ battle: [inst("XG4-007", "dr")], discard: deckCards(5, "d") }, {}, EXTRA));
    expect(zoneOf(s, "player1", "XG4-007:dr")).toBe("discard");
  });

  it("XG4-007: ※ — 自軍捨札が4枚以下なら撃破されない（出典: atwiki/page-2132「5枚以上あれば」）", () => {
    const s = endTurn(p1Battle({ battle: [inst("XG4-007", "dr")], discard: deckCards(4, "d") }, {}, EXTRA));
    expect(zoneOf(s, "player1", "XG4-007:dr")).toBe("battle");
  });

  it("XG4-007: ※ — 相手がターンを終えるときは撃破されない（出典: atwiki/page-2132「自分がターンを終えるとき」）", () => {
    const s = endTurn(enemyTurn({ battle: [inst("XG4-007", "dr")], discard: deckCards(6, "d") }, {}, EXTRA));
    expect(s.activePlayer).toBe("player1");
    expect(zoneOf(s, "player1", "XG4-007:dr")).toBe("battle");
  });

  it("XG4-007:【獣奏剣】— これが自軍エリア（ラッシュエリアでもよい）にある間、特徴「恐竜」を持つ自軍ユニットはアタックするとき BP+2000（出典: atwiki/page-2132「特徴「恐竜」を持つすべての自軍ユニットは、アタックするときBP+2000される」）", () => {
    let s = p1Battle({ rush: [inst("XG4-007", "dr")], battle: [inst("SPEC-DINO", "d")] }, { battle: [inst("TST-UNIT-2", "e")] }, EXTRA);
    s = settle(attack(s, "SPEC-DINO:d", "TST-UNIT-2:e"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
  });

  it("XG4-007:【獣奏剣】— アタックされたとき（敵軍ターン）は上がらない（出典: atwiki/page-2132「アタックするとき」・カード評価「敵軍ターン中は強化されていない」）", () => {
    let s = enemyTurn({ rush: [inst("XG4-007", "dr")], battle: [inst("SPEC-DINO", "d")] }, { battle: [inst("TST-UNIT-2", "e")] }, EXTRA);
    s = settle(attack(s, "TST-UNIT-2:e", "SPEC-DINO:d", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(3000);
  });

  it("XG4-007:【獣奏剣】— 「恐竜」を持たない自軍ユニットは上がらない（出典: atwiki/page-2132）", () => {
    let s = p1Battle({ rush: [inst("XG4-007", "dr")], battle: [inst("SPEC-WB-S", "w")] }, { battle: [inst("SPEC-E-WEAK", "e")] }, EXTRA);
    s = settle(attack(s, "SPEC-WB-S:w", "SPEC-E-WEAK:e"));
    expect(lastBattleBps(s)?.attacker).toBe(2000);
  });
});

