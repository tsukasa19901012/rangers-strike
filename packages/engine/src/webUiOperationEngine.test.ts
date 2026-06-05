import { describe, expect, it } from "vitest";
import { listImplementedOperations } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { createTestState, heldEtCommand, inst } from "./testing/fixtures";

function def(cardId: string) {
  return {
    id: cardId,
    name: cardId,
    type: "operation" as const,
    category: "ET",
    powerCost: 0,
  };
}

describe("Web UI operation engine backing", () => {
  for (const op of listImplementedOperations()) {
    if (op.kind !== "instant") continue;

    it(`${op.cardId} ${op.effectId} is playable from engine when set up`, () => {
      const operation = inst(op.cardId, "op1");
      const support = inst("RS-007", "support1");
      const enemyUnit = inst("TST-UNIT-0", "enemy1");

      const state = createTestState({
        phase: "rush",
        player1: {
          hand: [operation, support],
          power: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `p${i}`)),
          command: [heldEtCommand("c1")],
          rush: [enemyUnit],
          discard: [inst("RS-063", "disc1")],
        },
        player2: {
          rush: [enemyUnit],
          battle: [inst("TST-UNIT-1", "battle1")],
        },
      });
      state.definitions[op.cardId] = def(op.cardId);
      state.definitions["RS-007"] = def("RS-007");
      state.definitions["RS-063"] = {
        id: "RS-063",
        name: "RS-063",
        type: "unit",
        category: "ET",
        size: "S",
        bp: 1000,
      };
      state.definitions["TST-UNIT-0"] = {
        id: "TST-UNIT-0",
        name: "TST-UNIT-0",
        type: "unit",
        category: "ET",
        size: "M",
        bp: 5000,
      };
      state.definitions["TST-UNIT-1"] = {
        id: "TST-UNIT-1",
        name: "TST-UNIT-1",
        type: "unit",
        category: "ET",
        size: "M",
        bp: 5000,
      };

      const actions = getLegalActions(state).filter(
        (a) => a.type === "play_operation" && a.instanceId === operation.instanceId,
      );

      if (op.effectId === "cyber_s_rider") {
        expect(actions.some((a) => a.targetInstanceId === support.instanceId)).toBe(true);
        const action = actions.find((a) => a.targetInstanceId === support.instanceId);
        expect(applyAction(state, action!).ok).toBe(true);
        return;
      }

      const targeted = actions.filter((a) => a.targetInstanceId);
      const bare = actions.find((a) => !a.targetInstanceId);

      if (targeted.length > 0) {
        expect(applyAction(state, targeted[0]!).ok).toBe(true);
        return;
      }

      if (bare) {
        const result = applyAction(state, bare);
        expect(result.ok).toBe(true);
        if (op.effectId === "denji_machine") {
          expect(result.state.pendingEffectChoice?.effectId).toBe("denji_machine");
        }
      }
    });
  }
});
