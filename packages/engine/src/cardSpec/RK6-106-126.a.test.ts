/**
 * カード別スペック: RK-106〜RK-112（ザ・マスクドライダーEXP vol.2 仮面ライダーアギトFF〜オルタナティブ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2（本範囲のカードの Q&A なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-STK-03、R-STK-05、R-KW-REG、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア」を N／NR／R として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）: なし（rulesSpec/05-bp-strike-damage.test.ts は RK-112 をアタックされる側の駒として使うだけ）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attack,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  heldUnit,
  inst,
  intercept,
  interceptOffered,
  mount,
  mountedOn,
  p1Battle,
  pick,
  rcRideOff,
  rcUnit,
  registerOffered,
  releasedCat,
  releasedN,
  resolveAll,
  rideOff,
  rideOffOffered,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RK6-106-126.helpers";

const RC2000 = rcUnit("SPEC-RC2000", { category: "MA", bp: 2000 });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const EM = sUnit("SPEC-EM", { bp: 5000, powerCost: 3, size: "M" });
const BIG = sUnit("SPEC-BIG", { bp: 13000 });
/** 特徴「警察」を持ち、RC を持たない S ユニット（BP3000）。 */
const POLICE = sUnit("SPEC-POLICE", { category: "ET", bp: 3000, features: ["警察"] });
/** RC も「警察」も持たない S ユニット。 */
const PLAIN = sUnit("SPEC-PLAIN", { category: "ET", bp: 3000, features: ["男"] });
const EXTRA = [RC2000, E1, EM, BIG, POLICE, PLAIN, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターン（バトルフェイズ）の盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** vehicle に rider がライドしている組（[ビークル, ユニット]）。 */
const riding = (vehicle: CardInstance, rider: CardInstance): CardInstance[] => [vehicle, { ...rider, mountedOnInstanceId: vehicle.instanceId }];

// ===========================================================================
describe("RK-106 仮面ライダーアギトFF", () => {
  const TEXT =
    "※これはライド中、「SP1/3」になる。 【セイバースラッシュ】敵軍バトルエリアから、ホールド状態のSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-106: カタログ本文・スペックが出典と一致（出典: atwiki/page-691）", () => {
    expectCatalogText("RK-106", TEXT);
    expectStats("RK-106", { name: "仮面ライダーアギトFF", category: "MA", size: "S", bp: 4000, sp: "special", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "賢者の石"] });
    expectRarityIn("RK-106", ["NR"]);
  });

  it("RK-106: ※ ライド中は「SP1/3」になる — 3番目に並んでいれば SP1（出典: atwiki/page-691「※これはライド中、「SP1/3」になる」・R-STK-03）", () => {
    const s = board({ battle: [...fill(2), ...riding(inst("SPEC-VEHICLE", "v"), inst("RK-106", "ff"))] });
    expect(spOf(s, "player1", "RK-106:ff")).toBe(1);
  });

  it("RK-106: ※ ライド中でも3番目でなければ SP1 にならない（出典: atwiki/page-691・R-STK-03「分母と同じ並び順にある間は常に SP1」）", () => {
    const s = board({ battle: [...fill(1), ...riding(inst("SPEC-VEHICLE", "v"), inst("RK-106", "ff"))] });
    expect(spOf(s, "player1", "RK-106:ff")).toBe(0);
  });

  it("RK-106: ※ ライドしていなければ、3番目に並んでいても SP1 にならない（SP「！」のまま。RC はナンバーではないので NC にもならない）（出典: atwiki/page-691「SP：！」・カード評価「ライド中でなければSP1/3になれない」）", () => {
    const s = board({ battle: [...fill(2), inst("RK-106", "ff")] });
    expect(spOf(s, "player1", "RK-106:ff")).toBe(0);
  });

  it("RK-106: ※ ライドしたまま進めば、3番目のこのユニットは SP1 でストライクできる（出典: atwiki/page-691「ライド中、「SP1/3」になる」）", () => {
    let s = board({ battle: fill(2), rush: [inst("RK-106", "ff"), inst("SPEC-VEHICLE", "v")] });
    s = rideOff(mount(s, "RK-106:ff", "SPEC-VEHICLE:v"), false);
    expect(mountedOn(s, "player1", "RK-106:ff")).toBe("SPEC-VEHICLE:v");
    expect(spOf(s, "player1", "RK-106:ff")).toBe(1);
  });

  const slash = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-106", "ff"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-106:ff", "SPEC-VEHICLE:v");
  const enemy = {
    battle: [heldUnit("SPEC-E1", "h"), inst("SPEC-E1", "r"), heldUnit("SPEC-EM", "hm")],
    rush: [heldUnit("SPEC-E1", "rh")],
  };

  it("RK-106: RC — 敵軍バトルエリアのホールド状態の S ユニットだけを選べる（リリース状態・ラッシュエリア・M ユニットは選べない）（任意）（出典: atwiki/page-691「敵軍バトルエリアから、ホールド状態のSユニットを1体選び」「置いてもよい」）", () => {
    const s = slash(enemy);
    expectChoiceFrom(s, "player1", "RK-106");
    expect(choiceIds(s)).toEqual(["SPEC-E1:h"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-106: RC — 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-691「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = settle(pick(slash(enemy), "SPEC-E1:h"));
    expect(zoneOf(s, "player2", "SPEC-E1:h")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E1:h")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-106: RC — 選ばなければ何も起きない（出典: atwiki/page-691「置いてもよい」）", () => {
    const s = settle(skip(slash(enemy)));
    expect(zoneOf(s, "player2", "SPEC-E1:h")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RK-107 マシントルネイダー", () => {
  const TEXT = "【硬化装甲】これにライドしているユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。";

  it("RK-107: カタログ本文・スペックが出典と一致（出典: atwiki/page-694）", () => {
    expectCatalogText("RK-107", TEXT);
    expectVehicleStats("RK-107", { name: "マシントルネイダー", category: "MA", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-107", ["NR"]);
  });

  const commands = [...releasedCat("MA", 2), heldUnit("TST-OP", "held")];

  it("RK-107: 敵軍ターン中、これにライドしているユニットはリリース状態の自軍コマンド1つにつき BP+1000（ホールド状態のコマンドは数えない）（出典: atwiki/page-694「リリース状態の自軍コマンド1つにつきBP+1000される」）", () => {
    const s = enemyTurn({ battle: riding(inst("RK-107", "mt"), inst("SPEC-RC2000", "r")), command: commands });
    expect(bpOf(s, "player1", "SPEC-RC2000:r")).toBe(4000);
  });

  it("RK-107: 自軍ターン中は BP が変わらない（出典: atwiki/page-694「敵軍ターン中、」）", () => {
    const s = board({ battle: riding(inst("RK-107", "mt"), inst("SPEC-RC2000", "r")), command: commands });
    expect(bpOf(s, "player1", "SPEC-RC2000:r")).toBe(2000);
  });

  it("RK-107: これにライドしていないユニットは BP が変わらない（出典: atwiki/page-694「これにライドしているユニットは」）", () => {
    const s = enemyTurn({ battle: [inst("RK-107", "mt"), inst("SPEC-RC2000", "r")], command: commands });
    expect(bpOf(s, "player1", "SPEC-RC2000:r")).toBe(2000);
  });

  it("RK-107: ラッシュエリアでライドしたままのユニットも、敵軍ターン中は BP が上がる（出典: atwiki/page-694（エリアの限定がない）・R-TGT-01）", () => {
    const s = enemyTurn({ rush: riding(inst("RK-107", "mt"), inst("SPEC-RC2000", "r")), command: commands });
    expect(bpOf(s, "player1", "SPEC-RC2000:r")).toBe(4000);
  });
});

// ===========================================================================
describe("RK-108 仮面ライダーギルス", () => {
  const TEXT =
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ギルスヒールクロウ】このユニットをホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RK-108: カタログ本文・スペックが出典と一致（出典: atwiki/page-693）", () => {
    expectCatalogText("RK-108", TEXT);
    expectStats("RK-108", { name: "仮面ライダーギルス", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-108", ["R"]);
  });

  it("RK-108: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-693「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-108", "gl")] }, "RK-108:gl"))).toBe(true);
  });

  const claw = (p2: Partial<GameState["players"]["player2"]>) =>
    rcRideOff(board({ rush: [inst("RK-108", "gl"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-108:gl", "SPEC-VEHICLE:v");
  const enemy = {
    battle: [heldUnit("SPEC-E1", "h"), inst("SPEC-E1", "r"), inst("SPEC-EM", "m")],
    rush: [inst("SPEC-E1", "rr")],
  };

  it("RK-108: RC — このユニットをホールドするかを選べる（任意）（出典: atwiki/page-693「このユニットをホールドしてもよい」）", () => {
    const s = claw(enemy);
    expectChoiceFrom(s, "player1", "RK-108");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-108: RC — ホールドすると、敵軍バトルエリアの S ユニット（ホールド・リリースを問わない。ラッシュエリア・M ユニットは選べない）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-693「そうしたとき、敵軍バトルエリアからSユニットを1体選び」）", () => {
    const s = confirm(claw(enemy));
    expect(cardIn(s, "player1", "RK-108:gl")?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", "RK-108");
    expect(choiceIds(s)).toEqual(["SPEC-E1:h", "SPEC-E1:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-108: RC — 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-693「持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = settle(pick(confirm(claw(enemy)), "SPEC-E1:r"));
    expect(zoneOf(s, "player2", "SPEC-E1:r")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E1:r")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-108: RC — ホールドしなければ、このユニットはリリース状態のままで、敵軍ユニットも選ばない（出典: atwiki/page-693「ホールドしてもよい。そうしたとき、」）", () => {
    const s = settle(skip(claw(enemy)));
    expect(cardIn(s, "player1", "RK-108:gl")?.commandHeld ?? false).toBe(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-108");
    expect(zoneOf(s, "player2", "SPEC-E1:r")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-109 ギルスレイダー", () => {
  const TEXT =
    "※これは、自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出る事ができる。 【自己修復能力】ホールド状態のユニットがこれにライドするとき、そのユニットをリリースしてもよい。";

  it("RK-109: カタログ本文・スペックが出典と一致（出典: atwiki/page-695）", () => {
    expectCatalogText("RK-109", TEXT);
    expectVehicleStats("RK-109", { name: "ギルスレイダー", category: "MA", powerCost: 4, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("RK-109", ["N"]);
  });

  it("RK-109: ※ 自軍 S ユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-695「自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出る事ができる」）", () => {
    let s = board({ battle: fill(1), rush: [inst("RK-109", "gr")] });
    expect(canEnter(s, "RK-109:gr")).toBe(true);
    s = enter(s, "RK-109:gr");
    expect(zoneOf(s, "player1", "RK-109:gr")).toBe("battle");
  });

  it("RK-109: ※ 自軍バトルエリアに S ユニットがなければ、ライドされずには出られない（出典: atwiki/page-695）", () => {
    expect(canEnter(board({ rush: [inst("RK-109", "gr")] }), "RK-109:gr")).toBe(false);
  });

  it("RK-109: ホールド状態のユニットがこれにライドするとき、そのユニットをリリースするかを選べる（任意）（出典: atwiki/page-695「ホールド状態のユニットがこれにライドするとき、そのユニットをリリースしてもよい」）", () => {
    const s = mount(board({ rush: [heldUnit("SPEC-RC2000", "h"), inst("RK-109", "gr")] }), "SPEC-RC2000:h", "RK-109:gr");
    expectChoiceFrom(s, "player1", "RK-109");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-109: リリースを選ぶと、ライドしたユニットはリリース状態になる（出典: atwiki/page-695）", () => {
    const s = confirm(mount(board({ rush: [heldUnit("SPEC-RC2000", "h"), inst("RK-109", "gr")] }), "SPEC-RC2000:h", "RK-109:gr"));
    expect(cardIn(s, "player1", "SPEC-RC2000:h")?.commandHeld ?? false).toBe(false);
    expect(mountedOn(s, "player1", "SPEC-RC2000:h")).toBe("RK-109:gr");
  });

  it("RK-109: リリースしなければホールド状態のまま（出典: atwiki/page-695「リリースしてもよい」）", () => {
    const s = skip(mount(board({ rush: [heldUnit("SPEC-RC2000", "h"), inst("RK-109", "gr")] }), "SPEC-RC2000:h", "RK-109:gr"));
    expect(cardIn(s, "player1", "SPEC-RC2000:h")?.commandHeld).toBe(true);
  });

  it("RK-109: リリース状態のユニットがライドしたときは何も選ばない（出典: atwiki/page-695「ホールド状態のユニットが」）", () => {
    const s = mount(board({ rush: [inst("SPEC-RC2000", "r"), inst("RK-109", "gr")] }), "SPEC-RC2000:r", "RK-109:gr");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-109");
    expect(rideOffOffered(s)).toBe(true);
  });

  it("RK-109: ホールド状態のギルスが乗ってリリースし、ライドオフすれば【ギルスヒールクロウ】をもう一度使える（出典: atwiki/page-693 カード評価「愛車のギルスレイダーに乗ればホールドも解除され、…もう一度能力を使うことが出来る」）", () => {
    let s = mount(board({ rush: [heldUnit("RK-108", "gl"), inst("RK-109", "gr")] }, { battle: [inst("SPEC-E1", "e")] }), "RK-108:gl", "RK-109:gr");
    s = confirm(s);
    s = rideOff(s, true);
    expectChoiceFrom(s, "player1", "RK-108");
  });
});

// ===========================================================================
describe("RK-110 V-1システム", () => {
  const TEXT =
    "【性能の限界】敵軍ターン中、これが撃破されて捨札になったとき、このユニットカードを自軍コマンドゾーンにホールド状態で置いてもよい。（置けなければこの効果は発動できない）";

  it("RK-110: カタログ本文・スペックが出典と一致（出典: atwiki/page-631）", () => {
    expectCatalogText("RK-110", TEXT);
    expectStats("RK-110", { name: "V-1システム", category: "ET", size: "S", bp: 500, sp: "1/5", powerCost: 1, features: ["メカ", "男", "警察"] });
    expectRarityIn("RK-110", ["N"]);
  });

  it("RK-110: 敵軍ターン中にバトルで撃破されて捨札になったとき、自軍コマンドゾーンにホールド状態で置くかを選べる（任意）（出典: atwiki/page-631「このユニットカードを自軍コマンドゾーンにホールド状態で置いてもよい」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-110", "v1")] }, "RK-110:v1");
    expectChoiceFrom(s, "player1", "RK-110");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-110: 置くことを選ぶと、自軍コマンドゾーンにホールド状態で置かれる（出典: atwiki/page-631）", () => {
    const s = settle(confirm(attackedInEnemyTurn({ battle: [inst("RK-110", "v1")] }, "RK-110:v1")));
    expect(zoneOf(s, "player1", "RK-110:v1")).toBe("command");
    expect(cardIn(s, "player1", "RK-110:v1")?.commandHeld).toBe(true);
  });

  it("RK-110: 置かなければ捨札に残る（出典: atwiki/page-631「置いてもよい」）", () => {
    const s = settle(skip(attackedInEnemyTurn({ battle: [inst("RK-110", "v1")] }, "RK-110:v1")));
    expect(zoneOf(s, "player1", "RK-110:v1")).toBe("discard");
  });

  it("RK-110: 自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-631「敵軍ターン中、」）", () => {
    const s = settle(attack(board({ battle: [inst("RK-110", "v1")] }, { battle: [inst("SPEC-BIG", "big")] }), "RK-110:v1", "SPEC-BIG:big"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-110");
    expect(zoneOf(s, "player1", "RK-110:v1")).toBe("discard");
  });

  it("RK-110: 自軍コマンドゾーンが5枚で置けなければ発動しない（捨札に残る）（出典: atwiki/page-631「（置けなければこの効果は発動できない）」・R-ZONE-08）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("RK-110", "v1")], command: releasedN(5) }, "RK-110:v1");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-110");
    expect(zoneOf(s, "player1", "RK-110:v1")).toBe("discard");
  });

  it("RK-110: 敵軍ターン中にラッシュエリアで効果により撃破されたときも置ける（出典: atwiki/page-631（エリアの限定がない）・R-TGT-01）", () => {
    // 敵軍（player2）がギンガイオー（RS-687【ガルコンボーガン】敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する）をバトルエリアに出す。
    let s = st({ activePlayer: "player2", player1: { rush: [inst("RK-110", "v1")], deck: deckCards(3) }, player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") } }, EXTRA);
    s = enter(s, "RS-687:gg", "player2");
    if (s.pendingEffectChoice?.sourceCardId === "RS-687") s = pick(s, "RK-110:v1");
    s = settle(s);
    expectChoiceFrom(s, "player1", "RK-110");
    s = settle(confirm(s));
    expect(zoneOf(s, "player1", "RK-110:v1")).toBe("command");
  });

});

// ===========================================================================
describe("RK-111 ガードチェイサー", () => {
  const TEXT =
    "※特徴「警察」を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。 【非常警戒態勢】これにライドしているSユニットは次の能力を得る⇒ これが自軍ラッシュエリアにある間、相手にストライクされたとき、これをバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい。そうしたとき、そのストライクは無効になる。";

  it("RK-111: カタログ本文・スペックが出典と一致（出典: atwiki/page-660）", () => {
    expectCatalogText("RK-111", TEXT);
    expectVehicleStats("RK-111", { name: "ガードチェイサー", category: "ET", powerCost: 4, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-111", ["N"]);
  });

  it("RK-111: ※ 特徴「警察」を持つ S ユニットは、RC を持っていなくてもライドできる（出典: atwiki/page-660「ＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    let s = board({ rush: [inst("SPEC-POLICE", "po"), inst("RK-111", "gc")] });
    expect(canMount(s, "SPEC-POLICE:po", "RK-111:gc")).toBe(true);
    s = mount(s, "SPEC-POLICE:po", "RK-111:gc");
    expect(mountedOn(s, "player1", "SPEC-POLICE:po")).toBe("RK-111:gc");
  });

  it("RK-111: ※ 「警察」も RC も持たない S ユニットはライドできない（出典: atwiki/page-660・R-KW-RC-01）", () => {
    expect(canMount(board({ rush: [inst("SPEC-PLAIN", "pl"), inst("RK-111", "gc")] }), "SPEC-PLAIN:pl", "RK-111:gc")).toBe(false);
  });

  /** 敵軍（player2）の SP1・BP1000 のユニットが自軍（player1）にストライクする。 */
  const struck = (p1: Partial<GameState["players"]["player1"]>) =>
    strike(enemyTurn(p1, { battle: [inst("TST-UNIT-0", "st")] }), "TST-UNIT-0:st", "player2");

  it("RK-111: 自軍ラッシュエリアでこれにライドしている S ユニットは、ストライクされたとき、バトルエリアに出てストライクしてきたユニットとバトルできる（出典: atwiki/page-660「相手にストライクされたとき、これをバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい」）", () => {
    const s = struck({ rush: riding(inst("RK-111", "gc"), inst("SPEC-POLICE", "po")) });
    expect(interceptOffered(s, "SPEC-POLICE:po")).toBe(true);
  });

  it("RK-111: バトルすると、そのストライクは無効になり（ダメージを受けない）、BP の低いストライクしてきたユニットは撃破される。出たユニットはライドしたままバトルエリアにいる（出典: atwiki/page-660「そうしたとき、そのストライクは無効になる」・R-STK-05）", () => {
    const s = settle(intercept(struck({ rush: riding(inst("RK-111", "gc"), inst("SPEC-POLICE", "po")) }), "SPEC-POLICE:po"));
    expect(damageOf(s, "player1")).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:st")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-POLICE:po")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-111:gc")).toBe("battle");
    expect(mountedOn(s, "player1", "SPEC-POLICE:po")).toBe("RK-111:gc");
  });

  it("RK-111: バトルしなければストライクのダメージを受ける（出典: atwiki/page-660「バトルしてもよい」）", () => {
    const s = settle(struck({ rush: riding(inst("RK-111", "gc"), inst("SPEC-POLICE", "po")) }));
    expect(damageOf(s, "player1")).toBe(1);
    expect(zoneOf(s, "player1", "SPEC-POLICE:po")).toBe("rush");
  });

  it("RK-111: ライドしていないユニットは出られない（出典: atwiki/page-660「これにライドしているSユニットは次の能力を得る」）", () => {
    const s = struck({ rush: [inst("RK-111", "gc"), inst("SPEC-POLICE", "po")] });
    expect(interceptOffered(s, "SPEC-POLICE:po")).toBe(false);
  });

  it("RK-111: バトルエリアでライドしているユニットは出せない（出典: atwiki/page-660「これが自軍ラッシュエリアにある間」）", () => {
    const s = struck({ battle: riding(inst("RK-111", "gc"), inst("SPEC-POLICE", "po")) });
    expect(interceptOffered(s, "SPEC-POLICE:po")).toBe(false);
  });
});

// ===========================================================================
describe("RK-112 オルタナティブ", () => {
  const TEXT =
    "※これはライドオフしたときストライクできない。 【スラッシュダガー】敵軍バトルエリアからBPが本来のBPではないSユニットを1体選び撃破してもよい。";

  it("RK-112: カタログ本文・スペックが出典と一致（出典: atwiki/page-644）", () => {
    expectCatalogText("RK-112", TEXT);
    expectStats("RK-112", { name: "オルタナティブ", category: "WB", size: "S", bp: 1000, sp: "1/2", powerCost: 2, comboNumber: "RC", features: ["男", "ミラーライダー", "加速"] });
    expectRarityIn("RK-112", ["NR"]);
  });

  const dagger = (p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-112", "al"), inst("SPEC-VEHICLE", "v")], ...p1 }, p2), "RK-112:al", "SPEC-VEHICLE:v");
  // サイドバッシャーVM（RK-120「※これにライドしているユニットはBP+1000される」）にライドしたユニットは BP が本来の BP ではない。
  const enemy = {
    battle: [...riding(inst("RK-120", "vm"), inst("SPEC-RC2000", "up")), inst("SPEC-E1", "same")],
    rush: riding(inst("RK-120", "vm2"), inst("SPEC-RC2000", "rr")),
  };

  it("RK-112: ※ ライドオフしたときはストライクできない（出典: atwiki/page-644「※これはライドオフしたときストライクできない」）", () => {
    // 撃破できる敵軍ユニットがいない（RC の選択は開かない）盤面で確かめる。
    const s = settle(dagger({}, { battle: fill(1) }));
    expect(canStrike(s, "RK-112:al")).toBe(false);
  });

  it("RK-112: RC — 敵軍バトルエリアの、BP が本来の BP ではない S ユニットだけを選べる（本来の BP のまま・ラッシュエリアのユニットは選べない）（任意）（出典: atwiki/page-644「敵軍バトルエリアからBPが本来のBPではないSユニットを1体選び」・カード評価「ライドやオペレーションで強化されているSユニットは全て対象」）", () => {
    const s = dagger(enemy);
    expectChoiceFrom(s, "player1", "RK-112");
    expect(choiceIds(s)).toEqual(["SPEC-RC2000:up"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-112: RC — 選んだユニットを撃破する（出典: atwiki/page-644「撃破してもよい」）", () => {
    const s = resolveAll(pick(dagger(enemy), "SPEC-RC2000:up"));
    expect(zoneOf(s, "player2", "SPEC-RC2000:up")).toBe("discard");
  });

  it("RK-112: RC — 選ばなければ何も撃破しない（出典: atwiki/page-644「撃破してもよい」）", () => {
    const s = settle(skip(dagger(enemy)));
    expect(zoneOf(s, "player2", "SPEC-RC2000:up")).toBe("battle");
  });
});

