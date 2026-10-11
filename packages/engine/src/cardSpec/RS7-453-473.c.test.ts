/**
 * カード別スペック: RS-466〜RS-473（第7弾「七忍の炎陣」ギンガレオン〜タイムシャドウ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7（該当カードの Q なし）、grnrngr/faq-index「レジスト」
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。
 *     Q&A 欄なし。コメント欄の質疑も参考に引用）
 *  3. docs/rules/*.md の一般ルール（R-KW-RIDE-01〜03、R-KW-RESIST-01/02、R-KW-SCRUM-01、R-ADD-07、R-REPL-03 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  act,
  attack,
  attackTargets,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  expectVehicleStats,
  heldCommandIds,
  inst,
  legal,
  ncEnter,
  nextPhase,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rideOptions,
  rider,
  rushFromHand,
  sUnit,
  settle,
  skip,
  spOf,
  st,
  zoneOf,
} from "./RS7-453-473.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 特徴だけを指定したテスト用ユニット（WB・SP 空欄・BP2000・ナンバーなし）。 */
const featUnit = (id: string, features: string[], over: Partial<CardDefinition> = {}) =>
  sUnit(id, { features, sp: undefined, bp: 2000, ...over });
const RED = featUnit("SPEC-RED", ["レッド"]);
const GREEN = featUnit("SPEC-GREEN", ["グリーン"]);
const BLUE = featUnit("SPEC-BLUE", ["ブルー"]);
const YELLOW = featUnit("SPEC-YELLOW", ["イエロー"]);
const PINK = featUnit("SPEC-PINK", ["ピンク"]);
const PLAIN = featUnit("SPEC-PLAIN", ["男"]);
const RED_M = featUnit("SPEC-RED-M", ["レッド"], { size: "M" });
const CAR = sUnit("SPEC-CAR", { features: ["車両"], sp: 1, bp: 2000 });
const EXTRA = [RED, GREEN, BLUE, YELLOW, PINK, PLAIN, RED_M, CAR];

/** player1 のバトルフェイズ。ラッシュエリアに vehicle と riderId がいる。 */
const rideState = (vehicle: string, riderId: string, command: CardInstance[] = releasedCat("WB", 2)) =>
  st({ player1: { rush: [inst(vehicle, "v"), inst(riderId, "r")], command, deck: deckCards(3) } }, EXTRA);

/** 「特徴○○を持つSユニットは、自軍コマンドを1つホールドすれば、RCを持っていなくてもライドできる」の共通テスト。 */
function featureRideTests(vehicle: string, feature: string, okRider: string, page: string) {
  it(`${vehicle}: ※ 特徴「${feature}」を持つ S ユニットは RC がなくてもこのビークルにライドしてバトルエリアに出られる（出典: atwiki/${page}「ＲＣを持っていなくてもこのビークルにライドできる」・R-KW-RIDE-02）`, () => {
    const s = rideState(vehicle, okRider);
    expect(rideOptions(s)).toEqual([`${okRider}:r>${vehicle}:v`]);
    const t = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: `${okRider}:r`, vehicleInstanceId: `${vehicle}:v` });
    expect(t.players.player1.battle.find((c) => c.instanceId === `${okRider}:r`)?.mountedOnInstanceId).toBe(`${vehicle}:v`);
  });

  it(`${vehicle}: ※ ライドするとき自軍コマンドを1つホールドする（出典: atwiki/${page}「自軍コマンドを1つホールドすれば」）`, () => {
    const s = rideState(vehicle, okRider);
    const t = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: `${okRider}:r`, vehicleInstanceId: `${vehicle}:v` });
    expect(heldCommandIds(t)).toHaveLength(1);
  });

  it(`${vehicle}: ※ リリース状態の自軍コマンドがなければ RC を持たない「${feature}」の S ユニットはライドできない（出典: atwiki/${page}「自軍コマンドを1つホールドすれば」）`, () => {
    const s = rideState(vehicle, okRider, []);
    expect(rideOptions(s)).toEqual([]);
  });

  it(`${vehicle}: ※ 特徴「${feature}」を持たず RC もない S ユニットはライドできない（出典: atwiki/${page}・R-KW-RIDE-02）`, () => {
    expect(rideOptions(rideState(vehicle, "SPEC-PLAIN"))).toEqual([]);
  });
}

