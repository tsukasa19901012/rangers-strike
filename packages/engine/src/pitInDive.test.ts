import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { startPitInDiveOrderChoice } from "./rules/pendingChoices";
import { createTestState, inst } from "./testing/fixtures";

const smallRushDef = {
  id: "E-S",
  name: "Small Rush",
  type: "unit" as const,
  category: "WB" as const,
  rarity: "N" as const,
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S" as const,
};

describe("RS-049 pit_in_dive", () => {
  it("opens optional order choice for enemy rush S units", () => {
    const source = inst("RS-049", "source");
    const enemy = inst("E-S", "enemy");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [source] },
      player2: { rush: [enemy] },
    });
    state.definitions["E-S"] = smallRushDef;

    const withChoice = startPitInDiveOrderChoice(
      state,
      "player1",
      "RS-049",
      source.instanceId,
    );
    expect(withChoice?.pendingEffectChoice?.optional).toBe(true);
    expect(withChoice?.pendingEffectChoice?.validInstanceIds).toEqual([enemy.instanceId]);
  });

  it("allows skipping without moving enemy rush units", () => {
    const source = inst("RS-049", "source");
    const enemy = inst("E-S", "enemy");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [source] },
      player2: { rush: [enemy] },
    });
    state.definitions["E-S"] = smallRushDef;

    const withChoice = startPitInDiveOrderChoice(
      state,
      "player1",
      "RS-049",
      source.instanceId,
    )!;
    const actions = getLegalActions(withChoice);
    expect(actions.some((a) => a.type === "skip_effect_choice")).toBe(true);

    const skipped = applyAction(withChoice, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.pendingEffectChoice).toBeUndefined();
    expect(skipped.state.players.player2.rush).toHaveLength(1);
    expect(skipped.state.players.player2.battle).toHaveLength(0);
  });
});
