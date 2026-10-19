/**
 * カード別スペック: XG2-089〜XG2-097（クロスギャザー ザ・ドラゴンタイガー 機動刑事ジバン〜ビーファイターゲンジ。XG2-091・094 は指揮官でカタログにない）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-089」〜「XG2-097」とカード名で検索）。atwiki に転載された公式 Q&A（XG2-090 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01・R-KW-RESIST-01・R-KW-WING-01・R-CN-02・R-ZONE-08「コマンドゾーンは5枚まで」）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの: なし（レジスト・ウイングの規定は rulesSpec/07 系で照合済み。ここではこのカードで使えることだけを見る）。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  attackUntilRegister,
  canSkip,
  choiceIds,
  damageOf,
  enemyNcEnter,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  isHeld,
  legal,
  mount,
  ncEnter,
  p1Battle,
  pick,
  pickAs,
  rcBoard,
  registerOffered,
  released,
  releasedN,
  resolveAll,
  rideOff,
  ridesOn,
  spOf,
  sUnit,
  wingTests,
  zoneOf,
} from "./XG2-082-103.helpers";
import type { GameState } from "../types/game";

const DA_S = sUnit("SPEC-DA-S", { bp: 2000, category: "DA" });
const DA_M = { ...sUnit("SPEC-DA-M", { bp: 3000, category: "DA" }), size: "M" as const };
const OT_S = sUnit("SPEC-OT-S", { bp: 1000, category: "OT" });
/** BP1000・必要パワー1・ナンバー1（3つの値すべてがブラックビートより低い）。 */
const LOW3 = sUnit("SPEC-LOW3", { bp: 1000, powerCost: 1, comboNumber: 1 });
const EXTRA = [DA_S, DA_M, OT_S, LOW3];

/** 敵軍ターン中、自軍バトルエリアの id がバトルで撃破されるときのレジストを使う（ホールド状態になる）。 */
function registered(p1: Partial<GameState["players"]["player1"]>, id: string): GameState {
  const s = attackUntilRegister(p1, id);
  const a = legal(s).find((x) => x.type === "use_register" && x.playerId === "player1");
  if (!a) throw new Error("no use_register");
  return act(s, a);
}

