/**
 * Auto-generated pipeline test for RS-643 (分身獣ギガホイール)
 * Regenerate: npm run pipeline:card -- RS-643
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RS-643 分身獣ギガホイール (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RS-643");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it.skip("segment_body — effect uses fallback_handler — engine test required", () => {});
});
