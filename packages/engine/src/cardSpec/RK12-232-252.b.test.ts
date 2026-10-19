/**
 * カード別スペック: RK-239〜RK-245（ザ・マスクドライダーEXP vol.3 ウエイクアップ！〜仮面ライダーキバ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-3（「RK-240 クライマックス刑事」欄。カード番号は RK-242 の誤記。
 *     docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_3.html）。
 *     atwiki に転載された公式 Q&A（RK-239 Q1〜Q3、RK-242 Q1、RK-244 Q1、RK-245 Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAG-01、R-KW-RESIST、R-CN-05 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 公式どうしの食い違い（ユーザー決定済み）:
 *  - RK-242 Q1（atwiki/page-762「同名のタッグ…を２枚同時に常駐させていれば、両方の効果をそれぞれ発動することができます。(2010/10/25修正)」）と
 *    grnrngr/faq-rider-3「１度のラッシュフェイズの間に太字部分の効果は１度だけしか発動することはできません」。
 *    ユーザー決定（2026-10-19）「両方の効果をそれぞれ発動することができる」により atwiki の修正後を採る（README §5.7 i、
 *    docs/verification/review-items-2026-10.md B-11）。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-239 Q3（インフェルシアの花嫁の太字部分を RK-239 と読み替えてキバ（XG5-074）をホールドした場合）— cardSpec/RS8-516-537.a.test.ts RS-519
 *  - RK-242 と PK-011 を2枚同時に常駐させられる（grnrngr/faq-rider-3）— rulesSpec/07-perm-tag-other.test.ts R-KW-TAG-01
 *  - RK-242 の「バトルエリアに出たとき撃破される」の無効化の土台（ターンの記録）— destroyOnEnterBattle.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  accept,
  act,
  activateResident,
  attackUntilRegister,
  attackersOf,
  canActivateResident,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  featuresOf,
  heldUnit,
  inst,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  raw,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushFromHand,
  rushed,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RK12-232-252.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const MCN = sUnit("SPEC-MCN", { bp: 1000, powerCost: 1, comboNumber: 1 });
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const DRAGON = sUnit("SPEC-DRAGON", { category: "WB", bp: 1000, features: ["獣", "ドラゴン"] });
const BEAST = sUnit("SPEC-BEAST", { category: "WB", bp: 1000, features: ["獣"] });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 1000, features: ["DEN-O"] });
const DENO_M = sUnit("SPEC-DENO-M", { category: "OT", bp: 1000, features: ["DEN-O"], size: "M" });
const IMAGIN = sUnit("SPEC-IMAGIN", { category: "OT", bp: 1000, features: ["イマジン"] });
const RIDER5 = sUnit("SPEC-RIDER5", { category: "WB", bp: 5000, features: ["仮面ライダー"] });
const BIG_S = sUnit("SPEC-BIG-S", { category: "WB", bp: 2000 });
const MID_S = sUnit("SPEC-MID-S", { category: "WB", bp: 1500 });
const BIG_M = sUnit("SPEC-BIG-M", { category: "WB", bp: 2000, size: "M" });
const EXTRA = [PLAIN_VEHICLE, C1, C2, M2, MCN, RCU, KAMEN, DRAGON, BEAST, DENO, DENO_M, IMAGIN, RIDER5, BIG_S, MID_S, BIG_M];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, phase: GameState["phase"] = "battle") =>
  st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

function enteredInEnemyTurn(id: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  let s = enemyTurn({ rush: [inst(cid, suf)], ...p1 }, { ...p2, rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v"), ...(p2.rush ?? [])] });
  s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
  s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
  return pick(s, id);
}

// ===========================================================================
describe("RK-239 ウエイクアップ！", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍バトルフェイズ中、ホールド状態の自軍Sユニットがバトルエリアに出たとき、『自軍Sユニットを1体選びホールドする』を実行してもよい。そうしたとき、バトルエリアに出たユニットをリリースする。";

  it("RK-239: カタログ本文・スペックが出典と一致（出典: atwiki/page-763）", () => {
    expectCatalogText("RK-239", TEXT);
    expectOpStats("RK-239", { name: "ウエイクアップ！", category: "MA", powerCost: 3 });
    expectRarityIn("RK-239", ["N"]);
  });

  const wake = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    enter(board({ operation: [resident("RK-239", "wu")], rush: [heldUnit("SPEC-KAMEN", "h"), inst("SPEC-C1", "r"), inst("SPEC-M2", "m")], battle: [inst("SPEC-C2", "b")], ...p1 }), "SPEC-KAMEN:h");

  it("RK-239: 自軍バトルフェイズ中、ホールド状態の自軍 S ユニットがバトルエリアに出たとき、太字部分『自軍Sユニットを1体選びホールドする』を実行するかを選べる（任意。リリース状態の自軍 S ユニットから選ぶ。M は対象外）（出典: atwiki/page-763「『自軍Sユニットを1体選びホールドする』を実行してもよい」）", () => {
    const s = wake();
    expect(zoneOf(s, "player1", "SPEC-KAMEN:h")).toBe("battle");
    expectChoiceFrom(s, "player1", "RK-239");
    expect(choiceIds(s)).toEqual(["SPEC-C1:r", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-239: 選んだユニットをホールドし、バトルエリアに出たユニットをリリースする（出典: atwiki/page-763「そうしたとき、バトルエリアに出たユニットをリリースする」）", () => {
    const s = resolveAll(pick(wake(), "SPEC-C1:r"));
    expect(cardIn(s, "player1", "SPEC-C1:r")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld ?? false).toBe(false);
  });

  it("RK-239: 実行しなければ、出たユニットはホールド状態のまま（出典: atwiki/page-763「実行してもよい」）", () => {
    const s = resolveAll(skip(wake()));
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "SPEC-C1:r")?.commandHeld ?? false).toBe(false);
  });

  it("RK-239: ※タッグ — 太字部分のかわりに、他の自軍のタッグの常駐（クライマックス刑事）の太字部分『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行して、出たユニットをリリースできる（出典: atwiki/page-763「太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる」・R-KW-TAG-01）", () => {
    let s = wake({ operation: [resident("RK-239", "wu"), resident("RK-242", "cx")], power: [faceUp("TST-P", "pw0")] });
    expectChoiceFrom(s, "player1", "RK-239");
    expect(choiceIds(s)).toEqual(["RK-239:wu", "RK-242:cx"]);
    s = pick(s, "RK-242:cx");
    s = resolveAll(pick(s, "TST-P:pw0"));
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-P:pw0");
    expect(cardIn(s, "player1", "SPEC-KAMEN:h")?.commandHeld ?? false).toBe(false);
  });

  it("RK-239: リリース状態の自軍 S ユニットが出たときは発動しない（出典: atwiki/page-763「ホールド状態の自軍Sユニットがバトルエリアに出たとき」）", () => {
    const s = enter(board({ operation: [resident("RK-239", "wu")], rush: [inst("SPEC-KAMEN", "h"), inst("SPEC-C1", "r")] }), "SPEC-KAMEN:h");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-239");
  });

  it("RK-239: ホールド状態の M ユニットが出たときは発動しない（出典: atwiki/page-763「ホールド状態の自軍Sユニットが」）", () => {
    const s = enter(board({ operation: [resident("RK-239", "wu")], rush: [heldUnit("SPEC-M2", "hm"), inst("SPEC-C1", "r")] }), "SPEC-M2:hm");
    expect(zoneOf(s, "player1", "SPEC-M2:hm")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-239");
  });

  it("RK-239: 自軍ラッシュフェイズには発動しない（太字部分は他のタッグからも借りられない常駐の効果として自分では起動できない）（出典: atwiki/page-763「自軍バトルフェイズ中、」）", () => {
    const s = rushPhase({ operation: [resident("RK-239", "wu")], rush: [inst("SPEC-C1", "r")] });
    expect(canActivateResident(s, "RK-239:wu")).toBe(false);
  });

  // atwiki/page-763 Q1 = atwiki/page-876 Q1「いいえ、それはできません。リリース状態でバトルエリアに出たので、…『ホールド状態の自軍Sユニットがバトルエリアに出たとき』を満たしていないからです。」
  it("RK-239: 公式Q&A — リリース状態の RK-245 仮面ライダーキバが出て【ダークネスムーンブレイク】でホールドしても、ウエイクアップ！でリリースすることはできない（出典: atwiki/page-763 Q1・atwiki/page-876 Q1）", () => {
    let s = enter(board({ operation: [resident("RK-239", "wu")], rush: [inst("RK-245", "kb"), inst("SPEC-C1", "r")] }, { battle: [inst("SPEC-C1", "e")] }), "RK-245:kb");
    expectChoiceFrom(s, "player1", "RK-245");
    s = accept(s);
    s = resolveAll(s, ["SPEC-C1:e"]);
    expect(cardIn(s, "player1", "RK-245:kb")?.commandHeld).toBe(true);
    expect(s.log.some((l) => l.includes("RK-239") && l.includes("resolve_effect_choice"))).toBe(false);
    expect(cardIn(s, "player1", "SPEC-C1:r")?.commandHeld ?? false).toBe(false);
  });

  it.todo(
    "RK-239: 公式Q&A — ホールド状態の XG4-075 アポロガイストを出してウエイクアップ！でリリースしても【生命の強奪】は使え、相手はリリース状態のアポロガイストをリリースできないので S ユニットを撃破するしかない（出典: atwiki/page-763 Q2）— XG4-075【生命の強奪】が未実装（本範囲外のカード。DSL がない）",
  );
});

// ===========================================================================
describe("RK-240 仮面ライダー電王CF（2nd）", () => {
  const TEXT =
    "※これは特徴「仮面ライダー」を持つ自軍ユニットがホールドされたターン「SP1」になる。 【俺達の必殺技】自軍ターン中、これがバトルエリアに出たとき、本来の特徴に「イマジン」を持つ自軍バトルエリアのユニットの数を数えてもよい。そうしたとき、その数以下の必要パワーを持つSユニットを、本来の特徴に「イマジン」を持つ自軍バトルエリアのユニットの数まで選び、持ち主のパワーゾーンに送る。";

  it("RK-240: カタログ本文・スペックが出典と一致（出典: atwiki/page-954）", () => {
    expectCatalogText("RK-240", TEXT);
    expectStats("RK-240", {
      name: "仮面ライダー電王CF（2nd）",
      category: "OT",
      size: "S",
      bp: 5000,
      sp: "1/4" as never,
      powerCost: "4+",
      features: ["仮面ライダー", "男", "DEN-O", "警察", "2nd"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-240", ["SR"]);
  });

  it("RK-240: 追加条件 — 特徴「DEN-O」を持つ自軍 S ユニット1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-954「追加条件：特徴「DEN-O」を持つ自軍Sユニット1体をパワーゾーンに送る」）", () => {
    const s0 = rushPhase({ hand: [inst("RK-240", "cf")], rush: [inst("SPEC-DENO", "d")], command: releasedCat("OT", 1), power: powerCards(4) });
    const r = rushFromHand(s0, "player1", "RK-240:cf", { materials: ["SPEC-DENO:d"] });
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-240:cf")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-DENO:d")).toBe("power");
  });

  it("RK-240: 追加条件 — 「DEN-O」を持つ自軍 S ユニットがいなければ（M のみ）ラッシュできない（出典: atwiki/page-954）", () => {
    const s0 = rushPhase({ hand: [inst("RK-240", "cf")], rush: [inst("SPEC-DENO-M", "d")], command: releasedCat("OT", 1), power: powerCards(4) });
    expect(rushFromHand(s0, "player1", "RK-240:cf").ok).toBe(false);
  });

  /** RK-249 アドベントで ※コールWB を得た RK-243 仮面ライダーリュウガ（特徴「仮面ライダー」）を、WB のユニットをラッシュするためのコマンドとしてホールドする。 */
  const heldRiderTurn = (extra: Partial<GameState["players"]["player1"]> = {}) => {
    let s = rushPhase({ operation: [resident("RK-249", "adv")], rush: [inst("RK-243", "ry"), inst("RK-240", "cf")], hand: [inst("SPEC-C1", "u")], power: powerCards(3), ...extra });
    s = activateResident(s, "RK-249:adv");
    s = pick(s, "RK-243:ry");
    s = raw(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-C1:u" });
    s = raw(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["RK-243:ry"] });
    return resolveAll(s);
  };

  it("RK-240: ※ 特徴「仮面ライダー」を持つ自軍ユニットがホールドされたターンは「SP1」になる（出典: atwiki/page-954「※これは特徴「仮面ライダー」を持つ自軍ユニットがホールドされたターン「SP1」になる」・カード評価「宇宙警察を使えば、自身をコールOTでホールドすることによってSPを得ることができる」）", () => {
    const s = heldRiderTurn();
    expect(cardIn(s, "player1", "RK-243:ry")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "RK-240:cf")).toBeDefined();
    const before = rushPhase({ rush: [inst("RK-240", "cf")] });
    expect(spOfCf(before)).not.toBe(1);
    expect(spOfCf(s)).toBe(1);
  });

  it("RK-240: ※ ホールドされたのが「仮面ライダー」を持たない自軍ユニットなら「SP1」にならない（出典: atwiki/page-954）", () => {
    let s = rushPhase({ rush: [inst("RK-240", "cf")], hand: [inst("SPEC-C1", "u")], command: releasedCat("WB", 1), power: powerCards(3) });
    s = resolveAll(rushed(s, "SPEC-C1:u"));
    expect(spOfCf(s)).not.toBe(1);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] };
  const entered = (ownBattle: CardInstance[] = [inst("SPEC-IMAGIN", "i1"), inst("SPEC-IMAGIN", "i2")]) =>
    enter(board({ battle: ownBattle, rush: [inst("RK-240", "cf")] }, enemy), "RK-240:cf");

  it("RK-240: 【俺達の必殺技】自軍ターン中、バトルエリアに出たとき、本来の特徴に「イマジン」を持つ自軍バトルエリアのユニットの数（2）を数えるかを選べる（任意）（出典: atwiki/page-954「…の数を数えてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-240");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-240: 数えると、その数（2）以下の必要パワーを持つ S ユニット（自軍・敵軍、エリアを問わない。M は対象外）を、その数まで選んで持ち主のパワーゾーンに送る（出典: atwiki/page-954「その数以下の必要パワーを持つSユニットを、…の数まで選び、持ち主のパワーゾーンに送る」）", () => {
    let s = accept(entered());
    expectChoiceFrom(s, "player1", "RK-240");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:r", "SPEC-C2:b", "SPEC-IMAGIN:i1", "SPEC-IMAGIN:i2"]);
    s = pick(s, "SPEC-C2:b");
    s = resolveAll(pick(s, "SPEC-C1:r"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:r")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-240: 自軍バトルエリアに「イマジン」がいなければ（0体）何も送らない（出典: atwiki/page-954）", () => {
    const s = resolveAll(entered([inst("SPEC-C1", "own")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-240");
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RK-240: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-954「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-240:cf", { battle: [inst("SPEC-IMAGIN", "i1")] }, { battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-240:cf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-240");
  });

  it.todo("RK-240: 「その数まで選び」— 0体から数えた数まで、何体選んでもよいか（途中で終われるか）（出典: atwiki/page-954）— 「まで」の下限の出典がない（エンジンは1体以上・数えた数までで、途中で確定できる）");
});

/** RK-240 のいまの SP（ストライクで与えるダメージ）。 */
function spOfCf(s: GameState): number {
  return spOf(s, "player1", "RK-240:cf");
}

// ===========================================================================
describe("RK-241 仮面ライダーミニ電王SF", () => {
  const TEXT =
    "※これはBP2000以上の敵軍Sユニットにアタックされない。 【ムリヤリな変身】これが撃破されて捨札になったとき、自軍捨札から「モモタロス」のカードを1枚選び、自軍ラッシュエリアに出してもよい。";

  it("RK-241: カタログ本文・スペックが出典と一致（出典: atwiki/page-958）", () => {
    expectCatalogText("RK-241", TEXT);
    expectStats("RK-241", { name: "仮面ライダーミニ電王SF", category: "OT", size: "S", bp: 500, sp: "1/4" as never, powerCost: 2, features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("RK-241", ["R"]);
  });

  const attackers = (atk: string) => enemyTurn({ battle: [inst("RK-241", "mini")] }, { battle: [inst(atk.split(":")[0]!, atk.split(":")[1]!)] });
  const canAttackMini = (s: GameState, atk: string) => attackersOf(s, "RK-241:mini").includes(atk);

  it("RK-241: ※ BP2000 以上の敵軍 S ユニットにはアタックされない（出典: atwiki/page-958「BP2000以上の敵軍Sユニットにアタックされない」）", () => {
    expect(canAttackMini(attackers("SPEC-BIG-S:a"), "SPEC-BIG-S:a")).toBe(false);
  });

  it("RK-241: ※ BP2000 未満の敵軍 S ユニット・BP2000 以上の M ユニットにはアタックされる（出典: atwiki/page-958）", () => {
    expect(canAttackMini(attackers("SPEC-MID-S:a"), "SPEC-MID-S:a")).toBe(true);
    expect(canAttackMini(attackers("SPEC-BIG-M:a"), "SPEC-BIG-M:a")).toBe(true);
  });

  /** 敵軍の M ユニット（BP2000）にアタックされて撃破される（選択は残す）。 */
  const destroyed = (discard: CardInstance[]) => {
    const s = enemyTurn({ battle: [inst("RK-241", "mini")], discard }, { battle: [inst("SPEC-BIG-M", "a")] });
    return settle(act(s, { type: "battle", playerId: "player2", attackerInstanceId: "SPEC-BIG-M:a", defenderInstanceId: "RK-241:mini" }));
  };

  it("RK-241: 【ムリヤリな変身】撃破されて捨札になったとき、自軍捨札の「モモタロス」のカード（「モモタロス（2nd）」を含む）から1枚選べる（任意。デンオウモモタロス等は対象外）（出典: atwiki/page-958「自軍捨札から「モモタロス」のカードを1枚選び、自軍ラッシュエリアに出してもよい」・カード評価「モモタロス（2nd）は…」）", () => {
    const s = destroyed([inst("RK-142", "mo"), inst("RK-310", "mo2"), inst("XG2-081", "dm"), inst("SPEC-C1", "x")]);
    expect(zoneOf(s, "player1", "RK-241:mini")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-241");
    expect(choiceIds(s)).toEqual(["RK-142:mo", "RK-310:mo2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-241: 選んだ「モモタロス」は自軍ラッシュエリアに出る（出典: atwiki/page-958）", () => {
    const s = resolveAll(pick(destroyed([inst("RK-142", "mo")]), "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("rush");
  });

  it("RK-241: 出さないことも選べる（出典: atwiki/page-958「出してもよい」）", () => {
    const s = resolveAll(skip(destroyed([inst("RK-142", "mo")])));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("discard");
  });

  it("RK-241: 自軍捨札に「モモタロス」がなければ何も起きない（出典: atwiki/page-958）", () => {
    const s = destroyed([inst("SPEC-C1", "x")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-241");
  });
});


// ===========================================================================
describe("RK-242 クライマックス刑事", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズごとに1度だけ、『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行してもよい。そうしたとき、このターン、特徴「イマジン」を持つ自軍ユニットは、「これはバトルエリアに出たとき撃破される」と書かれていても、そのテキストは無効になり、特徴「警察」を追加される。";

  it("RK-242: カタログ本文・スペックが出典と一致（出典: atwiki/page-762）", () => {
    expectCatalogText("RK-242", TEXT);
    expectOpStats("RK-242", { name: "クライマックス刑事", category: "OT", powerCost: 0 });
    expectRarityIn("RK-242", ["N"]);
  });

  const cxBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({ operation: [resident("RK-242", "cx")], power: [faceUp("TST-P", "up"), faceDown("TST-P", "dn")], rush: [inst("RK-142", "mo"), inst("SPEC-IMAGIN", "im"), inst("SPEC-C1", "c")], ...p1 }, { rush: [inst("SPEC-IMAGIN", "eim")] });
  const used = () => resolveAll(pick(activateResident(cxBoard(), "RK-242:cx"), "TST-P:up"));

  it("RK-242: 自軍ラッシュフェイズに、太字部分『オモテ向きの自軍パワーを1枚選び、自軍山札の上に戻す』を実行できる（任意。ウラ向きのカードは選べない）（出典: atwiki/page-762「自軍ラッシュフェイズごとに1度だけ、…を実行してもよい」）", () => {
    const s0 = cxBoard();
    expect(canActivateResident(s0, "RK-242:cx")).toBe(true);
    const s = activateResident(s0, "RK-242:cx");
    expectChoiceFrom(s, "player1", "RK-242");
    expect(choiceIds(s)).toEqual(["TST-P:up"]);
  });

  it("RK-242: 選んだオモテ向きのパワーは自軍山札の上に戻る（出典: atwiki/page-762）", () => {
    const s = used();
    expect(s.players.player1.deck[0]?.instanceId).toBe("TST-P:up");
    expect(zoneOf(s, "player1", "TST-P:up")).toBe("deck");
  });

  it("RK-242: そうしたとき、このターン、特徴「イマジン」を持つ自軍ユニットに特徴「警察」が追加される（敵軍のイマジンには追加されない）（出典: atwiki/page-762「特徴「警察」を追加される」）", () => {
    const s = used();
    expect(featuresOf(s, "player1", "SPEC-IMAGIN:im")).toContain("警察");
    expect(featuresOf(s, "player1", "SPEC-C1:c")).not.toContain("警察");
    expect(featuresOf(s, "player2", "SPEC-IMAGIN:eim")).not.toContain("警察");
  });

  it("RK-242: そうしたとき、このターン、自軍のイマジンの「これはバトルエリアに出たとき撃破される」は無効になる（RK-142 モモタロスがバトルエリアに残る）（出典: atwiki/page-762「そのテキストは無効になり」）", () => {
    const s = enter(nextPhase(used()), "RK-142:mo");
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("battle");
  });

  it("RK-242: 実行しなければ、RK-142 モモタロスはバトルエリアに出たとき撃破される（出典: atwiki/page-762「そうしたとき」・RK-142 本文）", () => {
    const s = resolveAll(enter(nextPhase(cxBoard()), "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("discard");
  });

  it("RK-242: 自軍ラッシュフェイズごとに1度だけ（同じラッシュフェイズに2回目は実行できない）（出典: atwiki/page-762「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = used();
    expect(canActivateResident(s, "RK-242:cx")).toBe(false);
  });

  it("RK-242: オモテ向きの自軍パワーがなければ（他のタッグもなければ）実行できない（出典: atwiki/page-762）", () => {
    expect(canActivateResident(cxBoard({ power: [faceDown("TST-P", "dn")] }), "RK-242:cx")).toBe(false);
  });

  it("RK-242: 自軍バトルフェイズには実行できない（出典: atwiki/page-762「自軍ラッシュフェイズごとに」）", () => {
    expect(canActivateResident(nextPhase(cxBoard()), "RK-242:cx")).toBe(false);
  });

  // ユーザー決定（2026-10-19）「両方の効果をそれぞれ発動することができる」（docs/rules/README.md §5.7 i）。
  // Q1 の例は RK-242 と PK-011 だが、PK-011 はカタログの同一性（packages/cards/src/reprints.ts）に入っていないため、RK-242 を2枚使う（同名のタッグ2枚）。
  it("RK-242: 公式Q&A — 同名のタッグ（クライマックス刑事2枚）を2枚同時に常駐させていれば、1度のラッシュフェイズに両方の太字部分の効果をそれぞれ発動できる（出典: atwiki/page-762 Q1「両方の効果をそれぞれ発動することができます。(2010/10/25修正)」・ユーザー決定 2026-10-19「両方の効果をそれぞれ発動することができる」）", () => {
    const pickOwnBold = (st: GameState, opId: string) => (st.pendingEffectChoice?.effectId === "tag_bold_pick" ? pick(st, opId) : st);
    let s = cxBoard({ operation: [resident("RK-242", "cx"), resident("RK-242", "cx2")], power: [faceUp("TST-P", "up"), faceUp("TST-P", "up2")] });
    s = resolveAll(pick(pickOwnBold(activateResident(s, "RK-242:cx"), "RK-242:cx"), "TST-P:up"));
    expect(canActivateResident(s, "RK-242:cx")).toBe(false);
    // 同名のもう1枚（cx2）はまだ使っていないので、同じラッシュフェイズにもう1度太字部分を実行できる。
    expect(canActivateResident(s, "RK-242:cx2")).toBe(true);
    s = resolveAll(pick(pickOwnBold(activateResident(s, "RK-242:cx2"), "RK-242:cx2"), "TST-P:up2"));
    expect(zoneOf(s, "player1", "TST-P:up")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-P:up2")).toBe("deck");
    expect(canActivateResident(s, "RK-242:cx2")).toBe(false);
  });
});

// ===========================================================================
describe("RK-243 仮面ライダーリュウガ", () => {
  const TEXT = "【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットからコンビネーションしたとき発動できる⇒敵軍バトルエリアから、ナンバーを持たない敵軍Sユニットを1体選び撃破する。";

  it("RK-243: カタログ本文・スペックが出典と一致（出典: atwiki/page-1010）", () => {
    expectCatalogText("RK-243", TEXT);
    expectStats("RK-243", { name: "仮面ライダーリュウガ", category: "WB", size: "S", bp: 4000, sp: "1/2" as never, powerCost: 5, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-243", ["R"]);
  });

  const enemy = { battle: [inst("SPEC-C1", "nonum"), inst("SPEC-MCN", "cn"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  const entered = (prev = "SPEC-DRAGON:d") => enter(board({ battle: [inst(prev.split(":")[0]!, prev.split(":")[1]!)], rush: [inst("RK-243", "ry")] }, enemy), "RK-243:ry");

  it("RK-243: 【ドラゴンライダーキック】特徴「ドラゴン」を持つユニットからコンビネーションしたとき（その次にバトルエリアに出たとき）、発動するかを選べ（任意）、敵軍バトルエリアのナンバーを持たない S ユニット（ナンバーあり・M・ラッシュエリアは対象外）から1体選ぶ（出典: atwiki/page-1010「敵軍バトルエリアから、ナンバーを持たない敵軍Sユニットを1体選び撃破する」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-243");
    expect(choiceIds(s)).toEqual(["SPEC-C1:nonum"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-243: 選んだユニットを撃破する（出典: atwiki/page-1010）", () => {
    const s = resolveAll(pick(entered(), "SPEC-C1:nonum"));
    expect(zoneOf(s, "player2", "SPEC-C1:nonum")).toBe("discard");
  });

  it("RK-243: 直前のユニットが「ドラゴン」を持たなければ発動しない（出典: atwiki/page-1010「特徴「ドラゴン」を持つユニットからコンビネーションしたとき」・R-CN-05）", () => {
    const s = entered("SPEC-BEAST:b");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-243");
  });

  it("RK-243: バトルエリアの最初のユニットとして出たときは発動しない（出典: atwiki/page-1010・R-CN-05）", () => {
    const s = enter(board({ rush: [inst("RK-243", "ry")] }, enemy), "RK-243:ry");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-243");
  });

  it("RK-243: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: R-CN-04・R-CN-05）", () => {
    const s = enteredInEnemyTurn("RK-243:ry", { battle: [inst("SPEC-DRAGON", "d")] }, { battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-243:ry")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-243");
  });

  it.todo("RK-243: ナンバーが RC のユニットが「ナンバーを持たない」に当たるか（出典: atwiki/page-1010）— 出典がない（エンジンは RC をナンバーとして扱い、選べない）");
});

// ===========================================================================
describe("RK-244 ミッシングエース", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズごとに1度だけ、『自分の手札から1枚選び捨札にする』を実行してもよい。そうしたとき、相手は自分自身の捨札にあるユニットカードと同じカード名の自分自身のユニットを1体選び、撃破する。";

  it("RK-244: カタログ本文・スペックが出典と一致（出典: atwiki/page-932）", () => {
    expectCatalogText("RK-244", TEXT);
    expectOpStats("RK-244", { name: "ミッシングエース", category: "WB", powerCost: 3 });
    expectRarityIn("RK-244", ["N"]);
  });

  const enemy = { discard: [inst("SPEC-C1", "d1"), inst("TST-OP", "dop")], battle: [inst("SPEC-C1", "a")], rush: [inst("SPEC-C1", "b"), inst("SPEC-C2", "c")] };
  const maBoard = (p2: Partial<GameState["players"]["player2"]> = enemy) => rushPhase({ operation: [resident("RK-244", "ma")], hand: [inst("TST-OP", "h")] }, p2);
  const used = (p2: Partial<GameState["players"]["player2"]> = enemy) => pick(activateResident(maBoard(p2), "RK-244:ma"), "TST-OP:h");

  it("RK-244: 自軍ラッシュフェイズに、太字部分『自分の手札から1枚選び捨札にする』を実行できる（出典: atwiki/page-932「自軍ラッシュフェイズごとに1度だけ、…を実行してもよい」）", () => {
    const s0 = maBoard();
    expect(canActivateResident(s0, "RK-244:ma")).toBe(true);
    const s = activateResident(s0, "RK-244:ma");
    expectChoiceFrom(s, "player1", "RK-244");
    expect(choiceIds(s)).toEqual(["TST-OP:h"]);
  });

  it("RK-244: そうしたとき、相手は自分の捨札にあるユニットカードと同じカード名の自分のユニット（エリアを問わない）から1体選ぶ（選ばないことはできない）（出典: atwiki/page-932「相手は自分自身の捨札にあるユニットカードと同じカード名の自分自身のユニットを1体選び、撃破する」）", () => {
    const s = used();
    expect(zoneOf(s, "player1", "TST-OP:h")).toBe("discard");
    expectChoiceFrom(s, "player2", "RK-244");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C1:b"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-244: 相手が選んだユニットは撃破される（出典: atwiki/page-932）", () => {
    const s = resolveAll(pick(used(), "SPEC-C1:b"));
    expect(zoneOf(s, "player2", "SPEC-C1:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
  });

  it("RK-244: 同じカード名のユニットがなければ、手札を捨札にするだけで何も撃破されない（出典: atwiki/page-932）", () => {
    const s = resolveAll(used({ ...enemy, discard: [inst("SPEC-C2", "x")], rush: [inst("SPEC-C1", "b")] }));
    expect(zoneOf(s, "player1", "TST-OP:h")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:b")).toBe("rush");
  });

  it("RK-244: 自軍ラッシュフェイズごとに1度だけ（出典: atwiki/page-932「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = resolveAll(pick(used(), "SPEC-C1:b"));
    expect(canActivateResident({ ...s, players: { ...s.players, player1: { ...s.players.player1, hand: [inst("TST-OP", "h2")] } } }, "RK-244:ma")).toBe(false);
  });

  // atwiki/page-932 Q1「はい、どちらの場合も対象になります。」
  it("RK-244: 公式Q&A — 自軍 L ユニットがなく XG6-018 アバレキラーが捨札にあるとき、場の RS-227 爆竜トップゲイラーは対象になる（出典: atwiki/page-932 Q1）", () => {
    const s = used({ discard: [inst("XG6-018", "ak")], battle: [inst("RS-227", "tg")] });
    expectChoiceFrom(s, "player2", "RK-244");
    expect(choiceIds(s)).toEqual(["RS-227:tg"]);
  });

  it("RK-244: 公式Q&A — 自軍 L ユニットがなく RS-227 爆竜トップゲイラーが捨札にあるとき、場の XG6-018 アバレキラーは対象になる（出典: atwiki/page-932 Q1）", () => {
    const s = used({ discard: [inst("RS-227", "tg")], battle: [inst("XG6-018", "ak")] });
    expectChoiceFrom(s, "player2", "RK-244");
    expect(choiceIds(s)).toEqual(["XG6-018:ak"]);
  });
});

// ===========================================================================
describe("RK-245 仮面ライダーキバ", () => {
  const TEXT =
    "※これはラッシュするとき、可能ならホールド状態で置く。 ※レジスト（これがバトルで撃破されたとき、捨て札にするかわりにこれをホールドしてその場に留めてもよい） 【ダークネスムーンブレイク】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-245: カタログ本文・スペックが出典と一致（出典: atwiki/page-876）", () => {
    expectCatalogText("RK-245", TEXT);
    expectStats("RK-245", { name: "仮面ライダーキバ", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("RK-245", ["SR"]);
  });

  it("RK-245: ※ 手札からラッシュするとき、ホールド状態で置く（出典: atwiki/page-876「これはラッシュするとき、可能ならホールド状態で置く」）", () => {
    const s0 = rushPhase({ hand: [inst("RK-245", "kb")], command: releasedCat("MA", 1), power: powerCards(4) });
    const s = resolveAll(rushed(s0, "RK-245:kb"));
    expect(zoneOf(s, "player1", "RK-245:kb")).toBe("rush");
    expect(cardIn(s, "player1", "RK-245:kb")?.commandHeld).toBe(true);
  });

  it("RK-245: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-876「※レジスト」・R-KW-RESIST）", () => {
    const s = attackUntilRegister({ battle: [inst("RK-245", "kb")] }, "RK-245:kb");
    expect(registerOffered(s)).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C2", "r")] };
  const entered = (self: CardInstance = inst("RK-245", "kb")) => enter(board({ rush: [self] }, enemy), self.instanceId);

  it("RK-245: 【ダークネスムーンブレイク】自軍ターン中、リリース状態でバトルエリアに出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-876「このユニットをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-245");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-245: ホールドすると、敵軍 S ユニット（エリアを問わない。M は対象外）から1体選ぶ（選ばないことはできない）（出典: atwiki/page-876「そうしたとき、敵軍Sユニットを1体選び」）", () => {
    const s = accept(entered());
    expect(cardIn(s, "player1", "RK-245:kb")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-245");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-245: 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-876「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(accept(entered()), "SPEC-C2:r"));
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C2:r")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-245: ホールドしなければ何もしない（出典: atwiki/page-876「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(cardIn(s, "player1", "RK-245:kb")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-245: ホールド状態でバトルエリアに出たときは、ホールドできないので発動しない（出典: atwiki/page-876「このユニットをホールドしてもよい」・カード評価「ホールド状態で場に出なければならず、そのままでは能力は使えない」）", () => {
    const s0 = board({ rush: [heldUnit("RK-245", "kb")] }, enemy);
    expect(canEnter(s0, "RK-245:kb")).toBe(true);
    const s = enter(s0, "RK-245:kb");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-245");
  });

  it("RK-245: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-876「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-245:kb", {}, { battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-245:kb")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-245");
  });

  it.todo(
    "RK-245: 公式Q&A — XG2-055 変身一発でラッシュしても「ラッシュするとき、可能ならホールド状態で置く」は発動する（ホールド状態で出る）（出典: atwiki/page-876 Q2）— XG2-055 変身一発が未実装（本範囲外のカード。DSL がない）",
  );
  it.todo(
    "RK-245: 公式Q&A — 自軍 XG5-025 ボウケンブルーAT があるとき相手がラッシュしたキバはホールド状態で出るので【上空からの牽制】の対象外（出典: atwiki/page-876 Q3）— XG5-025【上空からの牽制】が未実装（本範囲外のカード。DSL がない）",
  );
});
