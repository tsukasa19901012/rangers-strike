/**
 * カード別スペック: XG6-045〜XG6-051（クロスギャザー ザ・ギガンティックタイタン テディ〜仮面ライダー歌舞鬼）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-046 Q1、XG6-048 Q1・Q2、XG6-050 Q1
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-READ-01・R-KW-CALL-01・R-KW-RESIST-01・R-STK-03）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  choiceIds,
  deckCards,
  enemyAttacks,
  enemyTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  faceUp,
  inst,
  leadTests,
  legal,
  ncEnter,
  p1Battle,
  payableFor,
  pick,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  residentOp,
  resistTest,
  resolveAll,
  rushBoard,
  rushFromHand,
  settle,
  spOf,
  sUnit,
  toTurnEnd,
  zoneOf,
} from "./XG6-045-065.helpers";

const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const KR = sUnit("SPEC-KR", { category: "WB", bp: 1000, features: ["仮面ライダー"] });
const KR_DA = sUnit("SPEC-KR-DA", { category: "DA", bp: 1000, features: ["仮面ライダー"] });
const KR_DAM = sUnit("SPEC-KR-DAM", { category: ["MA", "DA"] as never, bp: 1000, features: ["仮面ライダー"] });
const NOT_KR_DA = sUnit("SPEC-DA-PLAIN", { category: "DA", bp: 1000, features: ["男"] });
const MALE = sUnit("SPEC-MALE", { category: "WB", bp: 9000, features: ["男"] });
const UND = sUnit("SPEC-UND", { category: "DA", bp: 1000, powerCost: 1, features: ["アンデッド"] });
const DA_U = sUnit("SPEC-DA-U", { category: "DA", bp: 1000, powerCost: 1 });
const EXTRA = [C3, KR, KR_DA, KR_DAM, NOT_KR_DA, MALE, UND, DA_U];

// ===========================================================================
describe("XG6-045 テディ", () => {
  const TEXT =
    "※このユニットからコンビネーションする「仮面ライダーNEW電王SF」は、ナンバーにRCを持っていればライドオフしなくてもその効果を発動できる。また、このコンビネーションが成立している間BP+2000される。 【危険の排除】これをラッシュしたとき、自軍山札の上から1枚を見て、そのカードを自軍パワーゾーンのオモテ向きのカード1枚と置き換えるか、山札の上に戻す。";
  const PAGE = "atwiki/page-2305";

  it(`XG6-045: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-045", TEXT);
    expectUnit("XG6-045", { name: "テディ", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 2, features: ["イマジン"] });
    expectRushCondition("XG6-045", undefined);
    expectRarityIn("XG6-045", ["N"]);
  });

  const rushed = () =>
    rushFromHand(
      rushBoard({ hand: [inst("XG6-045", "td")], command: releasedCat("OT", 1), power: [faceUp("TST-OP", "fu"), ...powerCards(2)], deck: [inst("SPEC-C3", "top"), ...deckCards(2)] }, {}, EXTRA),
      "player1",
      "XG6-045:td",
    ).state;

  it(
    `XG6-045: 【危険の排除】ラッシュしたとき、山札の上のカードを、オモテ向きの自軍パワー1枚と置き換えられる（置き換えたパワーは山札の上へ）（出典: ${PAGE}「そのカードを自軍パワーゾーンのオモテ向きのカード1枚と置き換えるか、山札の上に戻す」）`,
    () => {
      let s = rushed();
      expectChoiceFrom(s, "player1", "XG6-045");
      s = resolveAll(pick(s, "TST-OP:fu"));
      expect(zoneOf(s, "player1", "SPEC-C3:top")).toBe("power");
      expect(s.players.player1.deck[0]?.instanceId).toBe("TST-OP:fu");
    },
  );

  it(`XG6-045: 【危険の排除】置き換えなければ、山札の上のカードは山札の上のまま（出典: ${PAGE}「山札の上に戻す」）`, () => {
    const s = rushed();
    expect(s.players.player1.deck[0]?.instanceId).toBe("SPEC-C3:top");
    expect(zoneOf(s, "player1", "TST-OP:fu")).toBe("power");
  });

  /** テディ（バトルエリア1番目）の次に NEW電王SF を出す（ライドしない）。山札の上は必要パワー3のカード、敵軍バトルエリアに S ユニット3体。 */
  const combo = () =>
    enter(
      p1Battle(
        { battle: [inst("XG6-045", "td")], rush: [inst("XG6-044", "sf")], deck: [inst("SPEC-C3", "top"), ...deckCards(2)] },
        { battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2"), inst("TST-UNIT-0", "b3")] },
        EXTRA,
      ),
      "XG6-044:sf",
    );

  it(
    `XG6-045: ※ テディからコンビネーションする NEW電王SF は、ライドオフしなくても RC【カウンターストライク】を発動できる（山札の上が必要パワー3 → 敵軍バトルエリア3番目の S ユニットを捨札）（出典: ${PAGE}「ナンバーにRCを持っていればライドオフしなくてもその効果を発動できる」・XG6-questions Q6）`,
    () => {
      const s = resolveAll(combo(), ["accept"]);
      expect(zoneOf(s, "player2", "TST-UNIT-0:b3")).toBe("discard");
    },
  );

  it(
    `XG6-045: ※ コンビネーションが成立している間、NEW電王SF は BP+2000（BP5000。SP1 の条件も満たす）（出典: ${PAGE}「このコンビネーションが成立している間BP+2000される」・カード評価「XG6の方のSP1の条件を満たすことができる」・XG6-questions Q6）`,
    () => {
      const s = combo();
      expect(bpOf(s, "player1", "XG6-044:sf")).toBe(5000);
    },
  );
});

