import { describe, expect, it } from "vitest";
import { getCardById } from "../catalog";
import { allParityGatesPassed, runCatalogParityAudit } from "./parity";
import { FULL_PLAYABLE_CARD_COUNT, CORE_PLAYABLE_CARD_COUNT } from "./tiers";
import { loadCorePlayableCards } from "./coreCatalogSources";
import {
  assertFullPlayableCatalogIntegrity,
  corePlayableCatalog,
  fullPlayableCatalog,
  generatedCorePlayableCatalog,
  getCardDefinition,
  getCatalog,
  legend1Catalog,
  listCardIds,
  listCoreCardIds,
  resolvePlayableCard,
} from "./unifiedCatalog";

describe("unifiedCatalog", () => {
  it("exposes core tier with 1052 cards from generated catalog", () => {
    expect(getCatalog("core").cards.length).toBe(CORE_PLAYABLE_CARD_COUNT);
    expect(listCoreCardIds().size).toBe(CORE_PLAYABLE_CARD_COUNT);
    expect(generatedCorePlayableCatalog.cards.length).toBe(CORE_PLAYABLE_CARD_COUNT);
    expect(loadCorePlayableCards().length).toBe(CORE_PLAYABLE_CARD_COUNT);
  });

  it("derives legend expansion shards from generated core", () => {
    const legend1Ids = new Set(legend1Catalog.cards.map((card) => card.id));
    for (const card of corePlayableCatalog.cards.filter((c) => c.expansion === "legend1")) {
      expect(legend1Ids.has(card.id)).toBe(true);
    }
  });

  it("full-playable tier has 1849 unique ids", () => {
    assertFullPlayableCatalogIntegrity();
    expect(fullPlayableCatalog.cards).toHaveLength(FULL_PLAYABLE_CARD_COUNT);
    expect(new Set(listCardIds("full-playable")).size).toBe(FULL_PLAYABLE_CARD_COUNT);
  });

  it("getCardDefinition(core) matches legacy getCardById", () => {
    expect(getCardDefinition("RS-006", "core")).toEqual(getCardById("RS-006"));
    expect(getCardDefinition("RS-006")).toEqual(getCardById("RS-006"));
  });

  it("resolvePlayableCard returns core and promoted cards", () => {
    expect(resolvePlayableCard("RS-006")?.expansion).toBe("legend1");
    expect(resolvePlayableCard("BK-001")?.expansion).toBe("legend1");
    expect(resolvePlayableCard("RK-001")?.expansion).toBe("legend2");
    expect(resolvePlayableCard("PK-001")?.expansion).toBe("vanilla-promoted");
    expect(resolvePlayableCard("UNKNOWN-999")).toBeUndefined();
  });
});

describe("catalog parity (U0)", () => {
  it("passes all U0 gates", () => {
    const report = runCatalogParityAudit();
    expect(allParityGatesPassed(report)).toBe(true);
    expect(report.summary.fullPlayableCount).toBe(FULL_PLAYABLE_CARD_COUNT);
    expect(report.summary.dslReady).toBe(FULL_PLAYABLE_CARD_COUNT);
  });
});
