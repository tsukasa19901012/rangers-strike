/**
 * cardSpec PK-001〜PK-014・PM-001・SM-001・SK-000〜SK-004（プロモーションカード・シークレットレア）用ヘルパー。
 * BK1-001-019.helpers.ts（RK1〜RK16・RM1〜RM3 のヘルパーを含む）をそのまま再エクスポートし、
 * 同じ本文のカード（PK-006 と SK-001、PK-009 と SK-002 など）で使う共通テストを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  inst,
  pick,
  powerCards,
  rcRideOff,
  rcUnit,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

type P1 = Partial<GameState["players"]["player1"]>;
type P2 = Partial<GameState["players"]["player2"]>;

/** 自軍（player1）バトルフェイズの盤面（extra の定義を足す）。 */
export function battleBoard(extra: CardDefinition[], p1: P1 = {}, p2: P2 = {}): GameState {
  return st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 敵軍（player2）バトルフェイズの盤面。 */
export function enemyBattle(extra: CardDefinition[], p1: P1 = {}, p2: P2 = {}): GameState {
  return st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 自軍（player1）ラッシュフェイズの盤面。 */
export function rushBoardWith(extra: CardDefinition[], p1: P1 = {}, p2: P2 = {}): GameState {
  return st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 自軍パワーゾーンにオモテ向きで置かれたカード。 */
export function faceUpPower(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), faceDown: false };
}

// ===========================================================================
/**
 * 「【…】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」」（SP「！」）の共通テスト
 * （PK-001・PK-003。RK-033 仮面ライダー龍騎と効果名だけが違う）。
 */
export function dragonComboTests(id: string, effectName: string, page: string, known?: string): void {
  const itSp = known ? it.fails : it;
  const bug = known ? ` — 既知の不具合: CARD-${id} ${known}` : "";
  const DRAGON = sUnit("SPEC-PR-DRAGON", { category: "WB", bp: 2000, features: ["ドラゴン"] });
  const EXTRA = [DRAGON];
  const board = (p1: P1 = {}, p2: P2 = {}) => battleBoard(EXTRA, p1, p2);
  const text = `【${effectName}】特徴「ドラゴン」を持つユニットからコンビネーションするとき、このターン、これは次の能力を得る⇒「SP1」`;

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, text);
    expectStats(id, { name: "仮面ライダー龍騎", category: "WB", size: "S", bp: 4000, sp: "special", powerCost: 6, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn(id, ["PR"]);
  });

  itSp(`${id}: 【${effectName}】特徴「ドラゴン」を持つユニットの次に出ると「SP1」を得て、ストライクで1点与える（出典: ${page}・R-CN-05（コンビネーションは直前に出たユニットとの間に成立））${bug}`, () => {
    let s = enter(board({ battle: [inst("SPEC-PR-DRAGON", "d")], rush: [inst(id, "r")] }), `${id}:r`);
    expect(canStrike(s, `${id}:r`)).toBe(true);
    s = settle(strike(s, `${id}:r`));
    expect(damageOf(s, "player2")).toBe(1);
  });

  itSp(`${id}: 【${effectName}】ドラグレッダー（RK-034。特徴「ドラゴン」）からのコンビネーションでも「SP1」を得る（出典: ${page}・atwiki/page-179「特徴：ミラーモンスター／獣／ドラゴン」）${bug}`, () => {
    const s = enter(board({ battle: [inst("RK-034", "d")], rush: [inst(id, "r")] }), `${id}:r`);
    expect(canStrike(s, `${id}:r`)).toBe(true);
  });

  it(`${id}: 「ドラゴン」以外のユニットの次に出たときは「SP！」のままでストライクできない（出典: ${page}「SP：！」）`, () => {
    const s = enter(board({ battle: [inst("SPEC-PR-DRAGON", "d"), inst("TST-UNIT-0", "x")], rush: [inst(id, "r")] }), `${id}:r`);
    expect(canStrike(s, `${id}:r`)).toBe(false);
  });

  it(`${id}: 1番目に出たとき（コンビネーションの相手がいない）はストライクできない（出典: ${page}「ユニットからコンビネーションするとき」）`, () => {
    const s = enter(board({ rush: [inst(id, "r")] }), `${id}:r`);
    expect(canStrike(s, `${id}:r`)).toBe(false);
  });
}

