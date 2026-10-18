/**
 * カード別スペック: RK-134〜RK-140（ザ・マスクドライダーEXP vol.2 仮面ライダー2号（THE FIRST）〜仮面ライダー電王LF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-140 の Q&A・SK-002 欄の RK-134）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-HOLD-03、R-TGT-01、R-POW-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-137 デッキに好きな枚数入れてよい（同名の RK-303 と合わせても制限されない）— rulesSpec/01-overview-deck.test.ts R-DECK-03
 *  - RK-140 必要パワー2以下のユニットは（敵軍も）バトルエリアに出られない（バトルエリアにあるとき）・【電車斬り】で相手に1点 — errataCardEffects.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  heldUnit,
  inst,
  intercept,
  interceptOffered,
  legal,
  mount,
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
  rushFromHand,
  rushVia,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK7-127-147.helpers";

const RC3500 = rcUnit("SPEC-RC3500", { category: "WB", bp: 3500 });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E2 = sUnit("SPEC-E2", { bp: 2000, powerCost: 2 });
const E3 = sUnit("SPEC-E3", { bp: 3000, powerCost: 3 });
const E4 = sUnit("SPEC-E4", { bp: 4000, powerCost: 4 });
const E5 = sUnit("SPEC-E5", { bp: 5000, powerCost: 5 });
const EM4 = sUnit("SPEC-EM4", { bp: 5000, powerCost: 4, size: "M" });
/** 追加条件を持つユニット（必要パワー「2+」）。 */
const ECOND = sUnit("SPEC-ECOND", {
  bp: 3000,
  powerCost: "2+" as never,
  rushAdditionalCondition: { conditionId: "discard_hand_card", text: "自分の手札を1枚選び捨札にする", unitCount: 1 } as never,
});
const WOMAN = sUnit("SPEC-WOMAN", { category: "DA", bp: 1000, features: ["女"] });
const WOMAN2 = sUnit("SPEC-WOMAN2", { category: "DA", bp: 1000, features: ["怪人", "女"] });
const MAN = sUnit("SPEC-MAN", { category: "DA", bp: 1000, features: ["男"] });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 1000, features: ["DEN-O"] });
const DENO_OP = { id: "SPEC-RES", name: "SPEC-RES", type: "operation", category: "OT", rarity: "N", expansion: "card-spec", powerCost: 0 } as never;
const EXTRA = [RC3500, E1, E2, E3, E4, E5, EM4, ECOND, WOMAN, WOMAN2, MAN, DENO, DENO_OP, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, phase: GameState["phase"] = "battle") =>
  st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const riding = (vehicle: CardInstance, rider: CardInstance): CardInstance[] => [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];

