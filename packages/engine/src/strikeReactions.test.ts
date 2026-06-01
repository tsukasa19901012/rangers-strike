import { describe, expect, it } from "vitest";
import { applyAction } from "./core/applyAction";
import { getLegalActions as getActions } from "./core/legalActions";
import type { GameState } from "./types/game";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("earth force", () => {
  it("still allows rush when earth force is active", () => {
    const unit = inst("TST-UNIT-0", "h1");
    const earthForce = inst("RS-022", "op");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2")],
        command: [heldWbCommand("c1")],
        operation: [earthForce],
      },
    });

    const rushes = getActions(state).filter((a) => a.type === "rush");
    expect(rushes).toHaveLength(1);
  });

  it("requires rush units to enter battle before ending the battle phase", () => {
    const unit = inst("TST-UNIT-0", "r1");
    const earthForce = inst("RS-022", "op");
    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [unit],
        command: [heldWbCommand("c1")],
        operation: [earthForce],
      },
    });

    const endPhase = getActions(state).find((a) => a.type === "end_phase");
    expect(endPhase).toBeUndefined();

    const moves = getActions(state).filter((a) => a.type === "move_to_battle");
    expect(moves).toHaveLength(1);
  });

  it("does not allow hand to battle during battle phase", () => {
    const unit = inst("TST-UNIT-0", "h1");
    const earthForce = inst("RS-022", "op");
    const state = createTestState({
      phase: "battle",
      player1: {
        hand: [unit],
        power: [inst("TST-P", "p1")],
        command: [heldWbCommand("c1")],
        operation: [earthForce],
      },
    });

    const moves = getActions(state).filter((a) => a.type === "move_to_battle");
    expect(moves).toHaveLength(0);
  });

  it("opens upkeep choice after draw when 3+ face-up power cards exist", () => {
    const earthForce = inst("RS-022", "op");
    const state = createTestState({
      phase: "start",
      player1: {
        deck: [inst("TST-P", "d1")],
        operation: [earthForce],
        power: [
          { ...inst("TST-P", "p1"), faceDown: false },
          { ...inst("TST-P", "p2"), faceDown: false },
          { ...inst("TST-P", "p3"), faceDown: false },
        ],
      },
    });

    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));

    expect(next.pendingEffectChoice?.kind).toBe("select_power");
    expect(next.pendingEffectChoice?.effectId).toBe("earth_force");
    expect(next.pendingEffectChoice?.selectCount).toBe(3);
    expect(getActions(next).some((a) => a.type === "end_phase")).toBe(false);
    expect(getActions(next).some((a) => a.type === "skip_effect_choice")).toBe(true);
  });

  it("allows ending start phase after paying upkeep", () => {
    const earthForce = inst("RS-022", "op");
    const p1 = { ...inst("TST-P", "p1"), faceDown: false };
    const p2 = { ...inst("TST-P", "p2"), faceDown: false };
    const p3 = { ...inst("TST-P", "p3"), faceDown: false };
    let state: GameState = {
      ...createTestState({
        phase: "start",
        player1: {
          deck: [inst("TST-P", "d1")],
          operation: [earthForce],
          power: [p1, p2, p3],
          hasDrawnThisStart: true,
        },
      }),
      pendingEffectChoice: {
        playerId: "player1",
        effectId: "earth_force",
        sourceCardId: "RS-022",
        sourceInstanceId: earthForce.instanceId,
        kind: "select_power",
        phasePlayerId: "player1",
        validInstanceIds: [p1.instanceId, p2.instanceId, p3.instanceId],
        selectCount: 3,
        optional: false,
        selectedInstanceIds: [],
      },
    };

    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: p1.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: p2.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: p3.instanceId,
      }),
    );

    expect(state.players.player1.hasPaidEarthForceUpkeep).toBe(true);
    expect(state.players.player1.power).toHaveLength(0);
    expect(state.players.player1.discard).toHaveLength(3);
    expect(state.players.player1.operation).toHaveLength(1);

    state = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));
    expect(state.phase).toBe("charge");
    expect(state.players.player1.operation).toHaveLength(1);
  });

  it("discards earth force when fewer than 3 face-up power cards at start end", () => {
    const earthForce = inst("RS-022", "op");
    const state = createTestState({
      phase: "start",
      player1: {
        operation: [earthForce],
        power: [
          { ...inst("TST-P", "p1"), faceDown: false },
          { ...inst("TST-P", "p2"), faceDown: true },
        ],
        hasDrawnThisStart: true,
      },
    });

    const next = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));

    expect(next.phase).toBe("charge");
    expect(next.players.player1.operation).toHaveLength(0);
    expect(next.players.player1.discard.some((c) => c.cardId === "RS-022")).toBe(true);
  });

  it("discards earth force when upkeep is skipped", () => {
    const earthForce = inst("RS-022", "op");
    const p1 = { ...inst("TST-P", "p1"), faceDown: false };
    const p2 = { ...inst("TST-P", "p2"), faceDown: false };
    const p3 = { ...inst("TST-P", "p3"), faceDown: false };
    let state: GameState = {
      ...createTestState({
        phase: "start",
        player1: {
          operation: [earthForce],
          power: [p1, p2, p3],
          hasDrawnThisStart: true,
        },
      }),
      pendingEffectChoice: {
        playerId: "player1",
        effectId: "earth_force",
        sourceCardId: "RS-022",
        sourceInstanceId: earthForce.instanceId,
        kind: "select_power",
        phasePlayerId: "player1",
        validInstanceIds: [p1.instanceId, p2.instanceId, p3.instanceId],
        selectCount: 3,
        optional: false,
        selectedInstanceIds: [],
      },
    };

    state = unwrap(
      applyAction(state, { type: "skip_effect_choice", playerId: "player1" }),
    );

    expect(state.pendingEffectChoice).toBeUndefined();
    expect(state.players.player1.operation).toHaveLength(0);
    expect(state.players.player1.power).toHaveLength(3);
    expect(state.players.player1.discard.some((c) => c.cardId === "RS-022")).toBe(true);

    state = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));
    expect(state.phase).toBe("charge");
  });
});

