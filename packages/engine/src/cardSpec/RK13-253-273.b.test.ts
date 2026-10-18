/**
 * カード別スペック: RK-260〜RK-266（ザ・マスクドライダーEXP vol.4 一ツ目タイタン〜機甲隊長ガテゾーン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-260」〜「RK-266」とカード名で検索）。本範囲の atwiki のカードページに公式 Q&A の転載はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-MORPH、R-KW-RESIST、R-RIDE 等）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの（重複させない）:
 *  - RK-264 の「相手は自分自身の…を選び」がブレイカー等の対象可否の判定を通ること — rulesSpec/07-breaker.test.ts R-KW-BREAKER-03
 *  - ※モーフの一般則（置き換え先の状態・パワーゾーン・完全一致）— rulesSpec/07-morph.test.ts（本範囲では各カードの特徴の完全一致だけを確かめる）
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  attackUntilRegister,
  attackersOf,
  canEnter,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  enemyBoard,
  enemyRushes,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  faceDown,
  faceUp,
  fill,
  heldUnit,
  inst,
  morphCandidates,
  mount,
  p1Battle,
  pick,
  pickAs,
  rcRideOff,
  registerOffered,
  released,
  resident,
  resolveAll,
  settle,
  skip,
  sUnit,
  attack,
  targetsOf,
  toTurnEnd,
  withStacked,
  zoneOf,
} from "./RK13-253-273.helpers";

const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3M = sUnit("SPEC-C3M", { bp: 1000, powerCost: 3, size: "M" });
const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const RC3000 = sUnit("SPEC-RC3000", { bp: 3000, powerCost: 1, comboNumber: "RC" });
const MECHA = sUnit("SPEC-MECHA", { category: "DA", bp: 1000, features: ["メカ"] });
const E1000 = sUnit("SPEC-E1000", { bp: 1000, sp: 1 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000, sp: 1 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500, sp: 1 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000, sp: 1 });
const EM2000 = sUnit("SPEC-EM2000", { bp: 2000, sp: 1, size: "M" });
const EXTRA = [PLAIN_VEHICLE, C2, C3, C3M, ENEMY0, RC3000, MECHA, E1000, E2000, E3500, E5000, EM2000];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

// ===========================================================================
describe("RK-260 一ツ目タイタン", () => {
  const TEXT =
    "【体内マグマ】これが自軍エリアにある間、自分がターンを終えるとき、自軍捨札からカードを1枚選び、これの下にウラ向きで重ねてもよい。これがユニットでなくなるとき、この下に重ねたウラ向きのカードをすべて捨札にする。そうして捨札にするとき、それが敵軍ターン中なら、捨札にするカード1枚につき、そのカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい。";

  it("RK-260: カタログ本文・スペックが出典と一致（出典: atwiki/page-1257）", () => {
    expectCatalogText("RK-260", TEXT);
    expectStats("RK-260", { name: "一ツ目タイタン", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 4, features: ["ブラックサタン", "男", "改造人間"] });
    expectRarityIn("RK-260", ["NR"]);
  });

  const ending = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    toTurnEnd(board({ battle: [inst("RK-260", "ti")], discard: [inst("SPEC-C3", "d3"), inst("TST-OP", "dop")], ...p1 }), "RK-260");

  it.fails("RK-260: 【体内マグマ】自分がターンを終えるとき、自軍捨札からカードを1枚選ぶか（任意。ユニットカードに限らない）を選べる（出典: atwiki/page-1257「自軍捨札からカードを1枚選び、これの下にウラ向きで重ねてもよい」）", () => {
    const s = ending();
    expectChoiceFrom(s, "player1", "RK-260");
    expect(choiceIds(s)).toEqual(["SPEC-C3:d3", "TST-OP:dop"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-260: 選んだカードはこれの下にウラ向きで重なる（捨札から離れる）（出典: atwiki/page-1257「これの下にウラ向きで重ねて」）", () => {
    const s = settle(pick(ending(), "SPEC-C3:d3"));
    const under = cardIn(s, "player1", "RK-260:ti")?.stackedCards ?? [];
    expect(under.map((c) => c.instanceId)).toEqual(["SPEC-C3:d3"]);
    expect(under[0]?.faceDown).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-C3:d3")).toBeNull();
  });

  it.fails("RK-260: 重ねないことも選べる（出典: atwiki/page-1257「重ねてもよい」）", () => {
    const s = settle(skip(ending()));
    expect(cardIn(s, "player1", "RK-260:ti")?.stackedCards ?? []).toEqual([]);
    expect(zoneOf(s, "player1", "SPEC-C3:d3")).toBe("discard");
  });

  it.fails("RK-260: ラッシュエリアにあっても発動する（出典: atwiki/page-1257「これが自軍エリアにある間」）", () => {
    const s = ending({ battle: [], rush: [inst("RK-260", "ti")] });
    expectChoiceFrom(s, "player1", "RK-260");
  });

  /** 敵軍ターンに、下に重ねたカード（stacked）を持つタイタンが BP13000 のユニットにアタックされて撃破される。 */
  const titanDestroyed = (stacked = [faceDown("SPEC-C3", "u3")], p2: Partial<GameState["players"]["player2"]> = {}) =>
    settle(
      attack(
        enemyTurn({ battle: [withStacked(inst("RK-260", "ti"), stacked)] }, { battle: [inst("TST-UNIT-7", "atk"), inst("SPEC-C3", "e3"), inst("SPEC-C2", "e2"), inst("SPEC-C3M", "e3m")], rush: [inst("SPEC-C3", "r3")], ...p2 }),
        "TST-UNIT-7:atk",
        "RK-260:ti",
        "player2",
      ),
    );

  it.fails("RK-260: これがユニットでなくなるとき、下に重ねたウラ向きのカードはすべて捨札になる（出典: atwiki/page-1257「この下に重ねたウラ向きのカードをすべて捨札にする」）", () => {
    const s = resolveAll(titanDestroyed([faceDown("SPEC-C3", "u3"), faceDown("SPEC-C2", "u2")]));
    expect(zoneOf(s, "player1", "RK-260:ti")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C3:u3")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C2:u2")).toBe("discard");
  });

  it.fails("RK-260: 敵軍ターン中なら、捨札にしたカードと同じ必要パワーの数字を持つ敵軍 S ユニット（エリアを問わない。M は対象外）から1体選んで撃破できる（任意）（出典: atwiki/page-1257「それが敵軍ターン中なら、…同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破してもよい」）", () => {
    const s = titanDestroyed();
    expectChoiceFrom(s, "player1", "RK-260");
    expect(choiceIds(s)).toEqual(["SPEC-C3:e3", "SPEC-C3:r3"]);
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(pick(s, "SPEC-C3:r3"));
    expect(zoneOf(t, "player2", "SPEC-C3:r3")).toBe("discard");
    expect(zoneOf(t, "player2", "SPEC-C3:e3")).toBe("battle");
  });

  it.fails("RK-260: 捨札にするカード1枚につき1体ずつ選べる（2枚なら2回）（出典: atwiki/page-1257「捨札にするカード1枚につき」）", () => {
    let s = titanDestroyed([faceDown("SPEC-C3", "u3"), faceDown("SPEC-C2", "u2")]);
    const picked: string[] = [];
    for (let i = 0; i < 2; i++) {
      expectChoiceFrom(s, "player1", "RK-260");
      const id = choiceIds(s).includes("SPEC-C2:e2") ? "SPEC-C2:e2" : "SPEC-C3:e3";
      picked.push(id);
      s = settle(pick(s, id));
    }
    s = resolveAll(s);
    expect(picked.sort()).toEqual(["SPEC-C2:e2", "SPEC-C3:e3"]);
    expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("discard");
  });

  it.fails("RK-260: 自軍ターン中にユニットでなくなったときは、重ねたカードを捨札にするだけで撃破はしない（出典: atwiki/page-1257「それが敵軍ターン中なら」）", () => {
    let s = board({ battle: [withStacked(inst("RK-260", "ti"), [faceDown("SPEC-C3", "u3")])] }, { battle: [inst("TST-UNIT-7", "big"), inst("SPEC-C3", "e3")] });
    s = settle(attack(s, "RK-260:ti", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "RK-260:ti")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-260");
    expect(zoneOf(s, "player1", "SPEC-C3:u3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-261 仮面ライダーBLACK RX", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい） 【リボルケイン】敵軍捨て札からオペレーションカードを1枚選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-261: カタログ本文・スペックが出典と一致（出典: atwiki/page-1242）", () => {
    expectCatalogText("RK-261", TEXT);
    expectStats("RK-261", { name: "仮面ライダーBLACK RX", category: "MA", size: "S", bp: 3000, sp: "1/3" as never, powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("RK-261", ["SR"]);
  });

  it("RK-261: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（ロボライダー）と置き換えられる。特徴が一致しない仮面ライダー（ストロンガー）は選べない（出典: atwiki/page-1242・atwiki/page-1242「モーフできるユニット」・R-KW-MORPH-03）", () => {
    let s = enemyRushes({ battle: [inst("RK-261", "rx")], command: [released("RK-262", "rb"), released("RK-254", "st")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-262:rb"]);
    s = settle(pickAs(s, "player1", "RK-262:rb"));
    expect(zoneOf(s, "player1", "RK-262:rb")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-261:rx")).toBe("command");
  });

  const revolcane = (p2: Partial<GameState["players"]["player2"]> = { discard: [inst("TST-OP", "eop"), inst("SPEC-C3", "eu")] }) =>
    rcRideOff(board({ rush: [inst("RK-261", "rx"), inst("SPEC-VEHICLE", "v")] }, p2), "RK-261:rx", "SPEC-VEHICLE:v");

  it.fails("RK-261: 【リボルケイン】RC — 敵軍捨札のオペレーションカードから1枚選べる（任意。ユニットカードは選べない）（出典: atwiki/page-1242「敵軍捨て札からオペレーションカードを1枚選び、…置いてもよい」）", () => {
    const s = revolcane();
    expectChoiceFrom(s, "player1", "RK-261");
    expect(choiceIds(s)).toEqual(["TST-OP:eop"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-261: 選んだカードは持ち主（相手）のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1242「持ち主のパワーゾーンにダメージにして置いて」）", () => {
    const s = settle(pick(revolcane(), "TST-OP:eop"));
    expect(zoneOf(s, "player2", "TST-OP:eop")).toBe("power");
    expect(cardIn(s, "player2", "TST-OP:eop")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RK-261: 置かないことも選べる（出典: atwiki/page-1242「置いてもよい」）", () => {
    const s = settle(skip(revolcane()));
    expect(zoneOf(s, "player2", "TST-OP:eop")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-261: 敵軍捨札にオペレーションカードがなければ何も起きない（出典: atwiki/page-1242 カード評価「相手によっては効果を発揮出来ず」）", () => {
    const s = settle(revolcane({ discard: [inst("SPEC-C3", "eu")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-261");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RK-262 ロボライダー", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい） ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【ボルティックシューター】これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("RK-262: カタログ本文・スペックが出典と一致（出典: atwiki/page-1393）", () => {
    expectCatalogText("RK-262", TEXT);
    expectStats("RK-262", { name: "ロボライダー", category: "MA", size: "S", bp: 4000, sp: undefined, powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("RK-262", ["R"]);
  });

  it("RK-262: ※モーフ — 特徴が完全一致する自軍パワーゾーンのオモテ向きのユニットカード（バイオライダー）と置き換えられる（出典: atwiki/page-1393・「モーフできるユニット」・R-KW-MORPH-02）", () => {
    const s = enemyRushes({ battle: [inst("RK-262", "rb")], power: [faceUp("RK-263", "bio")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-263:bio"]);
  });

  it("RK-262: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1393・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-262", "rb")] }, "RK-262:rb"))).toBe(true);
  });

  it("RK-262: 【ボルティックシューター】RC — 敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1393「これは敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = settle(rcRideOff(board({ rush: [inst("RK-262", "rb"), inst("SPEC-VEHICLE", "v")] }, { rush: [inst("SPEC-E2000", "r")], battle: [inst("SPEC-E1000", "b")] }), "RK-262:rb", "SPEC-VEHICLE:v"));
    expect(targetsOf(s, "RK-262:rb")).toEqual(["SPEC-E1000:b", "SPEC-E2000:r"]);
  });

  it.fails("RK-262: ライドオフせずに（RC が発動せずに）出たときは、敵軍ラッシュエリアのユニットにアタックできない（出典: atwiki/page-1393「CN：RC」）", () => {
    const s = settle(enter(board({ rush: [inst("RK-262", "rb")] }, { rush: [inst("SPEC-E2000", "r")], battle: [inst("SPEC-E1000", "b")] }), "RK-262:rb"));
    expect(targetsOf(s, "RK-262:rb")).toEqual(["SPEC-E1000:b"]);
  });
});

// ===========================================================================
describe("RK-263 バイオライダー", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選びこれと置き換えてもよい） ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【液化】このユニットは、ホールド状態のとき敵軍ユニットにアタックされない。";

  it("RK-263: カタログ本文・スペックが出典と一致（出典: atwiki/page-1359）", () => {
    expectCatalogText("RK-263", TEXT);
    expectStats("RK-263", { name: "バイオライダー", category: "MA", size: "S", bp: 500, sp: "1/3" as never, powerCost: 4, features: ["仮面ライダー", "男", "改造人間", "ハイブリッドエネルギー"] });
    expectRarityIn("RK-263", ["NR"]);
  });

  it("RK-263: ※モーフ — 特徴が完全一致する自軍コマンドゾーンのユニットカード（BLACK RX）と置き換えられる（出典: atwiki/page-1359・「モーフできるユニット」）", () => {
    const s = enemyRushes({ battle: [inst("RK-263", "bio")], command: [released("RK-261", "rx")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-261:rx"]);
  });

  it("RK-263: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1359・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-263", "bio")] }, "RK-263:bio"))).toBe(true);
  });

  const attackers = (bio: GameState["players"]["player1"]["battle"][number]) =>
    attackersOf(enemyTurn({ battle: [bio] }, { battle: [inst("SPEC-E2000", "s"), inst("SPEC-EM2000", "m")] }), "RK-263:bio");

  it.fails("RK-263: 【液化】ホールド状態のとき、敵軍ユニット（S・M とも）にアタックされない（出典: atwiki/page-1359「ホールド状態のとき敵軍ユニットにアタックされない」）", () => {
    expect(attackers(heldUnit("RK-263", "bio"))).toEqual([]);
  });

  it("RK-263: リリース状態のときはアタックされる（出典: atwiki/page-1359「ホールド状態のとき」）", () => {
    expect(attackers(inst("RK-263", "bio"))).toEqual(["SPEC-E2000:s", "SPEC-EM2000:m"]);
  });
});

// ===========================================================================
describe("RK-264 アクロバッター", () => {
  const TEXT =
    "※これは、自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出ることができる。 【アクロバットバーン】 自軍ターン中、これがバトルエリアに出たとき、これにライドしているユニットのBP以下のBPを持つユニットを、相手は自分自身のSユニットの中から1体選び、自分自身の山札の下に戻す。";

  it("RK-264: カタログ本文・スペックが出典と一致（出典: atwiki/page-1373）", () => {
    expectCatalogText("RK-264", TEXT);
    expectVehicleStats("RK-264", { name: "アクロバッター", category: "MA", powerCost: 4, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("RK-264", ["N"]);
  });

  it("RK-264: ※ 自軍 S ユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出られる（なければ出られない）（出典: atwiki/page-1373）", () => {
    expect(canEnter(board({ battle: fill(1), rush: [inst("RK-264", "ab")] }), "RK-264:ab")).toBe(true);
    expect(canEnter(board({ rush: [inst("RK-264", "ab")] }), "RK-264:ab")).toBe(false);
  });

  const enemy = { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E5000", "b"), inst("SPEC-EM2000", "m")], rush: [inst("SPEC-E1000", "r"), inst("SPEC-E3500", "c")] };
  const burn = (rider = inst("SPEC-RC3000", "r"), p2: Partial<GameState["players"]["player2"]> = enemy) =>
    mount(board({ rush: [rider, inst("RK-264", "ab")] }, p2), rider.instanceId, "RK-264:ab");

  it.fails("RK-264: 【アクロバットバーン】自軍ターン中にバトルエリアに出たとき、相手は自分の S ユニット（エリアを問わない）のうち、ライドしているユニットの BP（3000）以下の BP を持つものから1体選ぶ（見送れない。M は対象外）（出典: atwiki/page-1373「これにライドしているユニットのBP以下のBPを持つユニットを、相手は自分自身のSユニットの中から1体選び」）", () => {
    const s = burn();
    expectChoiceFrom(s, "player2", "RK-264");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:r", "SPEC-E2000:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("RK-264: 相手が選んだユニットは相手の山札の下に戻る（出典: atwiki/page-1373「自分自身の山札の下に戻す」）", () => {
    const s = settle(pickAs(burn(), "player2", "SPEC-E2000:a"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("SPEC-E2000:a");
  });

  it.fails("RK-264: 比べるのはライドしているユニットの今の BP（本来の BP ではない）（出典: atwiki/page-1373「これにライドしているユニットのBP以下」。RK-028 の「本来のBP」とは書き方が違う）", () => {
    const s = burn({ ...inst("SPEC-RC3000", "r"), bpModifier: 500 });
    expect(choiceIds(s)).toEqual(["SPEC-E1000:r", "SPEC-E2000:a", "SPEC-E3500:c"]);
  });

  it("RK-264: ライドされずに出たときは何も起きない（出典: atwiki/page-1373「これにライドしているユニットのBP以下」）", () => {
    const s = settle(enter(board({ battle: fill(1), rush: [inst("RK-264", "ab")] }, enemy), "RK-264:ab"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-264");
    expect(zoneOf(s, "player2", "SPEC-E1000:r")).toBe("rush");
  });
});

// ===========================================================================
describe("RK-265 ライドロン", () => {
  const TEXT =
    "※これは、自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出ることができる。 【ライディングアロー】 自軍ターン中、これがバトルエリアに出たとき、これがライドされていれば、敵軍常駐の上に重ねたカードの上から1枚選び、持ち主の山札の下に戻してもよい。";

  it("RK-265: カタログ本文・スペックが出典と一致（出典: atwiki/page-1374）", () => {
    expectCatalogText("RK-265", TEXT);
    expectVehicleStats("RK-265", { name: "ライドロン", category: "MA", powerCost: 1, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-265", ["N"]);
  });

  it("RK-265: ※ 自軍 S ユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出られる（なければ出られない）（出典: atwiki/page-1374）", () => {
    expect(canEnter(board({ battle: fill(1), rush: [inst("RK-265", "rd")] }), "RK-265:rd")).toBe(true);
    expect(canEnter(board({ rush: [inst("RK-265", "rd")] }), "RK-265:rd")).toBe(false);
  });

  const enemy = { operation: [resident("RK-021", "cu", [faceDown("TST-OP", "s0"), faceDown("TST-OP", "s1")])] };
  const arrow = (p2: Partial<GameState["players"]["player2"]> = enemy) =>
    mount(board({ rush: [inst("SPEC-RC3000", "r"), inst("RK-265", "rd")] }, p2), "SPEC-RC3000:r", "RK-265:rd");

  it.fails("RK-265: 【ライディングアロー】自軍ターン中、ライドされてバトルエリアに出たとき、敵軍常駐に重ねたカードの一番上の1枚を選べる（任意）（出典: atwiki/page-1374「敵軍常駐の上に重ねたカードの上から1枚選び、…戻してもよい」）", () => {
    const s = arrow();
    expectChoiceFrom(s, "player1", "RK-265");
    expect(choiceIds(s)).toEqual(["TST-OP:s1"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-265: 選んだカードは持ち主の山札の下に戻り、その下のカードは常駐に重なったまま（出典: atwiki/page-1374「持ち主の山札の下に戻して」）", () => {
    const s = settle(pick(arrow(), "TST-OP:s1"));
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("TST-OP:s1");
    expect((s.players.player2.operation[0]?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["TST-OP:s0"]);
  });

  it.fails("RK-265: 戻さないことも選べる（出典: atwiki/page-1374「戻してもよい」）", () => {
    const s = settle(skip(arrow()));
    expect((s.players.player2.operation[0]?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["TST-OP:s0", "TST-OP:s1"]);
  });

  it.fails("RK-265: ライドされずに出たときは発動しない（出典: atwiki/page-1374「これがライドされていれば」）", () => {
    const s = settle(enter(board({ battle: fill(1), rush: [inst("RK-265", "rd")] }, enemy), "RK-265:rd"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-265");
    expect((s.players.player2.operation[0]?.stackedCards ?? []).length).toBe(2);
  });
});

// ===========================================================================
describe("RK-266 機甲隊長ガテゾーン", () => {
  const TEXT =
    "【ショットガン】敵軍ラッシュエリアのユニットを、BPの合計が3000以下になるように選び撃破してもよい。ただし、選べるユニットの数は、特徴「メカ」を持つ自軍ユニットの数までとする。";

  it("RK-266: カタログ本文・スペックが出典と一致（出典: atwiki/page-1259）", () => {
    expectCatalogText("RK-266", TEXT);
    expectStats("RK-266", { name: "機甲隊長ガテゾーン", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: "RC", features: ["クライシス帝国", "メカ", "人型"] });
    expectRarityIn("RK-266", ["N"]);
  });

  const enemy = { rush: [inst("SPEC-E1000", "a"), inst("SPEC-E2000", "b"), inst("SPEC-E1000", "c"), inst("SPEC-E3500", "x")], battle: [inst("SPEC-E1000", "bt")] };
  const shotgun = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    rcRideOff(board({ rush: [inst("RK-266", "gz"), inst("SPEC-VEHICLE", "v"), inst("SPEC-MECHA", "me")], ...p1 }, enemy), "RK-266:gz", "SPEC-VEHICLE:v");

  it.fails("RK-266: 【ショットガン】RC — 敵軍ラッシュエリアのユニットから選べる（任意。敵軍バトルエリアのユニット・BP3000 を超えるユニットは選べない）（出典: atwiki/page-1259「敵軍ラッシュエリアのユニットを、BPの合計が3000以下になるように選び撃破してもよい」）", () => {
    const s = shotgun();
    expectChoiceFrom(s, "player1", "RK-266");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:a", "SPEC-E1000:c", "SPEC-E2000:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-266: BP の合計が3000以下になるように選ぶ（2000 を選んだら、残りは BP1000 以下だけ）（出典: atwiki/page-1259「BPの合計が3000以下になるように」）", () => {
    const s = pick(shotgun(), "SPEC-E2000:b");
    expect(choiceIds(s)).toEqual(["SPEC-E1000:a", "SPEC-E1000:c"]);
  });

  it.fails("RK-266: 「メカ」を持つ自軍ユニットが2体（これ自身を含む）なら2体まで選んで撃破できる（出典: atwiki/page-1259「選べるユニットの数は、特徴「メカ」を持つ自軍ユニットの数までとする」）", () => {
    let s = pick(pick(shotgun(), "SPEC-E1000:a"), "SPEC-E2000:b");
    if (s.pendingEffectChoice?.sourceCardId === "RK-266") s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E1000:c")).toBe("rush");
  });

  it("RK-266: 「メカ」を持つ自軍ユニットがこれ1体だけなら、1体しか選べない（出典: atwiki/page-1259「特徴「メカ」を持つ自軍ユニットの数まで」）", () => {
    let s = pick(shotgun({ rush: [inst("RK-266", "gz"), inst("SPEC-VEHICLE", "v")] }), "SPEC-E1000:a");
    if (s.pendingEffectChoice?.sourceCardId === "RK-266" && choiceIds(s).length === 0) s = confirm(s);
    expect(s.pendingEffectChoice?.sourceCardId === "RK-266" ? choiceIds(s) : []).toEqual([]);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E1000:c")).toBe("rush");
  });

  it("RK-266: 撃破しないことも選べる（出典: atwiki/page-1259「撃破してもよい」）", () => {
    const s = resolveAll(skip(shotgun()));
    expect(zoneOf(s, "player2", "SPEC-E1000:a")).toBe("rush");
  });
});
