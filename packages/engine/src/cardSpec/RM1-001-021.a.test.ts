/**
 * カード別スペック: RM-001〜RM-007（スペシャルメタルエディション 蒸着〜世界忍者戦）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「RM-001」〜「RM-007」とカード名で検索。card_8 にあるのは RM-023 の項だけ）。atwiki に転載された公式 Q&A（RM-004 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RM-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CTR-01・R-KW-PERM-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RM-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア／スーパーレア／ノーマルレア／ノーマル」を MR／SR／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  attack,
  canCounter,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  damageOf,
  deckCards,
  destroyedInEnemyBattle,
  enterSeq,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  featuresOf,
  fill,
  heldN,
  inst,
  nextPhase,
  pick,
  played,
  powerCards,
  releasedCat,
  residentOp,
  resolveAll,
  rushBoard,
  rushed,
  skip,
  spOf,
  st,
  sUnit,
  toLeave,
  useCounter,
  zoneOf,
} from "./RM1-001-021.helpers";

const NOSP = sUnit("SPEC-NOSP", { category: "OT", bp: 1000, sp: undefined });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M" });
const MALE = sUnit("SPEC-MALE", { category: "OT", bp: 2000, features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { category: "OT", bp: 2000, features: ["女"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "OT", bp: 3000, size: "M", features: ["男"] });
const MECHA = sUnit("SPEC-MECHA", { category: "ET", bp: 2000, features: ["メカ"] });
const MECHA_HUMANOID = sUnit("SPEC-MH", { category: "ET", bp: 2000, features: ["メカ", "人型"] });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const E4500 = sUnit("SPEC-E4500", { bp: 4500 });
const EM4000 = sUnit("SPEC-EM4000", { bp: 4000, size: "M" });
const EM = sUnit("SPEC-EM", { bp: 1000, size: "M" });
const BEAST = sUnit("SPEC-BEAST", { bp: 1000, features: ["獣"] });
const DINO = sUnit("SPEC-DINO", { bp: 1000, features: ["恐竜"] });
const PLAIN = sUnit("SPEC-PLAIN", { bp: 1000 });
const OT_L = sUnit("SPEC-OT-L", { category: "OT", bp: 8000, size: "L", powerCost: 9 });
const ET_L = sUnit("SPEC-ET-L", { category: "ET", bp: 8000, size: "L" });
const NINJA = (cat: "WB" | "MA" | "OT" | "ET" | "DA") => sUnit(`SPEC-NIN-${cat}`, { category: cat, bp: 1000, features: ["忍者"] });
const NINJAS = (["WB", "MA", "OT", "ET", "DA"] as const).map(NINJA);
const NINJA_M = sUnit("SPEC-NIN-M", { category: "WB", bp: 3000, size: "M", features: ["忍者"] });
const EXTRA = [NOSP, OT_S, OT_M, MALE, FEMALE, MALE_M, MECHA, MECHA_HUMANOID, E4000, E4500, EM4000, EM, BEAST, DINO, PLAIN, OT_L, ET_L, NINJA_M, ...NINJAS];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoard(p1, p2, EXTRA);

// ===========================================================================
/** 蒸着・赤射・焼結（「次の効果から1つ選び発動する」の宇宙刑事ベルト系オペレーション）の共通テスト。 */
function metalBeltTests(opts: {
  id: string;
  name: string;
  cost: number;
  page: string;
  text: string;
  heroName: string;
  rushMode: string;
  otherMode: string;
  heroes: string[];
}) {
  const { id, page, rushMode, otherMode } = opts;
  const used = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    played(board({ hand: [inst(id, "op")], command: releasedCat("OT", 1), power: powerCards(opts.cost), ...p1 }), `${id}:op`);
  const heroDeck = (): CardInstance[] => [...opts.heroes.map((h, i) => inst(h, `h${i}`)), inst("RM-021", "x"), ...deckCards(3)];

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, opts.text);
    expectOpStats(id, { name: opts.name, category: "OT", powerCost: opts.cost });
    expectRarityIn(id, ["MR"]);
  });

  it(`${id}: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: ${page}「次の効果から1つ選び発動する」）`, () => {
    const s = used();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([rushMode, otherMode].sort());
  });

  it(`${id}: ◎1つ目 — 自軍山札の「${opts.heroName}」のカードから1枚選べる（ほかのカードは選べない・任意）（出典: ${page}「自軍山札から「${opts.heroName}」のカードを1枚選び、自軍ラッシュエリアに出してもよい」）`, () => {
    const s = pick(used({ deck: heroDeck() }), rushMode);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(opts.heroes.map((h, i) => `${h}:h${i}`).sort());
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ◎1つ目 — 選んだカードは自軍ラッシュエリアに出る（必要パワーを満たさなくてよい）。山札から離れる（出典: ${page}）`, () => {
    // パワーゾーンはこのカードの必要パワーの枚数だけ（ヒーローの必要パワーより少なくても出せる。本文に「ただし必要パワー…は満たすこと」がない）。
    const hero = `${opts.heroes[0]}:h0`;
    const s = resolveAll(pick(pick(used({ deck: heroDeck() }), rushMode), hero));
    expect(zoneOf(s, "player1", hero)).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(heroDeck().length - 1);
    expect(zoneOf(s, "player1", `${id}:op`)).toBe("discard");
  });

  it(`${id}: ◎1つ目 — 出さなくてもよい（ラッシュエリアは変わらない）（出典: ${page}「出してもよい」）`, () => {
    const s = resolveAll(skip(pick(used({ deck: heroDeck() }), rushMode)));
    expect(s.players.player1.rush).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(heroDeck().length);
  });

  it(`${id}: ◎2つ目 — 選べるのは自軍の S ユニット（ラッシュエリア・バトルエリア）だけ。M ユニット・敵軍のユニット・コマンドゾーンのユニットカードは選べない（出典: ${page}「自軍Sユニットを1体選ぶ」・カード評価「コマンドゾーンにあるユニットカードには使用できない」）`, () => {
    const s = pick(
      used({ rush: [inst("SPEC-OT-S", "a"), inst("SPEC-OT-M", "m")], battle: [inst("SPEC-NOSP", "b")], command: [...releasedCat("OT", 1), inst("SPEC-OT-S", "cmd")] }),
      otherMode,
    );
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["SPEC-NOSP:b", "SPEC-OT-S:a"]);
  });
}

// ===========================================================================
describe("RM-001 蒸着", () => {
  const TEXT =
    "次の効果から１つ選び発動する⇒◎自軍山札から「宇宙刑事ギャバン」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットはSP1/4になる。";

  metalBeltTests({
    id: "RM-001",
    name: "蒸着",
    cost: 4,
    page: "atwiki/page-888",
    text: TEXT,
    heroName: "宇宙刑事ギャバン",
    rushMode: "gavan_rush",
    otherMode: "sp_1_4",
    heroes: ["RM-018", "XG2-083"],
  });

  /** 蒸着の◎2つ目で SPEC-NOSP（印刷 SP なし）を選び、バトルフェイズに n 体の後へ出す。 */
  const sp14 = (fillers: number) => {
    let s = played(
      board({ hand: [inst("RM-001", "op")], command: releasedCat("OT", 1), power: powerCards(4), rush: [inst("SPEC-NOSP", "u"), ...fill(fillers)] }),
      "RM-001:op",
    );
    s = resolveAll(pick(pick(s, "sp_1_4"), "SPEC-NOSP:u"));
    s = nextPhase(s);
    return enterSeq(s, [...fill(fillers).map((c) => c.instanceId), "SPEC-NOSP:u"]);
  };

  it("RM-001: ◎2つ目 — 選んだユニットは SP1/4 になる（バトルエリアの4番目に並べば「SP1」）（出典: atwiki/page-888「このターン、選んだユニットはSP1/4になる」）", () => {
    expect(spOf(sp14(3), "player1", "SPEC-NOSP:u")).toBe(1);
  });

  it("RM-001: ◎2つ目 — SP1/4 のユニットは4番目以外では SP を持たない（出典: atwiki/page-888・R-STK-03（分数 SP は分母の位置で SP1））", () => {
    expect(spOf(sp14(2), "player1", "SPEC-NOSP:u")).toBe(0);
  });

  it("RM-001: 「宇宙刑事シャリバン×ギャバン×シャイダー」（XG7-068）は「宇宙刑事ギャバン」のカードではない（出典: atwiki/page-888「「宇宙刑事ギャバン」のカード」・atwiki/page-2433）", () => {
    const s = pick(
      played(board({ hand: [inst("RM-001", "op")], command: releasedCat("OT", 1), power: powerCards(4), deck: [inst("XG7-068", "x"), ...deckCards(3)] }), "RM-001:op"),
      "gavan_rush",
    );
    expect(choiceIds(s)).not.toContain("XG7-068:x");
  });
});

// ===========================================================================
describe("RM-002 赤射", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「宇宙刑事シャリバン」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットの特徴に「レッド」を追加する。";

  metalBeltTests({
    id: "RM-002",
    name: "赤射",
    cost: 2,
    page: "atwiki/page-889",
    text: TEXT,
    heroName: "宇宙刑事シャリバン",
    rushMode: "sharivan_rush",
    otherMode: "add_red",
    heroes: ["RM-025"],
  });

  it("RM-002: ◎2つ目 — 選んだユニットの特徴に「レッド」が追加される（ほかの自軍ユニットには追加されない）（出典: atwiki/page-889「このターン、選んだユニットの特徴に「レッド」を追加する」）", () => {
    let s = played(board({ hand: [inst("RM-002", "op")], command: releasedCat("OT", 1), power: powerCards(2), rush: [inst("SPEC-MALE", "u"), inst("SPEC-OT-S", "o")] }), "RM-002:op");
    s = resolveAll(pick(pick(s, "add_red"), "SPEC-MALE:u"));
    expect(featuresOf(s, "player1", "SPEC-MALE:u")).toEqual(["レッド", "男"].sort());
    expect(featuresOf(s, "player1", "SPEC-OT-S:o")).toEqual([]);
  });
});

// ===========================================================================
describe("RM-003 焼結", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「宇宙刑事シャイダー」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後山札をシャッフルする。◎自軍Sユニットを1体選ぶ。このターン、選んだユニットの特徴に「ブルー」を追加する。";

  metalBeltTests({
    id: "RM-003",
    name: "焼結",
    cost: 3,
    page: "atwiki/page-890",
    text: TEXT,
    heroName: "宇宙刑事シャイダー",
    rushMode: "shaider_rush",
    otherMode: "add_blue",
    heroes: ["XG1-083", "XG4-094"],
  });

  it("RM-003: ◎2つ目 — 選んだユニットの特徴に「ブルー」が追加される（出典: atwiki/page-890「このターン、選んだユニットの特徴に「ブルー」を追加する」）", () => {
    let s = played(board({ hand: [inst("RM-003", "op")], command: releasedCat("OT", 1), power: powerCards(3), rush: [inst("SPEC-MALE", "u")] }), "RM-003:op");
    s = resolveAll(pick(pick(s, "add_blue"), "SPEC-MALE:u"));
    expect(featuresOf(s, "player1", "SPEC-MALE:u")).toEqual(["ブルー", "男"].sort());
  });
});

// ===========================================================================
describe("RM-004 巨獣特捜", () => {
  const TEXT =
    "敵軍山札の上から、自軍ダメージの点数と同じ数までオモテにする。そして、オモテにしたカードの中から、特徴「獣」または「恐竜」を持つユニットカードを好きな順で持ち主のラッシュエリアに出し、それ以外は山札に戻してシャッフルする。そうして出したユニットが1体以上あれば、自軍山札を見て、OTのLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  /** 自軍ダメージ damage 点（パワーゾーンは計8枚）で巨獣特捜を使う。 */
  const used = (damage: number, enemyDeck: CardInstance[], ownDeck: CardInstance[] = deckCards(3)) =>
    played(
      board(
        { hand: [inst("RM-004", "op")], command: releasedCat("OT", 1), power: [...powerCards(8 - damage), ...damageCards(damage)], deck: ownDeck },
        { deck: enemyDeck },
      ),
      "RM-004:op",
    );
  const OWN_DECK = [inst("SPEC-OT-L", "l"), inst("RM-020", "dol"), inst("SPEC-ET-L", "el"), inst("SPEC-OT-S", "os"), ...deckCards(2)];

  it("RM-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-891）", () => {
    expectCatalogText("RM-004", TEXT);
    expectOpStats("RM-004", { name: "巨獣特捜", category: "OT", powerCost: 8 });
    expectRarityIn("RM-004", ["MR"]);
  });

  it("RM-004: 敵軍山札の上から自軍ダメージの数だけオモテにし、特徴「獣」「恐竜」のユニットカードは持ち主（敵軍）のラッシュエリアに出る。それ以外は敵軍山札に戻る（出典: atwiki/page-891）", () => {
    const enemyDeck = [inst("SPEC-BEAST", "b1"), inst("SPEC-PLAIN", "p1"), inst("SPEC-DINO", "d1"), ...deckCards(3, "e")];
    const s = resolveAll(used(3, enemyDeck));
    expect(zoneOf(s, "player2", "SPEC-BEAST:b1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-DINO:d1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-PLAIN:p1")).toBe("deck");
    expect(s.players.player2.deck).toHaveLength(4);
  });

  it("RM-004: オモテにするのは自軍ダメージの数まで（4枚目より下の「獣」は出ない）（出典: atwiki/page-891「自軍ダメージの点数と同じ数まで」）", () => {
    const enemyDeck = [inst("SPEC-PLAIN", "p1"), inst("SPEC-BEAST", "b1"), inst("SPEC-BEAST", "b2"), ...deckCards(3, "e")];
    const s = resolveAll(used(2, enemyDeck));
    expect(zoneOf(s, "player2", "SPEC-BEAST:b1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-BEAST:b2")).toBe("deck");
  });

  it("RM-004: 1体以上出したら、自軍山札の OT の L ユニットのカードから1枚選べる（任意）（出典: atwiki/page-891「そうして出したユニットが1体以上あれば、自軍山札を見て、OTのLユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい」）", () => {
    const t = used(1, [inst("SPEC-BEAST", "b1"), ...deckCards(3, "e")], OWN_DECK);
    expectChoiceFrom(t, "player1", "RM-004");
    expect(choiceIds(t)).toEqual(["RM-020:dol", "SPEC-OT-L:l"]);
    expect(canSkip(t)).toBe(true);
  });

  // atwiki/page-891 Q1/A1「いいえ。テキストに追加条件についての項目はありませんので、追加条件を満たす必要はありません。」
  it("RM-004: 公式Q&A — 自軍山札から出す L ユニットは追加条件を満たさなくてよい（電子星獣ドルを、ドルギランを捨札にせずに出せる）（出典: atwiki/page-891 Q1）", () => {
    const s = resolveAll(pick(used(1, [inst("SPEC-BEAST", "b1"), ...deckCards(3, "e")], OWN_DECK), "RM-020:dol"));
    expect(zoneOf(s, "player1", "RM-020:dol")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(OWN_DECK.length - 1);
  });

  it("RM-004: 「獣」「恐竜」のユニットカードを1枚も出さなければ、自軍山札からは出せない（出典: atwiki/page-891「そうして出したユニットが1体以上あれば」）", () => {
    const s = used(2, [inst("SPEC-PLAIN", "p1"), inst("SPEC-PLAIN", "p2"), ...deckCards(3, "e")], OWN_DECK);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-004");
    const done = resolveAll(s);
    expect(done.players.player1.rush).toHaveLength(0);
    expect(done.players.player2.deck).toHaveLength(5);
  });

  it.todo(
    "RM-004: オモテにする枚数を自軍ダメージの数より少なくできるか（「同じ数まで」）— 本文の「まで」を確かめる出典がない。本スペックは常に自軍ダメージの数（山札が足りなければ全部）をオモテにする前提で、枚数の指定を公開 API で選ぶ手段がない",
  );
});

// ===========================================================================
describe("RM-005 ダブルスナイパー", () => {
  const TEXT =
    "特徴「男」を持つ自軍ユニットを1体と、特徴「女」を持つ自軍ユニットを1体選び、選んだ2体の本来のBPを合計する。そして、合計したBP以下の敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  const used = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    played(
      board(
        { hand: [inst("RM-005", "op")], command: releasedCat("OT", 1), power: powerCards(6), rush: [inst("SPEC-MALE", "m"), inst("SPEC-FEMALE", "f"), inst("SPEC-OT-S", "o")], battle: [inst("SPEC-MALE-M", "mm")], ...p1 },
        { rush: [inst("SPEC-E4000", "e4"), inst("SPEC-E4500", "e45")], battle: [inst("SPEC-EM4000", "em4")] },
      ),
      "RM-005:op",
    );

  it("RM-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-892）", () => {
    expectCatalogText("RM-005", TEXT);
    expectOpStats("RM-005", { name: "ダブルスナイパー", category: "OT", powerCost: 6 });
    expectRarityIn("RM-005", ["MR", "N"]);
  });

  it("RM-005: まず特徴「男」を持つ自軍ユニット（サイズ・エリアを問わない）を選ぶ（出典: atwiki/page-892「特徴「男」を持つ自軍ユニットを1体」・カード評価「サイズ・カテゴリを問わない」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "RM-005");
    expect(choiceIds(s)).toEqual(["SPEC-MALE-M:mm", "SPEC-MALE:m"].sort());
  });

  it("RM-005: 次に特徴「女」を持つ自軍ユニットを選ぶ（出典: atwiki/page-892「特徴「女」を持つ自軍ユニットを1体選び」）", () => {
    const s = pick(used(), "SPEC-MALE:m");
    expectChoiceFrom(s, "player1", "RM-005");
    expect(choiceIds(s)).toEqual(["SPEC-FEMALE:f"]);
  });

  it("RM-005: 2体の本来の BP の合計（2000＋2000）以下の敵軍ユニット（サイズ・エリアを問わない）を選ぶ（出典: atwiki/page-892「合計したBP以下の敵軍ユニットを1体選び」）", () => {
    const s = pick(pick(used(), "SPEC-MALE:m"), "SPEC-FEMALE:f");
    expectChoiceFrom(s, "player1", "RM-005");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:e4", "SPEC-EM4000:em4"].sort());
  });

  it("RM-005: 合計するのは本来の BP（選んだユニットが BP+3000 されていても合計は 4000）（出典: atwiki/page-892「選んだ2体の本来のBPを合計する」）", () => {
    const s = pick(pick(used({ rush: [{ ...inst("SPEC-MALE", "m"), bpModifier: 3000 }, inst("SPEC-FEMALE", "f")] }), "SPEC-MALE:m"), "SPEC-FEMALE:f");
    expect(choiceIds(s)).not.toContain("SPEC-E4500:e45");
  });

  it("RM-005: 選んだ敵軍ユニットは持ち主のパワーゾーンに送られる（ダメージではない）（出典: atwiki/page-892「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(pick(pick(used(), "SPEC-MALE:m"), "SPEC-FEMALE:f"), "SPEC-EM4000:em4"));
    expect(zoneOf(s, "player2", "SPEC-EM4000:em4")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-EM4000:em4")?.faceDown).toBeFalsy();
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("RM-006 怒（いか）る！", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 特徴「男」または「女」を持つ自軍ユニットが撃破されて捨札になったとき発動できる⇒特徴「メカ」と「人型」を持つ自軍ユニットの数と同じ数まで敵軍Sユニットを選び、選んだユニットを好きな順で持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  const ENEMY = [inst("SPEC-E4000", "s1"), inst("SPEC-E4500", "s2"), inst("SPEC-EM", "m")];
  /** 自軍の victim が敵軍ターンに撃破され、離場の反応ウィンドウが開いたところ。自軍ラッシュエリアに「メカ」「人型」のユニットが mh 体。 */
  const destroyed = (victim = "SPEC-MALE", mh = 1, p2: Partial<GameState["players"]["player2"]> = {}) =>
    destroyedInEnemyBattle(
      inst(victim, "v"),
      {
        hand: [inst("RM-006", "op")],
        command: releasedCat("ET", 1),
        power: powerCards(6),
        rush: [...Array.from({ length: mh }, (_, i) => inst("SPEC-MH", `mh${i}`)), inst("SPEC-MECHA", "mc")],
      },
      { rush: ENEMY, ...p2 },
      EXTRA,
    );

  it("RM-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-879）", () => {
    expectCatalogText("RM-006", TEXT);
    expectOpStats("RM-006", { name: "怒（いか）る！", category: "ET", powerCost: 6 });
    expectRarityIn("RM-006", ["MR"]);
  });

  it("RM-006: 特徴「男」「女」を持つ自軍ユニットが撃破されて捨札になったとき使える。「男」「女」を持たないユニットのときは使えない（出典: atwiki/page-879）", () => {
    expect(canCounter(destroyed("SPEC-MALE"), "RM-006:op")).toBe(true);
    expect(canCounter(destroyed("SPEC-FEMALE"), "RM-006:op")).toBe(true);
    expect(canCounter(destroyed("SPEC-MECHA"), "RM-006:op")).toBe(false);
  });

  it("RM-006: ※カウンター — 自軍ターン中は使えない（出典: atwiki/page-879「これは敵軍ターン中にのみ使用できる」・R-CTR-01）", () => {
    let s = st(
      {
        phase: "battle",
        player1: { battle: [inst("SPEC-MALE", "v")], rush: [inst("SPEC-MH", "mh")], hand: [inst("RM-006", "op")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "big")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    s = toLeave(attack(s, "SPEC-MALE:v", "TST-UNIT-7:big"));
    expect(canCounter(s, "RM-006:op")).toBe(false);
  });

  it("RM-006: 選べるのは敵軍の S ユニット（ラッシュエリア・バトルエリア）。M・L ユニットは選べない（出典: atwiki/page-879「敵軍Sユニットを選び」・カード評価「エリアを問わずに除去できる」）", () => {
    const s = useCounter(destroyed(), "RM-006:op");
    expectChoiceFrom(s, "player1", "RM-006");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:s1", "SPEC-E4500:s2"]);
  });

  it("RM-006: 選べる数は「メカ」と「人型」を両方持つ自軍ユニットの数まで（1体なら1体でおしまい）。選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-879「特徴「メカ」と「人型」を持つ自軍ユニットの数と同じ数まで…ホールド状態で置く」）", () => {
    const s = resolveAll(pick(useCounter(destroyed("SPEC-MALE", 1), "RM-006:op"), "SPEC-E4000:s1"));
    expect(zoneOf(s, "player2", "SPEC-E4000:s1")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-E4000:s1")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-E4500:s2")).toBe("rush");
  });

  it("RM-006: 「メカ」「人型」のユニットが2体なら2体まで選べる（出典: atwiki/page-879）", () => {
    let s = pick(useCounter(destroyed("SPEC-MALE", 2), "RM-006:op"), "SPEC-E4000:s1");
    expect(choiceIds(s)).toEqual(["SPEC-E4500:s2"]);
    s = pick(s, "SPEC-E4500:s2");
    if (s.pendingEffectChoice?.sourceCardId === "RM-006") s = confirm(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E4000:s1")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-E4500:s2")).toBe("command");
  });

  it("RM-006: 持ち主のコマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-879「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(useCounter(destroyed("SPEC-MALE", 1, { command: heldN(5, "TST-OP", "ec") }), "RM-006:op"), "SPEC-E4000:s1"));
    expect(zoneOf(s, "player2", "SPEC-E4000:s1")).toBe("discard");
  });
});

// ===========================================================================
describe("RM-007 世界忍者戦", () => {
  const TEXT =
    "※常駐 自軍ラッシュフェイズ中、自軍ユニットをラッシュしたとき、本来の特徴に「忍者」を持つすべてのユニットの本来のカテゴリを見て、WB、MA、OT、ET、DAがそれぞれ1つ以上あれば、次の効果を発動できる⇒特徴「忍者」を持たない敵軍Sユニットをすべて持ち主のパワーゾーンにダメージにして置く。";

  const ALL_NINJAS = NINJAS.map((n, i) => inst(n.id, `n${i}`));
  const ENEMY = [inst("SPEC-E4000", "s1"), inst("SPEC-NIN-WB", "en"), inst("SPEC-EM", "m")];
  /** 自軍ラッシュフェイズ、世界忍者戦を常駐させ、手札の TST-UNIT-0 をラッシュする。 */
  const rushWith = (own: CardInstance[], enemy: CardInstance[] = ENEMY) =>
    rushed(
      board(
        { operation: [residentOp("RM-007", "op")], rush: own, hand: [inst("TST-UNIT-0", "r")], command: releasedCat("WB", 1), deck: deckCards(5) },
        { rush: enemy },
      ),
      "TST-UNIT-0:r",
    );

  it("RM-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-831）", () => {
    expectCatalogText("RM-007", TEXT);
    expectOpStats("RM-007", { name: "世界忍者戦", category: "MA", powerCost: 6 });
    expectRarityIn("RM-007", ["MR"]);
  });

  it("RM-007: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-831・R-KW-PERM-01）", () => {
    const s = resolveAll(played(board({ hand: [inst("RM-007", "op")], command: releasedCat("MA", 1), power: powerCards(6) }), "RM-007:op"));
    expect(zoneOf(s, "player1", "RM-007:op")).toBe("operation");
  });

  it("RM-007: 「忍者」のユニットのカテゴリに WB・MA・OT・ET・DA がそろっていれば、自軍ユニットをラッシュしたとき発動できる（任意）（出典: atwiki/page-831「次の効果を発動できる」）", () => {
    const s = rushWith(ALL_NINJAS);
    expectChoiceFrom(s, "player1", "RM-007");
    expect(canSkip(s)).toBe(true);
  });

  it("RM-007: 発動すると「忍者」を持たない敵軍 S ユニットがすべてダメージになる（「忍者」の S ユニット・M ユニットは残る）（出典: atwiki/page-831「特徴「忍者」を持たない敵軍Sユニットをすべて持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(accept(rushWith(ALL_NINJAS)));
    expect(zoneOf(s, "player2", "SPEC-E4000:s1")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E4000:s1")?.faceDown).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-NIN-WB:en")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RM-007: カテゴリが1つでも欠けていれば発動しない（出典: atwiki/page-831「それぞれ1つ以上あれば」）", () => {
    const s = rushWith(ALL_NINJAS.slice(0, 4), [inst("SPEC-E4000", "s1")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RM-007");
    expect(zoneOf(resolveAll(s), "player2", "SPEC-E4000:s1")).toBe("rush");
  });

  it("RM-007: 敵軍の「忍者」のユニットのカテゴリも数える（出典: atwiki/page-831「本来の特徴に「忍者」を持つすべてのユニット」）", () => {
    // 自軍は WB 以外の4体。敵軍の SPEC-NIN-WB（WB の「忍者」）で5つそろう。
    const s = rushWith(ALL_NINJAS.slice(1), ENEMY);
    expectChoiceFrom(s, "player1", "RM-007");
  });

});
