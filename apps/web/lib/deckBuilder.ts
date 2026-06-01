import {
  allCardsCatalog,
  deckCardCount,
  expandDeck,
  getStarterDeck,
  hidoraDeckUnlimited,
  type CardDefinition,
  type DeckDefinition,
  type DeckEntry,
  type StarterDeckId,
} from "@rangers-strike/cards";

export const MIN_DECK_SIZE = 40;
export const STORAGE_KEY = "rangers-strike/custom-decks/v1";

export type CustomDeck = {
  id: string;
  name: string;
  entries: DeckEntry[];
  updatedAt: number;
};

export type DeckValidation = {
  ok: boolean;
  total: number;
  errors: string[];
};

export function maxCopiesForCard(card: CardDefinition): number {
  if (hidoraDeckUnlimited(card.id)) {
    return 40;
  }
  if (card.rarity === "SR" || card.rarity === "SC" || card.rarity === "NR" || card.rarity === "PR") {
    return 1;
  }
  return 3;
}

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
  const errors: string[] = [];
  const total = countEntries(entries);
  const byId = new Map(allCardsCatalog.cards.map((card) => [card.id, card]));

  if (total < MIN_DECK_SIZE) {
    errors.push(`デッキは最低${MIN_DECK_SIZE}枚必要です（現在 ${total} 枚）`);
  }

  for (const entry of entries) {
    const card = byId.get(entry.cardId);
    if (!card) {
      errors.push(`不明なカード: ${entry.cardId}`);
      continue;
    }
    const max = maxCopiesForCard(card);
    if (entry.count > max) {
      errors.push(`${card.name} は最大 ${max} 枚までです`);
    }
    if (entry.count <= 0) {
      errors.push(`${card.name} の枚数が不正です`);
    }
  }

  return { ok: errors.length === 0 && total >= MIN_DECK_SIZE, total, errors };
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
    allCardsCatalog,
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
