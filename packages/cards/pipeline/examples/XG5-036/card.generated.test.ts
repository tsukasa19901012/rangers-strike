/**
 * Auto-generated pipeline test for XG5-036 (龍ディスク)
 * Regenerate: npm run pipeline:card -- XG5-036
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("XG5-036 龍ディスク (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("XG5-036");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("named_e9be8de38387 — effect uses fallback_handler — engine test required", () => {});
});
