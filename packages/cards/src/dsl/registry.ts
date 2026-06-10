import type { CardDocument, EffectDefinition, TriggerType } from "./types";
import { getTriggerType } from "./validator";
import {
  loadAllCardDocuments,
  loadExtendedCardDocuments,
  loadFullPlayableDocuments,
} from "./loader";
import { complexityPromotedCatalog, vanillaPromotedCatalog } from "../extendedCatalog";

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

/** Wiki スタブを含む拡張レジストリ（1849 枚想定）。 */
export function createExtendedCardRegistry(): CardRegistry {
  const registry = new CardRegistry();
  registry.registerAll(loadExtendedCardDocuments());
  return registry;
}

/** 179 + vanilla-promoted 354 = 533 枚のフルプレイ可能レジストリ（M11）。 */
export function createFullPlayableRegistry(): CardRegistry {
  const registry = new CardRegistry();
  registry.registerAll(loadFullPlayableDocuments());
  return registry;
}

export type ExtendedRegistryMetrics = {
  total: number;
  playable: number;
  stubs: number;
  dslReady: number;
  legacyHandler: number;
  unimplemented: number;
  stubCompiled: number;
};

export function snapshotExtendedRegistryMetrics(
  registry: CardRegistry = createExtendedCardRegistry(),
): ExtendedRegistryMetrics {
  const snap = registry.snapshot();
  const playableIds = new Set(
    loadAllCardDocuments().map((c) => c.id),
  );
  const stubIds = registry
    .listCards()
    .filter((c) => !playableIds.has(c.id))
    .map((c) => c.id);
  const stubCompiled = stubIds.filter(
    (id) =>
      snap.dslReady.includes(id) ||
      snap.legacyHandler.includes(id),
  ).length;

  return {
    total: registry.size(),
    playable: playableIds.size,
    stubs: stubIds.length,
    dslReady: snap.dslReady.length,
    legacyHandler: snap.legacyHandler.length,
    unimplemented: snap.unimplemented.length,
    stubCompiled,
  };
}

export type FullPlayableRegistryMetrics = {
  total: number;
  core: number;
  vanillaPromoted: number;
  complexityPromoted: number;
  dslReady: number;
  legacyHandler: number;
  unimplemented: number;
  fallbackOnly: number;
};

export function snapshotFullPlayableRegistryMetrics(
  registry: CardRegistry = createFullPlayableRegistry(),
): FullPlayableRegistryMetrics {
  const snap = registry.snapshot();
  const coreIds = new Set(loadAllCardDocuments().map((c) => c.id));
  const vanillaIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));
  const complexityIds = new Set(complexityPromotedCatalog.cards.map((c) => c.id));

  const fallbackOnly = registry.listCards().filter((c) => {
    const effects = c.effects ?? [];
    return (
      effects.length > 0 &&
      effects.every((e) => e.effects.every((p) => p.type === "fallback_handler"))
    );
  }).length;

  return {
    total: registry.size(),
    core: coreIds.size,
    vanillaPromoted: registry.listCards().filter((c) => vanillaIds.has(c.id)).length,
    complexityPromoted: registry.listCards().filter((c) => complexityIds.has(c.id)).length,
    dslReady: snap.dslReady.length,
    legacyHandler: snap.legacyHandler.length,
    unimplemented: snap.unimplemented.length,
    fallbackOnly,
  };
}
