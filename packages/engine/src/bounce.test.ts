import { describe, expect, it } from "vitest";
import {
  bounceAllFromZone,
  bounceToHand,
  canBounceToHand,
} from "./rules/bounce";
import { createTestState, inst } from "./testing/fixtures";

describe("bounce framework", () => {
  it("bounces a battle unit to owner hand and clears battle state", () => {
    const unit = {
      ...inst("TST-UNIT-0", "u1"),
      registerHeld: true,
      battleActed: true,
    };
    const state = createTestState({
      player1: { battle: [unit], hand: [] },
    });

    const { state: next, bounced } = bounceToHand(state, {
      playerId: "player1",
      instanceId: unit.instanceId,
      fromZone: "battle",
    });

    expect(bounced?.cardId).toBe("TST-UNIT-0");
    expect(next.players.player1.battle).toHaveLength(0);
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.hand[0]?.registerHeld).toBeUndefined();
    expect(next.players.player1.hand[0]?.battleActed).toBeUndefined();
  });

  it("bounces held command to hand as released", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true, mothershipHold: true };
    const state = createTestState({
      player1: { command: [cmd], hand: [] },
    });

    const { state: next } = bounceToHand(state, {
      playerId: "player1",
      instanceId: cmd.instanceId,
      fromZone: "command",
    });

    expect(next.players.player1.command).toHaveLength(0);
    expect(next.players.player1.hand[0]?.commandHeld).toBe(false);
    expect(next.players.player1.hand[0]?.mothershipHold).toBe(false);
  });

  it("rejects face-down power when faceUpPowerOnly", () => {
    const power = { ...inst("TST-OP", "p1"), faceDown: true };
    const state = createTestState({
      player1: { power: [power] },
    });

    expect(
      canBounceToHand(state, {
        playerId: "player1",
        instanceId: power.instanceId,
        fromZone: "power",
        faceUpPowerOnly: true,
      }),
    ).toBe(false);
  });

  it("bounceAllFromZone filters by predicate", () => {
    const s1 = inst("TST-UNIT-0", "s1");
    const m1 = inst("TST-UNIT-2", "m1");
    const state = createTestState({
      player2: { rush: [s1, m1], hand: [] },
    });

    const { state: next } = bounceAllFromZone(
      state,
      "player2",
      "rush",
      (_card, def) => def?.size === "S",
    );

    expect(next.players.player2.rush.map((c) => c.instanceId)).toEqual([
      m1.instanceId,
    ]);
    expect(next.players.player2.hand.map((c) => c.instanceId)).toEqual([
      s1.instanceId,
    ]);
  });
});
