/**
 * Auto-generated full-playable smoke test (M12)
 * Full playable: 1832
 */
import { describe, it, expect } from "vitest";
import { createFullPlayableRegistry } from "../registry";
import { validateCardDocument } from "../validator";
import {
  COMPLEXITY_PROMOTED_CARD_COUNT,
  FULL_PLAYABLE_CARD_COUNT,
  VANILLA_PROMOTED_CARD_COUNT,
} from "../../catalog/tiers";
import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
} from "../../extendedCatalog";

describe("full-playable catalog", () => {
  const registry = createFullPlayableRegistry();

  it("merges all tiers without duplicate ids", () => {
    expect(fullPlayableCatalog.cards.length).toBe(FULL_PLAYABLE_CARD_COUNT);
    expect(vanillaPromotedCatalog.cards.length).toBe(VANILLA_PROMOTED_CARD_COUNT);
    expect(complexityPromotedCatalog.cards.length).toBe(COMPLEXITY_PROMOTED_CARD_COUNT);
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(fullPlayableCatalog.cards.length);
  });

  it("registers all full-playable cards", () => {
    expect(registry.size()).toBe(FULL_PLAYABLE_CARD_COUNT);
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
