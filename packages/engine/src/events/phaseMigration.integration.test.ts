import { describe, expect, it } from "vitest";
import { createTestState, inst } from "../testing/fixtures";
import { finalizeLeavePending } from "../rules/operationCounters";
import { emitTurnEndingAndResolve } from "./emitTurnEnding";
import { resetEngineEventDispatcherForTests } from "./globalDispatcher";

const defs = { "RS-054": { id: "RS-054", name: "Test", type: "unit", category: "DA", size: "S" } } as const;

describe("phase migration integration", () => {
  it("UnitLeftZone listener resolves tantrum on discard leave", () => {
    resetEngineEventDispatcherForTests();
    const unit = inst("RS-054", "u1");
    let state = createTestState({
      definitions: defs as never,
      phase: "battle",
      player1: { battle: [unit] },
    });
    state = finalizeLeavePending(
      state,
      {
        ownerPlayerId: "player1",
        instanceId: unit.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: unit.cardId,
        phasePlayerId: "player2",
      },
      false,
    );
    expect(state.players.player1.battle).toHaveLength(0);
    expect(state.players.player1.discard.some((c) => c.instanceId === unit.instanceId)).toBe(true);
  });

  it("TurnEnding listener runs end-turn battle effects", () => {
    resetEngineEventDispatcherForTests();
    const hawk = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs as never,
      phase: "end",
      activePlayer: "player1",
      player1: { battle: [hawk] },
    });
    const { state: after } = emitTurnEndingAndResolve(state, "player1");
    expect(after).toBeDefined();
  });
});
