/**
 * カード別スペック: XG3-022〜XG3-028（クロスギャザー ザ・Wインパクト アバレッド〜魔導馬バリキオン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG3-」とカード名で検索:
 *     本範囲のカードの項はない（同名の別カード RS-054 アバレッド・RS-114 魔導馬バリキオン・RK-581 の項だけ）。本範囲のカードページに atwiki 転載の公式 Q&A はない。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG3-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST-01・R-CN-02・R-CAT-02・R-RUSH 系）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG3-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  bpOf,
  canEnter,
  canSelfRush,
  canSkip,
  canStartRush,
  choiceIds,
  choiceOf,
  deckCards,
  enter,
  enterAny,
  enteredInEnemyTurn,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectUnitStats,
  inst,
  lineUp,
  pick,
  pickAs,
  PLAIN_VEHICLE,
  powerCards,
  refsOf,
  releasedCat,
  resistTests,
  resolveAll,
  rushBoard,
  rushFromHand,
  selfRush,
  spOf,
  st,
  sUnit,
  useRef,
  zoneOf,
} from "./XG3-022-041.helpers";

const DINO_S = sUnit("SPEC-DINO-S", { category: "WB", bp: 1000, features: ["恐竜"] });
const COST1 = sUnit("SPEC-COST1", { bp: 1000, powerCost: 1 });
const COST2 = sUnit("SPEC-COST2", { bp: 1000, powerCost: "2+" });
const COST3 = sUnit("SPEC-COST3", { bp: 1000, powerCost: 3 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const DA3 = sUnit("SPEC-DA3", { category: "DA", bp: 1000, features: ["男", "怪人", "メカ"] });
const DA2 = sUnit("SPEC-DA2", { category: "DA", bp: 1000, features: ["男", "怪人"] });
const DA3_COND = sUnit("SPEC-DA3-COND", {
  category: "DA",
  bp: 1000,
  features: ["男", "怪人", "メカ"],
  powerCost: "1+",
  rushAdditionalCondition: { conditionId: "discard_named_unit", text: "自軍「SPEC-NONE」1体を捨札にする", partnerName: "SPEC-NONE", unitCount: 1 } as never,
});
const DA3_M = sUnit("SPEC-DA3-M", { category: "DA", bp: 3000, size: "M", features: ["男", "怪人", "メカ"] });
const DA_L = sUnit("SPEC-DA-L", { category: "DA", bp: 13000, size: "L", powerCost: 9 });
const DA_L_COND = sUnit("SPEC-DA-L-COND", {
  category: "DA",
  bp: 13000,
  size: "L",
  powerCost: "6+",
  rushAdditionalCondition: { conditionId: "discard_named_unit", text: "自軍「SPEC-NONE」1体を捨札にする", partnerName: "SPEC-NONE", unitCount: 1 } as never,
});
const WB_L = sUnit("SPEC-WB-L", { category: "WB", bp: 13000, size: "L", powerCost: 1 });
const MAGIC = sUnit("SPEC-MAGIC", { category: "MA", bp: 1000, features: ["魔法"] });
const EXTRA = [DINO_S, COST1, COST2, COST3, E2000, E3000, E3500, DA3, DA2, DA3_COND, DA3_M, DA_L, DA_L_COND, WB_L, MAGIC, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);
const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const line = (ids: string[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => lineUp(ids, p1, p2, EXTRA);

// ===========================================================================
describe("XG3-022 アバレッド", () => {
  const TEXT = "※レジスト 【アバレイザー】「SP1」特徴「恐竜」を持つ自軍ユニットの数を数え、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破してもよい。";

  it("XG3-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-1898「SP：！」「CN：2」「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-022", TEXT);
    expectStats("XG3-022", { name: "アバレッド", category: "WB", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 2, features: ["レッド", "男"] });
    expectRarityIn("XG3-022", ["NR"]);
  });

  resistTests("XG3-022", "atwiki/page-1898");

  it("XG3-022:【アバレイザー】— 2番目に出れば（NC）「SP1」。1番目なら SP なし（出典: atwiki/page-1898「【アバレイザー】「SP1」」・R-CN-02）", () => {
    expect(spOf(resolveAll(line(["TST-UNIT-0:f", "XG3-022:a"])), "player1", "XG3-022:a")).toBe(1);
    expect(spOf(resolveAll(line(["XG3-022:a"])), "player1", "XG3-022:a")).toBe(0);
  });

  /** 自軍: 恐竜のユニット2体（ラッシュエリア・バトルエリアに1体ずつ）。敵軍: 必要パワー0・1・2+・3 のユニット。 */
  const nc = () =>
    line(["SPEC-DINO-S:d2", "XG3-022:a"], { rush: [inst("SPEC-DINO-S", "d1")] }, {
      battle: [inst("TST-UNIT-0", "c0"), inst("SPEC-COST2", "c2")],
      rush: [inst("SPEC-COST1", "c1"), inst("SPEC-COST3", "c3")],
    });

  it("XG3-022:【アバレイザー】— 特徴「恐竜」を持つ自軍ユニットの数（2）以下の必要パワーの数字を持つ敵軍ユニット（エリア・サイズを問わない。「2+」は2）から選べる（任意）（出典: atwiki/page-1898「その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破してもよい」・カード評価「サイズ、エリアを問わず対象にとれる」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG3-022");
    expect(choiceIds(s)).toEqual(["SPEC-COST1:c1", "SPEC-COST2:c2", "TST-UNIT-0:c0"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG3-022:【アバレイザー】— 選んだユニットを撃破する（出典: atwiki/page-1898）", () => {
    const s = resolveAll(nc(), ["SPEC-COST2:c2"]);
    expect(zoneOf(s, "player2", "SPEC-COST2:c2")).toBe("discard");
  });

  it("XG3-022:【アバレイザー】— 自軍に「恐竜」のユニットがいなければ、必要パワー0のユニットしか選べない（候補がなければ何もしない）（出典: atwiki/page-1898「特徴「恐竜」を持つ自軍ユニットの数を数え」）", () => {
    const s = resolveAll(line(["TST-UNIT-0:f", "XG3-022:a"], {}, { rush: [inst("SPEC-COST1", "c1")] }));
    expect(zoneOf(s, "player2", "SPEC-COST1:c1")).toBe("rush");
  });
});

