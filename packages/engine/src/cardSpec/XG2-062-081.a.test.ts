/**
 * カード別スペック: XG2-062〜XG2-068（クロスギャザー ザ・ドラゴンタイガー 仮面ライダー装甲響鬼〜リュウタロス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-062」〜「XG2-068」とカード名で検索）。atwiki に転載された公式 Q&A も本範囲にはない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-KW-MORPH-01〜03・R-ADD-02・R-ZONE-08・02-zones-cards「ホールド状態でもバトルエリアに出られる」）・
 *     atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - XG2-064 カブトMF【キャストオフ】の選択が開くことは rules/castoff.test.ts・castoffRealAction.test.ts・castoffChain.test.ts、
 *    XG2-066 カブトRF【ライダーキック】の基本の流れは rules/riderKickEffects.test.ts、XG2-068 リュウタロスの ※ は rules/imaginDestroyOnEnter.test.ts。
 */
import { describe, expect, it } from "vitest";
import {
  actionsWith,
  attack,
  attackTargets,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canEndPhase,
  canHoldPay,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enemyTurn,
  enter,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  faceDownCard,
  heldUnit,
  holdPay,
  inst,
  isDamageIn,
  isHeld,
  lastBattleBps,
  morphCandidates,
  morphRush,
  ncEnter,
  p1Battle,
  pick,
  pickAs,
  PLAIN_VEHICLE,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resident,
  resolveAll,
  rushBoard,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  withStacked,
  zoneOf,
} from "./XG2-062-081.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const B3000 = sUnit("SPEC-B3000", { bp: 3000 });
const ACCEL = sUnit("SPEC-ACCEL", { bp: 13000, features: ["加速"] });
const EXTRA = [C1, C2, C3, C4, C5, B3000, ACCEL, PLAIN_VEHICLE];

// ===========================================================================
describe("XG2-062 仮面ライダー装甲響鬼", () => {
  const TEXT =
    "※レジスト 【鬼神覚声】自軍ターン中、これがバトルエリアに出たとき、これをホールドするかリリースしてもよい。そうしたとき、必要パワーの数字が4以下の敵軍ユニットを１体選び、持ち主のパワーゾーンへダメージにして置く。";

  it("XG2-062: カタログ本文・スペックが出典と一致（出典: atwiki/page-1855）", () => {
    expectCatalogText("XG2-062", TEXT);
    expectUnit("XG2-062", { name: "仮面ライダー装甲響鬼", category: "MA", size: "S", bp: 6000, sp: "1/3", powerCost: "6+", features: ["仮面ライダー", "男", "猛士", "装甲声刃"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG2-062", ["SR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 6) => rushBoard({ hand: [inst("XG2-062", "h")], rush, power: powerCards(power), command: releasedCat("MA", 1) });

  it("XG2-062: 追加条件 — 自軍「仮面ライダー響鬼」（XG2-063）1体を捨札にし、パワー6でラッシュできる。パワー5ではできない（出典: atwiki/page-1855「必要パワー：6+」「追加条件：自軍「仮面ライダー響鬼」1体を捨札する」）", () => {
    const r = rushFromHand(board([inst("XG2-063", "hb")]), "player1", "XG2-062:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-062:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-063:hb")).toBe("discard");
    expect(canStartRush(board([inst("XG2-063", "hb")], 5), "player1", "XG2-062:h")).toBe(false);
  });

  it("XG2-062: 追加条件 — 「仮面ライダー響鬼」がいなければラッシュできない（出典: atwiki/page-1855）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-062:h")).toBe(false);
  });

  it("XG2-062: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-1855「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-062", "u")] }, "XG2-062:u"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C4", "e4"), inst("SPEC-C5", "e5")], rush: [inst("SPEC-C2", "e2")] };
  const entered = () => ncEnter("XG2-062:ah", 0, {}, enemy, EXTRA);

  it("XG2-062: 【鬼神覚声】自軍ターン中にバトルエリアに出たとき、発動するかを選べる（任意）（出典: atwiki/page-1855「これをホールドするかリリースしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-062");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-062: 【鬼神覚声】選べるのは必要パワーの数字が4以下の敵軍ユニット（バトルエリアの必要パワー4・ラッシュエリアの必要パワー2）。必要パワー5は選べない（出典: atwiki/page-1855「必要パワーの数字が4以下の敵軍ユニットを１体選び」・カード評価「エリア･サイズを問わず、パワー4と幅広く対象に取れる」）", () => {
    const s = entered();
    expect(choiceIds(s).sort()).toEqual(["SPEC-C2:e2", "SPEC-C4:e4"]);
  });

  it("XG2-062: 【鬼神覚声】リリース状態で出たときは、これをホールドしてから、選んだユニットを持ち主のパワーゾーンへダメージ（ウラ向き）にして置く（出典: atwiki/page-1855「これをホールドするかリリースしてもよい。そうしたとき、…持ち主のパワーゾーンへダメージにして置く」）", () => {
    const s = resolveAll(entered(), ["SPEC-C4:e4"]);
    expect(isHeld(s, "player1", "XG2-062:ah")).toBe(true);
    expect(isDamageIn(s, "player2", "SPEC-C4:e4")).toBe(true);
  });

  it("XG2-062: 【鬼神覚声】ホールド状態でバトルエリアに出たときは、これをリリースして発動できる（出典: atwiki/page-1855「これをホールドするかリリースしてもよい」・カード評価「ホールドからリリースしても効果の発動ができる」・02-zones-cards「ホールド状態でもバトルエリアに出られる」）", () => {
    const s0 = p1Battle({ rush: [heldUnit("XG2-062", "ah")] }, { battle: [inst("SPEC-C3", "e3")] }, EXTRA);
    const s = resolveAll(enter(s0, "XG2-062:ah"), ["SPEC-C3:e3"]);
    expect(isHeld(s, "player1", "XG2-062:ah")).toBe(false);
    expect(isDamageIn(s, "player2", "SPEC-C3:e3")).toBe(true);
  });

  it("XG2-062: 【鬼神覚声】発動しないことを選べば、敵軍ユニットはそのまま（出典: atwiki/page-1855「してもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(zoneOf(s, "player2", "SPEC-C4:e4")).toBe("battle");
    expect(isHeld(s, "player1", "XG2-062:ah")).toBe(false);
  });

  it("XG2-062: 【鬼神覚声】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1855「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG2-062:ah", {}, { battle: [inst("SPEC-C3", "e3")] }, EXTRA);
    expect(zoneOf(s, "player1", "XG2-062:ah")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-062");
  });
});