// ===========================================================================
describe("RS-466 ギンガレオン", () => {
  const TEXT =
    "※特徴「レッド」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【炎の星獣】これにライドしているSユニットは次の能力を得る⇒※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）";

  it("RS-466: カタログ本文・スペックが出典と一致（出典: atwiki/page-765）", () => {
    expectCatalogText("RS-466", TEXT);
    expectVehicleStats("RS-466", { name: "ギンガレオン", category: "WB", size: "M", powerCost: 3, features: ["獣"] });
  });

  featureRideTests("RS-466", "レッド", "SPEC-RED", "page-765");

  it("RS-466: ※ 特徴「レッド」でも S ユニットでない（M ユニット）なら RC なしではライドできない（出典: atwiki/page-765「特徴「レッド」を持つSユニットは」）", () => {
    expect(rideOptions(rideState("RS-466", "SPEC-RED-M"))).toEqual([]);
  });

  /** 敵軍ターンに、ギンガレオンにライドしてバトルエリアにいる自軍ユニットが BP13000 にアタックされる。 */
  const attackedRider = (riderId: string) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [rider(riderId, "r", "RS-466:v"), inst("RS-466", "v")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    return attack(s, "TST-UNIT-7:atk", `${riderId}:r`, "player2");
  };

  it("RS-466: 【炎の星獣】ライドしている S ユニットはレジストを得る — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-765「これにライドしているSユニットは次の能力を得る⇒※レジスト」・R-KW-RESIST-01）", () => {
    let s = attackedRider("SPEC-RED");
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) {
      const pass = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
      if (!pass) break;
      s = act(s, pass);
    }
    const use = legal(s).find((a) => a.type === "use_register");
    expect(use).toBeDefined();
    s = act(s, use!);
    s = settle(s);
    const me = s.players.player1.battle.find((c) => c.instanceId === "SPEC-RED:r");
    expect(me?.commandHeld).toBe(true);
  });

  it("RS-466: 【炎の星獣】ライドしていなければレジストはなく、バトルで撃破されると捨札になる（出典: atwiki/page-765「これにライドしているSユニットは」）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("SPEC-RED", "r"), inst("RS-466", "v")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    const t = settle(attack(s, "TST-UNIT-7:atk", "SPEC-RED:r", "player2"));
    expect(legal(t).some((a) => a.type === "use_register")).toBe(false);
    expect(zoneOf(t, "player1", "SPEC-RED:r")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-467 ギンガルコン", () => {
  const TEXT =
    "※特徴「グリーン」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【風の星獣】これにライドしたユニットがある間、WBの自軍Sユニットは次の能力を得る⇒スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない）";

  it("RS-467: カタログ本文・スペックが出典と一致（出典: atwiki/page-766）", () => {
    expectCatalogText("RS-467", TEXT);
    expectVehicleStats("RS-467", { name: "ギンガルコン", category: "WB", size: "M", powerCost: 1, features: ["獣"] });
  });

  featureRideTests("RS-467", "グリーン", "SPEC-GREEN", "page-766");

  const W1 = sUnit("SPEC-W1", { sp: undefined, bp: 2000, comboNumber: 1 });
  const W2 = sUnit("SPEC-W2", { sp: undefined, bp: 2000, comboNumber: 2 });
  /** 敵軍ターン。自軍バトル [WB・CN1, WB・CN2]。riding=true ならギンガルコンにライドしたユニットがラッシュエリアにいる。 */
  const windTargets = (riding: boolean) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: {
          battle: [inst("SPEC-W1", "a"), inst("SPEC-W2", "b")],
          rush: riding ? [rider("SPEC-GREEN", "g", "RS-467:v"), inst("RS-467", "v")] : [inst("SPEC-GREEN", "g"), inst("RS-467", "v")],
        },
        player2: { battle: [inst("TST-UNIT-7", "atk")] },
      },
      [...EXTRA, W1, W2],
    );
    return attackTargets(s, "TST-UNIT-7:atk", "player2").sort();
  };

  it("RS-467: 【風の星獣】ライドしたユニットがある間、WB の自軍 S ユニットはスクラムを得る — CN2 が次に並ぶ CN1 はアタックされない（出典: atwiki/page-766「WBの自軍Sユニットは次の能力を得る⇒スクラム」・R-KW-SCRUM-01）", () => {
    expect(windTargets(true)).toEqual(["SPEC-W2:b"]);
  });

  it("RS-467: 【風の星獣】ライドしたユニットがなければスクラムはなく、CN1 もアタックされる（出典: atwiki/page-766「これにライドしたユニットがある間」）", () => {
    expect(windTargets(false)).toEqual(["SPEC-W1:a", "SPEC-W2:b"]);
  });
});

