import { describe, expect, it } from "vitest";
import { applyAction } from "./core/applyAction";
import { getLegalActions } from "./core/legalActions";
import { requiresDamagePowerChoice } from "./rules/damagePayment";
import { createTestState, inst } from "./testing/fixtures";

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("damage power choice", () => {
  it("requires choice when multiple face-up power and partial damage", () => {
    const player = {
      power: [
        { ...inst("TST-P", "p1"), faceDown: false },
        { ...inst("TST-P", "p2"), faceDown: false },
        { ...inst("TST-P", "p3"), faceDown: false },
      ],
    };
    expect(requiresDamagePowerChoice({ ...createTestState().players.player1, ...player }, 1)).toBe(
      true,
    );
    expect(requiresDamagePowerChoice({ ...createTestState().players.player1, ...player }, 2)).toBe(
      true,
    );
    expect(requiresDamagePowerChoice({ ...createTestState().players.player1, ...player }, 3)).toBe(
      false,
    );
  });

  it("lets defender pick which power flips on strike damage", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const p1 = { ...inst("TST-P", "p1"), faceDown: false };
    const p2 = { ...inst("TST-P", "p2"), faceDown: false };
    const p3 = { ...inst("TST-P", "p3"), faceDown: false };
    let state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: {
        power: [p1, p2, p3],
        deck: [inst("TST-P", "d1")],
      },
    });

    state = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );
    expect(state.players.player2.damage).toBe(0);
    expect(state.pendingDamagePayment?.playerId).toBe("player2");
    expect(state.pendingDamagePayment?.remainingFlips).toBe(2);

    state = unwrap(
      applyAction(state, {
        type: "resolve_damage_payment",
        playerId: "player2",
        instanceId: p2.instanceId,
      }),
    );
    expect(state.pendingDamagePayment?.remainingFlips).toBe(1);
    expect(state.pendingDamagePayment?.selectedFlipIds).toContain(p2.instanceId);
    expect(state.players.player2.power.every((c) => !c.faceDown)).toBe(true);

    state = unwrap(
      applyAction(state, {
        type: "resolve_damage_payment",
        playerId: "player2",
        instanceId: p3.instanceId,
      }),
    );
    expect(state.pendingDamagePayment).toBeUndefined();
    expect(state.players.player2.damage).toBe(2);
    expect(state.players.player2.power.find((c) => c.instanceId === p1.instanceId)?.faceDown).toBe(
      false,
    );
    expect(state.players.player2.power.find((c) => c.instanceId === p2.instanceId)?.faceDown).toBe(
      true,
    );
    expect(state.players.player2.power.find((c) => c.instanceId === p3.instanceId)?.faceDown).toBe(
      true,
    );
    expect(state.pendingStrike).toBeUndefined();
    expect(state.activePlayer).toBe("player1");
  });

  it("auto-flips when only one face-up power option for damage 1", () => {
    const attacker = inst("TST-UNIT-0", "a1");
    const faceUp = { ...inst("TST-P", "p1"), faceDown: false };
    const faceDown = { ...inst("TST-P", "p2"), faceDown: true };
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { power: [faceUp, faceDown] },
    });

    const next = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );

    expect(next.pendingDamagePayment).toBeUndefined();
    expect(next.pendingStrike).toBeUndefined();
    expect(next.activePlayer).toBe("player1");
    expect(next.players.player2.damage).toBe(1);
    expect(next.players.player2.power.find((c) => c.instanceId === faceUp.instanceId)?.faceDown).toBe(
      true,
    );
  });

  it("lists only unselected face-up power as legal targets", () => {
    const p1 = { ...inst("TST-P", "p1"), faceDown: false };
    const p2 = { ...inst("TST-P", "p2"), faceDown: false };
    const state = createTestState({
      activePlayer: "player2",
      player2: { power: [p1, p2] },
      pendingDamagePayment: {
        playerId: "player2",
        remainingFlips: 1,
        deckDraws: 0,
        totalDamage: 2,
        selectedFlipIds: [p1.instanceId],
        resume: { kind: "none", activePlayer: "player1" },
      },
    });

    const targets = getLegalActions(state)
      .filter((a) => a.type === "resolve_damage_payment")
      .map((a) => (a.type === "resolve_damage_payment" ? a.instanceId : ""));
    expect(targets).toEqual([p2.instanceId]);
  });
});
