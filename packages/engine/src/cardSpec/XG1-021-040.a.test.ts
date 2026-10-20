/**
 * カード別スペック: XG1-021〜XG1-027（クロスギャザー ザ・ファーストエンカウント ブルーターボ〜ウーラー兵）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない（「XG」・カード名で検索）。
 *     本範囲に atwiki へ転載された公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-TAKUS-01、コマンドゾーンは5枚まで〈02-zones-cards〉、R-DECK-02 好きな枚数）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を XG1-021〜027 で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  canSkip,
  choiceIds,
  damageCards,
  damageOf,
  deckWithTen,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  fill,
  fullCommand,
  heldUnit,
  inst,
  isDamageCard,
  isHeldCard,
  ncAt,
  p1Battle,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  settle,
  skip,
  spOf,
  sUnit,
  targetsOf,
  zoneOf,
} from "./XG1-021-040.helpers";

const E4000 = sUnit("SPEC-E4000", { category: "ET", bp: 4000 });
const E3500 = sUnit("SPEC-E3500", { category: "ET", bp: 3500 });
const E4000M = sUnit("SPEC-E4000M", { category: "ET", bp: 4000, size: "M" });
const MA_NOSP = sUnit("SPEC-MA-NOSP", { category: "MA", bp: 1000, sp: undefined });
const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", bp: 1000, sp: undefined });
const EXTRA = [E4000, E3500, E4000M, MA_NOSP, ET_NOSP];

const TURBO_STATS = { category: ["MA", "ET"], size: "S" };

// ===========================================================================
describe("XG1-021 ブルーターボ", () => {
  const TEXT = "【Jガン】これは敵軍ラッシュエリアのホールド状態のユニットにアタックできる。";

  it("XG1-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-1574）", () => {
    expectCatalogText("XG1-021", TEXT);
    expectUnitStats("XG1-021", { name: "ブルーターボ", ...TURBO_STATS, bp: 3000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["ブルー", "男"] });
    expectRarityIn("XG1-021", ["N"]);
  });

  it("XG1-021: 【Jガン】敵軍ラッシュエリアのホールド状態のユニットにアタックできる（既知の不具合: CARD-XG1-021 ラッシュエリアのホールド状態のユニットがアタック先に出ない）（リリース状態のラッシュエリアのユニットにはできない）（出典: atwiki/page-1574「これは敵軍ラッシュエリアのホールド状態のユニットにアタックできる」・カード評価「ほぼウイング対策」）", () => {
    const s = p1Battle({ battle: [inst("XG1-021", "bt")] }, { rush: [heldUnit("SPEC-E4000", "h"), inst("SPEC-E3500", "r")], battle: [inst("SPEC-E4000M", "b")] }, EXTRA);
    expect([...targetsOf(s, "XG1-021:bt")].sort()).toEqual(["SPEC-E4000:h", "SPEC-E4000M:b"]);
  });

  it("XG1-021: 【Jガン】があっても、敵軍ラッシュエリアのリリース状態のユニットにはアタックできない（出典: atwiki/page-1574「ホールド状態のユニット」）", () => {
    const s = p1Battle({ battle: [inst("XG1-021", "bt")] }, { rush: [inst("SPEC-E3500", "r")], battle: [inst("SPEC-E4000M", "b")] }, EXTRA);
    expect(targetsOf(s, "XG1-021:bt")).not.toContain("SPEC-E3500:r");
  });
});

// ===========================================================================
describe("XG1-022 ピンクターボ", () => {
  const TEXT = "【Wステッキ】敵軍コマンドが5つあれば、自分は1枚ドローしてもよい。敵軍コマンドが4つ以下なら、敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。";

  it("XG1-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-1575）", () => {
    expectCatalogText("XG1-022", TEXT);
    expectUnitStats("XG1-022", { name: "ピンクターボ", ...TURBO_STATS, bp: 2000, sp: undefined, powerCost: 1, comboNumber: 2, features: ["ピンク", "女"] });
    expectRarityIn("XG1-022", ["N"]);
  });

  const nc = (commands: number) => ncAt("XG1-022:pt", 2, {}, { command: fullCommand(commands), discard: [inst("TST-OP", "d1"), inst("SPEC-E4000", "d2")] }, EXTRA);

  it("XG1-022: 【Wステッキ】NC — 敵軍コマンドが5つなら、1枚ドローするかを選べ（任意）、ドローすれば手札が1枚増える（既知の不具合: CARD-XG1-022 ドローのかわりに敵軍コマンドを選ぶ選択が開く）（出典: atwiki/page-1575「敵軍コマンドが5つあれば、自分は1枚ドローしてもよい」）", () => {
    const s0 = nc(5);
    expectChoiceFrom(s0, "player1", "XG1-022");
    expect(canSkip(s0)).toBe(true);
    expect(choiceIds(s0)).not.toContain("TST-OP:fc0");
    const s = resolveAll(s0, ["draw"]);
    expect(s.players.player1.hand).toHaveLength(1);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("XG1-022: 敵軍コマンドが4つ以下なら、敵軍捨札のカードから1枚選べる（任意）（既知の不具合: CARD-XG1-022 敵軍コマンドの選択が開く）（出典: atwiki/page-1575「敵軍コマンドが4つ以下なら、敵軍捨札からカードを1枚選び…置いてもよい」）", () => {
    const s = nc(3);
    expectChoiceFrom(s, "player1", "XG1-022");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:d2", "TST-OP:d1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-022: 選んだ敵軍捨札のカードは持ち主のコマンドゾーンにホールド状態で置かれる（ドローはしない）（既知の不具合: CARD-XG1-022）（出典: atwiki/page-1575「持ち主のコマンドゾーンにホールド状態で置いてもよい」・カード評価「捨札に送られたマルチカテゴリをコマンドに送ってパワー加速」）", () => {
    const s = resolveAll(pick(nc(3), "SPEC-E4000:d2"));
    expect(zoneOf(s, "player2", "SPEC-E4000:d2")).toBe("command");
    expect(isHeldCard(s, "player2", "SPEC-E4000:d2")).toBe(true);
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG1-023 レッドターボ", () => {
  const TEXT = "【GTソード】「SP1」敵軍バトルエリアからBP4000以上のSユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ、持ち主のパワーゾーンにダメージにして置く。";

  it("XG1-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-1660）", () => {
    expectCatalogText("XG1-023", TEXT);
    expectUnitStats("XG1-023", { name: "レッドターボ", ...TURBO_STATS, bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG1-023", ["R"]);
  });

  // 敵軍バトルエリア: BP4000 の S・BP3500 の S・BP4000 の M、ラッシュエリア: BP4000 の S。
  const nc = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    ncAt("XG1-023:rt", 3, {}, { battle: [inst("SPEC-E4000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-E4000M", "m")], rush: [inst("SPEC-E4000", "r")], ...p2 }, EXTRA);

  it("XG1-023: 「SP1」— 3番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1660「SP：！」「【GTソード】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG1-023:rt")).toBe(1);
  });

  it("XG1-023: 【GTソード】NC — 敵軍バトルエリアの BP4000 以上の S ユニットから1体選ぶ（ラッシュエリア・BP3500・M は対象外。見送れない）（既知の不具合: CARD-XG1-023 【GTソード】の選択が開かない）（出典: atwiki/page-1660「敵軍バトルエリアからBP4000以上のSユニットを1体選び」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-023");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG1-023: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（既知の不具合: CARD-XG1-023）（出典: atwiki/page-1660「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(nc(), ["SPEC-E4000:a"]);
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("command");
    expect(isHeldCard(s, "player2", "SPEC-E4000:a")).toBe(true);
  });

  it("XG1-023: 敵軍コマンドゾーンが5枚で置けなければ、持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（既知の不具合: CARD-XG1-023）（出典: atwiki/page-1660「置けなければ、持ち主のパワーゾーンにダメージにして置く」・カード評価「ダメージを狙うには相手のコマンドを増やしておく必要がある」）", () => {
    const s = resolveAll(nc({ command: fullCommand(5) }), ["SPEC-E4000:a"]);
    expect(zoneOf(s, "player2", "SPEC-E4000:a")).toBe("power");
    expect(isDamageCard(s, "player2", "SPEC-E4000:a")).toBe(true);
  });
});

// ===========================================================================
/** ※タクスMA（R-KW-TAKUS-01）: これがバトルエリアの2番目にある間、これの次に並ぶ MA を持つ S ユニットは「SP1」を得る。 */
function takusMaTests(id: string, page: string) {
  const at = (pos: number, nextId: string) => {
    const left = fill(pos - 1);
    const s = p1Battle({ rush: [inst(id, "tk"), inst(nextId, "nx")], battle: left }, {}, EXTRA);
    return enterSeq(s, [`${id}:tk`, `${nextId}:nx`]);
  };

  it(`${id}: ※タクスMA — バトルエリアの2番目にある間、次に並ぶ MA を持つ S ユニット（印刷の SP なし）は「SP1」を得る（出典: ${page}「※タクスMA」・R-KW-TAKUS-01）`, () => {
    expect(spOf(at(2, "SPEC-MA-NOSP"), "player1", "SPEC-MA-NOSP:nx")).toBe(1);
  });

  it(`${id}: ※タクスMA — 次に並ぶユニットが MA を持たなければ SP を得ない（出典: ${page}・R-KW-TAKUS-01「これの次に並ぶ○○を持つSユニット」）`, () => {
    expect(spOf(at(2, "SPEC-ET-NOSP"), "player1", "SPEC-ET-NOSP:nx")).toBe(0);
  });

  it(`${id}: ※タクスMA — これが2番目以外（3番目）なら次の MA のユニットも SP を得ない（出典: ${page}・R-KW-TAKUS-01「MAなら2」）`, () => {
    expect(spOf(at(3, "SPEC-MA-NOSP"), "player1", "SPEC-MA-NOSP:nx")).toBe(0);
  });
}

