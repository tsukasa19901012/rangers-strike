import { describe, expect, it } from "vitest";
import {
  IMPLEMENTED_NC_EFFECT_IDS,
  getCardById,
  getNumberComboEffect,
  listNcNamedEffects,
  listStandardNcCards,
  listWiredNumberComboCards,
  type NumberComboEffectId,
} from "@rangers-strike/cards";

describe("comboEffects NC wiring", () => {
  const wired = listWiredNumberComboCards(getCardById);
  const standard = listStandardNcCards(getCardById);

  it("maps every implemented NC effect from unitEffects", () => {
    for (const { cardId, effectId } of listNcNamedEffects()) {
      if (!IMPLEMENTED_NC_EFFECT_IDS.includes(effectId as NumberComboEffectId)) continue;
      expect(getNumberComboEffect(cardId)).toBe(effectId);
    }
  });

  it("lists all wired cards with numeric CN", () => {
    expect(wired.length).toBeGreaterThanOrEqual(28);
    for (const entry of wired) {
      expect(entry.comboNumber).toBeGreaterThanOrEqual(1);
      expect(entry.effectName.length).toBeGreaterThan(0);
    }
  });

  it("includes Magi Blue future sight at CN 2", () => {
    const blue = wired.find((entry) => entry.cardId === "RS-059");
    expect(blue).toEqual(
      expect.objectContaining({
        effectId: "future_sight",
        comboNumber: 2,
        effectName: "未来予知",
      }),
    );
  });

  it("separates standard NC from combo-from override cards", () => {
    const comboFromIds = wired
      .filter((entry) => entry.triggerType === "nc_or_combo_from")
      .map((entry) => entry.cardId);
    expect(comboFromIds).toContain("RS-031");
    expect(standard.every((entry) => entry.triggerType === "nc")).toBe(true);
    expect(getNumberComboEffect("RS-056")).toBe("magical_dragon_shoot");
  });
});
