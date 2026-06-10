import { describe, expect, it } from "vitest";
import { matchRulingPatterns, pickPrimaryCategory } from "./rulingCatalog";

describe("rulingCatalog", () => {
  it("classifies wing as rule_override", () => {
    const hits = matchRulingPatterns("【ウイング】これはウイングとしてアタックできる。");
    expect(hits.some((h) => h.category === "rule_override" && h.patternId === "wing")).toBe(true);
    const cats = new Set(hits.map((h) => h.category));
    expect(pickPrimaryCategory(cats)).toBe("rule_override");
  });

  it("classifies replacement before continuous", () => {
    const text = "撃破されて捨札になるとき、かわりに捨札になるだけで留まらせる。";
    const hits = matchRulingPatterns(text);
    const cats = new Set(hits.map((h) => h.category));
    expect(pickPrimaryCategory(cats)).toBe("replacement_effect");
  });

  it("classifies commander as state_rewrite", () => {
    const hits = matchRulingPatterns("ゲーム開始時、コマンダーゾーンに配置する。");
    expect(pickPrimaryCategory(new Set(hits.map((h) => h.category)))).toBe("state_rewrite");
  });
});
