import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { createGame } from "./core/createGame";
import { satisfyCostWindow } from "./core/costWindow";
import { getLegalActions } from "./core/legalActions";
import { applyAction } from "./core/applyAction";

const vehicleDef: CardDefinition = {
  id: "TST-VEHICLE",
  name: "テストビークル",
  type: "vehicle",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  size: "S",
  features: ["メカ"],
};

const etCommandDef: CardDefinition = {
  id: "TST-CMD",
  name: "テストコマンド",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S",
};

const fillerDeck = Array.from({ length: 40 }, (_, i) => ({
  id: `FILL-${i}`,
  name: "Filler",
  type: "unit" as const,
  category: "ET" as const,
  rarity: "N" as const,
  expansion: "test",
  powerCost: 0,
  bp: 1000,
  size: "S" as const,
}));

function gameWithVehicleInHand() {
  const base = createGame({
    player1Deck: fillerDeck,
    player2Deck: fillerDeck,
    rng: () => 0.5,
  });
  const instanceId = "veh-1";
  return {
    ...base,
    phase: "rush" as const,
    activePlayer: "player1" as const,
    definitions: {
      ...base.definitions,
      [vehicleDef.id]: vehicleDef,
      [etCommandDef.id]: etCommandDef,
    },
    players: {
      ...base.players,
      player1: satisfyCostWindow(
        {
          ...base.players.player1,
          hand: [{ instanceId, cardId: vehicleDef.id }],
          command: [{ instanceId: "cmd-1", cardId: etCommandDef.id, commandHeld: true }],
        },
        "rush_category",
      ),
    },
  };
}

describe("vehicle rush", () => {
  it("lists rush action for vehicles in hand", () => {
    const state = gameWithVehicleInHand();
    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "rush" && a.instanceId === "veh-1")).toBe(true);
  });

  it("moves vehicle from hand to rush on rush action", () => {
    const state = gameWithVehicleInHand();
    const result = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: "veh-1",
    });
    expect(result.ok).toBe(true);
    expect(result.state.players.player1.rush.some((c) => c.instanceId === "veh-1")).toBe(true);
    expect(result.state.players.player1.hand).toHaveLength(0);
  });
});
