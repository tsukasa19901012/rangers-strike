/**
 * カード別スペック: XG2-001〜XG2-007（クロスギャザー ザ・ドラゴンタイガー ファイブレッド〜ランドガンマ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-001」〜「XG2-007」とカード名で検索。card_5 の「ファイブブルー」は RS-273 の項）。atwiki に転載された公式 Q&A（XG2-001 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-KW-CALL-01・R-KW-WING-01・R-KW-BLAST-01・R-ADD-06）・atwiki/page-1517（「ゾーン」）・
 *     atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 *
 * 「持ち主のゾーンに置く」は、持ち主のパワーゾーン（オモテ向き）かコマンドゾーン（リリース状態）のどちらか（atwiki/page-1517 Q1「パワーゾーンと
 * コマンドゾーンの両方を指した総称」・Q2・R-ZONE-09）。どちらを選ぶかは決めず、持ち主のどちらかのゾーンにあることだけを確かめる（questions.md）。
 *
 * 既存の照合と重なるもの（ここでは繰り返さない）:
 *  - ブラストそのもの（R-KW-BLAST-01〜03）は rulesSpec/07-blast.test.ts。ウイングそのものは wingTests（RK1 ヘルパー）の形で確かめる。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attackedInEnemyTurn,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  heldN,
  inOwnersZone,
  inst,
  lastBattleBps,
  legal,
  ncEnter,
  p1Battle,
  pick,
  powerCards,
  released,
  releasedCat,
  resident,
  resolveAll,
  resolveZone,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  wingTests,
  zoneOf,
} from "./XG2-001-020.helpers";

const MECHA_S = sUnit("SPEC-MECHA-S", { bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { bp: 3000, size: "M", features: ["メカ"] });
const BEAST_S = sUnit("SPEC-BEAST-S", { bp: 1000, features: ["獣"] });
const INSECT_S = sUnit("SPEC-INSECT-S", { bp: 1000, features: ["昆虫"] });
const BEAST_M = sUnit("SPEC-BEAST-M", { bp: 3000, size: "M", features: ["獣"] });
const PLAIN_S = sUnit("SPEC-PLAIN-S", { bp: 1000, features: ["男"] });
const NUM_S = sUnit("SPEC-NUM-S", { bp: 1000, features: ["2nd"] });
const KANJI_S = sUnit("SPEC-KANJI-S", { bp: 1000, features: ["妖魔一族"] });
const KANA_S = sUnit("SPEC-KANA-S", { bp: 1000, features: ["ファイブハンド"] });
const NUM_M = sUnit("SPEC-NUM-M", { bp: 3000, size: "M", features: ["2nd"] });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { bp: 1000, powerCost: 2 });
const C4 = sUnit("SPEC-C4", { bp: 1000, powerCost: 4 });
const C3M = sUnit("SPEC-C3M", { bp: 3000, size: "M", powerCost: "3+" as never });
const MONO_M = sUnit("SPEC-MONO-M", { category: "OT", bp: 4000, size: "M" });
const EXTRA = [MECHA_S, MECHA_M, BEAST_S, INSECT_S, BEAST_M, PLAIN_S, NUM_S, KANJI_S, KANA_S, NUM_M, ET_S, C2, C4, C3M, MONO_M];

/** カテゴリを2つ以上持つコマンド（TST-OP-WB-ET）。 */
const multiCmd = (n: number, prefix = "mc") => Array.from({ length: n }, (_, i) => released("TST-OP-WB-ET", `${prefix}${i}`));

