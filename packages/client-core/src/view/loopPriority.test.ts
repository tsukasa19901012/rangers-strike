import { describe, expect, it } from "vitest";
import { buildPendingView } from "./board";
import { testEngine } from "../testing/engine";

describe("loop priority window", () => {
  it("titles the engine's loop_priority choice as a loop, not a simultaneous order", () => {
    const base = testEngine.createStarterGame({ player1Starter: "abarenoh", player2Starter: "dekaranger", seed: 1 });
    const [a, b] = base.players.player1.hand;
    const state = {
      ...base,
      pendingEffectChoice: {
        playerId: "player1",
        kind: "simultaneous_order",
        effectId: "loop_priority",
        sourceCardId: "engine",
        validInstanceIds: [a!.instanceId, b!.instanceId],
      },
    } as unknown as typeof base;
    const view = buildPendingView(testEngine, state);
    expect(view?.title).toMatch(/^ループの優先/);
  });
});
