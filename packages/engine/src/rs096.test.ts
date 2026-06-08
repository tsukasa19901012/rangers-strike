import { describe, expect, it } from "vitest";
import { legend2Catalog } from "@rangers-strike/cards";
import { getOnTurnEndNamedEffect, hasOnTurnEndNamedEffect } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { applyOnTurnEndBattleEffects } from "./rules/legend2/destroyEffects";
import { createTestState, inst } from "./testing/fixtures";
import { battleFillers } from "./testing/battleEntry";

const defs = Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card]));

describe("RS-096 karakuri_fire_hawk", () => {
  it("catalog uses on_turn_end trigger", () => {
    const named = getOnTurnEndNamedEffect("RS-096");
    expect(named?.effectId).toBe("karakuri_fire_hawk");
    expect(named?.trigger.type).toBe("on_turn_end");
    expect(hasOnTurnEndNamedEffect("RS-096", "karakuri_fire_hawk")).toBe(true);
  });

  it("returns to hand when owner ends turn in battle", () => {
    const hawk = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player1",
      player1: {
        battle: [hawk, ...battleFillers(2)],
      },
    });

    const afterEnd = applyOnTurnEndBattleEffects(state, "player1");
    expect(afterEnd.players.player1.battle.some((c) => c.cardId === "RS-096")).toBe(false);
    expect(afterEnd.players.player1.hand.some((c) => c.cardId === "RS-096")).toBe(true);
  });

  it("does not bounce when ending turn on opponent battle", () => {
    const hawk = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player2",
      player1: {
        battle: [hawk, ...battleFillers(2)],
      },
    });

    const afterEnd = applyOnTurnEndBattleEffects(state, "player2");
    expect(afterEnd.players.player1.battle.some((c) => c.cardId === "RS-096")).toBe(true);
    expect(afterEnd.players.player1.hand.some((c) => c.cardId === "RS-096")).toBe(false);
  });

  it("end phase finalization bounces RS-096 from battle", () => {
    const hawk = inst("RS-096", "hawk");
    const state = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player1",
      player1: {
        battle: [hawk, ...battleFillers(2)],
      },
    });

    const ended = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.players.player1.hand.some((c) => c.cardId === "RS-096")).toBe(true);
  });
});