// ===========================================================================
describe("XG2-089 機動刑事ジバン", () => {
  const TEXT = "※レジスト 【ジバンエンド】DAを持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンに置く。置けなければ捨札にする。";

  it("XG2-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-134）", () => {
    expectCatalogText("XG2-089", TEXT);
    expectUnit("XG2-089", { name: "機動刑事ジバン", category: "ET", size: "S", bp: 3000, sp: "1/5", powerCost: 3, comboNumber: "RC", features: ["メカ", "男", "警察"] });
    expectRarityIn("XG2-089", ["R"]);
  });

  it("XG2-089: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-134「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-089", "u")] }, "XG2-089:u"))).toBe(true);
  });

  const end = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcBoard("XG2-089:jb", {}, { battle: [inst("SPEC-DA-S", "da"), inst("TST-UNIT-0", "wb")], rush: [inst("SPEC-DA-S", "dr"), inst("SPEC-DA-M", "dm")], ...p2 }, EXTRA);

  it.fails("XG2-089: 【ジバンエンド】RC — DA を持つ敵軍 S ユニット（エリアを問わない）を1体選ぶ（必ず。WB のユニット・M ユニットは選べない）（出典: atwiki/page-134「DAを持つ敵軍Sユニットを1体選び」） 既知の不具合: CARD-XG2-089 【ジバンエンド】の選択が開かない", () => {
    const s = end();
    expectChoiceFrom(s, "player1", "XG2-089");
    expect(choiceIds(s).sort()).toEqual(["SPEC-DA-S:da", "SPEC-DA-S:dr"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG2-089: 【ジバンエンド】選んだユニットは持ち主のコマンドゾーンに置かれる（出典: atwiki/page-134「持ち主のコマンドゾーンに置く」） 既知の不具合: CARD-XG2-089 【ジバンエンド】の選択が開かない", () => {
    const s = resolveAll(end(), ["SPEC-DA-S:dr"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:dr")).toBe("command");
  });

  it.fails("XG2-089: 【ジバンエンド】敵軍コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-134「置けなければ捨札にする」・R-ZONE-08） 既知の不具合: CARD-XG2-089 【ジバンエンド】の選択が開かない", () => {
    const s = resolveAll(rcBoard("XG2-089:jb", {}, { battle: [inst("SPEC-DA-S", "da")], command: releasedN(5, "TST-OP", "ec") }, EXTRA), ["SPEC-DA-S:da"]);
    expect(zoneOf(s, "player2", "SPEC-DA-S:da")).toBe("discard");
  });
});

// ===========================================================================
describe("XG2-090 レゾン", () => {
  const TEXT =
    "【第六世代コンピューター】これが自軍バトルエリアにあり、ユニットにライドされていなければ、敵軍ターン中、自軍バトルエリアのSユニットがホールド状態になったとき、そのユニットをこのビークルにライドさせてから、ラッシュエリアに戻してもよい。";

  it("XG2-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-1811）", () => {
    expectCatalogText("XG2-090", TEXT);
    expectVehicle("XG2-090", { name: "レゾン", category: "ET", powerCost: 2, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG2-090", ["N"]);
  });

  it.fails("XG2-090: 【第六世代コンピューター】敵軍ターン中、自軍バトルエリアの RC を持つ S ユニット（XG2-089 ジバン）がレジストでホールド状態になったとき、これにライドさせるかを選べる（任意）（出典: atwiki/page-1811「自軍バトルエリアのSユニットがホールド状態になったとき、そのユニットをこのビークルにライドさせてから、ラッシュエリアに戻してもよい」・カード評価「レジストを持つRCユニットの生存率を高めてくれる」） 既知の不具合: CARD-XG2-090 【第六世代コンピューター】がなく、ホールド状態になっても選択が開かない", () => {
    const s = registered({ battle: [inst("XG2-090", "rz"), inst("XG2-089", "jb")] }, "XG2-089:jb");
    expect(isHeld(s, "player1", "XG2-089:jb")).toBe(true);
    expectChoiceFrom(s, "player1", "XG2-090");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-090: 【第六世代コンピューター】ライドさせると、ユニットはこれにライドしたまま自軍ラッシュエリアに戻る（出典: atwiki/page-1811「そのユニットをこのビークルにライドさせてから、ラッシュエリアに戻してもよい」） 既知の不具合: CARD-XG2-090 【第六世代コンピューター】がなく、ホールド状態になっても選択が開かない", () => {
    const s = resolveAll(registered({ battle: [inst("XG2-090", "rz"), inst("XG2-089", "jb")] }, "XG2-089:jb"), ["XG2-090:rz", "XG2-089:jb"]);
    expect(zoneOf(s, "player1", "XG2-089:jb")).toBe("rush");
    expect(ridesOn(s, "player1", "XG2-089:jb", "XG2-090:rz")).toBe(true);
  });

  it("XG2-090: 公式Q&A — RC を持たないユニット（XG2-098 カメロック）はライドさせられない（出典: atwiki/page-1811 Q1「はい、その通りです」（ライドさせられるのは RC を持つユニットだけ））", () => {
    const s = registered({ battle: [inst("XG2-090", "rz"), inst("XG2-098", "km")] }, "XG2-098:km");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-090");
    expect(zoneOf(s, "player1", "XG2-098:km")).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-092 ナイトファイヤー", () => {
  const TEXT =
    "※レジスト 【パイルトルネード】「SP1」相手は自分自身のユニットを1体選び、自分自身のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。（この効果は、ライドオフしたときナンバーに関係なく発動する）";

  it("XG2-092: カタログ本文・スペックが出典と一致（出典: atwiki/page-132）", () => {
    expectCatalogText("XG2-092", TEXT);
    expectUnit("XG2-092", { name: "ナイトファイヤー", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 6, comboNumber: 5, features: ["メカ", "男", "警察"] });
    expectRarityIn("XG2-092", ["SR"]);
  });

  it("XG2-092: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-132「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-092", "u")] }, "XG2-092:u"))).toBe(true);
  });

  const enemy = () => ({ battle: [inst("TST-UNIT-0", "e"), inst("TST-UNIT-2", "m")], rush: [inst("SPEC-DA-S", "r")] });

  it("XG2-092: 【パイルトルネード】5番目に出れば「SP1」。3番目では SP なし（出典: atwiki/page-132「CN：5」「SP：！」）", () => {
    expect(spOf(ncEnter("XG2-092:nf", 4, {}, enemy(), EXTRA), "player1", "XG2-092:nf")).toBe(1);
    expect(spOf(ncEnter("XG2-092:nf", 2, {}, enemy(), EXTRA), "player1", "XG2-092:nf")).toBe(0);
  });

  it.fails("XG2-092: 【パイルトルネード】NC で、相手が自分自身のユニット（サイズ・エリアを問わない）を1体選ぶ（必ず）（出典: atwiki/page-132「相手は自分自身のユニットを1体選び」・カード評価「サイズとエリアを問わない除去効果」） 既知の不具合: CARD-XG2-092 【パイルトルネード】の相手が選ぶ効果がなく、選択が開かない", () => {
    const s = ncEnter("XG2-092:nf", 4, {}, enemy(), EXTRA);
    expectChoiceFrom(s, "player2", "XG2-092");
    expect(choiceIds(s).sort()).toEqual(["SPEC-DA-S:r", "TST-UNIT-0:e", "TST-UNIT-2:m"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG2-092: 【パイルトルネード】選んだユニットは相手のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-132「自分自身のコマンドゾーンにホールド状態で置く」） 既知の不具合: CARD-XG2-092 【パイルトルネード】の相手が選ぶ効果がなく、選択が開かない", () => {
    const s = resolveAll(pickAs(ncEnter("XG2-092:nf", 4, {}, enemy(), EXTRA), "player2", "TST-UNIT-2:m"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:m")).toBe("command");
    expect(isHeld(s, "player2", "TST-UNIT-2:m")).toBe(true);
  });

  it.fails("XG2-092: 【パイルトルネード】（）書き — RS-406 マシンボクサー（「警察」を持つ S ユニットがライドできる）からライドオフしたときは、ナンバーに関係なく（1番目でも）発動する（出典: atwiki/page-132「（この効果は、ライドオフしたときナンバーに関係なく発動する）」・カード評価「警察ならばライド出来るマシンボクサーやガードチェイサーと併用したい」） 既知の不具合: CARD-XG2-092 【パイルトルネード】の相手が選ぶ効果がなく、ライドオフしても選択が開かない", () => {
    let s = p1Battle({ rush: [inst("XG2-092", "nf"), inst("RS-406", "mb")] }, enemy(), EXTRA);
    s = rideOff(mount(s, "XG2-092:nf", "RS-406:mb"), true);
    expect(spOf(s, "player1", "XG2-092:nf")).toBe(1);
    expectChoiceFrom(s, "player2", "XG2-092");
  });
});

// ===========================================================================
describe("XG2-093 ソルドーザー", () => {
  const TEXT = "※これはアタックすることができない。 【道路封鎖】これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは相手に選ばれない。";

  it("XG2-093: カタログ本文・スペックが出典と一致（出典: atwiki/page-1809）", () => {
    expectCatalogText("XG2-093", TEXT);
    expectUnit("XG2-093", { name: "ソルドーザー", category: "ET", size: "S", bp: 5000, sp: undefined, powerCost: 2, features: ["メカ", "人型", "警察"] });
    expectRarityIn("XG2-093", ["N"]);
  });

  it("XG2-093: ※ アタックすることができない（出典: atwiki/page-1809「※これはアタックすることができない」）", () => {
    const s = enter(p1Battle({ rush: [inst("XG2-093", "sd")] }, { battle: [inst("TST-UNIT-0", "e")] }), "XG2-093:sd");
    expect(attackTargets(s, "XG2-093:sd")).toEqual([]);
  });

  /** 敵軍（player2。自軍コマンド3枚）が RS-662 鳳凰メレ【火将危願】を出す（必要パワー3の敵軍コマンドを1枚選び捨札にしてもよい）。こちらのコマンドに必要パワー3の TST-OP。 */
  const meleEnters = (p1: Partial<GameState["players"]["player1"]>) =>
    enemyNcEnter("RS-662:mr", 0, { command: releasedN(3, "TST-OP", "ec") }, { command: [released("TST-OP", "mc")], ...p1 }, EXTRA);

  it("XG2-093: 前提 — これがいなければ、相手の RS-662 鳳凰メレ【火将危願】で自軍コマンドが選ばれる（出典: RS-662 本文）", () => {
    expect(choiceIds(meleEnters({}))).toEqual(["TST-OP:mc"]);
  });

  it.fails("XG2-093: 【道路封鎖】これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは相手の効果（鳳凰メレ【火将危願】）に選ばれない（出典: atwiki/page-1809「これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは相手に選ばれない」・カード評価「守護獣プテラノドンのようなコマンド除去…を防ぐことができる」） 既知の不具合: CARD-XG2-093 【道路封鎖】がなく、自軍コマンドが相手の効果に選ばれる", () => {
    const s = meleEnters({ battle: [inst("XG2-093", "sd")] });
    expect(choiceIds(s)).toEqual([]);
  });

  it("XG2-093: 【道路封鎖】これが自軍ラッシュエリアにあるだけなら、自軍コマンドは選ばれる（出典: atwiki/page-1809「自軍バトルエリアにある間」）", () => {
    expect(choiceIds(meleEnters({ rush: [inst("XG2-093", "sd")] }))).toEqual(["TST-OP:mc"]);
  });
});

// ===========================================================================
describe("XG2-095 ブラックビート", () => {
  const TEXT =
    "※レジスト 【スティンガービュート】敵軍バトルエリアから、「BP」「必要パワーの数字」「ナンバーの数字」の3つのうちのいずれかの値が、このユニットよりも低いユニットを1体選び撃破してもよい。そうして撃破したユニットの3つの値すべてがこのユニットよりも低かったなら、相手に1点ダメージを与える。";

  it("XG2-095: カタログ本文・スペックが出典と一致（出典: atwiki/page-152）", () => {
    expectCatalogText("XG2-095", TEXT);
    expectUnit("XG2-095", { name: "ブラックビート", category: ["WB", "DA"], size: "S", bp: 3000, sp: "1/2", powerCost: 4, comboNumber: 3, features: ["メカ", "昆虫", "ブラック", "男"] });
    expectRarityIn("XG2-095", ["R"]);
  });

  it("XG2-095: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-152「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-095", "u")] }, "XG2-095:u"))).toBe(true);
  });

  /** これ: BP3000・必要パワー4・ナンバー3。敵軍バトルエリア: TST-UNIT-2（BP3000・必要パワー2・ナンバーなし）、RS-284 ホワイトスワン（BP500・必要パワー0・ナンバー3）、TST-UNIT-7（BP13000・必要パワー7+）。 */
  const sting = () =>
    ncEnter("XG2-095:bk", 2, {}, { battle: [inst("TST-UNIT-2", "low1"), inst("RS-284", "sw"), inst("TST-UNIT-7", "big")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it.fails("XG2-095: 【スティンガービュート】NC（3番目）— 敵軍バトルエリアの、BP・必要パワーの数字・ナンバーの数字のどれかがこれより低いユニットを選べる（任意。どれも低くない TST-UNIT-7・ラッシュエリアのユニットは選べない）（出典: atwiki/page-152「3つのうちのいずれかの値が、このユニットよりも低いユニットを1体選び撃破してもよい」・コメント欄「ナンバーがなくても、BPかパワーが低ければ撃破できる」） 既知の不具合: CARD-XG2-095 【スティンガービュート】の選択が開かない", () => {
    const s = sting();
    expectChoiceFrom(s, "player1", "XG2-095");
    expect(choiceIds(s).sort()).toEqual(["RS-284:sw", "TST-UNIT-2:low1"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-095: 【スティンガービュート】撃破したユニット（ナンバーのない TST-UNIT-2）の3つの値がすべて低いとは言えなければ、ダメージは与えない（出典: atwiki/page-152「3つの値すべてがこのユニットよりも低かったなら」・コメント欄「ナンバーがない相手はダメージに関する効果が狙えない」） 既知の不具合: CARD-XG2-095 【スティンガービュート】の選択が開かない", () => {
    const s = resolveAll(pick(sting(), "TST-UNIT-2:low1"));
    expect(zoneOf(s, "player2", "TST-UNIT-2:low1")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it.fails("XG2-095: 【スティンガービュート】撃破したユニットの BP（1000）・必要パワーの数字（1）・ナンバーの数字（1）がすべてこれより低ければ、相手に1点ダメージを与える（出典: atwiki/page-152「そうして撃破したユニットの3つの値すべてがこのユニットよりも低かったなら、相手に1点ダメージを与える」） 既知の不具合: CARD-XG2-095 【スティンガービュート】の選択が開かない", () => {
    const s0 = ncEnter("XG2-095:bk", 2, {}, { battle: [inst("SPEC-LOW3", "all")] }, EXTRA);
    const s = resolveAll(pick(s0, "SPEC-LOW3:all"));
    expect(zoneOf(s, "player2", "SPEC-LOW3:all")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-096 ビーファイターヤンマ", () => {
  const TEXT = "※ウイング 【ドラゴンフライング】「SP1」";

  it("XG2-096: カタログ本文・スペックが出典と一致（出典: atwiki/page-1782）", () => {
    expectCatalogText("XG2-096", TEXT);
    expectUnit("XG2-096", { name: "ビーファイターヤンマ", category: ["WB", "ET"], size: "S", bp: 2000, sp: "1/5", powerCost: 3, comboNumber: 2, features: ["メカ", "昆虫", "男"] });
    expectRarityIn("XG2-096", ["N"]);
  });

  it("XG2-096: 【ドラゴンフライング】NC（2番目）で「SP1」。5番目は分数 SP（1/5）で1。1番目は SP なし（出典: atwiki/page-1782「CN：2」「SP：1/5」・カード評価「２番目と５番目でSPが付く」）", () => {
    expect(spOf(ncEnter("XG2-096:ym", 1), "player1", "XG2-096:ym")).toBe(1);
    expect(spOf(ncEnter("XG2-096:ym", 4), "player1", "XG2-096:ym")).toBe(1);
    expect(spOf(ncEnter("XG2-096:ym", 0), "player1", "XG2-096:ym")).toBe(0);
  });

  wingTests("XG2-096", "atwiki/page-1782");
});

// ===========================================================================
describe("XG2-097 ビーファイターゲンジ", () => {
  const TEXT =
    "【ライトニングキャノン】自軍コマンドゾーンから、カテゴリを2つ以上持つカードを1枚選び、自分の手札に戻してもよい。そうしたとき、戻したカードの持つカテゴリと同じカテゴリを1つ以上持つ敵軍Sユニットを1体選び撃破する。";

  it("XG2-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-1783）", () => {
    expectCatalogText("XG2-097", TEXT);
    expectUnit("XG2-097", { name: "ビーファイターゲンジ", category: ["WB", "ET"], size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 3, features: ["メカ", "昆虫", "男"] });
    expectRarityIn("XG2-097", ["N"]);
  });

  /** 自軍コマンド: TST-OP-WB-ET（WB／ET）と TST-OP（WB のみ）。敵軍: WB の S（バトル）、OT の S（バトル）、WB／ET の S（ラッシュ）、M ユニット。 */
  const cannon = () =>
    ncEnter(
      "XG2-097:gj",
      2,
      { command: [released("TST-OP-WB-ET", "mc"), released("TST-OP", "wb")] },
      { battle: [inst("TST-UNIT-0", "wb"), inst("SPEC-OT-S", "ot"), inst("TST-UNIT-2", "m")], rush: [inst("TST-UNIT-WB-ET", "r")] },
      EXTRA,
    );

  it.fails("XG2-097: 【ライトニングキャノン】NC（3番目）— 自軍コマンドゾーンのカテゴリを2つ以上持つカードを1枚選び、手札に戻せる（任意。カテゴリが1つのカードは選べない）（出典: atwiki/page-1783「自軍コマンドゾーンから、カテゴリを2つ以上持つカードを1枚選び、自分の手札に戻してもよい」） 既知の不具合: CARD-XG2-097 【ライトニングキャノン】の選択が開かない", () => {
    const s = cannon();
    expectChoiceFrom(s, "player1", "XG2-097");
    expect(choiceIds(s)).toEqual(["TST-OP-WB-ET:mc"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-097: 【ライトニングキャノン】戻したら、戻したカードと同じカテゴリ（WB か ET）を持つ敵軍 S ユニット（エリアを問わない）を1体選び撃破する（OT の S ユニット・M ユニットは選べない）（出典: atwiki/page-1783「戻したカードの持つカテゴリと同じカテゴリを1つ以上持つ敵軍Sユニットを1体選び撃破する」） 既知の不具合: CARD-XG2-097 【ライトニングキャノン】の選択が開かない", () => {
    let s = pick(cannon(), "TST-OP-WB-ET:mc");
    expect(zoneOf(s, "player1", "TST-OP-WB-ET:mc")).toBe("hand");
    expect(choiceIds(s).sort()).toEqual(["TST-UNIT-0:wb", "TST-UNIT-WB-ET:r"]);
    s = resolveAll(pick(s, "TST-UNIT-WB-ET:r"));
    expect(zoneOf(s, "player2", "TST-UNIT-WB-ET:r")).toBe("discard");
  });
});
