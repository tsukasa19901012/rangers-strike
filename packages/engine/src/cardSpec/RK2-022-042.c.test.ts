/**
 * カード別スペック: RK-036〜RK-042（ザ・マスクドライダーEXP vol.1 ライア〜ブランウイング）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-036・RK-037・RK-042 の Q&A、
 *     RK-008 の相互参照 Q）、grnrngr/faq-card-5（card_5.html。RS-305 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06、R-ADD-07、R-CN-05、R-CTR-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル」を N として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-038 の分数 SP（1/2）のストライク位置 — rulesSpec/05-bp-strike-damage.test.ts
 *  - RK-040「ホールドしなければ出られない」を相手にホールドさせて出す — rulesSpec/07-perm-tag-other.test.ts R-KW-WRECKER-01
 */
import { describe, expect, it } from "vitest";
import type { GameState, PlayerId } from "../types/game";
import {
  act,
  attack,
  attackersOf,
  calm,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enter,
  enterHold,
  expectCatalogText,
  expectRarityIn,
  expectStats,
  held,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  rcUnit,
  releasedCat,
  resolveAll,
  ridingPair,
  rushFromHand,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK2-022-042.helpers";

const MIRROR = sUnit("SPEC-MIRROR", { category: "WB", bp: 2000, features: ["仮面ライダー", "ミラーライダー"] });
const MIRROR_M = sUnit("SPEC-MIRROR-M", { category: "WB", size: "M", bp: 2000, features: ["ミラーライダー"] });
const MALE = sUnit("SPEC-MALE", { bp: 2000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 2000, features: ["女"] });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E2500 = sUnit("SPEC-E2500", { bp: 2500 });
const EM_SP = sUnit("SPEC-EM-SP", { bp: 2000, size: "M", sp: 1 });
const COST2M = sUnit("SPEC-COST2M", { bp: 3000, size: "M", powerCost: 2 });
const COST3 = sUnit("SPEC-COST3", { bp: 3000, powerCost: 3 });
const COST5P = sUnit("SPEC-COST5P", { bp: 3000, powerCost: "5+" });
const RC = rcUnit("SPEC-RC", { bp: 1500 });
const EXTRA = [MIRROR, MIRROR_M, MALE, FEMALE, E2000, E2500, EM_SP, COST2M, COST3, COST5P, RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-036 仮面ライダーライア", () => {
  const TEXT =
    "【運命への反抗】これが自軍バトルエリアにある間、自分は自軍コマンドをホールドせずにカウンターのオペレーションを使用できる。ただし、使用するオペレーションと同じカテゴリのカードを自軍コマンドゾーンから1枚選び、捨札にしなければ使用できない。";

  it("RK-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-181）", () => {
    expectCatalogText("RK-036", TEXT);
    expectStats("RK-036", {
      name: "仮面ライダーライア",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "1/2",
      powerCost: 3,
      features: ["仮面ライダー", "男", "ミラーライダー"],
    });
    expectRarityIn("RK-036", ["N"]);
  });

  /** 敵軍（player2）ターン、BP2500 の S ユニットが自軍 TST-UNIT-0 にアタックする（自軍はギギの腕輪〈RK-004 WB カウンター・必要パワー3〉を持つ）。 */
  const attacked = (p1: Partial<GameState["players"]["player1"]>) =>
    attack(
      enemyTurn(
        { hand: [inst("RK-004", "g")], power: powerCards(3), ...p1, battle: [inst("TST-UNIT-0", "d"), ...(p1.battle ?? [])] },
        { battle: [inst("SPEC-E2500", "a")] },
      ),
      "SPEC-E2500:a",
      "TST-UNIT-0:d",
      "player2",
    );
  const canCounter = (s: GameState) =>
    legal(s).some(
      (a) =>
        a.playerId === "player1" &&
        ((a.type === "initiate_command_payment" && a.sourceInstanceId === "RK-004:g") || (a.type === "play_counter" && a.instanceId === "RK-004:g")),
    );
  const useCounter = (s: GameState) => {
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "RK-004:g");
    let next = pay ? act(s, pay) : s;
    const play = legal(next).find((a) => a.type === "play_counter" && a.instanceId === "RK-004:g");
    if (play) next = act(next, play);
    return next;
  };

  it("RK-036: 【運命への反抗】自軍バトルエリアにある間、自軍コマンドがすべてホールド状態でもカウンターを使える（出典: atwiki/page-181「自軍コマンドをホールドせずにカウンターのオペレーションを使用できる」・grnrngr/faq-card-5 RS-305 Q「「RK-036 仮面ライダーライア」などの効果により、自軍コマンドがすべてホールドされていてもカウンターを発動できる」）", () => {
    expect(canCounter(attacked({ battle: [inst("RK-036", "l")], command: [held("TST-OP", "h0")] }))).toBe(true);
  });

  it("RK-036: 【運命への反抗】使うときは、同じカテゴリ（WB）のカードを自軍コマンドゾーンから1枚捨札にする（ホールドはしない）（出典: atwiki/page-181「使用するオペレーションと同じカテゴリのカードを自軍コマンドゾーンから1枚選び、捨札にしなければ使用できない」）", () => {
    let s = attacked({ battle: [inst("RK-036", "l")], command: [held("TST-OP", "h0")] });
    s = resolveAll(useCounter(s), ["TST-OP:h0"]);
    expect(zoneOf(s, "player1", "TST-OP:h0")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-004:g")).toBe("discard");
    // ギギの腕輪の効果（BP+2000）で BP1000 のユニットが BP2500 に勝つ。
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E2500:a")).toBe("discard");
  });

  it("RK-036: 同じカテゴリのカードが自軍コマンドゾーンになければ、ホールドせずには使えない（出典: atwiki/page-181「ただし、…捨札にしなければ使用できない」）", () => {
    expect(canCounter(attacked({ battle: [inst("RK-036", "l")], command: [held("TST-OP-ET", "h0")] }))).toBe(false);
  });

  it("RK-036: ライアがいなければ、コマンドがすべてホールド状態のときカウンターは使えない（出典: R-CTR-01・atwiki/page-181「これが自軍バトルエリアにある間」）", () => {
    expect(canCounter(attacked({ command: [held("TST-OP", "h0")] }))).toBe(false);
  });

  it("RK-036: ライアがラッシュエリアにあるときは効かない（出典: atwiki/page-181「これが自軍バトルエリアにある間」）", () => {
    expect(canCounter(attacked({ rush: [inst("RK-036", "l")], command: [held("TST-OP", "h0")] }))).toBe(false);
  });

  it.todo(
    "RK-036: 公式Q&A — 天空勇者マジシャイン（RS-325）でコマンドゾーンのカウンターを発動するときは、そのカウンター自身のホールドは省けない（出典: grnrngr/faq-rider-1 RK-036 Q1・atwiki/page-181 Q1）— RS-325【天空の剣】でコマンドゾーンのカウンターを使う経路がエンジンにない",
  );
  it.todo(
    "RK-036: 公式Q&A（相互参照）— ゴーゴーファイヤー（RS-238）がある状態でライアの効果でメカニック忍者（RK-008）を使うと、ライアで捨札にしたとき・メカニック忍者で出したときの2回【プロジェットカノン】を発動できる（出典: grnrngr/faq-rider-1 RK-008 Q）— メカニック忍者（RK-008）は照合済みだが、その処理の途中に RS-238【プロジェットカノン】を割り込ませる順番を公開 API で組めていない（cardSpec/RS4-222-242.c.test.ts の it.todo と同じ）",
  );
});

