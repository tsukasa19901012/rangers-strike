import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { finalizeLeavePending } from "./rules/operationCounters";
import { createTestState, inst } from "./testing/fixtures";

const RESIST_UNIT: CardDefinition = {
  id: "TST-RESIST",
  name: "Resist Unit",
  type: "unit",
  category: "WB",
  rarity: "N",
  expansion: "test",
  powerCost: 2,
  bp: 2000,
  sp: 1,
  size: "S",
  features: ["レジスト"],
};

describe("register (resist)", () => {
  it("defers battle destruction to pendingRegister for resist units", () => {
    const defender = inst("TST-RESIST", "d1");
    const state = createTestState({
      phase: "battle",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const next = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
        registerEligible: true,
      },
      false,
    );
    expect(next.pendingRegister?.ownerPlayerId).toBe("player2");
    expect(next.players.player2.battle).toHaveLength(1);
  });

  it("does not offer register for effect destroys without registerEligible", () => {
    const defender = inst("TST-RESIST", "d1");
    const state = createTestState({
      phase: "battle",
      player2: { battle: [defender] },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const next = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
      false,
    );
    expect(next.pendingRegister).toBeUndefined();
    expect(next.players.player2.battle).toHaveLength(0);
  });

  it("holds unit on field when use_register is chosen", () => {
    const defender = inst("TST-RESIST", "d1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: { battle: [defender] },
      pendingRegister: {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "use_register")).toBe(true);

    const result = applyAction(state, {
      type: "use_register",
      playerId: "player2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const held = result.state.players.player2.battle.find(
      (c) => c.instanceId === defender.instanceId,
    );
    expect(held?.registerHeld).toBe(true);
    expect(result.state.pendingRegister).toBeUndefined();
  });

  it("allows use_register while damage payment is still pending on the stack", () => {
    const defender = inst("TST-RESIST", "d1");
    const faceUp = { ...inst("TST-P", "p1"), faceDown: false };
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player2: { battle: [defender], power: [faceUp, { ...inst("TST-P", "p2"), faceDown: true }] },
      pendingRegister: {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
      pendingDamagePayment: {
        playerId: "player2",
        remainingFlips: 1,
        deckDraws: 0,
        totalDamage: 1,
        selectedFlipIds: [],
        resume: { kind: "none", activePlayer: "player1" },
      },
    });
    state.definitions["TST-RESIST"] = RESIST_UNIT;

    const actions = getLegalActions(state);
    expect(actions.every((a) => a.type === "use_register" || a.type === "pass_register")).toBe(
      true,
    );

    const result = applyAction(state, {
      type: "use_register",
      playerId: "player2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingRegister).toBeUndefined();
    expect(result.state.pendingDamagePayment?.remainingFlips).toBe(1);
  });
});
