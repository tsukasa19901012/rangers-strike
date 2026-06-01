import { describe, expect, it } from "vitest";
import {
  IMPLEMENTED_INSTANT_EFFECT_IDS,
  IMPLEMENTED_PERMANENT_EFFECT_IDS,
  listImplementedOperations,
  listUnimplementedOperations,
} from "@rangers-strike/cards";

describe("operationCatalog", () => {
  const implemented = listImplementedOperations();
  const unimplemented = listUnimplementedOperations();

  it("covers all Legend1 operation cards", () => {
    expect(unimplemented).toEqual([]);
    expect(implemented.length).toBeGreaterThanOrEqual(30);
  });

  it("marks instant handlers as implemented", () => {
    for (const effectId of IMPLEMENTED_INSTANT_EFFECT_IDS) {
      expect(implemented.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("marks permanent ops as implemented", () => {
    for (const effectId of IMPLEMENTED_PERMANENT_EFFECT_IDS) {
      expect(implemented.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("has no unimplemented entries in Legend1", () => {
    expect(unimplemented).toEqual([]);
  });
});
