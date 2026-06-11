/**
 * @deprecated `./catalog/unifiedCatalog` を直接参照してください。
 * 後方互換のため legend コアカタログ API を re-export します。
 */
export {
  ALL_CARDS_BY_ID,
  ALL_CATALOGS,
  allCardsCatalog,
  getCardById,
  getCatalogByExpansion,
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
  listExpansionIds,
  type ExpansionId,
} from "./catalog/unifiedCatalog";
