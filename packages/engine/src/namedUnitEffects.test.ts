import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions } from "./index";
import { canAttackRushWithYellowThunder, hasBattleNcEffect } from "./rules/namedUnitEffects";
import { createTestState, inst } from "./testing/fixtures";
import { battleFillers, battleUnit, moveToBattle } from "./testing/battleEntry";
import { legend1Catalog } from "@rangers-strike/cards";

const defs = Object.fromEntries(legend1Catalog.cards.map((c) => [c.id, c]));

describe("named unit effects", () => {
  it("RS-033 panther claw blocks battle counters", () => {
    const panther = inst("RS-033", "a1");
    const defender = inst("RS-048", "d1");
    const counter = inst("RS-006", "c1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: { battle: [panther] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [{ ...inst("RS-007", "cmd"), commandHeld: true }],
      },
    });

    const battle = getLegalActions(state).find((a) => a.type === "battle");
    expect(battle).toBeDefined();
    const next = applyAction(state, battle!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.state.pendingBattle).toBeUndefined();
  });

  it("RS-045 signal cannon adds defending BP for OT M", () => {
    const signal = inst("RS-045", "s1");
    const attacker = inst("RS-046", "a1");
    const defender = inst("RS-043", "d1");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: { battle: [attacker], rush: [signal] },
      player2: { battle: [defender] },
    });

    const battle = getLegalActions(state).find((a) => a.type === "battle");
    const next = applyAction(state, battle!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.state.players.player1.battle).toHaveLength(0);
    expect(next.state.players.player2.battle).toHaveLength(1);
  });

  it("RS-040 moss breaker holds enemy command on NC", () => {
    const moss = inst("RS-040", "m1");
    const partner = inst("RS-041", "p1");
    const enemyCmd = { ...inst("RS-007", "ec"), commandHeld: false };
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: defs,
      player1: {
        battle: [partner],
        rush: [moss],
        command: [{ ...inst("RS-007", "cmd"), commandHeld: true }],
        power: [inst("RS-007", "pow1")],
      },
      player2: {
        command: [enemyCmd],
      },
    });

    const move = getLegalActions(state).find((a) => a.type === "move_to_battle");
    expect(move).toBeDefined();
    const next = applyAction(state, move!);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.state.pendingEffectChoice?.effectId).toBe("moss_breaker");
    expect(next.state.pendingEffectChoice?.playerId).toBe("player2");
    expect(next.state.activePlayer).toBe("player2");
    const choiceActions = getLegalActions(next.state);
    expect(
      choiceActions.some(
        (a) => a.type === "initiate_command_payment" && a.kind === "effect_hold",
      ),
    ).toBe(true);

    const initiated = applyAction(next.state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "effect_hold",
      sourceInstanceId: enemyCmd.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player2",
      commandInstanceIds: [enemyCmd.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.pendingEffectChoice).toBeUndefined();
    expect(resolved.state.players.player2.command[0]?.commandHeld).toBe(true);
  });

  it("RS-058 yellow thunder requires NC activation to attack rush", () => {
    const yellow = inst("RS-058", "yellow");
    const rushDefender = inst("TST-UNIT-0", "d-rush");
    const defs = Object.fromEntries(legend1Catalog.cards.map((c) => [c.id, c]));
    let state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: { rush: [yellow], battle: battleFillers(2) },
      player2: { rush: [rushDefender], battle: [] },
    });
    state = moveToBattle(state, yellow.instanceId);
    expect(battleUnit(state, "player1", yellow.instanceId)?.spModifier).toBe(1);
    expect(hasBattleNcEffect(battleUnit(state, "player1", yellow.instanceId)!, "yellow_thunder")).toBe(
      true,
    );
    expect(canAttackRushWithYellowThunder(state, "player1", yellow.instanceId)).toBe(true);

    const boostedOnly = createTestState({
      phase: "battle",
      definitions: defs,
      player1: {
        battle: [{ ...inst("RS-058", "boosted"), spModifier: 1 }],
      },
      player2: { rush: [inst("TST-UNIT-0", "d-rush-3")], battle: [] },
    });
    expect(canAttackRushWithYellowThunder(boostedOnly, "player1", "RS-058:boosted")).toBe(false);

    const yellowCn4 = inst("RS-058", "y2");
    const atCn4 = moveToBattle(
      createTestState({
        phase: "battle",
        definitions: defs,
        player1: { rush: [yellowCn4], battle: battleFillers(3) },
        player2: { rush: [inst("TST-UNIT-0", "d-rush-2")], battle: [] },
      }),
      yellowCn4.instanceId,
    );
    expect(battleUnit(atCn4, "player1", yellowCn4.instanceId)?.spModifier ?? 0).toBe(0);
    expect(canAttackRushWithYellowThunder(atCn4, "player1", yellowCn4.instanceId)).toBe(false);
  });
});
