import abarenohDeck from "./legend1/decks/abarenoh.json";
import dekarangerDeck from "./legend1/decks/dekaranger.json";
import magikingDeck from "./legend1/decks/magiking.json";
import roaringWingsDeck from "./legend3/decks/roaring-wings.json";
import silverAdventurerDeck from "./legend3/decks/silver-adventurer.json";
import type { DeckDefinition } from "./schema";
import { validateDeckEntries } from "./deckRules";
import {
  deckCardCount,
  expandDeck,
  type CardDefinition,
} from "./schema";
import {
  allCardsCatalog,
  getCardById,
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
  type ExpansionId,
} from "./catalog";
import { resolveCardImageUrl } from "./cardImages";

export * from "./schema";
export * from "./cardName";
export * from "./fusionMaterial";
export * from "./bannedCards";
export * from "./deckRules";
export * from "./catalog";
export type { CatalogTier, CorePlayableExpansion } from "./catalog/tiers";
export { CATALOG_TIERS, CORE_PLAYABLE_CARD_COUNT, FULL_PLAYABLE_CARD_COUNT } from "./catalog/tiers";
export {
  getCatalog,
  getCardDefinition,
  listCardIds,
  listCoreCardIds,
  assertFullPlayableCatalogIntegrity,
  generatedCorePlayableCatalog,
  generatedFullPlayableCatalog,
} from "./catalog/unifiedCatalog";
export {
  loadCorePlayableCards,
  loadCorePlayableCatalog,
  loadLegacyCoreCards,
  loadLegacyCoreCatalog,
} from "./catalog/coreCatalogSources";
export * from "./effects";
export * from "./errata";
export * from "./effectTaxonomy";
export * from "./unitEffects";
export * from "./powerCost";
export * from "./zord";
export * from "./mothership";
export * from "./comboEffects";
export * from "./comboEffectCatalog";
export * from "./effectLabels";
export * from "./operationCatalog";
export * from "./unitEffectCatalog";
export * from "./wikiReference";
export * from "./resist";
export * from "./bounce";
export * from "./glossaryImplementation";

/** レジェンド1 カード画像の Web パス接頭辞 */
export const LEGEND1_IMAGE_BASE_PATH = "/cards/legend1";

/** レジェンド2 カード画像の Web パス接頭辞 */
export const LEGEND2_IMAGE_BASE_PATH = "/cards/legend2";

/** レジェンド3 カード画像の Web パス接頭辞 */
export const LEGEND3_IMAGE_BASE_PATH = "/cards/legend3";

/** カード裏面画像（tcg-db.nikita.jp）。 */
export const LEGEND1_CARD_BACK_IMAGE_URL = `${LEGEND1_IMAGE_BASE_PATH}/back.jpg`;

/** カードアセットのファイルシステムパス（@rangers-strike/cards パッケージルートからの相対） */
export const LEGEND1_ASSETS_DIR = "assets/legend1";
export const LEGEND2_ASSETS_DIR = "assets/legend2";
export const LEGEND3_ASSETS_DIR = "assets/legend3";

export function getCardBackImageUrl(): string {
  return LEGEND1_CARD_BACK_IMAGE_URL;
}

export const starterDecks = {
  abarenoh: abarenohDeck as DeckDefinition,
  dekaranger: dekarangerDeck as DeckDefinition,
  magiking: magikingDeck as DeckDefinition,
  "roaring-wings": roaringWingsDeck as DeckDefinition,
  "silver-adventurer": silverAdventurerDeck as DeckDefinition,
} as const;

export type StarterDeckId = keyof typeof starterDecks;

export function getCardImageUrl(idOrCard: string | CardDefinition): string | undefined {
  return resolveCardImageUrl(idOrCard);
}

export {
  GRNRNGR_CARD_IMAGE_BASE,
  grnrngrCardImageUrl,
  resolveCardImageUrl,
} from "./cardImages";

export function getStarterDeck(id: StarterDeckId): DeckDefinition {
  return starterDecks[id];
}

export function buildStarterDeck(id: StarterDeckId): CardDefinition[] {
  return expandDeck(starterDecks[id], allCardsCatalog);
}

export function buildAbarenohDeck(): CardDefinition[] {
  return buildStarterDeck("abarenoh");
}

export function buildDekarangerDeck(): CardDefinition[] {
  return buildStarterDeck("dekaranger");
}

export function buildMagikingDeck(): CardDefinition[] {
  return buildStarterDeck("magiking");
}

export function validateStarterDeck(deck: DeckDefinition): void {
  const total = deckCardCount(deck);
  if (total !== 40) {
    throw new Error(`${deck.id} deck must have 40 cards, got ${total}`);
  }

  for (const entry of deck.entries) {
    if (!getCardById(entry.cardId)) {
      throw new Error(`${deck.id} deck references unknown card: ${entry.cardId}`);
    }
  }

  const validation = validateDeckEntries(deck.entries, allCardsCatalog, {
    minSize: 40,
  });
  if (!validation.ok) {
    throw new Error(`${deck.id} deck violates build rules: ${validation.errors.join("; ")}`);
  }
}

for (const deck of Object.values(starterDecks)) {
  validateStarterDeck(deck);
}

export {
  allCardsCatalog,
  getCardById,
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
  type ExpansionId,
} from "./catalog";
export {
  complexityPromotedCatalog,
  extendedCardsCatalog,
  fullPlayableCatalog,
  playableCardsCatalog,
  stubPromotedCatalog,
  vanillaPromotedCatalog,
  wikiStubsCatalog,
  getComplexityPromotedCardById,
  getExtendedCardById,
  getFullPlayableCardById,
  getPlayableCardById,
  getVanillaPromotedCardById,
  resolvePlayableCard,
  isComplexityPromotedCardId,
  isFullPlayableCardId,
  isPlayableCardId,
  isVanillaPromotedCardId,
  isWikiStubCardId,
} from "./extendedCatalog";
export { getWikiSetLabel, getWikiSetLabels } from "./wikiSetLabels";
export { isCardDslReady, isCardDslUnimplemented } from "./dslReady";
export {
  ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS,
  ENGINE_NATIVE_GRANT_KEYWORDS,
} from "./engineImplementedCatchall";
export { loadCardById, loadCards, inferCatalogTierForCardId } from "./dsl/loader";
