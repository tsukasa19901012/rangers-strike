import { describe, expect, it } from "vitest";
import type { Category } from "./schema";
import { getCardById, legend2Catalog } from "./catalog";

/**
 * grnrngr.com カードページの公式カテゴリ（2026）。
 * ET = アーステクノロジー, MA = ミスティックアームズ, OT = オーバーテクノロジー 等。
 */
const LEGEND2_OFFICIAL_CATEGORY: Record<string, Category> = {
  "RS-073": "ET",
  "RS-074": "ET",
  "RS-075": "ET",
  "RS-076": "ET",
  "RS-091": "ET",
  "RS-095": "MA",
  "RS-096": "MA",
  "RS-097": "MA",
  "RS-098": "MA",
  "RS-099": "MA",
  "RS-100": "MA",
  "RS-101": "MA",
  "RS-106": "OT",
  "RS-111": "MA",
  "RS-113": "MA",
  "RS-116": "MA",
  "RS-117": "ET",
  "RS-118": "ET",
  "RS-119": "ET",
  "RS-120": "ET",
  "RS-121": "ET",
  "RS-122": "ET",
};

describe("legend2 card categories", () => {
  it("matches official categories for verified cards", () => {
    for (const [id, category] of Object.entries(LEGEND2_OFFICIAL_CATEGORY)) {
      const card = getCardById(id);
      expect(card, id).toBeDefined();
      expect(card?.category, id).toBe(category);
    }
  });

  it("has no MA-series units left mislabeled as ET", () => {
    const maSeriesNames = /^(旋風神|ハリケン|マジキング|ファイヤーカイザー|マンドラ坊や)/;
    for (const card of legend2Catalog.cards) {
      if (!maSeriesNames.test(card.name)) continue;
      expect(card.category, card.id).toBe("MA");
    }
  });
});
