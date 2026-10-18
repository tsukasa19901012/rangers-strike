/**
 * カード別スペック: RK-246〜RK-252（ザ・マスクドライダーEXP vol.3 仮面ライダーキバGF〜vol.4 変身音叉 音角）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-card-1（RS-011 欄。RK-251 と RS-325 の Q。
 *     docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_1.html）。
 *     atwiki に転載された公式 Q&A（RK-247 Q1、RK-250 Q1・Q2、RK-251 Q1〜Q3）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CALL-01、R-CTR 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-249 アドベント（※コールWB の付与・選ばなければ得ない・ラッシュフェイズごとに1度だけ）— rulesSpec/07-call-read.test.ts R-KW-CALL-01
 *  - RK-251 Q2（ゴルゴムの仕業で無効化されたオーラパワーをマジシャインの効果でコマンドゾーンに留める）— rulesSpec/06-effects-timing.test.ts
 *    R-REPL-02 の it.todo（RS-325 の「かわりに」が未接続）
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  accept,
  act,
  activateResident,
  attack,
  bpOf,
  canEndPhase,
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
  inst,
  nextPhase,
  p1Battle,
  pick,
  played,
  powerCards,
  raw,
  reanimateTests,
  releasedCat,
  resident,
  resolveAll,
  settle,
  skip,
  st,
  sUnit,
  zordDownTests,
  zoneOf,
} from "./RK12-232-252.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const POLICE = sUnit("SPEC-POLICE", { category: "WB", bp: 1000, features: ["警察"] });
const MALE = sUnit("SPEC-MALE", { category: "WB", bp: 1000, features: ["男"] });
const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 2000 });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 2000 });
const WB_M = sUnit("SPEC-WB-M", { category: "WB", bp: 2000, size: "M" });
const WB_SURVIVE = sUnit("SPEC-WB-SURVIVE", { category: "WB", bp: 2000, features: ["サバイブ"] });
const WB_MA = sUnit("SPEC-WB-MA", { category: ["WB", "MA"], bp: 2000 } as never);
const MIRROR3 = sUnit("SPEC-MIRROR3", { category: "WB", bp: 2000, powerCost: 3, features: ["仮面ライダー", "ミラーライダー"] });
const EXTRA = [PLAIN_VEHICLE, C1, C2, C3, M2, POLICE, MALE, ACCEL, WB_S, MA_S, WB_M, WB_SURVIVE, WB_MA, MIRROR3];

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

/**
 * 自軍ラッシュフェイズに、RK-249 アドベントで ※コールWB を得た RK-243 仮面ライダーリュウガを、WB のユニット（SPEC-C1）をラッシュするための
 * コマンドとしてホールドする（自軍ユニットがホールドされたターンにする）。
 */
function holdOwnUnitInRush(p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  const ops = [resident("RK-249", "adv"), ...(p1.operation ?? [])];
  let s = rushPhase({ ...p1, operation: ops, rush: [inst("RK-243", "ry"), ...(p1.rush ?? [])], hand: [inst("SPEC-C1", "u"), ...(p1.hand ?? [])], power: p1.power ?? powerCards(3) }, p2);
  s = activateResident(s, "RK-249:adv");
  s = pick(s, "RK-243:ry");
  s = raw(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-C1:u" });
  s = raw(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["RK-243:ry"] });
  return resolveAll(s);
}

