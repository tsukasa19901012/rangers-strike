import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { COMMAND_ZONE_MAX } from "./types/game";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

describe("command zone", () => {
  it("charges a card to command zone", () => {
    const card = inst("TST-OP", "h1");
    const state = createTestState({
      phase: "charge",
      player1: { hand: [card] },
    });

    const result = applyAction(state, {
      type: "charge_command",
      playerId: "player1",
      instanceId: card.instanceId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.command).toHaveLength(1);
    expect(result.state.players.player1.command[0]?.commandHeld).toBe(false);
  });

  it("holds and releases command", () => {
    const cmd = inst("TST-OP", "c1");
    const state = createTestState({
      phase: "rush",
      player1: { command: [cmd] },
    });

    const held = applyAction(state, {
      type: "hold_command",
      playerId: "player1",
      instanceId: cmd.instanceId,
    });
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    expect(held.state.players.player1.command[0]?.commandHeld).toBe(true);

    const released = applyAction(held.state, {
      type: "release_command",
      playerId: "player1",
      instanceId: cmd.instanceId,
    });
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    expect(released.state.players.player1.command[0]?.commandHeld).toBe(false);
  });

  it("requires held command matching unit category to rush", () => {
    const unit = inst("TST-UNIT-2", "u1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2"), inst("TST-OP", "p3")],
        command: [heldWbCommand("c1")],
      },
    });

    const rushes = getLegalActions(state).filter((a) => a.type === "rush");
    expect(rushes).toHaveLength(1);
  });

  it("rejects charge when command zone is full", () => {
    const card = inst("TST-OP", "h1");
    const command = Array.from({ length: COMMAND_ZONE_MAX }, (_, i) =>
      inst("TST-OP", `c${i}`),
    );
    const state = createTestState({
      phase: "charge",
      player1: { hand: [card], command },
    });

    const charges = getLegalActions(state).filter((a) => a.type === "charge_command");
    expect(charges).toHaveLength(0);

    const result = applyAction(state, {
      type: "charge_command",
      playerId: "player1",
      instanceId: card.instanceId,
    });
    expect(result.ok).toBe(false);
  });
});