// ===========================================================================
describe("RK-134 仮面ライダー2号（THE FIRST）", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ライダーキック】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。さらに、このユニットがホールド状態なら、このターン、これはBP+2000される。";

  it("RK-134: カタログ本文・スペックが出典と一致（出典: atwiki/page-662）", () => {
    expectCatalogText("RK-134", TEXT);
    expectStats("RK-134", { name: "仮面ライダー2号（THE FIRST）", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-134", ["R"]);
  });

  it("RK-134: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-662「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-134", "n2")] }, "RK-134:n2"))).toBe(true);
  });

  /** 2号をビークルにライドさせて出し、ライドオフする（RC 発動）。 */
  const rc = (p2: Partial<GameState["players"]["player2"]>) =>
    settle(rcRideOff(board({ rush: [inst("RK-134", "n2"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-134:n2", "SPEC-VEHICLE:v"));

  it("RK-134: RC — アタックするとき、敵軍ユニットの BP を本来の値としてバトルする（ライドで BP3000 の相手〈本来 2000〉に BP3000 で勝ち、2号は残る）（出典: atwiki/page-662「敵軍ユニットのBPをカードに表記された本来の値としてバトルする」）", () => {
    let s = rc({ battle: riding(inst("RK-024", "ev"), inst("SPEC-E2", "e")) });
    expect(bpOf(s, "player2", "SPEC-E2:e")).toBe(3000);
    s = resolveAll(attack(s, "RK-134:n2", "SPEC-E2:e"));
    expect(zoneOf(s, "player2", "SPEC-E2:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-134:n2")).toBe("battle");
  });

  it("RK-134: RC — 敵軍ドレイクMF（アタックされるとき BP+4000）にも本来の BP1000 としてバトルする（出典: atwiki/page-662・カード評価「仮面ライダーカリスや気力を使ってBPを底上げしたユニットと本来のBPで戦える」）", () => {
    const s = resolveAll(attack(rc({ battle: [inst("RK-135", "mf")] }), "RK-134:n2", "RK-135:mf"));
    expect(zoneOf(s, "player2", "RK-135:mf")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-134:n2")).toBe("battle");
  });

  it("RK-134: ライドしないで出たときは RC が発動せず、ドレイクMF（アタックされるとき BP5000）に負ける（出典: atwiki/page-662・R-KW-RC-01）", () => {
    let s = enter(board({ rush: [inst("RK-134", "n2")] }, { battle: [inst("RK-135", "mf")] }), "RK-134:n2");
    s = resolveAll(attack(s, "RK-134:n2", "RK-135:mf"));
    expect(zoneOf(s, "player2", "RK-135:mf")).toBe("battle");
  });

  /** RC を発動したあと、2号をホールド状態にする（レジストではないホールド。R-HOLD-03 の [未確定] にかからない場面）。 */
  const heldAfterRc = (p2: Partial<GameState["players"]["player2"]>) => {
    const s = rc(p2);
    return { ...s, players: { ...s.players, player1: { ...s.players.player1, battle: s.players.player1.battle.map((c) => (c.instanceId === "RK-134:n2" ? { ...c, commandHeld: true } : c)) } } };
  };

  it("RK-134: RC — このユニットがホールド状態でアタックするとき、このターン BP+2000 される（BP5000 で本来の BP4000 の相手に勝つ）（出典: atwiki/page-662「さらに、このユニットがホールド状態なら、このターン、これはBP+2000される」）", () => {
    const s = resolveAll(attack(heldAfterRc({ battle: [inst("SPEC-E4", "d")] }), "RK-134:n2", "SPEC-E4:d"));
    expect(zoneOf(s, "player2", "SPEC-E4:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-134:n2")).toBe("battle");
  });

  it("RK-134: RC — リリース状態なら BP+2000 されない（BP3000 で本来の BP4000 の相手に負ける）（出典: atwiki/page-662「このユニットがホールド状態なら」）", () => {
    const s = resolveAll(attack(rc({ battle: [inst("SPEC-E4", "d")] }), "RK-134:n2", "SPEC-E4:d"));
    expect(zoneOf(s, "player2", "SPEC-E4:d")).toBe("battle");
  });


  it.todo(
    "RK-134: 公式Q&A（相互参照）— SK-002 仮面ライダーV3【ダブルタイフーン】では「RK-134 仮面ライダー2号（THE FIRST）」をホールドして RC を発動できない（括弧書きもカード名に含む）（出典: grnrngr/faq-rider-2 SK-002 Q2）— SK-002 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-135 仮面ライダードレイクMF", () => {
  const TEXT =
    "※これはアタックされるときBP+4000される。 【潜行捜索】数字を1つ宣言してもよい。そうしたとき、自軍山札の下から1枚ひいてオモテにする。オモテにしたカードの必要パワーの数字が、宣言した数字と同じなら、自分の手札に加え、それ以外なら山札の下に戻す。";

  it("RK-135: カタログ本文・スペックが出典と一致（出典: atwiki/page-632）", () => {
    expectCatalogText("RK-135", TEXT);
    expectStats("RK-135", { name: "仮面ライダードレイクMF", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-135", ["N"]);
  });

  it("RK-135: ※ アタックされるときは BP5000 としてバトルする（BP4000 のアタックに勝ち残る）（出典: atwiki/page-632「※これはアタックされるときBP+4000される」・grnrngr/faq-card-4 RS-226 Q（ドレイクMF はアタックされるとき BP5000））", () => {
    let s = enemyTurn({ battle: [inst("RK-135", "mf")] }, { battle: [inst("SPEC-E4", "a")] });
    s = resolveAll(attack(s, "SPEC-E4:a", "RK-135:mf", "player2"));
    expect(zoneOf(s, "player1", "RK-135:mf")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E4:a")).toBe("discard");
  });

  it("RK-135: ※ アタックするときは BP+4000 されない（BP1000 のまま）（出典: atwiki/page-632「アタックされるとき」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-135", "mf")] }, { battle: [inst("SPEC-E2", "d")] }), "RK-135:mf", "SPEC-E2:d"));
    expect(zoneOf(s, "player1", "RK-135:mf")).toBe("discard");
    expect(bpOf(board({ battle: [inst("RK-135", "mf")] }), "player1", "RK-135:mf")).toBe(1000);
  });

  /** 山札の下が必要パワー3 のカード。 */
  const search = (deck = [inst("SPEC-E1", "top"), inst("SPEC-E3", "bottom")]) =>
    rcRideOff(board({ rush: [inst("RK-135", "mf"), inst("SPEC-VEHICLE", "v")], deck }), "RK-135:mf", "SPEC-VEHICLE:v");

  it("RK-135: RC — 数字を1つ宣言するかを選べる（任意）（出典: atwiki/page-632「数字を1つ宣言してもよい」）", () => {
    const s = search();
    expectChoiceFrom(s, "player1", "RK-135");
    expect(s.pendingEffectChoice?.kind).toBe("declare_number");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-135: RC — 宣言した数字と山札の下のカードの必要パワーが同じなら、そのカードを手札に加える（出典: atwiki/page-632「宣言した数字と同じなら、自分の手札に加え」）", () => {
    const s = settle(pick(search(), "3"));
    expect(zoneOf(s, "player1", "SPEC-E3:bottom")).toBe("hand");
  });

  it("RK-135: RC — 違えば山札の下に戻す（出典: atwiki/page-632「それ以外なら山札の下に戻す」）", () => {
    const s = settle(pick(search(), "1"));
    expect(zoneOf(s, "player1", "SPEC-E3:bottom")).toBe("deck");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("SPEC-E3:bottom");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RK-135: RC — 宣言しなければ山札は変わらない（出典: atwiki/page-632「宣言してもよい。そうしたとき」）", () => {
    const s = settle(skip(search()));
    expect(s.players.player1.deck.map((c) => c.instanceId)).toEqual(["SPEC-E1:top", "SPEC-E3:bottom"]);
  });
});

// ===========================================================================
describe("RK-136 仮面ライダードレイクRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ライダーシューティング】これをラッシュしたとき、自軍パワーゾーンのオモテ向きのカードを見て、その枚数以下の必要パワーの数値を持つ追加条件を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("RK-136: カタログ本文・スペックが出典と一致（出典: atwiki/page-668）", () => {
    expectCatalogText("RK-136", TEXT);
    expectStats("RK-136", {
      name: "仮面ライダードレイクRF",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "1/4",
      powerCost: "3+",
      comboNumber: undefined,
      features: ["仮面ライダー", "男", "加速"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-136", ["NR"]);
  });

  const enemy = {
    battle: [inst("SPEC-E4", "c4"), inst("SPEC-E5", "c5"), inst("SPEC-ECOND", "cond")],
    rush: [inst("SPEC-EM4", "m4"), inst("SPEC-E1", "c1")],
  };
  /** パワーゾーン: オモテ3枚・ウラ（ダメージ）2枚。追加条件でドレイクMF を送ると、オモテは4枚。 */
  const rushRf = (p2: Partial<GameState["players"]["player2"]> = enemy, power = [...powerCards(3), ...damageCards(2)]) =>
    rushFromHand(rushPhase({ hand: [inst("RK-136", "rf")], rush: [inst("RK-135", "mf")], power, command: releasedCat("OT", 1) }, p2), "player1", "RK-136:rf", { materials: ["RK-135:mf"] });

  it("RK-136: 追加条件 — 自軍「仮面ライダードレイクMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-668「自軍「仮面ライダードレイクMF」1体をパワーゾーンに送る」）", () => {
    const r = rushRf({});
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-136:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-135:mf")).toBe("power");
  });

  it("RK-136: 追加条件 — ドレイクMF 以外の S ユニットでは満たせない（出典: atwiki/page-668）", () => {
    const s = rushPhase({ hand: [inst("RK-136", "rf")], rush: [inst("SPEC-E1", "x")], power: powerCards(3), command: releasedCat("OT", 1) });
    expect(legal(s).some((a) => "sourceInstanceId" in a && a.sourceInstanceId === "RK-136:rf")).toBe(false);
  });

  it("RK-136: ラッシュしたとき、自軍パワーゾーンのオモテ向きのカードの枚数（追加条件で送ったドレイクMF を含む。ダメージは数えない）以下の必要パワーを持つ、追加条件を持たない敵軍ユニット（エリア・サイズを問わない）を1体選べる（任意）（出典: atwiki/page-668・カード評価「除去はエリアとサイズを問わない」「追加条件でのパワー加速をあわせれば」）", () => {
    const r = rushRf();
    expect(r.ok, r.error).toBe(true);
    const s = r.state;
    expectChoiceFrom(s, "player1", "RK-136");
    expect(choiceIds(s)).toEqual(["SPEC-E1:c1", "SPEC-E4:c4", "SPEC-EM4:m4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-136: 選んだユニットは持ち主のパワーゾーンに（オモテ向きで）送られる（出典: atwiki/page-668「持ち主のパワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(pick(rushRf().state, "SPEC-EM4:m4"));
    expect(zoneOf(s, "player2", "SPEC-EM4:m4")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-EM4:m4")?.faceDown ?? false).toBe(false);
  });

  it("RK-136: 送らないこともできる（出典: atwiki/page-668「送ってもよい」）", () => {
    const s = settle(skip(rushRf().state));
    expect(zoneOf(s, "player2", "SPEC-E4:c4")).toBe("battle");
  });

  it("RK-136: ※ 相手の効果では選ばれない（敵軍の RS-245 の対象にならない）（出典: atwiki/page-668「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = enemyTurn({ battle: [inst("RK-136", "rf"), inst("SPEC-E1", "own")] }, { hand: [inst("RS-245", "op")], command: releasedCat("WB", 1, "e"), power: powerCards(5) }, "rush");
    const r = playOp(s, "player2", "RS-245:op");
    const next = r.ok ? r.state : s;
    expect(next.pendingEffectChoice?.validInstanceIds ?? []).not.toContain("RK-136:rf");
  });

  it("RK-136: ※ アタックの対象には選ばれる（出典: atwiki/page-668「アタックされる以外では」）", () => {
    const s = enemyTurn({ battle: [inst("RK-136", "rf")] }, { battle: [inst("SPEC-E5", "a")] });
    expect(legal(s).some((a) => a.type === "battle" && a.defenderInstanceId === "RK-136:rf")).toBe(true);
  });

  it.todo(
    "RK-136: ※「相手に選ばれない」は、パワーゾーン・捨札などゾーンにあるときも有効か（出典: grnrngr/faq-rider-1 の「パワーゾーンやコマンドゾーンにあるカードは…有効ではない」と、atwiki 公式回答の転載・grnrngr/faq-card-3 RS-149 Q1「有効」）— 公式の回答どうしが食い違い、ユーザーの判断待ち（エンジンは現状「ゾーンでも有効」のまま変えていない）",
  );
});

// ===========================================================================
describe("RK-137 ワームサナギ体", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RK-137: カタログ本文・スペックが出典と一致（出典: atwiki/page-638）", () => {
    expectCatalogText("RK-137", TEXT);
    expectStats("RK-137", { name: "ワームサナギ体", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["ワーム", "怪人"] });
    expectRarityIn("RK-137", ["N"]);
  });
});

// ===========================================================================
describe("RK-138 ウカワーム", () => {
  const TEXT =
    "※これはラッシュしたターンにバトルエリアに出られない。 【不安定な擬態】これが撃破されて捨札になったとき、相手は自分自身の捨札から特徴「女」を持つユニットカードを1枚選び、自分自身のラッシュエリアに出してもよい。相手がそうしなかったとき、自軍捨札から「ウカワーム」以外の特徴「女」を持つユニットカードを1枚選び、自分の手札に戻してもよい。";

  it("RK-138: カタログ本文・スペックが出典と一致（出典: atwiki/page-639）", () => {
    expectCatalogText("RK-138", TEXT);
    expectStats("RK-138", { name: "ウカワーム", category: "DA", size: "S", bp: 2000, sp: 1, powerCost: 5, comboNumber: undefined, features: ["ワーム", "怪人", "女", "加速"] });
    expectRarityIn("RK-138", ["N"]);
  });

  it("RK-138: ※ ラッシュしたターンはバトルエリアに出られない（出典: atwiki/page-639「※これはラッシュしたターンにバトルエリアに出られない」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-138", "uk")], power: powerCards(5), command: releasedCat("DA", 1) }), "player1", "RK-138:uk");
    expect(r.ok, r.error).toBe(true);
    const s = nextPhase(settle(r.state));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-138:uk")).toBe(false);
  });

  it("RK-138: ※ 前のターンからラッシュエリアにあれば、バトルエリアに出られる（出典: atwiki/page-639「ラッシュしたターンに」）", () => {
    expect(canEnter(board({ rush: [inst("RK-138", "uk")] }), "RK-138:uk")).toBe(true);
  });

  /** 敵軍（player2）ターンに BP13000 のユニットにアタックされて撃破される。 */
  const destroyed = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) =>
    settle(attack(enemyTurn({ battle: [inst("RK-138", "uk")], ...p1 }, { battle: [inst("TST-UNIT-7", "atk")], ...p2 }), "TST-UNIT-7:atk", "RK-138:uk", "player2"));
  const p1Discard = { discard: [inst("SPEC-WOMAN", "w1"), inst("RK-138", "uk2"), inst("SPEC-MAN", "m1"), inst("TST-OP", "op")] };
  const p2Discard = { discard: [inst("SPEC-WOMAN2", "ew"), inst("SPEC-MAN", "em")] };

  it("RK-138: 撃破されて捨札になったとき、まず相手が自分自身の捨札の特徴「女」を持つユニットカードを1枚選び、自分自身のラッシュエリアに出せる（任意）（出典: atwiki/page-639「相手は自分自身の捨札から特徴「女」を持つユニットカードを1枚選び、自分自身のラッシュエリアに出してもよい」）", () => {
    const s = destroyed(p1Discard, p2Discard);
    expect(zoneOf(s, "player1", "RK-138:uk")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-WOMAN2:ew"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-138: 相手が出したら、相手のラッシュエリアに出て、自分は手札に戻せない（出典: atwiki/page-639「相手がそうしなかったとき」）", () => {
    const s = resolveAll(pick(destroyed(p1Discard, p2Discard), "SPEC-WOMAN2:ew"));
    expect(zoneOf(s, "player2", "SPEC-WOMAN2:ew")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-WOMAN:w1")).toBe("discard");
  });

  it("RK-138: 相手が出さなければ、自軍捨札の「ウカワーム」以外の特徴「女」を持つユニットカードを1枚選び、手札に戻せる（任意）（出典: atwiki/page-639「自軍捨札から「ウカワーム」以外の特徴「女」を持つユニットカードを1枚選び、自分の手札に戻してもよい」）", () => {
    let s = settle(skip(destroyed(p1Discard, p2Discard)));
    expectChoiceFrom(s, "player1", "RK-138");
    expect(choiceIds(s)).toEqual(["SPEC-WOMAN:w1"]);
    expect(canSkip(s)).toBe(true);
    s = settle(pick(s, "SPEC-WOMAN:w1"));
    expect(zoneOf(s, "player1", "SPEC-WOMAN:w1")).toBe("hand");
  });

  it("RK-138: 相手の捨札に特徴「女」のユニットカードがなければ（相手は出せないので）、自分が手札に戻せる（出典: atwiki/page-639「相手がそうしなかったとき」）", () => {
    const s = destroyed(p1Discard, { discard: [inst("SPEC-MAN", "em")] });
    expectChoiceFrom(s, "player1", "RK-138");
    expect(choiceIds(s)).toEqual(["SPEC-WOMAN:w1"]);
  });

  it("RK-138: 撃破されずに場に残ったときは発動しない（出典: atwiki/page-639「撃破されて捨札になったとき」）", () => {
    const s = settle(attack(enemyTurn({ battle: [inst("RK-138", "uk")], ...p1Discard }, { battle: [inst("SPEC-E1", "atk")], ...p2Discard }), "SPEC-E1:atk", "RK-138:uk", "player2"));
    expect(zoneOf(s, "player1", "RK-138:uk")).toBe("battle");
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RK-139 仮面ライダーゼロノスAF", () => {
  const TEXT = "【俺はかーなーり強い】相手は自分自身のラッシュエリアからユニットを1体選び、可能ならバトルエリアに出す。";

  it("RK-139: カタログ本文・スペックが出典と一致（出典: atwiki/page-670）", () => {
    expectCatalogText("RK-139", TEXT);
    expectStats("RK-139", {
      name: "仮面ライダーゼロノスAF",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "1/4",
      powerCost: "3+",
      comboNumber: "RC",
      features: ["仮面ライダー", "男"],
      rushCondition: "discard_hand_card",
    });
    expectRarityIn("RK-139", ["NR"]);
  });

  it("RK-139: 追加条件 — 自分の手札を1枚選び捨札にしてラッシュできる（出典: atwiki/page-670「自分の手札を1枚選び捨札にする」）", () => {
    const s0 = rushPhase({ hand: [inst("RK-139", "af"), inst("TST-OP", "cost")], power: powerCards(3), command: releasedCat("OT", 1) });
    const r = rushVia(s0, "player1", "RK-139:af", (a) => ((a.zordMaterialInstanceIds as string[] | undefined) ?? []).includes("TST-OP:cost"));
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-139:af")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP:cost")).toBe("discard");
  });

  const rc = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-139:af", "SPEC-VEHICLE:v");

  it("RK-139: RC — 相手が自分自身のラッシュエリアのユニット（サイズを問わない）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-670「相手は自分自身のラッシュエリアからユニットを1体選び」・カード評価「サイズ制限が無い」）", () => {
    const s = rc({ rush: [inst("SPEC-E1", "r1"), inst("SPEC-EM4", "rm")], battle: [inst("SPEC-E2", "b")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-139");
    expect(choiceIds(s)).toEqual(["SPEC-E1:r1", "SPEC-EM4:rm"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-139: RC — 選ばれたユニットは相手のバトルエリアに出る（出典: atwiki/page-670「可能ならバトルエリアに出す」）", () => {
    const s = resolveAll(pick(rc({ rush: [inst("SPEC-E1", "r1"), inst("SPEC-EM4", "rm")] }), "SPEC-EM4:rm"));
    expect(zoneOf(s, "player2", "SPEC-EM4:rm")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E1:r1")).toBe("rush");
  });

  it("RK-139: RC — バトルエリアに出られないユニット（ホースオルフェノク格闘態・パワー6枚未満）も選べ、選ばれたらラッシュエリアに残る（出典: atwiki/page-670「可能なら」・カード評価「キャッスルドランのようなバトルエリアに出るのに制限のあるユニットが相手の場にいると効果がうまく機能しなくなる」）", () => {
    let s = rc({ rush: [inst("RK-122", "ho"), inst("SPEC-E1", "r1")], power: powerCards(2, "ep") });
    expect(choiceIds(s)).toEqual(["RK-122:ho", "SPEC-E1:r1"]);
    s = resolveAll(pick(s, "RK-122:ho"));
    expect(zoneOf(s, "player2", "RK-122:ho")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E1:r1")).toBe("rush");
  });

  it("RK-139: RC — 相手のラッシュエリアにユニットがなければ何も起きない（出典: atwiki/page-670）", () => {
    const s = settle(rc({ battle: [inst("SPEC-E1", "b")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-139");
  });
});

// ===========================================================================
describe("RK-140 仮面ライダー電王LF", () => {
  const TEXT =
    "※これが自軍エリアにある間、必要パワーの数字が2以下のユニットはバトルエリアに出られない。 【電車斬り】自軍ターン中、これがバトルエリアに出たとき、自軍常駐置き場のオモテ向きのカードの中から、本来の特徴に「DEN-O」を持つユニットカードを1枚選び、捨札にしてもよい。そうしたとき、相手に1点ダメージを与える。";

  it("RK-140: カタログ本文・スペックが出典と一致（出典: atwiki/page-671）", () => {
    expectCatalogText("RK-140", TEXT);
    expectStats("RK-140", {
      name: "仮面ライダー電王LF",
      category: "OT",
      size: "S",
      bp: 6000,
      sp: "1/4",
      powerCost: "5+",
      comboNumber: undefined,
      features: ["仮面ライダー", "男", "DEN-O"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-140", ["SR"]);
  });

  it("RK-140: ※ 自軍ラッシュエリアにあるときも、必要パワー2以下のユニットは（自軍・敵軍とも）バトルエリアに出られない。3以上なら出られる（出典: atwiki/page-671「これが自軍エリアにある間」）", () => {
    const s = board({ rush: [inst("RK-140", "lf"), inst("SPEC-E2", "low"), inst("SPEC-E3", "mid")] });
    expect(canEnter(s, "SPEC-E2:low")).toBe(false);
    expect(canEnter(s, "SPEC-E3:mid")).toBe(true);
    const e = enemyTurn({ rush: [inst("RK-140", "lf")] }, { rush: [inst("SPEC-E1", "low"), inst("SPEC-E3", "mid")] });
    expect(canEnter(e, "SPEC-E1:low", "player2")).toBe(false);
    expect(canEnter(e, "SPEC-E3:mid", "player2")).toBe(true);
  });

  it("RK-140: 公式Q&A — 効果でバトルエリアに出すときも、必要パワー2以下のユニットは出せない（電王RF【一本釣り】で選べない）（出典: grnrngr/faq-rider-2 RK-140 Q「否定文を優先するルールにより、必要パワー2以下のカードをバトルエリアに出すことはできません」）", () => {
    const s = rcRideOff(
      board({ rush: [inst("RK-140", "lf"), inst("RK-061", "rf"), inst("SPEC-VEHICLE", "v")] }, { power: [inst("SPEC-E2", "p2"), inst("SPEC-E3", "p3")] }),
      "RK-061:rf",
      "SPEC-VEHICLE:v",
    );
    expect(choiceIds(s)).toEqual(["SPEC-E3:p3"]);
  });

  /** 自軍常駐置き場: オモテの DEN-O ユニットを重ねた常駐。 */
  const resident = (stacked: CardInstance[]) => ({ ...inst("SPEC-RES", "res"), stackedCards: stacked });
  const densha = (stacked: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ rush: [inst("RK-140", "lf")], operation: [resident(stacked)], ...p1 }, { battle: [inst("SPEC-E1", "e")] }), "RK-140:lf");

  it("RK-140:【電車斬り】自軍ターン中に出たとき、常駐置き場のオモテ向きの、本来の特徴に「DEN-O」を持つユニットカードだけを選べる（任意）（出典: atwiki/page-671「本来の特徴に「DEN-O」を持つユニットカードを1枚選び、捨札にしてもよい」）", () => {
    const s = densha([inst("SPEC-DENO", "d1"), inst("SPEC-MAN", "m1")]);
    expectChoiceFrom(s, "player1", "RK-140");
    expect(choiceIds(s)).toEqual(["SPEC-DENO:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-140:【電車斬り】捨札にしなければダメージを与えない（出典: atwiki/page-671「捨札にしてもよい。そうしたとき」）", () => {
    const s = settle(skip(densha([inst("SPEC-DENO", "d1")])));
    expect(s.players.player2.damage).toBe(0);
  });

  it("RK-140:【電車斬り】常駐置き場に DEN-O のユニットカードがなければ、ダメージを与えない（出典: atwiki/page-671「そうしたとき、相手に1点ダメージを与える」）", () => {
    const s = settle(densha([inst("SPEC-MAN", "m1")]));
    expect(s.players.player2.damage).toBe(0);
  });

  it("RK-140:【電車斬り】敵軍ターン中にバトルエリアに出たときは発動しない（ガードチェイサーで相手のストライクに割り込んで出る）（出典: atwiki/page-671「自軍ターン中、」）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { rush: riding(inst("RK-111", "gc"), inst("RK-140", "lf")), operation: [resident([inst("SPEC-DENO", "d1")])], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-0", "st")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = strike(s, "TST-UNIT-0:st", "player2");
    expect(interceptOffered(s, "RK-140:lf")).toBe(true);
    s = intercept(s, "RK-140:lf");
    expect(zoneOf(s, "player1", "RK-140:lf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-140");
  });
});
