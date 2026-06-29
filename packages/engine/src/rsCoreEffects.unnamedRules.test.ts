import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { generatedCorePlayableCatalog as corePlayableCatalog } from "@rangers-strike/cards";
import { unitEffectiveCategories } from "./core/catalog";
import { canStrikeUnit } from "./rules/combo";
import {
  promotedAttackerCannotTarget,
  promotedDefenderBlocksAttack,
} from "./dsl/promotedKeywordBridge";
import { canAttackDefender } from "./rules/legend3/restrictions";
import { wingCanAttackEnemyRush } from "./keywords";
import { canMoveUnitToBattle } from "./rules/restrictions";
import { applyReanimate } from "./rules/reanimate";
import { createTestState, inst, TEST_DEFINITIONS } from "./testing/fixtures";

const defs: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(corePlayableCatalog.cards.map((card) => [card.id, card])),
};

describe("unnamed field rules", () => {
  it("no_attack_from_s blocks S attackers (RS-486)", () => {
    const defender = inst("RS-486", "def");
    const attacker = inst("TST-UNIT-0", "s-atk");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [defender] },
      player2: { battle: [attacker] },
    });
    expect(
      promotedDefenderBlocksAttack(
        state,
        "player2",
        attacker.instanceId,
        "player1",
        defender.instanceId,
      ),
    ).toBe(true);
  });

  it("no_attack_from_enemy_s blocks enemy S attackers (XG1-070)", () => {
    const defender = inst("XG1-070", "def");
    const attacker = inst("TST-UNIT-0", "s-atk");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [defender] },
      player2: { battle: [attacker] },
    });
    expect(
      promotedDefenderBlocksAttack(
        state,
        "player2",
        attacker.instanceId,
        "player1",
        defender.instanceId,
      ),
    ).toBe(true);
  });

  it("cannot_attack_non_da blocks non-DA targets (RS-640)", () => {
    const attacker = inst("RS-640", "atk");
    const defender = inst("TST-UNIT-0", "wb-def");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    expect(
      promotedAttackerCannotTarget(
        state,
        "player1",
        attacker.instanceId,
        "player2",
        defender.instanceId,
      ),
    ).toBe(true);
  });

  it("cannot_attack_s blocks S defenders (RM-026)", () => {
    const attacker = inst("RM-026", "atk");
    const defender = inst("TST-UNIT-0", "s-def");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    expect(
      promotedAttackerCannotTarget(
        state,
        "player1",
        attacker.instanceId,
        "player2",
        defender.instanceId,
      ),
    ).toBe(true);
  });

  it("cannot_attack_enemy_battle blocks battle defenders (RS-479)", () => {
    const attacker = inst("RS-479", "atk");
    const defender = inst("TST-UNIT-1", "m-def");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    expect(
      promotedAttackerCannotTarget(
        state,
        "player1",
        attacker.instanceId,
        "player2",
        defender.instanceId,
      ),
    ).toBe(true);
  });

  it("wing_attack_enemy_rush allows attacking enemy rush (RS-479)", () => {
    const attacker = inst("RS-479", "atk");
    const defender = inst("TST-UNIT-0", "s-rush");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { rush: [defender] },
    });
    expect(wingCanAttackEnemyRush(state, "player1", attacker.cardId)).toBe(true);
    expect(
      canAttackDefender(state, "player1", attacker.instanceId, "player2", defender.instanceId),
    ).toBe(true);
  });

  it("category_wb_in_battle adds WB in battle (RS-361)", () => {
    const unit = inst("RS-361", "bal");
    const state = createTestState({
      definitions: defs,
      player1: { battle: [unit] },
    });
    const cats = unitEffectiveCategories(state, "player1", unit, "battle");
    expect(cats).toContain("WB");
  });

  it("no_strike_with_held_command blocks strike when holding command (RS-636)", () => {
    const unit = inst("RS-636", "nej");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [unit],
        command: [{ ...inst("TST-OP-OT", "held"), commandHeld: true }],
      },
    });
    expect(canStrikeUnit(defs, unit, state, "player1")).toBe(false);
  });

  it("needs_ally_s_in_battle requires ally S (RS-114)", () => {
    const horse = inst("RS-114", "horse");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      player1: { rush: [horse], battle: [] },
    });
    expect(canMoveUnitToBattle(state, "player1", horse, "rush")).toBe(false);
  });

  it("rush_from_hand_only blocks reanimate from discard to rush (XP-017)", () => {
    const card = inst("XP-017", "rush-only");
    const state = createTestState({
      definitions: defs,
      player1: { discard: [card] },
    });
    const after = applyReanimate(state, {
      playerId: "player1",
      instanceId: card.instanceId,
      from: "discard",
      to: "rush",
    });
    expect(after.players.player1.rush).toHaveLength(0);
    expect(after.players.player1.discard).toHaveLength(1);
  });
});
