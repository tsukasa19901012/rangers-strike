import { describe, expect, it } from "vitest";
import { effectiveComboNumber } from "./core/catalog";
import { numberComboTriggers } from "./rules/numberComboEffects";
import { legend3EnemySComboDelta } from "./rules/legend3/fieldEffects";
import { createTestState, inst } from "./testing/fixtures";
import { battleFillers, hasNcLog, legendDefinitions, moveToBattle } from "./testing/battleEntry";

describe("RS-140 data_analysis", () => {
  it("counts Colon on opponent field", () => {
    const colon = inst("RS-140", "colon");
    const state = createTestState({
      definitions: legendDefinitions,
      player2: { rush: [colon] },
    });
    expect(legend3EnemySComboDelta(state, "player1")).toBe(1);
    expect(legend3EnemySComboDelta(state, "player2")).toBe(0);
  });

  it("raises effective CN for own S units when opponent Colon is on field", () => {
    const colon = inst("RS-140", "colon");
    const state = createTestState({
      definitions: legendDefinitions,
      player2: { battle: [colon] },
    });
    expect(effectiveComboNumber(state, "player1", 4, "RS-048")).toBe(5);
    expect(effectiveComboNumber(state, "player1", 4, "TST-UNIT-2")).toBe(4);
  });

  it("triggers NC at raised CN position", () => {
    const colon = inst("RS-140", "colon");
    const ncUnit = inst("RS-048", "nc");
    const state = createTestState({
      definitions: legendDefinitions,
      player2: { rush: [colon] },
    });
    const def = legendDefinitions["RS-048"]!;
    const before = battleFillers(4);
    expect(
      numberComboTriggers(state, "player1", ncUnit, def, 5, before),
    ).toBe(true);
    expect(
      numberComboTriggers(state, "player1", ncUnit, def, 4, battleFillers(3)),
    ).toBe(false);
  });

  it("delays NC trigger while opponent Colon is on field", () => {
    const colon = inst("RS-140", "colon");
    const ncUnit = inst("RS-048", "nc");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: legendDefinitions,
      player1: {
        rush: [ncUnit],
        battle: battleFillers(3),
      },
      player2: { rush: [colon] },
    });

    const atCn4 = moveToBattle(state, ncUnit.instanceId, "player1");
    expect(hasNcLog(atCn4, "grant_sp1")).toBe(false);

    const ncUnit2 = inst("RS-048", "nc2");
    state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: legendDefinitions,
      player1: {
        rush: [ncUnit2],
        battle: battleFillers(4),
      },
      player2: { rush: [colon] },
    });
    const atCn5 = moveToBattle(state, ncUnit2.instanceId, "player1");
    expect(hasNcLog(atCn5, "grant_sp1")).toBe(true);
    expect(atCn5.players.player1.battle.find((c) => c.cardId === "RS-048")?.spModifier).toBe(1);
  });

  it("does not shift NC when Colon is absent", () => {
    const ncUnit = inst("RS-048", "nc");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: legendDefinitions,
      player1: {
        rush: [ncUnit],
        battle: battleFillers(3),
      },
    });

    const atCn4 = moveToBattle(state, ncUnit.instanceId, "player1");
    expect(hasNcLog(atCn4, "grant_sp1")).toBe(true);
  });
});
