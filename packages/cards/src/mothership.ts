import type { Category } from "./schema";
import type { ZordConditionId } from "./effectTaxonomy";
import { findNamedEffectByEffectId } from "./unitEffects";
import { getZordCondition, resolveRushAdditionalCondition } from "./zord";

export type MothershipKind = "jaguar" | "dekabase";

export const MOTHERSHIP_CONFIG: Record<
  MothershipKind,
  {
    cardId: string;
    commandCategory: Category;
    substitutesCondition: ZordConditionId;
  }
> = {
  jaguar: {
    cardId: "RS-076",
    commandCategory: "ET",
    substitutesCondition: "send_s_unit_to_command_or_discard",
  },
  dekabase: {
    cardId: "RS-105",
    commandCategory: "OT",
    substitutesCondition: "send_s_unit_to_power",
  },
};

export function mothershipSubstitutesCondition(
  kind: MothershipKind,
  condition: ZordConditionId | undefined,
): boolean {
  if (!condition) return false;
  return condition === MOTHERSHIP_CONFIG[kind].substitutesCondition;
}

export function mothershipHoldCountForRush(rushingCardId: string): number {
  return resolveRushAdditionalCondition(rushingCardId)?.unitCount ?? 1;
}

/** ゾード追加コストの S ユニット枠のうち、このラッシュの素材で充足する数。 */
export function zordSlotsFilledByMaterial(
  rushingCardId: string,
  hasMaterial: boolean,
  materialDestination?: "command" | "discard",
): number {
  if (!hasMaterial) return 0;
  const condition = getZordCondition(rushingCardId);
  if (
    condition === "send_s_unit_to_command_or_discard" &&
    (materialDestination === "command" || materialDestination === "discard")
  ) {
    return 1;
  }
  if (condition === "send_s_unit_to_power") return 1;
  if (condition === "send_s_unit_to_discard") return 1;
  if (condition === "discard_fusion_unit") return 1;
  return 0;
}

/** S ユニット素材支払い後も必要な母艦ホールド数（Q7 部分充足）。 */
export function mothershipHoldsRequiredForRush(
  rushingCardId: string,
  slotsFilledByMaterial: number,
): number {
  return Math.max(0, mothershipHoldCountForRush(rushingCardId) - slotsFilledByMaterial);
}

/** ジャガー母艦は捨札経路の追加コストと併用不可（Q5）。 */
export function jaguarMothershipAllowedWithMaterial(
  rushingCardId: string,
  materialDestination?: "command" | "discard",
): boolean {
  if (getZordCondition(rushingCardId) !== "send_s_unit_to_command_or_discard") return false;
  return materialDestination !== "discard";
}

const MOTHERSHIP_EFFECT_IDS: Record<MothershipKind, string> = {
  jaguar: "jaguar_mothership",
  dekabase: "dekabase_mothership",
};

export function activeMothershipKindInRush(
  rushCardIds: string[],
): MothershipKind | null {
  for (const cardId of rushCardIds) {
    if (findNamedEffectByEffectId(cardId, MOTHERSHIP_EFFECT_IDS.jaguar)) return "jaguar";
    if (findNamedEffectByEffectId(cardId, MOTHERSHIP_EFFECT_IDS.dekabase)) return "dekabase";
  }
  return null;
}

export function mothershipKindForZordRush(
  rushingCardId: string,
  rushCardIds: string[],
): MothershipKind | null {
  const kind = activeMothershipKindInRush(rushCardIds);
  if (!kind) return null;
  const condition = getZordCondition(rushingCardId);
  if (!mothershipSubstitutesCondition(kind, condition)) return null;
  return kind;
}
