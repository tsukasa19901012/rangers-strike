import type { CardDefinition } from "@rangers-strike/cards";
import {
  canonicalCardName,
  fusionMaterialAliasNames,
  getZordCondition,
  isExtendedZordMaterialCondition,
  isSendSUnitZordCondition,
  isValidZordFusionMaterial,
  isZordUpCost,
  resolveRushAdditionalCondition,
} from "@rangers-strike/cards";
import {
  resolveZordFusionPartnerIds,
  resolveZordFusionPartnerSlots,
} from "../dsl/zordBridge";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { findInZone, removeAt } from "../core/helpers";

/** ゾードアップ素材を取れるゾーン（フィールドのみ、手札不可）。 */
export type ZordMaterialZone = "rush" | "battle";

const ZORD_MATERIAL_ZONES: ZordMaterialZone[] = ["rush", "battle"];

const NON_FIELD_ZORD_UP_CONDITIONS = new Set([
  "state_gate",
  "hold_extra_command",
  "opponent_draw",
]);

export function needsZordMaterial(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || !isZordUpCost(def.powerCost)) return false;
  const resolved = resolveRushAdditionalCondition(cardId, def);
  const conditionId = resolved?.conditionId ?? getZordCondition(cardId);
  if (!conditionId || conditionId.startsWith("zord_down_")) return false;
  if (NON_FIELD_ZORD_UP_CONDITIONS.has(conditionId)) return false;
  if (isExtendedZordMaterialCondition(conditionId)) return false;
  return true;
}

/** 合体―行があるゾードは、列挙された全パートナーがフィールド上に必要。 */
export function requiresAllFusionPartners(rushingCardId: string): boolean {
  return resolveZordFusionPartnerIds(rushingCardId).length > 0;
}

function partnerNamesForId(
  definitions: Record<string, CardDefinition>,
  partnerCardId: string,
): Set<string> {
  const def = getDefinition(definitions, partnerCardId);
  const names = new Set<string>();
  if (!def) return names;
  names.add(canonicalCardName(def.name));
  for (const alias of fusionMaterialAliasNames(def.text)) {
    names.add(alias);
  }
  return names;
}

function fieldCardMatchesPartner(
  definitions: Record<string, CardDefinition>,
  fieldCard: CardInstance,
  partnerCardId: string,
): boolean {
  if (fieldCard.cardId === partnerCardId) return true;
  const fieldDef = getDefinition(definitions, fieldCard.cardId);
  if (!fieldDef) return false;
  const partnerNames = partnerNamesForId(definitions, partnerCardId);
  const fieldNames = new Set<string>([canonicalCardName(fieldDef.name)]);
  for (const alias of fusionMaterialAliasNames(fieldDef.text)) {
    fieldNames.add(alias);
  }
  for (const fieldName of fieldNames) {
    if (partnerNames.has(fieldName)) return true;
  }
  return false;
}

function findPartnerInstance(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  partnerCardId: string,
  rushingInstanceId: string,
): { zone: ZordMaterialZone; index: number; card: CardInstance } | null {
  for (const zone of ZORD_MATERIAL_ZONES) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId) continue;
      if (fieldCardMatchesPartner(definitions, card, partnerCardId)) {
        return { zone, index, card };
      }
    }
  }
  return null;
}

/** ゾードカードに列挙された全合体パートナー（例: RS-050 → 051/052/053）。 */
export function collectRequiredFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): Array<{ zone: ZordMaterialZone; index: number; card: CardInstance }> | null {
  const slots = resolveZordFusionPartnerSlots(rushingCardId);
  if (slots.length === 0) return null;

  const found: Array<{ zone: ZordMaterialZone; index: number; card: CardInstance }> = [];
  const usedInstanceIds = new Set<string>();

  for (const slot of slots) {
    let match: { zone: ZordMaterialZone; index: number; card: CardInstance } | null =
      null;
    for (const partnerId of slot) {
      const candidate = findPartnerInstance(
        player,
        definitions,
        partnerId,
        rushingInstanceId,
      );
      if (candidate && !usedInstanceIds.has(candidate.card.instanceId)) {
        match = candidate;
        break;
      }
    }
    if (!match) return null;
    usedInstanceIds.add(match.card.instanceId);
    found.push(match);
  }

  return found;
}

export function hasAllRequiredFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): boolean {
  return (
    collectRequiredFusionMaterials(
      player,
      definitions,
      rushingCardId,
      rushingInstanceId,
    ) !== null
  );
}

export function applyAllZordFusionMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): PlayerState | null {
  const materials = collectRequiredFusionMaterials(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
  );
  if (!materials) return null;

  let nextPlayer = player;
  const toDiscard: CardInstance[] = [];

  for (const material of materials) {
    const zoneCards = [...nextPlayer[material.zone]];
    const removeIndex = zoneCards.findIndex(
      (c) => c.instanceId === material.card.instanceId,
    );
    if (removeIndex < 0) return null;
    const [, remaining] = removeAt(zoneCards, removeIndex);
    toDiscard.push(material.card);
    nextPlayer = { ...nextPlayer, [material.zone]: remaining };
  }

  return {
    ...nextPlayer,
    discard: [...nextPlayer.discard, ...toDiscard],
  };
}

export function isValidFusionMaterial(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  card: CardInstance,
  rushingInstanceId: string,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  return isValidZordFusionMaterial(rushingCardId, card.cardId, definitions);
}

function normalizeName(value: string): string {
  return value.replace(/\s/g, "");
}

