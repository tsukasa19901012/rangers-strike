import abarenohDeck from "./legend1/decks/abarenoh.json";
import dekarangerDeck from "./legend1/decks/dekaranger.json";
import magikingDeck from "./legend1/decks/magiking.json";
import type { DeckDefinition } from "./schema";
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
  type ExpansionId,
} from "./catalog";

export * from "./schema";
export * from "./catalog";
export * from "./effects";
export * from "./errata";
export * from "./effectTaxonomy";
export * from "./unitEffects";
export * from "./zord";
export * from "./comboEffects";
export * from "./comboEffectCatalog";
export * from "./effectLabels";
export * from "./operationCatalog";
export * from "./unitEffectCatalog";
export * from "./wikiReference";

/** Web path prefix for Legend 1 card images */
export const LEGEND1_IMAGE_BASE_PATH = "/cards/legend1";

/** Web path prefix for Legend 2 card images */
export const LEGEND2_IMAGE_BASE_PATH = "/cards/legend2";

/** Card back art (tcg-db.nikita.jp). */
export const LEGEND1_CARD_BACK_IMAGE_URL = `${LEGEND1_IMAGE_BASE_PATH}/back.jpg`;

/** Filesystem path to card assets (relative to @rangers-strike/cards package root) */
export const LEGEND1_ASSETS_DIR = "assets/legend1";
export const LEGEND2_ASSETS_DIR = "assets/legend2";

export function getCardBackImageUrl(): string {
  return LEGEND1_CARD_BACK_IMAGE_URL;
}

export const starterDecks = {
  abarenoh: abarenohDeck as DeckDefinition,
  dekaranger: dekarangerDeck as DeckDefinition,
  magiking: magikingDeck as DeckDefinition,
} as const;

export type StarterDeckId = keyof typeof starterDecks;

export function getCardImageUrl(idOrCard: string | CardDefinition): string | undefined {
  const card =
    typeof idOrCard === "string" ? getCardById(idOrCard) : idOrCard;
  return card?.imageUrl;
}

export function getStarterDeck(id: StarterDeckId): DeckDefinition {
  return starterDecks[id];
}

export function buildStarterDeck(id: StarterDeckId): CardDefinition[] {
  return expandDeck(starterDecks[id], legend1Catalog);
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
}

for (const deck of Object.values(starterDecks)) {
  validateStarterDeck(deck);
}

export { legend1Catalog, legend2Catalog, allCardsCatalog, type ExpansionId };
