import { describe, expect, it } from "vitest";
import { applyAction } from "./core/applyAction";
import { getLegalActions } from "./core/legalActions";
import { counterWithCategoryHold } from "./testing/counterPayment";
import { createTestState, inst } from "./testing/fixtures";
import { def, deckOf, unwrap } from "./rulesSpec/01-helpers";
import type { GameState } from "./types/game";

function play(): GameState {
  const op = inst("RS-183", "kuroko");
  const definitions = { ...createTestState().definitions, "RS-183": def("RS-183") };
  const state = createTestState({
    phase: "rush",
    activePlayer: "player1",
    definitions,
    player1: {
      hand: [op, ...deckOf("h", 3)],
      power: deckOf("p", 4),
      command: [inst("TST-OP-MA", "cmd"), inst("TST-OP", "spare")],
      deck: deckOf("d", 5),
    },
    player2: { hand: deckOf("oh", 3), deck: deckOf("e", 5) },
  });
  return unwrap(counterWithCategoryHold(state, "player1", op.instanceId, "TST-OP-MA:cmd"));
}

describe("RS-183 黒子ロボの記憶操作", () => {
  it("draws up to 3, then 3 return steps (hold avoids one), then the opponent does the same", () => {
    let s = play();
    expect(s.players.player1.discard.map((c) => c.instanceId)).toContain("RS-183:kuroko");
    expect(s.pendingEffectChoice?.kurokoMeta?.stage).toBe("draw");
    s = unwrap(applyAction(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "draw" }));
    s = unwrap(applyAction(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "draw" }));
    s = unwrap(applyAction(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(s.players.player1.hand).toHaveLength(5);
    // 1回目: リリース状態のコマンドをホールドして戻さない
    expect(s.pendingEffectChoice?.kind).toBe("select_command");
    const holdInit = getLegalActions(s).find((a) => a.type === "initiate_command_payment" && a.kind === "effect_hold");
    expect(holdInit).toBeDefined();
    s = unwrap(applyAction(s, holdInit!));
    s = unwrap(applyAction(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP:spare"] }));
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:spare")?.commandHeld).toBe(true);
    // 2・3回目はホールドできるコマンドがないので戻す
    expect(s.players.player1.hand).toHaveLength(3);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = unwrap(applyAction(s, { type: "skip_effect_choice", playerId: "player2" }));
    expect(s.players.player2.hand).toHaveLength(0);
    expect(s.players.player2.deck).toHaveLength(8);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.activePlayer).toBe("player1");
    expect(s.winner).toBeNull();
  });
});