// ===========================================================================
describe("XG3-023 アバレマックス", () => {
  const TEXT =
    "※レジスト 【大気爆裂マックスフィールド】自軍バトルエリアのユニットがこのユニット1体だけなら、次の効果が有効になる⇒自軍バトルエリアのユニットはBP+2000され、敵軍バトルエリアのユニットはBP-2000される。（BP0以下になったユニットは撃破される）";

  it("XG3-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-1969）", () => {
    expectCatalogText("XG3-023", TEXT);
    expectStats("XG3-023", { name: "アバレマックス", category: "WB", size: "S", bp: 6000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["レッド", "男", "スティライザー"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG3-023", ["SR"]);
  });

  it("XG3-023: 追加条件 — 自軍「アバレッド」（XG3-022・RS-054）1体を捨札にしてラッシュできる。いなければラッシュできない（出典: atwiki/page-1969「追加条件：自軍「アバレッド」1体を捨札にする」）", () => {
    const mk = (rush: ReturnType<typeof inst>[]) => board({ hand: [inst("XG3-023", "am")], rush, power: powerCards(6), command: releasedCat("WB", 1) });
    expect(canStartRush(mk([]), "player1", "XG3-023:am")).toBe(false);
    for (const id of ["XG3-022", "RS-054"]) {
      const r = rushFromHand(mk([inst(id, "ab")]), "player1", "XG3-023:am");
      expect(r.ok, r.error).toBe(true);
      expect(zoneOf(r.state, "player1", "XG3-023:am")).toBe("rush");
      expect(zoneOf(r.state, "player1", `${id}:ab`)).toBe("discard");
    }
  });

  resistTests("XG3-023", "atwiki/page-1969");

  it("XG3-023:【大気爆裂マックスフィールド】— 自軍バトルエリアがこれ1体だけなら、これは BP+2000（8000）、敵軍バトルエリアのユニットは BP-2000（敵軍ラッシュエリアのユニットは変わらない）（出典: atwiki/page-1969「自軍バトルエリアのユニットはBP+2000され、敵軍バトルエリアのユニットはBP-2000される」）", () => {
    const s = battle({ battle: [inst("XG3-023", "am")] }, { battle: [inst("SPEC-E3500", "e")], rush: [inst("SPEC-E3500", "r")] });
    expect(bpOf(s, "player1", "XG3-023:am")).toBe(8000);
    expect(bpOf(s, "player2", "SPEC-E3500:e")).toBe(1500);
    expect(bpOf(s, "player2", "SPEC-E3500:r")).toBe(3500);
  });

  it("XG3-023:【大気爆裂マックスフィールド】— 自軍バトルエリアにほかのユニットがいれば有効にならない（出典: atwiki/page-1969「自軍バトルエリアのユニットがこのユニット1体だけなら」・カード評価「自身以外の自軍ユニットにはBP上昇効果が及ばない」）", () => {
    const s = battle({ battle: [inst("XG3-023", "am"), inst("TST-UNIT-0", "f")] }, { battle: [inst("SPEC-E3500", "e")] });
    expect(bpOf(s, "player1", "XG3-023:am")).toBe(6000);
    expect(bpOf(s, "player2", "SPEC-E3500:e")).toBe(3500);
  });

  it("XG3-023:【大気爆裂マックスフィールド】— 敵軍バトルエリアの BP2000 以下のユニットは BP0 以下になって撃破される（出典: atwiki/page-1969「（BP0以下になったユニットは撃破される）」）", () => {
    let s = line(["XG3-023:am"], {}, { battle: [inst("SPEC-E2000", "e"), inst("SPEC-E3000", "e3")] });
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E2000:e")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3000:e3")).toBe("battle");
  });

  it("XG3-023:【大気爆裂マックスフィールド】— 敵軍ターン中も有効で、敵軍バトルエリアに出た BP2000 のユニットは撃破される（出典: atwiki/page-1969・カード評価「敵軍ターンではBPの低いユニットがバトルエリアに出るのを防ぐ」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("XG3-023", "am")], deck: deckCards(3) }, player2: { rush: [inst("SPEC-E2000", "e")], deck: deckCards(3, "e") } }, EXTRA);
    s = resolveAll(enter(s, "SPEC-E2000:e", "player2"));
    expect(zoneOf(s, "player2", "SPEC-E2000:e")).toBe("discard");
  });
});

