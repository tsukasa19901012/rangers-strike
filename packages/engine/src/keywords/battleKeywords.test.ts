import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import {
  blastBypassesRushAdditionalCondition,
  breakerBlocksSameNameRush,
  crossAdjustedBattlePosition,
  crossValueForCard,
  scrumBlocksAttack,
  taxisSpFloor,
} from "./battleKeywords";

describe("cross1 keyword", () => {
  it("shifts battle position for units to the right of cross holder", () => {
    const cross = inst("XG7-013", "c1");
    const follower = inst("TST-FOLLOW", "f1");
    const battle = [cross, follower];
    expect(crossValueForCard("XG7-013")).toBeGreaterThan(0);
    expect(crossAdjustedBattlePosition(battle, follower.instanceId)).toBe(1);
  });
});

describe("taxis keyword", () => {
  it("grants SP1 to the next matching-category unit", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-F1",
          name: "F1",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
        {
          id: "TST-F2",
          name: "F2",
          type: "unit",
          category: "WB",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
        {
          id: "TST-OT",
          name: "OT Unit",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
      ],
    ]);

    const filler1 = inst("TST-F1", "1");
    const filler2 = inst("TST-F2", "2");
    const taxis = inst("XG7-013", "t");
    const ot = inst("TST-OT", "o");

    const state = {
      ...createTestState(defs),
      definitions: { ...defs, ...createTestState().definitions },
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          battle: [filler1, filler2, taxis, ot],
        },
      },
    };

    expect(taxisSpFloor(state, "player1", ot)).toBe(1);
  });
});

describe("scrum keyword", () => {
  it("blocks attack when battle CN is ascending", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-SCRUM",
          name: "Scrum Unit",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "test",
          powerCost: 2,
          bp: 2000,
          size: "S",
          comboNumber: 4,
          text: "※スクラム",
        },
        {
          id: "TST-A",
          name: "A",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
          comboNumber: 2,
        },
        {
          id: "TST-B",
          name: "B",
          type: "unit",
          category: "MA",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
          comboNumber: 3,
        },
      ],
    ]);

    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [inst("TST-A", "a"), inst("TST-B", "b"), inst("TST-SCRUM", "s")],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[2]!.instanceId),
    ).toBe(true);
  });
});

describe("blast keyword", () => {
  it("bypasses additional conditions at one face-up power remaining", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-BLAST",
          name: "Blast Zord",
          type: "unit",
          category: "WB",
          rarity: "SR",
          expansion: "test",
          powerCost: "7+",
          bp: 12000,
          size: "L",
          text: "※ブラスト",
        },
      ],
    ]);

    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player1: {
          ...createTestState(defs).players.player1,
          power: [
            { ...inst("TST-P1", "p1"), faceDown: true },
            { ...inst("TST-P2", "p2"), faceDown: true },
            { ...inst("TST-P3", "p3"), faceDown: true },
            { ...inst("TST-P4", "p4"), faceDown: true },
            { ...inst("TST-P5", "p5"), faceDown: true },
            inst("TST-P6", "p6"),
          ],
        },
      },
    };

    expect(blastBypassesRushAdditionalCondition(state, "player1", "TST-BLAST")).toBe(true);
  });
});

describe("breaker keyword", () => {
  it("blocks rushing a second breaker copy of the same name", () => {
    const defs = buildDefinitionMap([
      [
        {
          id: "TST-BREAKER",
          name: "Breaker Unit",
          type: "unit",
          category: "ET",
          rarity: "SR",
          expansion: "test",
          powerCost: 5,
          bp: 8000,
          size: "L",
          text: "※ブレイカー",
        },
      ],
    ]);

    const player = {
      ...createTestState(defs).players.player1,
      rush: [inst("TST-BREAKER", "on-field")],
    };

    expect(breakerBlocksSameNameRush(player, defs, "TST-BREAKER")).toBe(true);
  });
});
