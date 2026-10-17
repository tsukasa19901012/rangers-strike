/**
 * docs/rules/03-turn.md（ターンの流れ）の細粒度ルールテスト。
 * 期待値はルールブック本文と docs/rules/sources/web/ の公式ルール・公式FAQ・atwiki に従う。
 * 現エンジンが満たさないものは it.fails（既知の不具合）として残す。
 */
import { describe, expect, it } from "vitest";
import { applyAction, createGame, getLegalActions } from "../index";
import { withSyncedEffectStack } from "../rules/effectStack";
import type { GameState } from "../types/game";
import {
  act,
  allDefs,
  cards,
  createTestState,
  doStartSteps,
  endTurn,
  hasLegal,
  inst,
  legal,
  RIDER_DEF,
  settle,
  unwrap,
  VEHICLE_DEF,
} from "./03-helpers";
import { TEST_DEFINITIONS, type TestStateOptions } from "../testing/fixtures";

const released = (id: string, suffix: string) => ({ ...inst(id, suffix), commandHeld: false });
const held = (id: string, suffix: string) => ({ ...inst(id, suffix), commandHeld: true });

/** プレイヤー2のスタートフェイズ直前（プレイヤー1のエンドフェイズ）を作り、ターンを渡す。 */
function startOfPlayer2Turn(
  player2: TestStateOptions["player2"],
  extra: Partial<TestStateOptions> = {},
): GameState {
  const state = createTestState({
    phase: "battle",
    activePlayer: "player1",
    turn: 1,
    definitions: allDefs([VEHICLE_DEF, RIDER_DEF]),
    player2,
    ...extra,
  });
  const next = endTurn(state);
  expect(next.activePlayer).toBe("player2");
  expect(next.phase).toBe("start");
  return next;
}

// ---------------------------------------------------------------------------
// 1. ターン構造
// ---------------------------------------------------------------------------

describe("R-TURN-01 5つのフェイズ", () => {
  // 「フェイズの順番を前後させることはできない」(atwiki/page-69)
  it("R-TURN-01: チャージ→ラッシュ→バトル→エンドの順に進み、相手のスタートフェイズへ移る（出典: grnrngr/rule_tarn, atwiki/page-69）", () => {
    let state = createTestState({
      phase: "charge",
      activePlayer: "player1",
      turn: 1,
      player1: { hand: [inst("TST-OP", "h1")] },
    });
    const seen: string[] = [state.phase];
    for (let i = 0; i < 6 && state.activePlayer === "player1"; i += 1) {
      state = settle(act(state, { type: "end_phase", playerId: "player1" }));
      if (state.activePlayer === "player1" && seen[seen.length - 1] !== state.phase) {
        seen.push(state.phase);
      }
    }
    // エンドフェイズは自動で終わることがあるため、バトルまでは必ず順に通る
    expect(seen.slice(0, 3)).toEqual(["charge", "rush", "battle"]);
    if (seen.length > 3) expect(seen[3]).toBe("end");
    expect(state.activePlayer).toBe("player2");
    expect(state.phase).toBe("start");
  });

  // 「フェイズの順番を前後させることはできない」(atwiki/page-69)
  it("R-TURN-01: ラッシュフェイズからはバトルフェイズにしか進めず、チャージの行動にも戻れない（出典: atwiki/page-69）", () => {
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { hand: [inst("TST-OP", "h1")], rush: [inst("TST-UNIT-0", "r1")] },
    });
    expect(hasLegal(state, "charge_power", "player1")).toBe(false);
    expect(hasLegal(state, "charge_command", "player1")).toBe(false);
    expect(hasLegal(state, "move_to_battle", "player1")).toBe(false);
    const next = act(state, { type: "end_phase", playerId: "player1" });
    expect(next.phase).toBe("battle");
  });

  // 「速やかにもう片方のターンが開始される」(atwiki/page-588)
  it("R-TURN-01: ターン終了を宣言すると、間を置かず相手のターン（スタートフェイズ）が始まりターン数が進む（出典: atwiki/page-588）", () => {
    const state = createTestState({ phase: "battle", activePlayer: "player1", turn: 3 });
    const next = endTurn(state);
    expect(next.activePlayer).toBe("player2");
    expect(next.phase).toBe("start");
    expect(next.turn).toBe(4);
  });
});

describe("R-TURN-02 フェイズ内の行動順は自由", () => {
  // 「各フェイズ中の行動には、順序の制限はありません」(faq-index)
  it("R-TURN-02: ラッシュ→オペレーション→ラッシュの順に行える（出典: grnrngr/faq-index「フェイズ」, atwiki/page-69 Q1）", () => {
    const u1 = inst("TST-UNIT-0", "u1");
    const u2 = inst("TST-UNIT-0", "u2");
    const op = inst("RS-025", "gao");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: {
        hand: [u1, op, u2],
        power: cards("p", 3),
        command: [released("TST-OP", "c1"), released("TST-OP", "c2"), released("TST-OP", "c3")],
      },
    });
    // 1体目のラッシュ
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: u1.instanceId,
    });
    state = settle(
      act(state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c1"] }),
    );
    expect(state.players.player1.rush.map((c) => c.instanceId)).toContain(u1.instanceId);
    // オペレーション（ガオ・ソウル）
    const play = legal(state, "player1").find(
      (a) =>
        (a.type === "play_operation" && a.instanceId === op.instanceId && a.targetInstanceId === u1.instanceId) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === op.instanceId),
    );
    expect(play).toBeDefined();
    state = act(state, play!);
    if (state.pendingCommandPayment) {
      state = act(state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c2"] });
    }
    state = settle(state);
    expect(state.players.player1.rush.find((c) => c.instanceId === u1.instanceId)?.bpModifier).toBe(4000);
    // 2体目のラッシュ
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: u2.instanceId,
    });
    state = settle(
      act(state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c3"] }),
    );
    expect(state.phase).toBe("rush");
    expect(state.players.player1.rush.map((c) => c.instanceId)).toEqual(
      expect.arrayContaining([u1.instanceId, u2.instanceId]),
    );
  });

  // 「好きな順に必ず行う」(atwiki/page-264)
  it("R-TURN-02: スタートフェイズの行程もドローを先にしてよい（出典: atwiki/page-69 本文「フェイズ中の行程は基本的に好きな順番で行ってよい」）", () => {
    const state = createTestState({
      phase: "start",
      player1: {
        deck: cards("d", 3),
        command: [held("TST-OP", "c1")],
        battle: [inst("TST-UNIT-0", "b1")],
      },
    });
    expect(hasLegal(state, "draw", "player1")).toBe(true);
    expect(hasLegal(state, "release_start_commands", "player1")).toBe(true);
    expect(hasLegal(state, "return_all_battle_to_rush", "player1")).toBe(true);
  });
});

describe("R-TURN-03 先攻1ターン目はチャージから", () => {
  const deck = Array.from({ length: 20 }, () => TEST_DEFINITIONS["TST-OP"]!);

  // 「先攻１ターン目はスタートフェイズがスキップされ」(rule_phase1-2)
  it("R-TURN-03: 先攻の1ターン目はチャージフェイズから始まりドローしない（出典: grnrngr/rule_phase1-2, atwiki/page-264）", () => {
    const state = createGame({ player1Deck: deck, player2Deck: deck, firstPlayer: "player1" });
    expect(state.turn).toBe(1);
    expect(state.activePlayer).toBe("player1");
    expect(state.phase).toBe("charge");
    expect(state.players.player1.hand).toHaveLength(7);
    expect(state.players.player1.deck).toHaveLength(13);
  });

  // 「先攻側は１ターン目のみ、このフェイズを飛ばして」(atwiki/page-264)
  it("R-TURN-03: 後攻が先攻のときも先攻側がチャージから始まる（出典: atwiki/page-264）", () => {
    const state = createGame({ player1Deck: deck, player2Deck: deck, firstPlayer: "player2" });
    expect(state.activePlayer).toBe("player2");
    expect(state.phase).toBe("charge");
    expect(state.players.player2.hand).toHaveLength(7);
  });

  // 「先攻側は１ターン目のみ」(atwiki/page-264)
  it("R-TURN-03: 後攻の1ターン目はスタートフェイズから始まりドローする（出典: atwiki/page-264「１ターン目のみ」）", () => {
    let state = createGame({ player1Deck: deck, player2Deck: deck, firstPlayer: "player1" });
    state = endTurn(state);
    expect(state.activePlayer).toBe("player2");
    expect(state.phase).toBe("start");
    expect(hasLegal(state, "draw", "player2")).toBe(true);
    state = doStartSteps(state, ["draw"]);
    expect(state.players.player2.hand).toHaveLength(8);
  });
});