// ===========================================================================
describe("XG2-063 仮面ライダー響鬼", () => {
  const TEXT =
    "※レジスト 【鬼幻術・鬼火】これが自軍エリアにある間、自軍バトルフェイズ中、敵軍ユニットがラッシュされたとき、これをホールドしてもよい。そうしたとき、ラッシュされたユニットを持ち主のパワーゾーンにダメージにして置く。";

  it("XG2-063: カタログ本文・スペックが出典と一致（出典: atwiki/page-1770）", () => {
    expectCatalogText("XG2-063", TEXT);
    expectUnit("XG2-063", { name: "仮面ライダー響鬼", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 2, features: ["仮面ライダー", "男", "猛士"] });
    expectRarityIn("XG2-063", ["N"]);
  });

  it("XG2-063: ※レジスト — バトルで撃破されるとき、レジストが使える（出典: atwiki/page-1770「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-063", "u")] }, "XG2-063:u"))).toBe(true);
  });

  /** 自軍バトルフェイズに RS-284 ホワイトスワン（CN3）【スワンウィング】で敵軍コマンドゾーンの S ユニットのカードを敵軍ラッシュエリアに出す。響鬼は自軍ラッシュエリア。 */
  const swan = () => {
    const s = p1Battle({ battle: [inst("TST-UNIT-0", "f0"), inst("TST-UNIT-0", "f1")], rush: [inst("XG2-063", "hb"), inst("RS-284", "sw")] }, { command: [released("SPEC-C4", "ce")] }, EXTRA);
    return pick(enter(s, "RS-284:sw"), "swan_wing_deploy_enemy_command_s");
  };

  it("XG2-063: 前提 — ホワイトスワン【スワンウィング】で、敵軍コマンドゾーンの S ユニットのカードが敵軍ラッシュエリアに出る（出典: RS-284 本文）", () => {
    expect(zoneOf(swan(), "player2", "SPEC-C4:ce")).toBe("rush");
  });

  it("XG2-063: 【鬼幻術・鬼火】自軍バトルフェイズ中に敵軍ユニットがラッシュされたとき、自軍ラッシュエリアにあるこれをホールドするかを選べる（任意）（出典: atwiki/page-1770「これが自軍エリアにある間、自軍バトルフェイズ中、敵軍ユニットがラッシュされたとき、これをホールドしてもよい」・カード評価「ズ・バヅー・バ…のような敵ユニットを場に出す能力と相性がよい」）", () => {
    const s = swan();
    expectChoiceFrom(s, "player1", "XG2-063");
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-063: 【鬼幻術・鬼火】ホールドすると、ラッシュされたユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1770「そうしたとき、ラッシュされたユニットを持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(swan(), ["hold", "XG2-063:hb"]);
    expect(isHeld(s, "player1", "XG2-063:hb")).toBe(true);
    expect(isDamageIn(s, "player2", "SPEC-C4:ce")).toBe(true);
  });

  it("XG2-063: 【鬼幻術・鬼火】敵軍ターンのラッシュ（自軍バトルフェイズ以外）では発動しない（出典: atwiki/page-1770「自軍バトルフェイズ中、」）", () => {
    const s = settle(morphRush({ rush: [inst("XG2-063", "hb")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-063");
    expect(zoneOf(s, "player2", "SPEC-MORPH-RUSHER:e")).toBe("rush");
  });
});

// ===========================================================================
describe("XG2-064 仮面ライダーカブトMF", () => {
  const TEXT =
    "※これはアタックされるときBP+3000される。 【キャストオフ】これをラッシュしたとき、OTを持つ自軍コマンドを1つホールドして次の効果を発動できる⇒自軍山札を見て「仮面ライダーカブトRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG2-064: カタログ本文・スペックが出典と一致（出典: atwiki/page-1747）", () => {
    expectCatalogText("XG2-064", TEXT);
    expectUnit("XG2-064", { name: "仮面ライダーカブトMF", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 1, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG2-064", ["N"]);
  });

  it("XG2-064: ※ アタックされるときは BP+3000（4000）され、BP3000 のユニットとのバトルに勝つ。ふだんの BP は1000（出典: atwiki/page-1747「これはアタックされるときBP+3000される」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { battle: [inst("XG2-064", "mf")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-B3000", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    expect(bpOf(s0, "player1", "XG2-064:mf")).toBe(1000);
    const s = resolveAll(settle(attack(s0, "SPEC-B3000:atk", "XG2-064:mf", "player2")));
    expect(lastBattleBps(s)?.defender).toBe(4000);
    expect(zoneOf(s, "player1", "XG2-064:mf")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-B3000:atk")).toBe("discard");
  });

  const rushed = (command = releasedCat("OT", 2)) =>
    rushFromHand(rushBoard({ hand: [inst("XG2-064", "mf")], deck: [inst("XG2-066", "rf"), inst("TST-UNIT-0", "u"), ...deckCards(3)], power: powerCards(1), command }), "player1", "XG2-064:mf").state;

  it("XG2-064: 【キャストオフ】ラッシュしたとき、OT を持つ自軍コマンドを1つホールドして発動できる（任意）（出典: atwiki/page-1747「OTを持つ自軍コマンドを1つホールドして次の効果を発動できる」）", () => {
    const s = rushed();
    expect(canHoldPay(s, "XG2-064:mf")).toBe(true);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-064: 【キャストオフ】自軍山札から「仮面ライダーカブトRF」だけを選べ、追加条件（これをパワーゾーンに送る）を満たして自軍ラッシュエリアに出す（出典: atwiki/page-1747「自軍山札を見て「仮面ライダーカブトRF」のカードを1枚選び自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと」・カード評価「パワー加速とデッキ圧縮を同時に行う」）", () => {
    let s = holdPay(rushed(), "XG2-064:mf");
    expect(choiceIds(s)).toEqual(["XG2-066:rf"]);
    s = resolveAll(pick(s, "XG2-066:rf"));
    expect(zoneOf(s, "player1", "XG2-066:rf")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-064:mf")).toBe("power");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("deck");
  });

  it("XG2-064: 【キャストオフ】ラッシュでホールドしたほかに、リリース状態の OT のコマンドがなければ発動できない（出典: atwiki/page-1747「OTを持つ自軍コマンドを1つホールドして」）", () => {
    const s = rushed(releasedCat("OT", 1));
    expect(canHoldPay(s, "XG2-064:mf")).toBe(false);
    expect(zoneOf(s, "player1", "XG2-066:rf")).toBe("deck");
  });
});

// ===========================================================================
describe("XG2-065 仮面ライダーカブトHF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ハイパークロックアップ】これは、自軍常駐置き場にカードが5枚以上あるとき、次の能力を得る⇒特徴「加速」を持たないユニットにアタックされない。";

  it("XG2-065: カタログ本文・スペックが出典と一致（出典: atwiki/page-895）", () => {
    expectCatalogText("XG2-065", TEXT);
    expectUnit("XG2-065", { name: "仮面ライダーカブトHF", category: "OT", size: "S", bp: 4000, sp: 1, powerCost: "7+", features: ["仮面ライダー", "男", "加速"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG2-065", ["SR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 7) => rushBoard({ hand: [inst("XG2-065", "hf")], rush, power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-065: 追加条件 — 自軍「仮面ライダーカブトRF」（XG2-066）1枚をパワーゾーンに送り、パワー7でラッシュできる。パワー6ではできない（出典: atwiki/page-895「必要パワー：7+」「追加条件：自軍「仮面ライダーカブトRF」1枚をパワーゾーンに送る」）", () => {
    const r = rushFromHand(board([inst("XG2-066", "rf")]), "player1", "XG2-065:hf");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-066:rf")).toBe("power");
    expect(canStartRush(board([inst("XG2-066", "rf")], 6), "player1", "XG2-065:hf")).toBe(false);
  });

  it("XG2-065: 追加条件 — 「※これは「仮面ライダーカブトRF」としてつかえる」ディケイド カブトRF（XG1-070・XG4-079）でも満たす（出典: atwiki/page-895「自軍「仮面ライダーカブトRF」1枚をパワーゾーンに送る」、atwiki/page-1668 Q1「としてつかえる」は全ての場で常に有効）", () => {
    for (const id of ["XG1-070", "XG4-079"]) {
      const r = rushFromHand(board([inst(id, "dk")]), "player1", "XG2-065:hf");
      expect(r.ok, `${id}: ${r.error}`).toBe(true);
      expect(zoneOf(r.state, "player1", `${id}:dk`)).toBe("power");
    }
  });

  it("XG2-065: 追加条件 — 「仮面ライダーカブトRF」以外のユニットでは満たさない（出典: atwiki/page-895「自軍「仮面ライダーカブトRF」1枚をパワーゾーンに送る」）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-065:hf")).toBe(false);
  });

  it("XG2-065: ※ 相手の効果（RS-687 ギンガイオー【ガルコンボーガン】）では選ばれない（出典: atwiki/page-895「これはアタックされる以外では相手に選ばれない」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("XG2-065", "hf"), inst("TST-UNIT-0", "ctl")], deck: deckCards(3) }, player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") } });
    s = enter(s, "RS-687:gg", "player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ctl"]);
  });

  const attacked = (residents: ReturnType<typeof inst>[], attacker = "TST-UNIT-7:atk") => {
    const [ac, as] = attacker.split(":") as [string, string];
    const s = st({ activePlayer: "player2", player1: { battle: [inst("XG2-065", "hf")], operation: residents, deck: deckCards(3) }, player2: { battle: [inst(ac, as)], deck: deckCards(3, "e") } }, EXTRA);
    return attackTargets(s, attacker, "player2");
  };
  const residents = (n: number) => Array.from({ length: n }, (_, i) => resident("TST-OP", `res${i}`));

  it("XG2-065: 【ハイパークロックアップ】自軍常駐置き場にカードが5枚あると、特徴「加速」を持たないユニットにアタックされない（出典: atwiki/page-895「自軍常駐置き場にカードが5枚以上あるとき、…特徴「加速」を持たないユニットにアタックされない」）", () => {
    expect(attacked(residents(5))).toEqual([]);
  });

  it("XG2-065: 【ハイパークロックアップ】特徴「加速」を持つユニットにはアタックされる。常駐置き場が4枚なら「加速」を持たないユニットにもアタックされる（出典: atwiki/page-895）", () => {
    expect(attacked(residents(5), "SPEC-ACCEL:atk")).toEqual(["XG2-065:hf"]);
    expect(attacked(residents(4))).toEqual(["XG2-065:hf"]);
  });

  it("XG2-065: 【ハイパークロックアップ】常駐オペレーションに重ねたカードも常駐置き場のカードとして数える（常駐1枚＋重ねた4枚で5枚）（出典: atwiki/page-895 カード評価「クロックアップで重ねるカードを稼ぎやすい」・XG2-questions Q6）", () => {
    expect(attacked([resident("TST-OP", "res", [inst("TST-OP", "a"), inst("TST-OP", "b"), inst("TST-OP", "c"), inst("TST-OP", "d")])])).toEqual([]);
  });

  it("XG2-065: 【ハイパークロックアップ】タッグの常駐も数える — タッグ2枚（RK-242・PK-011）＋重ねた3枚で5枚ならアタックされず、重ねたのが2枚（4枚）ならアタックされる（出典: 利用者の決定 2026-10-20・questions-all.md U-8「タッグ常駐も数える」・R-KW-TAG-01）", () => {
    expect(attacked([resident("RK-242", "t1", [inst("TST-OP", "a"), inst("TST-OP", "b")]), resident("PK-011", "t2", [inst("TST-OP", "c")])])).toEqual([]);
    expect(attacked([resident("RK-242", "t1", [inst("TST-OP", "a")]), resident("PK-011", "t2", [inst("TST-OP", "c")])])).toEqual(["XG2-065:hf"]);
  });
});

