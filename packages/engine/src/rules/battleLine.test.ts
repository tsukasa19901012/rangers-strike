import { describe, expect, it } from "vitest";
import { generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction } from "../index";
import { effectiveBp } from "../core/catalog";
import { battlePositionOneBased } from "./fractionalSp";
import { countLogicalBattleSlots, logicalBattlePosition } from "./battleLine";
import { battlePositionAfterMove } from "./combo";
import { createTestState, inst } from "../testing/fixtures";

const defs: Record<string, CardDefinition> = Object.fromEntries(
  corePlayableCatalog.cards.map((card) => [card.id, card]),
);

describe("logical battle line with ridden vehicles", () => {
  it("counts ridden vehicle + rider as one combo slot", () => {
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const battle = [vehicle, rider];

    expect(countLogicalBattleSlots(battle)).toBe(1);
    expect(logicalBattlePosition(battle, vehicle.instanceId)).toBe(1);
    expect(logicalBattlePosition(battle, rider.instanceId)).toBe(1);
    expect(battlePositionAfterMove(battle)).toBe(2);
  });

  it("keeps separate slots after ride-off (no mount link)", () => {
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    const battle = [vehicle, rider];

    expect(countLogicalBattleSlots(battle)).toBe(2);
    expect(logicalBattlePosition(battle, rider.instanceId)).toBe(2);
    expect(battlePositionAfterMove(battle)).toBe(3);
  });

  it("assigns position 2 to the next unit while a rider stays mounted", () => {
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const second = inst("RK-064", "u2");
    const battle = [vehicle, rider, second];

    expect(battlePositionOneBased(battle, second.instanceId)).toBe(2);
    expect(battlePositionOneBased(battle, rider.instanceId)).toBe(1);
  });

  it("RK-058 grants BP+500 to a mounted rider in battle", () => {
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const state = createTestState({
      definitions: defs,
      player1: { battle: [vehicle, rider] },
    });

    expect(effectiveBp(state, "player1", rider)).toBe(2500);
  });

  it("second battle entry gets combo position 2 when first slot is a ridden vehicle", () => {
    const vehicle = inst("RK-058", "veh");
    const rider = inst("RK-061", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;
    const second = inst("RK-064", "r2");
    const base = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        battle: [vehicle, rider],
        rush: [second],
        command: [
          { instanceId: "cmd1", cardId: "RK-061", commandHeld: true },
          { instanceId: "cmd2", cardId: "RK-064", commandHeld: true },
        ],
      },
    });

    const result = applyAction(base, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: second.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const battle = result.state.players.player1.battle;
    expect(battlePositionOneBased(battle, second.instanceId)).toBe(2);
  });
});