describe("R-TURN-04 「このターン」の期間", () => {
  // 「ターンエンドと宣言するまでです」(faq-index「ターン」)
  it("R-TURN-04: 自軍ユニットに付いた「このターン」のBP修正はバトルフェイズ中も続き、ターン終了で切れる（出典: grnrngr/faq-index「ターン」, atwiki/page-588 Q1）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const op = inst("RS-025", "gao");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { hand: [op], power: cards("p", 2), command: [released("TST-OP", "c1")], rush: [unit] },
    });
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: op.instanceId,
      targetInstanceId: unit.instanceId,
    });
    state = settle(act(state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c1"] }));
    state = act(state, { type: "end_phase", playerId: "player1" });
    expect(state.phase).toBe("battle");
    expect(state.players.player1.rush[0]?.bpModifier).toBe(4000);
    state = endTurn(state);
    expect(state.players.player1.rush[0]?.bpModifier ?? 0).toBe(0);
  });

  // 「どちらのプレイヤーのカードに付いた効果でも同じ」(03-turn R-TURN-04)
  it("R-TURN-04: 敵軍ユニットに付いた「このターン」のBP・SP修正もターン終了で切れる（出典: atwiki/page-588 Q1）", () => {
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player2: { battle: [{ ...inst("TST-UNIT-2", "e1"), bpModifier: -2000, spModifier: 1 }] },
    });
    const next = endTurn(state);
    const unit = next.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-2:e1")
      ?? next.players.player2.battle.find((c) => c.instanceId === "TST-UNIT-2:e1");
    expect(unit?.bpModifier ?? 0).toBe(0);
    expect(unit?.spModifier ?? 0).toBe(0);
  });

  // 「その効果が発動した以降のターン中にのみ適用される」(faq-card-2 RS-107 Q1)
  it("R-TURN-04: ディースナイパー発動前に相手がカウンターでホールドしていたコマンドは捨札にならない（出典: grnrngr/faq-card-2 RS-107 Q1）", () => {
    const blue = inst("RS-107", "blue");
    const enemyHeld = held("RS-026", "e-held");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { rush: [blue], battle: [inst("TST-UNIT-0", "f0")] },
      player2: { command: [enemyHeld] },
    });
    state = settle(act(state, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId }));
    expect(state.players.player2.command.map((c) => c.instanceId)).toContain(enemyHeld.instanceId);
    expect(state.players.player2.discard.map((c) => c.instanceId)).not.toContain(enemyHeld.instanceId);
  });

  // 「継続して有効になりますか？」「はい」(faq-card-2 RS-107 Q2)
  it("R-TURN-04: ディースナイパー発動後は、デカブルーが場を離れても相手がカウンターのためにホールドしたコマンドは捨札になる（出典: grnrngr/faq-card-2 RS-107 Q2）", () => {
    const blue = inst("RS-107", "blue");
    const guts = inst("RS-027", "guts");
    const victim = inst("TST-UNIT-2", "victim");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { rush: [blue], battle: [inst("TST-UNIT-0", "f0")] },
      player2: {
        battle: [victim],
        hand: [guts],
        deck: cards("d", 5),
        command: [released("TST-OP", "pay")],
      },
    });
    state = settle(act(state, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId }));
    // デカブルーが場を離れた後
    state = {
      ...state,
      players: {
        ...state.players,
        player1: {
          ...state.players.player1,
          battle: state.players.player1.battle.filter((c) => c.instanceId !== blue.instanceId),
          discard: [...state.players.player1.discard, blue],
        },
      },
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: victim.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: victim.cardId,
        phasePlayerId: "player1",
      },
    };
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "category_use",
      sourceInstanceId: guts.instanceId,
    });
    state = act(state, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:pay"] });
    expect(state.players.player2.discard.map((c) => c.instanceId)).toContain("TST-OP:pay");
  });

  // 「このターン」の修正はターン終了で消える（faq-index「ターン」）
  it("R-TURN-04: 相手プレイヤーに付いた「このターン」のルール修正（ディースナイパー）もターン終了で消える（出典: grnrngr/faq-index「ターン」, atwiki/page-588 Q1）", () => {
    const blue = inst("RS-107", "blue");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { rush: [blue], battle: [inst("TST-UNIT-0", "f0")] },
    });
    state = settle(act(state, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId }));
    expect(state.players.player2.modifiers ?? []).toContainEqual(
      expect.objectContaining({ ruleId: "deace_sniper" }),
    );
    state = endTurn(state);
    expect(state.players.player2.modifiers ?? []).not.toContainEqual(
      expect.objectContaining({ ruleId: "deace_sniper" }),
    );
  });

  it.todo(
    "R-TURN-04: バルパンサー（2nd）のパンサークローは発動前にホールド状態で置かれたユニットカードには及ばない（出典: grnrngr/faq-card-6 RS-363 Q1）— RS-363 のNC効果がエンジン未実装で組み立てられない",
  );
});

describe("R-TURN-05 ターンプレイヤー", () => {
  // 「同時のタイミングに起こった処理の順番を決める権利がある」(atwiki/page-588)
  it("R-TURN-05: 同時に開いた反応（撃破とストライク）の解決順はターンプレイヤーが選ぶ（出典: atwiki/page-588, atwiki/page-2167）", () => {
    for (const turnPlayer of ["player1", "player2"] as const) {
      const other = turnPlayer === "player1" ? "player2" : "player1";
      const state = createTestState({
        phase: "battle",
        activePlayer: turnPlayer,
        pendingLeave: {
          ownerPlayerId: other,
          instanceId: "u1",
          fromZone: "battle",
          toZone: "discard",
          leavingCardId: "TST-UNIT-0",
          phasePlayerId: turnPlayer,
        },
        pendingStrike: {
          strikerPlayerId: turnPlayer,
          strikerInstanceId: "s1",
          damage: 1,
          battlePhasePlayer: turnPlayer,
        },
      });
      const synced = withSyncedEffectStack(state);
      expect(synced.pendingEffectChoice?.kind).toBe("simultaneous_order");
      expect(synced.pendingEffectChoice?.playerId).toBe(turnPlayer);
    }
  });

  it.todo(
    "R-TURN-05: 止められない無限ループ（RS-363 パンサークロー×RS-238 プロジェットカノン）ではターンプレイヤーが優先する効果を選ぶ（出典: grnrngr/faq-card-6 RS-363 Q2, atwiki/page-2167）— 両カードの効果がエンジン未実装",
  );
});

// ---------------------------------------------------------------------------
// 2. スタートフェイズ
// ---------------------------------------------------------------------------

