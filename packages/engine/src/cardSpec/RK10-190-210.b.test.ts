/**
 * カード別スペック: RK-197〜RK-203（ザ・マスクドライダーEXP vol.3 アントロード〜仮面ライダーファイズAF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_*.html）に本範囲のカードの項はない（rider_1〜4・rider.html を検索）。
 *     atwiki に転載された公式 Q&A（RK-203 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-ADD-02 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-203 ※（撃破されて捨札になったとき「仮面ライダーファイズ」を出す）が撃破でないときは働かない — cardSpec/RS5-243-263.b.test.ts RS-252・RS5-243-263.a.test.ts RS-245
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { KW } from "../rulesSpec/07-helpers";
import {
  NOSP_ATTACKER,
  accept,
  act,
  attack,
  attackedInEnemyTurn,
  attackersOf,
  boardOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  deckWithTen,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  fill,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  reanimateTests,
  registerOffered,
  releasedCat,
  resident,
  resolveAll,
  rushed,
  settle,
  skip,
  stackedOn,
  sUnit,
  zordDownTests,
  zoneOf,
} from "./RK10-190-210.helpers";

const MA_S = sUnit("SPEC-MA-S", { category: "MA", bp: 1000, powerCost: 1 });
const MA_M = sUnit("SPEC-MA-M", { category: "MA", bp: 1000, powerCost: 1, size: "M" });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 1000, powerCost: 1, features: ["女"] });
const REIYOU = sUnit("SPEC-REIYOU", { bp: 1000, powerCost: 1, features: ["レイヨウ型"] });
const RESIST1 = sUnit("SPEC-RESIST1", { bp: 1000, powerCost: 1, text: KW.resist } as never);
const E_M = sUnit("SPEC-E-M", { bp: 1000, powerCost: 1, size: "M" });
const WB_S = sUnit("SPEC-WB-S", { category: "WB", bp: 1000, powerCost: 1 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000, powerCost: 1 });
const MA_S2 = sUnit("SPEC-MA-S2", { category: "MA", bp: 1000, powerCost: 1 });
const MADA = sUnit("SPEC-MADA", { category: ["MA", "DA"] as never, bp: 1000, powerCost: 1 });
const RIDER = sUnit("SPEC-RIDER", { category: "ET", bp: 1000, powerCost: 1, comboNumber: "RC" });
const VEHICLE = { id: "SPEC-VEH", name: "SPEC-VEH", type: "vehicle", category: "ET", rarity: "N", expansion: "card-spec", powerCost: 0, size: "S" } as never;
const WEAK = sUnit("SPEC-WEAK", { bp: 500, powerCost: 1, sp: undefined });
const EXTRA = [NOSP_ATTACKER, MA_S, MA_M, FEMALE, REIYOU, RESIST1, E_M, WB_S, DA_S, MA_S2, MADA, RIDER, VEHICLE, WEAK];

/** バトルの反応・離場の反応をパスし、レジストの提示（use_register）で止める。 */
const untilRegister = (s0: GameState) => {
  let s = s0;
  for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) {
    const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
    if (!p) break;
    s = act(s, p);
  }
  return s;
};
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("rush", "player1", p1, p2, EXTRA);
const battlePhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("battle", "player1", p1, p2, EXTRA);
const enemyBattle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => boardOf("battle", "player2", p1, p2, EXTRA);

