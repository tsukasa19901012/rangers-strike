import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { createTestState, inst } from "./testing/fixtures";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

describe("RS-004 denji machine", () => {
  it("opens reveal step for caster and opponent audience", () => {
    const op = inst("RS-004", "op1");
    const sUnit = inst("TST-UNIT-0", "s");
    const c1 = inst("TST-UNIT-2", "c1");
    const c2 = inst("TST-UNIT-2", "c2");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: {
        ...createTestState().definitions,
        "RS-004": def("RS-004"),
        "RS-020": def("RS-020"),
      },
      player1: {
        hand: [op],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [{ ...inst("RS-020", "cmd"), commandHeld: true }],
        deck: [sUnit, c1, c2, inst("TST-OP", "d4")],
      },
    });

    const played = applyAction(state, getLegalActions(state).find((a) => a.type === "play_operation")!);
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const pending = played.state.pendingEffectChoice;
    expect(pending?.effectId).toBe("denji_machine");
    expect(pending?.denjiMachineMeta?.step).toBe("reveal");
    expect(pending?.denjiMachineMeta?.audiencePlayerIds).toContain("player2");
    expect(pending?.viewedInstanceIds).toEqual([sUnit.instanceId, c1.instanceId, c2.instanceId]);
    expect(pending?.denjiMachineMeta?.revealedCards?.map((c) => c.instanceId)).toEqual([
      sUnit.instanceId,
      c1.instanceId,
      c2.instanceId,
    ]);
  });

  it("moves S to hand and orders non-S to deck bottom", () => {
    const op = inst("RS-004", "op1");
    const sUnit = inst("TST-UNIT-0", "s");
    const bottomFirst = inst("TST-UNIT-2", "b1");
    const bottomSecond = inst("TST-UNIT-2", "b2");
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: {
        ...createTestState().definitions,
        "RS-004": def("RS-004"),
        "RS-020": def("RS-020"),
      },
      player1: {
        hand: [op],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [{ ...inst("RS-020", "cmd"), commandHeld: true }],
        deck: [sUnit, bottomFirst, bottomSecond, inst("TST-OP", "d4")],
      },
    });

    const played = applyAction(state, getLegalActions(state).find((a) => a.type === "play_operation")!);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    state = played.state;

    const confirmed = applyAction(state, { type: "confirm_denji_reveal", playerId: "player1" });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    state = confirmed.state;

    expect(state.players.player1.hand.some((c) => c.instanceId === sUnit.instanceId)).toBe(true);
    expect(state.pendingEffectChoice?.denjiMachineMeta?.step).toBe("order_bottom");

    const order1 = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: bottomSecond.instanceId,
    });
    expect(order1.ok).toBe(true);
    if (!order1.ok) return;
    state = order1.state;

    const order2 = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: bottomFirst.instanceId,
    });
    expect(order2.ok).toBe(true);
    if (!order2.ok) return;

    expect(order2.state.pendingEffectChoice).toBeUndefined();
    const deck = order2.state.players.player1.deck;
    expect(deck).toHaveLength(3);
    expect(deck[1]?.instanceId).toBe(bottomSecond.instanceId);
    expect(deck[2]?.instanceId).toBe(bottomFirst.instanceId);
  });

  it("finishes immediately when all three are S units", () => {
    const op = inst("RS-004", "op1");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: {
        ...createTestState().definitions,
        "RS-004": def("RS-004"),
        "RS-020": def("RS-020"),
      },
      player1: {
        hand: [op],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [{ ...inst("RS-020", "cmd"), commandHeld: true }],
        deck: [
          inst("TST-UNIT-0", "s1"),
          inst("TST-UNIT-0", "s2"),
          inst("TST-UNIT-0", "s3"),
          inst("TST-OP", "d4"),
        ],
      },
    });

    const played = applyAction(state, getLegalActions(state).find((a) => a.type === "play_operation")!);
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const done = applyAction(played.state, { type: "confirm_denji_reveal", playerId: "player1" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.state.pendingEffectChoice).toBeUndefined();
    expect(done.state.players.player1.hand).toHaveLength(3);
    expect(done.state.players.player1.deck).toHaveLength(1);
  });
});
