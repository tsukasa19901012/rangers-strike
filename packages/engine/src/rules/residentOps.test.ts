import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { createTestState, inst } from "../testing/fixtures";
import { powerCards } from "../testing/gameplayFlow";
import { applyResidentOpOnPlace } from "./residentOps";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));
const testDefs = { ...createTestState().definitions, ...defs };

describe("RK-021 クロックアップ", () => {
  it("stacks deck cards equal to power zone size on placement", () => {
    const op = inst("RK-021", "op1");
    const state = createTestState({
      phase: "rush",
      definitions: testDefs,
      player1: {
        operation: [op],
        deck: [inst("TST-UNIT-0", "d1"), inst("TST-UNIT-0", "d2"), inst("TST-UNIT-0", "d3"), inst("TST-UNIT-0", "d4")],
        power: powerCards(3),
      },
    });
    const placed = applyResidentOpOnPlace(state, "player1", op.instanceId, "RK-021");
    const stacked = placed.players.player1.operation[0]?.stackedCards ?? [];
    expect(stacked).toHaveLength(3);
    expect(stacked.every((c) => c.faceDown)).toBe(true);
    expect(placed.players.player1.deck).toHaveLength(1);
  });

  it("prevents battle against 加速 unit and returns one stacked card to deck bottom", () => {
    // RK-020 等 加速持ちを探す
    const accel = fullPlayableCatalog.cards.find(
      (c) => c.type === "unit" && (c.features ?? []).includes("加速"),
    );
    expect(accel).toBeDefined();
    const defender = inst(accel!.id, "def1");
    const attacker = inst("TST-UNIT-2", "atk1");
    const op = { ...inst("RK-021", "op1"), stackedCards: [{ ...inst("TST-UNIT-0", "s1"), faceDown: true }] };

    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: testDefs,
      player1: {
        battle: [defender],
        operation: [op],
        deck: [inst("TST-UNIT-0", "d1")],
      },
      player2: {
        battle: [attacker],
      },
    });

    const r = applyAction(state, {
      type: "battle",
      playerId: "player2",
      attackerInstanceId: attacker.instanceId,
      defenderInstanceId: defender.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s2 = r.state;
    // バトルは行われない: 両者フィールドに残る
    expect(s2.players.player1.battle.some((c) => c.instanceId === defender.instanceId)).toBe(true);
    expect(s2.players.player2.battle.some((c) => c.instanceId === attacker.instanceId)).toBe(true);
    // アタッカーは行動済み
    expect(
      s2.players.player2.battle.find((c) => c.instanceId === attacker.instanceId)?.battleActed,
    ).toBe(true);
    // 重ねたカードが山札の下へ
    expect(s2.players.player1.operation[0]?.stackedCards ?? []).toHaveLength(0);
    expect(s2.players.player1.deck.at(-1)?.instanceId).toBe("TST-UNIT-0:s1");
  });

  it("does not prevent battle when the stack is empty", () => {
    const accel = fullPlayableCatalog.cards.find(
      (c) => c.type === "unit" && (c.features ?? []).includes("加速"),
    );
    const defender = inst(accel!.id, "def1");
    const attacker = inst("TST-UNIT-2", "atk1");
    const op = inst("RK-021", "op1");

    const state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      definitions: testDefs,
      player1: { battle: [defender], operation: [op] },
      player2: { battle: [attacker] },
    });

    const r = applyAction(state, {
      type: "battle",
      playerId: "player2",
      attackerInstanceId: attacker.instanceId,
      defenderInstanceId: defender.instanceId,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // バトルは通常どおり解決される（少なくともどちらかに変化がある）
    const changed =
      !r.state.players.player1.battle.some((c) => c.instanceId === defender.instanceId) ||
      !r.state.players.player2.battle.some((c) => c.instanceId === attacker.instanceId) ||
      r.state.pendingLeave !== undefined ||
      r.state.pendingBattle !== undefined;
    expect(changed).toBe(true);
  });
});
