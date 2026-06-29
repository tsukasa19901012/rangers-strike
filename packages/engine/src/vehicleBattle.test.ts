import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, createGame, getLegalActions } from "./index";
import { satisfyCostWindow } from "./core/costWindow";
import { canMoveUnitToBattle } from "./rules/restrictions";
import { canStrikeUnit } from "./rules/combo";
import { canAttackDefender } from "./rules/legend3/restrictions";
import { canAttackRushWithYellowThunder } from "./rules/namedUnitEffects";
import { markVehicleBattleWithoutRide, vehicleMayBattleWithoutRide } from "./rules/bkOperationTurnRules";
import { canVehicleEnterBattleFromRush } from "./rules/vehicleRules";
import { createTestState, inst } from "./testing/fixtures";
import { buildDefinitionMap } from "./core/catalog";

const vehicleDef: CardDefinition = {
  id: "TST-VEHICLE",
  name: "テストビークル",
  type: "vehicle",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  size: "S",
  features: ["メカ"],
};

const riderDef: CardDefinition = {
  id: "TST-RIDER",
  name: "テストライダー",
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

const enemyDef: CardDefinition = {
  id: "TST-ENEMY",
  name: "テスト敵",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  sp: 1,
  size: "S",
};

const fillerDeck = Array.from({ length: 40 }, (_, i) => ({
  id: `FILL-${i}`,
  name: "Filler",
  type: "unit" as const,
  category: "ET" as const,
  rarity: "N" as const,
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S" as const,
}));

function defsWithVehicle() {
  return buildDefinitionMap([[vehicleDef, riderDef, enemyDef]]);
}

describe("vehicle battle rules (wiki page 141)", () => {
  it("unridden vehicle in rush cannot move to battle", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const state = {
      ...createTestState(defs),
      phase: "battle" as const,
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          rush: [vehicle],
        },
      },
    };

    expect(canMoveUnitToBattle(state, "player1", vehicle, "rush")).toBe(false);
    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "move_to_battle" && a.instanceId === vehicle.instanceId)).toBe(
      false,
    );
  });

  it("vehicle in battle cannot strike or be attacked", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const enemy = inst("TST-ENEMY", "e1");
    const attacker = inst("TST-RIDER", "a1");
    const state = {
      ...createTestState(defs),
      phase: "battle" as const,
      activePlayer: "player1" as const,
      definitions: defs,
      players: {
        player1: {
          ...createTestState(defs).players.player1,
          battle: [attacker],
        },
        player2: {
          ...createTestState(defs).players.player2,
          battle: [vehicle],
        },
      },
    };

    expect(canStrikeUnit(defs, vehicle, state, "player2")).toBe(false);
    expect(
      canAttackDefender(
        state,
        "player1",
        attacker.instanceId,
        "player2",
        vehicle.instanceId,
        canAttackRushWithYellowThunder,
      ),
    ).toBe(false);

    const actions = getLegalActions(state);
    expect(
      actions.some(
        (a) =>
          a.type === "battle" &&
          "defenderInstanceId" in a &&
          a.defenderInstanceId === vehicle.instanceId,
      ),
    ).toBe(false);
    expect(actions.some((a) => a.type === "strike" && a.instanceId === vehicle.instanceId)).toBe(false);
  });

  it("vehicle with BK turn rule may enter battle without ride", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const base = createTestState(defs);
    const player1 = markVehicleBattleWithoutRide(
      {
        ...base.players.player1,
        rush: [vehicle],
        command: [{ instanceId: "cmd", cardId: "TST-RIDER", commandHeld: true }],
      },
      vehicle.instanceId,
    );
    const state = {
      ...base,
      phase: "battle" as const,
      definitions: defs,
      players: { ...base.players, player1 },
    };

    expect(vehicleMayBattleWithoutRide(player1, vehicle.instanceId)).toBe(true);
    expect(canVehicleEnterBattleFromRush(state, "player1", vehicle)).toBe(true);
    expect(canMoveUnitToBattle(state, "player1", vehicle, "rush")).toBe(true);
  });

  it("ridden unit can move to battle; vehicle alone cannot when ridden", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const base = createTestState(defs);
    const state = {
      ...base,
      phase: "battle" as const,
      definitions: defs,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          rush: [vehicle, rider],
          command: [{ instanceId: "cmd", cardId: "TST-RIDER", commandHeld: true }],
        },
      },
    };

    expect(canMoveUnitToBattle(state, "player1", vehicle, "rush")).toBe(false);
    expect(canMoveUnitToBattle(state, "player1", rider, "rush")).toBe(true);
  });

  it("ridden unit moves vehicle into battle together", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const base = createTestState(defs);
    const state = {
      ...base,
      phase: "battle" as const,
      definitions: defs,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          rush: [vehicle, rider],
          command: [{ instanceId: "cmd", cardId: "TST-RIDER", commandHeld: true }],
        },
      },
    };

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: rider.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.state.players.player1;
    expect(p1.rush.some((c) => c.instanceId === vehicle.instanceId)).toBe(false);
    expect(p1.battle.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
    expect(
      p1.battle.find((c) => c.instanceId === rider.instanceId)?.mountedOnInstanceId,
    ).toBe(vehicle.instanceId);
  });

  it("mount_ride rides the unit into battle with the vehicle", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    const base = createTestState(defs);
    const state = {
      ...base,
      phase: "battle" as const,
      definitions: defs,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          rush: [vehicle, rider],
          command: [{ instanceId: "cmd", cardId: "TST-RIDER", commandHeld: true }],
        },
      },
    };

    const result = applyAction(state, {
      type: "mount_ride",
      playerId: "player1",
      riderInstanceId: rider.instanceId,
      vehicleInstanceId: vehicle.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.state.players.player1;
    expect(p1.battle.some((c) => c.instanceId === rider.instanceId)).toBe(true);
    expect(p1.battle.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
    expect(
      p1.battle.find((c) => c.instanceId === rider.instanceId)?.mountedOnInstanceId,
    ).toBe(vehicle.instanceId);
  });

  it("move_to_battle without vehicle does not auto-ride", () => {
    const defs = defsWithVehicle();
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RIDER", "r1");
    const base = createTestState(defs);
    const state = {
      ...base,
      phase: "battle" as const,
      definitions: defs,
      players: {
        ...base.players,
        player1: {
          ...base.players.player1,
          rush: [vehicle, rider],
          command: [{ instanceId: "cmd", cardId: "TST-RIDER", commandHeld: true }],
        },
      },
    };

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: rider.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.state.players.player1;
    const entered = p1.battle.find((c) => c.instanceId === rider.instanceId);
    expect(entered?.mountedOnInstanceId).toBeUndefined();
    expect(p1.rush.some((c) => c.instanceId === vehicle.instanceId)).toBe(true);
  });
});

