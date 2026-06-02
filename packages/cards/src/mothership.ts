import type { Category } from "./schema";
import type { ZordConditionId } from "./effectTaxonomy";
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

/** S-unit slots of the zord additional cost satisfied by material (this rush). */
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
  return 0;
}

/** Mothership holds still needed after S-unit material payment (Q7 partial). */
export function mothershipHoldsRequiredForRush(
  rushingCardId: string,
  slotsFilledByMaterial: number,
): number {
  return Math.max(0, mothershipHoldCountForRush(rushingCardId) - slotsFilledByMaterial);
}

/** Jaguar 母艦 cannot stack with discard-path additional cost (Q5). */
export function jaguarMothershipAllowedWithMaterial(
  rushingCardId: string,
  materialDestination?: "command" | "discard",
): boolean {
  if (getZordCondition(rushingCardId) !== "send_s_unit_to_command_or_discard") return false;
  return materialDestination !== "discard";
}

export function activeMothershipKindInRush(
  rushCardIds: string[],
): MothershipKind | null {
  if (rushCardIds.includes(MOTHERSHIP_CONFIG.jaguar.cardId)) return "jaguar";
  if (rushCardIds.includes(MOTHERSHIP_CONFIG.dekabase.cardId)) return "dekabase";
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
