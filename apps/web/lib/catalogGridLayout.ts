export const CATALOG_CARD_WIDTH = 72;
export const CATALOG_GRID_GAP = 10;
export const CATALOG_GRID_PADDING = 8;
/** Small card image height (102px) + qty badge overflow */
export const CATALOG_ROW_HEIGHT = 116;
/** Row height when the adjust overlay is open on a card in the row */
export const CATALOG_ROW_HEIGHT_SELECTED = 180;

export function computeCatalogGridColumns(containerWidth: number): number {
  if (containerWidth <= 0) return 2;
  const contentWidth = containerWidth - CATALOG_GRID_PADDING;
  return Math.max(
    1,
    Math.floor((contentWidth + CATALOG_GRID_GAP) / (CATALOG_CARD_WIDTH + CATALOG_GRID_GAP)),
  );
}
