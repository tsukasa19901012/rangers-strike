import { describe, expect, it } from "vitest";
import { COMMAND_ZONE_MAX } from "./types/game";
import { applyAction } from "./core/applyAction";
import { getLegalActions } from "./index";
import {
  advanceZordSetup,
  canBeginZordSetup,
  canFinishZordSetup,
  createZordSetup,
  listZordSetupResolveActions,
} from "./rules/zordSetup";
import { createTestState, heldOtCommand, heldWbCommand, inst } from "./testing/fixtures";

const fusionDef = (id: string, name: string) => ({
  id,
  name,
  type: "unit" as const,
  category: "WB" as const,
  rarity: "N" as const,
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S" as const,
});

describe("zord setup wizard", () => {
  const rs075Def = {
    id: "RS-075",
    name: "Blue Vulcan",
    type: "unit" as const,
    category: "ET" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: "5+" as const,
    bp: 5000,
    size: "M" as const,
  };

  it("starts with destination when command zone has space (RS-075)", () => {
    const zord = inst("RS-075", "z1");
    const s1 = inst("RS-080", "s1");
    const s2 = inst("RS-081", "s2");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [s1, s2],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [],
      },
    });
    state.definitions["RS-075"] = rs075Def;
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };
    state.definitions["RS-081"] = { ...fusionDef("RS-081", "S2"), size: "S" };

    const setup = createZordSetup(state, "player1", zord.instanceId);
    expect(setup?.step).toBe("destination");
    expect(setup?.validInstanceIds).toEqual([s1.instanceId, s2.instanceId]);
  });

  it("lets player pick material after choosing command destination", () => {
    const zord = inst("RS-075", "z1");
    const s1 = inst("RS-080", "s1");
    const s2 = inst("RS-081", "s2");
    let state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [s1, s2],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [{ ...inst("TST-OP-ET", "et-pay"), commandHeld: false }],
      },
    });
    state.definitions["RS-075"] = rs075Def;
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };
    state.definitions["RS-081"] = { ...fusionDef("RS-081", "S2"), size: "S" };

    const begin = applyAction(state, {
      type: "begin_zord_setup",
      playerId: "player1",
      zordInstanceId: zord.instanceId,
    });
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    state = begin.state;
    expect(state.pendingZordSetup?.step).toBe("destination");

    const pickCommand = applyAction(state, {
      type: "resolve_zord_setup",
      playerId: "player1",
      destination: "command",
    });
    expect(pickCommand.ok).toBe(true);
    if (!pickCommand.ok) return;
    state = pickCommand.state;
    expect(state.pendingZordSetup?.step).toBe("material");
    expect(state.pendingZordSetup?.materialDestination).toBe("command");
    expect(state.pendingZordSetup?.validInstanceIds).toEqual([
      s1.instanceId,
      s2.instanceId,
    ]);

    const pickSecond = applyAction(state, {
      type: "resolve_zord_setup",
      playerId: "player1",
      materialInstanceId: s2.instanceId,
    });
    if (!pickSecond.ok) {
      expect(pickSecond.error).toBeUndefined();
      return;
    }
    expect(pickSecond.state.pendingCommandPayment).toBeDefined();
    expect(pickSecond.state.pendingCommandPayment?.continuation).toMatchObject({
      type: "rush",
      zordMaterialInstanceId: s2.instanceId,
      zordMaterialDestination: "command",
    });
  });

  it("skips destination step when command zone is full", () => {
    const zord = inst("RS-075", "z1");
    const s1 = inst("RS-080", "s1");
    const commands = Array.from({ length: COMMAND_ZONE_MAX }, (_, i) =>
      inst("TST-OP-ET", `c${i}`),
    );
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [s1],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: commands,
      },
    });
    state.definitions["RS-075"] = rs075Def;
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };

    const setup = createZordSetup(state, "player1", zord.instanceId);
    expect(setup?.step).toBe("material");
    expect(setup?.materialDestination).toBeUndefined();

    const advanced = advanceZordSetup(
      state,
      setup!,
      { materialInstanceId: s1.instanceId },
    );
    expect(advanced.kind).not.toBe("error");
    if (advanced.kind === "continue" || advanced.kind === "error") return;
    expect(advanced.kind).toBe("payment");
  });

  it("offers zord setup for RS-046 when RS-105 substitutes additional cost", () => {
    const zord = inst("RS-046", "z1");
    const mothership = inst("RS-105", "ms");
    const otCmd = { ...inst("TST-OP-OT", "ot-pay"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldOtCommand("held"), otCmd],
        rushCategoryHoldReady: true,
      },
    });
    state.definitions["RS-046"] = {
      id: "RS-046",
      name: "Pat Armor",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: "5+",
      bp: 5000,
      size: "M",
    };
    state.definitions["RS-105"] = {
      id: "RS-105",
      name: "Dekabase",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 5,
      bp: 5000,
      size: "L",
    };

    const setup = createZordSetup(state, "player1", zord.instanceId);
    expect(setup?.step).toBe("mothership");

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "begin_zord_setup")).toBe(false);
    expect(actions.some((a) => a.type === "rush" && a.instanceId === zord.instanceId)).toBe(
      true,
    );
  });

  it("does not offer zord setup when category payment cannot be completed (RS-045)", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const state = createTestState({
      phase: "rush",
      player1: {
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
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };

    expect(canBeginZordSetup(state, "player1", zord.instanceId)).toBe(false);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "begin_zord_setup" && a.zordInstanceId === zord.instanceId,
      ),
    ).toBe(false);
  });

  it("cancels pending zord setup when no resolve advances (CPU path)", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player2: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldOtCommand("c1")],
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
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };

    const setup = createZordSetup(state, "player2", zord.instanceId);
    expect(setup).not.toBeNull();
    if (!setup) return;
    state = { ...state, pendingZordSetup: setup };

    expect(listZordSetupResolveActions(state, setup).length).toBe(0);
    expect(canFinishZordSetup(state, setup)).toBe(false);

    const cancel = applyAction(state, {
      type: "cancel_zord_setup",
      playerId: "player2",
    });
    expect(cancel.ok).toBe(true);
    expect(cancel.state.pendingZordSetup).toBeUndefined();
  });

  it("rushes RS-045 directly after category hold without duplicate payment", () => {
    const zord = inst("RS-045", "z1");
    const sUnit = inst("RS-080", "s1");
    const otCmd = { ...inst("TST-OP-OT", "ot-pay"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [otCmd],
        rushCategoryHoldReady: true,
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
    state.definitions["RS-080"] = { ...fusionDef("RS-080", "S1"), size: "S" };

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "begin_zord_setup")).toBe(false);
    expect(actions.some((a) => a.type === "rush" && a.instanceId === zord.instanceId)).toBe(
      true,
    );

    const setup = createZordSetup(state, "player1", zord.instanceId);
    expect(setup).not.toBeNull();
    const advanced = advanceZordSetup(state, setup!, {
      materialInstanceId: sUnit.instanceId,
    });
    expect(advanced.kind).toBe("rush");
  });
});
