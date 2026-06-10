import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { createTestState, inst } from "../testing/fixtures";
import { tryResolveDslTriggeredEffects } from "./triggerResolver";

const defs = Object.fromEntries(legend1Catalog.cards.map((c) => [c.id, c]));

describe("dsl trigger resolver — L1 unit effects", () => {
  it("RS-046 armor_attack opens DSL choose on rush", () => {
    const unit = inst("RS-046", "rush-unit");
    const enemy = inst("RS-048", "enemy");
    const state = createTestState({
      phase: "rush",
      definitions: defs,
      player2: {
        battle: [enemy],
      },
      player1: {
        rush: [unit],
      },
    });

    const result = tryResolveDslTriggeredEffects({
      state,
      cardId: "RS-046",
      instanceId: unit.instanceId,
      playerId: "player1",
      phasePlayerId: "player1",
      triggerType: "on_rush",
    });

    expect(result.handled).toBe(true);
    expect(result.state.pendingEffectChoice?.effectId).toBe("armor_attack");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(enemy.instanceId);
  });

  it("RS-050 destroy_enemy_bp4000 opens DSL choose on enter battle", () => {
    const unit = inst("RS-050", "zord");
    const enemy = inst("RS-048", "enemy");
    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        battle: [unit],
      },
      player2: {
        battle: [enemy],
      },
    });

    const result = tryResolveDslTriggeredEffects({
      state,
      cardId: "RS-050",
      instanceId: unit.instanceId,
      playerId: "player1",
      phasePlayerId: "player1",
      triggerType: "enter_battle",
    });

    expect(result.handled).toBe(true);
    expect(result.state.pendingEffectChoice?.effectId).toBe("destroy_enemy_bp4000");
    expect(result.state.pendingEffectChoice?.validInstanceIds).toContain(enemy.instanceId);
  });
});
