import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { isCpuTurn, pickCpuAction } from "./level1";
import { dedupeActions } from "./simulation";
import { createTestState, heldWbCommand, inst, WIN_DAMAGE } from "../testing/fixtures";
import { getDefinition } from "../core/catalog";
import { createZordSetup } from "../rules/zordSetup";

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

  it("prioritizes start phase release before draw", () => {
    const state = createTestState({
      phase: "start",
      activePlayer: "player2",
      player2: {
        deck: [inst("TST-OP", "d1")],
        command: [heldWbCommand("held")],
      },
    });

    expect(pickCpuAction(state, "player2")?.type).toBe("release_start_commands");
  });

  it("ends charge when power already meets deck max required power", () => {
    const zord = inst("RS-050", "z1");
    const powers = Array.from({ length: 7 }, (_, i) => inst("TST-P", `p${i}`));
    const state = createTestState({
      phase: "charge",
      activePlayer: "player2",
      player2: {
        hand: [zord, inst("TST-UNIT-2", "u1")],
        deck: [],
        power: powers,
        command: [{ ...inst("TST-OP", "c1"), commandHeld: false }],
      },
    });
    state.definitions["RS-050"] = {
      id: "RS-050",
      name: "Abarenoh",
      type: "unit",
      category: "WB",
      rarity: "SR",
      expansion: "test",
      powerCost: "7+",
      bp: 13000,
      size: "L",
      sp: 1,
    };

    expect(pickCpuAction(state, "player2")?.type).toBe("end_phase");
  });

  it("charges power when a rush unit lacks power but command support exists", () => {
    const wbCmd = inst("TST-OP", "c1");
    const state = createTestState({
      phase: "charge",
      activePlayer: "player2",
      player2: {
        hand: [inst("TST-UNIT-2", "u1")],
        power: [inst("TST-P", "p1")],
        command: [{ ...wbCmd, commandHeld: false }],
      },
    });

    expect(pickCpuAction(state, "player2")?.type).toBe("charge_power");
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

  it("isCpuTurn is false while striker resolves leave during pending strike", () => {
    const striker = inst("TST-UNIT-2", "s1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [striker] },
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: striker.instanceId,
        damage: 2,
        battlePhasePlayer: "player1",
      },
      pendingLeave: {
        ownerPlayerId: "player1",
        instanceId: striker.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: striker.cardId,
        phasePlayerId: "player2",
        resumePendingStrike: { damageCancelled: true },
      },
    });

    expect(isCpuTurn(state, "player2")).toBe(false);
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

  it("begins zord setup for RS-045 instead of blocked category payment", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldWbCommand("c1")],
      },
    });
    state.definitions["RS-045"] = {
      id: "RS-045",
      name: "パトレーラー",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "legend1",
      powerCost: "4+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-080"] = {
      id: "RS-080",
      name: "S Unit",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
    };

    const action = pickCpuAction(state, "player2", { enableSearch: false });
    expect(action?.type).not.toBe("begin_zord_setup");
  });

  it("cancels zord setup when no legal resolve remains", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const base = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldWbCommand("c1")],
      },
    });
    base.definitions["RS-045"] = {
      id: "RS-045",
      name: "パトレーラー",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "legend1",
      powerCost: "4+",
      bp: 5000,
      size: "M",
    };
    base.definitions["RS-080"] = {
      id: "RS-080",
      name: "S Unit",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
    };
    const setup = createZordSetup(base, "player2", zord.instanceId);
    expect(setup).not.toBeNull();
    const state = { ...base, pendingZordSetup: setup! };

    expect(pickCpuAction(state, "player2", { enableSearch: false })?.type).toBe(
      "cancel_zord_setup",
    );
  });

  it("recovers from stuck zord setup in a CPU step loop", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const base = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldWbCommand("c1")],
      },
    });
    base.definitions["RS-045"] = {
      id: "RS-045",
      name: "パトレーラー",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "legend1",
      powerCost: "4+",
      bp: 5000,
      size: "M",
    };
    base.definitions["RS-080"] = {
      id: "RS-080",
      name: "S Unit",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
    };
    const setup = createZordSetup(base, "player2", zord.instanceId);
    let state = { ...base, pendingZordSetup: setup! };

    for (let step = 0; step < 4; step += 1) {
      if (!state.pendingZordSetup) break;
      const action = pickCpuAction(state, "player2", { enableSearch: false });
      expect(action).not.toBeNull();
      if (!action) break;
      const result = applyAction(state, action);
      expect(result.ok, result.ok ? undefined : result.error).toBe(true);
      if (!result.ok) break;
      state = result.state;
    }

    expect(state.pendingZordSetup).toBeUndefined();
  });

  it("completes RS-045 zord rush flow as CPU", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const otCmd = inst("TST-OP-OT", "ot-pay");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [otCmd],
      },
    });
    state.definitions["RS-045"] = {
      id: "RS-045",
      name: "パトレーラー",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "legend1",
      powerCost: "4+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-080"] = {
      id: "RS-080",
      name: "S Unit",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
    };

    for (let step = 0; step < 6; step += 1) {
      const action = pickCpuAction(state, "player2", { enableSearch: false });
      expect(action).not.toBeNull();
      if (!action) break;
      const result = applyAction(state, action);
      expect(result.ok, result.ok ? undefined : result.error).toBe(true);
      if (!result.ok) break;
      state = result.state;
      if (state.players.player2.rush.some((c) => c.instanceId === zord.instanceId)) {
        break;
      }
    }

    expect(state.players.player2.rush.some((c) => c.instanceId === zord.instanceId)).toBe(
      true,
    );
    expect(state.players.player2.hand.some((c) => c.instanceId === zord.instanceId)).toBe(
      false,
    );
  });

  it("prioritizes rushing a fusion partner when a fusion zord is in hand", () => {
    const zord = inst("RS-050", "z1");
    const tyranno = inst("RS-051", "f1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord, tyranno],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
        command: [heldWbCommand("c1")],
        rushCategoryHoldReady: true,
      },
    });
    state.definitions["RS-050"] = {
      id: "RS-050",
      name: "Abarenoh",
      type: "unit",
      category: "WB",
      rarity: "SR",
      expansion: "test",
      powerCost: "7+",
      bp: 13000,
      size: "L",
      sp: 1,
    };
    state.definitions["RS-051"] = {
      id: "RS-051",
      name: "Tyranno",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };

    const action = pickCpuAction(state, "player2");
    expect(action?.type).toBe("rush");
    if (action?.type === "rush") {
      expect(action.instanceId).toBe(tyranno.instanceId);
    }
  });

  it("prefers rush over operation when both are legal in rush phase", () => {
    const op = inst("RS-007", "op1");
    const unit = inst("TST-UNIT-2", "u1");
    const weak = inst("TST-UNIT-0", "w1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [unit, op],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
        command: [heldWbCommand("c1")],
        rushCategoryHoldReady: true,
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
    expect(action?.type).toBe("rush");
    if (action?.type === "rush") {
      expect(action.instanceId).toBe(unit.instanceId);
    }
  });

  it("plays operation in rush phase only when no unit can rush", () => {
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
