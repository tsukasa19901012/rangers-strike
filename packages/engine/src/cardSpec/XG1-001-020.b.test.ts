/**
 * カード別スペック: XG1-008〜XG1-014（クロスギャザー ザ・ファーストエンカウント レッドフラッシュ〜キングレンジャー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない（「XG」・カード名で検索）。
 *     本範囲に atwiki へ転載された公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ZONE-01「ゾーン＝パワーゾーン＋コマンドゾーン」、R-KW-BLAST-01、R-KW-SCRUM-01、R-KW-WING-01）・
 *     atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を XG1-008〜014 で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activate,
  canActivate,
  canSkip,
  canStartRush,
  choiceIds,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  faceDown,
  faceUp,
  heldN,
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
  rushResults,
  scrumTests,
  spOf,
  strike,
  sUnit,
  targetsOf,
  wingTests,
  zoneOf,
} from "./XG1-001-020.helpers";

const C2 = sUnit("SPEC-C2", { category: "ET", bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { category: "ET", bp: 1000, powerCost: 3 });
const C2M = sUnit("SPEC-C2M", { category: "ET", bp: 3000, powerCost: 2, size: "M" });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const MA_M = sUnit("SPEC-MA-M", { category: "MA", bp: 3000, size: "M" });
const EXTRA = [C2, C3, C2M, OT_S, ET_S, DA_S, MA_M];

// ===========================================================================
describe("XG1-008 レッドフラッシュ", () => {
  const TEXT =
    "【レッドバル】「SP1」自軍パワーゾーンからユニットカードを1枚選び手札に戻してもよい。そうしたとき、そのカードの必要パワーの数字を見て、同じ必要パワーの数字を持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。";

  it("XG1-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-1609）", () => {
    expectCatalogText("XG1-008", TEXT);
    expectUnitStats("XG1-008", { name: "レッドフラッシュ", category: "OT", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 4, features: ["レッド", "男"] });
    expectRarityIn("XG1-008", ["N"]);
  });

  // 自軍パワーゾーン: 必要パワー2 の S ユニットのカード・オペレーションのカード。敵軍: 必要パワー2（バトルエリア・ラッシュエリア）・3 の S ユニット、必要パワー2 の M ユニット。
  const nc = () =>
    ncAt(
      "XG1-008:rf",
      4,
      { power: [faceUp("SPEC-C2", "pw"), faceUp("TST-OP", "po"), ...powerCards(2)] },
      { battle: [inst("SPEC-C2", "b"), inst("SPEC-C3", "c"), inst("SPEC-C2M", "m")], rush: [inst("SPEC-C2", "r")] },
      EXTRA,
    );

  it("XG1-008: 「SP1」— 4番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1609「SP：！」「【レッドバル】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG1-008:rf")).toBe(1);
  });

  it("XG1-008: 【レッドバル】NC — 自軍パワーゾーンのユニットカードから1枚選び手札に戻せる（オペレーションのカードは選べない。任意）（既知の不具合: CARD-XG1-008 【レッドバル】の選択が開かない）（出典: atwiki/page-1609「自軍パワーゾーンからユニットカードを1枚選び手札に戻してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-008");
    expect(choiceIds(s)).toEqual(["SPEC-C2:pw"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-008: 戻すと、戻したカードと同じ必要パワーの数字（2）の敵軍 S ユニット（エリアを問わない。M・数字の違うユニットは対象外）から1体を選ぶ（見送れない）（既知の不具合: CARD-XG1-008）（出典: atwiki/page-1609「同じ必要パワーの数字を持つ敵軍Sユニットを1体選び」・カード評価「除去効果は強制的に発動する」）", () => {
    const s = pick(nc(), "SPEC-C2:pw");
    expect(zoneOf(s, "player1", "SPEC-C2:pw")).toBe("hand");
    expectChoiceFrom(s, "player1", "XG1-008");
    expect(choiceIds(s)).toEqual(["SPEC-C2:b", "SPEC-C2:r"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG1-008: 選んだ敵軍ユニットは持ち主のパワーゾーンに送られる（既知の不具合: CARD-XG1-008）（出典: atwiki/page-1609「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(nc(), ["SPEC-C2:pw", "SPEC-C2:r"]);
    expect(zoneOf(s, "player2", "SPEC-C2:r")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-009 レッドマスク", () => {
  const TEXT = "※スクラム 【マスキークラッシュ】SP1 これがストライクしてダメージを与えるとき、かわりに敵軍捨札を1枚選び持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("XG1-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-1596）", () => {
    expectCatalogText("XG1-009", TEXT);
    expectUnitStats("XG1-009", { name: "レッドマスク", category: "MA", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG1-009", ["N"]);
  });

  scrumTests("XG1-009", 3, "atwiki/page-1596");

  const nc = () => ncAt("XG1-009:rm", 3, {}, { discard: [inst("SPEC-C2", "d1"), inst("TST-OP", "d2")], power: powerCards(2, "ep") }, EXTRA);

  it("XG1-009: 「SP1」— 3番目に並んで NC が成立すると SP1 になる（既知の不具合: CARD-XG1-009 NC が成立しても SP を持たずストライクできない）（出典: atwiki/page-1596「SP：！」「【マスキークラッシュ】SP1」）", () => {
    expect(spOf(nc(), "player1", "XG1-009:rm")).toBe(1);
  });

  it("XG1-009: NC — ストライクしてダメージを与えるとき、かわりに敵軍捨札のカードを1枚選び、持ち主のパワーゾーンにダメージ（ウラ向き）として置ける（パワーゾーンのカードはウラ返らない）（既知の不具合: CARD-XG1-009）（出典: atwiki/page-1596「かわりに敵軍捨札を1枚選び持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(strike(nc(), "XG1-009:rm"), ["TST-OP:d2"]);
    expect(zoneOf(s, "player2", "TST-OP:d2")).toBe("power");
    expect(isDamageCard(s, "player2", "TST-OP:d2")).toBe(true);
    expect(isDamageCard(s, "player2", "TST-P:ep0")).toBe(false);
    expect(isDamageCard(s, "player2", "TST-P:ep1")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-010 レッドファルコン", () => {
  const TEXT =
    "※ウイング 【ライブラスター】「SP1」カテゴリを1つ宣言してもよい。そうしたとき、宣言したカテゴリを持つSユニットを相手に1枚選ばせ、持ち主のコマンドゾーンに置く。置けなければ捨札にする。";

  it("XG1-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-1599）", () => {
    expectCatalogText("XG1-010", TEXT);
    expectUnitStats("XG1-010", { name: "レッドファルコン", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男"] });
    expectRarityIn("XG1-010", ["N"]);
  });

  wingTests("XG1-010", "atwiki/page-1599");

  const nc = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    ncAt("XG1-010:rf", 5, { rush: [inst("SPEC-OT-S", "own")] }, { battle: [inst("SPEC-OT-S", "eb"), inst("SPEC-ET-S", "et")], rush: [inst("SPEC-OT-S", "er")], ...p2 }, EXTRA);

  it("XG1-010: 「SP1」— 5番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1599「SP：！」「【ライブラスター】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG1-010:rf")).toBe(1);
  });

  it("XG1-010: 【ライブラスター】NC — カテゴリを1つ宣言するかを選べる（任意）（既知の不具合: CARD-XG1-010 カテゴリの宣言が開かない）（出典: atwiki/page-1599「カテゴリを1つ宣言してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-010");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-010: 宣言すると、宣言したカテゴリ（OT）を持つ S ユニット（自軍のユニットも含む）の中から相手が1体選ぶ（既知の不具合: CARD-XG1-010）（出典: atwiki/page-1599「宣言したカテゴリを持つSユニットを相手に1枚選ばせ」・カード評価「【ライブラスター】は自軍も選べる」）", () => {
    const s = pick(nc(), "OT");
    expectChoiceFrom(s, "player2", "XG1-010");
    expect(choiceIds(s)).toEqual(["SPEC-OT-S:eb", "SPEC-OT-S:er", "SPEC-OT-S:own"]);
  });

  it("XG1-010: 相手が選んだユニットは持ち主のコマンドゾーンに（リリース状態で）置かれ、5枚で置けなければ捨札になる（既知の不具合: CARD-XG1-010）（出典: atwiki/page-1599「持ち主のコマンドゾーンに置く。置けなければ捨札にする」）", () => {
    const s = resolveAll(nc(), ["OT", "SPEC-OT-S:er"]);
    expect(zoneOf(s, "player2", "SPEC-OT-S:er")).toBe("command");
    expect(isHeldCard(s, "player2", "SPEC-OT-S:er")).toBe(false);
    const full = resolveAll(nc({ command: releasedCat("WB", 5, "fc") }), ["OT", "SPEC-OT-S:eb"]);
    expect(zoneOf(full, "player2", "SPEC-OT-S:eb")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-011 巨大バッカスフンド", () => {
  const TEXT = "※ブラスト 【スペースメタルの魔剣】自軍ゾーンか敵軍ゾーンに、OTを持つカードがオモテ向きであれば、これは「SP1」になる。";

  it("XG1-011: カタログ本文・スペックが出典と一致（追加条件「自軍「皇帝バッカスフンド」1体を捨札にする」）（出典: atwiki/page-1644）", () => {
    expectCatalogText("XG1-011", TEXT);
    expectUnitStats("XG1-011", { name: "巨大バッカスフンド", category: "DA", size: "L", bp: 8000, sp: "special", powerCost: "5+", features: ["皇帝", "メカ", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG1-011", ["NR"]);
  });

  it("XG1-011: 追加条件 — 自軍「皇帝バッカスフンド」（RS-215）1体を捨札にしてラッシュできる（出典: atwiki/page-1644「追加条件：自軍「皇帝バッカスフンド」1体を捨札にする」）", () => {
    const s = rushPhaseBoard({ hand: [inst("XG1-011", "h")], rush: [inst("RS-215", "p")], command: releasedCat("DA", 1), power: powerCards(5) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "XG1-011:h", { materials: ["RS-215:p"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-011:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-215:p")).toBe("discard");
  });

  it("XG1-011: ※ブラスト — ダメージ6点で自軍 L ユニットがなければ、皇帝バッカスフンドなしでラッシュできる（5点ではできない）（出典: atwiki/page-1644「※ブラスト」・カード評価「ブラスト専用として割り切るか」・R-KW-BLAST-01）", () => {
    const mk = (damage: number) => rushPhaseBoard({ hand: [inst("XG1-011", "h")], command: releasedCat("DA", 1), power: powerCards(5), damage }, {}, EXTRA);
    expect(canStartRush(mk(5), "player1", "XG1-011:h")).toBe(false);
    const r = rushFromHand(mk(6), "player1", "XG1-011:h");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG1-011:h")).toBe("rush");
  });

  const field = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    p1Battle({ battle: [inst("XG1-011", "bf")], ...p1 }, p2, EXTRA);

  it("XG1-011: 【スペースメタルの魔剣】自軍パワーゾーンに OT のカードがオモテ向きであれば「SP1」になる（既知の不具合: CARD-XG1-011 SP を持たない）（出典: atwiki/page-1644「自軍ゾーンか敵軍ゾーンに、OTを持つカードがオモテ向きであれば、これは「SP1」になる」・R-ZONE-01）", () => {
    expect(spOf(field({ power: [faceUp("TST-OP-OT", "ot")] }), "player1", "XG1-011:bf")).toBe(1);
  });

  it("XG1-011: 敵軍コマンドゾーンの OT のカードでも「SP1」になる（既知の不具合: CARD-XG1-011）（出典: atwiki/page-1644「自軍ゾーンか敵軍ゾーンに」・R-ZONE-01）", () => {
    expect(spOf(field({}, { command: releasedCat("OT", 1) }), "player1", "XG1-011:bf")).toBe(1);
  });

  it("XG1-011: OT のカードがウラ向き（ダメージ）だけ、またはエリア（ラッシュエリア）のユニットだけなら SP を持たない（出典: atwiki/page-1644「オモテ向きであれば」・R-ZONE-01「ゾーン＝パワーゾーン＋コマンドゾーン」）", () => {
    expect(spOf(field({ power: [faceDown("TST-OP-OT", "ot")], rush: [inst("SPEC-OT-S", "u")] }), "player1", "XG1-011:bf")).toBe(0);
  });
});

// ===========================================================================
describe("XG1-012 レッドパンチャー", () => {
  const TEXT =
    "※これは自軍コマンドがすべてリリース状態なら「SP1」になる。 【ボクシングスタイル】自軍バトルフェイズ中、これが自軍バトルエリアにある間、ETを持つ自軍コマンドを3つホールドしてもよい。そうしたとき、これをラッシュエリアに戻す。";

  it("XG1-012: カタログ本文・スペックが出典と一致（追加条件「自軍Sユニットを1体捨札にする」）（出典: atwiki/page-1615）", () => {
    expectCatalogText("XG1-012", TEXT);
    expectUnitStats("XG1-012", { name: "レッドパンチャー", category: "MA", size: "L", bp: 4000, sp: "special", powerCost: "5+", features: ["メカ", "人型"], rushCondition: "send_s_unit_to_discard" });
    expectRarityIn("XG1-012", ["N"]);
  });

  const field = (command = releasedCat("ET", 3)) => p1Battle({ battle: [inst("XG1-012", "rp")], command }, {}, EXTRA);

  it("XG1-012: ※ 自軍コマンドがすべてリリース状態なら「SP1」になる（既知の不具合: CARD-XG1-012 SP を持たない）（出典: atwiki/page-1615「※これは自軍コマンドがすべてリリース状態なら「SP1」になる」）", () => {
    expect(spOf(field(), "player1", "XG1-012:rp")).toBe(1);
  });

  it("XG1-012: ※ 自軍コマンドが1つだけでも、それがリリース状態なら「SP1」（既知の不具合: CARD-XG1-012）（出典: atwiki/page-1615 コメント欄「はい、自軍コマンドがすべてリリース状態なのでSP1になります」）", () => {
    expect(spOf(field(releasedCat("ET", 1)), "player1", "XG1-012:rp")).toBe(1);
  });

  it("XG1-012: ※ ホールド状態の自軍コマンドが1つでもあれば SP を持たない（出典: atwiki/page-1615「すべてリリース状態なら」）", () => {
    expect(spOf(field([...releasedCat("ET", 2), ...heldN(1)]), "player1", "XG1-012:rp")).toBe(0);
  });

  it("XG1-012: 【ボクシングスタイル】自軍バトルフェイズ中、自軍バトルエリアにあれば、ET の自軍コマンドを3つホールドしてラッシュエリアに戻れる（既知の不具合: CARD-XG1-012 起動の手がない）（出典: atwiki/page-1615「ETを持つ自軍コマンドを3つホールドしてもよい。そうしたとき、これをラッシュエリアに戻す」・カード評価「コマンドをリリースする手段が有れば何度でもバトルエリアに出てストライクできる」）", () => {
    const s0 = field();
    expect(canActivate(s0, "XG1-012:rp")).toBe(true);
    const s = resolveAll(activate(s0, "XG1-012:rp"));
    expect(zoneOf(s, "player1", "XG1-012:rp")).toBe("rush");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("XG1-012: 【ボクシングスタイル】ET のリリース状態の自軍コマンドが2つ（＋MA が1つ）しかなければ起動できない（出典: atwiki/page-1615「ETを持つ自軍コマンドを3つ」）", () => {
    expect(canActivate(field([...releasedCat("ET", 2), ...releasedCat("MA", 1)]), "XG1-012:rp")).toBe(false);
  });

  it("XG1-012: 【ボクシングスタイル】ラッシュエリアにあるときは起動できない（出典: atwiki/page-1615「これが自軍バトルエリアにある間」）", () => {
    const s = p1Battle({ rush: [inst("XG1-012", "rp")], command: releasedCat("ET", 3) }, {}, EXTRA);
    expect(canActivate(s, "XG1-012:rp")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-013 キングピラミッダーPF", () => {
  const TEXT =
    "【巨大要塞】これが自軍ラッシュエリアにある間、自分がラッシュするMユニットまたはLユニットの追加条件を満たすために次のようにしてもよい⇒自軍Sユニットを1体捨札にするかわりに、自軍Sユニットを1体ホールドする。";

  it("XG1-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-1642）", () => {
    expectCatalogText("XG1-013", TEXT);
    expectUnitStats("XG1-013", { name: "キングピラミッダーPF", category: "MA", size: "XL", bp: 5000, sp: undefined, powerCost: 5, features: ["メカ", "母艦"] });
    expectRarityIn("XG1-013", ["NR"]);
  });

  // 追加条件「自軍Sユニットを1体捨札にする」の L ユニット XG1-012 レッドパンチャーをラッシュする。
  const board = (withPyramider: boolean) =>
    rushPhaseBoard(
      { hand: [inst("XG1-012", "h")], rush: [...(withPyramider ? [inst("XG1-013", "kp")] : []), inst("TST-UNIT-0", "s")], command: releasedCat("MA", 2), power: powerCards(5) },
      {},
      EXTRA,
    );

  it("XG1-013: 【巨大要塞】自軍ラッシュエリアにあれば、L ユニットの追加条件の「自軍Sユニットを1体捨札にする」かわりに、自軍 S ユニットを1体ホールドしてラッシュできる（既知の不具合: CARD-XG1-013 置きかえの選び方がない）（出典: atwiki/page-1642「自軍Sユニットを1体捨札にするかわりに、自軍Sユニットを1体ホールドする」・カード評価「MAのユニットでなくても追加条件を置き換えることができる」）", () => {
    const held = rushResults(board(true), "player1", "XG1-012:h").filter(
      (r) => zoneOf(r, "player1", "XG1-012:h") === "rush" && zoneOf(r, "player1", "TST-UNIT-0:s") === "rush" && isHeldCard(r, "player1", "TST-UNIT-0:s"),
    );
    expect(held.length).toBeGreaterThan(0);
  });

  it("XG1-013: キングピラミッダーPF がなければ、追加条件の S ユニットは捨札になる（置きかえは選べない）（出典: atwiki/page-1642「これが自軍ラッシュエリアにある間」）", () => {
    const results = rushResults(board(false), "player1", "XG1-012:h").filter((r) => zoneOf(r, "player1", "XG1-012:h") === "rush");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => zoneOf(r, "player1", "TST-UNIT-0:s") === "discard")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-014 キングレンジャー", () => {
  const TEXT =
    "※これはホールド状態のユニットにアタックすることができない。 【キングスティック】これが自軍エリアにある間、自軍ラッシュフェイズ中、ホールド状態のDAを持たないSユニットを1体選び、自軍コマンドを2つ（選んだユニットがウイングを持つなら4つ）ホールドしてもよい。そうしたとき、選んだユニットをリリースする。";

  it("XG1-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-1675）", () => {
    expectCatalogText("XG1-014", TEXT);
    expectUnitStats("XG1-014", { name: "キングレンジャー", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 4, features: ["ブラック", "男"] });
    expectRarityIn("XG1-014", ["SR"]);
  });

  it("XG1-014: ※ ホールド状態の敵軍ユニットにはアタックできない（リリース状態のユニットにはできる）（出典: atwiki/page-1675「※これはホールド状態のユニットにアタックすることができない」）", () => {
    const s = p1Battle({ battle: [inst("XG1-014", "kr")] }, { battle: [heldUnit("SPEC-C2", "h"), inst("SPEC-C3", "r")] }, EXTRA);
    expect(targetsOf(s, "XG1-014:kr")).toEqual(["SPEC-C3:r"]);
  });

  // 自軍ラッシュフェイズ。敵軍: ホールド状態の S ユニット（ET・DA）・ホールド状態の M ユニット・リリース状態の S ユニット・ホールド状態のウイング持ち（XG1-003）。
  const rushBoard = (command = releasedCat("MA", 4)) =>
    rushPhaseBoard(
      { rush: [inst("XG1-014", "kr"), heldUnit("SPEC-OT-S", "own")], command },
      { rush: [heldUnit("SPEC-ET-S", "et"), heldUnit("SPEC-DA-S", "da"), heldUnit("SPEC-MA-M", "m"), inst("SPEC-C2", "rel"), heldUnit("XG1-003", "wing")] },
      EXTRA,
    );

  it("XG1-014: 【キングスティック】自軍ラッシュフェイズ中に起動でき、ホールド状態の DA を持たない S ユニット（自軍・敵軍を問わない）から1体選ぶ（DA・M・リリース状態は対象外）（既知の不具合: CARD-XG1-014 起動の手がない）（出典: atwiki/page-1675「ホールド状態のDAを持たないSユニットを1体選び」・カード評価「自軍と敵軍問わずユニットをリリースする能力」）", () => {
    const s0 = rushBoard();
    expect(canActivate(s0, "XG1-014:kr")).toBe(true);
    const s = activate(s0, "XG1-014:kr");
    expectChoiceFrom(s, "player1", "XG1-014");
    expect(choiceIds(s)).toEqual(["SPEC-ET-S:et", "SPEC-OT-S:own", "XG1-003:wing"]);
  });

  it("XG1-014: 自軍コマンドを2つホールドすると、選んだユニットをリリースする（既知の不具合: CARD-XG1-014）（出典: atwiki/page-1675「自軍コマンドを2つ…ホールドしてもよい。そうしたとき、選んだユニットをリリースする」）", () => {
    const s = resolveAll(activate(rushBoard(), "XG1-014:kr"), ["SPEC-ET-S:et"]);
    expect(isHeldCard(s, "player2", "SPEC-ET-S:et")).toBe(false);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("XG1-014: 選んだユニットがウイングを持つなら、自軍コマンドを4つホールドしてリリースする（既知の不具合: CARD-XG1-014）（出典: atwiki/page-1675「（選んだユニットがウイングを持つなら4つ）」）", () => {
    const s = resolveAll(activate(rushBoard(), "XG1-014:kr"), ["XG1-003:wing"]);
    expect(isHeldCard(s, "player2", "XG1-003:wing")).toBe(false);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(4);
  });

  it("XG1-014: 【キングスティック】自軍バトルフェイズには起動できない（出典: atwiki/page-1675「自軍ラッシュフェイズ中」・カード評価「効果の発動がラッシュフェイズ限定」）", () => {
    const s = p1Battle({ rush: [inst("XG1-014", "kr")], command: releasedCat("MA", 4) }, { rush: [heldUnit("SPEC-ET-S", "et")] }, EXTRA);
    expect(canActivate(s, "XG1-014:kr")).toBe(false);
  });
});
