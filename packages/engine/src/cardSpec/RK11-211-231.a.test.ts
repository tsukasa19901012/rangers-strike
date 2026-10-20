/**
 * カード別スペック: RK-211〜RK-217（ザ・マスクドライダーEXP vol.3 仮面ライダーブレイドJF〜イーグルアンデッド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-3（RK-214 欄）・grnrngr/faq-rider-2（RK-130 欄。RK-215・RK-216 と同じ
 *     「ラッシュするかわりに捨札にして」の手続き）（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html・rider_3.html）。
 *     atwiki に転載された公式 Q&A（RK-214 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CAT-02 のパワーの数え方、R-KW-SCRUM-01、R-KW-RESIST 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: なし（cardSpec・rulesSpec を RK-211〜217 で検索）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  heldUnit,
  inst,
  ncEnter,
  nextPhase,
  p1Battle,
  pick,
  powerCards,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushOpen,
  rushVia,
  scrumTests,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  targetsOf,
  toTurnEnd,
  zordDownTests,
  zoneOf,
} from "./RK11-211-231.helpers";

const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C3SP2 = sUnit("SPEC-C3SP2", { bp: 1000, powerCost: 3, sp: 2 });
const C3NOSP = sUnit("SPEC-C3NOSP", { bp: 1000, powerCost: 3, sp: undefined });
const M2 = sUnit("SPEC-M2", { bp: 1000, powerCost: 2, size: "M" });
const MA1 = sUnit("SPEC-MA1", { category: "MA", bp: 1000, powerCost: 1 });
const WB1 = sUnit("SPEC-WB1", { category: "WB", bp: 1000, powerCost: 1 });
const WB1M = sUnit("SPEC-WB1M", { category: "WB", bp: 1000, powerCost: 1, size: "M" });
/** 特徴「仮面ライダー」を持つ自軍の S ユニット（BP3000）。 */
const KAMEN = sUnit("SPEC-KAMEN", { category: "WB", bp: 3000, features: ["仮面ライダー"] });
const EXTRA = [PLAIN_VEHICLE, C1, C2, C3, C3SP2, C3NOSP, M2, MA1, WB1, WB1M, KAMEN];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 敵軍（player2）のターン（バトルフェイズ）の盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

/** 敵軍ターン中に、敵軍の RK-139 ゼロノスAF【俺はかーなーり強い】（RC）で自軍ラッシュエリアの id をバトルエリアに出させる。 */
function enteredInEnemyTurn(id: string, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}): GameState {
  let s = enemyTurn({ rush: [inst(id.split(":")[0]!, id.split(":")[1]!)], ...p1 }, { ...p2, rush: [inst("RK-139", "af"), inst("SPEC-VEHICLE", "v"), ...(p2.rush ?? [])] });
  s = act(s, { type: "mount_ride", playerId: "player2", riderInstanceId: "RK-139:af", vehicleInstanceId: "SPEC-VEHICLE:v" });
  s = act(s, { type: "resolve_ride_off_choice", playerId: "player2", rideOff: true });
  return pick(s, id);
}

