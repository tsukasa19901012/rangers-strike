import {
  deckCardCount,
  DECK_MIN_SIZE,
  expandDeck,
  fullPlayableCatalog,
  getStarterDeck,
  maxCopiesForCard,
  validateDeckEntries as validateDeckEntriesCore,
  type CardDefinition,
  type DeckDefinition,
  type DeckEntry,
  type DeckValidationResult,
  type StarterDeckId,
} from "@rangers-strike/cards";

export { maxCopiesForCard } from "@rangers-strike/cards";

export const MIN_DECK_SIZE = DECK_MIN_SIZE;
export const STORAGE_KEY = "rangers-strike/custom-decks/v1";

export type CustomDeck = {
  id: string;
  name: string;
  entries: DeckEntry[];
  updatedAt: number;
};

export type DeckValidation = DeckValidationResult;

export function entriesToMap(entries: DeckEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.cardId, entry.count);
  }
  return map;
}

export function mapToEntries(map: Map<string, number>): DeckEntry[] {
  return [...map.entries()]
    .filter(([, count]) => count > 0)
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export function countEntries(entries: DeckEntry[]): number {
  return deckCardCount({ ...emptyDeckShell(), entries });
}

function emptyDeckShell(): DeckDefinition {
  return {
    id: "custom",
    name: "custom",
    starterType: "A",
    expansion: "all",
    source: "",
    entries: [],
  };
}

export function validateDeckEntries(entries: DeckEntry[]): DeckValidation {
  return validateDeckEntriesCore(entries, fullPlayableCatalog);
}

export function buildCardDefinitions(entries: DeckEntry[]): CardDefinition[] {
  return expandDeck(
    {
      id: "custom",
      name: "custom",
      starterType: "A",
      expansion: "all",
      source: "custom",
      entries,
    },
    fullPlayableCatalog,
  );
}

export function starterTemplateEntries(starterId: StarterDeckId): DeckEntry[] {
  return getStarterDeck(starterId).entries.map((entry) => ({ ...entry }));
}

export function loadCustomDecks(): CustomDeck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomDeck[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveCustomDeck(deck: CustomDeck): void {
  const decks = loadCustomDecks().filter((entry) => entry.id !== deck.id);
  decks.unshift(deck);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function deleteCustomDeck(id: string): void {
  const decks = loadCustomDecks().filter((entry) => entry.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function getCustomDeck(id: string): CustomDeck | undefined {
  return loadCustomDecks().find((deck) => deck.id === id);
}

export function createDeckId(): string {
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
