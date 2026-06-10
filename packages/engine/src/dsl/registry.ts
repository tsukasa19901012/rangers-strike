import type { EventDispatcher } from "../events/EventDispatcher";
import type { GameEvent, EventListener } from "../events/types";
import type { GameState } from "../types/game";
import { interpretDslEffect } from "./interpreter";
import type { DslEffectDefinition, DslExecutionContext } from "./types";
import { eventCardId } from "./loadFromCards";

const dslByTrigger = new Map<string, DslEffectDefinition[]>();

export function registerDslEffect(definition: DslEffectDefinition): void {
  const list = dslByTrigger.get(definition.trigger) ?? [];
  list.push(definition);
  dslByTrigger.set(definition.trigger, list);
}

export function resetDslRegistryForTests(): void {
  dslByTrigger.clear();
}

function dslListenerFor(trigger: string): EventListener {
  return (event: GameEvent, state: GameState) => {
    const definitions = dslByTrigger.get(trigger) ?? [];
    const cardId = eventCardId(event);
    let current = state;
    for (const definition of definitions) {
      if (definition.sourceCardId && cardId && definition.sourceCardId !== cardId) {
        continue;
      }

      const ctx: DslExecutionContext = {
        effectId: definition.effectId,
        sourceCardId: definition.sourceCardId ?? definition.effectId,
        playerId: event.phasePlayerId,
      };
      const result = interpretDslEffect(current, definition, ctx, event.phasePlayerId);
      current = result.state;
      if (result.stopResolution) return result;
    }
    return { state: current };
  };
}

/** Phase 0: DSL 効果を Event Listener registry に接続（card-id スコープ付き）。 */
export function registerDslListeners(dispatcher: EventDispatcher): void {
  for (const trigger of dslByTrigger.keys()) {
    dispatcher.on(trigger as GameEvent["type"], dslListenerFor(trigger));
  }
}
