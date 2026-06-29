import generatedCorePlayable from "../generated/catalog/core-playable/cards.json";
import type { CardCatalog, CardDefinition } from "../schema";

export const corePlayableGeneratedCatalog = generatedCorePlayable as CardCatalog;

/** コア 1052 枚（generated/catalog/core-playable が正）。 */
export function loadCorePlayableCards(): CardDefinition[] {
  return corePlayableGeneratedCatalog.cards;
}

export function loadCorePlayableCatalog(): CardCatalog {
  return corePlayableGeneratedCatalog;
}

/** @deprecated U5 — `loadCorePlayableCards` を使用 */
export function loadLegacyCoreCards(): CardDefinition[] {
  return loadCorePlayableCards();
}

/** @deprecated U5 — `loadCorePlayableCatalog` を使用 */
export function loadLegacyCoreCatalog(): CardCatalog {
  return loadCorePlayableCatalog();
}
