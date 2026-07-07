import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { createTestState, inst } from "../testing/fixtures";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));

const IMAGIN_DESTROY_ON_ENTER = [
  "PK-007",
  "RK-142",
  "RK-143",
  "RK-144",
  "RK-145",
  "RK-154",
  "RK-157",
  "XG2-068",
];

describe("イマジンの ※バトルエリアに出たとき撃破される", () => {
  for (const id of IMAGIN_DESTROY_ON_ENTER) {
    it(`${id} は直接バトル進入で撃破され捨札へ`, () => {
      const c = inst(id, "x");
      const state = createTestState({
        phase: "battle",
        definitions: { ...createTestState().definitions, ...defs },
        player1: { rush: [c] },
      });
      const r = applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: c.instanceId,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.state.players.player1.battle.some((x) => x.instanceId === c.instanceId)).toBe(false);
      expect(r.state.players.player1.discard.some((x) => x.instanceId === c.instanceId)).toBe(true);
    });
  }

  it("RK-147 とのジョイントコンビで進入した RK-142 も撃破される", () => {
    const isurugi = inst("RK-147", "isurugi");
    const momo = inst("RK-142", "momo");
    const state = createTestState({
      phase: "battle",
      definitions: { ...createTestState().definitions, ...defs },
      player1: {
        rush: [momo],
        battle: [isurugi],
        power: [inst("TST-P1", "p1"), inst("TST-P2", "p2"), inst("TST-P3", "p3")],
      },
    });
    const r = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: momo.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.player1.battle.some((c) => c.cardId === "RK-142")).toBe(false);
    expect(r.state.players.player1.discard.some((c) => c.cardId === "RK-142")).toBe(true);
  });
});