describe("R-START-01 3つの行程", () => {
  const orders: Array<Array<"release" | "return" | "draw">> = [
    ["release", "return", "draw"],
    ["release", "draw", "return"],
    ["return", "release", "draw"],
    ["return", "draw", "release"],
    ["draw", "release", "return"],
    ["draw", "return", "release"],
  ];

  for (const order of orders) {
    // 「次の３つの行程を好きな順に必ず行う」(atwiki/page-264)
    it(`R-START-01: ${order.join("→")} の順でも3行程を終えてチャージフェイズへ進む（出典: atwiki/page-264, grnrngr/rule_phase1-2）`, () => {
      let state = startOfPlayer2Turn({
        deck: cards("d", 3),
        hand: [],
        command: [held("TST-OP", "c1"), held("TST-OP", "c2")],
        battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-2", "b2")],
      });
      state = doStartSteps(state, order);
      const p2 = state.players.player2;
      expect(state.phase).toBe("charge");
      expect(p2.command.every((c) => !c.commandHeld)).toBe(true);
      expect(p2.battle).toHaveLength(0);
      expect(p2.rush.map((c) => c.instanceId).sort()).toEqual(["TST-UNIT-0:b1", "TST-UNIT-2:b2"]);
      expect(p2.hand).toHaveLength(1);
      expect(p2.deck).toHaveLength(2);
    });
  }

  // 「必ず行う」(atwiki/page-264)
  it("R-START-01: 3行程を終えるまではスタートフェイズを終えられない（出典: atwiki/page-264「必ず行う」）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      command: [held("TST-OP", "c1")],
      battle: [inst("TST-UNIT-0", "b1")],
    });
    expect(hasLegal(state, "end_phase", "player2")).toBe(false);
    expect(applyAction(state, { type: "end_phase", playerId: "player2" }).ok).toBe(false);
    state = doStartSteps(state, ["release", "draw"]);
    expect(state.phase).toBe("start");
    expect(hasLegal(state, "end_phase", "player2")).toBe(false);
    expect(applyAction(state, { type: "end_phase", playerId: "player2" }).ok).toBe(false);
  });

  // 「ホールド状態の自軍コマンドをリリースする」(atwiki/page-264)
  it("R-START-01: リリースされるのは自軍コマンドのみで、相手のホールド中コマンドはリリースされない（出典: atwiki/page-264「自軍コマンドをリリース」）", () => {
    let state = startOfPlayer2Turn(
      { deck: cards("d", 3), command: [held("TST-OP", "c1")] },
      { player1: { command: [held("TST-OP", "p1c")] } },
    );
    state = doStartSteps(state, ["release", "return", "draw"]);
    expect(state.players.player2.command[0]?.commandHeld).toBe(false);
    expect(state.players.player1.command[0]?.commandHeld).toBe(true);
  });

  // 「ホールド状態のユニットはスタートフェイズになってもリリースされず」(atwiki/page-157)
  it("R-START-01: ラッシュエリアのホールド状態のユニットはリリースされない（出典: atwiki/page-157, page-158。ユーザー決定: リリースはコマンドのみ）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      command: [held("TST-OP", "c1")],
      rush: [{ ...inst("TST-UNIT-2", "hu"), commandHeld: true }],
    });
    state = doStartSteps(state, ["release", "return", "draw"]);
    expect(state.phase).toBe("charge");
    expect(state.players.player2.command[0]?.commandHeld).toBe(false);
    expect(state.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-2:hu")?.commandHeld).toBe(true);
  });

  // 「ライドされていなくても…はい、戻します」(atwiki/page-141 Q9)
  it("R-START-01: バトルエリアのライドされていないビークルもラッシュエリアに戻す（出典: atwiki/page-141 Q9）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      battle: [inst("TST-VEHICLE", "v1")],
    });
    state = doStartSteps(state, ["return", "release", "draw"]);
    expect(state.players.player2.battle).toHaveLength(0);
    expect(state.players.player2.rush.map((c) => c.instanceId)).toContain("TST-VEHICLE:v1");
  });

  // 「任意の順番で戻すことができます」(faq-index / atwiki/page-457 Q1)
  it("R-START-01: バトルエリアの複数ユニットを1体ずつ任意の順で戻せる（出典: grnrngr/faq-index, atwiki/page-457 Q1）", () => {
    const state = startOfPlayer2Turn({
      deck: cards("d", 3),
      battle: [inst("TST-UNIT-0", "b1"), inst("TST-UNIT-2", "b2")],
    });
    const returns = legal(state, "player2").filter((a) => a.type === "return_all_battle_to_rush");
    // 2体それぞれを先に戻す選択肢（戻すユニットを指定できる行動）が必要
    const perUnit = returns.filter((a) => "instanceId" in a);
    expect(perUnit.length).toBeGreaterThanOrEqual(2);
  });

  // 「はい、できます」(faq-card-3 RS-135)
  it("R-START-01: ジェットファルコンを先に戻して効果を解決し、ハリケンレオンがバトルエリアに残る間に敵軍ユニットを引き出せば、相手はコマンドをホールドする（出典: grnrngr/faq-card-3 RS-135）", () => {
    const falcon = inst("RS-135", "falcon");
    const leon = inst("RS-097", "leon");
    const enemy = inst("TST-UNIT-0", "enemy"); // SP1
    let state = startOfPlayer2Turn(
      { deck: cards("d", 3), battle: [falcon, leon] },
      { player1: { rush: [enemy], command: [released("TST-OP", "e1")] } },
    );
    state = act(state, { type: "return_all_battle_to_rush", playerId: "player2" });
    const choice = state.pendingEffectChoice;
    expect(choice?.effectId).toBe("falcon_claw");
    const pick = legal(state, "player2").find(
      (a) => a.type === "resolve_effect_choice" && (a as { instanceId?: string }).instanceId === enemy.instanceId,
    );
    expect(pick).toBeDefined();
    state = act(state, pick!);
    expect(state.players.player1.battle.map((c) => c.instanceId)).toContain(enemy.instanceId);
    expect(state.players.player1.command[0]?.commandHeld).toBe(true);
  });
});

describe("R-START-02 戻すことはラッシュではない", () => {
  // 「戻すのはラッシュでは無い」(atwiki/page-146)
  it("R-START-02: 戻したユニットに対して「ラッシュされたとき」のカウンター（疾風流超忍法）は発動できない（出典: atwiki/page-146）", () => {
    let state = startOfPlayer2Turn(
      { deck: cards("d", 3), battle: [inst("TST-UNIT-2", "b1")] },
      {
        player1: {
          hand: [inst("RS-026", "ninpo")],
          power: cards("p", 5),
          command: [released("TST-OP-MA", "ma1")],
        },
      },
    );
    state = act(state, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(state.pendingRush).toBeUndefined();
    expect(
      getLegalActions(state).some(
        (a) => a.playerId === "player1" && (a as { sourceInstanceId?: string }).sourceInstanceId === "RS-026:ninpo",
      ),
    ).toBe(false);
    expect(state.players.player2.rush.map((c) => c.instanceId)).toContain("TST-UNIT-2:b1");
  });

  // 「ライドしたままの状態になります」(atwiki/page-141 Q1)
  it("R-START-02: ライドしているユニットはラッシュエリアに戻ってもライドしたまま（出典: atwiki/page-141 Q1）", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = { ...inst("TST-RIDER", "r1"), mountedOnInstanceId: vehicle.instanceId };
    let state = startOfPlayer2Turn({ deck: cards("d", 3), battle: [vehicle, rider] });
    state = act(state, { type: "return_all_battle_to_rush", playerId: "player2" });
    const back = state.players.player2.rush.find((c) => c.instanceId === rider.instanceId);
    expect(back?.mountedOnInstanceId).toBe(vehicle.instanceId);
    expect(state.players.player2.rush.map((c) => c.instanceId)).toContain(vehicle.instanceId);
  });

  // 「いいえ、できません」(faq/rider ライドオフ)
  it("R-START-02: スタートフェイズに戻すときライドオフはできない（出典: grnrngr/faq/rider「ライドオフ」Q1）", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = { ...inst("TST-RIDER", "r1"), mountedOnInstanceId: vehicle.instanceId };
    let state = startOfPlayer2Turn({ deck: cards("d", 3), battle: [vehicle, rider] });
    state = act(state, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(hasLegal(state, "resolve_ride_off_choice", "player2")).toBe(false);
    state = doStartSteps(state, ["draw"]);
    expect(state.phase).toBe("charge");
    expect(
      state.players.player2.rush.find((c) => c.instanceId === rider.instanceId)?.mountedOnInstanceId,
    ).toBe(vehicle.instanceId);
  });

  // 「ホールド状態も消えない」(03-turn R-START-02 / R-ZONE-04)
  it("R-START-02: バトルエリアのホールド状態のユニット（レジストで留まったもの）は戻してもホールドのまま（出典: atwiki/page-157, atwiki/page-1512）", () => {
    // 既知の不具合: 未登録（prepareRegisterUnitReturnedToRush がラッシュエリアへ戻す際にホールドを解除する）
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      battle: [{ ...inst("TST-UNIT-2", "res"), commandHeld: true, registerHeld: true }],
    });
    state = act(state, { type: "return_all_battle_to_rush", playerId: "player2" });
    expect(state.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-2:res")?.commandHeld).toBe(true);
  });

  // 「ホールド状態のユニットは…リリースされず」(atwiki/page-157)
  it("R-START-02: ホールド状態のユニットをバトルエリアから戻してもホールドのまま（効果由来のホールド）（出典: atwiki/page-157）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      battle: [{ ...inst("TST-UNIT-2", "hu"), commandHeld: true }],
    });
    state = doStartSteps(state, ["return", "release", "draw"]);
    expect(state.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-2:hu")?.commandHeld).toBe(true);
  });
});