// ===========================================================================
describe("RS-468 ギンガリラ", () => {
  const TEXT =
    "※特徴「ブルー」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【水の星獣】これにライドしたユニットがある間、次の効果を発動する⇒特徴「車両」を持つユニットは「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれているかのように扱う。";

  it("RS-468: カタログ本文・スペックが出典と一致（出典: atwiki/page-767）", () => {
    expectCatalogText("RS-468", TEXT);
    expectVehicleStats("RS-468", { name: "ギンガリラ", category: "WB", size: "M", powerCost: 4, features: ["獣"] });
  });

  featureRideTests("RS-468", "ブルー", "SPEC-BLUE", "page-767");

  /** 敵軍（player2）のバトルフェイズ。player1 のバトルエリアにギンガリラ（riding=true ならブルーがライド中）。敵軍ラッシュに「車両」。 */
  const carState = (riding: boolean) =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: riding ? [rider("SPEC-BLUE", "b", "RS-468:v"), inst("RS-468", "v")] : [inst("RS-468", "v")] },
        player2: { rush: [inst("SPEC-CAR", "c")], command: releasedCat("WB", 1, "ec"), deck: deckCards(3, "e") },
      },
      EXTRA,
    );
  const freeEntry = (s: GameState) => legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "SPEC-CAR:c");
  const holdEntry = (s: GameState) =>
    legal(s).some((a) => a.type === "initiate_command_payment" && a.kind === "battle_entry" && a.sourceInstanceId === "SPEC-CAR:c");

  it("RS-468: 【水の星獣】ライドしたユニットがある間、特徴「車両」を持つ（敵軍）ユニットはコマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-767「「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれているかのように扱う」・R-ADD-07）", () => {
    const s = carState(true);
    expect(freeEntry(s)).toBe(false);
    expect(holdEntry(s)).toBe(true);
  });

  it("RS-468: 【水の星獣】ライドしたユニットがなければ「車両」のユニットはホールドなしで出られる（出典: atwiki/page-767「これにライドしたユニットがある間」）", () => {
    expect(freeEntry(carState(false))).toBe(true);
  });
});