// ===========================================================================
describe("RK-197 アントロード", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 ※これが自分の手札にある間、自軍ラッシュフェイズ中、MAを持つ敵軍Sユニットがあれば、これを自軍ラッシュエリアに出してもよい。 【女王の僕】これが自軍バトルエリアにある間、特徴「女」を持つユニットは次の能力を得る⇒レジスト (これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい)";

  it("RK-197: カタログ本文・スペックが出典と一致（出典: atwiki/page-921）", () => {
    expectCatalogText("RK-197", TEXT);
    expectStats("RK-197", { name: "アントロード", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 4, features: ["アンノウン", "昆虫"] });
    expectRarityIn("RK-197", ["N"]);
  });

  it("RK-197: ※ デッキに好きな枚数入れられる（出典: atwiki/page-921「※このカードはデッキに好きな枚数入れてもよい」）", () => {
    expect(deckWithTen("RK-197", "アントロード")).toBe(true);
  });

  const selfRush = (s: GameState) => legal(s).some((a) => a.type === "self_rush_from_zone" && a.instanceId === "RK-197:al");

  it("RK-197: ※ 手札にある間、自軍ラッシュフェイズ中、MA を持つ敵軍 S ユニットがあれば自軍ラッシュエリアに出せる（出典: atwiki/page-921「MAを持つ敵軍Sユニットがあれば、これを自軍ラッシュエリアに出してもよい」・カード評価「パワーもコマンドも無視してラッシュできる」）", () => {
    let s = rushPhase({ hand: [inst("RK-197", "al")] }, { rush: [inst("SPEC-MA-S", "ma")] });
    expect(selfRush(s)).toBe(true);
    s = act(s, legal(s).find((a) => a.type === "self_rush_from_zone" && a.instanceId === "RK-197:al")!);
    expect(zoneOf(s, "player1", "RK-197:al")).toBe("rush");
  });

  it("RK-197: ※ MA の敵軍ユニットが M だけ・MA を持たない S だけ・自軍の MA だけなら出せない（出典: atwiki/page-921「MAを持つ敵軍Sユニット」）", () => {
    expect(selfRush(rushPhase({ hand: [inst("RK-197", "al")] }, { battle: [inst("SPEC-MA-M", "m"), inst("TST-UNIT-0", "wb")] }))).toBe(false);
    expect(selfRush(rushPhase({ hand: [inst("RK-197", "al")], rush: [inst("SPEC-MA-S", "mine")] }))).toBe(false);
  });

  it("RK-197: ※ 自軍ラッシュフェイズ以外（バトルフェイズ）には出せない（出典: atwiki/page-921「自軍ラッシュフェイズ中」）", () => {
    expect(selfRush(battlePhase({ hand: [inst("RK-197", "al")] }, { rush: [inst("SPEC-MA-S", "ma")] }))).toBe(false);
  });

  it("RK-197: 【女王の僕】自軍バトルエリアにある間、特徴「女」を持つ自軍ユニットはレジストを得る（出典: atwiki/page-921「特徴「女」を持つユニットは次の能力を得る⇒レジスト」）", () => {
    const s = untilRegister(attack(enemyBattle({ battle: [inst("RK-197", "al"), inst("SPEC-FEMALE", "f")] }, { battle: [inst("TST-UNIT-7", "atk")] }), "TST-UNIT-7:atk", "SPEC-FEMALE:f", "player2"));
    expect(registerOffered(s)).toBe(true);
  });

  it("RK-197: 【女王の僕】敵軍の特徴「女」のユニットもレジストを得る（出典: atwiki/page-921 カード評価「女性ユニットにレジストを付加する効果は敵軍も受けてしまう」・コメント欄）", () => {
    const s = attack(battlePhase({ battle: [inst("RK-197", "al"), inst("TST-UNIT-7", "atk")] }, { battle: [inst("SPEC-FEMALE", "ef")] }), "TST-UNIT-7:atk", "SPEC-FEMALE:ef");
    expect(registerOffered(untilRegister(s), "player2")).toBe(true);
  });

  it("RK-197: 【女王の僕】アントロードがラッシュエリアにあるだけでは得ない（出典: atwiki/page-921「これが自軍バトルエリアにある間」）", () => {
    const s = attack(enemyBattle({ rush: [inst("RK-197", "al")], battle: [inst("SPEC-FEMALE", "f")] }, { battle: [inst("TST-UNIT-7", "atk")] }), "TST-UNIT-7:atk", "SPEC-FEMALE:f", "player2");
    expect(registerOffered(untilRegister(s))).toBe(false);
  });
});

