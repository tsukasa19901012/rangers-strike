import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions, isLegalAction } from "./index";
import {
  createTestState,
  inst,
  releasedEtCommand,
  releasedMaCommand,
  releasedWbCommand,
} from "./testing/fixtures";
import { counterWithCategoryHold } from "./testing/counterPayment";

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
        command: [releasedEtCommand("cmd")],
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
          a.type === "initiate_command_payment" &&
          a.playerId === "player2" &&
          a.sourceInstanceId === counter.instanceId,
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
        command: [releasedWbCommand("cmd")],
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
          a.type === "initiate_command_payment" &&
          a.playerId === "player2" &&
          a.sourceInstanceId === counter.instanceId,
      ),
    ).toBe(true);
    expect(actions.some((a) => a.type === "pass_leave_reaction" && a.playerId === "player2")).toBe(
      true,
    );
    expect(actions.some((a) => a.type === "resolve_effect_choice" && a.playerId === "player1")).toBe(
      false,
    );
  });

  it("allows applying RS-026 rush counter while rusher has a pending effect choice", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const counter = inst("RS-026", "c1");
    const mUnit = inst("TST-UNIT-2", "m1");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player2",
      player1: {
        rush: [unit],
        command: [mUnit],
      },
      player2: {
        hand: [counter],
        command: [releasedMaCommand("cmd")],
        power: [inst("TST-OP", "p2"), inst("TST-OP", "p3"), inst("TST-OP", "p4")],
      },
    });
    state = {
      ...state,
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: unit.instanceId,
        phasePlayerId: "player1",
      },
      pendingEffectChoice: {
        ...attackerEffectChoice,
        validInstanceIds: [mUnit.instanceId],
      },
    };
    state.definitions["RS-026"] = def("RS-026");

    const paymentAction = {
      type: "initiate_command_payment" as const,
      playerId: "player2" as const,
      kind: "category_use" as const,
      sourceInstanceId: counter.instanceId,
    };
    expect(isLegalAction(state, paymentAction)).toBe(true);

    const result = counterWithCategoryHold(
      state,
      "player2",
      counter.instanceId,
      releasedMaCommand("cmd").instanceId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.player1.rush).toHaveLength(0);
    expect(result.state.players.player1.deck[0]?.instanceId).toBe(unit.instanceId);
    expect(result.state.pendingRush).toBeUndefined();
  });
});
