import { describe, expect, it } from "vitest";
import { createTestState, inst } from "../testing/fixtures";
import { tryResolveP0OperationEffect } from "./p0EffectBridge";

describe("p0EffectBridge", () => {
  it("resolves deal_damage_1 via cardInterpreter", () => {
    const state = createTestState({
      player1: { damage: 0 },
      player2: { damage: 0 },
    });
    const outcome = tryResolveP0OperationEffect(
      {
        state,
        playerId: "player1",
        operationCardId: "RS-TEST",
      },
      "deal_damage_1",
    );
    expect(outcome).not.toBeNull();
    expect(outcome!.state.players.player2.damage).toBe(1);
  });

  it("requires target for bp_boost", () => {
    const unit = inst("RS-U", "u1");
    const state = createTestState({
      player1: { battle: [unit] },
    });
    state.definitions["RS-U"] = {
      id: "RS-U",
      name: "Unit",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 1,
      bp: 3000,
      size: "M",
    };

    const noTarget = tryResolveP0OperationEffect(
      { state, playerId: "player1", operationCardId: "RS-OP" },
      "bp_boost_4000",
    );
    expect(noTarget?.detail).toBe("target_required");

    const withTarget = tryResolveP0OperationEffect(
      {
        state,
        playerId: "player1",
        operationCardId: "RS-OP",
        targetInstanceId: unit.instanceId,
      },
      "bp_boost_4000",
    );
    expect(withTarget?.state.players.player1.battle[0]?.bpModifier).toBe(4000);
  });
});
