import { describe, it, expect } from "vitest";
import { applyCardOverride, listCardOverrideIds } from "./loadCardOverrides";
import { validateCardDocument } from "../validator";
import type { CardDocument } from "../types";

describe("card overrides", () => {
  it("lists SK-000 override", () => {
    expect(listCardOverrideIds()).toContain("SK-000");
  });

  it("SK-000 override validates as template unit", () => {
    const base: CardDocument = {
      id: "SK-000",
      name: "仮面ライダー龍騎ブランク体",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "wiki_stub",
      powerCost: 4,
    };
    const merged = applyCardOverride(base);
    const result = validateCardDocument(merged);
    expect(result.ok, result.issues.map((i) => i.message).join(", ")).toBe(true);
    expect(merged.bp).toBe(0);
    expect(merged.implementation?.handler).toBe("interpreter");
  });
});
