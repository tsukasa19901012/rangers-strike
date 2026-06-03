import { describe, expect, it } from "vitest";
import { ZORD_CONDITIONS } from "@rangers-strike/cards";
import { getBattleEntryHoldCount } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { legendDefinitions } from "./testing/battleEntry";
import { createTestState, inst } from "./testing/fixtures";
import {
  advanceToBattlePhase,
  buildZordRushSetup,
  commandCardIdForCategories,
  executeBattleFromEntry,
  executeStrikeFromEntry,
  expectBattleEntryCombatOptions,
  findRushLegalAction,
  moveToBattleWithHolds,
  powerCards,
  rushUnitWithCategoryPayment,
  settleReactiveWindows,
  unwrapAction,
} from "./testing/gameplayFlow";

const ZORD_IDS = Object.keys(ZORD_CONDITIONS);

describe("gameplay flow integration", () => {
  describe("rush with additional conditions (zord-up)", () => {
    it.each(ZORD_IDS)(
      "rushes %s when zord additional condition is satisfied",
      (zordCardId) => {
        const setup = buildZordRushSetup(legendDefinitions, zordCardId);
        expect(setup, `setup failed for ${zordCardId}`).not.toBeNull();
        if (!setup) return;

        const afterRush = rushUnitWithCategoryPayment(
          setup.state,
          "player1",
          setup.zordInstanceId,
          setup.commandInstanceId,
          setup.payment,
        );
        const rushed = settleReactiveWindows(afterRush);

        expect(
          rushed.players.player1.rush.some((c) => c.instanceId === setup.zordInstanceId),
        ).toBe(true);
        expect(rushed.players.player1.hand.some((c) => c.instanceId === setup.zordInstanceId)).toBe(
          false,
        );
      },
    );

    it("lists legal rush or payment after category hold for RS-045", () => {
      const setup = buildZordRushSetup(legendDefinitions, "RS-045");
      expect(setup).not.toBeNull();
      if (!setup) return;

      const paid = rushUnitWithCategoryPayment(
        setup.state,
        "player1",
        setup.zordInstanceId,
        setup.commandInstanceId,
        setup.payment,
      );
      const actions = getLegalActions(settleReactiveWindows(paid));
      const canRushAgain = actions.some(
        (a) =>
          a.type === "rush" ||
          (a.type === "initiate_command_payment" && a.kind === "category_use"),
      );
      expect(canRushAgain).toBe(false);
    });
  });

  describe("rush without zord additional cost", () => {
    it("rushes a standard unit after per-rush command payment", () => {
      const unit = inst("TST-UNIT-2", "u");
      const cmd = inst("TST-OP", "cmd");
      const state = createTestState({
        phase: "rush",
        player1: {
          hand: [unit],
          power: powerCards(3),
          command: [cmd],
        },
      });

      const after = rushUnitWithCategoryPayment(
        state,
        "player1",
        unit.instanceId,
        cmd.instanceId,
      );
      expect(after.players.player1.rush).toHaveLength(1);
      expect(findRushLegalAction(after, unit.instanceId)).toBeUndefined();
    });
  });

  describe("battle entry when hold requirements are met", () => {
    it("moves a unit without ※ directly from rush to battle", () => {
      const unit = inst("TST-UNIT-0", "r");
      let state = createTestState({
        phase: "battle",
        player1: { rush: [unit] },
      });

      state = unwrapAction(
        applyAction(state, {
          type: "move_to_battle",
          playerId: "player1",
          instanceId: unit.instanceId,
        }),
      );

      expect(state.players.player1.battle).toHaveLength(1);
      expect(state.players.player1.rush).toHaveLength(0);
    });

    it("moves RS-052 to battle after rush payment and ※ battle-entry hold", () => {
      expect(getBattleEntryHoldCount("RS-052")).toBeGreaterThan(0);

      const unit = inst("RS-052", "u");
      const rushCmd = inst("TST-OP", "rush-cmd");
      const entryCmd = inst("TST-OP", "entry-cmd");

      let state = createTestState({
        definitions: legendDefinitions,
        phase: "rush",
        player1: {
          hand: [unit],
          power: powerCards(3),
          command: [rushCmd, entryCmd],
        },
      });

      state = rushUnitWithCategoryPayment(
        state,
        "player1",
        unit.instanceId,
        rushCmd.instanceId,
      );
      state = advanceToBattlePhase(settleReactiveWindows(state));

      expect(state.phase).toBe("battle");
      state = moveToBattleWithHolds(
        state,
        "player1",
        unit.instanceId,
        entryCmd.instanceId,
      );
      state = settleReactiveWindows(state);

      expect(state.players.player1.battle.some((c) => c.instanceId === unit.instanceId)).toBe(
        true,
      );
    });
  });

  describe("battle and strike after conditions are satisfied", () => {
    function standardUnitAtBattleEntry() {
      const attacker = inst("TST-UNIT-2", "atk");
      const defender = inst("TST-UNIT-0", "def");
      const rushCmd = inst("TST-OP", "rush-cmd");

      let state = createTestState({
        phase: "rush",
        player1: {
          hand: [attacker],
          power: powerCards(3),
          command: [rushCmd],
        },
        player2: { battle: [defender] },
      });

      state = rushUnitWithCategoryPayment(
        state,
        "player1",
        attacker.instanceId,
        rushCmd.instanceId,
      );
      state = advanceToBattlePhase(settleReactiveWindows(state));
      state = moveToBattleWithHolds(state, "player1", attacker.instanceId, rushCmd.instanceId);
      return { state, attacker, defender };
    }

    it("offers battle and strike on battle entry for a standard unit", () => {
      const { state, attacker, defender } = standardUnitAtBattleEntry();
      expectBattleEntryCombatOptions(
        state,
        attacker.instanceId,
        defender.instanceId,
      );
    });

    it("attacks on battle entry for a standard unit", () => {
      const { state, attacker, defender } = standardUnitAtBattleEntry();
      executeBattleFromEntry(state, attacker.instanceId, defender.instanceId);
    });

    it("strikes on battle entry for a standard unit", () => {
      const { state, attacker, defender } = standardUnitAtBattleEntry();
      expectBattleEntryCombatOptions(
        state,
        attacker.instanceId,
        defender.instanceId,
      );
      executeStrikeFromEntry(state, attacker.instanceId);
    });

    it("attacks after full zord rush flow (RS-045)", () => {
      const setup = buildZordRushSetup(legendDefinitions, "RS-045");
      expect(setup).not.toBeNull();
      if (!setup) return;

      const defender = inst("TST-UNIT-0", "def");
      const entryCmd = inst("TST-OP-OT", "entry-cmd");

      let state = createTestState({
        definitions: legendDefinitions,
        phase: "rush",
        player1: {
          ...setup.state.players.player1,
          command: [...setup.state.players.player1.command, entryCmd],
        },
        player2: { battle: [defender] },
      });

      state = rushUnitWithCategoryPayment(
        state,
        "player1",
        setup.zordInstanceId,
        setup.commandInstanceId,
        setup.payment,
      );
      state = advanceToBattlePhase(settleReactiveWindows(state));

      const zordInRush = state.players.player1.rush.find(
        (c) => c.instanceId === setup.zordInstanceId,
      );
      expect(zordInRush).toBeDefined();
      if (!zordInRush) return;

      state = moveToBattleWithHolds(
        state,
        "player1",
        setup.zordInstanceId,
        entryCmd.instanceId,
      );

      const zordInBattle = state.players.player1.battle.find(
        (c) => c.instanceId === setup.zordInstanceId,
      );
      expect(zordInBattle).toBeDefined();
      if (!zordInBattle) return;

      expectBattleEntryCombatOptions(
        state,
        setup.zordInstanceId,
        defender.instanceId,
        { expectStrike: false },
      );
      executeBattleFromEntry(state, setup.zordInstanceId, defender.instanceId);
    });
  });
});
