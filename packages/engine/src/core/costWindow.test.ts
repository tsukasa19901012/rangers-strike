import { describe, expect, it } from "vitest";
import type { PlayerState } from "../types/game";
import {
  clearCostWindow,
  getCostWindowMetadata,
  isCostWindowSatisfied,
  satisfyCostWindow,
} from "./costWindow";

function emptyPlayer(): PlayerState {
  return {
    id: "player1",
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    exile: [],
    commander: [],
    damage: 0,
  };
}

describe("costWindow", () => {
  it("tracks battle_entry_hold satisfaction", () => {
    expect(isCostWindowSatisfied(emptyPlayer(), "battle_entry_hold")).toBe(false);

    const modern = satisfyCostWindow(emptyPlayer(), "battle_entry_hold");
    expect(isCostWindowSatisfied(modern, "battle_entry_hold")).toBe(true);
  });

  it("stores RS-132 metadata", () => {
    const player = satisfyCostWindow(emptyPlayer(), "battle_entry_rush_discard", {
      discardedCardId: "RS-079",
    });
    expect(getCostWindowMetadata(player, "battle_entry_rush_discard")?.discardedCardId).toBe(
      "RS-079",
    );
    const cleared = clearCostWindow(player, "battle_entry_rush_discard");
    expect(getCostWindowMetadata(cleared, "battle_entry_rush_discard")).toBeUndefined();
  });
});
