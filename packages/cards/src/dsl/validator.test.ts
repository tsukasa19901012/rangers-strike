import { describe, it, expect } from "vitest";
import { validateCardDocument, validateEffectDefinition, validateTrigger } from "./validator";
import exampleDsl from "./examples/RS-046.dsl.json";

describe("dsl/validator", () => {
  it("validates example DSL card", () => {
    const result = validateCardDocument(exampleDsl);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("rejects invalid card id", () => {
    const result = validateCardDocument({ id: "invalid" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "invalid_card_id")).toBe(true);
  });

  it("accepts XG expansion card ids", () => {
    const result = validateCardDocument({
      id: "XG1-007",
      name: "test",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "wiki_stub",
      powerCost: 5,
      bp: 5000,
      size: "S",
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("accepts zord down power cost (7-)", () => {
    const result = validateCardDocument({
      id: "RS-230",
      name: "test",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "legend1",
      powerCost: "7-",
      bp: 5500,
      size: "S",
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("validates on_rush trigger", () => {
    const result = validateTrigger({ type: "on_rush" });
    expect(result.ok).toBe(true);
  });

  it("requires partnerCardIds for nc_or_combo_from", () => {
    const result = validateTrigger({ type: "nc_or_combo_from" });
    expect(result.ok).toBe(false);
  });

  it("validates draw primitive", () => {
    const result = validateEffectDefinition({
      id: "test_draw",
      trigger: { type: "on_rush" },
      effects: [{ type: "draw", amount: 1 }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects empty effects array", () => {
    const result = validateEffectDefinition({
      id: "empty",
      trigger: { type: "on_rush" },
      effects: [],
    });
    expect(result.ok).toBe(false);
  });
});
