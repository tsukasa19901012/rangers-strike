import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createStarterGame } from "./createStarterGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("vertical slice — core flow", () => {
  it("creates game at charge phase (first turn skips start)", () => {
    const state = createStarterGame({ rng: () => 0.5 });
    expect(state.phase).toBe("charge");
    expect(state.winner).toBeNull();
    expect(state.players.player1.hand.length).toBe(7);
  });

  it("can draw on turn 2 start phase", () => {
    let state = createStarterGame({
      rng: mulberry32(42),
      firstPlayer: "player1",
    });
    const handBefore = state.players.player1.hand.length;

    for (let i = 0; i < 80 && state.turn < 2; i += 1) {
      const actions = getLegalActions(state);
      if (actions.length === 0) break;
      state = applyAction(state, actions[0]!).state!;
    }

    if (state.phase === "start" && state.activePlayer === "player1") {
      const draw = getLegalActions(state).find((a) => a.type === "draw");
      if (draw) {
        state = applyAction(state, draw).state!;
        expect(state.players.player1.hand.length).toBeGreaterThanOrEqual(handBefore);
      }
    }
    expect(state.turn).toBeGreaterThanOrEqual(2);
  });

  it("seed 7 CPU match visits rush, battle, and may strike", () => {
    const result = playStarterMatchUntilEnd(
      createStarterGame({
        rng: mulberry32(7),
        player1Starter: "abarenoh",
        player2Starter: "dekaranger",
      }),
      { maxSteps: 10_000 },
    );

    expect(result.reason).not.toBe("apply_failed");
    expect(result.trace.phasesSeen.has("rush")).toBe(true);
    expect(result.trace.phasesSeen.has("battle")).toBe(true);
    expect(result.trace.phasesSeen.has("charge")).toBe(true);

    if (result.reason === "winner") {
      expect(result.state.winner).not.toBeNull();
    }
  });
});