// ===========================================================================
describe("XG6-046 仮面ライダーディエンドCF", () => {
  const TEXT =
    "※リードOT ※これは特徴｢仮面ライダー｣を持つ自軍ユニット1体につきBP+1000される｡ 【ゲキジョウバン】これを手札からラッシュした時、自軍山札の上から8枚までオモテにして､その中から特徴｢仮面ライダー｣を持つDAのユニットカードを自軍ラッシュエリアに出してもよい。ただし、同名のカードは2枚以上出せない。その後、残りのカードを山札に戻してシャッフルする。この効果で出したユニットは、このターン、ストライクできず、このターンを終えるとき、自軍エリアにあれば捨札になる。";
  const PAGE = "atwiki/page-2314";

  it(`XG6-046: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-046", TEXT);
    expectUnit("XG6-046", { name: "仮面ライダーディエンドCF", category: "OT", size: "S", bp: 2000, sp: 1, powerCost: 8, features: ["仮面ライダー", "男", "ディエンドライバー"] });
    expectRushCondition("XG6-046", undefined);
    expectRarityIn("XG6-046", ["SR"]);
  });

  leadTests("XG6-046", "OT", PAGE);

  it(
    `XG6-046: ※ 特徴「仮面ライダー」を持つ自軍ユニット（これ自身も）1体につき BP+1000（これだけなら BP3000、もう1体いれば BP4000。敵軍のユニットは数えない）（出典: ${PAGE}「特徴｢仮面ライダー｣を持つ自軍ユニット1体につきBP+1000される」・カード評価「自身も特徴「仮面ライダー」を持つため…実質BP3000」）`,
    () => {
      expect(bpOf(p1Battle({ battle: [inst("XG6-046", "de")] }, { battle: [inst("SPEC-KR", "ek")] }, EXTRA), "player1", "XG6-046:de")).toBe(3000);
      expect(bpOf(p1Battle({ battle: [inst("XG6-046", "de"), inst("SPEC-KR", "k")] }, {}, EXTRA), "player1", "XG6-046:de")).toBe(4000);
    },
  );

  it(
    `XG6-046: 【ゲキジョウバン】手札からラッシュしたとき、山札の上8枚の中の、特徴「仮面ライダー」を持つ DA のユニットカード（マルチカテゴリも）から出すカードを選べる。同名は1枚だけ（出典: ${PAGE}「その中から特徴｢仮面ライダー｣を持つDAのユニットカードを自軍ラッシュエリアに出してもよい。ただし、同名のカードは2枚以上出せない」・Q1「はい、できます」）`,
    () => {
      const deck = [inst("SPEC-KR-DA", "a"), inst("SPEC-KR-DA", "b"), inst("SPEC-KR-DAM", "m"), inst("SPEC-KR", "w"), inst("SPEC-DA-PLAIN", "p"), ...deckCards(3), inst("SPEC-KR-DA", "ninth")];
      const s = rushFromHand(rushBoard({ hand: [inst("XG6-046", "de")], command: releasedCat("OT", 1), power: powerCards(8), deck }, {}, EXTRA), "player1", "XG6-046:de").state;
      expectChoiceFrom(s, "player1", "XG6-046");
      expect(choiceIds(s)).toEqual(expect.arrayContaining(["SPEC-KR-DA:a", "SPEC-KR-DAM:m"]));
      expect(choiceIds(s)).not.toContain("SPEC-KR:w");
      expect(choiceIds(s)).not.toContain("SPEC-DA-PLAIN:p");
      expect(choiceIds(s)).not.toContain("SPEC-KR-DA:ninth");
      expect(canSkip(s)).toBe(true);
    },
  );
});

// ===========================================================================
describe("XG6-047 仮面ライダーG4", () => {
  const TEXT = "※これが自軍捨札にある間、自軍ラッシュフェイズ中、自軍コマンドを1つゲームから除外してから、これを自軍ラッシュエリアに出してもよい。 【ギガント】これをラッシュしたとき、特徴「仮面ライダー」を持つ敵軍ユニットを1体選び撃破する。";
  const PAGE = "atwiki/page-2307";

  it(`XG6-047: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-047", TEXT);
    expectUnit("XG6-047", { name: "仮面ライダーG4", category: ["ET", "DA"], size: "S", bp: 4000, sp: "1/5", powerCost: 6, features: ["仮面ライダー", "メカ", "男"] });
    expectRushCondition("XG6-047", undefined);
    expectRarityIn("XG6-047", ["N"]);
  });

  it(
    `XG6-047: ※ 自軍捨札にある間、自軍ラッシュフェイズ中に、自軍コマンドを1つゲームから除外して、これを自軍ラッシュエリアに出せる（必要パワー・カテゴリは問わない）（出典: ${PAGE}「自軍コマンドを1つゲームから除外してから、これを自軍ラッシュエリアに出してもよい」・カード評価「効果でそれらを無視して捨札から簡単にラッシュできる」）`,
    () => {
      const s = rushBoard({ discard: [inst("XG6-047", "g4")], command: [released("TST-OP", "c")] }, {}, EXTRA);
      const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG6-047:g4"));
      expect(a).toBeDefined();
    },
  );

  it(
    `XG6-047: 【ギガント】ラッシュしたとき、特徴「仮面ライダー」を持つ敵軍ユニット（エリアを問わない）を1体選んで撃破する（出典: ${PAGE}「特徴「仮面ライダー」を持つ敵軍ユニットを1体選び撃破する」）`,
    () => {
      let s = rushFromHand(
        rushBoard({ hand: [inst("XG6-047", "g4")], command: [...releasedCat("ET", 1), ...releasedCat("DA", 1)], power: powerCards(6) }, { battle: [inst("SPEC-KR", "k"), inst("TST-UNIT-0", "x")], rush: [inst("SPEC-KR-DA", "kr")] }, EXTRA),
        "player1",
        "XG6-047:g4",
      ).state;
      expectChoiceFrom(s, "player1", "XG6-047");
      expect(choiceIds(s)).toEqual(["SPEC-KR-DA:kr", "SPEC-KR:k"]);
      s = resolveAll(pick(s, "SPEC-KR:k"));
      expect(zoneOf(s, "player2", "SPEC-KR:k")).toBe("discard");
    },
  );
});