describe("XG1-024 イエローターボ", () => {
  const TEXT = "※タクスMA 【Bボーガン】敵軍コマンドゾーンからホールド状態のカードを1枚選び、持ち主のパワーゾーンに送るか、持ち主の手札に戻してもよい。";

  it("XG1-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-1576）", () => {
    expectCatalogText("XG1-024", TEXT);
    expectUnitStats("XG1-024", { name: "イエローターボ", ...TURBO_STATS, bp: 3000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["イエロー", "男"] });
    expectRarityIn("XG1-024", ["N"]);
  });

  takusMaTests("XG1-024", "atwiki/page-1576");

  const nc = () => ncAt("XG1-024:yt", 4, {}, { command: [heldUnit("TST-OP", "h1"), heldUnit("SPEC-E4000", "h2"), inst("TST-OP", "r")] }, EXTRA);

  it("XG1-024: 【Bボーガン】— 4番目に並んで NC が成立すると、自軍が敵軍コマンドゾーンのホールド状態のカードを選ぶ（任意）（出典: atwiki/page-1576「敵軍コマンドゾーンからホールド状態のカードを1枚選び…てもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-024");
    expect(canSkip(s)).toBe(true);
    expect(choiceIds(s)).not.toContain("TST-OP:r");
  });

  it("XG1-024: 【Bボーガン】の候補はホールド状態の「カード」すべて（ユニットに限らずオペレーションも選べる。リリース状態は選べない）（既知の不具合: CARD-XG1-024 ホールド状態のユニットしか候補にならない）（出典: atwiki/page-1576「ホールド状態のカードを1枚選び」）", () => {
    expect([...choiceIds(nc())].sort()).toEqual(["SPEC-E4000:h2", "TST-OP:h1"]);
  });

  it("XG1-024: 選んだカードを持ち主の手札に戻せる（出典: atwiki/page-1576「持ち主の手札に戻してもよい」）", () => {
    const s = pick(nc(), "SPEC-E4000:h2");
    expect(zoneOf(s, "player2", "SPEC-E4000:h2")).toBe("hand");
  });

  it("XG1-024: 選んだカードは、手札に戻すかわりに持ち主のパワーゾーンに送ることも選べる（既知の不具合: CARD-XG1-024 送り先を選べず必ず手札に戻る）（出典: atwiki/page-1576「持ち主のパワーゾーンに送るか、持ち主の手札に戻してもよい」・カード評価「パワー送るか手札に戻すか選択することができる」）", () => {
    const s = resolveAll(nc(), ["SPEC-E4000:h2", "power", "to_power", "power_zone"]);
    expect(zoneOf(s, "player2", "SPEC-E4000:h2")).toBe("power");
  });
});

