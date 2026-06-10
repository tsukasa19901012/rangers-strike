import { withSyncedEffectStack } from "../rules/effectStack";
import type { GameState } from "../types/game";
import {
  resolutionStopReason,
  shouldStopEventResolution,
  type EventResolutionStopReason,
} from "./blocking";
import type { EventDispatcher } from "./EventDispatcher";
import type { EventQueue } from "./EventQueue";
import type { EnterBattleResumeFrom, GameEvent } from "./types";

const DEFAULT_MAX_ITERATIONS = 10_000;

export type ResolveUntilBlockedOptions = {
  maxIterations?: number;
};

export type ResolveUntilBlockedResult = {
  state: GameState;
  processedEvents: GameEvent[];
  logs: string[];
  enterResumeFrom?: EnterBattleResumeFrom;
  stoppedReason: EventResolutionStopReason;
};

/**
 * EventQueue を空になるかブロック条件に達するまで解決する。
 * GameEvent → Listener → EffectResolver の中核ループ（カード効果は Listener 経由で後接続）。
 */
export class EventResolver {
  constructor(private readonly dispatcher: EventDispatcher) {}

  resolveUntilBlocked(
    state: GameState,
    queue: EventQueue,
    options: ResolveUntilBlockedOptions = {},
  ): ResolveUntilBlockedResult {
    return resolveUntilBlocked(state, queue, this.dispatcher, options);
  }
}

export function resolveUntilBlocked(
  state: GameState,
  queue: EventQueue,
  dispatcher: EventDispatcher,
  options: ResolveUntilBlockedOptions = {},
): ResolveUntilBlockedResult {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  let currentState = state;
  const processedEvents: GameEvent[] = [];
  const logs: string[] = [];
  let enterResumeFrom: EnterBattleResumeFrom | undefined;
  let iterations = 0;
  let listenerStopped = false;

  while (iterations < maxIterations) {
    if (shouldStopEventResolution(currentState)) {
      break;
    }

    const event = queue.dequeue();
    if (!event) {
      break;
    }

    iterations += 1;
    processedEvents.push(event);

    const outcome = dispatcher.dispatch(event, currentState);
    currentState = outcome.state;

    if (outcome.logs?.length) {
      logs.push(...outcome.logs);
    }

    if (outcome.enterResumeFrom !== undefined) {
      enterResumeFrom = outcome.enterResumeFrom;
    }

    if (outcome.events?.length) {
      queue.enqueue(outcome.events);
    }

    if (outcome.stopResolution) {
      listenerStopped = true;
      break;
    }
  }

  const hitMaxIterations = iterations >= maxIterations && !queue.isEmpty();
  const stoppedReason = resolutionStopReason(
    currentState,
    queue.isEmpty(),
    listenerStopped,
    hitMaxIterations,
  );

  return {
    state: withSyncedEffectStack(currentState),
    processedEvents,
    logs,
    enterResumeFrom,
    stoppedReason,
  };
}
