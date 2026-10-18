/**
 * カード別スペック: BK-008〜BK-014（ザ・マスクドライダーエクスパンション ベルトコレクションBOX ゼクロスベルト〜ファイズドライバー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「BK-」とカード名で検索）。本範囲のカードページに atwiki 転載の公式 Q&A はない。atwiki/page-1084 Q1（「これは「○○」として使える」カードは
 *     山札・手札などでもそのカード名として選べる。BK-001 の Q）を本範囲のカード名の指定にも当てはめる
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-BK-NNN.md）・atwiki/page-1739「カード名」
 *  3. docs/rules/*.md の一般ルール（R-RUSH-20/21・R-VEH 系）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-BK-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  beltUsed,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  deckOrder,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  faceUpResident,
  heldN,
  inst,
  nextPhase,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  searchBeltTests,
  skip,
  sUnit,
  vehicleCard,
  zoneOf,
  type Cat,
} from "./BK1-001-019.helpers";

const PLAIN = sUnit("SPEC-PLAIN", { category: "ET", bp: 3000 });
const CYBORG_M = sUnit("SPEC-CYBORG-M", { category: "ET", bp: 3000, size: "M", features: ["改造人間"] });
const MECHA_E = sUnit("SPEC-MECHA-E", { bp: 1000, features: ["メカ"] });
const M_VEHICLE = vehicleCard("SPEC-MV", { size: "M" });
const EXTRA = [PLAIN, CYBORG_M, MECHA_E, M_VEHICLE];

const used = (id: string, cat: Cat, cost: number, p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  beltUsed(id, cat, cost, p1, p2, EXTRA);

/** 「次の効果から1つ選び発動する⇒◎自分の手札から「X」のカードを1枚選び、自軍ラッシュエリアに出してもよい。◎…」の◎1つ目の共通テスト。 */
function handRushTests(opts: { id: string; cat: Cat; cost: number; page: string; heroName: string; otherMode: string; heroes: string[]; others: string[]; othersWhy: string }) {
  const { id, page } = opts;
  const hand = () => [...opts.heroes.map((h, i) => inst(h, `h${i}`)), ...opts.others.map((h, i) => inst(h, `x${i}`))];
  const usedWith = () => used(id, opts.cat, opts.cost, { hand: hand() });
  // 既知の不具合: CARD-BK-009・010・013 — 2つの効果の選択が本文の再録の汎用の分岐（"0"/"1"）で、手札から出す効果の候補・出し方が本文と合わない。
  const t = it.fails;

  t(`${id}: 使うと、2つの効果のどちらを発動するかを選ぶ（出典: ${page}「次の効果から1つ選び発動する」）`, () => {
    const s = usedWith();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["rush", opts.otherMode].sort());
  });

  t(`${id}: ◎1つ目 — 自分の手札の「${opts.heroName}」のカードから1枚選べる（任意）（出典: ${page}「自分の手札から「${opts.heroName}」のカードを1枚選び、自軍ラッシュエリアに出してもよい」・atwiki/page-1084 Q1・${opts.othersWhy}）`, () => {
    const s = pick(usedWith(), "rush");
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(opts.heroes.map((h, i) => `${h}:h${i}`).sort());
    expect(canSkip(s)).toBe(true);
  });

  t(`${id}: ◎1つ目 — 選んだカードは自軍ラッシュエリアに出る（必要パワーを満たさなくてよい）（出典: ${page}（本文に「ただし必要パワー…は満たすこと」がない）・R-RUSH-20）`, () => {
    const hero = `${opts.heroes[0]}:h0`;
    const s = resolveAll(pick(pick(usedWith(), "rush"), hero));
    expect(zoneOf(s, "player1", hero)).toBe("rush");
    expect(zoneOf(s, "player1", `${id}:op`)).toBe("discard");
  });

  t(`${id}: ◎1つ目 — 出さなくてもよい（出典: ${page}「出してもよい」）`, () => {
    const s = resolveAll(skip(pick(usedWith(), "rush")));
    expect(s.players.player1.rush).toHaveLength(0);
    expect(s.players.player1.hand).toHaveLength(hand().length);
  });
}