// ===========================================================================
describe("RK-198 仮面ライダーインペラー", () => {
  const TEXT =
    "※これをラッシュしたとき、相手は1枚ドローしてもよい。 ※これは特徴「レイヨウ型」を持つユニットが自軍バトルエリアにあれば敵軍Sユニットにアタックされない。 【ドライブディバイダー】特徴「レイヨウ型」を持つユニットからコンビネーションしたとき発動できる⇒レジストを持たない敵軍Sユニットを、特徴「レイヨウ型」を持つユニットの数まで選びホールドする。";

  it("RK-198: カタログ本文・スペックが出典と一致（出典: atwiki/page-903）", () => {
    expectCatalogText("RK-198", TEXT);
    expectStats("RK-198", { name: "仮面ライダーインペラー", category: "WB", size: "S", bp: 1000, sp: "1/2", powerCost: 2, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-198", ["NR"]);
  });

  const afterRush = () => rushed(rushPhase({ hand: [inst("RK-198", "im")], command: releasedCat("WB", 1), power: powerCards(2) }, { deck: deckCards(5, "e") }), "RK-198:im");

  it("RK-198: ※ ラッシュしたとき、相手は1枚ドローするかを選べる（出典: atwiki/page-903「相手は1枚ドローしてもよい」）", () => {
    const s = afterRush();
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-198");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-198: ※ 相手がドローを選べば相手の手札が1枚増える（出典: atwiki/page-903）", () => {
    const s = settle(accept(afterRush()));
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RK-198: ※ 相手が見送れば手札は増えない（出典: atwiki/page-903「ドローしてもよい」）", () => {
    const s = settle(skip(afterRush()));
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RK-198: ※ 特徴「レイヨウ型」のユニットが自軍バトルエリアにあれば敵軍 S ユニットにアタックされない（M にはアタックされる）（出典: atwiki/page-903「敵軍Sユニットにアタックされない」）", () => {
    const s = enemyBattle({ battle: [inst("SPEC-REIYOU", "r"), inst("RK-198", "im")] }, { battle: [inst("TST-UNIT-0", "s"), inst("TST-UNIT-2", "m")] });
    expect(attackersOf(s, "RK-198:im")).toEqual(["TST-UNIT-2:m"]);
  });

  it("RK-198: ※ 「レイヨウ型」がラッシュエリアにあるだけならアタックされる（出典: atwiki/page-903「自軍バトルエリアにあれば」）", () => {
    const s = enemyBattle({ battle: [inst("RK-198", "im")], rush: [inst("SPEC-REIYOU", "r")] }, { battle: [inst("TST-UNIT-0", "s")] });
    expect(attackersOf(s, "RK-198:im")).toEqual(["TST-UNIT-0:s"]);
  });

  /** 「レイヨウ型」→ インペラーの順にバトルエリアに出す（ラッシュエリアにも「レイヨウ型」を1体置く）。 */
  const combo = (p2: Partial<GameState["players"]["player2"]> = { battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-0", "c"), inst("SPEC-RESIST1", "rs"), inst("SPEC-E-M", "m")] }, partner = "SPEC-REIYOU") => {
    let s = battlePhase({ rush: [inst(partner, "p"), inst("RK-198", "im"), inst("SPEC-REIYOU", "r2")] }, p2);
    s = passEntry(enter(s, `${partner}:p`));
    return enter(s, "RK-198:im");
  };

  it("RK-198: 【ドライブディバイダー】「レイヨウ型」からコンビネーションしたとき発動でき、レジストを持たない敵軍 S ユニットから選ぶ（M は対象外）（出典: atwiki/page-903「レジストを持たない敵軍Sユニットを…選びホールドする」）", () => {
    const s = combo();
    expectChoiceFrom(s, "player1", "RK-198");
    expect(canSkip(s)).toBe(true);
    const t = s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : s;
    expect(choiceIds(t)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c"]);
  });

  it("RK-198: 【ドライブディバイダー】「レイヨウ型」のユニットの数（2）までホールドできる（出典: atwiki/page-903「特徴「レイヨウ型」を持つユニットの数まで選び」）", () => {
    let s = combo();
    if (s.pendingEffectChoice?.kind === "confirm") s = confirm(s);
    s = pick(s, "TST-UNIT-0:a");
    if (s.pendingEffectChoice?.sourceCardId === "RK-198") s = pick(s, "TST-UNIT-0:b");
    if (s.pendingEffectChoice?.sourceCardId === "RK-198" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = settle(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-198");
    expect(cardIn(s, "player2", "TST-UNIT-0:a")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-UNIT-0:b")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-UNIT-0:c")?.commandHeld ?? false).toBe(false);
  });

  it("RK-198: 【ドライブディバイダー】「レイヨウ型」でないユニットからのコンビネーションでは発動しない（出典: atwiki/page-903「特徴「レイヨウ型」を持つユニットからコンビネーションしたとき」）", () => {
    const s = combo(undefined, "TST-UNIT-0");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-198");
  });

  it.todo(
    "RK-198: 【ドライブディバイダー】の「特徴「レイヨウ型」を持つユニットの数」に敵軍の「レイヨウ型」を含むか（出典: atwiki/page-903）— 本文に「自軍」の限定がなく、atwiki に回答がない（エンジンは自軍・敵軍の場のユニットを数える）",
  );
});

// ===========================================================================
describe("RK-199 オメガゼール", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ゼール種の統率】これが自軍エリアにある間、次の効果を発動する⇒「オメガゼール」以外の特徴「レイヨウ型」を持つ自軍ユニットは「これはコマンドを1つホールドしなければバトルエリアに出られない」と書かれていても、そのテキストは無効になる。また相手は特徴「レイヨウ型」を持つユニットを撃破したとき、1枚ドローしてもよい。";

  it("RK-199: カタログ本文・スペックが出典と一致（出典: atwiki/page-922）", () => {
    expectCatalogText("RK-199", TEXT);
    expectStats("RK-199", { name: "オメガゼール", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 3, features: ["ミラーモンスター", "獣", "レイヨウ型"] });
    expectRarityIn("RK-199", ["N"]);
  });

  it("RK-199: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-922「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-199", "om")] }), "RK-199:om")).toBe(false);
    const s = enterHold(battlePhase({ rush: [inst("RK-199", "om")], command: releasedCat("WB", 1) }), "RK-199:om");
    expect(zoneOf(s, "player1", "RK-199:om")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RK-199: 【ゼール種の統率】自軍エリアにある間、「レイヨウ型」の自軍ユニット（マガゼール）はコマンドをホールドせずにバトルエリアに出られる（出典: atwiki/page-922「そのテキストは無効になる」）", () => {
    const s = battlePhase({ rush: [inst("RK-199", "om"), inst("RK-200", "mg")] });
    expect(canEnter(s, "RK-200:mg")).toBe(true);
    expect(zoneOf(enter(s, "RK-200:mg"), "player1", "RK-200:mg")).toBe("battle");
  });

  it("RK-199: 【ゼール種の統率】「オメガゼール」自身（2体目のオメガゼールも）は無効にならない（出典: atwiki/page-922「「オメガゼール」以外の」）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-199", "om"), inst("RK-199", "om2")] }), "RK-199:om2")).toBe(false);
  });

  it("RK-199: 【ゼール種の統率】敵軍のオメガゼールでは無効にならない（出典: atwiki/page-922「特徴「レイヨウ型」を持つ自軍ユニットは」）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-200", "mg")] }, { rush: [inst("RK-199", "eom")] }), "RK-200:mg")).toBe(false);
  });

  it("RK-199: 【ゼール種の統率】相手が「レイヨウ型」のユニットを撃破したとき、相手は1枚ドローするかを選べる（出典: atwiki/page-922「相手は特徴「レイヨウ型」を持つユニットを撃破したとき、1枚ドローしてもよい」）", () => {
    let s = attackedInEnemyTurn({ rush: [inst("RK-199", "om")], battle: [inst("RK-200", "mg")] }, "RK-200:mg");
    for (let i = 0; i < 3 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== "RK-199"; i++) s = settle(skip(s));
    expect(zoneOf(s, "player1", "RK-200:mg")).toBe("discard");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-199");
    const hand = s.players.player2.hand.length;
    s = settle(accept(s));
    expect(s.players.player2.hand).toHaveLength(hand + 1);
  });

  it("RK-199: 【ゼール種の統率】「レイヨウ型」でないユニットが撃破されても相手はドローしない（出典: atwiki/page-922）", () => {
    const s = attackedInEnemyTurn({ rush: [inst("RK-199", "om")], battle: [inst("TST-UNIT-0", "u")] }, "TST-UNIT-0:u");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-199");
  });
});

