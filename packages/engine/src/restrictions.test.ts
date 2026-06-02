import { describe, expect, it } from "vitest";
import { buildAbarenohDeck } from "@rangers-strike/cards";
import {
  explainCannotEnterBattle,
  canMoveUnitToBattle,
  getLightningGravityHoldNotice,
} from "./rules/restrictions";
import { getBattleEntryHoldCount } from "@rangers-strike/cards";
import { getLegalActions } from "./core/legalActions";
import { applyAction } from "./core/applyAction";
import { createTestState, inst } from "./testing/fixtures";
import { legendDefinitions } from "./testing/battleEntry";

describe("explainCannotEnterBattle", () => {
  it("returns null when the unit can enter battle", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [unit] },
    });

    expect(canMoveUnitToBattle(state, "player1", unit, "rush")).toBe(true);
    expect(explainCannotEnterBattle(state, "player1", unit, "rush")).toBeNull();
  });

  it("explains pat signer blocking high-BP M units", () => {
    const mUnit = inst("RS-043", "pat");
    const signer = inst("RS-047", "signer");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: { rush: [mUnit] },
      player2: { battle: [signer] },
    });

    const reason = explainCannotEnterBattle(state, "player1", mUnit, "rush");
    expect(reason).toContain("進入禁止サインボード");
    expect(reason).toContain("BP5000以上");
  });

  it("explains missing held commands for M units under lightning gravity", () => {
    const mUnit = inst("RS-043", "pat");
    const gravity = inst("RS-069", "lg");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [gravity],
        command: [],
      },
    });

    const reason = explainCannotEnterBattle(state, "player1", mUnit, "rush");
    expect(reason).toContain("稲妻重力エネルギー");
    expect(reason).toContain("必要1枚");
  });

  it("returns lightning gravity hold notice for blocked M unit", () => {
    const mUnit = inst("RS-043", "pat");
    const gravity = inst("RS-069", "lg");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [gravity],
        command: [],
      },
    });

    expect(getLightningGravityHoldNotice(state, "player1", mUnit)).toEqual({
      unitName: "パトストライカー",
      requiredHolds: 1,
      heldHolds: 0,
      lightningGravityCount: 1,
      unitHoldCount: 0,
    });
  });

  it("blocks generic M unit under RS-069 without a held command", () => {
    const mUnit = inst("RS-043", "pat");
    const gravity = inst("RS-069", "lg");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [gravity],
        command: [{ ...inst("RS-007", "c1"), commandHeld: false }],
      },
    });

    expect(canMoveUnitToBattle(state, "player1", mUnit, "rush")).toBe(false);
    expect(
      getLegalActions(state).filter((a) => a.type === "move_to_battle"),
    ).toHaveLength(0);
    expect(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: mUnit.instanceId,
      }).ok,
    ).toBe(false);
  });

  it("blocks generic M under RS-069 when unit definition omits size", () => {
    const mUnit = inst("RS-043", "pat");
    const gravity = inst("RS-069", "lg");
    const defs = { ...legendDefinitions };
    defs["RS-043"] = { ...defs["RS-043"]!, size: undefined };
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [gravity],
        command: [],
      },
    });

    expect(canMoveUnitToBattle(state, "player1", mUnit, "rush")).toBe(false);
  });

  it("ignores RS-069 on field when blocked by infinite chain", () => {
    const mUnit = inst("RS-043", "pat");
    const gravity = inst("RS-069", "lg");
    let state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [mUnit],
        operation: [gravity],
        command: [],
      },
      player2: {
        turnModifiers: { infiniteChainActive: true },
      },
    });

    expect(canMoveUnitToBattle(state, "player1", mUnit, "rush")).toBe(true);
  });

  it("explains ally S requirement for RS-114", () => {
    const barikyon = inst("RS-114", "horse");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: { rush: [barikyon], battle: [] },
    });

    const reason = explainCannotEnterBattle(state, "player1", barikyon, "rush");
    expect(reason).toContain("Sユニット");
  });

  it("explains traffic control size restriction", () => {
    const sUnit = inst("RS-054", "s1");
    const mUnit = inst("RS-043", "pat");
    const traffic = inst("RS-086", "traffic");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [mUnit],
        battle: [sUnit],
      },
      player2: { battle: [traffic] },
    });

    const reason = explainCannotEnterBattle(state, "player1", mUnit, "rush");
    expect(reason).toContain("交通整理");
    expect(reason).toContain("S");
  });

  it("explains zenibomb blocking newly rushed units", () => {
    const unit = inst("RS-054", "s1");
    let state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [unit],
      },
    });
    state = {
      ...state,
      players: {
        ...state.players,
        player1: {
          ...state.players.player1,
          turnModifiers: {
            ...state.players.player1.turnModifiers,
            rushedThisTurnInstanceIds: [unit.instanceId],
            zenibombActive: true,
          },
        },
      },
    };

    const reason = explainCannotEnterBattle(state, "player1", unit, "rush");
    expect(reason).toContain("ゼニボム");
  });
});