describe("R-START-03 追加ドロー", () => {
  // 「ドローしたあとで…少ないときは、追加でもう１枚ドローできる」(rule_phase1-2)
  it("R-START-03: 通常ドロー後に手札がダメージ未満なら追加ドローでき、引くと手札+1（出典: grnrngr/rule_phase1-2）", () => {
    let state = startOfPlayer2Turn({ damage: 3, deck: cards("d", 5), hand: [] });
    state = doStartSteps(state, ["draw"]);
    expect(state.players.player2.hand).toHaveLength(1);
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(true);
    state = act(state, { type: "bonus_draw", playerId: "player2" });
    expect(state.players.player2.hand).toHaveLength(2);
    expect(state.phase).toBe("charge");
  });

  // 「二度目のドローに関しては強制ではない」(atwiki/page-264)
  it("R-START-03: 追加ドローは任意で、引かずにチャージフェイズへ進める（出典: atwiki/page-264）", () => {
    let state = startOfPlayer2Turn({ damage: 3, deck: cards("d", 5), hand: [] });
    state = doStartSteps(state, ["draw"]);
    expect(hasLegal(state, "skip_bonus_draw", "player2")).toBe(true);
    state = act(state, { type: "skip_bonus_draw", playerId: "player2" });
    expect(state.phase).toBe("charge");
    expect(state.players.player2.hand).toHaveLength(1);
  });

  // 「ドローしたカードを手札と合わせて…未満ならば」(atwiki/page-264)
  it("R-START-03: 判定は通常ドロー後の手札で行い、引いたカードを含めてダメージと同数なら追加ドローできない（出典: atwiki/page-264, grnrngr/rule_phase1-2）", () => {
    // ドロー前は 2 < 3 だが、ドロー後は 3 = 3
    let state = startOfPlayer2Turn({ damage: 3, deck: cards("d", 5), hand: cards("h", 2) });
    state = doStartSteps(state, ["draw"]);
    expect(state.players.player2.hand).toHaveLength(3);
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(false);
    expect(state.phase).toBe("charge");
  });

  // 「ドローしたあとで」(rule_phase1-2)
  it("R-START-03: 通常ドローより前には追加ドローできない（出典: grnrngr/rule_phase1-2「ドローしたあとで」）", () => {
    const state = startOfPlayer2Turn({ damage: 5, deck: cards("d", 5), hand: [] });
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(false);
    expect(applyAction(state, { type: "bonus_draw", playerId: "player2" }, { trustLegality: true }).ok).toBe(false);
  });

  // 「追加ドローは１ターンに１度だけです」(faq-index / atwiki/page-123 Q1)
  it("R-START-03: 追加ドローは1ターンに1度だけで、手札がまだダメージ未満でも2回目はない（出典: grnrngr/faq-index「追加ドロー」, atwiki/page-123 Q1）", () => {
    let state = startOfPlayer2Turn({ damage: 6, deck: cards("d", 6), hand: [] });
    state = doStartSteps(state, ["draw"]);
    state = act(state, { type: "bonus_draw", playerId: "player2" });
    expect(state.players.player2.hand).toHaveLength(2);
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(false);
    expect(applyAction(state, { type: "bonus_draw", playerId: "player2" }, { trustLegality: true }).ok).toBe(false);
    expect(state.players.player2.hand).toHaveLength(2);
  });

  // 「追加ドローは１ターンに１度だけです」(faq-index)
  it("R-START-03: 追加ドロー前に他の行程を残していても、追加ドロー後に再度追加ドローはできない（出典: atwiki/page-123 Q1）", () => {
    let state = startOfPlayer2Turn({
      damage: 6,
      deck: cards("d", 6),
      hand: [],
      command: [held("TST-OP", "c1")],
      battle: [inst("TST-UNIT-0", "b1")],
    });
    state = doStartSteps(state, ["draw"]);
    state = act(state, { type: "bonus_draw", playerId: "player2" });
    state = doStartSteps(state, ["release"]);
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(false);
    state = doStartSteps(state, ["return"]);
    expect(state.phase).toBe("charge");
    expect(state.players.player2.hand).toHaveLength(2);
  });

  // 「（１ターンに１回まで）」(rule_phase1-2)
  it("R-START-03: チャージフェイズ以降は追加ドローできない（出典: grnrngr/rule_phase1-2）", () => {
    const state = createTestState({
      phase: "charge",
      player1: { damage: 5, deck: cards("d", 5), hand: [], hasDrawnThisStart: true },
    });
    expect(hasLegal(state, "bonus_draw", "player1")).toBe(false);
    expect(applyAction(state, { type: "bonus_draw", playerId: "player1" }, { trustLegality: true }).ok).toBe(false);
  });

  it.todo(
    "R-START-03: [未確定] 追加ドローは通常ドローの直後に限るか、リリース・戻しの行程を挟んでから行ってよいか（atwiki/page-264「続けて」。02-D10）",
  );
});

