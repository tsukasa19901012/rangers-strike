import abarenohDeck from "./legend1/decks/abarenoh.json";
import dekarangerDeck from "./legend1/decks/dekaranger.json";
import magikingDeck from "./legend1/decks/magiking.json";
import fiveDragonsADeck from "./legend5/decks/five-dragons-a.json";
import fiveDragonsBDeck from "./legend5/decks/five-dragons-b.json";
import fiveDragonsCDeck from "./legend5/decks/five-dragons-c.json";
import fiveDragonsDDeck from "./legend5/decks/five-dragons-d.json";
import roaringWingsDeck from "./legend3/decks/roaring-wings.json";
import silverAdventurerDeck from "./legend3/decks/silver-adventurer.json";
import sevenNinjaADeck from "./legend7/decks/seven-ninja-a.json";
import sevenNinjaBDeck from "./legend7/decks/seven-ninja-b.json";
import sevenNinjaCDeck from "./legend7/decks/seven-ninja-c.json";
import blueNineADeck from "./legend9/decks/blue-nine-a.json";
import blueNineBDeck from "./legend9/decks/blue-nine-b.json";
import blueNineCDeck from "./legend9/decks/blue-nine-c.json";
import riderExp1ADeck from "./rider-exp-1/decks/rider-exp-1-a.json";
import riderExp1BDeck from "./rider-exp-1/decks/rider-exp-1-b.json";
import riderExp1CDeck from "./rider-exp-1/decks/rider-exp-1-c.json";
import riderExp1DDeck from "./rider-exp-1/decks/rider-exp-1-d.json";
import riderExp2ADeck from "./rider-exp-2/decks/rider-exp-2-a.json";
import riderExp2BDeck from "./rider-exp-2/decks/rider-exp-2-b.json";
import riderExp2CDeck from "./rider-exp-2/decks/rider-exp-2-c.json";
import riderExp2DDeck from "./rider-exp-2/decks/rider-exp-2-d.json";
import riderExp3ADeck from "./rider-exp-3/decks/rider-exp-3-a.json";
import riderExp3BDeck from "./rider-exp-3/decks/rider-exp-3-b.json";
import riderExp41Deck from "./rider-exp-4/decks/rider-exp-4-1.json";
import riderExp42Deck from "./rider-exp-4/decks/rider-exp-4-2.json";
import riderExp43Deck from "./rider-exp-4/decks/rider-exp-4-3.json";
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
  "five-dragons-a": fiveDragonsADeck as DeckDefinition,
  "five-dragons-b": fiveDragonsBDeck as DeckDefinition,
  "five-dragons-c": fiveDragonsCDeck as DeckDefinition,
  "five-dragons-d": fiveDragonsDDeck as DeckDefinition,
  "roaring-wings": roaringWingsDeck as DeckDefinition,
  "silver-adventurer": silverAdventurerDeck as DeckDefinition,
  "seven-ninja-a": sevenNinjaADeck as DeckDefinition,
  "seven-ninja-b": sevenNinjaBDeck as DeckDefinition,
  "seven-ninja-c": sevenNinjaCDeck as DeckDefinition,
  "blue-nine-a": blueNineADeck as DeckDefinition,
  "blue-nine-b": blueNineBDeck as DeckDefinition,
  "blue-nine-c": blueNineCDeck as DeckDefinition,
  "rider-exp-1-a": riderExp1ADeck as DeckDefinition,
  "rider-exp-1-b": riderExp1BDeck as DeckDefinition,
  "rider-exp-1-c": riderExp1CDeck as DeckDefinition,
  "rider-exp-1-d": riderExp1DDeck as DeckDefinition,
  "rider-exp-2-a": riderExp2ADeck as DeckDefinition,
  "rider-exp-2-b": riderExp2BDeck as DeckDefinition,
  "rider-exp-2-c": riderExp2CDeck as DeckDefinition,
  "rider-exp-2-d": riderExp2DDeck as DeckDefinition,
  "rider-exp-3-a": riderExp3ADeck as DeckDefinition,
  "rider-exp-3-b": riderExp3BDeck as DeckDefinition,
  "rider-exp-4-1": riderExp41Deck as DeckDefinition,
  "rider-exp-4-2": riderExp42Deck as DeckDefinition,
  "rider-exp-4-3": riderExp43Deck as DeckDefinition,
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
