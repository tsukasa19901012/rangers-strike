/**
 * カード別スペック: XG7-001〜XG7-008（クロスギャザー ザ・ベストパートナー ゴーカイピンク〜黒騎士ヒュウガ×獣装光ギンガレッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider・rider_1〜4）に本範囲のカードの項はない
 *     （「XG7-」とカード名で検索）。atwiki に転載された公式 Q&A（XG7-001 Q1・Q2、XG7-002 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG7-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-CROSS・R-KW-CALL・R-REPL-04 置き換え）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG7-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマル」を SR／R／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attack,
  bpOf,
  callTests,
  canSelfRush,
  canSkip,
  choiceIds,
  crossTests,
  deckCards,
  deckOf,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  expectUnitStats,
  extraHoldTests,
  fill,
  gokaiSwapTests,
  inst,
  lastBattleBps,
  ncBoard,
  p1Battle,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushPhaseOf,
  selfRush,
  settle,
  skip,
  spOf,
  sUnit,
  toPhase,
  vehicleCard,
  zoneOf,
} from "./XG7-001-023.helpers";

const RED_MALE = sUnit("SPEC-RED-MALE", { category: "WB", bp: 1000, features: ["レッド", "男"] });
const GREEN = sUnit("SPEC-GREEN", { category: "WB", bp: 1000, features: ["グリーン"] });
const SILVER = sUnit("SPEC-SILVER", { category: "WB", bp: 1000, features: ["シルバー"] });
const PLAIN_MALE = sUnit("SPEC-PLAIN-MALE", { category: "WB", bp: 1000, features: ["男"] });
const YELLOW_FEMALE = sUnit("SPEC-YELLOW-FEMALE", { category: "WB", bp: 1000, features: ["イエロー", "女"] });
const YELLOW_MALE = sUnit("SPEC-YELLOW-MALE", { category: "WB", bp: 1000, features: ["イエロー", "男"] });
const E_RED_MALE = sUnit("SPEC-E-RED-MALE", { category: "WB", bp: 9000, features: ["レッド", "男"] });
const E_RED = sUnit("SPEC-E-RED", { category: "WB", bp: 1000, features: ["レッド"] });
const E_RED_MALE_M = sUnit("SPEC-E-RED-MALE-M", { category: "WB", bp: 3000, size: "M", features: ["レッド", "男"] });
const BIG = sUnit("SPEC-BIG", { category: "WB", bp: 9000, sp: undefined });
const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, sp: undefined });
const BLACK = sUnit("SPEC-BLACK", { category: "OT", bp: 1000, features: ["ブラック"] });
const BEAST_VEHICLE = vehicleCard("SPEC-BEAST-V", { features: ["獣"] });
const MECHA_VEHICLE = vehicleCard("SPEC-MECHA-V", { features: ["メカ"] });
const DINO = sUnit("SPEC-DINO", { category: "WB", bp: 1000, features: ["恐竜"] });
const DINO_M = sUnit("SPEC-DINO-M", { category: "WB", bp: 5000, size: "M", features: ["恐竜"] });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "WB", bp: 5000, size: "M" });
const EXTRA = [RED_MALE, GREEN, SILVER, PLAIN_MALE, YELLOW_FEMALE, YELLOW_MALE, E_RED_MALE, E_RED, E_RED_MALE_M, BIG, ENEMY, BLACK, BEAST_VEHICLE, MECHA_VEHICLE, DINO, DINO_M, PLAIN_M];

const nc = (id: string, fillers: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  ncBoard(id, fillers, p1, p2, EXTRA);

// ===========================================================================
describe("XG7-001 ゴーカイピンク", () => {
  const TEXT =
    "※これをラッシュしたとき、「ゴーカイピンク」以外のオモテ向きの自軍パワーから、追加条件を持たない、特徴「ピンク」またはホワイトを持つSユニットのカードを1枚選び、これと置き換えてもよい。　【レンジャーキー】自軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードが特徴に色を持つなら自軍パワーゾーンに置き、それ以外なら山札の下に戻す。";

  it("XG7-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-2406）", () => {
    expectCatalogText("XG7-001", TEXT);
    expectStats("XG7-001", { name: "ゴーカイピンク", category: "OT", size: "S", bp: 1000, sp: undefined, powerCost: 3, comboNumber: 1, features: ["ピンク", "女", "宇宙海賊"] });
    expectRarityIn("XG7-001", ["N"]);
  });

  gokaiSwapTests({ id: "XG7-001", name: "ゴーカイピンク", page: "atwiki/page-2406", cost: 3, colors: ["ピンク", "ホワイト"] });

  const key = (top: CardInstance) => nc("XG7-001:g", 0, { deck: [top, ...deckCards(3)] });

  it("XG7-001: 【レンジャーキー】NC — 山札の上から1枚をオモテにするかを選べる（任意）（出典: atwiki/page-2406「自軍山札の上から1枚をオモテにしてもよい」）", () => {
    const s = key(inst("SPEC-RED-MALE", "top"));
    expectChoiceFrom(s, "player1", "XG7-001");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-001: 【レンジャーキー】オモテにしたカードが特徴に色（レッド）を持てば、自軍パワーゾーンに置く（出典: atwiki/page-2406「特徴に色を持つなら自軍パワーゾーンに置き」・Q1） — 既知の不具合: CARD-XG7-001 オモテにしたカードを特徴の色で振り分けない（色を持つカードもパワーゾーンに置かない）", () => {
    const s = resolveAll(key(inst("SPEC-RED-MALE", "top")), ["SPEC-RED-MALE:top"]);
    expect(zoneOf(s, "player1", "SPEC-RED-MALE:top")).toBe("power");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it.fails("XG7-001: 【レンジャーキー】「シルバー」も特徴の色（10種）に含まれる（出典: atwiki/page-2406 Q1「…「シルバー」、「バイオレット」、「ゴールド」の１０種です」） — 既知の不具合: CARD-XG7-001 オモテにしたカードを特徴の色で振り分けない（色を持つカードもパワーゾーンに置かない）", () => {
    const s = resolveAll(key(inst("SPEC-SILVER", "top")), ["SPEC-SILVER:top"]);
    expect(zoneOf(s, "player1", "SPEC-SILVER:top")).toBe("power");
  });

  it.fails("XG7-001: 【レンジャーキー】特徴に色を持たないカード（特徴「男」だけ）は山札の下に戻す（出典: atwiki/page-2406「それ以外なら山札の下に戻す」） — 既知の不具合: CARD-XG7-001 色を持たないカードを山札の下に戻さない（山札の上に残る）", () => {
    const s = resolveAll(key(inst("SPEC-PLAIN-MALE", "top")), ["SPEC-PLAIN-MALE:top"]);
    expect(zoneOf(s, "player1", "SPEC-PLAIN-MALE:top")).toBe("deck");
    expect(deckOf(s).at(-1)).toBe("SPEC-PLAIN-MALE:top");
  });

  it("XG7-001: 【レンジャーキー】オモテにしなければ、山札はそのまま（出典: atwiki/page-2406「オモテにしてもよい」）", () => {
    const s = resolveAll(skip(key(inst("SPEC-RED-MALE", "top"))));
    expect(deckOf(s)[0]).toBe("SPEC-RED-MALE:top");
    expect(s.players.player1.power).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG7-002 ゴーカイグリーン", () => {
  const TEXT =
    "※これをラッシュしたとき、「ゴーカイグリーン」以外のオモテ向きの自軍パワーから、追加条件を持たない、特徴「グリーン」またはブラックを持つSユニットのカードを1枚選び、これと置き換えてもよい。【ゴーカイガン】オモテ向きの自軍パワーから、特徴に色を持つカードを好きな枚数選び手札に戻してもよい。そうしたとき、このターン、これは戻したカード1枚につきBP+1000される。";

  it("XG7-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-2407）", () => {
    expectCatalogText("XG7-002", TEXT);
    expectStats("XG7-002", { name: "ゴーカイグリーン", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 2, features: ["グリーン", "男", "宇宙海賊"] });
    expectRarityIn("XG7-002", ["N"]);
  });

  gokaiSwapTests({ id: "XG7-002", name: "ゴーカイグリーン", page: "atwiki/page-2407", cost: 4, colors: ["グリーン", "ブラック"] });

  const gun = () =>
    nc("XG7-002:g", 1, { power: [inst("SPEC-RED-MALE", "r"), inst("SPEC-GREEN", "gr"), inst("SPEC-PLAIN-MALE", "pm"), { ...inst("SPEC-SILVER", "dn"), faceDown: true }, ...powerCards(1)] });

  it.fails("XG7-002: 【ゴーカイガン】NC — オモテ向きの自軍パワーの、特徴に色を持つカードから好きな枚数を選べる（任意）。色のないカード・ウラ向きのカードは選べない（出典: atwiki/page-2407「オモテ向きの自軍パワーから、特徴に色を持つカードを好きな枚数選び手札に戻してもよい」） — 既知の不具合: CARD-XG7-002 【ゴーカイガン】が未実装（NC で選択が開かず、パワーを手札に戻せない・BP が上がらない）", () => {
    const s = gun();
    expectChoiceFrom(s, "player1", "XG7-002");
    expect(choiceIds(s)).toEqual(["SPEC-GREEN:gr", "SPEC-RED-MALE:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-002: 【ゴーカイガン】選んだカードを手札に戻し、このターン1枚につき BP+1000（2枚で5000）（出典: atwiki/page-2407「戻したカード1枚につきBP+1000される」） — 既知の不具合: CARD-XG7-002 【ゴーカイガン】が未実装（NC で選択が開かず、パワーを手札に戻せない・BP が上がらない）", () => {
    let s = gun();
    s = pick(pick(s, "SPEC-RED-MALE:r"), "SPEC-GREEN:gr");
    if (s.pendingEffectChoice?.sourceCardId === "XG7-002") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-RED-MALE:r")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-GREEN:gr")).toBe("hand");
    expect(bpOf(s, "player1", "XG7-002:g")).toBe(5000);
  });

  it.fails("XG7-002: 【ゴーカイガン】戻さなければ BP は変わらない（出典: atwiki/page-2407「戻してもよい。そうしたとき」） — 既知の不具合: CARD-XG7-002 【ゴーカイガン】が未実装（NC で選択が開かず、パワーを手札に戻せない・BP が上がらない）", () => {
    const s = resolveAll(skip(gun()));
    expect(bpOf(s, "player1", "XG7-002:g")).toBe(3000);
    expect(s.players.player1.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG7-003 ゴーカイレッド", () => {
  const TEXT =
    "※これをラッシュしたとき、「ゴーカイレッド」以外のオモテ向きの自軍パワーから、追加条件を持たない特徴「レッド」を持つSユニットのカードを1枚選び、これと置き換えてもよい。　【赤きレジェンド】オモテ向きの自軍パワーから、特徴「レッド」を持つカードを1枚選び捨札にしてもよい。そうしたとき、相手に1点ダメージを与える。";

  it("XG7-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-2401）", () => {
    expectCatalogText("XG7-003", TEXT);
    expectStats("XG7-003", { name: "ゴーカイレッド", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 3, comboNumber: 3, features: ["レッド", "男", "宇宙海賊"] });
    expectRarityIn("XG7-003", ["SR"]);
  });

  gokaiSwapTests({ id: "XG7-003", name: "ゴーカイレッド", page: "atwiki/page-2401", cost: 3, colors: ["レッド"] });

  const legend = (power: CardInstance[] = [inst("SPEC-RED-MALE", "r"), inst("SPEC-GREEN", "gr"), { ...inst("SPEC-RED-MALE", "dn"), faceDown: true }]) =>
    nc("XG7-003:g", 2, { power });

  it.fails("XG7-003: 【赤きレジェンド】NC — オモテ向きの自軍パワーの、特徴「レッド」を持つカードから1枚選べる（任意）（出典: atwiki/page-2401「オモテ向きの自軍パワーから、特徴「レッド」を持つカードを1枚選び捨札にしてもよい」） — 既知の不具合: CARD-XG7-003 【赤きレジェンド】がパワーの「レッド」のカードを捨札にせず、無条件に相手に1点を与える", () => {
    const s = legend();
    expectChoiceFrom(s, "player1", "XG7-003");
    expect(choiceIds(s)).toEqual(["SPEC-RED-MALE:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-003: 【赤きレジェンド】選んだカードを捨札にし、相手に1点ダメージ（出典: atwiki/page-2401「そうしたとき、相手に1点ダメージを与える」） — 既知の不具合: CARD-XG7-003 【赤きレジェンド】がパワーの「レッド」のカードを捨札にせず、無条件に相手に1点を与える", () => {
    const s = resolveAll(legend(), ["SPEC-RED-MALE:r"]);
    expect(zoneOf(s, "player1", "SPEC-RED-MALE:r")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  it.fails("XG7-003: 【赤きレジェンド】オモテ向きの自軍パワーに「レッド」のカードがなければダメージを与えない（出典: atwiki/page-2401「捨札にしてもよい。そうしたとき」） — 既知の不具合: CARD-XG7-003 【赤きレジェンド】がパワーの「レッド」のカードを捨札にせず、無条件に相手に1点を与える", () => {
    const s = resolveAll(legend([inst("SPEC-GREEN", "gr"), { ...inst("SPEC-RED-MALE", "dn"), faceDown: true }]));
    expect(s.players.player2.damage).toBe(0);
  });

  it("XG7-003: SP1/4 — バトルエリアの4番目で SP1（3番目では SP を持たない）（出典: atwiki/page-2401「SP：1/4」・R-STK-03）", () => {
    expect(spOf(p1Battle({ battle: [...fill(3), inst("XG7-003", "g")] }, {}, EXTRA), "player1", "XG7-003:g")).toBe(1);
    expect(spOf(p1Battle({ battle: [...fill(2), inst("XG7-003", "g")] }, {}, EXTRA), "player1", "XG7-003:g")).toBe(0);
  });
});

// ===========================================================================
describe("XG7-004 ゴーカイブルー", () => {
  const TEXT =
    "※これをラッシュしたとき、「ゴーカイブルー」以外のオモテ向きの自軍パワーから、追加条件を持たない特徴「ブルー」を持つSユニットのカードを1枚選び、これと置き換えてもよい。　【ゴーカイサーベル】SP1 特徴に色を持つオモテ向きの自軍パワーを1枚選び、自軍山札の上に戻してもよい。そうしたとき、戻したカードと同じ特徴を2つ以上持つ、敵軍バトルエリアのSユニットを1体選び撃破する。";

  it("XG7-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-2408）", () => {
    expectCatalogText("XG7-004", TEXT);
    expectStats("XG7-004", { name: "ゴーカイブルー", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: 1, comboNumber: 4, features: ["ブルー", "男", "宇宙海賊"] });
    expectRarityIn("XG7-004", ["N"]);
  });

  gokaiSwapTests({ id: "XG7-004", name: "ゴーカイブルー", page: "atwiki/page-2408", cost: 1, colors: ["ブルー"] });

  const enemy = { battle: [inst("SPEC-E-RED-MALE", "two"), inst("SPEC-E-RED", "one"), inst("SPEC-E-RED-MALE-M", "m")], rush: [inst("SPEC-E-RED-MALE", "rush")] };
  const saber = () => nc("XG7-004:g", 3, { power: [inst("SPEC-RED-MALE", "r"), inst("SPEC-PLAIN-MALE", "pm"), { ...inst("SPEC-GREEN", "dn"), faceDown: true }] }, enemy);

  it.fails("XG7-004: 【ゴーカイサーベル】「SP1」— NC が成立すると SP1（出典: atwiki/page-2408「SP：！」「【ゴーカイサーベル】SP1」） — 既知の不具合: CARD-XG7-004 【ゴーカイサーベル】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    expect(spOf(resolveAll(saber()), "player1", "XG7-004:g")).toBe(1);
  });

  it.fails("XG7-004: 【ゴーカイサーベル】NC — 特徴に色を持つオモテ向きの自軍パワーから1枚選べる（任意）（出典: atwiki/page-2408「特徴に色を持つオモテ向きの自軍パワーを1枚選び、自軍山札の上に戻してもよい」） — 既知の不具合: CARD-XG7-004 【ゴーカイサーベル】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    const s = saber();
    expectChoiceFrom(s, "player1", "XG7-004");
    expect(choiceIds(s)).toEqual(["SPEC-RED-MALE:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-004: 【ゴーカイサーベル】戻したカードは山札の上。同じ特徴を2つ以上持つ敵軍バトルエリアの S ユニットだけから1体選び撃破する（出典: atwiki/page-2408「戻したカードと同じ特徴を2つ以上持つ、敵軍バトルエリアのSユニットを1体選び撃破する」） — 既知の不具合: CARD-XG7-004 【ゴーカイサーベル】が未実装（NC で SP1 にならず、選択も開かない）", () => {
    let s = pick(saber(), "SPEC-RED-MALE:r");
    expect(deckOf(s)[0]).toBe("SPEC-RED-MALE:r");
    expectChoiceFrom(s, "player1", "XG7-004");
    expect(choiceIds(s)).toEqual(["SPEC-E-RED-MALE:two"]);
    s = resolveAll(pick(s, "SPEC-E-RED-MALE:two"));
    expect(zoneOf(s, "player2", "SPEC-E-RED-MALE:two")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-005 ゴーカイイエロー", () => {
  const TEXT =
    "※これをラッシュしたとき、「ゴーカイイエロー」以外のオモテ向きの自軍パワーから、追加条件を持たない特徴「イエロー」を持つSユニットのカードを1枚選び、これと置き換えてもよい。　【モバイレーツ】次の相手ターン、カード名に「ゴーカイ」を含む自軍ユニットが撃破されて捨札になるとき、そのユニットと同じ特徴を2つ以上持つ、オモテ向きの自軍パワーを1枚捨札にして、その場に留めてもよい。";

  it("XG7-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-2409）", () => {
    expectCatalogText("XG7-005", TEXT);
    expectStats("XG7-005", { name: "ゴーカイイエロー", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 5, features: ["イエロー", "女", "宇宙海賊"] });
    expectRarityIn("XG7-005", ["N"]);
  });

  gokaiSwapTests({ id: "XG7-005", name: "ゴーカイイエロー", page: "atwiki/page-2409", cost: 0, colors: ["イエロー"] });

  /** NC 成立のあと相手ターンのバトルフェイズに進め、敵軍の SPEC-BIG（BP9000）で target にアタックさせる。 */
  const nextEnemyAttack = (target: string, p1: Partial<GameState["players"]["player1"]>) => {
    let s = resolveAll(nc("XG7-005:g", 4, p1, { rush: [inst("SPEC-BIG", "big")] }));
    s = toPhase(endTurn(s), "player2", "battle");
    s = enter(s, "SPEC-BIG:big", "player2");
    return settle(attack(s, "SPEC-BIG:big", target, "player2"));
  };
  const power = () => [inst("SPEC-YELLOW-FEMALE", "yf"), inst("SPEC-YELLOW-MALE", "ym"), inst("SPEC-PLAIN-MALE", "pm")];

  it.fails("XG7-005: 【モバイレーツ】NC の次の相手ターン、これが撃破されて捨札になるとき、同じ特徴を2つ以上持つオモテ向きの自軍パワーを1枚選べる（任意）（出典: atwiki/page-2409「そのユニットと同じ特徴を2つ以上持つ、オモテ向きの自軍パワーを1枚捨札にして、その場に留めてもよい」） — 既知の不具合: CARD-XG7-005 【モバイレーツ】が未実装（次の相手ターンに撃破されても、パワーを捨札にして留める選択が開かない）", () => {
    const s = nextEnemyAttack("XG7-005:g", { power: power() });
    expectChoiceFrom(s, "player1", "XG7-005");
    expect(choiceIds(s)).toEqual(["SPEC-YELLOW-FEMALE:yf"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG7-005: 【モバイレーツ】選んだパワーを捨札にして、撃破されたユニットはその場（バトルエリア）に留まる（出典: atwiki/page-2409「捨札にして、その場に留めてもよい」） — 既知の不具合: CARD-XG7-005 【モバイレーツ】が未実装（次の相手ターンに撃破されても、パワーを捨札にして留める選択が開かない）", () => {
    const s = resolveAll(nextEnemyAttack("XG7-005:g", { power: power() }), ["SPEC-YELLOW-FEMALE:yf"]);
    expect(zoneOf(s, "player1", "SPEC-YELLOW-FEMALE:yf")).toBe("discard");
    expect(zoneOf(s, "player1", "XG7-005:g")).toBe("battle");
  });

  it.fails("XG7-005: 【モバイレーツ】カード名に「ゴーカイ」を含むほかの自軍ユニット（XG7-003 ゴーカイレッド）も守れる（出典: atwiki/page-2409「カード名に「ゴーカイ」を含む自軍ユニット」） — 既知の不具合: CARD-XG7-005 【モバイレーツ】が未実装（次の相手ターンに撃破されても、パワーを捨札にして留める選択が開かない）", () => {
    const s = resolveAll(nextEnemyAttack("XG7-003:r", { battle: [inst("XG7-003", "r")], power: power() }), ["SPEC-YELLOW-MALE:ym"]);
    expect(zoneOf(s, "player1", "XG7-003:r")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-YELLOW-MALE:ym")).toBe("discard");
  });

  it("XG7-005: 【モバイレーツ】カード名に「ゴーカイ」を含まない自軍ユニットは守れない（出典: atwiki/page-2409）", () => {
    const s = resolveAll(nextEnemyAttack("SPEC-RED-MALE:u", { battle: [inst("SPEC-RED-MALE", "u")], power: [inst("SPEC-RED-MALE", "pw")] }));
    expect(zoneOf(s, "player1", "SPEC-RED-MALE:u")).toBe("discard");
  });
});

// ===========================================================================
describe("XG7-006 ギンガピンク", () => {
  const TEXT = "※これが自分の手札にある間、自軍ラッシュフェイズ中、特徴「獣」を持つ自軍ビークルか、特徴「ブラック」を持つ自軍ユニットがあれば、これを自軍ラッシュエリアに出してもよい。【花一心】「SP1」";

  it("XG7-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-2411）", () => {
    expectCatalogText("XG7-006", TEXT);
    expectStats("XG7-006", { name: "ギンガピンク", category: "MA", size: "S", bp: 500, sp: "special", powerCost: 1, comboNumber: 3, features: ["ピンク", "女"] });
    expectRarityIn("XG7-006", ["N"]);
  });

  const hand = (p1: Partial<GameState["players"]["player1"]>) => rushPhaseOf({ hand: [inst("XG7-006", "gp")], command: [], power: [], ...p1 }, {}, EXTRA);

  it.fails("XG7-006: ※ 自軍ラッシュフェイズ中、特徴「ブラック」を持つ自軍ユニットがあれば、コマンドもパワーもなしに手札から自軍ラッシュエリアに出せる（出典: atwiki/page-2411・カード評価「コマンドをホールドせずにラッシュする」） — 既知の不具合: CARD-XG7-006 手札から自軍ラッシュエリアに出す合法手（self_rush_from_zone）がない", () => {
    const s0 = hand({ rush: [inst("SPEC-BLACK", "bk")] });
    expect(canSelfRush(s0, "hand", "XG7-006:gp")).toBe(true);
    const s = settle(selfRush(s0, "hand", "XG7-006:gp"));
    expect(zoneOf(s, "player1", "XG7-006:gp")).toBe("rush");
  });

  it.fails("XG7-006: ※ 特徴「獣」を持つ自軍ビークルがあっても出せる（出典: atwiki/page-2411「特徴「獣」を持つ自軍ビークルか」） — 既知の不具合: CARD-XG7-006 手札から自軍ラッシュエリアに出す合法手（self_rush_from_zone）がない", () => {
    expect(canSelfRush(hand({ rush: [inst("SPEC-BEAST-V", "v")] }), "hand", "XG7-006:gp")).toBe(true);
  });

  it("XG7-006: ※ どちらもなければ（「獣」でないビークル・「ブラック」の敵軍ユニットだけ）出せない（出典: atwiki/page-2411「…自軍ユニットがあれば」）", () => {
    const s = rushPhaseOf({ hand: [inst("XG7-006", "gp")], rush: [inst("SPEC-MECHA-V", "v")], command: [], power: [] }, { rush: [inst("SPEC-BLACK", "ebk")] }, EXTRA);
    expect(canSelfRush(s, "hand", "XG7-006:gp")).toBe(false);
  });

  it("XG7-006: ※ 自軍ラッシュフェイズ以外（自軍バトルフェイズ）には出せない（出典: atwiki/page-2411「自軍ラッシュフェイズ中」）", () => {
    const s = p1Battle({ hand: [inst("XG7-006", "gp")], rush: [inst("SPEC-BLACK", "bk")] }, {}, EXTRA);
    expect(canSelfRush(s, "hand", "XG7-006:gp")).toBe(false);
  });

  it("XG7-006: 【花一心】「SP1」— NC（3番目）で SP1（出典: atwiki/page-2411「【花一心】「SP1」」）", () => {
    expect(spOf(resolveAll(nc("XG7-006:gp", 2)), "player1", "XG7-006:gp")).toBe(1);
  });
});

// ===========================================================================
describe("XG7-007 ドラゴンレンジャー×ティラノレンジャー", () => {
  const TEXT =
    "※クロス1 ※コールWB ※これが自軍捨札にある間、特徴「恐竜」を持つ自軍Mユニットは、アタックするとき、BP+1000される。【龍撃剣＆獣奏剣】これは自軍ターン中、特徴「恐竜」を持つユニット1体につきBP+1000され、BP8000以上のときSP1になる。";

  it("XG7-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-2447）", () => {
    expectCatalogText("XG7-007", TEXT);
    expectStats("XG7-007", {
      name: "ドラゴンレンジャー×ティラノレンジャー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "1/2",
      powerCost: "3+",
      comboNumber: undefined,
      features: ["レッド", "グリーン", "男", "獣奏剣"],
      rushCondition: "hold_extra_command",
    });
    expectRarityIn("XG7-007", ["SR"]);
  });

  crossTests("XG7-007", "atwiki/page-2447");
  extraHoldTests("XG7-007", ["WB"], "3+", "atwiki/page-2447");
  callTests("XG7-007", "WB", "atwiki/page-2447");

  const attackWith = (unit: string, discard: CardInstance[]) => {
    let s = p1Battle({ rush: [inst(unit, "m")], discard }, { battle: [inst("SPEC-ENEMY", "e")] }, EXTRA);
    s = enter(s, `${unit}:m`);
    return settle(attack(s, `${unit}:m`, "SPEC-ENEMY:e"));
  };

  it.fails("XG7-007: ※ これが自軍捨札にある間、特徴「恐竜」を持つ自軍 M ユニットはアタックするとき BP+1000（出典: atwiki/page-2447「※これが自軍捨札にある間、特徴「恐竜」を持つ自軍Mユニットは、アタックするとき、BP+1000される」） — 既知の不具合: CARD-XG7-007 捨札にあるときの「恐竜」の M ユニットのアタック時 BP+1000 が未実装", () => {
    expect(lastBattleBps(attackWith("SPEC-DINO-M", [inst("XG7-007", "d")]))?.attacker).toBe(6000);
  });

  it("XG7-007: ※ 「恐竜」を持たない M ユニット・これが捨札にないときは上がらない（出典: atwiki/page-2447）", () => {
    expect(lastBattleBps(attackWith("SPEC-PLAIN-M", [inst("XG7-007", "d")]))?.attacker).toBe(5000);
    expect(lastBattleBps(attackWith("SPEC-DINO-M", []))?.attacker).toBe(5000);
  });

  it.fails("XG7-007: 【龍撃剣＆獣奏剣】自軍ターン中、特徴「恐竜」を持つ自軍ユニット1体につき BP+1000（2体で5000）（出典: atwiki/page-2447「これは自軍ターン中、特徴「恐竜」を持つユニット1体につきBP+1000され」） — 既知の不具合: CARD-XG7-007 CN を持たない【龍撃剣＆獣奏剣】（常時の BP 修正・SP1）が未実装", () => {
    const s = p1Battle({ battle: [inst("XG7-007", "d")], rush: [inst("SPEC-DINO", "a"), inst("SPEC-DINO-M", "b"), inst("SPEC-PLAIN-M", "c")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG7-007:d")).toBe(5000);
  });

  it("XG7-007: 【龍撃剣＆獣奏剣】敵軍ターン中は上がらない（出典: atwiki/page-2447「自軍ターン中」）", () => {
    const s = p1Battle({ battle: [inst("XG7-007", "d")], rush: [inst("SPEC-DINO", "a"), inst("SPEC-DINO", "b")] }, {}, EXTRA);
    expect(bpOf({ ...s, activePlayer: "player2" }, "player1", "XG7-007:d")).toBe(3000);
  });

  it.fails("XG7-007: 【龍撃剣＆獣奏剣】BP8000以上のとき SP1（「恐竜」5体で8000。1番目でも SP1）（出典: atwiki/page-2447「BP8000以上のときSP1になる」） — 既知の不具合: CARD-XG7-007 CN を持たない【龍撃剣＆獣奏剣】（常時の BP 修正・SP1）が未実装", () => {
    const s = p1Battle({ battle: [inst("XG7-007", "d")], rush: Array.from({ length: 5 }, (_, i) => inst("SPEC-DINO", `d${i}`)) }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG7-007:d")).toBe(8000);
    expect(spOf(s, "player1", "XG7-007:d")).toBe(1);
  });

  it("XG7-007: 【龍撃剣＆獣奏剣】BP8000未満なら1番目では SP を持たない（SP1/2）（出典: atwiki/page-2447「SP：1/2」）", () => {
    const s = p1Battle({ battle: [inst("XG7-007", "d")], rush: [inst("SPEC-DINO", "a")] }, {}, EXTRA);
    expect(spOf(s, "player1", "XG7-007:d")).toBe(0);
  });

  it.fails("XG7-007: 【龍撃剣＆獣奏剣】敵軍の「恐竜」のユニットも数える（「特徴「恐竜」を持つユニット」に自軍・敵軍の限定がない。XG7-questions Q1 の前提）（出典: atwiki/page-2447） — 既知の不具合: CARD-XG7-007 CN を持たない【龍撃剣＆獣奏剣】（常時の BP 修正・SP1）が未実装", () => {
    const s = p1Battle({ battle: [inst("XG7-007", "d")] }, { battle: [inst("SPEC-DINO", "e1"), inst("SPEC-DINO", "e2")] }, EXTRA);
    expect(bpOf(s, "player1", "XG7-007:d")).toBe(5000);
  });
});

// ===========================================================================
describe("XG7-008 黒騎士ヒュウガ×獣装光ギンガレッド", () => {
  const TEXT =
    "※クロス1 ※これはMAの自軍コマンドがあれば、バトルエリアの2番目か3番目にある間、SP1になる。【アースの戦士】これは自軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。また、BP7000以上のとき、次の能力を得る⇒これがバトルで敵軍ユニットを撃破したとき、捨札にするかわりにゲームから除外する。";

  it("XG7-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-2412）", () => {
    expectCatalogText("XG7-008", TEXT);
    expectUnitStats("XG7-008", {
      name: "黒騎士ヒュウガ×獣装光ギンガレッド",
      category: ["WB", "MA"],
      size: "S",
      bp: 5000,
      sp: "special",
      powerCost: "5+",
      comboNumber: undefined,
      features: ["レッド", "ブラック", "男", "ギンガの光"],
      rushCondition: "hold_extra_command",
    });
    expectRarityIn("XG7-008", ["N"]);
  });

  crossTests("XG7-008", "atwiki/page-2412");
  extraHoldTests("XG7-008", ["WB", "MA"], "5+", "atwiki/page-2412");

  const at = (left: number, command = releasedCat("MA", 1)) => p1Battle({ battle: [...fill(left), inst("XG7-008", "g")], command }, {}, EXTRA);

  it("XG7-008: ※ MA の自軍コマンドがあれば、バトルエリアの2番目・3番目で SP1（出典: atwiki/page-2412「バトルエリアの2番目か3番目にある間、SP1になる」）", () => {
    expect(spOf(at(1), "player1", "XG7-008:g")).toBe(1);
    expect(spOf(at(2), "player1", "XG7-008:g")).toBe(1);
  });

  it("XG7-008: ※ 1番目・4番目では SP を持たない（出典: atwiki/page-2412）", () => {
    expect(spOf(at(0), "player1", "XG7-008:g")).toBe(0);
    expect(spOf(at(3), "player1", "XG7-008:g")).toBe(0);
  });

  it("XG7-008: ※ MA の自軍コマンドがなければ2番目でも SP を持たない（出典: atwiki/page-2412「MAの自軍コマンドがあれば」）", () => {
    expect(spOf(at(1, releasedCat("WB", 1)), "player1", "XG7-008:g")).toBe(0);
  });

  it.fails("XG7-008: 【アースの戦士】自軍ターン中、リリース状態の自軍コマンド1つにつき BP+1000（ホールド状態は数えない）（出典: atwiki/page-2412「リリース状態の自軍コマンド1つにつきBP+1000される」） — 既知の不具合: CARD-XG7-008 CN を持たない【アースの戦士】（リリース状態のコマンドの数の BP 修正・除外）が未実装", () => {
    const s = p1Battle({ battle: [inst("XG7-008", "g")], command: [...releasedCat("WB", 2), { ...inst("TST-OP-MA", "h"), commandHeld: true }] }, {}, EXTRA);
    expect(bpOf(s, "player1", "XG7-008:g")).toBe(7000);
  });

  it("XG7-008: 【アースの戦士】敵軍ターン中は上がらない（出典: atwiki/page-2412「自軍ターン中」）", () => {
    const s = p1Battle({ battle: [inst("XG7-008", "g")], command: releasedCat("WB", 3) }, {}, EXTRA);
    expect(bpOf({ ...s, activePlayer: "player2" }, "player1", "XG7-008:g")).toBe(5000);
  });

  const fight = (commands: number) => {
    let s = p1Battle({ rush: [inst("XG7-008", "g")], command: releasedCat("WB", commands) }, { battle: [inst("SPEC-ENEMY", "e")] }, EXTRA);
    s = enter(s, "XG7-008:g");
    return resolveAll(attack(s, "XG7-008:g", "SPEC-ENEMY:e"));
  };

  it.fails("XG7-008: 【アースの戦士】BP7000以上でバトルで敵軍ユニットを撃破したとき、捨札にするかわりにゲームから除外する（出典: atwiki/page-2412「BP7000以上のとき…捨札にするかわりにゲームから除外する」） — 既知の不具合: CARD-XG7-008 CN を持たない【アースの戦士】（リリース状態のコマンドの数の BP 修正・除外）が未実装", () => {
    const s = fight(2);
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe(null);
    expect(s.players.player2.exile.map((c) => c.instanceId)).toContain("SPEC-ENEMY:e");
  });

  it("XG7-008: 【アースの戦士】BP7000未満なら撃破したユニットは捨札になる（出典: atwiki/page-2412）", () => {
    const s = fight(1);
    expect(zoneOf(s, "player2", "SPEC-ENEMY:e")).toBe("discard");
  });
});
