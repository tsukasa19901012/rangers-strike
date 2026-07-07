import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createTestState, inst } from "../testing/fixtures";
import { powerCards } from "../testing/gameplayFlow";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));

describe("castoff via real rush action", () => {
  it("opens castoff choice after rushing XG2-064 via applyAction", () => {
    const mf = inst("XG2-064", "mf1");
    const rf = inst("XG2-066", "rf1");
    const otCmd = inst("TST-OP-OT", "cmd1");
    const otCmd2 = inst("TST-OP-OT", "cmd2");
    const state = createTestState({
      phase: "rush",
      definitions: { ...createTestState().definitions, ...defs },
      player1: {
        hand: [mf],
        deck: [rf],
        command: [otCmd, otCmd2],
        power: powerCards(5),
      },
    });

    const legal = getLegalActions(state);
    const rushActions = legal.filter(
      (a) => a.type === "rush" && a.instanceId === mf.instanceId,
    );
    const payments = legal.filter(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.kind === "category_use" &&
        a.sourceInstanceId === mf.instanceId,
    );
    
    let s2 = state;
    if (rushActions.length > 0) {
      const r = applyAction(state, rushActions[0]!);
      expect(r.ok).toBe(true);
      if (r.ok) s2 = r.state;
    } else {
      expect(payments.length).toBeGreaterThan(0);
      const r1 = applyAction(state, payments[0]!);
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      s2 = r1.state;
      const r2 = applyAction(s2, {
        type: "resolve_command_payment",
        playerId: "player1",
        commandInstanceIds: [otCmd.instanceId],
      });
        expect(r2.ok).toBe(true);
      if (r2.ok) s2 = r2.state;
    }
    expect(s2.players.player1.rush.map((c) => c.instanceId)).toContain(mf.instanceId);
    expect(s2.pendingEffectChoice?.effectId).toBe("castoff_hold_command");
  });
});