// ===========================================================================
describe("XG1-025 ブラックターボ", () => {
  const TEXT = "※タクスMA 【Tハンマー】SP1";

  it("XG1-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-1663）", () => {
    expectCatalogText("XG1-025", TEXT);
    expectUnitStats("XG1-025", { name: "ブラックターボ", ...TURBO_STATS, bp: 3000, sp: "special", powerCost: 1, comboNumber: 5, features: ["ブラック", "男"] });
    expectRarityIn("XG1-025", ["R"]);
  });

  takusMaTests("XG1-025", "atwiki/page-1663");

  it("XG1-025: 【Tハンマー】— 5番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1663「【Tハンマー】SP1」）", () => {
    expect(spOf(ncAt("XG1-025:bt", 5, {}, {}, EXTRA), "player1", "XG1-025:bt")).toBe(1);
  });

  it("XG1-025: NC が成立しなければ（4番目）SP を持たない（出典: atwiki/page-1663「SP：！」）", () => {
    expect(spOf(ncAt("XG1-025:bt", 4, {}, {}, EXTRA), "player1", "XG1-025:bt")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-026 ヤミマル", () => {
  const TEXT = "※これをラッシュしたとき、自軍ダメージが3点以下なら、1点ダメージを受ける。 【ヤミオノ】自軍ダメージが3点以下なら、これは次の能力を得る⇒「SP1」";

  it("XG1-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-1676）", () => {
    expectCatalogText("XG1-026", TEXT);
    expectUnitStats("XG1-026", { name: "ヤミマル", category: "DA", size: "S", bp: 3000, sp: "special", powerCost: 5, features: ["流れ暴魔", "男"] });
    expectRarityIn("XG1-026", ["R"]);
  });

  /** 自軍ダメージ n 点（パワーゾーンのウラ向きのカード n 枚）＋オモテ向きのカード5枚。 */
  const damaged = (n: number) => ({ power: [...damageCards(n), ...powerCards(5)], damage: n });

  it("XG1-026: ※ ラッシュしたとき自軍ダメージが3点なら、1点ダメージを受ける（4点になる）（出典: atwiki/page-1676「自軍ダメージが3点以下なら、1点ダメージを受ける」）", () => {
    const r = rushFromHand(rushPhaseBoard({ hand: [inst("XG1-026", "ym")], command: releasedCat("DA", 1), ...damaged(3) }, {}, EXTRA), "player1", "XG1-026:ym");
    expect(r.ok).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "XG1-026:ym")).toBe("rush");
    expect(damageOf(s, "player1")).toBe(4);
  });

  it("XG1-026: ※ 自軍ダメージが4点ならダメージを受けない（出典: atwiki/page-1676「3点以下なら」）", () => {
    const r = rushFromHand(rushPhaseBoard({ hand: [inst("XG1-026", "ym")], command: releasedCat("DA", 1), ...damaged(4) }, {}, EXTRA), "player1", "XG1-026:ym");
    expect(r.ok).toBe(true);
    expect(damageOf(settle(r.state), "player1")).toBe(4);
  });

  it("XG1-026: 【ヤミオノ】自軍ダメージが3点以下なら「SP1」を得る（既知の不具合: CARD-XG1-026 SP を持たない）（出典: atwiki/page-1676「自軍ダメージが3点以下なら、これは次の能力を得る⇒「SP1」」・コメント欄「自軍ダメージが3点以下なら常時SP1ですよ」）", () => {
    expect(spOf(p1Battle({ battle: [inst("XG1-026", "ym")], ...damaged(3) }, {}, EXTRA), "player1", "XG1-026:ym")).toBe(1);
  });

  it("XG1-026: 【ヤミオノ】自軍ダメージが4点なら SP を持たない（出典: atwiki/page-1676「3点以下なら」）", () => {
    expect(spOf(p1Battle({ battle: [inst("XG1-026", "ym")], ...damaged(4) }, {}, EXTRA), "player1", "XG1-026:ym")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-027 ウーラー兵", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("XG1-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-1613）", () => {
    expectCatalogText("XG1-027", TEXT);
    expectUnitStats("XG1-027", { name: "ウーラー兵", category: "DA", size: "S", bp: 1500, sp: undefined, powerCost: 2, features: ["戦闘員"] });
    expectRarityIn("XG1-027", ["N"]);
  });

  it("XG1-027: ※ デッキに好きな枚数（10枚）入れてもよい（出典: atwiki/page-1613「※このカードはデッキに好きな枚数入れてもよい」・カード評価「ジャマーとまったく同じ性能」）", () => {
    expect(deckWithTen("XG1-027", "ウーラー兵")).toBe(true);
  });

  it("XG1-027: 「好きな枚数」でないカードは同じものを10枚は入れられない（対照: XG1-026 ヤミマル）（出典: atwiki/page-1613・R-DECK-02）", () => {
    expect(deckWithTen("XG1-026", "ヤミマル")).toBe(false);
  });
});

// 使っていない import の警告を避ける（skip はほかのバッチと同じ形でそろえる）。
void skip;
