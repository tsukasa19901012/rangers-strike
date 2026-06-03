import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./level1";
import { dedupeActions } from "./simulation";
import { createTestState, heldWbCommand, inst, WIN_DAMAGE } from "../testing/fixtures";
import { getDefinition } from "../core/catalog";

describe("CPU level 1", () => {
  it("charges command when command zone is empty", () => {
    const state = createTestState({
      phase: "charge",
      activePlayer: "player2",
      player2: {
        hand: [inst("TST-UNIT-2", "u1"), inst("TST-OP", "c1")],
        power: [],
        command: [],
      },
    });

    expect(pickCpuAction(state, "player2")?.type).toBe("charge_command");
  });

  it("charges power when command is ready but power is insufficient", () => {
    const state = createTestState({
      phase: "charge",
      activePlayer: "player2",
      player2: {
        hand: [inst("TST-UNIT-2", "u1"), inst("TST-OP", "c1")],
        power: [inst("TST-P", "p1")],
        command: [heldWbCommand("held")],
      },
    });

    expect(pickCpuAction(state, "player2")?.type).toBe("charge_command");
  });

  it("takes lethal strike immediately on battle entry", () => {
    const attacker = inst("TST-UNIT-0", "a1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player2: {
        battle: [attacker],
        command: [heldWbCommand("c1")],
      },
      player1: {
        damage: WIN_DAMAGE - 1,
      },
    });
    state = {
      ...state,
      pendingBattleEntry: {
        playerId: "player2",
        instanceId: attacker.instanceId,
        phasePlayerId: "player2",
      },
    };

    expect(pickCpuAction(state, "player2")?.type).toBe("strike");
  });

  it("passes battle entry when search finds no winning attack", () => {
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

    const action = pickCpuAction(state, "player2");
    expect(action?.type).toBe("pass_battle_entry");
  });

  it("declines battle when effective BP is lower", () => {
    const weak = inst("TST-UNIT-0", "a1");
    const strong = inst("TST-UNIT-2", "d1");
    const state = createTestState({
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

    const action = pickCpuAction(state, "player2", { enableSearch: false });
    expect(action?.type).not.toBe("battle");
  });

  it("responds to pending strike", () => {
    const striker = inst("TST-UNIT-2", "s1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [striker] },
      player2: {},
    });

    state = {
      ...state,
      activePlayer: "player2",
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: striker.instanceId,
        damage: 2,
        battlePhasePlayer: "player1",
      },
    };

    const action = pickCpuAction(state, "player2");
    expect(action).not.toBeNull();
    expect(action?.playerId).toBe("player2");
    expect(action?.type).toBe("pass_strike_reaction");
  });

  it("uses simulation to pick among rush phase options", () => {
    const op = inst("RS-007", "op1");
    const weak = inst("TST-UNIT-0", "w1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [op],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
        command: [heldWbCommand("c1")],
      },
      player1: {
        battle: [weak],
      },
    });
    state.definitions["RS-007"] = {
      id: "RS-007",
      name: "Dynamite",
      type: "operation",
      category: "WB",
      rarity: "R",
      expansion: "legend1",
      powerCost: 3,
    };

    const action = pickCpuAction(state, "player2");
    expect(action?.type).toBe("play_operation");
    if (action?.type === "play_operation") {
      expect(action.targetInstanceId).toBe(weak.instanceId);
    }
  });
});

describe("CPU simulation", () => {
  it("dedupes identical candidate actions", () => {
    const actions = [
      { type: "end_phase", playerId: "player2" },
      { type: "end_phase", playerId: "player2" },
    ] as const;
    expect(dedupeActions([...actions])).toHaveLength(1);
  });
});
