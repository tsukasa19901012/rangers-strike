import { describe, expect, it } from "vitest";
import { classifyWikiSet, groupWikiSets } from "./expansionGroups";

describe("expansionGroups", () => {
  it("classifies promo sets", () => {
    expect(classifyWikiSet("2007年 Vジャンプ8月号同梱プロモーションカード")).toBe("promo");
  });

  it("classifies booster sets", () => {
    expect(classifyWikiSet("XG1 ザ・ファーストエンカウント")).toBe("booster");
  });

  it("groups sets into buckets", () => {
    const groups = groupWikiSets([
      "XG1 ザ・ファーストエンカウント",
      "プロモーションカード",
      "英雄の再誕",
    ]);
    expect(groups.find((g) => g.id === "booster")?.sets).toHaveLength(2);
    expect(groups.find((g) => g.id === "promo")?.sets).toHaveLength(1);
  });
});
