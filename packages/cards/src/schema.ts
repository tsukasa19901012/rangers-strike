export type Category = "ET" | "WB" | "OT" | "MA" | "DA";

export type UnitSize = "S" | "M" | "L" | "XL" | "SC";

export type CardType = "unit" | "operation" | "vehicle" | "commander";

export type Rarity = "N" | "R" | "SR" | "NR" | "SC" | "PR";

/** SP value: number, "special" (!), or none */
export type SpValue = number | "special" | null;

export type ComboNumber = number | "L" | "R" | "RC" | null;

export type CardDefinition = {
  id: string;
  name: string;
  type: CardType;
  category: Category | Category[];
  rarity: Rarity;
  expansion: string;
  /** Power cost. Suffix "+" means zord-up eligible (e.g. "7+"). */
  powerCost: number | string;
  bp?: number;
  sp?: SpValue;
  size?: UnitSize;
  comboNumber?: ComboNumber;
  /**
   * Full card text from source. Structured parse lives in unitEffects.json
   * (効果名 / 効果名を持たないテキスト); see effectTaxonomy.ts.
   */
  text?: string;
  effectId?: string;
  tags?: string[];
  /** Unit traits such as メカ, 男, etc. */
  features?: string[];
  /** Path served from the web app root, e.g. /cards/legend1/RS-001.jpg */
  imageUrl?: string;
  /** Original image source used for download / attribution */
  imageSourceUrl?: string;
};

export type DeckEntry = {
  cardId: string;
  count: number;
};

export type DeckDefinition = {
  id: string;
  name: string;
  starterType: "A" | "B" | "C";
  expansion: string;
  source: string;
  entries: DeckEntry[];
};

export type CardCatalog = {
  expansion: string;
  cards: CardDefinition[];
};

export function expandDeck(
  deck: DeckDefinition,
  catalog: CardCatalog,
): CardDefinition[] {
  const byId = new Map(catalog.cards.map((c) => [c.id, c]));
  const result: CardDefinition[] = [];

  for (const entry of deck.entries) {
    const card = byId.get(entry.cardId);
    if (!card) {
      throw new Error(`Unknown card id in deck ${deck.id}: ${entry.cardId}`);
    }
    for (let i = 0; i < entry.count; i += 1) {
      result.push(card);
    }
  }

  return result;
}

export function deckCardCount(deck: DeckDefinition): number {
  return deck.entries.reduce((sum, e) => sum + e.count, 0);
}
