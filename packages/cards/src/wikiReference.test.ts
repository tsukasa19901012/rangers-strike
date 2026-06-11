import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog } from "./catalog/unifiedCatalog";
import { getCardEffect } from "./effects";
import { getUnitEffectBlock } from "./unitEffects";
import { WIKI_OPERATION_TEXT } from "./wikiReference";

describe("wikiReference", () => {
  it("documents all legend1 and legend2 operations", () => {
    const ops = [...legend1Catalog.cards, ...legend2Catalog.cards].filter(
      (c) => c.type === "operation",
    );
    for (const card of ops) {
      expect(WIKI_OPERATION_TEXT[card.id], card.id).toBeDefined();
    }
    const documentedLegend12 = Object.keys(WIKI_OPERATION_TEXT).filter(
      (id) => id <= "RS-122",
    );
    expect(documentedLegend12).toHaveLength(ops.length);
  });

  it("matches getCardEffect text for every operation", () => {
    for (const [cardId, wikiText] of Object.entries(WIKI_OPERATION_TEXT)) {
      const effect = getCardEffect(cardId);
      expect(effect?.text, cardId).toBe(wikiText);
    }
  });

  it("keeps unit catalog text aligned with registry rawText", () => {
    const units = [...legend1Catalog.cards, ...legend2Catalog.cards].filter(
      (c) => c.type === "unit",
    );

    for (const card of units) {
      const block = getUnitEffectBlock(card.id);
      expect(block, card.id).toBeDefined();
      const cardText = card.text ?? "";
      expect(cardText, card.id).toBe(block?.rawText ?? "");
    }
  });
});
