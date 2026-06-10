import { describe, expect, it } from "vitest";
import { createTestState, inst } from "../testing/fixtures";
import { applyStateRewrite, canApplyStateRewrite } from "./stateRewrite";

describe("stateRewrite", () => {
  it("applies deck_size_change when valid", () => {
    const deck = [inst("RS-1", "d1"), inst("RS-2", "d2"), inst("RS-3", "d3")];
    const state = createTestState({ player1: { deck } });
    const rewrite = {
      kind: "deck_size_change" as const,
      sourceCardId: "RS-X",
      playerId: "player1" as const,
      deckDelta: -1,
    };
    expect(canApplyStateRewrite(state, rewrite)).toBe(true);
    const result = applyStateRewrite(state, rewrite);
    expect(result.applied).toBe(true);
    expect(result.state.players.player1.deck).toHaveLength(2);
  });

  it("rejects copy_card stub", () => {
    const state = createTestState();
    const result = applyStateRewrite(state, {
      kind: "copy_card",
      sourceCardId: "RS-X",
    });
    expect(result.applied).toBe(false);
  });
});