const BATTLE_ENTRY_HOLD_CARDS = [
  "RS-035",
  "RS-036",
  "RS-037",
  "RS-038",
  "RS-039",
  "RS-051",
  "RS-052",
  "RS-053",
] as const;

describe("battle entry hold requirements", () => {
  it("detects RS-052/053 hold from catalog card text", () => {
    expect(getBattleEntryHoldCount("RS-052")).toBe(1);
    expect(getBattleEntryHoldCount("RS-053")).toBe(1);
  });

  it("blocks RS-052 without hold using abarenoh deck definitions", () => {
    const deckDefs = Object.fromEntries(
      buildAbarenohDeck().map((card) => [card.id, card]),
    );
    const unit = inst("RS-052", "tricera");
    const state = createTestState({
      definitions: deckDefs,
      phase: "battle",
      player1: {
        rush: [unit],
        command: [{ ...inst("RS-007", "cmd"), commandHeld: false }],
      },
    });

    expect(canMoveUnitToBattle(state, "player1", unit, "rush")).toBe(false);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "move_to_battle" && a.instanceId === unit.instanceId,
      ),
    ).toBe(false);
  });

  it.each(BATTLE_ENTRY_HOLD_CARDS)(
    "blocks %s without a held command",
    (cardId) => {
      const unit = inst(cardId, "u1");
      const state = createTestState({
        definitions: legendDefinitions,
        phase: "battle",
        player1: {
          rush: [unit],
          command: [{ ...inst("RS-007", "c1"), commandHeld: false }],
        },
      });

      expect(canMoveUnitToBattle(state, "player1", unit, "rush")).toBe(false);
      expect(explainCannotEnterBattle(state, "player1", unit, "rush")).toContain("ホールド");
      expect(
        getLegalActions(state).filter((a) => a.type === "move_to_battle"),
      ).toHaveLength(0);
      expect(
        applyAction(state, {
          type: "move_to_battle",
          playerId: "player1",
          instanceId: unit.instanceId,
        }).ok,
      ).toBe(false);
    },
  );

  it.each(BATTLE_ENTRY_HOLD_CARDS)(
    "allows %s with a held command",
    (cardId) => {
      const unit = inst(cardId, "u1");
      const state = createTestState({
        definitions: legendDefinitions,
        phase: "battle",
        player1: {
          rush: [unit],
          command: [{ ...inst("RS-007", "c1"), commandHeld: true }],
        },
      });

      expect(canMoveUnitToBattle(state, "player1", unit, "rush")).toBe(true);
    },
  );

  it.each(BATTLE_ENTRY_HOLD_CARDS)(
    "consumes held command when %s enters battle",
    (cardId) => {
      const unit = inst(cardId, "u1");
      const state = createTestState({
        definitions: legendDefinitions,
        phase: "battle",
        player1: {
          rush: [unit],
          command: [{ ...inst("RS-007", "c1"), commandHeld: true }],
        },
      });

      const result = applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: unit.instanceId,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.players.player1.command[0]?.commandHeld).toBe(false);
    },
  );

  it("requires a new hold for each fusion unit (RS-051 then RS-052)", () => {
    const tyranno = inst("RS-051", "t1");
    const tricera = inst("RS-052", "t2");
    let state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [tyranno, tricera],
        command: [{ ...inst("RS-007", "c1"), commandHeld: true }],
      },
    });

    const first = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: tyranno.instanceId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;

    const passed = applyAction(state, {
      type: "pass_battle_entry",
      playerId: "player1",
    });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    state = passed.state;

    expect(canMoveUnitToBattle(state, "player1", tricera, "rush")).toBe(false);
    expect(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: tricera.instanceId,
      }).ok,
    ).toBe(false);
  });

  it.each(BATTLE_ENTRY_HOLD_CARDS)(
    "blocks %s without hold even when definition size is missing",
    (cardId) => {
      const unit = inst(cardId, "u1");
      const defs = { ...legendDefinitions };
      const base = defs[cardId]!;
      defs[cardId] = { ...base, size: undefined };
      const state = createTestState({
        definitions: defs,
        phase: "battle",
        player1: {
          rush: [unit],
          command: [],
        },
      });

      expect(canMoveUnitToBattle(state, "player1", unit, "rush")).toBe(false);
    },
  );
});
