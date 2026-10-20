// Builds the client's DeckApi from the card package's deck rules. Shells pass
// the functions in (the Vita bundle re-exports them from @rangers-strike/cards),
// so client-core itself never imports card data.
import type { CardDefinition, DeckApi, DeckEntry } from "../engineApi";

type Catalog = { expansion: string; cards: CardDefinition[] };

export type DeckRuleFunctions = {
  catalog: Catalog;
  validateDeckEntries(entries: DeckEntry[], catalog: Catalog): { ok: boolean; total: number; errors: string[] };
  normalizeSameCardName(name: string): string;
  maxCopiesForCard(card: CardDefinition): number;
  cardCategories(card: CardDefinition): string[];
  expandDeck(deck: { id: string; name: string; starterType: string; expansion: string; source: string; entries: DeckEntry[] }, catalog: Catalog): CardDefinition[];
};

export function createDeckApi(rules: DeckRuleFunctions): DeckApi {
  const cards = rules.catalog.cards.filter((card) => card.type !== "commander");
  return {
    cards,
    validate: (entries) => rules.validateDeckEntries([...entries], rules.catalog),
    sameNameKey: (card) => rules.normalizeSameCardName(card.name),
    maxCopies: (card) => rules.maxCopiesForCard(card),
    categories: (card) => rules.cardCategories(card),
    build: (entries) =>
      rules.expandDeck({ id: "custom", name: "custom", starterType: "A", expansion: "all", source: "custom", entries: [...entries] }, rules.catalog),
  };
}