// ===========================================================================
describe("RS-469 ギンガベリック", () => {
  const TEXT =
    "※特徴「イエロー」を持つSユニットは、自軍コマンドを１つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【雷の星獣】これにライドしたユニットがある間、次の効果を発動する⇒自軍バトルフェイズ中、MAの自軍コマンドを1つホールドするかわりに、敵軍コマンドを1つ選びホールドしてもよい。";

  it("RS-469: カタログ本文・スペックが出典と一致（出典: atwiki/page-741）", () => {
    expectCatalogText("RS-469", TEXT);
    expectVehicleStats("RS-469", { name: "ギンガベリック", category: "WB", size: "M", powerCost: 2, features: ["獣"] });
  });

  featureRideTests("RS-469", "イエロー", "SPEC-YELLOW", "page-741");

  /** 2番目にギンガレッド（RS-376【炎一閃】「MA」の自軍コマンドを１つホールドして発動できる）を出す。MA の自軍コマンドはない。 */
  const thunderState = (riding: boolean) =>
    ncEnter(
      "RS-376",
      2,
      { rush: riding ? [rider("SPEC-YELLOW", "y", "RS-469:v"), inst("RS-469", "v")] : [inst("SPEC-YELLOW", "y"), inst("RS-469", "v")] },
      { battle: [inst("SPEC-PLAIN", "t")], command: releasedCat("WB", 1, "ec"), deck: deckCards(3, "e") },
      EXTRA,
    );
  const activateFlash = (s: GameState) =>
    legal(s).find((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === "RS-376:x");

  it("RS-469: 【雷の星獣】ライドしたユニットがある間、自軍バトルフェイズ中に「MA の自軍コマンドを1つホールド」するかわりに敵軍コマンドを1つ選んでホールドできる（MA コマンドがなくても可・R-REPL-03）（出典: atwiki/page-741）", () => {
    let s = thunderState(true);
    const activate = activateFlash(s);
    expect(activate).toBeDefined();
    s = act(s, activate!);
    expect(choiceIds(s)).toEqual(["TST-OP:ec0"]);
    s = pick(s, "TST-OP:ec0");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:ec0")?.commandHeld).toBe(true);
    // 【炎一閃】の本文（ナンバーを持たない敵軍 S ユニットを1体撃破）が続く。
    s = resolveAll(s, ["SPEC-PLAIN:t"]);
    expect(zoneOf(s, "player2", "SPEC-PLAIN:t")).toBe("discard");
  });

  it("RS-469: 【雷の星獣】ライドしたユニットがなければ、MA の自軍コマンドがないとき「MA の自軍コマンドを1つホールドして」の効果は発動できない（出典: atwiki/page-741「これにライドしたユニットがある間」）", () => {
    expect(activateFlash(thunderState(false))).toBeUndefined();
  });
  it.todo("RS-469: atwiki Q — エンペラー（XG5）の「怪人を持つ」コマンドのホールドは肩代わりできない／「アタックするかわりに」と同様、MA コマンドをホールドすべきタイミングでなければ使えない（出典: atwiki/page-741 コメント）— 【雷の星獣】が未実装");
});

// ===========================================================================
describe("RS-470 ギンガット", () => {
  const TEXT =
    "※特徴「ピンク」を持つSユニットは、自軍コマンドを1つホールドすれば、RCを持っていなくてもこのビークルにライドできる。 【花の星獣】これにライドしたユニットがある間、次の効果を発動する⇒自分がバトルフェイズを行うとき、かわりにチャージフェイズを行ってもよい。";

  it("RS-470: カタログ本文・スペックが出典と一致（出典: atwiki/page-768）", () => {
    expectCatalogText("RS-470", TEXT);
    expectVehicleStats("RS-470", { name: "ギンガット", category: "WB", size: "M", powerCost: 0, features: ["獣"] });
  });

  featureRideTests("RS-470", "ピンク", "SPEC-PINK", "page-768");

  /** 自軍ラッシュフェイズ。ラッシュエリアにギンガット（riding=true ならピンクがライド中）。手札1枚。 */
  const catState = (riding: boolean) =>
    st(
      {
        phase: "rush",
        player1: {
          rush: riding ? [rider("SPEC-PINK", "p", "RS-470:v"), inst("RS-470", "v")] : [inst("SPEC-PINK", "p"), inst("RS-470", "v")],
          hand: [inst("TST-OP", "h")],
          deck: deckCards(3),
        },
      },
      EXTRA,
    );

  /** ラッシュフェイズを終えた直後から、合法手1手でチャージフェイズ（自分の手番）に入れるか。 */
  const canChargeInstead = (s: GameState) => {
    const after = nextPhase(s);
    if (after.phase === "charge" && after.activePlayer === "player1") return true;
    return legal(after).some((a) => {
      try {
        const t = act(after, a);
        return t.phase === "charge" && t.activePlayer === "player1";
      } catch {
        return false;
      }
    });
  };

  it("RS-470: 【花の星獣】ライドしたユニットがある間、バトルフェイズを行うとき、かわりにチャージフェイズを行える（出典: atwiki/page-768「自分がバトルフェイズを行うとき、かわりにチャージフェイズを行ってもよい」）", () => {
    expect(canChargeInstead(catState(true))).toBe(true);
  });

  it("RS-470: 【花の星獣】「行ってもよい」— 通常どおりバトルフェイズに進むこともできる（出典: atwiki/page-768「行ってもよい」）", () => {
    const t = nextPhase(catState(true));
    const battle = t.phase === "battle" || legal(t).some((a) => {
      try {
        return act(t, a).phase === "battle";
      } catch {
        return false;
      }
    });
    expect(battle).toBe(true);
  });

  it("RS-470: 【花の星獣】ライドしたユニットがなければ、ラッシュフェイズの次はバトルフェイズ（チャージフェイズにはできない）（出典: atwiki/page-768「これにライドしたユニットがある間」）", () => {
    expect(canChargeInstead(catState(false))).toBe(false);
    expect(nextPhase(catState(false)).phase).toBe("battle");
  });

  it.todo("RS-470: atwiki Q — スカラベアンデット等でバトルフェイズを行えないターンでも、「かわりに」チャージフェイズを行える（出典: atwiki/page-768 コメント「〜のかわりに、のテキストは〜ができなくても、後半のテキストが実行できる」・R-REPL-03）— 【花の星獣】が未実装");
});

// ===========================================================================
const MECHA = sUnit("SPEC-MECHA", { size: "M", features: ["メカ"], sp: undefined, bp: 3000, category: "ET", powerCost: 9 });
const MECHA_L = sUnit("SPEC-MECHA-L", { size: "L", features: ["メカ"], sp: undefined, bp: 3000, category: "ET" });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { size: "M", features: ["車両"], sp: undefined, bp: 3000, category: "ET" });
const MECHA_DEFS = [MECHA, MECHA_L, PLAIN_M];

