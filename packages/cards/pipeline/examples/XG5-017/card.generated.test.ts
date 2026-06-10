/**
 * Auto-generated pipeline test for XG5-017 (魔法剣キングカリバー)
 * Regenerate: npm run pipeline:card -- XG5-017
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("XG5-017 魔法剣キングカリバー (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("XG5-017");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it("draw_cards fires on operation", () => {
    const effect = card.effects?.find((e) => e.id === "draw_cards");
    expect(effect?.trigger.type).toBe("operation");
    expect(["operation_played","operation_resolved"].every((ev) => ev.length > 0)).toBe(true);
  });
});