// ===========================================================================
/** ファイブレッド・ファイブブルー・ファイブピンク（CN5 の NC「SP1」＋敵軍 S ユニットを持ち主のゾーンに置く）の共通テスト。 */
function fiveTests(opts: { id: string; page: string; effect: string; yes: string[]; no: string[]; noWhy: string }) {
  const { id, page, effect } = opts;
  const enemy = () => ({
    rush: opts.yes.slice(0, 1).map((c) => inst(c, "r")),
    battle: [...opts.yes.slice(1).map((c, i) => inst(c, `b${i}`)), ...opts.no.map((c, i) => inst(c, `n${i}`))],
  });
  const yesIds = [...opts.yes.slice(0, 1).map((c) => `${c}:r`), ...opts.yes.slice(1).map((c, i) => `${c}:b${i}`)].sort();
  const entered = (fillerCount = 4) => ncEnter(`${id}:f`, fillerCount, {}, enemy(), EXTRA);

  it(`${id}: NC【${effect}】— ナンバーコンビネーション（バトルエリアの5番目）で「SP1」を得る（出典: ${page}「「SP1」」・R-CN-01）`, () => {
    let s = entered();
    if (s.pendingEffectChoice?.sourceCardId === id) s = skip(s);
    expect(spOf(settle(s), "player1", `${id}:f`)).toBe(1);
  });

  it(`${id}: NC【${effect}】— 選べるのは条件に合う敵軍 S ユニット（ラッシュエリア・バトルエリア）。${opts.noWhy}は選べない。任意（出典: ${page}）`, () => {
    const s = entered();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(yesIds);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: NC【${effect}】— 選んだユニットは持ち主（敵軍）のゾーン（パワーゾーンかコマンドゾーン）に置かれる（出典: ${page}「持ち主のゾーンに置いてもよい」・atwiki/page-1517 Q1）`, () => {
    const target = yesIds[0]!;
    const s = resolveZone(pick(entered(), target));
    expect(inOwnersZone(s, "player2", target)).toBe(true);
  });

  it(`${id}: NC【${effect}】— 置かなくてもよい（敵軍のユニットはそのまま）（出典: ${page}「置いてもよい」）`, () => {
    const s = entered();
    const t = s.pendingEffectChoice?.sourceCardId === id ? resolveAll(skip(s)) : resolveAll(s);
    for (const target of yesIds) expect(["rush", "battle"]).toContain(zoneOf(t, "player2", target));
  });

  it(`${id}: NC しなければ（バトルエリアの1番目）発動せず、「SP1」も得ない（出典: ${page}・R-CN-01）`, () => {
    const s = entered(0);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe(id);
    expect(spOf(settle(s), "player1", `${id}:f`)).toBe(0);
  });
}

// ===========================================================================
describe("XG2-001 ファイブレッド", () => {
  const TEXT = "※コールET 【ファイブラスター】「SP1」特徴「メカ」を持つ敵軍Sユニットを1体選び、持ち主のゾーンに置いてもよい。";

  it("XG2-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-1852）", () => {
    expectCatalogText("XG2-001", TEXT);
    expectUnit("XG2-001", { name: "ファイブレッド", category: ["OT", "ET"], size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男"] });
    expectRarityIn("XG2-001", ["R"]);
  });

  fiveTests({
    id: "XG2-001",
    page: "atwiki/page-1852",
    effect: "ファイブラスター",
    yes: ["SPEC-MECHA-S", "SPEC-MECHA-S"],
    no: ["SPEC-MECHA-M", "SPEC-PLAIN-S"],
    noWhy: "「メカ」の M ユニット・「メカ」を持たない S ユニット",
  });

  it("XG2-001: ※コールET — 自軍ラッシュエリアのこれを、ET のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-1852「※コールET」・R-KW-CALL-01）", () => {
    let s = rushBoard({ hand: [inst("SPEC-ET-S", "u")], rush: [inst("XG2-001", "c")], power: powerCards(3) }, {}, EXTRA);
    const pay = legal(s).find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === "SPEC-ET-S:u");
    expect(pay).toBeDefined();
    s = act(s, pay!);
    expect(zoneOf(s, "player1", "SPEC-ET-S:u")).toBe("rush");
    expect(cardIn(s, "player1", "XG2-001:c")?.commandHeld).toBe(true);
  });

  it("XG2-001: 公式Q&A — RS-262 フラッシュキング【スーパーコズモフラッシュ】の「OT以外のカード」として、自軍パワーゾーンのファイブレッド（OT を含むマルチカテゴリ）は選べない（出典: atwiki/page-1852 Q1「OTを含むカードは「OTのカードである」として扱われます」）", () => {
    const s = enter(p1Battle({ rush: [inst("RS-262", "fk")], power: [inst("XG2-001", "p"), inst("TST-P", "p1"), inst("TST-P", "p2")] }, {}, EXTRA), "RS-262:fk");
    expectChoiceFrom(s, "player1", "RS-262");
    expect(choiceIds(s)).not.toContain("XG2-001:p");
  });
});

// ===========================================================================
describe("XG2-002 ファイブブルー", () => {
  const TEXT = "【ツインフリスビー】「SP1」特徴「獣」または「昆虫」を持つ敵軍Sユニットを1体選び、持ち主のゾーンに置いてもよい。";

  it("XG2-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-1786）", () => {
    expectCatalogText("XG2-002", TEXT);
    expectUnit("XG2-002", { name: "ファイブブルー", category: ["OT", "ET"], size: "S", bp: 3000, sp: "special", powerCost: 1, comboNumber: 5, features: ["ブルー", "男"] });
    expectRarityIn("XG2-002", ["N"]);
  });

  fiveTests({
    id: "XG2-002",
    page: "atwiki/page-1786",
    effect: "ツインフリスビー",
    yes: ["SPEC-BEAST-S", "SPEC-INSECT-S"],
    no: ["SPEC-BEAST-M", "SPEC-PLAIN-S"],
    noWhy: "「獣」の M ユニット・「獣」「昆虫」を持たない S ユニット",
  });
});

// ===========================================================================
describe("XG2-003 ファイブピンク", () => {
  const TEXT = "【サークルピュータ】「SP1」数字（漢字も含む）を含む特徴を持つ敵軍Sユニットを1体選び、持ち主のゾーンに置いてもよい。";

  it("XG2-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-1750）", () => {
    expectCatalogText("XG2-003", TEXT);
    expectUnit("XG2-003", { name: "ファイブピンク", category: ["OT", "ET"], size: "S", bp: 2000, sp: "special", powerCost: 0, comboNumber: 5, features: ["ピンク", "女"] });
    expectRarityIn("XG2-003", ["N"]);
  });

  fiveTests({
    id: "XG2-003",
    page: "atwiki/page-1750",
    effect: "サークルピュータ",
    yes: ["SPEC-NUM-S", "SPEC-KANJI-S"],
    no: ["SPEC-KANA-S", "SPEC-NUM-M", "SPEC-PLAIN-S"],
    noWhy:
      "カタカナで書かれた数（「ファイブハンド」。カード評価「カタカナで表記された特徴は対象外」）・数字の特徴の M ユニット・数字を含まない特徴だけの S ユニット",
  });
});

// ===========================================================================
describe("XG2-004 ファイブロボ", () => {
  const TEXT =
    "合体―スカイアルファー＋キャリアベータ＋ランドガンマ ※ブラスト 【超次元ソード】このユニットは、カテゴリを2つ以上持つ自軍コマンドが2つ以上あれば「SP2」になる。";

  it("XG2-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-1693）", () => {
    expectCatalogText("XG2-004", TEXT);
    expectUnit("XG2-004", { name: "ファイブロボ", category: ["OT", "ET"], size: "L", bp: 12000, sp: 1, powerCost: "8+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("XG2-004", ["R"]);
  });

  const MATS = () => [inst("XG2-005", "a"), inst("XG2-006", "b"), inst("XG2-007", "c")];
  const board = (rush = MATS(), power = 8, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushBoard({ hand: [inst("XG2-004", "r")], rush, power: powerCards(power), command: [...releasedCat("OT", 1), ...releasedCat("ET", 1)], ...p1 }, {}, EXTRA);

  it("XG2-004: 追加条件（合体）— スカイアルファー・キャリアベータ・ランドガンマを自軍エリアから捨札にし、パワー8でラッシュできる（出典: atwiki/page-1693「合体―スカイアルファー＋キャリアベータ＋ランドガンマ」「必要パワー：8+」・R-ADD-06）", () => {
    const r = rushFromHand(board(), "player1", "XG2-004:r");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "XG2-004:r")).toBe("rush");
    for (const m of ["XG2-005:a", "XG2-006:b", "XG2-007:c"]) expect(zoneOf(s, "player1", m)).toBe("discard");
  });

  it("XG2-004: 合体のユニットが1体でも足りなければラッシュできない。パワー7でもラッシュできない（出典: atwiki/page-1693・R-ADD-06）", () => {
    expect(canStartRush(board(MATS().slice(0, 2)), "player1", "XG2-004:r")).toBe(false);
    expect(canStartRush(board(MATS(), 7), "player1", "XG2-004:r")).toBe(false);
  });

  it("XG2-004: ※ブラスト — 残りダメージ1点（ダメージ6点）で自軍 L ユニットがなければ、合体のユニットがなくてもラッシュできる（出典: atwiki/page-1693「※ブラスト」・R-KW-BLAST-01）", () => {
    expect(canStartRush(board([], 8, { damage: 6 }), "player1", "XG2-004:r")).toBe(true);
    expect(canStartRush(board([], 8, { damage: 5 }), "player1", "XG2-004:r")).toBe(false);
  });

  const inBattle = (cmds: number) =>
    p1Battle({ battle: [inst("XG2-004", "r")], command: [...multiCmd(cmds), ...releasedCat("OT", 1)] }, {}, EXTRA);

  it("XG2-004: 【超次元ソード】カテゴリを2つ以上持つ自軍コマンドが2つ以上あれば「SP2」になる（出典: atwiki/page-1693）", () => {
    expect(spOf(inBattle(2), "player1", "XG2-004:r")).toBe(2);
  });

  it("XG2-004: 【超次元ソード】カテゴリを2つ以上持つ自軍コマンドが1つだけなら SP1 のまま（出典: atwiki/page-1693「2つ以上あれば」・カード評価「SP2を得るためにはマルチカテゴリのコマンドが2枚必要」）", () => {
    expect(spOf(inBattle(1), "player1", "XG2-004:r")).toBe(1);
  });

  it("XG2-004: 【超次元ソード】敵軍コマンドのマルチカテゴリのカードは数えない（出典: atwiki/page-1693「自軍コマンド」）", () => {
    const s = p1Battle({ battle: [inst("XG2-004", "r")], command: releasedCat("OT", 1) }, { command: multiCmd(2, "emc") }, EXTRA);
    expect(spOf(s, "player1", "XG2-004:r")).toBe(1);
  });
});

// ===========================================================================
/** 「自軍Sユニット n 体（をそれぞれ）自軍ゾーンに送る」の追加条件の共通テスト（XG2-005〜007）。 */
function zoneZordTests(id: string, page: string, n: number, power: number) {
  const board = (sCount: number, pw = power) =>
    rushBoard(
      { hand: [inst(id, "z")], rush: Array.from({ length: sCount }, (_, i) => inst("TST-UNIT-0", `s${i}`)), power: powerCards(pw), command: [...releasedCat("OT", 1), ...releasedCat("ET", 1)] },
      {},
      EXTRA,
    );

  it(`${id}: 追加条件 — 自軍 S ユニット ${n} 体を自軍ゾーンに送り、パワー${power}でラッシュできる（送ったユニットは自軍のパワーゾーンかコマンドゾーンにある）（出典: ${page}「追加条件：自軍Sユニット${n === 1 ? "1体を" : `${n}体をそれぞれ`}自軍ゾーンに送る」・atwiki/page-1517 Q1）`, () => {
    const r = rushFromHand(board(n), "player1", `${id}:z`);
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:z`)).toBe("rush");
    for (let i = 0; i < n; i++) expect(inOwnersZone(s, "player1", `TST-UNIT-0:s${i}`)).toBe(true);
  });

  it(`${id}: 追加条件 — S ユニットが ${n - 1} 体しかなければラッシュできない。パワー${power - 1}でもラッシュできない（出典: ${page}）`, () => {
    expect(canStartRush(board(n - 1), "player1", `${id}:z`)).toBe(false);
    expect(canStartRush(board(n, power - 1), "player1", `${id}:z`)).toBe(false);
  });

  it(`${id}: 追加条件 — 送り先に自軍コマンドゾーンも選べる（「ゾーン」はパワーゾーンとコマンドゾーンの総称）（出典: ${page}・atwiki/page-1517 Q1）`, () => {
    const r = rushFromHand(board(n), "player1", `${id}:z`, { destination: "command" });
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "TST-UNIT-0:s0")).toBe("command");
  });
}

