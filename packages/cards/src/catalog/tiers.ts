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

export const FULL_PLAYABLE_CARD_COUNT = 1832;

/** コアプレイアブル（L1–L3 + RS-179..690 + SR-* + BK-* + RK-*）。 */
export const CORE_PLAYABLE_CARD_COUNT = 1052;

/** E7: 効果文の抽出修正で 7 枚が A→C/D に再分類され complexity-promoted へ移動（167→160）。 */
export const VANILLA_PROMOTED_CARD_COUNT = 160;

/** full-playable カタログから除外するカード種別。 */
export const PLAYABLE_EXCLUDED_CARD_TYPES = ["commander"] as const;

export type PlayableExcludedCardType = (typeof PLAYABLE_EXCLUDED_CARD_TYPES)[number];

export const COMPLEXITY_PROMOTED_CARD_COUNT = 620;

export const CORE_PLAYABLE_EXPANSIONS = ["legend1", "legend2", "legend3"] as const;

export type CorePlayableExpansion = (typeof CORE_PLAYABLE_EXPANSIONS)[number];
