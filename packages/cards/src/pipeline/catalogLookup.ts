import legend1Cards from "../legend1/cards.json";
import legend2Cards from "../legend2/cards.json";
import legend3Cards from "../legend3/cards.json";
import type { CardDocument } from "../dsl/types";

type CatalogFile = { cards: CardDocument[] };

const CATALOGS: CatalogFile[] = [legend1Cards, legend2Cards, legend3Cards];

export function lookupCatalogCard(cardId: string): CardDocument | undefined {
  for (const catalog of CATALOGS) {
    const found = catalog.cards.find((c) => c.id === cardId);
    if (found) return { ...found };
  }
  return undefined;
}
