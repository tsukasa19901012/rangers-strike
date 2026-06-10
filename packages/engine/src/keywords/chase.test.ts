import { describe, expect, it } from "vitest";
import { applyAction } from "../index";
import { tryLeaveField } from "../rules/operationCounters";
import { createTestState, inst } from "../testing/fixtures";

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("chase keyword", () => {
  const vehicle1 = inst("TST-V1", "v1");
  const vehicle2 = inst("TST-V2", "v2");
  const rider = inst("TST-RIDER", "r1");

  function chaseState() {
    rider.mountedOnInstanceId = vehicle1.instanceId;
    return createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: {
        rush: [vehicle1, vehicle2, rider],
        battle: [],
      },
      player2: {
        battle: [],
      },
    });
  }

  it("opens pendingChase when a mounted chase unit would leave", () => {
    const state = chaseState();
    state.definitions["TST-V1"] = {
      id: "TST-V1",
      name: "Vehicle 1",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-V2"] = {
      id: "TST-V2",
      name: "Vehicle 2",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-RIDER"] = {
      id: "TST-RIDER",
      name: "Chase Rider",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S",
      tags: ["chase"],
    };

    const result = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: rider.instanceId,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: rider.cardId,
      phasePlayerId: "player1",
    });

    expect(result.deferred).toBe(true);
    expect(result.state.pendingChase?.chaserInstanceId).toBe(rider.instanceId);
    expect(result.state.pendingChase?.validVehicleInstanceIds).toContain(vehicle2.instanceId);
  });

  it("resolve_chase discards old vehicle and remounts on a new one", () => {
    const state = chaseState();
    state.definitions["TST-V1"] = {
      id: "TST-V1",
      name: "Vehicle 1",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-V2"] = {
      id: "TST-V2",
      name: "Vehicle 2",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-RIDER"] = {
      id: "TST-RIDER",
      name: "Chase Rider",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S",
      tags: ["chase"],
    };

    const opened = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: rider.instanceId,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: rider.cardId,
      phasePlayerId: "player1",
    }).state;

    const resolved = unwrap(
      applyAction(opened, {
        type: "resolve_chase",
        playerId: "player1",
        newVehicleInstanceId: vehicle2.instanceId,
      }),
    );

    expect(resolved.pendingChase).toBeUndefined();
    expect(resolved.players.player1.rush.some((c) => c.instanceId === rider.instanceId)).toBe(true);
    expect(
      resolved.players.player1.rush.find((c) => c.instanceId === rider.instanceId)?.mountedOnInstanceId,
    ).toBe(vehicle2.instanceId);
    expect(resolved.players.player1.discard.some((c) => c.instanceId === vehicle1.instanceId)).toBe(true);
    expect(resolved.players.player1.rush.some((c) => c.instanceId === vehicle1.instanceId)).toBe(false);
  });

  it("pass_chase proceeds with normal leave", () => {
    const state = chaseState();
    state.definitions["TST-V1"] = {
      id: "TST-V1",
      name: "Vehicle 1",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-V2"] = {
      id: "TST-V2",
      name: "Vehicle 2",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-RIDER"] = {
      id: "TST-RIDER",
      name: "Chase Rider",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S",
      tags: ["chase"],
    };

    const opened = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: rider.instanceId,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: rider.cardId,
      phasePlayerId: "player1",
    }).state;

    const passed = unwrap(
      applyAction(opened, {
        type: "pass_chase",
        playerId: "player1",
      }),
    );

    expect(passed.pendingChase).toBeUndefined();
    expect(passed.players.player1.discard.some((c) => c.instanceId === rider.instanceId)).toBe(true);
    expect(passed.players.player1.rush.some((c) => c.instanceId === rider.instanceId)).toBe(false);
  });

  it("opens pendingChase when a mounted vehicle is destroyed", () => {
    const state = chaseState();
    state.definitions["TST-V1"] = {
      id: "TST-V1",
      name: "Vehicle 1",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-V2"] = {
      id: "TST-V2",
      name: "Vehicle 2",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
    };
    state.definitions["TST-RIDER"] = {
      id: "TST-RIDER",
      name: "Chase Rider",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S",
      tags: ["chase"],
    };

    const result = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: vehicle1.instanceId,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: "TST-V1",
      phasePlayerId: "player1",
    });

    expect(result.deferred).toBe(true);
    expect(result.state.pendingChase?.mode).toBe("vehicle_destroyed");
    expect(result.state.pendingChase?.chaserInstanceId).toBe(rider.instanceId);
    expect(result.state.players.player1.rush.some((c) => c.instanceId === vehicle1.instanceId)).toBe(
      true,
    );
  });
});
