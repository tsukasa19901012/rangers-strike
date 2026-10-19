/**
 * cardSpec XG4-097〜XG4-102（ヘレンレディ〜ケンローダー）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-XG4-102）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  activate,
  attackUntilRegister,
  bpOf,
  canActivate,
  canMount,
  choiceIds,
  deckCards,
  endTurnKeep,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  p1Battle,
  pick,
  registerOffered,
  releasedCat,
  resolveAll,
  ridingPair,
  spOf,
  st,
  sUnit,
  taxTests,
  zoneOf,
} from "./XG4-084-102.helpers";

const OT_MAN_5000 = sUnit("SPEC-OT-MAN-5000", { category: "OT", bp: 5000, sp: undefined, features: ["男"] });
const OT_MAN_4000 = sUnit("SPEC-OT-MAN-4000", { category: "OT", bp: 4000, sp: undefined, features: ["男"] });
const WB_MAN_5000 = sUnit("SPEC-WB-MAN-5000", { category: "WB", bp: 5000, sp: undefined, features: ["男"] });
const WOMAN = sUnit("SPEC-WOMAN", { category: "OT", bp: 1000, sp: undefined, features: ["女"] });
const MAN = sUnit("SPEC-MAN", { category: "OT", bp: 1000, sp: undefined, features: ["男"] });
const MECHA = sUnit("SPEC-MECHA", { category: "OT", bp: 1000, sp: undefined, features: ["メカ"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "OT", bp: 1000, sp: undefined, features: ["男"] });
const E_6000 = sUnit("SPEC-E-6000", { bp: 6000, sp: undefined });
const E_7000 = sUnit("SPEC-E-7000", { bp: 7000, sp: undefined });
const EXTRA = [OT_MAN_5000, OT_MAN_4000, WB_MAN_5000, WOMAN, MAN, MECHA, PLAIN, E_6000, E_7000];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-097 ヘレンレディ", () => {
  it("XG4-097: カタログ本文・スペックが出典と一致（出典: atwiki/page-2058）", () => {
    expectCatalogText("XG4-097", "【ヘレンカッター】これは、BP5000以上の、OTを持ち特徴「男」を持つSユニットと隣り合っている間、次の能力を得る⇒SP1");
    expectUnit("XG4-097", { name: "ヘレンレディ", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["メカ", "女"] });
    expectRarityIn("XG4-097", ["N"]);
  });

  const sp = (neighbor: string) => spOf(battle({ battle: [inst("XG4-097", "hl"), inst(neighbor, "n")] }), "player1", "XG4-097:hl");

  it.fails("XG4-097:【ヘレンカッター】— BP5000 以上・OT・「男」の S ユニットと隣り合っている間「SP1」（1番目でも SP1）（出典: atwiki/page-2058「隣り合っている間、次の能力を得る⇒SP1」）（既知の不具合: CARD-XG4-097 【ヘレンカッター】の SP1 が付かない）", () => {
    expect(sp("SPEC-OT-MAN-5000")).toBe(1);
  });

  it("XG4-097:【ヘレンカッター】— 隣が BP4000、または OT を持たないなら「SP1」にならない（1番目なので分数 SP も0）（出典: atwiki/page-2058「BP5000以上の、OTを持ち特徴「男」を持つSユニット」）", () => {
    expect(sp("SPEC-OT-MAN-4000")).toBe(0);
    expect(sp("SPEC-WB-MAN-5000")).toBe(0);
  });
});

// ===========================================================================
describe("XG4-098 スピルバン", () => {
  const TEXT =
    "【トリプルボンバー】このユニットの両隣に特徴「女」を持つ自軍ユニットが並んでいる間、このユニットはBP+2000され、次の能力を得る⇒自分がターンを終えるとき、このユニットのBP以下のBPを持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る。";

  it("XG4-098: カタログ本文・スペックが出典と一致（出典: atwiki/page-2119）", () => {
    expectCatalogText("XG4-098", TEXT);
    expectUnit("XG4-098", { name: "スピルバン", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 4, comboNumber: undefined, features: ["メカ", "男"] });
    expectRarityIn("XG4-098", ["NR"]);
  });

  const line = (left: string, right: string) =>
    battle({ battle: [inst(left, "l"), inst("XG4-098", "sb"), inst(right, "r")] }, { battle: [inst("SPEC-E-6000", "a"), inst("SPEC-E-7000", "b")], deck: deckCards(3, "e") });

  it.fails("XG4-098:【トリプルボンバー】— 両隣に「女」の自軍ユニットが並んでいる間 BP+2000（BP6000）（出典: atwiki/page-2119「このユニットはBP+2000され」）（既知の不具合: CARD-XG4-098 【トリプルボンバー】の BP+2000 とターン終了時の効果が働かない）", () => {
    expect(bpOf(line("SPEC-WOMAN", "SPEC-WOMAN"), "player1", "XG4-098:sb")).toBe(6000);
  });

  it("XG4-098:【トリプルボンバー】— 片側だけなら BP は上がらない（出典: atwiki/page-2119「両隣に」）", () => {
    expect(bpOf(line("SPEC-WOMAN", "SPEC-MAN"), "player1", "XG4-098:sb")).toBe(4000);
  });

  it.fails("XG4-098:【トリプルボンバー】— 自分がターンを終えるとき、これの BP（6000）以下の敵軍ユニットを1体選び、持ち主のパワーゾーンに送る（BP7000 は選べない）（出典: atwiki/page-2119「このユニットのBP以下のBPを持つ敵軍ユニットを1体選び持ち主のパワーゾーンに送る」）（既知の不具合: CARD-XG4-098 【トリプルボンバー】の BP+2000 とターン終了時の効果が働かない）", () => {
    let s = endTurnKeep(line("SPEC-WOMAN", "SPEC-WOMAN"));
    expectChoiceFrom(s, "player1", "XG4-098");
    expect(choiceIds(s)).toEqual(["SPEC-E-6000:a"]);
    s = resolveAll(pick(s, "SPEC-E-6000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-6000:a")).toBe("power");
  });
});

// ===========================================================================
describe("XG4-099 ホバリアン", () => {
  const TEXT = "※特徴「メカ」を持つ自軍Sユニットは、自軍コマンドを1つホールドすればＲＣを持っていなくてもこのビークルにライドできる。 【バリア】これにライドしている特徴「メカ」を持つユニットは、次の能力を得る⇒「レジスト」";

  it("XG4-099: カタログ本文・スペックが出典と一致（出典: atwiki/page-2120）", () => {
    expectCatalogText("XG4-099", TEXT);
    expectVehicle("XG4-099", { name: "ホバリアン", category: "OT", powerCost: 3, size: "S", features: ["メカ", "車両", "航空機"] });
    expectRarityIn("XG4-099", ["N"]);
  });

  it("XG4-099: ※ — 「メカ」の S ユニットは、自軍コマンドをホールドできれば RC がなくてもライドできる（「メカ」を持たないユニット・コマンドがない場合はライドできない）（出典: atwiki/page-2120「自軍コマンドを1つホールドすればＲＣを持っていなくてもこのビークルにライドできる」）", () => {
    const withCmd = battle({ rush: [inst("XG4-099", "hv"), inst("SPEC-MECHA", "m"), inst("SPEC-PLAIN", "p")], command: releasedCat("OT", 1) });
    expect(canMount(withCmd, "SPEC-MECHA:m", "XG4-099:hv")).toBe(true);
    expect(canMount(withCmd, "SPEC-PLAIN:p", "XG4-099:hv")).toBe(false);
    const noCmd = battle({ rush: [inst("XG4-099", "hv"), inst("SPEC-MECHA", "m")], command: [] });
    expect(canMount(noCmd, "SPEC-MECHA:m", "XG4-099:hv")).toBe(false);
  });

  it.fails("XG4-099:【バリア】— ライドしている「メカ」のユニットは「レジスト」を得る（バトルで撃破されたときホールドして留められる）（出典: atwiki/page-2120「これにライドしている特徴「メカ」を持つユニットは、次の能力を得る⇒「レジスト」」）（既知の不具合: CARD-XG4-099 ライドしている「メカ」のユニットが「レジスト」を得ない）", () => {
    expect(registerOffered(attackUntilRegister({ battle: ridingPair("SPEC-MECHA", "m", "XG4-099", "hv") }, "SPEC-MECHA:m", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
  });
});

// ===========================================================================
describe("XG4-100 バイクロッサー・ケン", () => {
  it("XG4-100: カタログ本文・スペックが出典と一致（出典: atwiki/page-2109）", () => {
    expectCatalogText("XG4-100", "※レジスト ※タクスOT 【隠烈剛】これが自軍エリアにある間、次の敵軍ターン中、ライドしている自軍Sユニットは敵軍ユニットにアタックされない。");
    expectUnit("XG4-100", { name: "バイクロッサー・ケン", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: "RC", features: ["メカ", "男"] });
    expectRarityIn("XG4-100", ["NR"]);
  });

  it("XG4-100: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2109 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-100", "kn")] }, "XG4-100:kn"))).toBe(true);
  });

  taxTests("XG4-100", "OT", "atwiki/page-2109");

  it.todo("XG4-100: RC【隠烈剛】— ライドオフした次の敵軍ターン中、ライドしている自軍 S ユニットは敵軍ユニットにアタックされない（出典: atwiki/page-2109）（未対応の理由: ライドオフした自軍ターンから次の敵軍バトルフェイズまで、ライドしたままのユニットを残してアタックさせる手順を公開 API で組めない）");
});

// ===========================================================================
describe("XG4-101 バイクロッサー・ギン", () => {
  it("XG4-101: カタログ本文・スペックが出典と一致（出典: atwiki/page-2110）", () => {
    expectCatalogText("XG4-101", "【ブレーザーカノン】これがライドしていれば、相手に1点ダメージを与える。");
    expectUnit("XG4-101", { name: "バイクロッサー・ギン", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: "RC", features: ["メカ", "男"] });
    expectRarityIn("XG4-101", ["NR"]);
  });

  it.todo("XG4-101: RC【ブレーザーカノン】— これがライドしていれば相手に1点ダメージを与える（出典: atwiki/page-2110「これがライドしていれば」）（未対応の理由: RC はライドオフしたときに発動するので、そのときに「ライドしていれば」が成り立つ場面（ライドオフせずに RC を発動できる XG4-091 ガンギブソン等）が出典で決まらない。XG4-questions.md に記載）");
});

// ===========================================================================
describe("XG4-102 ケンローダー", () => {
  // 読み替え後の本文（R-ERR-XG4-102・atwiki/page-2060 Q1）。
  const TEXT =
    "【ギンクロン発進】自軍ラッシュフェイズ中、このビークルを捨札にして次の効果を発動できる⇒自軍山札を見て「ケンローダー」以外のＯＴを持つＳビークルのカードを１枚選び、自軍ラッシュエリアに出す。ただし、追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG4-102: カタログ本文（読み替え後）・スペックが出典と一致（出典: atwiki/page-2060・R-ERR-XG4-102）", () => {
    expectCatalogText("XG4-102", TEXT);
    expectVehicle("XG4-102", { name: "ケンローダー", category: "OT", powerCost: 3, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("XG4-102", ["N"]);
  });

  const rb = (zone: "rush" | "hand") =>
    st(
      { phase: "rush", player1: { [zone]: [inst("XG4-102", "kl")], deck: [inst("XG4-099", "hv"), inst("XG4-102", "k2"), inst("XG4-090", "gg"), ...deckCards(3)] }, player2: { deck: deckCards(3, "e") } },
      EXTRA,
    );

  it("XG4-102:【ギンクロン発進】— 自軍ラッシュフェイズ中、自軍エリアのこれを捨札にして発動でき、山札の「ケンローダー」以外の OT の S ビークルから1枚選ぶ（ET のビークル・ケンローダーは選べない）（出典: R-ERR-XG4-102「自軍山札を見て「ケンローダー」以外のＯＴを持つＳビークルのカードを１枚選び」）", () => {
    const s0 = rb("rush");
    expect(canActivate(s0, "XG4-102:kl")).toBe(true);
    const s = activate(s0, "XG4-102:kl");
    expect(zoneOf(s, "player1", "XG4-102:kl")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG4-102");
    expect(choiceIds(s)).toEqual(["XG4-099:hv"]);
  });

  it("XG4-102:【ギンクロン発進】— 選んだビークルは自軍ラッシュエリアに出る（出典: R-ERR-XG4-102「自軍ラッシュエリアに出す」）", () => {
    let s = activate(rb("rush"), "XG4-102:kl");
    expectChoiceFrom(s, "player1", "XG4-102");
    s = resolveAll(pick(s, "XG4-099:hv"));
    expect(zoneOf(s, "player1", "XG4-099:hv")).toBe("rush");
  });

  it("XG4-102: 公式Q&A — 手札・ゾーンにあるケンローダーでは発動できない（出典: atwiki/page-2060 Q1「いいえ、それはできません」）", () => {
    expect(canActivate(rb("hand"), "XG4-102:kl")).toBe(false);
  });

});
