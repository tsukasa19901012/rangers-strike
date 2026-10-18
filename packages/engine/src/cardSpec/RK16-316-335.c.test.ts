/**
 * カード別スペック: RK-330〜RK-335（ザ・マスクドライダーEXP vol.4 仮面ライダークウガRT〜モモタロス（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（rider_1〜4・rider.html・card_*.html）に本範囲のカードの項はない
 *     （「RK-330」〜「RK-335」とカード名（クウガRT・クウガAM・龍騎・龍騎サバイブ・電王LF・モモタロス）で検索。rider_2 の「モモタロス」は RK-142 の項）。
 *     atwiki に転載された公式 Q&A（RK-332 Q1・RK-333 Q1・Q2・RK-334 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-02・R-KW-MORPH・R-KW-RESIST）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: RK-334 の「必要パワー2以下のユニットはバトルエリアに出られない」は errataCardEffects.test.ts・rkBattleEntryLockPayment.test.ts
 * にもある（ここでは自軍・敵軍の両方を cardSpec の形で確かめ直す）。RK-335 は RK-310 モモタロス（2nd）のスターター版（atwiki/page-1279 は同じページ）で、
 * RK15-295-315.c の RK-310 と同じ内容を RK-335 の ID で確かめる。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  KW_MORPH,
  PLAIN_VEHICLE,
  activate,
  attack,
  attackUntilRegister,
  bpOf,
  canActivate,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enemyBoard,
  enemyRushes,
  enter,
  enteredInEnemyTurn,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  faceDown,
  inst,
  morphCandidates,
  ncEnter,
  p1Battle,
  pick,
  pickAs,
  powerCards,
  rcRideOff,
  reanimateTests,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RK16-316-335.helpers";

const RISING = ["仮面ライダー", "男", "アマダム", "ライジング"];
const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", bp: 1000, powerCost: 0 });
const AMADAM = sUnit("SPEC-AMADAM", { category: "MA", bp: 1000, powerCost: 1, features: ["アマダム"] });
/** 特徴が RK-330 と完全一致するモーフ持ち。 */
const MORPH_RT = sUnit("SPEC-MORPH-RT", { category: "MA", bp: 2000, powerCost: 1, features: RISING, text: KW_MORPH } as never);
const KAIJIN = sUnit("SPEC-KAIJIN", { category: "DA", bp: 1000, powerCost: 1, features: ["怪人"] });
const KAIJIN_M = sUnit("SPEC-KAIJIN-M", { category: "DA", bp: 1000, powerCost: 1, size: "M", features: ["怪人"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const C6 = sUnit("SPEC-C6", { bp: 1000, powerCost: 6 });
const M4 = sUnit("SPEC-M4", { bp: 1000, powerCost: 4, size: "M" });
const M5 = sUnit("SPEC-M5", { bp: 1000, powerCost: 5, size: "M" });
const DRAGON = sUnit("SPEC-DRAGON", { bp: 1000, powerCost: 1, features: ["ドラゴン"] });
const DRAGON4 = sUnit("SPEC-DRAGON4", { bp: 1000, powerCost: 4, features: ["ドラゴン"] });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 1000, powerCost: 1, features: ["DEN-O"] });
const advent = (id: string, cost: number) =>
  ({ id, name: id, type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: cost, features: ["アドベントカード"] }) as unknown as CardDefinition;
const ADV2 = advent("SPEC-ADV2", 2);
const ADV3 = advent("SPEC-ADV3", 3);
const OP4 = { id: "SPEC-OP4", name: "SPEC-OP4", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 4 } as unknown as CardDefinition;
const FEMALE_ATK = sUnit("SPEC-FEMALE-ATK", { bp: 1000, sp: 1, features: ["女"] });
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, ENEMY0, AMADAM, MORPH_RT, KAIJIN, KAIJIN_M, C1, C2, C3, C4, C5, C6, M4, M5, DRAGON, DRAGON4, DENO, ADV2, ADV3, OP4, FEMALE_ATK];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => p1Battle(p1, p2, EXTRA);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBoard(p1, p2, EXTRA);