// ===========================================================================
describe("RK-246 仮面ライダーキバGF", () => {
  const TEXT =
    "※これは自軍パワーゾーンのオモテ向きのカード1枚につきBP+1000される。 【ガルル・ハウリングスラッシュ】自軍ターン中、これがバトルエリアに出たとき、このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアから相手の手札の枚数以下の必要パワーの数字を持つSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-246: カタログ本文・スペックが出典と一致（出典: atwiki/page-959）", () => {
    expectCatalogText("RK-246", TEXT);
    expectStats("RK-246", { name: "仮面ライダーキバGF", category: "MA", size: "S", bp: 500, sp: "1/3" as never, powerCost: 3, features: ["仮面ライダー", "男", "魔皇力"] });
    expectRarityIn("RK-246", ["R"]);
  });

  it("RK-246: ※ 自軍パワーゾーンのオモテ向きのカード1枚につき BP+1000（オモテ3枚・ウラ1枚なら 3500）（出典: atwiki/page-959・カード評価「ラッシュした時点で+3000（ダメージを受けていなければ）」）", () => {
    const s = board({ rush: [inst("RK-246", "gf")], power: [...powerCards(3), faceDown("TST-P", "d")] });
    expect(bpOf(s, "player1", "RK-246:gf")).toBe(3500);
  });

  const enemy = { hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")], battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b"), inst("SPEC-C3", "c"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] };
  const entered = (p2: Partial<GameState["players"]["player2"]> = enemy) => enter(board({ rush: [inst("RK-246", "gf")] }, p2), "RK-246:gf");

  it("RK-246: 【ガルル・ハウリングスラッシュ】自軍ターン中、バトルエリアに出たとき、このユニットをホールドするかを選べる（任意）（出典: atwiki/page-959「このユニットをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-246");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-246: ホールドすると、敵軍バトルエリアの、相手の手札の枚数（2）以下の必要パワーの数字を持つ S ユニット（ラッシュエリア・M は対象外）から1体選ぶ（出典: atwiki/page-959「敵軍バトルエリアから相手の手札の枚数以下の必要パワーの数字を持つSユニットを1体選び」）", () => {
    const s = accept(entered());
    expect(cardIn(s, "player1", "RK-246:gf")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-246");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-246: 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-959「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(pick(accept(entered()), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-C2:b")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-246: ホールドしなければ何もしない（出典: atwiki/page-959「ホールドしてもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(entered()));
    expect(cardIn(s, "player1", "RK-246:gf")?.commandHeld ?? false).toBe(false);
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-246: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-959「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-246:gf", {}, { hand: enemy.hand, battle: enemy.battle });
    expect(zoneOf(s, "player1", "RK-246:gf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-246");
  });
});

