/**
 * カード別スペック: RK-141〜RK-147（ザ・マスクドライダーEXP vol.2 仮面ライダーゼロノスZF〜デンライナーイスルギ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RK146 の読み替え）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-141・RK-142 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-CROSS-01、R-CN-02 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-142 Q3（バトルエリアに出た時点で撃破される）とイマジンとの契約の併用 — cardSpec/RK5-085-105.a.test.ts RK-088
 *  - RK-146 の読み替え後の本文と、相手・自分の順にオペレーションを手札に加える処理 — rulesSpec/08-errata.s2-atwiki.test.ts R-ERR-RK146
 *  - RK-168 電王CF【てんこもりだぜ！】とイマジンの組み合わせ — rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK168
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  bpOf,
  canConfirm,
  canUseCard,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectStats,
  fill,
  inst,
  legal,
  p1Battle,
  pick,
  powerCards,
  rcRideOff,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushOpen,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  useCard,
  zoneOf,
} from "./RK7-127-147.helpers";
import { PLAIN_VEHICLE } from "./RK7-127-147.helpers";

const KAMEN = sUnit("SPEC-KAMEN", { category: "OT", bp: 1000, sp: "1/4" as never, features: ["仮面ライダー"] });
const KAMEN5 = sUnit("SPEC-KAMEN5", { category: "OT", bp: 1000, sp: "1/5" as never, features: ["仮面ライダー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "OT", bp: 1000, sp: "1/4" as never, features: ["男"] });
const S13 = sUnit("SPEC-S13", { category: "OT", bp: 1000, sp: "1/3" as never });
const E1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E2 = sUnit("SPEC-E2", { bp: 2000, powerCost: 2 });
const E3 = sUnit("SPEC-E3", { bp: 3000, powerCost: 3 });
const C3 = sUnit("SPEC-C3", { bp: 3000, powerCost: 3 });
const C6 = sUnit("SPEC-C6", { bp: 3000, powerCost: 6 });
const WOMAN = sUnit("SPEC-WOMAN", { category: "DA", bp: 1000, features: ["女"] });
const WOMAN_L = sUnit("SPEC-WOMAN-L", { category: "DA", bp: 9000, size: "L", powerCost: "7+" as never, features: ["女"] });
const BEAST = sUnit("SPEC-BEAST", { category: "WB", bp: 1000, features: ["獣"] });
const EXTRA = [KAMEN, KAMEN5, PLAIN, S13, E1, E2, E3, C3, C6, WOMAN, WOMAN_L, BEAST, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const faceUp = (cardId: string, suf: string): CardInstance => ({ ...inst(cardId, suf), faceDown: false });

// ===========================================================================
describe("RK-141 仮面ライダーゼロノスZF", () => {
  const TEXT =
    "【デネビックバスター】これがストライクしたとき、次の効果を、自分が三回まで好きな回数行った後で、相手も同じ回数行う。 自分自身の山札の上から1枚をオモテにする。そして、オモテにしたカードの必要パワーの数値を見て、その数字と同じ必要パワーの数字を持つ自分自身のユニットがあれば、その中から1体選び撃破する。そうして撃破したなら、オモテにしたカードは捨札になり、撃破しなかったら手札に加える。";

  it("RK-141: カタログ本文・スペックが出典と一致（出典: atwiki/page-669）", () => {
    expectCatalogText("RK-141", TEXT);
    expectStats("RK-141", {
      name: "仮面ライダーゼロノスZF",
      category: "OT",
      size: "S",
      bp: 5000,
      sp: 1,
      powerCost: "6+",
      comboNumber: undefined,
      features: ["仮面ライダー", "男"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-141", ["SR"]);
  });

  it("RK-141: 追加条件 — 自軍「仮面ライダーゼロノスAF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-669「自軍「仮面ライダーゼロノスAF」1体をパワーゾーンに送る。」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RK-141", "zf")], rush: [inst("RK-139", "af")], power: powerCards(6), command: releasedCat("OT", 1), deck: deckCards(3) } }, EXTRA);
    const r = rushFromHand(s, "player1", "RK-141:zf", { materials: ["RK-139:af"] });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-141:zf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RK-139:af")).toBe("power");
  });

  /**
   * 自軍: 山札の上から 必要パワー3・必要パワー1・必要パワー6 …。自軍ユニット: 必要パワー3 が2体。
   * 敵軍: 山札の上から 必要パワー2・必要パワー2 …。敵軍ユニット: 必要パワー2 が1体。
   */
  const p1 = {
    battle: [inst("RK-141", "zf")],
    rush: [inst("SPEC-C3", "a"), inst("SPEC-C3", "b")],
    deck: [inst("SPEC-C3", "t1"), inst("SPEC-E1", "t2"), inst("SPEC-C6", "t3"), ...deckCards(4)],
  };
  const p2 = { battle: [inst("SPEC-E2", "x")], deck: [inst("SPEC-E2", "u1"), inst("SPEC-E2", "u2"), ...deckCards(4, "e")] };
  const struck = (a: Partial<GameState["players"]["player1"]> = p1, b: Partial<GameState["players"]["player2"]> = p2) =>
    settle(strike(board(a, b), "RK-141:zf"));

  it.fails("RK-141: ストライクしたとき、自分は効果を行うかを選べる（0回でもよい）（出典: atwiki/page-669「自分が三回まで好きな回数行った後で」）", () => {
    const s = struck();
    expectChoiceFrom(s, "player1", "RK-141");
    expect(canConfirm(s)).toBe(true);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("RK-141: 1回行う — 山札の上をオモテにし、同じ必要パワーの自分自身のユニットがあれば1体選び撃破し、オモテにしたカードは捨札になる（選ばないことはできない）（出典: atwiki/page-669）", () => {
    let s = confirm(struck());
    expectChoiceFrom(s, "player1", "RK-141");
    expect(choiceIds(s)).toEqual(["SPEC-C3:a", "SPEC-C3:b"]);
    expect(canSkip(s)).toBe(false);
    s = settle(pick(s, "SPEC-C3:b"));
    expect(zoneOf(s, "player1", "SPEC-C3:b")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C3:t1")).toBe("discard");
  });

  it.fails("RK-141: 同じ必要パワーの自分自身のユニットがなければ、オモテにしたカードを手札に加える（出典: atwiki/page-669「撃破しなかったら手札に加える」・カード評価「ドロー加速ともいえる」）", () => {
    let s = settle(pick(confirm(struck()), "SPEC-C3:a"));
    s = settle(confirm(s)); // 2回目: 必要パワー1 — 自軍に必要パワー1のユニットはいない
    expect(zoneOf(s, "player1", "SPEC-E1:t2")).toBe("hand");
  });

  it.fails("RK-141: 自分が行った回数と同じ回数を、相手も自分自身の山札とユニットで行う（出典: atwiki/page-669「相手も同じ回数行う」）", () => {
    let s = settle(pick(confirm(struck()), "SPEC-C3:a"));
    s = settle(skip(s)); // 自分は1回でやめる
    // 相手: 山札の上は必要パワー2。相手の必要パワー2のユニットを撃破する（相手が選ぶ）。
    if (s.pendingEffectChoice?.playerId === "player2") s = settle(pick(s, "SPEC-E2:x"));
    expect(zoneOf(s, "player2", "SPEC-E2:x")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2:u1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E2:u2")).toBe("deck");
  });

  it.fails("RK-141: 自分が0回なら相手も行わない（出典: atwiki/page-669「相手も同じ回数行う」）", () => {
    const s = settle(skip(struck()));
    expect(zoneOf(s, "player2", "SPEC-E2:x")).toBe("battle");
    expect(s.players.player2.deck[0]?.instanceId).toBe("SPEC-E2:u1");
  });

  it.fails("RK-141: 自分が行えるのは3回まで（出典: atwiki/page-669「三回まで」）", () => {
    let s = settle(pick(confirm(struck()), "SPEC-C3:a")); // 1回目
    s = settle(confirm(s)); // 2回目（必要パワー1 → 手札）
    expect(canConfirm(s)).toBe(true);
    s = settle(confirm(s)); // 3回目（必要パワー6 → ゼロノスZF 自身を撃破）
    if (s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.validInstanceIds.includes("RK-141:zf")) s = settle(pick(s, "RK-141:zf"));
    expect(s.pendingEffectChoice?.playerId).not.toBe("player1");
  });

  it.fails("RK-141: 公式Q&A — 必要パワー6をオモテにしてゼロノスZF 自身が撃破されても、効果の処理は続く（出典: grnrngr/faq-rider-2 RK-141 Q「いいえ。…捨札になっても、効果の処理は継続されます」）", () => {
    const a = { ...p1, deck: [inst("SPEC-C6", "t3"), inst("SPEC-C3", "t1"), ...deckCards(4)] };
    let s = confirm(struck(a));
    expect(choiceIds(s)).toEqual(["RK-141:zf"]);
    s = settle(pick(s, "RK-141:zf"));
    expect(zoneOf(s, "player1", "RK-141:zf")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-141");
    expect(canConfirm(s)).toBe(true);
  });

  it("RK-141: コミュニティQ&A — ストライクのダメージを与えられなくても、ストライクしたときに発動する（出典: atwiki/page-669 コメント欄「ストライクした時なので、…ダメージを与えられなくても効果を発動できる」）", () => {
    // ストライクの宣言の時点で発動する: ダメージを処理する前に選択が開いている。
    const s = strike(board(p1, p2), "RK-141:zf");
    const t = settle(s);
    expect(t.pendingEffectChoice?.sourceCardId).toBe("RK-141");
  });
});

// ===========================================================================
/** 自軍（player1）バトルフェイズ。パワーゾーンにオモテ向きのイマジン、ラッシュエリアに出す仮面ライダー（SP1/4）。 */
const imaginBoard = (power: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  board({ power, rush: [inst("SPEC-KAMEN", "k")], battle: fill(1), ...p1 }, p2);
const kamenEnters = (power: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  enter(imaginBoard(power, p1, p2), "SPEC-KAMEN:k");

function imaginBasics(id: string, name: string, page: string, stats: Parameters<typeof expectStats>[1], text: string, rarity: string) {
  it(`${id}: カタログ本文・スペックが出典と一致（出典: ${page}）`, () => {
    expectCatalogText(id, text);
    expectStats(id, stats);
    expectRarityIn(id, [rarity]);
  });

  it(`${id}: ※ バトルエリアに出た時点ですぐに撃破され、ストライクもアタックもできない（出典: ${page}「※これはバトルエリアに出たとき撃破される。」・grnrngr/faq-rider-2 RK-142 Q3）`, () => {
    const s = settle(enter(board({ rush: [inst(id, "im")], battle: fill(3) }), `${id}:im`));
    expect(zoneOf(s, "player1", `${id}:im`)).toBe("discard");
    expect(canStrike(s, `${id}:im`)).toBe(false);
  });

  it(`${id}: パワーゾーンでオモテ向きの間、自軍バトルフェイズ中に特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にするかを選べる（任意）（出典: ${page}「これを捨札にしてもよい」）`, () => {
    const s = kamenEnters([faceUp(id, "im"), ...powerCards(2)]);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual([`${id}:im`]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ウラ向き（ダメージ）なら発動しない（出典: ${page}「自軍パワーゾーンでオモテ向きになっている間」）`, () => {
    const s = kamenEnters([{ ...inst(id, "im"), faceDown: true }, ...powerCards(2)]);
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(`${id}:im`);
  });

  it(`${id}: 特徴「仮面ライダー」を持たないユニットが出たときは発動しない（出典: ${page}「特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき」）`, () => {
    const s = enter(board({ power: [faceUp(id, "im")], rush: [inst("SPEC-PLAIN", "p")], battle: fill(1) }), "SPEC-PLAIN:p");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(`${id}:im`);
  });

  it(`${id}: 敵軍ターン中に自軍の仮面ライダーがバトルエリアに出ても発動しない（出典: ${page}「自軍バトルフェイズ中、」）`, () => {
    // 相手（player2）の電王RF【一本釣り】で、自軍パワーゾーンの仮面ライダーを自軍バトルエリアに出す。
    let s = enemyTurn(
      { power: [faceUp(id, "im"), faceUp("SPEC-KAMEN", "k")] },
      { rush: [inst("RK-061", "rf"), inst("SPEC-VEHICLE", "v")] },
    );
    s = rcRideOff(s, "RK-061:rf", "SPEC-VEHICLE:v", "player2");
    if (s.pendingEffectChoice?.sourceCardId === "RK-061") s = pick(s, "SPEC-KAMEN:k");
    s = settle(s);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("battle");
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).not.toContain(`${id}:im`);
    expect(zoneOf(s, "player1", `${id}:im`)).toBe("power");
  });
  void name;
}

// ===========================================================================
describe("RK-142 モモタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【最初からクライマックスだぜ】これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にしてもよい。そうしたとき、このターン、そのユニットは「SP1」になる。";

  imaginBasics("RK-142", "モモタロス", "atwiki/page-514", { name: "モモタロス", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: 1, comboNumber: undefined, features: ["イマジン"] }, TEXT, "R");

  it("RK-142: 捨札にすると、このターン、出た仮面ライダー（SP1/4 の2番目）は「SP1」になりストライクできる（出典: atwiki/page-514「このターン、そのユニットは「SP1」になる」）", () => {
    const s = settle(pick(kamenEnters([faceUp("RK-142", "im")]), "RK-142:im"));
    expect(zoneOf(s, "player1", "RK-142:im")).toBe("discard");
    expect(spOf(s, "player1", "SPEC-KAMEN:k")).toBe(1);
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(true);
  });

  it("RK-142: 捨札にしなければ SP は変わらない（SP1/4 の2番目はストライクできない）（出典: atwiki/page-514「捨札にしてもよい。そうしたとき」）", () => {
    const s = settle(skip(kamenEnters([faceUp("RK-142", "im")])));
    expect(zoneOf(s, "player1", "RK-142:im")).toBe("power");
    expect(canStrike(s, "SPEC-KAMEN:k")).toBe(false);
  });

  it("RK-142: コミュニティQ&A — 2枚捨札にしても SP2 にはならず SP1 のまま（出典: atwiki/page-514 コメント欄「SPを増やす効果ではないので…どの場合でもSP1になります」）", () => {
    let s = kamenEnters([faceUp("RK-142", "im"), faceUp("RK-142", "im2")]);
    s = pick(s, "RK-142:im");
    if (s.pendingEffectChoice?.validInstanceIds.includes("RK-142:im2")) s = pick(s, "RK-142:im2");
    s = settle(s);
    expect(spOf(s, "player1", "SPEC-KAMEN:k")).toBe(1);
  });

  // faq-rider-2 RK-142 Q1「はい、できます。」
  it.fails("RK-142: 公式Q&A — 敵軍の電王RF【一本釣り】で自軍パワーゾーンのモモタロスが自軍バトルエリアに出て撃破されるとき、ダイノガッツを使って場に留められる（出典: grnrngr/faq-rider-2 RK-142 Q1「はい、できます」）", () => {
    let s = enemyTurn(
      { power: [faceUp("RK-142", "mo"), ...powerCards(2)], hand: [inst("RS-027", "dg")], command: releasedCat("WB", 1), deck: deckCards(5) },
      { rush: [inst("RK-061", "rf"), inst("SPEC-VEHICLE", "v")] },
    );
    s = rcRideOff(s, "RK-061:rf", "SPEC-VEHICLE:v", "player2");
    s = pick(s, "RK-142:mo");
    expect(canUseCard(s, "player1", "RS-027:dg")).toBe(true);
    s = settle(useCard(s, "player1", "RS-027:dg"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("battle");
  });

  it.todo(
    "RK-142: 公式Q&A — 改造人間が常駐し超電子ダイナモを使った電王RF の【一本釣り】で出たモモタロスが自身の※で撃破されても、電王RF が撃破したことにはならず1点ダメージは与えない（出典: grnrngr/faq-rider-2 RK-142 Q2）— 超電子ダイナモの「撃破した」ユニットの記録が RK-061 側では作られておらず（cardSpec/RK1-001-021.a.test.ts RK-005 の it.todo と同じ）、ダメージが出ないことを確かめても意味のある照合にならないため",
  );
});

// ===========================================================================
describe("RK-143 ウラタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【女の子のことなら僕に任せてよ】これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にしてもよい。そうしたとき、特徴「女」を持つ敵軍ユニットを1体選び、持ち主のパワーゾーンに送る。";

  imaginBasics("RK-143", "ウラタロス", "atwiki/page-651", { name: "ウラタロス", category: "OT", size: "S", bp: 2000, sp: "1/4", powerCost: 0, comboNumber: undefined, features: ["イマジン"] }, TEXT, "NR");

  const enemy = { battle: [inst("SPEC-WOMAN", "w"), inst("SPEC-E1", "m")], rush: [inst("SPEC-WOMAN-L", "wl")] };

  it("RK-143: 捨札にすると、特徴「女」を持つ敵軍ユニット（エリア・サイズを問わない）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-651「特徴「女」を持つ敵軍ユニットを1体選び」・カード評価「エリアとサイズを問わずにパワー送りにすることができる」）", () => {
    const s = pick(kamenEnters([faceUp("RK-143", "im")], {}, enemy), "RK-143:im");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-WOMAN-L:wl", "SPEC-WOMAN:w"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-143: 選んだユニットは持ち主のパワーゾーンに送られる（出典: atwiki/page-651「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(pick(pick(kamenEnters([faceUp("RK-143", "im")], {}, enemy), "RK-143:im"), "SPEC-WOMAN-L:wl"));
    expect(zoneOf(s, "player2", "SPEC-WOMAN-L:wl")).toBe("power");
    expect(zoneOf(s, "player1", "RK-143:im")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-144 キンタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【俺の強さは泣けるで！】これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にしてもよい。そうしたとき、そのユニットはBP+3000される。";

  imaginBasics("RK-144", "キンタロス", "atwiki/page-652", { name: "キンタロス", category: "OT", size: "S", bp: 5000, sp: undefined, powerCost: 1, comboNumber: undefined, features: ["イマジン"] }, TEXT, "NR");

  it("RK-144: 捨札にすると、出た仮面ライダーは BP+3000 される（出典: atwiki/page-652「そのユニットはBP+3000される」）", () => {
    const s = settle(pick(kamenEnters([faceUp("RK-144", "im")]), "RK-144:im"));
    expect(bpOf(s, "player1", "SPEC-KAMEN:k")).toBe(4000);
  });

  it.fails("RK-144: コミュニティQ&A — パワーゾーンに2枚あれば1枚ごとに発動でき、2枚捨札にして BP+6000 にできる（出典: atwiki/page-652 コメント欄「1枚ごとに効果を発動できるため、2枚捨札にしてBP+6000することができます」）", () => {
    let s = pick(kamenEnters([faceUp("RK-144", "im"), faceUp("RK-144", "im2")]), "RK-144:im");
    expect(choiceIds(s)).toEqual(["RK-144:im2"]);
    s = settle(pick(s, "RK-144:im2"));
    expect(bpOf(s, "player1", "SPEC-KAMEN:k")).toBe(7000);
  });
});

// ===========================================================================
describe("RK-145 リュウタロス", () => {
  const TEXT =
    "※これはバトルエリアに出たとき撃破される。 【ネコ達いじめたのお前？】これが自軍パワーゾーンでオモテ向きになっている間、自軍バトルフェイズ中、特徴「仮面ライダー」を持つ自軍ユニットがバトルエリアに出たとき、これを捨札にしてもよい。そうしたとき、自軍捨札にある特徴「獣」を持つユニットカードの枚数以下の必要パワーの数字を持つ敵軍ユニットを1体撃破する。";

  imaginBasics("RK-145", "リュウタロス", "atwiki/page-653", { name: "リュウタロス", category: "OT", size: "S", bp: 4000, sp: "1/4", powerCost: 2, comboNumber: undefined, features: ["イマジン"] }, TEXT, "NR");

  const enemy = { battle: [inst("SPEC-E1", "c1"), inst("SPEC-E2", "c2"), inst("SPEC-E3", "c3")], rush: [inst("SPEC-WOMAN-L", "l7")] };

  it("RK-145: 捨札にすると、自軍捨札の特徴「獣」を持つユニットカードの枚数（2枚）以下の必要パワーを持つ敵軍ユニット（エリア・サイズを問わない）を1体選ぶ（選ばないことはできない）（出典: atwiki/page-653・カード評価「対象もサイズや追加条件は関係無い」）", () => {
    const s = pick(kamenEnters([faceUp("RK-145", "im")], { discard: [inst("SPEC-BEAST", "b1"), inst("SPEC-BEAST", "b2"), inst("SPEC-E3", "x")] }, enemy), "RK-145:im");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-E1:c1", "SPEC-E2:c2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-145: 選んだユニットを撃破する（出典: atwiki/page-653「1体撃破する」）", () => {
    const s = resolveAll(pick(pick(kamenEnters([faceUp("RK-145", "im")], { discard: [inst("SPEC-BEAST", "b1"), inst("SPEC-BEAST", "b2")] }, enemy), "RK-145:im"), "SPEC-E2:c2"));
    expect(zoneOf(s, "player2", "SPEC-E2:c2")).toBe("discard");
  });

  it("RK-145: 枚数を数えるのは自軍捨札（敵軍捨札の「獣」は数えない）（出典: atwiki/page-653「自軍捨札にある」）", () => {
    const s = pick(kamenEnters([faceUp("RK-145", "im")], { discard: [inst("SPEC-BEAST", "b1")] }, { ...enemy, discard: [inst("SPEC-BEAST", "eb1"), inst("SPEC-BEAST", "eb2")] }), "RK-145:im");
    expect(choiceIds(s)).toEqual(["SPEC-E1:c1"]);
  });
});

// ===========================================================================
describe("RK-146 デネブ", () => {
  /** 公式の読み替え後の本文（atwiki/page-672 Q2「（2010/5/10修正）」。docs/rules/README.md §1.2 例外2）。 */
  const TEXT =
    "【デネブキャンディー】これをラッシュしたとき、次の効果を、相手、自分の順に行う⇒自分自身の山札を見てもよい。そうしたとき、その中からオペレーションカードを1枚選び、相手に見せてから手札に加える。その後、山札をシャッフルする。";

  it("RK-146: カタログ本文（公式の読み替え後）・スペックが出典と一致（出典: atwiki/page-672・同 Q2 の読み替え）", () => {
    expectCatalogText("RK-146", TEXT);
    expectStats("RK-146", { name: "デネブ", category: "OT", size: "S", bp: 1000, sp: "1/4", powerCost: 2, comboNumber: undefined, features: ["イマジン"] });
    expectRarityIn("RK-146", ["NR"]);
  });

  it("RK-146: イマジンだがバトルエリアに出ても撃破されない（出典: atwiki/page-672（※の撃破の文がない）・カード評価「イマジン特有のデメリットを持っておらず、バトルエリアにも普通に出る事が可能」）", () => {
    const s = settle(enter(board({ rush: [inst("RK-146", "dn")] }), "RK-146:dn"));
    expect(zoneOf(s, "player1", "RK-146:dn")).toBe("battle");
  });

  it("RK-146: 相手は山札を見ないことを選べる（見なければ相手の手札は増えない）（出典: atwiki/page-672 Q2 の読み替え「自分自身の山札を見てもよい」・カード評価「相手、自分共に任意」）", () => {
    let s = rushOpen(
      st({ phase: "rush", player1: { hand: [inst("RK-146", "dn")], command: releasedCat("OT", 1), power: powerCards(2), deck: [inst("TST-OP", "o1"), ...deckCards(3)] }, player2: { deck: [inst("TST-OP", "eo"), ...deckCards(3, "e")] } }, EXTRA),
      "player1",
      "RK-146:dn",
    );
    s = settle(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RK-147 デンライナーイスルギ", () => {
  const TEXT =
    "※これはアタックすることができない。 【レドーム分離】このユニットからコンビネーションするSP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる。";

  it("RK-147: カタログ本文・スペックが出典と一致（出典: atwiki/page-673）", () => {
    expectCatalogText("RK-147", TEXT);
    expectStats("RK-147", {
      name: "デンライナーイスルギ",
      category: "OT",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "3+",
      comboNumber: "L",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_power",
    });
    expectRarityIn("RK-147", ["N"]);
  });

  it("RK-147: ※ アタックできない（出典: atwiki/page-673「※これはアタックすることができない」）", () => {
    const s = board({ battle: [inst("RK-147", "is")] }, { battle: [inst("SPEC-E1", "e")] });
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "RK-147:is")).toBe(false);
  });

  it("RK-147: このユニットからコンビネーションする SP1/4 の S ユニットは、自軍ターン中「SP1」になる（2番目でもストライクで1点）（出典: atwiki/page-673「SP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる」）", () => {
    const s = enter(board({ battle: [inst("RK-147", "is")], rush: [inst("SPEC-PLAIN", "p")] }), "SPEC-PLAIN:p");
    expect(spOf(s, "player1", "SPEC-PLAIN:p")).toBe(1);
    expect(canStrike(s, "SPEC-PLAIN:p")).toBe(true);
  });

  it("RK-147: SP1/4 でない S ユニット（SP1/3）は能力を得ない（2番目ではストライクできない）（出典: atwiki/page-673「SP1/4のSユニット」）", () => {
    const s = enter(board({ battle: [inst("RK-147", "is")], rush: [inst("SPEC-S13", "p")] }), "SPEC-S13:p");
    expect(spOf(s, "player1", "SPEC-S13:p")).toBe(0);
  });

  it("RK-147: このユニットの次に出たのでなければ能力を得ない（出典: atwiki/page-673「このユニットからコンビネーションする」）", () => {
    const s = enter(board({ battle: [inst("RK-147", "is"), inst("TST-UNIT-0", "x")], rush: [inst("SPEC-PLAIN", "p")] }), "SPEC-PLAIN:p");
    expect(spOf(s, "player1", "SPEC-PLAIN:p")).toBe(0);
  });

  it.fails("RK-147: コミュニティQ&A — クロスで SP1/5 から SP1/4 になったユニットも能力を得る（出典: atwiki/page-673 コメント欄「1/5はクロス効果で1/4になるからこの電車の対象になる」・R-KW-CROSS-01）", () => {
    // 1番目: クロス1 のユニット（XG7-010）、2番目: イスルギ、3番目に SP1/5 の S ユニット（クロスで 1/4）。
    const s = enter(board({ battle: [inst("XG7-010", "cr"), inst("RK-147", "is")], rush: [inst("SPEC-KAMEN5", "p")] }), "SPEC-KAMEN5:p");
    expect(spOf(s, "player1", "SPEC-KAMEN5:p")).toBe(1);
  });

  it.todo(
    "RK-147: コミュニティQ&A — クロスで SP1/4 から SP1/3 になったユニットは能力を得ない（出典: atwiki/page-673 コメント欄「無効になります」）— クロスのユニットとイスルギを並べると相手は3番目になり、SP1/3 でもともと SP1 になるため、能力の有無を公開 API で区別できない",
  );
});