/** 「…1体を捨札にすれば必要パワー0になる」（必要パワー N-）の追加条件の共通テスト。 */
function zeroCostTests(id: string, materialId: string, materialLabel: string, cost: number, cat: "WB" | "MA" | "OT", page: string): void {
  it(`${id}: 追加条件 — ${materialLabel}を捨札にすれば必要パワー0でラッシュできる（出典: ${page}）`, () => {
    const s = rushPhase({ hand: [inst(id, "x")], rush: [inst(materialId, "p")], command: releasedCat(cat, 1), power: [] });
    const r = rushVia(s, "player1", `${id}:x`, (a) => a.zordMaterialInstanceId === `${materialId}:p`);
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:x`)).toBe("rush");
    expect(zoneOf(t, "player1", `${materialId}:p`)).toBe("discard");
  });

  it(`${id}: 必要パワー${cost}- — 追加条件を満たさなければパワー${cost}でラッシュでき、${cost - 1}ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => rushPhase({ hand: [inst(id, "x")], command: releasedCat(cat, 1), power: powerCards(n) });
    expect(canStartRush(mk(cost - 1), "player1", `${id}:x`)).toBe(false);
    const r = rushFromHand(mk(cost), "player1", `${id}:x`);
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:x`)).toBe("rush");
  });
}

// ===========================================================================
describe("RK-330 仮面ライダークウガRT", () => {
  const TEXT =
    "※モーフ（敵軍ユニットがモーフ以外でラッシュされたとき、特徴がこのユニットと完全一致するオモテ向きのユニットカードを自軍ゾーンから1枚選び、これと置き換えてもよい） ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） ※これは自軍コマンドを3つホールドしなければバトルエリアに出られない（モーフで出るときは除く）。";

  it("RK-330: カタログ本文・スペックが出典と一致（出典: atwiki/page-1368）", () => {
    expectCatalogText("RK-330", TEXT);
    expectStats("RK-330", { name: "仮面ライダークウガRT", category: "MA", size: "S", bp: 5500, sp: 1, powerCost: "7-", features: RISING, rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-330", ["R"]);
  });

  zeroCostTests("RK-330", "SPEC-AMADAM", "特徴「アマダム」を持つ自軍ユニット1体", 7, "MA", "atwiki/page-1368「追加条件：特徴「アマダム」を持つ自軍ユニット1体を捨札にすれば必要パワー0になる」");

  it("RK-330: ※モーフ — 敵軍のラッシュに対し、特徴が完全一致する自軍コマンドゾーンのカード（RK-331 クウガAM）と置き換えられる（出典: atwiki/page-1368「※モーフ」・R-KW-MORPH-01）", () => {
    const s = enemyRushes({ rush: [inst("RK-330", "rt")], command: [inst("RK-331", "am")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-331:am"]);
    const t = pickAs(s, "player1", "RK-331:am");
    expect(zoneOf(t, "player1", "RK-331:am")).toBe("rush");
    expect(zoneOf(t, "player1", "RK-330:rt")).toBe("command");
  });

  it("RK-330: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1368「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-330", "rt")] }, "RK-330:rt"))).toBe(true);
  });

  it("RK-330: ※ 自軍コマンドを3つホールドしなければバトルエリアに出られない（リリース状態が2つでは出られず、3つあればホールドして出る）（出典: atwiki/page-1368「※これは自軍コマンドを3つホールドしなければバトルエリアに出られない」）", () => {
    expect(canEnter(board({ rush: [inst("RK-330", "rt")], command: releasedCat("MA", 2) }), "RK-330:rt")).toBe(false);
    const s0 = board({ rush: [inst("RK-330", "rt")], command: releasedCat("MA", 3) });
    expect(canEnter(s0, "RK-330:rt")).toBe(true);
    const s = enterWithHold(s0, "RK-330:rt", ["TST-OP-MA:cMA0", "TST-OP-MA:cMA1", "TST-OP-MA:cMA2"]);
    expect(zoneOf(s, "player1", "RK-330:rt")).toBe("battle");
    expect(s.players.player1.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RK-330: ※ モーフでバトルエリアのユニットと置き換わって出るときはホールドしなくてよい（出典: atwiki/page-1368「（モーフで出るときは除く）」・カード評価「モーフでバトルエリアのユニットと置き換わる分にはデメリットであるコマンド3つのホールドは必要無い」）", () => {
    const s = enemyRushes({ battle: [inst("SPEC-MORPH-RT", "m")], command: [inst("RK-330", "rt")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["RK-330:rt"]);
    const t = pickAs(s, "player1", "RK-330:rt");
    expect(zoneOf(t, "player1", "RK-330:rt")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-331 仮面ライダークウガAM", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダークウガRM」のカードを1枚選び、自軍ラッシュエリアに出す。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【アメイジングマイティキック】自軍ターン中、これがバトルエリアに出たとき、本来の特徴に「怪人」を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RK-331: カタログ本文・スペックが出典と一致（出典: atwiki/page-1245）", () => {
    expectCatalogText("RK-331", TEXT);
    expectStats("RK-331", { name: "仮面ライダークウガAM", category: "MA", size: "S", bp: 5500, sp: "1/3", powerCost: "10-", features: RISING, rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-331", ["SR"]);
  });

  zeroCostTests("RK-331", "RK-271", "自軍「仮面ライダークウガRM」1体", 10, "MA", "atwiki/page-1245「追加条件：自軍「仮面ライダークウガRM」1体を捨札にすれば必要パワー0になる」");
  reanimateTests("RK-331", "RK-271", "仮面ライダークウガRM", "atwiki/page-1245");

  it("RK-331: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1245「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-331", "am")] }, "RK-331:am"))).toBe(true);
  });

  const enemy = { battle: [inst("SPEC-KAIJIN", "a"), inst("SPEC-KAIJIN-M", "m"), inst("SPEC-C1", "p")], rush: [inst("SPEC-KAIJIN", "r")] };
  const kick = () => enter(board({ rush: [inst("RK-331", "am")] }, enemy), "RK-331:am");

  it.fails("RK-331: 【アメイジングマイティキック】自軍ターン中に出たとき、本来の特徴に「怪人」を持つ敵軍ユニット（エリア・サイズを問わない）から1体選べる（任意）（出典: atwiki/page-1245「本来の特徴に「怪人」を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい」・カード評価「怪人をサイズ問わず除去できる」）", () => {
    const s = kick();
    expectChoiceFrom(s, "player1", "RK-331");
    expect(choiceIds(s)).toEqual(["SPEC-KAIJIN-M:m", "SPEC-KAIJIN:a", "SPEC-KAIJIN:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-331: 選んだユニットは持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（出典: atwiki/page-1245「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(kick(), "SPEC-KAIJIN-M:m"));
    expect(zoneOf(s, "player2", "SPEC-KAIJIN-M:m")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-KAIJIN-M:m")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it.fails("RK-331: 選ばなければ何も起きない（出典: atwiki/page-1245「置いてもよい」）", () => {
    const s = resolveAll(skip(kick()));
    expect(damageOf(s, "player2")).toBe(0);
    expect(zoneOf(s, "player2", "SPEC-KAIJIN:a")).toBe("battle");
  });

  it("RK-331: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）出たときは発動しない（出典: atwiki/page-1245「自軍ターン中」）", () => {
    const s = enteredInEnemyTurn("RK-331:am", {}, { battle: [inst("SPEC-KAIJIN", "a")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-331:am")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-331");
  });
});

// ===========================================================================
describe("RK-332 仮面ライダー龍騎（2nd）", () => {
  const TEXT =
    "※これは特徴「ドラゴン」を持つ自軍ユニット1体につきBP+1000される。 【叶えたい願いを胸に】特徴「ドラゴン」を持つユニットからコンビネーションしたとき発動できる⇒敵軍バトルエリアから、これがコンビネーションしているユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";

  it("RK-332: カタログ本文・スペックが出典と一致（出典: atwiki/page-1252）", () => {
    expectCatalogText("RK-332", TEXT);
    expectStats("RK-332", { name: "仮面ライダー龍騎（2nd）", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 5, features: ["仮面ライダー", "男", "ミラーライダー", "2nd"] });
    expectRarityIn("RK-332", ["R"]);
  });

  it.fails("RK-332: ※ 特徴「ドラゴン」を持つ自軍ユニット（両エリア）1体につき BP+1000（敵軍の「ドラゴン」は数えない）（出典: atwiki/page-1252「これは特徴「ドラゴン」を持つ自軍ユニット1体につきBP+1000される」）", () => {
    const s = board({ rush: [inst("RK-332", "ry"), inst("SPEC-DRAGON", "d1")], battle: [inst("SPEC-DRAGON", "d2")] }, { battle: [inst("SPEC-DRAGON", "e")] });
    expect(bpOf(s, "player1", "RK-332:ry")).toBe(5000);
  });

  it.fails("RK-332: ※ 「ドラゴン」を持つビークル（RK-325 パワードイクサー）はユニットではないので数えない（出典: atwiki/page-1252「自軍ユニット」・RK-325 カード評価「特徴｢ドラゴン｣を持つが、ビークルなので参照する機会は少ない」）", () => {
    const s = board({ rush: [inst("RK-332", "ry"), inst("RK-325", "v"), inst("SPEC-DRAGON", "d1")] });
    expect(bpOf(s, "player1", "RK-332:ry")).toBe(4000);
  });

  it.fails("RK-332: 公式Q&A — コマンドゾーンにオモテ向きであるときも BP+1000 は有効（出典: atwiki/page-1252 Q1「公開情報である「ゾーン」及び「捨札」にオモテ向きであるときは常に有効」）", () => {
    const s = board({ command: [inst("RK-332", "ry")], rush: [inst("SPEC-DRAGON", "d1")] });
    expect(bpOf(s, "player1", "RK-332:ry")).toBe(4000);
  });

  it.fails("RK-332: 公式Q&A — ウラ向きのとき（ダメージ）はテキストが無効で BP は増えない（出典: atwiki/page-1252 Q1「このカードが「ウラ向き」であるとき…このテキストは無効になり、BPは＋されません」）", () => {
    const s = board({ power: [faceDown("RK-332", "ry")], rush: [inst("SPEC-DRAGON", "d1")] });
    expect(bpOf(s, "player1", "RK-332:ry")).toBe(3000);
  });

  const wish = (prev = "SPEC-DRAGON4:d") => {
    const [cid, suf] = prev.split(":") as [string, string];
    return enter(
      board(
        { battle: [inst(cid, suf)], rush: [inst("RK-332", "ry")] },
        { battle: [inst("SPEC-C3", "c3"), inst("SPEC-C4", "c4"), inst("SPEC-C5", "c5"), inst("SPEC-M4", "m4")], rush: [inst("SPEC-C1", "r")] },
      ),
      "RK-332:ry",
    );
  };

  it.fails("RK-332: 【叶えたい願いを胸に】「ドラゴン」のユニット（必要パワー4）からコンビネーションしたとき、敵軍バトルエリアの必要パワー4以下のユニット（サイズを問わない）から1体選べる（任意）（出典: atwiki/page-1252「これがコンビネーションしているユニットの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する」「発動できる」・コメント欄「こいつの除去サイズ無視か」）", () => {
    const s = wish();
    expectChoiceFrom(s, "player1", "RK-332");
    expect(choiceIds(s)).toEqual(["SPEC-C3:c3", "SPEC-C4:c4", "SPEC-M4:m4"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-332: 選んだユニットは撃破される（出典: atwiki/page-1252「撃破する」）", () => {
    const s = resolveAll(pick(wish(), "SPEC-M4:m4"));
    expect(zoneOf(s, "player2", "SPEC-M4:m4")).toBe("discard");
  });

  it("RK-332: 「ドラゴン」を持たないユニットからコンビネーションしたときは発動しない（出典: atwiki/page-1252「特徴「ドラゴン」を持つユニットからコンビネーションしたとき」）", () => {
    const s = wish("SPEC-C4:own");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-332");
  });

  it("RK-332: 敵軍ターン中に（敵軍 RK-139 ゼロノスAF の効果で）「ドラゴン」の次に出たときは発動しない（出典: atwiki/page-1252 コメント欄の回答「「コンビネーション」が発生するタイミングは、自軍バトルフェイズに自軍ユニットをバトルエリアに出して…上記の場合では…発動できません」）", () => {
    const s = enteredInEnemyTurn("RK-332:ry", { battle: [inst("SPEC-DRAGON4", "d")] }, { battle: [inst("SPEC-C3", "c3")] }, EXTRA);
    expect(zoneOf(s, "player1", "RK-332:ry")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-332");
  });
});

// ===========================================================================
describe("RK-333 仮面ライダー龍騎サバイブ", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「仮面ライダー龍騎」を1体選び、自軍ラッシュエリアに出す。 【ドラグバイザーツバイ】自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい。そうしたとき選んだカードの必要パワーの数字を合計して、その合計以下の必要パワーの数字を持つ敵軍ユニットを1体撃破する";

  it("RK-333: カタログ本文・スペックが出典と一致（出典: atwiki/page-1243）", () => {
    expectCatalogText("RK-333", TEXT);
    expectStats("RK-333", { name: "仮面ライダー龍騎サバイブ", category: "WB", size: "S", bp: 6500, sp: "1/2", powerCost: "10-", comboNumber: "RC", features: ["仮面ライダー", "男", "ミラーライダー", "サバイブ"], rushCondition: "zord_down_discard_named" });
    expectRarityIn("RK-333", ["SR"]);
  });

  zeroCostTests("RK-333", "RK-332", "自軍「仮面ライダー龍騎」（RK-332 龍騎（2nd）。（2nd）は同名）", 10, "WB", "atwiki/page-1243「追加条件：自軍「仮面ライダー龍騎」を1体捨札にすれば必要パワー0になる」");
  reanimateTests("RK-333", "RK-332", "仮面ライダー龍騎", "atwiki/page-1243");

  const enemy = { battle: [inst("SPEC-C5", "c5"), inst("SPEC-C4", "c4"), inst("SPEC-M5", "m5")], rush: [inst("SPEC-C2", "r2"), inst("SPEC-C6", "r6")] };
  const visor = (discard = [inst("SPEC-ADV2", "a2"), inst("SPEC-ADV3", "a3"), inst("SPEC-OP4", "o4")]) =>
    rcRideOff(board({ rush: [inst("RK-333", "sv"), inst("SPEC-VEHICLE", "v")], discard }, enemy), "RK-333:sv", "SPEC-VEHICLE:v");

  it.fails("RK-333: 【ドラグバイザーツバイ】RC — 自軍捨札の特徴「アドベントカード」を持つカードを選べる（任意）（出典: atwiki/page-1243「自軍捨札から特徴「アドベントカード」を持つカードを2枚まで選んでもよい」）", () => {
    const s = visor();
    expectChoiceFrom(s, "player1", "RK-333");
    expect(choiceIds(s)).toEqual(["SPEC-ADV2:a2", "SPEC-ADV3:a3"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-333: 2枚選ぶと必要パワーの合計（5）以下の敵軍ユニット（エリア・サイズを問わない）から1体選び撃破する（強制）。選んだカードは捨札に残る（出典: atwiki/page-1243「その合計以下の必要パワーの数字を持つ敵軍ユニットを1体撃破する」・カード評価「エリア・サイズを問わない」）", () => {
    let s = pick(pick(visor(), "SPEC-ADV2:a2"), "SPEC-ADV3:a3");
    expectChoiceFrom(s, "player1", "RK-333");
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2", "SPEC-C4:c4", "SPEC-C5:c5", "SPEC-M5:m5"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-M5:m5"));
    expect(zoneOf(s, "player2", "SPEC-M5:m5")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-ADV2:a2")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-ADV3:a3")).toBe("discard");
  });

  it.fails("RK-333: 1枚だけ選んで確定してもよい（合計2）（出典: atwiki/page-1243「2枚まで」・コメント欄「「2枚まで」だから1枚でも発動可能」）", () => {
    const s = confirm(pick(visor(), "SPEC-ADV2:a2"));
    expect(choiceIds(s)).toEqual(["SPEC-C2:r2"]);
  });

  it("RK-333: 公式Q&A — 自軍捨札に「アドベントカード」がなければ発動できない（合計0として発動はしない）（出典: atwiki/page-1243 Q1「いいえ。…処理を解決できないため、その効果は発動できません」）", () => {
    const s = visor([inst("SPEC-OP4", "o4")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-333");
  });

  it.fails("RK-333: 選ばなければ何も起きない（出典: atwiki/page-1243「選んでもよい。そうしたとき」）", () => {
    const s = resolveAll(skip(visor()));
    expect(zoneOf(s, "player2", "SPEC-C2:r2")).toBe("rush");
  });

  it("RK-333: ライドオフせずに出たとき（RC が発動しない）は何も起きない（出典: atwiki/page-1243「CN：ＲＣ」）", () => {
    const s = enter(board({ rush: [inst("RK-333", "sv")], discard: [inst("SPEC-ADV2", "a2")] }, enemy), "RK-333:sv");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-333");
  });

  it.todo(
    "RK-333: 公式Q&A — XG5-066 仮面ライダーベルデ【コピーベント】で龍騎サバイブと置き換えるときは、追加条件で必要パワーを0にできない（出典: atwiki/page-1243 Q2）— XG5-066【コピーベント】が未実装（本範囲外のカード。RK3-043-063.a の RK-043 の it.todo と同じ）",
  );
});

// ===========================================================================
describe("RK-334 仮面ライダー電王LF（2nd）", () => {
  const TEXT =
    "※これが自軍エリアにある間、必要パワーの数字が2以下のユニットはバトルエリアに出られず、効果名を持つテキストは無効になり発動もできない。 【電車斬り】このターン、これは、自軍ラッシュエリアに「モモタロス」「ウラタロス」「キンタロス」「リュウタロス」があれば「SP2」になる。";

  it("RK-334: カタログ本文・スペックが出典と一致（出典: atwiki/page-1369）", () => {
    expectCatalogText("RK-334", TEXT);
    expectStats("RK-334", { name: "仮面ライダー電王LF（2nd）", category: "OT", size: "S", bp: 4500, sp: "special", powerCost: "7-", comboNumber: 1, features: ["仮面ライダー", "男", "DEN-O", "2nd"], rushCondition: "zord_down_discard_feature" });
    expectRarityIn("RK-334", ["SR"]);
  });

  zeroCostTests("RK-334", "SPEC-DENO", "特徴「DEN-O」を持つ自軍ユニット1体", 7, "OT", "atwiki/page-1369「追加条件：特徴「DEN-O」を持つ自軍ユニット1体を捨札にすれば必要パワー0になる」");

  it("RK-334: ※ 自軍エリアにある間、必要パワー2以下のユニットは（自軍・敵軍とも）バトルエリアに出られない（3以上なら出られる）（出典: atwiki/page-1369「必要パワーの数字が2以下のユニットはバトルエリアに出られず」・コメント欄の回答「自軍もしくは敵軍の指定が無いため、すべての必要パワーの数字が2以下のユニットが効果の対象」）", () => {
    const s = board({ rush: [inst("RK-334", "lf"), inst("SPEC-C2", "low"), inst("SPEC-C3", "mid")] });
    expect(canEnter(s, "SPEC-C2:low")).toBe(false);
    expect(canEnter(s, "SPEC-C3:mid")).toBe(true);
    const e = enemyTurn({ rush: [inst("RK-334", "lf")] }, { rush: [inst("SPEC-C1", "low"), inst("SPEC-C3", "mid")] });
    expect(canEnter(e, "SPEC-C1:low", "player2")).toBe(false);
    expect(canEnter(e, "SPEC-C3:mid", "player2")).toBe(true);
  });

  it("RK-334: ※ 必要パワー2以下のユニットの効果名を持つテキストは発動できない（自軍 RK-326 ガルル獣人態【ガルルフエッスル】）（出典: atwiki/page-1369「効果名を持つテキストは無効になり発動もできない」）", () => {
    const s = rushPhase({ rush: [inst("RK-334", "lf"), inst("RK-326", "g")], deck: [inst("RK-246", "k")] });
    expect(canActivate(s, "RK-326:g")).toBe(false);
  });

  it("RK-334: ※ 敵軍の必要パワー2以下のユニットの効果名を持つテキストも発動できない（敵軍 RK-326【ガルルフエッスル】）（出典: atwiki/page-1369・コメント欄の回答）", () => {
    const s = st({ phase: "rush", activePlayer: "player2", player1: { rush: [inst("RK-334", "lf")], deck: deckCards(5) }, player2: { rush: [inst("RK-326", "g")], deck: [inst("RK-246", "k")] } }, EXTRA);
    expect(canActivate(s, "RK-326:g", "player2")).toBe(false);
  });

  it.fails("RK-334: ※ 必要パワー3以上のユニットの効果名を持つテキストは発動できる（RK-328 ドッガ怪人態【ドッガフエッスル】）（出典: atwiki/page-1369「必要パワーの数字が2以下のユニットは」）", () => {
    const s = rushPhase({ rush: [inst("RK-334", "lf"), inst("RK-328", "d")], deck: [inst("RK-312", "k")] });
    expect(canActivate(s, "RK-328:d")).toBe(true);
    expect(zoneOf(activate(s, "RK-328:d"), "player1", "RK-328:d")).toBe("discard");
  });

  const IMAGINS = () => [inst("RK-142", "mo"), inst("RK-143", "ur"), inst("RK-144", "ki"), inst("RK-145", "ry")];

  it("RK-334: 【電車斬り】NC（1番目）— 自軍ラッシュエリアにモモタロス・ウラタロス・キンタロス・リュウタロスがあれば「SP2」になる（出典: atwiki/page-1369「【電車斬り】このターン、これは、自軍ラッシュエリアに…があれば「SP2」になる」「CN：1」）", () => {
    const s = resolveAll(ncEnter("RK-334:lf", 0, { rush: IMAGINS() }, {}, EXTRA));
    expect(spOf(s, "player1", "RK-334:lf")).toBe(2);
    expect(canStrike(s, "RK-334:lf")).toBe(true);
  });

  it("RK-334: 【電車斬り】4枚のうち1枚でも欠ければ SP はない（出典: atwiki/page-1369「「SP：！」」）", () => {
    const s = resolveAll(ncEnter("RK-334:lf", 0, { rush: IMAGINS().slice(0, 3) }, {}, EXTRA));
    expect(spOf(s, "player1", "RK-334:lf")).toBe(0);
  });

  it("RK-334: NC が成立しなければ（2番目）4枚がそろっても SP はない（出典: atwiki/page-1369「CN：1」・R-CN-02）", () => {
    const s = resolveAll(ncEnter("RK-334:lf", 1, { rush: IMAGINS() }, {}, EXTRA));
    expect(spOf(s, "player1", "RK-334:lf")).toBe(0);
  });

  it.todo(
    "RK-334: 公式Q&A — 場にあっても XG7-059 トリガードーパント【ゲームスタート……】は発動できるが、ラッシュエリアに出た時点でユニットになるので「そうしたとき」以降は無効になる（出典: atwiki/page-1369 Q1）— XG7-059 が未実装（本範囲外のカード）",
  );
});

// ===========================================================================
describe("RK-335 モモタロス（2nd）", () => {
  const TEXT = "※レジスト ※これは特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される。 【最後までクライマックスだぜ！】「SP1」";

  it("RK-335: カタログ本文・スペックが出典と一致（出典: atwiki/page-1279（RK-310 と同じページ。スターター版））", () => {
    expectCatalogText("RK-335", TEXT);
    expectStats("RK-335", { name: "モモタロス（2nd）", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 4, features: ["イマジン", "2nd"] });
    expectRarityIn("RK-335", ["R"]);
  });

  it("RK-335: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留めるかを選べる（出典: atwiki/page-1279「※レジスト」・R-KW-RESIST）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-335", "mo")] }, "RK-335:mo"))).toBe(true);
  });

  it("RK-335: ※ 特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される（出典: atwiki/page-1279「※これは特徴「女」を持つユニットとバトルしたとき、バトルに勝っても撃破される」）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-335", "mo")] }, { battle: [inst("SPEC-FEMALE-ATK", "f")] }), "SPEC-FEMALE-ATK:f", "RK-335:mo", "player2"));
    expect(zoneOf(s, "player2", "SPEC-FEMALE-ATK:f")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-335:mo")).toBe("discard");
  });

  it("RK-335: 「女」を持たないユニットとのバトルに勝てば残る（出典: atwiki/page-1279）", () => {
    const s = resolveAll(attack(enemyTurn({ battle: [inst("RK-335", "mo")] }, { battle: [inst("TST-UNIT-0", "a")] }), "TST-UNIT-0:a", "RK-335:mo", "player2"));
    expect(zoneOf(s, "player1", "RK-335:mo")).toBe("battle");
  });

  it("RK-335: 【最後までクライマックスだぜ！】NC（4番目）で「SP1」になりストライクできる（出典: atwiki/page-1279「【最後までクライマックスだぜ！】「SP1」」「CN：4」）", () => {
    const s = ncEnter("RK-335:mo", 3, {}, {}, EXTRA);
    expect(spOf(s, "player1", "RK-335:mo")).toBe(1);
    expect(canStrike(s, "RK-335:mo")).toBe(true);
  });

  it("RK-335: NC 不成立（3番目）なら SP はない（出典: atwiki/page-1279「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RK-335:mo", 2, {}, {}, EXTRA);
    expect(spOf(s, "player1", "RK-335:mo")).toBe(0);
  });
});
