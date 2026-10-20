/**
 * カード別スペック: XG6-052〜XG6-058（クロスギャザー ザ・ギガンティックタイタン 仮面ライダーコーカサス〜仮面ライダーオーズ・タカキリバ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-053 Q1〜Q3、XG6-056 Q1（デッキ構築）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAKUS-01・R-KW-RESIST-01・R-KW-READ-01・R-KW-MORPH・R-KW-WING）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types/game";
import {
  NOSP_ATTACKER,
  attackTargets,
  bpOf,
  canEndPhase,
  canSkip,
  choiceIds,
  enemyAttacks,
  enemyTurn,
  enter,
  entered,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  inst,
  leadTests,
  legal,
  morphTest,
  mountAndRideOff,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resistTest,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  sUnit,
  takusTests,
  vehicleCard,
  wingTests,
  zoneOf,
} from "./XG6-045-065.helpers";

const VEH = vehicleCard("SPEC-VEH");
const L10 = sUnit("SPEC-L10", { bp: 10000, size: "L" });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const E2 = sUnit("SPEC-E2", { bp: 2000 });
const E3 = sUnit("SPEC-E3", { bp: 3000 });
const S3K = sUnit("SPEC-S3K", { bp: 3000 });
const EXTRA = [VEH, L10, C5, C3, E2, E3, S3K, NOSP_ATTACKER];

// ===========================================================================
describe("XG6-052 仮面ライダーコーカサス", () => {
  const TEXT = "※これは相手に選ばれない。 【ハイパークロックアップ】 自軍ターン中、これが自軍バトルエリアにある間、敵軍バトルエリアにあるSユニットの効果名を持たないテキストは無効になり、発動もできない。";
  const PAGE = "atwiki/page-2287";

  it(`XG6-052: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-052", TEXT);
    expectUnit("XG6-052", { name: "仮面ライダーコーカサス", category: ["OT", "DA"], size: "S", bp: 5000, sp: undefined, powerCost: 7, features: ["仮面ライダー", "男", "加速"] });
    expectRushCondition("XG6-052", undefined);
    expectRarityIn("XG6-052", ["N"]);
  });

  it(`XG6-052: ※ 相手に選ばれない（敵軍 XG6-006【ボウケンフラッシュ】の選択に入らない）（出典: ${PAGE}「これは相手に選ばれない」）`, () => {
    let s = enemyTurn({ battle: [inst("XG6-052", "c"), inst("TST-UNIT-0", "o")] }, { rush: [inst("XG6-006", "dt")], command: [inst("XG6-016", "an")] }, EXTRA);
    s = enter(s, "XG6-006:dt", "player2");
    for (let i = 0; i < 2 && s.pendingEffectChoice?.sourceCardId === "XG6-006" && choiceIds(s).includes("XG6-016:an"); i++) s = pick(s, "XG6-016:an");
    expect(choiceIds(s)).toContain("TST-UNIT-0:o");
    expect(choiceIds(s)).not.toContain("XG6-052:c");
  });

  it(
    `XG6-052: 【ハイパークロックアップ】自軍ターン中、敵軍バトルエリアの S ユニットの効果名を持たないテキスト（XG6-059「※これはBP3000以上のユニットにアタックされない」）は無効になり、BP5000 のこれでアタックできる（出典: ${PAGE}「効果名を持たないテキストは無効になり」・カード評価「効果名を持たない効果を無効」）`,
    () => {
      expect(attackTargets(p1Battle({ battle: [inst("XG6-052", "c")] }, { battle: [inst("XG6-059", "t")] }, EXTRA), "XG6-052:c")).toContain("XG6-059:t");
    },
  );

  it(`XG6-052: 【ハイパークロックアップ】これがバトルエリアになければ（ラッシュエリア）、XG6-059 の「アタックされない」は働く（BP5000 のユニットでアタックできない）（出典: ${PAGE}「これが自軍バトルエリアにある間」）`, () => {
    const s = p1Battle({ rush: [inst("XG6-052", "c")], battle: [inst("TST-UNIT-7", "big")] }, { battle: [inst("XG6-059", "t")] }, EXTRA);
    expect(attackTargets(s, "TST-UNIT-7:big")).not.toContain("XG6-059:t");
  });
});

// ===========================================================================
describe("XG6-053 仮面ライダーアーク", () => {
  const TEXT =
    "※これは敵軍ターン中「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 ※これ以外のユニットがSユニットだけなら、これはLユニットになり、BP+2000される。 【ゴー・トゥー・ヘル！】自軍ターン中、これがバトルエリアに出たとき、これがLユニットなら、次の効果を発動する→敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";
  const PAGE = "atwiki/page-2308";

  it(`XG6-053: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-053", TEXT);
    expectUnit("XG6-053", { name: "仮面ライダーアーク", category: ["MA", "DA"], size: "S", bp: 7000, sp: undefined, powerCost: 5, features: ["仮面ライダー", "男", "レジェンドルガ"] });
    expectRushCondition("XG6-053", undefined);
    expectRarityIn("XG6-053", ["N"]);
  });

  it(`XG6-053: ※ 敵軍ターン中、SP1 のユニット（TST-UNIT-0 BP1000）とのバトルに勝っても撃破される（出典: ${PAGE}「敵軍ターン中「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）`, () => {
    const s = settle(enemyAttacks(enemyTurn({ battle: [inst("XG6-053", "a")] }, { battle: [inst("TST-UNIT-0", "s1")] }, EXTRA), "TST-UNIT-0:s1", "XG6-053:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s1")).toBe("discard");
    expect(zoneOf(s, "player1", "XG6-053:a")).toBe("discard");
  });

  it(`XG6-053: ※ SP を持たないユニットとのバトルに勝てば場に残る（出典: ${PAGE}「「SP1」以上のユニットと」）`, () => {
    const s = settle(enemyAttacks(enemyTurn({ battle: [inst("XG6-053", "a")] }, { battle: [inst("SPEC-NOSP", "n")] }, EXTRA), "SPEC-NOSP:n", "XG6-053:a"));
    expect(zoneOf(s, "player1", "XG6-053:a")).toBe("battle");
  });

  it(
    `XG6-053: ※ これ以外のユニット（両軍）が S ユニットだけなら、L ユニットになり BP+2000（BP9000）（出典: ${PAGE}「これ以外のユニットがSユニットだけなら、これはLユニットになり、BP+2000される」・Q1）`,
    () => {
      expect(bpOf(p1Battle({ battle: [inst("XG6-053", "a"), inst("TST-UNIT-0", "s")] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA), "player1", "XG6-053:a")).toBe(9000);
    },
  );

  it(`XG6-053: ※ ほかに L ユニット（敵軍でもよい）があれば S ユニットのまま BP7000（出典: ${PAGE}「Sユニットだけなら」・Q1「場にはLユニットがあるので」）`, () => {
    expect(bpOf(p1Battle({ battle: [inst("XG6-053", "a")] }, { battle: [inst("SPEC-L10", "l")] }, EXTRA), "player1", "XG6-053:a")).toBe(7000);
  });

  it(`XG6-053: 【ゴー・トゥー・ヘル！】L ユニットのときバトルエリアに出たら、敵軍バトルエリアの S ユニット（ラッシュエリアは選べない）から1体選ぶ（出典: ${PAGE}「敵軍バトルエリアからSユニットを1体選び」）`, () => {
    const s = entered("XG6-053:a", {}, { battle: [inst("TST-UNIT-0", "e1")], rush: [inst("SPEC-E2", "er")] }, EXTRA);
    expectChoiceFrom(s, "player1", "XG6-053");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e1"]);
  });

  it(`XG6-053: 【ゴー・トゥー・ヘル！】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）として置く（敵軍のダメージ +1）（出典: ${PAGE}「持ち主のパワーゾーンにダメージにして置く」）`, () => {
    const s = resolveAll(pick(entered("XG6-053:a", {}, { battle: [inst("TST-UNIT-0", "e1")] }, EXTRA), "TST-UNIT-0:e1"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:e1")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it(
    `XG6-053: 【ゴー・トゥー・ヘル！】ほかに L ユニットがあって、これが S ユニットのままなら発動しない（出典: ${PAGE}「これがLユニットなら」）`,
    () => {
      const s = entered("XG6-053:a", { battle: [inst("SPEC-L10", "l")] }, { battle: [inst("TST-UNIT-0", "e1")] }, EXTRA);
      expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG6-053");
    },
  );
});

// ===========================================================================
describe("XG6-054 仮面ライダースカル", () => {
  const TEXT =
    "※レジスト ※タクスET 【帽子が似合う男になれ】自軍バトルエリアのSユニットを1体選び、ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。そうしたとき、このターン、このユニットのBPに戻したユニットのBPを「+」する。";
  const PAGE = "atwiki/page-2294";

  it(`XG6-054: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-054", TEXT);
    expectUnit("XG6-054", { name: "仮面ライダースカル", category: ["ET", "DA"], size: "S", bp: 1000, sp: undefined, powerCost: 0, comboNumber: "RC", features: ["仮面ライダー", "男", "ロストドライバー"] });
    expectRushCondition("XG6-054", undefined);
    expectRarityIn("XG6-054", ["N"]);
  });

  resistTest("XG6-054", PAGE);
  takusTests("XG6-054", "ET", 4, PAGE);

  const rc = () => mountAndRideOff(p1Battle({ rush: [inst("XG6-054", "sk"), inst("SPEC-VEH", "v")], battle: [inst("SPEC-E3", "m")] }, {}, EXTRA), "XG6-054:sk", "SPEC-VEH:v");

  it(
    `XG6-054: RC【帽子が似合う男になれ】自軍バトルエリアの S ユニットを1体選んでラッシュエリアに戻せる（任意）（出典: ${PAGE}「自軍バトルエリアのSユニットを1体選び、ラッシュエリアに戻してもよい」）`,
    () => {
      const s = rc();
      expectChoiceFrom(s, "player1", "XG6-054");
      expect(choiceIds(s)).toContain("SPEC-E3:m");
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-054: RC — 戻したとき、このターン、これの BP に戻したユニットの BP を足す（1000+3000）。戻したユニットはこのターン出られない（出典: ${PAGE}「このユニットのBPに戻したユニットのBPを「+」する」「再びバトルエリアに出ることはできない」）`,
    () => {
      const s = resolveAll(pick(rc(), "SPEC-E3:m"));
      expect(zoneOf(s, "player1", "SPEC-E3:m")).toBe("rush");
      expect(bpOf(s, "player1", "XG6-054:sk")).toBe(4000);
      expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "SPEC-E3:m")).toBe(false);
    },
  );
});

// ===========================================================================
describe("XG6-055 仮面ライダーオーズ・タトバコンボ", () => {
  const TEXT =
    "※モーフ ※ウイング ※リードET 【コンボチェンジ】カード名に「タトバ」を含まない、モーフと特徴「オーズドライバー」を持つユニットカードを自分の手札から1枚選び、これと置き換えてもよい。このとき出したユニットは、BP+2000され、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。";
  const PAGE = "atwiki/page-2337";

  it(`XG6-055: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-055", TEXT);
    expectUnit("XG6-055", { name: "仮面ライダーオーズ・タトバコンボ", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRushCondition("XG6-055", undefined);
    expectRarityIn("XG6-055", ["SR"]);
  });

  morphTest("XG6-055", "XG6-059", "XG6-036", PAGE);
  wingTests("XG6-055", PAGE);
  leadTests("XG6-055", "ET", PAGE);

  const rc = (hand: CardInstance[]) =>
    mountAndRideOff(p1Battle({ rush: [inst("XG6-055", "ta"), inst("SPEC-VEH", "v")], hand }, { battle: [inst("TST-UNIT-0", "e1")] }, EXTRA), "XG6-055:ta", "SPEC-VEH:v");

  it(
    `XG6-055: RC【コンボチェンジ】手札の、カード名に「タトバ」を含まずモーフと特徴「オーズドライバー」を持つユニットカードから1枚選べる（任意）（出典: ${PAGE}「自分の手札から1枚選び、これと置き換えてもよい」）`,
    () => {
      const s = rc([inst("XG6-058", "tk"), inst("XG6-055", "ta2"), inst("XG6-036", "cj")]);
      expectChoiceFrom(s, "player1", "XG6-055");
      expect(choiceIds(s)).toEqual(["XG6-058:tk"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-055: RC — 置き換えて出したユニットはこれの位置に出て BP+2000（XG6-058 BP2000 → 4000）。これは手札に戻る（出典: ${PAGE}「このとき出したユニットは、BP+2000され」）`,
    () => {
      const s = resolveAll(pick(rc([inst("XG6-058", "tk")]), "XG6-058:tk"));
      expect(zoneOf(s, "player1", "XG6-058:tk")).toBe("battle");
      expect(zoneOf(s, "player1", "XG6-055:ta")).toBe("hand");
      expect(bpOf(s, "player1", "XG6-058:tk")).toBe(4000);
    },
  );
});

// ===========================================================================
describe("XG6-056 仮面ライダーオーズ・ガタキリバコンボ", () => {
  const TEXT = "※モーフ ※リードET 【忍ばせた大鎌】敵軍Ｓユニットを、ＢＰの合計がこのユニットのＢＰ以下になるように２体まで選んで撃破してもよい。そうしたとき、このターン、これはアタックすることができない。";
  const PAGE = "atwiki/page-2344";

  it(`XG6-056: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-056", TEXT);
    expectUnit("XG6-056", { name: "仮面ライダーオーズ・ガタキリバコンボ", category: "WB", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRushCondition("XG6-056", undefined);
    expectRarityIn("XG6-056", ["SR"]);
  });

  morphTest("XG6-056", "XG6-057", "XG6-036", PAGE);
  leadTests("XG6-056", "ET", PAGE);

  const rc = () =>
    mountAndRideOff(
      p1Battle({ rush: [inst("XG6-056", "ga"), inst("SPEC-VEH", "v")] }, { battle: [inst("SPEC-E2", "a"), inst("SPEC-E2", "b"), inst("SPEC-S3K", "c")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA),
      "XG6-056:ga",
      "SPEC-VEH:v",
    );

  it(
    `XG6-056: RC【忍ばせた大鎌】BP の合計がこれの BP（4000）以下になるように、敵軍 S ユニット（エリアを問わない）を2体まで選んで撃破でき、そのターンはアタックできない（出典: ${PAGE}「ＢＰの合計がこのユニットのＢＰ以下になるように２体まで選んで撃破してもよい。そうしたとき、このターン、これはアタックすることができない」・カード評価「エリアを問わず」）`,
    () => {
      let s = rc();
      expectChoiceFrom(s, "player1", "XG6-056");
      expect(canSkip(s)).toBe(true);
      s = resolveAll(pick(pick(s, "SPEC-E2:a"), "SPEC-E2:b"));
      expect(zoneOf(s, "player2", "SPEC-E2:a")).toBe("discard");
      expect(zoneOf(s, "player2", "SPEC-E2:b")).toBe("discard");
      expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "XG6-056:ga")).toBe(false);
    },
  );

  it(`XG6-056: RC — 撃破しなければアタックできる（出典: ${PAGE}「そうしたとき」）`, () => {
    let s = rc();
    if (s.pendingEffectChoice?.sourceCardId === "XG6-056") s = resolveAll(skip(s));
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "XG6-056:ga")).toBe(true);
  });
});

// ===========================================================================
describe("XG6-057 仮面ライダーオーズ・ラトラーターコンボ", () => {
  const TEXT =
    "※モーフ ※これは毎ターン、可能ならバトルエリア に出る。 ※これはBP3000以上のユニットにアタックされない。 【トラクロー】これをラッシュしたとき、必要パワーを満たしていない敵軍ユニットまたは敵軍ビークルを1体選びゲームから除外する。";
  const PAGE = "atwiki/page-2312";

  it(`XG6-057: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-057", TEXT);
    expectUnit("XG6-057", { name: "仮面ライダーオーズ・ラトラーターコンボ", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 3, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRushCondition("XG6-057", undefined);
    expectRarityIn("XG6-057", ["R"]);
  });

  morphTest("XG6-057", "XG6-056", "XG6-036", PAGE);

  it(`XG6-057: ※ 毎ターン、可能ならバトルエリアに出る（出さずにバトルフェイズを終えられない）（出典: ${PAGE}「これは毎ターン、可能ならバトルエリアに出る」）`, () => {
    expect(canEndPhase(p1Battle({ rush: [inst("XG6-057", "r")] }, {}, EXTRA))).toBe(false);
  });

  it(`XG6-057: ※ BP3000 以上のユニットにアタックされない（BP1000 のユニットにはアタックされる）（出典: ${PAGE}「これはBP3000以上のユニットにアタックされない」）`, () => {
    const s = enemyTurn({ battle: [inst("XG6-057", "r")] }, { battle: [inst("SPEC-S3K", "big"), inst("TST-UNIT-0", "s")] }, EXTRA);
    expect(attackTargets(s, "SPEC-S3K:big", "player2")).not.toContain("XG6-057:r");
    expect(attackTargets(s, "TST-UNIT-0:s", "player2")).toContain("XG6-057:r");
  });

  it(
    `XG6-057: 【トラクロー】ラッシュしたとき、必要パワーを満たしていない敵軍ユニット（敵軍パワー4 のとき必要パワー5）を1体選んでゲームから除外する（満たしているユニットは選べない）（出典: ${PAGE}「必要パワーを満たしていない敵軍ユニットまたは敵軍ビークルを1体選びゲームから除外する」）`,
    () => {
      let s = rushFromHand(rushBoard({ hand: [inst("XG6-057", "r")], command: releasedCat("WB", 1), power: powerCards(3) }, { battle: [inst("SPEC-C5", "e5"), inst("SPEC-C3", "e3")], power: powerCards(4, "ep") }, EXTRA), "player1", "XG6-057:r").state;
      expectChoiceFrom(s, "player1", "XG6-057");
      expect(choiceIds(s)).toEqual(["SPEC-C5:e5"]);
      s = resolveAll(pick(s, "SPEC-C5:e5"));
      expect(s.players.player2.exile.map((c) => c.instanceId)).toEqual(["SPEC-C5:e5"]);
    },
  );
});

// ===========================================================================
describe("XG6-058 仮面ライダーオーズ・タカキリバ", () => {
  const TEXT = "※モーフ ※ウイング 【虚空より狙う鎌】自軍コマンドを1つ選び捨札にしてもよい。そうしたとき、捨札にしたコマンドと同じカテゴリを持つ敵軍コマンドを1つ選びゲームから除外する。";
  const PAGE = "atwiki/page-2297";

  it(`XG6-058: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-058", TEXT);
    expectUnit("XG6-058", { name: "仮面ライダーオーズ・タカキリバ", category: "WB", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: "RC", features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRushCondition("XG6-058", undefined);
    expectRarityIn("XG6-058", ["N"]);
  });

  morphTest("XG6-058", "XG6-055", "XG6-036", PAGE);
  wingTests("XG6-058", PAGE);

  const rc = () =>
    mountAndRideOff(
      p1Battle({ rush: [inst("XG6-058", "tk"), inst("SPEC-VEH", "v")], command: [released("TST-OP-MA", "mc")] }, { command: [released("TST-OP-MA", "emc"), released("TST-OP", "ewc")] }, EXTRA),
      "XG6-058:tk",
      "SPEC-VEH:v",
    );

  it(
    `XG6-058: RC【虚空より狙う鎌】自軍コマンドを1つ捨札にしたとき、同じカテゴリ（MA）を持つ敵軍コマンドを1つ選んでゲームから除外する（WB のコマンドは選べない）（出典: ${PAGE}「捨札にしたコマンドと同じカテゴリを持つ敵軍コマンドを1つ選びゲームから除外する」）`,
    () => {
      let s = rc();
      expectChoiceFrom(s, "player1", "XG6-058");
      expect(canSkip(s)).toBe(true);
      s = pick(s, "TST-OP-MA:mc");
      expect(zoneOf(s, "player1", "TST-OP-MA:mc")).toBe("discard");
      expect(choiceIds(s)).toEqual(["TST-OP-MA:emc"]);
      s = resolveAll(pick(s, "TST-OP-MA:emc"));
      expect(s.players.player2.exile.map((c) => c.instanceId)).toEqual(["TST-OP-MA:emc"]);
    },
  );
});
