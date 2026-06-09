import type { CardDocument, EffectDefinition, TriggerType } from "./types";
import { getTriggerType } from "./validator";
import { loadAllCardDocuments } from "./loader";

export type RegistryEntry = {
  card: CardDocument;
  effects: EffectDefinition[];
};

export type CardRegistrySnapshot = {
  cards: Map<string, CardDocument>;
  effectsById: Map<string, { cardId: string; effect: EffectDefinition }>;
  byTrigger: Map<TriggerType, Array<{ cardId: string; effect: EffectDefinition }>>;
  unimplemented: string[];
  dslReady: string[];
  legacyHandler: string[];
};

export class CardRegistry {
  private cards = new Map<string, CardDocument>();
  private effectsById = new Map<string, { cardId: string; effect: EffectDefinition }>();
  private byTrigger = new Map<TriggerType, Array<{ cardId: string; effect: EffectDefinition }>>();

  register(card: CardDocument): void {
    this.cards.set(card.id, card);

    for (const effect of card.effects ?? []) {
      this.effectsById.set(effect.id, { cardId: card.id, effect });

      const triggerType = getTriggerType(effect.trigger) as TriggerType;
      const list = this.byTrigger.get(triggerType) ?? [];
      list.push({ cardId: card.id, effect });
      this.byTrigger.set(triggerType, list);
    }
  }

  registerAll(cards: CardDocument[]): void {
    for (const card of cards) {
      this.register(card);
    }
  }

  getCard(cardId: string): CardDocument | undefined {
    return this.cards.get(cardId);
  }

  getEffect(effectId: string): { cardId: string; effect: EffectDefinition } | undefined {
    return this.effectsById.get(effectId);
  }

  listCards(): CardDocument[] {
    return [...this.cards.values()];
  }

  listByTrigger(trigger: TriggerType): Array<{ cardId: string; effect: EffectDefinition }> {
    return this.byTrigger.get(trigger) ?? [];
  }

  listEffectIds(): string[] {
    return [...this.effectsById.keys()];
  }

  listUnimplemented(): string[] {
    return this.listCards()
      .filter((c) => c.implementation?.handler === "unimplemented")
      .map((c) => c.id);
  }

  listDslReady(): string[] {
    return this.listCards()
      .filter((c) => c.implementation?.handler === "interpreter")
      .map((c) => c.id);
  }

  listLegacyHandler(): string[] {
    return this.listCards()
      .filter((c) => c.implementation?.handler === "typescript")
      .map((c) => c.id);
  }

  snapshot(): CardRegistrySnapshot {
    return {
      cards: new Map(this.cards),
      effectsById: new Map(this.effectsById),
      byTrigger: new Map(this.byTrigger),
      unimplemented: this.listUnimplemented(),
      dslReady: this.listDslReady(),
      legacyHandler: this.listLegacyHandler(),
    };
  }

  size(): number {
    return this.cards.size;
  }

  effectCount(): number {
    return this.effectsById.size;
  }
}

/** デフォルトレジストリ（全カタログ読み込み済み） */
let defaultRegistry: CardRegistry | null = null;

export function getDefaultCardRegistry(): CardRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new CardRegistry();
    defaultRegistry.registerAll(loadAllCardDocuments());
  }
  return defaultRegistry;
}

export function resetDefaultCardRegistry(): void {
  defaultRegistry = null;
}

export function createCardRegistryFromCatalog(): CardRegistry {
  const registry = new CardRegistry();
  registry.registerAll(loadAllCardDocuments());
  return registry;
}
