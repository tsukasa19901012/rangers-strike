import { describe, expect, it } from "vitest";
import { inferCategoryFromWikiLabels, parseSp, SIZE_MAP } from "./metaMaps";

describe("parseSp", () => {
  it("parses fractional SP without stripping the slash", () => {
    expect(parseSp("1/4")).toBe("1/4");
    expect(parseSp("SP1/4")).toBe("1/4");
    expect(parseSp("1／4")).toBe("1/4");
    expect(parseSp("1/5")).toBe("1/5");
    expect(parseSp("2/3")).toBe("2/3");
  });

  it("parses integer and special SP", () => {
    expect(parseSp("2")).toBe(2);
    expect(parseSp("！")).toBe("special");
    expect(parseSp("なし")).toBeNull();
  });
});

describe("SIZE_MAP", () => {
  it("maps vehicle kinds to unit sizes", () => {
    expect(SIZE_MAP["Sビークル"]).toBe("S");
    expect(SIZE_MAP["Mビークル"]).toBe("M");
  });
});

describe("inferCategoryFromWikiLabels", () => {
  it("maps atwiki ミステックアームズ spelling to MA", () => {
    expect(inferCategoryFromWikiLabels("ミステックアームズ")).toBe("MA");
  });

  it("maps multi-category labels to category arrays", () => {
    expect(inferCategoryFromWikiLabels("ワイルドビースト／ミスティックアームズ")).toEqual([
      "WB",
      "MA",
    ]);
  });
});
