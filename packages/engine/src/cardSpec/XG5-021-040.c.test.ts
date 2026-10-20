/**
 * カード別スペック: XG5-035〜XG5-040（クロスギャザー XG5 ザ・チケットブレイカー 獅子ディスク〜ゴセイブラック）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG5-」とカード名で検索:
 *     本範囲のカードの項はない（ウイングの一般の項 faq-card-9 だけ）。本範囲のカードページに atwiki 転載の公式 Q&A はない
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG5-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. atwiki のキーワードのページ（page-2250 リード・page-1291 タクス）・docs/rules/*.md の一般ルール・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG5-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する（XG5-035 は atwiki の欄が空で照合しない）。
 * 「（自分の手札が1枚以下なら…）」の手札の枚数は、効果を解決するときの自分の手札の枚数とする（出したユニット自身は数えない）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectMultiStats,
  expectOpStats,
  expectRarityIn,
  beltUsed,
  fill,
  heldCard,
  inst,
  leadMaTests,
  pick,
  pickAll,
  registerOffered,
  attackUntilRegister,
  released,
  releasedCat,
  resolveAll,
  spOf,
  st,
  sUnit,
  taxMaTests,
  wingTests,
  zoneOf,
} from "./XG5-021-040.helpers";

const MA3 = sUnit("SPEC-MA3", { category: "MA", bp: 3000 });
const MA3B = sUnit("SPEC-MA3B", { category: "MA", bp: 3000 });
const WB5 = sUnit("SPEC-WB5", { category: "WB", bp: 5000 });
const E2 = sUnit("SPEC-E2", { category: "WB", bp: 2000 });
const E3 = sUnit("SPEC-E3", { category: "WB", bp: 3000 });
const E4 = sUnit("SPEC-E4", { category: "WB", bp: 4000 });
const EM = sUnit("SPEC-EM", { category: "WB", bp: 1000, size: "M" });
const ETS = sUnit("SPEC-ETS", { category: "ET", bp: 1000 });
const WBET = sUnit("SPEC-WBET", { category: ["WB", "ET"], bp: 1000 } as never);
const MULTI = sUnit("SPEC-MULTI", { category: ["WB", "MA"], bp: 1000 } as never);
const MULTI_M = sUnit("SPEC-MULTI-M", { category: ["WB", "MA"], bp: 1000, size: "M" } as never);
const EXTRA = [MA3, MA3B, WB5, E2, E3, E4, EM, ETS, WBET, MULTI, MULTI_M];

const battle = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

/** 手札 n 枚（TST-UNIT-0）。 */
const handN = (n: number) => Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `h${i}`));

// ===========================================================================
describe("XG5-035 獅子ディスク", () => {
  const TEXT = "自軍ラッシュエリアから、MAを持つ自軍Sユニットを１体選ぶ。そうしたとき、選んだユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG5-035: カタログ本文・スペックが出典と一致（レアリティは atwiki の欄が空で照合しない）（出典: atwiki/page-2175）", () => {
    expectCatalogText("XG5-035", TEXT);
    expectOpStats("XG5-035", { name: "獅子ディスク", category: "MA", powerCost: 5 });
  });

  // 自軍: ラッシュエリアに MA の S ユニット（BP3000）と WB の S ユニット（BP5000）、バトルエリアに MA の S ユニット（BP3000）。
  // 敵軍: ラッシュエリアに BP2000・BP4000・M ユニット、バトルエリアに BP3000。
  const P1 = () => ({ rush: [inst("SPEC-MA3", "m"), inst("SPEC-WB5", "w")], battle: [inst("SPEC-MA3B", "mb")] });
  const P2 = () => ({ rush: [inst("SPEC-E2", "a"), inst("SPEC-E4", "c"), inst("SPEC-EM", "m")], battle: [inst("SPEC-E3", "b")] });
  const used = (p1: Partial<GameState["players"]["player1"]> = P1()) => beltUsed("XG5-035", "MA", 5, p1, P2(), EXTRA);

  it("XG5-035: まず自軍ラッシュエリアの MA を持つ自軍 S ユニットを1体選ぶ（バトルエリア・MA を持たないユニットは選べない）（出典: atwiki/page-2175「自軍ラッシュエリアから、MAを持つ自軍Sユニットを１体選ぶ」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-035");
    expect(choiceIds(s)).toEqual(["SPEC-MA3:m"]);
  });

  it("XG5-035: 選んだユニットの BP（3000）以下の敵軍 S ユニットを1体選び（エリアを問わない。BP4000・M ユニットは選べない）、持ち主のパワーゾーンにダメージにして置く（出典: atwiki/page-2175「選んだユニットのBP以下のBPを持つ敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」・カード評価「エリアを問わないユニット除去とダメージを同時に行える」）", () => {
    let s = pick(used(), "SPEC-MA3:m");
    expect(choiceIds(s)).toEqual(["SPEC-E2:a", "SPEC-E3:b"]);
    s = resolveAll(pick(s, "SPEC-E3:b"));
    expect(zoneOf(s, "player2", "SPEC-E3:b")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E3:b")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XG5-035: 自軍ラッシュエリアに MA を持つ S ユニットがなければ、敵軍ユニットは選ばない（出典: atwiki/page-2175「そうしたとき」）", () => {
    const s = resolveAll(used({ rush: [inst("SPEC-WB5", "w")], battle: [inst("SPEC-MA3B", "mb")] }));
    for (const id of ["SPEC-E2:a", "SPEC-E3:b", "SPEC-E4:c"]) expect(zoneOf(s, "player2", id)).not.toBe("power");
    expect(damageOf(s, "player2")).toBe(0);
  });
});

