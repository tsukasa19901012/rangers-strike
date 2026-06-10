import { allCardsCatalog, getCardById } from "./catalog";
import complexityPromotedCards from "./generated/catalog/complexity-promoted/cards.json";
import vanillaPromotedCards from "./generated/catalog/vanilla-promoted/cards.json";
import wikiStubsCards from "./generated/catalog/wiki-stubs/cards.json";
import type { CardCatalog, CardDefinition } from "./schema";

/** Wiki 未登録カードのスタブカタログ（generate-wiki-stubs で生成）。 */
export const wikiStubsCatalog = wikiStubsCards as CardCatalog;

/** A/E/B グレード昇格カタログ（M11 — emit-vanilla-catalog で生成）。 */
export const vanillaPromotedCatalog = vanillaPromotedCards as CardCatalog;

/** C/D グレード昇格カタログ（M12 — emit-complexity-catalog で生成）。 */
export const complexityPromotedCatalog = complexityPromotedCards as CardCatalog;

/** レジェンド1–3 スターター用 179 枚。 */
export const corePlayableCatalog = allCardsCatalog;

/** @deprecated エイリアス — corePlayableCatalog と同義 */
export const playableCardsCatalog = corePlayableCatalog;

/** 179 + vanilla 354 + complexity 1316 = 1849 枚。 */
export const fullPlayableCatalog: CardCatalog = {
  expansion: "full-playable",
  cards: [
    ...corePlayableCatalog.cards,
    ...vanillaPromotedCatalog.cards,
    ...complexityPromotedCatalog.cards,
  ],
};

/** スタブ昇格済み 1670 枚（vanilla + complexity）。 */
export const stubPromotedCatalog: CardCatalog = {
  expansion: "stub-promoted",
  cards: [...vanillaPromotedCatalog.cards, ...complexityPromotedCatalog.cards],
};

/** プレイ可能 + 全 Wiki スタブ = 1849 枚。 */
export const extendedCardsCatalog: CardCatalog = {
  expansion: "extended",
  cards: [...corePlayableCatalog.cards, ...wikiStubsCatalog.cards],
};

const CORE_BY_ID = new Map(corePlayableCatalog.cards.map((c) => [c.id, c]));
const VANILLA_BY_ID = new Map(vanillaPromotedCatalog.cards.map((c) => [c.id, c]));
const COMPLEXITY_BY_ID = new Map(complexityPromotedCatalog.cards.map((c) => [c.id, c]));
const FULL_PLAYABLE_BY_ID = new Map(fullPlayableCatalog.cards.map((c) => [c.id, c]));
const EXTENDED_BY_ID = new Map(extendedCardsCatalog.cards.map((c) => [c.id, c]));

export function getCorePlayableCardById(id: string): CardDefinition | undefined {
  return CORE_BY_ID.get(id);
}

export function getPlayableCardById(id: string): CardDefinition | undefined {
  return CORE_BY_ID.get(id);
}

export function getVanillaPromotedCardById(id: string): CardDefinition | undefined {
  return VANILLA_BY_ID.get(id);
}

export function getComplexityPromotedCardById(id: string): CardDefinition | undefined {
  return COMPLEXITY_BY_ID.get(id);
}

export function getFullPlayableCardById(id: string): CardDefinition | undefined {
  return FULL_PLAYABLE_BY_ID.get(id);
}

/** Core カードを優先し、なければ full playable（promoted 含む）を返す。 */
export function resolvePlayableCard(id: string): CardDefinition | undefined {
  return getCardById(id) ?? getFullPlayableCardById(id);
}

export function getExtendedCardById(id: string): CardDefinition | undefined {
  return EXTENDED_BY_ID.get(id);
}

export function isCorePlayableCardId(id: string): boolean {
  return CORE_BY_ID.has(id);
}

export function isPlayableCardId(id: string): boolean {
  return CORE_BY_ID.has(id);
}

export function isVanillaPromotedCardId(id: string): boolean {
  return VANILLA_BY_ID.has(id);
}

export function isComplexityPromotedCardId(id: string): boolean {
  return COMPLEXITY_BY_ID.has(id);
}

export function isFullPlayableCardId(id: string): boolean {
  return FULL_PLAYABLE_BY_ID.has(id);
}

export function isWikiStubCardId(id: string): boolean {
  return !CORE_BY_ID.has(id) && EXTENDED_BY_ID.has(id);
}
