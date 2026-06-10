import { describe, expect, it, beforeEach } from "vitest";
import { createTestState } from "../testing/fixtures";
import {
  buildUnitRushedEvent,
  createDefaultEventDispatcher,
  EventDispatcher,
  EventQueue,
  EventResolver,
  resetEventSeqForTests,
  resetListenerIdsForTests,
  resolveUntilBlocked,
  shouldStopEventResolution,
} from "./index";
import type { GameEvent, UnitRushedEvent } from "./index";

describe("EventQueue", () => {
  it("processes events in FIFO order", () => {
    const queue = new EventQueue();
    const state = createTestState();
    const first = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player1",
      instanceId: "u1",
      cardId: "RS-050",
      seq: 1,
    });
    const second = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player2",
      instanceId: "u2",
      cardId: "RS-051",
      seq: 2,
    });

    queue.enqueue(first);
    queue.enqueue([second]);

    expect(queue.size()).toBe(2);
    expect(queue.peek()?.instanceId).toBe("u1");
    expect(queue.dequeue()?.instanceId).toBe("u1");
    expect(queue.dequeue()?.instanceId).toBe("u2");
    expect(queue.isEmpty()).toBe(true);
  });
});

describe("EventDispatcher", () => {
  beforeEach(() => {
    resetListenerIdsForTests();
    resetEventSeqForTests();
  });

  it("runs listeners in registration order and chains state", () => {
    const dispatcher = new EventDispatcher();
    const calls: string[] = [];

    dispatcher.on("UnitRushed", (event, state) => {
      calls.push(`a:${event.instanceId}`);
      return {
        state: { ...state, log: [...state.log, "listener-a"] },
      };
    });
    dispatcher.on("UnitRushed", (event, state) => {
      calls.push(`b:${event.instanceId}`);
      return {
        state: { ...state, log: [...state.log, "listener-b"] },
      };
    });

    const state = createTestState();
    const event = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player1",
      instanceId: "u1",
      cardId: "RS-050",
    });

    const outcome = dispatcher.dispatch(event, state);
    expect(calls).toEqual(["a:u1", "b:u1"]);
    expect(outcome.state.log).toEqual(["listener-a", "listener-b"]);
  });

  it("collects follow-up events from listeners", () => {
    const dispatcher = new EventDispatcher();
    const state = createTestState();
    const followUp = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player2",
      instanceId: "u2",
      cardId: "RS-051",
    });

    dispatcher.on("UnitRushed", () => ({
      state,
      events: [followUp],
    }));

    const event = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player1",
      instanceId: "u1",
      cardId: "RS-050",
    });

    const outcome = dispatcher.dispatch(event, state);
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events?.[0]?.instanceId).toBe("u2");
  });
});

describe("EventResolver", () => {
  beforeEach(() => {
    resetListenerIdsForTests();
    resetEventSeqForTests();
  });

  it("resolves queued events until empty with default dispatcher", () => {
    const state = createTestState();
    const queue = new EventQueue();
    const dispatcher = createDefaultEventDispatcher();
    const event = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player1",
      instanceId: "u1",
      cardId: "RS-050",
    });
    queue.enqueue(event);

    const result = resolveUntilBlocked(state, queue, dispatcher);
    expect(result.stoppedReason).toBe("queue_empty");
    expect(result.processedEvents).toHaveLength(1);
    expect(result.logs).toEqual([]);
    expect(queue.isEmpty()).toBe(true);
  });

  it("stops when listener requests stopResolution", () => {
    const dispatcher = new EventDispatcher();
    const state = createTestState();
    const queue = new EventQueue();

    dispatcher.on("UnitRushed", (event, current) => ({
      state: {
        ...current,
        pendingStrike: {
          strikerPlayerId: "player1",
          strikerInstanceId: event.instanceId,
          damage: 1,
          battlePhasePlayer: "player1",
        },
      },
      stopResolution: true,
    }));

    queue.enqueue(
      buildUnitRushedEvent({
        state,
        rusherPlayerId: "player1",
        instanceId: "u1",
        cardId: "RS-050",
      }),
    );
    queue.enqueue(
      buildUnitRushedEvent({
        state,
        rusherPlayerId: "player2",
        instanceId: "u2",
        cardId: "RS-051",
      }),
    );

    const resolver = new EventResolver(dispatcher);
    const result = resolver.resolveUntilBlocked(state, queue);

    expect(result.stoppedReason).toBe("listener_stop");
    expect(result.processedEvents).toHaveLength(1);
    expect(queue.size()).toBe(1);
    expect(result.state.pendingStrike).toBeDefined();
    expect(result.state.effectStack?.frames[0]?.kind).toBe("strike_reaction");
  });

  it("stops when pending blocks before dequeuing next event", () => {
    const dispatcher = createDefaultEventDispatcher();
    const state = createTestState({
      pendingBattle: {
        attackerPlayerId: "player1",
        attackerInstanceId: "a1",
        defenderPlayerId: "player2",
        defenderInstanceId: "d1",
        phasePlayerId: "player1",
      },
    });
    const queue = new EventQueue();
    queue.enqueue(
      buildUnitRushedEvent({
        state,
        rusherPlayerId: "player1",
        instanceId: "u1",
        cardId: "RS-050",
      }),
    );

    const result = resolveUntilBlocked(state, queue, dispatcher);
    expect(result.stoppedReason).toBe("pending_blocked");
    expect(result.processedEvents).toHaveLength(0);
    expect(queue.size()).toBe(1);
  });

  it("enqueues listener follow-up events and processes them in order", () => {
    const dispatcher = new EventDispatcher();
    const state = createTestState();
    const queue = new EventQueue();
    const order: string[] = [];

    dispatcher.on("UnitRushed", (event, current) => {
      order.push(`rush:${event.instanceId}`);
      if (event.instanceId === "u1") {
        return {
          state: current,
          events: [
            buildUnitRushedEvent({
              state: current,
              rusherPlayerId: "player2",
              instanceId: "u2",
              cardId: "RS-051",
            }),
          ],
        };
      }
      return { state: current };
    });

    queue.enqueue(
      buildUnitRushedEvent({
        state,
        rusherPlayerId: "player1",
        instanceId: "u1",
        cardId: "RS-050",
      }),
    );

    const result = resolveUntilBlocked(state, queue, dispatcher);
    expect(result.stoppedReason).toBe("queue_empty");
    expect(order).toEqual(["rush:u1", "rush:u2"]);
    expect(result.processedEvents.map((e) => (e as UnitRushedEvent).instanceId)).toEqual([
      "u1",
      "u2",
    ]);
  });
});

describe("shouldStopEventResolution", () => {
  it("detects winner and effect stack blocks", () => {
    const base = createTestState();
    expect(shouldStopEventResolution(base)).toBe(false);
    expect(shouldStopEventResolution({ ...base, winner: "player1" })).toBe(true);
    expect(
      shouldStopEventResolution({
        ...base,
        pendingRush: {
          rusherPlayerId: "player1",
          rushedInstanceId: "u1",
          phasePlayerId: "player1",
        },
      }),
    ).toBe(true);
  });
});

describe("isGameEvent", () => {
  it("narrows known event types", () => {
    const state = createTestState();
    const event: GameEvent = buildUnitRushedEvent({
      state,
      rusherPlayerId: "player1",
      instanceId: "u1",
      cardId: "RS-050",
    });
    expect(event.type).toBe("UnitRushed");
  });
});
