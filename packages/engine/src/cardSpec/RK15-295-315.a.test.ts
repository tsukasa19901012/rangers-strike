/**
 * カード別スペック: RK-295〜RK-301（ザ・マスクドライダーEXP vol.4 仮面ライダーサソードRF〜ガタックエクステンダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-295」〜「RK-301」とカード名（サソード・ホッパー・ダークカブト・エクステンダー）で検索）。atwiki に転載された公式 Q&A（RK-300 Q1・RK-301 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-295〜301 とカード名で検索）。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackTargets,
  attackersOf,
  bpOf,
  canMount,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  enemyBoard,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  fill,
  held,
  inst,
  lastBattleBps,
  mount,
  ncEnter,
  p1Battle,
  pick,
  pickAll,
  powerCards,
  releasedCat,
  resolveAll,
  rideOffOffered,
  riding,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK15-295-315.helpers";

const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const RCU2 = sUnit("SPEC-RCU2", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const ACCEL = sUnit("SPEC-ACCEL", { bp: 1000, powerCost: 1, features: ["加速"] });
const PLAIN = sUnit("SPEC-PLAIN", { bp: 1000, powerCost: 1, features: ["男"] });
const C0 = sUnit("SPEC-C0", { bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, sp: 1 });
const E8000 = sUnit("SPEC-E8000", { bp: 8000, sp: 1 });
const E8500 = sUnit("SPEC-E8500", { bp: 8500, sp: 1 });
const EM_ACCEL = sUnit("SPEC-EM", { bp: 1000, sp: 1, size: "M" });
const ES_ACCEL = sUnit("SPEC-ES-ACCEL", { bp: 1000, sp: 1, features: ["加速"] });
const OP2 = { id: "SPEC-OP2", name: "SPEC-OP2", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 2 } as unknown as CardDefinition;
const OP3 = { id: "SPEC-OP3", name: "SPEC-OP3", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 3 } as unknown as CardDefinition;
const EXTRA = [PLAIN_VEHICLE, RCU, RCU2, ACCEL, PLAIN, C0, C1, C2, C3, C4, M2, E4000, E8000, E8500, EM_ACCEL, ES_ACCEL, OP2, OP3];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

/** 敵軍の RS-687 ギンガイオー【ガルコンボーガン】（相手が選ぶ効果）の候補（敵軍ターンに出したとき）。 */
function gingaioChoices(p1: Partial<GameState["players"]["player1"]>): string[] {
  const s = act(enemyTurn(p1, { rush: [inst("RS-687", "gg")] }), { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
  return s.pendingEffectChoice?.sourceCardId === "RS-687" ? choiceIds(s) : [];
}

// ===========================================================================
describe("RK-295 仮面ライダーサソードRF", () => {
  const TEXT =
    "※これはバトルエリアの1番目に並んでいないときアタックもストライクもできない。 ※これはアタックされる以外では相手に選ばれない。 【頂点に立つ男】このターン、これは自軍パワーゾーンのカード枚数が敵軍パワーゾーンのカード枚数よりも1枚多いごとにBP+1000され、BP5000以上のとき「SP1」になる。";

  it("RK-295: カタログ本文・スペックが出典と一致（出典: atwiki/page-1341）", () => {
    expectCatalogText("RK-295", TEXT);
    expectStats("RK-295", { name: "仮面ライダーサソードRF", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: "3+", comboNumber: 1, features: ["仮面ライダー", "男", "加速"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-295", ["N"]);
  });

  it("RK-295: 追加条件 — 自軍「仮面ライダーサソードMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1341「追加条件：自軍「仮面ライダーサソードMF」1体をパワーゾーンに送る」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-295", "rf")], rush: [inst("RK-294", "mf")], power: powerCards(3), command: releasedCat("OT", 1) }), "player1", "RK-295:rf", { materials: ["RK-294:mf"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-295:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-294:mf")).toBe("power");
  });

  it("RK-295: 追加条件 — サソードMF 以外の S ユニットでは満たせない（出典: atwiki/page-1341）", () => {
    expect(rushFromHand(rushPhase({ hand: [inst("RK-295", "rf")], rush: [inst("SPEC-PLAIN", "p")], power: powerCards(3), command: releasedCat("OT", 1) }), "player1", "RK-295:rf").ok).toBe(false);
  });

  it("RK-295: ※ バトルエリアの1番目に並んでいないときアタックもストライクもできない（出典: atwiki/page-1341「※これはバトルエリアの1番目に並んでいないときアタックもストライクもできない」）", () => {
    const s = enter(board({ battle: fill(1), rush: [inst("RK-295", "rf")], power: powerCards(6) }, { battle: [inst("SPEC-C1", "e")] }), "RK-295:rf");
    expect(canStrike(s, "RK-295:rf")).toBe(false);
    expect(attackTargets(s, "RK-295:rf")).toEqual([]);
  });

  it("RK-295: ※ 1番目に並んでいればアタックできる（出典: atwiki/page-1341）", () => {
    const s = enter(board({ rush: [inst("RK-295", "rf")] }, { battle: [inst("SPEC-C1", "e")] }), "RK-295:rf");
    expect(attackTargets(s, "RK-295:rf")).toEqual(["SPEC-C1:e"]);
  });

  it("RK-295: ※ 相手が選ぶ効果では選ばれない（敵軍ギンガイオー【ガルコンボーガン】の候補に入らない）（出典: atwiki/page-1341「※これはアタックされる以外では相手に選ばれない」）", () => {
    expect(gingaioChoices({ rush: [inst("RK-295", "rf"), inst("TST-UNIT-0", "u")] })).toEqual(["TST-UNIT-0:u"]);
  });

  const apex = (own: number, enemy: number) => ncEnter("RK-295:rf", 0, { power: powerCards(own) }, { power: powerCards(enemy, "ep") }, EXTRA);

  it("RK-295: 【頂点に立つ男】NC（1番目）— 自軍パワーゾーンが敵軍より1枚多いごとに BP+1000（2枚多ければ BP4000、SP はまだ「！」のまま 0）（出典: atwiki/page-1341「1枚多いごとにBP+1000され」「CN：1」）", () => {
    const s = apex(4, 2);
    expect(bpOf(s, "player1", "RK-295:rf")).toBe(4000);
    expect(spOf(s, "player1", "RK-295:rf")).toBe(0);
  });

  it("RK-295: 【頂点に立つ男】BP5000 以上のとき「SP1」になりストライクできる（3枚多い）（出典: atwiki/page-1341「BP5000以上のとき「SP1」になる」）", () => {
    const s = apex(5, 2);
    expect(bpOf(s, "player1", "RK-295:rf")).toBe(5000);
    expect(spOf(s, "player1", "RK-295:rf")).toBe(1);
    expect(canStrike(s, "RK-295:rf")).toBe(true);
  });

  it("RK-295: 【頂点に立つ男】自軍パワーゾーンが敵軍以下なら BP は変わらない（出典: atwiki/page-1341「よりも1枚多いごとに」）", () => {
    const s = apex(2, 4);
    expect(bpOf(s, "player1", "RK-295:rf")).toBe(2000);
    expect(spOf(s, "player1", "RK-295:rf")).toBe(0);
  });

  it("RK-295: 【頂点に立つ男】NC が成立しなければ（ラッシュエリア）BP は変わらない（出典: atwiki/page-1341「CN：1」・R-CN-02）", () => {
    const s = board({ rush: [inst("RK-295", "rf")], power: powerCards(6) });
    expect(bpOf(s, "player1", "RK-295:rf")).toBe(2000);
  });
});

// ===========================================================================
describe("RK-296 仮面ライダーキックホッパー（2nd）", () => {
  const TEXT =
    "【ライダーキック】敵軍バトルエリアのユニットを、必要パワーの数字の合計が2になるまで好きな数選んでもよい（自軍Sユニットが「仮面ライダーキックホッパー」と「仮面ライダーパンチホッパー」だけなら、4になるまで好きな数選んでもよい）。そうしたとき、選んだユニットを持ち主のパワーゾーンに送る。";

  it("RK-296: カタログ本文・スペックが出典と一致（出典: atwiki/page-1392）", () => {
    expectCatalogText("RK-296", TEXT);
    expectStats("RK-296", { name: "仮面ライダーキックホッパー（2nd）", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 4, comboNumber: 1, features: ["仮面ライダー", "男", "加速", "2nd"] });
    expectRarityIn("RK-296", ["R"]);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-C1", "b"), inst("SPEC-C2", "c"), inst("SPEC-C3", "d"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] };
  const kick = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = enemy) => ncEnter("RK-296:kh", 0, p1, p2, EXTRA);

  it("RK-296: 【ライダーキック】NC（1番目）— 敵軍バトルエリアの必要パワー2以下のユニットから選べる（任意。M ユニットも選べる。ラッシュエリアは対象外）（出典: atwiki/page-1392「敵軍バトルエリアのユニットを、必要パワーの数字の合計が2になるまで好きな数選んでもよい」・コメント欄「ユニットのサイズを問わない除去」）", () => {
    const s = kick({ rush: [inst("SPEC-PLAIN", "x")] });
    expectChoiceFrom(s, "player1", "RK-296");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:b", "SPEC-C2:c", "SPEC-M2:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-296: 合計2まで複数選べ、選んだユニットは持ち主のパワーゾーンに送られる（必要パワー1を2体）（出典: atwiki/page-1392「好きな数選んでもよい。そうしたとき、選んだユニットを持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pickAll(kick({ rush: [inst("SPEC-PLAIN", "x")] }), ["SPEC-C1:a", "SPEC-C1:b"]));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:b")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C2:c")).toBe("battle");
  });

  it("RK-296: 1体選んだ後、残りの合計を超えるユニット（必要パワー1を選んだ後の必要パワー2）は選べない（出典: atwiki/page-1392「合計が2になるまで」）", () => {
    const s = pick(kick({ rush: [inst("SPEC-PLAIN", "x")] }), "SPEC-C1:a");
    expect(choiceIds(s)).toEqual(["SPEC-C1:b"]);
  });

  it("RK-296: 1体だけ選んで確定してもよい（出典: atwiki/page-1392「好きな数」）", () => {
    const s = resolveAll(confirm(pick(kick({ rush: [inst("SPEC-PLAIN", "x")] }), "SPEC-C1:a")));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:b")).toBe("battle");
  });

  it("RK-296: 選ばなければ何も起きない（出典: atwiki/page-1392「選んでもよい」）", () => {
    const s = resolveAll(skip(kick({ rush: [inst("SPEC-PLAIN", "x")] })));
    expect(zoneIds(s, "player2", "battle")).toHaveLength(5);
  });

  it("RK-296: 自軍 S ユニットがキックホッパーとパンチホッパーだけなら、合計4まで選べる（必要パワー3も候補）（出典: atwiki/page-1392「（自軍Sユニットが「仮面ライダーキックホッパー」と「仮面ライダーパンチホッパー」だけなら、4になるまで好きな数選んでもよい）」）", () => {
    const s = kick({ rush: [inst("RK-297", "ph")] });
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:b", "SPEC-C2:c", "SPEC-C3:d", "SPEC-M2:m"]);
  });

  it("RK-296: ほかの S ユニットもいれば合計2まで（出典: atwiki/page-1392「だけなら」）", () => {
    const s = kick({ rush: [inst("RK-297", "ph"), inst("SPEC-PLAIN", "x")] });
    expect(choiceIds(s)).not.toContain("SPEC-C3:d");
  });

  it("RK-296: パンチホッパーがいなければ（キックホッパーだけ）合計2まで（出典: atwiki/page-1392「「仮面ライダーキックホッパー」と「仮面ライダーパンチホッパー」だけなら」・カード評価「自軍のＳユニットが仮面ライダーパンチホッパーとこのカードだけになる状況」）", () => {
    const s = kick();
    expect(choiceIds(s)).not.toContain("SPEC-C3:d");
  });

  it("RK-296: 「相手に選ばれない」敵軍ユニット（仮面ライダーサソードRF）は選べない（出典: atwiki/page-1392「選んでもよい」・atwiki/page-1341「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = kick({ rush: [inst("SPEC-PLAIN", "x")] }, { battle: [inst("SPEC-C0", "z"), inst("RK-295", "rf")] });
    expect(choiceIds(s)).toEqual(["SPEC-C0:z"]);
  });

  it("RK-296: NC が成立しなければ（2番目）何も起きない（出典: atwiki/page-1392「CN：1」・R-CN-02）", () => {
    const s = ncEnter("RK-296:kh", 1, {}, enemy, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-296");
  });
});