describe("R-START-04 ドローの定義", () => {
  // 「はい、発動します」(faq-card-1 RS-008 Q1)
  it("R-START-04: 超電子頭脳はスタートフェイズの通常ドローに適用される（2枚ひいて1枚手札・1枚捨札）（出典: grnrngr/faq-card-1 RS-008 Q1）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 5),
      hand: [],
      operation: [inst("RS-008", "brain")],
    });
    state = doStartSteps(state, ["draw"]);
    state = settle(state);
    expect(state.players.player2.hand).toHaveLength(1);
    expect(state.players.player2.discard).toHaveLength(1);
    expect(state.players.player2.deck).toHaveLength(3);
  });

  // 「追加ドローのときにも発動しますか？」「はい」(faq-card-1 RS-008 Q1)
  it("R-START-04: 超電子頭脳は追加ドローにも適用される（出典: grnrngr/faq-card-1 RS-008 Q1）", () => {
    let state = startOfPlayer2Turn({
      damage: 5,
      deck: cards("d", 6),
      hand: [],
      operation: [inst("RS-008", "brain")],
    });
    state = doStartSteps(state, ["draw"]);
    expect(hasLegal(state, "bonus_draw", "player2")).toBe(true);
    state = settle(act(state, { type: "bonus_draw", playerId: "player2" }));
    expect(state.players.player2.hand).toHaveLength(2);
    expect(state.players.player2.discard).toHaveLength(2);
    expect(state.players.player2.deck).toHaveLength(2);
  });

  // 「マジブルーの効果でドローするときや…発動します」(faq-card-1 RS-008 Q1)
  it("R-START-04: 超電子頭脳はマジブルー【未来予知】（NC）の効果ドローにも適用される（出典: grnrngr/faq-card-1 RS-008 Q1）", () => {
    const blue = inst("RS-059", "blue"); // ナンバー2
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: {
        rush: [blue],
        battle: [inst("TST-UNIT-0", "f0")],
        deck: cards("d", 5),
        hand: [],
        operation: [inst("RS-008", "brain")],
      },
    });
    state = settle(act(state, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId }));
    expect(state.log.some((l) => l.includes("future_sight") || l.includes("未来予知"))).toBe(true);
    expect(state.players.player1.hand).toHaveLength(1);
    expect(state.players.player1.discard).toHaveLength(1);
    expect(state.players.player1.deck).toHaveLength(3);
  });

  // 「「カードをひく」だけでは発動しません」(faq-card-1 RS-008 Q2)
  it("R-START-04: ダイノガッツで山札からひいて捨てるのはドローではなく、超電子頭脳は適用されない（出典: grnrngr/faq-card-1 RS-008 Q2）", () => {
    const guts = inst("RS-027", "guts");
    const victim = inst("TST-UNIT-2", "victim"); // 必要パワー2
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: victim.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: victim.cardId,
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [victim],
        hand: [guts],
        deck: cards("d", 6),
        command: [released("TST-OP", "pay")],
        operation: [inst("RS-008", "brain")],
      },
    });
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "category_use",
      sourceInstanceId: guts.instanceId,
    });
    state = settle(act(state, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:pay"] }));
    const p2 = state.players.player2;
    expect(p2.battle.map((c) => c.instanceId)).toContain(victim.instanceId);
    expect(p2.deck).toHaveLength(4);
    expect(p2.hand).toHaveLength(0);
    expect(p2.discard.filter((c) => c.instanceId.startsWith("TST-OP:d"))).toHaveLength(2);
  });

  // 「「上からひく」かわりに「下からひく」ことができます」(faq-card-2 RS-122)
  it("R-START-04: ゴーゴーマリンがラッシュエリアにあれば、スタートフェイズのドローで山札の下からひける（出典: grnrngr/faq-card-2 RS-122）", () => {
    const deck = [inst("TST-OP", "top"), inst("TST-OP", "mid"), inst("TST-OP", "bottom")];
    let state = startOfPlayer2Turn({ deck, hand: [], rush: [inst("RS-122", "marine")] });
    state = act(state, { type: "draw", playerId: "player2" });
    const bottomChoice = legal(state, "player2").find(
      (a) => a.type === "resolve_seabed_draw" && (a as { placement?: string }).placement === "bottom",
    );
    expect(bottomChoice).toBeDefined();
    state = settle(act(state, bottomChoice!));
    expect(state.players.player2.hand.map((c) => c.instanceId)).toEqual(["TST-OP:bottom"]);
  });

  // 「カードを「ひく」とき以外には発動できません」(faq-card-2 RS-122)
  it("R-START-04: 山札の上をオモテにする効果（ジャッジメント）はひく操作ではなく、ゴーゴーマリンの「下から」は選べない（出典: grnrngr/faq-card-2 RS-122）", () => {
    const judgment = inst("RS-028", "judg");
    const target = inst("TST-UNIT-0", "t1");
    const deckTop = inst("TST-UNIT-0", "deck-s");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: {
        hand: [judgment],
        power: cards("p", 5),
        command: [held("RS-020", "c1")],
        rush: [inst("RS-122", "marine")],
        deck: [deckTop, inst("TST-OP", "d2"), inst("TST-OP", "bottom")],
      },
      player2: { battle: [target] },
    });
    const play = legal(state, "player1").find(
      (a) => a.type === "play_operation" && a.instanceId === judgment.instanceId && a.targetInstanceId === target.instanceId,
    );
    expect(play).toBeDefined();
    state = act(state, play!);
    expect(state.pendingEffectChoice?.kind).not.toBe("seabed_draw");
    expect(hasLegal(state, "resolve_seabed_draw", "player1")).toBe(false);
    expect(state.players.player1.hand.map((c) => c.instanceId)).not.toContain("TST-OP:bottom");
  });

  it.todo(
    "R-START-04: 山札から直接捨てる・オモテにする・サーチは「ドロー」ではなく「ドローするとき」の効果を誘発しない（出典: atwiki/page-123）— 該当する山札操作カードと超電子頭脳の組合せを個別カード単位で検証する必要があり、本章では未作成",
  );
});

describe("R-START-05 引けなければ敗北", () => {
  // 「山札が無くドローできないときは、ゲームに負けてしまいます」(rule_phase1-2)
  it("R-START-05: スタートフェイズに山札が0枚でドローできなければ負ける（出典: grnrngr/rule_phase1-2, atwiki/page-123）", () => {
    let state = startOfPlayer2Turn({ deck: [], hand: cards("h", 3) });
    state = applyAction(state, { type: "draw", playerId: "player2" }).ok
      ? unwrap(applyAction(state, { type: "draw", playerId: "player2" }))
      : state;
    expect(state.winner).toBe("player1");
  });

  // 「カードをひくべきときにひけなかった場合はゲームに負けてしまいます」(faq-card-1 RS-027)
  it("R-START-05: ダイノガッツでひくべき枚数をひけなければ負ける（出典: grnrngr/faq-card-1 RS-027 Q4）", () => {
    // 既知の不具合: E2（効果で山札からひけなくても敗北しない。ダイノガッツは山札不足でも途中で止まるだけ）
    const guts = inst("RS-027", "guts");
    const victim = inst("TST-UNIT-2", "victim"); // 必要パワー2
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: victim.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: victim.cardId,
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")], deck: cards("p1d", 5) },
      player2: {
        battle: [victim],
        hand: [guts],
        deck: cards("d", 1),
        command: [released("TST-OP", "pay")],
      },
    });
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "category_use",
      sourceInstanceId: guts.instanceId,
    });
    state = settle(act(state, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: ["TST-OP:pay"] }));
    expect(state.winner).toBe("player1");
  });

  // 「ドローすべき時にカードが引けなければ負けとなる」(atwiki/page-123)
  it("R-START-05: 効果によるドロー（マジブルー【未来予知】）で山札が0枚なら負ける（出典: atwiki/page-123）", () => {
    const blue = inst("RS-059", "blue"); // ナンバー2
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { rush: [blue], battle: [inst("TST-UNIT-0", "f0")], deck: [], hand: [] },
      player2: { deck: cards("p2d", 5) },
    });
    state = settle(act(state, { type: "move_to_battle", playerId: "player1", instanceId: blue.instanceId }));
    expect(state.log.some((l) => l.includes("future_sight") || l.includes("未来予知"))).toBe(true);
    expect(state.winner).toBe("player2");
  });
});

describe("R-START-06 「フェイズ開始時」の効果", () => {
  // 「ドローした後でもかまいません」(faq-card-5 RS-256)
  it.todo(
    "R-START-06: 闇の戒律の「自軍スタートフェイズごとに」の選択はドロー後に行ってよい（出典: grnrngr/faq-card-5 RS-256）— RS-256 闇の戒律の効果がエンジン未実装（unnamed_resident）",
  );

  // 「「毎ターン1回ずつ発動できる」と考えてください。」(faq-rider-2 RK-080)
  it("R-START-06: 「スタートフェイズを終えるとき、一度だけ」（超変身）は毎ターン1回ずつ発動できる — 前のターンに重ねていても、次のスタートフェイズを終えるときにまた手札から重ねられる（出典: grnrngr/faq-rider-2 RK-080）", () => {
    let state = startOfPlayer2Turn({
      deck: cards("d", 5),
      hand: [inst("RK-029", "h")],
      operation: [{ ...inst("RK-080", "op"), stackedCards: [inst("RK-102", "old")] }],
    });
    // 任意の選択を見送らないよう、settle を使わずにスタートフェイズを進める（settle は任意の選択を skip する）。
    for (let i = 0; i < 8 && !state.pendingEffectChoice && state.phase === "start"; i++) {
      const acts = legal(state);
      const a = ["release_start_commands", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "end_phase"]
        .map((t) => acts.find((x) => x.type === t))
        .find(Boolean);
      if (!a) break;
      state = act(state, a);
    }
    expect(state.pendingEffectChoice?.sourceCardId).toBe("RK-080");
    expect(state.pendingEffectChoice?.validInstanceIds).toEqual(["RK-029:h"]);
  });

  /** 敵軍（player1）バトルエリアにブランウイングを置き、player2 のスタートフェイズを heldCount 個のホールド状態のコマンドで始めてチャージフェイズまで進める（ホールドの選択は先頭で解決）。 */
  const brandWingStart = (wings: number, heldCount: number): GameState => {
    let state = startOfPlayer2Turn(
      { deck: cards("d", 5), command: Array.from({ length: heldCount }, (_, i) => held("TST-OP", `h${i}`)) },
      { player1: { deck: cards("p1d", 5), battle: Array.from({ length: wings }, (_, i) => inst("RK-042", `w${i}`)) } },
    );
    state = doStartSteps(state, ["release", "return", "draw"]);
    for (let i = 0; i < 10 && !(state.phase === "charge" && !state.pendingEffectChoice); i++) {
      const p = state.pendingEffectChoice;
      if (p) {
        state = settle(act(state, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: p.validInstanceIds[0]! }));
        continue;
      }
      const a = legal(state).find((x) => x.type === "skip_bonus_draw") ?? legal(state).find((x) => x.type === "end_phase");
      if (!a) break;
      state = settle(act(state, a));
    }
    expect(state.phase).toBe("charge");
    return state;
  };
  const heldNow = (state: GameState) => state.players.player2.command.filter((c) => c.commandHeld).length;

  // 「はい、その通りです。「RK-042　ブランウィング」の効果は重複します。」(faq-rider-1 RK-042 Q1)
  it("R-START-06: ブランウイング2体なら、相手がスタートフェイズに2つ以上リリースしたとき、スタートフェイズを終えるときにコマンドを2つホールドする（出典: grnrngr/faq-rider-1 RK-042 Q1）", () => {
    expect(heldNow(brandWingStart(2, 2))).toBe(2);
  });

  // 「いいえ、ホールドするコマンドは1つです。…「RK-042 ブランウイング」1体につき1つになります。」(faq-rider-1 RK-042 Q2)
  it("R-START-06: ブランウイング1体なら、相手が4つリリースしてもホールドするのは1つ（出典: grnrngr/faq-rider-1 RK-042 Q2）", () => {
    expect(heldNow(brandWingStart(1, 4))).toBe(1);
  });

  // 「ターン開始時」の効果はホールド中のコマンドの有無に関係なく発動する
  it("R-START-06: ゲゲル（重ね10枚以上）のターン開始時の効果は、ホールド中の自軍コマンドがなくても発動する（出典: atwiki/page-1828）", () => {
    // 既知の不具合: E17（ホールド中のコマンドがないと発動しない）
    const gegeru = { ...inst("RK-081", "gegeru"), stackedCards: cards("st", 10) };
    let state = startOfPlayer2Turn({
      deck: cards("d", 3),
      command: [],
      rush: [inst("TST-UNIT-0", "u1")],
      operation: [gegeru],
    });
    state = doStartSteps(state, ["release", "return", "draw"]);
    const unit = state.players.player2.rush.find((c) => c.instanceId === "TST-UNIT-0:u1");
    expect(unit?.activatedNcEffects ?? []).toContain("gegeru_sp1");
  });

  it.todo(
    "R-START-06: [未確定] 「ターン開始時」と書かれたカード（ゲゲル、XG4 の入れ替え等）が「スタートフェイズ開始時」と同じく3行程より前に処理されるか",
  );
});

