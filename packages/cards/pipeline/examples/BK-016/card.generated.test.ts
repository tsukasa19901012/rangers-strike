/**
 * Auto-generated pipeline test for BK-016 (火炎鼓装備帯)
 * Regenerate: npm run pipeline:card -- BK-016
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("BK-016 火炎鼓装備帯 (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("BK-016");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("named_e781abe7828e — effect uses fallback_handler — engine test required", () => {});
});