// ===========================================================================
describe("RK-037 エビルダイバー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【グライディング】このユニットと隣り合う特徴「ミラーライダー」を持つSユニットは、敵軍ユニットにアタックされない。";

  it("RK-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-182）", () => {
    expectCatalogText("RK-037", TEXT);
    expectStats("RK-037", {
      name: "エビルダイバー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "1/2",
      powerCost: 3,
      features: ["ミラーモンスター", "獣"],
    });
    expectRarityIn("RK-037", ["N"]);
  });

  it("RK-037: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-182・R-ADD-07）", () => {
    expect(canEnter(board({ battle: [inst("TST-UNIT-0", "x")], rush: [inst("RK-037", "e")], command: [held("TST-OP", "h")] }), "RK-037:e")).toBe(false);
    const s = calm(enterHold(board({ rush: [inst("RK-037", "e")], command: releasedCat("WB", 1) }), "RK-037:e"));
    expect(zoneOf(s, "player1", "RK-037:e")).toBe("battle");
  });

  it("RK-037: 【グライディング】隣り合う「ミラーライダー」の S ユニットは敵軍ユニット（S・M とも）にアタックされない（出典: atwiki/page-182）", () => {
    const s = enemyTurn(
      { battle: [inst("SPEC-MIRROR", "m"), inst("RK-037", "e")] },
      { battle: [inst("SPEC-E2000", "a"), inst("SPEC-EM-SP", "b")] },
    );
    expect(attackersOf(s, "SPEC-MIRROR:m")).toEqual([]);
    expect(attackersOf(s, "RK-037:e")).toEqual(["SPEC-E2000:a", "SPEC-EM-SP:b"]);
  });

  it("RK-037: 【グライディング】隣り合っていない「ミラーライダー」・隣り合う「ミラーライダー」以外・M ユニットはアタックされる（出典: atwiki/page-182「このユニットと隣り合う特徴「ミラーライダー」を持つSユニット」）", () => {
    const s = enemyTurn(
      { battle: [inst("SPEC-MIRROR", "far"), inst("TST-UNIT-0", "x"), inst("RK-037", "e"), inst("SPEC-MIRROR-M", "mm")] },
      { battle: [inst("SPEC-E2000", "a")] },
    );
    expect(attackersOf(s, "SPEC-MIRROR:far")).toEqual(["SPEC-E2000:a"]);
    expect(attackersOf(s, "TST-UNIT-0:x")).toEqual(["SPEC-E2000:a"]);
    expect(attackersOf(s, "SPEC-MIRROR-M:mm")).toEqual(["SPEC-E2000:a"]);
  });

  // 公式 Q1「いいえ、発動しません。…ラッシュエリアではユニットの並び順を参照することはありません。」
  it("RK-037: 公式Q&A — ラッシュエリアにあるときは隣り合うユニットがなく、効果は発動しない（出典: grnrngr/faq-rider-1 RK-037 Q1・atwiki/page-182 Q1）", () => {
    const s = enemyTurn({ battle: [inst("SPEC-MIRROR", "m")], rush: [inst("RK-037", "e")] }, { battle: [inst("SPEC-E2000", "a")] });
    expect(attackersOf(s, "SPEC-MIRROR:m")).toEqual(["SPEC-E2000:a"]);
  });
});

