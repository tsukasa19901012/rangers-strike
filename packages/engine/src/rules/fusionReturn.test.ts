import { describe, expect, it } from "vitest";
import { fusionPartnerReturnCount } from "@rangers-strike/cards";
import { returnFusionPartnersFromDiscard } from "./fusionReturn";
import { legendDefinitions } from "../testing/battleEntry";
import { createTestState, heldWbCommand, inst } from "../testing/fixtures";

describe("returnFusionPartnersFromDiscard", () => {
  it("returns listed partners to battle after bazooka on RS-050", () => {
    const fusion1 = inst("RS-051", "f1");
    const fusion2 = inst("RS-052", "f2");
    const state = createTestState({
      definitions: legendDefinitions,
      player2: {
        battle: [],
        discard: [fusion1, fusion2, inst("RS-053", "f3")],
        command: [heldWbCommand("c1"), { ...inst("RS-007", "c2"), commandHeld: false }],
      },
    });

    const next = returnFusionPartnersFromDiscard(state, "player2", "RS-050", "battle");
    expect(next.players.player2.battle.map((c) => c.cardId).sort()).toEqual([
      "RS-051",
      "RS-052",
      "RS-053",
    ]);
    expect(next.players.player2.discard).toHaveLength(0);
  });

  it("returns partners to hand for great_assault on RS-176", () => {
    const partner = inst("RS-171", "p1");
    const state = createTestState({
      player2: {
        hand: [],
        discard: [partner, inst("RS-172", "p2")],
      },
    });

    const next = returnFusionPartnersFromDiscard(state, "player2", "RS-176", "hand");
    expect(fusionPartnerReturnCount("RS-176")).toBe(5);
    expect(next.players.player2.hand.map((c) => c.cardId).sort()).toEqual([
      "RS-171",
      "RS-172",
    ]);
  });

  it("no-ops when destroyed card does not require fusion return", () => {
    const state = createTestState({
      player1: { discard: [inst("RS-051", "f1")] },
    });
    const next = returnFusionPartnersFromDiscard(state, "player1", "RS-046", "battle");
    expect(next).toBe(state);
  });
});
