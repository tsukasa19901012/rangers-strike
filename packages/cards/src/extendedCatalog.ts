/**
 * @deprecated `./catalog/unifiedCatalog` を直接参照してください。
 * 後方互換のため full-playable / promoted カタログ API を re-export します。
 */
export {
  complexityPromotedCatalog,
  corePlayableCatalog,
  extendedCardsCatalog,
  fullPlayableCatalog,
  playableCardsCatalog,
  stubPromotedCatalog,
  vanillaPromotedCatalog,
  wikiStubsCatalog,
  getComplexityPromotedCardById,
  getCorePlayableCardById,
  getExtendedCardById,
  getFullPlayableCardById,
  getPlayableCardById,
  getVanillaPromotedCardById,
  isComplexityPromotedCardId,
  isCorePlayableCardId,
  isFullPlayableCardId,
  isPlayableCardId,
  isVanillaPromotedCardId,
  isWikiStubCardId,
  resolvePlayableCard,
} from "./catalog/unifiedCatalog";
