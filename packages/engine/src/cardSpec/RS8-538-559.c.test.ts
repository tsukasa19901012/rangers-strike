/**
 * カード別スペック: RS-550〜RS-556（第8弾「究極の八神」隠大将軍〜バトルサルダー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-8（RS-550〜RS-556 の Q なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-02・R-ADD-06、R-CN-02、R-KW-TAKUS-01、R-DESTROY-02 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  attackTargets,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  enterSeq,
  expectCatalogText,
  expectStats,
  fill,
  heldUnit,
  inst,
  passEntry,
  pick,
  powerCards,
  reanimateTests,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./RS8-538-559.helpers";
import type { CardInstance, GameState } from "../types/game";

const KAIJIN = sUnit("SPEC-KAIJIN", { name: "テスト怪人", bp: 1000, features: ["怪人"] });
const P1 = sUnit("SPEC-P1", { powerCost: 1 });
const P2 = sUnit("SPEC-P2", { powerCost: 2 });
const P4 = sUnit("SPEC-P4", { powerCost: 4 });
const MA_S = sUnit("SPEC-MA-S", { category: "MA", sp: undefined, bp: 1000 });
const WB_S0 = sUnit("SPEC-WB-S0", { sp: undefined, bp: 1000 });
const EXTRA = [KAIJIN, P1, P2, P4, MA_S, WB_S0];

/** n 番目（1始まり）に id を出す自軍バトルフェイズの盤面。 */
function ncBoard(
  id: string,
  nth: number,
  p2: Partial<GameState["players"]["player2"]> = {},
  p1: Partial<GameState["players"]["player1"]> = {},
): GameState {
  return st(
    {
      player1: { battle: fill(nth - 1), rush: [inst(id, "g")], deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    EXTRA,
  );
}

/** n 番目に出す（進入後の行動ウィンドウは残す）。 */
function ncEnter(id: string, nth: number, p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}): GameState {
  return enter(passEntry(ncBoard(id, nth, p2, p1)), `${id}:g`);
}

const GODS = (): CardInstance[] => ["RS-551", "RS-552", "RS-553", "RS-554", "RS-555"].map((id) => inst(id, "m"));

// ===========================================================================
describe("RS-550 隠大将軍", () => {
  const TEXT =
    "合体―ゴッドガンマー＋ゴッドロウガン＋ゴッドサルダー＋ゴッドカーク＋ゴッドクマード 【鉄拳ゴッドフィニッシュ】自軍ターン中、これがバトルエリアに出たとき、必要パワーに「＋」を持たない敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";
  const board = (activePlayer: "player1" | "player2" = "player1") =>
    st(
      {
        activePlayer,
        player1: { rush: [inst("RS-550", "u")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-7", "plus"), inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-2", "r")], deck: deckCards(3, "e") },
      },
      EXTRA,
    );

  it("RS-550: カタログ本文・スペックが出典と一致（出典: atwiki/page-1217）", () => {
    expectCatalogText("RS-550", TEXT);
    expectStats("RS-550", {
      name: "隠大将軍",
      category: "MA",
      size: "L",
      bp: 17000,
      sp: 2,
      powerCost: "7+",
      features: ["人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-550: 追加条件 — ゴッドガンマー〜ゴッドクマードの5体を捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-1217・R-ADD-06）", () => {
    const mk = (rush: CardInstance[], power = 7) =>
      st({ phase: "rush", player1: { hand: [inst("RS-550", "u")], rush, command: releasedCat("MA", 2), power: powerCards(power), deck: deckCards(3) } });
    expect(canStartRush(mk(GODS().slice(0, 4)), "player1", "RS-550:u")).toBe(false);
    expect(canStartRush(mk(GODS(), 6), "player1", "RS-550:u")).toBe(false);
    const r = rushFromHand(mk(GODS()), "player1", "RS-550:u");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-550:u")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  // 既知の不具合: CARD-RS-550 【鉄拳ゴッドフィニッシュ】の候補が敵軍バトルエリアだけで、必要パワー「＋」のユニット（7+）も含まれる
  it.fails("RS-550: 【鉄拳ゴッドフィニッシュ】候補は必要パワーに「＋」を持たない敵軍ユニット（バトル・ラッシュエリア）（出典: atwiki/page-1217）", () => {
    const s = enter(board(), "RS-550:u");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-550");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-2:r"]);
  });

  it("RS-550: 【鉄拳ゴッドフィニッシュ】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（出典: atwiki/page-1217「持ち主のパワーゾーンにダメージにして置いてもよい」）", () => {
    const s = resolveAll(pick(enter(board(), "RS-550:u"), "TST-UNIT-0:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:a")?.faceDown).toBe(true);
  });

  it("RS-550: 【鉄拳ゴッドフィニッシュ】任意 — 見送れる（出典: atwiki/page-1217「置いてもよい」）", () => {
    const s0 = enter(board(), "RS-550:u");
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-550: 【鉄拳ゴッドフィニッシュ】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-1217「自軍ターン中」）", () => {
    const s = enterBattleByEffect(board("player2"), "player1", "RS-550:u");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-550");
  });
});

// ===========================================================================
describe("RS-551 ゴッドガンマー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャブラック」のカードを1枚選び、自軍ラッシュエリアに出す。 ※タクスMA（これがバトルエリアの2番目にある間、これの次に並ぶMAを持つSユニットは「SP1」を得る） 【ガンマーダイナマイト】相手は、特徴「怪人」を持つ自分自身のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-551: カタログ本文・スペックが出典と一致（出典: atwiki/page-1173）", () => {
    expectCatalogText("RS-551", TEXT);
    expectStats("RS-551", {
      name: "ゴッドガンマー",
      category: "MA",
      size: "M",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 1,
      features: ["忍者", "獣"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-551", "RS-455", "ニンジャブラック", "atwiki/page-1173", "MA");
  reanimateTests("RS-551", "RS-455", "ニンジャブラック", "atwiki/page-1173");

  it("RS-551: ※タクスMA — 2番目にある間、次に並ぶ MA の S ユニットは SP1 を得る（出典: atwiki/page-1173・R-KW-TAKUS-01）", () => {
    const s = enterSeq(
      st({ player1: { battle: [...fill(1), inst("RS-551", "g")], rush: [inst("SPEC-MA-S", "n")], deck: deckCards(3) } }, EXTRA),
      ["SPEC-MA-S:n"],
    );
    expect(spOf(s, "player1", "SPEC-MA-S:n")).toBe(1);
  });

  it("RS-551: ※タクスMA — 次に並ぶのが MA を持たない S ユニットなら SP を得ない（出典: atwiki/page-1173「MAを持つSユニット」）", () => {
    const s = enterSeq(
      st({ player1: { battle: [...fill(1), inst("RS-551", "g")], rush: [inst("SPEC-WB-S0", "n")], deck: deckCards(3) } }, EXTRA),
      ["SPEC-WB-S0:n"],
    );
    expect(spOf(s, "player1", "SPEC-WB-S0:n")).toBe(0);
  });

  it("RS-551: ※タクスMA — ゴッドガンマーが2番目でなければ（1番目）SP を得ない（出典: atwiki/page-1173「バトルエリアの2番目にある間」）", () => {
    const s = enterSeq(
      st({ player1: { battle: [inst("RS-551", "g")], rush: [inst("SPEC-MA-S", "n")], deck: deckCards(3) } }, EXTRA),
      ["SPEC-MA-S:n"],
    );
    expect(spOf(s, "player1", "SPEC-MA-S:n")).toBe(0);
  });

  // 既知の不具合: CARD-RS-551 【ガンマーダイナマイト】を選ぶのが自分（相手であるべき）で、候補が敵軍バトルエリアだけ（ラッシュエリアの怪人が落ちる）
  it.fails("RS-551: 【ガンマーダイナマイト】NC（1番目）で、相手が自分自身の「怪人」ユニット（バトル・ラッシュエリア）から1体選ぶ（強制）（出典: atwiki/page-1173「相手は、特徴「怪人」を持つ自分自身のユニットを1体選び」）", () => {
    const s = ncEnter("RS-551", 1, { battle: [inst("SPEC-KAIJIN", "kb"), inst("TST-UNIT-0", "n")], rush: [inst("SPEC-KAIJIN", "kr")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-551");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-KAIJIN:kb", "SPEC-KAIJIN:kr"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-551: 【ガンマーダイナマイト】選ばれた怪人ユニットは持ち主のパワーゾーンにダメージ（ウラ向き）で置かれる（出典: atwiki/page-1173）", () => {
    let s = ncEnter("RS-551", 1, { battle: [inst("SPEC-KAIJIN", "kb")] });
    s = resolveAll(s, ["SPEC-KAIJIN:kb"]);
    expect(s.players.player2.power.find((c) => c.instanceId === "SPEC-KAIJIN:kb")?.faceDown).toBe(true);
  });

  it("RS-551: 【ガンマーダイナマイト】相手に怪人ユニットがいなければ何も起きない（出典: atwiki/page-1173）", () => {
    const s = resolveAll(ncEnter("RS-551", 1, { battle: [inst("TST-UNIT-0", "n")] }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:n")).toBe("battle");
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("RS-551: 【ガンマーダイナマイト】NC が成立しなければ（2番目）発動しない（出典: R-CN-02）", () => {
    const s = resolveAll(ncEnter("RS-551", 2, { battle: [inst("SPEC-KAIJIN", "kb")] }));
    expect(zoneOf(s, "player2", "SPEC-KAIJIN:kb")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-552 ゴッドロウガン", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャブルー」のカードを1枚選び、自軍ラッシュエリアに出す。 【ロウガンアタック】敵軍ラッシュエリアのユニットの数が、敵軍バトルエリアのユニットの数より多ければ、これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-552: カタログ本文・スペックが出典と一致（出典: atwiki/page-1174）", () => {
    expectCatalogText("RS-552", TEXT);
    expectStats("RS-552", {
      name: "ゴッドロウガン",
      category: "MA",
      size: "M",
      bp: 4500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 2,
      features: ["忍者", "獣"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-552", "RS-456", "ニンジャブルー", "atwiki/page-1174", "MA");
  reanimateTests("RS-552", "RS-456", "ニンジャブルー", "atwiki/page-1174");

  it("RS-552: 【ロウガンアタック】NC（2番目）で、敵軍ラッシュエリアのユニット数（2）がバトルエリア（1）より多ければラッシュエリアのユニットにアタックできる（出典: atwiki/page-1174）", () => {
    const s = ncEnter("RS-552", 2, { battle: [inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")] });
    expect(attackTargets(s, "RS-552:g")).toEqual(expect.arrayContaining(["TST-UNIT-0:b", "TST-UNIT-0:r1", "TST-UNIT-0:r2"]));
  });

  it("RS-552: 【ロウガンアタック】ラッシュエリアの数がバトルエリアと同数（1対1）なら、ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-1174「より多ければ」）", () => {
    const s = ncEnter("RS-552", 2, { battle: [inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-0", "r1")] });
    expect(attackTargets(s, "RS-552:g")).toContain("TST-UNIT-0:b");
    expect(attackTargets(s, "RS-552:g")).not.toContain("TST-UNIT-0:r1");
  });

  it("RS-552: 【ロウガンアタック】NC が成立しなければ（1番目）ラッシュエリアのユニットにはアタックできない（出典: R-CN-02）", () => {
    const s = ncEnter("RS-552", 1, { battle: [inst("TST-UNIT-0", "b")], rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2")] });
    expect(attackTargets(s, "RS-552:g")).not.toContain("TST-UNIT-0:r1");
  });
});

// ===========================================================================
describe("RS-553 ゴッドサルダー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 ※自軍バトルエリアにこれ以外の「ゴッドサルダー」があれば、これはアタックされない。 【サルダーダブルソード】「SP1」";

  it("RS-553: カタログ本文・スペックが出典と一致（出典: atwiki/page-1175）", () => {
    expectCatalogText("RS-553", TEXT);
    expectStats("RS-553", {
      name: "ゴッドサルダー",
      category: "MA",
      size: "M",
      bp: 4500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 3,
      features: ["忍者", "獣", "人型"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-553", "RS-457", "ニンジャレッド", "atwiki/page-1175", "MA");
  reanimateTests("RS-553", "RS-457", "ニンジャレッド", "atwiki/page-1175");

  // 既知の不具合: CARD-RS-553 ※「これ以外の「ゴッドサルダー」があれば、これはアタックされない」が未実装
  it.fails("RS-553: ※ 自軍バトルエリアに別の「ゴッドサルダー」があれば、どちらもアタックされない（出典: atwiki/page-1175）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst("RS-553", "a"), inst("RS-553", "b")] } });
    const t = attackTargets(s, "TST-UNIT-7:atk");
    expect(t).not.toContain("RS-553:a");
    expect(t).not.toContain("RS-553:b");
  });

  it("RS-553: ※ 別の「ゴッドサルダー」がラッシュエリアにあるだけならアタックされる（出典: atwiki/page-1175「自軍バトルエリアに」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst("RS-553", "a")], rush: [inst("RS-553", "b")] } });
    expect(attackTargets(s, "TST-UNIT-7:atk")).toContain("RS-553:a");
  });

  it("RS-553: ※ 別名のバトルサルダーが並んでいてもアタックされる（出典: atwiki/page-1175「これ以外の「ゴッドサルダー」」）", () => {
    const s = st({ player1: { battle: [inst("TST-UNIT-7", "atk")] }, player2: { battle: [inst("RS-553", "a"), inst("RS-556", "b")] } });
    expect(attackTargets(s, "TST-UNIT-7:atk")).toContain("RS-553:a");
  });

  it("RS-553: 【サルダーダブルソード】3番目で NC が成立すると SP1（出典: atwiki/page-1175「【サルダーダブルソード】「SP1」」）", () => {
    const s = enterSeq(ncBoard("RS-553", 3), ["RS-553:g"]);
    expect(spOf(s, "player1", "RS-553:g")).toBe(1);
  });

  it("RS-553: 【サルダーダブルソード】NC が成立しなければ（2番目）SP は「！」のまま（出典: R-CN-02）", () => {
    const s = enterSeq(ncBoard("RS-553", 2), ["RS-553:g"]);
    expect(spOf(s, "player1", "RS-553:g")).toBe(0);
  });
});

// ===========================================================================
describe("RS-554 ゴッドカーク", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャホワイト」のカードを1枚選び、自軍ラッシュエリアに出す。 【フライングビーム】敵軍パワーゾーンのカード枚数を見て、その枚数よりも必要パワーの数字が大きい敵軍ユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";
  const p2 = () => ({
    battle: [inst("SPEC-P2", "two"), inst("SPEC-P4", "four"), inst("TST-UNIT-7", "seven")],
    rush: [inst("SPEC-P4", "r4"), inst("SPEC-P1", "r1")],
    power: [...powerCards(2, "ep"), ...damageCards(1, "ed")],
  });

  it("RS-554: カタログ本文・スペックが出典と一致（出典: atwiki/page-1176）", () => {
    expectCatalogText("RS-554", TEXT);
    expectStats("RS-554", {
      name: "ゴッドカーク",
      category: "MA",
      size: "M",
      bp: 3500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 4,
      features: ["忍者", "獣"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-554", "RS-458", "ニンジャホワイト", "atwiki/page-1176", "MA");
  reanimateTests("RS-554", "RS-458", "ニンジャホワイト", "atwiki/page-1176");

  // 既知の不具合: CARD-RS-554 【フライングビーム】の候補に「パワーゾーンの枚数より必要パワーが大きい」条件がなく、敵軍ラッシュエリアのユニットが含まれない
  it.fails("RS-554: 【フライングビーム】NC（4番目）— 敵軍パワーゾーン3枚（ダメージ含む）なら、必要パワーが4以上の敵軍ユニット（バトル・ラッシュ、7+ は7）が候補（出典: atwiki/page-1176「その枚数よりも必要パワーの数字が大きい」）", () => {
    const s = ncEnter("RS-554", 4, p2());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-554");
    expect(choiceIds(s)).toEqual(["SPEC-P4:four", "SPEC-P4:r4", "TST-UNIT-7:seven"]);
  });

  it("RS-554: 【フライングビーム】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）で置く（出典: atwiki/page-1176）", () => {
    const s = resolveAll(pick(ncEnter("RS-554", 4, p2()), "TST-UNIT-7:seven"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-7:seven")?.faceDown).toBe(true);
  });

  it("RS-554: 【フライングビーム】任意 — 見送れる（出典: atwiki/page-1176「置いてもよい」）", () => {
    const s0 = ncEnter("RS-554", 4, p2());
    expect(canSkip(s0)).toBe(true);
    const s = resolveAll(skip(s0));
    expect(zoneOf(s, "player2", "TST-UNIT-7:seven")).toBe("battle");
  });

  it("RS-554: 【フライングビーム】NC が成立しなければ（3番目）発動しない（出典: R-CN-02）", () => {
    const s = ncEnter("RS-554", 3, p2());
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-554");
  });
});

// ===========================================================================
describe("RS-555 ゴッドクマード", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャイエロー」のカードを1枚選び、自軍ラッシュエリアに出す。 【地割れ】敵軍バトルエリアからホールド状態のSユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";
  const p2 = () => ({
    battle: [heldUnit("TST-UNIT-0", "hs"), inst("TST-UNIT-0", "rs"), heldUnit("TST-UNIT-2", "hm")],
    rush: [heldUnit("TST-UNIT-0", "hr")],
  });

  it("RS-555: カタログ本文・スペックが出典と一致（出典: atwiki/page-1177）", () => {
    expectCatalogText("RS-555", TEXT);
    expectStats("RS-555", {
      name: "ゴッドクマード",
      category: "MA",
      size: "M",
      bp: 3500,
      sp: undefined,
      powerCost: "7-",
      comboNumber: 5,
      features: ["忍者", "獣"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-555", "RS-459", "ニンジャイエロー", "atwiki/page-1177", "MA");
  reanimateTests("RS-555", "RS-459", "ニンジャイエロー", "atwiki/page-1177");

  it("RS-555: 【地割れ】NC（5番目）— 候補は敵軍バトルエリアのホールド状態の S ユニットだけ（出典: atwiki/page-1177「敵軍バトルエリアからホールド状態のSユニット」）", () => {
    const s = ncEnter("RS-555", 5, p2());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-555");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:hs"]);
  });

  it("RS-555: 【地割れ】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）で置く（出典: atwiki/page-1177）", () => {
    const s = resolveAll(pick(ncEnter("RS-555", 5, p2()), "TST-UNIT-0:hs"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-0:hs")?.faceDown).toBe(true);
  });

  it("RS-555: 【地割れ】任意 — 見送れる（出典: atwiki/page-1177「置いてもよい」）", () => {
    const s0 = ncEnter("RS-555", 5, p2());
    expect(canSkip(s0)).toBe(true);
    expect(zoneOf(resolveAll(skip(s0)), "player2", "TST-UNIT-0:hs")).toBe("battle");
  });

  it("RS-555: 【地割れ】NC が成立しなければ（4番目）発動しない（出典: R-CN-02）", () => {
    const s = ncEnter("RS-555", 4, p2());
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-555");
  });
});

// ===========================================================================
describe("RS-556 バトルサルダー", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「ニンジャレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 【サルダークロー】「SP1」敵軍ユニットの数と同じ枚数、敵軍山札の上からオモテにしてもよい。そうしたとき、オモテにしたカードと同じカード名の敵軍ユニットを全て撃破する。そして相手はオモテにしたカードを山札の下に好きな順で戻す。";
  // 敵軍ユニット3体（バトル2・ラッシュ1）→ 山札の上から3枚（TST-UNIT-0・TST-OP・TST-OP）をオモテにする。4枚目の TST-UNIT-2 はオモテにならない。
  const p2 = () => ({
    battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")],
    rush: [inst("TST-UNIT-2", "c")],
    deck: [inst("TST-UNIT-0", "d0"), inst("TST-OP", "d1"), inst("TST-OP", "d2"), inst("TST-UNIT-2", "d3"), inst("TST-OP", "d4")],
  });

  it("RS-556: カタログ本文・スペックが出典と一致（出典: atwiki/page-1178）", () => {
    expectCatalogText("RS-556", TEXT);
    expectStats("RS-556", {
      name: "バトルサルダー",
      category: "MA",
      size: "M",
      bp: 4500,
      sp: "special",
      powerCost: "7-",
      comboNumber: 3,
      features: ["忍者", "獣", "人型"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-556", "RS-457", "ニンジャレッド", "atwiki/page-1178", "MA");
  reanimateTests("RS-556", "RS-457", "ニンジャレッド", "atwiki/page-1178");

  it("RS-556: 【サルダークロー】3番目で NC が成立すると SP1（出典: atwiki/page-1178「【サルダークロー】「SP1」」）", () => {
    const s = resolveAll(enterSeq(ncBoard("RS-556", 3, p2()), ["RS-556:g"]));
    expect(spOf(s, "player1", "RS-556:g")).toBe(1);
  });

  // 既知の不具合: CARD-RS-556 【サルダークロー】の山札公開・同名撃破が未実装（SP1 のみ）
  it.fails("RS-556: 【サルダークロー】敵軍ユニット数（3）と同じ枚数の山札をオモテにし、同名の敵軍ユニットを全て撃破する（出典: atwiki/page-1178「オモテにしたカードと同じカード名の敵軍ユニットを全て撃破する」）", () => {
    const s = resolveAll(ncEnter("RS-556", 3, p2()));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:b")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:c")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-556 【サルダークロー】が未実装
  it.fails("RS-556: 【サルダークロー】オモテにした3枚は山札の下に戻り、4枚目以降が上になる（出典: atwiki/page-1178「相手はオモテにしたカードを山札の下に好きな順で戻す」）", () => {
    const s = resolveAll(ncEnter("RS-556", 3, p2()));
    const deck = s.players.player2.deck.map((c) => c.instanceId);
    expect(deck.slice(0, 2)).toEqual(["TST-UNIT-2:d3", "TST-OP:d4"]);
    expect(deck.slice(2).sort()).toEqual(["TST-OP:d1", "TST-OP:d2", "TST-UNIT-0:d0"]);
  });

  // 既知の不具合: CARD-RS-556 【サルダークロー】の「オモテにしてもよい」の選択が提示されない
  it.fails("RS-556: 【サルダークロー】任意 — オモテにしないことを選べる（出典: atwiki/page-1178「オモテにしてもよい」）", () => {
    const s = ncEnter("RS-556", 3, p2());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-556");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-556: 【サルダークロー】NC が成立しなければ（2番目）敵軍ユニットは撃破されない（出典: R-CN-02）", () => {
    const s = resolveAll(ncEnter("RS-556", 2, p2()));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("battle");
    expect(spOf(s, "player1", "RS-556:g")).toBe(0);
  });
});
