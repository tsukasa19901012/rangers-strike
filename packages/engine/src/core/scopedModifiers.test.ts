import { describe, expect, it } from "vitest";
import type { PlayerState } from "../types/game";
import { TURN_RULE_IDS } from "../types/scopedModifiers";
import {
  addTurnRuleModifier,
  clearTurnScopedModifiers,
  hasTurnRuleModifier,
} from "./scopedModifiers";
import { clearTurnModifiers } from "./modifiers";
import { applyAction } from "./applyAction";
import { createTestState, inst } from "../testing/fixtures";

function emptyPlayer(): PlayerState {
  return {
    id: "player1",
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    exile: [],
    commander: [],
    damage: 0,
  };
}

describe("scopedModifiers", () => {
  it("adds and detects turn rule modifiers", () => {
    let player = emptyPlayer();
    expect(hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB)).toBe(false);

    player = addTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB, { sourceCardId: "RS-110" });
    expect(hasTurnRuleModifier(player, TURN_RULE_IDS.ZENIBOMB)).toBe(true);
    expect(player.modifiers).toHaveLength(1);
    expect(player.modifiers?.[0]).toMatchObject({
      kind: "rule",
      ruleId: "zenibomb",
      scope: "turn",
      sourceCardId: "RS-110",
    });
  });

  it("does not duplicate the same turn rule modifier", () => {
    const once = addTurnRuleModifier(emptyPlayer(), TURN_RULE_IDS.INFINITE_CHAIN);
    const twice = addTurnRuleModifier(once, TURN_RULE_IDS.INFINITE_CHAIN);
    expect(twice.modifiers).toHaveLength(1);
  });

  it("clears turn-scoped modifiers on turn end", () => {
    const player = addTurnRuleModifier(
      addTurnRuleModifier(emptyPlayer(), TURN_RULE_IDS.DEACE_SNIPER),
      TURN_RULE_IDS.SUPER_DYNAMITE,
    );
    const cleared = clearTurnScopedModifiers(player);
    expect(cleared.modifiers).toBeUndefined();
    expect(hasTurnRuleModifier(cleared, TURN_RULE_IDS.DEACE_SNIPER)).toBe(false);
  });

  it("clearTurnModifiers also clears scoped turn rules", () => {
    const player = addTurnRuleModifier(emptyPlayer(), TURN_RULE_IDS.INFINITE_CHAIN);
    const cleared = clearTurnModifiers(player);
    expect(hasTurnRuleModifier(cleared, TURN_RULE_IDS.INFINITE_CHAIN)).toBe(false);
  });
});

describe("turn end cleanup", () => {
  it("clears this-turn BP modifiers on both players' units (page-588 Q1)", () => {
    const state = createTestState({
      phase: "end",
      activePlayer: "player1",
      player1: { battle: [{ ...inst("TST-OP", "own"), bpModifier: 2000 }] },
      player2: { battle: [{ ...inst("TST-OP", "enemy"), bpModifier: -1000 }] },
    });
    const result = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayer).toBe("player2");
    expect(result.state.players.player1.battle[0]?.bpModifier).toBeUndefined();
    expect(result.state.players.player2.battle[0]?.bpModifier).toBeUndefined();
  });
});
