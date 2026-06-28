import corePlayableGenerated from "../generated/catalog/core-playable/cards.json";
import fullPlayableGenerated from "../generated/catalog/full-playable/cards.json";
import complexityPromotedCards from "../generated/catalog/complexity-promoted/cards.json";
import vanillaPromotedCards from "../generated/catalog/vanilla-promoted/cards.json";
import wikiStubsCards from "../generated/catalog/wiki-stubs/cards.json";
import type { CardCatalog, CardDefinition } from "../schema";
import type { CatalogTier } from "./tiers";
import { FULL_PLAYABLE_CARD_COUNT } from "./tiers";

// --- Core (generated U2; 正は generated/catalog/core-playable) ---

export const generatedCorePlayableCatalog = corePlayableGenerated as CardCatalog;

export const corePlayableCatalog = generatedCorePlayableCatalog;

/** 拡張パック横断のコアプレイアブルカタログ（RS-001..690 + SR-001..008）。 */
export const allCardsCatalog: CardCatalog = {
  expansion: "all",
  cards: corePlayableCatalog.cards,
};

/** @deprecated corePlayableCatalog と同義 */
export const playableCardsCatalog = corePlayableCatalog;

function catalogForExpansion(expansion: "legend1" | "legend2" | "legend3"): CardCatalog {
  return {
    expansion,
    cards: corePlayableCatalog.cards.filter((card) => card.expansion === expansion),
  };
}

export const legend1Catalog = catalogForExpansion("legend1");
export const legend2Catalog = catalogForExpansion("legend2");
export const legend3Catalog = catalogForExpansion("legend3");

export const ALL_CATALOGS = [legend1Catalog, legend2Catalog, legend3Catalog] as const;

export type ExpansionId = (typeof ALL_CATALOGS)[number]["expansion"];

// --- Generated tiers ---

export const generatedFullPlayableCatalog = fullPlayableGenerated as CardCatalog;

export const wikiStubsCatalog = wikiStubsCards as CardCatalog;
export const vanillaPromotedCatalog = vanillaPromotedCards as CardCatalog;
export const complexityPromotedCatalog = complexityPromotedCards as CardCatalog;

export const stubPromotedCatalog: CardCatalog = {
  expansion: "stub-promoted",
  cards: [...vanillaPromotedCatalog.cards, ...complexityPromotedCatalog.cards],
};

export const fullPlayableCatalog = generatedFullPlayableCatalog;

export const extendedCardsCatalog: CardCatalog = {
  expansion: "extended",
  cards: [...corePlayableCatalog.cards, ...wikiStubsCatalog.cards],
};

// --- Indexes ---

const CORE_BY_ID = new Map(corePlayableCatalog.cards.map((card) => [card.id, card]));
const VANILLA_BY_ID = new Map(vanillaPromotedCatalog.cards.map((card) => [card.id, card]));
const COMPLEXITY_BY_ID = new Map(complexityPromotedCatalog.cards.map((card) => [card.id, card]));
const FULL_PLAYABLE_BY_ID = new Map(fullPlayableCatalog.cards.map((card) => [card.id, card]));
const EXTENDED_BY_ID = new Map(extendedCardsCatalog.cards.map((card) => [card.id, card]));
const WIKI_STUBS_BY_ID = new Map(wikiStubsCatalog.cards.map((card) => [card.id, card]));

export const ALL_CARDS_BY_ID: ReadonlyMap<string, CardDefinition> = CORE_BY_ID;

const TIER_CATALOGS: Record<CatalogTier, CardCatalog> = {
  core: corePlayableCatalog,
  "vanilla-promoted": vanillaPromotedCatalog,
  "complexity-promoted": complexityPromotedCatalog,
  "wiki-stubs": wikiStubsCatalog,
  "stub-promoted": stubPromotedCatalog,
  "full-playable": fullPlayableCatalog,
  extended: extendedCardsCatalog,
};

// --- Tier API ---

