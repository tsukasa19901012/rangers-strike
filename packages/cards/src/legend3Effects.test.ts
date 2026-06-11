import { describe, expect, it } from "vitest";
import {
  getCardById,
  IMPLEMENTED_CONDITIONAL_EFFECT_IDS,
  IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS,
  IMPLEMENTED_JOINT_L_EFFECT_IDS,
  IMPLEMENTED_JOINT_R_EFFECT_IDS,
  IMPLEMENTED_NC_EFFECT_IDS,
  IMPLEMENTED_ON_ATTACK_EFFECT_IDS,
  IMPLEMENTED_ON_RUSH_EFFECT_IDS,
  IMPLEMENTED_PASSIVE_EFFECT_IDS,
  listWiredConditionalEffects,
  listWiredEnterBattleEffects,
  listWiredJointComboCards,
  listWiredNumberComboCards,
  listWiredOnAttackEffects,
  listWiredOnRushEffects,
  listWiredPassiveEffects,
} from "@rangers-strike/cards";
import { corePlayableCatalog } from "./catalog/unifiedCatalog";
import { getUnitEffectBlock } from "./unitEffects";

function countLegend3NamedEffects(): number {
  return corePlayableCatalog.cards
    .filter((card) => card.id >= "RS-126" && card.id <= "RS-178")
    .reduce((sum, card) => sum + (getUnitEffectBlock(card.id)?.namedEffects.length ?? 0), 0);
}

describe("legend3 unitEffects wiring", () => {
  const legend3NamedCount = countLegend3NamedEffects();

  const isLegend3 = (cardId: string) => cardId >= "RS-126" && cardId <= "RS-178";

  it("implements legend3 on-rush effects", () => {
    const onRush = listWiredOnRushEffects(getCardById).filter((e) => isLegend3(e.cardId));
    expect(onRush.length).toBeGreaterThanOrEqual(7);
    for (const effectId of [
      "great_assault",
      "airlift",
      "assault",
      "submerge",
      "taurus_dive",
      "earth_resource_absorb",
      "nature_big_bang_final",
    ]) {
      expect(IMPLEMENTED_ON_RUSH_EFFECT_IDS).toContain(effectId);
      expect(onRush.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("implements legend3 NC effects", () => {
    const nc = listWiredNumberComboCards(getCardById).filter((e) => isLegend3(e.cardId));
    for (const effectId of [
      "fire_sword",
      "blazing_fire",
      "iron_broken",
      "grant_sp1",
    ]) {
      expect(IMPLEMENTED_NC_EFFECT_IDS).toContain(effectId);
      expect(nc.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("implements legend3 joint combo effects", () => {
    const joint = listWiredJointComboCards(getCardById).filter((e) => isLegend3(e.cardId));
    expect(joint.length).toBeGreaterThanOrEqual(8);
    for (const effectId of ["oni_neck_last", "elephant_shield", "cross_thunder"]) {
      expect(
        IMPLEMENTED_JOINT_L_EFFECT_IDS.includes(effectId as never) ||
          IMPLEMENTED_JOINT_R_EFFECT_IDS.includes(effectId as never),
      ).toBe(true);
      expect(joint.some((entry) => entry.effectId === effectId)).toBe(true);
    }
  });

  it("tracks legend3 named effect catalog coverage", () => {
    expect(legend3NamedCount).toBeGreaterThanOrEqual(50);
    expect(IMPLEMENTED_ON_ATTACK_EFFECT_IDS.length).toBeGreaterThanOrEqual(13);
    expect(IMPLEMENTED_ENTER_BATTLE_EFFECT_IDS.length).toBeGreaterThanOrEqual(10);
    expect(IMPLEMENTED_PASSIVE_EFFECT_IDS.length).toBeGreaterThanOrEqual(17);
    expect(IMPLEMENTED_CONDITIONAL_EFFECT_IDS).toContain("red_boot");
    expect(listWiredPassiveEffects(getCardById).filter((e) => isLegend3(e.cardId)).length).toBeGreaterThanOrEqual(4);
    expect(listWiredEnterBattleEffects(getCardById).filter((e) => isLegend3(e.cardId)).length).toBeGreaterThanOrEqual(5);
    expect(listWiredOnAttackEffects(getCardById).filter((e) => isLegend3(e.cardId)).length).toBeGreaterThanOrEqual(3);
    expect(listWiredConditionalEffects(getCardById).filter((e) => isLegend3(e.cardId)).length).toBeGreaterThanOrEqual(1);
  });
});