// ===========================================================================
describe("XG5-036 龍ディスク", () => {
  const TEXT = "自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ。そうしたとき、選んだユニットのBP以下のBPを持つ敵軍Sユニットをすべて持ち主の手札に戻す。";

  it("XG5-036: カタログ本文・スペックが出典と一致（出典: atwiki/page-2201）", () => {
    expectCatalogText("XG5-036", TEXT);
    expectOpStats("XG5-036", { name: "龍ディスク", category: "MA", powerCost: 4 });
    expectRarityIn("XG5-036", ["N"]);
  });

  const P1 = () => ({ rush: [inst("SPEC-MA3", "m"), inst("SPEC-WB5", "w")], battle: [inst("SPEC-MA3B", "mb")] });
  const P2 = () => ({ rush: [inst("SPEC-E2", "a"), inst("SPEC-E4", "c"), inst("SPEC-EM", "m")], battle: [inst("SPEC-E3", "b")] });
  const used = (p1: Partial<GameState["players"]["player1"]> = P1()) => beltUsed("XG5-036", "MA", 4, p1, P2(), EXTRA);

  it("XG5-036: まず自軍ラッシュエリアの MA を持つ自軍 S ユニットを1体選ぶ（バトルエリア・MA を持たないユニットは選べない）（出典: atwiki/page-2201「自軍ラッシュエリアから、MAを持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG5-036");
    expect(choiceIds(s)).toEqual(["SPEC-MA3:m"]);
  });

  it("XG5-036: 選んだユニットの BP（3000）以下の敵軍 S ユニットをすべて（エリアを問わない）持ち主の手札に戻す。BP4000・M ユニットは残る（出典: atwiki/page-2201「選んだユニットのBP以下のBPを持つ敵軍Sユニットをすべて持ち主の手札に戻す」）", () => {
    const s = resolveAll(pick(used(), "SPEC-MA3:m"));
    expect(zoneOf(s, "player2", "SPEC-E2:a")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-E3:b")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-E4:c")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-EM:m")).toBe("rush");
  });

  it("XG5-036: 自軍ラッシュエリアに MA を持つ S ユニットがなければ、敵軍ユニットは戻らない（出典: atwiki/page-2201「そうしたとき」）", () => {
    const s = resolveAll(used({ rush: [inst("SPEC-WB5", "w")], battle: [inst("SPEC-MA3B", "mb")] }));
    expect(zoneOf(s, "player2", "SPEC-E2:a")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E3:b")).toBe("battle");
  });
});

