import { describe, expect, it } from "vitest";
import { applyAction } from "../../core/applyAction";
import { createTestState, inst } from "../../testing/fixtures";
import { shouldAutoFinalizeEndPhase } from "./endTurnEffects";

describe("endTurnEffects", () => {
  it("shouldAutoFinalizeEndPhase is true when end phase has no pending work", () => {
    const state = createTestState({ phase: "end" });
    expect(shouldAutoFinalizeEndPhase(state)).toBe(true);
  });

  it("shouldAutoFinalizeEndPhase is false while end_turn_menu is open", () => {
    const state = {
      ...createTestState({ phase: "end" }),
      pendingEffectChoice: {
        playerId: "player1" as const,
        effectId: "end_turn_effects",
        sourceCardId: "RS-138",
        kind: "end_turn_menu" as const,
        phasePlayerId: "player1" as const,
        validInstanceIds: ["RS-138:jet"],
        optional: true,
      },
    };
    expect(shouldAutoFinalizeEndPhase(state)).toBe(false);
  });

  it("auto-finalizes empty end phase when battle phase ends", () => {
    const state = createTestState({ phase: "battle" });
    const ended = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.phase).toBe("start");
    expect(ended.state.activePlayer).toBe("player2");
  });

  it("auto-finalizes after skipping end_turn_menu", () => {
    const jet = inst("RS-138", "jet");
    const state = {
      ...createTestState({
        phase: "end",
        player1: { battle: [jet] },
      }),
      pendingEffectChoice: {
        playerId: "player1" as const,
        effectId: "end_turn_effects",
        sourceCardId: "RS-138",
        kind: "end_turn_menu" as const,
        phasePlayerId: "player1" as const,
        validInstanceIds: [jet.instanceId],
        optional: true,
      },
    };
    state.definitions["RS-138"] = {
      id: "RS-138",
      name: "ジェットスケボー",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
      comboNumber: 1,
    };

    const skipped = applyAction(state, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.phase).toBe("start");
    expect(skipped.state.activePlayer).toBe("player2");
  });
});
