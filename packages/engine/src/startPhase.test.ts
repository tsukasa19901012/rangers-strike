import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { advancePhase } from "./core/createGame";
import { formatGameLog } from "./log/formatLog";
import { getStartPhaseStatus } from "./rules/startPhase";
import { createTestState, inst } from "./testing/fixtures";

function unwrap<T extends { ok: boolean }>(result: T): T extends { ok: true; state: infer S } ? S : never {
  if (!result.ok) throw new Error("expected ok");
  return (result as { ok: true; state: unknown }).state as never;
}

function reject(result: ReturnType<typeof applyAction>): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  return result.error;
}

describe("start phase steps", () => {
  it("initializes no-op steps when entering start phase", () => {
    let state = createTestState({
      phase: "end",
      activePlayer: "player1",
      turn: 1,
      player2: {
        command: [{ ...inst("TST-OP", "c1"), commandHeld: false }],
        battle: [],
      },
    });
    state = advancePhase(state);
    expect(state.phase).toBe("start");
    expect(state.activePlayer).toBe("player2");
    expect(state.players.player2.hasReleasedCommandsThisStart).toBe(true);
    expect(state.players.player2.hasReturnedBattleThisStart).toBe(true);
    expect(state.players.player2.hasDrawnThisStart).toBe(false);
  });

  it("completes release, return, and draw in any order before charge", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    const unit = inst("TST-UNIT-0", "b1");
    let state = createTestState({
      phase: "start",
      player1: {
        deck: [inst("TST-OP", "d1")],
        hand: [],
        command: [cmd],
        battle: [unit],
      },
    });

    state = unwrap(
      applyAction(state, { type: "return_battle_to_rush", playerId: "player1" }),
    );
    expect(state.players.player1.battle).toHaveLength(0);
    expect(state.players.player1.rush).toHaveLength(1);
    expect(state.players.player1.hasReturnedBattleThisStart).toBe(true);
    expect(getLegalActions(state).some((a) => a.type === "end_phase")).toBe(false);

    state = unwrap(
      applyAction(state, { type: "draw", playerId: "player1" }),
    );
    expect(state.players.player1.hand).toHaveLength(1);
    expect(state.players.player1.command[0]?.commandHeld).toBe(true);
    expect(getLegalActions(state).some((a) => a.type === "end_phase")).toBe(false);

    state = unwrap(
      applyAction(state, { type: "release_start_commands", playerId: "player1" }),
    );
    expect(state.players.player1.command[0]?.commandHeld).toBe(false);
    expect(state.phase).toBe("charge");
  });

  it("allows optional bonus draw after mandatory draw", () => {
    let state = createTestState({
      phase: "start",
      player1: {
        damage: 3,
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")],
        hand: [],
        hasReleasedCommandsThisStart: true,
        hasReturnedBattleThisStart: true,
      },
    });

    state = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(state.players.player1.hand).toHaveLength(1);
    expect(state.phase).toBe("start");
    expect(getLegalActions(state).some((a) => a.type === "bonus_draw")).toBe(true);

    state = unwrap(applyAction(state, { type: "bonus_draw", playerId: "player1" }));
    expect(state.phase).toBe("charge");
    expect(state.players.player1.hand).toHaveLength(2);
  });

  it("reports start phase status for UI", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    const unit = inst("TST-UNIT-0", "b1");
    const state = createTestState({
      phase: "start",
      player1: {
        command: [cmd],
        battle: [unit],
      },
    });

    const status = getStartPhaseStatus(state, "player1");
    expect(status.releaseDone).toBe(false);
    expect(status.returnDone).toBe(false);
    expect(status.drawDone).toBe(false);
    expect(status.canRelease).toBe(true);
    expect(status.canReturn).toBe(true);
    expect(status.canDraw).toBe(true);
    expect(status.canAdvanceToCharge).toBe(false);
    expect(status.heldCommandCount).toBe(1);
    expect(status.battleUnitCount).toBe(1);
  });

  it("auto-advances to charge when mandatory steps complete and no bonus draw", () => {
    let state = createTestState({
      phase: "start",
      player1: {
        deck: [inst("TST-OP", "d1")],
        hasReleasedCommandsThisStart: true,
        hasReturnedBattleThisStart: true,
      },
    });

    state = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(state.phase).toBe("charge");
  });

  it("rejects manual end_phase during start (auto-advance only)", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "start",
      player1: {
        deck: [inst("TST-OP", "d1")],
        command: [cmd],
        battle: [inst("TST-UNIT-0", "b1")],
      },
    });

    expect(reject(applyAction(state, { type: "end_phase", playerId: "player1" }))).toBe(
      "illegal_action",
    );
  });

  it("rejects duplicate release and return", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    let state = createTestState({
      phase: "start",
      player1: { command: [cmd], battle: [inst("TST-UNIT-0", "b1")] },
    });

    state = unwrap(
      applyAction(state, { type: "release_start_commands", playerId: "player1" }),
    );
    expect(reject(applyAction(state, { type: "release_start_commands", playerId: "player1" }))).toBe(
      "illegal_action",
    );

    state = unwrap(
      applyAction(state, { type: "return_battle_to_rush", playerId: "player1" }),
    );
    expect(reject(applyAction(state, { type: "return_battle_to_rush", playerId: "player1" }))).toBe(
      "illegal_action",
    );
  });

  it("draws a second card on optional bonus draw", () => {
    let state = createTestState({
      phase: "start",
      player1: {
        damage: 3,
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")],
        hand: [],
        hasReleasedCommandsThisStart: true,
        hasReturnedBattleThisStart: true,
      },
    });

    state = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    state = unwrap(applyAction(state, { type: "bonus_draw", playerId: "player1" }));
    expect(state.players.player1.hand).toHaveLength(2);
    expect(state.players.player1.deck).toHaveLength(0);
  });

  it("formats start phase log entries", () => {
    expect(formatGameLog("player1|release_start_commands", {})).toBe(
      "あなたがホールド中のコマンドをリリースした",
    );
    expect(formatGameLog("player2|return_battle_to_rush", {})).toBe(
      "CPUがバトルエリアのユニットをラッシュに戻した",
    );
  });
});
