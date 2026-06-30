import { describe, expect, it } from "vitest";
import { legend2Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { battleDefenderBp } from "./rules/namedUnitEffects";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const DEFINITIONS = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("RK-134 ride-off then battle", () => {
  it("uses printed defender BP for ライダーキック (ignores attacked boost)", () => {
    const rk134 = inst("RK-134", "atk");
    const rk135 = inst("RK-135", "def");
    const state = createTestState({
      phase: "battle",
      definitions: DEFINITIONS,
      player1: { battle: [rk134] },
      player2: { battle: [rk135] },
    });
    const pending = {
      attackerPlayerId: "player1" as const,
      defenderPlayerId: "player2" as const,
      attackerInstanceId: rk134.instanceId,
      defenderInstanceId: rk135.instanceId,
      phasePlayerId: "player1" as const,
    };
    expect(battleDefenderBp(state, pending)).toBe(1000);
  });

  it("clears pendingBattleEntry and allows end_phase after destroying RK-135", () => {
    const vehicleDef = legend2Catalog.cards.find(
      (card) => card.type === "vehicle" && card.expansion === "legend2",
    );
    expect(vehicleDef).toBeDefined();

    const vehicle = inst(vehicleDef!.id, "vehicle");
    const rk134 = inst("RK-134", "r134");
    const rk135 = inst("RK-135", "rk135");
    rk134.mountedOnInstanceId = vehicle.instanceId;

    let state = createTestState({
      phase: "battle",
      definitions: DEFINITIONS,
      player1: {
        rush: [vehicle, rk134],
        power: [
          inst("TST-P1", "p1"),
          inst("TST-P2", "p2"),
          inst("TST-P3", "p3"),
        ],
      },
      player2: { battle: [rk135] },
    });

    state = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: rk134.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, {
        type: "resolve_ride_off_choice",
        playerId: "player1",
        rideOff: true,
      }),
    );

    const defenderId = state.players.player2.battle[0]!.instanceId;
    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: rk134.instanceId,
        defenderInstanceId: defenderId,
      }),
    );

    expect(state.pendingBattleEntry).toBeUndefined();
    expect(state.pendingRegister).toBeUndefined();
    expect(
      state.players.player1.battle.find((c) => c.cardId === "RK-134")?.battleActed,
    ).toBe(true);
    expect(state.players.player2.discard.some((c) => c.cardId === "RK-135")).toBe(true);
    expect(getLegalActions(state).some((a) => a.type === "end_phase")).toBe(true);
  });
});
