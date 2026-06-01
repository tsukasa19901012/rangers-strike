import type { CardDefinition } from "./schema";
import {
  IMPLEMENTED_JOINT_L_EFFECT_IDS,
  IMPLEMENTED_JOINT_R_EFFECT_IDS,
  IMPLEMENTED_RIDING_COMBO_EFFECT_IDS,
  listWiredJointComboCards,
  type JointComboLEffectId,
  type JointComboREffectId,
  type RidingComboEffectId,
  type WiredJointComboCard,
} from "./comboEffects";

export type { WiredJointComboCard };

export function listWiredJointLEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredJointComboCard[] {
  return listWiredJointComboCards(lookup).filter(
    (entry) => entry.triggerType === "joint_combo_l",
  );
}

export function listWiredJointREffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredJointComboCard[] {
  return listWiredJointComboCards(lookup).filter(
    (entry) => entry.triggerType === "joint_combo_r",
  );
}

export function listWiredRidingComboEffects(
  lookup: (cardId: string) => CardDefinition | undefined,
): WiredJointComboCard[] {
  return listWiredJointComboCards(lookup).filter(
    (entry) => entry.triggerType === "riding_combo",
  );
}

export function isJointComboEffectImplemented(
  effectId: string,
  triggerType: WiredJointComboCard["triggerType"],
): boolean {
  if (triggerType === "joint_combo_l") {
    return IMPLEMENTED_JOINT_L_EFFECT_IDS.includes(effectId as JointComboLEffectId);
  }
  if (triggerType === "joint_combo_r") {
    return IMPLEMENTED_JOINT_R_EFFECT_IDS.includes(effectId as JointComboREffectId);
  }
  return IMPLEMENTED_RIDING_COMBO_EFFECT_IDS.includes(effectId as RidingComboEffectId);
}