// ===========================================================================
describe("RK-211 仮面ライダーブレイドJF", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダーブレイド」のカードを1枚選び、自軍ラッシュエリアに出す。 【ライトニングスラッシュ】自軍ターン中、これがバトルエリアに出たとき、自分の手札を2枚選び、相手に見せてもよい。そうしたとき、見せたカードの持つカテゴリがすべて同じなら、必要パワーを満たしていない敵軍ユニットを1体選び撃破する。そうして撃破したユニットの本来のSPが1以上なら、そのSPと同じ数だけ、相手にダメージを与える。";

  it("RK-211: カタログ本文・スペックが出典と一致（出典: atwiki/page-1078）", () => {
    expectCatalogText("RK-211", TEXT);
    expectStats("RK-211", { name: "仮面ライダーブレイドJF", category: "WB", size: "S", bp: 5500, sp: "1/2", powerCost: "7-", features: ["仮面ライダー", "男", "ジャックフォーム"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-211", ["SR"]);
  });

  zordDownTests("RK-211", "RK-125", "仮面ライダーブレイド", "atwiki/page-1078", "WB");
  reanimateTests("RK-211", "RK-125", "仮面ライダーブレイド", "atwiki/page-1078");

  // 敵軍のパワーは2枚。必要パワーの数字が3以上のユニットが「必要パワーを満たしていない」。
  const enemy = { battle: [inst("SPEC-C3SP2", "a"), inst("SPEC-C1", "b"), inst("TST-UNIT-7", "l")], rush: [inst("SPEC-C3NOSP", "r")], power: powerCards(2, "ep") };
  const WB_HAND = [inst("TST-OP", "h1"), inst("TST-OP", "h2"), inst("TST-OP-MA", "h3")];
  const entered = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = enemy) =>
    enter(board({ rush: [inst("RK-211", "jf")], hand: WB_HAND, ...p1 }, p2), "RK-211:jf");
  /** 手札の2枚を選んで見せる。 */
  const shown = (s: GameState, a: string, b: string) => pick(pick(s, a), b);

  it("RK-211: 【ライトニングスラッシュ】自軍ターン中、バトルエリアに出たとき、自分の手札を2枚選んで見せるかを選べる（任意）（出典: atwiki/page-1078「自分の手札を2枚選び、相手に見せてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "RK-211");
    expect(choiceIds(s)).toEqual(["TST-OP-MA:h3", "TST-OP:h1", "TST-OP:h2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-211: 見せた2枚のカテゴリがすべて同じなら、必要パワーを満たしていない敵軍ユニット（敵軍のパワー2枚に対して必要パワー3以上。サイズ・エリアを問わない）から1体選ぶ（選ばないことはできない）（出典: atwiki/page-1078「必要パワーを満たしていない敵軍ユニットを1体選び撃破する」・カード評価「サイズやエリアに囚われない」）", () => {
    const s = shown(entered(), "TST-OP:h1", "TST-OP:h2");
    expectChoiceFrom(s, "player1", "RK-211");
    expect(choiceIds(s)).toEqual(["SPEC-C3NOSP:r", "SPEC-C3SP2:a", "TST-UNIT-7:l"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-211: 選んだユニットを撃破し、その本来の SP（2）と同じ数だけ相手にダメージを与える（出典: atwiki/page-1078「そうして撃破したユニットの本来のSPが1以上なら、そのSPと同じ数だけ、相手にダメージを与える」）", () => {
    const s = resolveAll(pick(shown(entered(), "TST-OP:h1", "TST-OP:h2"), "SPEC-C3SP2:a"));
    expect(zoneOf(s, "player2", "SPEC-C3SP2:a")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(2);
  });

  it("RK-211: 撃破したユニットの本来の SP が「－」ならダメージを与えない（出典: atwiki/page-1078「本来のSPが1以上なら」）", () => {
    const s = resolveAll(pick(shown(entered(), "TST-OP:h1", "TST-OP:h2"), "SPEC-C3NOSP:r"));
    expect(zoneOf(s, "player2", "SPEC-C3NOSP:r")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-211: 見せた2枚のカテゴリが違えば撃破しない（出典: atwiki/page-1078「見せたカードの持つカテゴリがすべて同じなら」）", () => {
    const s = resolveAll(shown(entered(), "TST-OP:h1", "TST-OP-MA:h3"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-211");
    expect(zoneOf(s, "player2", "SPEC-C3SP2:a")).toBe("battle");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-211: 「必要パワーを満たしているか」は、相手のパワーに自軍コマンドゾーンのマルチカテゴリのカードを数えて判定する（パワー2枚＋マルチ1枚＝3なら必要パワー3は満たしている）（出典: カード評価「判定には、マルチカテゴリの自軍コマンドも含まれる」・R-CAT-02「自軍パワー＝自軍パワーゾーンのカード枚数＋敵軍コマンドゾーンのマルチカテゴリカードの枚数」）", () => {
    const s = shown(entered({ command: [...releasedCat("WB", 1), { ...inst("TST-OP-WB-ET", "mc"), commandHeld: false }] }), "TST-OP:h1", "TST-OP:h2");
    expectChoiceFrom(s, "player1", "RK-211");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:l"]);
  });

  it("RK-211: 手札が1枚以下なら発動しない（出典: atwiki/page-1078「自分の手札を2枚選び」）", () => {
    const s = entered({ hand: [inst("TST-OP", "h1")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-211");
  });

  it("RK-211: 敵軍ターン中にバトルエリアに出たとき（RK-139 ゼロノスAF の効果）は発動しない（出典: atwiki/page-1078「自軍ターン中、」）", () => {
    const s = enteredInEnemyTurn("RK-211:jf", { hand: WB_HAND }, { battle: enemy.battle, power: enemy.power });
    expect(zoneOf(s, "player1", "RK-211:jf")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-211");
  });

  it.todo(
    "RK-211: 本来の SP が分数（1/2 など）のユニットを撃破したときのダメージ（出典: atwiki/page-1078「本来のSPが1以上なら、そのSPと同じ数だけ」）— 分数 SP を「SP」として何点と数えるかの出典がない",
  );
  it.todo(
    "RK-211: 見せたカードにマルチカテゴリのカードがあるときの「カテゴリがすべて同じ」の判定（出典: atwiki/page-1078）— 出典に記述がない",
  );
});

// ===========================================================================
describe("RK-212 仮面ライダーラルク", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【レイバレット】ホールド状態の敵軍Sユニットを2体選んでもよい。そうしたとき、選んだ2体の持つカテゴリが違うなら、相手はそのどちらか1体を選び撃破する。";

  it("RK-212: カタログ本文・スペックが出典と一致（出典: atwiki/page-930）", () => {
    expectCatalogText("RK-212", TEXT);
    expectStats("RK-212", { name: "仮面ライダーラルク", category: "WB", size: "S", bp: 500, sp: "1/2", powerCost: 2, comboNumber: 1, features: ["仮面ライダー", "女"] });
    expectRarityIn("RK-212", ["N"]);
  });

  scrumTests("RK-212", 1, "atwiki/page-930");

  const enemy = { battle: [heldUnit("SPEC-WB1", "w"), heldUnit("SPEC-WB1M", "m"), inst("SPEC-MA1", "rel")], rush: [heldUnit("SPEC-MA1", "r"), heldUnit("SPEC-WB1", "w2")] };
  const nc = (p2: Partial<GameState["players"]["player2"]> = enemy) => ncEnter("RK-212:lk", 0, {}, p2, EXTRA);

  it("RK-212: 【レイバレット】NC — ホールド状態の敵軍 S ユニット（エリアを問わない。リリース状態・M は対象外）を2体選べる（任意）（出典: atwiki/page-930「ホールド状態の敵軍Sユニットを2体選んでもよい」・カード評価「ラッシュエリアのユニットも除去できる」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-212");
    expect(choiceIds(s)).toEqual(["SPEC-MA1:r", "SPEC-WB1:w", "SPEC-WB1:w2"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-212: 選んだ2体のカテゴリが違えば、相手がそのどちらか1体を選ぶ（出典: atwiki/page-930「相手はそのどちらか1体を選び撃破する」）", () => {
    const s = pick(pick(nc(), "SPEC-WB1:w"), "SPEC-MA1:r");
    expectChoiceFrom(s, "player2", "RK-212");
    expect(choiceIds(s)).toEqual(["SPEC-MA1:r", "SPEC-WB1:w"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-212: 相手が選んだ1体が撃破され、もう1体は残る（出典: atwiki/page-930）", () => {
    const s = resolveAll(pick(pick(pick(nc(), "SPEC-WB1:w"), "SPEC-MA1:r"), "SPEC-MA1:r"));
    expect(zoneOf(s, "player2", "SPEC-MA1:r")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-WB1:w")).toBe("battle");
  });

  it("RK-212: 選んだ2体のカテゴリが同じなら撃破しない（出典: atwiki/page-930「選んだ2体の持つカテゴリが違うなら」）", () => {
    const s = resolveAll(pick(pick(nc(), "SPEC-WB1:w"), "SPEC-WB1:w2"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-212");
    expect(zoneOf(s, "player2", "SPEC-WB1:w")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-WB1:w2")).toBe("rush");
  });

  it("RK-212: ホールド状態の敵軍 S ユニットが1体しかいなければ発動しない（出典: atwiki/page-930「2体選んでもよい」）", () => {
    const s = nc({ battle: [heldUnit("SPEC-WB1", "w"), inst("SPEC-MA1", "rel")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-212");
  });

  it.todo("RK-212: マルチカテゴリのユニットを選んだときの「カテゴリが違う」の判定（出典: atwiki/page-930）— 出典に記述がない");
});

// ===========================================================================
describe("RK-213 仮面ライダーグレイブ", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いＣＮを持つユニットがこれの次に並んでいる間、これはアタックされない） 【グラビティスラッシュ】「SP1」敵軍コマンドのカテゴリの数を数えてもよい。（コマンドがなければ0と数える）そうしたとき、その数以下の必要パワーの数字を持つユニットを敵軍バトルエリアから1体選び撃破する。";

  it("RK-213: カタログ本文・スペックが出典と一致（出典: atwiki/page-899）", () => {
    expectCatalogText("RK-213", TEXT);
    expectStats("RK-213", { name: "仮面ライダーグレイブ", category: "WB", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 2, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-213", ["R"]);
  });

  scrumTests("RK-213", 2, "atwiki/page-899");

  const enemy = (command = [...releasedCat("WB", 1), ...releasedCat("MA", 1)]) => ({
    battle: [inst("SPEC-C1", "a"), inst("SPEC-C2", "b"), inst("SPEC-C3", "c"), inst("SPEC-M2", "m"), inst("TST-UNIT-0", "z")],
    rush: [inst("SPEC-C1", "r")],
    command,
  });
  const nc = (p2: Partial<GameState["players"]["player2"]> = enemy()) => ncEnter("RK-213:gr", 1, {}, p2, EXTRA);

  it("RK-213: 「SP1」— NC が成立すると SP1 になる（出典: atwiki/page-899「SP：！」「【グラビティスラッシュ】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "RK-213:gr")).toBe(1);
  });

  it("RK-213: 【グラビティスラッシュ】NC — 敵軍コマンドのカテゴリの数（WB・MA の2）以下の必要パワーの数字を持つ、敵軍バトルエリアのユニット（サイズを問わない）から1体選べる（任意）（出典: atwiki/page-899「その数以下の必要パワーの数字を持つユニットを敵軍バトルエリアから1体選び撃破する」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-213");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b", "SPEC-M2:m", "TST-UNIT-0:z"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-213: 選んだユニットを撃破する（出典: atwiki/page-899「1体選び撃破する」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("discard");
  });

  it("RK-213: 数えるのはカテゴリの種類の数（同じカテゴリのコマンドが3枚でも1）（出典: atwiki/page-899「敵軍コマンドのカテゴリの数」・コメント欄「そのカテゴリの数は赤、黄、黒の3つ」）", () => {
    const s = nc(enemy(releasedCat("WB", 3)));
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "TST-UNIT-0:z"]);
  });

  it("RK-213: マルチカテゴリのコマンドは持つカテゴリをそれぞれ数える（WB／ET のコマンドと WB のコマンドで2）（出典: atwiki/page-899 コメント欄「そのカテゴリの数は赤、黄、黒の3つ」）", () => {
    const s = nc(enemy([{ ...inst("TST-OP-WB-ET", "mc"), commandHeld: false }, ...releasedCat("WB", 1)]));
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b", "SPEC-M2:m", "TST-UNIT-0:z"]);
  });

  it("RK-213: 敵軍コマンドがなければ0と数え、必要パワー0のユニットだけが候補（出典: atwiki/page-899「（コマンドがなければ0と数える）」）", () => {
    const s = nc(enemy([]));
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:z"]);
  });
});

// ===========================================================================
describe("RK-214 仮面ライダーランス", () => {
  const TEXT =
    "※レジスト （これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【インパクトスタッブ】敵軍バトルエリアのSユニットを2体選んでもよい。そうしたとき、相手は次のようにする⇒選ばれたユニットのうち1体を撃破する。その後、もう1体をホールドする。";

  it("RK-214: カタログ本文・スペックが出典と一致（出典: atwiki/page-931）", () => {
    expectCatalogText("RK-214", TEXT);
    expectStats("RK-214", { name: "仮面ライダーランス", category: "WB", size: "S", bp: 1000, sp: undefined, powerCost: 1, comboNumber: 3, features: ["仮面ライダー", "男"] });
    expectRarityIn("RK-214", ["N"]);
  });

  it("RK-214: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-931「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-214", "ln")] }, "RK-214:ln"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-C1", "a"), heldUnit("SPEC-C2", "b"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] };
  const nc = (p2: Partial<GameState["players"]["player2"]> = enemy) => ncEnter("RK-214:ln", 2, {}, p2, EXTRA);

  it("RK-214: 【インパクトスタッブ】NC — 敵軍バトルエリアの S ユニット（ホールド状態も含む。ラッシュエリア・M は対象外）を2体選べる（任意）（出典: atwiki/page-931「敵軍バトルエリアのSユニットを2体選んでもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "RK-214");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-214: 2体選ぶと、相手が撃破する1体を選ぶ（出典: atwiki/page-931「相手は次のようにする⇒選ばれたユニットのうち1体を撃破する」）", () => {
    const s = pick(pick(nc(), "SPEC-C1:a"), "SPEC-C2:b");
    expectChoiceFrom(s, "player2", "RK-214");
    expect(choiceIds(s)).toEqual(["SPEC-C1:a", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(false);
  });

  // grnrngr/faq-rider-3 RK-214「いいえ。撃破するのはどちらでもいいので、撃破することができます。その後、残ったもう１体の状態が、リリース状態ならホールド、ホールド状態ならホールド状態のままにする」
  it("RK-214: 公式Q&A — 相手はホールド状態のユニットを撃破することを選べ、残ったリリース状態のユニットはホールドされる（出典: grnrngr/faq-rider-3 RK-214・atwiki/page-931 Q1）", () => {
    const s = resolveAll(pick(pick(pick(nc(), "SPEC-C1:a"), "SPEC-C2:b"), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-C1:a")?.commandHeld).toBe(true);
  });

  it("RK-214: 公式Q&A — リリース状態のユニットを撃破したとき、残ったホールド状態のユニットはホールド状態のまま（出典: grnrngr/faq-rider-3 RK-214「ホールド状態ならホールド状態のままにする」）", () => {
    const s = resolveAll(pick(pick(pick(nc(), "SPEC-C1:a"), "SPEC-C2:b"), "SPEC-C1:a"));
    expect(zoneOf(s, "player2", "SPEC-C1:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-C2:b")?.commandHeld).toBe(true);
  });

  it("RK-214: 敵軍バトルエリアの S ユニットが1体しかいなければ発動しない（出典: atwiki/page-931「2体選んでもよい」・カード評価「敵軍バトルエリアにユニットが2体いないと使用できない」）", () => {
    const s = nc({ battle: [inst("SPEC-C1", "a"), inst("SPEC-M2", "m")], rush: [inst("SPEC-C1", "r")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-214");
  });
});

// ===========================================================================
/** 「ラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい」の共通テスト（RK-130 と同じ手続き）。 */
function replaceRushTests(id: string, page: string, cost: number) {
  const declare = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushOpen(rushPhase({ hand: [inst(id, "ud")], command: releasedCat("DA", 1), power: powerCards(cost), rush: [inst("SPEC-KAMEN", "k1")], battle: [inst("SPEC-KAMEN", "k2"), inst("TST-UNIT-0", "u")], ...p1 }, p2), "player1", `${id}:ud`);

  it(`${id}: ラッシュのための手続き（コマンドのホールド）を行ってから、ラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニット（エリアを問わない）を選べる（任意）（出典: ${page}・grnrngr/faq-rider-2 RK-130「ラッシュのための手続きを行ってから、捨札にしてください」・コメント欄「コマンドのホールドは必要です」）`, () => {
    const s = declare();
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN:k1", "SPEC-KAMEN:k2"]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: 選ぶと、これはラッシュされずに捨札になる（出典: ${page}「これをラッシュするかわりに捨札にして」）`, () => {
    const s = settle(pick(declare(), "SPEC-KAMEN:k1"));
    expect(zoneOf(s, "player1", `${id}:ud`)).toBe("discard");
  });

  it(`${id}: 選ばなければ、ふつうにラッシュエリアに出る（出典: ${page}「選んでもよい」）`, () => {
    const s = settle(skip(declare()));
    expect(zoneOf(s, "player1", `${id}:ud`)).toBe("rush");
  });

  it(`${id}: 特徴「仮面ライダー」を持つ自軍ユニットがいなければ、ふつうにラッシュする（出典: ${page}）`, () => {
    const s = declare({ rush: [], battle: [inst("TST-UNIT-0", "u")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(zoneOf(settle(s), "player1", `${id}:ud`)).toBe("rush");
  });

  return declare;
}

describe("RK-215 リザードアンデッド", () => {
  const TEXT =
    "【スペード2―スラッシュ】自軍ラッシュフェイズ中、これをラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは次の能力を得る⇒これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";

  it("RK-215: カタログ本文・スペックが出典と一致（出典: atwiki/page-943）", () => {
    expectCatalogText("RK-215", TEXT);
    expectStats("RK-215", { name: "リザードアンデッド", category: "DA", size: "S", bp: 3500, sp: undefined, powerCost: 1, features: ["アンデッド", "獣"] });
    expectRarityIn("RK-215", ["N"]);
  });

  const declare = replaceRushTests("RK-215", "atwiki/page-943", 1);

  /** k2（バトルエリア・BP3000）を選び、自軍の手札2枚で BP5000 になっている敵軍の RK-127 仮面ライダーカリス（本来の BP1000）にアタックする。 */
  const slash = (chosen: string, attacker: string) => {
    let s = settle(pick(declare({ hand: [inst("RK-215", "ud"), inst("TST-OP", "x1"), inst("TST-OP", "x2")] }, { battle: [inst("RK-127", "ch")] }), chosen));
    s = nextPhase(s);
    expect(s.phase).toBe("battle");
    expect(bpOf(s, "player2", "RK-127:ch")).toBe(5000);
    return resolveAll(attack(s, attacker, "RK-127:ch"));
  };

  it("RK-215: このターン、選んだユニットがアタックするとき、敵軍ユニットの BP を本来の値（1000）としてバトルし、BP5000 になっているユニットに勝つ（出典: atwiki/page-943「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする」）", () => {
    const s = slash("SPEC-KAMEN:k2", "SPEC-KAMEN:k2");
    expect(zoneOf(s, "player2", "RK-127:ch")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k2")).toBe("battle");
  });

  it("RK-215: 選ばなかったユニットがアタックしても、敵軍ユニットの BP は今の値（5000）のまま（出典: atwiki/page-943「選んだユニットは次の能力を得る」）", () => {
    const s = slash("SPEC-KAMEN:k1", "SPEC-KAMEN:k2");
    expect(zoneOf(s, "player2", "RK-127:ch")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k2")).toBe("discard");
  });
});

describe("RK-216 ドラゴンフライアンデッド", () => {
  const TEXT =
    "【ハート4―フロート】自軍ラッシュフェイズ中、これをラッシュするかわりに捨札にして、特徴「仮面ライダー」を持つ自軍ユニットを1体選んでもよい。そうしたとき、このターン、選んだユニットは次の能力を得る⇒このターンを終えるとき、これが自軍バトルエリアにあれば、これを手札に戻す。";

  it("RK-216: カタログ本文・スペックが出典と一致（出典: atwiki/page-944）", () => {
    expectCatalogText("RK-216", TEXT);
    expectStats("RK-216", { name: "ドラゴンフライアンデッド", category: "DA", size: "S", bp: 1500, sp: undefined, powerCost: 2, features: ["アンデッド", "昆虫"] });
    expectRarityIn("RK-216", ["N"]);
  });

  const declare = replaceRushTests("RK-216", "atwiki/page-944", 2);

  it("RK-216: このターンを終えるとき、選んだユニットが自軍バトルエリアにあれば手札に戻す（出典: atwiki/page-944「このターンを終えるとき、これが自軍バトルエリアにあれば、これを手札に戻す」）", () => {
    let s = settle(pick(declare(), "SPEC-KAMEN:k2"));
    s = toTurnEnd(s);
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k2")).toBe("hand");
  });

  it("RK-216: 選んだユニットがラッシュエリアにあれば戻さない（出典: atwiki/page-944「自軍バトルエリアにあれば」）", () => {
    let s = settle(pick(declare(), "SPEC-KAMEN:k1"));
    s = toTurnEnd(s);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k1")).toBe("rush");
  });

  it("RK-216: 選ばなかったバトルエリアのユニットは戻さない（出典: atwiki/page-944「選んだユニットは次の能力を得る」）", () => {
    let s = settle(pick(declare(), "SPEC-KAMEN:k1"));
    s = toTurnEnd(s);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k2")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-217 イーグルアンデッド", () => {
  const TEXT =
    "※これが自分の手札にある間、自分が「仮面ライダーブレイドJF」をラッシュするとき、これを捨札にすれば、自軍「仮面ライダーブレイド」を1体捨札にしたことにできる。 【滑空攻撃】これは敵軍ラッシュエリアのレジストを持つユニットにアタックできる。";

  it("RK-217: カタログ本文・スペックが出典と一致（出典: atwiki/page-904）", () => {
    expectCatalogText("RK-217", TEXT);
    expectStats("RK-217", { name: "イーグルアンデッド", category: "DA", size: "S", bp: 4500, sp: undefined, powerCost: 5, features: ["アンデッド", "獣"] });
    expectRarityIn("RK-217", ["N"]);
  });

  const jfRush = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst("RK-211", "jf"), inst("RK-217", "eg")], command: releasedCat("WB", 1), power: [], deck: deckCards(3), ...p1 } }, EXTRA);

  it("RK-217: ※ 手札にあるこれを捨札にすれば、「仮面ライダーブレイド」を捨札にしたことにして、ブレイドJF を必要パワー0でラッシュできる（出典: atwiki/page-904「これを捨札にすれば、自軍「仮面ライダーブレイド」を1体捨札にしたことにできる」・カード評価「ブレイドJFとこれが揃えばすぐにでもラッシュが可能」）", () => {
    const r = rushVia(jfRush(), "player1", "RK-211:jf", (a) => a.zordMaterialInstanceId === "RK-217:eg");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-211:jf")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-217:eg")).toBe("discard");
  });

  it("RK-217: ※ 場（ラッシュエリア）にあるこれは「仮面ライダーブレイド」のかわりにできない（出典: atwiki/page-904「これが自分の手札にある間」）", () => {
    const r = rushVia(jfRush({ hand: [inst("RK-211", "jf")], rush: [inst("RK-217", "eg")] }), "player1", "RK-211:jf", (a) => a.zordMaterialInstanceId === "RK-217:eg");
    expect(r.ok).toBe(false);
  });

  it("RK-217: ※ ブレイドJF 以外のカードをラッシュするときは使えない（出典: atwiki/page-904「「仮面ライダーブレイドJF」をラッシュするとき」）", () => {
    const r = rushVia(jfRush({ hand: [inst("RK-210", "gj"), inst("RK-217", "eg")] }), "player1", "RK-210:gj", (a) => a.zordMaterialInstanceId === "RK-217:eg");
    expect(r.ok).toBe(false);
  });

  const glide = (p2: Partial<GameState["players"]["player2"]>) => board({ battle: [inst("RK-217", "eg")] }, p2);

  it("RK-217: 【滑空攻撃】敵軍ラッシュエリアのレジストを持つユニットにアタックできる（出典: atwiki/page-904「これは敵軍ラッシュエリアのレジストを持つユニットにアタックできる」）", () => {
    const s = glide({ rush: [inst("RK-214", "ln"), inst("SPEC-C1", "c")], battle: [inst("SPEC-C2", "b")] });
    expect(targetsOf(s, "RK-217:eg")).toEqual(["RK-214:ln", "SPEC-C2:b"]);
  });

  it("RK-217: 【滑空攻撃】アタックしたレジストを持つユニットとふつうにバトルする（BP4500 対 BP1000 で勝つ）（出典: atwiki/page-904）", () => {
    let s = glide({ rush: [inst("RK-214", "ln")] });
    s = resolveAll(attack(s, "RK-217:eg", "RK-214:ln"));
    expect(zoneOf(s, "player1", "RK-217:eg")).toBe("battle");
  });
});
