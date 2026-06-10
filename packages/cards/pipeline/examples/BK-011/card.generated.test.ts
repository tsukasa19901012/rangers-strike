/**
 * Auto-generated pipeline test for BK-011 (アークル)
 * Regenerate: npm run pipeline:card -- BK-011
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("BK-011 アークル (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("BK-011");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("named_e382a2e383bc — effect uses fallback_handler — engine test required", () => {});
});
