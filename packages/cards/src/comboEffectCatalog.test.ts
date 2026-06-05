import { describe, expect, it } from "vitest";
import {
  IMPLEMENTED_JOINT_L_EFFECT_IDS,
  IMPLEMENTED_JOINT_R_EFFECT_IDS,
  IMPLEMENTED_RIDING_COMBO_EFFECT_IDS,
  getJointLEffect,
  getJointREffect,
  getRidingComboEffect,
  listWiredJointComboCards,
} from "./comboEffects";
import {
  isJointComboEffectImplemented,
  listWiredJointLEffects,
  listWiredJointREffects,
  listWiredRidingComboEffects,
} from "./comboEffectCatalog";
import { getCardById } from "./index";

describe("comboEffectCatalog joint/riding wiring", () => {
  const wired = listWiredJointComboCards(getCardById);

  it("exposes implemented effect id lists", () => {
    expect(IMPLEMENTED_JOINT_L_EFFECT_IDS).toContain("grant_sp1_to_partner");
    expect(IMPLEMENTED_JOINT_R_EFFECT_IDS).toContain("grant_sp1");
    expect(IMPLEMENTED_RIDING_COMBO_EFFECT_IDS).toContain("grant_sp1");
  });

  it("Legend1 has no L/R/RC combo cards yet", () => {
    const legend1Only = wired.filter((entry) => entry.cardId < "RS-071");
    expect(legend1Only).toEqual([]);
    expect(listWiredJointLEffects(getCardById).filter((e) => e.cardId < "RS-071")).toEqual([]);
    expect(listWiredJointREffects(getCardById).filter((e) => e.cardId < "RS-071")).toEqual([]);
    expect(listWiredRidingComboEffects(getCardById)).toEqual([]);
  });

  it("validates implemented effect ids by trigger type", () => {
    expect(isJointComboEffectImplemented("grant_sp1_to_partner", "joint_combo_l")).toBe(true);
    expect(isJointComboEffectImplemented("grant_sp1", "joint_combo_r")).toBe(true);
    expect(isJointComboEffectImplemented("grant_sp1", "riding_combo")).toBe(true);
    expect(isJointComboEffectImplemented("unknown", "joint_combo_l")).toBe(false);
  });

  it("getters resolve implemented ids from named effects", () => {
    expect(getJointLEffect("RS-031")).toBeUndefined();
    expect(getJointREffect("RS-031")).toBeUndefined();
    expect(getRidingComboEffect("RS-031")).toBeUndefined();
  });
});
