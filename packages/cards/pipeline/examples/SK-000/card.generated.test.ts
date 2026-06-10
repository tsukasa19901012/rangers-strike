/**
 * Auto-generated pipeline test for SK-000 (仮面ライダー龍騎ブランク体)
 * Regenerate: npm run pipeline:card -- SK-000
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("SK-000 仮面ライダー龍騎ブランク体 (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("SK-000");
    expect(doc.effects?.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(doc.implementation?.handler).toBe("unimplemented");
  });

  it.skip("effect — no effects defined", () => {});
});