// ===========================================================================
describe("XG5-037 ゴセイレッド", () => {
  const TEXT =
    "※ウイング ※リードMA 【レッドブレイク】敵軍Sユニットを1体選び、持ち主の手札に戻してもよい。（自分の手札が1枚以下なら、手札に戻すかわりに、持ち主のパワーゾーンにダメージにして置いてもよい）";

  it("XG5-037: カタログ本文・スペックが出典と一致（出典: atwiki/page-2228）", () => {
    expectCatalogText("XG5-037", TEXT);
    expectMultiStats("XG5-037", { name: "ゴセイレッド", category: ["WB", "MA"], size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 1, features: ["レッド", "男"] });
    expectRarityIn("XG5-037", ["R"]);
  });

  wingTests("XG5-037", "atwiki/page-2228");
  leadMaTests("XG5-037", "atwiki/page-2228");

  const P2 = () => ({ rush: [inst("SPEC-E2", "a"), inst("SPEC-EM", "m")], battle: [inst("SPEC-E3", "b")] });
  const entered = (hand = 2) => enter(battle({ hand: handN(hand), rush: [inst("XG5-037", "r")] }, P2()), "XG5-037:r");

  it("XG5-037: NC【レッドブレイク】— 1番目に出たとき、敵軍 S ユニット（エリアを問わない）を1体選べる（任意）（出典: atwiki/page-2228「敵軍Sユニットを1体選び、持ち主の手札に戻してもよい」・カード評価「エリアを問わず」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-037");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["SPEC-E2:a", "SPEC-E3:b"]));
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-037: NC【レッドブレイク】— 敵軍 M ユニットは選べない（出典: atwiki/page-2228「敵軍Sユニット」）", () => {
    expect(choiceIds(entered())).not.toContain("SPEC-EM:m");
  });

  it("XG5-037: NC【レッドブレイク】— 選んだユニットは持ち主の手札に戻る（手札2枚なので、ダメージにはできない）（出典: atwiki/page-2228「持ち主の手札に戻してもよい」）", () => {
    let s = pick(entered(2), "SPEC-E3:b");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-037");
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-E3:b")).toBe("hand");
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("XG5-037: NC【レッドブレイク】— 自分の手札が1枚以下なら、手札に戻すかわりに持ち主のパワーゾーンにダメージにして置くかを選べる（出典: atwiki/page-2228「自分の手札が1枚以下なら、手札に戻すかわりに、持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = pick(entered(1), "SPEC-E3:b");
    expectChoiceFrom(s, "player1", "XG5-037");
  });

  it("XG5-037: NC【レッドブレイク】— 出したターン以外（2番目に出たとき）は発動しない（出典: atwiki/page-2228「CN：1」）", () => {
    const s = enter(battle({ hand: handN(2), battle: fill(1), rush: [inst("XG5-037", "r")] }, P2()), "XG5-037:r");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG5-037");
  });
});

// ===========================================================================
describe("XG5-038 ゴセイピンク", () => {
  const TEXT =
    "※ウイング ※リードMA 【息吹のスカイックパワー】カテゴリを2つ以上持つ自軍Sユニットを1体選びリリースしてもよい。（自分の手札が1枚以下なら、カテゴリを2つ以上持つ自軍Sユニットを2体選んでもよい）";

  it("XG5-038: カタログ本文・スペックが出典と一致（出典: atwiki/page-2202）", () => {
    expectCatalogText("XG5-038", TEXT);
    expectMultiStats("XG5-038", { name: "ゴセイピンク", category: ["WB", "MA"], size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 4, features: ["ピンク", "女"] });
    expectRarityIn("XG5-038", ["N"]);
  });

  wingTests("XG5-038", "atwiki/page-2202");
  leadMaTests("XG5-038", "atwiki/page-2202");

  // 4番目に出る。自軍: ホールド状態のマルチカテゴリの S ユニット2体（ラッシュエリア・バトルエリア）、ホールド状態の単カテゴリの S ユニット、ホールド状態のマルチカテゴリの M ユニット。
  const entered = (hand = 2) =>
    enter(
      battle({
        hand: handN(hand),
        battle: [...fill(2), heldCard("SPEC-MULTI", "b")],
        rush: [inst("XG5-038", "p"), heldCard("SPEC-MULTI", "r"), heldCard("TST-UNIT-0", "single"), heldCard("SPEC-MULTI-M", "mm")],
      }),
      "XG5-038:p",
    );

  it("XG5-038: NC【息吹のスカイックパワー】— 4番目に出たとき、カテゴリを2つ以上持つ自軍 S ユニットを選べる（単カテゴリ・M ユニットは選べない。任意）（出典: atwiki/page-2202「カテゴリを2つ以上持つ自軍Sユニットを1体選びリリースしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG5-038");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["SPEC-MULTI:b", "SPEC-MULTI:r"]));
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:single");
    expect(choiceIds(s)).not.toContain("SPEC-MULTI-M:mm");
    expect(canSkip(s)).toBe(true);
  });

  it("XG5-038: NC【息吹のスカイックパワー】— 選んだユニットはリリース状態になる（手札2枚なら1体だけ）（出典: atwiki/page-2202「1体選びリリースしてもよい」）", () => {
    const s = resolveAll(pick(entered(2), "SPEC-MULTI:r"), []);
    expect(cardIn(s, "player1", "SPEC-MULTI:r")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player1", "SPEC-MULTI:b")?.commandHeld).toBe(true);
  });

  it("XG5-038: NC【息吹のスカイックパワー】— 自分の手札が1枚以下なら2体選んでリリースできる（出典: atwiki/page-2202「自分の手札が1枚以下なら、カテゴリを2つ以上持つ自軍Sユニットを2体選んでもよい」）", () => {
    const s = resolveAll(pickAll(entered(1), ["SPEC-MULTI:r", "SPEC-MULTI:b"]), []);
    expect(cardIn(s, "player1", "SPEC-MULTI:r")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player1", "SPEC-MULTI:b")?.commandHeld ?? false).toBe(false);
  });
});

