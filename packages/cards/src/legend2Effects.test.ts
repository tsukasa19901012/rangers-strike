import { describe, expect, it } from "vitest";
import {
  getCardById,
  IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS,
  IMPLEMENTED_NC_EFFECT_IDS,
  IMPLEMENTED_ON_ATTACK_EFFECT_IDS,
  IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  IMPLEMENTED_PASSIVE_EFFECT_IDS,
  listWiredConditionalEffects,
  listWiredEnterBattleEffects,
  listWiredOnAttackEffects,
  listWiredOnRushEffects,
  listWiredPassiveEffects,
  listWiredNumberComboCards,
} from "@rangers-strike/cards";
import { corePlayableCatalog } from "./catalog/unifiedCatalog";
import { getUnitEffectBlock } from "./unitEffects";

function countLegend2NamedEffects(): number {
  return corePlayableCatalog.cards
    .filter((card) => card.id >= "RS-071" && card.id <= "RS-122")
    .reduce((sum, card) => sum + (getUnitEffectBlock(card.id)?.namedEffects.length ?? 0), 0);
}

describe("legend2 unitEffects wiring", () => {
  const legend2NamedCount = countLegend2NamedEffects();

  it("catalog lists all legend2 NC effects", () => {
    const nc = listWiredNumberComboCards(getCardById).filter((entry) =>
      entry.cardId.startsWith("RS-07") || entry.cardId.startsWith("RS-08") ||
      entry.cardId.startsWith("RS-09") || entry.cardId.startsWith("RS-10") ||
      entry.cardId.startsWith("RS-11") || entry.cardId.startsWith("RS-12"),
    );
    const legend2NcIds = nc.map((entry) => entry.effectId);
    for (const effectId of IMPLEMENTED_NC_EFFECT_IDS) {
      if (
        [
          "competition",
          "ryuu_geki_ken",
          "tricera_lance",
          "ptera_arrow",
          "life_rescue",
          "super_ninpo_lion_dance",
          "super_ninpo_water_transform",
          "dark_dual_blade",
          "space_ninpo_rope_skull",
          "deace_sniper",
          "green_crush",
          "backup_request",
          "zenibomb",
        ].includes(effectId)
      ) {
        expect(legend2NcIds).toContain(effectId);
      }
    }
  });

  it("implements legend2 on-rush effects", () => {
    const onRush = listWiredOnRushEffects(getCardById).filter((e) =>
      e.cardId >= "RS-071" && e.cardId <= "RS-122",
    );
    expect(onRush.length).toBeGreaterThanOrEqual(7);
    for (const effectId of [
      "rescue_activity",
      "sure_win_combination",
      "firefighting",
      "dismantling",
      "heavenly_disaster",
      "karakuri_great_tsunami",
      "air_transport",
    ]) {
      expect(IMPLEMENTED_ON_RUSH_EFFECT_IDS).toContain(effectId);
      expect(onRush.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("tracks legend2 named effect count", () => {
    expect(legend2NamedCount).toBeGreaterThanOrEqual(40);
    expect(IMPLEMENTED_ON_ATTACK_EFFECT_IDS.length).toBeGreaterThanOrEqual(10);
    expect(IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS.length).toBeGreaterThanOrEqual(5);
    expect(IMPLEMENTED_CONDITIONAL_EFFECT_IDS.length).toBeGreaterThanOrEqual(9);
    expect(IMPLEMENTED_PASSIVE_EFFECT_IDS.length).toBeGreaterThanOrEqual(12);
  });

  it("lists wired enter battle legend2 effects", () => {
    const enter = listWiredEnterBattleEffects(getCardById);
    expect(enter.some((e) => e.cardId === "RS-095" && e.effectId === "mane_hurricane")).toBe(true);
    expect(enter.some((e) => e.cardId === "RS-121" && e.effectId === "ruin_excavation")).toBe(true);
  });

  it("lists wired passive legend2 effects", () => {
    const passive = listWiredPassiveEffects(getCardById);
    expect(passive.some((e) => e.effectId === "bio_buster")).toBe(true);
    expect(passive.some((e) => e.effectId === "seabed_survey")).toBe(true);
    expect(passive.some((e) => e.cardId === "RS-073" && e.effectId === "val_shield")).toBe(true);
  });

  it("lists wired on-attack legend2 effects", () => {
    const onAttack = listWiredOnAttackEffects(getCardById);
    expect(onAttack.some((e) => e.cardId === "RS-117")).toBe(true);
  });

  it("lists wired conditional legend2 effects", () => {
    const conditional = listWiredConditionalEffects(getCardById);
    expect(conditional.some((e) => e.cardId === "RS-094")).toBe(true);
  });
});
