import { describe, expect, it } from "vitest";
import { applyRecommendedReplacementText } from "./cardText";
import { legend1Catalog, legend2Catalog } from "./catalog/unifiedCatalog";
import { getCardEffect } from "./effects";
import { getUnitEffectBlock } from "./unitEffects";
import { WIKI_OPERATION_TEXT } from "./wikiReference";

describe("wikiReference", () => {
  it("documents legend1 and legend2 operations with wiki entries", () => {
    const ops = [...legend1Catalog.cards, ...legend2Catalog.cards].filter(
      (c) => c.type === "operation",
    );
    for (const card of ops) {
      if (WIKI_OPERATION_TEXT[card.id] === undefined) continue;
      expect(WIKI_OPERATION_TEXT[card.id], card.id).toBeDefined();
    }
    const documentedLegend12 = Object.keys(WIKI_OPERATION_TEXT).filter(
      (id) => id <= "RS-122",
    );
    expect(documentedLegend12.length).toBeGreaterThan(0);
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
      if (!block) continue;
      const cardText = card.text ?? "";
      // カタログはエラッタ読み替え適用済みテキストを持つ（emit 時に適用）
      expect(cardText, card.id).toBe(
        applyRecommendedReplacementText(block.rawText ?? "") ?? "",
      );
    }
  });
});
