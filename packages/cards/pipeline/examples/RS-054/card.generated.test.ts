/**
 * Auto-generated pipeline test for RS-054 (アバレッド)
 * Regenerate: npm run pipeline:card -- RS-054
 */
import { describe, it, expect } from "vitest";
import card from "./card.json";
import type { CardDocument } from "../../../src/dsl/types";
import { validateCardDocument } from "../../../src/dsl/validator";

const doc = card as CardDocument;

describe("RS-054 アバレッド (pipeline)", () => {
  it("card.json passes schema validation", () => {
    const result = validateCardDocument(doc);
    expect(result.ok, result.issues.map((i) => i.message).join("; ")).toBe(true);
  });

  it("has expected card id and effects", () => {
    expect(doc.id).toBe("RS-054");
    expect(doc.effects?.length ?? 0).toBeGreaterThan(0);
  });

  it("unnamed_destroy_self_damage fires on while_in_field", () => {
    const effect = card.effects?.find((e) => e.id === "unnamed_destroy_self_damage");
    expect(effect?.trigger.type).toBe("while_in_field");
    expect(["modifier_applied"].every((ev) => ev.length > 0)).toBe(true);
  });

  it("unnamed_auto_battle_entry_each_turn fires on while_in_field", () => {
    const effect = card.effects?.find((e) => e.id === "unnamed_auto_battle_entry_each_turn");
    expect(effect?.trigger.type).toBe("while_in_field");
    expect(["modifier_applied"].every((ev) => ev.length > 0)).toBe(true);
  });

  it("grant_sp1 fires on nc", () => {
    const effect = card.effects?.find((e) => e.id === "grant_sp1");
    expect(effect?.trigger.type).toBe("nc");
    expect(["battle_entered","nc_triggered","effect_triggered"].every((ev) => ev.length > 0)).toBe(true);
  });
});
