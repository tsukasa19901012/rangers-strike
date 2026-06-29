/**
 * Auto-generated vanilla-promoted smoke test (M11)
 * Promoted: 184 | Full playable: 1849
 */
import { describe, it, expect } from "vitest";
import { createFullPlayableRegistry } from "../registry";
import { validateCardDocument } from "../validator";
import { fullPlayableCatalog, vanillaPromotedCatalog } from "../../extendedCatalog";

describe("vanilla-promoted catalog", () => {
  const registry = createFullPlayableRegistry();

  it("merges legend and promoted without duplicate ids", () => {
    expect(vanillaPromotedCatalog.cards.length).toBe(184);
    expect(fullPlayableCatalog.cards.length).toBe(1849);
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(fullPlayableCatalog.cards.length);
  });

  it("has promoted dslReady cards", () => {
    expect(fullPlayableCatalog.cards.length).toBe(1849);
    expect(registry.size()).toBeGreaterThanOrEqual(1849);
  });

  it("validates every promoted card document", () => {
    for (const card of vanillaPromotedCatalog.cards) {
      const doc = registry.getCard(card.id);
      expect(doc, card.id).toBeDefined();
      const result = validateCardDocument(doc!);
      expect(result.ok, `${card.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(true);
    }
  });

  it("reports handler coverage for promoted subset", () => {
    const snap = registry.snapshot();
    const promotedIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));
    const promotedDocs = registry.listCards().filter((c) => promotedIds.has(c.id));
    const interpreter = promotedDocs.filter((c) => c.implementation?.handler === "interpreter").length;
    const typescript = promotedDocs.filter((c) => c.implementation?.handler === "typescript").length;
    const unimplemented = promotedDocs.filter((c) => c.implementation?.handler === "unimplemented").length;
    expect(interpreter + typescript + unimplemented).toBe(promotedDocs.length);
    expect(unimplemented).toBe(0);
    expect(interpreter).toBeGreaterThan(0);
  });
});