// ===========================================================================
describe("RK-297 仮面ライダーパンチホッパー（2nd）", () => {
  const TEXT =
    "【ライダーパンチ】敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選んでもよい（自軍Sユニットが｢仮面ライダーキックホッパー｣と｢仮面ライダーパンチホッパー｣だけなら、必要パワーの数字が4以下のカードを1枚選んでもよい)。そうしたとき、選んだカードを捨札にする。";

  it("RK-297: カタログ本文・スペックが出典と一致（出典: atwiki/page-1386）", () => {
    expectCatalogText("RK-297", TEXT);
    expectStats("RK-297", { name: "仮面ライダーパンチホッパー（2nd）", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 2, features: ["仮面ライダー", "男", "加速", "2nd"] });
    expectRarityIn("RK-297", ["N"]);
  });

  const enemyPower = [faceUp("SPEC-C1", "p1"), faceUp("SPEC-OP2", "p2"), faceUp("SPEC-OP3", "p3"), faceUp("SPEC-C4", "p4"), faceDown("SPEC-C1", "d")];
  const punch = (battle: ReturnType<typeof inst>[], rush: ReturnType<typeof inst>[] = []) =>
    ncEnter("RK-297:ph", 0, { battle, rush }, { power: enemyPower }, EXTRA);

  it("RK-297: 【ライダーパンチ】NC（2番目）— 敵軍パワーゾーンのオモテ向きのカードから必要パワー2以下のカード（ユニット・オペレーションとも）を1枚選べる（任意。ダメージは対象外）（出典: atwiki/page-1386「敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選んでもよい」）", () => {
    const s = punch(fill(1));
    expectChoiceFrom(s, "player1", "RK-297");
    expect(choiceIds(s)).toEqual(["SPEC-C1:p1", "SPEC-OP2:p2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-297: 選んだカードは捨札になる（出典: atwiki/page-1386「選んだカードを捨札にする」）", () => {
    const s = resolveAll(pick(punch(fill(1)), "SPEC-OP2:p2"));
    expect(zoneOf(s, "player2", "SPEC-OP2:p2")).toBe("discard");
    expect(zoneIds(s, "player2", "power")).toHaveLength(4);
  });

  it("RK-297: 自軍 S ユニットがキックホッパーとパンチホッパーだけなら、必要パワー4以下のカードを選べる（出典: atwiki/page-1386「（自軍Sユニットが｢仮面ライダーキックホッパー｣と｢仮面ライダーパンチホッパー｣だけなら、必要パワーの数字が4以下のカードを1枚選んでもよい)」）", () => {
    const s = punch([inst("RK-296", "kh")]);
    expect(choiceIds(s)).toEqual(["SPEC-C1:p1", "SPEC-C4:p4", "SPEC-OP2:p2", "SPEC-OP3:p3"]);
  });

  it("RK-297: ほかの S ユニットもいれば必要パワー2以下のまま（出典: atwiki/page-1386「だけなら」）", () => {
    const s = punch([inst("RK-296", "kh")], [inst("SPEC-PLAIN", "x")]);
    expect(choiceIds(s)).toEqual(["SPEC-C1:p1", "SPEC-OP2:p2"]);
  });

  it("RK-297: 「相手に選ばれない」を持つカード（敵軍パワーゾーンのオモテ向きのサソードRF。必要パワー3）は、合計4まで選べるときも選べない（今のエンジンの扱い）（出典: atwiki/page-1386「選んでもよい」・atwiki/page-1341「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = ncEnter("RK-297:ph", 0, { battle: [inst("RK-296", "kh")] }, { power: [faceUp("SPEC-C1", "p1"), faceUp("RK-295", "rf")] }, EXTRA);
    expect(choiceIds(s)).toEqual(["SPEC-C1:p1"]);
  });

  it.todo(
    "RK-297: 敵軍パワーゾーンのカードに「相手に選ばれない」が効くか（ゾーンにあるカードにも効くか）— ユーザー確認待ち: grnrngr/faq-rider-1 は効かない、atwiki と grnrngr/faq-card-3 RS-149 Q1 は効くとする。今のエンジンは効く（選べない）として実装し、上の照合もその扱い",
  );

  it("RK-297: NC が成立しなければ（1番目）何も起きない（出典: atwiki/page-1386「CN：2」・R-CN-02）", () => {
    const s = punch([]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-297");
  });
});

// ===========================================================================
describe("RK-298 仮面ライダーダークカブトMF", () => {
  const TEXT =
    "※これはアタックされるときBP+3000される。 【むき出しの殺意】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアのユニットがSユニット1体だけなら、そのユニットを持ち主のパワーゾーンに送ってもよい。";

  it("RK-298: カタログ本文・スペックが出典と一致（出典: atwiki/page-1387）", () => {
    expectCatalogText("RK-298", TEXT);
    expectStats("RK-298", { name: "仮面ライダーダークカブトMF", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 3, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-298", ["NR"]);
  });

  it("RK-298: ※ アタックされるとき BP+3000（BP4000 のユニットにアタックされても BP5000 で勝つ）（出典: atwiki/page-1387「※これはアタックされるときBP+3000される」）", () => {
    const s = settle(attack(enemyTurn({ battle: [inst("RK-298", "mf")] }, { battle: [inst("SPEC-E4000", "a")] }), "SPEC-E4000:a", "RK-298:mf", "player2"));
    expect(lastBattleBps(s)?.defender).toBe(5000);
    expect(zoneOf(s, "player1", "RK-298:mf")).toBe("battle");
  });

  const kill = (p2: Partial<GameState["players"]["player2"]>) => enter(board({ rush: [inst("RK-298", "mf")] }, p2), "RK-298:mf");

  it("RK-298: 【むき出しの殺意】自軍ターン中に出たとき、敵軍バトルエリアのユニットが S ユニット1体だけなら、それを持ち主のパワーゾーンに送るかを選べる（任意）（出典: atwiki/page-1387「そのユニットを持ち主のパワーゾーンに送ってもよい」）", () => {
    let s = kill({ battle: [inst("SPEC-C3", "e")], rush: [inst("SPEC-C1", "r")] });
    expectChoiceFrom(s, "player1", "RK-298");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(confirm(s));
    expect(zoneOf(s, "player2", "SPEC-C3:e")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:r")).toBe("rush");
  });

  it("RK-298: 送らないことも選べる（出典: atwiki/page-1387「送ってもよい」）", () => {
    const s = resolveAll(skip(kill({ battle: [inst("SPEC-C3", "e")] })));
    expect(zoneOf(s, "player2", "SPEC-C3:e")).toBe("battle");
  });

  it("RK-298: 敵軍バトルエリアのユニットが2体なら発動しない（出典: atwiki/page-1387「Sユニット1体だけなら」）", () => {
    const s = kill({ battle: [inst("SPEC-C3", "e"), inst("SPEC-C1", "f")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-298");
  });

  it("RK-298: 敵軍バトルエリアのユニットが M ユニット1体なら発動しない（出典: atwiki/page-1387「Sユニット1体だけなら」）", () => {
    const s = kill({ battle: [inst("SPEC-M2", "m")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-298");
  });

  it("RK-298: ユニットを選ぶ効果ではないので、「相手に選ばれない」敵軍ユニット（ダークカブトRF）も送れる（出典: atwiki/page-1387 コメント欄「この効果は相手を選んでいないから、「これはアタックされる以外で相手に選ばれない」やブレイカー持ちでも対象に出来ますね」・atwiki/page-1372 カード評価「仮面ライダーダークカブトMFの対象を選ばない効果も有効」）", () => {
    const s = resolveAll(confirm(kill({ battle: [inst("RK-299", "rf")] })));
    expect(zoneOf(s, "player2", "RK-299:rf")).toBe("power");
  });

  it("RK-298: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1387「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-298:mf", {}, { battle: [inst("SPEC-C3", "e")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-298:mf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-298");
    expect(zoneOf(s, "player2", "SPEC-C3:e")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-299 仮面ライダーダークカブトRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ダークライダーキック】自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドを3つリリースしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("RK-299: カタログ本文・スペックが出典と一致（出典: atwiki/page-1383）", () => {
    expectCatalogText("RK-299", TEXT);
    expectStats("RK-299", { name: "仮面ライダーダークカブトRF", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: "4+", features: ["仮面ライダー", "男", "加速"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("RK-299", ["SR"]);
  });

  it("RK-299: 追加条件 — 自軍「仮面ライダーダークカブトMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1383「追加条件：自軍「仮面ライダーダークカブトMF」1体をパワーゾーンに送る」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-299", "rf")], rush: [inst("RK-298", "mf")], power: powerCards(4), command: releasedCat("OT", 1) }), "player1", "RK-299:rf", { materials: ["RK-298:mf"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-299:rf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-298:mf")).toBe("power");
  });

  it("RK-299: ※ 相手が選ぶ効果では選ばれない（敵軍ギンガイオー【ガルコンボーガン】の候補に入らない）（出典: atwiki/page-1383「※これはアタックされる以外では相手に選ばれない」）", () => {
    expect(gingaioChoices({ rush: [inst("RK-299", "rf"), inst("TST-UNIT-0", "u")] })).toEqual(["TST-UNIT-0:u"]);
  });

  const enemyCommands = [held("TST-OP-OT", "h1"), held("TST-OP-OT", "h2"), held("TST-OP-OT", "h3"), held("TST-OP-OT", "h4")];
  const darkKick = (command = enemyCommands) => enter(board({ rush: [inst("RK-299", "rf")] }, { command }), "RK-299:rf");

  it("RK-299: 【ダークライダーキック】自軍ターン中に出たとき、敵軍のホールド状態のコマンドから3つ選んでリリースできる（任意。どれをリリースするかはこのカードのプレイヤーが選ぶ）（出典: atwiki/page-1383「敵軍コマンドを3つリリースしてもよい」・コメント欄「リリースを選ぶのはこのカードのプレイヤー」）", () => {
    const s = darkKick();
    expectChoiceFrom(s, "player1", "RK-299");
    expect(choiceIds(s)).toEqual(["TST-OP-OT:h1", "TST-OP-OT:h2", "TST-OP-OT:h3", "TST-OP-OT:h4"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-299: 3つリリースすると、このターン「SP1」になる（出典: atwiki/page-1383「そうしたとき、このターン、これは「SP1」になる」）", () => {
    const s = resolveAll(pickAll(darkKick(), ["TST-OP-OT:h1", "TST-OP-OT:h2", "TST-OP-OT:h4"]));
    expect(cardIn(s, "player2", "TST-OP-OT:h1")?.commandHeld).not.toBe(true);
    expect(cardIn(s, "player2", "TST-OP-OT:h4")?.commandHeld).not.toBe(true);
    expect(cardIn(s, "player2", "TST-OP-OT:h3")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "RK-299:rf")).toBe(1);
  });

  it("RK-299: 「相手に選ばれない」を持つコマンド（敵軍コマンドゾーンのホールド状態のサソードRF）は選べない（ホールド状態のコマンドが3つでも、そのうち1つがそれなら発動できない）（今のエンジンの扱い）（出典: atwiki/page-1383 コメント欄「相手のコマンドがRFで埋まってたらこの効果使えないんですね」・atwiki/page-1341「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = darkKick([held("TST-OP-OT", "h1"), held("TST-OP-OT", "h2"), held("RK-295", "rf")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-299");
  });

  it.todo(
    "RK-299: 敵軍コマンドゾーンのカードに「相手に選ばれない」が効くか — ユーザー確認待ち: grnrngr/faq-rider-1 は効かない、atwiki（page-1383 コメント欄を含む）と grnrngr/faq-card-3 RS-149 Q1 は効くとする。今のエンジンは効く（選べない）として実装し、上の照合もその扱い。なお、どのコマンドをリリースするかを選ぶのは、コメント欄で「このカードのプレイヤー」と「持ち主」の両方の回答がある（コミュニティの記述どうしの食い違い。本書は前者を採る）",
  );

  it("RK-299: リリースしなければ SP は「1/4」のまま（1番目では 0）（出典: atwiki/page-1383「リリースしてもよい」・「SP：1/4」）", () => {
    const s = resolveAll(skip(darkKick()));
    expect(spOf(s, "player1", "RK-299:rf")).toBe(0);
  });

  it("RK-299: 敵軍のホールド状態のコマンドが2つしかなければ発動できない（出典: atwiki/page-1383 コメント欄「相手のコマンドがRFで埋まってたらこの効果使えない」）", () => {
    const s = darkKick([held("TST-OP-OT", "h1"), held("TST-OP-OT", "h2"), ...releasedCat("OT", 2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-299");
  });
});

// ===========================================================================
describe("RK-300 カブトエクステンダー", () => {
  const TEXT =
    "※特徴「加速」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる。 ※これにライドしているユニットはBP+500される。 【クロックアップ】これにライドしているユニットは、特徴「加速」を持たないSユニットにアタックされない。";

  it("RK-300: カタログ本文・スペックが出典と一致（出典: atwiki/page-1372）", () => {
    expectCatalogText("RK-300", TEXT);
    expectVehicleStats("RK-300", { name: "カブトエクステンダー", category: "OT", powerCost: 3, size: "S", features: ["メカ", "車両", "加速"] });
    expectRarityIn("RK-300", ["N"]);
  });

  it("RK-300: ※ 特徴「加速」を持つ S ユニットは RC がなくてもライドできる。「加速」も RC も持たないユニットはライドできない（出典: atwiki/page-1372「※特徴「加速」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる」）", () => {
    const s = board({ rush: [inst("RK-300", "ke"), inst("SPEC-ACCEL", "a"), inst("SPEC-PLAIN", "p")] });
    expect(canMount(s, "SPEC-ACCEL:a", "RK-300:ke")).toBe(true);
    expect(canMount(s, "SPEC-PLAIN:p", "RK-300:ke")).toBe(false);
  });

  it("RK-300: ※ これにライドしているユニットは BP+500（出典: atwiki/page-1372「※これにライドしているユニットはBP+500される」）", () => {
    const s = board({ battle: riding(inst("RK-300", "ke"), inst("SPEC-ACCEL", "a")) });
    expect(bpOf(s, "player1", "SPEC-ACCEL:a")).toBe(1500);
  });

  const attackers = () =>
    attackersOf(
      enemyTurn({ battle: riding(inst("RK-300", "ke"), inst("SPEC-ACCEL", "a")) }, { battle: [inst("SPEC-C1", "s"), inst("SPEC-ES-ACCEL", "x"), inst("SPEC-EM", "m")] }),
      "SPEC-ACCEL:a",
    );

  it("RK-300: 【クロックアップ】これにライドしているユニットは、特徴「加速」を持たない S ユニットにアタックされない（出典: atwiki/page-1372「特徴「加速」を持たないSユニットにアタックされない」）", () => {
    expect(attackers()).not.toContain("SPEC-C1:s");
  });

  it("RK-300: 【クロックアップ】「加速」を持つ S ユニットと M ユニットはアタックできる（出典: atwiki/page-1372「特徴「加速」を持たないSユニットに」・コメント欄「Mユニットにはアタックされますよね？／されますよ」）", () => {
    expect(attackers()).toEqual(["SPEC-EM:m", "SPEC-ES-ACCEL:x"]);
  });
});

// ===========================================================================
describe("RK-301 ガタックエクステンダー", () => {
  const TEXT =
    "※特徴「加速」を持つSユニットは、RCを持っていなくてもこのビークルにライドできる。 ※これにライドしているユニットはBP+500される。 【エクステンドライダー落とし】ライドされている「カブトエクステンダー」からこのビークルがコンビネーションしたとき、次の効果を発動できる⇒本来のBPが8000以下の敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("RK-301: カタログ本文・スペックが出典と一致（出典: atwiki/page-1388）", () => {
    expectCatalogText("RK-301", TEXT);
    expectVehicleStats("RK-301", { name: "ガタックエクステンダー", category: "OT", powerCost: 5, size: "S", features: ["メカ", "車両", "加速"] });
    expectRarityIn("RK-301", ["N"]);
  });

  it("RK-301: ※ 特徴「加速」を持つ S ユニットは RC がなくてもライドでき、ライドしているユニットは BP+500（出典: atwiki/page-1388）", () => {
    const s = board({ rush: [inst("RK-301", "ge"), inst("SPEC-ACCEL", "a"), inst("SPEC-PLAIN", "p")] });
    expect(canMount(s, "SPEC-ACCEL:a", "RK-301:ge")).toBe(true);
    expect(canMount(s, "SPEC-PLAIN:p", "RK-301:ge")).toBe(false);
    expect(bpOf(board({ battle: riding(inst("RK-301", "ge"), inst("SPEC-ACCEL", "a")) }), "player1", "SPEC-ACCEL:a")).toBe(1500);
  });

  const enemy = { battle: [inst("SPEC-E8000", "a"), inst("SPEC-E8500", "b")], rush: [inst("SPEC-C1", "r")] };
  const drop = (battle: ReturnType<typeof inst>[] = riding(inst("RK-300", "ke"), inst("SPEC-RCU", "r1")), p2: Partial<GameState["players"]["player2"]> = enemy) =>
    mount(board({ battle, rush: [inst("RK-301", "ge"), inst("SPEC-RCU2", "r2")] }, p2), "SPEC-RCU2:r2", "RK-301:ge");

  it("RK-301: 【エクステンドライダー落とし】ライドされているカブトエクステンダーからコンビネーションしたとき、本来の BP が8000以下の敵軍ユニット（エリアを問わない）を1体選べる（任意）（出典: atwiki/page-1388「本来のBPが8000以下の敵軍ユニットを1体選び」「次の効果を発動できる」）", () => {
    const s = drop();
    expectChoiceFrom(s, "player1", "RK-301");
    expect(choiceIds(s)).toEqual(["SPEC-C1:r", "SPEC-E8000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-301: 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-1388「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(drop(), "SPEC-E8000:a"));
    expect(zoneOf(s, "player2", "SPEC-E8000:a")).toBe("power");
  });

  // atwiki/page-1372 Q1・page-1388 Q1「いいえ。ビークルの並び順は、そのビークルがバトルエリアに出た時点で確定します。よって、その時点で…コンビネーションは確定し効果が実行され、その後ライドオフするかしないかを決定します。」
  it("RK-301: 公式Q&A — コンビネーションはビークルが出た時点で確定し、効果を処理してからライドオフするかを決める（出典: atwiki/page-1372 Q1・atwiki/page-1388 Q1）", () => {
    let s = drop();
    expectChoiceFrom(s, "player1", "RK-301");
    expect(rideOffOffered(s)).toBe(false);
    s = pick(s, "SPEC-E8000:a");
    expect(rideOffOffered(s)).toBe(true);
  });

  it("RK-301: 左隣のカブトエクステンダーにユニットがライドしていなければ発動しない（出典: atwiki/page-1388「ライドされている「カブトエクステンダー」から」）", () => {
    const s = drop([inst("RK-300", "ke")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-301");
  });

  it("RK-301: 左隣がほかのビークルなら発動しない（出典: atwiki/page-1388「「カブトエクステンダー」から」）", () => {
    const s = drop(riding(inst("RK-274", "bc"), inst("SPEC-RCU", "r1")));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-301");
  });
});
