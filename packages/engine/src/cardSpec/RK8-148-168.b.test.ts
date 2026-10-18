/**
 * カード別スペック: RK-155〜RK-161（ザ・マスクドライダーEXP vol.2 キングライナー〜ショッカーライダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-160・RK-161 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-KW-MORPH-01、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-161 公式Q&A Q3（巨大化爆弾・暗黒の鎧を重ねたショッカーライダーを含んでも SP1）— cardSpec/RS5-243-263.b.test.ts RS-255 の it.todo（巨大化爆弾の手順がエンジンにない）
 *  - RK-157 ※「バトルエリアに出たとき撃破される」— rules/imaginDestroyOnEnter.test.ts
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import { fillerEntries } from "../rulesSpec/01-helpers";
import {
  act,
  KW_MORPH,
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  bpOf,
  canConfirm,
  canEnter,
  confirm,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  heldUnit,
  inst,
  lastBattleBps,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  returnAll,
  riding,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RK8-148-168.helpers";

const RC = rcUnit("SPEC-RC", { category: "OT", bp: 1000 });
const VEH_S = sUnit("SPEC-VEH-S", { category: "OT", bp: 3000, powerCost: 3, features: ["車両"] });
const VEH_M = sUnit("SPEC-VEH-M", { category: "OT", bp: 4000, powerCost: 3, size: "M", features: ["メカ", "車両"] });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "OT", bp: 4000, powerCost: 3, size: "M", features: ["メカ"] });
const ATK8000 = sUnit("SPEC-ATK8000", { bp: 8000 });
const D6000 = sUnit("SPEC-D6000", { bp: 6000 });
const IMAGIN = sUnit("SPEC-IMAGIN", { category: "DA", bp: 1000, features: ["イマジン"] });
const MINUS_S = sUnit("SPEC-MINUS-S", { bp: 3000, powerCost: "3-" as never });
const MINUS_M = sUnit("SPEC-MINUS-M", { bp: 7000, powerCost: "7-" as never, size: "M" });
const PLUS_S = sUnit("SPEC-PLUS-S", { bp: 3000, powerCost: "3+" as never });
const ES = sUnit("SPEC-ES", { bp: 1000, powerCost: 1 });
/** シザーズジャガー用: 敵軍がラッシュするユニット（必要パワー5）と、自軍の手札のユニット。 */
const E5 = sUnit("SPEC-E5", { category: "WB", bp: 3000, powerCost: 5 });
const E5M = sUnit("SPEC-E5M", { category: "WB", bp: 6000, powerCost: 5, size: "M" });
const E5C = sUnit("SPEC-E5C", {
  category: "WB",
  bp: 3000,
  powerCost: "5+" as never,
  rushAdditionalCondition: { conditionId: "send_s_unit_to_power", text: "自軍Sユニットを1体パワーゾーンに送る。", unitCount: 1 } as never,
});
const DA5 = sUnit("SPEC-DA5", { category: "DA", bp: 4000, powerCost: 5 });
const DA5C = sUnit("SPEC-DA5C", {
  category: "DA",
  bp: 6000,
  powerCost: "5+" as never,
  size: "M",
  rushAdditionalCondition: { conditionId: "discard_hand_card", text: "自分の手札を1枚選び捨札にする", unitCount: 1 } as never,
});
const WB5 = sUnit("SPEC-WB5", { category: "WB", bp: 4000, powerCost: 5 });
const DA4 = sUnit("SPEC-DA4", { category: "DA", bp: 4000, powerCost: 4 });
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const MORPH_T = sUnit("SPEC-MORPH-T", { category: "WB", bp: 3000, powerCost: 5, features: ["仮面ライダー", "男"] });
const RES = { id: "SPEC-RES", name: "SPEC-RES", type: "operation", category: "OT", rarity: "N", expansion: "card-spec", powerCost: 0 } as never;
const EXTRA = [PLAIN_VEHICLE, RC, VEH_S, VEH_M, PLAIN_M, ATK8000, D6000, IMAGIN, MINUS_S, MINUS_M, PLUS_S, ES, E5, E5M, E5C, DA5, DA5C, WB5, DA4, MORPH, MORPH_T, RES];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, phase: GameState["phase"] = "battle") =>
  st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）スタートフェイズの盤面。 */
const startPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "start", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-155 キングライナー", () => {
  const TEXT =
    "※これはアタックされるときBP+4000される。 【車両の収納と発車】自軍ターン中、これがバトルエリアに出たとき、自軍バトルエリアから特徴「車両」を持つMユニットを1体選び、自軍パワーゾーンに送ってもよい。また、これがラッシュエリアに戻るとき、自軍パワーゾーンのオモテ向きのカードから、特徴「車両」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。";

  it("RK-155: カタログ本文・スペックが出典と一致（出典: atwiki/page-678）", () => {
    expectCatalogText("RK-155", TEXT);
    expectStats("RK-155", { name: "キングライナー", category: "OT", size: "L", bp: 5000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["メカ", "車両"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-155", ["N"]);
  });

  it("RK-155: ※ アタックされるとき BP+4000（BP9000 で BP8000 の敵軍ユニットに勝ち、残る）（出典: atwiki/page-678「※これはアタックされるときBP+4000される」・カード評価「アタックを受けるときはBP9000」）", () => {
    let s = enemyTurn({ battle: [inst("RK-155", "kl")] }, { battle: [inst("SPEC-ATK8000", "a")] });
    s = resolveAll(attack(s, "SPEC-ATK8000:a", "RK-155:kl", "player2"));
    expect(zoneOf(s, "player1", "RK-155:kl")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK8000:a")).toBe("discard");
  });

  it("RK-155: ※ 自分からアタックするときは BP5000 のまま（出典: atwiki/page-678「アタックされるとき」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-155", "kl")] }, { battle: [inst("SPEC-D6000", "d")] }), "RK-155:kl", "SPEC-D6000:d"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
  });

  const entered = (battle = [inst("RK-147", "is"), inst("SPEC-VEH-S", "vs"), inst("SPEC-PLAIN-M", "pm")], rush = [inst("SPEC-VEH-M", "rm")]) =>
    enter(board({ battle, rush: [inst("RK-155", "kl"), ...rush] }, { battle: [inst("SPEC-VEH-M", "em")] }), "RK-155:kl");

  it("RK-155: 自軍ターン中にバトルエリアに出たとき、自軍バトルエリアの特徴「車両」を持つ M ユニットだけから1体選べる（S・車両でない M・ラッシュエリア・敵軍は対象外。任意）（出典: atwiki/page-678「自軍バトルエリアから特徴「車両」を持つMユニットを1体選び、自軍パワーゾーンに送ってもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-155");
    expect(choiceIds(s)).toEqual(["RK-147:is"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-155: 選んだユニットは自軍パワーゾーンにオモテ向きで送られる（出典: atwiki/page-678「自軍パワーゾーンに送ってもよい」）", () => {
    const s = resolveAll(pick(entered(), "RK-147:is"));
    expect(zoneOf(s, "player1", "RK-147:is")).toBe("power");
    expect(cardIn(s, "player1", "RK-147:is")?.faceDown ?? false).toBe(false);
  });

  it("RK-155: 送らなければ何も起きない（出典: atwiki/page-678「送ってもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player1", "RK-147:is")).toBe("battle");
  });

  const returned = (power = [faceUp("RK-147", "p1"), faceDown("RK-151", "dm"), faceUp("SPEC-VEH-S", "ps"), faceUp("SPEC-PLAIN-M", "pm")]) =>
    returnAll(startPhase({ battle: [inst("RK-155", "kl")], power }));

  it("RK-155: ラッシュエリアに戻るとき、自軍パワーゾーンのオモテ向きの、特徴「車両」を持つ M ユニットのカードだけから1枚選べる（ダメージ・S・車両でない M は対象外。任意）（出典: atwiki/page-678「自軍パワーゾーンのオモテ向きのカードから、特徴「車両」を持つMユニットのカードを1枚選び」）", () => {
    const s = returned();
    expect(zoneOf(s, "player1", "RK-155:kl")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-155");
    expect(choiceIds(s)).toEqual(["RK-147:p1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-155: 選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-678「自軍ラッシュエリアに出してもよい」）", () => {
    const s = settle(pick(returned(), "RK-147:p1"));
    expect(zoneOf(s, "player1", "RK-147:p1")).toBe("rush");
  });

  it("RK-155: 出さなければパワーゾーンに残る（出典: atwiki/page-678「出してもよい」）", () => {
    const s = settle(skip(returned()));
    expect(zoneOf(s, "player1", "RK-147:p1")).toBe("power");
  });

  it("RK-155: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は、パワーゾーンに送る効果は発動しない（出典: atwiki/page-678「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    let s = enemyTurn({ battle: [inst("RK-147", "is")], rush: [inst("RK-155", "kl")] }, { rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v")] });
    s = rcRideOff(s, "RK-139:af", "SPEC-VEHICLE:v", "player2");
    s = pick(s, "RK-155:kl");
    expect(zoneOf(s, "player1", "RK-155:kl")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-155");
  });
});

