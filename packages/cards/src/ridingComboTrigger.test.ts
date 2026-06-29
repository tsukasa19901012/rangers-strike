import { describe, expect, it } from "vitest";
import {
  getRidingComboNamedEffect,
  getUnitEffectBlock,
  listRidingComboNamedEffects,
} from "./unitEffects";
import { dslEffectMatchesRidingComboTrigger } from "./ridingComboTrigger";
import { loadCardById } from "./dsl/loader";

describe("riding combo trigger normalization", () => {
  it("maps RC card named effects from nc to riding_combo in unit blocks", () => {
    const block = getUnitEffectBlock("PK-006");
    const satan = block?.namedEffects.find((entry) => entry.effectId === "satansaberu");
    expect(satan?.trigger.type).toBe("riding_combo");
  });

  it("lists RC cards in riding combo named effects", () => {
    const ids = listRidingComboNamedEffects().map((entry) => entry.cardId);
    expect(ids).toContain("PK-006");
    expect(ids.length).toBeGreaterThan(100);
  });

  it("resolves getRidingComboNamedEffect for RC cards", () => {
    expect(getRidingComboNamedEffect("PK-006")?.effectId).toBe("satansaberu");
  });

  it("includes ride-off unconditional NC cards as riding combo", () => {
    const ids = listRidingComboNamedEffects().map((entry) => entry.cardId);
    expect(ids).toContain("XG4-025");
    const block = getUnitEffectBlock("XG4-025");
    const named = block?.namedEffects.find((entry) => entry.effectId === "ken_sonikuhanma");
    expect(named?.trigger.type).toBe("nc");
    expect(getRidingComboNamedEffect("XG4-025")?.effectId).toBe("ken_sonikuhanma");
  });

  it("matches DSL riding_combo lookup for RC cards stored as nc in stubs", () => {
    const doc = loadCardById("PK-006", "full-playable");
    const satan = doc.effects?.find((entry) => entry.id === "satansaberu");
    expect(satan).toBeDefined();
    expect(
      dslEffectMatchesRidingComboTrigger(
        satan!.trigger,
        satan!.text ?? "",
        doc.comboNumber,
      ),
    ).toBe(true);
  });
});
