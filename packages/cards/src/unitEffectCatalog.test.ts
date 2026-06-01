import { describe, expect, it } from "vitest";
import {
  getCardById,
  IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  listWiredConditionalEffects,
  listWiredOnRushEffects,
} from "@rangers-strike/cards";

describe("unitEffectCatalog wiring", () => {
  const onRush = listWiredOnRushEffects(getCardById);
  const conditional = listWiredConditionalEffects(getCardById);

  it("lists all implemented on-rush effects from unitEffects", () => {
    expect(onRush.length).toBe(IMPLEMENTED_ON_RUSH_EFFECT_IDS.length);
    for (const effectId of IMPLEMENTED_ON_RUSH_EFFECT_IDS) {
      expect(onRush.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("includes RS-046 armor attack", () => {
    expect(onRush).toContainEqual(
      expect.objectContaining({
        cardId: "RS-046",
        effectId: "armor_attack",
        effectName: "アーマーアタック",
      }),
    );
  });

  it("lists conditional battle-entry effects excluding super_shield", () => {
    expect(conditional.map((entry) => entry.effectId).sort()).toEqual(
      [...IMPLEMENTED_CONDITIONAL_EFFECT_IDS].sort(),
    );
    expect(conditional.some((entry) => entry.effectId === "super_shield")).toBe(false);
  });

  it("includes Abare Black super drill", () => {
    expect(conditional).toContainEqual(
      expect.objectContaining({
        cardId: "RS-051",
        effectId: "super_drill",
      }),
    );
  });
});
