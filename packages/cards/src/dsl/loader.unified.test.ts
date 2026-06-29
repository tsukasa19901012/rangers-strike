import { describe, expect, it } from "vitest";
import { FULL_PLAYABLE_CARD_COUNT } from "../catalog/tiers";
import { fingerprintCardDocuments } from "../catalog/statsParity";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "./registry";
import {
  inferCatalogTierForCardId,
  loadCardById,
  loadCards,
  loadFullPlayableDocuments,
} from "./loader";

describe("loadCardById (U3)", () => {
  it("loads core card with named effects", () => {
    const doc = loadCardById("RS-046", "core");
    expect(doc.effects?.some((effect) => effect.id === "armor_attack")).toBe(true);
    expect(doc.implementation?.handler).toBe("interpreter");
  });

  it("loads core BK card", () => {
    const doc = loadCardById("BK-001", "core");
    expect(doc.name).toBe("タイフーン（1号）");
    expect(doc.expansion).toBe("legend1");
  });

  it("loads promoted-only card", () => {
    const doc = loadCardById("PK-001", "vanilla-promoted");
    expect(doc.expansion).toBe("vanilla-promoted");
  });

  it("infers catalog tier from card id", () => {
    expect(inferCatalogTierForCardId("RS-006")).toBe("core");
    expect(inferCatalogTierForCardId("BK-001")).toBe("core");
    expect(inferCatalogTierForCardId("RK-001")).toBe("core");
    expect(inferCatalogTierForCardId("PK-001")).toBe("vanilla-promoted");
  });

  it("loadCards(full-playable) matches deprecated loader fingerprint", () => {
    const unified = loadCards("full-playable");
    const legacy = loadFullPlayableDocuments();
    expect(unified).toHaveLength(FULL_PLAYABLE_CARD_COUNT);
    expect(legacy).toHaveLength(FULL_PLAYABLE_CARD_COUNT);
    expect(fingerprintCardDocuments(unified)).toBe(fingerprintCardDocuments(legacy));
  });

  it("full playable registry metrics unchanged", () => {
    const metrics = snapshotFullPlayableRegistryMetrics(createFullPlayableRegistry());
    expect(metrics.total).toBe(FULL_PLAYABLE_CARD_COUNT);
    expect(metrics.dslReady).toBe(FULL_PLAYABLE_CARD_COUNT);
    expect(metrics.unimplemented).toBe(0);
  });
});
