import sk000 from "./SK-000.json";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../cardDocumentMerge";

const CARD_OVERRIDES: Record<string, Partial<CardDocument>> = {
  "SK-000": sk000 as Partial<CardDocument>,
};

let cachedOverrides: Map<string, Partial<CardDocument>> | null = null;

/** 人手修正 DSL（`src/dsl/overrides/{cardId}.json`）。 */
export function loadCardOverrides(): Map<string, Partial<CardDocument>> {
  if (cachedOverrides) return cachedOverrides;
  cachedOverrides = new Map(Object.entries(CARD_OVERRIDES));
  return cachedOverrides;
}

export function resetCardOverrideCache(): void {
  cachedOverrides = null;
}

export function applyCardOverride(base: CardDocument): CardDocument {
  const overlay = loadCardOverrides().get(base.id);
  if (!overlay) return base;
  return mergeCardDocument(base, overlay);
}

export function listCardOverrideIds(): string[] {
  return [...loadCardOverrides().keys()];
}
