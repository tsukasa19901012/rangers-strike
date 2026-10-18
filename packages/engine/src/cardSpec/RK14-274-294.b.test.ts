/**
 * カード別スペック: RK-281〜RK-287（ザ・マスクドライダーEXP vol.4 ドラグランザー〜ゴルトフェニックス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-281」〜「RK-287」とカード名で検索）。atwiki に転載された公式 Q&A（RK-281 Q1・atwiki/page-2355 Q6（RK-286））
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST・R-ADD-07・05 章の「1/2」）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 *
 * 既存の照合と重なるもの: RK-286 をトリックベント（RK-084）でラッシュする場合は RK4-064-084.c で照合済み。
 * RK-286 の atwiki/page-2355 Q6（ブレイカー持ちも【戦いのリセット】で撃破される）は rulesSpec/07-breaker の it.todo だったものをここで照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  activateField,
  attack,
  attackTargets,
  attackUntilRegister,
  attackedInEnemyTurn,
  attackersOf,
  bpOf,
  canActivateField,
  canEnter,
  canMount,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  choicePlayer,
  deckCards,
  enemyBoard,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  held,
  inst,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  registerOffered,
  releasedCat,
  releasedN,
  resolveAll,
  riding,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  withStacked,
  zoneOf,
} from "./RK14-274-294.helpers";

const KW_MORPH =
  "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい）";
const RCU = sUnit("SPEC-RCU", { bp: 1000, powerCost: 1, comboNumber: "RC" });
const SURVIVE_RC = sUnit("SPEC-SURVIVE-RC", { category: "WB", bp: 1000, powerCost: 1, comboNumber: "RC", sp: undefined, features: ["仮面ライダー", "サバイブ"] });
const NOSURV_RC = sUnit("SPEC-NOSURV-RC", { category: "WB", bp: 1000, powerCost: 1, comboNumber: "RC", sp: undefined, features: ["仮面ライダー"] });
const MIRROR3 = sUnit("SPEC-MIRROR3", { category: "WB", bp: 1000, powerCost: 3, features: ["仮面ライダー", "ミラーライダー"] });
const PLAIN3 = sUnit("SPEC-PLAIN3", { category: "WB", bp: 1000, powerCost: 3, features: ["仮面ライダー"] });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3M = sUnit("SPEC-C3M", { bp: 1000, powerCost: 3, size: "M" });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C6 = sUnit("SPEC-C6", { bp: 1000, powerCost: 6 });
const C7 = sUnit("SPEC-C7", { bp: 1000, powerCost: 7 });
const C7M = sUnit("SPEC-C7MINUS", { bp: 1000, powerCost: "7-" } as never);
const CM4 = sUnit("SPEC-CM4", { bp: 1000, powerCost: 4, size: "M" });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000, sp: 1 });
const E4500 = sUnit("SPEC-E4500", { bp: 4500, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const MALE = sUnit("SPEC-MALE", { category: "WB", bp: 1000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "WB", bp: 1000, features: ["女"] });
const MORPH = sUnit("SPEC-MORPH", { category: "WB", bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const EXTRA = [
  PLAIN_VEHICLE, RCU, SURVIVE_RC, NOSURV_RC, MIRROR3, PLAIN3, C3, C3M, C2, C4, C6, C7, C7M, CM4,
  E1000, E2000, E4000, E4500, E5000, EM2000, KAMEN, MALE, FEMALE, MORPH,
];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-281 ドラグランザー", () => {
  const TEXT =
    "※これは、自軍エリアでホールド状態かライドされている間、Sビークルとして扱う。 ※これはユニットの間、次のテキストを得る⇒これは自軍コマンドを1つホールドしなければバトルエリアに出られない。また、自軍ラッシュフェイズ中、これをホールドしてもよい。 【ドラゴンファイヤーストーム】これにライドしている特徴「サバイブ」を持つユニットは「SP1」になる。";

  it("RK-281: カタログ本文・スペックが出典と一致（出典: atwiki/page-1367）", () => {
    expectCatalogText("RK-281", TEXT);
    expectStats("RK-281", { name: "ドラグランザー", category: "WB", size: "S", bp: 5000, sp: "1/2", powerCost: 6, features: ["ミラーモンスター", "獣", "ドラゴン"] });
    expectRarityIn("RK-281", ["NR"]);
  });

  it.fails("RK-281: ※ ユニットの間は、自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1367・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-281", "dg")], command: [held("TST-OP", "h")] }), "RK-281:dg")).toBe(false);
    const s = settle(enterHold(board({ rush: [inst("RK-281", "dg")], command: releasedCat("WB", 1) }), "RK-281:dg"));
    expect(zoneOf(s, "player1", "RK-281:dg")).toBe("battle");
  });

  it.fails("RK-281: ※ 自軍ラッシュフェイズ中にこれをホールドでき、ホールド状態のこれは S ビークルとして RC を持つユニットがライドできる（出典: atwiki/page-1367「自軍エリアでホールド状態かライドされている間、Sビークルとして扱う」「自軍ラッシュフェイズ中、これをホールドしてもよい」）", () => {
    const s0 = rushPhase({ rush: [inst("RK-281", "dg"), inst("SPEC-RCU", "r")] });
    expect(canActivateField(s0, "RK-281:dg")).toBe(true);
    const s = nextPhase(activateField(s0, "RK-281:dg"));
    expect(cardIn(s, "player1", "RK-281:dg")?.commandHeld).toBe(true);
    expect(canMount(s, "SPEC-RCU:r", "RK-281:dg")).toBe(true);
  });

  it.fails("RK-281: 【ドラゴンファイヤーストーム】これにライドしている特徴「サバイブ」を持つユニットは「SP1」になる（出典: atwiki/page-1367）", () => {
    const s = board({ battle: riding({ ...inst("RK-281", "dg"), commandHeld: true }, inst("SPEC-SURVIVE-RC", "sv")) });
    expect(spOf(s, "player1", "SPEC-SURVIVE-RC:sv")).toBe(1);
  });

  it("RK-281: 【ドラゴンファイヤーストーム】ライドしているユニットが「サバイブ」を持たなければ SP は変わらない（出典: atwiki/page-1367「特徴「サバイブ」を持つユニットは」）", () => {
    const s = board({ battle: riding({ ...inst("RK-281", "dg"), commandHeld: true }, inst("SPEC-NOSURV-RC", "n")) });
    expect(spOf(s, "player1", "SPEC-NOSURV-RC:n")).toBe(0);
  });

  // atwiki/page-1367 Q1「ユニットでなくなるので「RK-250 サバイブ」は捨札になります。」
  it.fails("RK-281: 公式Q&A — RK-250 サバイブを重ねたこれをホールドしてビークルにすると、サバイブは捨札になる（出典: atwiki/page-1367 Q1・atwiki/page-1350 Q2）", () => {
    const s = settle(activateField(rushPhase({ rush: [withStacked(inst("RK-281", "dg"), [inst("RK-250", "sv")])] }), "RK-281:dg"));
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-281:dg")).toBe("rush");
  });

  it.todo(
    "RK-281: ビークルになったこれを仮面ライダー龍騎がコンビネーションの相手にできない（ユニットでなくなる）（出典: atwiki/page-1367 カード評価「ビークルになった時点でユニットではなくなるので仮面ライダー龍騎をコンビネーションさせても龍騎の効果が発動しない」）— コミュニティの記述で、エンジンのコンビネーションの相手の判定（直前に出たユニット）はビークルになったこれを含めない作りだが、RK-033 側の照合範囲",
  );
});

// ===========================================================================
describe("RK-282 仮面ライダーシザース", () => {
  const TEXT =
    "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【シザースアタック】自軍ラッシュエリアに「ボルキャンサー」があれば、このユニットは「SP1/2」になる。";

  it("RK-282: カタログ本文・スペックが出典と一致（出典: atwiki/page-1244）", () => {
    expectCatalogText("RK-282", TEXT);
    expectStats("RK-282", { name: "仮面ライダーシザース", category: "WB", size: "S", bp: 500, sp: "special", powerCost: 0, features: ["仮面ライダー", "男", "ミラーライダー", "警察"] });
    expectRarityIn("RK-282", ["N"]);
  });

  it("RK-282: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1244・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-282", "sc")] }, "RK-282:sc"))).toBe(true);
  });

  const scissors = (p1Rush: ReturnType<typeof inst>[], p1Battle = [inst("TST-UNIT-0", "f"), inst("RK-282", "sc")], p2: Partial<GameState["players"]["player2"]> = {}) =>
    board({ battle: p1Battle, rush: p1Rush }, p2);

  it.fails("RK-282: 【シザースアタック】自軍ラッシュエリアに「ボルキャンサー」があれば「SP1/2」になる — バトルエリアの2番目にいれば SP1（出典: atwiki/page-1244・docs/rules/05「「1/2」等は、分母と同じ並び順にある間は常に SP1」）", () => {
    expect(spOf(scissors([inst("RK-283", "bc")]), "player1", "RK-282:sc")).toBe(1);
  });

  it("RK-282: 「SP1/2」なので、バトルエリアの1番目では SP1 にならない（出典: atwiki/page-1244・docs/rules/05「分母と同じ並び順にある間は常に SP1」）", () => {
    expect(spOf(scissors([inst("RK-283", "bc")], [inst("RK-282", "sc")]), "player1", "RK-282:sc")).toBe(0);
  });

  it("RK-282: 自軍ラッシュエリアに「ボルキャンサー」がなければ「SP！」のまま（2番目でもストライクで与えるダメージは0）（出典: atwiki/page-1244・コメント欄「自軍ラッシュエリアにボルキャンサーがいないとストライカーになれない」）", () => {
    expect(spOf(scissors([]), "player1", "RK-282:sc")).toBe(0);
  });

  it("RK-282: ボルキャンサーがバトルエリアにあるときは「SP1/2」にならない（出典: atwiki/page-1244「自軍ラッシュエリアに」・コメント欄「ボルキャンサーをバトルエリアに出せば…SP1の状態を解除できる」）", () => {
    expect(spOf(scissors([], [inst("RK-283", "bc"), inst("RK-282", "sc")]), "player1", "RK-282:sc")).toBe(0);
  });

  it("RK-282: 敵軍ラッシュエリアの「ボルキャンサー」は数えない（出典: atwiki/page-1244「自軍ラッシュエリアに」）", () => {
    expect(spOf(scissors([], undefined, { rush: [inst("RK-283", "ebc")] }), "player1", "RK-282:sc")).toBe(0);
  });
});

// ===========================================================================
describe("RK-283 ボルキャンサー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【契約解除者の捕食】これが自軍エリアにある間、敵軍ターン中、特徴「ミラーライダー」を持つ自軍ユニットが撃破されて捨札になったとき、自分も相手も次のようにする⇒撃破されたユニットの必要パワーの数字と同じ必要パワーの数字を持つSユニットのカードを、自分自身のコマンドゾーンから1枚選び捨札にする。";

  it("RK-283: カタログ本文・スペックが出典と一致（出典: atwiki/page-1380）", () => {
    expectCatalogText("RK-283", TEXT);
    expectStats("RK-283", { name: "ボルキャンサー", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-283", ["N"]);
  });

  it("RK-283: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1380・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-283", "bc")], command: [held("TST-OP", "h")] }), "RK-283:bc")).toBe(false);
  });

  const myCommand = [inst("SPEC-C3", "c3"), inst("SPEC-C3M", "c3m"), inst("SPEC-C2", "c2")];
  const enemyCommand = [inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2")];
  /** 敵軍ターンに、自軍の victim（必要パワー3）が BP13000 の敵軍ユニットにアタックされて撃破される。 */
  const preyed = (victim = "SPEC-MIRROR3:mr", p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => {
    const [cid, suf] = victim.split(":") as [string, string];
    return attackedInEnemyTurn({ battle: [inst(cid, suf)], rush: [inst("RK-283", "bc")], command: myCommand, ...p1 }, victim, { command: enemyCommand, ...p2 }, "TST-UNIT-7:atk", EXTRA);
  };

  it.fails("RK-283: 【契約解除者の捕食】敵軍ターン中に自軍の「ミラーライダー」が撃破されて捨札になったとき、自分は必要パワーの数字が同じ（3）S ユニットのカードを自分のコマンドゾーンから1枚選ぶ（M ユニット・違う数字は対象外。見送れない）（出典: atwiki/page-1380）", () => {
    const s = preyed();
    expect(zoneOf(s, "player1", "SPEC-MIRROR3:mr")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-283");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-283: 自分も相手も、選んだカードを捨札にする（相手も必要パワーの数字が3の S ユニットのカードを自分のコマンドゾーンから捨札にする）（出典: atwiki/page-1380「自分も相手も次のようにする⇒…自分自身のコマンドゾーンから1枚選び捨札にする」）", () => {
    const s = resolveAll(preyed());
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C2:c2")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("command");
  });

  it.fails("RK-283: 自分のコマンドゾーンに当てはまるカードがなくても、相手は捨札にする（出典: atwiki/page-1380「自分も相手も」）", () => {
    let s = preyed(undefined, { command: [inst("SPEC-C2", "c2")] });
    expectChoiceFrom(s, "player2", "RK-283");
    expect(choiceIds(s)).toEqual(["SPEC-C3:e3"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("discard");
  });

  it("RK-283: 撃破されたのが「ミラーライダー」を持たないユニットなら発動しない（出典: atwiki/page-1380「特徴「ミラーライダー」を持つ自軍ユニットが」）", () => {
    const s = resolveAll(preyed("SPEC-PLAIN3:p"));
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("command");
  });

  it("RK-283: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-1380「敵軍ターン中」）", () => {
    const s = resolveAll(
      // 自軍の「ミラーライダー」（BP1000）が BP13000 の敵軍ユニットにアタックして撃破される。
      attack(board({ battle: [inst("SPEC-MIRROR3", "mr")], rush: [inst("RK-283", "bc")], command: myCommand }, { battle: [inst("TST-UNIT-7", "big")], command: enemyCommand }), "SPEC-MIRROR3:mr", "TST-UNIT-7:big"),
    );
    expect(zoneOf(s, "player1", "SPEC-MIRROR3:mr")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("command");
  });

  it("RK-283: これが場になければ発動しない（出典: atwiki/page-1380「これが自軍エリアにある間」）", () => {
    const s = resolveAll(preyed(undefined, { rush: [] }));
    expect(zoneOf(s, "player1", "SPEC-C3:c3")).toBe("command");
  });
});


// ===========================================================================
describe("RK-284 仮面ライダーベルデ", () => {
  const TEXT =
    "【デスバニッシュ】「バイオグリーザ」からコンビネーションしたとき発動できる⇒敵軍バトルエリアから、BP4000以下のSユニットを1体選び撃破する。そうしたとき、撃破したユニットのBPがこのユニットのBPよりも低ければ、相手は自分自身のコマンドゾーンからカードを1枚選び捨札にする。";

  it("RK-284: カタログ本文・スペックが出典と一致（出典: atwiki/page-1251）", () => {
    expectCatalogText("RK-284", TEXT);
    expectStats("RK-284", { name: "仮面ライダーベルデ", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 2, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("RK-284", ["R"]);
  });

  const enemy = {
    battle: [inst("SPEC-E1000", "a"), inst("SPEC-E2000", "eq"), inst("SPEC-E4000", "b"), inst("SPEC-E4500", "c"), inst("SPEC-EM2000", "m")],
    rush: [inst("SPEC-E1000", "r")],
    command: [inst("TST-OP", "ec0"), held("TST-OP", "ec1")],
  };
  const vanish = (prev = [inst("RK-285", "bg")]) => enter(board({ battle: prev, rush: [inst("RK-284", "vd")] }, enemy), "RK-284:vd");

  it.fails("RK-284: 【デスバニッシュ】「バイオグリーザ」からコンビネーションしたとき発動でき、敵軍バトルエリアの BP4000 以下の S ユニットから1体選ぶ（M・ラッシュエリア・BP4500 は対象外）（出典: atwiki/page-1251）", () => {
    const s = vanish();
    expectChoiceFrom(s, "player1", "RK-284");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:a", "SPEC-E2000:eq", "SPEC-E4000:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-284: 撃破したユニットの BP（1000）がこのユニットの BP（2000）より低ければ、相手は自分のコマンドゾーンのカード（ホールド・リリースを問わない）から1枚選んで捨札にする（出典: atwiki/page-1251「撃破したユニットのBPがこのユニットのBPよりも低ければ、相手は自分自身のコマンドゾーンからカードを1枚選び捨札にする」）", () => {
    let s = pick(vanish(), "SPEC-E1000:a");
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expectChoiceFrom(s, "player2", "RK-284");
    expect(choiceIds(s)).toEqual(["TST-OP:ec0", "TST-OP:ec1"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-OP:ec1"));
    expect(zoneOf(s, "player2", "TST-OP:ec1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:ec0")).toBe("command");
  });

  it.fails("RK-284: 撃破したユニットの BP がこのユニットの BP 以上（4000・同じ2000）なら、相手はコマンドを捨札にしない（出典: atwiki/page-1251「このユニットのBPよりも低ければ」）", () => {
    for (const id of ["SPEC-E4000:b", "SPEC-E2000:eq"]) {
      const s = resolveAll(pick(vanish(), id));
      expect(zoneOf(s, "player2", id)).toBe("discard");
      expect(s.players.player2.command).toHaveLength(2);
    }
  });

  it.fails("RK-284: 発動しなければ何も起きない（出典: atwiki/page-1251「発動できる」）", () => {
    const s = resolveAll(skip(vanish()));
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("battle");
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RK-284: バイオグリーザ以外のユニットの次に出たときは発動しない（出典: atwiki/page-1251「「バイオグリーザ」からコンビネーションしたとき」・R-CN-05）", () => {
    const s = vanish([inst("SPEC-E1000", "x")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-284");
  });
});

// ===========================================================================
describe("RK-285 バイオグリーザ", () => {
  const TEXT = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【見えない刺客】これは敵軍ユニットにアタックされない。";

  it("RK-285: カタログ本文・スペックが出典と一致（出典: atwiki/page-1354）", () => {
    expectCatalogText("RK-285", TEXT);
    expectStats("RK-285", { name: "バイオグリーザ", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 3, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-285", ["N"]);
  });

  it("RK-285: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1354・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-285", "bg")], command: [held("TST-OP", "h")] }), "RK-285:bg")).toBe(false);
    const s = settle(enterHold(board({ rush: [inst("RK-285", "bg")], command: releasedCat("WB", 1) }), "RK-285:bg"));
    expect(zoneOf(s, "player1", "RK-285:bg")).toBe("battle");
  });

  it("RK-285: 【見えない刺客】敵軍ユニット（S・M とも）にアタックされない（出典: atwiki/page-1354「これは敵軍ユニットにアタックされない」）", () => {
    const s = enemyTurn({ battle: [inst("RK-285", "bg"), inst("TST-UNIT-0", "o")] }, { battle: [inst("SPEC-E5000", "s"), inst("SPEC-EM2000", "m")] });
    expect(attackersOf(s, "RK-285:bg")).toEqual([]);
    expect(attackersOf(s, "TST-UNIT-0:o")).toEqual(["SPEC-E5000:s", "SPEC-EM2000:m"]);
  });
});

// ===========================================================================
describe("RK-286 仮面ライダーオーディン", () => {
  const TEXT =
    "※これが撃破されて捨札になるとき、かわりに自軍ラッシュエリアにある特徴「男」を持つユニット1体を捨札にすれば、これはその場に留まる。 【戦いのリセット】これをラッシュしたとき、次の効果を自分、相手の順に行う⇒自分自身のパワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい自分自身のユニットをすべて撃破する。";

  it("RK-286: カタログ本文・スペックが出典と一致（出典: atwiki/page-1276）", () => {
    expectCatalogText("RK-286", TEXT);
    expectStats("RK-286", {
      name: "仮面ライダーオーディン",
      category: "WB",
      size: "S",
      bp: 5000,
      sp: 1,
      powerCost: "6+",
      features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"],
      rushCondition: "state_gate",
    });
    expectRarityIn("RK-286", ["SR"]);
  });

  /** 自軍パワー6・捨札の合計 discards 枚で、手札のオーディンをラッシュする。 */
  const odin = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, discards: [number, number] = [6, 5]) =>
    rushPhase(
      { hand: [inst("RK-286", "od")], command: releasedCat("WB", 1), power: powerCards(6), discard: deckCards(discards[0], "d1"), ...p1 },
      { power: powerCards(3, "ep"), discard: deckCards(discards[1], "d2"), ...p2 },
    );

  it("RK-286: 追加条件 — 自分と相手の捨札の合計が11枚以上あればラッシュでき、10枚ではラッシュできない（出典: atwiki/page-1276「自分と相手の捨札の合計が11枚以上ある」）", () => {
    expect(canStartRush(odin(), "player1", "RK-286:od")).toBe(true);
    expect(canStartRush(odin({}, {}, [5, 5]), "player1", "RK-286:od")).toBe(false);
  });

  const reset = () => {
    const r = rushFromHand(
      odin(
        { battle: [inst("SPEC-C7", "m7"), inst("SPEC-C6", "m6")], rush: [inst("SPEC-C7MINUS", "m7m")] },
        { battle: [inst("SPEC-C4", "e4"), inst("SPEC-C3", "e3")], rush: [inst("SPEC-CM4", "em4")] },
      ),
      "player1",
      "RK-286:od",
    );
    expect(r.ok, r.error).toBe(true);
    return resolveAll(r.state);
  };

  it.fails("RK-286: 【戦いのリセット】ラッシュしたとき、自分はパワーゾーンの枚数（6）より必要パワーの数字が大きい自分のユニットをすべて撃破する（7・「7-」は撃破、6 とオーディン自身は残る）（出典: atwiki/page-1276）", () => {
    const s = reset();
    expect(zoneOf(s, "player1", "SPEC-C7:m7")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C7MINUS:m7m")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C6:m6")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-286:od")).toBe("rush");
  });

  it.fails("RK-286: 【戦いのリセット】相手も、相手のパワーゾーンの枚数（3）より必要パワーの数字が大きい相手のユニットをすべて撃破する（エリア・サイズを問わない）（出典: atwiki/page-1276「次の効果を自分、相手の順に行う」・コメント欄「サイズ・エリア問わず除去できる」）", () => {
    const s = reset();
    expect(zoneOf(s, "player2", "SPEC-C4:e4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-CM4:em4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("battle");
  });

  // atwiki/page-2355 Q6「はい、できます。【戦いのリセット】の効果はユニットを選んではいないからです。」
  it.fails("RK-286: 公式Q&A — 必要パワーを満たしていないブレイカー持ちのユニットも【戦いのリセット】で撃破される（出典: atwiki/page-2355 Q6）", () => {
    const BRK = sUnit("SPEC-BRK4", { bp: 3000, powerCost: 4, text: "※ブレイカー（本来のカード名がこれと同名の自軍ユニットまたは自軍ビークルがあるとき、これはラッシュすることができない。また、ブレイカーを持たない、敵軍ユニットか敵軍常駐の効果に選ばれない）" } as never);
    const s0 = st(
      {
        phase: "rush",
        player1: { hand: [inst("RK-286", "od")], command: releasedCat("WB", 1), power: powerCards(6), discard: deckCards(6, "d1"), deck: deckCards(5) },
        player2: { battle: [inst("SPEC-BRK4", "b")], power: powerCards(3, "ep"), discard: deckCards(5, "d2"), deck: deckCards(5, "e") },
      },
      [...EXTRA, BRK],
    );
    const r = rushFromHand(s0, "player1", "RK-286:od");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player2", "SPEC-BRK4:b")).toBe("discard");
  });

  it.fails("RK-286: ※ 撃破されて捨札になるとき、かわりに自軍ラッシュエリアの「男」を持つユニット1体を捨札にするかを選べる（任意。「男」を持たないユニットは選べない）（出典: atwiki/page-1276「かわりに自軍ラッシュエリアにある特徴「男」を持つユニット1体を捨札にすれば」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-286", "od")], rush: [inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f")] }, "RK-286:od", {}, "TST-UNIT-7:atk", EXTRA);
    expectChoiceFrom(s, "player1", "RK-286");
    expect(choiceIds(s)).toEqual(["SPEC-MALE:m"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-286: ※ 「男」のユニットを捨札にすれば、これはその場に留まる（出典: atwiki/page-1276「これはその場に留まる」）", () => {
    const s = resolveAll(pick(attackedInEnemyTurn({ battle: [inst("RK-286", "od")], rush: [inst("SPEC-MALE", "m")] }, "RK-286:od", {}, "TST-UNIT-7:atk", EXTRA), "SPEC-MALE:m"));
    expect(zoneOf(s, "player1", "SPEC-MALE:m")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-286:od")).toBe("battle");
  });

  it.fails("RK-286: ※ 捨札にしないことを選べば、これは捨札になる（出典: atwiki/page-1276「捨札にすれば」）", () => {
    const s = resolveAll(skip(attackedInEnemyTurn({ battle: [inst("RK-286", "od")], rush: [inst("SPEC-MALE", "m")] }, "RK-286:od", {}, "TST-UNIT-7:atk", EXTRA)));
    expect(zoneOf(s, "player1", "RK-286:od")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MALE:m")).toBe("rush");
  });

  it.todo(
    "RK-286: 【戦いのリセット】とモーフ（敵軍の「ラッシュされたとき」）の順番 — ラッシュしたときの効果が先（出典: atwiki/page-1276 コメント欄「ラッシュした時の効果が先に発動します」）— コミュニティの回答だけで公式の出典がない（エンジンはラッシュしたときの効果を先に処理する）",
  );
});

// ===========================================================================
describe("RK-287 ゴルトフェニックス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※これは特徴「仮面ライダー」を持つユニット以外にアタックする事ができない。 【瞬間の悪夢】 これをラッシュしたとき、敵軍コマンドゾーンから、モーフを持つユニットカードを1枚選び捨札にしてもよい。";

  it("RK-287: カタログ本文・スペックが出典と一致（出典: atwiki/page-1355）", () => {
    expectCatalogText("RK-287", TEXT);
    expectStats("RK-287", { name: "ゴルトフェニックス", category: "WB", size: "S", bp: 8000, sp: undefined, powerCost: 6, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("RK-287", ["NR"]);
  });

  it("RK-287: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1355・R-ADD-07）", () => {
    expect(canEnter(board({ rush: [inst("RK-287", "gf")], command: [held("TST-OP", "h")] }), "RK-287:gf")).toBe(false);
  });

  it("RK-287: ※ 特徴「仮面ライダー」を持つユニットにしかアタックできない（出典: atwiki/page-1355「特徴「仮面ライダー」を持つユニット以外にアタックする事ができない」）", () => {
    const s = board({ battle: [inst("RK-287", "gf")] }, { battle: [inst("SPEC-KAMEN", "k"), inst("SPEC-E2000", "x")] });
    expect(attackTargets(s, "RK-287:gf")).toEqual(["SPEC-KAMEN:k"]);
  });

  const nightmare = (enemyCommand = [inst("SPEC-MORPH", "mu"), held("SPEC-MORPH", "mh"), inst("SPEC-E2000", "pu"), inst("TST-OP", "op")]) => {
    const r = rushFromHand(rushPhase({ hand: [inst("RK-287", "gf")], command: releasedCat("WB", 1), power: powerCards(6) }, { command: enemyCommand }), "player1", "RK-287:gf");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it.fails("RK-287: 【瞬間の悪夢】ラッシュしたとき、敵軍コマンドゾーンのモーフを持つユニットカード（ホールド・リリースを問わない）から1枚選べる（任意）（出典: atwiki/page-1355）", () => {
    const s = nightmare();
    expectChoiceFrom(s, "player1", "RK-287");
    expect(choiceIds(s)).toEqual(["SPEC-MORPH:mh", "SPEC-MORPH:mu"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-287: 選んだカードは捨札になる（出典: atwiki/page-1355「1枚選び捨札にしてもよい」）", () => {
    const s = resolveAll(pick(nightmare(), "SPEC-MORPH:mu"));
    expect(zoneOf(s, "player2", "SPEC-MORPH:mu")).toBe("discard");
  });

  it("RK-287: 捨札にしないことも選べる（出典: atwiki/page-1355「捨札にしてもよい」）", () => {
    const s = resolveAll(skip(nightmare()));
    expect(zoneOf(s, "player2", "SPEC-MORPH:mu")).toBe("command");
  });

  it.fails("RK-287: 敵軍コマンドゾーンにモーフを持つユニットカードがなければ何も起きない（出典: atwiki/page-1355「モーフを持つユニットカードを」）", () => {
    const s = nightmare([inst("SPEC-E2000", "pu"), inst("TST-OP", "op")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-287");
  });
});