describe("courage magic", () => {
  it("releases a held command when S unit enters battle", () => {
    const sUnit = inst("TST-UNIT-0", "r1");
    const courage = inst("RS-029", "op");
    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [sUnit],
        command: [heldWbCommand("c1")],
        operation: [courage],
      },
    });

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: sUnit.instanceId,
      }),
    );

    expect(next.players.player1.command[0]?.commandHeld).toBe(false);
  });
});

describe("strike reactions", () => {
  it("does not offer dino guts during strike window", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const dinoGuts = inst("RS-027", "dg");
    const fiveTech = inst("RS-014", "ft");
    const interceptor = inst("TST-UNIT-0", "s1");
    let state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        rush: [interceptor],
        hand: [dinoGuts],
        command: [heldWbCommand("c1")],
        operation: [fiveTech],
      },
    });
    state.definitions["RS-027"] = {
      id: "RS-027",
      name: "ダイノガッツ",
      type: "operation",
      category: "WB",
      rarity: "R",
      expansion: "legend1",
      powerCost: 0,
    };
    state.definitions["RS-014"] = {
      id: "RS-014",
      name: "ファイブテクター",
      type: "operation",
      category: "WB",
      rarity: "R",
      expansion: "legend1",
      powerCost: 0,
      tags: ["常駐"],
    };

    state = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );

    expect(state.pendingStrike).toBeDefined();
    const counters = getActions(state).filter((a) => a.type === "play_counter");
    expect(counters).toHaveLength(0);
  });

  it("offers plasma energy counter when permanent is active", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const plasma = inst("RS-067", "plasma");
    let state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { operation: [plasma] },
    });
    state.definitions["RS-067"] = {
      id: "RS-067",
      name: "Plasma",
      type: "operation",
      category: "ET",
      rarity: "R",
      expansion: "legend1",
      powerCost: 5,
    };

    state = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );

    const plasmaAction = getActions(state).find((a) => a.type === "use_plasma_energy");
    expect(plasmaAction).toBeDefined();

    state = unwrap(applyAction(state, plasmaAction!));
    expect(state.players.player1.battle).toHaveLength(0);
    expect(state.players.player2.damage).toBeGreaterThan(0);
    expect(state.players.player2.operation).toHaveLength(0);
    expect(state.players.player2.discard.some((c) => c.cardId === "RS-067")).toBe(true);
  });
});
