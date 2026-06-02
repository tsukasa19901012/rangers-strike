import type { CardDefinition } from "@rangers-strike/cards";
import {
  getZordCondition,
  isValidZordFusionMaterial,
  isZordUpCost,
  listZordFusionPartnerIds,
} from "@rangers-strike/cards";
import type { CardInstance, PlayerState } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { findInZone, removeAt } from "../core/helpers";

/** Zones where zord-up materials may be taken (field only, not hand). */
export type ZordMaterialZone = "rush" | "battle";

const ZORD_MATERIAL_ZONES: ZordMaterialZone[] = ["rush", "battle"];

export function needsZordMaterial(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || !isZordUpCost(def.powerCost)) return false;
  return getZordCondition(cardId) !== undefined;
}

/** Zords with a 合体― line require every listed partner on field. */
export function requiresAllFusionPartners(rushingCardId: string): boolean {
  return listZordFusionPartnerIds(rushingCardId).length > 0;
}

function findPartnerInstance(
  player: PlayerState,
  partnerCardId: string,
  rushingInstanceId: string,
): { zone: ZordMaterialZone; index: number; card: CardInstance } | null {
  for (const zone of ZORD_MATERIAL_ZONES) {
    for (let index = 0; index < player[zone].length; index++) {
      const card = player[zone][index]!;
      if (card.instanceId === rushingInstanceId) continue;
      if (card.cardId === partnerCardId) {
        return { zone, index, card };
      }
    }
  }
  return null;
}

/** All fusion partners listed on the zord card (e.g. RS-050 → 051/052/053). */
export function collectRequiredFusionMaterials(
  player: PlayerState,
  rushingCardId: string,
  rushingInstanceId: string,
): Array<{ zone: ZordMaterialZone; index: number; card: CardInstance }> | null {
  const partners = listZordFusionPartnerIds(rushingCardId);
  if (partners.length === 0) return null;

  const found: Array<{ zone: ZordMaterialZone; index: number; card: CardInstance }> = [];
  const usedInstanceIds = new Set<string>();

  for (const partnerId of partners) {
    const match = findPartnerInstance(player, partnerId, rushingInstanceId);
    if (!match || usedInstanceIds.has(match.card.instanceId)) return null;
    usedInstanceIds.add(match.card.instanceId);
    found.push(match);
  }

  return found;
}

export function hasAllRequiredFusionMaterials(
  player: PlayerState,
  rushingCardId: string,
  rushingInstanceId: string,
): boolean {
  return collectRequiredFusionMaterials(player, rushingCardId, rushingInstanceId) !== null;
}

export function applyAllZordFusionMaterials(
  player: PlayerState,
  rushingCardId: string,
  rushingInstanceId: string,
): PlayerState | null {
  const materials = collectRequiredFusionMaterials(
    player,
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
  return isValidZordFusionMaterial(rushingCardId, card.cardId);
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
  const condition = getZordCondition(rushingCardId);
  if (!condition) return [];

  const candidates: CardInstance[] = [];

  for (const zone of ZORD_MATERIAL_ZONES) {
    for (const card of player[zone]) {
      if (condition === "discard_fusion_unit") {
        if (isValidFusionMaterial(definitions, rushingCardId, card, rushingInstanceId)) {
          candidates.push(card);
        }
      } else if (condition === "send_s_unit_to_power") {
        if (isValidPowerMaterial(definitions, card, rushingInstanceId)) {
          candidates.push(card);
        }
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
  const condition = getZordCondition(rushingCardId);
  if (!condition) return null;

  for (const zone of ZORD_MATERIAL_ZONES) {
    const found = findInZone(player, zone, materialInstanceId);
    if (!found) continue;

    if (condition === "discard_fusion_unit") {
      if (!isValidFusionMaterial(definitions, rushingCardId, found.card, rushingInstanceId)) {
        continue;
      }
    } else if (!isValidPowerMaterial(definitions, found.card, rushingInstanceId)) {
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
): PlayerState | null {
  const material = findZordMaterial(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    materialInstanceId,
  );
  if (!material) return null;

  const condition = getZordCondition(rushingCardId);
  if (!condition) return null;

  const [, zoneCards] = removeAt(player[material.zone], material.index);
  let nextPlayer: PlayerState = { ...player, [material.zone]: zoneCards };

  if (condition === "discard_fusion_unit") {
    nextPlayer = {
      ...nextPlayer,
      discard: [...nextPlayer.discard, material.card],
    };
  } else {
    nextPlayer = {
      ...nextPlayer,
      power: [...nextPlayer.power, { ...material.card, faceDown: false }],
    };
  }

  return nextPlayer;
}
