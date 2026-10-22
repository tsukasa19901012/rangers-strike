import { describe, expect, it } from "vitest";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { hideOpponentHand } from "./simulation";

describe("hideOpponentHand", () => {
  it("相手の手札を山札と混ぜて配り直し、枚数と自分の側は変えない", () => {
    const state = createStarterGame({ player1Starter: "abarenoh", player2Starter: "magiking", seed: 3, firstPlayer: "player1" });
    const hidden = hideOpponentHand(state, "player1");
    const before = state.players.player2;
    const after = hidden.players.player2;
    expect(hidden.players.player1).toBe(state.players.player1);
    expect(after.hand).toHaveLength(before.hand.length);
    expect(after.deck).toHaveLength(before.deck.length);
    const ids = (cards: { instanceId: string }[]) => cards.map((c) => c.instanceId).sort();
    expect(ids([...after.hand, ...after.deck])).toEqual(ids([...before.hand, ...before.deck]));
    expect(ids(after.hand)).not.toEqual(ids(before.hand));
  });
});