// ===========================================================================
describe("RK-247 仮面ライダーネガ電王", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から｢ネガタロス｣のカードを1枚選びラッシュエリアに出す。 ※これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない。 【不敵な挑発】これが自軍エリアにある間、次の効果を発動する⇒特徴「警察」を持つユニットは、可能なら毎ターンバトルエリアに出る。";

  it("RK-247: カタログ本文・スペックが出典と一致（出典: atwiki/page-1011）", () => {
    expectCatalogText("RK-247", TEXT);
    expectStats("RK-247", { name: "仮面ライダーネガ電王", category: "DA", size: "S", bp: 4500, sp: 1, powerCost: "7-", features: ["仮面ライダー", "イマジン"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-247", ["R"]);
  });

  zordDownTests("RK-247", "RK-236", "ネガタロス", "atwiki/page-1011", "DA");
  reanimateTests("RK-247", "RK-236", "ネガタロス", "atwiki/page-1011");

  it("RK-247: ※ 自軍ユニットがホールドされていないターンはバトルエリアに出られない（出典: atwiki/page-1011「これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-247", "ng")] }), "RK-247:ng")).toBe(false);
  });

  it("RK-247: ※ 自軍ユニットがホールドされたターン（※コールでコマンドとしてホールドした）はバトルエリアに出られる（出典: atwiki/page-1011・カード評価「自分から能動的にユニットをホールドする必要がある」）", () => {
    const s = nextPhase(holdOwnUnitInRush({ rush: [inst("RK-247", "ng")] }));
    expect(s.phase).toBe("battle");
    expect(canEnter(s, "RK-247:ng")).toBe(true);
  });

  it("RK-247: 【不敵な挑発】これが自軍エリアにある間、自軍の特徴「警察」を持つユニットは可能なら毎ターンバトルエリアに出る（出さずにバトルフェイズを終えられない）（出典: atwiki/page-1011「特徴「警察」を持つユニットは、可能なら毎ターンバトルエリアに出る」）", () => {
    const s = board({ battle: [inst("RK-247", "ng")], rush: [inst("SPEC-POLICE", "p")] });
    expect(canEndPhase(s)).toBe(false);
    const t = enter(s, "SPEC-POLICE:p");
    expect(zoneOf(settle(t), "player1", "SPEC-POLICE:p")).toBe("battle");
  });

  it("RK-247: 【不敵な挑発】敵軍の「警察」も、敵軍のターンに可能ならバトルエリアに出る（出典: atwiki/page-1011「特徴「警察」を持つユニットは」（自軍・敵軍の限定がない））", () => {
    const s = enemyTurn({ rush: [inst("RK-247", "ng")] }, { rush: [inst("SPEC-POLICE", "p")] });
    expect(canEndPhase(s, "player2")).toBe(false);
  });

  it("RK-247: 【不敵な挑発】これが場になければ「警察」は出なくてよい（出典: atwiki/page-1011「これが自軍エリアにある間」）", () => {
    expect(canEndPhase(board({ rush: [inst("SPEC-POLICE", "p")], hand: [inst("RK-247", "ng")] }))).toBe(true);
  });

  // atwiki/page-1011 Q1「はい、できます。」
  for (const id of ["RK-280", "RK-281"]) {
    it.fails(`RK-247: 公式Q&A — ${id} を自軍ラッシュフェイズ中に自身の効果でホールドしたターンも、ネガ電王はバトルエリアに出られる（出典: atwiki/page-1011 Q1）`, () => {
      const s = nextPhase(act(rushPhase({ rush: [inst("RK-247", "ng"), inst(id, "v")] }), { type: "activate_field_unit_ability", playerId: "player1", unitInstanceId: `${id}:v` }));
      expect(s.phase).toBe("battle");
      expect(canEnter(s, "RK-247:ng")).toBe(true);
    });
  }
  it.todo(
    "RK-247: 公式Q&A — XG2-082 電子星獣ドルを自軍ラッシュフェイズ中に自身の効果でホールドしたターンも、ネガ電王はバトルエリアに出られる（出典: atwiki/page-1011 Q1）— XG2-082 の「ホールドしてもよい」が未実装（本範囲外のカード。RS8-560-581.c の RS-579 と同じ。RK-280・RK-281 は上で照合）",
  );
});