// ===========================================================================
describe("BK-008 ゼクロスベルト", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダーZX」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍コマンドゾーンから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと。";

  searchBeltTests({
    id: "BK-008",
    name: "ゼクロスベルト",
    cat: "ET",
    cost: 2,
    page: "atwiki/page-721",
    text: TEXT,
    heroName: "仮面ライダーZX",
    otherMode: "command_rush",
    heroes: ["RK-100", "XG1-051", "XG4-077"],
    others: ["RK-023"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない）",
  });

  /** パワーゾーン4枚。コマンドゾーンに 改造人間 S（必要パワー4・5）、改造人間でない S、改造人間の M、ハカイダー（4+。追加条件は「メカ」の敵軍ユニット）。 */
  const command = () => [inst("RK-023", "c4"), { ...inst("RK-100", "held"), commandHeld: true }, inst("RK-097", "c5"), inst("SPEC-PLAIN", "p"), inst("SPEC-CYBORG-M", "m"), inst("XG2-101", "hk")];
  const board = (p2: Partial<GameState["players"]["player2"]> = {}) => used("BK-008", "ET", 2, { command: command(), power: powerCards(4) }, p2);

  it.fails("BK-008: ◎2つ目 — 自軍コマンドゾーン（リリース状態・ホールド状態とも）の、特徴「改造人間」を持つ S ユニットのカードで、必要パワーと追加条件を満たすものから1枚選ぶ（見送れない）（出典: atwiki/page-721「自軍コマンドゾーンから、特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出す。ただし、必要パワーと追加条件は満たすこと」・R-RUSH-21）", () => {
    const s = pick(board(), "command_rush");
    expectChoiceFrom(s, "player1", "BK-008");
    expect(choiceIds(s)).toEqual(["RK-023:c4", "RK-100:held"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("BK-008: ◎2つ目 — 追加条件（ハカイダー: 特徴「メカ」を持つ敵軍ユニットがある）を満たせば選べる（出典: atwiki/page-721「ただし、必要パワーと追加条件は満たすこと」）", () => {
    const s = pick(board({ rush: [inst("SPEC-MECHA-E", "e")] }), "command_rush");
    expect(choiceIds(s)).toEqual(["RK-023:c4", "RK-100:held", "XG2-101:hk"]);
  });

  it.fails("BK-008: ◎2つ目 — 選んだカードは自軍ラッシュエリアに出る（出典: atwiki/page-721「自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(pick(pick(board(), "command_rush"), "RK-023:c4"));
    expect(zoneOf(s, "player1", "RK-023:c4")).toBe("rush");
  });

  it.fails("BK-008: ◎2つ目 — 選べるカードがなければ何もしない（出典: atwiki/page-721）", () => {
    const s = resolveAll(pick(used("BK-008", "ET", 2, { command: [inst("SPEC-PLAIN", "p")] }), "command_rush"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "SPEC-PLAIN:p")).toBe("command");
  });
});

// ===========================================================================
describe("BK-009 キングストーン（太陽の石）", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自分の手札から「仮面ライダーBLACK」のカードを1枚選び、自軍ラッシュエリアに出してもよい。◎自軍Sビークルを1体選ぶ。このターン、選んだビークルは、ライドされていなくてもバトルエリアに出すことができる。";

  it("BK-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-725）", () => {
    expectCatalogText("BK-009", TEXT);
    expectOpStats("BK-009", { name: "キングストーン（太陽の石）", category: "MA", powerCost: 1 });
    expectRarityIn("BK-009", ["N"]);
  });

  handRushTests({
    id: "BK-009",
    cat: "MA",
    cost: 1,
    page: "atwiki/page-725",
    heroName: "仮面ライダーBLACK",
    otherMode: "vehicle_without_ride",
    heroes: ["RK-027", "XG3-046"],
    others: ["RK-261", "XG3-048"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない。「仮面ライダーBLACK RX」は別のカード名）",
  });

  it.fails("BK-009: ◎2つ目 — 自軍ラッシュエリアの S ビークルから1体選ぶ（M ビークル・ユニット・敵軍のビークルは選べない）（出典: atwiki/page-725「自軍Sビークルを1体選ぶ」）", () => {
    const s = pick(used("BK-009", "MA", 1, { rush: [inst("RK-323", "v"), inst("SPEC-MV", "mv"), inst("SPEC-PLAIN", "u")] }, { rush: [inst("RK-323", "ev")] }), "vehicle_without_ride");
    expectChoiceFrom(s, "player1", "BK-009");
    expect(choiceIds(s)).toEqual(["RK-323:v"]);
  });

  it.fails("BK-009: ◎2つ目 — このターン、選んだビークルはライドされていなくてもバトルエリアに出せる（出典: atwiki/page-725「このターン、選んだビークルは、ライドされていなくてもバトルエリアに出すことができる」）", () => {
    let s = used("BK-009", "MA", 1, { rush: [inst("RK-323", "v"), inst("RK-323", "w")] });
    s = nextPhase(resolveAll(pick(pick(s, "vehicle_without_ride"), "RK-323:v")));
    expect(canEnter(s, "RK-323:v")).toBe(true);
    expect(canEnter(s, "RK-323:w")).toBe(false);
  });
});

// ===========================================================================
describe("BK-010 サンライザー", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自分の手札から「仮面ライダーBLACK RX」のカードを1枚選び、自軍ラッシュエリアに出してもよい。◎1枚ドローする。その後、自分の手札からカードを1枚選び、自軍山札の上に戻す。";

  it("BK-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-726）", () => {
    expectCatalogText("BK-010", TEXT);
    expectOpStats("BK-010", { name: "サンライザー", category: "MA", powerCost: 3 });
    expectRarityIn("BK-010", ["N"]);
  });

  handRushTests({
    id: "BK-010",
    cat: "MA",
    cost: 3,
    page: "atwiki/page-726",
    heroName: "仮面ライダーBLACK RX",
    otherMode: "draw_return",
    heroes: ["RK-261", "XG3-048"],
    others: ["RK-027"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない）",
  });

  const drawBoard = () => used("BK-010", "MA", 3, { hand: [inst("SPEC-PLAIN", "a")], deck: [inst("RK-027", "top"), ...deckCards(3)] });

  it.fails("BK-010: ◎2つ目 — 1枚ドローしてから、手札のカード（ドローしたカードを含む）を1枚選ぶ（見送れない）（出典: atwiki/page-726「1枚ドローする。その後、自分の手札からカードを1枚選び」）", () => {
    const s = pick(drawBoard(), "draw_return");
    expectChoiceFrom(s, "player1", "BK-010");
    expect(choiceIds(s)).toEqual(["RK-027:top", "SPEC-PLAIN:a"]);
    expect(canSkip(s)).toBe(false);
  });

  it.fails("BK-010: ◎2つ目 — 選んだカードは自軍山札の上に戻る（出典: atwiki/page-726「自軍山札の上に戻す」）", () => {
    const s = resolveAll(pick(pick(drawBoard(), "draw_return"), "SPEC-PLAIN:a"));
    expect(deckOrder(s)[0]).toBe("SPEC-PLAIN:a");
    expect(s.players.player1.hand.map((c) => c.instanceId)).toEqual(["RK-027:top"]);
  });
});

// ===========================================================================
/** アークル・オルタリング（「自分の手札か、自軍常駐置き場でオモテ向きになっているカードの中から、本来の特徴に「X」を持つユニットカードを1枚選び…」）の共通テスト。 */
function handResidentTests(opts: { id: string; name: string; page: string; text: string; feature: string; handOk: string[]; residentOk: string; handNg: string[]; ngWhy: string }) {
  const { id, page } = opts;
  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    used(id, "MA", 3, {
      hand: [...opts.handOk.map((h, i) => inst(h, `h${i}`)), ...opts.handNg.map((h, i) => inst(h, `x${i}`))],
      operation: [faceUpResident(opts.residentOk, "res"), { ...inst(opts.residentOk, "down"), faceDown: true }],
      ...p1,
    });
  // 既知の不具合: CARD-BK-011・012 — 常駐のオペレーションとして扱われ、候補・追加条件・ドローが本文と合わない。
  const t = it.fails;

  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, opts.text);
    expectOpStats(id, { name: opts.name, category: "MA", powerCost: 3 });
    expectRarityIn(id, ["N"]);
  });

  t(`${id}: 手札と、自軍常駐置き場でオモテ向きのカードの中から、本来の特徴に「${opts.feature}」を持つユニットカードを1枚選ぶ（常駐置き場のウラ向きのカードは選べない。見送れない）（出典: ${page}「自分の手札か、自軍常駐置き場でオモテ向きになっているカードの中から、本来の特徴に「${opts.feature}」を持つユニットカードを1枚選び、ラッシュエリアに出す」・${opts.ngWhy}）`, () => {
    const s = board();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([...opts.handOk.map((h, i) => `${h}:h${i}`), `${opts.residentOk}:res`].sort());
    expect(canSkip(s)).toBe(false);
  });

  t(`${id}: 手札から選んだカードは自軍ラッシュエリアに出て（必要パワーは満たさなくてよい）、1枚ドローする（このカードは常駐せず捨札）（出典: ${page}「ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、手札から選んだ場合は1枚ドローする」）`, () => {
    const s = resolveAll(pick(board({ deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] }), `${opts.handOk[0]}:h0`));
    expect(zoneOf(s, "player1", `${opts.handOk[0]}:h0`)).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("hand");
    expect(zoneOf(s, "player1", `${id}:op`)).toBe("discard");
  });

  t(`${id}: 常駐置き場から選んだカードは自軍ラッシュエリアに出て、ドローはしない（出典: ${page}「手札から選んだ場合は1枚ドローする」）`, () => {
    const s = resolveAll(pick(board({ deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] }), `${opts.residentOk}:res`));
    expect(zoneOf(s, "player1", `${opts.residentOk}:res`)).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("deck");
  });
}

