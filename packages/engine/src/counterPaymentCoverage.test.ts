import { describe, expect, it } from "vitest";
import { getCardEffect, legend1Catalog } from "@rangers-strike/cards";
import { getLegalActions, isLegalAction } from "./index";
import { createTestState, inst, releasedEtCommand, releasedMaCommand, releasedWbCommand } from "./testing/fixtures";
import type { CardInstance, GameState, PlayerId } from "./types/game";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

function powerCards(count: number, prefix: string): CardInstance[] {
  return Array.from({ length: count }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

const COUNTER_OPS = legend1Catalog.cards
  .filter((card) => getCardEffect(card.id)?.kind === "counter")
  .map((card) => card.id);

type CounterSpec = {
  cardId: string;
  releasedCommand: (suffix: string) => CardInstance;
  powerCount: number;
  buildPending: (counter: CardInstance, defenderId: PlayerId) => Partial<GameState>;
  defenderId: PlayerId;
};

const COUNTER_SPECS: CounterSpec[] = [
  {
    cardId: "RS-006",
    releasedCommand: releasedEtCommand,
    powerCount: 1,
    defenderId: "player2",
    buildPending: (counter, defenderId) => ({
      phase: "battle",
      activePlayer: "player1",
      pendingBattle: {
        attackerPlayerId: "player1",
        attackerInstanceId: "TST-UNIT-2:a1",
        defenderPlayerId: defenderId,
        defenderInstanceId: "TST-UNIT-0:d1",
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d1")],
        hand: [counter],
      },
    }),
  },
  {
    cardId: "RS-018",
    releasedCommand: releasedMaCommand,
    powerCount: 4,
    defenderId: "player2",
    buildPending: (counter, defenderId) => ({
      phase: "battle",
      activePlayer: "player1",
      pendingBattle: {
        attackerPlayerId: "player1",
        attackerInstanceId: "TST-UNIT-2:a1",
        defenderPlayerId: defenderId,
        defenderInstanceId: "TST-UNIT-0:d1",
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d1")],
        rush: [inst("TST-UNIT-7", "sub1")],
        hand: [counter],
      },
    }),
  },
  {
    cardId: "RS-026",
    releasedCommand: releasedMaCommand,
    powerCount: 3,
    defenderId: "player2",
    buildPending: (counter, defenderId) => ({
      phase: "rush",
      activePlayer: "player1",
      pendingRush: {
        rusherPlayerId: "player1",
        rushedInstanceId: "TST-UNIT-0:u1",
        phasePlayerId: "player1",
      },
      player1: { rush: [inst("TST-UNIT-0", "u1")] },
      player2: { hand: [counter] },
    }),
  },
  {
    cardId: "RS-016",
    releasedCommand: releasedWbCommand,
    powerCount: 4,
    defenderId: "player2",
    buildPending: (counter, defenderId) => ({
      phase: "battle",
      activePlayer: "player1",
      pendingLeave: {
        ownerPlayerId: defenderId,
        instanceId: "TST-UNIT-0:d1",
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: "TST-UNIT-0",
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [inst("TST-UNIT-0", "d1")],
        discard: [inst("TST-UNIT-0", "twin")],
        hand: [counter],
      },
    }),
  },
  {
    cardId: "RS-027",
    releasedCommand: releasedWbCommand,
    powerCount: 0,
    defenderId: "player2",
    buildPending: (counter, defenderId) => ({
      phase: "battle",
      activePlayer: "player1",
      pendingLeave: {
        ownerPlayerId: defenderId,
        instanceId: "TST-UNIT-2:d1",
        fromZone: "battle",
        toZone: "discard",
        leavingCardId: "TST-UNIT-2",
        phasePlayerId: "player1",
      },
      player1: { battle: [inst("TST-UNIT-2", "a1")] },
      player2: {
        battle: [inst("TST-UNIT-2", "d1")],
        deck: [inst("TST-OP", "deck1"), inst("TST-OP", "deck2")],
        hand: [counter],
      },
    }),
  },
];

function applyPending(
  state: GameState,
  pending: Partial<GameState>,
): GameState {
  return {
    ...state,
    phase: pending.phase ?? state.phase,
    activePlayer: pending.activePlayer ?? state.activePlayer,
    pendingBattle: pending.pendingBattle,
    pendingRush: pending.pendingRush,
    pendingLeave: pending.pendingLeave,
  };
}

describe("counter payment coverage (all operation counters)", () => {
  it("catalog lists five hand operation counters", () => {
    expect(COUNTER_OPS).toEqual(
      expect.arrayContaining(["RS-006", "RS-016", "RS-018", "RS-026", "RS-027"]),
    );
    expect(COUNTER_SPECS.map((spec) => spec.cardId).sort()).toEqual([...COUNTER_OPS].sort());
  });

  it.each(COUNTER_SPECS)(
    "$cardId offers category payment with released command, not pre-held only",
    (spec) => {
      const counter = inst(spec.cardId, "counter");
      const released = spec.releasedCommand("pay");
      const heldOnly = { ...spec.releasedCommand("held"), commandHeld: true };
      const pending = spec.buildPending(counter, spec.defenderId);
      let state = applyPending(
        createTestState({
          phase: pending.phase,
          activePlayer: pending.activePlayer,
          player1: pending.player1,
          player2: {
            ...pending.player2,
            command: [heldOnly],
            power: powerCards(spec.powerCount, "held-pw"),
          },
        }),
        pending,
      );
      state.definitions[spec.cardId] = def(spec.cardId);

      const heldActions = getLegalActions(state);
      expect(
        heldActions.some(
          (a) =>
            a.type === "initiate_command_payment" &&
            a.sourceInstanceId === counter.instanceId,
        ),
      ).toBe(false);
      expect(
        heldActions.some(
          (a) => a.type === "play_counter" && a.instanceId === counter.instanceId,
        ),
      ).toBe(false);

      state = applyPending(
        createTestState({
          phase: pending.phase,
          activePlayer: pending.activePlayer,
          player1: pending.player1,
          player2: {
            ...pending.player2,
            command: [released],
            power: powerCards(spec.powerCount, "pw"),
          },
        }),
        pending,
      );
      state.definitions[spec.cardId] = def(spec.cardId);
      if (spec.cardId === "RS-018") {
        state.definitions["RS-057"] = def("RS-057");
      }

      const releasedActions = getLegalActions(state);
      expect(
        releasedActions.some(
          (a) =>
            a.type === "initiate_command_payment" &&
            a.playerId === spec.defenderId &&
            a.sourceInstanceId === counter.instanceId,
        ),
      ).toBe(true);
      expect(
        releasedActions.some(
          (a) => a.type === "play_counter" && a.instanceId === counter.instanceId,
        ),
      ).toBe(false);

      expect(
        isLegalAction(state, {
          type: "initiate_command_payment",
          playerId: spec.defenderId,
          kind: "category_use",
          sourceInstanceId: counter.instanceId,
        }),
      ).toBe(true);
    },
  );
});