// ===========================================================================
describe("RK-156 マシンデンバード", () => {
  const TEXT =
    "【デンライナー搭乗】これがバトルエリアからラッシュエリアに戻るとき、これがライドされていれば次の効果を発動できる⇒自軍山札から特徴「車両」を持つMユニットのカードを1枚選び、相手に見せてから自分の手札に加えてもよい。その後、山札をシャッフルする。";

  it("RK-156: カタログ本文・スペックが出典と一致（出典: atwiki/page-680）", () => {
    expectCatalogText("RK-156", TEXT);
    expectVehicleStats("RK-156", { name: "マシンデンバード", category: "OT", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-156", ["N"]);
  });

  const deck = [inst("TST-OP", "d0"), inst("RK-147", "d1"), inst("SPEC-VEH-S", "d2"), inst("SPEC-PLAIN-M", "d3"), inst("RK-151", "d4")];
  const returned = (ridden = true, p2: Partial<GameState["players"]["player2"]> = {}) =>
    returnAll(startPhase({ battle: ridden ? riding(inst("RK-156", "db"), inst("SPEC-RC", "r")) : [inst("RK-156", "db"), inst("SPEC-RC", "r")], deck }, p2));

  it("RK-156: ライドされたままラッシュエリアに戻るとき、自軍山札の特徴「車両」を持つ M ユニットのカードだけから1枚選べる（任意）（出典: atwiki/page-680「自軍山札から特徴「車両」を持つMユニットのカードを1枚選び、…手札に加えてもよい」）", () => {
    const s = returned();
    expectChoiceFrom(s, "player1", "RK-156");
    expect(choiceIds(s)).toEqual(["RK-147:d1", "RK-151:d4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-156: 選んだカードは手札に加わる（出典: atwiki/page-680「自分の手札に加えてもよい」）", () => {
    const s = settle(pick(returned(), "RK-151:d4"));
    expect(zoneOf(s, "player1", "RK-151:d4")).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RK-156: その後、山札をシャッフルする（敵軍 RK-132 闘鬼【妻子のバックアップ】が発動できる）（出典: atwiki/page-680「その後、山札をシャッフルする」・RK-132 本文「敵軍山札がシャッフルされたとき」）", () => {
    const s = settle(pick(returned(true, { rush: [heldUnit("RK-132", "tk")] }), "RK-151:d4"));
    expectChoiceFrom(s, "player2", "RK-132");
  });

  it("RK-156: ライドされていなければ発動しない（出典: atwiki/page-680「これがライドされていれば」）", () => {
    const s = returned(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-156");
  });

  it("RK-156: バトルエリアに出ただけ（ナンバーコンビネーション）では発動しない（出典: atwiki/page-680「これがバトルエリアからラッシュエリアに戻るとき」）", () => {
    let s = board({ rush: [inst("RK-156", "db"), inst("SPEC-RC", "r")], deck, power: powerCards(1) });
    s = settle(rcRideOff(s, "SPEC-RC:r", "RK-156:db"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-156");
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RK-157 バットイマジン", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【契約者の望むもの】これが自軍バトルエリアからラッシュエリアに戻るとき、自軍常駐置き場からカードを1枚選び、自分の手札に加えてもよい。ただし、ウラ向きのカードはウラ向きのまま選ぶ。";

  it("RK-157: カタログ本文・スペックが出典と一致（出典: atwiki/page-637）", () => {
    expectCatalogText("RK-157", TEXT);
    expectStats("RK-157", { name: "バットイマジン", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 0, comboNumber: undefined, features: ["イマジン"] });
    expectRarityIn("RK-157", ["N"]);
  });

  const returned = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = { operation: [inst("SPEC-RES", "er")] }) =>
    returnAll(startPhase({ battle: [inst("RK-157", "bt")], operation: [inst("SPEC-RES", "r1"), { ...inst("TST-OP", "fd"), faceDown: true }], ...p1 }, p2));

  it("RK-157: 自軍バトルエリアからラッシュエリアに戻るとき、自軍常駐置き場のカード（ウラ向きのカードを含む）から1枚選べる（敵軍の常駐は対象外。任意）（出典: atwiki/page-637「自軍常駐置き場からカードを1枚選び」「ウラ向きのカードはウラ向きのまま選ぶ」）", () => {
    const s = returned();
    expect(zoneOf(s, "player1", "RK-157:bt")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-157");
    expect(choiceIds(s)).toEqual(["SPEC-RES:r1", "TST-OP:fd"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-157: 選んだカードは自分の手札に加わる（出典: atwiki/page-637「自分の手札に加えてもよい」）", () => {
    const s = settle(pick(returned(), "SPEC-RES:r1"));
    expect(zoneOf(s, "player1", "SPEC-RES:r1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:fd")).toBe("operation");
  });

  it("RK-157: ウラ向きのカードもそのまま選んで手札に加えられる（出典: atwiki/page-637「ウラ向きのカードはウラ向きのまま選ぶ」）", () => {
    const s = settle(pick(returned(), "TST-OP:fd"));
    expect(zoneOf(s, "player1", "TST-OP:fd")).toBe("hand");
  });

  it("RK-157: 加えなければ常駐置き場に残る（出典: atwiki/page-637「加えてもよい」）", () => {
    const s = settle(skip(returned()));
    expect(s.players.player1.operation).toHaveLength(2);
  });

  it("RK-157: 自軍常駐置き場にカードがなければ選択は開かない（出典: atwiki/page-637）", () => {
    const s = returned({ operation: [] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-157");
  });
});

// ===========================================================================
describe("RK-158 ギガンデスヘブン", () => {
  const TEXT = "※これは自分の手札からカードを2枚選び、捨札にしなければバトルエリアに出られない。";

  it("RK-158: カタログ本文・スペックが出典と一致（出典: atwiki/page-704）", () => {
    expectCatalogText("RK-158", TEXT);
    expectStats("RK-158", { name: "ギガンデスヘブン", category: "DA", size: "M", bp: 7500, sp: 1, powerCost: "7-", comboNumber: undefined, features: ["イマジン"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-158", ["NR"]);
  });

  it("RK-158: 追加条件 — 特徴「イマジン」を持つ自軍ユニット1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-704「特徴「イマジン」を持つ自軍ユニット1体を捨札にすれば必要パワー0になる」）", () => {
    const s = rushPhase({ hand: [inst("RK-158", "gh")], rush: [inst("SPEC-IMAGIN", "im"), inst("TST-UNIT-0", "x")], command: releasedCat("DA", 1), power: [] });
    const r = rushVia(s, "player1", "RK-158:gh", (a) => a.zordMaterialInstanceId === "SPEC-IMAGIN:im");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RK-158:gh")).toBe("rush");
    expect(zoneOf(t, "player1", "SPEC-IMAGIN:im")).toBe("discard");
  });

  it("RK-158: 追加条件 — イマジンでないユニットは捨札にできない（パワー0ではラッシュできない）（出典: atwiki/page-704「特徴「イマジン」を持つ自軍ユニット」）", () => {
    const s = rushPhase({ hand: [inst("RK-158", "gh")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("DA", 1), power: [] });
    expect(canStartRush(s, "player1", "RK-158:gh")).toBe(false);
  });

  it("RK-158: 必要パワー7- — イマジンがいなければパワー7でラッシュできる（出典: atwiki/page-704「必要パワー：7-」）", () => {
    const s = rushPhase({ hand: [inst("RK-158", "gh")], command: releasedCat("DA", 1), power: powerCards(7) });
    const r = rushFromHand(s, "player1", "RK-158:gh");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-158:gh")).toBe("rush");
  });

  it("RK-158: ※ 手札を2枚選んで捨札にすればバトルエリアに出られる（選んだ2枚が捨札になる）（出典: atwiki/page-704「自分の手札からカードを2枚選び、捨札にしなければバトルエリアに出られない」）", () => {
    let s = enter(board({ rush: [inst("RK-158", "gh")], hand: [inst("TST-OP", "h0"), inst("TST-OP", "h1"), inst("TST-OP", "h2")] }), "RK-158:gh");
    for (const id of ["TST-OP:h0", "TST-OP:h2"]) if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    if (s.pendingEffectChoice && canConfirm(s)) s = confirm(s);
    // 捨札にする手順を済ませてから、あらためてバトルエリアに出す（エンジンの「出るときの支払い」の手順）。
    if (zoneOf(s, "player1", "RK-158:gh") === "rush") s = enter(s, "RK-158:gh");
    s = settle(s);
    expect(zoneOf(s, "player1", "RK-158:gh")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:h2")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:h1")).toBe("hand");
  });

  it("RK-158: ※ 手札が1枚ならバトルエリアに出られない（出典: atwiki/page-704「カードを2枚選び、捨札にしなければ」）", () => {
    const s = board({ rush: [inst("RK-158", "gh")], hand: [inst("TST-OP", "h0")] });
    expect(canEnter(s, "RK-158:gh")).toBe(false);
  });
});

// ===========================================================================
describe("RK-159 仮面ライダーV3（THE NEXT）", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【V3キック】必要パワーの数字に「－」のある敵軍Sユニットを1体選び撃破してもよい。";

  it("RK-159: カタログ本文・スペックが出典と一致（出典: atwiki/page-655）", () => {
    expectCatalogText("RK-159", TEXT);
    expectStats("RK-159", { name: "仮面ライダーV3（THE NEXT）", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-159", ["SR"]);
  });

  it("RK-159: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-655「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-159", "v3")] }, "RK-159:v3"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-MINUS-S", "ms"), inst("SPEC-PLUS-S", "ps"), inst("SPEC-MINUS-M", "mm")], rush: [inst("SPEC-MINUS-S", "rs")] };
  const rc = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    rcRideOff(board({ rush: [inst("RK-159", "v3"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-159:v3", "SPEC-VEHICLE:v");

  it("RK-159: RC — 必要パワーに「－」のある敵軍 S ユニット（エリアを問わない）だけから1体選べる（M・「＋」は対象外。任意）（出典: atwiki/page-655「必要パワーの数字に「－」のある敵軍Sユニットを1体選び撃破してもよい」・カード評価「エリアを問わず「－」ユニットを除去できる」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "RK-159");
    expect(choiceIds(s)).toEqual(["SPEC-MINUS-S:ms", "SPEC-MINUS-S:rs"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-159: RC — 選んだユニットを撃破する（出典: atwiki/page-655「撃破してもよい」）", () => {
    const s = resolveAll(pick(rc(), "SPEC-MINUS-S:rs"));
    expect(zoneOf(s, "player2", "SPEC-MINUS-S:rs")).toBe("discard");
  });

  it("RK-159: RC — 撃破しないこともできる（出典: atwiki/page-655「撃破してもよい」）", () => {
    const s = resolveAll(skip(rc()));
    expect(zoneOf(s, "player2", "SPEC-MINUS-S:ms")).toBe("battle");
  });

  it("RK-159: ライドせずに出たときは RC が発動しない（出典: atwiki/page-655「CN：RC」・R-KW-RC-01）", () => {
    const s = enter(board({ rush: [inst("RK-159", "v3")] }, enemy), "RK-159:v3");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-159");
  });
});

// ===========================================================================
describe("RK-160 シザーズジャガー", () => {
  const TEXT =
    "【ナノロボット散布実験】これが自軍エリアにある間、追加条件を持たない敵軍Sユニットがラッシュされたとき、そのユニットの必要パワーの数字と同じ必要パワーの数字を持つDAのユニットカードを自分の手札から1枚選び、ラッシュエリアに出してもよい。ただし、DAの自軍コマンドを1つホールドすること。そうしたとき、ラッシュされた敵軍ユニットを撃破する。";

  it("RK-160: カタログ本文・スペックが出典と一致（出典: atwiki/page-703）", () => {
    expectCatalogText("RK-160", TEXT);
    expectStats("RK-160", { name: "シザーズジャガー", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["ショッカー", "怪人", "男", "改造人間"] });
    expectRarityIn("RK-160", ["N"]);
  });

  const hand = [inst("SPEC-DA5", "d5"), inst("SPEC-DA5C", "d5c"), inst("SPEC-WB5", "w5"), inst("SPEC-DA4", "d4")];
  /** 敵軍（player2）がラッシュフェイズに rushed を手札からラッシュする（自軍のラッシュ反応はパス）。 */
  const enemyRushes = (rushed = "SPEC-E5", p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = enemyTurn(
      { rush: [inst("RK-160", "sj")], hand, command: releasedCat("DA", 1), ...p1 },
      { hand: [inst(rushed, "er"), inst("TST-OP", "eh")], command: releasedCat("WB", 1), power: powerCards(5) },
      "rush",
    );
    const r = rushFromHand(s, "player2", `${rushed}:er`);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-160: 追加条件を持たない敵軍 S ユニット（必要パワー5）がラッシュされたとき、手札の、必要パワーの数字が5の DA のユニットカードから1枚選べる（追加条件の有無・サイズは問わない。任意）（出典: atwiki/page-703・カード評価「パワーが同じならば追加条件を満たさずともDAのカテゴリを持つあらゆるユニットを一発でラッシュでき」）", () => {
    const s = enemyRushes();
    expectChoiceFrom(s, "player1", "RK-160");
    expect(choiceIds(s)).toEqual(["SPEC-DA5:d5", "SPEC-DA5C:d5c"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-160: 選んだカードは自軍ラッシュエリアに出て、DA の自軍コマンドを1つホールドし、ラッシュされた敵軍ユニットを撃破する（出典: atwiki/page-703「ラッシュエリアに出してもよい。ただし、DAの自軍コマンドを1つホールドすること。そうしたとき、ラッシュされた敵軍ユニットを撃破する」）", () => {
    const s = resolveAll(pick(enemyRushes(), "SPEC-DA5C:d5c"));
    expect(zoneOf(s, "player1", "SPEC-DA5C:d5c")).toBe("rush");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E5:er")).toBe("discard");
  });

  it("RK-160: 出さなければ何も起きない（出典: atwiki/page-703「出してもよい」）", () => {
    const s = resolveAll(skip(enemyRushes()));
    expect(zoneOf(s, "player1", "SPEC-DA5:d5")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-E5:er")).toBe("rush");
  });

  it("RK-160: DA の自軍コマンドがリリース状態でなければ（WB だけ）発動しない（出典: atwiki/page-703「ただし、DAの自軍コマンドを1つホールドすること」・カード評価「コールDAでの代用は出来ない」）", () => {
    const s = enemyRushes("SPEC-E5", { command: releasedCat("WB", 1) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-160");
  });

  it("RK-160: 追加条件を持つ敵軍ユニットがラッシュされたときは発動しない（出典: atwiki/page-703「追加条件を持たない敵軍Sユニット」）", () => {
    const s = enemyTurn(
      { rush: [inst("RK-160", "sj")], hand, command: releasedCat("DA", 1) },
      { hand: [inst("SPEC-E5C", "er"), inst("TST-OP", "eh")], rush: [inst("TST-UNIT-0", "emat")], command: releasedCat("WB", 1), power: powerCards(5) },
      "rush",
    );
    const r = rushFromHand(s, "player2", "SPEC-E5C:er");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-160");
  });

  it("RK-160: 敵軍 M ユニットがラッシュされたときは発動しない（出典: atwiki/page-703「敵軍Sユニット」）", () => {
    const s = enemyRushes("SPEC-E5M");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-160");
  });

  it("RK-160: 自軍のユニットをラッシュしたときは発動しない（出典: atwiki/page-703「敵軍Sユニットがラッシュされたとき」）", () => {
    const s = rushPhase({ rush: [inst("RK-160", "sj")], hand: [inst("SPEC-E5", "mine"), ...hand], command: [...releasedCat("DA", 1), released("TST-OP", "w")], power: powerCards(5) });
    const r = rushFromHand(s, "player1", "SPEC-E5:mine");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RK-160");
  });

  // grnrngr/faq-rider-2 RK-160 Q1「いいえ、できません。…ラッシュに関するすべての処理が終わった時点で、自軍エリアに「RK-160 シザーズジャガー」がユニットとして場に無くてはいけないからです。」（Q の「RK-204 仮面ライダーサイガ」は RK-205 の誤記）
  it("RK-160: 公式Q&A — 敵軍の仮面ライダーサイガ（RK-205）【フライングアタッカー】でシザーズジャガーがコマンドゾーンに送られたときは発動できない（出典: grnrngr/faq-rider-2 RK-160 Q1・atwiki/page-703 Q1）", () => {
    const OPET5 = { id: "SPEC-OPET5", name: "SPEC-OPET5", type: "operation", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 5 } as never;
    const DA4 = sUnit("SPEC-DA4X", { category: "DA", bp: 1000, powerCost: 4 });
    let s = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: { rush: [inst("RK-160", "sj")], hand: [inst("SPEC-DA4X", "d4")], command: releasedCat("DA", 1), deck: deckCards(3) },
        player2: { hand: [inst("RK-205", "sg")], command: [released("SPEC-OPET5", "c5")], power: powerCards(4, "ep"), deck: deckCards(3, "e") },
      },
      [OPET5, DA4],
    );
    const r = rushFromHand(s, "player2", "RK-205:sg");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-205");
    s = act(s, s.pendingEffectChoice!.kind === "confirm" ? { type: "confirm_effect_choice", playerId: "player2" } : { type: "resolve_effect_choice", playerId: "player2", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! });
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["RK-160:sj"]);
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "RK-160:sj" }));
    expect(zoneOf(s, "player1", "RK-160:sj")).toBe("command");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-160");
  });

  // faq-rider-2 RK-160 Q2「はい、可能です。」
  it("RK-160: 公式Q&A — 自軍のラッシュに対して相手がモーフで入れ替えた（ラッシュエリアに出た）敵軍 S ユニットに対しても発動できる（出典: grnrngr/faq-rider-2 RK-160 Q2・atwiki/page-703 Q2）", () => {
    let s = rushPhase(
      { rush: [inst("RK-160", "sj")], hand: [inst("SPEC-ES", "mine"), inst("SPEC-DA5", "d5")], command: [released("TST-OP", "w"), ...releasedCat("DA", 1)], power: powerCards(5) },
      { rush: [inst("SPEC-MORPH", "m")], command: [inst("SPEC-MORPH-T", "t")] },
    );
    const r = rushFromHand(s, "player1", "SPEC-ES:mine");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expect(s.pendingEffectChoice?.effectId).toBe("morph_replacement");
    s = settle(pick(s, "SPEC-MORPH-T:t"));
    expect(zoneOf(s, "player2", "SPEC-MORPH-T:t")).toBe("rush");
    expectChoiceFrom(s, "player1", "RK-160");
    expect(choiceIds(s)).toEqual(["SPEC-DA5:d5"]);
  });

  // grnrngr/faq-rider-2 RK-160 Q3・Q4（自軍 RK-275 ゴ・ガドル・バ【ザバギンバシグラ】・RK-276 ズ・バヅー・バ【キョクギンジャンママ】で敵軍ラッシュエリアに
  // 出た、追加条件を持たない S ユニットに対しても発動できる）は RK14-274-294.a の RK-275・RK-276 で照合する。
  it.todo(
    "RK-160: 公式Q&A — 【ナノロボット散布実験】で XG2-060 スカラベアンデッドを出すとき、自軍ラッシュフェイズ中ならゲームから除外して【スペード10―タイム】を発動できる（出典: atwiki/page-703 Q5）— XG2-060 は本範囲外のカードで、効果は敵軍のラッシュ（敵軍ラッシュフェイズ）で発動するため自軍ラッシュフェイズ中の状況を組むには RK-275 等（照合済み）で相手のカードを出す必要があり、XG2-060 自体が本範囲外",
  );
  it.todo(
    "RK-160: 公式Q&A — XP-017 仮面ライダーディケイド激情態も【ナノロボット散布実験】で出せる（出典: atwiki/page-703 Q6）— XP-017 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-161 ショッカーライダー", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 ※これは「ショッカーライダー」だけでコンビネーションしてバトルエリアの6番目に並んだとき「SP1」になる。";

  it("RK-161: カタログ本文・スペックが出典と一致（出典: atwiki/page-702）", () => {
    expectCatalogText("RK-161", TEXT);
    expectStats("RK-161", { name: "ショッカーライダー", category: "DA", size: "S", bp: 2500, sp: "special", powerCost: 1, comboNumber: "RC", features: ["ショッカー", "怪人", "男", "改造人間"] });
    expectRarityIn("RK-161", ["NR"]);
  });

  const riders = (n: number, prefix = "sr") => Array.from({ length: n }, (_, i) => inst("RK-161", `${prefix}${i}`));

  it("RK-161: ※ ショッカーライダーだけで6番目に並んだとき「SP1」になり、ストライクできる（出典: atwiki/page-702「「ショッカーライダー」だけでコンビネーションしてバトルエリアの6番目に並んだとき「SP1」になる」）", () => {
    const s = enter(board({ battle: riders(5), rush: [inst("RK-161", "six")] }), "RK-161:six");
    expect(spOf(s, "player1", "RK-161:six")).toBe(1);
    expect(canStrike(s, "RK-161:six")).toBe(true);
  });

  it("RK-161: ※ 5番目までは SP を持たない（出典: atwiki/page-702「6番目に並んだとき」）", () => {
    const s = enter(board({ battle: riders(4), rush: [inst("RK-161", "five")] }), "RK-161:five");
    expect(spOf(s, "player1", "RK-161:five")).toBe(0);
  });

  it("RK-161: ※ 6体の中にショッカーライダー以外のユニットがいれば「SP1」にならない（出典: atwiki/page-702「「ショッカーライダー」だけで」・カード評価「途中にビークルや他のユニットが入っても無効」）", () => {
    const s = enter(board({ battle: [inst("TST-UNIT-0", "x"), ...riders(4)], rush: [inst("RK-161", "six")] }), "RK-161:six");
    expect(spOf(s, "player1", "RK-161:six")).toBe(0);
  });

  // faq-rider-2 RK-161 Q1・Q2「いいえ。バトルエリアにビークルが存在すれば…SP1にはなりません。」
  it("RK-161: 公式Q&A — バトルエリアにビークル（ショッカーライダーがライドしているもの）があれば「SP1」にならない（出典: grnrngr/faq-rider-2 RK-161 Q1・Q2・atwiki/page-702 Q1・Q2）", () => {
    const s = enter(board({ battle: [...riders(4), ...riding(inst("SPEC-VEHICLE", "v"), inst("RK-161", "rd"))], rush: [inst("RK-161", "six")] }), "RK-161:six");
    expect(spOf(s, "player1", "RK-161:six")).toBe(0);
  });

  it("RK-161: ※ デッキに好きな枚数入れてもよい（10枚入れても枚数制限のエラーにならない）（出典: atwiki/page-702「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    const entries = [{ cardId: "RK-161", count: 10 }, ...fillerEntries(30, ["ショッカーライダー"])];
    expect(validateDeckEntries(entries).errors.filter((e) => e.includes("枚まで"))).toEqual([]);
  });
});

void bpOf;
void ES;
