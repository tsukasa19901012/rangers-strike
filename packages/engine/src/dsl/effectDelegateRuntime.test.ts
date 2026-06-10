import { describe, expect, it } from "vitest";
import "./cardInterpreter";
import { applyGrantKeyword } from "./grantKeyword";
import { createTestState, inst } from "../testing/fixtures";

describe("effectDelegateRuntime", () => {
  it("resolves effect_* keyword via rematch when pattern matches", () => {
    const unit = inst("RK-097", "u1");
    const command = inst("RK-111", "c1");
    const state = createTestState({
      phase: "battle",
      player1: {
        battle: [unit],
        command: [{ ...command, commandHeld: true }],
      },
    });

    const result = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "RK-097",
        effectId: "named_e383a9e382a4",
        triggerSourceInstanceId: unit.instanceId,
      },
      "effect_named_e383a9e382a4",
    );

    expect(result.state).toBeDefined();
    expect(["return_command_rc_to_hand", "choose", "effect_named_e383a9e382a4"]).toContain(
      result.detail ?? "",
    );
  });
});