// ===========================================================================
describe("RK-200 マガゼール", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※このカードはデッキに好きな枚数入れてもよい。 【群れの襲撃】自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを、特徴「レイヨウ型」を持つ自軍ユニットの数まで選んでもよい。そうしたとき、選んだユニットをライドオフさせる。";

  it("RK-200: カタログ本文・スペックが出典と一致（出典: atwiki/page-923）", () => {
    expectCatalogText("RK-200", TEXT);
    expectStats("RK-200", { name: "マガゼール", category: "WB", size: "S", bp: 500, sp: "1/2", powerCost: 2, features: ["ミラーモンスター", "獣", "レイヨウ型"] });
    expectRarityIn("RK-200", ["N"]);
  });

  it("RK-200: ※ デッキに好きな枚数入れられる（出典: atwiki/page-923）", () => {
    expect(deckWithTen("RK-200", "マガゼール")).toBe(true);
  });

  it("RK-200: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-923）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-200", "mg")] }), "RK-200:mg")).toBe(false);
    expect(canEnter(battlePhase({ rush: [inst("RK-200", "mg")], command: releasedCat("WB", 1) }), "RK-200:mg")).toBe(true);
  });

  const riders = {
    battle: [inst("SPEC-VEH", "v1"), { ...inst("SPEC-RIDER", "r1"), mountedOnInstanceId: "SPEC-VEH:v1" }, inst("SPEC-VEH", "v2"), { ...inst("SPEC-RIDER", "r2"), mountedOnInstanceId: "SPEC-VEH:v2" }, inst("SPEC-RIDER", "free")],
  };
  /** マガゼールを（コマンドをホールドして）バトルエリアに出す。reiyou は自軍ラッシュエリアに置く「レイヨウ型」の数。 */
  const entered = (reiyou: number, p2: Partial<GameState["players"]["player2"]> = riders) =>
    enterHold(battlePhase({ rush: [inst("RK-200", "mg"), ...Array.from({ length: reiyou }, (_, i) => inst("SPEC-REIYOU", `r${i}`))], command: releasedCat("WB", 1) }, p2), "RK-200:mg");

  it("RK-200: 【群れの襲撃】自軍ターン中、バトルエリアに出たとき、ライド中の敵軍 S ユニットから選べる（任意）（出典: atwiki/page-923「ライド中の敵軍Sユニットを…選んでもよい」）", () => {
    const s = entered(1);
    expectChoiceFrom(s, "player1", "RK-200");
    expect(choiceIds(s)).toEqual(["SPEC-RIDER:r1", "SPEC-RIDER:r2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-200: 【群れの襲撃】「レイヨウ型」の自軍ユニットの数（マガゼール自身を含めて2）まで選び、ライドオフさせる（出典: atwiki/page-923「特徴「レイヨウ型」を持つ自軍ユニットの数まで選んでもよい。そうしたとき、選んだユニットをライドオフさせる」）", () => {
    let s = pick(entered(1), "SPEC-RIDER:r1");
    if (s.pendingEffectChoice?.sourceCardId === "RK-200") s = pick(s, "SPEC-RIDER:r2");
    s = settle(s);
    expect(cardIn(s, "player2", "SPEC-RIDER:r1")?.mountedOnInstanceId).toBeUndefined();
    expect(cardIn(s, "player2", "SPEC-RIDER:r2")?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-VEH:v1")).toBe("battle");
  });

  it("RK-200: 【群れの襲撃】「レイヨウ型」がマガゼールだけなら1体まで（出典: atwiki/page-923）", () => {
    let s = pick(entered(0), "SPEC-RIDER:r1");
    if (s.pendingEffectChoice?.sourceCardId === "RK-200" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = settle(s);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-200");
    expect(cardIn(s, "player2", "SPEC-RIDER:r1")?.mountedOnInstanceId).toBeUndefined();
    expect(cardIn(s, "player2", "SPEC-RIDER:r2")?.mountedOnInstanceId).toBe("SPEC-VEH:v2");
  });
});

// ===========================================================================
describe("RK-201 ドラグブラッカー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ドラグブレス】これをラッシュしたとき、次の効果を、相手、自分の順に行う⇒自分自身のユニットを1体選ぶ。そして、自分自身の選んだユニットの持っていないカテゴリを持つ自分自身のSユニットを1体選び撃破する。";

  it("RK-201: カタログ本文・スペックが出典と一致（出典: atwiki/page-924）", () => {
    expectCatalogText("RK-201", TEXT);
    expectStats("RK-201", { name: "ドラグブラッカー", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["ミラーモンスター", "獣", "ドラゴン"] });
    expectRarityIn("RK-201", ["N"]);
  });

  it("RK-201: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-924）", () => {
    expect(canEnter(battlePhase({ rush: [inst("RK-201", "db")] }), "RK-201:db")).toBe(false);
  });

  const afterRush = (p2: Partial<GameState["players"]["player2"]> = { battle: [inst("SPEC-WB-S", "ew"), inst("SPEC-DA-S", "ed")] }, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushed(rushPhase({ hand: [inst("RK-201", "db")], command: releasedCat("WB", 1), power: powerCards(2), ...p1 }, p2), "RK-201:db");

  it("RK-201: 【ドラグブレス】ラッシュしたとき、まず相手が自分のユニットを1体選ぶ（出典: atwiki/page-924「相手、自分の順に行う⇒自分自身のユニットを1体選ぶ」）", () => {
    const s = afterRush();
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-201");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:ed", "SPEC-WB-S:ew"]);
  });

  it("RK-201: 相手は選んだユニットの持っていないカテゴリを持つ自分の S ユニットを1体選び撃破する（出典: atwiki/page-924「自分自身の選んだユニットの持っていないカテゴリを持つ自分自身のSユニットを1体選び撃破する」）", () => {
    let s = pick(afterRush(), "SPEC-WB-S:ew");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-DA-S:ed"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "SPEC-DA-S:ed");
    expect(zoneOf(s, "player2", "SPEC-DA-S:ed")).toBe("discard");
  });

  it("RK-201: 相手の後に自分も同じように行う（単色なら撃破するユニットはない）（出典: atwiki/page-924「相手、自分の順に」・カード評価「単色ならこちらはなにも撃破せずに」）", () => {
    let s = pick(pick(afterRush(), "SPEC-WB-S:ew"), "SPEC-DA-S:ed");
    expectChoiceFrom(s, "player1", "RK-201");
    expect(choiceIds(s)).toEqual(["RK-201:db"]);
    s = resolveAll(pick(s, "RK-201:db"));
    expect(zoneOf(s, "player1", "RK-201:db")).toBe("rush");
  });

  it("RK-201: マルチカテゴリのユニットを選べば、そのどのカテゴリも持たないユニットだけを撃破する（出典: atwiki/page-924 コメント欄「MA+DAのユニットを選べばMAもDAも持た無いユニットのみ撃破」「↑ＯＫ」）", () => {
    const s = pick(afterRush({ battle: [inst("SPEC-MADA", "md"), inst("SPEC-MA-S2", "ma"), inst("SPEC-DA-S", "da"), inst("SPEC-WB-S", "wb")] }), "SPEC-MADA:md");
    expect(choiceIds(s)).toEqual(["SPEC-WB-S:wb"]);
  });

  it.todo(
    "RK-201: 選んだユニットが MA+DA のとき、WB+MA のユニット（MA を持つが、選んだユニットの持たない WB も持つ）を撃破できるか（出典: atwiki/page-924 コメント欄「MAもDAも持た無いユニットのみ撃破」）— コメント欄の回答は本文「持っていないカテゴリを持つ」と食い違って読め、公式の回答がない（エンジンは本文どおり撃破できる）",
  );

  it("RK-201: 撃破できるユニットがなければ撃破しない（単色の相手）（出典: atwiki/page-924）", () => {
    let s = pick(afterRush({ battle: [inst("SPEC-WB-S", "a"), inst("SPEC-WB-S", "b")] }), "SPEC-WB-S:a");
    expect(s.pendingEffectChoice?.playerId).not.toBe("player2");
    s = resolveAll(s, ["RK-201:db"]);
    expect(zoneOf(s, "player2", "SPEC-WB-S:b")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-202 仮面ライダー王蛇ブランク体", () => {
  it("RK-202: スペックが出典と一致（テキストなし）（出典: atwiki/page-925「テキスト：なし」）", () => {
    expectStats("RK-202", { name: "仮面ライダー王蛇ブランク体", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 0, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-202", ["N"]);
  });

  it("RK-202: 必要パワー0 — パワーがなくてもラッシュできる（出典: atwiki/page-925「必要パワー：0」）", () => {
    const s = settle(rushed(rushPhase({ hand: [inst("RK-202", "ob")], command: releasedCat("WB", 1), power: [] }), "RK-202:ob"));
    expect(zoneOf(s, "player1", "RK-202:ob")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-203 仮面ライダーファイズAF", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーファイズ」のカードを1枚選び、自軍ラッシュエリアに出す。 【アクセルモード】自軍ターン中、これがアタックしてバトルに勝ったとき、常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、山札の下に戻してもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、これをラッシュエリアに戻す。";

  it("RK-203: カタログ本文・スペックが出典と一致（出典: atwiki/page-873）", () => {
    expectCatalogText("RK-203", TEXT);
    expectStats("RK-203", { name: "仮面ライダーファイズAF", category: "ET", size: "S", bp: 4500, sp: 1, powerCost: "7-", features: ["仮面ライダー", "男", "加速", "アクセルフォーム"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-203", ["SR"]);
  });

  zordDownTests("RK-203", "RK-064", "仮面ライダーファイズ", "atwiki/page-873", "ET");
  reanimateTests("RK-203", "RK-064", "仮面ライダーファイズ", "atwiki/page-873");

  const STACK = [faceDown("TST-OP", "s0"), faceDown("TST-OP", "s1")];
  const won = (p1: Partial<GameState["players"]["player1"]> = { operation: [resident("RK-021", "cu", STACK)] }, defender = "SPEC-WEAK:d") => {
    const s = battlePhase({ battle: [inst("RK-203", "af")], deck: deckCards(3), ...p1 }, { battle: [inst(defender.split(":")[0]!, defender.split(":")[1]!)] });
    return settle(attack(s, "RK-203:af", defender));
  };

  it("RK-203: 【アクセルモード】自軍ターン中、アタックしてバトルに勝ったとき、常駐オペレーションに重ねたカード（ウラ向きのまま）から1枚選べる（任意）（出典: atwiki/page-873「常駐している自軍オペレーションに重ねたカードがあれば、その中から1枚選び、山札の下に戻してもよい（ウラ向きのカードはウラ向きのまま選ぶ）」）", () => {
    const s = won();
    expect(zoneOf(s, "player2", "SPEC-WEAK:d")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-203");
    expect(choiceIds(s)).toEqual(["TST-OP:s0", "TST-OP:s1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-203: 【アクセルモード】選んだカードは山札の下に戻り、ファイズAF はラッシュエリアに戻る（出典: atwiki/page-873「そうしたとき、これをラッシュエリアに戻す」）", () => {
    const s = settle(pick(won(), "TST-OP:s1"));
    expect(stackedOn(s, "player1", "RK-021:cu")).toEqual(["TST-OP:s0"]);
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("TST-OP:s1");
    expect(zoneOf(s, "player1", "RK-203:af")).toBe("rush");
  });

  it("RK-203: 【アクセルモード】戻さなければバトルエリアに残る（出典: atwiki/page-873「戻してもよい」）", () => {
    let s = won();
    if (s.pendingEffectChoice?.sourceCardId === "RK-203") s = skip(s);
    s = settle(s);
    expect(zoneOf(s, "player1", "RK-203:af")).toBe("battle");
    expect(stackedOn(s, "player1", "RK-021:cu")).toHaveLength(2);
  });

  it("RK-203: 【アクセルモード】重ねたカードがなければ何も起きない（出典: atwiki/page-873「重ねたカードがあれば」）", () => {
    const s = won({ operation: [resident("RK-021", "cu", [])] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-203");
    expect(zoneOf(s, "player1", "RK-203:af")).toBe("battle");
  });

  it("RK-203: 【アクセルモード】バトルに勝たなければ（相手が残れば）何も起きない（出典: atwiki/page-873「バトルに勝ったとき」）", () => {
    const s = won(undefined, "TST-UNIT-7:big");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-203");
  });

  // atwiki/page-873 Q1・page-1365 Q1（RK-312 仮面ライダーキバDF の効果でファイズAF が撃破され、捨札からラッシュされたファイズと自軍のモーフで置き換えた
  // ユニットは、元のユニットがアタック・ストライクしていなければアタック・ストライクできる）は RK15-295-315.c の RK-312 の it.todo に移した（RK-316 が必要）。
});
