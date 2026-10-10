/**
 * カード別スペック: RS-474〜RS-480（第7弾「七忍の炎陣」タイムシャドウSM〜ガオシルバー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_7.html。RS-474〜RS-480 の Q はない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06 合体、R-CN-01〜05、R-TGT-04 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attackTargets,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS7-474-494.helpers";
import type { GameState } from "../types/game";

/** 敵軍（player2）のアタック先候補。 */
const enemyTargets = (s: GameState, attacker: string) => attackTargets(s, attacker, "player2");

// ===========================================================================
describe("RS-474 タイムシャドウSM", () => {
  const TEXT =
    "※これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、自軍捨札の枚数がこれの必要パワーの数字以上あれば、これを自軍ラッシュエリアに出してもよい。※自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンからオモテ向きのカードを1枚選び捨札にする。【ステルスモード】これは敵軍ユニットにアタックされない。";

  it("RS-474: カタログ本文・スペックが出典と一致（出典: atwiki/page-792）", () => {
    expectCatalogText("RS-474", TEXT);
    expectStats("RS-474", {
      name: "タイムシャドウSM",
      category: "OT",
      size: "L",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      features: ["メカ", "航空機"],
      rushCondition: undefined,
    });
  });

  const selfRush = (s: GameState) =>
    legal(s).find((a) => a.type === "self_rush_from_zone" && (a as { instanceId: string }).instanceId === "RS-474:ts");

  const rushPhase = (discard: number, opts: { faceDown?: boolean; phase?: GameState["phase"] } = {}) =>
    st({
      phase: opts.phase ?? "rush",
      player1: {
        power: [{ ...inst("RS-474", "ts"), faceDown: opts.faceDown ?? false }, ...powerCards(2)],
        discard: Array.from({ length: discard }, (_, i) => inst("TST-OP", `d${i}`)),
        deck: deckCards(3),
      },
    });

  it("RS-474: ※1 自軍ラッシュフェイズ中、自軍捨札が必要パワー（4）枚以上あれば、パワーゾーンのオモテ向きのこれを自軍ラッシュエリアに出せる（出典: atwiki/page-792「自軍捨札の枚数がこれの必要パワーの数字以上あれば…出してもよい」）", () => {
    const s = rushPhase(4);
    const a = selfRush(s);
    expect(a).toBeDefined();
    const t = act(s, a!);
    expect(zoneOf(t, "player1", "RS-474:ts")).toBe("rush");
    expect(t.players.player1.power).toHaveLength(2);
  });

  it("RS-474: ※1 自軍捨札が3枚（必要パワー未満）なら出せない（出典: atwiki/page-792「必要パワーの数字以上あれば」）", () => {
    expect(selfRush(rushPhase(3))).toBeUndefined();
  });

  it("RS-474: ※1 ダメージ（ウラ向き）になっているときは出せない（出典: atwiki/page-792「自軍パワーゾーンでオモテ向きになっている間」）", () => {
    expect(selfRush(rushPhase(6, { faceDown: true }))).toBeUndefined();
  });

  it("RS-474: ※1 自軍バトルフェイズ中は出せない（出典: atwiki/page-792「自軍ラッシュフェイズ中」）", () => {
    expect(selfRush(rushPhase(6, { phase: "battle" }))).toBeUndefined();
  });

  it("RS-474: ※1 敵軍ラッシュフェイズ中は出せない（出典: atwiki/page-792「自軍ラッシュフェイズ中」）", () => {
    const s = st({
      phase: "rush",
      activePlayer: "player2",
      player1: { power: [inst("RS-474", "ts")], discard: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `d${i}`)), deck: deckCards(3) },
    });
    expect(legal(s).some((a) => a.type === "self_rush_from_zone" && a.playerId === "player1")).toBe(false);
  });

  it("RS-474: ※1 「出してもよい」— 出さずにラッシュフェイズを終えられる（任意）（出典: atwiki/page-792「出してもよい」）", () => {
    const s = rushPhase(4);
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(true);
    const t = act(s, legal(s).find((a) => a.type === "end_phase")!);
    expect(zoneOf(t, "player1", "RS-474:ts")).toBe("power");
  });

  const enterOwnTurn = (power = [inst("TST-P", "up1"), inst("TST-P", "up2"), ...damageCards(2)]) =>
    enter(st({ player1: { rush: [inst("RS-474", "ts")], power, deck: deckCards(3) } }), "RS-474:ts");

  // 既知の不具合: CARD-RS-474 ※2 が自軍ターン中にバトルエリアに出ても選択を出さず、オモテ向きのパワーカードが捨札にならない
  it.fails("RS-474: ※2 自軍ターン中にバトルエリアに出たとき、自軍パワーゾーンのオモテ向きのカード（ダメージ以外）から1枚選び捨札にする（出典: atwiki/page-792「自軍パワーゾーンからオモテ向きのカードを1枚選び捨札にする」）", () => {
    let s = enterOwnTurn();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-474");
    expect(choiceIds(s)).toEqual(["TST-P:up1", "TST-P:up2"]);
    s = resolveAll(pick(s, "TST-P:up2"));
    expect(zoneOf(s, "player1", "TST-P:up2")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-P:up1")).toBe("power");
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(2);
  });

  // 既知の不具合: CARD-RS-474 ※2 の選択が出ない（強制の選択として確認できない）
  it.fails("RS-474: ※2 強制 — 見送ることはできない（出典: atwiki/page-792「選び捨札にする」）", () => {
    const s = enterOwnTurn();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-474");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-474: ※2 オモテ向きのカードがなければ何も捨札にならない（出典: atwiki/page-792）", () => {
    const s = resolveAll(enterOwnTurn(damageCards(2)));
    expect(zoneOf(s, "player1", "RS-474:ts")).toBe("battle");
    expect(s.players.player1.power).toHaveLength(2);
    expect(s.players.player1.discard).toHaveLength(0);
  });

  it("RS-474: ※2 敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-792「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-474", "ts")], power: [inst("TST-P", "up1")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    const s = resolveAll(enterBattleByEffect(s0, "player1", "RS-474:ts"));
    expect(zoneOf(s, "player1", "RS-474:ts")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-P:up1")).toBe("power");
  });

  it("RS-474: 【ステルスモード】敵軍ユニットにアタックされない（並んでいる他の自軍ユニットはアタックされる）（出典: atwiki/page-792「これは敵軍ユニットにアタックされない」）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-474", "ts"), inst("TST-UNIT-0", "f")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    expect(enemyTargets(s, "TST-UNIT-7:atk")).toEqual(["TST-UNIT-0:f"]);
  });
});

