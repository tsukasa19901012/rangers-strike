import { describe, expect, it } from "vitest";
import { ON_RUSH_EFFECTS, resolveRushTriggeredEffects } from "../rules/rushEffects";
import { createTestState, inst } from "../testing/fixtures";
import { getEngineEventDispatcher } from "./globalDispatcher";

describe("UnitRushed event integration", () => {
  it("resolveRushTriggeredEffects dispatches through registered listener", () => {
    expect(getEngineEventDispatcher().hasListeners("UnitRushed")).toBe(true);

    const unit = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        rush: [unit],
        deck: [inst("TST-OP", "deck1")],
      },
    });

    state.definitions["TST-UNIT-0"] = {
      id: "TST-UNIT-0",
      name: "Rush FX",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 2000,
      size: "S",
    };

    ON_RUSH_EFFECTS["TST-UNIT-0"] = "draw_1";

    const beforeDeck = state.players.player1.deck.length;
    const result = resolveRushTriggeredEffects(state, "player1", unit.instanceId);

    expect(result.state.players.player1.deck.length).toBe(beforeDeck - 1);
    expect(result.logs.length).toBeGreaterThan(0);

    delete ON_RUSH_EFFECTS["TST-UNIT-0"];
  });
});
