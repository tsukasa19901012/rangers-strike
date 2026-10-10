/**
 * カード別スペック: RS-285〜RS-291（第5弾「五龍の逆鱗」ファイタージゲン〜気伝獣龍星王）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-5（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか faq-card-1/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  enter,
  enterHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  skip,
  st,
  strike,
  sUnit,
  toPhase,
  useCard,
  zoneOf,
} from "./RS5-285-305.helpers";
import type { GameState } from "../types/game";

const SP1_S = sUnit("SPEC-SP1", { bp: 1000, sp: 1 });
const SPN_S = sUnit("SPEC-SPN", { bp: 1000, sp: undefined });
const E9 = sUnit("SPEC-E9", { bp: 9000, sp: undefined });
const E8 = sUnit("SPEC-E8", { bp: 8000, sp: undefined });
const E4 = sUnit("SPEC-E4", { bp: 4000, sp: undefined });
const E5 = sUnit("SPEC-E5", { bp: 5000, sp: undefined });
const S3 = sUnit("SPEC-S3", { bp: 3000, sp: undefined });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 1000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", size: "M", bp: 4000 });
const WB_MAN_S = sUnit("SPEC-WB-MAN", { category: "WB", bp: 1000, features: ["男"] });
const RED_S = sUnit("SPEC-RED", { bp: 1000, features: ["レッド"] });
const MECHA5 = sUnit("SPEC-MECHA5", { bp: 2000, sp: undefined, features: ["メカ"] });
const SPECS = [SP1_S, SPN_S, E9, E8, E4, E5, S3, ET_S, DA_S, DA_M, WB_MAN_S, RED_S, MECHA5];

// ===========================================================================
describe("RS-285 ファイタージゲン", () => {
  const TEXT = "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。";

  it("RS-285: カタログ本文・スペックが出典と一致（出典: atwiki/page-437）", () => {
    expectCatalogText("RS-285", TEXT);
    expectStats("RS-285", {
      name: "ファイタージゲン",
      category: "DA",
      size: "M",
      bp: 7000,
      sp: 1,
      powerCost: "4+",
      features: ["メカ", "航空機", "怪人"],
      rushCondition: "discard_feature_unit",
    });
  });

  function enemyAttacks(attackerId: string) {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-285", "j")], deck: deckCards(5) },
        player2: { battle: [inst(attackerId, "a")], deck: deckCards(5, "e") },
      },
      SPECS,
    );
    return settle(attack(s, `${attackerId}:a`, "RS-285:j", "player2"));
  }

  // 「敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-285: ※ 敵軍ターン中に SP1 のユニットとバトルすると、バトルに勝っても撃破される（出典: atwiki/page-437）", () => {
    const s = enemyAttacks("SPEC-SP1");
    expect(zoneOf(s, "player2", "SPEC-SP1:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-285:j")).toBe("discard");
  });

  it("RS-285: ※ 「SP1」以上 — SP2 のユニットとバトルしても撃破される（出典: atwiki/page-437「「SP1」以上」）", () => {
    const s = enemyAttacks("TST-UNIT-2");
    expect(zoneOf(s, "player1", "RS-285:j")).toBe("discard");
  });

  it("RS-285: ※ SP を持たないユニットとのバトルに勝てば撃破されない（出典: atwiki/page-437）", () => {
    const s = enemyAttacks("SPEC-SPN");
    expect(zoneOf(s, "player2", "SPEC-SPN:a")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-285:j")).toBe("battle");
  });

  it("RS-285: ※ 自軍ターン中に SP1 のユニットとバトルして勝っても撃破されない（出典: atwiki/page-437「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-285", "j")] }, player2: { battle: [inst("SPEC-SP1", "d")], deck: deckCards(3, "e") } }, SPECS);
    s = settle(attack(s, "RS-285:j", "SPEC-SP1:d"));
    expect(zoneOf(s, "player2", "SPEC-SP1:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-285:j")).toBe("battle");
  });

  // 「追加条件：特徴「航空機」を持つ自軍ユニット1体を捨札にする」「必要パワー：4+」
  function jigenRush(rush: ReturnType<typeof inst>[], power: number) {
    return st({ phase: "rush", player1: { hand: [inst("RS-285", "j")], rush, power: powerCards(power), command: releasedN(1, "TST-OP-DA") } }, SPECS);
  }

  it("RS-285: 追加条件 — 特徴「航空機」を持つ自軍ユニット1体を捨札にし、パワー4でラッシュできる（出典: atwiki/page-437）", () => {
    const r = rushFromHand(jigenRush([inst("RS-668", "air")], 4), "player1", "RS-285:j", { materials: ["RS-668:air"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-285:j")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-668:air")).toBe("discard");
  });

  it("RS-285: 追加条件 — 「航空機」を持たないユニットしかなければラッシュできない（出典: atwiki/page-437・R-ADD-02「＋」）", () => {
    expect(canStartRush(jigenRush([inst("TST-UNIT-0", "u")], 4), "player1", "RS-285:j")).toBe(false);
  });

  it("RS-285: 必要パワー4+ — 「航空機」を捨札にできてもパワー3ではラッシュできない（出典: atwiki/page-437「必要パワー：4+」）", () => {
    const r = rushFromHand(jigenRush([inst("RS-668", "air")], 3), "player1", "RS-285:j");
    expect(r.ok && zoneOf(r.state, "player1", "RS-285:j") === "rush").toBe(false);
  });
});

// ===========================================================================
describe("RS-286 大獣神", () => {
  const TEXT =
    "合体―守護獣ティラノザウルス＋守護獣ジュウマンモス＋守護獣トリケラトプス＋守護獣サーベルタイガー＋守護獣プテラノドン【守護獣の神】これがバトルエリアにあるとき、これ以外の「WB」のユニットすべてはBP＋2000される。";
  const PARTS = ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"];

  it("RS-286: カタログ本文・スペックが出典と一致（出典: atwiki/page-76）", () => {
    expectCatalogText("RS-286", TEXT);
    expectStats("RS-286", {
      name: "大獣神",
      category: "WB",
      size: "L",
      bp: 17000,
      sp: 1,
      powerCost: "8+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  function godRush(parts: string[], power: number) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-286", "god")],
        rush: parts.map((id, i) => inst(id, `p${i}`)),
        power: powerCards(power),
        command: [released("TST-OP", "wb")],
      },
    });
  }

  // 「合体―守護獣ティラノザウルス＋…＋守護獣プテラノドン」「追加条件：自軍合体ユニットを捨札にする」「必要パワー：8+」
  it("RS-286: 合体 — 5体の合体ユニットを捨札にし、パワー8でラッシュできる（出典: atwiki/page-76・R-ADD-06）", () => {
    const r = rushFromHand(godRush(PARTS, 8), "player1", "RS-286:god");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-286:god")).toBe("rush");
    PARTS.forEach((id, i) => expect(zoneOf(r.state, "player1", `${id}:p${i}`)).toBe("discard"));
  });

  it("RS-286: 合体ユニットが1体欠ける、またはパワー7ではラッシュできない（出典: atwiki/page-76・R-ADD-06）", () => {
    const short = rushFromHand(godRush(PARTS.slice(0, 4), 8), "player1", "RS-286:god");
    expect(short.ok && zoneOf(short.state, "player1", "RS-286:god") === "rush").toBe(false);
    const low = rushFromHand(godRush(PARTS, 7), "player1", "RS-286:god");
    expect(low.ok && zoneOf(low.state, "player1", "RS-286:god") === "rush").toBe(false);
  });

  // 「これがバトルエリアにあるとき、これ以外の「WB」のユニットすべてはBP＋2000される」
  it("RS-286: 【守護獣の神】バトルエリアにあるとき、これ以外の自軍 WB ユニット（バトル・ラッシュとも）は BP＋2000、自身は変わらない（出典: atwiki/page-76）", () => {
    const s = st({ player1: { battle: [inst("RS-286", "god"), inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-0", "b")] } });
    expect(bpOf(s, "player1", "TST-UNIT-0:a")).toBe(3000);
    expect(bpOf(s, "player1", "TST-UNIT-0:b")).toBe(3000);
    expect(bpOf(s, "player1", "RS-286:god")).toBe(17000);
  });

  it("RS-286: 【守護獣の神】WB 以外のユニットは BP＋2000 されない（出典: atwiki/page-76「「WB」のユニット」）", () => {
    const s = st({ player1: { battle: [inst("RS-286", "god"), inst("SPEC-ET-S", "et")] } }, SPECS);
    expect(bpOf(s, "player1", "SPEC-ET-S:et")).toBe(1000);
  });

  it("RS-286: 【守護獣の神】ラッシュエリアにあるときは効果がない（出典: atwiki/page-76「これがバトルエリアにあるとき」）", () => {
    const s = st({ player1: { rush: [inst("RS-286", "god"), inst("TST-UNIT-0", "a")] } });
    expect(bpOf(s, "player1", "TST-UNIT-0:a")).toBe(1000);
  });

  it("RS-286: 【守護獣の神】2体あれば効果は重複する（出典: atwiki/page-76・R-CONT-01）", () => {
    const s = st({ player1: { battle: [inst("RS-286", "g1"), inst("RS-286", "g2"), inst("TST-UNIT-0", "a")] } });
    expect(bpOf(s, "player1", "TST-UNIT-0:a")).toBe(5000);
    expect(bpOf(s, "player1", "RS-286:g1")).toBe(19000);
  });

  // atwiki/page-76 Q&A「「RS-034 大獣神」の「守護獣の神」の効果は、敵軍「ワイルドビースト」のユニットにも適用されますか？」→「はい、適用されます。」
  it("RS-286: Q&A — 【守護獣の神】は敵軍の WB ユニットにも適用される（出典: atwiki/page-76 Q&A・faq-card-1 RS-034）", () => {
    const s = st({ player1: { battle: [inst("RS-286", "god")] }, player2: { battle: [inst("TST-UNIT-0", "e")], rush: [inst("SPEC-ET-S", "et")] } }, SPECS);
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(3000);
    expect(bpOf(s, "player2", "SPEC-ET-S:et")).toBe(1000);
  });
});

// ===========================================================================
describe("RS-287 剛龍神", () => {
  const TEXT =
    "合体―守護獣ドラゴンシーザー＋守護獣ジュウマンモス＋守護獣トリケラトプス＋守護獣サーベルタイガー【超爆裂龍神突き】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP8000以下のユニットを1体選び撃破してもよい。そうしたとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する。";
  const PARTS = ["RS-288", "RS-036", "RS-037", "RS-038"];

  it("RS-287: カタログ本文・スペックが出典と一致（出典: atwiki/page-417）", () => {
    expectCatalogText("RS-287", TEXT);
    expectStats("RS-287", {
      name: "剛龍神",
      category: "WB",
      size: "L",
      bp: 14000,
      sp: 1,
      powerCost: "8+",
      features: ["恐竜", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  function gouRush(parts: string[], power: number) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-287", "g")],
        rush: parts.map((id, i) => inst(id, `p${i}`)),
        power: powerCards(power),
        command: [released("TST-OP", "wb")],
      },
    });
  }

  it("RS-287: 合体 — 4体の合体ユニットを捨札にし、パワー8でラッシュできる（出典: atwiki/page-417・R-ADD-06）", () => {
    const r = rushFromHand(gouRush(PARTS, 8), "player1", "RS-287:g");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-287:g")).toBe("rush");
    PARTS.forEach((id, i) => expect(zoneOf(r.state, "player1", `${id}:p${i}`)).toBe("discard"));
  });

  it("RS-287: 合体ユニットが1体欠ける、またはパワー7ではラッシュできない（出典: atwiki/page-417・R-ADD-06）", () => {
    const short = rushFromHand(gouRush(PARTS.slice(1), 8), "player1", "RS-287:g");
    expect(short.ok && zoneOf(short.state, "player1", "RS-287:g") === "rush").toBe(false);
    const low = rushFromHand(gouRush(PARTS, 7), "player1", "RS-287:g");
    expect(low.ok && zoneOf(low.state, "player1", "RS-287:g") === "rush").toBe(false);
  });

  function gouEnters(p2: Partial<GameState["players"]["player2"]>) {
    const s = st({ player1: { rush: [inst("RS-287", "g")] }, player2: { deck: deckCards(3, "e"), ...p2 } }, SPECS);
    return enter(s, "RS-287:g");
  }
  const fullBoard = {
    battle: [inst("SPEC-E9", "b9"), inst("SPEC-E8", "b8")],
    rush: [inst("SPEC-E4", "r4"), inst("SPEC-E5", "r5")],
  };

  // 「敵軍バトルエリアからBP8000以下のユニットを1体選び撃破してもよい。そうしたとき、敵軍ラッシュエリアからBP4000以下のユニットを1体選び撃破する」
  it("RS-287: 【超爆裂龍神突き】敵軍バトルエリアの BP8000 以下を撃破し、続けて敵軍ラッシュエリアの BP4000 以下を撃破する（出典: atwiki/page-417）", () => {
    let s = gouEnters(fullBoard);
    expect(choiceIds(s)).toEqual(["SPEC-E8:b8"]);
    s = settle(pick(s, "SPEC-E8:b8"));
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("discard");
    expect(choiceIds(s)).toEqual(["SPEC-E4:r4"]);
    s = settle(pick(s, "SPEC-E4:r4"));
    expect(zoneOf(s, "player2", "SPEC-E4:r4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E5:r5")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-287:g")).toBe("battle");
  });

  it("RS-287: 【超爆裂龍神突き】敵軍バトルエリアで選べるのは BP8000 以下のユニットだけで、選んだユニットを撃破する（出典: atwiki/page-417）", () => {
    let s = gouEnters(fullBoard);
    expect(choiceIds(s)).toEqual(["SPEC-E8:b8"]);
    s = settle(pick(s, "SPEC-E8:b8"));
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E9:b9")).toBe("battle");
  });

  it("RS-287: 【超爆裂龍神突き】バトルエリアの撃破は任意（見送れる）で、見送ればラッシュエリアのユニットも撃破しない（出典: atwiki/page-417「撃破してもよい。そうしたとき」）", () => {
    let s = gouEnters(fullBoard);
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E4:r4")).toBe("rush");
  });

  it("RS-287: 【超爆裂龍神突き】敵軍バトルエリアに BP8000 以下がいなければ、ラッシュエリアのユニットも撃破しない（出典: atwiki/page-417「そうしたとき」）", () => {
    const s = settle(gouEnters({ battle: [inst("SPEC-E9", "b9")], rush: [inst("SPEC-E4", "r4")] }));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-E4:r4")).toBe("rush");
  });

  it("RS-287: 【超爆裂龍神突き】ラッシュエリアの撃破は強制（見送れない）（出典: atwiki/page-417「撃破する」）", () => {
    let s = gouEnters(fullBoard);
    s = settle(pick(s, "SPEC-E8:b8"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-287");
    expect(canSkip(s)).toBe(false);
  });

  it.todo(
    "RS-287: 【超爆裂龍神突き】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-417「自軍ターン中」）— 敵軍ターン中に L ユニットをバトルエリアに出す手段（紐男爵【紐拳】等）がエンジンで発動せず状況を作れない",
  );
});

// ===========================================================================
describe("RS-288 守護獣ドラゴンシーザー", () => {
  const TEXT =
    "※これは、特徴「獣奏剣」を持つ自軍ユニットがないとき、自軍コマンドゾーンの「獣奏剣」をホールドしなければバトルエリアに出られない。【ドラゴンハーレー】これが自軍ラッシュエリアにある間、自分がターンを終えるとき、BP3000のユニットがあれば1体選び撃破する。";

  it("RS-288: カタログ本文・スペックが出典と一致（出典: atwiki/page-99）", () => {
    expectCatalogText("RS-288", TEXT);
    expectStats("RS-288", {
      name: "守護獣ドラゴンシーザー",
      category: "WB",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: 5,
      features: ["恐竜", "ドラゴン"],
    });
  });

  // 「特徴「獣奏剣」を持つ自軍ユニットがないとき、自軍コマンドゾーンの「獣奏剣」をホールドしなければバトルエリアに出られない」
  it("RS-288: ※ 「獣奏剣」を持つ自軍ユニットも、自軍コマンドゾーンの「獣奏剣」もなければバトルエリアに出られない（ふつうのコマンドでは代わりにならない）（出典: atwiki/page-99）", () => {
    const s = st({ player1: { rush: [inst("RS-288", "d")], command: releasedN(2) } });
    expect(canEnter(s, "RS-288:d")).toBe(false);
  });

  it("RS-288: ※ 自軍コマンドゾーンのリリース状態の「獣奏剣」をホールドしてバトルエリアに出る（出典: atwiki/page-99）", () => {
    const s0 = st({ player1: { rush: [inst("RS-288", "d")], command: [released("RS-243", "sw")] } });
    expect(canEnter(s0, "RS-288:d")).toBe(true);
    const s = enter(s0, "RS-288:d");
    expect(zoneOf(s, "player1", "RS-288:d")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("RS-288: ※ ホールド状態の「獣奏剣」しかなければ出られない（出典: atwiki/page-99・R-ADD-07）", () => {
    const s = st({ player1: { rush: [inst("RS-288", "d")], command: [held("RS-243", "sw")] } });
    expect(canEnter(s, "RS-288:d")).toBe(false);
  });

  it("RS-288: ※ 特徴「獣奏剣」を持つ自軍ユニット（ドラゴンレンジャー）があれば、「獣奏剣」をホールドせずに出られる（出典: atwiki/page-99）", () => {
    const s0 = st({ player1: { rush: [inst("RS-288", "d"), inst("RS-289", "dr")], command: [released("RS-243", "sw")] } });
    const s = enter(s0, "RS-288:d");
    expect(zoneOf(s, "player1", "RS-288:d")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(false);
  });

  // 「これが自軍ラッシュエリアにある間、自分がターンを終えるとき、BP3000のユニットがあれば1体選び撃破する」
  function harleyEnd(p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) {
    const s = st({ player1: { deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } }, SPECS);
    return endTurn(s);
  }

  it("RS-288: 【ドラゴンハーレー】自分がターンを終えるとき、どちらの軍の BP3000 のユニットも選べ、選んだ1体を撃破する（出典: atwiki/page-99）", () => {
    let s = harleyEnd(
      { rush: [inst("RS-288", "d")], battle: [inst("SPEC-S3", "own")] },
      { battle: [inst("SPEC-S3", "en"), inst("SPEC-E4", "e4")] },
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-288");
    expect(choiceIds(s)).toEqual(["SPEC-S3:en", "SPEC-S3:own"]);
    expect(canSkip(s)).toBe(false);
    s = pick(s, "SPEC-S3:en");
    expect(zoneOf(s, "player2", "SPEC-S3:en")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-S3:own")).toBe("battle");
  });

  it("RS-288: 【ドラゴンハーレー】BP3000 のユニットがなければ何も起きない（出典: atwiki/page-99「あれば」）", () => {
    const s = harleyEnd({ rush: [inst("RS-288", "d")] }, { battle: [inst("SPEC-E4", "e4")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.activePlayer).toBe("player2");
  });

  it("RS-288: 【ドラゴンハーレー】バトルエリアにあるときは発動しない（出典: atwiki/page-99「これが自軍ラッシュエリアにある間」）", () => {
    const s = harleyEnd({ battle: [inst("RS-288", "d")] }, { battle: [inst("SPEC-S3", "en")] });
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-S3:en")).toBe("battle");
  });

  it("RS-288: 【ドラゴンハーレー】相手がターンを終えるときは発動しない（出典: atwiki/page-99「自分がターンを終えるとき」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-288", "d")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-S3", "en")], deck: deckCards(3, "e") } }, SPECS);
    const s = endTurn(s0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-S3:en")).toBe("battle");
  });

  // faq-rider-1 RK-016「その敵軍ユニットを選ぶためには自軍コマンドを１つホールドしなくてはいけません。ホールドするコマンドが無い場合は選ぶことはできません…」
  it.fails("RS-288: 公式Q&A — ミラーワールドの能力を得た敵軍ユニットは、ホールドする自軍コマンドがなければ選べず、選べる自軍ユニットを選ぶ（出典: grnrngr/faq-rider-1 RS-288 Q）", () => {
    // 既知の不具合: CARD-RS-288 【ドラゴンハーレー】の対象選択がミラーワールドの能力（選ぶにはコマンドのホールドが必要）を考慮しない
    const s = harleyEnd(
      { rush: [inst("RS-288", "d")], battle: [inst("SPEC-S3", "own")], command: [] },
      { battle: [inst("SPEC-S3", "en")], operation: [{ ...inst("RK-016", "mw"), stackedCards: [inst("SPEC-S3", "stk")] }] },
    );
    expect(choiceIds(s)).toEqual(["SPEC-S3:own"]);
  });

  it.fails("RS-288: 公式Q&A — ミラーワールドの能力を得た敵軍ユニットを選ぶときは、自軍コマンドを1つホールドする（出典: grnrngr/faq-rider-1 RS-288 Q「自軍コマンドを１つホールドしなくてはいけません」）", () => {
    // 既知の不具合: CARD-RS-288 【ドラゴンハーレー】の対象選択がミラーワールドの能力（選ぶにはコマンドのホールドが必要）を考慮しない
    let s = harleyEnd(
      { rush: [inst("RS-288", "d")], command: releasedN(1) },
      { battle: [inst("SPEC-S3", "en")], operation: [{ ...inst("RK-016", "mw"), stackedCards: [inst("SPEC-S3", "stk")] }] },
    );
    expect(choiceIds(s)).toEqual(["SPEC-S3:en"]);
    s = pick(s, "SPEC-S3:en");
    expect(zoneOf(s, "player2", "SPEC-S3:en")).toBe("discard");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RS-289 ドラゴンレンジャー", () => {
  const TEXT =
    "※これはダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない。※自分がターンを終えるとき、ゲームに負けるまでの自軍ダメージが残り3点以下なら、これを撃破する。【獣奏剣】これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットはBP＋1000される。";

  it("RS-289: カタログ本文・スペックが出典と一致（出典: atwiki/page-416）", () => {
    expectCatalogText("RS-289", TEXT);
    expectStats("RS-289", {
      name: "ドラゴンレンジャー",
      category: "WB",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: 3,
      features: ["グリーン", "男", "獣奏剣"],
    });
  });

  /** 敵軍（player2）ターンのバトルフェイズから始めて、player1 のバトルフェイズまで進める。strikeDamage なら敵軍ターン中にストライクを受ける。 */
  function nextOwnBattle(strikeDamage: boolean) {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-289", "dr")], power: powerCards(3, "p1pw"), deck: deckCards(8) },
      player2: { battle: [inst("TST-UNIT-0", "st")], deck: deckCards(8, "e") },
    });
    if (strikeDamage) s = settle(strike(s, "TST-UNIT-0:st", "player2"));
    s = endTurn(s);
    return toPhase(s, "player1", "battle");
  }

  // 「※これはダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない」
  it("RS-289: ※ 敵軍ターン中にストライクでダメージを受けたら、次の自軍ターンにバトルエリアに出られる（出典: atwiki/page-416）", () => {
    const s = nextOwnBattle(true);
    expect(s.players.player1.damage).toBe(1);
    expect(canEnter(s, "RS-289:dr")).toBe(true);
  });

  it("RS-289: ※ 直前の敵軍ターンにダメージを受けていなければバトルエリアに出られない（出典: atwiki/page-416「にしか…出られない」）", () => {
    const s = nextOwnBattle(false);
    expect(s.players.player1.damage).toBe(0);
    expect(canEnter(s, "RS-289:dr")).toBe(false);
  });

  it("RS-289: ※ ダメージを受けた敵軍ターンの「次の」自軍ターンだけ — その次の自軍ターン（間の敵軍ターンにダメージなし）には出られない（出典: atwiki/page-416「次の自軍ターンにしか」）", () => {
    let s = nextOwnBattle(true);
    s = endTurn(passEntry(s));
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    expect(canEnter(s, "RS-289:dr")).toBe(false);
  });

  // faq-card-5 RS-289 Q1「はい、出ることができます。」（カードをダメージにして置く効果でもダメージを受けたとみなす）
  it("RS-289: 公式Q&A — 敵軍ターン中に「ダメージにして置く」効果（カーナビック）を受けた場合も、次の自軍ターンに出られる（出典: grnrngr/faq-card-5 RS-289 Q1）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { hand: [inst("RS-247", "ctr")], rush: [inst("RS-289", "dr")], deck: deckCards(8) },
      player2: { hand: [inst("RS-185", "cn")], command: [released("TST-OP-OT", "c"), released("TST-OP", "c2")], power: powerCards(6), deck: deckCards(8, "e") },
    });
    s = useCard(s, "player2", "RS-185:cn");
    s = settle(pick(s, "RS-247:ctr"));
    expect(s.players.player1.power.some((c) => c.instanceId === "RS-247:ctr" && c.faceDown)).toBe(true);
    s = toPhase(endTurn(s), "player1", "battle");
    expect(canEnter(s, "RS-289:dr")).toBe(true);
  });

  // 「※自分がターンを終えるとき、ゲームに負けるまでの自軍ダメージが残り3点以下なら、これを撃破する」
  function endWithDamage(damage: number, zone: "battle" | "rush", active: "player1" | "player2" = "player1") {
    const s = st({
      activePlayer: active,
      player1: { [zone]: [inst("RS-289", "dr")], damage, power: damageCards(damage), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    return endTurn(s);
  }

  it("RS-289: ※ 自分がターンを終えるとき、自軍ダメージ4点（負けるまで残り3点）ならバトルエリアのこれを撃破する（出典: atwiki/page-416）", () => {
    expect(zoneOf(endWithDamage(4, "battle"), "player1", "RS-289:dr")).toBe("discard");
  });

  it("RS-289: ※ ラッシュエリアにあっても撃破する（出典: atwiki/page-416「これを撃破する」）", () => {
    expect(zoneOf(endWithDamage(5, "rush"), "player1", "RS-289:dr")).toBe("discard");
  });

  it("RS-289: ※ 自軍ダメージ3点（残り4点）なら撃破しない（出典: atwiki/page-416「残り3点以下なら」）", () => {
    expect(zoneOf(endWithDamage(3, "battle"), "player1", "RS-289:dr")).toBe("battle");
  });

  it("RS-289: ※ 相手がターンを終えるときは撃破しない（出典: atwiki/page-416「自分がターンを終えるとき」）", () => {
    expect(zoneOf(endWithDamage(4, "rush", "player2"), "player1", "RS-289:dr")).toBe("rush");
  });

  // 「【獣奏剣】これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットはBP＋1000される」
  it("RS-289: 【獣奏剣】自軍エリア（ラッシュエリア）にある間、特徴「恐竜」を持つ自軍ユニット（バトル・ラッシュとも）は BP＋1000（出典: atwiki/page-416）", () => {
    // 守護獣ジュウマンモス（恐竜・BP5000）、守護獣トリケラトプス（恐竜・BP5000）
    const s = st({ player1: { rush: [inst("RS-289", "dr"), inst("RS-036", "d1")], battle: [inst("RS-037", "d2"), inst("TST-UNIT-0", "x")] } });
    expect(bpOf(s, "player1", "RS-036:d1")).toBe(6000);
    expect(bpOf(s, "player1", "RS-037:d2")).toBe(6000);
    expect(bpOf(s, "player1", "TST-UNIT-0:x")).toBe(1000);
    expect(bpOf(s, "player1", "RS-289:dr")).toBe(6000);
  });

  it("RS-289: 【獣奏剣】バトルエリアにあっても有効、敵軍の「恐竜」は BP＋1000 されない（出典: atwiki/page-416「自軍ユニット」）", () => {
    const s = st({ player1: { battle: [inst("RS-289", "dr")], rush: [inst("RS-036", "d1")] }, player2: { battle: [inst("RS-038", "ed")] } });
    expect(bpOf(s, "player1", "RS-036:d1")).toBe(6000);
    expect(bpOf(s, "player2", "RS-038:ed")).toBe(3000);
  });

  // faq-card-5 RS-289 Q2「はい、選ぶことができます。」
  it("RS-289: 公式Q&A — キラーオーに撃破されたとき、【爆竜必殺デススティンガー】で本来の BP5000 の「恐竜」（獣奏剣で6000だった）を選べる（出典: grnrngr/faq-card-5 RS-289 Q2）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-289", "dr")], rush: [inst("RS-036", "d")], deck: deckCards(4) },
        player2: { battle: [inst("RS-226", "k")], deck: deckCards(4, "e") },
      },
      SPECS,
    );
    expect(bpOf(s, "player1", "RS-036:d")).toBe(6000);
    s = settle(attack(s, "RS-226:k", "RS-289:dr", "player2"));
    expect(zoneOf(s, "player1", "RS-289:dr")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-226");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toContain("RS-036:d");
  });
});

