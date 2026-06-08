import { describe, expect, it } from "vitest";
import { legend2Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { canStrikeUnit } from "./rules/combo";
import { cannotAttackOrStrikeThisTurn } from "./rules/restrictions";
import { createTestState, inst, TEST_DEFINITIONS } from "./testing/fixtures";
import { battleFillers } from "./testing/battleEntry";
import { rushWithCategoryHold } from "./testing/rushPayment";

const defs = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

describe("RS-090 Red Racer", () => {
  it("cannot attack or strike on the turn it was rushed", () => {
    const racer = inst("RS-090", "racer");
    const player = {
      battle: [racer, ...battleFillers(2)],
      turnModifiers: {
        comboNumberDelta: 0,
        battleBlockedInstanceIds: [],
        shironLightUsed: false,
        rushedThisTurnInstanceIds: [racer.instanceId],
      },
    };
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player1",
      player1: player,
      player2: {
        battle: battleFillers(2),
      },
    });

    expect(cannotAttackOrStrikeThisTurn(state.players.player1, racer)).toBe(true);
    expect(canStrikeUnit(defs, racer, state, "player1")).toBe(false);

    const attacks = getLegalActions(state).filter((a) => a.type === "battle");
    expect(attacks.some((a) => a.attackerInstanceId === racer.instanceId)).toBe(false);

    const strikes = getLegalActions(state).filter((a) => a.type === "strike");
    expect(strikes.some((a) => a.instanceId === racer.instanceId)).toBe(false);
  });

  it("auto-enters battle when rushed if possible", () => {
    const racer = inst("RS-090", "racer");
    const state = createTestState({
      definitions: defs,
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [racer],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [inst("TST-OP-OT", "ot-pay")],
      },
    });
    const result = rushWithCategoryHold(
      state,
      "player1",
      racer.instanceId,
      "TST-OP-OT:ot-pay",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.battle.some((c) => c.cardId === "RS-090")).toBe(true);
    expect(result.state.players.player1.rush.some((c) => c.cardId === "RS-090")).toBe(false);
  });
});
