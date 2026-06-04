import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import type { GameState } from "./types/game";
import { legendDefinitions } from "./testing/battleEntry";
import { createTestState, inst } from "./testing/fixtures";

function stateWithPlayers(
  player1: Partial<import("./types/game").PlayerState>,
  player2: Partial<import("./types/game").PlayerState>,
  extras?: Partial<GameState>,
): GameState {
  return {
    ...createTestState({
      definitions: legendDefinitions,
      player1,
      player2,
      phase: "battle",
      activePlayer: "player1",
    }),
    ...extras,
  };
}

describe("RS-122 seabed survey", () => {
  it("offers top or bottom draw when RS-122 is in rush", () => {
    const bottom = inst("TST-UNIT-0", "bottom");
    const top = inst("TST-UNIT-0", "top");
    const marine = inst("RS-122", "marine");
    let state = stateWithPlayers(
      { rush: [marine], deck: [top, bottom], hand: [] },
      { deck: [inst("TST-UNIT-0", "e1")], hand: [] },
      { phase: "start", activePlayer: "player1" },
    );

    const startDraw = applyAction(state, {
      type: "draw",
      playerId: "player1",
    });
    expect(startDraw.ok).toBe(true);
    if (!startDraw.ok) return;
    expect(startDraw.state.pendingEffectChoice?.effectId).toBe("seabed_survey");
    expect(startDraw.state.pendingEffectChoice?.kind).toBe("seabed_draw");

    const fromBottom = applyAction(startDraw.state, {
      type: "resolve_seabed_draw",
      playerId: "player1",
      placement: "bottom",
    });
    expect(fromBottom.ok).toBe(true);
    if (!fromBottom.ok) return;
    expect(fromBottom.state.players.player1.hand[0]?.instanceId).toBe(bottom.instanceId);
    expect(fromBottom.state.players.player1.deck[0]?.instanceId).toBe(top.instanceId);
  });

  it("skip draws from top by default", () => {
    const bottom = inst("TST-UNIT-0", "bottom");
    const top = inst("TST-UNIT-0", "top");
    const marine = inst("RS-122", "marine");
    let state = stateWithPlayers(
      { rush: [marine], deck: [top, bottom], hand: [] },
      { deck: [inst("TST-UNIT-0", "e1")], hand: [] },
      { phase: "start", activePlayer: "player1" },
    );

    const startDraw = applyAction(state, { type: "draw", playerId: "player1" });
    expect(startDraw.ok).toBe(true);
    if (!startDraw.ok || !startDraw.state.pendingEffectChoice) return;

    const skipped = applyAction(startDraw.state, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.players.player1.hand[0]?.instanceId).toBe(top.instanceId);
  });
});

describe("RS-115 opponent may draw", () => {
  it("does not draw when opponent skips", () => {
    let state = stateWithPlayers(
      { deck: [inst("TST-UNIT-0", "d1")], hand: [] },
      { deck: [inst("TST-UNIT-0", "e1")], hand: [] },
      {
      pendingEffectChoice: {
        playerId: "player2",
        effectId: "opponent_may_draw_on_enter",
        sourceCardId: "RS-115",
        kind: "optional_deck_draw",
        phasePlayerId: "player1",
        validInstanceIds: ["draw"],
        optional: true,
      },
      activePlayer: "player2",
      },
    );

    const skipped = applyAction(state, {
      type: "skip_effect_choice",
      playerId: "player2",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.state.players.player2.hand).toHaveLength(0);
    expect(skipped.state.players.player2.deck).toHaveLength(1);
  });

  it("opens optional draw when RS-115 enters battle", () => {
    const p115 = inst("RS-115", "u115");
    const allyS = inst("RS-114", "s");
    const enemyDeck = inst("TST-UNIT-0", "enemy-top");
    const state = stateWithPlayers(
      { rush: [p115], battle: [allyS], deck: [inst("TST-UNIT-0", "d1")], hand: [] },
      { deck: [enemyDeck, inst("TST-UNIT-0", "e2")], hand: [] },
    );

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: p115.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.pendingEffectChoice?.effectId).toBe("opponent_may_draw_on_enter");
    expect(moved.state.pendingEffectChoice?.playerId).toBe("player2");

    const actions = getLegalActions(moved.state).filter(
      (a) => a.playerId === "player2",
    );
    expect(actions.some((a) => a.type === "skip_effect_choice")).toBe(true);
    expect(
      actions.some(
        (a) => a.type === "resolve_effect_choice" && a.instanceId === "draw",
      ),
    ).toBe(true);
  });

  it("draws one card when opponent accepts", () => {
    let state = stateWithPlayers(
      { deck: [inst("TST-UNIT-0", "d1")], hand: [] },
      { deck: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], hand: [] },
      {
      pendingEffectChoice: {
        playerId: "player2",
        effectId: "opponent_may_draw_on_enter",
        sourceCardId: "RS-115",
        kind: "optional_deck_draw",
        phasePlayerId: "player1",
        validInstanceIds: ["draw"],
        optional: true,
      },
      activePlayer: "player2",
      },
    );

    const drew = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player2",
      instanceId: "draw",
    });
    expect(drew.ok).toBe(true);
    if (!drew.ok) return;
    expect(drew.state.players.player2.hand).toHaveLength(1);
    expect(drew.state.players.player2.deck).toHaveLength(1);
    expect(drew.state.players.player2.hand[0]?.instanceId).toBe("TST-UNIT-0:e1");
  });
});
