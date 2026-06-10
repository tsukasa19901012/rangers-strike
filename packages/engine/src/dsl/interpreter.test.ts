import { describe, expect, it } from "vitest";
import { createTestState } from "../testing/fixtures";
import { interpretDslEffect } from "./interpreter";
import type { DslEffectDefinition } from "./types";

describe("dsl interpreter", () => {
  it("applies add_turn_rule primitive", () => {
    const state = createTestState({});
    const definition: DslEffectDefinition = {
      effectId: "test_infinite_chain",
      trigger: "manual",
      primitives: [{ op: "add_turn_rule", ruleId: "infinite_chain" }],
    };
    const result = interpretDslEffect(
      state,
      definition,
      { effectId: "test", sourceCardId: "RS-072", playerId: "player1" },
      "player1",
    );
    expect(result.state.players.player1.modifiers).toContainEqual(
      expect.objectContaining({ kind: "rule", ruleId: "infinite_chain", scope: "turn" }),
    );
  });
});
