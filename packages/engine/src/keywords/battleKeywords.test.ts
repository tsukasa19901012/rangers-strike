import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import {
  applyHoldForWing,
  blastBypassesRushAdditionalCondition,
  breakerBlocksSameNameRush,
  canHoldForWing,
  canWingAttackFromRush,
  crossAdjustedBattlePosition,
  crossValueForCard,
  scrumBlocksAttack,
  taxisSpFloor,
  wingTurnBlocksStrike,
} from "./battleKeywords";
import { canStrikeUnit } from "../rules/combo";
import { addTurnRestrictionModifier } from "../core/scopedModifiers";
import { RESTRICTION_IDS } from "../types/scopedModifiers";

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
        comboNumber: 3,
        text: "※スクラム",
      },
      {
        id: "TST-NEXT",
        name: "Next",
        type: "unit",
        category: "MA",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        bp: 1000,
        size: "S",
        comboNumber: 4,
      },
      {
        id: "TST-LEFT",
        name: "Left",
        type: "unit",
        category: "MA",
        rarity: "N",
        expansion: "test",
        powerCost: 1,
        bp: 1000,
        size: "S",
        comboNumber: 2,
      },
    ],
  ]);

  it("blocks attack when adjacent right unit has CN + 1", () => {
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [
            inst("TST-LEFT", "left"),
            inst("TST-SCRUM", "s"),
            inst("TST-NEXT", "next"),
          ],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[1]!.instanceId),
    ).toBe(true);
  });

  it("does not block when ascending line exists but adjacent CN+1 is missing", () => {
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [
            inst("TST-LEFT", "left"),
            inst("TST-SCRUM", "s"),
          ],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[1]!.instanceId),
    ).toBe(false);
  });

  it("does not block when right neighbor CN is not +1", () => {
    const wrongNext = inst("TST-LEFT", "wrong");
    const state = {
      ...createTestState(defs),
      definitions: defs,
      players: {
        ...createTestState(defs).players,
        player2: {
          ...createTestState(defs).players.player2,
          battle: [inst("TST-SCRUM", "s"), wrongNext],
        },
      },
    };

    expect(
      scrumBlocksAttack(state, "player2", state.players.player2.battle[0]!.instanceId),
    ).toBe(false);
  });
});

describe("wing keyword", () => {
  const WING_DEF: CardDefinition = {
    id: "TST-WING",
    name: "Wing Unit",
    type: "unit",
    category: "OT",
    rarity: "N",
    expansion: "test",
    powerCost: 3,
    bp: 5000,
    sp: 1,
    size: "M",
    tags: ["wing"],
  };

  it("requires hold before wing attack from rush", () => {
    const wingUnit = inst("TST-WING", "w1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;

    expect(canHoldForWing(state, "player1", wingUnit)).toBe(true);
    expect(canWingAttackFromRush(state, "player1", wingUnit)).toBe(false);

    const held = applyHoldForWing(state, "player1", wingUnit.instanceId);
    expect(held).not.toBeNull();
    const heldUnit = held!.players.player1.rush[0]!;
    expect(heldUnit.commandHeld).toBe(true);
    expect(canWingAttackFromRush(held!, "player1", heldUnit)).toBe(true);
  });

  it("blocks strike on wing turn after hold", () => {
    const wingUnit = { ...inst("TST-WING", "w1"), commandHeld: true };
    const state = createTestState({
      phase: "battle",
      player1: { battle: [wingUnit] },
    });
    state.definitions["TST-WING"] = WING_DEF;
    state.players.player1 = addTurnRestrictionModifier(
      state.players.player1,
      wingUnit.instanceId,
      RESTRICTION_IDS.WING_TURN_NO_STRIKE,
    );
    expect(wingTurnBlocksStrike(state.players.player1, wingUnit.instanceId)).toBe(true);
    expect(canStrikeUnit(state.definitions, wingUnit, state, "player1")).toBe(false);
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
