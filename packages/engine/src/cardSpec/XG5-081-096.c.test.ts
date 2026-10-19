/**
 * カード別スペック: XG5-092〜XG5-096（クロスギャザー XG5 ザ・チケットブレイカー ビジンダー〜ギルの笛の音）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない。atwiki に転載された公式 Q&A: なし
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-DMG-02・R-ADD-02）・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activate,
  attack,
  attackTargets,
  beltUsed,
  canActivate,
  canEndPhase,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enemyAttacks,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  faceUp,
  inst,
  pick,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  skipFrom,
  st,
  sUnit,
  withBp,
  zoneOf,
  zordDownTests,
} from "./XG5-081-096.helpers";

const SP_M = sUnit("SPEC-M", { category: "WB", bp: 1000, size: "M" });
const HUM2 = sUnit("SPEC-HUM2", { category: "WB", bp: 2000, features: ["人型"] });
const HUM3 = sUnit("SPEC-HUM3", { category: "WB", bp: 3000, features: ["人型"] });
const NON9 = sUnit("SPEC-NON9", { category: "WB", bp: 9000 });
const E4 = sUnit("SPEC-E4", { category: "WB", bp: 4000 });
const E5 = sUnit("SPEC-E5", { category: "WB", bp: 5000 });
const E6 = sUnit("SPEC-E6", { category: "WB", bp: 6000 });
const DA_MECHA = sUnit("SPEC-DA-MECHA", { category: "DA", bp: 1000, features: ["メカ"] });
const DA_ONLY = sUnit("SPEC-DA", { category: "DA", bp: 1000 });
const MECHA = sUnit("SPEC-MECHA", { category: "WB", bp: 1000, features: ["メカ"] });
const DA_MECHA_M = sUnit("SPEC-DA-MECHA-M", { category: "DA", bp: 1000, size: "M", features: ["メカ"] });
const MH = sUnit("SPEC-MH", { category: "WB", bp: 1000, features: ["メカ", "人型"] });
const NOSP = sUnit("SPEC-NOSP", { category: "WB", bp: 1000, sp: undefined });
const EXTRA = [SP_M, HUM2, HUM3, NON9, E4, E5, E6, DA_MECHA, DA_ONLY, MECHA, DA_MECHA_M, MH, NOSP];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(8), ...p1 }, player2: { deck: deckCards(8, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("XG5-092 ビジンダー", () => {
  const TEXT =
    "【天使と悪魔】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドゾーンにあるカテゴリが1つだけなら、そのカテゴリごとに次の効果を発動できる⇒DAなら、敵軍Sユニットを1体選び、このユニットと選んだユニットを撃破する。DA以外なら、敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く（置けなければ捨札にする）。";

  it("XG5-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-2224）", () => {
    expectCatalogText("XG5-092", TEXT);
    expectMultiStats("XG5-092", { name: "ビジンダー", category: ["ET", "DA"], size: "S", bp: 4000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["メカ", "人型"] });
    expectRarityIn("XG5-092", ["N"]);
  });

  /** 自軍コマンドゾーン command。敵軍バトルエリアに TST-UNIT-0（S）・SPEC-M（M）、敵軍ラッシュエリアに TST-UNIT-0（S）。 */
  const entered = (command: GameState["players"]["player1"]["command"], p2: Partial<GameState["players"]["player2"]> = {}) =>
    enter(battle({ rush: [inst("XG5-092", "bj")], command }, { battle: [inst("TST-UNIT-0", "s"), inst("SPEC-M", "m")], rush: [inst("TST-UNIT-0", "r")], ...p2 }), "XG5-092:bj");

  it.fails("XG5-092:【天使と悪魔】— DA 以外（ET だけ）なら、敵軍バトルエリアの S ユニットを選べる（M ユニット・ラッシュエリアは選べない。任意） 既知の不具合: CARD-XG5-092 コマンドのカテゴリが1つだけでも【天使と悪魔】が発動しない（出典: atwiki/page-2224「DA以外なら、敵軍バトルエリアからSユニットを1体選び」「発動できる」）", () => {
    const s = entered(releasedCat("ET", 2));
    expectChoiceFrom(s, "player1", "XG5-092");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:s"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-092:【天使と悪魔】— DA 以外なら、選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる 既知の不具合: CARD-XG5-092 【天使と悪魔】が発動せずホールドできない（出典: atwiki/page-2224「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(entered(releasedCat("ET", 2)), "TST-UNIT-0:s"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("command");
    expect(cardIn(s, "player2", "TST-UNIT-0:s")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "XG5-092:bj")).toBe("battle");
  });

  it.fails("XG5-092:【天使と悪魔】— DA 以外で持ち主のコマンドゾーンが5枚なら捨札になる 既知の不具合: CARD-XG5-092 【天使と悪魔】が発動せず捨札にもならない（出典: atwiki/page-2224「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(entered(releasedCat("ET", 2), { command: releasedCat("WB", 5) }), "TST-UNIT-0:s"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("discard");
  });

  it.fails("XG5-092:【天使と悪魔】— DA だけなら、敵軍 S ユニット（バトルエリア・ラッシュエリア）を選べる（M ユニットは選べない） 既知の不具合: CARD-XG5-092 DA だけでも【天使と悪魔】が発動しない（出典: atwiki/page-2224「DAなら、敵軍Sユニットを1体選び」）", () => {
    const s = entered(releasedCat("DA", 2));
    expectChoiceFrom(s, "player1", "XG5-092");
    expect([...choiceIds(s)].sort()).toEqual(["TST-UNIT-0:r", "TST-UNIT-0:s"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-092:【天使と悪魔】— DA なら、これと選んだユニットを撃破する 既知の不具合: CARD-XG5-092 【天使と悪魔】が発動せず撃破できない（出典: atwiki/page-2224「このユニットと選んだユニットを撃破する」）", () => {
    const s = resolveAll(pick(entered(releasedCat("DA", 2)), "TST-UNIT-0:s"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:s")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-092:bj")).toBe("discard");
  });

  it("XG5-092:【天使と悪魔】— 自軍コマンドゾーンのカテゴリが2つ（ET と DA）なら発動しない（出典: atwiki/page-2224「自軍コマンドゾーンにあるカテゴリが1つだけなら」）", () => {
    const s = entered([...releasedCat("ET", 1), released("TST-OP-DA", "da")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-092");
  });
});

// ===========================================================================
describe("XG5-093 ダブルブラザーパワー", () => {
  const TEXT =
    "特徴「人型」を持つ自軍ユニットを2体選び、選んだ2体の本来のBPを合計する。そして、合計したBP以下の敵軍ユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG5-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-2273）", () => {
    expectCatalogText("XG5-093", TEXT);
    expectOpStats("XG5-093", { name: "ダブルブラザーパワー", category: "ET", powerCost: 6 });
    expectRarityIn("XG5-093", ["R"]);
  });

  /** 自軍: 人型 BP2000（+5000 されて 7000）・人型 BP3000・人型でない BP9000。敵軍: BP4000・5000・6000。 */
  const used = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    beltUsed(
      "XG5-093",
      "ET",
      6,
      { battle: [withBp(inst("SPEC-HUM2", "h2"), 5000), inst("SPEC-HUM3", "h3"), inst("SPEC-NON9", "n")] },
      { battle: [inst("SPEC-E4", "e4"), inst("SPEC-E5", "e5"), inst("SPEC-E6", "e6")], ...p2 },
      EXTRA,
    );

  it.fails("XG5-093: 特徴「人型」を持つ自軍ユニットを選ぶ（人型でないユニットは選べない） 既知の不具合: CARD-XG5-093 使っても何も選ばせない（効果がない）（出典: atwiki/page-2273「特徴「人型」を持つ自軍ユニットを2体選び」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-093");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-HUM2:h2", "SPEC-HUM3:h3"]);
  });

  it.fails("XG5-093: 選んだ2体の本来の BP の合計（2000＋3000＝5000。BP の増減は数えない）以下の敵軍ユニットを選ぶ 既知の不具合: CARD-XG5-093 効果がなく敵軍ユニットを選べない（出典: atwiki/page-2273「選んだ2体の本来のBPを合計する。そして、合計したBP以下の敵軍ユニットを1体選び」）", () => {
    const s = pick(pick(used(), "SPEC-HUM2:h2"), "SPEC-HUM3:h3");
    expectChoiceFrom(s, "player1", "XG5-093");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-E4:e4", "SPEC-E5:e5"]);
  });

  it.fails("XG5-093: 選んだ敵軍ユニットは持ち主のコマンドゾーンにホールド状態で置かれる 既知の不具合: CARD-XG5-093 効果がなくホールドできない（出典: atwiki/page-2273「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(pick(pick(used(), "SPEC-HUM2:h2"), "SPEC-HUM3:h3"), "SPEC-E5:e5"));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-E5:e5")?.commandHeld).toBe(true);
  });

  it.fails("XG5-093: 持ち主のコマンドゾーンが5枚なら捨札になる 既知の不具合: CARD-XG5-093 効果がなく捨札にもならない（出典: atwiki/page-2273「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(pick(pick(used({ command: releasedCat("WB", 5) }), "SPEC-HUM2:h2"), "SPEC-HUM3:h3"), "SPEC-E5:e5"));
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("discard");
  });
});