describe("RS-471 グランドライナー", () => {
  const TEXT =
    "※敵軍ターン中、これが撃破されて捨札になったとき、自軍コマンドゾーンに特徴「メカ」を持つMユニットのカードがあれば、その中から好きな枚数選び、自軍ラッシュエリアに出してもよい。 【グランドストーム】これは自軍コマンドゾーンに特徴「メカ」を持つMユニットのカードが5枚あれば「SP1」になる。";

  it("RS-471: カタログ本文・スペックが出典と一致（出典: atwiki/page-789）", () => {
    expectCatalogText("RS-471", TEXT);
    expectStats("RS-471", {
      name: "グランドライナー",
      category: "ET",
      size: "XL",
      bp: 7000,
      sp: "special",
      powerCost: "4+",
      features: ["メカ", "人型"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-471: 追加条件 — 自軍「ゴーライナー」1体を捨札にしてラッシュできる（出典: atwiki/page-789「追加条件：自軍｢ゴーライナー｣1体を捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-471", "gl")], rush: [inst("RS-472", "go")], command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-471:gl");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-471:gl")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-472:go")).toBe("discard");
  });

  it("RS-471: 追加条件 — 自軍「ゴーライナー」がいなければラッシュできない／必要パワー4+ はパワー3では不可（出典: atwiki/page-789・R-ADD-01）", () => {
    const none = st({ phase: "rush", player1: { hand: [inst("RS-471", "gl")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "RS-471:gl")).toBe(false);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-471", "gl")], rush: [inst("RS-472", "go")], command: releasedCat("ET", 1), power: powerCards(3), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-471:gl")).toBe(false);
  });

  const mechaCmds = (n: number): CardInstance[] => Array.from({ length: n }, (_, i) => ({ ...inst("SPEC-MECHA", `m${i}`), commandHeld: true }));

  /** 敵軍ターンに BP13000 にアタックされて撃破される。自軍コマンド: メカ M ×3（リリース）、メカ L、メカでない M、ビークル。 */
  const destroyedGL = () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: {
          battle: [inst("RS-471", "gl")],
          command: [inst("SPEC-MECHA", "m0"), inst("SPEC-MECHA", "m1"), inst("SPEC-MECHA", "m2"), inst("SPEC-MECHA-L", "l"), inst("SPEC-PLAIN-M", "pm")],
          deck: deckCards(3),
        },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      MECHA_DEFS,
    );
    return settle(attack(s, "TST-UNIT-7:atk", "RS-471:gl", "player2"));
  };

  it("RS-471: ※ 敵軍ターン中に撃破されて捨札になったとき、自軍コマンドゾーンの「メカ」の M ユニットのカードだけが候補（L・メカでない M は不可）で、必要パワーを問わず出せる（出典: atwiki/page-789「特徴「メカ」を持つMユニットのカードがあれば、その中から好きな枚数選び」・コメント「パワー・カテゴリ・追加条件を無視してラッシュ出来ます」）", () => {
    let s = destroyedGL();
    expect(zoneOf(s, "player1", "RS-471:gl")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-471");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA:m0", "SPEC-MECHA:m1", "SPEC-MECHA:m2"]);
    s = resolveAll(pick(s, "SPEC-MECHA:m0"));
    expect(zoneOf(s, "player1", "SPEC-MECHA:m0")).toBe("rush");
  });

  it("RS-471: ※ 「好きな枚数選び」— 複数枚（3枚すべて）を選んでラッシュエリアに出せる（出典: atwiki/page-789「その中から好きな枚数選び、自軍ラッシュエリアに出してもよい」）", () => {
    let s = destroyedGL();
    for (const id of ["SPEC-MECHA:m0", "SPEC-MECHA:m1", "SPEC-MECHA:m2"]) {
      if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    }
    if (s.pendingEffectChoice && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = resolveAll(s);
    expect(s.players.player1.rush.map((c) => c.instanceId).sort()).toEqual(["SPEC-MECHA:m0", "SPEC-MECHA:m1", "SPEC-MECHA:m2"]);
  });

  it("RS-471: ※ 「出してもよい」— 出さないことを選べる（出典: atwiki/page-789「出してもよい」）", () => {
    const s = destroyedGL();
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.rush).toHaveLength(0);
    expect(t.players.player1.command).toHaveLength(5);
  });

  it("RS-471: ※ 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-789「敵軍ターン中、」）", () => {
    const s = st(
      { player1: { battle: [inst("RS-471", "gl")], command: [inst("SPEC-MECHA", "m0")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "e")] } },
      MECHA_DEFS,
    );
    const t = settle(attack(s, "RS-471:gl", "TST-UNIT-7:e"));
    expect(zoneOf(t, "player1", "RS-471:gl")).toBe("discard");
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(t, "player1", "SPEC-MECHA:m0")).toBe("command");
  });

  it("RS-471: ※ 自軍コマンドゾーンに「メカ」の M ユニットのカードがなければ何も出さない（出典: atwiki/page-789「…があれば」）", () => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-471", "gl")], command: [inst("SPEC-MECHA-L", "l"), inst("TST-OP-ET", "op")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
      },
      MECHA_DEFS,
    );
    const t = resolveAll(attack(s, "TST-UNIT-7:atk", "RS-471:gl", "player2"));
    expect(zoneOf(t, "player1", "RS-471:gl")).toBe("discard");
    expect(t.players.player1.rush).toHaveLength(0);
  });

  it("RS-471: 【グランドストーム】自軍コマンドゾーンに「メカ」の M ユニットのカードが5枚あれば「SP1」になる（出典: atwiki/page-789「…が5枚あれば「SP1」になる」）", () => {
    const s = st({ player1: { rush: [inst("RS-471", "gl")], command: mechaCmds(5) } }, MECHA_DEFS);
    expect(spOf(s, "player1", "RS-471:gl")).toBe(1);
    expect(spOf(enter(s, "RS-471:gl"), "player1", "RS-471:gl")).toBe(1);
  });

  it("RS-471: 【グランドストーム】4枚では SP！は 0 のまま（出典: atwiki/page-789「5枚あれば」）", () => {
    const s = st({ player1: { rush: [inst("RS-471", "gl")], command: mechaCmds(4) } }, MECHA_DEFS);
    expect(spOf(enter(s, "RS-471:gl"), "player1", "RS-471:gl")).toBe(0);
  });
});

