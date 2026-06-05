import { allCardsCatalog } from "./catalog";
import type { RushAdditionalCondition, ZordConditionId } from "./effectTaxonomy";
import {
  buildFusionPartnerIdSet,
  getUnitEffectBlock,
  listZordFusionPartnerIds,
} from "./unitEffects";

export type { RushAdditionalCondition, ZordConditionId };

/** Legacy zord-up map (Legend 1/2). Legend 3+ uses unitEffects.json / cards.json. */
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

/** Fusion units not listed on any 合体― line but valid generic discard material. */
const LEGACY_EXTRA_FUSION_UNIT_IDS = ["RS-062"] as const;

/** Derived from all 合体― partner lists in unitEffects.json (+ legacy extras). */
export const FUSION_UNIT_IDS: ReadonlySet<string> = new Set([
  ...buildFusionPartnerIdSet(),
  ...LEGACY_EXTRA_FUSION_UNIT_IDS,
]);

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

export function isZordUpCost(powerCost: number | string): boolean {
  return typeof powerCost === "string" && powerCost.endsWith("+");
}

export function getZordCondition(cardId: string): ZordConditionId | undefined {
  return (
    ZORD_CONDITIONS[cardId] ??
    resolveRushAdditionalCondition(cardId)?.conditionId
  );
}

/** All zord-up units with a resolved additional condition (all expansions). */
export function listZordUpCardIds(): string[] {
  return allCardsCatalog.cards
    .filter(
      (card) =>
        card.type === "unit" &&
        isZordUpCost(card.powerCost) &&
        getZordCondition(card.id) !== undefined,
    )
    .map((card) => card.id)
    .sort();
}

export function isFusionUnit(cardId: string): boolean {
  return FUSION_UNIT_IDS.has(cardId);
}

/** Whether `materialCardId` can be discarded for this zord-up rush. */
export function isValidZordFusionMaterial(
  zordCardId: string,
  materialCardId: string,
): boolean {
  const partners = listZordFusionPartnerIds(zordCardId);
  if (partners.length > 0) {
    return partners.includes(materialCardId);
  }
  return isFusionUnit(materialCardId);
}

/** Whether destroying this card should return fusion partners from discard. */
export function requiresFusionPartnerReturn(cardId: string): boolean {
  return getZordCondition(cardId) === "discard_fusion_unit";
}

/** How many fusion partners to return after the zord is discarded. */
export function fusionPartnerReturnCount(cardId: string): number {
  const partners = listZordFusionPartnerIds(cardId);
  return partners.length > 0 ? partners.length : 1;
}