// ---------------------------------------------------------------------------
// 3. チャージフェイズ
// ---------------------------------------------------------------------------

describe("R-CHARGE-01 1枚チャージ", () => {
  // 「パワーゾーンかコマンドゾーンのどちらかにおいて」(rule_phase1-2)
  it("R-CHARGE-01: 手札1枚をパワーゾーンに置ける（出典: grnrngr/rule_phase1-2）", () => {
    const card = inst("TST-UNIT-2", "h1");
    const state = createTestState({ phase: "charge", player1: { hand: [card, inst("TST-OP", "h2")] } });
    const next = act(state, { type: "charge_power", playerId: "player1", instanceId: card.instanceId });
    expect(next.players.player1.power.map((c) => c.instanceId)).toEqual([card.instanceId]);
    expect(next.players.player1.hand).toHaveLength(1);
  });

  // 「パワーゾーンかコマンドゾーンのどちらかにおいて」(rule_phase1-2)
  it("R-CHARGE-01: 手札1枚をコマンドゾーンに置ける（出典: grnrngr/rule_phase1-2, atwiki/page-145）", () => {
    const card = inst("TST-UNIT-2", "h1");
    const state = createTestState({ phase: "charge", player1: { hand: [card] } });
    const next = act(state, { type: "charge_command", playerId: "player1", instanceId: card.instanceId });
    expect(next.players.player1.command.map((c) => c.instanceId)).toEqual([card.instanceId]);
    expect(next.players.player1.hand).toHaveLength(0);
  });

  // 「１ターンに１枚だけです」(rule_phase1-2)
  it("R-CHARGE-01: 1ターンに置けるのは1枚だけで、2枚目は置けない（出典: grnrngr/rule_phase1-2, atwiki/page-145）", () => {
    const state = createTestState({
      phase: "charge",
      player1: { hand: [inst("TST-OP", "h1"), inst("TST-OP", "h2")] },
    });
    const next = act(state, { type: "charge_power", playerId: "player1", instanceId: "TST-OP:h1" });
    expect(hasLegal(next, "charge_power", "player1")).toBe(false);
    expect(hasLegal(next, "charge_command", "player1")).toBe(false);
    for (const type of ["charge_power", "charge_command"] as const) {
      expect(
        applyAction(next, { type, playerId: "player1", instanceId: "TST-OP:h2" }, { trustLegality: true }).ok,
      ).toBe(false);
    }
    // チャージフェイズのまま2枚目を試みても不可
    const stillCharge = { ...next, phase: "charge" as const };
    expect(
      applyAction(stillCharge, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h2" }, { trustLegality: true }).ok,
    ).toBe(false);
  });

  // 「しなくても構いません」(rule_phase1-2)
  it("R-CHARGE-01: チャージせずに手札を維持してラッシュフェイズへ進める（出典: grnrngr/rule_phase1-2, atwiki/page-145）", () => {
    const state = createTestState({ phase: "charge", player1: { hand: [inst("TST-OP", "h1")] } });
    expect(hasLegal(state, "end_phase", "player1")).toBe(true);
    const next = act(state, { type: "end_phase", playerId: "player1" });
    expect(next.phase).toBe("rush");
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.power).toHaveLength(0);
    expect(next.players.player1.command).toHaveLength(0);
  });

  // 「コマンドゾーンには５枚までカードを置くことができます」(rule_phase1-2)
  it("R-CHARGE-01: コマンドゾーンが5枚ならコマンドには置けないが、パワーには置ける（出典: grnrngr/rule_phase1-2）", () => {
    const state = createTestState({
      phase: "charge",
      player1: { hand: [inst("TST-OP", "h1")], command: cards("c", 5) },
    });
    expect(hasLegal(state, "charge_command", "player1")).toBe(false);
    expect(
      applyAction(state, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h1" }, { trustLegality: true }).ok,
    ).toBe(false);
    expect(hasLegal(state, "charge_power", "player1")).toBe(true);
  });

  // 「コマンドゾーンには５枚まで」(rule_phase1-2)
  it("R-CHARGE-01: コマンドゾーンが4枚なら5枚目として置ける（出典: grnrngr/rule_phase1-2）", () => {
    const state = createTestState({
      phase: "charge",
      player1: { hand: [inst("TST-OP", "h1")], command: cards("c", 4) },
    });
    const next = act(state, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h1" });
    expect(next.players.player1.command).toHaveLength(5);
  });

  // 「自分の手札からカードを１枚だけ選んで」(rule_phase1-2)
  it("R-CHARGE-01: 相手のチャージフェイズに非ターンプレイヤーはチャージできない（出典: grnrngr/rule_phase1-2「自分の手札から」）", () => {
    const state = createTestState({
      phase: "charge",
      activePlayer: "player1",
      player2: { hand: [inst("TST-OP", "h1")] },
    });
    expect(hasLegal(state, "charge_power", "player2")).toBe(false);
    expect(hasLegal(state, "charge_command", "player2")).toBe(false);
  });
});

describe("R-CHARGE-02 置くときの向き・状態", () => {
  // 「カードは必ずオモテ向きに置きます」(rule_phase1-2)
  it("R-CHARGE-02: パワーゾーンにはオモテ向きで置く（出典: grnrngr/rule_phase1-2）", () => {
    const state = createTestState({ phase: "charge", player1: { hand: [{ ...inst("TST-OP", "h1"), faceDown: true }] } });
    const next = act(state, { type: "charge_power", playerId: "player1", instanceId: "TST-OP:h1" });
    expect(next.players.player1.power[0]?.faceDown ?? false).toBe(false);
    expect(next.players.player1.damage).toBe(0);
  });

  // 「チャージフェイズにカードを置く時と同じように」(faq-index)
  it("R-CHARGE-02: コマンドゾーンにはオモテ向き・リリース状態で置く（出典: grnrngr/rule_phase1-2, grnrngr/faq-index「ゾードアップ」）", () => {
    const state = createTestState({ phase: "charge", player1: { hand: [{ ...inst("TST-OP", "h1"), commandHeld: true }] } });
    const next = act(state, { type: "charge_command", playerId: "player1", instanceId: "TST-OP:h1" });
    expect(next.players.player1.command[0]?.commandHeld ?? false).toBe(false);
    expect(next.players.player1.command[0]?.faceDown ?? false).toBe(false);
  });

  it.todo(
    "R-CHARGE-02: ゾードアップでコマンドゾーンへ送るSユニットはリリース状態で置く（出典: grnrngr/faq-index「ゾードアップ」）— 04章（ラッシュ／ゾードアップ）で検証する",
  );
});

// ---------------------------------------------------------------------------
// 4. ラッシュフェイズ
// ---------------------------------------------------------------------------

describe("R-RUSHPH-01 ラッシュフェイズの行動", () => {
  const setup = (phase: GameState["phase"]) =>
    createTestState({
      phase,
      activePlayer: "player1",
      definitions: allDefs([VEHICLE_DEF]),
      player1: {
        hand: [inst("TST-UNIT-0", "u1"), inst("TST-VEHICLE", "v1"), inst("RS-025", "gao"), inst("RS-030", "adv")],
        power: cards("p", 5),
        command: [
          released("TST-OP", "c1"),
          released("TST-OP", "c2"),
          released("TST-OP-ET", "c3"),
        ],
        rush: [inst("TST-UNIT-0", "r1")],
      },
    });
  const canUse = (state: GameState, id: string) =>
    legal(state, "player1").some(
      (a) =>
        ((a.type === "rush" || a.type === "play_operation") && a.instanceId === id) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === id),
    ) ||
    applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: id,
      targetInstanceId: "TST-UNIT-0:r1",
    }).ok;

  // 「ユニット、ビークルのラッシュとオペレーションの使用ができる」(atwiki/page-516)
  it("R-RUSHPH-01: ラッシュフェイズにユニット・ビークルのラッシュ、通常オペレーション、常駐の配置ができる（出典: atwiki/page-516, grnrngr/rule_phase3）", () => {
    const state = setup("rush");
    expect(canUse(state, "TST-UNIT-0:u1")).toBe(true);
    expect(canUse(state, "TST-VEHICLE:v1")).toBe(true);
    expect(canUse(state, "RS-025:gao")).toBe(true);
    expect(canUse(state, "RS-030:adv")).toBe(true);
  });

  // 「カウンター以外のオペレーションカードが使用できるのはラッシュフェイズのみ」(atwiki/page-1828)
  for (const phase of ["charge", "battle", "end"] as const) {
    it(`R-RUSHPH-01: ${phase} フェイズには手札からのラッシュ・通常オペレーション・常駐配置はできない（出典: atwiki/page-1828, atwiki/page-516）`, () => {
      const state = setup(phase);
      expect(canUse(state, "TST-UNIT-0:u1")).toBe(false);
      expect(canUse(state, "TST-VEHICLE:v1")).toBe(false);
      expect(canUse(state, "RS-025:gao")).toBe(false);
      expect(canUse(state, "RS-030:adv")).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// 5. バトルフェイズ
// ---------------------------------------------------------------------------

describe("R-BATTLEPH-01 バトルフェイズの行動", () => {
  // 「ユニットのバトルエリアへの移動、アタック及びストライクが行える」(atwiki/page-593)
  it("R-BATTLEPH-01: バトルフェイズにユニットをバトルエリアへ移動し、アタックかストライクを選べる（出典: atwiki/page-593, grnrngr/rule_phase4）", () => {
    const unit = inst("TST-UNIT-0", "u1"); // SP1
    const enemy = inst("TST-UNIT-0", "e1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [unit] },
      player2: { battle: [enemy] },
    });
    expect(hasLegal(state, "move_to_battle", "player1", (a) => (a as { instanceId?: string }).instanceId === unit.instanceId)).toBe(true);
    state = act(state, { type: "move_to_battle", playerId: "player1", instanceId: unit.instanceId });
    expect(state.players.player1.battle.map((c) => c.instanceId)).toContain(unit.instanceId);
    expect(
      hasLegal(state, "battle", "player1", (a) => (a as { attackerInstanceId?: string }).attackerInstanceId === unit.instanceId),
    ).toBe(true);
    expect(hasLegal(state, "strike", "player1", (a) => (a as { instanceId?: string }).instanceId === unit.instanceId)).toBe(true);
  });

  // 「「なにもしない」を選ぶこともできます」(atwiki/page-457 Q2)
  it("R-BATTLEPH-01: バトルエリアに出たユニットはアタックもストライクもせず「なにもしない」を選べる（出典: atwiki/page-457 Q2）", () => {
    const unit = inst("TST-UNIT-0", "u1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { rush: [unit] },
      player2: { battle: [inst("TST-UNIT-0", "e1")] },
    });
    state = act(state, { type: "move_to_battle", playerId: "player1", instanceId: unit.instanceId });
    if (state.pendingBattleEntry) {
      state = act(state, { type: "pass_battle_entry", playerId: "player1" });
    }
    expect(state.players.player2.damage).toBe(0);
    expect(state.players.player1.battle.map((c) => c.instanceId)).toContain(unit.instanceId);
    expect(hasLegal(state, "end_phase", "player1")).toBe(true);
  });

  // 「バトルフェイズ」でのみバトルエリアへ移動できる (atwiki/page-593)
  it("R-BATTLEPH-01: ラッシュフェイズにはユニットをバトルエリアへ移動できない（出典: atwiki/page-593, atwiki/page-516）", () => {
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [inst("TST-UNIT-0", "u1")] },
    });
    expect(hasLegal(state, "move_to_battle", "player1")).toBe(false);
    expect(hasLegal(state, "strike", "player1")).toBe(false);
    expect(hasLegal(state, "battle", "player1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. エンドフェイズ
// ---------------------------------------------------------------------------

describe("R-END-01 ターン終了", () => {
  // 「ターン終了を宣言する事で自分のターンを終え、相手のターンに移行する」(atwiki/page-155)
  it("R-END-01: エンドフェイズでターン終了を宣言すると相手のターンに移る（出典: atwiki/page-155）", () => {
    const state = createTestState({ phase: "battle", activePlayer: "player2", turn: 2 });
    const next = endTurn(state);
    expect(next.activePlayer).toBe("player1");
    expect(next.turn).toBe(3);
  });

  // 「手札に持てるカードの枚数に上限は…ありません」(faq-index / atwiki/page-122 Q1)
  it("R-END-01: 手札上限はなく、ターン終了時に手札を捨てる手順はない（出典: grnrngr/faq-index「手札」, atwiki/page-122 Q1）", () => {
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { hand: cards("h", 15) },
    });
    const next = endTurn(state);
    expect(next.activePlayer).toBe("player2");
    expect(next.players.player1.hand).toHaveLength(15);
    expect(next.players.player1.discard).toHaveLength(0);
  });

  // 「「ターンを終えるとき」はまだ自分のターンです」(faq-card-4 RS-238)
  it.todo(
    "R-END-01: アドベンチャーで自軍ターンを終えるときにコマンドが手札に戻っても、自軍ゴーゴーファイヤー（敵軍ターン中）の効果は適用されない（出典: grnrngr/faq-card-4 RS-238）— RS-238【プロジェットカノン】がエンジン未実装で否定側を検証できない",
  );

  // 「その時点ではまだターンは継続中」(faq-card-5 RS-310 Q1)
  it("R-END-01: ガオ・ソウルでBP8000になったゴウライビートルは、ターンを終えるとき（このターンの修正が残っている時点）に撃破される（出典: grnrngr/faq-card-5 RS-310 Q1）", () => {
    const beetle = inst("RS-310", "beetle"); // BP2000 + ダメージ合計2 → 4000、+4000 → 8000
    const gao = inst("RS-025", "gao");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: {
        hand: [gao],
        power: [...cards("p", 2), { ...inst("TST-OP", "dmg1"), faceDown: true }],
        damage: 1,
        command: [released("TST-OP", "c1")],
        rush: [beetle],
      },
      player2: { damage: 1, power: [{ ...inst("TST-OP", "dmg2"), faceDown: true }] },
    });
    state = act(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: gao.instanceId,
      targetInstanceId: beetle.instanceId,
    });
    state = settle(act(state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:c1"] }));
    expect(state.players.player1.rush.find((c) => c.instanceId === beetle.instanceId)?.bpModifier).toBe(4000);
    state = endTurn(state);
    const where = [...state.players.player1.rush, ...state.players.player1.battle].map((c) => c.instanceId);
    expect(where).not.toContain(beetle.instanceId);
    expect(state.players.player1.discard.map((c) => c.instanceId)).toContain(beetle.instanceId);
  });

  // 「「ターンを終えるとき」はまだ自分のターンです」(faq-card-4 RS-238)
  it("R-END-01: 「ターンを終えるとき」の効果（アドベンチャー）を処理している間は、まだターンを終えるプレイヤーのターンである（出典: grnrngr/faq-card-4 RS-238, grnrngr/faq-card-5 RS-310 Q1）", () => {
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      turn: 1,
      definitions: allDefs(),
      player1: { operation: [inst("RS-030", "adv1")], command: [held("TST-OP", "a")] },
    });
    for (let i = 0; i < 4 && !state.pendingEffectChoice; i += 1) {
      state = act(state, { type: "end_phase", playerId: "player1" });
    }
    expect(state.pendingEffectChoice?.effectId).toBe("adventure");
    expect(state.activePlayer).toBe("player1");
    expect(state.turn).toBe(1);
  });

  // 「ターン終了を宣言する事で…相手のターンに移行する」(atwiki/page-155)
  it("R-END-01: 「ターンを終えるとき」の効果を解決した後は相手のターンになる（出典: atwiki/page-155, atwiki/page-588）", () => {
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      turn: 1,
      definitions: allDefs(),
      player1: { operation: [inst("RS-030", "adv1")], command: [held("TST-OP", "a")] },
    });
    for (let i = 0; i < 8; i += 1) {
      const choice = state.pendingEffectChoice;
      if (choice) {
        state = act(state, legal(state, choice.playerId).find((a) => a.type === "resolve_effect_choice")!);
        continue;
      }
      if (state.turn > 1) break;
      state = act(state, { type: "end_phase", playerId: "player1" });
    }
    expect(state.players.player1.hand.map((c) => c.instanceId)).toContain("TST-OP:a");
    expect(state.turn).toBe(2);
    expect(state.activePlayer).toBe("player2");
    expect(state.phase).toBe("start");
  });

  it.todo(
    "R-END-01: ゴウライビートルの撃破判定より先にエグゾスの留まり判定を行うよう、ターンプレイヤーが順番を選べる（出典: grnrngr/faq-card-5 RS-310 Q2）— 「ターンを終えるとき」の同時効果の順序選択がエンジンにない",
  );

  it.todo(
    "R-END-01: 「自軍エンドフェイズ」の効果は「ターンを終えるとき」の効果より先に処理する（出典: atwiki/page-155）— 「自軍エンドフェイズ」効果（闇の戒律等）がエンジン未実装",
  );

  it.todo("R-END-01: [未確定] エンドフェイズの公式ステップ一覧（公式ルールのエンドフェイズ項に本文がない）");
});

