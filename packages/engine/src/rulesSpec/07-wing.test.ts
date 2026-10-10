/**
 * docs/rules/07-keywords.md「ウイング」節（R-KW-WING-01〜04）のルール仕様テスト。
 * 出典: grnrngr/faq-card-9「ウイング」Q1〜Q6、atwiki/page-1537。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { markBattleBlocked } from "../rules/turnModifiers";
import { act, canAttack, canStrike, card, hasLegal, inst, KW, state, unitDef, where } from "./07-helpers";

const WING = unitDef("RSPEC-WING", { text: KW.wing, bp: 5000, sp: 1 });
const ENEMY = unitDef("RSPEC-ENEMY", { bp: 3000 });
const w = inst(WING.id, "w");
const e = inst(ENEMY.id, "e");

function battlePhase(over: Partial<GameState["players"]["player1"]> = {}): GameState {
  return state([WING, ENEMY], {
    phase: "battle",
    player1: { rush: [w], ...over },
    player2: { battle: [e] },
  });
}

const canHold = (s: GameState, id = w.instanceId) =>
  hasLegal(s, (a) => a.type === "hold_for_wing" && a.instanceId === id);
const canEnter = (s: GameState, id = w.instanceId) =>
  hasLegal(
    s,
    (a) =>
      (a.type === "move_to_battle" && a.instanceId === id) ||
      (a.type === "initiate_command_payment" && a.kind === "battle_entry" && a.sourceInstanceId === id),
  );

describe("R-KW-00 共通（キーワードは※記載のものだけ）", () => {
  // 「ダークウイング」はウイングではない
  it.fails("R-KW-00: 効果名に「ウイング」を含むだけのユニットはウイングを発動できない（出典: docs/rules/07 R-KW-00、atwiki/page-2355 本文）", () => {
    // 既知の不具合: E12（テキスト部分一致で判定）
    const darkWing = unitDef("RSPEC-DARKWING", {
      text: "【ダークウイング】これがバトルエリアに出たとき、敵軍Sユニットを1体選びホールドする。",
    });
    const d = inst(darkWing.id, "d");
    const s = state([darkWing, ENEMY], { phase: "battle", player1: { rush: [d] }, player2: { battle: [e] } });
    expect(canHold(s, d.instanceId)).toBe(false);
  });
});

describe("R-KW-WING-01 規定文", () => {
  // 「ラッシュエリアでホールドして、ラッシュエリアからアタックできる」
  it("R-KW-WING-01: 自軍バトルフェイズにラッシュエリアでホールドし、そこから敵軍ユニットにアタックできる（出典: grnrngr/faq-card-9 ウイング Q1）", () => {
    let s = battlePhase();
    expect(canHold(s)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    expect(card(s, "player1", w.instanceId)?.commandHeld).toBe(true);
    expect(where(s, "player1", w.instanceId)).toBe("rush");
    expect(canAttack(s, w.instanceId, e.instanceId)).toBe(true);
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: w.instanceId, defenderInstanceId: e.instanceId });
    // BP5000 対 BP3000: 敵が撃破され、ウイングのユニットはラッシュエリアに残る
    expect(where(s, "player2", e.instanceId)).toBe("discard");
    expect(where(s, "player1", w.instanceId)).toBe("rush");
  });

  // 「相手のユニットにアタックすることができます」
  it("R-KW-WING-01: アタック先は相手のユニットなので、敵軍バトルエリアが空ならウイングでアタックもストライクもできない（出典: grnrngr/faq-card-9 ウイング Q1）", () => {
    let s = state([WING, ENEMY], { phase: "battle", player1: { rush: [w] }, player2: { battle: [] } });
    if (canHold(s)) {
      s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    }
    expect(hasLegal(s, (a) => a.type === "battle" && a.attackerInstanceId === w.instanceId)).toBe(false);
    expect(canStrike(s, w.instanceId)).toBe(false);
  });
});

describe("R-KW-WING-02 公式Q&A", () => {
  // 「なんらかの制限を受けて…出られない状態でも」→「はい、できます」
  it.fails("R-KW-WING-02: バトルエリアに出られない制限を受けていてもウイングは発動できる（出典: grnrngr/faq-card-9 ウイング Q2）", () => {
    // 既知の不具合: 04-#18（進入制限下で発動不可にしている）
    const s0 = battlePhase();
    const s: GameState = {
      ...s0,
      players: { ...s0.players, player1: markBattleBlocked(s0.players.player1, w.instanceId) },
    };
    expect(canEnter(s)).toBe(false);
    expect(canHold(s)).toBe(true);
  });

  // 「自軍バトルフェイズ以外のフェイズに」→「いいえ」
  it("R-KW-WING-02: 自軍ラッシュフェイズにはウイングを発動できない（出典: grnrngr/faq-card-9 ウイング Q3）", () => {
    const s = state([WING, ENEMY], { phase: "rush", player1: { rush: [w] }, player2: { battle: [e] } });
    expect(canHold(s)).toBe(false);
  });

  // 「自軍バトルフェイズ以外のフェイズに」→「いいえ」
  it("R-KW-WING-02: 敵軍バトルフェイズにはウイングを発動できない（出典: grnrngr/faq-card-9 ウイング Q3）", () => {
    const s = state([WING, ENEMY], {
      phase: "battle",
      activePlayer: "player2",
      player1: { rush: [w] },
      player2: { rush: [inst("TST-UNIT-0", "x")], battle: [e] },
    });
    expect(hasLegal(s, (a) => a.type === "hold_for_wing" && a.playerId === "player1")).toBe(false);
  });

  // 「発動したそのターン中にバトルエリアに出ることが」→「いいえ」
  it("R-KW-WING-02: ウイングを発動したターン、そのユニットはバトルエリアに出られない（出典: grnrngr/faq-card-9 ウイング Q4）", () => {
    let s = battlePhase();
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: w.instanceId, defenderInstanceId: e.instanceId });
    expect(canEnter(s)).toBe(false);
  });

  // 「コマンドゾーンやパワーゾーンなど…以外の場所からでも」→「いいえ」
  it("R-KW-WING-02: コマンドゾーンにあるウイング持ちのカードからは発動できない（出典: grnrngr/faq-card-9 ウイング Q5）", () => {
    const s = state([WING, ENEMY], {
      phase: "battle",
      player1: { rush: [], command: [inst(WING.id, "cmd")] },
      player2: { battle: [e] },
    });
    expect(hasLegal(s, (a) => a.type === "hold_for_wing")).toBe(false);
  });

  // 「コマンドゾーンやパワーゾーンなど…以外の場所からでも」→「いいえ」
  it("R-KW-WING-02: パワーゾーンにあるウイング持ちのカードからは発動できない（出典: grnrngr/faq-card-9 ウイング Q5）", () => {
    const s = state([WING, ENEMY], {
      phase: "battle",
      player1: { rush: [], power: [inst(WING.id, "pw")] },
      player2: { battle: [e] },
    });
    expect(hasLegal(s, (a) => a.type === "hold_for_wing")).toBe(false);
  });

  // 「バトルエリアにあるユニット」もラッシュエリア以外
  it("R-KW-WING-02: バトルエリアにいるウイング持ちユニットはウイングを発動できない（出典: grnrngr/faq-card-9 ウイング Q5）", () => {
    const s = state([WING, ENEMY], { phase: "battle", player1: { battle: [w] }, player2: { battle: [e] } });
    expect(canHold(s)).toBe(false);
  });

  // 「アタックするかわりにストライク」→「いいえ」
  it("R-KW-WING-02: SP1 のユニットがウイングを発動しても、アタックのかわりにストライクはできない（出典: grnrngr/faq-card-9 ウイング Q6）", () => {
    let s = battlePhase();
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    expect(canStrike(s, w.instanceId)).toBe(false);
    expect(canAttack(s, w.instanceId, e.instanceId)).toBe(true);
  });
});

describe("R-KW-WING-03 リリースされれば再ウイング", () => {
  // 「同じユニットのウイングを1ターンに複数回使う」
  it.fails("R-KW-WING-03: ウイングでアタックした後、効果でリリースされれば同じターンにもう一度ウイングできる（出典: atwiki/page-1537 本文、page-1974 ゴセイアルティメット）", () => {
    // 既知の不具合: 04-#20（アタック済みフラグが残り、リリース後も再ウイングできない）
    const e2 = inst(ENEMY.id, "e2");
    let s = state([WING, ENEMY], { phase: "battle", player1: { rush: [w] }, player2: { battle: [e, e2] } });
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: w.instanceId, defenderInstanceId: e.instanceId });
    // リリース効果（ギルスレイダー等）の結果を状態で再現する
    s = {
      ...s,
      players: {
        ...s.players,
        player1: {
          ...s.players.player1,
          rush: s.players.player1.rush.map((c) => (c.instanceId === w.instanceId ? { ...c, commandHeld: false } : c)),
        },
      },
    };
    expect(canHold(s)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    expect(canAttack(s, w.instanceId, e2.instanceId)).toBe(true);
  });
});

describe("R-KW-WING-04 バトルエリアからの戻りとの組み合わせ", () => {
  // 「何らかの効果でラッシュエリアに戻り、その後ウイングを使うことは可能」
  it("R-KW-WING-04: バトルエリアでアタックした後、効果でラッシュエリアに戻ればウイングで再度アタックできる（出典: atwiki/page-1537 本文）", () => {
    const e2 = inst(ENEMY.id, "e2");
    let s = state([WING, ENEMY], { phase: "battle", player1: { rush: [w] }, player2: { battle: [e, e2] } });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: w.instanceId });
    s = act(s, { type: "battle", playerId: "player1", attackerInstanceId: w.instanceId, defenderInstanceId: e.instanceId });
    expect(where(s, "player1", w.instanceId)).toBe("battle");
    // タイムイエロー等の「バトルエリアからラッシュエリアに戻す」効果の結果を状態で再現する
    const moved = s.players.player1.battle.find((c) => c.instanceId === w.instanceId)!;
    s = {
      ...s,
      players: {
        ...s.players,
        player1: {
          ...s.players.player1,
          battle: s.players.player1.battle.filter((c) => c.instanceId !== w.instanceId),
          rush: [...s.players.player1.rush, { ...moved, battleActed: undefined }],
        },
      },
    };
    expect(canHold(s)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: w.instanceId });
    expect(canAttack(s, w.instanceId, e2.instanceId)).toBe(true);
  });

  // 「そうしたターン、これはバトルエリアに出られない」
  it.todo("R-KW-WING-04: [未確定] 「そうしたターン」はホールドだけで成立するか、アタックまで要るか（ホールド取り消しの可否、04-#19）");
});
