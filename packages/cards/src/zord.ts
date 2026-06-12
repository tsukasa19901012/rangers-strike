import { allCardsCatalog } from "./catalog";
import type { RushAdditionalCondition, ZordConditionId } from "./effectTaxonomy";
import { isFusionMaterialForPartners } from "./fusionMaterial";
import type { CardDefinition } from "./schema";
import { isZordDownCost, isZordUpCost } from "./powerCost";

export { isZordDownCost, isZordUpCost } from "./powerCost";
export { hasPowerCostMinusSuffix, printedPowerCostNumber } from "./powerCost";
import { countZordFusionPartnerSlots } from "./pipeline/fusionPartners";
import {
  buildFusionPartnerIdSet,
  getUnitEffectBlock,
  listZordFusionPartnerIds,
} from "./unitEffects";

export type { RushAdditionalCondition, ZordConditionId };

/** レガシー zord-up マップ（Legend 1/2）。Legend 3+ は registry / CardDocument を使用。 */
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

/** いずれの 合体― 行にも載らないが、汎用捨札素材として有効な合体ユニット。 */
const LEGACY_EXTRA_FUSION_UNIT_IDS = ["RS-062"] as const;

/** registry の全 合体― パートナー一覧から導出（レガシー追加分含む）。 */
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
    conditionId === "send_s_unit_to_command_or_discard" ||
    conditionId === "send_s_units_to_zones"
  );
}

export const EXTENDED_ZORD_MATERIAL_CONDITIONS: ReadonlySet<ZordConditionId> = new Set([
  "return_named_to_hand",
  "discard_operation_cards",
  "discard_category_l_unit",
  "discard_command_card",
  "discard_all_hand",
  "discard_hand_card",
  "discard_generic_unit",
  "discard_all_face_up_power",
]);

export function isExtendedZordMaterialCondition(conditionId: ZordConditionId): boolean {
  return EXTENDED_ZORD_MATERIAL_CONDITIONS.has(conditionId);
}

export function isZordUpMaterialCondition(conditionId: ZordConditionId): boolean {
  return (
    conditionId === "discard_fusion_unit" ||
    conditionId === "discard_named_unit" ||
    conditionId === "discard_feature_unit" ||
    conditionId === "discard_vehicle_unit" ||
    conditionId === "discard_fusion_vehicle" ||
    conditionId === "discard_name_contains_unit" ||
    isSendSUnitZordCondition(conditionId) ||
    isExtendedZordMaterialCondition(conditionId)
  );
}

export function getRushAdditionalCondition(
  cardId: string,
): RushAdditionalCondition | undefined {
  const conditionId = ZORD_CONDITIONS[cardId];
  if (!conditionId) return undefined;
  return buildRushAdditionalCondition(conditionId);
}

/** registry / CardDocument を優先し、なければ ZORD_CONDITIONS のデフォルト。 */
export function resolveRushAdditionalCondition(
  cardId: string,
  card?: { rushAdditionalCondition?: RushAdditionalCondition },
): RushAdditionalCondition | undefined {
  const fromBlock = getUnitEffectBlock(cardId)?.rushAdditionalCondition;
  if (fromBlock) return fromBlock;
  if (card?.rushAdditionalCondition) return card.rushAdditionalCondition;
  return getRushAdditionalCondition(cardId);
}

export function getZordCondition(cardId: string): ZordConditionId | undefined {
  const legacy = ZORD_CONDITIONS[cardId];
  if (legacy) return legacy;
  const resolved = resolveRushAdditionalCondition(cardId);
  if (!resolved || resolved.conditionId.startsWith("zord_down_")) return undefined;
  return resolved.conditionId;
}

export function getZordDownCondition(
  cardId: string,
  card?: { rushAdditionalCondition?: RushAdditionalCondition },
): RushAdditionalCondition | undefined {
  const fromBlock = getUnitEffectBlock(cardId)?.rushAdditionalCondition;
  const candidate = fromBlock ?? card?.rushAdditionalCondition;
  if (!candidate || !candidate.conditionId.startsWith("zord_down_")) {
    return undefined;
  }
  return candidate;
}

export function needsZordDownPayment(
  cardId: string,
  powerCost: number | string,
  card?: { rushAdditionalCondition?: RushAdditionalCondition },
): boolean {
  if (!isZordDownCost(powerCost)) return false;
  return getZordDownCondition(cardId, card) !== undefined;
}

/** 追加条件が解決された zord-up ユニット一覧（全拡張）。 */
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

/** `materialCardId` をこの zord-up ラッシュの捨札素材にできるか。 */
export function isValidZordFusionMaterial(
  zordCardId: string,
  materialCardId: string,
  definitions?: Record<string, CardDefinition>,
): boolean {
  const partners = listZordFusionPartnerIds(zordCardId);
  if (partners.length > 0) {
    if (partners.includes(materialCardId)) return true;
    if (definitions) {
      const material = definitions[materialCardId];
      if (material) {
        return isFusionMaterialForPartners(material, partners, definitions);
      }
    }
    return false;
  }
  return isFusionUnit(materialCardId);
}

/** このカード破棄時に合体パートナーを捨札から戻すか。 */
export function requiresFusionPartnerReturn(cardId: string): boolean {
  return getZordCondition(cardId) === "discard_fusion_unit";
}

/** ゾード捨て後に戻す合体パートナーの枚数（合体―行の枠数。同名別収録は1枠）。 */
export function fusionPartnerReturnCount(cardId: string): number {
  const block = getUnitEffectBlock(cardId);
  const zord = block?.unnamedText.find((entry) => entry.kind === "zord");
  if (!zord?.text) return 1;
  const slots = countZordFusionPartnerSlots(zord.text);
  return slots > 0 ? slots : 1;
}