// ===========================================================================
describe("RK-248 パラダイス・ロスト", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍ラッシュフェイズごとに1度だけ、『敵軍捨札から1枚選び、持ち主の手札に加える』を実行してもよい。そうしたとき、このターン、相手の常駐オペレーションは無効になる。";

  it("RK-248: カタログ本文・スペックが出典と一致（出典: atwiki/page-951）", () => {
    expectCatalogText("RK-248", TEXT);
    expectOpStats("RK-248", { name: "パラダイス・ロスト", category: "DA", powerCost: 3 });
    expectRarityIn("RK-248", ["N"]);
  });

  const plBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushPhase(
      { operation: [resident("RK-248", "pl")], rush: [inst("SPEC-MALE", "mine")], ...p1 },
      { discard: [inst("SPEC-C1", "ed"), inst("TST-OP", "eop")], operation: [resident("RK-001", "kz")], rush: [inst("SPEC-MALE", "his")], ...p2 },
    );
  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(pick(activateResident(plBoard(p1, p2), "RK-248:pl"), "SPEC-C1:ed"));

  it("RK-248: 自軍ラッシュフェイズに、太字部分『敵軍捨札から1枚選び、持ち主の手札に加える』を実行できる（敵軍捨札のカードから選ぶ）（出典: atwiki/page-951「自軍ラッシュフェイズごとに1度だけ、…を実行してもよい」）", () => {
    const s = activateResident(plBoard(), "RK-248:pl");
    expectChoiceFrom(s, "player1", "RK-248");
    expect(choiceIds(s)).toEqual(["SPEC-C1:ed", "TST-OP:eop"]);
  });

  it("RK-248: 選んだカードは持ち主（相手）の手札に加わる（出典: atwiki/page-951「持ち主の手札に加える」）", () => {
    const s = used();
    expect(zoneOf(s, "player2", "SPEC-C1:ed")).toBe("hand");
  });

  it("RK-248: そうしたとき、このターン、相手の常駐オペレーションは無効になる（相手の RK-001 改造人間が「改造人間」を追加しない）（出典: atwiki/page-951「このターン、相手の常駐オペレーションは無効になる」）", () => {
    expect(featuresOf(plBoard(), "player2", "SPEC-MALE:his")).toContain("改造人間");
    const s = used();
    expect(featuresOf(s, "player2", "SPEC-MALE:his")).not.toContain("改造人間");
  });

  it("RK-248: 自分の常駐オペレーションは無効にならない（自軍の RK-001 改造人間は効く）（出典: atwiki/page-951「相手の常駐オペレーション」）", () => {
    const s = used({ operation: [resident("RK-248", "pl"), resident("RK-001", "mykz")] });
    expect(featuresOf(s, "player1", "SPEC-MALE:mine")).toContain("改造人間");
  });

  it("RK-248: 無効になった相手の RK-021 クロックアップは、このターン、特徴「加速」を持つユニットへのアタックでバトルを止められない（出典: atwiki/page-951・カード評価「ファイブテクターやクロックアップなどを無効にできる」）", () => {
    let s = used({ battle: [inst("TST-UNIT-7", "big")] }, { operation: [resident("RK-021", "cu", [faceDown("TST-OP", "s0"), faceDown("TST-OP", "s1")])], battle: [inst("SPEC-ACCEL", "ac")] });
    s = nextPhase(s);
    s = settle(attack(s, "TST-UNIT-7:big", "SPEC-ACCEL:ac"));
    expect(zoneOf(s, "player2", "SPEC-ACCEL:ac")).toBe("discard");
  });

  it("RK-248: 自軍ラッシュフェイズごとに1度だけ（出典: atwiki/page-951「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = used();
    expect(actResidentLegal(s)).toBe(false);
  });

  it("RK-248: 実行しなければ相手の常駐は有効なまま（出典: atwiki/page-951「実行してもよい」）", () => {
    expect(featuresOf(nextPhase(plBoard()), "player2", "SPEC-MALE:his")).toContain("改造人間");
  });
});

function actResidentLegal(s: GameState): boolean {
  try {
    raw(s, { type: "activate_resident_operation", playerId: "player1", operationInstanceId: "RK-248:pl" });
    return true;
  } catch {
    return false;
  }
}

// ===========================================================================
describe("RK-249 アドベント", () => {
  const TEXT =
    "※常駐 自軍ラッシュフェイズごとに1度だけ、特徴「ミラーライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは次の能力を得る⇒※コールWB（このユニットはWBのユニットをラッシュするためのコマンドとしてホールドできる）";

  it("RK-249: カタログ本文・スペックが出典と一致（出典: atwiki/page-1246）", () => {
    expectCatalogText("RK-249", TEXT);
    expectOpStats("RK-249", { name: "アドベント", category: "WB", powerCost: 4 });
    expectRarityIn("RK-249", ["N"]);
  });

  it("RK-249: 選べるのは特徴「ミラーライダー」を持つ自軍ユニットだけ（出典: atwiki/page-1246「特徴「ミラーライダー」を持つ自軍ユニットを1体選んでもよい」）", () => {
    const s = activateResident(rushPhase({ operation: [resident("RK-249", "adv")], rush: [inst("RK-243", "ry"), inst("SPEC-C1", "c")] }, { rush: [inst("SPEC-MIRROR3", "em")] }), "RK-249:adv");
    expectChoiceFrom(s, "player1", "RK-249");
    expect(choiceIds(s)).toEqual(["RK-243:ry"]);
  });

  it.todo(
    "RK-249: 特徴「アドベントカード」を持つ（出典: atwiki/page-1246「特徴：アドベントカード」）— カタログがオペレーションの特徴を持たない（全オペレーションで未収録。RK-083 と同じ）ため照合できない",
  );
});

