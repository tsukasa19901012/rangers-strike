import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { createTestState, inst } from "./testing/fixtures";
import {
  battleFillers,
  battleUnit,
  hasNcLog,
  moveToBattle,
} from "./testing/battleEntry";

const defs = Object.fromEntries(legend1Catalog.cards.map((c) => [c.id, c]));

describe("battle entry action prompt", () => {
  const abaredDef = {
    id: "RS-054",
    name: "アバレッド",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    size: "S" as const,
    sp: "special" as const,
    comboNumber: 2,
  };

  it("opens action prompt after entering battle", () => {
    const abared = inst("RS-054", "a1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [abared] },
    });
    state.definitions["RS-054"] = abaredDef;

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: abared.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    expect(moved.state.pendingBattleEntry?.instanceId).toBe(abared.instanceId);
    expect(getLegalActions(moved.state).some((a) => a.type === "pass_battle_entry")).toBe(true);
    expect(getLegalActions(moved.state).some((a) => a.type === "move_to_battle")).toBe(false);
    expect(getLegalActions(moved.state).some((a) => a.type === "end_phase")).toBe(false);
  });

  it("allows next entry after pass", () => {
    const first = inst("RS-054", "a1");
    const second = inst("RS-054", "a2");
    let state = createTestState({
      phase: "battle",
      player1: { rush: [first, second] },
    });
    state.definitions["RS-054"] = abaredDef;

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: first.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    const passed = applyAction(state, {
      type: "pass_battle_entry",
      playerId: "player1",
    });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    state = passed.state;

    expect(state.pendingBattleEntry).toBeUndefined();
    expect(getLegalActions(state).some((a) => a.type === "move_to_battle")).toBe(true);
  });

  it("defers attack/strike prompt until number combo choice resolves", () => {
    const mossBreaker = inst("RS-040", "mb1");
    const partner = inst("RS-041", "p1");
    const enemyCommand = { ...inst("RS-007", "cmd1"), commandHeld: false };

    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: { rush: [mossBreaker], battle: [partner] },
      player2: { command: [enemyCommand] },
    });

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: mossBreaker.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    expect(state.pendingEffectChoice?.effectId).toBe("moss_breaker");
    expect(state.pendingBattleEntry).toBeUndefined();
    expect(state.deferredBattleEntry?.resumeEnterBattle?.from).toBe("tail");
    expect(getLegalActions(state).some((a) => a.type === "pass_battle_entry")).toBe(false);

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "effect_hold",
      sourceInstanceId: enemyCommand.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player2",
      commandInstanceIds: [enemyCommand.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    state = resolved.state;

    expect(state.pendingEffectChoice).toBeUndefined();
    expect(state.pendingBattleEntry?.instanceId).toBe(mossBreaker.instanceId);
    expect(getLegalActions(state).some((a) => a.type === "pass_battle_entry")).toBe(true);
  });
});

describe("special SP strike eligibility", () => {
  it("RS-043 cannot strike after skipping judgment sword", () => {
    const patStriker = inst("RS-043", "pat");
    const held = { ...inst("RS-010", "cmd"), commandHeld: true };
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        rush: [patStriker],
        power: [
          inst("TST-P", "p1"),
          inst("TST-P", "p2"),
          inst("TST-P", "p3"),
          inst("TST-P", "p4"),
          inst("TST-P", "p5"),
        ],
        command: [held],
      },
      player2: { battle: [] },
    });

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: patStriker.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;
    expect(state.pendingEffectChoice?.effectId).toBe("judgment_sword");

    const skipped = applyAction(state, {
      type: "skip_effect_choice",
      playerId: "player1",
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    state = skipped.state;

    expect(state.pendingBattleEntry?.instanceId).toBe(patStriker.instanceId);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "strike" && a.instanceId === patStriker.instanceId,
      ),
    ).toBe(false);
    expect(battleUnit(state, "player1", patStriker.instanceId)?.spModifier ?? 0).toBe(0);
  });

  it("RS-043 judgment sword rejects selecting the same power card twice", () => {
    const patStriker = inst("RS-043", "pat");
    const p1 = inst("TST-P", "p1");
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        rush: [patStriker],
        power: [p1, inst("TST-P", "p2"), inst("TST-P", "p3")],
      },
      player2: { battle: [] },
    });

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: patStriker.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    const first = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: p1.instanceId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;

    const duplicate = applyAction(state, {
      type: "resolve_effect_choice",
      playerId: "player1",
      instanceId: p1.instanceId,
    });
    expect(duplicate.ok).toBe(false);
    expect(battleUnit(state, "player1", patStriker.instanceId)?.spModifier ?? 0).toBe(0);
    expect(state.players.player1.discard).toHaveLength(0);
  });

  it("RS-043 judgment sword grants SP1 only after discarding two power cards", () => {
    const patStriker = inst("RS-043", "pat");
    const p1 = inst("TST-P", "p1");
    const p2 = inst("TST-P", "p2");
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        rush: [patStriker],
        power: [p1, p2, inst("TST-P", "p3")],
      },
      player2: { battle: [] },
    });

    const moved = applyAction(state, {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: patStriker.instanceId,
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    state = moved.state;

    for (const id of [p1.instanceId, p2.instanceId]) {
      const picked = applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: id,
      });
      expect(picked.ok).toBe(true);
      if (!picked.ok) return;
      state = picked.state;
    }

    expect(state.players.player1.power).toHaveLength(1);
    expect(state.players.player1.discard).toHaveLength(2);
    expect(battleUnit(state, "player1", patStriker.instanceId)?.spModifier).toBe(1);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "strike" && a.instanceId === patStriker.instanceId,
      ),
    ).toBe(true);
  });

  it("RS-058 cannot strike at CN 4 without yellow thunder", () => {
    const yellow = inst("RS-058", "yellow");
    const rushDefender = inst("TST-UNIT-0", "d-rush");
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        rush: [yellow],
        battle: battleFillers(3),
      },
      player2: { rush: [rushDefender], battle: [] },
    });

    state = moveToBattle(state, yellow.instanceId);
    expect(hasNcLog(state, "yellow_thunder")).toBe(false);
    expect(battleUnit(state, "player1", yellow.instanceId)?.spModifier ?? 0).toBe(0);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "strike" && a.instanceId === yellow.instanceId,
      ),
    ).toBe(false);
    expect(
      getLegalActions(state).some(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === yellow.instanceId &&
          a.defenderInstanceId === rushDefender.instanceId,
      ),
    ).toBe(false);
  });

  it("RS-058 can strike at CN 3 with yellow thunder", () => {
    const yellow = inst("RS-058", "yellow");
    const rushDefender = inst("TST-UNIT-0", "d-rush");
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        rush: [yellow],
        battle: battleFillers(2),
      },
      player2: { rush: [rushDefender], battle: [] },
    });

    state = moveToBattle(state, yellow.instanceId);
    expect(hasNcLog(state, "yellow_thunder")).toBe(true);
    expect(battleUnit(state, "player1", yellow.instanceId)?.spModifier).toBe(1);
    expect(
      getLegalActions(state).some(
        (a) => a.type === "strike" && a.instanceId === yellow.instanceId,
      ),
    ).toBe(true);
    expect(
      getLegalActions(state).some(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === yellow.instanceId &&
          a.defenderInstanceId === rushDefender.instanceId,
      ),
    ).toBe(true);
  });
});
