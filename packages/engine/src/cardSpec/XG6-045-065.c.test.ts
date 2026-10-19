/**
 * カード別スペック: XG6-059〜XG6-065（クロスギャザー ザ・ギガンティックタイタン 仮面ライダーオーズ・タカトラーター〜サブマシーン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-060 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-01・R-KW-WING・R-KW-MORPH・R-STK）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。カタログの誤りは「カタログ」と書く。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attackTargets,
  beltUsed,
  bpOf,
  canEndPhase,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  destroyedInEnemyBattle,
  enemyTurn,
  entered,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  inst,
  legal,
  morphTest,
  mount,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  spOf,
  st,
  sUnit,
  toTurnEnd,
  wingTests,
  zoneOf,
  deckCards,
} from "./XG6-045-065.helpers";

const ETL = sUnit("SPEC-ETL", { category: "ET", bp: 10000, size: "L" });
const WBL = sUnit("SPEC-WBL", { category: "WB", bp: 10000, size: "L" });
const S3K = sUnit("SPEC-S3K", { bp: 3000 });
const E9K = sUnit("SPEC-E9K", { bp: 9000 });
const E8K = sUnit("SPEC-E8K", { bp: 8000, size: "M" });
const MECHA3 = sUnit("SPEC-MECHA3", { category: "ET", bp: 1000, powerCost: 3, features: ["メカ"] });
const MECHA5 = sUnit("SPEC-MECHA5", { category: "ET", bp: 1000, powerCost: 5, features: ["メカ"] });
const PLAIN3 = sUnit("SPEC-PLAIN3", { category: "ET", bp: 1000, powerCost: 3 });
const C1 = sUnit("SPEC-C1", { category: "DA", bp: 1000, powerCost: 1 });
const C8 = sUnit("SPEC-C8", { category: "DA", bp: 1000, powerCost: 8 });
const EXTRA = [ETL, WBL, S3K, E9K, E8K, MECHA3, MECHA5, PLAIN3, C1, C8];

// ===========================================================================
describe("XG6-059 仮面ライダーオーズ・タカトラーター", () => {
  const TEXT = "※モーフ ※ウイング ※これは毎ターン、可能ならバトルエリア に出る。 ※これはBP3000以上のユニットにアタックされない。";
  const PAGE = "atwiki/page-2296";

  it(`XG6-059: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-059", TEXT);
    expectUnit("XG6-059", { name: "仮面ライダーオーズ・タカトラーター", category: "WB", size: "S", bp: 1000, sp: "1/2", powerCost: 2, features: ["仮面ライダー", "男", "オーズドライバー"] });
    expectRushCondition("XG6-059", undefined);
    expectRarityIn("XG6-059", ["N"]);
  });

  morphTest("XG6-059", "XG6-058", "XG6-036", PAGE);
  wingTests("XG6-059", PAGE);

  it(`XG6-059: ※ 毎ターン、可能ならバトルエリアに出る（出さずにバトルフェイズを終えられない）（出典: ${PAGE}「これは毎ターン、可能ならバトルエリアに出る」）`, () => {
    expect(canEndPhase(p1Battle({ rush: [inst("XG6-059", "t")] }, {}, EXTRA))).toBe(false);
  });

  it(`XG6-059: ※ BP3000 以上のユニット（サイズを問わない）にアタックされない。BP1000 のユニットにはアタックされる（出典: ${PAGE}「これはBP3000以上のユニットにアタックされない」）`, () => {
    const s = enemyTurn({ battle: [inst("XG6-059", "t")] }, { battle: [inst("SPEC-S3K", "s3"), inst("SPEC-WBL", "l"), inst("TST-UNIT-0", "s1")] }, EXTRA);
    expect(attackTargets(s, "SPEC-S3K:s3", "player2")).not.toContain("XG6-059:t");
    expect(attackTargets(s, "SPEC-WBL:l", "player2")).not.toContain("XG6-059:t");
    expect(attackTargets(s, "TST-UNIT-0:s1", "player2")).toContain("XG6-059:t");
  });
});

// ===========================================================================
describe("XG6-060 タカカン", () => {
  const TEXT = "※これが自軍コマンドゾーンに置かれたとき、これを手札に加えてもよい。 ◎コマンドを１つ選び、カテゴリを１つ宣言する。そうしたとき、このターン、宣言したカテゴリを選んだコマンドに追加する。";
  const PAGE = "atwiki/page-2301";

  it(`XG6-060: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-060", TEXT);
    expectOpStats("XG6-060", { name: "タカカン", category: "ET", powerCost: 1 });
    expectRarityIn("XG6-060", ["N"]);
  });

  it.fails(`XG6-060: カタログの特徴が出典と一致（特徴「カンドロイド」）（出典: ${PAGE}「特徴：カンドロイド」）— 既知の不具合: CARD-XG6-060 カタログに特徴がない`, () => {
    expect(DEFS["XG6-060"]?.features ?? []).toEqual(["カンドロイド"]);
  });

  it.fails(
    `XG6-060: ※ チャージフェイズに自軍コマンドゾーンに置いたとき、手札に加えるかを選べる（任意）（出典: ${PAGE}「これが自軍コマンドゾーンに置かれたとき、これを手札に加えてもよい」・カード評価「ライドベンダーからサーチすると、そのまま手札に回収できる」）— 既知の不具合: CARD-XG6-060 選択が開かず、コマンドゾーンに残る`,
    () => {
      const s = act(st({ phase: "charge", player1: { hand: [inst("XG6-060", "tk")], deck: deckCards(3) } }, EXTRA), { type: "charge_command", playerId: "player1", instanceId: "XG6-060:tk" });
      expectChoiceFrom(s, "player1", "XG6-060");
      expect(canSkip(s)).toBe(true);
    },
  );

  it.fails(
    `XG6-060: ◎ コマンドを1つ（自軍・敵軍）選んでカテゴリを1つ宣言すると、このターン、そのコマンドにそのカテゴリが追加される（出典: ${PAGE}「コマンドを１つ選び、カテゴリを１つ宣言する。そうしたとき、このターン、宣言したカテゴリを選んだコマンドに追加する」・カード評価「敵軍コマンドに追加して一時的なパワー加速」）— 既知の不具合: CARD-XG6-060 何も選ばせない`,
    () => {
      const s = beltUsed("XG6-060", "ET", 1, { command: [released("TST-OP-MA", "m")] }, { command: [released("TST-OP", "e")] }, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-060");
      expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-OP-MA:m", "TST-OP:e"]));
    },
  );
});

// ===========================================================================
describe("XG6-061 ライドベンダー", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1000される。 【ベンダーモード】自軍ラッシュフェイズ中、このビークルを捨札にして次の効果を発動できる→自軍山札を見てオペレーションカードを1枚選び、自軍コマンドゾーンにホールド状態で置く（置けなければ自軍コマンドを1つ選び、捨札にしてから置く）。その後、山札をシャッフルする。";
  const PAGE = "atwiki/page-2289";

  it(`XG6-061: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-061", TEXT);
    const d = DEFS["XG6-061"]!;
    expect({ name: d.name, type: d.type, category: d.category, size: d.size, powerCost: d.powerCost, features: d.features }).toEqual({
      name: "ライドベンダー",
      type: "vehicle",
      category: "ET",
      size: "S",
      powerCost: 2,
      features: ["メカ", "車両"],
    });
    expectRushCondition("XG6-061", undefined);
    expectRarityIn("XG6-061", ["N"]);
  });

  it(`XG6-061: ※ これにライドしているユニット（XG6-054 スカル BP1000）は BP+1000（出典: ${PAGE}「これにライドしているユニットはBP+1000される」）`, () => {
    const s = mount(p1Battle({ rush: [inst("XG6-054", "sk"), inst("XG6-061", "rv")] }, {}, EXTRA), "XG6-054:sk", "XG6-061:rv");
    expect(bpOf(s, "player1", "XG6-054:sk")).toBe(2000);
  });

  it.fails(
    `XG6-061: 【ベンダーモード】自軍ラッシュフェイズ中、このビークルを捨札にして、山札のオペレーションカードを1枚選び自軍コマンドゾーンにホールド状態で置ける（出典: ${PAGE}「このビークルを捨札にして次の効果を発動できる→自軍山札を見てオペレーションカードを1枚選び、自軍コマンドゾーンにホールド状態で置く」）— 既知の不具合: CARD-XG6-061 発動する手段がない`,
    () => {
      const s = rushBoard({ rush: [inst("XG6-061", "rv")], deck: [inst("TST-UNIT-0", "u"), inst("XG6-060", "op"), ...deckCards(2)] }, {}, EXTRA);
      const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG6-061:rv"));
      expect(a).toBeDefined();
    },
  );
});

// ===========================================================================
describe("XG6-062 戦闘ワンセブン", () => {
  const TEXT =
    "※これがユニットでなくなったとき、自軍捨札から「要塞ワンセブン」のカードを１枚選び、自軍ラッシュエリアに出す。 【グラビトン攻撃】これが自軍エリアにある間、自分がターンを終えるとき、このユニットのBP以下のBPを持つ敵軍ユニットを１体選び撃破してもよい。そうしたとき、このユニットを捨札にする。";
  const PAGE = "atwiki/page-2311";

  it(`XG6-062: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-062", TEXT);
    expectUnit("XG6-062", { name: "戦闘ワンセブン", category: "ET", size: "L", bp: 8000, sp: 1, powerCost: "5+", features: ["メカ", "人型"] });
    expectRushCondition("XG6-062", "discard_named_unit", "自軍「要塞ワンセブン」１体を捨札にする");
    expectRarityIn("XG6-062", ["SR"]);
  });

  it(`XG6-062: 追加条件 — 自軍「要塞ワンセブン」1体を捨札にしてラッシュできる。いなければラッシュできない（出典: ${PAGE}「自軍「要塞ワンセブン」１体を捨札にする」）`, () => {
    const mk = (rush: ReturnType<typeof inst>[]) => rushBoard({ hand: [inst("XG6-062", "s")], rush, command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(mk([inst("XG6-064", "y")]), "player1", "XG6-062:s");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-064:y")).toBe("discard");
    expect(canStartRush(mk([]), "player1", "XG6-062:s")).toBe(false);
  });

  it.fails(
    `XG6-062: ※ ユニットでなくなったとき（バトルで撃破）、自軍捨札の「要塞ワンセブン」を1枚選んで自軍ラッシュエリアに出す（出典: ${PAGE}「自軍捨札から「要塞ワンセブン」のカードを１枚選び、自軍ラッシュエリアに出す」・カード評価「素体の要塞ワンセブンが返って来る」）— 既知の不具合: CARD-XG6-062 何も出さない`,
    () => {
      const s = resolveAll(destroyedInEnemyBattle(inst("XG6-062", "s"), { discard: [inst("XG6-064", "y")] }, {}, EXTRA));
      expect(zoneOf(s, "player1", "XG6-064:y")).toBe("rush");
    },
  );

  it.fails(
    `XG6-062: 【グラビトン攻撃】自分がターンを終えるとき、これの BP（8000）以下の BP の敵軍ユニット（エリア・サイズを問わない）を1体選んで撃破してよい。撃破したらこれを捨札にする（出典: ${PAGE}「このユニットのBP以下のBPを持つ敵軍ユニットを１体選び撃破してもよい。そうしたとき、このユニットを捨札にする」・カード評価「エリアを問わず」）— 既知の不具合: CARD-XG6-062 ターンを終えるときに選択が開かない`,
    () => {
      let s = toTurnEnd(p1Battle({ battle: [inst("XG6-062", "s")] }, { battle: [inst("SPEC-E9K", "big")], rush: [inst("SPEC-E8K", "m")] }, EXTRA), "XG6-062");
      expectChoiceFrom(s, "player1", "XG6-062");
      expect(choiceIds(s)).toEqual(["SPEC-E8K:m"]);
      expect(canSkip(s)).toBe(true);
      s = resolveAll(pick(s, "SPEC-E8K:m"));
      expect(zoneOf(s, "player2", "SPEC-E8K:m")).toBe("discard");
      expect(zoneOf(s, "player1", "XG6-062:s")).toBe("discard");
    },
  );
});

// ===========================================================================
describe("XG6-063 ワンエイト", () => {
  const TEXT =
    "※これはDAを持つコマンドがないとき、アタックすることができない。 【全弾発射】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを2つホールドしてもよい。そうしたとき、このターン、これはSP1/5になり、ホールドしたコマンドの必要パワーの数字が1と8だったなら、SP1になる。";
  const PAGE = "atwiki/page-2353";

  it(`XG6-063: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-063", TEXT);
    expectUnit("XG6-063", { name: "ワンエイト", category: ["ET", "DA"], size: "L", bp: 8000, sp: "special", powerCost: 8, features: ["メカ", "人型"] });
    expectRushCondition("XG6-063", undefined);
    expectRarityIn("XG6-063", ["R"]);
  });

  it.fails(
    `XG6-063: ※ DA を持つコマンド（両軍とも）がないとき、アタックできない（出典: ${PAGE}「これはDAを持つコマンドがないとき、アタックすることができない」）— 既知の不具合: CARD-XG6-063 アタックできる`,
    () => {
      const s = p1Battle({ battle: [inst("XG6-063", "w")], command: [released("TST-OP", "c")] }, { battle: [inst("TST-UNIT-0", "x")], command: [released("TST-OP-ET", "ec")] }, EXTRA);
      expect(attackTargets(s, "XG6-063:w")).toEqual([]);
    },
  );

  it(`XG6-063: ※ DA を持つ自軍コマンドがあればアタックできる（出典: ${PAGE}）`, () => {
    const s = p1Battle({ battle: [inst("XG6-063", "w")], command: [released("TST-OP-DA", "c")] }, { battle: [inst("TST-UNIT-0", "x")] }, EXTRA);
    expect(attackTargets(s, "XG6-063:w")).toContain("TST-UNIT-0:x");
  });

  it(`XG6-063: SP は「！」— 【全弾発射】を使わなければ SP を持たない（出典: ${PAGE}「SP：！」）`, () => {
    expect(spOf(p1Battle({ battle: [inst("XG6-063", "w")] }, {}, EXTRA), "player1", "XG6-063:w")).toBe(0);
  });

  it.fails(
    `XG6-063: 【全弾発射】出たとき、自軍コマンドを2つホールドできる（任意）。必要パワーの数字が1と8のコマンドなら、このターン SP1（1番目でもストライクできる）（出典: ${PAGE}「自軍コマンドを2つホールドしてもよい…ホールドしたコマンドの必要パワーの数字が1と8だったなら、SP1になる」）— 既知の不具合: CARD-XG6-063 選択が開かない（ログだけ出る）`,
    () => {
      let s = entered("XG6-063:w", { command: [released("SPEC-C1", "c1"), released("SPEC-C8", "c8"), released("TST-OP-DA", "c3")] }, {}, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-063");
      expect(canSkip(s)).toBe(true);
      s = resolveAll(pick(pick(s, "SPEC-C1:c1"), "SPEC-C8:c8"));
      expect(spOf(s, "player1", "XG6-063:w")).toBe(1);
    },
  );
});

// ===========================================================================
describe("XG6-064 要塞ワンセブン", () => {
  const TEXT =
    "※ウイング ※これはバトルエリアに出られない。 【要塞能力】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ、自分の手札を1枚捨札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字以下の必要パワーの数字を持ち、特徴「メカ」を持つカードを自軍捨札から1枚選び手札に加える。";
  const PAGE = "atwiki/page-2333";

  it(`XG6-064: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-064", TEXT);
    expectUnit("XG6-064", { name: "要塞ワンセブン", category: "ET", size: "L", bp: 5000, sp: undefined, powerCost: 5, features: ["メカ", "母艦"] });
    expectRushCondition("XG6-064", undefined);
    expectRarityIn("XG6-064", ["R"]);
  });

  wingTests("XG6-064", PAGE);

  it(`XG6-064: ※ バトルエリアに出られない（コマンドがあっても）（出典: ${PAGE}「これはバトルエリアに出られない」）`, () => {
    expect(canEnter(p1Battle({ rush: [inst("XG6-064", "y")], command: [released("TST-OP-ET", "c")] }, {}, EXTRA), "XG6-064:y")).toBe(false);
  });

  it.fails(
    `XG6-064: 【要塞能力】自軍ラッシュフェイズに、手札を1枚捨札にして、その必要パワーの数字（3）以下で特徴「メカ」を持つカードを自軍捨札から1枚手札に加えられる（出典: ${PAGE}「自分の手札を1枚捨札にしてもよい。そうしたとき…特徴「メカ」を持つカードを自軍捨札から1枚選び手札に加える」）— 既知の不具合: CARD-XG6-064 発動する手段がない`,
    () => {
      const s = rushBoard({ rush: [inst("XG6-064", "y")], hand: [inst("SPEC-PLAIN3", "h")], discard: [inst("SPEC-MECHA3", "m3"), inst("SPEC-MECHA5", "m5")] }, {}, EXTRA);
      const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG6-064:y"));
      expect(a).toBeDefined();
    },
  );
});

// ===========================================================================
describe("XG6-065 サブマシーン", () => {
  const TEXT = "※ウイング 【友情の証】これは自軍Lユニットがあれば、敵軍ユニットにアタックされない。また、このユニットと隣り合うETを持つLユニットはBP+1000される。";
  const PAGE = "atwiki/page-2299";

  it(`XG6-065: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-065", TEXT);
    expectUnit("XG6-065", { name: "サブマシーン", category: "ET", size: "S", bp: 1000, sp: undefined, powerCost: 3, features: ["メカ", "車両", "航空機"] });
    expectRushCondition("XG6-065", undefined);
    expectRarityIn("XG6-065", ["N"]);
  });

  wingTests("XG6-065", PAGE);

  it.fails(
    `XG6-065: 【友情の証】自軍 L ユニット（ラッシュエリアでもよい）があれば、敵軍ユニットにアタックされない（出典: ${PAGE}「これは自軍Lユニットがあれば、敵軍ユニットにアタックされない」）— 既知の不具合: CARD-XG6-065 アタックの対象になる`,
    () => {
      const s = enemyTurn({ battle: [inst("XG6-065", "sm")], rush: [inst("SPEC-ETL", "l")] }, { battle: [inst("TST-UNIT-0", "x")] }, EXTRA);
      expect(attackTargets(s, "TST-UNIT-0:x", "player2")).not.toContain("XG6-065:sm");
    },
  );

  it(`XG6-065: 【友情の証】自軍 L ユニットがなければアタックされる（出典: ${PAGE}「自軍Lユニットがあれば」）`, () => {
    const s = enemyTurn({ battle: [inst("XG6-065", "sm")] }, { battle: [inst("TST-UNIT-0", "x")] }, EXTRA);
    expect(attackTargets(s, "TST-UNIT-0:x", "player2")).toContain("XG6-065:sm");
  });

  it.fails(
    `XG6-065: 【友情の証】これと隣り合う（左右の）ET を持つ L ユニットは BP+1000。隣り合わない L ユニット・ET を持たない L ユニットは変わらない（出典: ${PAGE}「このユニットと隣り合うETを持つLユニットはBP+1000される」・カード評価「これ1つで2体まで強化できる」）— 既知の不具合: CARD-XG6-065 BP が上がらない`,
    () => {
      const s = p1Battle({ battle: [inst("SPEC-ETL", "l1"), inst("XG6-065", "sm"), inst("SPEC-ETL", "l2"), inst("SPEC-ETL", "l3")] }, {}, EXTRA);
      expect(bpOf(s, "player1", "SPEC-ETL:l1")).toBe(11000);
      expect(bpOf(s, "player1", "SPEC-ETL:l2")).toBe(11000);
      expect(bpOf(s, "player1", "SPEC-ETL:l3")).toBe(10000);
      const t = p1Battle({ battle: [inst("SPEC-WBL", "w"), inst("XG6-065", "sm")] }, {}, EXTRA);
      expect(bpOf(t, "player1", "SPEC-WBL:w")).toBe(10000);
    },
  );
});
