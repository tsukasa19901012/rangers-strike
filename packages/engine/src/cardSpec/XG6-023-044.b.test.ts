/**
 * カード別スペック: XG6-030〜XG6-036（クロスギャザー ザ・ギガンティックタイタン ネオショッカー大首領〜仮面ライダーW・CJ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-031 Q1、XG6-035 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-ADD-07・R-KW-WING・R-KW-READ-01・R-KW-BREAKER・R-KW-MORPH・R-STK-03）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types/game";
import {
  attack,
  attackTargets,
  bpOf,
  breakerTests,
  canEnter,
  canSkip,
  canStartRush,
  categoriesOf,
  choiceIds,
  destroyedInEnemyBattle,
  enemyAttacks,
  enemyRushes,
  enemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  faceUp,
  fill,
  heldN,
  inst,
  legal,
  morphCandidates,
  mountAndRideOff,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  spOf,
  sUnit,
  vehicleCard,
  wingTests,
  withStacked,
  faceDown,
  zoneOf,
} from "./XG6-023-044.helpers";

const DA1 = sUnit("SPEC-DA1", { category: "DA", bp: 1000 });
const DA15 = sUnit("SPEC-DA15", { category: "DA", bp: 1500 });
const L10 = sUnit("SPEC-L10", { bp: 10000, size: "L" });
const C5 = sUnit("SPEC-C5", { category: "DA", bp: 1000, powerCost: 5 });
const C4 = sUnit("SPEC-C4", { category: "DA", bp: 1000, powerCost: 4 });
const DD = sUnit("SPEC-DD", { category: "ET", bp: 1000, features: ["仮面ライダー", "男", "ダブルドライバー"] });
const WB4 = sUnit("SPEC-WB4", { category: "WB", bp: 4000 });
const VEH = vehicleCard("SPEC-VEH");
const EXTRA = [DA1, DA15, L10, C5, C4, DD, WB4, VEH];

// ===========================================================================
describe("XG6-030 ネオショッカー大首領", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 ※これは敵軍ターン中、ウイングを持つユニットとバトルしたときバトルに勝っても撃破される。 【唯一の弱点】これは自軍コマンドがすべてホールド状態なら、敵軍Sユニットにアタックされない。";
  const PAGE = "atwiki/page-2324";

  it(`XG6-030: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-030", TEXT);
    expectUnit("XG6-030", { name: "ネオショッカー大首領", category: "DA", size: "L", bp: 4000, sp: 1, powerCost: 5, features: ["ネオショッカー", "獣", "ドラゴン"] });
    expectRushCondition("XG6-030", undefined);
    expectRarityIn("XG6-030", ["R"]);
  });

  it(`XG6-030: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（ホールドなしの進入はなく、コマンドがなければ出られない）（出典: ${PAGE}・R-ADD-07）`, () => {
    const s = p1Battle({ rush: [inst("XG6-030", "n")], command: [released("TST-OP", "c")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG6-030:n")).toBe(false);
    expect(legal(s).some((a) => a.type === "initiate_command_payment" && a.kind === "battle_entry" && a.sourceInstanceId === "XG6-030:n")).toBe(true);
    expect(canEnter(p1Battle({ rush: [inst("XG6-030", "n")] }, {}, EXTRA), "XG6-030:n")).toBe(false);
  });

  it(
    `XG6-030: ※ 敵軍ターン中、ウイングを持つユニット（XG6-028 スカイオン BP3000）とバトルすると、勝っても撃破される（出典: ${PAGE}「ウイングを持つユニットとバトルしたときバトルに勝っても撃破される」）`,
    () => {
      const s = settle(enemyAttacks(enemyTurn({ battle: [inst("XG6-030", "n")] }, { battle: [inst("XG6-028", "w")] }, EXTRA), "XG6-028:w", "XG6-030:n"));
      expect(zoneOf(s, "player2", "XG6-028:w")).toBe("discard");
      expect(zoneOf(s, "player1", "XG6-030:n")).toBe("discard");
    },
  );

  it(`XG6-030: ※ ウイングを持たないユニット（BP1000）とのバトルに勝てば場に残る（出典: ${PAGE}「ウイングを持つユニットと」）`, () => {
    const s = settle(enemyAttacks(enemyTurn({ battle: [inst("XG6-030", "n")] }, { battle: [inst("TST-UNIT-0", "u")] }, EXTRA), "TST-UNIT-0:u", "XG6-030:n"));
    expect(zoneOf(s, "player1", "XG6-030:n")).toBe("battle");
  });

  it(
    `XG6-030: 【唯一の弱点】自軍コマンドがすべてホールド状態なら、敵軍 S ユニットにアタックされない（出典: ${PAGE}「自軍コマンドがすべてホールド状態なら、敵軍Sユニットにアタックされない」）`,
    () => {
      const s = enemyTurn({ battle: [inst("XG6-030", "n")], command: heldN(2) }, { battle: [inst("TST-UNIT-0", "s")] }, EXTRA);
      expect(attackTargets(s, "TST-UNIT-0:s", "player2")).not.toContain("XG6-030:n");
    },
  );

  it(`XG6-030: 【唯一の弱点】L ユニットにはアタックされる。リリース状態のコマンドがあるとき・コマンドがないときは S ユニットにもアタックされる（出典: ${PAGE}「敵軍Sユニットに」「すべてホールド状態なら」・カード評価「自軍コマンドが0枚のときは効果を発動できない」）`, () => {
    const held = enemyTurn({ battle: [inst("XG6-030", "n")], command: heldN(2) }, { battle: [inst("SPEC-L10", "l")] }, EXTRA);
    expect(attackTargets(held, "SPEC-L10:l", "player2")).toContain("XG6-030:n");
    const mixed = enemyTurn({ battle: [inst("XG6-030", "n")], command: [...heldN(1), released("TST-OP", "r")] }, { battle: [inst("TST-UNIT-0", "s")] }, EXTRA);
    expect(attackTargets(mixed, "TST-UNIT-0:s", "player2")).toContain("XG6-030:n");
    const none = enemyTurn({ battle: [inst("XG6-030", "n")] }, { battle: [inst("TST-UNIT-0", "s")] }, EXTRA);
    expect(attackTargets(none, "TST-UNIT-0:s", "player2")).toContain("XG6-030:n");
  });
});

// ===========================================================================
describe("XG6-031 ジョーカーアンデッド", () => {
  const TEXT =
    "※これは手札からしかラッシュできない。 ※これがユニットでなくなるとき、自軍捨札を3枚選びゲームから除外すれば、その場に留まる。 ※これが自軍エリアにある間、本来のBPの下三桁が500でない自軍ユニットはラッシュできない。 【種の根絶】これをラッシュしたとき、これ以外の自軍ユニットをすべて捨札にする。また、ユニットがこれ1体だけなら、これは「SP3」になる。";
  const PAGE = "atwiki/page-2327";

  it(`XG6-031: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-031", TEXT);
    expectUnit("XG6-031", { name: "ジョーカーアンデッド", category: "DA", size: "S", bp: 6500, sp: 1, powerCost: "4+", features: ["アンデッド"] });
    expectRushCondition("XG6-031", "state_gate", "自軍捨札が5枚以上ある");
    expectRarityIn("XG6-031", ["R"]);
  });

  const board = (discard: number, extra: Partial<Parameters<typeof rushBoard>[0]> = {}) =>
    rushBoard({ hand: [inst("XG6-031", "j")], command: releasedCat("DA", 1), power: powerCards(4), discard: fill(discard, "dd"), ...extra }, {}, EXTRA);

  it(
    `XG6-031: 追加条件 — 自軍捨札が5枚あれば手札からラッシュできる（出典: ${PAGE}「自軍捨札が5枚以上ある」）`,
    () => {
      const r = rushFromHand(board(5), "player1", "XG6-031:j");
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-031:j")).toBe("rush");
    },
  );

  it(`XG6-031: 追加条件 — 自軍捨札が4枚ではラッシュできない（出典: ${PAGE}）`, () => {
    expect(canStartRush(board(4), "player1", "XG6-031:j")).toBe(false);
  });

  it(
    `XG6-031: 【種の根絶】ラッシュしたとき、これ以外の自軍ユニット（バトルエリア・ラッシュエリア）をすべて捨札にする（出典: ${PAGE}「これ以外の自軍ユニットをすべて捨札にする」）`,
    () => {
      const r = rushFromHand(board(5, { battle: [inst("TST-UNIT-0", "a")], rush: [inst("SPEC-DA15", "b")] }), "player1", "XG6-031:j");
      const s = resolveAll(r.state);
      expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
      expect(zoneOf(s, "player1", "SPEC-DA15:b")).toBe("discard");
      expect(zoneOf(s, "player1", "XG6-031:j")).toBe("rush");
    },
  );

  it(
    `XG6-031: 【種の根絶】ユニットがこれ1体だけなら「SP3」（ラッシュしたターンの後も続く）（出典: ${PAGE}「ユニットがこれ1体だけなら、これは「SP3」になる」・Q1「ラッシュしたターン以降も有効」）`,
    () => {
      expect(spOf(p1Battle({ battle: [inst("XG6-031", "j")] }, {}, EXTRA), "player1", "XG6-031:j")).toBe(3);
    },
  );

  it(`XG6-031: 【種の根絶】ほかのユニット（敵軍のユニットも数える）があれば SP1 のまま（出典: ${PAGE}「ユニットがこれ1体だけなら」）`, () => {
    expect(spOf(p1Battle({ battle: [inst("XG6-031", "j")] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA), "player1", "XG6-031:j")).toBe(1);
  });

  it(
    `XG6-031: ※ これが自軍エリアにある間、本来の BP の下三桁が500でない自軍ユニット（BP1000）はラッシュできない（出典: ${PAGE}「本来のBPの下三桁が500でない自軍ユニットはラッシュできない」）`,
    () => {
      const s = rushBoard({ battle: [inst("XG6-031", "j")], hand: [inst("SPEC-DA1", "u")], command: releasedCat("DA", 1), power: powerCards(3) }, {}, EXTRA);
      expect(canStartRush(s, "player1", "SPEC-DA1:u")).toBe(false);
    },
  );

  it(`XG6-031: ※ 本来の BP の下三桁が500の自軍ユニット（BP1500）はラッシュできる（出典: ${PAGE}・カード評価「下500」）`, () => {
    const s = rushBoard({ battle: [inst("XG6-031", "j")], hand: [inst("SPEC-DA15", "u")], command: releasedCat("DA", 1), power: powerCards(3) }, {}, EXTRA);
    expect(canStartRush(s, "player1", "SPEC-DA15:u")).toBe(true);
  });

  it(
    `XG6-031: ※ ユニットでなくなるとき（バトルで撃破）、自軍捨札を3枚選んでゲームから除外すれば、その場に留まる（出典: ${PAGE}「自軍捨札を3枚選びゲームから除外すれば、その場に留まる」・カード評価「最低でも1回は耐久可能」）`,
    () => {
      const s = destroyedInEnemyBattle(inst("XG6-031", "j"), { discard: fill(3, "dd") }, {}, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-031");
      const t = resolveAll(s);
      expect(zoneOf(t, "player1", "XG6-031:j")).toBe("battle");
      expect(t.players.player1.exile).toHaveLength(3);
    },
  );

  it(`XG6-031: ※ 自軍捨札が2枚しかなければ留まれず捨札になる（出典: ${PAGE}「3枚選び」）`, () => {
    const s = resolveAll(destroyedInEnemyBattle(inst("XG6-031", "j"), { discard: fill(2, "dd") }, {}, EXTRA));
    expect(zoneOf(s, "player1", "XG6-031:j")).toBe("discard");
  });

  it.todo("XG6-031: ※ 手札からしかラッシュできない — 手札以外からラッシュする効果と組み合わせる手順を、本範囲では用意していない（追加条件の時点でラッシュできないため）");
});

// ===========================================================================
describe("XG6-032 巨大邪神14", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍Sユニットを1体選び、これの下にウラ向きで重ねる。 これがユニットでなくなるとき、これにウラ向きで重ねたカードは捨札になる。 【絶対的な最強の力】 このユニットの下にウラ向きで重ねたカードがあれば、これは次の能力を得る⇒敵軍ユニット1体につきBP+1000され、BP12000以上のときSP2になる。";
  const PAGE = "atwiki/page-2288";

  it(`XG6-032: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-032", TEXT);
    expectUnit("XG6-032", { name: "巨大邪神14", category: "DA", size: "L", bp: 8000, sp: 1, powerCost: "14-", features: ["ドラゴン"] });
    expectRushCondition("XG6-032", "zord_down_discard_power_cards", "必要パワーの数字が5以上の自軍パワーを4枚捨札にすれば必要パワー0になる");
    expectRarityIn("XG6-032", ["N"]);
  });

  const fivePlus = (): CardInstance[] => [faceUp("SPEC-C5", "a"), faceUp("SPEC-C5", "b"), faceUp("SPEC-C5", "c"), faceUp("SPEC-C5", "d")];

  it(
    `XG6-032: 追加条件 — 必要パワーの数字が5以上の自軍パワー4枚を捨札にすれば、必要パワー0でラッシュできる（出典: ${PAGE}「必要パワーの数字が5以上の自軍パワーを4枚捨札にすれば必要パワー0になる」）`,
    () => {
      const r = rushFromHand(rushBoard({ hand: [inst("XG6-032", "z")], command: releasedCat("DA", 1), power: fivePlus(), battle: [inst("TST-UNIT-0", "u")] }, {}, EXTRA), "player1", "XG6-032:z");
      expect(r.ok).toBe(true);
      expect(r.state.players.player1.power).toHaveLength(0);
    },
  );

  it(`XG6-032: 必要パワー14- — 自軍パワー14ならラッシュでき、13ではできない（必要パワー4の自軍パワーでは追加条件にならない）（出典: ${PAGE}・R-ADD-02）`, () => {
    const mk = (pw: CardInstance[]) => rushBoard({ hand: [inst("XG6-032", "z")], command: releasedCat("DA", 1), power: pw }, {}, EXTRA);
    expect(rushFromHand(mk(powerCards(14)), "player1", "XG6-032:z").ok).toBe(true);
    expect(canStartRush(mk([faceUp("SPEC-C4", "a"), faceUp("SPEC-C4", "b"), faceUp("SPEC-C4", "c"), faceUp("SPEC-C4", "d"), ...powerCards(9)]), "player1", "XG6-032:z")).toBe(false);
  });

  it(
    `XG6-032: ※ ラッシュしたとき、自軍 S ユニットを1体選び、これの下にウラ向きで重ねる（出典: ${PAGE}「自軍Sユニットを1体選び、これの下にウラ向きで重ねる」）`,
    () => {
      const r = rushFromHand(rushBoard({ hand: [inst("XG6-032", "z")], command: releasedCat("DA", 1), power: powerCards(14), battle: [inst("TST-UNIT-0", "u")] }, {}, EXTRA), "player1", "XG6-032:z");
      const s = resolveAll(r.state);
      const z = s.players.player1.rush.find((c) => c.instanceId === "XG6-032:z");
      expect((z?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["TST-UNIT-0:u"]);
    },
  );

  it(
    `XG6-032: 【絶対的な最強の力】下にウラ向きのカードがあれば、敵軍ユニット1体につき BP+1000（4体で BP12000）、BP12000 以上で SP2（出典: ${PAGE}「敵軍ユニット1体につきBP+1000され、BP12000以上のときSP2になる」）`,
    () => {
      const s = p1Battle(
        { battle: [withStacked(inst("XG6-032", "z"), [faceDown("TST-UNIT-0", "x")])] },
        { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")], rush: [inst("TST-UNIT-0", "e4")] },
        EXTRA,
      );
      expect(bpOf(s, "player1", "XG6-032:z")).toBe(12000);
      expect(spOf(s, "player1", "XG6-032:z")).toBe(2);
    },
  );

  it(`XG6-032: 【絶対的な最強の力】下に重ねたカードがなければ、敵軍ユニットがいても BP8000・SP1 のまま（出典: ${PAGE}「重ねたカードがあれば」）`, () => {
    const s = p1Battle({ battle: [inst("XG6-032", "z")] }, { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")] }, EXTRA);
    expect(bpOf(s, "player1", "XG6-032:z")).toBe(8000);
    expect(spOf(s, "player1", "XG6-032:z")).toBe(1);
  });
});

// ===========================================================================
/** 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。（リードMAを持つ自軍ユニットがあるとき無効になる）」 */
function holdUnlessLeadTests(id: string, page: string) {
  it(`${id}: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（ホールドなしの進入はない）（出典: ${page}・R-ADD-07）`, () => {
    const s = p1Battle({ rush: [inst(id, "a")], command: [released("TST-OP", "c")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === `${id}:a`)).toBe(false);
    expect(canEnter(s, `${id}:a`)).toBe(true);
    expect(canEnter(p1Battle({ rush: [inst(id, "a")] }, {}, EXTRA), `${id}:a`)).toBe(false);
  });
  it(`${id}: ※ リード MA を持つ自軍ユニット（XG6-026 グランディオン）があれば、コマンドをホールドせずに出られる（出典: ${page}「リードMAを持つ自軍ユニットがあるとき無効になる」）`, () => {
    const s = p1Battle({ rush: [inst(id, "a")], battle: [inst("XG6-026", "ld")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === `${id}:a`)).toBe(true);
  });
}

describe("XG6-033 シロネリオオザル", () => {
  const PAGE = "atwiki/page-2291";
  it(`XG6-033: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-033", "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 （この効果はリードMAを持つ自軍ユニットがあるとき無効になる）");
    expectUnit("XG6-033", { name: "シロネリオオザル", category: "MA", size: "M", bp: 6000, sp: undefined, powerCost: 4, features: ["ディスクアニマル"] });
    expectRushCondition("XG6-033", undefined);
    expectRarityIn("XG6-033", ["N"]);
  });
  holdUnlessLeadTests("XG6-033", PAGE);
});

describe("XG6-034 ケシズミガラス", () => {
  const PAGE = "atwiki/page-2295";
  it(`XG6-034: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-034", "※ウイング ※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 （このテキストはリードMAを持つ自軍ユニットがあるとき無効になる）");
    expectUnit("XG6-034", { name: "ケシズミガラス", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 3, features: ["ディスクアニマル"] });
    expectRushCondition("XG6-034", undefined);
    expectRarityIn("XG6-034", ["N"]);
  });
  wingTests("XG6-034", PAGE);
  holdUnlessLeadTests("XG6-034", PAGE);
});

// ===========================================================================
describe("XG6-035 仮面ライダーW・CJX", () => {
  const TEXT =
    "※ブレイカー ※これは自軍コマンドゾーンにあるカテゴリが追加される。 ※これは手札からしかラッシュできない。 【ビッカーチャージブレイク】このユニットは、これが持っているカテゴリ１つにつきBP＋2000される。また、これがアタックして敵軍ユニットを撃破したとき、これのBPが11000以上なら相手に1点ダメージを与える。";
  const PAGE = "atwiki/page-2317";

  it(`XG6-035: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-035", TEXT);
    expectUnit("XG6-035", { name: "仮面ライダーW・CJX", category: "ET", size: "S", bp: 3000, sp: 1, powerCost: "5+", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRushCondition("XG6-035", "discard_feature_unit", "特徴「ダブルドライバー」を持つ自軍ユニットを１体コマンドゾーンに送るか捨札にする");
    expectRarityIn("XG6-035", ["SR"]);
  });

  const board = (rush: CardInstance[] = [inst("SPEC-DD", "d")]) => rushBoard({ hand: [inst("XG6-035", "w")], rush, command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);

  it(`XG6-035: 追加条件 — 特徴「ダブルドライバー」を持つ自軍ユニットを捨札にしても、コマンドゾーンに送ってもラッシュできる（出典: ${PAGE}「コマンドゾーンに送るか捨札にする」）`, () => {
    const a = rushFromHand(board(), "player1", "XG6-035:w");
    expect(a.ok).toBe(true);
    expect(zoneOf(a.state, "player1", "SPEC-DD:d")).toBe("discard");
    const b = rushFromHand(board(), "player1", "XG6-035:w", { destination: "command" });
    expect(b.ok).toBe(true);
    expect(zoneOf(b.state, "player1", "SPEC-DD:d")).toBe("command");
  });

  it(`XG6-035: 追加条件 — 特徴「ダブルドライバー」を持つ自軍ユニットがなければラッシュできない（出典: ${PAGE}）`, () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG6-035:w")).toBe(false);
  });

  breakerTests("XG6-035", PAGE, "ET", EXTRA, { rush: [inst("SPEC-DD", "d")] }, "同名の自軍ユニットがバトルエリアにあってもラッシュを始められる");

  const field = (command: CardInstance[]) => p1Battle({ battle: [inst("XG6-035", "w")], command }, { battle: [inst("SPEC-WB4", "e")] }, EXTRA);
  const three = () => [released("TST-OP", "c1"), released("TST-OP-MA", "c2"), released("TST-OP-DA", "c3")];

  it.fails(
    `XG6-035: ※ 自軍コマンドゾーンにあるカテゴリ（WB・MA・DA）が追加される（場でも手札でも）（出典: ${PAGE}「これは自軍コマンドゾーンにあるカテゴリが追加される」・Q1「はい、追加されます」）— 既知の不具合: CARD-XG6-035 カテゴリが ET のまま`,
    () => {
      expect([...categoriesOf(field(three()), "player1", "XG6-035:w")].sort()).toEqual(["DA", "ET", "MA", "WB"]);
      const h = rushBoard({ hand: [inst("XG6-035", "w")], command: [released("TST-OP-MA", "c")] }, {}, EXTRA);
      expect([...categoriesOf(h, "player1", "XG6-035:w")].sort()).toEqual(["ET", "MA"]);
    },
  );

  it(
    `XG6-035: 【ビッカーチャージブレイク】持っているカテゴリ1つにつき BP+2000（ET だけなら BP5000、4つなら BP11000）（出典: ${PAGE}「これが持っているカテゴリ１つにつきBP＋2000される」・カード評価「単色でもBPは5000まで上昇する」）`,
    () => {
      expect(bpOf(field([]), "player1", "XG6-035:w")).toBe(5000);
      expect(bpOf(field(three()), "player1", "XG6-035:w")).toBe(11000);
    },
  );

  it(
    `XG6-035: 【ビッカーチャージブレイク】BP11000 以上でアタックして敵軍ユニットを撃破したとき、相手に1点ダメージを与える（出典: ${PAGE}「これのBPが11000以上なら相手に1点ダメージを与える」・Q2）`,
    () => {
      const s = settle(attack(field(three()), "XG6-035:w", "SPEC-WB4:e"));
      expect(zoneOf(s, "player2", "SPEC-WB4:e")).toBe("discard");
      expect(s.players.player2.damage).toBe(1);
    },
  );

  it.todo("XG6-035: ※ 手札からしかラッシュできない — 手札以外からラッシュする効果と組み合わせる手順を、本範囲では用意していない");
});

// ===========================================================================
describe("XG6-036 仮面ライダーW・CJ", () => {
  const TEXT =
    "※モーフ 【メモリチェンジ】カード名に「CJ」を含まない、モーフと特徴「ダブルドライバー」を持つユニットカードを自軍コマンドゾーンから1枚選び、これと置き換えてもよい。このとき出したユニットは、ライドオフした直後のユニットとして扱い、RCの効果を持っていれば、その効果を発動する。";
  const PAGE = "atwiki/page-2321";

  it(`XG6-036: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-036", TEXT);
    expectUnit("XG6-036", { name: "仮面ライダーW・CJ", category: "ET", size: "S", bp: 2000, sp: "1/5", powerCost: 2, comboNumber: "RC", features: ["仮面ライダー", "男", "ダブルドライバー"] });
    expectRushCondition("XG6-036", undefined);
    expectRarityIn("XG6-036", ["R"]);
  });

  it(`XG6-036: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（XG2-043）と置き換えられる。特徴が違う RK-261 は選べない（出典: ${PAGE}「※モーフ」・R-KW-MORPH-01・R-KW-MORPH-03）`, () => {
    let s = enemyRushes({ battle: [inst("XG6-036", "cj")], command: [released("XG2-043", "a"), released("RK-261", "b")] }, "TST-UNIT-0:e");
    expect(morphCandidates(s)).toEqual(["XG2-043:a"]);
    s = settle(pickAs(s, "player1", "XG2-043:a"));
    expect(zoneOf(s, "player1", "XG2-043:a")).toBe("battle");
    expect(zoneOf(s, "player1", "XG6-036:cj")).toBe("command");
  });

  const rc = () =>
    mountAndRideOff(
      p1Battle({ rush: [inst("XG6-036", "cj"), inst("SPEC-VEH", "v")], command: [released("XG2-045", "lt"), released("SX-003", "fj"), released("XG2-043", "cj2"), released("XG6-035", "cjx"), released("SPEC-DD", "dd")] }, {}, EXTRA),
      "XG6-036:cj",
      "SPEC-VEH:v",
    );

  it(
    `XG6-036: RC【メモリチェンジ】自軍コマンドゾーンの、カード名に「CJ」を含まずモーフと特徴「ダブルドライバー」を持つユニットカードから1枚選べる（任意）（出典: ${PAGE}「カード名に「CJ」を含まない、モーフと特徴「ダブルドライバー」を持つユニットカードを自軍コマンドゾーンから1枚選び…てもよい」）`,
    () => {
      const s = rc();
      expectChoiceFrom(s, "player1", "XG6-036");
      expect(choiceIds(s)).toEqual(["SX-003:fj", "XG2-045:lt"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-036: RC — 選んだカードとこれを置き換える（選んだカードはこれの位置に出て、これはコマンドゾーンへ）（出典: ${PAGE}「これと置き換えてもよい」・R-KW-MORPH-02）`,
    () => {
      const s = resolveAll(pick(rc(), "XG2-045:lt"));
      expect(zoneOf(s, "player1", "XG2-045:lt")).toBe("battle");
      expect(zoneOf(s, "player1", "XG6-036:cj")).toBe("command");
    },
  );
});
