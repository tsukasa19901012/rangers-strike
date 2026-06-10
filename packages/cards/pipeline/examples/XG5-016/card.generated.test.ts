/**
 * Auto-generated pipeline test for XG5-016 (シグナルキャノン)
 * Regenerate: npm run pipeline:card -- XG5-016
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("XG5-016 シグナルキャノン (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("XG5-016");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("named_e382b7e382b0 — effect uses fallback_handler — engine test required", () => {});
});
