import { describe, expect, it } from "vitest";
import "./cardInterpreter";
import { applyGrantKeyword } from "./grantKeyword";
import { createTestState, inst } from "../testing/fixtures";

describe("effectCardGrantKeywordBridge", () => {
  it("resolves effect_card::XG4-002 via catchall pattern runtime", () => {
    const unit = inst("XG4-002", "tv");
    const deckCard = inst("TST-UNIT-0", "deck-s");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [unit],
        deck: [deckCard],
      },
    });

    const result = applyGrantKeyword(
      state,
      {
        playerId: "player1",
        phasePlayerId: "player1",
        sourceCardId: "XG4-002",
        effectId: "tv",
        triggerSourceInstanceId: unit.instanceId,
      },
      "effect_card::XG4-002::tv",
    );

    expect(result.detail).toBeDefined();
    expect(result.detail).not.toBe("interpret_effect_unresolved");
  });
});