// ===========================================================================
describe("XG5-039 ゴセイブルー", () => {
  const TEXT =
    "※タクスMA ※リードMA 【ブルーチェック】敵軍コマンドゾーンから、自分の手札の枚数以上の必要パワーの数字を持つユニットカードを1枚選び捨札にする。（自分の手札が1枚以下なら、捨札にするかわりに持ち主の山札の上に戻してもよい）";

  it("XG5-039: カタログ本文・スペックが出典と一致（出典: atwiki/page-2203）", () => {
    expectCatalogText("XG5-039", TEXT);
    expectMultiStats("XG5-039", { name: "ゴセイブルー", category: ["WB", "MA"], size: "S", bp: 3000, sp: undefined, powerCost: 3, comboNumber: 5, features: ["ブルー", "男"] });
    expectRarityIn("XG5-039", ["N"]);
  });

  taxMaTests("XG5-039", "atwiki/page-2203");
  leadMaTests("XG5-039", "atwiki/page-2203");

  // 5番目に出る。敵軍コマンドゾーン: TST-UNIT-0（必要パワー0）・TST-UNIT-2（2）・TST-UNIT-7（7+）・TST-OP（オペレーション）。
  const P2 = () => ({ command: [released("TST-UNIT-0", "u0"), released("TST-UNIT-2", "u2"), released("TST-UNIT-7", "u7"), released("TST-OP", "op")] });
  const entered = (hand = 2) => enter(battle({ hand: handN(hand), battle: fill(4), rush: [inst("XG5-039", "b")] }, P2()), "XG5-039:b");

  it("XG5-039: NC【ブルーチェック】— 5番目に出たとき、敵軍コマンドゾーンの、自分の手札の枚数（2）以上の必要パワーの数字を持つユニットカードから選ぶ（0 のユニット・オペレーションは選べない）（出典: atwiki/page-2203「自分の手札の枚数以上の必要パワーの数字を持つユニットカードを1枚選び」）", () => {
    const s = entered(2);
    expectChoiceFrom(s, "player1", "XG5-039");
    expect([...choiceIds(s)].sort()).toEqual(["TST-UNIT-2:u2", "TST-UNIT-7:u7"]);
  });

  it("XG5-039: NC【ブルーチェック】— 選んだカードは捨札になる（出典: atwiki/page-2203「1枚選び捨札にする」）", () => {
    const s = resolveAll(pick(entered(2), "TST-UNIT-2:u2"), []);
    expect(zoneOf(s, "player2", "TST-UNIT-2:u2")).toBe("discard");
  });

  it("XG5-039: NC【ブルーチェック】— 自分の手札が1枚以下なら、捨札にするかわりに持ち主の山札の上に戻せる（出典: atwiki/page-2203「捨札にするかわりに持ち主の山札の上に戻してもよい」）", () => {
    let s = pick(entered(1), "TST-UNIT-7:u7");
    expectChoiceFrom(s, "player1", "XG5-039");
    s = resolveAll(s, ["deck_top", "deck"]);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-7:u7");
  });
});

