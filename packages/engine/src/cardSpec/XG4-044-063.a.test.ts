/**
 * cardSpec XG4-044〜XG4-050（ゴセイブラック〜ロボイザー）。
 * 出典の優先順（docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）・grnrngr FAQ（XG4 のカード別 Q&A なし）・atwiki に転記された公式Q&A
 *  2. atwiki のカード本文（docs/wiki/sources/atwiki/page-N-XG4-NNN.md）
 *  3. atwiki のカード評価・コメント
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけを使う。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canEnter,
  canMount,
  canSkip,
  canWing,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  expectVehicle,
  inst,
  mount,
  ncEnter,
  p1Battle,
  pick,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  ridingPair,
  settle,
  st,
  sUnit,
  swapTests,
  targetsOf,
  toMyTurnStart,
  vehicleCard,
  zoneOf,
} from "./XG4-044-063.helpers";

const E_S = sUnit("SPEC-E-S", { bp: 1000, sp: undefined });
const E_M = sUnit("SPEC-E-M", { bp: 1000, size: "M", sp: undefined });
const OWN_S = sUnit("SPEC-OWN-S", { bp: 1000, sp: undefined });
const E_3000 = sUnit("SPEC-E-3000", { bp: 3000, sp: undefined });
const E_3500 = sUnit("SPEC-E-3500", { bp: 3500, sp: undefined });
const E_3000R = sUnit("SPEC-E-3000R", { bp: 3000, sp: undefined, text: "※レジスト" } as never);
const E_SP1 = sUnit("SPEC-E-SP1", { bp: 4000, sp: 1 });
const E_SP0 = sUnit("SPEC-E-SP0", { bp: 4000, sp: undefined });
const E_4000 = sUnit("SPEC-E-4000", { bp: 4000, sp: undefined });
const GRUNT = sUnit("SPEC-GRUNT", { bp: 1000, sp: undefined, features: ["戦闘員"] });
const PLAIN = sUnit("SPEC-PLAIN", { bp: 1000, sp: undefined, features: ["男"] });
const BIKE = vehicleCard("SPEC-BIKE", { category: "MA" });
const RC_RIDER = sUnit("SPEC-RC", { bp: 1000, sp: undefined, comboNumber: "RC" });
const EXTRA = [E_S, E_M, OWN_S, E_3000, E_3500, E_3000R, E_SP1, E_SP0, E_4000, GRUNT, PLAIN, BIKE, RC_RIDER];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);

// ===========================================================================
describe("XG4-044 ゴセイブラック（XG4）", () => {
  const TEXT = "※レジスト 【ランディックアックス】このターン、これは、リリース状態の自軍コマンド1つにつきBP+1000される。";

  it("XG4-044: カタログ本文・スペックが出典と一致（SP 欄の「！」は誤植で、SP 空欄として扱う）（出典: atwiki/page-2096・同 Q1「SP欄の！は印刷の誤りですので、SP空欄のカードとして扱って下さい」）", () => {
    expectCatalogText("XG4-044", TEXT);
    expectUnit("XG4-044", { name: "ゴセイブラック", category: ["WB", "MA"], size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["ブラック", "男"] });
    expectRarityIn("XG4-044", ["N"]);
  });

  it("XG4-044: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2096 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-044", "gb")] }, "XG4-044:gb"))).toBe(true);
  });

  it.fails("XG4-044: NC【ランディックアックス】— 4番目に出ると、リリース状態の自軍コマンド1つにつき BP+1000（3つで BP6000。ホールド状態のコマンドは数えない）（出典: atwiki/page-2096「リリース状態の自軍コマンド1つにつきBP+1000される」）（既知の不具合: CARD-XG4-044 NC【ランディックアックス】がログに出るだけで BP が上がらない）", () => {
    const s = settle(ncEnter("XG4-044:gb", 3, { command: [...releasedCat("MA", 2), released("TST-OP-ET", "et"), { ...released("TST-OP-WB", "h"), commandHeld: true }] }, {}, EXTRA));
    expect(bpOf(s, "player1", "XG4-044:gb")).toBe(6000);
  });

  it("XG4-044: NC — 4番目以外（3番目）に出れば BP は上がらない（出典: atwiki/page-2096「CN：4」）", () => {
    const s = settle(ncEnter("XG4-044:gb", 2, { command: releasedCat("MA", 2) }, {}, EXTRA));
    expect(bpOf(s, "player1", "XG4-044:gb")).toBe(3000);
  });
});

// ===========================================================================
describe("XG4-045 ゴセイピンク（XG4）", () => {
  const TEXT = "※ウイング 【スカイックショット】Sユニットを1体選び、持ち主の山札の上に戻す。";

  it("XG4-045: カタログ本文・スペックが出典と一致（出典: atwiki/page-2050）", () => {
    expectCatalogText("XG4-045", TEXT);
    expectUnit("XG4-045", { name: "ゴセイピンク", category: ["WB", "MA"], size: "S", bp: 500, sp: undefined, powerCost: 0, comboNumber: 5, features: ["ピンク", "女"] });
    expectRarityIn("XG4-045", ["N"]);
  });

  // BP500 なので RK1 の wingTests（BP500 の相手を撃破する）は使わず、アタックできるところまでを確かめる。
  const wingBoard = (phase: GameState["phase"] = "battle") =>
    st({ phase, player1: { rush: [inst("XG4-045", "w")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E-S", "e")], deck: deckCards(3, "e") } }, EXTRA);

  it("XG4-045: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドし、ラッシュエリアから敵軍ユニットにアタックできる（出典: atwiki/page-2050、grnrngr/faq-card-9 ウイング A1・R-KW-WING-01）", () => {
    let s = wingBoard();
    expect(canWing(s, "XG4-045:w")).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-045:w" });
    expect(cardIn(s, "player1", "XG4-045:w")?.commandHeld).toBe(true);
    expect(targetsOf(s, "XG4-045:w")).toContain("SPEC-E-S:e");
  });

  it("XG4-045: ※ウイング — 発動したターンはバトルエリアに出られず、ラッシュフェイズには発動できない（出典: grnrngr/faq-card-9 ウイング Q3・Q4）", () => {
    const s = act(wingBoard(), { type: "hold_for_wing", playerId: "player1", instanceId: "XG4-045:w" });
    expect(canEnter(s, "XG4-045:w")).toBe(false);
    expect(canWing(wingBoard("rush"), "XG4-045:w")).toBe(false);
  });

  const nc = () =>
    settle(ncEnter("XG4-045:gp", 4, { rush: [inst("SPEC-OWN-S", "own")] }, { battle: [inst("SPEC-E-S", "eb"), inst("SPEC-E-M", "em")], rush: [inst("SPEC-E-S", "er")], deck: deckCards(3, "e") }, EXTRA));

  it.fails("XG4-045: NC【スカイックショット】— 5番目に出ると、S ユニット（敵軍・自軍、どのエリアでも）を1体選ぶ。M ユニットは選べない（任意ではない）（出典: atwiki/page-2050「Sユニットを1体選び」・カード評価「Sユニットなら何でも戻すことができるが、BPの低いMユニット等は戻せなくなっている」）（既知の不具合: CARD-XG4-045 NC【スカイックショット】がログに出るだけで選択が開かない）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-045");
    const c = choiceIds(s);
    for (const id of ["SPEC-E-S:eb", "SPEC-E-S:er", "SPEC-OWN-S:own"]) expect(c).toContain(id);
    expect(c).not.toContain("SPEC-E-M:em");
    expect(canSkip(s)).toBe(false);
  });

  it.fails("XG4-045: NC — 選んだユニットは持ち主の山札の一番上に戻る（出典: atwiki/page-2050「持ち主の山札の上に戻す」）（既知の不具合: CARD-XG4-045 NC【スカイックショット】がログに出るだけで選択が開かない）", () => {
    let s = nc();
    expectChoiceFrom(s, "player1", "XG4-045");
    s = resolveAll(pick(s, "SPEC-E-S:er"));
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-E-S:er");
  });
});

// ===========================================================================
describe("XG4-046 腑破十臓", () => {
  const TEXT =
    "※これはレジストを持たないBP3000以下のユニットにアタックできない。 ※これはホールド状態のときBP-3000される。 【妖刀・裏正】これが敵軍ユニットをバトルで撃破した時、撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える。";

  it("XG4-046: カタログ本文・スペックが出典と一致（出典: atwiki/page-2149）", () => {
    expectCatalogText("XG4-046", TEXT);
    expectUnit("XG4-046", { name: "腑破十臓", category: "DA", size: "S", bp: 6000, sp: undefined, powerCost: 3, comboNumber: undefined, features: ["妖怪", "男", "侍"] });
    expectRarityIn("XG4-046", ["R"]);
  });

  const board = () =>
    battle({ battle: [inst("XG4-046", "jz")] }, { battle: [inst("SPEC-E-3000", "a"), inst("SPEC-E-3500", "b"), inst("SPEC-E-3000R", "c")] });

  it.fails("XG4-046: ※ — レジストを持たない BP3000 以下のユニットにはアタックできない（BP3500・レジストを持つ BP3000 にはアタックできる）（出典: atwiki/page-2149「これはレジストを持たないBP3000以下のユニットにアタックできない」・コメント「敵軍ユニットがレジストを持っていればBP3000以下のユニットでもアタック出来ますよね?」「可能です」）（既知の不具合: CARD-XG4-046 レジストを持たない BP3000 以下のユニットにもアタックできてしまう）", () => {
    expect(targetsOf(board(), "XG4-046:jz")).toEqual(["SPEC-E-3000R:c", "SPEC-E-3500:b"]);
  });

  it.fails("XG4-046: ※ — ホールド状態のとき BP-3000（BP3000）（出典: atwiki/page-2149「これはホールド状態のときBP-3000される」）（既知の不具合: CARD-XG4-046 ホールド状態の BP-3000 が働かない）", () => {
    const s = battle({ battle: [{ ...inst("XG4-046", "jz"), commandHeld: true }] });
    expect(bpOf(s, "player1", "XG4-046:jz")).toBe(3000);
    expect(bpOf(battle({ battle: [inst("XG4-046", "jz")] }), "player1", "XG4-046:jz")).toBe(6000);
  });

  it.fails("XG4-046:【妖刀・裏正】— SP1 以上の敵軍ユニットをバトルで撃破すると、相手に1点ダメージを与える（出典: atwiki/page-2149「撃破したユニットのSPが1以上だったなら、相手に1点ダメージを与える」）（既知の不具合: CARD-XG4-046 【妖刀・裏正】のダメージが入らない）", () => {
    const s = settle(attack(battle({ battle: [inst("XG4-046", "jz")] }, { battle: [inst("SPEC-E-SP1", "t")], deck: deckCards(3, "e") }), "XG4-046:jz", "SPEC-E-SP1:t"));
    expect(zoneOf(s, "player2", "SPEC-E-SP1:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG4-046:【妖刀・裏正】— SP を持たないユニットを撃破してもダメージは与えない（出典: atwiki/page-2149「SPが1以上だったなら」）", () => {
    const s = settle(attack(battle({ battle: [inst("XG4-046", "jz")] }, { battle: [inst("SPEC-E-SP0", "t")], deck: deckCards(3, "e") }), "XG4-046:jz", "SPEC-E-SP0:t"));
    expect(zoneOf(s, "player2", "SPEC-E-SP0:t")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it.todo("XG4-046: 公式Q&A — 敵軍バトルエリアにレジストを持たない BP3000 以下のユニットだけがいるとき、XG3-034 恐竜折神からコンビネーションした腑破十臓は【キョウリュウマル】を発動できる（出典: atwiki/page-2149 Q1）（未対応の理由: 恐竜折神からのジョイントコンビネーションで【キョウリュウマル】を発動させる盤面を公開 API で組む手段がない）");
});

// ===========================================================================
describe("XG4-047 シンケンレッド（XG4）", () => {
  const TEXT =
    "※レジスト 【車上の赤き侍】ライドしている敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。（この効果はライドしている自軍ユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("XG4-047: カタログ本文・スペックが出典と一致（出典: atwiki/page-2108）", () => {
    expectCatalogText("XG4-047", TEXT);
    expectUnit("XG4-047", { name: "シンケンレッド", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 4, comboNumber: 4, features: ["レッド", "男", "侍"] });
    expectRarityIn("XG4-047", ["NR"]);
  });

  it("XG4-047: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2108 ※レジスト・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG4-047", "sr")] }, "XG4-047:sr"))).toBe(true);
  });

  const nc = () =>
    settle(ncEnter("XG4-047:sr", 3, {}, { battle: [...ridingPair("SPEC-E-S", "rd", "SPEC-BIKE", "bk"), inst("SPEC-E-S", "nr")], deck: deckCards(3, "e") }, EXTRA));

  it.fails("XG4-047: NC【車上の赤き侍】— 4番目に出ると、ライドしている敵軍 S ユニットから1体選べる（ライドしていないユニットは選べない。任意）（出典: atwiki/page-2108「ライドしている敵軍Sユニットを1体選び…置いてもよい」）（既知の不具合: CARD-XG4-047 NC【車上の赤き侍】の候補にライドしていないユニットが入る）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG4-047");
    expect(choiceIds(s)).toEqual(["SPEC-E-S:rd"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-047: NC — 選んだユニットは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-2108「持ち主のパワーゾーンにダメージにして置いてもよい」）（既知の不具合: CARD-XG4-047 選んだユニットがダメージ（ウラ向き）として数えられない）", () => {
    let s = nc();
    expectChoiceFrom(s, "player1", "XG4-047");
    s = resolveAll(pick(s, "SPEC-E-S:rd"));
    expect(zoneOf(s, "player2", "SPEC-E-S:rd")).toBe("power");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.todo("XG4-047: ライドしている自軍ユニットからコンビネーションするときはナンバーに関係なく発動する（出典: atwiki/page-2108「（この効果はライドしている自軍ユニットからコンビネーションするときはナンバーに関係なく発動する）」）（未対応の理由: 「ライドしている自軍ユニットからのコンビネーション」が RC・JC のどちらを指すか出典で決まらず、盤面を決められない）");
});

// ===========================================================================
describe("XG4-048 ウガッツバイク", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 ※特徴「戦闘員」を持つユニットはＲＣがなくてもこのビークルにライドでき、これにライドしている間BP+500される。";

  it("XG4-048: カタログ本文・スペックが出典と一致（出典: atwiki/page-2070）", () => {
    expectCatalogText("XG4-048", TEXT);
    expectVehicle("XG4-048", { name: "ウガッツバイク", category: "DA", powerCost: 0, size: "S", features: ["メカ", "車両", "戦闘員"] });
    expectRarityIn("XG4-048", ["N"]);
  });

  it.todo("XG4-048: ※ — デッキに好きな枚数入れてもよい（出典: atwiki/page-2070「このカードはデッキに好きな枚数入れてもよい」）（未対応の理由: デッキ構築の枚数制限は createTestState / applyAction / getLegalActions では確かめられない）");

  it.fails("XG4-048: ※ — 特徴「戦闘員」を持つユニットは RC がなくてもライドできる（「戦闘員」も RC も持たないユニットはライドできない）（出典: atwiki/page-2070「特徴「戦闘員」を持つユニットはＲＣがなくてもこのビークルにライドでき」）（既知の不具合: CARD-XG4-048 「戦闘員」を持つユニットが RC なしでライドできない（BP+500 も確かめられない））", () => {
    const s = battle({ rush: [inst("XG4-048", "ub"), inst("SPEC-GRUNT", "g"), inst("SPEC-PLAIN", "p")] });
    expect(canMount(s, "SPEC-GRUNT:g", "XG4-048:ub")).toBe(true);
    expect(canMount(s, "SPEC-PLAIN:p", "XG4-048:ub")).toBe(false);
  });

  it.fails("XG4-048: ※ — ライドしている間 BP+500（BP1000 の戦闘員が BP1500）（出典: atwiki/page-2070「これにライドしている間BP+500される」）（既知の不具合: CARD-XG4-048 「戦闘員」を持つユニットが RC なしでライドできない（BP+500 も確かめられない））", () => {
    const s = settle(mount(battle({ rush: [inst("XG4-048", "ub"), inst("SPEC-GRUNT", "g")] }), "SPEC-GRUNT:g", "XG4-048:ub"));
    expect(bpOf(s, "player1", "SPEC-GRUNT:g")).toBe(1500);
  });
});

// ===========================================================================
describe("XG4-049 アクロバッター（XG4）", () => {
  const TEXT =
    "※自軍ターン開始時、自分の手札から「ロボイザー」か「マックジャバー」のカードを1枚選び、これと置き換えてもよい。 ※これにライドしているユニットはBP+500される。 【光機動生命体】これはライドされていなくてもバトルエリアに出ることができる。";

  it("XG4-049: カタログ本文・スペックが出典と一致（出典: atwiki/page-2076）", () => {
    expectCatalogText("XG4-049", TEXT);
    expectVehicle("XG4-049", { name: "アクロバッター", category: "MA", powerCost: 2, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("XG4-049", ["N"]);
  });

  swapTests("XG4-049", ["XG4-050", "XG4-051"], "TST-UNIT-0", "atwiki/page-2076");

  it("XG4-049: ※ — これにライドしているユニットは BP+500（出典: atwiki/page-2076「これにライドしているユニットはBP+500される」）", () => {
    const s = battle({ rush: ridingPair("SPEC-RC", "r", "XG4-049", "ab") });
    expect(bpOf(s, "player1", "SPEC-RC:r")).toBe(1500);
  });

  it.fails("XG4-049:【光機動生命体】— ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-2076「これはライドされていなくてもバトルエリアに出ることができる」）（既知の不具合: CARD-XG4-049 ライドされていないビークルがバトルエリアに出られない）", () => {
    const s0 = battle({ rush: [inst("XG4-049", "ab")] });
    expect(canEnter(s0, "XG4-049:ab")).toBe(true);
    expect(zoneOf(settle(enter(s0, "XG4-049:ab")), "player1", "XG4-049:ab")).toBe("battle");
  });
});

// ===========================================================================
describe("XG4-050 ロボイザー", () => {
  const TEXT =
    "※自軍ターン開始時、自分の手札から「アクロバッター」か「マックジャバー」のカードを1枚選び、これと置き換えてもよい。 【後部バルカン砲】ライドされているこのビークルが自軍バトルエリアからラッシュエリアに戻るとき、敵軍バトルエリアからBP3000のSユニットを1体選び、撃破してもよい。";

  it("XG4-050: カタログ本文・スペックが出典と一致（出典: atwiki/page-2075）", () => {
    expectCatalogText("XG4-050", TEXT);
    expectVehicle("XG4-050", { name: "ロボイザー", category: "MA", powerCost: 3, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("XG4-050", ["N"]);
  });

  swapTests("XG4-050", ["XG4-049", "XG4-051"], "TST-UNIT-0", "atwiki/page-2075");

  // 自軍スタートフェイズにバトルエリアのユニットがラッシュエリアに戻るとき（R-TURN のスタートフェイズ）。
  const returning = (rider = true) =>
    toMyTurnStart(
      { battle: rider ? ridingPair("SPEC-RC", "r", "XG4-050", "rb") : [inst("XG4-050", "rb")] },
      "XG4-050",
      { battle: [inst("SPEC-E-3000", "a"), inst("SPEC-E-4000", "b")], rush: [inst("SPEC-E-3000", "c")] },
      EXTRA,
    );

  it.fails("XG4-050:【後部バルカン砲】— ライドされたままバトルエリアからラッシュエリアに戻るとき、敵軍バトルエリアの BP3000 の S ユニットから1体選べる（ラッシュエリア・BP4000 は選べない。任意）（出典: atwiki/page-2075「敵軍バトルエリアからBP3000のSユニットを1体選び、撃破してもよい」）（既知の不具合: CARD-XG4-050 ライドされたまま戻っても【後部バルカン砲】の選択が開かない）", () => {
    const s = returning();
    expectChoiceFrom(s, "player1", "XG4-050");
    expect(choiceIds(s)).toEqual(["SPEC-E-3000:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG4-050:【後部バルカン砲】— 選んだユニットは撃破される（出典: atwiki/page-2075「撃破してもよい」）（既知の不具合: CARD-XG4-050 ライドされたまま戻っても【後部バルカン砲】の選択が開かない）", () => {
    let s = returning();
    expectChoiceFrom(s, "player1", "XG4-050");
    s = resolveAll(pick(s, "SPEC-E-3000:a"));
    expect(zoneOf(s, "player2", "SPEC-E-3000:a")).toBe("discard");
  });

  it("XG4-050:【後部バルカン砲】— ライドされていなければ発動しない（出典: atwiki/page-2075「ライドされているこのビークルが」）", () => {
    const s = returning(false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG4-050");
  });
});
