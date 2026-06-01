import { listZordFusionPartnerIds } from "./unitEffects";

/** Zord-up additional condition ids (powerCost suffix "+"). */
export type ZordConditionId =
  | "discard_fusion_unit"
  | "send_s_unit_to_power";

export const ZORD_CONDITIONS: Record<string, ZordConditionId> = {
  "RS-034": "discard_fusion_unit",
  "RS-042": "discard_fusion_unit",
  "RS-043": "send_s_unit_to_power",
  "RS-044": "send_s_unit_to_power",
  "RS-045": "send_s_unit_to_power",
  "RS-046": "send_s_unit_to_power",
  "RS-047": "send_s_unit_to_power",
  "RS-050": "discard_fusion_unit",
  "RS-056": "discard_fusion_unit",
  "RS-070": "discard_fusion_unit",
  "RS-073": "discard_fusion_unit",
  "RS-074": "send_s_unit_to_power",
  "RS-075": "send_s_unit_to_power",
  "RS-084": "discard_fusion_unit",
  "RS-085": "send_s_unit_to_power",
  "RS-086": "send_s_unit_to_power",
  "RS-087": "send_s_unit_to_power",
  "RS-088": "send_s_unit_to_power",
  "RS-089": "send_s_unit_to_power",
  "RS-094": "send_s_unit_to_power",
  "RS-095": "discard_fusion_unit",
  "RS-096": "send_s_unit_to_power",
  "RS-097": "send_s_unit_to_power",
  "RS-098": "send_s_unit_to_power",
  "RS-111": "discard_fusion_unit",
  "RS-112": "discard_fusion_unit",
  "RS-113": "discard_fusion_unit",
  "RS-117": "discard_fusion_unit",
  "RS-118": "send_s_unit_to_power",
  "RS-119": "send_s_unit_to_power",
  "RS-120": "send_s_unit_to_power",
  "RS-121": "send_s_unit_to_power",
  "RS-122": "send_s_unit_to_power",
};

/** Units that satisfy 「自軍合体ユニットを捨札にする」. */
export const FUSION_UNIT_IDS = new Set([
  "RS-035",
  "RS-036",
  "RS-037",
  "RS-038",
  "RS-039",
  "RS-043",
  "RS-044",
  "RS-045",
  "RS-046",
  "RS-047",
  "RS-051",
  "RS-052",
  "RS-053",
  "RS-057",
  "RS-058",
  "RS-059",
  "RS-060",
  "RS-061",
  "RS-062",
  "RS-074",
  "RS-075",
  "RS-085",
  "RS-086",
  "RS-087",
  "RS-088",
  "RS-089",
  "RS-096",
  "RS-097",
  "RS-098",
  "RS-114",
  "RS-115",
  "RS-118",
  "RS-119",
  "RS-120",
  "RS-121",
  "RS-122",
]);

export function isZordUpCost(powerCost: number | string): boolean {
  return typeof powerCost === "string" && powerCost.endsWith("+");
}

export function getZordCondition(cardId: string): ZordConditionId | undefined {
  return ZORD_CONDITIONS[cardId];
}

export function isFusionUnit(cardId: string): boolean {
  return FUSION_UNIT_IDS.has(cardId);
}

/** Whether `materialCardId` can be discarded for this zord-up rush. */
export function isValidZordFusionMaterial(
  zordCardId: string,
  materialCardId: string,
): boolean {
  if (!isFusionUnit(materialCardId)) return false;
  const partners = listZordFusionPartnerIds(zordCardId);
  if (partners.length === 0) return true;
  return partners.includes(materialCardId);
}
