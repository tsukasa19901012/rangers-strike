/**
 * カード別スペック: RK-127〜RK-133（ザ・マスクドライダーEXP vol.2 仮面ライダーカリス〜仮面ライダー蛮鬼）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-127・129・130・131 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-CN-02、R-KW-REG、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-127 Q1（宏のオルゴール時計の発動条件はラッシュされた時点の BP で判定）— cardSpec/RK1-001-021.b.test.ts RK-012 の欄（本範囲で it.todo から実テストにした）
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canConfirm,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  heldUnit,
  inst,
  nextPhase,
  p1Battle,
  pick,
  playOp,
  powerCards,
  rcRideOff,
  rcUnit,
  registerOffered,
  releasedCat,
  resolveAll,
  rideOff,
  mount,
  rushOpen,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK7-127-147.helpers";

const RC2000 = rcUnit("SPEC-RC2000", { category: "WB", bp: 2000 });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const EM = sUnit("SPEC-EM", { bp: 5000, powerCost: 3, size: "M" });
const EL = sUnit("SPEC-EL", { bp: 8000, powerCost: "7+" as never, size: "L" });
const BIG = sUnit("SPEC-BIG", { bp: 13000 });
const NOSP = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });
/** 特徴「仮面ライダー」を持つ自軍の S ユニット（SP1）。 */
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 1000, features: ["仮面ライダー"] });
/** ダークアライアンスの S ユニット。 */
const DA = sUnit("SPEC-DA", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", bp: 5000, size: "M" });
/** BP の下三桁が500 の、追加条件を持たないユニットカード（S・M）。 */
const B1500 = sUnit("SPEC-B1500", { bp: 1500 });
const B500 = sUnit("SPEC-B500", { bp: 500 });
const B2500M = sUnit("SPEC-B2500M", { bp: 2500, size: "M", powerCost: 3 });
/** BP の下三桁が500 でないユニット。 */
const B1000 = sUnit("SPEC-B1000", { bp: 1000 });
/** BP の下三桁が500 で、追加条件を持つユニット。 */
const B1500C = sUnit("SPEC-B1500C", {
  bp: 1500,
  powerCost: "2+" as never,
  rushAdditionalCondition: { conditionId: "discard_hand_card", text: "自分の手札を1枚選び捨札にする", unitCount: 1 } as never,
});
const COST = [1, 2, 3].map((n) => sUnit(`SPEC-C${n}`, { bp: 1000, powerCost: n }));
const OP_COST2 = { id: "SPEC-OP2", name: "SPEC-OP2", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 2 } as unknown as CardDefinition;
const EXTRA = [RC2000, E1, EM, EL, BIG, NOSP, KAMEN, DA, DA_M, B1500, B500, B2500M, B1000, B1500C, OP_COST2, PLAIN_VEHICLE, ...COST];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターン（バトルフェイズ）の盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const riding = (vehicle: CardInstance, rider: CardInstance): CardInstance[] => [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];
const heldCmd = (cardId: string, suf: string): CardInstance => ({ ...inst(cardId, suf), commandHeld: true });

// ===========================================================================
describe("RK-127 仮面ライダーカリス", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 ※これは相手の手札1枚につきBP+2000される。 【カリスアロー】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードの必要パワーの数字がすべて同じなら、敵軍コマンドゾーンからホールド状態のカードを1枚選び捨札にする。";

  it("RK-127: カタログ本文・スペックが出典と一致（出典: atwiki/page-648）", () => {
    expectCatalogText("RK-127", TEXT);
    expectStats("RK-127", { name: "仮面ライダーカリス", category: "WB", size: "S", bp: 1000, sp: "1/2", powerCost: 2, comboNumber: "RC", features: ["アンデッド", "仮面ライダー", "男"] });
    expectRarityIn("RK-127", ["SR"]);
  });

  it("RK-127: ※ 相手の手札1枚につき BP+2000（手札2枚で BP5000・0枚で BP1000）（出典: atwiki/page-648「※これは相手の手札1枚につきBP+2000される」・grnrngr/faq-rider-2 RK-127 Q（手札2枚のとき BP5000））", () => {
    expect(bpOf(board({ battle: [inst("RK-127", "ch")] }, { hand: deckCards(2, "eh") }), "player1", "RK-127:ch")).toBe(5000);
    expect(bpOf(board({ battle: [inst("RK-127", "ch")] }, { hand: [] }), "player1", "RK-127:ch")).toBe(1000);
  });

  it("RK-127: ※ 自分の手札の枚数では BP は変わらない（出典: atwiki/page-648「相手の手札1枚につき」）", () => {
    expect(bpOf(board({ battle: [inst("RK-127", "ch")], hand: deckCards(3, "mh") }, { hand: [] }), "player1", "RK-127:ch")).toBe(1000);
  });

  it("RK-127: ※ ラッシュエリアにあるときも BP が上がる（出典: atwiki/page-648（エリアの限定がない）・grnrngr/faq-rider-2 RK-127 Q「ラッシュされた「RK-127 仮面ライダーカリス」はBP5000」）", () => {
    expect(bpOf(board({ rush: [inst("RK-127", "ch")] }, { hand: deckCards(2, "eh") }), "player1", "RK-127:ch")).toBe(5000);
  });

  const arrow = (hand: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ hand, rush: [inst("RK-127", "ch"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-127:ch", "SPEC-VEHICLE:v");
  const enemyCmd = { command: [heldCmd("TST-OP", "eh1"), heldCmd("TST-UNIT-0", "eh2"), inst("TST-OP", "er")] };
  const c = (n: number, suf = `h${n}`) => inst(`SPEC-C${n}`, suf);
  const show = (hand: CardInstance[], picks: CardInstance[], p2 = enemyCmd) => {
    let s = arrow(hand, p2);
    for (const x of picks) s = pick(s, x.instanceId);
    return s;
  };

  it("RK-127: ※ ライドオフしたときはストライクできない（出典: atwiki/page-648「※これはライドオフしたときストライクできない」）", () => {
    // 手札が3枚未満で【カリスアロー】の選択は開かない盤面で確かめる。
    const s = settle(arrow([], {}, { battle: fill(1) }));
    expect(canStrike(s, "RK-127:ch")).toBe(false);
  });

  it("RK-127: ※ ライドしたまま進めばストライクできる（出典: atwiki/page-648「ライドオフしたとき」）", () => {
    let s = board({ battle: fill(1), rush: [inst("RK-127", "ch"), inst("SPEC-VEHICLE", "v")] });
    s = settle(rideOff(mount(s, "RK-127:ch", "SPEC-VEHICLE:v"), false));
    expect(canStrike(s, "RK-127:ch")).toBe(true);
  });

  it("RK-127: RC — 自分の手札を3枚選んで見せるかを選べる（任意）（出典: atwiki/page-648「自分の手札を3枚選び、相手に見せてもよい」）", () => {
    const hand = [c(1), c(1, "h1b"), c(2), c(3)];
    const s = arrow(hand, enemyCmd);
    expectChoiceFrom(s, "player1", "RK-127");
    expect(choiceIds(s)).toEqual(hand.map((x) => x.instanceId).sort());
    expect(canSkip(s)).toBe(true);
  });

  it("RK-127: RC — 手札が3枚未満なら選べない（出典: atwiki/page-648「自分の手札を3枚選び」・grnrngr/faq-rider-2 RK-125 Q（「3枚まで」でなく必ず3枚選ぶ）と同じ書き方）", () => {
    const s = arrow([c(1), c(1, "h1b")], enemyCmd);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-127");
  });

  it("RK-127: RC — 見せた3枚の必要パワーがすべて同じなら、敵軍コマンドゾーンのホールド状態のカードだけから1枚選ぶ（選ばないことはできない）（出典: atwiki/page-648「すべて同じなら、敵軍コマンドゾーンからホールド状態のカードを1枚選び捨札にする」）", () => {
    const hand = [c(1), c(1, "h1b"), c(1, "h1c")];
    const s = show(hand, hand);
    expectChoiceFrom(s, "player1", "RK-127");
    expect(choiceIds(s)).toEqual(["TST-OP:eh1", "TST-UNIT-0:eh2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-127: RC — 選んだホールド状態のコマンドは捨札になる（見せた手札は手札に残る）（出典: atwiki/page-648「捨札にする」「相手に見せて」）", () => {
    const hand = [c(1), c(1, "h1b"), c(1, "h1c")];
    const s = settle(pick(show(hand, hand), "TST-UNIT-0:eh2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:eh2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("command");
    for (const x of hand) expect(zoneOf(s, "player1", x.instanceId)).toBe("hand");
  });

  it("RK-127: RC — 必要パワーが揃わなければ何も捨札にしない（出典: atwiki/page-648「見せたカードの必要パワーの数字がすべて同じなら」）", () => {
    const hand = [c(1), c(1, "h1b"), c(2)];
    const s = settle(show(hand, hand));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-127");
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("RK-127: RC — ユニットとオペレーションが混じっていても、必要パワーの数字が同じなら揃う（出典: atwiki/page-648「必要パワーの数字がすべて同じなら」（カードの種類を問わない））", () => {
    const hand = [c(2), inst("SPEC-OP2", "op"), c(2, "h2b")];
    const s = show(hand, hand);
    expectChoiceFrom(s, "player1", "RK-127");
  });

  it("RK-127: RC — 見せなければ何も起きない（出典: atwiki/page-648「相手に見せてもよい」）", () => {
    const s = settle(skip(arrow([c(1), c(1, "h1b"), c(1, "h1c")], enemyCmd)));
    expect(s.players.player2.command).toHaveLength(3);
  });
});

// ===========================================================================
describe("RK-128 仮面ライダーレンゲル", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 ※これが撃破されて捨札になるとき、かわりにダークアライアンスを持つ自軍Sユニットを1体選び捨札にしてもよい。 【レンゲルラウザー】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、見せたカードがすべて、BPの下三桁が500の追加条件を持たないユニットカードなら、そのカードをすべて自軍ラッシュエリアに出す。";

  it("RK-128: カタログ本文・スペックが出典と一致（出典: atwiki/page-649）", () => {
    expectCatalogText("RK-128", TEXT);
    expectStats("RK-128", { name: "仮面ライダーレンゲル", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-128", ["R"]);
  });

  const rouzer = (hand: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ hand, rush: [inst("RK-128", "rg"), inst("SPEC-VEHICLE", "v")], ...p1 }), "RK-128:rg", "SPEC-VEHICLE:v");
  const show = (hand: CardInstance[], picks: CardInstance[] = hand) => {
    let s = rouzer(hand);
    for (const x of picks) s = pick(s, x.instanceId);
    return s;
  };

  it("RK-128: ※ ライドオフしたときはストライクできない（出典: atwiki/page-649「※これはライドオフしたときストライクできない」）", () => {
    const s = settle(rouzer([], { battle: fill(1) }));
    expect(canStrike(s, "RK-128:rg")).toBe(false);
  });

  it("RK-128: ※ 撃破されて捨札になるとき、かわりに DA を持つ自軍 S ユニット（エリアを問わない）を1体選び捨札にできる（任意）（出典: atwiki/page-649「かわりにダークアライアンスを持つ自軍Sユニットを1体選び捨札にしてもよい」）", () => {
    const s = attackedInEnemyTurn(
      { battle: [inst("RK-128", "rg"), inst("SPEC-DA", "d1")], rush: [inst("SPEC-DA", "d2"), inst("SPEC-DA-M", "dm"), inst("TST-UNIT-0", "wb")] },
      "RK-128:rg",
      {},
      "TST-UNIT-7:atk",
      EXTRA,
    );
    expectChoiceFrom(s, "player1", "RK-128");
    expect(choiceIds(s)).toEqual(["SPEC-DA:d1", "SPEC-DA:d2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-128: ※ DA のユニットを捨札にすると、このユニットは捨札にならずその場に残る（出典: atwiki/page-649「かわりに」・カード評価「DAの戦闘員ならばこれが撃破された時に捨札にすることでその場に留まれる」）", () => {
    const s = resolveAll(
      pick(attackedInEnemyTurn({ battle: [inst("RK-128", "rg")], rush: [inst("SPEC-DA", "d2")] }, "RK-128:rg", {}, "TST-UNIT-7:atk", EXTRA), "SPEC-DA:d2"),
    );
    expect(zoneOf(s, "player1", "SPEC-DA:d2")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-128:rg")).toBe("battle");
  });

  it("RK-128: ※ 選ばなければこのユニットが捨札になる（出典: atwiki/page-649「捨札にしてもよい」）", () => {
    const s = resolveAll(skip(attackedInEnemyTurn({ battle: [inst("RK-128", "rg")], rush: [inst("SPEC-DA", "d2")] }, "RK-128:rg", {}, "TST-UNIT-7:atk", EXTRA)));
    expect(zoneOf(s, "player1", "RK-128:rg")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DA:d2")).toBe("rush");
  });

  it("RK-128: ※ DA を持つ自軍 S ユニットがいなければ、そのまま捨札になる（出典: atwiki/page-649）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-128", "rg")], rush: [inst("TST-UNIT-0", "wb")] }, "RK-128:rg", {}, "TST-UNIT-7:atk", EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-128");
    expect(zoneOf(resolveAll(s), "player1", "RK-128:rg")).toBe("discard");
  });

  it("RK-128: ※ 効果で撃破されるときも、かわりに DA のユニットを捨札にできる（出典: atwiki/page-649「撃破されて捨札になるとき」（撃破の方法を問わない））", () => {
    // 敵軍（player2）のラッシュフェイズに、敵軍の RS-245（敵軍Sユニットを1体選び撃破する）で撃破する。
    let s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { battle: [inst("RK-128", "rg")], rush: [inst("SPEC-DA", "d2")], deck: deckCards(5) },
        player2: { hand: [inst("RS-245", "op")], command: releasedCat("WB", 1, "e"), power: powerCards(5), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    const r = playOp(s, "player2", "RS-245:op", "RK-128:rg");
    expect(r.ok, r.error).toBe(true);
    s = settle(r.state);
    if (s.pendingEffectChoice?.sourceCardId === "RS-245") s = settle(pick(s, "RK-128:rg"));
    expectChoiceFrom(s, "player1", "RK-128");
    s = resolveAll(pick(s, "SPEC-DA:d2"));
    expect(zoneOf(s, "player1", "RK-128:rg")).toBe("battle");
  });

  it("RK-128: RC — 自分の手札を3枚選んで見せるかを選べる（任意）。手札が3枚未満なら選べない（出典: atwiki/page-649「自分の手札を3枚選び、相手に見せてもよい」・コメント欄「必ず3枚見せなければいけません」）", () => {
    const hand = [inst("SPEC-B1500", "a"), inst("SPEC-B500", "b"), inst("SPEC-B2500M", "c")];
    const s = rouzer(hand);
    expectChoiceFrom(s, "player1", "RK-128");
    expect(choiceIds(s)).toEqual(hand.map((x) => x.instanceId).sort());
    expect(canSkip(s)).toBe(true);
    expect(rouzer(hand.slice(0, 2)).pendingEffectChoice?.sourceCardId).not.toBe("RK-128");
  });

  it("RK-128: RC — 見せた3枚がすべて BP の下三桁が500 の追加条件を持たないユニットカード（S・M を問わない）なら、3枚とも自軍ラッシュエリアに出す（出典: atwiki/page-649「そのカードをすべて自軍ラッシュエリアに出す」）", () => {
    const hand = [inst("SPEC-B1500", "a"), inst("SPEC-B500", "b"), inst("SPEC-B2500M", "c"), inst("SPEC-B1000", "x")];
    const s = resolveAll(show(hand, hand.slice(0, 3)));
    for (const x of hand.slice(0, 3)) expect(zoneOf(s, "player1", x.instanceId)).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-B1000:x")).toBe("hand");
  });

  it("RK-128: RC — BP の下三桁が500 でないユニットが1枚でも混じっていれば、どれも出さない（出典: atwiki/page-649「見せたカードがすべて…なら」）", () => {
    const hand = [inst("SPEC-B1500", "a"), inst("SPEC-B500", "b"), inst("SPEC-B1000", "x")];
    const s = resolveAll(show(hand));
    for (const x of hand) expect(zoneOf(s, "player1", x.instanceId)).toBe("hand");
  });

  it("RK-128: RC — 追加条件を持つユニット・ユニットでないカードが混じっていれば、どれも出さない（出典: atwiki/page-649「追加条件を持たないユニットカードなら」）", () => {
    for (const odd of [inst("SPEC-B1500C", "cond"), inst("TST-OP", "op")]) {
      const hand = [inst("SPEC-B1500", "a"), inst("SPEC-B500", "b"), odd];
      const s = resolveAll(show(hand));
      for (const x of hand) expect(zoneOf(s, "player1", x.instanceId)).toBe("hand");
    }
  });

  it("RK-128: RC — 見せなければ何も起きない（出典: atwiki/page-649「相手に見せてもよい」）", () => {
    const hand = [inst("SPEC-B1500", "a"), inst("SPEC-B500", "b"), inst("SPEC-B2500M", "c")];
    const s = settle(skip(rouzer(hand)));
    for (const x of hand) expect(zoneOf(s, "player1", x.instanceId)).toBe("hand");
  });
});

// ===========================================================================
describe("RK-129 ブルースペイダー", () => {
  const TEXT =
    "【サンダースペイダー】これにライドしたユニットがある間、自分の手札からカードが1枚捨札に置かれるたび、次の効果を発動できる⇒ホールド状態の敵軍ユニットを1体選び撃破する。";

  it("RK-129: カタログ本文・スペックが出典と一致（出典: atwiki/page-617）", () => {
    expectCatalogText("RK-129", TEXT);
    expectVehicleStats("RK-129", { name: "ブルースペイダー", category: "WB", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-129", ["N"]);
  });

  const enemy = { battle: [heldUnit("SPEC-E1", "hb"), inst("SPEC-E1", "rb"), heldUnit("SPEC-EM", "hm")], rush: [heldUnit("SPEC-E1", "hr")] };
  /** ブルースペイダーにライドしたユニットがいる盤面（自軍ラッシュフェイズ）で、手札の RS-025 を使う（手札→捨札）。 */
  const useOp = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = enemy) => {
    const s = rushPhase({ hand: [inst("RS-025", "op")], command: releasedCat("WB", 1), power: powerCards(3), ...p1 }, p2);
    const r = playOp(s, "player1", "RS-025:op", "SPEC-RC2000:r");
    expect(r.ok, r.error).toBe(true);
    let next = r.state;
    if (next.pendingEffectChoice?.sourceCardId === "RS-025") next = pick(next, "SPEC-RC2000:r");
    return settle(next);
  };

  it("RK-129: 公式Q&A — これにライドしたユニットがある間、手札のオペレーションを使って捨札になったときも発動できる。ホールド状態の敵軍ユニット（サイズ・エリアを問わない）から選ぶ（任意）（出典: grnrngr/faq-rider-2 RK-129 Q「手札のオペレーションを使用して捨札になった場合も、効果を発動させる事ができます」・atwiki/page-617 Q1・カード評価「能力はサイズに関係なく発動する」）", () => {
    const s = useOp({ battle: riding(inst("RK-129", "bs"), inst("SPEC-RC2000", "r")) });
    expect(zoneOf(s, "player1", "RS-025:op")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-129");
    expect(choiceIds(s)).toEqual(["SPEC-E1:hb", "SPEC-E1:hr", "SPEC-EM:hm"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-129: 選んだホールド状態の敵軍ユニットを撃破する（出典: atwiki/page-617「ホールド状態の敵軍ユニットを1体選び撃破する」）", () => {
    const s = resolveAll(pick(useOp({ battle: riding(inst("RK-129", "bs"), inst("SPEC-RC2000", "r")) }), "SPEC-EM:hm"));
    expect(zoneOf(s, "player2", "SPEC-EM:hm")).toBe("discard");
  });

  it("RK-129: ライドしたユニットがいなければ発動しない（出典: atwiki/page-617「これにライドしたユニットがある間」）", () => {
    const s = useOp({ battle: [inst("RK-129", "bs"), inst("SPEC-RC2000", "r")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-129");
  });

  it("RK-129: ホールド状態の敵軍ユニットがいなければ発動しない（出典: atwiki/page-617）", () => {
    const s = useOp({ battle: riding(inst("RK-129", "bs"), inst("SPEC-RC2000", "r")) }, { battle: [inst("SPEC-E1", "rb")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-129");
  });

  it("RK-129: 効果（追加条件）で手札を捨札にしたときも発動する（出典: atwiki/page-617「自分の手札からカードが1枚捨札に置かれるたび」・カード評価「仮面ライダーゼロノスAF…を使い、手札を捨てる事で任意に能力を発動させることが出来る」）", () => {
    const s0 = rushPhase(
      { hand: [inst("RK-139", "af"), inst("TST-OP", "cost")], rush: riding(inst("RK-129", "bs"), inst("SPEC-RC2000", "r")), command: releasedCat("OT", 1), power: powerCards(3) },
      enemy,
    );
    const r = rushVia(s0, "player1", "RK-139:af", (a) => ((a.zordMaterialInstanceIds as string[] | undefined) ?? []).includes("TST-OP:cost"));
    expect(r.ok, r.error).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "TST-OP:cost")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-129");
  });
});

// ===========================================================================
describe("RK-130 ローカストアンデッド", () => {
  const TEXT =
    "【スペード5－キック】自軍ラッシュフェイズ中、これをラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは次の能力を得る⇒ストライクしたとき、レジストを持つ敵軍Sユニットを1体選び、撃破する。";

  it("RK-130: カタログ本文・スペックが出典と一致（出典: atwiki/page-640）", () => {
    expectCatalogText("RK-130", TEXT);
    expectStats("RK-130", { name: "ローカストアンデッド", category: "DA", size: "S", bp: 1500, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["アンデッド", "昆虫"] });
    expectRarityIn("RK-130", ["N"]);
  });

  const regEnemy = { battle: [inst("RK-133", "rb"), inst("SPEC-E1", "e")], rush: [inst("RK-133", "rr")] };
  const declare = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = regEnemy) =>
    rushOpen(rushPhase({ hand: [inst("RK-130", "lc")], command: releasedCat("DA", 1), power: powerCards(3), rush: [inst("SPEC-KAMEN", "k1")], battle: [inst("SPEC-KAMEN", "k2"), inst("TST-UNIT-0", "u")], ...p1 }, p2), "player1", "RK-130:lc");

  it("RK-130: 公式Q&A — ラッシュのための手続き（コマンドのホールド）を行ってから、ラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニット（エリアを問わない）を選べる（任意）（出典: grnrngr/faq-rider-2 RK-130 Q「ラッシュのための手続きを行ってから、捨札にしてください」・atwiki/page-640 Q1）", () => {
    const s = declare();
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-130");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN:k1", "SPEC-KAMEN:k2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-130: 選ぶと、これはラッシュされずに捨札になる（出典: atwiki/page-640「これをラッシュするかわりに捨札にして」）", () => {
    const s = settle(pick(declare(), "SPEC-KAMEN:k1"));
    expect(zoneOf(s, "player1", "RK-130:lc")).toBe("discard");
  });

  it("RK-130: 選ばなければ、ふつうにラッシュエリアに出る（出典: atwiki/page-640「選んでもよい」）", () => {
    const s = settle(skip(declare()));
    expect(zoneOf(s, "player1", "RK-130:lc")).toBe("rush");
  });

  it("RK-130: 特徴「仮面ライダー」を持つ自軍ユニットがいなければ、ふつうにラッシュする（出典: atwiki/page-640）", () => {
    const s = declare({ rush: [], battle: [inst("TST-UNIT-0", "u")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-130");
    expect(zoneOf(settle(s), "player1", "RK-130:lc")).toBe("rush");
  });

  /** k1（ラッシュエリア）を選び、バトルフェイズに k1 を出してストライクする。 */
  const kick = (p2: Partial<GameState["players"]["player2"]> = regEnemy) => {
    let s = settle(pick(declare({}, p2), "SPEC-KAMEN:k1"));
    s = nextPhase(s);
    expect(s.phase).toBe("battle");
    s = enter(s, "SPEC-KAMEN:k1");
    return settle(strike(s, "SPEC-KAMEN:k1"));
  };

  it("RK-130: このターン、選んだユニットはストライクしたとき、レジストを持つ敵軍 S ユニット（エリアを問わない）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-640「ストライクしたとき、レジストを持つ敵軍Sユニットを1体選び、撃破する」・カード評価「エリアも問わない」）", () => {
    const s = kick();
    expectChoiceFrom(s, "player1", "RK-130");
    expect(choiceIds(s)).toEqual(["RK-133:rb", "RK-133:rr"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-130: 選んだレジストを持つ敵軍ユニットを撃破する（出典: atwiki/page-640）", () => {
    const s = resolveAll(pick(kick(), "RK-133:rr"));
    expect(zoneOf(s, "player2", "RK-133:rr")).toBe("discard");
  });

  it("RK-130: 選ばなかったユニットはストライクしても能力を得ていない（出典: atwiki/page-640「選んだユニットは次の能力を得る」）", () => {
    let s = settle(pick(declare(), "SPEC-KAMEN:k1"));
    s = nextPhase(s);
    s = settle(strike(s, "SPEC-KAMEN:k2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-130");
  });
});

// ===========================================================================
describe("RK-131 仮面ライダー剛鬼", () => {
  const TEXT =
    "【音響打・豪腕無双】敵軍Lユニットを1体選び、自軍山札の上から7枚までオモテにしてもよい。そうしたとき、オモテにしたユニットカードのBPの合計が、選んだLユニットのBP以上なら、選んだLユニットを撃破する。その後、オモテにしたカードはすべて捨札になる。";

  it("RK-131: カタログ本文・スペックが出典と一致（出典: atwiki/page-634）", () => {
    expectCatalogText("RK-131", TEXT);
    expectStats("RK-131", { name: "仮面ライダー剛鬼", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, comboNumber: 2, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-131", ["N"]);
  });

  /** 山札の上から: BP5000（M）・BP1000・オペレーション・BP13000 …。 */
  const deck = [inst("SPEC-EM", "d1"), inst("SPEC-E1", "d2"), inst("TST-OP", "d3"), inst("SPEC-BIG", "d4"), ...deckCards(6, "rest")];
  const gouki = (n = 1, p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-EL", "lb")], rush: [inst("SPEC-EL", "lr"), inst("SPEC-EM", "m")] }) =>
    enter(board({ battle: fill(n), rush: [inst("RK-131", "go")], deck }, p2), "RK-131:go");

  it("RK-131: NC（2番目）— 敵軍 L ユニット（エリアを問わない）を1体選ぶかを選べる（任意）（出典: atwiki/page-634「敵軍Lユニットを1体選び、…オモテにしてもよい」・カード評価「エリアを問わないので…要塞ワンセブンの除去も可能」）", () => {
    const s = gouki();
    expectChoiceFrom(s, "player1", "RK-131");
    expect(choiceIds(s)).toEqual(["SPEC-EL:lb", "SPEC-EL:lr"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-131: NC 不成立（1番目）なら発動しない（出典: atwiki/page-634「CN：2」・R-CN-02）", () => {
    expect(gouki(0).pendingEffectChoice?.sourceCardId).not.toBe("RK-131");
  });

  it("RK-131: 公式Q&A — 枚数を宣言せず、山札の上から1枚ずつオモテにして、好きなところで止められる（出典: grnrngr/faq-rider-2 RK-131 Q1「はい、その通りです」・Q2「いいえ、その必要はありません」）", () => {
    let s = pick(gouki(), "SPEC-EL:lb");
    expectChoiceFrom(s, "player1", "RK-131");
    expect(canConfirm(s)).toBe(true);
    s = confirm(s);
    expect(cardIn(s, "player1", "SPEC-EM:d1")?.faceDown ?? false).toBe(false);
    expectChoiceFrom(s, "player1", "RK-131");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-131: オモテにしたユニットカードの BP の合計が選んだ L ユニットの BP 以上なら撃破し、オモテにしたカードはすべて捨札になる（出典: atwiki/page-634）", () => {
    let s = pick(gouki(), "SPEC-EL:lb");
    s = confirm(confirm(confirm(confirm(s)))); // 5000 + 1000 + 0（オペレーション） + 13000
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-EL:lb")).toBe("discard");
    for (const id of ["SPEC-EM:d1", "SPEC-E1:d2", "TST-OP:d3", "SPEC-BIG:d4"]) expect(zoneOf(s, "player1", id)).toBe("discard");
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP:rest0");
  });

  it("RK-131: 合計が L ユニットの BP に届かなければ撃破しないが、オモテにしたカードは捨札になる（オペレーションの BP は数えない）（出典: atwiki/page-634・カード評価「オペレーションカードやビークルカードが有った場合は…役に立たないまま捨札行き」）", () => {
    let s = pick(gouki(), "SPEC-EL:lb");
    s = confirm(confirm(confirm(s))); // 5000 + 1000 + 0 = 6000 < 8000
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-EL:lb")).toBe("battle");
    for (const id of ["SPEC-EM:d1", "SPEC-E1:d2", "TST-OP:d3"]) expect(zoneOf(s, "player1", id)).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-BIG:d4")).toBe("deck");
  });

  it("RK-131: コミュニティQ&A — 合計が L ユニットの BP を超えても、7枚まではオモテにし続けられる（出典: atwiki/page-634 コメント欄「対象のBPを超えても7枚までなら表にして捨て札にしてもよいのでしょうか？」「大丈夫ですよ」）", () => {
    let s = pick(gouki(), "SPEC-EL:lb");
    s = confirm(confirm(confirm(confirm(s)))); // 19000 ≥ 8000
    expect(canConfirm(s)).toBe(true);
  });

  it("RK-131: 7枚オモテにしたら、それ以上はオモテにできない（出典: atwiki/page-634「7枚までオモテにしてもよい」）", () => {
    let s = pick(gouki(), "SPEC-EL:lb");
    for (let i = 0; i < 7; i++) s = confirm(s);
    s = resolveAll(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-131");
    expect(s.players.player1.discard.filter((c) => c.instanceId !== "RK-131:go")).toHaveLength(7);
    expect(zoneOf(s, "player2", "SPEC-EL:lb")).toBe("discard");
  });

  it("RK-131: 敵軍 L ユニットがいなければ発動しない（出典: atwiki/page-634「敵軍Lユニットを1体選び」）", () => {
    expect(gouki(1, { battle: [inst("SPEC-EM", "m")] }).pendingEffectChoice?.sourceCardId).not.toBe("RK-131");
  });

  it("RK-131: 選ばなければ山札をオモテにしない（出典: atwiki/page-634「てもよい」）", () => {
    const s = settle(skip(gouki()));
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-EM:d1");
  });
});

// ===========================================================================
describe("RK-132 仮面ライダー闘鬼", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【妻子のバックアップ】これが自軍エリアにある間、敵軍山札がシャッフルされたとき、これがホールド状態ならリリースしてもよい。";

  it("RK-132: カタログ本文・スペックが出典と一致（出典: atwiki/page-685）", () => {
    expectCatalogText("RK-132", TEXT);
    expectStats("RK-132", { name: "仮面ライダー闘鬼", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: undefined, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-132", ["N"]);
  });

  it("RK-132: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-685「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-132", "tk")] }, "RK-132:tk"))).toBe(true);
  });

  /**
   * 自軍（player1）ラッシュフェイズに RK-146 デネブをラッシュする。【デネブキャンディー】で相手（player2）が先に山札を見てシャッフルし、
   * その後に自分が山札を見てシャッフルする（R-ERR-RK146）。
   */
  const deneb = (p1: Partial<GameState["players"]["player1"]>) => {
    const s = rushOpen(
      rushPhase({ hand: [inst("RK-146", "dn")], command: releasedCat("OT", 1), power: powerCards(2), deck: [inst("TST-OP", "o1"), ...deckCards(4)], ...p1 }, { deck: [inst("TST-OP", "eo"), ...deckCards(4, "e")] }),
      "player1",
      "RK-146:dn",
    );
    return settle(s);
  };
  /** 相手の【デネブキャンディー】の手順（山札を見て、オペレーションを1枚手札に加える）を進める。 */
  const enemyLooks = (s: GameState) => {
    let next = s;
    for (let i = 0; i < 4 && next.pendingEffectChoice?.playerId === "player2"; i++) {
      const p = next.pendingEffectChoice;
      next = settle(p.validInstanceIds.length > 0 ? pick(next, p.validInstanceIds[0]!) : confirm(next));
    }
    return next;
  };

  it("RK-132: これがホールド状態で自軍エリアにある間、敵軍山札がシャッフルされたとき、リリースするかを選べる（任意）（出典: atwiki/page-685「敵軍山札がシャッフルされたとき、これがホールド状態ならリリースしてもよい」）", () => {
    const s = enemyLooks(deneb({ rush: [heldUnit("RK-132", "tk")] }));
    expectChoiceFrom(s, "player1", "RK-132");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-132: 選ぶとリリース状態になる（出典: atwiki/page-685「リリースしてもよい」）", () => {
    let s = enemyLooks(deneb({ rush: [heldUnit("RK-132", "tk")] }));
    s = s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(cardIn(s, "player1", "RK-132:tk")?.commandHeld ?? false).toBe(false);
  });

  it("RK-132: リリース状態なら何も起きない（出典: atwiki/page-685「これがホールド状態なら」）", () => {
    const s = enemyLooks(deneb({ rush: [inst("RK-132", "tk")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-132");
  });

  it("RK-132: 自軍山札のシャッフルでは発動しない（出典: atwiki/page-685「敵軍山札が」）", () => {
    // 相手は山札を見ない（シャッフルしない）。自分は山札を見てシャッフルする。
    let s = deneb({ rush: [heldUnit("RK-132", "tk")] });
    if (s.pendingEffectChoice?.playerId === "player2") s = settle(skip(s));
    for (let i = 0; i < 4 && s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.sourceCardId === "RK-146"; i++) {
      const p = s.pendingEffectChoice;
      s = settle(p.validInstanceIds.length > 0 ? pick(s, p.validInstanceIds[0]!) : confirm(s));
    }
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-132");
    expect(cardIn(s, "player1", "RK-132:tk")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RK-133 仮面ライダー蛮鬼", () => {
  const TEXT = "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【音撃斬・冥府魔道】「SP1」";

  it("RK-133: カタログ本文・スペックが出典と一致（出典: atwiki/page-686）", () => {
    expectCatalogText("RK-133", TEXT);
    expectStats("RK-133", { name: "仮面ライダー蛮鬼", category: "MA", size: "S", bp: 500, sp: "special", powerCost: 1, comboNumber: 3, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("RK-133", ["N"]);
  });

  it("RK-133: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-686「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-133", "bk")] }, "RK-133:bk"))).toBe(true);
  });

  it("RK-133: NC（3番目）で「SP1」になりストライクできる（出典: atwiki/page-686「【音撃斬・冥府魔道】「SP1」」「CN：3」）", () => {
    const s = enter(board({ battle: fill(2), rush: [inst("RK-133", "bk")] }), "RK-133:bk");
    expect(spOf(s, "player1", "RK-133:bk")).toBe(1);
    expect(canStrike(s, "RK-133:bk")).toBe(true);
  });

  it("RK-133: NC 不成立（2番目）なら SP はない（出典: atwiki/page-686「SP：！」・R-CN-02）", () => {
    const s = enter(board({ battle: fill(1), rush: [inst("RK-133", "bk")] }), "RK-133:bk");
    expect(spOf(s, "player1", "RK-133:bk")).toBe(0);
  });

});