// ===========================================================================
describe("BK-011 アークル", () => {
  handResidentTests({
    id: "BK-011",
    name: "アークル",
    page: "atwiki/page-727",
    text: "自分の手札か、自軍常駐置き場でオモテ向きになっているカードの中から、本来の特徴に「アマダム」を持つユニットカードを1枚選び、ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、手札から選んだ場合は1枚ドローする。",
    feature: "アマダム",
    handOk: ["RK-029", "XG2-073"],
    residentOk: "RK-102",
    handNg: ["RK-105", "SK-004"],
    ngWhy: "SK-004 クウガUF は追加条件（自軍常駐置き場のカードを4枚捨札にする）を満たせない",
  });

  it.fails("BK-011: 追加条件を満たせるカード（SX-002 クウガRU: カード名に「クウガ」を含む自軍ユニット1体を捨札にする）は選べ、出すときに追加条件を実行する（出典: atwiki/page-727「ただし、追加条件は満たすこと」・R-RUSH-21）", () => {
    let s = used("BK-011", "MA", 3, { hand: [inst("SX-002", "ru")], rush: [inst("XG2-073", "kuuga")] });
    expect(choiceIds(s)).toEqual(["SX-002:ru"]);
    s = resolveAll(pick(s, "SX-002:ru"));
    expect(zoneOf(s, "player1", "SX-002:ru")).toBe("rush");
    expect(zoneOf(s, "player1", "XG2-073:kuuga")).toBe("discard");
  });

  it("BK-011: 選べるカードがなければ何もしない（ドローもしない）（出典: atwiki/page-727）", () => {
    const s = resolveAll(used("BK-011", "MA", 3, { hand: [inst("SPEC-PLAIN", "a")] }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.hand).toHaveLength(1);
  });
});

// ===========================================================================
describe("BK-012 オルタリング", () => {
  handResidentTests({
    id: "BK-012",
    name: "オルタリング",
    page: "atwiki/page-728",
    text: "自分の手札か、自軍常駐置き場でオモテ向きになっているカードの中から、本来の特徴に「賢者の石」を持つユニットカードを1枚選び、ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、手札から選んだ場合は1枚ドローする。",
    feature: "賢者の石",
    handOk: ["RK-105", "XG3-076"],
    residentOk: "RK-162",
    handNg: ["XG3-077", "RK-029"],
    ngWhy: "XG3-077 アギトトルネイダーはビークルカードで「ユニットカード」ではない",
  });
});

// ===========================================================================
describe("BK-013 Vバックル（龍騎）", () => {
  const TEXT =
    "次の効果から1つ選び発動する。◎自分の手札から「仮面ライダー龍騎」のカードを1枚選び、自軍ラッシュエリアに出してもよい。◎このターン、特徴「ミラーライダー」を持つユニットカードの必要パワーの数字は、自軍エリアにある特徴「ミラーモンスター」を持つユニット1体につき1少なくなる。";

  it("BK-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-713）", () => {
    expectCatalogText("BK-013", TEXT);
    expectOpStats("BK-013", { name: "Vバックル（龍騎）", category: "WB", powerCost: 3 });
    expectRarityIn("BK-013", ["N"]);
  });

  handRushTests({
    id: "BK-013",
    cat: "WB",
    cost: 3,
    page: "atwiki/page-713",
    heroName: "仮面ライダー龍騎",
    otherMode: "mirror_cost",
    heroes: ["RK-033", "XG2-079", "RK-332", "XG1-065"],
    others: ["RK-333", "SK-000", "XG7-036"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない。XG1-065 ディケイド 龍騎は「これは「仮面ライダー龍騎」として使える」。RK-332 は「（2nd）」の区別表記で同じカード名）",
  });

  /** ◎2つ目の後、手札の龍騎（必要パワー6）をパワーゾーン4枚で出せるか。 */
  const mirror = (p1: Partial<GameState["players"]["player1"]>) => {
    const s = resolveAll(pick(used("BK-013", "WB", 3, { hand: [inst("RK-033", "ryuki")], power: powerCards(4), command: releasedCat("WB", 1), ...p1 }), "mirror_cost"));
    return canStartRush(s, "player1", "RK-033:ryuki");
  };

  it.fails("BK-013: ◎2つ目 — 自軍エリアに「ミラーモンスター」のユニットが2体あれば、ミラーライダーの必要パワーは2少なくなる（龍騎 6 → 4）（出典: atwiki/page-713「自軍エリアにある特徴「ミラーモンスター」を持つユニット1体につき1少なくなる」）", () => {
    expect(mirror({ rush: [inst("RK-034", "m1")], battle: [inst("RK-035", "m2")] })).toBe(true);
  });

  it.fails("BK-013: ◎2つ目 — 「ミラーモンスター」が1体なら1少なくなるだけ（龍騎 6 → 5 でパワーゾーン4枚では出せない）（出典: atwiki/page-713）", () => {
    expect(mirror({ rush: [inst("RK-034", "m1")] })).toBe(false);
  });

  it.fails("BK-013: ◎2つ目 — 自軍コマンドゾーンの「ミラーモンスター」のカードは数えない（「自軍エリア」はラッシュエリア・バトルエリア）（出典: atwiki/page-713「自軍エリアにある…ユニット」）", () => {
    expect(mirror({ rush: [inst("RK-034", "m1")], command: [...releasedCat("WB", 1), inst("RK-035", "cmd")] })).toBe(false);
  });
});

// ===========================================================================
describe("BK-014 ファイズドライバー", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒◎自軍山札から「仮面ライダーファイズ」のカードを1枚選び、相手に見せてから手札に加えてもよい。その後、山札をシャッフルする。◎自軍山札の上から1枚ひいて、自軍コマンドゾーンにホールド状態で置く。（コマンドゾーンに置けるカードは通常5枚まで）";

  searchBeltTests({
    id: "BK-014",
    name: "ファイズドライバー",
    cat: "ET",
    cost: 3,
    page: "atwiki/page-722",
    text: TEXT,
    heroName: "仮面ライダーファイズ",
    otherMode: "deck_to_command",
    heroes: ["RK-064", "XG2-078", "XG1-066", "XG4-083"],
    others: ["RK-203", "XG4-060", "XG7-037"],
    othersWhy: "atwiki/page-1739（カード名は完全に一致しなければ対象にできない。ディケイド ファイズは「これは「仮面ライダーファイズ」として使える」）",
  });

  it.fails("BK-014: ◎2つ目 — 自軍山札の上から1枚を自軍コマンドゾーンにホールド状態で置く（出典: atwiki/page-722「自軍山札の上から1枚ひいて、自軍コマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(used("BK-014", "ET", 3, { deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)] }), "deck_to_command"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("command");
    expect(s.players.player1.command.find((c) => c.instanceId === "SPEC-PLAIN:top")?.commandHeld).toBe(true);
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it.fails("BK-014: ◎2つ目 — 自軍コマンドゾーンが5枚なら置けない（山札はそのまま）（出典: atwiki/page-722「（コマンドゾーンに置けるカードは通常5枚まで）」）", () => {
    const s = resolveAll(pick(used("BK-014", "ET", 3, { deck: [inst("SPEC-PLAIN", "top"), ...deckCards(3)], command: heldN(4) }), "deck_to_command"));
    expect(zoneOf(s, "player1", "SPEC-PLAIN:top")).toBe("deck");
    expect(s.players.player1.command).toHaveLength(5);
  });
  it.todo(
    "BK-014: ◎2つ目 — 自軍山札が0枚のときの扱い（「1枚ひいて」がドローにあたり、山札切れの敗北（R-WIN-03）になるか）— 本文・公式 FAQ・atwiki に記述がない（エンジンは何もしない）",
  );
});