// ===========================================================================
describe("RS-290 気伝武人龍星王", () => {
  const TEXT = "【飛竜棍・大風車】これが自軍バトルエリアにある間、「DA」の敵軍Sユニットはバトルエリアに出られない。";

  it("RS-290: カタログ本文・スペックが出典と一致（出典: atwiki/page-474）", () => {
    expectCatalogText("RS-290", TEXT);
    expectStats("RS-290", {
      name: "気伝武人龍星王",
      category: "MA",
      size: "M",
      bp: 7000,
      sp: 1,
      powerCost: "5+",
      features: ["獣", "ドラゴン", "人型"],
      rushCondition: "discard_named_unit",
    });
  });

  // 「追加条件：自軍「気伝獣龍星王」1体を捨札にする」「必要パワー：5+」
  function ryuseiRush(rush: ReturnType<typeof inst>[], power: number) {
    return st({ phase: "rush", player1: { hand: [inst("RS-290", "b")], rush, power: powerCards(power), command: releasedN(1, "TST-OP-MA") } });
  }

  it("RS-290: 追加条件 — 自軍「気伝獣龍星王」1体を捨札にし、パワー5でラッシュできる（出典: atwiki/page-474）", () => {
    const r = rushFromHand(ryuseiRush([inst("RS-291", "k")], 5), "player1", "RS-290:b");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-290:b")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-291:k")).toBe("discard");
  });

  it("RS-290: 「気伝獣龍星王」がいない、またはパワー4ではラッシュできない（出典: atwiki/page-474・R-ADD-02）", () => {
    expect(canStartRush(ryuseiRush([inst("TST-UNIT-0", "u")], 5), "player1", "RS-290:b")).toBe(false);
    const r = rushFromHand(ryuseiRush([inst("RS-291", "k")], 4), "player1", "RS-290:b");
    expect(r.ok && zoneOf(r.state, "player1", "RS-290:b") === "rush").toBe(false);
  });

  /** player2 のバトルフェイズ。player1 のバトル／ラッシュエリアに龍星王。 */
  function enemyTurn(p1: Partial<GameState["players"]["player1"]>, p2rush: ReturnType<typeof inst>[]) {
    return st({ activePlayer: "player2", player1: p1, player2: { rush: p2rush } }, SPECS);
  }

  // 「これが自軍バトルエリアにある間、「DA」の敵軍Sユニットはバトルエリアに出られない」
  it.fails("RS-290: 【飛竜棍・大風車】自軍バトルエリアにある間、DA の敵軍 S ユニットはバトルエリアに出られない（出典: atwiki/page-474）", () => {
    // 既知の不具合: CARD-RS-290 【飛竜棍・大風車】が実装されていない（while_da_s_cannot_battle_entry を参照する処理がない）
    const s = enemyTurn({ battle: [inst("RS-290", "b")] }, [inst("SPEC-DA-S", "s")]);
    expect(canEnter(s, "SPEC-DA-S:s", "player2")).toBe(false);
  });

  it("RS-290: 【飛竜棍・大風車】DA の M ユニットや DA 以外の S ユニットは出られる（出典: atwiki/page-474「「DA」の敵軍Sユニット」）", () => {
    const s = enemyTurn({ battle: [inst("RS-290", "b")] }, [inst("SPEC-DA-M", "m"), inst("TST-UNIT-0", "w")]);
    expect(canEnter(s, "SPEC-DA-M:m", "player2")).toBe(true);
    expect(canEnter(s, "TST-UNIT-0:w", "player2")).toBe(true);
  });

  it("RS-290: 【飛竜棍・大風車】ラッシュエリアにあるときは効果がない（出典: atwiki/page-474「自軍バトルエリアにある間」）", () => {
    const s = enemyTurn({ rush: [inst("RS-290", "b")] }, [inst("SPEC-DA-S", "s")]);
    expect(canEnter(s, "SPEC-DA-S:s", "player2")).toBe(true);
  });

  it("RS-290: 【飛竜棍・大風車】自軍の DA の S ユニットは制限されない（出典: atwiki/page-474「敵軍Sユニット」）", () => {
    const s = st({ player1: { battle: [inst("RS-290", "b")], rush: [inst("SPEC-DA-S", "s")] } }, SPECS);
    expect(canEnter(s, "SPEC-DA-S:s")).toBe(true);
  });

  // faq-card-5 RS-290 Q1「いいえ、できません。…そのカテゴリを含むものはすべて対象となります。」／faq-card-5 RS-339 Q「「ＤＡのＳユニット」として扱います」
  it.fails("RS-290: 公式Q&A — 闇のヤイバでカテゴリに DA が追加された（特徴「男」を持つ WB の）S ユニットもバトルエリアに出られない（出典: grnrngr/faq-card-5 RS-290 Q1・RS-339 Q1）", () => {
    // 既知の不具合: CARD-RS-290 【飛竜棍・大風車】が実装されていない
    const s = st(
      { player1: { rush: [inst("SPEC-WB-MAN", "m")] }, player2: { battle: [inst("RS-290", "b")], rush: [inst("RS-339", "y")] } },
      SPECS,
    );
    expect(canEnter(s, "SPEC-WB-MAN:m")).toBe(false);
  });

  // atwiki/page-474 Q2・Q4「はい、その通りです。公開情報を確認した上で、実行できないことが明確であれば、それを実行することはできません。」
  it.fails("RS-290: Q&A — 闇のヤイバで DA を持つ S ユニットになる「仮面ライダークウガRD」とはモーフで置き換えられない（モーフを使えない）（出典: atwiki/page-474 Q2・Q4）", () => {
    // 既知の不具合: CARD-RS-290 【飛竜棍・大風車】が実装されていない（モーフの置き換え先として選べてしまう）
    // 龍星王（player1 のバトルエリア）と闇のヤイバ（player1 のラッシュエリア）は player2 から見て敵軍。
    const s = st({
      phase: "rush",
      player1: { battle: [inst("RS-290", "b")], rush: [inst("RS-339", "y")], hand: [inst("TST-UNIT-0", "u")], command: releasedN(1, "TST-OP", "c"), power: powerCards(1) },
      player2: { battle: [inst("RK-271", "rm")], command: [released("RK-272", "rd")] },
    });
    const r = rushFromHand(s, "player1", "TST-UNIT-0:u");
    expect(r.ok).toBe(true);
    const morph = legal(r.state).some((a) => a.type === "resolve_effect_choice" && a.instanceId === "RK-272:rd");
    expect(morph).toBe(false);
  });

  // atwiki/page-474 Q3「はい、可能です。…「Lユニット」になり、【飛竜棍・大風車】の効果対象ではなくなるため、バトルエリアに出すことが出来ます。」
  it.fails("RS-290: Q&A — DA の S ユニット（バイオハンター・シルバ）もバルジオン（2nd）にライドすれば L ユニットになり、バトルエリアに出られる（出典: atwiki/page-474 Q3）", () => {
    // 既知の不具合: CARD-RS-527 本来のカテゴリに DA を持つ S ユニットがバルジオン（2nd）にライドする合法手が出ない（範囲外カード）
    const s = st({ activePlayer: "player2", player1: { battle: [inst("RS-290", "b")] }, player2: { rush: [inst("RS-079", "s"), inst("RS-527", "bj")] } });
    const ride = legal(s).find((a) => a.type === "mount_ride" && a.riderInstanceId === "RS-079:s" && a.vehicleInstanceId === "RS-527:bj");
    expect(ride).toBeDefined();
    const after = act(s, ride!);
    expect(zoneOf(after, "player2", "RS-079:s")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-291 気伝獣龍星王", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【大火炎】これが特徴「レッド」を持つユニットからコンビネーションするとき、敵軍バトルエリアから特徴「メカ」を持たないBP5000以下のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("RS-291: カタログ本文・スペックが出典と一致（出典: atwiki/page-475）", () => {
    expectCatalogText("RS-291", TEXT);
    expectStats("RS-291", {
      name: "気伝獣龍星王",
      category: "MA",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["獣", "ドラゴン"],
    });
  });

  // 「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」
  it("RS-291: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: atwiki/page-475）", () => {
    const s = st({ player1: { rush: [inst("RS-291", "k")], command: [held("TST-OP", "h")] } });
    expect(canEnter(s, "RS-291:k")).toBe(false);
  });

  it("RS-291: ※ 自軍コマンドを1つホールドしてバトルエリアに出る（カテゴリは問わない）（出典: atwiki/page-475・grnrngr/faq-card-5 RS-316 Q）", () => {
    const s = enterHold(st({ player1: { rush: [inst("RS-291", "k")], command: [released("TST-OP-DA", "c")] } }), "RS-291:k");
    expect(zoneOf(s, "player1", "RS-291:k")).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  function fromUnit(prevId: string) {
    const s = st(
      {
        player1: { battle: [inst(prevId, "prev")], rush: [inst("RS-291", "k")], command: releasedN(1) },
        player2: {
          battle: [inst("SPEC-E5", "e5"), inst("SPEC-E8", "e8"), inst("SPEC-MECHA5", "mc")],
          rush: [inst("SPEC-E4", "r4")],
          deck: deckCards(3, "e"),
        },
      },
      SPECS,
    );
    return enterHold(s, "RS-291:k");
  }

  // 「これが特徴「レッド」を持つユニットからコンビネーションするとき、敵軍バトルエリアから特徴「メカ」を持たないBP5000以下のユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」
  it.fails("RS-291: 【大火炎】「レッド」を持つユニットからコンビネーションするとき、敵軍バトルエリアの「メカ」を持たない BP5000 以下を1体選び、持ち主のパワーゾーンにダメージにして置く（出典: atwiki/page-475）", () => {
    // 既知の不具合: CARD-RS-291 【大火炎】が発動しない（CN を持たないのに NC 扱いの DSL スタブ）
    let s = fromUnit("SPEC-RED");
    expect(choiceIds(s)).toEqual(["SPEC-E5:e5"]);
    s = settle(pick(s, "SPEC-E5:e5"));
    const placed = s.players.player2.power.find((c) => c.instanceId === "SPEC-E5:e5");
    expect(placed?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it.fails("RS-291: 【大火炎】選ぶのは強制（見送れない）（出典: atwiki/page-475「1体選び…置く」）", () => {
    // 既知の不具合: CARD-RS-291 【大火炎】が発動しない
    const s = fromUnit("SPEC-RED");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-291");
    expect(canSkip(s)).toBe(false);
  });

  it("RS-291: 【大火炎】「レッド」を持たないユニットからコンビネーションしたときは発動しない（出典: atwiki/page-475）", () => {
    const s = settle(fromUnit("TST-UNIT-0"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "SPEC-E5:e5")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });
});
