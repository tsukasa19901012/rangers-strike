/**
 * R-START-05 / R-WIN-03: 効果による「ドロー」「ひく」でも、ひくべきときにひけなければ敗北する。
 */
import { describe, expect, it } from "vitest";
import { checkWinner } from "./core/createGame";
import { takeFromDeckTop } from "./core/helpers";
import { applySuperBrainDraw } from "./effects/drawEffects";
import { applyResidentOpOnPlace } from "./rules/residentOps";
import { createTestState, inst } from "./testing/fixtures";

describe("R-WIN-03: 効果の「ひく」で山札切れ", () => {
  it("R-START-05: takeFromDeckTop は引けるだけ引き、足りなければ敗北フラグを立てる", () => {
    const state = createTestState({ player1: { deck: [inst("TST-OP", "d1")] } });
    const short = takeFromDeckTop(state.players.player1, 2);
    expect(short.taken).toHaveLength(1);
    expect(short.player.deck).toHaveLength(0);
    expect(short.player.deckedOut).toBe(true);

    const enough = takeFromDeckTop(state.players.player1, 1);
    expect(enough.taken).toHaveLength(1);
    expect(enough.player.deckedOut).toBeUndefined();
  });

  it("R-WIN-03: クロックアップ（RK-021）はパワーの枚数だけひけなければ敗北", () => {
    const clockUp = inst("RK-021", "clock");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        deck: [inst("TST-OP", "d1")],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        operation: [clockUp],
      },
    });
    const next = applyResidentOpOnPlace(state, "player1", clockUp.instanceId, "RK-021");
    expect(next.players.player1.operation[0]?.stackedCards).toHaveLength(1);
    expect(next.players.player1.deckedOut).toBe(true);
    expect(checkWinner(next)).toBe("player2");
  });

  it("R-WIN-03: 効果の1枚ドローで山札が無ければ敗北", () => {
    const state = createTestState({ phase: "rush", activePlayer: "player1", player1: { deck: [] } });
    const drawn = applySuperBrainDraw(state, "player1", state.players.player1, "player1");
    expect(drawn.detail).toBe("empty_deck");
    expect(drawn.state.players.player1.deckedOut).toBe(true);
    expect(checkWinner(drawn.state)).toBe("player2");
  });
});