// ===========================================================================
/** ミケラ・ヴォッファ（「自軍ラッシュフェイズを行うとき、かわりに」DA のコマンドを3つホールドして山札から出す）の共通テスト。 */
function creationTests(opts: { id: string; name: string; page: string; effect: string; good: string; goodWhy: string; bad: string[]; condUnit: string }) {
  const { id, page } = opts;
  const deck = () => [inst(opts.good, "g"), ...opts.bad.map((b, i) => inst(b, `x${i}`)), inst(opts.condUnit, "cd"), ...deckCards(3)];
  const rushPhaseStart = (cmdN = 3) => board({ rush: [inst(id, "u")], command: releasedCat("DA", cmdN), deck: deck() });

  it(`${id}:【${opts.effect}】— 自軍ラッシュフェイズを行うとき、かわりに発動できる（DA のコマンド3つが必要）（出典: ${page}「自軍ラッシュフェイズを行うとき、かわりに次の効果を発動できる」）`, () => {
    expect(refsOf(rushPhaseStart(), `${id}:u`)).not.toEqual([]);
  });

  it(`${id}:【${opts.effect}】— リリース状態の DA の自軍コマンドが2つしかなければ発動できない（出典: ${page}「DAの自軍コマンドを3つホールドしてから」）`, () => {
    expect(refsOf(rushPhaseStart(2), `${id}:u`)).toEqual([]);
  });

  it(`${id}:【${opts.effect}】— 発動すると DA の自軍コマンド3つをホールドし、自軍山札の${opts.goodWhy}から選べる（追加条件を満たせないカードは選べない。任意）（出典: ${page}「自軍山札を見て、…自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと」）`, () => {
    const s = useRef(rushPhaseStart(), `${id}:u`);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(3);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([`${opts.good}:g`]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}:【${opts.effect}】— 選んだカードを自軍ラッシュエリアに出し、山札をシャッフルする。その後ラッシュフェイズは行わない（手札からラッシュできない）（出典: ${page}「その後、山札をシャッフルする」「かわりに」）`, () => {
    let s = useRef(board({ rush: [inst(id, "u")], hand: [inst("TST-UNIT-0", "h")], command: releasedCat("DA", 4), deck: deck() }), `${id}:u`);
    s = resolveAll(pick(s, `${opts.good}:g`));
    expect(zoneOf(s, "player1", `${opts.good}:g`)).toBe("rush");
    expect(canStartRush(s, "player1", "TST-UNIT-0:h")).toBe(false);
  });
}

describe("XG3-024 創造の使徒ミケラ", () => {
  const TEXT =
    "【トリノイド創造】これが自軍エリアにある間、自軍ラッシュフェイズを行うとき、かわりに次の効果を発動できる⇒DAの自軍コマンドを3つホールドしてから、自軍山札を見て、特徴が3つ以上でDAを持つSユニットのカードを自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG3-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-1899「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-024", TEXT);
    expectStats("XG3-024", { name: "創造の使徒ミケラ", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["男"] });
    expectRarityIn("XG3-024", ["NR"]);
  });

  creationTests({
    id: "XG3-024",
    name: "創造の使徒ミケラ",
    page: "atwiki/page-1899",
    effect: "トリノイド創造",
    good: "SPEC-DA3",
    goodWhy: "特徴が3つ以上で DA を持つ S ユニット（特徴2つ・M ユニット・追加条件を満たせないものは選べない）",
    bad: ["SPEC-DA2", "SPEC-DA3-M", "SPEC-DA3-COND"],
    condUnit: "TST-UNIT-0",
  });
});

describe("XG3-025 無限の使徒ヴォッファ", () => {
  const TEXT =
    "【ギガノイド創造】これが自軍エリアにある間、自軍ラッシュフェイズを行うとき、かわりに次の効果を発動できる⇒DAの自軍コマンドを3つホールドしてから、自軍山札を見て、DAを持つLユニットのカードを自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。その後、山札をシャッフルする。";

  it("XG3-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-1900「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-025", TEXT);
    expectStats("XG3-025", { name: "無限の使徒ヴォッファ", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["男"] });
    expectRarityIn("XG3-025", ["NR"]);
  });

  creationTests({
    id: "XG3-025",
    name: "無限の使徒ヴォッファ",
    page: "atwiki/page-1900",
    effect: "ギガノイド創造",
    good: "SPEC-DA-L",
    goodWhy: "DA を持つ L ユニット（必要パワーは問わない。DA でない L・追加条件を満たせないものは選べない）",
    bad: ["SPEC-WB-L", "SPEC-DA-L-COND", "SPEC-DA3"],
    condUnit: "TST-UNIT-0",
  });
});

// ===========================================================================
describe("XG3-026 マックスオージャ", () => {
  const TEXT =
    "【爆竜必殺マックスショルダーアタック】自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、リリース状態の自軍コマンドが2つ以上あればすべて選びホールドするかを選ぶ。";

  it("XG3-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-1999）", () => {
    expectCatalogText("XG3-026", TEXT);
    expectStats("XG3-026", { name: "マックスオージャ", category: "WB", size: "L", bp: 9000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["恐竜", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG3-026", ["R"]);
  });

  it("XG3-026: 追加条件 — 自軍「スティラコサウルス」1体を捨札にしてラッシュできる（出典: atwiki/page-1999「追加条件：自軍「スティラコサウルス」1体を捨札にする」）", () => {
    const r = rushFromHand(board({ hand: [inst("XG3-026", "o")], rush: [inst("XG3-027", "st")], power: powerCards(6), command: releasedCat("WB", 1) }), "player1", "XG3-026:o");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-026:o")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG3-027:st")).toBe("discard");
  });

  const entered = (enemyCmd: number) => enter(battle({ rush: [inst("XG3-026", "o")] }, { command: releasedCat("WB", enemyCmd, "ec"), power: powerCards(3, "ep") }), "XG3-026:o");

  it("XG3-026:【爆竜必殺マックスショルダーアタック】— 自軍ターン中にバトルエリアに出たとき、相手（リリース状態のコマンドが2つ以上）が「1点ダメージ」か「コマンドをすべてホールド」かを選ぶ（出典: atwiki/page-1999「相手は1点ダメージを受けるか、リリース状態の自軍コマンドが2つ以上あればすべて選びホールドするかを選ぶ」）", () => {
    const s = entered(2);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XG3-026");
    expect(choiceIds(s)).toHaveLength(2);
  });

  it("XG3-026:【爆竜必殺マックスショルダーアタック】— 相手がホールドを選べば、相手のリリース状態のコマンドがすべてホールド状態になる（ダメージは受けない）（出典: atwiki/page-1999「すべて選びホールドする」・カード評価「強力なカウンター封じ」）", () => {
    let s = entered(3);
    const hold = choiceIds(s).find((c) => /hold/.test(c));
    s = resolveAll(pickAs(s, "player2", hold!));
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player2.damage).toBe(0);
  });

  it("XG3-026:【爆竜必殺マックスショルダーアタック】— 相手のリリース状態のコマンドが1つ以下なら、相手は1点ダメージを受ける（出典: atwiki/page-1999「リリース状態の自軍コマンドが2つ以上あれば」）", () => {
    const s = resolveAll(entered(1));
    expect(s.players.player2.damage).toBe(1);
  });

  it("XG3-026:【爆竜必殺マックスショルダーアタック】— 敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-1999「自軍ターン中、」）", () => {
    const s = resolveAll(enteredInEnemyTurn("XG3-026:o", {}, { command: releasedCat("WB", 2, "ec"), power: powerCards(3, "ep") }, EXTRA));
    expect(s.players.player2.damage).toBe(0);
    expect(s.players.player2.command.some((c) => c.commandHeld)).toBe(false);
  });
});

// ===========================================================================
describe("XG3-027 スティラコサウルス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【ファイヤーボールクラッシュ】これをラッシュしたとき、敵軍バトルエリアからBP3000以下のユニットを3体まで選び撃破してもよい。";

  it("XG3-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-1901「レアリティ：ノーマルレア」）", () => {
    expectCatalogText("XG3-027", TEXT);
    expectStats("XG3-027", { name: "スティラコサウルス", category: "WB", size: "L", bp: 7000, sp: undefined, powerCost: "6+", comboNumber: undefined, features: ["恐竜"], rushCondition: "state_gate" });
    expectRarityIn("XG3-027", ["NR"]);
  });

  const rushOf = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushFromHand(board({ hand: [inst("XG3-027", "st")], power: powerCards(6), command: releasedCat("WB", 1), ...p1 }, p2), "player1", "XG3-027:st");

  it("XG3-027: 追加条件 — 特徴「スティライザー」を持つ自軍ユニット（アバレマックス）があればラッシュできる（捨札にしない）。どちらもなければラッシュできない（出典: atwiki/page-1901「追加条件：特徴「スティライザー」を持つ、自軍ユニットまたは自軍コマンドがある」）", () => {
    expect(canStartRush(board({ hand: [inst("XG3-027", "st")], power: powerCards(6), command: releasedCat("WB", 1) }), "player1", "XG3-027:st")).toBe(false);
    const r = rushOf({ rush: [inst("XG3-023", "am")] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG3-023:am")).toBe("rush");
  });

  it("XG3-027: 追加条件 — 特徴「スティライザー」を持つ自軍コマンド（コマンドゾーンのアバレマックス）があってもラッシュできる（出典: atwiki/page-1901「自軍ユニットまたは自軍コマンドがある」）", () => {
    const r2 = rushOf({ command: [...releasedCat("WB", 1), inst("XG3-023", "cmd")] });
    expect(r2.ok, r2.error).toBe(true);
    expect(zoneOf(r2.state, "player1", "XG3-027:st")).toBe("rush");
  });

  it("XG3-027: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1901）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-027", "st")] }), "XG3-027:st")).toBe(false);
    expect(zoneOf(enterAny(battle({ rush: [inst("XG3-027", "st")], command: releasedCat("WB", 1) }), "XG3-027:st"), "player1", "XG3-027:st")).toBe("battle");
  });

  const enemy = () => ({ battle: [inst("TST-UNIT-0", "e1"), inst("SPEC-E3000", "e2"), inst("SPEC-E2000", "e3"), inst("SPEC-E2000", "e4"), inst("SPEC-E3500", "big")], rush: [inst("TST-UNIT-0", "r")] });

  it("XG3-027:【ファイヤーボールクラッシュ】— ラッシュしたとき、敵軍バトルエリアの BP3000 以下のユニットから選べる（BP3500・ラッシュエリアのユニットは選べない。任意）（出典: atwiki/page-1901「敵軍バトルエリアからBP3000以下のユニットを3体まで選び撃破してもよい」）", () => {
    const r = rushOf({ rush: [inst("XG3-023", "am")] }, enemy());
    expectChoiceFrom(r.state, "player1", "XG3-027");
    expect(choiceIds(r.state)).toEqual(["SPEC-E2000:e3", "SPEC-E2000:e4", "SPEC-E3000:e2", "TST-UNIT-0:e1"]);
    expect(canSkip(r.state)).toBe(true);
  });

  it("XG3-027:【ファイヤーボールクラッシュ】— 3体まで選んで撃破する（4体目は選べない）（出典: atwiki/page-1901「3体まで選び撃破してもよい」）", () => {
    const r = rushOf({ rush: [inst("XG3-023", "am")] }, enemy());
    const s = resolveAll(r.state, ["TST-UNIT-0:e1", "SPEC-E3000:e2", "SPEC-E2000:e3", "confirm"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3000:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2000:e4")).toBe("battle");
  });
});

// ===========================================================================
describe("XG3-028 魔導馬バリキオン", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【荒ぶる駿馬】これが自分の手札にある間、自軍ラッシュフェイズ中、「魔導馬バリキオン」以外の特徴「魔法」を持つ自軍ユニットがあれば、これをラッシュエリアに出してもよい。";

  it("XG3-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-1902）", () => {
    expectCatalogText("XG3-028", TEXT);
    expectUnitStats("XG3-028", { name: "魔導馬バリキオン", category: ["MA", "DA"], size: "M", bp: 4000, sp: undefined, powerCost: 2, comboNumber: undefined, features: ["魔法"] });
    expectRarityIn("XG3-028", ["N"]);
  });

  it("XG3-028: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（出典: atwiki/page-1902）", () => {
    expect(canEnter(battle({ rush: [inst("XG3-028", "b")] }), "XG3-028:b")).toBe(false);
    expect(zoneOf(enterAny(battle({ rush: [inst("XG3-028", "b")], command: releasedCat("MA", 1) }), "XG3-028:b"), "player1", "XG3-028:b")).toBe("battle");
  });

  it("XG3-028:【荒ぶる駿馬】— 自軍ラッシュフェイズ中、「魔導馬バリキオン」以外の特徴「魔法」を持つ自軍ユニットがあれば、手札のこれをラッシュエリアに出せる（コマンド・パワーは要らない）（出典: atwiki/page-1902「これが自分の手札にある間、…これをラッシュエリアに出してもよい」・カード評価「コマンドを無視できる」）", () => {
    let s = board({ hand: [inst("XG3-028", "b")], rush: [inst("SPEC-MAGIC", "m")] });
    expect(canSelfRush(s, "hand", "XG3-028:b")).toBe(true);
    s = resolveAll(selfRush(s, "hand", "XG3-028:b"));
    expect(zoneOf(s, "player1", "XG3-028:b")).toBe("rush");
  });

  it("XG3-028:【荒ぶる駿馬】— 自軍の「魔法」のユニットがほかの「魔導馬バリキオン」だけなら出せない（出典: atwiki/page-1902「「魔導馬バリキオン」以外の特徴「魔法」を持つ自軍ユニットがあれば」）", () => {
    const s = board({ hand: [inst("XG3-028", "b")], rush: [inst("RS-114", "b2")] });
    expect(canSelfRush(s, "hand", "XG3-028:b")).toBe(false);
    expect(choiceOf(s, "player1", "XG3-028")).toBe(false);
  });

  it("XG3-028:【荒ぶる駿馬】— 自軍バトルフェイズ中は出せない（出典: atwiki/page-1902「自軍ラッシュフェイズ中」）", () => {
    expect(canSelfRush(battle({ hand: [inst("XG3-028", "b")], rush: [inst("SPEC-MAGIC", "m")] }), "hand", "XG3-028:b")).toBe(false);
  });
});
