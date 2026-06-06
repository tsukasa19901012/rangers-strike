import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { getLegalActions } from "./index";
import { createTestState, heldEtCommand, heldWbCommand, inst } from "./testing/fixtures";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

const attackerEffectChoice = {
  playerId: "player1" as const,
  effectId: "air_transport",
  sourceCardId: "TST-LEG2-RUSH",
  kind: "select_command" as const,
  phasePlayerId: "player1" as const,
  validInstanceIds: ["cmd-m"],
  optional: true,
  commandFilter: "released" as const,
  commandAction: "rush" as const,
};

describe("counter reaction priority over effect choice", () => {
  it("offers battle counter to defender when attacker has a pending effect choice", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const counter = inst("RS-006", "c1");

    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [heldEtCommand("cmd")],
        power: [inst("TST-OP", "p1")],
      },
    });
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderPlayerId: "player2",
        defenderInstanceId: defender.instanceId,
        phasePlayerId: "player1",
      },
      pendingEffectChoice: attackerEffectChoice,
    };
    state.definitions["RS-006"] = def("RS-006");

    const actions = getLegalActions(state);
    expect(
      actions.some(
        (a) =>
          a.type === "play_counter" &&
          a.playerId === "player2" &&
          a.instanceId === counter.instanceId,
      ),
    ).toBe(true);
    expect(actions.some((a) => a.type === "pass_battle_reaction" && a.playerId === "player2")).toBe(
      true,
    );
    expect(actions.some((a) => a.type === "resolve_effect_choice" && a.playerId === "player1")).toBe(
      false,
    );
  });

  it("offers strike reaction to defender when striker has a pending effect choice", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");

    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [attacker] },
      player2: { battle: [defender] },
    });
    state = {
      ...state,
      pendingStrike: {
        strikerPlayerId: "player1",
        strikerInstanceId: attacker.instanceId,
        damage: 2,
        battlePhasePlayer: "player1",
      },
      pendingEffectChoice: attackerEffectChoice,
    };

    const actions = getLegalActions(state);
    expect(
      actions.some((a) => a.type === "pass_strike_reaction" && a.playerId === "player2"),
    ).toBe(true);
    expect(actions.some((a) => a.type === "resolve_effect_choice" && a.playerId === "player1")).toBe(
      false,
    );
  });

  it("offers leave counter to owner when opponent has a pending effect choice", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const twin = inst("TST-UNIT-0", "d2");
    const counter = inst("RS-016", "c1");

    let state = createTestState({
      phase: "battle",
      activePlayer: "player2",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        discard: [twin],
        hand: [counter],
        command: [heldWbCommand("cmd")],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
          inst("TST-OP", "p4"),
        ],
      },
    });
    state = {
      ...state,
      pendingLeave: {
        ownerPlayerId: "player2",
        instanceId: defender.instanceId,
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: defender.cardId,
        phasePlayerId: "player1",
      },
      pendingEffectChoice: attackerEffectChoice,
    };
    state.definitions["RS-016"] = def("RS-016");

    const actions = getLegalActions(state);
    expect(
      actions.some(
        (a) =>
          a.type === "play_counter" &&
          a.playerId === "player2" &&
          a.instanceId === counter.instanceId,
      ),
    ).toBe(true);
    expect(actions.some((a) => a.type === "pass_leave_reaction" && a.playerId === "player2")).toBe(
      true,
    );
    expect(actions.some((a) => a.type === "resolve_effect_choice" && a.playerId === "player1")).toBe(
      false,
    );
  });
});
