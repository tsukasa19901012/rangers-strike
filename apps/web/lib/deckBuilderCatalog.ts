import { cardHasCategory, type CardDefinition, type Category } from "@rangers-strike/cards";

export type CatalogFilterType = "all" | "unit" | "operation";
export type CatalogSort = "id" | "name";
export type CatalogViewMode = "list" | "grid";

export function filterCatalogCards(
  catalogSource: readonly CardDefinition[],
  options: {
    filter: CatalogFilterType;
    categoryFilter: "all" | Category;
    searchQuery: string;
  },
): CardDefinition[] {
  const { filter, categoryFilter, searchQuery } = options;
  return catalogSource.filter((card) => {
    if (filter === "unit" && card.type !== "unit") return false;
    if (filter === "operation" && card.type !== "operation") return false;
    if (categoryFilter !== "all" && !cardHasCategory(card, categoryFilter)) return false;
    if (!searchQuery) return true;
    return (
      card.id.toLowerCase().includes(searchQuery) ||
      card.name.toLowerCase().includes(searchQuery)
    );
  });
}

export function sortCatalogCards(
  cards: CardDefinition[],
  sort: CatalogSort,
): CardDefinition[] {
  const sorted = [...cards];
  if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  } else {
    sorted.sort((a, b) => a.id.localeCompare(b.id));
  }
  return sorted;
}

export function categoryChipLabel(id: Category, fullLabel: string): string {
  const short = fullLabel.slice(0, 4);
  return `${id} ${short}`;
}
