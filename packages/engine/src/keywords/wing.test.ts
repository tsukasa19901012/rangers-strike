import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { wingAllowsEmptyBattleStrike } from "./index";
import { createTestState, inst } from "../testing/fixtures";

describe("wing keyword", () => {
  const wingUnit = inst("TST-WING", "w1");
  const WING_DEF: CardDefinition = {
    id: "TST-WING",
    name: "Wing Unit",
    type: "unit",
    category: "OT",
    rarity: "N",
    expansion: "test",
    powerCost: 3,
    bp: 5000,
    sp: 1,
    size: "M",
    tags: ["wing"],
  };

  it("allows strike when battle is empty except the wing unit", () => {
    const state = createTestState({
      player1: { battle: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;

    expect(wingAllowsEmptyBattleStrike(state, "player1", wingUnit)).toBe(true);
  });

  it("does not allow strike when another unit is in battle", () => {
    const ally = inst("TST-ALLY", "a1");
    const state = createTestState({
      player1: { battle: [ally, wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.definitions["TST-ALLY"] = {
      ...WING_DEF,
      id: "TST-ALLY",
      name: "Ally",
      tags: [],
    };

    expect(wingAllowsEmptyBattleStrike(state, "player1", wingUnit)).toBe(false);
  });
});