// ===========================================================================
describe("XG6-048 仮面ライダーリュウガ", () => {
  const TEXT =
    "※リードWB ※これは、自分がターンを終えるときバトルエリアにあれば捨札になる。 【鏡像の戦士】これが自分の手札か自軍捨札にある間、自軍ラッシュフェイズごとに1度だけ、自軍常駐置き場にあるカードを1枚選び捨札にしてよい。そうしたとき、これを自軍ラッシュエリアに出す。";
  const PAGE = "atwiki/page-2340";

  it(`XG6-048: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-048", TEXT);
    expectUnit("XG6-048", { name: "仮面ライダーリュウガ", category: ["WB", "DA"], size: "S", bp: 6000, sp: "1/2", powerCost: 3, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRushCondition("XG6-048", undefined);
    expectRarityIn("XG6-048", ["SR"]);
  });

  leadTests("XG6-048", "WB", PAGE);

  it(`XG6-048: ※ 自分がターンを終えるとき、バトルエリアにあれば捨札になる。ラッシュエリアにあれば残る（出典: ${PAGE}「自分がターンを終えるときバトルエリアにあれば捨札になる」）`, () => {
    const s = toTurnEnd(p1Battle({ battle: [inst("XG6-048", "ry")], rush: [inst("XG6-048", "r2")] }, {}, EXTRA));
    expect(zoneOf(s, "player1", "XG6-048:ry")).toBe("discard");
    expect(zoneOf(s, "player1", "XG6-048:r2")).toBe("rush");
  });

  it(
    `XG6-048: 【鏡像の戦士】手札にある間、自軍ラッシュフェイズに、自軍常駐置き場のカードを1枚捨札にして、これを自軍ラッシュエリアに出せる（出典: ${PAGE}「自軍常駐置き場にあるカードを1枚選び捨札にしてよい。そうしたとき、これを自軍ラッシュエリアに出す」）`,
    () => {
      for (const zone of ["hand", "discard"] as const) {
        const s = rushBoard({ [zone]: [inst("XG6-048", "ry")], operation: [residentOp("TST-OP", "res")] }, {}, EXTRA);
        const a = legal(s).find((x) => x.playerId === "player1" && JSON.stringify(x).includes("XG6-048:ry"));
        expect(a, zone).toBeDefined();
      }
    },
  );
});

// ===========================================================================
describe("XG6-049 仮面ライダーオーガ", () => {
  const TEXT =
    "※これはウイングを持つユニットとバトルしたときバトルに勝っても撃破される。 【オルフェノクの帝王】自分の手札を1枚選び自軍コマンドゾーンにホールド状態で置いてもよい。そうしたとき、そのカードの必要パワーの数字以下の必要パワーを持つ敵軍バトルエリアのSユニットを好きな数選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";
  const PAGE = "atwiki/page-2339";

  it(`XG6-049: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-049", TEXT);
    expectUnit("XG6-049", { name: "仮面ライダーオーガ", category: ["ET", "DA"], size: "S", bp: 7000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["仮面ライダー", "男", "皇帝"] });
    expectRushCondition("XG6-049", undefined);
    expectRarityIn("XG6-049", ["R"]);
  });

  it(`XG6-049: ※ ウイングを持つユニット（XG6-028 スカイオン BP3000）とバトルすると、自軍ターンにアタックして勝っても撃破される（出典: ${PAGE}「ウイングを持つユニットとバトルしたときバトルに勝っても撃破される」・カード評価「自軍ターン中も適用される」）`, () => {
    const s = settle(attack(p1Battle({ battle: [inst("XG6-049", "o")] }, { battle: [inst("XG6-028", "w")] }, EXTRA), "XG6-049:o", "XG6-028:w"));
    expect(zoneOf(s, "player2", "XG6-028:w")).toBe("discard");
    expect(zoneOf(s, "player1", "XG6-049:o")).toBe("discard");
  });

  const nc = () => ncEnter("XG6-049:o", 0, { hand: [inst("SPEC-C3", "h")] }, { battle: [inst("TST-UNIT-0", "e0"), inst("SPEC-C3", "e3"), inst("TST-UNIT-7", "big")], rush: [inst("TST-UNIT-0", "er")] }, EXTRA);

  it(
    `XG6-049: NC【オルフェノクの帝王】まず自分の手札を1枚選び、自軍コマンドゾーンにホールド状態で置くかを選ぶ（任意）（出典: ${PAGE}「自分の手札を1枚選び自軍コマンドゾーンにホールド状態で置いてもよい」）`,
    () => {
      const s = nc();
      expectChoiceFrom(s, "player1", "XG6-049");
      expect(choiceIds(s)).toEqual(["SPEC-C3:h"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-049: NC — 置いたカードの必要パワーの数字（3）以下の必要パワーを持つ敵軍バトルエリアの S ユニットを好きな数選び、持ち主のコマンドゾーンにホールド状態で置く（L ユニット・ラッシュエリアは選べない）（出典: ${PAGE}「そのカードの必要パワーの数字以下の必要パワーを持つ敵軍バトルエリアのSユニットを好きな数選び」）`,
    () => {
      let s = pick(nc(), "SPEC-C3:h");
      expect(s.players.player1.command.find((c) => c.instanceId === "SPEC-C3:h")?.commandHeld).toBe(true);
      expectChoiceFrom(s, "player1", "XG6-049");
      expect(choiceIds(s)).toEqual(["SPEC-C3:e3", "TST-UNIT-0:e0"]);
      s = resolveAll(s);
      expect(zoneOf(s, "player2", "SPEC-C3:e3")).toBe("command");
    },
  );
});

// ===========================================================================
describe("XG6-050 仮面ライダーグレイブ", () => {
  const TEXT =
    "※このユニットは特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる。 【試させてもらいますよ】「SP1」お互いの手札が1枚以上あれば、次の効果を発動できる⇒自分の手札を1～3枚選び相手に見せてから、その必要パワーの数字を合計する。そうしたとき、相手も同じようにして、合計した数字が低い方に1点ダメージを与える。";
  const PAGE = "atwiki/page-2338";

  it(`XG6-050: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-050", TEXT);
    expectUnit("XG6-050", { name: "仮面ライダーグレイブ", category: ["WB", "DA"], size: "S", bp: 4000, sp: "special", powerCost: 1, comboNumber: 2, features: ["仮面ライダー", "男"] });
    expectRushCondition("XG6-050", undefined);
    expectRarityIn("XG6-050", ["SR"]);
  });

  it(
    `XG6-050: ※ 特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる（自軍コマンドがなくても）（出典: ${PAGE}「特徴「アンデッド」を持つユニットをラッシュするためのコマンドとしてホールドできる」・R-KW-CALL-01 補足「単色はコマンドゾーンにそのカテゴリがなくてもよい」）`,
    () => {
      const s = rushBoard({ hand: [inst("SPEC-UND", "u")], rush: [inst("XG6-050", "g")], power: powerCards(1) }, {}, EXTRA);
      expect(payableFor(s, "SPEC-UND:u")).toContain("XG6-050:g");
    },
  );

  it(`XG6-050: ※ 特徴「アンデッド」を持たないユニットのラッシュにはコマンドとして使えない（出典: ${PAGE}）`, () => {
    const s = rushBoard({ hand: [inst("SPEC-DA-U", "u")], rush: [inst("XG6-050", "g")], command: releasedCat("DA", 1), power: powerCards(1) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-DA-U:u")).not.toContain("XG6-050:g");
  });

  it(`XG6-050: NC【試させてもらいますよ】2番目に並ぶと「SP1」、1番目では SP を持たない（出典: ${PAGE}「「SP1」」・「SP：！」）`, () => {
    expect(spOf(ncEnter("XG6-050:g", 1, {}, {}, EXTRA), "player1", "XG6-050:g")).toBe(1);
    expect(spOf(ncEnter("XG6-050:g", 0, {}, {}, EXTRA), "player1", "XG6-050:g")).toBe(0);
  });

  it(
    `XG6-050: NC — お互いの手札が1枚以上あれば、効果を発動するかを選べる（出典: ${PAGE}「お互いの手札が1枚以上あれば、次の効果を発動できる」・Q1）`,
    () => {
      const s = ncEnter("XG6-050:g", 1, { hand: [inst("SPEC-C3", "h")] }, { hand: [inst("TST-OP", "eh")] }, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-050");
      expect(canSkip(s)).toBe(true);
    },
  );
});

// ===========================================================================
describe("XG6-051 仮面ライダー歌舞鬼", () => {
  const TEXT = "※レジスト ※リードMA ※コールDA 【人間への絶望】これが特徴「男」または「女」を持つ敵軍ユニットとバトルするとき、これをリリースする。";
  const PAGE = "atwiki/page-2300";

  it(`XG6-051: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-051", TEXT);
    expectUnit("XG6-051", { name: "仮面ライダー歌舞鬼", category: ["MA", "DA"], size: "S", bp: 2000, sp: "1/3", powerCost: 2, features: ["仮面ライダー", "男"] });
    expectRushCondition("XG6-051", undefined);
    expectRarityIn("XG6-051", ["N"]);
  });

  resistTest("XG6-051", PAGE);
  leadTests("XG6-051", "MA", PAGE);

  it(`XG6-051: ※コールDA — DA のユニットをラッシュするためのコマンドとしてホールドできる（出典: ${PAGE}「※コールDA」・R-KW-CALL-01）`, () => {
    const s = rushBoard({ hand: [inst("SPEC-DA-U", "u")], rush: [inst("XG6-051", "k")], power: powerCards(1) }, {}, EXTRA);
    expect(payableFor(s, "SPEC-DA-U:u")).toContain("XG6-051:k");
  });

  it(
    `XG6-051: 【人間への絶望】ホールド状態のこれが特徴「男」の敵軍ユニットとバトルするとき、リリースされるので、負けてもレジストを使える（出典: ${PAGE}「これをリリースする」・カード評価「レジストとの相乗効果で、男か女との普通のバトルでは絶対に捨札にされない」）`,
    () => {
      const s = enemyAttacks(enemyTurn({ battle: [{ ...inst("XG6-051", "k"), commandHeld: true }] }, { battle: [inst("SPEC-MALE", "m")] }, EXTRA), "SPEC-MALE:m", "XG6-051:k");
      expect(registerOffered(s)).toBe(true);
    },
  );

  it(`XG6-051: 【人間への絶望】特徴「男」「女」を持たない敵軍ユニット（BP13000）とのバトルでは、ホールド状態のままでレジストできない（出典: ${PAGE}「特徴「男」または「女」を持つ敵軍ユニットと」・R-KW-RESIST-04）`, () => {
    const s = attackUntilRegister({ battle: [{ ...inst("XG6-051", "k"), commandHeld: true }] }, "XG6-051:k");
    expect(registerOffered(s)).toBe(false);
  });
});

