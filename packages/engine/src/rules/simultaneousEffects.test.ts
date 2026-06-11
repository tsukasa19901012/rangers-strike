import { describe, expect, it } from "vitest";
import { getReactionChooserPlayerId } from "../core/legalActions";
import { buildEffectStack } from "./effectStack";
import { withSyncedEffectStack } from "./effectStack";
import { createTestState } from "../testing/fixtures";

describe("simultaneousEffects", () => {
  it("opens simultaneous_order when leave and strike reactions coexist", () => {
    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      pendingLeave: {
        ownerPlayerId: "player1",
        instanceId: "u1",
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: "TST-UNIT-0",
        phasePlayerId: "player1",
      },
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: "s1",
        damage: 2,
        battlePhasePlayer: "player1",
      },
    });

    const synced = withSyncedEffectStack(state);
    expect(synced.pendingEffectChoice?.kind).toBe("simultaneous_order");
    expect(synced.pendingEffectChoice?.validInstanceIds).toEqual([
      "pendingLeave",
      "pendingStrike",
    ]);
  });

  it("applies player-chosen resolution order to the effect stack", () => {
    let state = createTestState({
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: "u1",
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: "TST-UNIT-0",
        phasePlayerId: "player1",
      },
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: "s1",
        damage: 1,
        battlePhasePlayer: "player1",
      },
      reactionResolutionOrder: ["pendingStrike", "pendingLeave"],
    });

    const stack = buildEffectStack(state);
    expect(stack.frames[0]?.id).toBe("pendingStrike");
    expect(stack.frames[1]?.id).toBe("pendingLeave");
    expect(getReactionChooserPlayerId(state)).toBe("player2");
  });
});
