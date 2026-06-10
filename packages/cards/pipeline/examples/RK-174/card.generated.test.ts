/**
 * Auto-generated pipeline test for RK-174 (プットオン)
 * Regenerate: npm run pipeline:card -- RK-174
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RK-174 プットオン (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RK-174");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it("place_in_power fires on operation", () => {
    const effect = card.effects?.find((e) => e.id === "place_in_power");
    expect(effect?.trigger.type).toBe("operation");
    expect(["operation_played","operation_resolved"].every((ev) => ev.length > 0)).toBe(true);
  });
});
