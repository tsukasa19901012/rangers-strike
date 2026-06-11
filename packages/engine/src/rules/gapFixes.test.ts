import { describe, expect, it } from "vitest";
import {
  allCategoriesExistInCommandZone,
  effectiveCommandCategories,
} from "../core/catalog";
import { canStrikeUnit } from "./combo";
import { helloMirageActive } from "./helloMirage";
import { getCategoryPaymentOptions } from "./commandPayment";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";

describe("Yogostein effective command categories", () => {
  it("grants DA to power 3 or less commands without printed DA", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "XG1-033",
          name: "害地大臣ヨゴシュタイン",
          type: "unit",
          category: "DA",
          rarity: "N",
          expansion: "legend1",
          powerCost: 4,
          bp: 6000,
          size: "S",
        },
        {
          id: "TST-OP-WB",
          name: "WB Command",
          type: "operation",
          category: "WB",
          rarity: "N",
          expansion: "legend1",
          powerCost: 2,
        },
      ],
    ]);

    const player = {
      ...createTestState(defs).players.player1,
      rush: [inst("XG1-033", "1")],
      command: [inst("TST-OP-WB", "1")],
    };

    expect(effectiveCommandCategories(player, defs, "TST-OP-WB")).toEqual(["WB", "DA"]);
    expect(allCategoriesExistInCommandZone(player, defs, ["WB", "DA"])).toBe(true);
  });
});

describe("Hello Mirage strike restriction", () => {
  it("blocks S unit strike when battle position mismatches category rule", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "RS-407",
          name: "天空大聖者マジエル",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "legend1",
          powerCost: 2,
          bp: 6000,
          size: "L",
          sp: 1,
        },
        {
          id: "TST-UNIT-WB",
          name: "WB S",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
          bp: 1000,
          size: "S",
          sp: 1,
        },
      ],
    ]);

    let state = { ...createTestState(defs), definitions: defs };
    state = {
      ...state,
      players: {
        ...state.players,
        player1: {
          ...state.players.player1,
          rush: [inst("RS-407", "1")],
          battle: [inst("TST-UNIT-WB", "1")],
        },
      },
    };

    const wbUnit = state.players.player1.battle[0]!;
    expect(helloMirageActive(state, "player1")).toBe(true);
    expect(canStrikeUnit(defs, wbUnit, state, "player1")).toBe(false);

    const daDefs = buildDefinitionMap([
      [
        {
          id: "RS-407",
          name: "天空大聖者マジエル",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "legend1",
          powerCost: 2,
          bp: 6000,
          size: "L",
          sp: 1,
        },
        {
          id: "TST-UNIT-DA",
          name: "DA S",
          type: "unit",
          category: "DA",
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
          bp: 1000,
          size: "S",
          sp: 1,
        },
      ],
    ]);
    const daState = {
      ...createTestState(daDefs),
      definitions: daDefs,
      players: {
        ...createTestState(daDefs).players,
        player1: {
          ...createTestState(daDefs).players.player1,
          rush: [inst("RS-407", "1")],
          battle: [inst("TST-UNIT-DA", "1")],
        },
      },
    };
    const daUnit = daState.players.player1.battle[0]!;
    expect(canStrikeUnit(daDefs, daUnit, daState, "player1")).toBe(true);

    const wbAtCorrectPosition = {
      ...daState,
      players: {
        ...daState.players,
        player1: {
          ...daState.players.player1,
          battle: [inst("TST-UNIT-WB", "1"), inst("TST-UNIT-WB", "2")],
        },
      },
    };
    const wbDefs = buildDefinitionMap([
      [
        {
          id: "RS-407",
          name: "天空大聖者マジエル",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "legend1",
          powerCost: 2,
          bp: 6000,
          size: "L",
          sp: 1,
        },
        {
          id: "TST-UNIT-WB",
          name: "WB S",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
          bp: 1000,
          size: "S",
          sp: 1,
        },
      ],
    ]);
    const wbAtTwo = wbAtCorrectPosition.players.player1.battle[1]!;
    expect(
      canStrikeUnit(wbDefs, wbAtTwo, { ...wbAtCorrectPosition, definitions: wbDefs }, "player1"),
    ).toBe(true);
  });
});

describe("Operation category payment options", () => {
  it("offers payment when power is sufficient but command hold is missing", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-OP-WB-ET",
          name: "WB ET Op",
          type: "operation",
          category: ["WB", "ET"],
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
        },
        {
          id: "TST-CMD-WB",
          name: "WB Cmd",
          type: "operation",
          category: "WB",
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
        },
        {
          id: "TST-CMD-ET",
          name: "ET Cmd",
          type: "operation",
          category: "ET",
          rarity: "N",
          expansion: "legend1",
          powerCost: 1,
        },
      ],
    ]);

    const state = createTestState(defs);
    const player = {
      ...state.players.player1,
      hand: [inst("TST-OP-WB-ET", "1")],
      power: [inst("TST-CMD-WB", "p")],
      command: [
        { ...inst("TST-CMD-WB", "1"), commandHeld: false },
        { ...inst("TST-CMD-ET", "1"), commandHeld: false },
      ],
    };
    const gameState = {
      ...state,
      definitions: defs,
      players: { ...state.players, player1: player },
    };

    const options = getCategoryPaymentOptions(gameState, "player1", ["WB", "ET"], {
      perRushPayment: true,
    });
    expect(options).not.toBeNull();
  });
});
