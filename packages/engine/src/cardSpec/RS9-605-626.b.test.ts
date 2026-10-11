/**
 * カード別スペック: RS-613〜RS-619（第9弾「蒼九の翼」ダイヤジャック〜ジェットマシン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-9（カード別 Q&A なし。キーワード「ブラスト」Q1 を RS-617 で参照）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。RS-613 は Q1・Q2 あり）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-ZONE-08、R-KW-BLAST-01、R-DECK-03 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import {
  act,
  attackersOf,
  bpOf,
  canSkip,
  canStartRush,
  canWing,
  cardIn,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  enterBattleByEffect,
  enterSeq,
  expectCatalogText,
  expectRarity,
  expectStats,
  fill,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS9-605-626.helpers";

const BP4000 = sUnit("SPEC-BP4000", { bp: 4000 });
const BP4000M = sUnit("SPEC-BP4000-M", { bp: 4000, size: "M" });
const BP7000 = sUnit("SPEC-BP7000", { bp: 7000 });
const BP7500 = sUnit("SPEC-BP7500", { bp: 7500 });
const ET_NOSP = sUnit("SPEC-ET-NOSP", { category: "ET", sp: undefined });
const RED = sUnit("SPEC-RED", { category: "ET", sp: undefined, features: ["レッド"] });
const GREEN = sUnit("SPEC-GREEN", { category: "ET", sp: undefined, features: ["グリーン"] });
const BLUE = sUnit("SPEC-BLUE", { category: "ET", sp: undefined, features: ["ブルー"] });
const AIR = sUnit("SPEC-AIR", { bp: 13000, sp: 1, size: "L", features: ["航空機"] });
const WING_S = sUnit("SPEC-WING", { category: "ET", sp: undefined, text: "※ウイング" });

// ===========================================================================
describe("RS-613 ダイヤジャック", () => {
  const TEXT =
    "※タクスET 【ダイヤソード】このターン、次に自軍バトルエリアのユニットがホールド状態になったとき、ホールドしたユニットのBP以下のBPを持つ敵軍ユニットを1体選び撃破してもよい。";

  it("RS-613: カタログ本文・スペックが出典と一致（出典: atwiki/page-1452）", () => {
    expectCatalogText("RS-613", TEXT);
    expectStats("RS-613", { name: "ダイヤジャック", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["メカ", "ブルー", "男"] });
  });

  it("RS-613: レアリティ — ノーマルレア（出典: atwiki/page-1452）", () => {
    expectRarity("RS-613", "NR");
  });

  const taxis = (before: number, next: string) =>
    enterSeq(st({ player1: { battle: fill(before), rush: [inst("RS-613", "dj"), inst(next, "n")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [ET_NOSP, RED]), ["RS-613:dj", `${next}:n`]);

  it("RS-613: ※タクスET — 4番目にあるとき、次に並ぶ ET の S ユニットは SP1 を得る（出典: atwiki/page-1452・R-KW-TAXIS）", () => {
    expect(spOf(taxis(3, "SPEC-ET-NOSP"), "player1", "SPEC-ET-NOSP:n")).toBe(1);
  });

  it("RS-613: ※タクスET — 3番目にあるときは SP1 を与えない（出典: atwiki/page-1452「4番目にある間」）", () => {
    expect(spOf(taxis(2, "SPEC-ET-NOSP"), "player1", "SPEC-ET-NOSP:n")).toBe(0);
  });

  /** NC（1番目）でダイヤジャックを出し、次に仮面ライダーレイ（自分をホールドして BP+4000＝7000）を出す。 */
  const swordBoard = (first: "dj" | "fill" = "dj") =>
    st(
      {
        player1: { battle: first === "fill" ? fill(1) : [], rush: [inst("RS-613", "dj"), inst("RK-322", "rei")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BP7000", "e7"), inst("SPEC-BP7500", "e75"), inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
      },
      [BP7000, BP7500],
    );

  // 既知の不具合: CARD-RS-613 【ダイヤソード】が NC 成立時にすぐ「敵軍ユニットを1体選び撃破」を開き（BP 制限なし）、ホールドを待たない
  it.fails("RS-613: 【ダイヤソード】NC 成立時点では何も撃破しない（「次に自軍バトルエリアのユニットがホールド状態になったとき」まで待つ）（出典: atwiki/page-1452）", () => {
    const s = passEntry(enter(swordBoard(), "RS-613:dj"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-613");
  });

  // 既知の不具合: CARD-RS-613 【ダイヤソード】がホールドを待たずに発動する
  it.fails("RS-613: 【ダイヤソード】Q&A — 仮面ライダーレイが自分をホールドして BP7000 になった後なら、BP7000 以下の敵軍ユニットを撃破できる（出典: atwiki/page-1452 Q1「ＢＰ７０００以下のユニットまで撃破できます」）", () => {
    let s = passEntry(enter(swordBoard(), "RS-613:dj"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-613");
    s = enter(s, "RK-322:rei");
    // レイの【ブリザードクロー・エクスキュージョン】でホールドする
    s = resolveAll(s, ["RK-322:rei"]);
    expect(cardIn(s, "player1", "RK-322:rei")?.commandHeld).toBe(true);
    // 実装されていれば、レイの効果の解決後にダイヤソードの選択が開く
    expect(s.players.player2.battle.map((c) => c.instanceId)).not.toContain("SPEC-BP7000:e7");
  });

  // 既知の不具合: CARD-RS-613 【ダイヤソード】の候補に BP 制限がない
  it.fails("RS-613: 【ダイヤソード】候補はホールドしたユニットの BP 以下の敵軍ユニットだけ（出典: atwiki/page-1452「ホールドしたユニットのBP以下のBPを持つ」）", () => {
    let s = passEntry(enter(swordBoard(), "RS-613:dj"));
    s = enter(s, "RK-322:rei");
    for (let i = 0; i < 3 && s.pendingEffectChoice?.sourceCardId === "RK-322"; i++) s = pick(s, "RK-322:rei");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-613");
    expect(choiceIds(s)).toEqual(["SPEC-BP7000:e7", "TST-UNIT-0:e1"]);
  });

  it("RS-613: 【ダイヤソード】NC が成立しない（2番目）ときは発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(passEntry(enter(swordBoard("fill"), "RS-613:dj")));
    expect(s.players.player2.battle).toHaveLength(3);
  });

  // 既知の不具合: CARD-RS-613 【ダイヤソード】がホールドを待たずに発動する
  it.fails("RS-613: 【ダイヤソード】Q&A — 【潜水】でホールドされたバトルエリアのオロチでも発動できる（出典: atwiki/page-1452 Q2「はい、できます」）", () => {
    let s = st(
      { player1: { rush: [inst("RS-613", "dj"), inst("RK-231", "oro")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-BP7000", "e7")], deck: deckCards(3, "e") } },
      [BP7000],
    );
    s = passEntry(enter(s, "RS-613:dj"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-613");
    s = passEntry(enter(s, "RK-231:oro"));
    for (let i = 0; i < 4 && !s.pendingEffectChoice; i++) {
      const e = legal(s).find((a) => a.type === "end_phase");
      if (!e) break;
      s = act(s, e);
    }
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-231");
    s = pick(s, "RK-231:oro");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-613");
    s = resolveAll(pick(s, "SPEC-BP7000:e7"));
    expect(zoneOf(s, "player2", "SPEC-BP7000:e7")).toBe("discard");
  });

  it.todo("RS-613: 【ダイヤソード】任意（撃破しなくてもよい）・「このターン」の次の1回だけ（出典: atwiki/page-1452「撃破してもよい」「次に」）— 発動タイミング自体が誤っており（NC 成立時に即発動）、正しい状況を公開 API で観測できないため");
});

// ===========================================================================
describe("RS-614 クローバーキング", () => {
  const TEXT = "【クラブメガトン】BP4000の敵軍Sユニットをすべて持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。";

  it("RS-614: カタログ本文・スペックが出典と一致（出典: atwiki/page-1453）", () => {
    expectCatalogText("RS-614", TEXT);
    expectStats("RS-614", { name: "クローバーキング", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 3, features: ["メカ", "グリーン", "男"] });
  });

  it("RS-614: レアリティ — ノーマル（出典: atwiki/page-1453）", () => {
    expectRarity("RS-614", "N");
  });

  const board = (nth = 3, enemyCommand: ReturnType<typeof inst>[] = []) =>
    st(
      {
        player1: { battle: fill(nth - 1), rush: [inst("RS-614", "k")], deck: deckCards(3) },
        player2: {
          battle: [inst("SPEC-BP4000", "a"), inst("TST-UNIT-0", "low"), inst("SPEC-BP4000-M", "m")],
          rush: [inst("SPEC-BP4000", "b")],
          command: enemyCommand,
          deck: deckCards(3, "e"),
        },
      },
      [BP4000, BP4000M],
    );

  // 既知の不具合: CARD-RS-614 【クラブメガトン】が汎用の「敵軍ユニットを1体選ぶ」処理（hold_enemy_unit）で、BP4000 の S ユニットを「すべて」置かない
  it.fails("RS-614: 【クラブメガトン】NC（3番目）— BP4000 の敵軍 S ユニット（バトル・ラッシュエリア）をすべて持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1453）", () => {
    let s = enterSeq(board(), ["RS-614:k"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-614" && s.pendingEffectChoice.kind === "confirm") s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-BP4000:b")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-BP4000:a")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:low")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-BP4000-M:m")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-614 【クラブメガトン】の対象条件（BP4000 の S ユニット）が落ちている
  it.fails("RS-614: 【クラブメガトン】BP4000 でない S ユニット・BP4000 の M ユニットは置かない（出典: atwiki/page-1453「BP4000の敵軍Sユニット」）", () => {
    const s = enterSeq(board(), ["RS-614:k"]);
    for (const id of choiceIds(s)) expect(["SPEC-BP4000:a", "SPEC-BP4000:b"]).toContain(id);
    expect(choiceIds(s).length).toBeGreaterThan(0);
  });

  // 既知の不具合: CARD-RS-614 【クラブメガトン】が「すべて」ではなく1体選択
  it.fails("RS-614: 【クラブメガトン】敵軍コマンドゾーンが5枚で置けなければ捨札にする（出典: atwiki/page-1453「置けなければ捨札にする」・R-ZONE-08）", () => {
    const s = resolveAll(enterSeq(board(3, Array.from({ length: 5 }, (_, i) => inst("TST-OP", `ec${i}`))), ["RS-614:k"]), ["SPEC-BP4000:a", "SPEC-BP4000:b"]);
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BP4000:b")).toBe("discard");
  });

  it("RS-614: 【クラブメガトン】任意 — 置かないことを選べる（出典: atwiki/page-1453「置いてもよい」）", () => {
    let s = enterSeq(board(), ["RS-614:k"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-614");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-BP4000:b")).toBe("rush");
  });

  it("RS-614: 【クラブメガトン】NC が成立しない（2番目）ときは発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(board(2), ["RS-614:k"]), ["SPEC-BP4000:a"]);
    expect(zoneOf(s, "player2", "SPEC-BP4000:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-BP4000:b")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-615 ハートクイン", () => {
  const TEXT =
    "【ジャッカーコバック】自軍バトルエリアから、特徴「ブルー」「レッド」「グリーン」を持つSユニットをそれぞれ1体ずつ好きな順にホールドして、次の効果を発動できる⇒このターン、これはSP1になり、ホールド状態の敵軍コマンドをすべて捨札にする。";

  it("RS-615: カタログ本文・スペックが出典と一致（出典: atwiki/page-1454）", () => {
    expectCatalogText("RS-615", TEXT);
    expectStats("RS-615", { name: "ハートクイン", category: "ET", size: "S", bp: 1000, sp: "special", powerCost: 1, comboNumber: 4, features: ["メカ", "ピンク", "女", "警察"] });
  });

  it("RS-615: レアリティ — ノーマル（出典: atwiki/page-1454）", () => {
    expectRarity("RS-615", "N");
  });

  const board = (battle: string[], nth = 4) =>
    st(
      {
        player1: { battle: [...battle.map((id, i) => inst(id, `u${i}`)), ...fill(nth - 1 - battle.length)], rush: [inst("RS-615", "q")], deck: deckCards(3) },
        player2: { command: [held("TST-OP", "eh1"), held("TST-OP", "eh2"), inst("TST-OP", "er")], deck: deckCards(3, "e") },
      },
      [RED, GREEN, BLUE],
    );

  // 既知の不具合: CARD-RS-615 【ジャッカーコバック】が未実装（grant_effect_generic のターン修飾子を登録するだけ）
  it.fails("RS-615: 【ジャッカーコバック】NC（4番目）— ブルー・レッド・グリーンの S ユニットを1体ずつホールドすると SP1 になり、ホールド状態の敵軍コマンドをすべて捨札にする（出典: atwiki/page-1454）", () => {
    let s = enterSeq(board(["SPEC-BLUE", "SPEC-RED", "SPEC-GREEN"]), ["RS-615:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-615");
    s = resolveAll(s, ["SPEC-BLUE:u0", "SPEC-RED:u1", "SPEC-GREEN:u2"]);
    expect(cardIn(s, "player1", "SPEC-BLUE:u0")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "SPEC-RED:u1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player1", "SPEC-GREEN:u2")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "RS-615:q")).toBe(1);
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:eh2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:er")).toBe("command");
  });

  it("RS-615: 【ジャッカーコバック】3色のうち1色（グリーン）が欠けていれば発動できない（SP は0、敵軍コマンドはそのまま）（出典: atwiki/page-1454「それぞれ1体ずつ…ホールドして」）", () => {
    const s = resolveAll(enterSeq(board(["SPEC-BLUE", "SPEC-RED"]), ["RS-615:q"]));
    expect(spOf(s, "player1", "RS-615:q")).toBe(0);
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("command");
  });

  // 既知の不具合: CARD-RS-615 【ジャッカーコバック】が未実装（選択が開かない）
  it.fails("RS-615: 【ジャッカーコバック】任意 — 発動しなければホールドも SP1 もない（出典: atwiki/page-1454「発動できる」）", () => {
    let s = enterSeq(board(["SPEC-BLUE", "SPEC-RED", "SPEC-GREEN"]), ["RS-615:q"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-615");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(cardIn(s, "player1", "SPEC-BLUE:u0")?.commandHeld ?? false).toBe(false);
    expect(spOf(s, "player1", "RS-615:q")).toBe(0);
  });

  it("RS-615: 【ジャッカーコバック】NC が成立しない（3番目）ときは発動しない（SP！は0）（出典: R-CN-02）", () => {
    const s = resolveAll(enterSeq(board(["SPEC-BLUE", "SPEC-RED"], 3), ["RS-615:q"]));
    expect(spOf(s, "player1", "RS-615:q")).toBe(0);
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("command");
  });
});

// ===========================================================================
describe("RS-616 クライマー", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。 【巨大ボール化】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから「クライマー」を2体選び捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒BP+4000";

  it("RS-616: カタログ本文・スペックが出典と一致（出典: atwiki/page-1455）", () => {
    expectCatalogText("RS-616", TEXT);
    expectStats("RS-616", { name: "クライマー", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 3, features: ["男", "戦闘員"] });
  });

  it("RS-616: レアリティ — ノーマル（出典: atwiki/page-1455）", () => {
    expectRarity("RS-616", "N");
  });

  it("RS-616: ※ デッキに好きな枚数（10枚）入れられる（出典: atwiki/page-1455・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-616", count: 10 }], undefined, { minSize: 10 });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  const board = (rush: string[]) =>
    st({ player1: { rush: [inst("RS-616", "c"), ...rush.map((id, i) => inst(id, `r${i}`))], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it("RS-616: 【巨大ボール化】自軍ラッシュエリアの「クライマー」2体を捨札にすると、このターン BP+4000（出典: atwiki/page-1455）", () => {
    let s = enterSeq(board(["RS-616", "RS-616", "TST-UNIT-0"]), ["RS-616:c"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-616");
    expect(choiceIds(s)).toEqual(["RS-616:r0", "RS-616:r1"]);
    s = resolveAll(s, ["RS-616:r0", "RS-616:r1"]);
    expect(zoneOf(s, "player1", "RS-616:r0")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-616:r1")).toBe("discard");
    expect(bpOf(s, "player1", "RS-616:c")).toBe(4500);
  });

  it("RS-616: 【巨大ボール化】自軍ラッシュエリアの「クライマー」が1体だけなら発動しない（出典: atwiki/page-1455「「クライマー」を2体選び」）", () => {
    const s = resolveAll(enterSeq(board(["RS-616", "TST-UNIT-0"]), ["RS-616:c"]));
    expect(zoneOf(s, "player1", "RS-616:r0")).toBe("rush");
    expect(bpOf(s, "player1", "RS-616:c")).toBe(500);
  });

  it("RS-616: 【巨大ボール化】任意 — 捨札にしなければ BP は上がらない（出典: atwiki/page-1455「捨札にしてもよい」）", () => {
    let s = enterSeq(board(["RS-616", "RS-616"]), ["RS-616:c"]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.rush).toHaveLength(2);
    expect(bpOf(s, "player1", "RS-616:c")).toBe(500);
  });

  it("RS-616: 【巨大ボール化】敵軍ターン中に効果でバトルエリアに出たときは発動しない（出典: atwiki/page-1455「自軍ターン中」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-616", "c"), inst("RS-616", "r0"), inst("RS-616", "r1")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-616:c");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-616");
    expect(bpOf(s, "player1", "RS-616:c")).toBe(500);
  });

  it("RS-616: 【巨大ボール化】BP+4000 は「このターン」だけ（相手のターンには BP500 に戻る）（出典: atwiki/page-1455「このターン、これは次の能力を得る」）", () => {
    let s = resolveAll(enterSeq(board(["RS-616", "RS-616"]), ["RS-616:c"]), ["RS-616:r0", "RS-616:r1"]);
    expect(bpOf(s, "player1", "RS-616:c")).toBe(4500);
    s = endTurn(passEntry(s));
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "RS-616:c")).toBe(500);
  });
});

// ===========================================================================
describe("RS-617 グレートイカロス", () => {
  const TEXT =
    "合体―ジェットイカロス（またはジェットマシン）＋ジェットガルーダ（またはバードガルーダ） ※ブラスト 【バードメーザー】 これは、自軍捨札にウイングを持つユニットカードが5枚以上あれば「SP2」になる。";

  it("RS-617: カタログ本文・スペックが出典と一致（出典: atwiki/page-1499）", () => {
    expectCatalogText("RS-617", TEXT);
    expectStats("RS-617", { name: "グレートイカロス", category: "ET", size: "L", bp: 15000, sp: 1, powerCost: "6+", features: ["メカ", "人型", "航空機"], rushCondition: "discard_fusion_unit" });
  });

  it("RS-617: レアリティ — レア（出典: atwiki/page-1499）", () => {
    expectRarity("RS-617", "R");
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st({ phase: "rush", player1: { hand: [inst("RS-617", "gi")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e") } });

  it("RS-617: 合体 — 自軍のジェットイカロスとジェットガルーダを捨札にしてラッシュできる（出典: atwiki/page-1499「合体―ジェットイカロス…＋ジェットガルーダ…」）", () => {
    const r = rushFromHand(rushBoard({ rush: [inst("RS-618", "ji"), inst("RS-620", "jg")] }), "player1", "RS-617:gi", { materials: ["RS-618:ji", "RS-620:jg"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-617:gi")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-618:ji")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-620:jg")).toBe("discard");
  });

  it("RS-617: 合体 — 代わりにジェットマシンとバードガルーダでもラッシュできる（出典: atwiki/page-1499「（またはジェットマシン）」「（またはバードガルーダ）」）", () => {
    const r = rushFromHand(rushBoard({ rush: [inst("RS-619", "jm"), inst("RS-621", "bg")] }), "player1", "RS-617:gi", { materials: ["RS-619:jm", "RS-621:bg"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-619:jm")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-621:bg")).toBe("discard");
  });

  it("RS-617: 合体 — 片方（ガルーダ側）が欠けていればラッシュできない（出典: atwiki/page-1499）", () => {
    expect(canStartRush(rushBoard({ rush: [inst("RS-618", "ji"), inst("RS-619", "jm")] }), "player1", "RS-617:gi")).toBe(false);
  });

  it("RS-617: ※ブラスト — 自軍ダメージ6点（残り1点）で自軍 L ユニットがなければ、合体素材なしでラッシュできる（出典: atwiki/page-1499・grnrngr/faq-card-9 ブラスト Q1「追加条件を無視できるようになります」）", () => {
    const s = rushBoard({ damage: 6, rush: [inst("TST-UNIT-0", "s")] });
    expect(canStartRush(s, "player1", "RS-617:gi")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-617:gi");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-617:gi")).toBe("rush");
  });

  it("RS-617: ※ブラスト — 自軍 L ユニットがあれば追加条件は無視できない（出典: grnrngr/faq-card-9 ブラスト Q1「自軍Ｌユニットが１体もなければ」）", () => {
    expect(canStartRush(rushBoard({ damage: 6, rush: [inst("TST-UNIT-7", "l")] }), "player1", "RS-617:gi")).toBe(false);
  });

  it("RS-617: ※ブラスト — 自軍ダメージ5点（残り2点）なら追加条件は無視できない（出典: grnrngr/faq-card-9 ブラスト Q1「残りダメージ１点で」）", () => {
    expect(canStartRush(rushBoard({ damage: 5 }), "player1", "RS-617:gi")).toBe(false);
  });

  it("RS-617: ※ブラスト — 必要パワーは満たさなければならない（パワー5では不可）（出典: R-KW-BLAST-01・atwiki/page-1701「もちろん必要パワーは満たさなければならない」）", () => {
    expect(canStartRush(rushBoard({ damage: 6, power: powerCards(5) }), "player1", "RS-617:gi")).toBe(false);
  });

  const spBoard = (discard: ReturnType<typeof inst>[], enemyDiscard: ReturnType<typeof inst>[] = []) =>
    st({ player1: { battle: [inst("RS-617", "gi")], discard, deck: deckCards(3) }, player2: { discard: enemyDiscard, deck: deckCards(3, "e") } });
  const wings = (n: number, prefix = "w") => Array.from({ length: n }, (_, i) => inst(i % 2 ? "RS-622" : "RS-611", `${prefix}${i}`));

  // 既知の不具合: CARD-RS-617 【バードメーザー】が DSL スタブで NC の grant_keyword（SP2）になっており、常時効果として働かない
  it.fails("RS-617: 【バードメーザー】自軍捨札にウイングを持つユニットカードが5枚あれば SP2（出典: atwiki/page-1499）", () => {
    expect(spOf(spBoard(wings(5)), "player1", "RS-617:gi")).toBe(2);
  });

  it("RS-617: 【バードメーザー】ウイングを持つユニットカードが4枚（＋ウイングなし）なら SP1 のまま（出典: atwiki/page-1499「5枚以上あれば」）", () => {
    expect(spOf(spBoard([...wings(4), inst("TST-UNIT-0", "x")]), "player1", "RS-617:gi")).toBe(1);
  });

  it("RS-617: 【バードメーザー】敵軍捨札のウイング持ちは数えない（出典: atwiki/page-1499「自軍捨札に」）", () => {
    expect(spOf(spBoard(wings(2), wings(5, "ew")), "player1", "RS-617:gi")).toBe(1);
  });
});

// ===========================================================================
describe("RS-618 ジェットイカロス", () => {
  const TEXT = "【ジェットランサー】 これは、自軍捨札にあるウイングを持つユニットカード1体につきBP+1000される。";

  it("RS-618: カタログ本文・スペックが出典と一致（出典: atwiki/page-1456）", () => {
    expectCatalogText("RS-618", TEXT);
    expectStats("RS-618", { name: "ジェットイカロス", category: "ET", size: "L", bp: 6000, sp: 1, powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  it("RS-618: レアリティ — ノーマルレア（出典: atwiki/page-1456）", () => {
    expectRarity("RS-618", "NR");
  });

  it("RS-618: 追加条件 — 自軍「ジェットマシン」1体を捨札にしてラッシュできる（出典: atwiki/page-1456）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-618", "ji")], rush: [inst("RS-619", "jm")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-618:ji", { materials: ["RS-619:jm"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-618:ji")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-619:jm")).toBe("discard");
  });

  it("RS-618: 追加条件 — 自軍に「ジェットマシン」がなければラッシュできない（出典: atwiki/page-1456）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-618", "ji")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-618:ji")).toBe(false);
  });

  const board = (discard: ReturnType<typeof inst>[], enemyDiscard: ReturnType<typeof inst>[] = []) =>
    st({ player1: { battle: [inst("RS-618", "ji")], discard, deck: deckCards(3) }, player2: { discard: enemyDiscard, deck: deckCards(3, "e") } });

  // 既知の不具合: CARD-RS-618 【ジェットランサー】が DSL スタブで NC 扱い（bp_modify の汎用登録だけ）で、BP が上がらない
  it.fails("RS-618: 【ジェットランサー】自軍捨札のウイング持ちユニットカード3枚で BP+3000（出典: atwiki/page-1456）", () => {
    expect(bpOf(board([inst("RS-611", "w1"), inst("RS-622", "w2"), inst("RS-621", "w3")]), "player1", "RS-618:ji")).toBe(9000);
  });

  it("RS-618: 【ジェットランサー】ウイングを持たないカード・敵軍捨札のウイング持ちは数えない（出典: atwiki/page-1456「自軍捨札にあるウイングを持つユニットカード」）", () => {
    expect(bpOf(board([inst("TST-UNIT-0", "x"), inst("TST-OP", "o")], [inst("RS-611", "ew")]), "player1", "RS-618:ji")).toBe(6000);
  });
});

// ===========================================================================
describe("RS-619 ジェットマシン", () => {
  const TEXT = "※ウイング 【航空戦力の奇襲】 これが自軍エリアにある間、ウイングを持つユニットは、特徴「航空機」を持たないユニットにアタックされない。";

  it("RS-619: カタログ本文・スペックが出典と一致（出典: atwiki/page-1457）", () => {
    expectCatalogText("RS-619", TEXT);
    expectStats("RS-619", { name: "ジェットマシン", category: "ET", size: "SC", bp: 2000, sp: undefined, powerCost: "4+", features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_command_or_discard" });
  });

  it("RS-619: レアリティ — ノーマル（出典: atwiki/page-1457）", () => {
    expectRarity("RS-619", "N");
  });

  const rushBoard = (n: number) =>
    st({ phase: "rush", player1: { hand: [inst("RS-619", "jm")], rush: fill(n, "s"), command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(3) } });

  it("RS-619: 追加条件 — 自軍 S ユニット5体をそれぞれコマンドゾーンに送るか捨札にしてラッシュできる（出典: atwiki/page-1457）", () => {
    const r = rushFromHand(rushBoard(5), "player1", "RS-619:jm", { destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-619:jm")).toBe("rush");
    expect(r.state.players.player1.rush).toHaveLength(1);
  });

  it("RS-619: 追加条件 — 自軍 S ユニットが4体ではラッシュできない（出典: atwiki/page-1457「Sユニット5体」）", () => {
    expect(canStartRush(rushBoard(4), "player1", "RS-619:jm")).toBe(false);
  });

  it("RS-619: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドしてアタックできる（出典: atwiki/page-1457・R-KW-WING-01）", () => {
    const s = st({ player1: { rush: [inst("RS-619", "jm")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    expect(canWing(s, "RS-619:jm")).toBe(true);
  });

  /** 敵軍ターン。自軍バトルエリアにウイング持ち（グリフォーザー）とウイングなし。 */
  const enemyTurn = (withMachine: boolean) =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-622", "g"), inst("TST-UNIT-0", "nw")], rush: withMachine ? [inst("RS-619", "jm")] : [], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "atk"), inst("SPEC-AIR", "air")], deck: deckCards(3, "e") },
      },
      [AIR],
    );

  // 既知の不具合: CARD-RS-619 【航空戦力の奇襲】が効いていない（ジェットマシンがあっても「航空機」を持たないユニットが自軍のウイング持ちにアタックできる）
  it.fails("RS-619: 【航空戦力の奇襲】ジェットマシンが自軍エリアにあれば、自軍のウイング持ちは「航空機」を持たないユニットにアタックされない（「航空機」持ちにはアタックされる）（出典: atwiki/page-1457）", () => {
    expect(attackersOf(enemyTurn(true), "RS-622:g")).toEqual(["SPEC-AIR:air"]);
  });

  it("RS-619: 【航空戦力の奇襲】ウイングを持たない自軍ユニットは守られない（出典: atwiki/page-1457「ウイングを持つユニットは」）", () => {
    expect(attackersOf(enemyTurn(true), "TST-UNIT-0:nw")).toContain("TST-UNIT-7:atk");
  });

  it("RS-619: 【航空戦力の奇襲】ジェットマシンが自軍エリアになければ守られない（出典: atwiki/page-1457「これが自軍エリアにある間」）", () => {
    expect(attackersOf(enemyTurn(false), "RS-622:g")).toContain("TST-UNIT-7:atk");
  });

  // 既知の不具合: CARD-RS-619 【航空戦力の奇襲】が、ジェットマシンの持ち主側のウイング持ちしか守らない（rs619WingProtectedFromNonAircraft は防御側にジェットマシンがあるかだけを見る）
  it.fails("RS-619: 【航空戦力の奇襲】対象は「ウイングを持つユニット」全体なので、敵軍のウイング持ちも「航空機」を持たない自軍ユニットにアタックされない（出典: atwiki/page-1457「ウイングを持つユニットは」）", () => {
    const s = st(
      {
        player1: { battle: [inst("TST-UNIT-7", "mine")], rush: [inst("RS-619", "jm")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-WING", "ew")], deck: deckCards(3, "e") },
      },
      [WING_S],
    );
    expect(attackersOf(s, "SPEC-WING:ew", "player1")).toEqual([]);
  });
});
