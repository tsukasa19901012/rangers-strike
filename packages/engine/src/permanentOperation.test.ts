import { describe, expect, it } from "vitest";
import { legend2Catalog, resolvePlayableCard } from "@rangers-strike/cards";
import { applyAction } from "./core/applyAction";
import { placePermanentOperation } from "./rules/permanentOperation";
import { resetRushPhaseFlags } from "./rules/turnModifiers";
import { createTestState, heldDaCommand, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const LEGEND2_DEFINITIONS = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

describe("permanent operation rules", () => {
  it("replaces the oldest resident when slot limit is exceeded", () => {
    const rk001 = inst("RK-001", "op1");
    const rk003 = inst("RK-003", "op2");
    let state = createTestState({
      definitions: LEGEND2_DEFINITIONS,
      phase: "rush",
      player1: {
        operation: [],
        discard: [],
      },
    });

    state = placePermanentOperation(state, "player1", rk001);
    expect(state.players.player1.operation).toHaveLength(1);
    expect(state.players.player1.operation[0]?.cardId).toBe("RK-001");

    state = placePermanentOperation(state, "player1", rk003);
    expect(state.players.player1.operation).toHaveLength(1);
    expect(state.players.player1.operation[0]?.cardId).toBe("RK-003");
    expect(state.players.player1.discard.map((card) => card.cardId)).toContain("RK-001");
  });

  it("allows two tag residents when a tag card is involved", () => {
    const xp001 = resolvePlayableCard("XP-001");
    if (!xp001) throw new Error("missing XP-001");
    const tagCard = inst("XP-001", "tag");
    const rk001 = inst("RK-001", "op1");
    let state = createTestState({
      definitions: { ...LEGEND2_DEFINITIONS, "XP-001": xp001 },
      phase: "rush",
      player1: { operation: [], discard: [] },
    });

    state = placePermanentOperation(state, "player1", tagCard);
    state = placePermanentOperation(state, "player1", rk001);
    expect(state.players.player1.operation).toHaveLength(2);
    expect(state.players.player1.discard).toHaveLength(0);

    const rk003 = inst("RK-003", "op3");
    state = placePermanentOperation(state, "player1", rk003);
    expect(state.players.player1.operation).toHaveLength(2);
    expect(state.players.player1.discard.map((card) => card.cardId)).toContain("XP-001");
    expect(state.players.player1.operation.map((card) => card.cardId)).toEqual([
      "RK-001",
      "RK-003",
    ]);
  });

  it("keeps existing residents when playing a non-permanent operation", () => {
    const resident = inst("RK-001", "resident");
    const instant = inst("RS-072", "instant");
    const state = createTestState({
      definitions: LEGEND2_DEFINITIONS,
      phase: "rush",
      player1: {
        operation: [resident],
        hand: [instant],
        command: [heldDaCommand("da")],
        power: [
          inst("TST-P", "p1"),
          inst("TST-P", "p2"),
          inst("TST-P", "p3"),
        ],
        discard: [],
      },
    });

    const played = applyAction(state, {
      type: "play_operation",
      playerId: "player1",
      instanceId: instant.instanceId,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    expect(played.state.players.player1.operation).toHaveLength(1);
    expect(played.state.players.player1.operation[0]?.cardId).toBe("RK-001");
    expect(played.state.players.player1.discard.some((card) => card.cardId === "RS-072")).toBe(
      true,
    );
  });

  it("clears resident activation flags at the next rush phase", () => {
    const resident = {
      ...inst("RK-001", "resident"),
      residentActivatedThisRush: true,
    };
    const player = resetRushPhaseFlags({
      ...createTestState().players.player1,
      operation: [resident],
    });
    expect(player.operation[0]?.residentActivatedThisRush).toBeUndefined();
  });
});
