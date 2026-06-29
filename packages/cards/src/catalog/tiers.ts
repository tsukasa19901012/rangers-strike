/** カタログ tier 識別子（U1 統合カタログ）。 */
export const CATALOG_TIERS = [
  "core",
  "vanilla-promoted",
  "complexity-promoted",
  "wiki-stubs",
  "stub-promoted",
  "full-playable",
  "extended",
] as const;

export type CatalogTier = (typeof CATALOG_TIERS)[number];

export const FULL_PLAYABLE_CARD_COUNT = 1849;

/** コアプレイアブル（L1–L3 + RS-179..690 + SR-* + BK-* + RK-*）。 */
export const CORE_PLAYABLE_CARD_COUNT = 1052;

export const VANILLA_PROMOTED_CARD_COUNT = 184;

export const COMPLEXITY_PROMOTED_CARD_COUNT = 613;

export const CORE_PLAYABLE_EXPANSIONS = ["legend1", "legend2", "legend3"] as const;

export type CorePlayableExpansion = (typeof CORE_PLAYABLE_EXPANSIONS)[number];
