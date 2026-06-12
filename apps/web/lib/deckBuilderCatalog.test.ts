import { describe, expect, it } from "vitest";
import { getFullPlayableCardById } from "@rangers-strike/cards";
import { filterCatalogCards, sortCatalogCards } from "./deckBuilderCatalog";

describe("deckBuilderCatalog", () => {
  const sample = [
    getFullPlayableCardById("BK-001"),
    getFullPlayableCardById("BK-002"),
  ].filter((card): card is NonNullable<typeof card> => card != null);

  it("shows all cards when search is empty", () => {
    const result = filterCatalogCards(sample, {
      filter: "all",
      categoryFilter: "all",
      searchQuery: "",
    });
    expect(result).toHaveLength(2);
  });

  it("filters by search query", () => {
    const result = filterCatalogCards(sample, {
      filter: "all",
      categoryFilter: "all",
      searchQuery: "bk-001",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("BK-001");
  });

  it("sorts by name", () => {
    const sorted = sortCatalogCards([...sample].reverse(), "name");
    expect(sorted[0]?.name.localeCompare(sorted[1]?.name ?? "", "ja")).toBeLessThanOrEqual(0);
  });
});
