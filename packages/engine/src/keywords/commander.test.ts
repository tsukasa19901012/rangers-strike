import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { leaveCommanderZone } from "../rules/commander";
import { createTestState, inst } from "../testing/fixtures";

const COMMANDER: CardDefinition = {
  id: "TST-CMD",
  name: "Test Commander",
  type: "commander",
  category: "WB",
  rarity: "SR",
  expansion: "test",
  powerCost: 0,
};

describe("commander zone", () => {
  it("sets winner when the last commander leaves the zone", () => {
    const commander = inst("TST-CMD", "cmd");
    let state = createTestState({
      phase: "battle",
      player1: { commander: [commander] },
    });
    state.definitions["TST-CMD"] = COMMANDER;

    state = leaveCommanderZone(state, "player1", commander.instanceId, "player2");
    expect(state.players.player1.commander).toHaveLength(0);
    expect(state.players.player1.discard.some((c) => c.instanceId === commander.instanceId)).toBe(
      true,
    );
    expect(state.winner).toBe("player2");
  });

  it("does not end the game when another commander remains", () => {
    const cmd1 = inst("TST-CMD", "cmd1");
    const cmd2 = inst("TST-CMD", "cmd2");
    let state = createTestState({
      phase: "battle",
      player1: { commander: [cmd1, cmd2] },
    });
    state.definitions["TST-CMD"] = COMMANDER;

    state = leaveCommanderZone(state, "player1", cmd1.instanceId, "player2");
    expect(state.players.player1.commander).toHaveLength(1);
    expect(state.winner).toBeNull();
  });
});
