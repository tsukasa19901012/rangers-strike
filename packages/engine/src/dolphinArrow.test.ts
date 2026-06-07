import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { applyLegend3NcEffect } from "./rules/legend3/ncEffects";
import { createTestState, inst } from "./testing/fixtures";

describe("dolphin arrow RS-139", () => {
  it("lets the activator choose an enemy held command for enemy power", () => {
    const blueDolphin = inst("RS-139", "attacker");
    const enemyCmd = inst("TST-OP-ET", "enemy-cmd");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [blueDolphin],
      },
      player2: {
        command: [{ ...enemyCmd, commandHeld: true }],
      },
    });
    state.definitions["RS-139"] = {
      id: "RS-139",
      name: "ブルードルフィン",
      type: "unit",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: 1,
    };

    const outcome = applyLegend3NcEffect(state, "player1", blueDolphin, "dolphin_arrow");
    state = outcome.state;

    expect(state.pendingEffectChoice?.playerId).toBe("player1");
    expect(state.pendingEffectChoice?.effectId).toBe("dolphin_arrow");
    expect(state.pendingEffectChoice?.optional).toBe(true);
    expect(state.pendingEffectChoice?.validInstanceIds).toEqual([enemyCmd.instanceId]);

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "resolve_effect_choice" &&
        a.playerId === "player1" &&
        a.instanceId === enemyCmd.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.state.players.player2.power.some((c) => c.instanceId === enemyCmd.instanceId),
    ).toBe(true);
    expect(
      result.state.players.player2.command.some((c) => c.instanceId === enemyCmd.instanceId),
    ).toBe(false);
  });

  it("can skip sending when optional", () => {
    const blueDolphin = inst("RS-139", "attacker");
    const enemyCmd = inst("TST-OP-ET", "enemy-cmd");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [blueDolphin],
      },
      player2: {
        command: [{ ...enemyCmd, commandHeld: true }],
      },
    });
    state.definitions["RS-139"] = {
      id: "RS-139",
      name: "ブルードルフィン",
      type: "unit",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: 1,
    };

    const outcome = applyLegend3NcEffect(state, "player1", blueDolphin, "dolphin_arrow");
    state = outcome.state;

    const skip = getLegalActions(state).find((a) => a.type === "skip_effect_choice");
    expect(skip).toBeDefined();

    const result = applyAction(state, skip!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.pendingEffectChoice).toBeUndefined();
    expect(
      result.state.players.player2.command.some((c) => c.instanceId === enemyCmd.instanceId),
    ).toBe(true);
    expect(result.state.players.player2.power).toHaveLength(0);
  });
});
