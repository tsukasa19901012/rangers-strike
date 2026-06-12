import { describe, expect, it } from "vitest";
import {
  fullPlayableCatalog,
  isCardDslUnimplemented,
} from "@rangers-strike/cards";
import { estimateCardUiCoverage } from "./estimateCardUiCoverage";

describe("estimateCardUiCoverage", () => {
  it("returns promoted-ui for DSL-ready core operations with UI wiring (RS-006)", () => {
    const coverage = estimateCardUiCoverage("RS-006");
    expect(coverage.tier).toBe("promoted-ui");
    expect(coverage.badges).toContain("Core");
    expect(coverage.badges).toContain("UI配線");
    expect(coverage.badges).toContain("DSL対応");
  });

  it("returns promoted-ui with generic DSL coverage for BK-001", () => {
    const coverage = estimateCardUiCoverage("BK-001");
    expect(coverage.tier).toBe("promoted-ui");
    expect(coverage.badges).toContain("DSL対応");
    expect(coverage.badges).toContain("汎用UI");
  });

  it("returns DSL未実装 for unimplemented cards when present", () => {
    const unimplementedId = fullPlayableCatalog.cards.find((card) =>
      isCardDslUnimplemented(card.id),
    )?.id;
    if (!unimplementedId) {
      expect(estimateCardUiCoverage("BK-001").badges).not.toContain("DSL未実装");
      return;
    }
    const coverage = estimateCardUiCoverage(unimplementedId);
    expect(coverage.tier).toBe("promoted-partial");
    expect(coverage.badges).toEqual(["DSL未実装"]);
  });

  it("returns empty badges for unknown card ids", () => {
    expect(estimateCardUiCoverage("UNKNOWN-999")).toEqual({
      tier: "promoted-partial",
      badges: [],
    });
  });
});
