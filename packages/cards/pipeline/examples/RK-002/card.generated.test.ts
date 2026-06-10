/**
 * Auto-generated pipeline test for RK-002 (V3ホッパー)
 * Regenerate: npm run pipeline:card -- RK-002
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RK-002 V3ホッパー (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RK-002");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("v3 — effect uses fallback_handler — engine test required", () => {});
});
