import stubOverlays from "../generated/dsl-stubs/stubs-bundle.json";
import type { CatalogTier } from "../catalog/tiers";
import {
  getCardDefinition,
  isComplexityPromotedCardId,
  isCorePlayableCardId,
  isVanillaPromotedCardId,
  isWikiStubCardId,
} from "../catalog/unifiedCatalog";
import type { CardDefinition } from "../schema";
import type { CardDocument } from "./types";

let cachedStubOverlays: Map<string, Partial<CardDocument>> | null = null;

/** `generated/dsl-stubs/stubs-bundle.json` の DSL オーバーレイ。 */
export function loadDslStubMap(): Map<string, Partial<CardDocument>> {
  if (cachedStubOverlays) return cachedStubOverlays;
  cachedStubOverlays = new Map(
    Object.entries(stubOverlays as Record<string, Partial<CardDocument>>),
  );
  return cachedStubOverlays;
}

export function resetDslStubCache(): void {
  cachedStubOverlays = null;
}

export function getDslStubPartial(cardId: string): Partial<CardDocument> | undefined {
  return loadDslStubMap().get(cardId);
}

export function inferCatalogTierForCardId(cardId: string): CatalogTier {
  if (isCorePlayableCardId(cardId)) return "core";
  if (isVanillaPromotedCardId(cardId)) return "vanilla-promoted";
  if (isComplexityPromotedCardId(cardId)) return "complexity-promoted";
  if (isWikiStubCardId(cardId)) return "wiki-stubs";
  return "full-playable";
}

/** カタログ stats のみを持つ CardDocument シェル。 */
export function definitionToCardDocumentShell(def: CardDefinition): CardDocument {
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    category: def.category,
    rarity: def.rarity,
    expansion: def.expansion,
    powerCost: def.powerCost,
    bp: def.bp,
    sp: def.sp,
    size: def.size,
    comboNumber: def.comboNumber,
    text: def.text,
    effectId: def.effectId,
    tags: def.tags,
    features: def.features,
    imageUrl: def.imageUrl,
    imageSourceUrl: def.imageSourceUrl,
    rushAdditionalCondition: def.rushAdditionalCondition,
  };
}

export function resolveCatalogDefinition(
  cardId: string,
  tier?: CatalogTier,
): { tier: CatalogTier; definition: CardDefinition } | undefined {
  const resolvedTier = tier ?? inferCatalogTierForCardId(cardId);
  const definition = getCardDefinition(cardId, resolvedTier);
  if (!definition) return undefined;
  return { tier: resolvedTier, definition };
}
