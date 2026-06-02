import { getUnitEffectBlock, listZordFusionPartnerIds } from "./unitEffects";
import type { RushAdditionalCondition, ZordConditionId } from "./effectTaxonomy";

export type { RushAdditionalCondition, ZordConditionId };

/** Zord-up additional condition ids (powerCost suffix "+"). */
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
  "RS-074": "send_s_unit_to_command_or_discard",
  "RS-075": "send_s_unit_to_command_or_discard",
  "RS-084": "discard_fusion_unit",
  "RS-085": "send_s_unit_to_power",
  "RS-086": "send_s_unit_to_power",
  "RS-087": "send_s_unit_to_power",
  "RS-088": "send_s_unit_to_power",
  "RS-089": "send_s_unit_to_power",
  "RS-094": "send_s_unit_to_power",
  "RS-095": "discard_fusion_unit",
  "RS-096": "send_s_unit_to_discard",
  "RS-097": "send_s_unit_to_discard",
  "RS-098": "send_s_unit_to_discard",
  "RS-111": "discard_fusion_unit",
  "RS-112": "discard_fusion_unit",
  "RS-113": "discard_fusion_unit",
  "RS-117": "discard_fusion_unit",
  "RS-118": "send_s_unit_to_command_or_discard",
  "RS-119": "send_s_unit_to_command_or_discard",
  "RS-120": "send_s_unit_to_command_or_discard",
  "RS-121": "send_s_unit_to_command_or_discard",
  "RS-122": "send_s_unit_to_command_or_discard",
};

/** Official 追加条件 text per condition id (atwiki 追加条件別一覧). */
export function rushAdditionalConditionText(
  conditionId: ZordConditionId,
  unitCount = 1,
): string {
  if (conditionId === "discard_fusion_unit") {
    return "自軍合体ユニットを捨札にする";
  }
  if (conditionId === "send_s_unit_to_command_or_discard") {
    return `自軍Sユニットを${unitCount}体コマンドゾーンに送るか捨札にする`;
  }
  if (conditionId === "send_s_unit_to_discard") {
    return `自軍Sユニットを${unitCount}体捨札にする`;
  }
  return `自軍Sユニットを${unitCount}体パワーゾーンに送る`;
}

export function buildRushAdditionalCondition(
  conditionId: ZordConditionId,
  unitCount = 1,
): RushAdditionalCondition {
  const text = rushAdditionalConditionText(conditionId, unitCount);
  if (
    conditionId === "send_s_unit_to_power" ||
    conditionId === "send_s_unit_to_discard" ||
    conditionId === "send_s_unit_to_command_or_discard"
  ) {
    return { conditionId, text, unitCount };
  }
  return { conditionId, text };
}

export function isSendSUnitZordCondition(conditionId: ZordConditionId): boolean {
  return (
    conditionId === "send_s_unit_to_power" ||
    conditionId === "send_s_unit_to_discard" ||
    conditionId === "send_s_unit_to_command_or_discard"
  );
}

export function getRushAdditionalCondition(
  cardId: string,
): RushAdditionalCondition | undefined {
  const conditionId = ZORD_CONDITIONS[cardId];
  if (!conditionId) return undefined;
  return buildRushAdditionalCondition(conditionId);
}

/** Prefer unitEffects.json / cards.json, then ZORD_CONDITIONS default. */
export function resolveRushAdditionalCondition(
  cardId: string,
  card?: { rushAdditionalCondition?: RushAdditionalCondition },
): RushAdditionalCondition | undefined {
  const fromBlock = getUnitEffectBlock(cardId)?.rushAdditionalCondition;
  if (fromBlock) return fromBlock;
  if (card?.rushAdditionalCondition) return card.rushAdditionalCondition;
  return getRushAdditionalCondition(cardId);
}

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