function matchesPartnerName(def: CardDefinition | undefined, partnerName: string): boolean {
  if (!def) return false;
  return normalizeName(def.name).includes(normalizeName(partnerName));
}

function resolveZordUpCondition(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
) {
  const def = getDefinition(definitions, rushingCardId);
  return resolveRushAdditionalCondition(rushingCardId, def);
}

export function isValidZordUpMaterial(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  card: CardInstance,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  const condition = resolveZordUpCondition(definitions, rushingCardId);
  if (!condition || condition.conditionId.startsWith("zord_down_")) {
    const legacy = getZordCondition(rushingCardId);
    if (legacy === "discard_fusion_unit") {
      return isValidFusionMaterial(definitions, rushingCardId, card, rushingInstanceId);
    }
    if (legacy && isSendSUnitZordCondition(legacy)) {
      return isValidPowerMaterial(definitions, card, rushingInstanceId);
    }
    return false;
  }

  const def = getDefinition(definitions, card.cardId);
  if (!def) return false;

  switch (condition.conditionId) {
    case "discard_fusion_unit":
      return isValidFusionMaterial(definitions, rushingCardId, card, rushingInstanceId);
    case "discard_fusion_vehicle":
      return (
        def.type === "vehicle" &&
        isValidZordFusionMaterial(rushingCardId, card.cardId, definitions)
      );
    case "discard_vehicle_unit":
      return def.type === "vehicle";
    case "discard_named_unit":
      return (
        def.type === "unit" &&
        !!condition.partnerName &&
        matchesPartnerName(def, condition.partnerName)
      );
    case "discard_feature_unit":
      return (
        def.type === "unit" &&
        !!condition.requiredFeature &&
        (def.features ?? []).includes(condition.requiredFeature) &&
        (!condition.requiredSize || def.size === condition.requiredSize)
      );
    case "discard_name_contains_unit":
      return (
        def.type === "unit" &&
        !!condition.nameContains &&
        normalizeName(def.name).includes(normalizeName(condition.nameContains))
      );
    case "discard_generic_unit":
      return def.type === "unit";
    case "send_s_units_to_zones":
      return isValidPowerMaterial(definitions, card, rushingInstanceId);
    default:
      if (isSendSUnitZordCondition(condition.conditionId)) {
        return isValidPowerMaterial(definitions, card, rushingInstanceId);
      }
      return false;
  }
}

export function isValidPowerMaterial(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  rushingInstanceId: string,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  return isSmallUnit(definitions, card.cardId);
}

export function collectZordMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): CardInstance[] {
  const resolved = resolveZordUpCondition(definitions, rushingCardId);
  const legacy = getZordCondition(rushingCardId);
  if (!resolved && !legacy) return [];

  const candidates: CardInstance[] = [];

  for (const zone of ZORD_MATERIAL_ZONES) {
    for (const card of player[zone]) {
      if (isValidZordUpMaterial(definitions, rushingCardId, rushingInstanceId, card)) {
        candidates.push(card);
      }
    }
  }

  return candidates;
}

export function findZordMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
): { zone: ZordMaterialZone; index: number; card: CardInstance } | null {
  if (!resolveZordUpCondition(definitions, rushingCardId) && !getZordCondition(rushingCardId)) {
    return null;
  }

  for (const zone of ZORD_MATERIAL_ZONES) {
    const found = findInZone(player, zone, materialInstanceId);
    if (!found) continue;
    if (
      !isValidZordUpMaterial(
        definitions,
        rushingCardId,
        rushingInstanceId,
        found.card,
      )
    ) {
      continue;
    }
    return { zone, index: found.index, card: found.card };
  }

  return null;
}

export function applyZordMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
  destination?: ZordMaterialDestination,
): PlayerState | null {
  const material = findZordMaterial(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    materialInstanceId,
  );
  if (!material) return null;

  const resolved = resolveZordUpCondition(definitions, rushingCardId);
  const conditionId = resolved?.conditionId ?? getZordCondition(rushingCardId);
  if (!conditionId) return null;

  const [, zoneCards] = removeAt(player[material.zone], material.index);
  let nextPlayer: PlayerState = { ...player, [material.zone]: zoneCards };

  if (
    conditionId === "discard_fusion_unit" ||
    conditionId === "discard_named_unit" ||
    conditionId === "discard_feature_unit" ||
    conditionId === "discard_vehicle_unit" ||
    conditionId === "discard_fusion_vehicle" ||
    conditionId === "discard_name_contains_unit"
  ) {
    nextPlayer = {
      ...nextPlayer,
      discard: [...nextPlayer.discard, material.card],
    };
  } else if (
    conditionId === "send_s_unit_to_discard" ||
    (conditionId === "send_s_unit_to_command_or_discard" && destination === "discard")
  ) {
    nextPlayer = {
      ...nextPlayer,
      discard: [...nextPlayer.discard, material.card],
    };
  } else if (conditionId === "send_s_unit_to_command_or_discard") {
    if (destination === "command") {
      if (nextPlayer.command.length >= COMMAND_ZONE_MAX) return null;
      nextPlayer = {
        ...nextPlayer,
        command: [
          ...nextPlayer.command,
          { ...material.card, commandHeld: false },
        ],
      };
    } else {
      return null;
    }
  } else {
    nextPlayer = {
      ...nextPlayer,
      power: [...nextPlayer.power, { ...material.card, faceDown: false }],
    };
  }

  return nextPlayer;
}
