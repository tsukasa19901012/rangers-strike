/**
 * Auto-generated pipeline test for RS-020 (クルマジックパワー)
 * Regenerate: npm run pipeline:card -- RS-020
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RS-020 クルマジックパワー (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RS-020");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it("place_in_power fires on operation", () => {
    const effect = card.effects?.find((e) => e.id === "place_in_power");
    expect(effect?.trigger.type).toBe("operation");
    expect(["operation_played","operation_resolved"].every((ev) => ev.length > 0)).toBe(true);
  });
});