describe("R-END-02 ターン終了処理は終えたプレイヤーのみ", () => {
  /** バトルフェイズからターンを終え、「ターンを終えるとき」の選択（アドベンチャー）を解決する。 */
  const endWithAdventure = (state: GameState): GameState => {
    let next = state;
    for (let i = 0; i < 12; i += 1) {
      const choice = next.pendingEffectChoice;
      if (choice) {
        const pick = legal(next, choice.playerId).find((a) => a.type === "resolve_effect_choice");
        if (!pick) break;
        next = act(next, pick);
        continue;
      }
      if (next.turn > state.turn) break;
      next = act(next, { type: "end_phase", playerId: next.activePlayer });
    }
    return next;
  };

  // 「いいえ。ターンを終えたプレイヤーのみ行います」(faq-card-1 RS-030 Q2)
  it("R-END-02: 自分のアドベンチャーは、相手がターンを終えるときに自分（配置者）のコマンドを戻させない（出典: grnrngr/faq-card-1 RS-030 Q2）", () => {
    const p1Cmd = held("TST-OP", "p1cmd");
    const p2Cmd = held("TST-OP-ET", "p2cmd");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { command: [p1Cmd] },
      player2: { operation: [inst("RS-030", "adv2")], command: [p2Cmd] },
    });
    const next = endWithAdventure(state);
    expect(next.players.player2.command.map((c) => c.instanceId)).toContain(p2Cmd.instanceId);
    expect(next.players.player2.hand.map((c) => c.instanceId)).not.toContain(p2Cmd.instanceId);
  });

  // 「自分自身のターンを終えるとき、自分自身のコマンドゾーンから」(RS-030 テキスト＋FAQ Q1/Q2)
  it("R-END-02: 相手が配置したアドベンチャーでも、ターンを終えたプレイヤーが自分のホールド中コマンドを1つ手札に戻す（出典: grnrngr/faq-card-1 RS-030 Q1・Q2）", () => {
    const p1Cmd = held("TST-OP", "p1cmd");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { command: [p1Cmd] },
      player2: { operation: [inst("RS-030", "adv2")] },
    });
    const next = endWithAdventure(state);
    expect(next.players.player1.hand.map((c) => c.instanceId)).toContain(p1Cmd.instanceId);
  });

  // 「ターンを終えたプレイヤーのみ行います」(faq-card-1 RS-030 Q2)
  it("R-END-02: 自分のアドベンチャーは自分がターンを終えるとき、自分のホールド中コマンドを1つ手札に戻す（出典: grnrngr/faq-card-1 RS-030 Q2）", () => {
    const p1Cmd = held("TST-OP", "p1cmd");
    const p2Cmd = held("TST-OP-ET", "p2cmd");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { operation: [inst("RS-030", "adv1")], command: [p1Cmd] },
      player2: { command: [p2Cmd] },
    });
    const next = endWithAdventure(state);
    expect(next.players.player1.hand.map((c) => c.instanceId)).toContain(p1Cmd.instanceId);
    expect(next.players.player2.command.map((c) => c.instanceId)).toContain(p2Cmd.instanceId);
  });

  // 「はい、重複します」(faq-card-1 RS-030 Q1)
  it("R-END-02: 自分も相手もアドベンチャーを常駐していれば、ターンを終えたプレイヤーがホールド中コマンドを2つ手札に戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    const a = held("TST-OP", "a");
    const b = held("TST-OP", "b");
    const c = held("TST-OP", "c");
    const p2Cmd = held("TST-OP-ET", "p2cmd");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { operation: [inst("RS-030", "adv1")], command: [a, b, c] },
      player2: { operation: [inst("RS-030", "adv2")], command: [p2Cmd] },
    });
    const next = endWithAdventure(state);
    const returned = next.players.player1.hand.filter((x) => ["TST-OP:a", "TST-OP:b", "TST-OP:c"].includes(x.instanceId));
    expect(returned).toHaveLength(2);
    expect(next.players.player2.command.map((x) => x.instanceId)).toContain(p2Cmd.instanceId);
  });

  // 「１枚しかなければその１枚を手札に戻します」(faq-card-1 RS-030 Q1)
  it("R-END-02: アドベンチャーが2枚分重複していても、ホールド中コマンドが1枚しかなければその1枚だけ戻す（出典: grnrngr/faq-card-1 RS-030 Q1）", () => {
    const a = held("TST-OP", "a");
    const r = released("TST-OP", "r");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: allDefs(),
      player1: { operation: [inst("RS-030", "adv1")], command: [a, r] },
      player2: { operation: [inst("RS-030", "adv2")] },
    });
    const next = endWithAdventure(state);
    expect(next.players.player1.hand.map((x) => x.instanceId)).toEqual(["TST-OP:a"]);
    expect(next.players.player1.command.map((x) => x.instanceId)).toContain("TST-OP:r");
  });
});
