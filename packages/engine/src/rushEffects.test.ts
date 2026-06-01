import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { ON_ENEMY_RUSH_PERMANENTS, ON_RUSH_EFFECTS } from "./rules/rushEffects";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("rush counter timing (RS-026 Q6/Q10)", () => {
  it("resolves rush-triggered effects before opening shippu counter window", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const counter = inst("RS-026", "c1");
    const radar = inst("RS-124", "radar");
    const power = inst("TST-OP", "pw1");
    const maCmd = { ...inst("RS-057", "cmd"), commandHeld: true };

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1")],
        command: [heldWbCommand("cmd")],
      },
      player2: {
        hand: [counter],
        operation: [radar],
        power: [power, inst("TST-OP", "p2"), inst("TST-OP", "p3"), inst("TST-OP", "p4")],
        command: [maCmd],
      },
    });

    state.definitions["RS-026"] = def("RS-026");
    state.definitions["RS-057"] = def("RS-057");
    state.definitions["RS-124"] = {
      id: "RS-124",
      name: "Radar",
      type: "operation",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      tags: ["常駐"],
    };

    ON_ENEMY_RUSH_PERMANENTS["RS-124"] = "power_to_hand";

    state = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    );

    expect(state.players.player2.hand.some((c) => c.instanceId === power.instanceId)).toBe(
      true,
    );
    expect(state.pendingRush?.rushedInstanceId).toBe(unit.instanceId);
    expect(state.activePlayer).toBe("player2");
    expect(
      getLegalActions(state).some(
        (a) => a.type === "play_counter" && a.instanceId === counter.instanceId,
      ),
    ).toBe(true);

    delete ON_ENEMY_RUSH_PERMANENTS["RS-124"];
  });

  it("resolves unit on-rush effect before counter window (Q10)", () => {
    const unit = inst("TST-RUSH-FX", "u1");
    const counter = inst("RS-026", "c1");
    const maCmd = { ...inst("RS-057", "cmd"), commandHeld: true };

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [unit],
        deck: [inst("TST-OP", "deck1")],
        power: [inst("TST-OP", "p1")],
        command: [heldWbCommand("cmd")],
      },
      player2: {
        hand: [counter],
        command: [maCmd],
        power: [inst("TST-OP", "p2"), inst("TST-OP", "p3"), inst("TST-OP", "p4")],
      },
    });

    state.definitions["TST-RUSH-FX"] = {
      id: "TST-RUSH-FX",
      name: "Rush FX",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 2000,
      size: "S",
    };
    state.definitions["RS-026"] = def("RS-026");
    state.definitions["RS-057"] = def("RS-057");

    ON_RUSH_EFFECTS["TST-RUSH-FX"] = "draw_1";

    const deckBefore = state.players.player1.deck.length;
    state = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    );

    expect(state.players.player1.deck.length).toBe(deckBefore - 1);
    expect(state.players.player1.hand.some((c) => c.cardId === "TST-OP")).toBe(true);
    expect(state.pendingRush).toBeDefined();

    delete ON_RUSH_EFFECTS["TST-RUSH-FX"];
  });
});
