import type {
  EnterBattleResumeFrom,
  EventListener,
  EventListenerRegistration,
  EventListenerResult,
  GameEvent,
  GameEventType,
} from "./types";
import { normalizeListenerResult } from "./types";
import type { GameState } from "../types/game";

let nextListenerId = 0;

function listenerId(): string {
  nextListenerId += 1;
  return `listener_${nextListenerId}`;
}

export function resetListenerIdsForTests(): void {
  nextListenerId = 0;
}

/**
 * イベント種別ごとに Listener を登録し、登録順に実行する。
 * カード効果は Listener として後から接続する（現時点では空でも可）。
 */
export class EventDispatcher {
  private readonly listeners = new Map<GameEventType, EventListenerRegistration[]>();

  on(type: GameEventType, listener: EventListener): () => void {
    const registration: EventListenerRegistration = {
      type,
      listener,
      id: listenerId(),
    };
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(registration);
    this.listeners.set(type, bucket);

    return () => {
      const current = this.listeners.get(type);
      if (!current) return;
      const filtered = current.filter((entry) => entry.id !== registration.id);
      if (filtered.length === 0) {
        this.listeners.delete(type);
      } else {
        this.listeners.set(type, filtered);
      }
    };
  }

  getListeners(type: GameEventType): readonly EventListenerRegistration[] {
    return this.listeners.get(type) ?? [];
  }

  hasListeners(type: GameEventType): boolean {
    return (this.listeners.get(type)?.length ?? 0) > 0;
  }

  /**
   * 1 イベントを全 Listener に渡す。
   * 各 Listener の `events` はキュー末尾へ、状態は次 Listener へ引き継ぐ。
   */
  dispatch(event: GameEvent, state: GameState): EventListenerResult {
    const registrations = this.listeners.get(event.type) ?? [];
    let currentState = state;
    const enqueued: GameEvent[] = [];
    const logs: string[] = [];
    let stopResolution = false;
    let enterResumeFrom: EnterBattleResumeFrom | undefined;

    for (const { listener } of registrations) {
      const raw = listener(event, currentState);
      const outcome = normalizeListenerResult(raw);
      currentState = outcome.state;
      if (outcome.events?.length) {
        enqueued.push(...outcome.events);
      }
      if (outcome.logs?.length) {
        logs.push(...outcome.logs);
      }
      if (outcome.enterResumeFrom !== undefined) {
        enterResumeFrom = outcome.enterResumeFrom;
      }
      if (outcome.stopResolution) {
        stopResolution = true;
        break;
      }
    }

    return {
      state: currentState,
      events: enqueued.length > 0 ? enqueued : undefined,
      logs: logs.length > 0 ? logs : undefined,
      stopResolution: stopResolution || undefined,
      enterResumeFrom,
    };
  }

  clone(): EventDispatcher {
    const copy = new EventDispatcher();
    for (const [type, registrations] of this.listeners) {
      copy.listeners.set(type, [...registrations]);
    }
    return copy;
  }
}

/** カード効果未接続の空 Dispatcher（Phase 2 移行のデフォルト）。 */
export function createDefaultEventDispatcher(): EventDispatcher {
  return new EventDispatcher();
}