export function getCatalog(tier: CatalogTier): CardCatalog {
  return TIER_CATALOGS[tier];
}

export function listCardIds(tier: CatalogTier): string[] {
  return getCatalog(tier).cards.map((card) => card.id);
}

export function listCoreCardIds(): ReadonlySet<string> {
  return new Set(corePlayableCatalog.cards.map((card) => card.id));
}

/** tier 内 lookup。core のみなら getCardById と同等。 */
export function getCardDefinition(
  id: string,
  tier: CatalogTier = "core",
): CardDefinition | undefined {
  switch (tier) {
    case "core":
      return CORE_BY_ID.get(id);
    case "vanilla-promoted":
      return VANILLA_BY_ID.get(id);
    case "complexity-promoted":
      return COMPLEXITY_BY_ID.get(id);
    case "wiki-stubs":
      return WIKI_STUBS_BY_ID.get(id);
    case "full-playable":
      return FULL_PLAYABLE_BY_ID.get(id);
    case "extended":
      return EXTENDED_BY_ID.get(id);
    case "stub-promoted":
      return VANILLA_BY_ID.get(id) ?? COMPLEXITY_BY_ID.get(id);
    default:
      return undefined;
  }
}

// --- Legacy-compatible lookups ---

export function getCardById(id: string): CardDefinition | undefined {
  return CORE_BY_ID.get(id);
}

export function getCatalogByExpansion(expansion: ExpansionId): CardCatalog {
  if (expansion === "legend1") return legend1Catalog;
  if (expansion === "legend2") return legend2Catalog;
  return legend3Catalog;
}

export function listExpansionIds(): ExpansionId[] {
  return ALL_CATALOGS.map((catalog) => catalog.expansion as ExpansionId);
}

export function getCorePlayableCardById(id: string): CardDefinition | undefined {
  return CORE_BY_ID.get(id);
}

export function getPlayableCardById(id: string): CardDefinition | undefined {
  return CORE_BY_ID.get(id);
}

export function getVanillaPromotedCardById(id: string): CardDefinition | undefined {
  return VANILLA_BY_ID.get(id);
}

export function getComplexityPromotedCardById(id: string): CardDefinition | undefined {
  return COMPLEXITY_BY_ID.get(id);
}

export function getFullPlayableCardById(id: string): CardDefinition | undefined {
  return FULL_PLAYABLE_BY_ID.get(id);
}

export function getExtendedCardById(id: string): CardDefinition | undefined {
  return EXTENDED_BY_ID.get(id);
}

/** Core を優先し、なければ full playable（promoted 含む）を返す。 */
export function resolvePlayableCard(id: string): CardDefinition | undefined {
  return getCardById(id) ?? getFullPlayableCardById(id);
}

export function isCorePlayableCardId(id: string): boolean {
  return CORE_BY_ID.has(id);
}

export function isPlayableCardId(id: string): boolean {
  return CORE_BY_ID.has(id);
}

export function isVanillaPromotedCardId(id: string): boolean {
  return VANILLA_BY_ID.has(id);
}

export function isComplexityPromotedCardId(id: string): boolean {
  return COMPLEXITY_BY_ID.has(id);
}

export function isFullPlayableCardId(id: string): boolean {
  return FULL_PLAYABLE_BY_ID.has(id);
}

export function isWikiStubCardId(id: string): boolean {
  return !CORE_BY_ID.has(id) && EXTENDED_BY_ID.has(id);
}

export function assertFullPlayableCatalogIntegrity(): void {
  const ids = fullPlayableCatalog.cards.map((card) => card.id);
  const unique = new Set(ids);
  if (ids.length !== FULL_PLAYABLE_CARD_COUNT) {
    throw new Error(
      `fullPlayableCatalog expected ${FULL_PLAYABLE_CARD_COUNT} cards, got ${ids.length}`,
    );
  }
  if (unique.size !== ids.length) {
    throw new Error(`fullPlayableCatalog has duplicate card ids`);
  }
}
