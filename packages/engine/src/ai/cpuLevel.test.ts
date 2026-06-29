import { describe, expect, it } from "vitest";
import { CPU_LEVELS, getCpuLevelConfig } from "./types";
import { pickCpuAction } from "./index";
import { createTestState, heldWbCommand, inst } from "../testing/fixtures";

describe("CPU levels", () => {
  it("exposes five levels", () => {
    expect(CPU_LEVELS).toEqual([1, 2, 3, 4, 5]);
  });

  it("increases search depth by level", () => {
    expect(getCpuLevelConfig(1).enableSearch).toBe(false);
    expect(getCpuLevelConfig(2).searchPly).toBe(1);
    expect(getCpuLevelConfig(4).searchPly).toBe(2);
    expect(getCpuLevelConfig(2).maxCandidates).toBe(28);
    expect(getCpuLevelConfig(2).maxCandidates).toBeLessThan(getCpuLevelConfig(5).maxCandidates);
    expect(getCpuLevelConfig(4).maxResponseDepth).toBeLessThan(getCpuLevelConfig(5).maxResponseDepth);
    expect(getCpuLevelConfig(5).maxCandidates).toBe(64);
    expect(getCpuLevelConfig(5).maxResponseDepth).toBe(28);
    expect(getCpuLevelConfig(5).searchPly).toBe(2);
  });

  it("level 1 passes weak battle entry without search", () => {
    const weak = { ...inst("TST-UNIT-0", "a1"), spModifier: -1 };
    const strong = inst("TST-UNIT-2", "d1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player2: {
        battle: [weak],
        command: [heldWbCommand("c1")],
      },
      player1: {
        battle: [strong],
      },
    });
    state = {
      ...state,
      pendingBattleEntry: {
        playerId: "player2",
        instanceId: weak.instanceId,
        phasePlayerId: "player2",
      },
    };

    expect(pickCpuAction(state, "player2", 1)?.type).toBe("pass_battle_entry");
  });
});
