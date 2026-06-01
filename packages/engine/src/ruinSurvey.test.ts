import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { createTestState, inst } from "./testing/fixtures";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

describe("RS-066 ruin survey", () => {
  it("opens scry choice when NC triggers at battle position 2", () => {
    const pink = inst("RS-066", "p1");
    const filler = inst("TST-UNIT-0", "f1");
    const deckTop = inst("RS-007", "top");
    const deckSecond = inst("RS-020", "second");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [pink],
        battle: [filler],
        deck: [deckTop, deckSecond],
      },
    });
    state.definitions["RS-066"] = def("RS-066");
    state.definitions["RS-007"] = def("RS-007");
    state.definitions["RS-020"] = def("RS-020");

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: pink.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.pendingEffectChoice?.viewedInstanceIds?.[0]).toBe(deckTop.instanceId);
    expect(result.state.pendingEffectChoice?.kind).toBe("deck_top_or_bottom");
    expect(result.state.activePlayer).toBe("player1");

    const actions = getLegalActions(result.state);
    expect(actions.filter((a) => a.type === "resolve_ruin_survey")).toHaveLength(2);
  });

  it("keeps deck order when returning to top", () => {
    const pink = inst("RS-066", "p1");
    const filler = inst("TST-UNIT-0", "f1");
    const deckTop = inst("RS-007", "top");
    const deckSecond = inst("RS-020", "second");

    let state = createTestState({
      phase: "battle",
      player1: {
        rush: [pink],
        battle: [filler],
        deck: [deckTop, deckSecond],
      },
    });
    state.definitions["RS-066"] = def("RS-066");
    state.definitions["RS-007"] = def("RS-007");
    state.definitions["RS-020"] = def("RS-020");

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: pink.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    const resolved = applyAction(state, {
      type: "resolve_ruin_survey",
      playerId: "player1",
      placement: "top",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.state.pendingEffectChoice).toBeUndefined();
    expect(resolved.state.players.player1.deck[0]?.instanceId).toBe(deckTop.instanceId);
    expect(resolved.state.players.player1.deck[1]?.instanceId).toBe(deckSecond.instanceId);
  });

  it("moves scried card to bottom of deck", () => {
    const pink = inst("RS-066", "p1");
    const filler = inst("TST-UNIT-0", "f1");
    const deckTop = inst("RS-007", "top");
    const deckSecond = inst("RS-020", "second");

    let state = createTestState({
      phase: "battle",
      player1: {
        rush: [pink],
        battle: [filler],
        deck: [deckTop, deckSecond],
      },
    });
    state.definitions["RS-066"] = def("RS-066");
    state.definitions["RS-007"] = def("RS-007");
    state.definitions["RS-020"] = def("RS-020");

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: pink.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    const resolved = applyAction(state, {
      type: "resolve_ruin_survey",
      playerId: "player1",
      placement: "bottom",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.state.players.player1.deck[0]?.instanceId).toBe(deckSecond.instanceId);
    expect(resolved.state.players.player1.deck[1]?.instanceId).toBe(deckTop.instanceId);
  });

  it("does not scry when deck is empty", () => {
    const pink = inst("RS-066", "p1");
    const filler = inst("TST-UNIT-0", "f1");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [pink],
        battle: [filler],
        deck: [],
      },
    });
    state.definitions["RS-066"] = def("RS-066");

    const result = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: pink.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingEffectChoice).toBeUndefined();
  });
});
