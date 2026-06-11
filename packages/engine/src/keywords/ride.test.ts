import { describe, expect, it } from "vitest";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import { attachRideForBattleEntry, attachRideIfEligible, findRideVehicleForRider } from "./ride";
import { markBattleBlocked } from "../rules/turnModifiers";

describe("ride on battle entry", () => {
  const defs = buildDefinitionMap([
    [
      {
        id: "TST-VEHICLE",
        name: "Pat Trailer",
        type: "vehicle",
        category: "OT",
        rarity: "N",
        expansion: "test",
        powerCost: 4,
        bp: 5000,
        size: "M",
      },
      {
        id: "TST-RIDER",
        name: "Pat Rider",
        type: "unit",
        category: "OT",
        rarity: "N",
        expansion: "test",
        powerCost: 2,
        bp: 2000,
        size: "S",
        comboNumber: "RC",
      },
    ],
  ]);

  it("mounts RC rider on an unmounted vehicle in rush", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          rush: [vehicle, rider],
        },
      },
    };

    const mounted = findRideVehicleForRider(state, "player1", rider);
    expect(mounted?.instanceId).toBe(vehicle.instanceId);

    const attached = attachRideIfEligible(state, "player1", rider);
    expect(attached.mountedOnInstanceId).toBe(vehicle.instanceId);
  });

  it("clears mount on ride-off", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;

    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          rush: [vehicle, rider],
        },
      },
    };

    const detached = attachRideIfEligible(state, "player1", rider, true);
    expect(detached.mountedOnInstanceId).toBeUndefined();
  });

  it("rolls back ride when battle entry would be illegal after mounting", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    const base = createTestState(defs);
    const blockedPlayer = markBattleBlocked(base.players.player1, rider.instanceId);
    const state = {
      ...base,
      definitions: defs,
      players: {
        ...base.players,
        player1: { ...blockedPlayer, rush: [vehicle, rider] },
      },
    };

    expect(attachRideIfEligible(state, "player1", rider).mountedOnInstanceId).toBe(
      vehicle.instanceId,
    );
    expect(attachRideForBattleEntry(state, "player1", rider).mountedOnInstanceId).toBeUndefined();
  });
});
