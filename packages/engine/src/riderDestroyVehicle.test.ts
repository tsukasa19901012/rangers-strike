import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { buildDefinitionMap } from "./core/catalog";
import { tryLeaveField } from "./rules/operationCounters";
import { restoreMountedVehicleIfMistakenlyDiscarded } from "./keywords/ride";
import { createTestState, inst } from "./testing/fixtures";

const vehicleDef: CardDefinition = {
  id: "TST-V",
  name: "V",
  type: "vehicle",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  size: "S",
};

const riderDef: CardDefinition = {
  id: "TST-R",
  name: "R",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 2000,
  sp: 1,
  size: "S",
  comboNumber: "RC",
};

const defs = buildDefinitionMap([[vehicleDef, riderDef]]);

describe("ridden vehicle on rider destroy", () => {
  it("keeps vehicle in rush when mounted rider is destroyed from rush", () => {
    const vehicle = inst("TST-V", "v1");
    const rider = inst("TST-R", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const base = createTestState(defs);
    const state = {
      ...base,
      definitions: defs,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          rush: [vehicle, rider],
        },
      },
    };

    const result = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: rider.instanceId,
      fromZone: "rush",
      toZone: "discard",
      leavingCardId: rider.cardId,
      phasePlayerId: "player2",
    });

    const p1 = result.state.players.player1;
    expect(p1.rush.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === vehicle.instanceId)).toBe(false);
    expect(p1.discard.some((c) => c.instanceId === rider.instanceId)).toBe(true);
  });

  it("keeps vehicle in battle when mounted rider is destroyed from battle", () => {
    const vehicle = inst("TST-V", "v1");
    const rider = inst("TST-R", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const base = createTestState(defs);
    const state = {
      ...base,
      definitions: defs,
      phase: "battle" as const,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          battle: [vehicle, rider],
          rush: [],
        },
      },
    };

    const result = tryLeaveField(state, {
      ownerPlayerId: "player1",
      instanceId: rider.instanceId,
      fromZone: "battle",
      toZone: "discard",
      leavingCardId: rider.cardId,
      phasePlayerId: "player2",
    });

    const p1 = result.state.players.player1;
    expect(p1.battle.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === vehicle.instanceId)).toBe(false);
    expect(p1.discard.some((c) => c.instanceId === rider.instanceId)).toBe(true);
  });

  it("keeps vehicle in battle when ridden defender loses battle", () => {
    const vehicle = inst("TST-V", "v1");
    const rider = inst("TST-R", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const enemy = inst("TST-R", "e1");
    const base = createTestState(defs);
    const state = {
      ...base,
      definitions: defs,
      phase: "battle" as const,
      activePlayer: "player2" as const,
      players: {
        player1: {
          ...base.players.player1,
          battle: [vehicle, rider],
          rush: [],
        },
        player2: {
          ...base.players.player2,
          battle: [enemy],
          command: [{ instanceId: "cmd", cardId: "TST-R", commandHeld: true }],
        },
      },
    };

    const result = applyAction(state, {
      type: "battle",
      playerId: "player2",
      attackerInstanceId: enemy.instanceId,
      defenderInstanceId: rider.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p1 = result.state.players.player1;
    expect(p1.battle.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
    expect(p1.discard.some((c) => c.instanceId === vehicle.instanceId)).toBe(false);
    expect(p1.discard.some((c) => c.instanceId === rider.instanceId)).toBe(true);
  });

  it("restores mounted vehicle when it was mistakenly discarded with rider", () => {
    const vehicle = inst("TST-V", "v1");
    const rider = inst("TST-R", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const base = createTestState(defs);
    const owner = {
      ...base.players.player1,
      battle: [],
      rush: [],
      discard: [rider, vehicle],
    };

    const restored = restoreMountedVehicleIfMistakenlyDiscarded(
      owner,
      rider,
      "battle",
    );

    expect(restored.discard.some((c) => c.instanceId === vehicle.instanceId)).toBe(false);
    expect(restored.discard.some((c) => c.instanceId === rider.instanceId)).toBe(true);
    expect(restored.battle.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
  });
});
