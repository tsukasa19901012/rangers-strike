import { describe, expect, it } from "vitest";
import { normalizeComboNumberLabel, parseComboNumber } from "./metaMaps";

describe("parseComboNumber", () => {
  it("parses fullwidth RC from atwiki", () => {
    expect(parseComboNumber("ＲＣ")).toBe("RC");
    expect(parseComboNumber("Ｒｃ")).toBe("RC");
  });

  it("parses fullwidth numeric CN", () => {
    expect(parseComboNumber("６")).toBe(6);
  });

  it("normalizes combo labels", () => {
    expect(normalizeComboNumberLabel("Ｌ")).toBe("L");
    expect(normalizeComboNumberLabel("Ｒ")).toBe("R");
  });
});
