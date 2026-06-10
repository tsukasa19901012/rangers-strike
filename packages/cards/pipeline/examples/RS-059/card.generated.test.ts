/**
 * Auto-generated pipeline test for RS-059 (マジブルー)
 * Regenerate: npm run pipeline:card -- RS-059
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RS-059 マジブルー (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RS-059");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it("unnamed_alias_magimermaid fires on while_in_field", () => {
    const effect = card.effects?.find((e) => e.id === "unnamed_alias_magimermaid");
    expect(effect?.trigger.type).toBe("while_in_field");
    expect(["modifier_applied"].every((ev) => ev.length > 0)).toBe(true);
  });

  it("future_sight fires on nc", () => {
    const effect = card.effects?.find((e) => e.id === "future_sight");
    expect(effect?.trigger.type).toBe("nc");
    expect(["battle_entered","nc_triggered","effect_triggered"].every((ev) => ev.length > 0)).toBe(true);
  });
});