// ===========================================================================
describe("RK-038 仮面ライダーガイ", () => {
  const TEXT =
    "【ヘビープレッシャー】「メタルゲラス」からコンビネーションしたとき発動できる⇒敵軍ユニットを1体選び撃破してもよい。ただし、必要パワーの数字が敵軍ダメージの点数以下のユニットしか選べない。";

  it("RK-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-51）", () => {
    expectCatalogText("RK-038", TEXT);
    expectStats("RK-038", {
      name: "仮面ライダーガイ",
      category: "WB",
      size: "S",
      bp: 2000,
      sp: "1/2",
      powerCost: 2,
      features: ["仮面ライダー", "男", "ミラーライダー"],
    });
    expectRarityIn("RK-038", ["N"]);
  });

  /** メタルゲラスの次にガイを出す（敵軍ダメージ dmg 点）。 */
  const pressure = (p2: Partial<GameState["players"]["player2"]>, dmg = 2, before = [inst("RK-039", "mg")]) =>
    enter(board({ battle: before, rush: [inst("RK-038", "g")] }, { damage: dmg, power: damageCards(dmg, "ed"), ...p2 }), "RK-038:g");

  it("RK-038: 【ヘビープレッシャー】「メタルゲラス」の次に出たとき、必要パワーの数字が敵軍ダメージ（2点）以下の敵軍ユニットを選べる（サイズ・エリアを問わない。任意）（出典: atwiki/page-51・カード評価「サイズ無視、エリア制限なし」）", () => {
    const s = pressure({ battle: [inst("TST-UNIT-0", "c0"), inst("SPEC-COST3", "c3")], rush: [inst("SPEC-COST2M", "c2")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-038");
    expect(choiceIds(s)).toEqual(["SPEC-COST2M:c2", "TST-UNIT-0:c0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-038: 選んだユニットを撃破する（出典: atwiki/page-51「敵軍ユニットを1体選び撃破してもよい」）", () => {
    const s = resolveAll(pick(pressure({ rush: [inst("SPEC-COST2M", "c2")] }), "SPEC-COST2M:c2"));
    expect(zoneOf(s, "player2", "SPEC-COST2M:c2")).toBe("discard");
  });

  it("RK-038: 撃破しないことを選べる（出典: atwiki/page-51「撃破してもよい」）", () => {
    const s = settle(skip(pressure({ rush: [inst("SPEC-COST2M", "c2")] })));
    expect(zoneOf(s, "player2", "SPEC-COST2M:c2")).toBe("rush");
  });

  it("RK-038: 必要パワー「5+」は数字 5 で比べる（敵軍ダメージ5点なら選べ、4点なら選べない）（出典: atwiki/page-51「必要パワーの数字が」）", () => {
    expect(choiceIds(pressure({ battle: [inst("SPEC-COST5P", "c")] }, 5))).toEqual(["SPEC-COST5P:c"]);
    const s = settle(pressure({ battle: [inst("SPEC-COST5P", "c")] }, 4));
    expect(choiceIds(s)).not.toContain("SPEC-COST5P:c");
  });

  it("RK-038: 「メタルゲラス」以外のユニットの次に出たときは発動しない（出典: atwiki/page-51「「メタルゲラス」からコンビネーションしたとき」・R-CN-05）", () => {
    const s = settle(pressure({ rush: [inst("SPEC-COST2M", "c2")] }, 2, [inst("RK-039", "mg"), inst("TST-UNIT-0", "x")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-038");
    expect(zoneOf(s, "player2", "SPEC-COST2M:c2")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-039 メタルゲラス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【突進】自軍ターン中、これがバトルエリアに出たとき、ライド中の敵軍Sユニットを１体選び、ライドオフさせる。";

  it("RK-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-183）", () => {
    expectCatalogText("RK-039", TEXT);
    expectStats("RK-039", {
      name: "メタルゲラス",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 1,
      features: ["ミラーモンスター", "獣"],
    });
    expectRarityIn("RK-039", ["N"]);
  });

  it("RK-039: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-183・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-039", "mg")], command: [held("TST-OP", "h")] }), "RK-039:mg")).toBe(false);
  });

  const charge = (p2: Partial<GameState["players"]["player2"]>) =>
    enterHold(board({ rush: [inst("RK-039", "mg")], command: releasedCat("WB", 1) }, p2), "RK-039:mg");

  it("RK-039: 【突進】出たとき、ライド中の敵軍 S ユニットを選ぶ（ライドしていないユニットは選べない・見送れない）（出典: atwiki/page-183「ライド中の敵軍Sユニットを１体選び」）", () => {
    const s = charge({ battle: [...ridingPair("SPEC-RC", "r", "RK-058", "v"), inst("SPEC-E2000", "x")], rush: ridingPair("SPEC-RC", "r2", "RK-030", "v2") });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-039");
    expect(choiceIds(s)).toEqual(["SPEC-RC:r", "SPEC-RC:r2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-039: 【突進】選んだユニットはライドオフし、ビークルはそのエリアに残る（出典: atwiki/page-183「ライドオフさせる」）", () => {
    const s = settle(pick(charge({ battle: ridingPair("SPEC-RC", "r", "RK-058", "v") }), "SPEC-RC:r"));
    expect(cardIn(s, "player2", "SPEC-RC:r")?.mountedOnInstanceId).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-RC:r")).toBe("battle");
    expect(zoneOf(s, "player2", "RK-058:v")).toBe("battle");
  });

  it("RK-039: 【突進】ライド中の敵軍ユニットがいなければ何もしない（出典: atwiki/page-183）", () => {
    const s = settle(charge({ battle: [inst("SPEC-E2000", "x")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-039");
    expect(zoneOf(s, "player1", "RK-039:mg")).toBe("battle");
  });

  it.todo(
    "RK-039: 【突進】でライドオフさせた敵軍ユニットの RC は発動するか／並び順はどうなるか（出典: atwiki/page-183「ライドオフさせる」）— 効果によるライドオフで RC が発動するか、ライドオフ後の並び順を定めた出典がないため",
  );
});

// ===========================================================================
describe("RK-040 ベノスネーカー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【毒液】敵軍ターン中、これとバトルしたユニットは、特徴「男」または「女」を持つとき、バトルに勝っても撃破される。";

  it("RK-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-184）", () => {
    expectCatalogText("RK-040", TEXT);
    expectStats("RK-040", {
      name: "ベノスネーカー",
      category: "WB",
      size: "S",
      bp: 1000,
      sp: "1/2",
      powerCost: 3,
      features: ["ミラーモンスター", "獣"],
    });
    expectRarityIn("RK-040", ["N"]);
  });

  const bitten = (attacker: string) =>
    resolveAll(attack(enemyTurn({ battle: [inst("RK-040", "v")] }, { battle: [inst(attacker.split(":")[0]!, attacker.split(":")[1]!)] }), attacker, "RK-040:v", "player2"));

  it("RK-040: 【毒液】敵軍ターン中、これとバトルした特徴「男」のユニットは、バトルに勝っても撃破される（出典: atwiki/page-184）", () => {
    const s = bitten("SPEC-MALE:a");
    expect(zoneOf(s, "player1", "RK-040:v")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MALE:a")).toBe("discard");
  });

  it("RK-040: 【毒液】特徴「女」のユニットも撃破される（出典: atwiki/page-184「特徴「男」または「女」を持つとき」）", () => {
    expect(zoneOf(bitten("SPEC-FEMALE:a"), "player2", "SPEC-FEMALE:a")).toBe("discard");
  });

  it("RK-040: 【毒液】「男」「女」を持たないユニットはバトルに勝てば残る（出典: atwiki/page-184）", () => {
    const s = bitten("SPEC-E2000:a");
    expect(zoneOf(s, "player1", "RK-040:v")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:a")).toBe("battle");
  });

  it("RK-040: 【毒液】自軍ターン中のバトルでは効かない（出典: atwiki/page-184「敵軍ターン中、」）", () => {
    const s = resolveAll(attack(board({ battle: [inst("RK-040", "v")] }, { battle: [inst("SPEC-MALE", "a")] }), "RK-040:v", "SPEC-MALE:a"));
    expect(zoneOf(s, "player1", "RK-040:v")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-MALE:a")).toBe("battle");
  });

  it.todo(
    "RK-040: 【毒液】による撃破はレジストで防げない（出典: atwiki/page-184 カード評価「ベノスネーカーの能力はレジストでも防げない事が公式からの回答で判明」）— 公式回答そのものが取得できる公式FAQ・atwiki Q&A に見当たらず（rider_1.html に RK-040 の項なし）、カード評価の伝聞だけのため",
  );
});

// ===========================================================================
describe("RK-041 ジェノサイダー", () => {
  const TEXT = "合体―ベノスネーカー＋メタルゲラス＋エビルダイバー 【ドゥームズデイ】これが自軍バトルエリアにある間、敵軍Sユニットはストライクしてダメージを与えたとき撃破される。";

  it("RK-041: カタログ本文・スペックが出典と一致（出典: atwiki/page-185）", () => {
    expectCatalogText("RK-041", TEXT);
    expectStats("RK-041", {
      name: "ジェノサイダー",
      category: "WB",
      size: "S",
      bp: 9000,
      sp: 1,
      powerCost: "5+",
      features: ["ミラーモンスター", "獣"],
      rushCondition: "discard_fusion_unit",
    });
    expectRarityIn("RK-041", ["N"]);
  });

  const MATS = () => [inst("RK-040", "v"), inst("RK-039", "m"), inst("RK-037", "e")];
  const rushBoard = (rush: ReturnType<typeof inst>[], power = 5) =>
    st({ phase: "rush", player1: { hand: [inst("RK-041", "g")], rush, command: releasedCat("WB", 1), power: powerCards(power), deck: deckCards(3) } }, EXTRA);

  it("RK-041: 追加条件（合体）— ベノスネーカー・メタルゲラス・エビルダイバーを自軍エリアから捨札にし、パワー5でラッシュできる（出典: atwiki/page-185「合体―ベノスネーカー＋メタルゲラス＋エビルダイバー」「必要パワー：5+」・R-ADD-06）", () => {
    const r = rushFromHand(rushBoard(MATS()), "player1", "RK-041:g");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-041:g")).toBe("rush");
    for (const id of ["RK-040:v", "RK-039:m", "RK-037:e"]) expect(zoneOf(s, "player1", id)).toBe("discard");
  });

  it("RK-041: 合体のユニットが1体でも足りなければ、パワー5でもラッシュできない（出典: atwiki/page-185・R-ADD-06「すべて自軍エリアから捨札にする」）", () => {
    expect(canStartRush(rushBoard(MATS().slice(0, 2)), "player1", "RK-041:g")).toBe(false);
  });

  it("RK-041: パワー4ではラッシュできない（出典: atwiki/page-185「必要パワー：5+」）", () => {
    expect(canStartRush(rushBoard(MATS(), 4), "player1", "RK-041:g")).toBe(false);
  });

  /** 敵軍（player2）ターン、player2 の striker がストライクする。 */
  const struck = (p1: Partial<GameState["players"]["player1"]>, striker: string) => {
    const [id, suf] = striker.split(":") as [string, string];
    const s = enemyTurn({ power: powerCards(3), ...p1 }, { battle: [inst(id, suf)] });
    return resolveAll(strike(s, striker, "player2"));
  };

  it("RK-041: 【ドゥームズデイ】自軍バトルエリアにある間、敵軍 S ユニットはストライクしてダメージを与えたとき撃破される（出典: atwiki/page-185）", () => {
    const s = struck({ battle: [inst("RK-041", "g")] }, "TST-UNIT-0:s");
    expect(damageOf(s, "player1")).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RK-041: 【ドゥームズデイ】敵軍 M ユニットのストライクでは撃破されない（出典: atwiki/page-185「敵軍Sユニットは」）", () => {
    const s = struck({ battle: [inst("RK-041", "g")] }, "SPEC-EM-SP:s");
    expect(damageOf(s, "player1")).toBe(1);
    expect(zoneOf(s, "player2", "SPEC-EM-SP:s")).toBe("battle");
  });

  it("RK-041: 【ドゥームズデイ】ラッシュエリアにあるときは効かない（出典: atwiki/page-185「これが自軍バトルエリアにある間」）", () => {
    const s = struck({ rush: [inst("RK-041", "g")] }, "TST-UNIT-0:s");
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-042 ブランウイング", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【閃光の翼】これが自軍バトルエリアにある間、相手は次の制限を受ける⇒スタートフェイズにリリースするコマンドが2つ以上あれば、スタートフェイズを終えるとき、自分自身のコマンドを1つ選びホールドする。";

  it("RK-042: カタログ本文・スペックが出典と一致（出典: atwiki/page-186）", () => {
    expectCatalogText("RK-042", TEXT);
    expectStats("RK-042", {
      name: "ブランウイング",
      category: "WB",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["ミラーモンスター", "獣"],
    });
    expectRarityIn("RK-042", ["N"]);
  });

  it("RK-042: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-186・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-042", "w")], command: [held("TST-OP", "h")] }), "RK-042:w")).toBe(false);
  });

  /** 相手（player2）のスタートフェイズを、held 個のホールド状態のコマンドで始めてチャージフェイズまで進める（選択は先頭で解決）。 */
  const startPhase = (p1: Partial<GameState["players"]["player1"]>, heldCount: number, released = 0, who: PlayerId = "player2") => {
    const other: PlayerId = who === "player1" ? "player2" : "player1";
    const cmds = [
      ...Array.from({ length: heldCount }, (_, i) => held("TST-OP", `h${i}`)),
      ...releasedCat("WB", released, "r"),
    ];
    let s = st(
      {
        phase: "start",
        activePlayer: who,
        [who]: { command: cmds, deck: deckCards(5, "e") },
        [other]: { deck: deckCards(5), ...p1 },
      },
      EXTRA,
    );
    for (let i = 0; i < 20 && !(s.activePlayer === who && s.phase === "charge" && !s.pendingEffectChoice); i++) {
      const p = s.pendingEffectChoice;
      if (p) {
        s = pick(s, p.validInstanceIds[0]!);
        continue;
      }
      const acts = legal(s);
      const a = ["release_start_commands", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "end_phase"]
        .map((t) => acts.find((x) => x.type === t))
        .find(Boolean);
      if (!a) break;
      s = act(s, a);
    }
    return s;
  };
  const heldCount = (s: GameState, who: PlayerId = "player2") => s.players[who].command.filter((c) => c.commandHeld).length;

  it("RK-042: 【閃光の翼】相手がスタートフェイズにコマンドを2つリリースしたら、スタートフェイズを終えるときに自分のコマンドを1つホールドする（出典: atwiki/page-186）", () => {
    const s = startPhase({ battle: [inst("RK-042", "w")] }, 2);
    expect(s.phase).toBe("charge");
    expect(heldCount(s)).toBe(1);
  });

  it("RK-042: 【閃光の翼】ホールドするコマンドは相手が選ぶ（出典: atwiki/page-186「自分自身のコマンドを1つ選びホールドする」）", () => {
    let s = st(
      { phase: "start", activePlayer: "player2", player1: { battle: [inst("RK-042", "w")], deck: deckCards(5) }, player2: { command: [held("TST-OP", "h0"), held("TST-OP", "h1")], deck: deckCards(5, "e") } },
      EXTRA,
    );
    for (let i = 0; i < 10 && !s.pendingEffectChoice && s.phase === "start"; i++) {
      const acts = legal(s);
      const a = ["release_start_commands", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "end_phase"].map((t) => acts.find((x) => x.type === t)).find(Boolean);
      if (!a) break;
      s = act(s, a);
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP:h0", "TST-OP:h1"]);
    s = pick(s, "TST-OP:h1");
    expect(cardIn(s, "player2", "TST-OP:h1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "TST-OP:h0")?.commandHeld ?? false).toBe(false);
  });

  it("RK-042: 【閃光の翼】リリースするコマンドが1つだけならホールドしない（出典: atwiki/page-186「リリースするコマンドが2つ以上あれば」）", () => {
    const s = startPhase({ battle: [inst("RK-042", "w")] }, 1, 1);
    expect(heldCount(s)).toBe(0);
  });

  // 公式 Q1「はい、その通りです。「RK-042 ブランウィング」の効果は重複します。」
  it("RK-042: 公式Q&A — ブランウイング2体なら、2つリリースした相手は2つホールドする（重複する）（出典: grnrngr/faq-rider-1 RK-042 Q1・atwiki/page-186 Q1）", () => {
    const s = startPhase({ battle: [inst("RK-042", "w1"), inst("RK-042", "w2")] }, 2);
    expect(heldCount(s)).toBe(2);
  });

  // 公式 Q2「いいえ、ホールドするコマンドは1つです。…「RK-042 ブランウイング」1体につき1つになります。」
  it("RK-042: 公式Q&A — ブランウイング1体なら、4つリリースしてもホールドするのは1つ（出典: grnrngr/faq-rider-1 RK-042 Q2・atwiki/page-186 Q2）", () => {
    const s = startPhase({ battle: [inst("RK-042", "w")] }, 4);
    expect(heldCount(s)).toBe(1);
  });

  it("RK-042: 【閃光の翼】ラッシュエリアにあるときは効かない（出典: atwiki/page-186「これが自軍バトルエリアにある間」）", () => {
    const s = startPhase({ rush: [inst("RK-042", "w")] }, 2);
    expect(heldCount(s)).toBe(0);
  });
});
