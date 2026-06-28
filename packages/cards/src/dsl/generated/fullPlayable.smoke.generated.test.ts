/**
 * Auto-generated full-playable smoke test (M12)
 * Full playable: 1849
 */
import { describe, it, expect } from "vitest";
import { createFullPlayableRegistry } from "../registry";
import { validateCardDocument } from "../validator";
import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
} from "../../extendedCatalog";

describe("full-playable catalog", () => {
  const registry = createFullPlayableRegistry();

  it("merges all tiers without duplicate ids", () => {
    expect(fullPlayableCatalog.cards.length).toBe(1849);
    expect(vanillaPromotedCatalog.cards.length).toBe(286);
    expect(complexityPromotedCatalog.cards.length).toBe(872);
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(fullPlayableCatalog.cards.length);
  });

  it("registers all full-playable cards", () => {
    expect(registry.size()).toBe(1849);
  });

  it("validates every stub-promoted card document", () => {
    const promotedIds = new Set([
      ...vanillaPromotedCatalog.cards.map((c) => c.id),
      ...complexityPromotedCatalog.cards.map((c) => c.id),
    ]);
    for (const card of registry.listCards()) {
      if (!promotedIds.has(card.id)) continue;
      const result = validateCardDocument(card);
      expect(result.ok, `${card.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(true);
    }
  });
});