// ===========================================================================
describe("RS-472 ゴーライナー", () => {
  const TEXT =
    "【現場への搬送】これをラッシュしたとき、自軍コマンドゾーンのカードを好きな枚数選び捨札にしてもよい。そうしたとき、自軍山札から特徴「メカ」を持つMユニットのカードを、捨札にした枚数と同じ枚数まで好きな数選び、自軍コマンドゾーンにホールド状態で置く。その後、山札をシャッフルする。";

  it("RS-472: カタログ本文・スペックが出典と一致（出典: atwiki/page-790）", () => {
    expectCatalogText("RS-472", TEXT);
    expectStats("RS-472", { name: "ゴーライナー", category: "ET", size: "XL", bp: 3000, sp: undefined, powerCost: 3, features: ["メカ", "車両", "母艦"] });
  });

  /** ゴーライナーを手札からラッシュする（ET コマンド3つ。1つはラッシュの支払いでホールド）。山札: メカM ×3、メカL、オペレーション。 */
  const rushGo = () => {
    const s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-472", "go")],
          command: releasedCat("ET", 3),
          power: powerCards(3),
          deck: [inst("SPEC-MECHA", "d1"), inst("TST-OP", "d2"), inst("SPEC-MECHA", "d3"), inst("SPEC-MECHA-L", "d4"), inst("SPEC-MECHA", "d5")],
        },
      },
      MECHA_DEFS,
    );
    const r = rushFromHand(s, "player1", "RS-472:go");
    expect(r.ok).toBe(true);
    return r.state;
  };
  /** コマンド2枚（cET1, cET2）を捨札にして山札の選択へ進む。 */
  const discardTwo = () => confirm(pick(pick(rushGo(), "TST-OP-ET:cET1"), "TST-OP-ET:cET2"));

  it("RS-472: 【現場への搬送】ラッシュしたとき、自軍コマンドゾーンのカード（ホールド状態のものも）を好きな枚数選べ、選ばないこともできる（出典: atwiki/page-790「自軍コマンドゾーンのカードを好きな枚数選び捨札にしてもよい」）", () => {
    const s = rushGo();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-472");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:cET0", "TST-OP-ET:cET1", "TST-OP-ET:cET2"]);
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.command).toHaveLength(3);
    expect(t.players.player1.deck).toHaveLength(5);
  });

  it("RS-472: 【現場への搬送】2枚捨てたら、山札の「メカ」の M ユニットのカードだけが候補（L・オペレーションは不可）で、選んだカードはホールド状態でコマンドゾーンに置かれる（出典: atwiki/page-790「特徴「メカ」を持つMユニットのカードを…自軍コマンドゾーンにホールド状態で置く」）", () => {
    let s = discardTwo();
    expect(zoneOf(s, "player1", "TST-OP-ET:cET1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP-ET:cET2")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA:d1", "SPEC-MECHA:d3", "SPEC-MECHA:d5"]);
    s = pick(s, "SPEC-MECHA:d1");
    const placed = s.players.player1.command.find((c) => c.instanceId === "SPEC-MECHA:d1");
    expect(placed?.commandHeld).toBe(true);
  });

  it("RS-472: 【現場への搬送】捨札にした枚数（2）まで選べる — 2枚をコマンドゾーンに置ける（出典: atwiki/page-790「捨札にした枚数と同じ枚数まで好きな数選び」）", () => {
    let s = pick(discardTwo(), "SPEC-MECHA:d1");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-MECHA:d3");
    s = resolveAll(pick(s, "SPEC-MECHA:d3"));
    expect(zoneOf(s, "player1", "SPEC-MECHA:d3")).toBe("command");
  });

  it("RS-472: 【現場への搬送】その後、山札をシャッフルする — 選ばなかったカードは山札に残る（出典: atwiki/page-790「その後、山札をシャッフルする」）", () => {
    let s = pick(discardTwo(), "SPEC-MECHA:d1");
    s = resolveAll(s);
    expect(s.players.player1.deck.map((c) => c.instanceId).sort()).toEqual(["SPEC-MECHA-L:d4", "SPEC-MECHA:d3", "SPEC-MECHA:d5", "TST-OP:d2"]);
    expect(s.players.player1.discard.map((c) => c.instanceId).sort()).toEqual(["TST-OP-ET:cET1", "TST-OP-ET:cET2"]);
  });

  it("RS-472: 【現場への搬送】山札から何も選ばないこともできる（捨てたコマンドは戻らない）（出典: atwiki/page-790「…まで好きな数選び」）", () => {
    const s = discardTwo();
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player1.command.map((c) => c.instanceId)).toEqual(["TST-OP-ET:cET0"]);
  });

  it("RS-472: 【現場への搬送】ラッシュせずにバトルエリアに出ても発動しない（出典: atwiki/page-790「これをラッシュしたとき」）", () => {
    const s = st({ player1: { rush: [inst("RS-472", "go")], command: releasedCat("ET", 2), deck: [inst("SPEC-MECHA", "d1")] } }, MECHA_DEFS);
    const t = enter(s, "RS-472:go");
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(t.players.player1.command).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-473 タイムシャドウ", () => {
  const TEXT =
    "【ブルームーンスラッシュ】これが自軍バトルエリアにある間、敵軍ターン中、相手がパワーゾーンにカードを置かずにチャージフェイズを終えたとき、敵軍パワーゾーンのオモテ向きのカードから、必要パワーの数字が2以下のカードを1枚選び、ダメージにしてもよい。";

  it("RS-473: カタログ本文・スペックが出典と一致（出典: atwiki/page-791）", () => {
    expectCatalogText("RS-473", TEXT);
    expectStats("RS-473", {
      name: "タイムシャドウ",
      category: "OT",
      size: "L",
      bp: 9000,
      sp: undefined,
      powerCost: "6+",
      features: ["メカ", "人型", "忍者"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-473: 追加条件 — 自軍「タイムシャドウSM」1体を捨札にしてラッシュでき、いなければラッシュできない（出典: atwiki/page-791「追加条件：自軍「タイムシャドウSM」1体を捨札にする」）", () => {
    const ok = st({ phase: "rush", player1: { hand: [inst("RS-473", "ts")], rush: [inst("RS-474", "sm")], command: releasedCat("OT", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(ok, "player1", "RS-473:ts");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-473:ts")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-474:sm")).toBe("discard");
    const ng = st({ phase: "rush", player1: { hand: [inst("RS-473", "ts")], command: releasedCat("OT", 1), power: powerCards(9), deck: deckCards(3) } });
    expect(canStartRush(ng, "player1", "RS-473:ts")).toBe(false);
  });

  /** 敵軍（player2）のチャージフェイズ。敵軍パワー（オモテ）: TST-OP-MA（必要パワー1）、TST-UNIT-2（2）、TST-OP（3）。 */
  const chargeState = (zone: "battle" | "rush" = "battle") =>
    st({
      activePlayer: "player2",
      phase: "charge",
      player1: { [zone]: [inst("RS-473", "ts")], deck: deckCards(3) },
      player2: { hand: [inst("TST-OP", "h")], power: [inst("TST-OP-MA", "p1"), inst("TST-UNIT-2", "p2"), inst("TST-OP", "p3")], deck: deckCards(5, "e") },
    });

  it("RS-473: 【ブルームーンスラッシュ】敵軍ターン中、相手がパワーゾーンにカードを置かずにチャージフェイズを終えたとき、敵軍パワーゾーンのオモテ向きの必要パワー2以下のカードを1枚選びダメージにできる（任意）（出典: atwiki/page-791）", () => {
    let s = nextPhase(chargeState());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-473");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:p1", "TST-UNIT-2:p2"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "TST-UNIT-2:p2"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-2:p2")?.faceDown).toBe(true);
  });

  it("RS-473: 【ブルームーンスラッシュ】相手がチャージフェイズにパワーゾーンへカードを置いたときは発動しない（出典: atwiki/page-791「パワーゾーンにカードを置かずに」）", () => {
    const s = chargeState();
    const charge = legal(s).find((a) => a.type === "charge_power" && a.playerId === "player2");
    expect(charge).toBeDefined();
    let t = act(s, charge!);
    if (t.phase === "charge") t = nextPhase(t);
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(t.players.player2.power.every((c) => !c.faceDown)).toBe(true);
  });

  it("RS-473: 【ブルームーンスラッシュ】ラッシュエリアにあるときは発動しない（出典: atwiki/page-791「これが自軍バトルエリアにある間」）", () => {
    const t = nextPhase(chargeState("rush"));
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(t.players.player2.power.every((c) => !c.faceDown)).toBe(true);
  });
});