// ===========================================================================
describe("XG5-094 ギルハカイダー", () => {
  const TEXT =
    "【ハカイダー部隊の決起】これが自軍エリアにある間、自軍ラッシュフェイズごとに1度だけ次の効果を発動できる⇒自軍山札を見て、DAを持ち特徴「メカ」を持つSユニットのカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルし、自分の手札を1枚選び捨札にする。";

  it("XG5-094: カタログ本文・スペックが出典と一致（出典: atwiki/page-2280）", () => {
    expectCatalogText("XG5-094", TEXT);
    expectMultiStats("XG5-094", { name: "ギルハカイダー", category: ["DA"], size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["改造人間", "メカ", "人型"] });
    expectRarityIn("XG5-094", ["SR"]);
  });

  /** 自軍ラッシュフェイズ。自軍バトルエリアに XG5-094、手札に TST-UNIT-0。山札: DA メカ S・DA だけ・メカだけ・DA メカ M。 */
  const board = () =>
    rushBoard(
      {
        battle: [inst("XG5-094", "gh")],
        hand: [inst("TST-UNIT-0", "h")],
        deck: [inst("SPEC-DA-MECHA", "d1"), inst("SPEC-DA", "d2"), inst("SPEC-MECHA", "d3"), inst("SPEC-DA-MECHA-M", "d4"), ...deckCards(3)],
      },
      {},
      EXTRA,
    );

  it.fails("XG5-094:【ハカイダー部隊の決起】— 自軍ラッシュフェイズに発動でき、自軍山札の DA と「メカ」を持つ S ユニットのカードを選べる（任意） 既知の不具合: CARD-XG5-094 自軍ラッシュフェイズに発動できない（出典: atwiki/page-2280「自軍ラッシュフェイズごとに1度だけ次の効果を発動できる⇒自軍山札を見て、DAを持ち特徴「メカ」を持つSユニットのカードを1枚選び」）", () => {
    const s0 = board();
    expect(canActivate(s0, "XG5-094:gh")).toBe(true);
    const s = activate(s0, "XG5-094:gh");
    expectChoiceFrom(s, "player1", "XG5-094");
    expect(choiceIds(s)).toEqual(["SPEC-DA-MECHA:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG5-094:【ハカイダー部隊の決起】— 選んだカードを手札に加え、その後、手札を1枚選び捨札にする 既知の不具合: CARD-XG5-094 発動できず山札から手札に加えられない（出典: atwiki/page-2280「手札に加えてもよい。その後、山札をシャッフルし、自分の手札を1枚選び捨札にする」）", () => {
    let s = pick(activate(board(), "XG5-094:gh"), "SPEC-DA-MECHA:d1");
    expect(zoneOf(s, "player1", "SPEC-DA-MECHA:d1")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG5-094");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-DA-MECHA:d1", "TST-UNIT-0:h"]);
    s = resolveAll(pick(s, "TST-UNIT-0:h"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:h")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DA-MECHA:d1")).toBe("hand");
  });

  it.fails("XG5-094:【ハカイダー部隊の決起】— 手札に加えなくても、その後に手札を1枚捨札にする 既知の不具合: CARD-XG5-094 発動できず手札を捨札にしない（出典: atwiki/page-2280「〜手札に加えてもよい。その後、…自分の手札を1枚選び捨札にする」）", () => {
    const s = skipFrom(activate(board(), "XG5-094:gh"), "XG5-094");
    expectChoiceFrom(s, "player1", "XG5-094");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:h"]);
  });

  it.fails("XG5-094:【ハカイダー部隊の決起】— 自軍ラッシュフェイズごとに1度だけ 既知の不具合: CARD-XG5-094 発動できない（1度目も使えない）（出典: atwiki/page-2280「自軍ラッシュフェイズごとに1度だけ」）", () => {
    const s = resolveAll(pick(pick(activate(board(), "XG5-094:gh"), "SPEC-DA-MECHA:d1"), "TST-UNIT-0:h"));
    expect(canActivate(s, "XG5-094:gh")).toBe(false);
  });

  it("XG5-094:【ハカイダー部隊の決起】— 自軍バトルフェイズには発動できない（出典: atwiki/page-2280「自軍ラッシュフェイズごとに」）", () => {
    expect(canActivate(battle({ battle: [inst("XG5-094", "gh")], hand: [inst("TST-UNIT-0", "h")] }), "XG5-094:gh")).toBe(false);
  });
});

// ===========================================================================
describe("XG5-095 ブラックドラゴン", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【サタンダークネス】 自軍ターン中、これがバトルエリアに出たとき、次の効果を自分、相手の順に行う⇒対戦相手のパワーゾーンから、オモテ向きのユニットカードを1体選びダメージにする。";

  it("XG5-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-2177）", () => {
    expectCatalogText("XG5-095", TEXT);
    expectMultiStats("XG5-095", { name: "ブラックドラゴン", category: ["DA"], size: "S", bp: 5500, sp: undefined, powerCost: "7-", comboNumber: undefined, features: ["改造人間", "メカ", "ブラック", "ドラゴン"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("XG5-095", ["NR"]);
  });

  zordDownTests("XG5-095", "XG5-094", "ギルハカイダー", "atwiki/page-2177", "DA");

  it("XG5-095: ※ — 敵軍ターン中、SP1 のユニット（BP1000）とバトルすると、勝っても撃破される（出典: atwiki/page-2177「敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」）", () => {
    const s = resolveAll(enemyAttacks({ battle: [inst("XG5-095", "bd")] }, inst("TST-UNIT-0", "atk"), "XG5-095:bd", EXTRA));
    expect(zoneOf(s, "player2", "TST-UNIT-0:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-095:bd")).toBe("discard");
  });

  it("XG5-095: ※ — SP を持たないユニットとのバトルなら撃破されない（出典: atwiki/page-2177「「SP1」以上のユニットとバトルしたとき」）", () => {
    const s = resolveAll(enemyAttacks({ battle: [inst("XG5-095", "bd")] }, inst("SPEC-NOSP", "atk"), "XG5-095:bd", EXTRA));
    expect(zoneOf(s, "player2", "SPEC-NOSP:atk")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-095:bd")).toBe("battle");
  });

  it("XG5-095: ※ — 自軍ターン中に SP1 のユニットとバトルして勝てば撃破されない（出典: atwiki/page-2177「敵軍ターン中」）", () => {
    const s = resolveAll(attack(battle({ battle: [inst("XG5-095", "bd")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG5-095:bd", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XG5-095:bd")).toBe("battle");
  });

  /** 自軍・敵軍のパワーゾーン: オモテ向きのユニットカード・オモテ向きのオペレーション・ウラ向きのユニットカード（ダメージ）。 */
  const entered = () =>
    enter(
      battle(
        { rush: [inst("XG5-095", "bd")], power: [faceUp("TST-UNIT-0", "mp"), faceUp("TST-OP", "mo"), inst("TST-UNIT-0", "md")] },
        { power: [faceUp("TST-UNIT-0", "ep"), faceUp("TST-OP", "eo"), inst("TST-UNIT-0", "ed")] },
      ),
      "XG5-095:bd",
    );

  it.fails("XG5-095:【サタンダークネス】— 自軍ターン中に出たとき、まず自分が相手のパワーゾーンのオモテ向きのユニットカードを選ぶ（オペレーション・ウラ向きは選べない） 既知の不具合: CARD-XG5-095 出ても選ばせない（効果がない）（出典: atwiki/page-2177「次の効果を自分、相手の順に行う⇒対戦相手のパワーゾーンから、オモテ向きのユニットカードを1体選び」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-095");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ep"]);
  });

  it.fails("XG5-095:【サタンダークネス】— 選んだカードは相手のダメージになり、次に相手が自分のパワーゾーンのオモテ向きのユニットカードを選ぶ 既知の不具合: CARD-XG5-095 効果がなく相手のカードをダメージにできない（出典: atwiki/page-2177「1体選びダメージにする」「自分、相手の順に行う」・R-DMG-02）", () => {
    const s = pick(entered(), "TST-UNIT-0:ep");
    expect(cardIn(s, "player2", "TST-UNIT-0:ep")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
    expectChoiceFrom(s, "player2", "XG5-095");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:mp"]);
  });

  it.fails("XG5-095:【サタンダークネス】— 相手が選んだ自分のカードは自分のダメージになる 既知の不具合: CARD-XG5-095 効果がなく相手が選べない（出典: atwiki/page-2177「次の効果を自分、相手の順に行う」）", () => {
    const s = resolveAll(pick(pick(entered(), "TST-UNIT-0:ep"), "TST-UNIT-0:mp"));
    expect(cardIn(s, "player1", "TST-UNIT-0:mp")?.faceDown).toBe(true);
    expect(damageOf(s, "player1")).toBe(1);
  });
});

// ===========================================================================
describe("XG5-096 ギルの笛の音", () => {
  const TEXT = "※常駐 特徴に「メカ」と「人型」を持つすべてのユニットは、カテゴリにDAが追加され、毎ターン可能ならバトルエリアに出る。";

  it("XG5-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-2225）", () => {
    expectCatalogText("XG5-096", TEXT);
    expectOpStats("XG5-096", { name: "ギルの笛の音", category: "DA", powerCost: 5 });
    expectRarityIn("XG5-096", ["N"]);
  });

  it("XG5-096: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-2225「※常駐」）", () => {
    expect(zoneOf(beltUsed("XG5-096", "DA", 5), "player1", "XG5-096:op")).toBe("operation");
  });

  const RES = [inst("XG5-096", "g")];

  it.fails("XG5-096: ※常駐 —「メカ」と「人型」を持つ敵軍ユニットは DA を持つ（XG5-019「DA を持たないユニットにアタックできない」でアタックできる。「メカ」だけは不可） 既知の不具合: CARD-XG5-096 「メカ」「人型」を持つユニットに DA が追加されない（出典: atwiki/page-2225「特徴に「メカ」と「人型」を持つすべてのユニットは、カテゴリにDAが追加され」）", () => {
    const p2 = { battle: [inst("SPEC-MH", "mh"), inst("SPEC-MECHA", "me")] };
    expect(attackTargets(battle({ battle: [inst("XG5-019", "dv")] }, p2), "XG5-019:dv")).toEqual([]);
    expect(attackTargets(battle({ battle: [inst("XG5-019", "dv")], operation: RES }, p2), "XG5-019:dv")).toEqual(["SPEC-MH:mh"]);
  });

  it.fails("XG5-096: ※常駐 —「メカ」と「人型」を持つ自軍ラッシュエリアのユニットは、出さずにバトルフェイズを終えられない 既知の不具合: CARD-XG5-096 出さずにバトルフェイズを終えられる（出典: atwiki/page-2225「毎ターン可能ならバトルエリアに出る」）", () => {
    expect(canEndPhase(battle({ rush: [inst("SPEC-MH", "u")] }))).toBe(true);
    expect(canEndPhase(battle({ rush: [inst("SPEC-MH", "u")], operation: RES }))).toBe(false);
  });

  it("XG5-096: ※常駐 —「メカ」だけのユニットは出さなくてよい（出典: atwiki/page-2225「特徴に「メカ」と「人型」を持つ」）", () => {
    expect(canEndPhase(battle({ rush: [inst("SPEC-MECHA", "u")], operation: RES }))).toBe(true);
  });
});
