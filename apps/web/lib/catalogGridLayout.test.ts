import { describe, expect, it } from "vitest";
import {
  CATALOG_CARD_WIDTH,
  CATALOG_GRID_GAP,
  CATALOG_GRID_PADDING,
  computeCatalogGridColumns,
} from "./catalogGridLayout";

describe("computeCatalogGridColumns", () => {
  it("returns at least 1 column", () => {
    expect(computeCatalogGridColumns(0)).toBe(2);
    expect(computeCatalogGridColumns(40)).toBe(1);
  });

  it("fits as many 72px columns as the container allows", () => {
    const oneColumnWidth = CATALOG_GRID_PADDING + CATALOG_CARD_WIDTH;
    expect(computeCatalogGridColumns(oneColumnWidth)).toBe(1);

    const twoColumnWidth =
      CATALOG_GRID_PADDING + CATALOG_CARD_WIDTH * 2 + CATALOG_GRID_GAP;
    expect(computeCatalogGridColumns(twoColumnWidth)).toBe(2);
  });

  it("scales up on wider viewports without a hard cap", () => {
    expect(computeCatalogGridColumns(390)).toBe(4);
    expect(computeCatalogGridColumns(1024)).toBe(12);
  });
});
