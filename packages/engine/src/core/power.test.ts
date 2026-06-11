import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  countAvailablePower,
  countOpponentMultiCategoryCommands,
  canAffordAvailablePower,
  effectivePowerCost,
} from "./power";
import { createTestState, inst } from "../testing/fixtures";
import { addTurnRuleModifier } from "./scopedModifiers";

const MULTI_CMD: CardDefinition = {
  id: "TST-MULTI-CMD",
  name: "Multi Command",
  type: "operation",
  category: ["WB", "DA"],
  rarity: "N",
  expansion: "test",
  powerCost: 1,
};

const SINGLE_CMD: CardDefinition = {
  id: "TST-SINGLE-CMD",
  name: "Single Command",
  type: "operation",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 1,
};

describe("countAvailablePower", () => {
  it("counts own power zone only when opponent has no multi command", () => {
    const state = createTestState({
      player1: { power: [inst("RS-001", "p1")] },
      player2: { command: [inst("TST-SINGLE-CMD", "c1")] },
    });
    state.definitions["TST-SINGLE-CMD"] = SINGLE_CMD;
    expect(countAvailablePower(state, "player1")).toBe(1);
    expect(countOpponentMultiCategoryCommands(state, "player1")).toBe(0);
  });

  it("adds opponent multi-category command (face-up or held)", () => {
    const held = { ...inst("TST-MULTI-CMD", "c1"), commandHeld: true };
    const state = createTestState({
      player1: { power: [] },
      player2: { command: [held] },
    });
    state.definitions["TST-MULTI-CMD"] = MULTI_CMD;
    expect(countAvailablePower(state, "player1")).toBe(1);
  });

  it("stacks multiple opponent multi commands", () => {
    const state = createTestState({
      player1: { power: [inst("RS-001", "p1"), inst("RS-002", "p2")] },
      player2: {
        command: [
          inst("TST-MULTI-CMD", "c1"),
          inst("TST-MULTI-CMD", "c2"),
        ],
      },
    });
    state.definitions["TST-MULTI-CMD"] = MULTI_CMD;
    expect(countAvailablePower(state, "player1")).toBe(4);
  });

  it("canAffordAvailablePower uses multi-category bonus", () => {
    const state = createTestState({
      player1: { power: [] },
      player2: { command: [inst("TST-MULTI-CMD", "c1")] },
    });
    state.definitions["TST-MULTI-CMD"] = MULTI_CMD;
    expect(canAffordAvailablePower(state, "player1", 1)).toBe(true);
    expect(canAffordAvailablePower(state, "player1", 2)).toBe(false);
  });
});

describe("effectivePowerCost", () => {
  it("reduces rush cost when opponent activated enemy_power_cost_minus this turn", () => {
    let state = createTestState({ activePlayer: "player1" });
    state = {
      ...state,
      players: {
        ...state.players,
        player1: addTurnRuleModifier(state.players.player1, "enemy_power_cost_minus"),
      },
    };
    expect(effectivePowerCost(state, "player2", 3)).toBe(2);
    expect(effectivePowerCost(state, "player1", 3)).toBe(3);
  });
});
