import { describe, expect, it } from "vitest";
import {
  estimateDeckWarnings,
  formatDeckWarningMessage,
} from "./deckWarnings";

describe("estimateDeckWarnings", () => {
  it("counts promoted-only cards by entry count", () => {
    const estimate = estimateDeckWarnings([
      { cardId: "RS-050", count: 3 },
      { cardId: "BK-001", count: 2 },
    ]);
    expect(estimate.uiUncertainCount).toBe(2);
    expect(estimate.uncertainCardIds).toEqual(["BK-001"]);
  });

  it("returns zero when all cards are core catalog", () => {
    const estimate = estimateDeckWarnings([{ cardId: "RS-050", count: 3 }]);
    expect(estimate.uiUncertainCount).toBe(0);
    expect(estimate.uncertainCardIds).toEqual([]);
  });

  it("ignores unknown card ids", () => {
    const estimate = estimateDeckWarnings([{ cardId: "RS-9999", count: 5 }]);
    expect(estimate.uiUncertainCount).toBe(0);
    expect(estimate.uncertainCardIds).toEqual([]);
  });
});

describe("formatDeckWarningMessage", () => {
  it("returns null when there are no uncertain cards", () => {
    expect(formatDeckWarningMessage({ uiUncertainCount: 0, uncertainCardIds: [] })).toBeNull();
  });

  it("formats the uncertain card count", () => {
    expect(
      formatDeckWarningMessage({ uiUncertainCount: 4, uncertainCardIds: ["BK-001"] }),
    ).toBe("UI 未確認カードが 4 枚含まれます");
  });
});
