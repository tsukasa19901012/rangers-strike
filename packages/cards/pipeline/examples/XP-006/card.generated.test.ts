/**
 * Auto-generated pipeline test for XP-006 (侍合体)
 * Regenerate: npm run pipeline:card -- XP-006
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("XP-006 侍合体 (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("XP-006");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("named_e4be8de59088 — effect uses fallback_handler — engine test required", () => {});
});
