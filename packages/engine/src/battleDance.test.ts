import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { createTestState, inst } from "./testing/fixtures";

function def(cardId: string) {
  return {
    id: cardId,
    name: cardId,
    type: "operation" as const,
    category: "ET",
    powerCost: 0,
  };
}

function sUnitDef(cardId: string) {
  return {
    id: cardId,
    name: cardId,
    type: "unit" as const,
    category: "ET",
    size: "S" as const,
    bp: 1000,
    sp: 1,
  };
}

describe("battle dance RS-003", () => {
  it("requires two released commands and holds them on retreat", () => {
    const sUnit = inst("TST-UNIT-0", "battle1");
    const cmdA = inst("TST-OP-ET", "c1");
    const cmdB = inst("TST-OP-ET", "c2");
    const state = createTestState({
      phase: "battle",
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [sUnit],
        rush: [],
        command: [
          { ...cmdA, commandHeld: false },
          { ...cmdB, commandHeld: false },
        ],
      },
    });
    state.definitions["RS-003"] = { ...def("RS-003"), tags: ["常駐"] };

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "battle_dance_retreat" &&
        a.battleInstanceId === sUnit.instanceId,
    );
    expect(action).toBeDefined();
    if (action?.type !== "battle_dance_retreat") return;

    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const player = result.state.players.player1;
    expect(player.battle.some((c) => c.instanceId === sUnit.instanceId)).toBe(false);
    expect(player.rush.some((c) => c.instanceId === sUnit.instanceId)).toBe(true);
    expect(player.command.find((c) => c.instanceId === cmdA.instanceId)?.commandHeld).toBe(true);
    expect(player.command.find((c) => c.instanceId === cmdB.instanceId)?.commandHeld).toBe(true);
  });

  it("does not legalize when fewer than two released commands", () => {
    const state = createTestState({
      phase: "battle",
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [inst("TST-UNIT-0", "battle1")],
        command: [{ ...inst("TST-OP-ET", "c1"), commandHeld: false }],
      },
    });
    state.definitions["RS-003"] = { ...def("RS-003"), tags: ["常駐"] };

    expect(getLegalActions(state).some((a) => a.type === "battle_dance_retreat")).toBe(false);
  });

  it("does not legalize when commands are already held", () => {
    const state = createTestState({
      phase: "battle",
      player1: {
        operation: [inst("RS-003", "op1")],
        battle: [inst("TST-UNIT-0", "battle1")],
        command: [
          { ...inst("TST-OP-ET", "c1"), commandHeld: true },
          { ...inst("TST-OP-ET", "c2"), commandHeld: true },
        ],
      },
    });
    state.definitions["RS-003"] = { ...def("RS-003"), tags: ["常駐"] };

    expect(getLegalActions(state).some((a) => a.type === "battle_dance_retreat")).toBe(false);
  });
});
