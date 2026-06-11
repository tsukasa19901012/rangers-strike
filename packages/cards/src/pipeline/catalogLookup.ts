import {
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
} from "../catalog/unifiedCatalog";
import type { CardDocument } from "../dsl/types";

type CatalogFile = { cards: CardDocument[] };

const CATALOGS: CatalogFile[] = [
  legend1Catalog as CatalogFile,
  legend2Catalog as CatalogFile,
  legend3Catalog as CatalogFile,
];

export function lookupCatalogCard(cardId: string): CardDocument | undefined {
  for (const catalog of CATALOGS) {
    const found = catalog.cards.find((c) => c.id === cardId);
    if (found) return { ...found };
  }
  return undefined;
}
