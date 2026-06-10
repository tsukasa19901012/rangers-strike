import { describe, it, expect } from "vitest";
import { interpretEffectPrimitives } from "./cardInterpreter";
import { createTestState, inst } from "../testing/fixtures";
import { legend1Catalog } from "@rangers-strike/cards";

describe("enqueue_trigger primitive", () => {
  it("delegates ruin_survey NC to legacy handler via enqueue_trigger", () => {
    const card = inst("RS-066", "battle");
    const def = legend1Catalog.cards.find((c) => c.id === "RS-066");
    if (!def) throw new Error("missing RS-066");

    const state = createTestState({
      phase: "battle",
      player1: {
        battle: [card],
        deck: [inst("RS-001", "d1"), inst("RS-002", "d2")],
      },
    });
    state.definitions["RS-066"] = def;

    const outcome = interpretEffectPrimitives(state, {
      effectId: "ruin_survey",
      sourceCardId: "RS-066",
      playerId: "player1",
      phasePlayerId: "player1",
      triggerSourceInstanceId: card.instanceId,
      discardOperation: false,
    }, [{ type: "enqueue_trigger", effectId: "ruin_survey" }]);

    expect(outcome.state.pendingEffectChoice?.effectId).toBe("ruin_survey");
    expect(outcome.detail).toBe("ruin_survey");
  });
});
