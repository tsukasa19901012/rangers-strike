import { describe, it, expect } from "vitest";
import {
  complexityPromotedCatalog,
  extendedCardsCatalog,
  fullPlayableCatalog,
  playableCardsCatalog,
  vanillaPromotedCatalog,
  wikiStubsCatalog,
  getExtendedCardById,
  getFullPlayableCardById,
  isComplexityPromotedCardId,
  isFullPlayableCardId,
  isPlayableCardId,
  isVanillaPromotedCardId,
  isWikiStubCardId,
} from "../extendedCatalog";
import {
  createExtendedCardRegistry,
  createCardRegistryFromCatalog,
  createFullPlayableRegistry,
  snapshotExtendedRegistryMetrics,
  snapshotFullPlayableRegistryMetrics,
} from "./registry";
import { validateCardDocument } from "./validator";

describe("extended catalog", () => {
  it("merges playable and wiki stubs without duplicate ids", () => {
    expect(playableCardsCatalog.cards).toHaveLength(179);
    expect(wikiStubsCatalog.cards.length).toBeGreaterThan(1600);
    expect(extendedCardsCatalog.cards).toHaveLength(
      playableCardsCatalog.cards.length + wikiStubsCatalog.cards.length,
    );

    const ids = new Set(extendedCardsCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(extendedCardsCatalog.cards.length);
  });

  it("resolves playable and stub cards by id", () => {
    expect(isPlayableCardId("RS-001")).toBe(true);
    expect(isWikiStubCardId("RS-001")).toBe(false);
    expect(getExtendedCardById("RS-001")?.name).toBeTruthy();

    const stub = wikiStubsCatalog.cards[0];
    expect(stub).toBeDefined();
    if (!stub) return;
    expect(isPlayableCardId(stub.id)).toBe(false);
    expect(isWikiStubCardId(stub.id)).toBe(true);
    expect(getExtendedCardById(stub.id)?.id).toBe(stub.id);
  });
});

describe("full playable catalog (M11/M12)", () => {
  it("merges core, vanilla, and complexity promoted without duplicate ids", () => {
    expect(vanillaPromotedCatalog.cards.length).toBe(354);
    expect(complexityPromotedCatalog.cards.length).toBe(1316);
    expect(fullPlayableCatalog.cards).toHaveLength(1849);
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(1849);
  });

  it("keeps core playable separate from promoted lookup", () => {
    expect(isPlayableCardId("RS-001")).toBe(true);
    expect(isFullPlayableCardId("RS-001")).toBe(true);
    const vanilla = vanillaPromotedCatalog.cards[0];
    expect(vanilla).toBeDefined();
    if (!vanilla) return;
    expect(isPlayableCardId(vanilla.id)).toBe(false);
    expect(isVanillaPromotedCardId(vanilla.id)).toBe(true);
    expect(isFullPlayableCardId(vanilla.id)).toBe(true);
    expect(getFullPlayableCardById(vanilla.id)?.id).toBe(vanilla.id);

    const complexity = complexityPromotedCatalog.cards[0];
    expect(complexity).toBeDefined();
    if (!complexity) return;
    expect(isComplexityPromotedCardId(complexity.id)).toBe(true);
    expect(isFullPlayableCardId(complexity.id)).toBe(true);
  });
});

describe("full playable CardRegistry (M11/M12)", () => {
  const registry = createFullPlayableRegistry();
  const metrics = snapshotFullPlayableRegistryMetrics(registry);

  it("loads 1849 cards", () => {
    expect(registry.size()).toBe(1849);
    expect(metrics.core).toBe(179);
    expect(metrics.vanillaPromoted).toBe(354);
    expect(metrics.complexityPromoted).toBe(1316);
  });

  it("validates every stub-promoted card document", () => {
    const promotedIds = new Set([
      ...vanillaPromotedCatalog.cards.map((c) => c.id),
      ...complexityPromotedCatalog.cards.map((c) => c.id),
    ]);
    for (const card of registry.listCards()) {
      if (!promotedIds.has(card.id)) continue;
      const result = validateCardDocument(card);
      expect(result.ok, `${card.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(
        true,
      );
    }
  });

  it("reduced vanilla fallback-only handlers after migration", () => {
    const vanillaIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));
    const vanillaDocs = registry.listCards().filter((c) => vanillaIds.has(c.id));
    const fallbackOnly = vanillaDocs.filter((c) => {
      const effects = c.effects ?? [];
      return (
        effects.length > 0 &&
        effects.every((e) => e.effects.every((p) => p.type === "fallback_handler"))
      );
    }).length;
    expect(fallbackOnly).toBe(0);
    expect(metrics.unimplemented).toBe(0);
  });

  it("tracks complexity promoted interpreter progress (M13/M14/M15)", () => {
    const complexityIds = new Set(complexityPromotedCatalog.cards.map((c) => c.id));
    const complexityDocs = registry.listCards().filter((c) => complexityIds.has(c.id));
    const interpreter = complexityDocs.filter(
      (c) => c.implementation?.handler === "interpreter",
    ).length;
    expect(interpreter).toBeGreaterThan(1200);
    expect(metrics.fallbackOnly).toBe(0);
    expect(metrics.dslReady).toBe(1849);
  });
});

describe("extended CardRegistry", () => {
  const registry = createExtendedCardRegistry();
  const metrics = snapshotExtendedRegistryMetrics(registry);

  it("loads extended catalog size", () => {
    expect(registry.size()).toBe(extendedCardsCatalog.cards.length);
    expect(metrics.playable).toBe(179);
    expect(metrics.stubs).toBe(wikiStubsCatalog.cards.length);
  });

  it("keeps playable cards interpreter-ready", () => {
    const playableRegistry = createCardRegistryFromCatalog();
    const snap = playableRegistry.snapshot();
    expect(snap.dslReady.length).toBe(179);
    expect(snap.legacyHandler.length).toBe(0);
  });

  it("tracks stub DSL compile progress", () => {
    expect(metrics.stubCompiled).toBeGreaterThan(1300);
    expect(metrics.stubs).toBe(wikiStubsCatalog.cards.length);
  });

  it("every playable card passes validation", () => {
    for (const card of createCardRegistryFromCatalog().listCards()) {
      const result = validateCardDocument(card);
      expect(result.ok, `${card.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(
        true,
      );
    }
  });
});
