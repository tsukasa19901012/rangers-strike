import { describe, expect, it } from "vitest";
import legend1Cards from "./legend1/cards.json";
import legend2Cards from "./legend2/cards.json";
import legend1UnitEffects from "./legend1/unitEffects.json";
import legend2UnitEffects from "./legend2/unitEffects.json";
import { getCardEffect } from "./effects";
import { WIKI_OPERATION_TEXT } from "./wikiReference";

describe("wikiReference", () => {
  it("documents all legend1 and legend2 operations", () => {
    const ops = [...legend1Cards.cards, ...legend2Cards.cards].filter(
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

  it("keeps unit cards.json text aligned with unitEffects rawText", () => {
    const units = [...legend1Cards.cards, ...legend2Cards.cards].filter(
      (c) => c.type === "unit",
    );
    const blocks = { ...legend1UnitEffects, ...legend2UnitEffects };

    for (const card of units) {
      const block = blocks[card.id as keyof typeof blocks];
      expect(block, card.id).toBeDefined();
      const cardText = card.text ?? "";
      expect(cardText, card.id).toBe(block?.rawText ?? "");
    }
  });
});
