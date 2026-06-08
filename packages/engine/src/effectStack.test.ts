import { describe, expect, it } from "vitest";
import { buildEffectStack, getStackActorPlayerId } from "./rules/effectStack";
import { getReactionChooserPlayerId } from "./core/legalActions";
import { createTestState, inst } from "./testing/fixtures";

describe("effectStack", () => {
  it("orders leave before strike before battle before rush", () => {
    const state = createTestState({
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
      pendingBattle: {
        attackerPlayerId: "player1",
        attackerInstanceId: "a1",
        defenderPlayerId: "player2",
        defenderInstanceId: "d1",
        phasePlayerId: "player1",
      },
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: "r1",
        phasePlayerId: "player1",
      },
    });

    const stack = buildEffectStack(state);
    expect(stack.frames.map((f) => f.kind)).toEqual([
      "leave_reaction",
      "strike_reaction",
      "battle_reaction",
      "rush_reaction",
    ]);
    expect(getReactionChooserPlayerId(state)).toBe("player2");
    expect(getStackActorPlayerId(state)).toBe("player2");
  });

  it("includes register_choice before strike reactions", () => {
    const state = createTestState({
      pendingRegister: {
        ownerPlayerId: "player2",
        instanceId: "d1",
        fromZone: "battle",
        leavingCardId: "TST-RESIST",
        phasePlayerId: "player1",
      },
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: "s1",
        damage: 1,
        battlePhasePlayer: "player1",
      },
    });
    const stack = buildEffectStack(state);
    expect(stack.frames[0]?.kind).toBe("register_choice");
    expect(getReactionChooserPlayerId(state)).toBe("player2");
  });
});