// ===========================================================================
describe("XG5-040 ゴセイブラック", () => {
  const TEXT =
    "※レジスト ※リードMA 【スネークバレット】「SP1」自軍コマンドゾーンにないカテゴリを持つ敵軍Sユニットを1体選び撃破する。（自分の手札が1枚以下なら、敵軍Sユニットを選ぶとき、自軍コマンドゾーンにあるカテゴリを持つ敵軍Sユニットを選んでもよい）";

  it("XG5-040: カタログ本文・スペックが出典と一致（出典: atwiki/page-2241）", () => {
    expectCatalogText("XG5-040", TEXT);
    expectMultiStats("XG5-040", { name: "ゴセイブラック", category: ["WB", "MA"], size: "S", bp: 4000, sp: "special", powerCost: 4, comboNumber: 3, features: ["ブラック", "男"] });
    expectRarityIn("XG5-040", ["NR"]);
  });

  it("XG5-040: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: atwiki/page-2241「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG5-040", "k")] }, "XG5-040:k"))).toBe(true);
  });

  leadMaTests("XG5-040", "atwiki/page-2241");

  // 3番目に出る。自軍コマンドゾーン: WB だけ。敵軍: ET の S ユニット、WB/ET の S ユニット、WB の S ユニット、WB の M ユニット。
  const P2 = () => ({ rush: [inst("SPEC-ETS", "et"), inst("SPEC-EM", "m")], battle: [inst("SPEC-WBET", "we"), inst("SPEC-E2", "wb")] });
  const entered = (hand = 2) => enter(battle({ hand: handN(hand), battle: fill(2), rush: [inst("XG5-040", "k")], command: releasedCat("WB", 1) }, P2()), "XG5-040:k");

  it("XG5-040: NC【スネークバレット】— 3番目に出たとき「SP1」になる（出典: atwiki/page-2241「「SP1」」・SP：！）", () => {
    expect(spOf(entered(), "player1", "XG5-040:k")).toBe(1);
  });

  it("XG5-040: NC【スネークバレット】— 自軍コマンドゾーンにないカテゴリ（ET）を持つ敵軍 S ユニットから選ぶ（WB/ET のマルチカテゴリも、ET がないので選べる。WB だけのユニット・M ユニットは選べない）（出典: atwiki/page-2241「自軍コマンドゾーンにないカテゴリを持つ敵軍Sユニットを1体選び撃破する」・利用者の決定 2026-10-20・questions-all.md U-26）", () => {
    const s = entered(2);
    expectChoiceFrom(s, "player1", "XG5-040");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-ETS:et", "SPEC-WBET:we"]);
  });

  it("XG5-040: NC【スネークバレット】— 選んだユニットは撃破されて捨札になる（出典: atwiki/page-2241「撃破する」）", () => {
    const s = resolveAll(pick(entered(2), "SPEC-ETS:et"), []);
    expect(zoneOf(s, "player2", "SPEC-ETS:et")).toBe("discard");
  });

  it("XG5-040: NC【スネークバレット】— 自分の手札が1枚以下なら、自軍コマンドゾーンにあるカテゴリ（WB）だけを持つ敵軍 S ユニットも選べる（出典: atwiki/page-2241「自軍コマンドゾーンにあるカテゴリを持つ敵軍Sユニットを選んでもよい」）", () => {
    const s = entered(1);
    expectChoiceFrom(s, "player1", "XG5-040");
    expect(choiceIds(s)).toContain("SPEC-E2:wb");
    expect(choiceIds(s)).not.toContain("SPEC-EM:m");
  });

  it("XG5-040: NC が成立しなければ（1番目）SP を持たない（出典: atwiki/page-2241「SP：！」）", () => {
    const s = enter(battle({ rush: [inst("XG5-040", "k")] }), "XG5-040:k");
    expect(spOf(s, "player1", "XG5-040:k")).toBe(0);
  });
});