// ===========================================================================
/** ガオハンター（合体－ガオウルフ＋ガオリゲーター＋ガオハンマーヘッド）を手札からラッシュする。 */
function rushGaoHunter(
  id: "RS-475" | "RS-476",
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  cmd: "WB" | "DA" = id === "RS-475" ? "WB" : "DA",
) {
  const s = st({
    phase: "rush",
    player1: {
      hand: [inst(id, "gh")],
      rush: [inst("RS-477", "w"), inst("RS-478", "a"), inst("RS-479", "h")],
      command: releasedCat(cmd, 2),
      power: powerCards(id === "RS-475" ? 6 : 5),
      deck: deckCards(5),
      ...p1,
    },
    player2: { deck: deckCards(5, "e"), ...p2 },
  });
  return rushFromHand(s, "player1", `${id}:gh`);
}

function fusionTests(id: "RS-475" | "RS-476", page: string, cost: number) {
  it(`${id}: 追加条件（合体）— ガオウルフ・ガオリゲーター・ガオハンマーヘッドを捨札にしてラッシュできる（出典: atwiki/${page}「合体－ガオウルフ＋ガオリゲーター＋ガオハンマーヘッド」・R-ADD-06）`, () => {
    const r = rushGaoHunter(id);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:gh`)).toBe("rush");
    for (const m of ["RS-477:w", "RS-478:a", "RS-479:h"]) expect(zoneOf(t, "player1", m)).toBe("discard");
  });

  it(`${id}: 追加条件（合体）— 素材が1種でも欠けていればラッシュできない（出典: atwiki/${page}・R-ADD-06）`, () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst(id, "gh")],
        rush: [inst("RS-477", "w"), inst("RS-478", "a")],
        command: releasedCat(id === "RS-475" ? "WB" : "DA", 2),
        power: powerCards(cost + 3),
        deck: deckCards(5),
      },
    });
    expect(canStartRush(s, "player1", `${id}:gh`)).toBe(false);
  });

  it(`${id}: 必要パワー${cost}+ — パワー${cost - 1}ではラッシュできない（出典: atwiki/${page}「必要パワー：${cost}+」）`, () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst(id, "gh")],
        rush: [inst("RS-477", "w"), inst("RS-478", "a"), inst("RS-479", "h")],
        command: releasedCat(id === "RS-475" ? "WB" : "DA", 2),
        power: powerCards(cost - 1),
        deck: deckCards(5),
      },
    });
    expect(canStartRush(s, "player1", `${id}:gh`)).toBe(false);
  });
}

// ===========================================================================
describe("RS-475 ガオハンタージャスティス", () => {
  const TEXT =
    "合体－ガオウルフ＋ガオリゲーター＋ガオハンマーヘッド【悪鬼突貫リボルバーファントム】これがバトルエリアに出たとき、自軍捨札をすべてウラ向きにしてシャッフルしてもよい。そうしたとき、その中から相手に1枚選ばせてから、すべてオモテにする。そして、相手の選んだカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";

  it("RS-475: カタログ本文・スペックが出典と一致（出典: atwiki/page-769）", () => {
    expectCatalogText("RS-475", TEXT);
    expectStats("RS-475", {
      name: "ガオハンタージャスティス",
      category: "WB",
      size: "L",
      bp: 11000,
      sp: 1,
      powerCost: "6+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  fusionTests("RS-475", "page-769", 6);

  /** 自軍捨札がすべて必要パワー3のカード（TST-OP）の状態で、ジャスティスがバトルエリアに出る。敵軍: 必要パワー0 / 2 / 7+。 */
  const enterJustice = (opts: { activePlayer?: "player1" | "player2"; discard?: number } = {}) => {
    const s0 = st({
      activePlayer: opts.activePlayer ?? "player1",
      player1: {
        rush: [inst("RS-475", "gh")],
        discard: Array.from({ length: opts.discard ?? 3 }, (_, i) => inst("TST-OP", `d${i}`)),
        deck: deckCards(5),
      },
      player2: {
        battle: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-2", "e2")],
        rush: [inst("TST-UNIT-7", "e7")],
        deck: deckCards(5, "e"),
      },
    });
    return opts.activePlayer === "player2" ? enterBattleByEffect(s0, "player1", "RS-475:gh") : enter(s0, "RS-475:gh");
  };

  /** 保留中の選択を、相手（player2）の選択は先頭で、自分（player1）の選択は prefer で解決する。 */
  const runJustice = (s: GameState, prefer: string[]) => resolveAll(s, prefer);

  // 既知の不具合: CARD-RS-475 【悪鬼突貫リボルバーファントム】が自軍捨札ではなく自軍山札の上を見る選択（scry_keep_one）になり、敵軍ユニットを撃破しない
  it.fails("RS-475: 【悪鬼突貫リボルバーファントム】相手が選んだ捨札のカードの必要パワー（3）以下の必要パワーを持つ敵軍ユニット（ラッシュエリアを含む）から1体選び撃破する（出典: atwiki/page-769「相手の選んだカードの必要パワーの数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する」）", () => {
    const s = runJustice(enterJustice(), ["TST-UNIT-2:e2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-7:e7")).toBe("rush");
    expect(s.players.player1.discard).toHaveLength(3);
    expect(s.players.player1.discard.every((c) => !c.faceDown)).toBe(true);
  });

  // 既知の不具合: CARD-RS-475 【悪鬼突貫リボルバーファントム】が自軍山札の上を見る選択になり、相手の選択・撃破候補の選択が出ない
  it.fails("RS-475: 【悪鬼突貫リボルバーファントム】必要パワーが選ばれたカードより大きい敵軍ユニット（7+）は選べない（出典: atwiki/page-769「…以下の必要パワーの数字を持つ敵軍ユニット」）", () => {
    let s = enterJustice();
    for (let i = 0; i < 6 && s.pendingEffectChoice && s.pendingEffectChoice.playerId === "player2"; i++) {
      s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0", "TST-UNIT-2:e2"]);
  });

  it("RS-475: 【悪鬼突貫リボルバーファントム】「シャッフルしてもよい」— 発動しないことを選べ、そのときは何も撃破されない（出典: atwiki/page-769「シャッフルしてもよい」）", () => {
    let s = enterJustice();
    if (s.pendingEffectChoice?.sourceCardId === "RS-475") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(s.players.player2.battle).toHaveLength(2);
    expect(s.players.player2.rush).toHaveLength(1);
  });

  it("RS-475: 【悪鬼突貫リボルバーファントム】自軍捨札が0枚なら相手は選べず、何も撃破されない（出典: atwiki/page-769「その中から相手に1枚選ばせてから」）", () => {
    const s = resolveAll(enterJustice({ discard: 0 }), ["TST-UNIT-0:e0"]);
    expect(s.players.player2.battle).toHaveLength(2);
  });

  // 既知の不具合: CARD-RS-475 【悪鬼突貫リボルバーファントム】が自軍山札の上を見る選択になり、敵軍ターン中に出ても撃破できない
  it.fails("RS-475: 【悪鬼突貫リボルバーファントム】「自軍ターン中」の限定はなく、敵軍ターン中にバトルエリアに出たときも発動できる（出典: atwiki/page-769「これがバトルエリアに出たとき」）", () => {
    const s = runJustice(enterJustice({ activePlayer: "player2" }), ["TST-UNIT-2:e2"]);
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-476 ガオハンターイビル", () => {
  const TEXT =
    "合体－ガオウルフ+ガオリゲーター+ガオハンマーヘッド※これはバトルエリアにあるとき、カテゴリにWBが追加される。【天地震撼ビーストハリケーン】自軍ターン中、これがバトルエリアに出たとき、自分の手札から特徴「獣」を持つユニットカードを1枚選び捨札にしてもよい。そうしたとき、捨札にしたユニットカードのBPと同じBPのユニットをすべて撃破する。";

  it("RS-476: カタログ本文・スペックが出典と一致（出典: atwiki/page-828）", () => {
    expectCatalogText("RS-476", TEXT);
    expectStats("RS-476", {
      name: "ガオハンターイビル",
      category: "DA",
      size: "L",
      bp: 11000,
      sp: 1,
      powerCost: "5+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  fusionTests("RS-476", "page-828", 5);

  it("RS-476: ※ バトルエリアにあるとき、カテゴリに WB が追加される（ゴウライスタッグ【牙がくれ】の「リリース状態のコマンドと同じカテゴリを持つ敵軍ユニット」に WB で該当し、アタックできない）（出典: atwiki/page-828「これはバトルエリアにあるとき、カテゴリにWBが追加される」）", () => {
    const mk = (cmd: string) =>
      st({
        player1: { battle: [inst("RS-476", "ev")], deck: deckCards(3) },
        player2: { battle: [inst("RS-311", "stag")], command: [released(cmd, "c")], deck: deckCards(3, "e") },
      });
    // リリース状態の WB コマンド → WB が追加されたイビルはアタックできない。
    expect(attackTargets(mk("TST-OP"), "RS-476:ev")).toEqual([]);
    // 対照: リリース状態のコマンドが ET なら（DA・WB のどちらとも違う）アタックできる。
    expect(attackTargets(mk("TST-OP-ET"), "RS-476:ev")).toEqual(["RS-311:stag"]);
  });

  /** 自軍バトルフェイズ: イビルを出す。手札に獣ユニット（ガオウルフ BP5000・ガオリゲーター BP4000）と非獣ユニット（TST-UNIT-0 BP1000）。 */
  const enterEvil = (opts: { activePlayer?: "player1" | "player2" } = {}) => {
    const s0 = st({
      activePlayer: opts.activePlayer ?? "player1",
      player1: {
        rush: [inst("RS-476", "ev")],
        battle: [inst("RS-479", "own4000")],
        hand: [inst("RS-477", "hw"), inst("RS-478", "ha"), inst("TST-UNIT-0", "h1")],
        deck: deckCards(5),
      },
      player2: {
        battle: [inst("RS-478", "e4000"), inst("TST-UNIT-2", "e3000")],
        rush: [inst("RS-479", "r4000")],
        deck: deckCards(5, "e"),
      },
    });
    return opts.activePlayer === "player2" ? enterBattleByEffect(s0, "player1", "RS-476:ev") : enter(s0, "RS-476:ev");
  };

  // 既知の不具合: CARD-RS-476 【天地震撼ビーストハリケーン】が汎用の「敵軍ユニット撃破」として扱われ（no_targets）、手札の獣ユニットを選ぶ選択が出ない
  it.fails("RS-476: 【天地震撼ビーストハリケーン】手札から特徴「獣」を持つユニットカードだけを選べる（出典: atwiki/page-828「自分の手札から特徴「獣」を持つユニットカードを1枚選び捨札にしてもよい」）", () => {
    const s = enterEvil();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-476");
    expect(choiceIds(s)).toEqual(["RS-477:hw", "RS-478:ha"]);
  });

  // 既知の不具合: CARD-RS-476 【天地震撼ビーストハリケーン】が実装されておらず、同じ BP のユニットが撃破されない
  it.fails("RS-476: 【天地震撼ビーストハリケーン】捨札にしたカードの BP（4000）と同じ BP のユニットを敵味方・エリアを問わずすべて撃破する（出典: atwiki/page-828「捨札にしたユニットカードのBPと同じBPのユニットをすべて撃破する」・R-TGT-04）", () => {
    const s = resolveAll(enterEvil(), ["RS-478:ha"]);
    expect(zoneOf(s, "player1", "RS-478:ha")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-478:e4000")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-479:r4000")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-479:own4000")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e3000")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-476:ev")).toBe("battle");
  });

  it("RS-476: 【天地震撼ビーストハリケーン】「捨札にしてもよい」— 見送れば手札もユニットも残る（出典: atwiki/page-828「捨札にしてもよい」）", () => {
    let s = enterEvil();
    if (s.pendingEffectChoice?.sourceCardId === "RS-476") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(s.players.player1.hand).toHaveLength(3);
    expect(zoneOf(s, "player2", "RS-478:e4000")).toBe("battle");
  });

  it("RS-476: 【天地震撼ビーストハリケーン】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-828「自軍ターン中、これがバトルエリアに出たとき」）", () => {
    const s = enterEvil({ activePlayer: "player2" });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-476");
    const t = resolveAll(s, ["RS-478:ha"]);
    expect(t.players.player1.hand).toHaveLength(3);
    expect(zoneOf(t, "player2", "RS-478:e4000")).toBe("battle");
  });
});

// ===========================================================================
/** 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」の共通テスト。 */
function holdEntryTests(id: string, page: string) {
  it(`${id}: ※ 自軍コマンドを1つホールドしてバトルエリアに出られる（出典: atwiki/${page}「自軍コマンドを1つホールドしなければバトルエリアに出られない」）`, () => {
    const s = enterWithHold(st({ player1: { rush: [inst(id, "m")], command: [released("TST-OP", "c")], deck: deckCards(3) } }), `${id}:m`, ["TST-OP:c"]);
    expect(zoneOf(s, "player1", `${id}:m`)).toBe("battle");
    expect(cardIn(s, "player1", "TST-OP:c")?.commandHeld).toBe(true);
  });

  it(`${id}: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: atwiki/${page}）`, () => {
    const s = st({ player1: { rush: [inst(id, "m")], command: [{ ...inst("TST-OP", "c"), commandHeld: true }], deck: deckCards(3) } });
    expect(canEnter(s, `${id}:m`)).toBe(false);
  });
}

describe("RS-477 ガオウルフ", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【威圧する咆哮】これが自軍エリアにある間、敵軍ターン中、敵軍ユニットがＮＣの効果を発動するとき、そのユニットと同じカード名のユニットカードが敵軍捨札にあれば、そのNCの効果を発動する前に、次の効果を発動できる⇒そのユニットが持つカテゴリと同じカテゴリを持つ敵軍コマンドをすべて捨札にする。";

  it("RS-477: カタログ本文・スペックが出典と一致（出典: atwiki/page-770）", () => {
    expectCatalogText("RS-477", TEXT);
    expectStats("RS-477", {
      name: "ガオウルフ",
      category: "WB",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: 4,
      features: ["獣"],
      rushCondition: undefined,
    });
  });

  holdEntryTests("RS-477", "page-770");

  /** 敵軍（player2）ターン: マジブルー（MA・CN2【未来予知】1枚ドロー）が2番目に出て NC を発動する。 */
  const blueEnters = (opts: { discard?: string[]; wolfZone?: "rush" | "battle" | "none" } = {}) => {
    const wolfZone = opts.wolfZone ?? "rush";
    const s = st({
      activePlayer: "player2",
      player1: { [wolfZone === "none" ? "hand" : wolfZone]: [inst("RS-477", "wf")], deck: deckCards(3) },
      player2: {
        battle: fillers(1, "ef"),
        rush: [inst("RS-059", "blue")],
        discard: (opts.discard ?? ["RS-059"]).map((id, i) => inst(id, `dis${i}`)),
        command: [released("TST-OP-MA", "ma1"), released("TST-OP-MA", "ma2"), released("TST-OP", "wb")],
        deck: deckCards(5, "e"),
      },
    });
    return enter(s, "RS-059:blue", "player2");
  };

  // 既知の不具合: CARD-RS-477 【威圧する咆哮】が実装されておらず、敵軍の NC 発動時に効果が発動しない
  it.fails("RS-477: 【威圧する咆哮】敵軍ターン中、敵軍ユニットが NC を発動するとき、同名カードが敵軍捨札にあれば、そのユニットと同じカテゴリ（MA）の敵軍コマンドをすべて捨札にできる（出典: atwiki/page-770「そのユニットが持つカテゴリと同じカテゴリを持つ敵軍コマンドをすべて捨札にする」）", () => {
    const s = resolveAll(blueEnters(), ["RS-477:wf"]);
    expect(zoneOf(s, "player2", "TST-OP-MA:ma1")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP-MA:ma2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:wb")).toBe("command");
  });

  it("RS-477: 【威圧する咆哮】敵軍捨札に同名のユニットカードがなければ発動しない（出典: atwiki/page-770「そのユニットと同じカード名のユニットカードが敵軍捨札にあれば」）", () => {
    const s = resolveAll(blueEnters({ discard: ["TST-UNIT-0"] }), ["RS-477:wf"]);
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("RS-477: 【威圧する咆哮】これが自軍エリア（ラッシュ・バトル）にないとき（手札）は発動しない（出典: atwiki/page-770「これが自軍エリアにある間」）", () => {
    const s = resolveAll(blueEnters({ wolfZone: "none" }), ["RS-477:wf"]);
    expect(s.players.player2.command).toHaveLength(3);
  });

  it("RS-477: 【威圧する咆哮】自軍ターン中に自軍ユニットが NC を発動しても自軍コマンドは捨札にならない（出典: atwiki/page-770「敵軍ターン中、敵軍ユニットが」）", () => {
    const s0 = st({
      player1: {
        battle: fillers(1),
        rush: [inst("RS-059", "blue")],
        discard: [inst("RS-059", "d")],
        command: [released("TST-OP-MA", "ma1")],
        deck: deckCards(5),
      },
      player2: { rush: [inst("RS-477", "wf")], deck: deckCards(3, "e") },
    });
    const s = resolveAll(enter(s0, "RS-059:blue"));
    expect(zoneOf(s, "player1", "TST-OP-MA:ma1")).toBe("command");
  });

  // 既知の不具合: CARD-RS-477 【威圧する咆哮】が実装されておらず、発動しない選択（見送り）の窓も出ない
  it.fails("RS-477: 【威圧する咆哮】「発動できる」— 発動しないことを選べる（出典: atwiki/page-770「次の効果を発動できる」）", () => {
    const s = blueEnters();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-477");
    expect(canSkip(s)).toBe(true);
    const t = resolveAll(skip(s));
    expect(t.players.player2.command).toHaveLength(3);
  });
});

// ===========================================================================
describe("RS-478 ガオリゲーター", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【粉砕する大顎】これをラッシュしたとき、敵軍バトルエリアから、カテゴリを2つ以上持つBP9000以下のユニットを1体選び、撃破してもよい。";

  it("RS-478: カタログ本文・スペックが出典と一致（出典: atwiki/page-771）", () => {
    expectCatalogText("RS-478", TEXT);
    expectStats("RS-478", {
      name: "ガオリゲーター",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 2,
      features: ["獣"],
      rushCondition: undefined,
    });
  });

  holdEntryTests("RS-478", "page-771");

  const MULTI9000 = sUnit("SPEC-MULTI9000", { category: ["WB", "ET"] as never, bp: 9000 });
  const MULTI9500 = sUnit("SPEC-MULTI9500", { category: ["WB", "ET"] as never, bp: 9500 });

  const rushGator = (p2: Partial<GameState["players"]["player2"]>) =>
    rushFromHand(
      st(
        {
          phase: "rush",
          player1: { hand: [inst("RS-478", "a")], command: releasedCat("WB", 2), power: powerCards(2), deck: deckCards(3) },
          player2: { deck: deckCards(3, "e"), ...p2 },
        },
        [MULTI9000, MULTI9500],
      ),
      "player1",
      "RS-478:a",
    );

  it("RS-478: 【粉砕する大顎】ラッシュしたとき、敵軍バトルエリアのカテゴリ2つ以上・BP9000以下（ちょうど9000を含む）のユニットだけを選べる（出典: atwiki/page-771「カテゴリを2つ以上持つBP9000以下のユニット」）", () => {
    const r = rushGator({
      battle: [inst("TST-UNIT-WB-ET", "m1000"), inst("SPEC-MULTI9000", "m9000"), inst("SPEC-MULTI9500", "m9500"), inst("TST-UNIT-0", "single")],
      rush: [inst("TST-UNIT-WB-ET", "mrush")],
    });
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-478");
    expect(choiceIds(r.state)).toEqual(["SPEC-MULTI9000:m9000", "TST-UNIT-WB-ET:m1000"]);
  });

  // 既知の不具合: CARD-RS-478 【粉砕する大顎】が印刷カテゴリだけを数え、効果で追加されたカテゴリ（ガオハンターイビルのバトルエリアでの WB）を数えない
  it.fails("RS-478: 【粉砕する大顎】効果でカテゴリが追加されて2つ以上になったユニット（バトルエリアのガオハンターイビル: DA＋WB）も選べる（出典: atwiki/page-771「カテゴリを2つ以上持つ」・atwiki/page-828「これはバトルエリアにあるとき、カテゴリにWBが追加される」）", () => {
    const r = rushGator({ battle: [inst("RS-476", "ev")] });
    expect(r.ok).toBe(true);
    expect(choiceIds(r.state)).toEqual(["RS-476:ev"]);
  });

  it("RS-478: 【粉砕する大顎】選んだユニットを撃破する（出典: atwiki/page-771「1体選び、撃破してもよい」）", () => {
    const r = rushGator({ battle: [inst("SPEC-MULTI9000", "m9000"), inst("TST-UNIT-0", "single")] });
    const t = resolveAll(pick(r.state, "SPEC-MULTI9000:m9000"));
    expect(zoneOf(t, "player2", "SPEC-MULTI9000:m9000")).toBe("discard");
    expect(zoneOf(t, "player2", "TST-UNIT-0:single")).toBe("battle");
  });

  it("RS-478: 【粉砕する大顎】「撃破してもよい」— 見送れる（出典: atwiki/page-771）", () => {
    const r = rushGator({ battle: [inst("SPEC-MULTI9000", "m9000")] });
    expect(canSkip(r.state)).toBe(true);
    const t = resolveAll(skip(r.state));
    expect(zoneOf(t, "player2", "SPEC-MULTI9000:m9000")).toBe("battle");
  });

  it("RS-478: 【粉砕する大顎】対象がいなければ何も起きない（単一カテゴリのみ）（出典: atwiki/page-771）", () => {
    const r = rushGator({ battle: [inst("TST-UNIT-0", "single")] });
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-478");
    expect(zoneOf(resolveAll(r.state), "player2", "TST-UNIT-0:single")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-479 ガオハンマーヘッド", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。※これは敵軍バトルエリアのユニットにアタックできない。※これは敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-479: カタログ本文・スペックが出典と一致（出典: atwiki/page-772）", () => {
    expectCatalogText("RS-479", TEXT);
    expectStats("RS-479", {
      name: "ガオハンマーヘッド",
      category: "WB",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["獣"],
      rushCondition: undefined,
    });
  });

  holdEntryTests("RS-479", "page-772");

  const field = () =>
    st({
      player1: { battle: [inst("RS-479", "h")], deck: deckCards(3) },
      player2: {
        battle: [inst("TST-UNIT-0", "bs"), inst("TST-UNIT-2", "bm")],
        rush: [inst("TST-UNIT-0", "rs"), inst("TST-UNIT-2", "rm"), inst("TST-UNIT-7", "rl")],
        deck: deckCards(3, "e"),
      },
    });

  it("RS-479: ※ 敵軍バトルエリアのユニットにはアタックできない（出典: atwiki/page-772「敵軍バトルエリアのユニットにアタックできない」）", () => {
    const t = attackTargets(field(), "RS-479:h");
    expect(t).not.toContain("TST-UNIT-0:bs");
    expect(t).not.toContain("TST-UNIT-2:bm");
  });

  it("RS-479: ※ 敵軍ラッシュエリアのユニットにはサイズを問わずアタックできる（出典: atwiki/page-772「敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    expect(attackTargets(field(), "RS-479:h").sort()).toEqual(["TST-UNIT-0:rs", "TST-UNIT-2:rm", "TST-UNIT-7:rl"]);
  });
});

// ===========================================================================
describe("RS-480 ガオシルバー", () => {
  const TEXT =
    "【邪気玉砕】「SP1」敵軍バトルエリアから、ナンバーの数字が昇順で連続して並んでいるユニットの組み合わせを1組選んでもよい（1、2、3や4、5など）。そうしたとき、選んだ1組の中で一番小さいナンバーの数字を持つユニットから順に、自分の手札の枚数と同じ数まで選び撃破する。";

  it("RS-480: カタログ本文・スペックが出典と一致（出典: atwiki/page-773）", () => {
    expectCatalogText("RS-480", TEXT);
    expectStats("RS-480", {
      name: "ガオシルバー",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 2,
      features: ["シルバー", "男"],
      rushCondition: undefined,
    });
  });

  const N1 = sUnit("SPEC-N1", { comboNumber: 1 });
  const N2 = sUnit("SPEC-N2", { comboNumber: 2 });
  const N3 = sUnit("SPEC-N3", { comboNumber: 3 });

  /** 自軍バトルフェイズ: 1番目に filler、2番目にガオシルバー（CN2）を出す。敵軍バトルエリア: CN1・CN2・CN3 が順に並ぶ。 */
  const silver = (opts: { position?: 1 | 2; hand?: number } = {}) =>
    enter(
      st(
        {
          player1: {
            battle: opts.position === 1 ? [] : fillers(1),
            rush: [inst("RS-480", "sv")],
            hand: Array.from({ length: opts.hand ?? 2 }, (_, i) => inst("TST-OP", `h${i}`)),
            deck: deckCards(5),
          },
          player2: { battle: [inst("SPEC-N1", "n1"), inst("SPEC-N2", "n2"), inst("SPEC-N3", "n3")], deck: deckCards(5, "e") },
        },
        [N1, N2, N3],
      ),
      "RS-480:sv",
    );

  it("RS-480: 【邪気玉砕】NC 成立（2番目）で「SP1」になる（出典: atwiki/page-773「「SP1」」・R-STK-02）", () => {
    const s = resolveAll(silver(), []);
    expect(spOf(s, "player1", "RS-480:sv")).toBe(1);
  });

  it("RS-480: 【邪気玉砕】NC 不成立（1番目）では SP は「！」のまま（ストライクで0）で、撃破も起きない（出典: atwiki/page-773・R-STK-02）", () => {
    const s = resolveAll(silver({ position: 1 }), ["SPEC-N1:n1"]);
    expect(spOf(s, "player1", "RS-480:sv")).toBe(0);
    expect(s.players.player2.battle).toHaveLength(3);
  });

  // 既知の不具合: CARD-RS-480 【邪気玉砕】の撃破部分が実装されておらず、SP1 しか得られない
  it.fails("RS-480: 【邪気玉砕】昇順に連続して並ぶ1組（1・2・3）を選ぶと、小さいナンバーから順に手札の枚数（2）まで撃破する（出典: atwiki/page-773「一番小さいナンバーの数字を持つユニットから順に、自分の手札の枚数と同じ数まで選び撃破する」）", () => {
    const s = resolveAll(silver({ hand: 2 }), ["SPEC-N1:n1", "SPEC-N2:n2"]);
    expect(zoneOf(s, "player2", "SPEC-N1:n1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-N2:n2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-N3:n3")).toBe("battle");
  });

  it("RS-480: 【邪気玉砕】手札が0枚なら撃破できる数は0（出典: atwiki/page-773「自分の手札の枚数と同じ数まで」）", () => {
    const s = resolveAll(silver({ hand: 0 }), ["SPEC-N1:n1"]);
    expect(s.players.player2.battle).toHaveLength(3);
  });

  it("RS-480: 【邪気玉砕】「選んでもよい」— 1組を選ばなければ何も撃破されない（出典: atwiki/page-773「1組選んでもよい」）", () => {
    let s = silver({ hand: 3 });
    if (s.pendingEffectChoice?.sourceCardId === "RS-480") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(3);
  });

  it.todo(
    "RS-480: 【邪気玉砕】連続していない並び（1・3 など）は「組み合わせ」として選べない（出典: atwiki/page-773「ナンバーの数字が昇順で連続して並んでいる」）— 撃破部分が未実装で「組み合わせ」を選ぶ手段（合法手）がエンジンに存在せず、候補の制限を観測できない",
  );
});