describe("vehicle rush", () => {
  function gameWithVehicleInHand() {
    const base = createGame({
      player1Deck: fillerDeck,
      player2Deck: fillerDeck,
      rng: () => 0.5,
    });
    const instanceId = "veh-1";
    return {
      ...base,
      phase: "rush" as const,
      activePlayer: "player1" as const,
      definitions: {
        ...base.definitions,
        [vehicleDef.id]: vehicleDef,
      },
      players: {
        ...base.players,
        player1: satisfyCostWindow(
          {
            ...base.players.player1,
            hand: [{ instanceId, cardId: vehicleDef.id }],
            command: [{ instanceId: "cmd-1", cardId: fillerDeck[0]!.id, commandHeld: true }],
          },
          "rush_category",
        ),
      },
    };
  }

  it("lists rush action for vehicles in hand", () => {
    const state = gameWithVehicleInHand();
    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "rush" && a.instanceId === "veh-1")).toBe(true);
  });

  it("moves vehicle from hand to rush on rush action", () => {
    const state = gameWithVehicleInHand();
    const result = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: "veh-1",
    });
    expect(result.ok).toBe(true);
    expect(result.state.players.player1.rush.some((c) => c.instanceId === "veh-1")).toBe(true);
    expect(result.state.players.player1.hand).toHaveLength(0);
  });
});
