import { describe, expect, it } from "vitest";
import { applyDamageToPlayer } from "./rules/damagePayment";
import { createTestState, inst } from "./testing/fixtures";

describe("RS-112 return to hand at 6 damage", () => {
  it("returns RS-112 to owner hand when enemy reaches 6 damage", () => {
    const zord = inst("RS-112", "z1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [zord],
        damage: 0,
      },
      player2: {
        damage: 5,
        deck: [inst("TST-OP", "deck")],
        power: [],
      },
    });
    state.definitions["RS-112"] = {
      id: "RS-112",
      name: "Urzaord",
      type: "unit",
      category: "MA",
      rarity: "SR",
      expansion: "test",
      powerCost: "7+",
      bp: 10000,
      size: "L",
    };

    const afterDamage = applyDamageToPlayer(state, "player2", 1, {
      kind: "none",
      activePlayer: "player1",
    });

    expect(afterDamage.players.player2.damage).toBe(6);
    expect(afterDamage.players.player1.battle).toHaveLength(0);
    expect(afterDamage.players.player1.hand.some((c) => c.cardId === "RS-112")).toBe(
      true,
    );
  });

  it("does not trigger when damaged player stays below 6", () => {
    const zord = inst("RS-112", "z1");
    const state = createTestState({
      player1: { battle: [zord] },
      player2: { damage: 4, deck: [inst("TST-OP", "d")], power: [] },
    });
    state.definitions["RS-112"] = {
      id: "RS-112",
      name: "Urzaord",
      type: "unit",
      category: "MA",
      rarity: "SR",
      expansion: "test",
      powerCost: "7+",
      bp: 10000,
      size: "L",
    };

    const after = applyDamageToPlayer(state, "player2", 1, {
      kind: "none",
      activePlayer: "player1",
    });
    expect(after.players.player1.battle).toHaveLength(1);
  });
});
