import { describe, expect, it } from "vitest";
import "./cardInterpreter";
import { interpretEffectPrimitives } from "./cardInterpreter";
import { tryInterpretEffectDefinition } from "./interpretEffectRuntime";
import { createTestState, inst } from "../testing/fixtures";

describe("interpretEffectRuntime", () => {
  it("interpret_effect primitive rematches effect text", () => {
    const unit = inst("RK-097", "u1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [unit] },
    });

    const outcome = interpretEffectPrimitives(
      state,
      {
        effectId: "named_e383a9e382a4",
        sourceCardId: "RK-162",
        playerId: "player1",
        phasePlayerId: "player1",
        triggerSourceInstanceId: unit.instanceId,
        discardOperation: false,
      },
      [{ type: "interpret_effect" }],
    );

    expect(outcome.state).toBeDefined();
    expect(outcome.detail).not.toBe("interpret_effect_unresolved");
  });

  it("tryInterpretEffectDefinition returns null without text", () => {
    const state = createTestState({});
    const result = tryInterpretEffectDefinition(
      state,
      {
        effectId: "missing",
        sourceCardId: "RS-001",
        playerId: "player1",
        phasePlayerId: "player1",
        discardOperation: false,
      },
      interpretEffectPrimitives,
    );
    expect(result).toBeNull();
  });
});
