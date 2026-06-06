import legend1Cards from "./legend1/cards.json";
import legend2Cards from "./legend2/cards.json";
import legend3Cards from "./legend3/cards.json";
import type { CardCatalog, CardDefinition } from "./schema";

export const legend1Catalog = legend1Cards as CardCatalog;
export const legend2Catalog = legend2Cards as CardCatalog;
export const legend3Catalog = legend3Cards as CardCatalog;

export const ALL_CATALOGS = [legend1Catalog, legend2Catalog, legend3Catalog] as const;

export type ExpansionId = (typeof ALL_CATALOGS)[number]["expansion"];

/** 拡張パック横断のデッキ構築・カード参照用統合カタログ。 */
export const allCardsCatalog: CardCatalog = {
  expansion: "all",
  cards: ALL_CATALOGS.flatMap((catalog) => catalog.cards),
};

const CARDS_BY_ID = new Map(allCardsCatalog.cards.map((card) => [card.id, card]));

export const ALL_CARDS_BY_ID: ReadonlyMap<string, CardDefinition> = CARDS_BY_ID;

export function getCardById(id: string): CardDefinition | undefined {
  return CARDS_BY_ID.get(id);
}

export function getCatalogByExpansion(expansion: ExpansionId): CardCatalog {
  if (expansion === "legend1") return legend1Catalog;
  if (expansion === "legend2") return legend2Catalog;
  return legend3Catalog;
}

export function listExpansionIds(): ExpansionId[] {
  return ALL_CATALOGS.map((catalog) => catalog.expansion as ExpansionId);
}