// ===========================================================================
describe("XG2-005 スカイアルファー", () => {
  const TEXT =
    "※ウイング 【アルファーレーザー】自軍ターン中、これがバトルエリアに出たとき、ホールド状態の敵軍コマンドをすべてリリースしてもよい。そうしたとき、リリースした枚数を数えて、その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び持ち主のゾーンに置く。";

  it("XG2-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-1787）", () => {
    expectCatalogText("XG2-005", TEXT);
    expectUnit("XG2-005", { name: "スカイアルファー", category: ["OT", "ET"], size: "M", bp: 4000, sp: undefined, powerCost: "5+", features: ["メカ", "航空機"], rushCondition: "send_s_units_to_zones" });
    expectRarityIn("XG2-005", ["N"]);
  });

  zoneZordTests("XG2-005", "atwiki/page-1787", 1, 5);
  wingTests("XG2-005", "atwiki/page-1787");

  /** 自軍バトルフェイズに出る。敵軍のコマンドはホールド状態3つ＋リリース状態1つ。 */
  const entered = () =>
    enter(
      p1Battle(
        { rush: [inst("XG2-005", "a")] },
        { command: [...heldN(3, "TST-OP", "eh"), released("TST-OP", "er")], rush: [inst("SPEC-C2", "c2"), inst("SPEC-C4", "c4")], battle: [inst("SPEC-C3M", "m3")] },
        EXTRA,
      ),
      "XG2-005:a",
    );

  it("XG2-005: 【アルファーレーザー】自軍ターン中にバトルエリアに出たとき、ホールド状態の敵軍コマンドをすべてリリースするかを選べる（任意）。リリースすると敵軍のコマンドはすべてリリース状態になる（出典: atwiki/page-1787「ホールド状態の敵軍コマンドをすべてリリースしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG2-005");
    expect(canSkip(s)).toBe(true);
    expect(accept(s).players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it("XG2-005: 【アルファーレーザー】リリースすると、リリースした枚数（3）以下の必要パワーの数字を持つ敵軍ユニット（サイズ・エリアを問わない。「3+」は3）から1体選ぶ。必要パワー4のユニットは選べない（出典: atwiki/page-1787「その数以下の必要パワーの数字を持つ敵軍ユニットを1体選び」・コメント「サイズ無視」）", () => {
    const s = accept(entered());
    expectChoiceFrom(s, "player1", "XG2-005");
    expect(choiceIds(s)).toEqual(["SPEC-C2:c2", "SPEC-C3M:m3"]);
  });

  it("XG2-005: 【アルファーレーザー】選んだユニットは持ち主のゾーンに置かれる（出典: atwiki/page-1787「持ち主のゾーンに置く」）", () => {
    const s = resolveZone(pick(accept(entered()), "SPEC-C3M:m3"));
    expect(inOwnersZone(s, "player2", "SPEC-C3M:m3")).toBe(true);
  });

  it("XG2-005: 【アルファーレーザー】リリースしなければ、敵軍のコマンドはホールド状態のまま（出典: atwiki/page-1787「リリースしてもよい」）", () => {
    const s = resolveAll(skip(entered()));
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(3);
    expect(zoneOf(s, "player2", "SPEC-C2:c2")).toBe("rush");
  });
});

// ===========================================================================
describe("XG2-006 キャリアベータ", () => {
  const TEXT =
    "【ベータランチャー】これが自軍エリアにある間、自分も相手も次の制限を受ける⇒自分自身のバトルエリアのユニットは、自分自身のスタートフェイズ中と対戦相手のターン中以外はラッシュエリアに戻せない。";

  it("XG2-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-1788）", () => {
    expectCatalogText("XG2-006", TEXT);
    expectUnit("XG2-006", { name: "キャリアベータ", category: ["OT", "ET"], size: "M", bp: 6000, sp: undefined, powerCost: "4+", features: ["メカ", "車両"], rushCondition: "send_s_units_to_zones" });
    expectRarityIn("XG2-006", ["N"]);
  });

  zoneZordTests("XG2-006", "atwiki/page-1788", 2, 4);

  /** 自軍バトルフェイズ、RS-003 バトルダンス（自分のバトルフェイズにコマンド2つをホールドし、自軍Sユニットを1体ラッシュエリアに戻す）を常駐させた盤面。 */
  const danceBoard = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    p1Battle({ operation: [resident("RS-003", "bd")], battle: [inst("TST-UNIT-0", "u")], command: releasedCat("WB", 2), ...p1 }, p2, EXTRA);

  /** RS-003 バトルダンスでバトルエリアの自軍ユニットをラッシュエリアに戻す手（battle_dance_retreat）があるか。 */
  const canDance = (s: GameState) => legal(s).some((a) => a.type === "battle_dance_retreat" && a.playerId === "player1");

  it("XG2-006: 対照 — キャリアベータがなければ、自軍バトルフェイズに RS-003 バトルダンスでバトルエリアのユニットをラッシュエリアに戻せる（出典: RS-003 本文）", () => {
    expect(canDance(danceBoard({}))).toBe(true);
  });

  it("XG2-006: 【ベータランチャー】自軍エリアにある間、自軍バトルフェイズ（スタートフェイズ以外の自分のターン）にはバトルエリアの自軍ユニットをラッシュエリアに戻せない（出典: atwiki/page-1788・コメント「バトルダンスとナイトフィーバー封じ」）", () => {
    const s = danceBoard({ rush: [inst("XG2-006", "cb")] });
    expect(canDance(s)).toBe(false);
  });

  it("XG2-006: 【ベータランチャー】「自分も相手も」— 相手のエリアにあるときも、自分のバトルフェイズに自分のバトルエリアのユニットを戻せない（出典: atwiki/page-1788「自分も相手も次の制限を受ける」）", () => {
    const s = danceBoard({}, { rush: [inst("XG2-006", "cb")] });
    expect(canDance(s)).toBe(false);
  });

  it("XG2-006: 【ベータランチャー】自分のスタートフェイズには、バトルエリアのユニットを通常どおりラッシュエリアに戻せる（出典: atwiki/page-1788「自分自身のスタートフェイズ中…以外は」）", () => {
    const s = st({ phase: "start", activePlayer: "player1", player1: { deck: deckCards(5), battle: [inst("TST-UNIT-0", "u")], rush: [inst("XG2-006", "cb")] }, player2: { deck: deckCards(5, "e") } }, EXTRA);
    expect(legal(s).some((a) => a.type === "return_all_battle_to_rush" && a.playerId === "player1")).toBe(true);
  });
});

// ===========================================================================
describe("XG2-007 ランドガンマ", () => {
  const TEXT =
    "【ガンマカノン砲】これが自軍エリアにある間、カテゴリを2つ以上持つ自軍Mユニットは次の能力を得る⇒アタックされるとき、カテゴリを2つ以上持つ自軍コマンド1つにつきBP＋3000される。";

  it("XG2-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-1789）", () => {
    expectCatalogText("XG2-007", TEXT);
    expectUnit("XG2-007", { name: "ランドガンマ", category: ["OT", "ET"], size: "M", bp: 4000, sp: undefined, powerCost: "3+", features: ["メカ", "車両"], rushCondition: "send_s_units_to_zones" });
    expectRarityIn("XG2-007", ["N"]);
  });

  zoneZordTests("XG2-007", "atwiki/page-1789", 2, 3);

  it("XG2-007: 【ガンマカノン砲】カテゴリを2つ以上持つ自軍 M ユニット（これ自身も）は、アタックされるときカテゴリを2つ以上持つ自軍コマンド1つにつき BP+3000（2つで BP4000→10000）（出典: atwiki/page-1789）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG2-007", "g")], command: multiCmd(2) }, "XG2-007:g", {}, "TST-UNIT-7:atk", EXTRA);
    expect(lastBattleBps(s)?.defender).toBe(10000);
  });

  it("XG2-007: 【ガンマカノン砲】単色の自軍 M ユニットは BP が上がらない（出典: atwiki/page-1789「カテゴリを2つ以上持つ自軍Mユニットは」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SPEC-MONO-M", "m")], rush: [inst("XG2-007", "g")], command: multiCmd(2) }, "SPEC-MONO-M:m", {}, "TST-UNIT-7:atk", EXTRA);
    expect(lastBattleBps(s)?.defender).toBe(4000);
  });

  it("XG2-007: 【ガンマカノン砲】ラッシュエリアにあっても効く（「自軍エリアにある間」）。マルチカテゴリの M ユニット（キャリアベータ）が BP6000→12000（出典: atwiki/page-1789「これが自軍エリアにある間」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG2-006", "cb")], rush: [inst("XG2-007", "g")], command: multiCmd(2) }, "XG2-006:cb", {}, "TST-UNIT-7:atk", EXTRA);
    expect(lastBattleBps(s)?.defender).toBe(12000);
  });

  it("XG2-007: 【ガンマカノン砲】アタックするときは上がらない（自軍バトルフェイズに BP4000 のまま）（出典: atwiki/page-1789「アタックされるとき」）", () => {
    const s = settle(act(p1Battle({ battle: [inst("XG2-007", "g")], command: multiCmd(2) }, { battle: [inst("TST-UNIT-7", "big")] }, EXTRA), { type: "battle", playerId: "player1", attackerInstanceId: "XG2-007:g", defenderInstanceId: "TST-UNIT-7:big" }));
    expect(lastBattleBps(s)?.attacker).toBe(4000);
  });
});
