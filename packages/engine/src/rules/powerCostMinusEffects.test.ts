import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { createTestState, inst } from "../testing/fixtures";
import {
  collectPowerCostMinusUnitIds,
  tryStartDestroyPowerCostMinusChoice,
} from "./powerCostMinusEffects";

const minusUnit: CardDefinition = {
  id: "T-MINUS",
  name: "テストマイナス",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend1",
  powerCost: "7-",
  bp: 1000,
  size: "S",
};

const normalUnit: CardDefinition = {
  id: "T-NORMAL",
  name: "テスト通常",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend1",
  powerCost: 3,
  bp: 1000,
  size: "S",
};

describe("power cost minus destroy", () => {
  it("collects enemy units with minus suffix", () => {
    const enemy = inst("T-MINUS", "enemy-minus");
    const state = createTestState({
      definitions: { "T-MINUS": minusUnit, "T-NORMAL": normalUnit },
      player2: {
        battle: [enemy, inst("T-NORMAL", "enemy-normal")],
      },
    });
    expect(collectPowerCostMinusUnitIds(state, "player2", { size: "S" })).toEqual([
      enemy.instanceId,
    ]);
  });

  it("opens optional destroy choice for v3 kick", () => {
    const state = createTestState({
      definitions: { "T-MINUS": minusUnit, "RK-159": { ...minusUnit, id: "RK-159", powerCost: 4 } },
      player1: {
        battle: [inst("RK-159", "attacker")],
      },
      player2: {
        battle: [inst("T-MINUS", "target")],
      },
    });
    const next = tryStartDestroyPowerCostMinusChoice(
      state,
      "player1",
      "RK-159",
      "player1",
      { effectId: "v3_kick", enemyOnly: true, size: "S", optional: true },
    );
    expect(next?.pendingEffectChoice?.effectId).toBe("v3_kick");
    expect(next?.pendingEffectChoice?.validInstanceIds).toEqual([
      inst("T-MINUS", "target").instanceId,
    ]);
    expect(next?.pendingEffectChoice?.optional).toBe(true);
  });
});