// ===========================================================================
describe("RK-250 サバイブ", () => {
  const TEXT =
    "WBを持ち、特徴「サバイブ」を持たない自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、BP+1500され、特徴「サバイブ」が追加される。また、重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める。";

  it("RK-250: カタログ本文・スペックが出典と一致（出典: atwiki/page-1350）", () => {
    expectCatalogText("RK-250", TEXT);
    expectOpStats("RK-250", { name: "サバイブ", category: "WB", powerCost: 5 });
    expectRarityIn("RK-250", ["N"]);
  });

  const svBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({
      hand: [inst("RK-250", "sv")],
      command: releasedCat("WB", 1),
      power: powerCards(5),
      rush: [inst("SPEC-WB-S", "w"), inst("SPEC-MA-S", "ma"), inst("SPEC-WB-M", "wm"), inst("SPEC-WB-SURVIVE", "ws")],
      battle: [inst("SPEC-WB-MA", "wma")],
      ...p1,
    });

  it("RK-250: WB を持ち、特徴「サバイブ」を持たない自軍 S ユニット（エリアを問わない。MA・M・「サバイブ」持ちは対象外）から1体選ぶ（出典: atwiki/page-1350「WBを持ち、特徴「サバイブ」を持たない自軍Sユニットを1体選ぶ」）", () => {
    const s = played(svBoard(), "RK-250:sv");
    expectChoiceFrom(s, "player1", "RK-250");
    expect(choiceIds(s)).toEqual(["SPEC-WB-MA:wma", "SPEC-WB-S:w"]);
  });

  /** サバイブを SPEC-WB-S（BP2000）に重ねた状態。 */
  const stacked = () => resolveAll(pick(played(svBoard(), "RK-250:sv"), "SPEC-WB-S:w"));

  it("RK-250: 選んだユニットとこのカードは重なり（捨札にはならない）、重ねたユニットは BP+1500・特徴「サバイブ」が追加される（出典: atwiki/page-1350「このカードに重ねたユニットは、BP+1500され、特徴「サバイブ」が追加される」）", () => {
    const s = stacked();
    expect(zoneOf(s, "player1", "RK-250:sv")).toBeNull();
    expect((cardIn(s, "player1", "SPEC-WB-S:w")?.stackedCards ?? []).map((c) => c.instanceId)).toContain("RK-250:sv");
    expect(bpOf(s, "player1", "SPEC-WB-S:w")).toBe(3500);
    expect(featuresOf(s, "player1", "SPEC-WB-S:w")).toContain("サバイブ");
  });

  /** サバイブを重ねたユニット（setup で直接重ねる）。 */
  const withSurvive = (suf: string, extra: CardInstance[] = []): CardInstance => ({ ...inst("SPEC-WB-S", suf), stackedCards: [inst("RK-250", "sv"), ...extra] });

  it("RK-250: 重ねたユニットがバトルで撃破されるとき、かわりにこのカードを捨札にしてその場に留まる（出典: atwiki/page-1350「重ねたユニットがユニットでなくなるとき、このカードを捨札にしてその場に留める」・カード評価「Sユニットを除去などから一度だけ守ってくれる」）", () => {
    let s = enemyTurn({ battle: [withSurvive("w")] }, { battle: [inst("TST-UNIT-7", "atk")] });
    s = resolveAll(attack(s, "TST-UNIT-7:atk", "SPEC-WB-S:w", "player2"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
    expect(featuresOf(s, "player1", "SPEC-WB-S:w")).not.toContain("サバイブ");
  });

  it("RK-250: 効果で撃破されるときも留まる（敵軍の RS-687 ギンガイオー【ガルコンボーガン】）（出典: atwiki/page-1350「ユニットでなくなるとき」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [withSurvive("w")], deck: deckCards(3) }, player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") } }, EXTRA);
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-687:gg" });
    if (s.pendingEffectChoice?.sourceCardId === "RS-687") s = pick(s, "SPEC-WB-S:w");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
  });

  it("RK-250: 留まった後にもう一度撃破されると、ふつうに捨札になる（出典: atwiki/page-1350・カード評価「一度だけ守ってくれる」）", () => {
    let s = enemyTurn({ battle: [withSurvive("w")] }, { battle: [inst("TST-UNIT-7", "atk"), inst("TST-UNIT-7", "atk2")] });
    s = resolveAll(attack(s, "TST-UNIT-7:atk", "SPEC-WB-S:w", "player2"));
    s = resolveAll(attack(s, "TST-UNIT-7:atk2", "SPEC-WB-S:w", "player2"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("discard");
  });

  // atwiki/page-1350 Q1「はい、そのとおりです。…ターンプレイヤーの任意の順番で解決して下さい。なお、「RK-250 サバイブ」の効果を先に解決した場合、
  // そのユニットは場に留まることになり…「RK-173 鬼の鎧」の「ユニットでなくなるとき」の効果は解決できなくなります。」
  const bothStacked = () => {
    const s = enemyTurn({ battle: [withSurvive("w", [inst("RK-173", "oni")])] }, { battle: [inst("TST-UNIT-7", "atk")] });
    return settle(attack(s, "TST-UNIT-7:atk", "SPEC-WB-S:w", "player2"));
  };

  it("RK-250: 公式Q&A — 鬼の鎧とサバイブを重ねたユニットがユニットでなくなるとき、ターンプレイヤー（ここでは敵軍）がどちらから解決するかを選ぶ（出典: atwiki/page-1350 Q1）", () => {
    const s = bothStacked();
    expectChoiceFrom(s, "player2", "RK-250");
    expect(choiceIds(s)).toEqual(["RK-173:oni", "RK-250:sv"]);
  });

  it("RK-250: 公式Q&A — サバイブを先に解決すると、ユニットは留まるので鬼の鎧は捨札にならない（出典: atwiki/page-1350 Q1）", () => {
    const s = resolveAll(pick(bothStacked(), "RK-250:sv"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
    expect((cardIn(s, "player1", "SPEC-WB-S:w")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-173:oni"]);
  });

  it("RK-250: 公式Q&A — 鬼の鎧を先に解決すると鬼の鎧は捨札になり、その後サバイブでユニットは留まる（出典: atwiki/page-1350 Q1「ターンプレイヤーの任意の順番で解決」）", () => {
    const s = resolveAll(pick(bothStacked(), "RK-173:oni"));
    expect(zoneOf(s, "player1", "SPEC-WB-S:w")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-173:oni")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
  });

  // atwiki/page-1350 Q2「はい、そのとおりです。ユニットでなくなるので「RK-250 サバイブ」は捨札になります。」
  for (const id of ["RK-280", "RK-281"]) {
    it.fails(`RK-250: 公式Q&A — サバイブを重ねた ${id} をホールドしてビークルにすると、ユニットでなくなるのでサバイブは捨札になる（出典: atwiki/page-1350 Q2）`, () => {
      const s = settle(act(rushPhase({ rush: [{ ...inst(id, "v"), stackedCards: [inst("RK-250", "sv")] }] }), { type: "activate_field_unit_ability", playerId: "player1", unitInstanceId: `${id}:v` }));
      expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
      expect(zoneOf(s, "player1", `${id}:v`)).toBe("rush");
    });
  }
  it.todo("RK-250: 重ねたユニットが手札・山札に戻る（「ユニットでなくなる」）ときも留まるか（出典: atwiki/page-1350）— エンジンの手札・山札に戻す処理が「ユニットでなくなるとき」の置換を通らない（撃破・パワーゾーン送り・効果の捨札だけ対応）");
});

// ===========================================================================
describe("RK-251 ゴルゴムの仕業", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 相手が通常のオペレーションカードを使用したとき、その効果を実行する前に発動できる。相手の使用したオペレーションカードの必要パワーの数字を見て、その数字以上の枚数のカードが自軍パワーゾーンにあれば、そのオペレーションカードの効果を無効にして、捨札にする。";

  it("RK-251: カタログ本文・スペックが出典と一致（出典: atwiki/page-1377）", () => {
    expectCatalogText("RK-251", TEXT);
    expectOpStats("RK-251", { name: "ゴルゴムの仕業", category: "DA", powerCost: 1 });
    expectRarityIn("RK-251", ["N"]);
  });

  /** 自軍（player1）がラッシュフェイズに RK-083 ストライクベント（WB・必要パワー3）を使う。相手（player2）は RK-251 を持つ。 */
  const vent = (p2Power = 3, p2: Partial<GameState["players"]["player2"]> = {}) =>
    played(
      rushPhase(
        { hand: [inst("RK-083", "sv")], rush: [inst("SPEC-MIRROR3", "mr")], command: releasedCat("WB", 1), power: powerCards(3) },
        { hand: [inst("RK-251", "gg")], command: releasedCat("DA", 1), power: powerCards(p2Power, "ep"), battle: [inst("SPEC-C1", "victim")], ...p2 },
      ),
      "RK-083:sv",
    );

  it("RK-251: 相手が通常のオペレーションを使ったとき、その効果を実行する前に、相手のパワーの枚数がその必要パワーの数字（3）以上なら使うかを選べる（任意）（出典: atwiki/page-1377「相手が通常のオペレーションカードを使用したとき、その効果を実行する前に発動できる」）", () => {
    const s = vent();
    expectChoiceFrom(s, "player2", "RK-251");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-251: 使うと、そのオペレーションの効果は無効になり捨札になる（ストライクベントで撃破されない）。ゴルゴムの仕業も捨札になる（出典: atwiki/page-1377「そのオペレーションカードの効果を無効にして、捨札にする」）", () => {
    const s = resolveAll(accept(vent()));
    expect(zoneOf(s, "player1", "RK-083:sv")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-251:gg")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:victim")).toBe("battle");
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("RK-251: 使わなければ、オペレーションの効果はふつうに実行される（出典: atwiki/page-1377「発動できる」）", () => {
    let s = skip(vent());
    s = resolveAll(s, ["SPEC-MIRROR3:mr", "SPEC-C1:victim"]);
    expect(zoneOf(s, "player2", "SPEC-C1:victim")).toBe("discard");
    expect(zoneOf(s, "player2", "RK-251:gg")).toBe("hand");
  });

  it("RK-251: 自軍パワーゾーンのカードが必要パワーの数字より少なければ（2枚）、無効にできない（使う機会は与えられない）（出典: atwiki/page-1377「その数字以上の枚数のカードが自軍パワーゾーンにあれば」）", () => {
    const s = vent(2);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-251");
  });

  it("RK-251: DA の自軍コマンドがなければ（カウンターのコマンドを支払えなければ）使えない（出典: atwiki/page-1377「※カウンター」・R-CTR）", () => {
    const s = vent(3, { command: releasedCat("WB", 1) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-251");
  });

  // atwiki/page-1377 Q1「はい、その通りです。」（「通常のオペレーション」は「常駐」や「カウンター」等のアイコンの無いオペレーション）
  it("RK-251: 公式Q&A — 相手が常駐オペレーションを使っても使えない（出典: atwiki/page-1377 Q1）", () => {
    const s = played(
      rushPhase({ hand: [inst("RK-249", "adv")], command: releasedCat("WB", 1), power: powerCards(4) }, { hand: [inst("RK-251", "gg")], command: releasedCat("DA", 1), power: powerCards(5, "ep") }),
      "RK-249:adv",
    );
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-251");
    expect(zoneOf(s, "player1", "RK-249:adv")).toBe("operation");
  });

  it.todo(
    "RK-251: 公式Q&A — コマンドゾーンの XG5-010 恐竜剣ゴッドホーン等の「これがコマンドゾーンにある間、…このカードの効果を発動する」はオペレーションカードの使用ではないので無効にできない（出典: atwiki/page-1377 Q3）— XG5-010・XG5-016・XG5-017 のコマンドゾーンの効果が未実装（本範囲外のカード）",
  );
});

// ===========================================================================
describe("RK-252 変身音叉 音角", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒ ◎自分の手札から、「仮面ライダー響鬼」のカードを1枚選び、自軍ラッシュエリアに出してもよい。 ◎敵軍山札の上から1枚をオモテにする。このカードを使用するためにホールドしたコマンドが特徴「ディスクアニマル」を持つなら、自分は1枚ドローする。その後、オモテにしたカードは持ち主の山札の上に戻す。";

  it("RK-252: カタログ本文・スペックが出典と一致（出典: atwiki/page-1339）", () => {
    expectCatalogText("RK-252", TEXT);
    expectOpStats("RK-252", { name: "変身音叉 音角", category: "MA", powerCost: 2 });
    expectRarityIn("RK-252", ["N"]);
  });

  const HAND = [inst("RK-221", "hb"), inst("XG2-063", "hb2"), inst("RK-222", "kurenai")];
  const used = (command: CardInstance[] = releasedCat("MA", 1)) =>
    played(rushPhase({ hand: [inst("RK-252", "ok"), ...HAND], command, power: powerCards(2) }), "RK-252:ok");

  it("RK-252: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: atwiki/page-1339「次の効果から1つ選び発動する」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "RK-252");
    expect(choiceIds(s)).toEqual(["hibiki_rush", "reveal_draw"]);
  });

  it("RK-252: ◎1つ目 — 手札の「仮面ライダー響鬼」のカード（RK-221・XG2-063。響鬼紅は対象外）から1枚選べる（任意）（出典: atwiki/page-1339「自分の手札から、「仮面ライダー響鬼」のカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const s = pick(used(), "hibiki_rush");
    expectChoiceFrom(s, "player1", "RK-252");
    expect(choiceIds(s)).toEqual(["RK-221:hb", "XG2-063:hb2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-252: 選んだ「仮面ライダー響鬼」は自軍ラッシュエリアに出る（必要パワーを満たしていなくてよい）（出典: atwiki/page-1339）", () => {
    const s = resolveAll(pick(pick(used(), "hibiki_rush"), "RK-221:hb"));
    expect(zoneOf(s, "player1", "RK-221:hb")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-252:ok")).toBe("discard");
  });

  it("RK-252: ◎2つ目 — 使うためにホールドしたコマンドが特徴「ディスクアニマル」を持つ（XG5-069 キハダガニ）なら、自分は1枚ドローし、オモテにした敵軍山札の上のカードは山札の上に戻る（出典: atwiki/page-1339「このカードを使用するためにホールドしたコマンドが特徴「ディスクアニマル」を持つなら、自分は1枚ドローする。その後、オモテにしたカードは持ち主の山札の上に戻す」）", () => {
    const s = resolveAll(pick(used([inst("XG5-069", "disk")]), "reveal_draw"));
    expect(cardIn(s, "player1", "XG5-069:disk")?.commandHeld).toBe(true);
    expect(s.players.player1.hand).toHaveLength(4);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e0");
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it("RK-252: ◎2つ目 — ホールドしたコマンドが「ディスクアニマル」を持たなければドローしない（出典: atwiki/page-1339）", () => {
    const s = resolveAll(pick(used(), "reveal_draw"));
    expect(s.players.player1.hand).toHaveLength(3);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:e0");
  });
});
