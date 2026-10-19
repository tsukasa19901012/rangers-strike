/**
 * カード別スペック: XG6-037〜XG6-044（クロスギャザー ザ・ギガンティックタイタン 仮面ライダーアクセル〜仮面ライダーNEW電王SF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md R-ERR-XG6-044（atwiki/page-2322 Q2 の読み替え）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: XG6-038 Q1、XG6-041 Q1、XG6-044 Q1・Q2
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。XG6-044 はライブ写し docs/rules/sources/web/w.atwiki.jp/renst/pages/2322.txt もある）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-KW-RESIST-01・R-KW-READ-01・R-KW-BREAKER・R-STK-03）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "../types/game";
import {
  accept,
  attackTargets,
  attackUntilRegister,
  beltUsed,
  bpOf,
  breakerTests,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  deckOrder,
  entered,
  enemyTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  faceUp,
  fill,
  inst,
  leadTests,
  legal,
  mountAndRideOff,
  p1Battle,
  pick,
  played,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushFromHand,
  spOf,
  strike,
  sUnit,
  vehicleCard,
  withBp,
  withDamage,
  zordDownTests,
  zoneOf,
  choicePlayer,
} from "./XG6-023-044.helpers";

const VEH = vehicleCard("SPEC-VEH");
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const M3 = sUnit("SPEC-M3", { bp: 3000, size: "M" });
const L10 = sUnit("SPEC-L10", { bp: 10000, size: "L" });
const ABC = sUnit("SPEC-ABC", { name: "ABCロボ", bp: 3000 });
const AB = sUnit("SPEC-AB", { name: "ABロボ", bp: 3000 });
const FEMALE = sUnit("SPEC-FEMALE", { category: "OT", bp: 1000, features: ["女"] });
const EXTRA = [VEH, C3, C2, M3, L10, ABC, AB, FEMALE];

// ===========================================================================
describe("XG6-037 仮面ライダーアクセル", () => {
  const TEXT =
    "【振り切るぜ】自軍バトルフェイズ中、これが自軍ラッシュエリアでライドしていなければ、Sビークルを1体選んでもよい。そうしたとき、このターン、これは本来のテキストをもたないSビークルとして扱い、選んだビークルの効果名を持つテキストと、次のテキストが追加される。→「これは、ライドされていなくてもバトルエリアに出ることができる」「自軍バトルフェイズ終了時、これにライドしているユニットをライドオフさせて自軍ラッシュエリアに置く」";
  const PAGE = "atwiki/page-2318";

  it(`XG6-037: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-037", TEXT);
    expectUnit("XG6-037", { name: "仮面ライダーアクセル", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 1, features: ["仮面ライダー", "男", "警察", "アクセルドライバー"] });
    expectRushCondition("XG6-037", undefined);
    expectRarityIn("XG6-037", ["R"]);
  });

  it(`XG6-037: 【振り切るぜ】を使わなければ、ふつうの S ユニットとしてバトルエリアに出られる（出典: ${PAGE}「選んでもよい」）`, () => {
    const s = p1Battle({ rush: [inst("XG6-037", "ac"), inst("SPEC-VEH", "v")] }, {}, EXTRA);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG6-037:ac")).toBe(true);
  });

  it.fails(
    `XG6-037: 【振り切るぜ】自軍バトルフェイズ中、ライドしていないこれ（自軍ラッシュエリア）について、S ビークルを選んでビークルとして扱う行動がある（出典: ${PAGE}「Sビークルを1体選んでもよい。そうしたとき、このターン、これは本来のテキストをもたないSビークルとして扱い」）— 既知の不具合: CARD-XG6-037 【振り切るぜ】を使う手段がない`,
    () => {
      const s = p1Battle({ rush: [inst("XG6-037", "ac"), inst("SPEC-VEH", "v")] }, {}, EXTRA);
      const others = legal(s).filter((a) => a.playerId === "player1" && JSON.stringify(a).includes("XG6-037:ac") && !["move_to_battle", "mount_ride", "hold_for_wing"].includes(a.type));
      expect(others.length).toBeGreaterThan(0);
    },
  );
});

// ===========================================================================
describe("XG6-038 仮面ライダーアクセルトライアル", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない 【マシンガンスパイク】自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から3枚まで捨て札にしてもよい。そうしたとき、捨札にしたカードの必要パワーの数字の合計が10未満なら、その数字以下の必要パワーの数字を持つ敵軍バトルエリアのユニットを１体選び撃破する。10以上なら、これを撃破する。";
  const PAGE = "atwiki/page-2319";

  it(`XG6-038: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-038", TEXT);
    expectUnit("XG6-038", { name: "仮面ライダーアクセルトライアル", category: "ET", size: "S", bp: 2500, sp: 1, powerCost: "7-", features: ["仮面ライダー", "男", "警察", "アクセルドライバー", "加速"] });
    expectRushCondition("XG6-038", "zord_down_discard_named", "「仮面ライダーアクセル」を１体コマンドゾーンに送るか捨て札にすれば必要パワー0になる");
    expectRarityIn("XG6-038", ["R"]);
  });

  zordDownTests("XG6-038", "XG6-037", "仮面ライダーアクセル", PAGE, "ET");

  it(
    `XG6-038: 追加条件 — 「仮面ライダーアクセル」をコマンドゾーンに送っても、必要パワー0でラッシュできる（出典: ${PAGE}「コマンドゾーンに送るか捨て札にすれば」）`,
    () => {
      const s = rushBoard({ hand: [inst("XG6-038", "t")], rush: [inst("XG6-037", "a")], command: releasedCat("ET", 1), power: [] }, {}, EXTRA);
      const r = rushFromHand(s, "player1", "XG6-038:t", { materials: ["XG6-037:a"], destination: "command" });
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "XG6-037:a")).toBe("command");
    },
  );

  it(`XG6-038: ※ アタックされる以外では相手に選ばれない（敵軍 XG6-006【ボウケンフラッシュ】の選択に入らない）。アタックの対象にはなる（出典: ${PAGE}「これはアタックされる以外では相手に選ばれない」）`, () => {
    let s = enemyTurn({ battle: [inst("XG6-038", "t"), inst("TST-UNIT-0", "o")] }, { rush: [inst("XG6-006", "dt")], command: [inst("XG6-016", "an")] }, EXTRA);
    s = enter(s, "XG6-006:dt", "player2");
    for (let i = 0; i < 2 && s.pendingEffectChoice?.sourceCardId === "XG6-006" && choiceIds(s).includes("XG6-016:an"); i++) s = pick(s, "XG6-016:an");
    expect(choiceIds(s)).toContain("TST-UNIT-0:o");
    expect(choiceIds(s)).not.toContain("XG6-038:t");
    const a = enemyTurn({ battle: [inst("XG6-038", "t")] }, { battle: [inst("TST-UNIT-0", "e")] }, EXTRA);
    expect(attackTargets(a, "TST-UNIT-0:e", "player2")).toContain("XG6-038:t");
  });

  const spike = (deck: CardInstance[]) => entered("XG6-038:t", { deck }, { battle: [inst("SPEC-C3", "e3"), inst("SPEC-L10", "big")], rush: [inst("SPEC-C2", "r2")] }, EXTRA);

  it(
    `XG6-038: 【マシンガンスパイク】出たとき、まず自軍山札の上から捨札にするかを選ぶ（いきなり敵軍ユニットを選ばない）（出典: ${PAGE}「自軍山札の上から3枚まで捨て札にしてもよい。そうしたとき」・Q1「宣言しておく必要はありません」）`,
    () => {
      const s = spike([inst("SPEC-C3", "d1"), inst("SPEC-C2", "d2"), ...deckCards(3)]);
      expectChoiceFrom(s, "player1", "XG6-038");
      expect(choiceIds(s)).not.toContain("SPEC-C3:e3");
      expect(choiceIds(s)).not.toContain("SPEC-L10:big");
    },
  );

  it(`XG6-038: 【マシンガンスパイク】敵軍ラッシュエリアのユニットは選べない（出典: ${PAGE}「敵軍バトルエリアのユニット」）`, () => {
    const s = resolveAll(spike([inst("SPEC-C3", "d1"), inst("SPEC-C2", "d2"), ...deckCards(3)]));
    expect(zoneOf(s, "player2", "SPEC-C2:r2")).toBe("rush");
  });
});

// ===========================================================================
describe("XG6-039 スタッグフォン", () => {
  const TEXT = "自軍コマンドゾーンのカードを1枚選び手札に加える。そうしたとき、このカードを自軍コマンドゾーンにホールド状態で置く。";
  const PAGE = "atwiki/page-2292";

  it(`XG6-039: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-039", TEXT);
    expectOpStats("XG6-039", { name: "スタッグフォン", category: "ET", powerCost: 4 });
    expectRarityIn("XG6-039", ["N"]);
  });

  it(
    `XG6-039: 自軍コマンドゾーンのカード（ユニットのカードも、支払いでホールドしたコマンドも）を1枚選び手札に加え、このカードを自軍コマンドゾーンにホールド状態で置く（出典: ${PAGE}「自軍コマンドゾーンのカードを1枚選び手札に加える。そうしたとき、このカードを自軍コマンドゾーンにホールド状態で置く」）`,
    () => {
      let s = beltUsed("XG6-039", "ET", 4, { command: [released("TST-UNIT-7", "u")] }, {}, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-039");
      expect(choiceIds(s)).toEqual(["TST-OP-ET:cET0", "TST-UNIT-7:u"]);
      s = resolveAll(pick(s, "TST-UNIT-7:u"));
      expect(zoneOf(s, "player1", "TST-UNIT-7:u")).toBe("hand");
      expect(zoneOf(s, "player1", "XG6-039:op")).toBe("command");
      expect(s.players.player1.command.find((c) => c.instanceId === "XG6-039:op")?.commandHeld).toBe(true);
    },
  );
});

// ===========================================================================
describe("XG6-040 仮面ライダージョーカー", () => {
  const TEXT = "※リードET 【ライダーキック】これ以外の自軍Sユニットが１体もなければ、相手は自分自身のSユニットを１体選び撃破する。そうしたとき、これはSP1になる。";
  const PAGE = "atwiki/page-2310";

  it(`XG6-040: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-040", TEXT);
    expectUnit("XG6-040", { name: "仮面ライダージョーカー", category: "DA", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "ロストドライバー"] });
    expectRushCondition("XG6-040", undefined);
    expectRarityIn("XG6-040", ["SR"]);
  });

  leadTests("XG6-040", "ET", PAGE);

  const rc = (p1: Partial<Parameters<typeof p1Battle>[0]> = {}, p2: Partial<Parameters<typeof p1Battle>[1]> = { battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-L10", "l")], rush: [inst("SPEC-C2", "e2")] }) =>
    mountAndRideOff(p1Battle({ ...p1, rush: [inst("XG6-040", "j"), inst("SPEC-VEH", "v"), ...(p1.rush ?? [])] }, p2, EXTRA), "XG6-040:j", "SPEC-VEH:v");

  it(
    `XG6-040: RC【ライダーキック】これ以外の自軍 S ユニットがなければ、相手が自分の S ユニット（エリアを問わない。L ユニットは選べない）を1体選んで撃破し、これは SP1 になる（出典: ${PAGE}「相手は自分自身のSユニットを１体選び撃破する。そうしたとき、これはSP1になる」）`,
    () => {
      let s = rc();
      expect(choicePlayer(s)).toBe("player2");
      expect(choiceIds(s)).toEqual(["SPEC-C2:e2", "TST-UNIT-0:e1"]);
      s = resolveAll(pick(s, "SPEC-C2:e2"));
      expect(zoneOf(s, "player2", "SPEC-C2:e2")).toBe("discard");
      expect(spOf(s, "player1", "XG6-040:j")).toBe(1);
    },
  );

  it(`XG6-040: RC — これ以外の自軍 S ユニット（ラッシュエリアでもよい）があれば何も起きず、SP を持たない（出典: ${PAGE}「これ以外の自軍Sユニットが１体もなければ」）`, () => {
    const s = resolveAll(rc({ rush: [inst("TST-UNIT-0", "mine")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
    expect(spOf(s, "player1", "XG6-040:j")).toBe(0);
  });

  it(`XG6-040: RC — 相手に S ユニットがなければ撃破されず、SP を持たない（出典: ${PAGE}「そうしたとき」）`, () => {
    const s = resolveAll(rc({}, { battle: [inst("SPEC-L10", "l")] }));
    expect(zoneOf(s, "player2", "SPEC-L10:l")).toBe("battle");
    expect(spOf(s, "player1", "XG6-040:j")).toBe(0);
  });
});

// ===========================================================================
describe("XG6-041 仮面ライダーエターナル", () => {
  const TEXT =
    "※ブレイカー ※リードDA 【死神のパーティータイムだ】これが自軍エリアにある間、本来のカード名にアルファベットを含むユニットはBP－1000され、含んだアルファベットが3文字以上あれば次の制限を受ける→これはストライクすることができない。";
  const PAGE = "atwiki/page-2316";

  it(`XG6-041: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-041", TEXT);
    expectUnit("XG6-041", { name: "仮面ライダーエターナル", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 3, features: ["仮面ライダー", "男", "ロストドライバー"] });
    expectRushCondition("XG6-041", undefined);
    expectRarityIn("XG6-041", ["SR"]);
  });

  breakerTests("XG6-041", PAGE, "DA", EXTRA);
  leadTests("XG6-041", "DA", PAGE);

  const field = () =>
    p1Battle({ battle: [inst("XG6-041", "et"), inst("SPEC-ABC", "x")] }, { battle: [inst("SPEC-AB", "y"), inst("SPEC-ABC", "z"), inst("RS-394", "ta")] }, EXTRA);

  it(
    `XG6-041: 【死神のパーティータイムだ】本来のカード名にアルファベットを含むユニットは、両軍とも BP-1000（ABロボ・ABCロボ BP3000 → 2000）（出典: ${PAGE}「本来のカード名にアルファベットを含むユニットはBP－1000され」）`,
    () => {
      const s = field();
      expect(bpOf(s, "player2", "SPEC-AB:y")).toBe(2000);
      expect(bpOf(s, "player2", "SPEC-ABC:z")).toBe(2000);
      expect(bpOf(s, "player1", "SPEC-ABC:x")).toBe(2000);
    },
  );

  it(
    `XG6-041: 【死神のパーティータイムだ】アルファベットを3文字以上含むユニット（自軍の ABCロボ）はストライクできない（出典: ${PAGE}「含んだアルファベットが3文字以上あれば…これはストライクすることができない」）`,
    () => {
      expect(canStrike(field(), "SPEC-ABC:x")).toBe(false);
    },
  );

  it(`XG6-041: 公式Q&A — 「α」などのギリシャ文字はアルファベットに含めない（RS-394 タイムロボα の BP は変わらない）。これ自身（エターナル）も BP5000 のまま（出典: ${PAGE} Q1「A〜Z（またはa〜z）の26文字を対象とします」）`, () => {
    const s = field();
    const base = p1Battle({}, { battle: [inst("RS-394", "ta")] }, EXTRA);
    expect(bpOf(s, "player2", "RS-394:ta")).toBe(bpOf(base, "player2", "RS-394:ta"));
    expect(bpOf(s, "player1", "XG6-041:et")).toBe(5000);
  });
});

// ===========================================================================
describe("XG6-042 仮面ライダーゼロノスAF", () => {
  const TEXT = "※自分の手札が0枚のとき、これを撃破する。 【ゼロのスタート】これがストライクしてダメージを与えたとき、相手に1枚ドローさせてもよい。そうしたとき、次の相手ターンのスタートフェイズ中、相手は山札からカードをドローできない。";
  const PAGE = "atwiki/page-2347";

  it(`XG6-042: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-042", TEXT);
    expectUnit("XG6-042", { name: "仮面ライダーゼロノスAF", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 2, features: ["男"] });
    expectRushCondition("XG6-042", undefined);
    expectRarityIn("XG6-042", ["R"]);
  });

  it(
    `XG6-042: ※ 自分の手札が0枚になったとき（最後の手札のオペレーションを使った）、これを撃破する（出典: ${PAGE}「自分の手札が0枚のとき、これを撃破する」・コメント欄「手札0の瞬間があるからコイツは撃破される」）`,
    () => {
      const s = played(rushBoard({ battle: [inst("XG6-042", "z")], hand: [inst("TST-OP-OT", "o")], command: releasedCat("OT", 1), power: powerCards(1) }, {}, EXTRA), "TST-OP-OT:o");
      expect(s.players.player1.hand).toHaveLength(0);
      expect(zoneOf(resolveAll(s), "player1", "XG6-042:z")).toBe("discard");
    },
  );

  it(`XG6-042: ※ 手札が1枚以上あれば撃破されない（出典: ${PAGE}）`, () => {
    const s = played(rushBoard({ battle: [inst("XG6-042", "z")], hand: [inst("TST-OP-OT", "o"), inst("TST-OP", "keep")], command: releasedCat("OT", 1), power: powerCards(1) }, {}, EXTRA), "TST-OP-OT:o");
    expect(zoneOf(s, "player1", "XG6-042:z")).toBe("battle");
  });

  it(`XG6-042: SP1/4 — バトルエリアの4番目なら SP1 でストライクでき、1番目ではストライクできない（出典: ${PAGE}「SP：1/4」・R-STK-03）`, () => {
    expect(canStrike(p1Battle({ battle: [...fill(3), inst("XG6-042", "z")], hand: [inst("TST-OP", "h")] }, {}, EXTRA), "XG6-042:z")).toBe(true);
    expect(canStrike(p1Battle({ battle: [inst("XG6-042", "z")], hand: [inst("TST-OP", "h")] }, {}, EXTRA), "XG6-042:z")).toBe(false);
  });

  it(
    `XG6-042: 【ゼロのスタート】ストライクしてダメージを与えたとき、相手に1枚ドローさせるかを選べる（任意）。させると相手の手札が1枚増える（出典: ${PAGE}「相手に1枚ドローさせてもよい」）`,
    () => {
      let s = strike(p1Battle({ battle: [...fill(3), inst("XG6-042", "z")], hand: [inst("TST-OP", "h")] }, {}, EXTRA), "XG6-042:z");
      expectChoiceFrom(s, "player1", "XG6-042");
      expect(canSkip(s)).toBe(true);
      const before = s.players.player2.hand.length;
      s = resolveAll(accept(s));
      expect(s.players.player2.hand.length).toBe(before + 1);
    },
  );
});

// ===========================================================================
describe("XG6-043 仮面ライダーゼロノスZF", () => {
  const TEXT =
    "※特徴「女」を持つ自軍ユニットがあれば、これはレジストを得る。 【強き心と強き願い】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードを1枚選びゲームから除外してよい。そうしたとき、これはBP+3000され、自分がゲームに負けるまで残り1点なら「SP2」になる。";
  const PAGE = "atwiki/page-2336";

  it(`XG6-043: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-043", TEXT);
    expectUnit("XG6-043", { name: "仮面ライダーゼロノスZF", category: "OT", size: "S", bp: 6000, sp: 1, powerCost: "0+", features: ["仮面ライダー", "男"] });
    expectRushCondition("XG6-043", "state_gate", "自軍捨札が7枚以上ある");
    expectRarityIn("XG6-043", ["SR"]);
  });

  const board = (n: number) => rushBoard({ hand: [inst("XG6-043", "z")], command: releasedCat("OT", 1), discard: fill(n, "dd") }, {}, EXTRA);

  it(
    `XG6-043: 追加条件 — 自軍捨札が7枚あれば、必要パワー0でラッシュできる（出典: ${PAGE}「自軍捨札が7枚以上ある」）`,
    () => {
      expect(rushFromHand(board(7), "player1", "XG6-043:z").ok).toBe(true);
    },
  );

  it(`XG6-043: 追加条件 — 自軍捨札が6枚ではラッシュできない（出典: ${PAGE}）`, () => {
    expect(canStartRush(board(6), "player1", "XG6-043:z")).toBe(false);
  });

  it(
    `XG6-043: ※ 特徴「女」を持つ自軍ユニットがあればレジストを得る（バトルで撃破されたときホールドして留められる）（出典: ${PAGE}「特徴「女」を持つ自軍ユニットがあれば、これはレジストを得る」・R-KW-RESIST-01）`,
    () => {
      expect(registerOffered(attackUntilRegister({ battle: [inst("XG6-043", "z"), inst("SPEC-FEMALE", "f")] }, "XG6-043:z", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
    },
  );

  it(`XG6-043: ※ 特徴「女」を持つ自軍ユニットがなければレジストはない（出典: ${PAGE}）`, () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG6-043", "z")] }, "XG6-043:z", {}, "TST-UNIT-7:atk", EXTRA))).toBe(false);
  });

  it(
    `XG6-043: 【強き心と強き願い】出たとき、自軍パワーゾーンのオモテ向きのカード（ダメージは選べない）を1枚選んでゲームから除外してよい。除外すると BP+3000（BP9000）（出典: ${PAGE}「オモテ向きのカードを1枚選びゲームから除外してよい。そうしたとき、これはBP+3000され」）`,
    () => {
      let s = entered("XG6-043:z", withDamage(2, [faceUp("TST-OP", "fu")]), {}, EXTRA);
      expectChoiceFrom(s, "player1", "XG6-043");
      expect(choiceIds(s)).toEqual(["TST-OP:fu"]);
      expect(canSkip(s)).toBe(true);
      s = resolveAll(pick(s, "TST-OP:fu"));
      expect(s.players.player1.exile.map((c) => c.instanceId)).toEqual(["TST-OP:fu"]);
      expect(bpOf(s, "player1", "XG6-043:z")).toBe(9000);
    },
  );

  it(
    `XG6-043: 【強き心と強き願い】除外したとき、負けるまで残り1点（ダメージ6点）なら「SP2」になる（出典: ${PAGE}「自分がゲームに負けるまで残り1点なら「SP2」になる」）`,
    () => {
      const s = resolveAll(pick(entered("XG6-043:z", withDamage(6, [faceUp("TST-OP", "fu")]), {}, EXTRA), "TST-OP:fu"));
      expect(spOf(s, "player1", "XG6-043:z")).toBe(2);
    },
  );

  it(`XG6-043: 【強き心と強き願い】残り2点（ダメージ5点）なら SP1 のまま（出典: ${PAGE}「残り1点なら」）`, () => {
    let s = entered("XG6-043:z", withDamage(5, [faceUp("TST-OP", "fu")]), {}, EXTRA);
    if (s.pendingEffectChoice?.sourceCardId === "XG6-043") s = pick(s, "TST-OP:fu");
    expect(spOf(resolveAll(s), "player1", "XG6-043:z")).toBe(1);
  });
});

// ===========================================================================
describe("XG6-044 仮面ライダーNEW電王SF", () => {
  const TEXT =
    "※これをラッシュしたとき、自軍パワーゾーンから「テディ」のカードを1枚選び自軍ラッシュエリアに出してもよい。 ※これはBP5000以上のとき「SP1」になる 【カウンターストライク】自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードの必要パワーの数字を見て、その数字と同じ並びにある敵軍Sユニット、またはライドされていない敵軍Sビークルがあれば1体選び捨札にする。その後、オモテにしたカードは山札の下に戻す。";
  const PAGE = "atwiki/page-2322";

  it(`XG6-044: カタログ本文（R-ERR-XG6-044 の読み替え後）・スペックが出典と一致（出典: ${PAGE} Q2・docs/rules/08-errata.md R-ERR-XG6-044）`, () => {
    expectCatalogText("XG6-044", TEXT);
    expectUnit("XG6-044", { name: "仮面ライダーNEW電王SF", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 3, comboNumber: "RC", features: ["仮面ライダー", "男", "NEWDEN-O"] });
    expectRushCondition("XG6-044", undefined);
    expectRarityIn("XG6-044", ["SR"]);
  });

  const rushed = () => rushFromHand(rushBoard({ hand: [inst("XG6-044", "sf")], command: releasedCat("OT", 1), power: [faceUp("XG6-045", "td"), ...powerCards(3)] }, {}, EXTRA), "player1", "XG6-044:sf");

  it(`XG6-044: ※ ラッシュしたとき、自軍パワーゾーンの「テディ」（XG6-045）を自軍ラッシュエリアに出せる（出典: ${PAGE}「自軍パワーゾーンから「テディ」のカードを1枚選び自軍ラッシュエリアに出してもよい」）`, () => {
    let s = rushed().state;
    if (s.pendingEffectChoice?.sourceCardId === "XG6-044") s = pick(s, "XG6-045:td");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG6-045:td")).toBe("rush");
  });

  it(
    `XG6-044: ※ 「テディ」を出すかは選べる（出さない選び方がある）（出典: ${PAGE}「出してもよい」）`,
    () => {
      const s = rushed().state;
      expectChoiceFrom(s, "player1", "XG6-044");
      expect(canSkip(s)).toBe(true);
    },
  );

  it(`XG6-044: ※ BP5000 以上なら（1番目でも）SP1。BP3000 で1番目なら SP を持たず、4番目なら分数 SP で SP1（出典: ${PAGE}「これはBP5000以上のとき「SP1」になる」・R-STK-03）`, () => {
    expect(spOf(p1Battle({ battle: [withBp(inst("XG6-044", "sf"), 2000)] }, {}, EXTRA), "player1", "XG6-044:sf")).toBe(1);
    expect(spOf(p1Battle({ battle: [inst("XG6-044", "sf")] }, {}, EXTRA), "player1", "XG6-044:sf")).toBe(0);
    expect(spOf(p1Battle({ battle: [...fill(3), inst("XG6-044", "sf")] }, {}, EXTRA), "player1", "XG6-044:sf")).toBe(1);
  });

  it(
    `XG6-044: ※ BP4500（5000 未満）で1番目なら SP を持たない（出典: ${PAGE}「BP5000以上のとき」）`,
    () => {
      const s = p1Battle({ battle: [withBp(inst("XG6-044", "sf"), 1500)] }, {}, EXTRA);
      expect(bpOf(s, "player1", "XG6-044:sf")).toBe(4500);
      expect(spOf(s, "player1", "XG6-044:sf")).toBe(0);
    },
  );

  const rc = (top: string, p2Battle: CardInstance[]) =>
    mountAndRideOff(p1Battle({ rush: [inst("XG6-044", "sf"), inst("SPEC-VEH", "v")], deck: [inst(top, "top"), ...deckCards(3)] }, { battle: p2Battle }, EXTRA), "XG6-044:sf", "SPEC-VEH:v");

  it(`XG6-044: RC【カウンターストライク】オモテにしたカードの必要パワー3 → 敵軍バトルエリア3番目の S ユニットを捨札にし、オモテにしたカードは山札の下に戻る（出典: ${PAGE} Q1・Q2・R-ERR-XG6-044）`, () => {
    const s = resolveAll(rc("SPEC-C3", [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-0", "b2"), inst("TST-UNIT-0", "b3")]), ["accept"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:b3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b2")).toBe("battle");
    expect(deckOrder(s).at(-1)).toBe("SPEC-C3:top");
  });

  it(`XG6-044: RC — その並び（2番目）が M ユニットなら何も捨札にしない（出典: ${PAGE}「敵軍Sユニット、またはライドされていない敵軍Sビークルがあれば」）`, () => {
    const s = resolveAll(rc("SPEC-C2", [inst("TST-UNIT-0", "b1"), inst("SPEC-M3", "m2"), inst("TST-UNIT-0", "b3")]), ["accept"]);
    expect(zoneOf(s, "player2", "SPEC-M3:m2")).toBe("battle");
    expect(s.players.player2.discard).toHaveLength(0);
  });
});
