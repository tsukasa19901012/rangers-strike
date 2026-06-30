import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import {
  canInitiateOperationCategoryPayment,
  canPlayOperationFromHand,
  explainOperationPlayBlock,
  isInstantOperationCard,
  isOperationPlayPhase,
  operationCardsToDiscardWithStack,
  stackCardOnPermanentOperation,
} from "./rules/operationProcedure";
import { placePermanentOperation } from "./rules/permanentOperation";
import { createTestState, heldEtCommand, heldWbCommand, inst } from "./testing/fixtures";

function def(id: string) {
  const card =
    legend1Catalog.cards.find((entry) => entry.id === id) ??
    legend2Catalog.cards.find((entry) => entry.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

describe("operation play procedure (wiki)", () => {
  it("allows normal operations only during rush phase", () => {
    const op = inst("RS-015", "op");
    const rushState = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
        command: [heldEtCommand("c1")],
      },
    });
    rushState.definitions["RS-015"] = def("RS-015");
    expect(isOperationPlayPhase(rushState)).toBe(true);
    expect(canPlayOperationFromHand(rushState, "player1", "RS-015")).toBe(true);

    const battleState = { ...rushState, phase: "battle" as const };
    expect(explainOperationPlayBlock(battleState, "player1", "RS-015")).toBe("wrong_phase");
    expect(getLegalActions(battleState).some((a) => a.type === "play_operation")).toBe(false);
  });

  it("requires sufficient power before play", () => {
    const op = inst("RS-007", "op");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-P", "p1")],
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-007"] = def("RS-007");
    expect(explainOperationPlayBlock(state, "player1", "RS-007")).toBe("insufficient_power");
    expect(canInitiateOperationCategoryPayment(state, "player1", "RS-007")).toBe(false);
  });

  it("requires command hold or category payment path", () => {
    const op = inst("RS-015", "op");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
        command: [inst("TST-OP-ET", "released")],
      },
    });
    state.definitions["RS-015"] = def("RS-015");
    expect(canPlayOperationFromHand(state, "player1", "RS-015")).toBe(false);
    expect(explainOperationPlayBlock(state, "player1", "RS-015")).toBe("command_not_ready");
    expect(canInitiateOperationCategoryPayment(state, "player1", "RS-015")).toBe(true);
  });

  it("discards instant operations after use", () => {
    const op = inst("RS-015", "op");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-015"] = def("RS-015");
    expect(isInstantOperationCard(state.definitions, "RS-015")).toBe(true);

    const action = getLegalActions(state).find((a) => a.type === "play_operation");
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-015")).toBe(true);
    expect(result.state.players.player1.operation).toHaveLength(0);
  });

  it("allows same-name permanent overwrite for command hold (wiki Q1)", () => {
    const existing = inst("RK-001", "existing");
    const incoming = inst("RK-001", "incoming");
    const defs = Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card]));
    let state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: {
        operation: [existing],
        hand: [incoming],
        power: [],
        command: [heldEtCommand("c1")],
      },
    });

    state = placePermanentOperation(state, "player1", incoming);
    expect(state.players.player1.operation).toHaveLength(1);
    expect(state.players.player1.operation[0]?.instanceId).toBe("RK-001:incoming");
    expect(state.players.player1.discard.some((c) => c.instanceId === "RK-001:existing")).toBe(true);
  });

  it("discards stacked cards when permanent is replaced", () => {
    const stacked = inst("TST-OP", "stack1");
    const existing = { ...inst("RK-001", "existing"), stackedCards: [stacked] };
    const incoming = inst("RK-003", "incoming");
    const defs = {
      ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
    };
    let state = createTestState({
      definitions: defs,
      phase: "rush",
      player1: { operation: [existing], discard: [] },
    });

    state = placePermanentOperation(state, "player1", incoming);
    expect(state.players.player1.discard.map((c) => c.instanceId)).toEqual([
      "RK-001:existing",
      "TST-OP:stack1",
    ]);
  });

  it("stacks cards on permanent operations", () => {
    const resident = inst("RK-001", "resident");
    const stacked = inst("TST-OP", "stack");
    let state = createTestState({
      phase: "rush",
      player1: { operation: [resident] },
    });

    const next = stackCardOnPermanentOperation(
      state,
      "player1",
      resident.instanceId,
      stacked,
    );
    expect(next).not.toBeNull();
    expect(next!.players.player1.operation[0]?.stackedCards).toHaveLength(1);
    expect(operationCardsToDiscardWithStack(next!.players.player1.operation[0]!)).toHaveLength(2);
  });
});