// ===========================================================================
describe("XG2-066 仮面ライダーカブトRF", () => {
  const TEXT =
    "※これはアタックされる以外では相手に選ばれない。 【ライダーキック】自軍ターン中、これがバトルエリアに出たとき、必要パワーの数字が「1」「2」「3」のオモテ向きの自軍パワーがそれぞれあるなら、その中から1枚選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」";

  it("XG2-066: カタログ本文・スペックが出典と一致（出典: atwiki/page-1771）", () => {
    expectCatalogText("XG2-066", TEXT);
    expectUnit("XG2-066", { name: "仮面ライダーカブトRF", category: "OT", size: "S", bp: 2500, sp: "1/4", powerCost: "7-", features: ["仮面ライダー", "男", "加速"], rushCondition: "zord_down_send_to_power" });
    expectRarityIn("XG2-066", ["NR"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power: number) => rushBoard({ hand: [inst("XG2-066", "h")], rush, power: powerCards(power), command: releasedCat("OT", 1) });

  it("XG2-066: 追加条件 — 自軍「仮面ライダーカブトMF」（XG2-064）1枚をパワーゾーンに送れば必要パワー0でラッシュできる（出典: atwiki/page-1771「自軍「仮面ライダーカブトMF」1枚をパワーゾーンに送れば必要パワー0になる」）", () => {
    const r = rushVia(board([inst("XG2-064", "mf")], 0), "player1", "XG2-066:h", (a) => a.zordMaterialInstanceId === "XG2-064:mf");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-066:h")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-064:mf")).toBe("power");
  });

  it("XG2-066: 必要パワー7- — 「仮面ライダーカブトMF」がいなければパワー7でラッシュでき、6ではできない（出典: atwiki/page-1771「必要パワー：7-」・R-ADD-02）", () => {
    expect(canStartRush(board([], 7), "player1", "XG2-066:h")).toBe(true);
    expect(canStartRush(board([], 6), "player1", "XG2-066:h")).toBe(false);
  });

  it("XG2-066: ※ 相手の効果（RS-687 ギンガイオー【ガルコンボーガン】）では選ばれない（出典: atwiki/page-1771「これはアタックされる以外では相手に選ばれない」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("XG2-066", "rf"), inst("TST-UNIT-0", "ctl")], deck: deckCards(3) }, player2: { rush: [inst("RS-687", "gg")], deck: deckCards(3, "e") } });
    s = enter(s, "RS-687:gg", "player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:ctl"]);
  });

  const kick = (power: ReturnType<typeof inst>[]) => ncEnter("XG2-066:rf", 0, { power }, {}, EXTRA);
  const P123 = () => [inst("SPEC-C1", "p1"), inst("SPEC-C2", "p2"), inst("SPEC-C3", "p3"), inst("TST-P", "p0")];

  it("XG2-066: 【ライダーキック】必要パワーの数字が1・2・3のオモテ向きの自軍パワーがそろっていれば、その中から1枚選べる（任意）（出典: atwiki/page-1771「…それぞれあるなら、その中から1枚選び捨札にしてもよい」）", () => {
    const s = kick(P123());
    expectChoiceFrom(s, "player1", "XG2-066");
    expect(choiceIds(s).sort()).toEqual(["SPEC-C1:p1", "SPEC-C2:p2", "SPEC-C3:p3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG2-066: 【ライダーキック】選んだカードは捨札になり、このターン「SP1」になる（1番目でもストライクで1点）（出典: atwiki/page-1771「そうしたとき、このターン、これは次の能力を得る⇒「SP1」」）", () => {
    const s0 = kick(P123());
    expect(spOf(s0, "player1", "XG2-066:rf")).toBe(0);
    const s = resolveAll(pick(s0, "SPEC-C2:p2"));
    expect(zoneOf(s, "player1", "SPEC-C2:p2")).toBe("discard");
    expect(spOf(s, "player1", "XG2-066:rf")).toBe(1);
  });

  it("XG2-066: 【ライダーキック】数字3のパワーがウラ向き（ダメージ）なら、そろっていないので発動しない（出典: atwiki/page-1771「オモテ向きの自軍パワー」）", () => {
    const s = kick([inst("SPEC-C1", "p1"), inst("SPEC-C2", "p2"), faceDownCard("SPEC-C3", "p3")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-066");
  });

  it("XG2-066: 【ライダーキック】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1771「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("XG2-066:rf", { power: P123() }, {}, EXTRA);
    expect(zoneOf(s, "player1", "XG2-066:rf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-066");
  });
});

// ===========================================================================
describe("XG2-067 仮面ライダー電王GF", () => {
  const TEXT =
    "※モーフ ※このユニットの下にオモテ向きの「リュウタロス」のカードが重なっている間、これは「SP1」になる。 【邪魔するなら撃つよ】これがバトルエリアに出たとき、BP3000のユニットを1体選び撃破する。";

  it("XG2-067: カタログ本文・スペックが出典と一致（出典: atwiki/page-1772）", () => {
    expectCatalogText("XG2-067", TEXT);
    expectUnit("XG2-067", { name: "仮面ライダー電王GF", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 6, features: ["仮面ライダー", "男", "DEN-O"] });
    expectRarityIn("XG2-067", ["N"]);
  });

  it("XG2-067: ※モーフ — 敵軍ユニットが通常のラッシュをされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（RK-072 電王GF）と置き換えられる。特徴が違うもの（XG2-066）は選べない（出典: atwiki/page-1772「※モーフ」・カード評価「特徴に2ndを持たない初期の「DEN-O」にモーフすることができる」・R-KW-MORPH-01〜03）", () => {
    const s = morphRush({ battle: [inst("XG2-067", "me")], command: [released("RK-072", "pt"), released("XG2-066", "ot")] });
    expect(morphCandidates(s)).toEqual(["RK-072:pt"]);
    const t = settle(pickAs(s, "player1", "RK-072:pt"));
    expect(zoneOf(t, "player1", "RK-072:pt")).toBe("battle");
    expect(zoneOf(t, "player1", "XG2-067:me")).toBe("command");
  });

  it("XG2-067: ※ 下にオモテ向きの「リュウタロス」のカードが重なっている間は「SP1」（1番目でもストライクで1点）（出典: atwiki/page-1772「このユニットの下にオモテ向きの「リュウタロス」のカードが重なっている間、これは「SP1」になる」・カード評価「リュウタロス（XG2）を重ねればSP1になりストライカーとして使える」）", () => {
    const s = p1Battle({ battle: [withStacked(inst("XG2-067", "gf"), [inst("XG2-068", "ry")])] });
    expect(spOf(s, "player1", "XG2-067:gf")).toBe(1);
  });

  const shot = () =>
    ncEnter("XG2-067:gf", 0, { battle: [inst("SPEC-B3000", "mine")] }, { battle: [inst("SPEC-B3000", "en"), inst("TST-UNIT-0", "e1")], rush: [inst("SPEC-B3000", "er")] }, EXTRA);

  it("XG2-067: 【邪魔するなら撃つよ】バトルエリアに出たとき、BP3000 のユニットを敵軍・自軍・エリアを問わず1体選ぶ（必ず。BP1000 は選べない）（出典: atwiki/page-1772「BP3000のユニットを1体選び撃破する」・カード評価「BP3000のユニットを敵味方関わりなく撃破してしまう」）", () => {
    const s = shot();
    expectChoiceFrom(s, "player1", "XG2-067");
    expect(choiceIds(s).sort()).toEqual(["SPEC-B3000:en", "SPEC-B3000:er", "SPEC-B3000:mine"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG2-067: 【邪魔するなら撃つよ】選んだユニットを撃破する（出典: atwiki/page-1772）", () => {
    const s = resolveAll(shot(), ["SPEC-B3000:er"]);
    expect(zoneOf(s, "player2", "SPEC-B3000:er")).toBe("discard");
  });

  it("XG2-067: 【邪魔するなら撃つよ】「自軍ターン中」の限定がないので、敵軍ターン中にモーフでバトルエリアに出たときも発動する（出典: atwiki/page-1772・コメント欄「効果はターンを問わないならモーフで出たときに使ってもいい」）", () => {
    // モーフを持つ XG5-073 電王SF（特徴が完全一致）から、敵軍ターン中にこれへモーフする。
    const s = morphRush({ battle: [inst("XG5-073", "me"), inst("SPEC-B3000", "mine")], command: [released("XG2-067", "gf")] }, EXTRA);
    const t = pickAs(s, "player1", "XG2-067:gf");
    expect(zoneOf(t, "player1", "XG2-067:gf")).toBe("battle");
    expectChoiceFrom(t, "player1", "XG2-067");
  });
});

// ===========================================================================
describe("XG2-068 リュウタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【憑依】自軍ラッシュフェイズ中、ライドしていない自軍Sユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒これが自軍バトルエリアにある間、すべての敵軍Sユニットは、可能ならバトルエリアに出る。";

  it("XG2-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-1773）", () => {
    expectCatalogText("XG2-068", TEXT);
    expectUnit("XG2-068", { name: "リュウタロス", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 5, features: ["イマジン"] });
    expectRarityIn("XG2-068", ["N"]);
  });

  it("XG2-068: ※ バトルエリアに出たとき撃破される（出典: atwiki/page-1773「これはバトルエリアに出たとき撃破される」）", () => {
    const s = resolveAll(settle(enter(p1Battle({ rush: [inst("XG2-068", "ry")] }), "XG2-068:ry")));
    expect(zoneOf(s, "player1", "XG2-068:ry")).toBe("discard");
  });

  it("XG2-068: 【憑依】自軍ラッシュフェイズ中、ライドしていない自軍 S ユニットを1体選び、これに重ねる手がある（任意）（出典: atwiki/page-1773「自軍ラッシュフェイズ中、ライドしていない自軍Sユニットを1体選び、このユニットに重ねてもよい」）", () => {
    const s = rushBoard({ rush: [inst("XG2-068", "ry"), inst("TST-UNIT-0", "u")] });
    expect(actionsWith(s, "XG2-068:ry")).not.toEqual([]);
  });

  /** 自軍バトルエリアに、下にリュウタロスが重なった TST-UNIT-0。 */
  const host = () => withStacked(inst("TST-UNIT-0", "host"), [inst("XG2-068", "ry")]);

  it("XG2-068: 【憑依】重ねたユニットが自軍バトルエリアにある間、敵軍 S ユニットは可能ならバトルエリアに出る（敵軍ラッシュエリアに S ユニットがあると、敵軍はバトルフェイズを終えられない）（出典: atwiki/page-1773「すべての敵軍Sユニットは、可能ならバトルエリアに出る」・カード評価「重ねたユニットは擬似帝王アトンと化する」）", () => {
    const s = enemyTurn({ battle: [host()] }, { rush: [inst("TST-UNIT-0", "er")] });
    expect(canEndPhase(s, "player2")).toBe(false);
  });

  it("XG2-068: 【憑依】重ねていなければ、敵軍はラッシュエリアの S ユニットを出さずにフェイズを終えられる（出典: atwiki/page-1773）", () => {
    const s = enemyTurn({ battle: [inst("TST-UNIT-0", "host")] }, { rush: [inst("TST-UNIT-0", "er")] });
    expect(canEndPhase(s, "player2")).toBe(true);
  });

  it("XG2-068: 【憑依】重ねたユニットがユニットでなくなる（撃破される）とき、下のリュウタロスは捨札になる（出典: atwiki/page-1773「重ねたユニットがユニットでなくなるとき捨札になる」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [host()] }, "TST-UNIT-0:host"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:host")).toBe("discard");
    expect(zoneOf(s, "player1", "XG2-068:ry")).toBe("discard");
  });
});
