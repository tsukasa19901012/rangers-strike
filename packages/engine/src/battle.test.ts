import { describe, expect, it } from "vitest";
import {
  applyAction,
  getLegalActions,
  unitBp,
} from "./index";
import { createTestState, inst } from "./testing/fixtures";

describe("battle resolution", () => {
  it("destroys the lower BP unit", () => {
    const strong = inst("TST-UNIT-2", "a1");
    const weak = inst("TST-UNIT-0", "d1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [strong] },
      player2: { battle: [weak] },
    });

    const battleAction = getLegalActions(state).find((a) => a.type === "battle");
    expect(battleAction).toBeDefined();

    const next = applyAction(state, battleAction!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;

    expect(next.state.players.player1.battle).toHaveLength(1);
    expect(next.state.players.player2.battle).toHaveLength(0);
    expect(next.state.players.player2.discard).toHaveLength(1);
  });

  it("destroys both units on equal BP", () => {
    const a1 = inst("TST-UNIT-0", "a1");
    const d1 = inst("TST-UNIT-0", "d1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [a1] },
      player2: { battle: [d1] },
    });

    const battleAction = getLegalActions(state).find((a) => a.type === "battle");
    const next = applyAction(state, battleAction!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;

    expect(next.state.players.player1.battle).toHaveLength(0);
    expect(next.state.players.player2.battle).toHaveLength(0);
  });

  it("allows strike while opponent has blockers when SP is sufficient", () => {
    const state = createTestState({
      phase: "battle",
      player1: { battle: [inst("TST-UNIT-0", "a1")] },
      player2: { battle: [inst("TST-UNIT-0", "d1")] },
    });

    const strikes = getLegalActions(state).filter((a) => a.type === "strike");
    expect(strikes).toHaveLength(1);
  });

  it("prevents a unit from striking twice in one battle phase", () => {
    const attacker = inst("TST-UNIT-0", "a1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { battle: [] },
    });

    const first = applyAction(state, {
      type: "strike",
      playerId: "player1",
      instanceId: attacker.instanceId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = applyAction(first.state, {
      type: "strike",
      playerId: "player1",
      instanceId: attacker.instanceId,
    });
    expect(second.ok).toBe(false);
  });
});

describe("unitBp", () => {
  it("reads BP from card definition", () => {
    expect(unitBp({ bp: 5000 } as never)).toBe(5000);
    expect(unitBp(undefined)).toBe(0);
  });
});
