import { describe, expect, it } from "vitest";
import { getCardById, getStarterDeck } from "../../../index";
import { cardDefinitionToDocument } from "../../loader";
import { getDefaultCardRegistry, resetDefaultCardRegistry } from "../../registry";
import {
  applyLegend1StarterOverlay,
  listLegend1StarterCardIds,
  loadLegend1StarterOverlays,
} from "./loadStarterOverlays";
import { isFullyDslEffect } from "../../loader";

const STARTER_DECK_IDS = ["abarenoh", "dekaranger", "magiking"] as const;

describe("legend1 starter DSL", () => {
  it("covers all 36 unique starter cards", () => {
    const ids = new Set<string>();
    for (const deckId of STARTER_DECK_IDS) {
      for (const entry of getStarterDeck(deckId).entries) {
        ids.add(entry.cardId);
      }
    }
    expect(listLegend1StarterCardIds().sort()).toEqual([...ids].sort());
    expect(loadLegend1StarterOverlays().size).toBe(36);
  });

  it("uses DSL interpreter only — no fallback_handler in overlays", () => {
    for (const partial of loadLegend1StarterOverlays().values()) {
      for (const effect of partial.effects ?? []) {
        expect(effect.effects.every((p) => p.type !== "fallback_handler")).toBe(true);
      }
      expect(partial.implementation?.handler).toBe("interpreter");
      expect(partial.implementation?.source).toBe("dsl");
    }
  });

  it("merges into valid CardDocuments", () => {
    for (const cardId of listLegend1StarterCardIds()) {
      const def = getCardById(cardId);
      expect(def, cardId).toBeDefined();
      const merged = applyLegend1StarterOverlay(cardDefinitionToDocument(def!));
      expect(merged.id).toBe(cardId);
      const hasGameplay =
        (merged.effects?.length ?? 0) > 0 ||
        !!merged.rushAdditionalCondition ||
        (merged.unnamedRules?.length ?? 0) > 0;
      expect(hasGameplay, cardId).toBe(true);
    }
  });

  it("registry lists starter cards as dsl-ready", () => {
    resetDefaultCardRegistry();
    const registry = getDefaultCardRegistry();
    for (const cardId of listLegend1StarterCardIds()) {
      const card = registry.getCard(cardId);
      expect(card, cardId).toBeDefined();
      expect(card!.implementation?.handler).toBe("interpreter");
      if ((card!.effects?.length ?? 0) > 0) {
        expect(card!.effects?.some(isFullyDslEffect)).toBe(true);
      }
      expect(registry.listLegacyHandler()).not.toContain(cardId);
    }
  });
});
