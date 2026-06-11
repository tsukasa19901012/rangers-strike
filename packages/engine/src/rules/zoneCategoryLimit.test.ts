import { describe, expect, it } from "vitest";
import {
  countDistinctCategoriesInCommandZone,
  dinoSlasherNeedsDiscard,
  sortCommandZoneForCategoryReduction,
} from "./zoneCategoryLimit";
import { createTestState, inst } from "../testing/fixtures";

describe("zoneCategoryLimit", () => {
  it("counts distinct categories in command zone", () => {
    const player = {
      ...createTestState().players.player1,
      command: [
        { ...inst("TST-OP", "c1"), commandHeld: false },
        { ...inst("TST-OP-ET", "c2"), commandHeld: false },
      ],
    };
    const definitions = createTestState().definitions;
    expect(countDistinctCategoriesInCommandZone(player, definitions)).toBe(2);
  });

  it("prioritizes multi-category cards for reduction ordering", () => {
    const player = {
      ...createTestState().players.player1,
      command: [
        { ...inst("TST-OP", "wb"), commandHeld: false },
        { ...inst("PR-002", "multi"), commandHeld: false },
      ],
    };
    const definitions = {
      ...createTestState().definitions,
      "PR-002": {
        ...createTestState().definitions["TST-OP"]!,
        id: "PR-002",
        category: ["WB", "ET"],
      },
    };
    const sorted = sortCommandZoneForCategoryReduction(player, definitions, player.command);
    expect(sorted[0]?.instanceId).toBe("PR-002:multi");
  });

  it("detects when dino slasher discard is required", () => {
    const base = createTestState();
    const state = {
      ...base,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          command: [{ ...inst("TST-OP", "p1"), commandHeld: false }],
        },
        player2: {
          ...base.players.player2,
          command: [
            { ...inst("TST-OP", "e1"), commandHeld: false },
            { ...inst("TST-OP-ET", "e2"), commandHeld: false },
            { ...inst("TST-OP-OT", "e3"), commandHeld: false },
          ],
        },
      },
    };
    const needs = dinoSlasherNeedsDiscard(state, "player1");
    expect(needs?.discardNeeded).toBe(true);
    expect(needs?.targetCount).toBe(1);
  });
});
