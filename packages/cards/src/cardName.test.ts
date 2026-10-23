import { describe, expect, it } from "vitest";
import { canonicalCardName } from "./cardName";
import { fullPlayableCatalog, wikiStubsCatalog } from "./catalog/unifiedCatalog";

describe("cardName", () => {
  it("canonicalCardName trims surrounding spaces only", () => {
    expect(canonicalCardName(" デカマスター ")).toBe("デカマスター");
    expect(canonicalCardName("タイフーン（1号）")).toBe("タイフーン（1号）");
  });

  it("card data names carry no wiki edition labels（2nd / XG / N弾）", () => {
    const labeled = [...fullPlayableCatalog.cards, ...wikiStubsCatalog.cards]
      .filter((card) => /（(?:2nd|XG\d*|\d+弾)）$/u.test(card.name))
      .map((card) => `${card.id} ${card.name}`);
    expect(labeled).toEqual([]);
  });
});