// ===========================================================================
/** シャドームーン（PK-006・SK-001）の共通テスト。 */
export function shadowMoonTests(id: string, page: string, rarity: string, text: string, saberBug?: string): void {
  const itSaber = saberBug ? it.fails : it;
  const bug = saberBug ? ` — 既知の不具合: CARD-${id} ${saberBug}` : "";
  const E1000 = sUnit("SPEC-SM-E1000", { bp: 1000, sp: 1 });
  const NOSP = sUnit("SPEC-SM-NOSP", { bp: 1000, sp: undefined });
  const RIDER = rcUnit("SPEC-SM-RIDER", { bp: 2000 });
  const VEH_M = { ...PLAIN_VEHICLE, id: "SPEC-SM-VEH-M", name: "SPEC-SM-VEH-M", size: "M" } as unknown as CardDefinition;
  const EXTRA = [E1000, NOSP, RIDER, VEH_M, PLAIN_VEHICLE];
  const board = (p1: P1 = {}, p2: P2 = {}) => battleBoard(EXTRA, p1, p2);
  const enemyTurn = (p1: P1 = {}, p2: P2 = {}) => enemyBattle(EXTRA, p1, p2);

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, text);
    expectStats(id, { name: "シャドームーン", category: "DA", size: "S", bp: 5000, sp: 1, powerCost: 5, comboNumber: "RC", features: ["男", "改造人間", "世紀王"] });
    expectRarityIn(id, [rarity]);
  });

  it(`${id}: ※ 敵軍ターン中、SP1 のユニットにアタックされてバトルに勝っても撃破される（出典: ${page}「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）`, () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst(id, "sm")] }, { battle: [inst("SPEC-SM-E1000", "e")] }), "SPEC-SM-E1000:e", `${id}:sm`, "player2"));
    expect(zoneOf(s, "player2", "SPEC-SM-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:sm`)).toBe("discard");
  });

  it(`${id}: ※ SP が空欄（－）のユニットとのバトルに勝てば撃破されない（出典: ${page}「「SP1」以上のユニットとバトルしたとき」）`, () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst(id, "sm")] }, { battle: [inst("SPEC-SM-NOSP", "e")] }), "SPEC-SM-NOSP:e", `${id}:sm`, "player2"));
    expect(zoneOf(s, "player1", `${id}:sm`)).toBe("battle");
  });

  it(`${id}: ※ 自軍ターン中は、SP1 のユニットとのバトルに勝っても撃破されない（出典: ${page}「敵軍ターン中、」）`, () => {
    const s = resolveAll(attack(board({ battle: [inst(id, "sm")] }, { battle: [inst("SPEC-SM-E1000", "e")] }), `${id}:sm`, "SPEC-SM-E1000:e"));
    expect(zoneOf(s, "player2", "SPEC-SM-E1000:e")).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:sm`)).toBe("battle");
  });

  /** 敵軍バトルエリア: ライドされた S ビークル（v1）、ライドされていない S ビークル（v2）、M ビークル（vm）。敵軍ラッシュエリア: S ビークル（vr）。 */
  const enemy = (): P2 => ({
    battle: [inst("SPEC-VEHICLE", "v1"), { ...inst("SPEC-SM-RIDER", "rd"), mountedOnInstanceId: "SPEC-VEHICLE:v1" }, inst("SPEC-VEHICLE", "v2"), inst("SPEC-SM-VEH-M", "vm")],
    rush: [inst("SPEC-VEHICLE", "vr")],
  });
  const saber = (p2: P2 = enemy()) => rcRideOff(board({ rush: [inst(id, "sm"), inst("SPEC-VEHICLE", "own")] }, p2), `${id}:sm`, "SPEC-VEHICLE:own");

  itSaber(`${id}: 【サタンサーベル】（RC）敵軍バトルエリアの S ビークルから1体選ぶ（M ビークル・敵軍ラッシュエリアのビークルは選べない。見送れない）（出典: ${page}「敵軍バトルエリアからSビークルを1体選ぶ」）${bug}`, () => {
    const s = saber();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["SPEC-VEHICLE:v1", "SPEC-VEHICLE:v2"]);
    expect(canSkip(s)).toBe(false);
  });

  itSaber(`${id}: 【サタンサーベル】選んだビークルにライドしているユニットを撃破し、ビークルを捨札にする（出典: ${page}「選んだビークルにライドしているユニットがあれば、それを撃破する。その後、選んだビークルを捨札にする」）${bug}`, () => {
    const s = resolveAll(pick(saber(), "SPEC-VEHICLE:v1"));
    expect(zoneOf(s, "player2", "SPEC-SM-RIDER:rd")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v2")).toBe("battle");
  });

  itSaber(`${id}: 【サタンサーベル】ライドされていないビークルを選べば、ビークルだけ捨札にする（出典: ${page}「ライドしているユニットがあれば」）${bug}`, () => {
    const s = resolveAll(pick(saber(), "SPEC-VEHICLE:v2"));
    expect(zoneOf(s, "player2", "SPEC-VEHICLE:v2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-SM-RIDER:rd")).toBe("battle");
  });

  it(`${id}: 【サタンサーベル】敵軍バトルエリアに S ビークルがなければ何もしない（出典: ${page}）`, () => {
    const s = saber({ battle: [inst("SPEC-SM-VEH-M", "vm")], rush: [inst("SPEC-VEHICLE", "vr")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(zoneOf(s, "player2", "SPEC-SM-VEH-M:vm")).toBe("battle");
  });

  it(`${id}: 【サタンサーベル】は RC の効果 — ライドしないで出たときは発動しない（出典: ${page}「CN：RC」・R-KW-RC-01）`, () => {
    const s = enter(board({ rush: [inst(id, "sm")] }, enemy()), `${id}:sm`);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
  });
}

// ===========================================================================
/** 仮面ライダーV3（PK-009・SK-002）の共通テスト。 */
export function v3Tests(id: string, page: string, rarity: string, text: string): void {
  const EXTRA = [PLAIN_VEHICLE];
  const board = (p1: P1 = {}, p2: P2 = {}) => battleBoard(EXTRA, p1, p2);
  const command = () => [inst("RK-023", "n1"), inst("RK-073", "n2"), inst("RK-164", "f1"), inst("RK-134", "f2"), inst("TST-OP-ET", "et")];
  const typhoon = (cmd: CardInstance[] = command()) =>
    rcRideOff(board({ rush: [inst(id, "v3"), inst("SPEC-VEHICLE", "v")], command: cmd }), `${id}:v3`, "SPEC-VEHICLE:v");

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, text);
    expectStats(id, { name: "仮面ライダーV3", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn(id, [rarity]);
  });

  it(`${id}: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: ${page}「※レジスト」・R-KW-RESIST）`, () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst(id, "v3")] }, `${id}:v3`))).toBe(true);
  });

  it(`${id}: 【ダブルタイフーン】（RC）自軍コマンドゾーンの「仮面ライダー1号」「仮面ライダー2号」のカードから1枚選べる（任意。「（THE FIRST）」は別のカード名なので選べない）（出典: ${page}「自軍コマンドゾーンから「仮面ライダー1号」か「仮面ライダー2号」のカードを1枚選びホールドしてもよい」・grnrngr/faq-rider-2 SK-002 Q2「括弧書きの部分もカード名として含みます」）`, () => {
    const s = typhoon();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["RK-023:n1", "RK-073:n2"]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: 公式Q&A — RK-023 仮面ライダー1号をホールドすると、【技の1号】の「SP1」をこのユニットの効果として発動し、V3 は SP1 を得る（出典: grnrngr/faq-rider-2 SK-002 Q1「はい、SP1を得ます」・${page} Q1）`, () => {
    const s = resolveAll(pick(typhoon(), "RK-023:n1"));
    expect(cardIn(s, "player1", "RK-023:n1")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", `${id}:v3`)).toBe(1);
    expect(canStrike(s, `${id}:v3`)).toBe(true);
  });

  it(`${id}: RK-073 仮面ライダー2号をホールドすると、【力の2号】（このターン BP+2000）をこのユニットの効果として発動する（出典: ${page}「ホールドしたユニットカードのＲＣの効果を、このユニットの効果として発動する」・atwiki/page-208 RK-073 本文）`, () => {
    const s = resolveAll(pick(typhoon(), "RK-073:n2"));
    expect(cardIn(s, "player1", "RK-073:n2")?.commandHeld).toBe(true);
    expect(bpOf(s, "player1", `${id}:v3`)).toBe(6000);
  });

  it(`${id}: ホールドしなければ何も起きない（1番目の SP1/5 は SP を持たない）（出典: ${page}「ホールドしてもよい。そうしたとき」）`, () => {
    const s = resolveAll(skip(typhoon()));
    expect(cardIn(s, "player1", "RK-023:n1")?.commandHeld ?? false).toBe(false);
    expect(spOf(s, "player1", `${id}:v3`)).toBe(0);
    expect(bpOf(s, "player1", `${id}:v3`)).toBe(4000);
  });

  it(`${id}: 【ダブルタイフーン】は RC の効果 — ライドしないで出たときは発動しない（出典: ${page}「CN：RC」・R-KW-RC-01）`, () => {
    const s = enter(board({ rush: [inst(id, "v3")], command: command() }), `${id}:v3`);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
  });
}

// ===========================================================================
/** 「自軍「X」を1体捨札にすれば必要パワー0になる」（必要パワー N-）の追加条件の共通テスト。 */
export function zeroCostTests(id: string, materialId: string, materialName: string, cost: number, cat: "WB" | "MA" | "OT" | "ET" | "DA", page: string): void {
  it(`${id}: 追加条件 — 自軍「${materialName}」1体を捨札にすれば必要パワー0でラッシュできる（出典: ${page}）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "x")], rush: [inst(materialId, "p")], command: releasedCat(cat, 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", `${id}:x`, (a) => a.zordMaterialInstanceId === `${materialId}:p`);
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:x`)).toBe("rush");
    expect(zoneOf(t, "player1", `${materialId}:p`)).toBe("discard");
  });

  it(`${id}: 必要パワー${cost}- — 「${materialName}」がいなければパワー${cost}でラッシュでき、${cost - 1}ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst(id, "x")], command: releasedCat(cat, 1), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(cost - 1), "player1", `${id}:x`)).toBe(false);
    const r = rushFromHand(mk(cost), "player1", `${id}:x`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:x`)).toBe("rush");
  });
}
