import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createTestState, inst } from "../testing/fixtures";
import { powerCards } from "../testing/gameplayFlow";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));

function setup(rfId: string, power: number) {
  const mf = inst("XG2-064", "mf1");
  const rf = inst(rfId, "rf1");
  const ot1 = inst("TST-OP-OT", "cmd1");
  const ot2 = inst("TST-OP-OT", "cmd2");
  return {
    mf, rf, ot1, ot2,
    state: createTestState({
      phase: "rush",
      definitions: { ...createTestState().definitions, ...defs },
      player1: {
        hand: [mf],
        deck: [rf, inst("TST-UNIT-0", "d2")],
        command: [ot1, ot2],
        power: powerCards(power),
      },
    }),
  };
}

describe("castoff full chain", () => {
  for (const rfId of ["XG2-066", "RK-065"]) {
    it(`deploys ${rfId} after holding the extra OT command`, () => {
      const { mf, rf, ot2, state } = setup(rfId, 8);
      const legal = getLegalActions(state);
      const pay = legal.find(
        (a) => a.type === "initiate_command_payment" && a.kind === "category_use" && a.sourceInstanceId === mf.instanceId,
      );
      expect(pay, "payment action").toBeDefined();
      let r = applyAction(state, pay!);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      let s = r.state;
      r = applyAction(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:cmd1"] });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      console.log(rfId, "step1 pending:", s.pendingEffectChoice?.effectId, s.pendingEffectChoice?.kind);
      expect(s.pendingEffectChoice?.effectId).toBe("castoff_hold_command");

      // 追加 OT コマンドを effect_hold 支払いでホールド（UI の実経路）
      r = applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "effect_hold", sourceInstanceId: s.pendingEffectChoice!.sourceInstanceId ?? ot2.instanceId });
      console.log(rfId, "init hold ok:", r.ok, r.ok ? "" : JSON.stringify((r as { error?: unknown }).error));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      r = applyAction(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: [ot2.instanceId] });
      console.log(rfId, "hold resolve ok:", r.ok, r.ok ? "" : JSON.stringify((r as { error?: unknown }).error));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      console.log(rfId, "step2 pending:", s.pendingEffectChoice?.effectId, s.pendingEffectChoice?.kind,
        "valid:", s.pendingEffectChoice?.validInstanceIds);
      expect(s.pendingEffectChoice?.effectId).toBe("castoff_deck_rush");

      // 山札の RF を選ぶ
      r = applyAction(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: rf.instanceId });
      console.log(rfId, "deploy resolve ok:", r.ok, r.ok ? "" : JSON.stringify((r as { error?: unknown }).error));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      console.log(rfId, "rush zone:", s.players.player1.rush.map((c) => c.cardId));
      expect(s.players.player1.rush.some((c) => c.instanceId === rf.instanceId)).toBe(true);
    });
  }

  it("declines the optional castoff when the effect_hold payment is cancelled", () => {
    const { mf, ot2, state } = setup("XG2-066", 8);
    const legal = getLegalActions(state);
    const pay = legal.find(
      (a) => a.type === "initiate_command_payment" && a.kind === "category_use" && a.sourceInstanceId === mf.instanceId,
    );
    expect(pay).toBeDefined();
    let r = applyAction(state, pay!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    let s = r.state;
    r = applyAction(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["TST-OP-OT:cmd1"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(s.pendingEffectChoice?.effectId).toBe("castoff_hold_command");

    r = applyAction(s, { type: "initiate_command_payment", playerId: "player1", kind: "effect_hold", sourceInstanceId: s.pendingEffectChoice!.sourceInstanceId ?? ot2.instanceId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;

    // キャンセル = 任意効果の辞退。支払いも効果選択も残らないこと
    r = applyAction(s, { type: "cancel_command_payment", playerId: "player1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(s.pendingCommandPayment).toBeUndefined();
    expect(s.pendingEffectChoice).toBeUndefined();
    // ラッシュ自体は成立している（本体はラッシュエリアに出ている）
    expect(s.players.player1.rush.some((c) => c.instanceId === mf.instanceId)).toBe(true);
  });
});
