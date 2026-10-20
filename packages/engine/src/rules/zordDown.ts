import type { CardDefinition } from "@rangers-strike/cards";
import {
  FUSION_UNIT_IDS,
  getZordDownCondition,
  hasPowerCostMinusSuffix,
  isZordDownCost,
  needsZordDownPayment,
  printedPowerCostNumber,
} from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import type { ZordMaterialDestination } from "../types/actions";

export type ZordDownRushVariant = {
  zordMaterialInstanceId?: string;
  zordMaterialInstanceIds?: string[];
  zordMaterialDestination?: ZordMaterialDestination;
};

function combinations<T>(items: T[], count: number): T[][] {
  if (count <= 0 || items.length < count) return [];
  if (count === 1) return items.map((item) => [item]);
  const results: T[][] = [];
  for (let i = 0; i <= items.length - count; i += 1) {
    const head = items[i]!;
    for (const tail of combinations(items.slice(i + 1), count - 1)) {
      results.push([head, ...tail]);
    }
  }
  return results;
}
import type { CardInstance, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import { findInZone, removeAt } from "../core/helpers";
import { getDefinition } from "../core/catalog";
import { rk11IsHandSubstitute } from "./rk/rk11Fields";
import { collectRequiredFusionMaterials } from "./zord";
import { resolveZordFusionPartnerIds } from "../dsl/zordBridge";

/** ゾードダウン素材を取れるゾーン（手札・捨札・フィールド）。 */
export type ZordDownMaterialZone = "hand" | "discard" | "rush" | "battle";

const ZORD_DOWN_MATERIAL_ZONES: ZordDownMaterialZone[] = [
  "hand",
  "discard",
  "rush",
  "battle",
];

export { needsZordDownPayment };

function normalizeName(value: string): string {
  return value.replace(/\s/g, "");
}

function matchesPartnerName(def: CardDefinition | undefined, partnerName: string): boolean {
  if (!def) return false;
  const target = normalizeName(partnerName);
  return normalizeName(def.name).includes(target);
}

function isValidZordDownFusionMaterial(cardId: string): boolean {
  return FUSION_UNIT_IDS.has(cardId);
}

/**
 * 「自軍合体ユニットを捨札にすれば必要パワー0になる」で、合体―行があるカードの素材（表記された合体ユニットすべて）。
 * 合体―行がなければ undefined、そろわなければ null。
 */
function requiredFusionDownMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
) {
  if (resolveZordFusionPartnerIds(rushingCardId).length === 0) return undefined;
  return collectRequiredFusionMaterials(player, definitions, rushingCardId, rushingInstanceId);
}

export function isValidZordDownMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  card: CardInstance,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  if (!condition) return false;

  const def = getDefinition(definitions, card.cardId);
  if (!def || def.type !== "unit") return false;

  // RK-217 イーグルアンデッド・RK-218 ピーコックアンデッドの※: 手札のこれを捨札にすれば、指定の名前のユニットを捨札にしたことにできる（rules/rk/rk11Fields.ts）。
  if (condition.conditionId === "zord_down_discard_named" && rk11IsHandSubstitute({ definitions }, player.hand, card, rushingCardId)) return true;

  switch (condition.conditionId) {
    case "zord_down_discard_fusion": {
      // 合体―行があれば、表記された合体ユニットすべてが素材（XP-008 NEW電王VF「合体―仮面ライダーNEW電王SF＋デネブ」・XG2-086）。
      const required = requiredFusionDownMaterials(player, definitions, rushingCardId, rushingInstanceId);
      if (required !== undefined) return required !== null && required.some((m) => m.card.instanceId === card.instanceId);
      return isValidZordDownFusionMaterial(card.cardId);
    }
    case "zord_down_discard_named":
    case "zord_down_send_to_power":
    case "zord_down_send_to_command_or_discard":
      return condition.partnerName
        ? matchesPartnerName(def, condition.partnerName)
        : false;
    case "zord_down_discard_feature":
      return condition.requiredFeature
        ? (def.features ?? []).includes(condition.requiredFeature)
        : false;
    case "zord_down_discard_power_cards": {
      const minCost = condition.minPrintedPowerCost ?? 0;
      const found = findInZone(player, "power", card.instanceId);
      if (!found) return false;
      const def = getDefinition(definitions, found.card.cardId);
      return printedPowerCostNumber(def?.powerCost) >= minCost;
    }
    default:
      return false;
  }
}

export function collectZordDownMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): CardInstance[] {
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  if (!condition) return [];

  if (condition.conditionId === "zord_down_discard_power_cards") {
    return [];
  }

  const candidates: CardInstance[] = [];
  for (const zone of ZORD_DOWN_MATERIAL_ZONES) {
    for (const card of player[zone]) {
      if (
        isValidZordDownMaterial(player, definitions, rushingCardId, rushingInstanceId, card)
      ) {
        candidates.push(card);
      }
    }
  }
  return candidates;
}

export function findZordDownMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
): { zone: ZordDownMaterialZone; index: number; card: CardInstance } | null {
  for (const zone of ZORD_DOWN_MATERIAL_ZONES) {
    const found = findInZone(player, zone, materialInstanceId);
    if (!found) continue;
    if (
      !isValidZordDownMaterial(
        player,
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

export function needsZordDownDestinationChoice(
  rushingCardId: string,
  definitions: Record<string, CardDefinition>,
  commandZoneHasSpace: boolean,
): boolean {
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  return (
    condition?.conditionId === "zord_down_send_to_command_or_discard" &&
    commandZoneHasSpace
  );
}

export function validateZordDownPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId?: string,
  materialDestination?: ZordMaterialDestination,
  materialInstanceIds?: string[],
): boolean {
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  if (!condition) return false;

  const multiIds =
    materialInstanceIds ?? (materialInstanceId ? [materialInstanceId] : []);
  const neededCount = condition.unitCount ?? 1;
  if (multiIds.length > 1 || (neededCount > 1 && multiIds.length > 0)) {
    if (multiIds.length !== neededCount) return false;
    const used = new Set<string>();
    for (const id of multiIds) {
      if (used.has(id)) return false;
      const material = findZordDownMaterial(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        id,
      );
      if (!material) return false;
      used.add(id);
    }
    return true;
  }

  if (condition.conditionId === "zord_down_discard_power_cards") {
    const needed = condition.unitCount ?? 1;
    const ids = materialInstanceIds ?? (materialInstanceId ? [materialInstanceId] : []);
    if (ids.length !== needed) return false;
    const minCost = condition.minPrintedPowerCost ?? 0;
    const used = new Set<string>();
    for (const id of ids) {
      if (used.has(id)) return false;
      const found = findInZone(player, "power", id);
      if (!found) return false;
      const def = getDefinition(definitions, found.card.cardId);
      if (printedPowerCostNumber(def?.powerCost) < minCost) return false;
      used.add(id);
    }
    return true;
  }

  if (!materialInstanceId) return false;
  const material = findZordDownMaterial(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    materialInstanceId,
  );
  if (!material) return false;

  if (condition.conditionId === "zord_down_send_to_command_or_discard") {
    if (materialDestination === "command") {
      return player.command.length < COMMAND_ZONE_MAX;
    }
    if (materialDestination === "discard") return true;
    return player.command.length >= COMMAND_ZONE_MAX;
  }

  return true;
}

export function applyZordDownMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
  destination?: ZordMaterialDestination,
): PlayerState | null {
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  if (!condition) return null;

  const material = findZordDownMaterial(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    materialInstanceId,
  );
  if (!material) return null;

  if (condition.conditionId === "zord_down_discard_fusion") {
    const required = requiredFusionDownMaterials(player, definitions, rushingCardId, rushingInstanceId);
    if (required === null) return null;
    if (required) {
      let next: PlayerState = player;
      for (const m of required) next = { ...next, [m.zone]: next[m.zone].filter((c) => c.instanceId !== m.card.instanceId) };
      return { ...next, discard: [...next.discard, ...required.map((m) => m.card)] };
    }
  }

  const [, zoneCards] = removeAt(player[material.zone], material.index);
  let nextPlayer: PlayerState = { ...player, [material.zone]: zoneCards };

  switch (condition.conditionId) {
    case "zord_down_discard_fusion":
    case "zord_down_discard_named":
    case "zord_down_discard_feature":
      return {
        ...nextPlayer,
        discard: [...nextPlayer.discard, material.card],
      };
    case "zord_down_send_to_power":
      return {
        ...nextPlayer,
        power: [...nextPlayer.power, { ...material.card, faceDown: false }],
      };
    case "zord_down_send_to_command_or_discard":
      if (destination === "command") {
        if (nextPlayer.command.length >= COMMAND_ZONE_MAX) return null;
        return {
          ...nextPlayer,
          command: [
            ...nextPlayer.command,
            { ...material.card, commandHeld: false },
          ],
        };
      }
      return {
        ...nextPlayer,
        discard: [...nextPlayer.discard, material.card],
      };
    default:
      return null;
  }
}

export function applyZordDownPowerMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  materialInstanceIds: string[],
): PlayerState | null {
  const condition = getZordDownCondition(rushingCardId, getDefinition(definitions, rushingCardId));
  if (condition?.conditionId !== "zord_down_discard_power_cards") return null;

  let nextPlayer = player;
  const toDiscard: CardInstance[] = [];

  for (const id of materialInstanceIds) {
    const found = findInZone(nextPlayer, "power", id);
    if (!found) return null;
    const def = getDefinition(definitions, found.card.cardId);
    const minCost = condition.minPrintedPowerCost ?? 0;
    if (printedPowerCostNumber(def?.powerCost) < minCost) return null;
    const [, remaining] = removeAt(nextPlayer.power, found.index);
    toDiscard.push(found.card);
    nextPlayer = { ...nextPlayer, power: remaining };
  }

  return {
    ...nextPlayer,
    discard: [...nextPlayer.discard, ...toDiscard],
  };
}

export function defenderHasPowerCostMinus(
  state: GameState,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
  defenderZone: "battle" | "rush",
): boolean {
  const defender = findInZone(
    state.players[defenderPlayerId],
    defenderZone,
    defenderInstanceId,
  );
  if (!defender) return false;
  const def = getDefinition(state.definitions, defender.card.cardId);
  return hasPowerCostMinusSuffix(def?.powerCost);
}

export function listZordDownRushPaymentVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): ZordDownRushVariant[] {
  const rushingDef = getDefinition(definitions, rushingCardId);
  const condition = getZordDownCondition(rushingCardId, rushingDef);
  if (!condition) return [];

  if (condition.conditionId === "zord_down_discard_power_cards") {
    const minCost = condition.minPrintedPowerCost ?? 0;
    const needed = condition.unitCount ?? 1;
    const eligible = player.power
      .filter((card) => {
        const def = getDefinition(definitions, card.cardId);
        return printedPowerCostNumber(def?.powerCost) >= minCost;
      })
      .map((card) => card.instanceId);
    return combinations(eligible, needed).map((zordMaterialInstanceIds) => ({
      zordMaterialInstanceIds,
    }));
  }

  const materials = collectZordDownMaterials(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
  );
  const needed = condition.unitCount ?? 1;
  const commandZoneHasSpace = player.command.length < COMMAND_ZONE_MAX;
  const needsDestination = needsZordDownDestinationChoice(
    rushingCardId,
    definitions,
    commandZoneHasSpace,
  );
  const variants: ZordDownRushVariant[] = [];
  const materialSets =
    needed > 1
      ? combinations(materials, needed)
      : materials.map((material) => [material]);

  for (const set of materialSets) {
    if (set.length === 1) {
      const material = set[0]!;
      if (needsDestination) {
        variants.push({
          zordMaterialInstanceId: material.instanceId,
          zordMaterialDestination: "discard",
        });
        if (commandZoneHasSpace) {
          variants.push({
            zordMaterialInstanceId: material.instanceId,
            zordMaterialDestination: "command",
          });
        }
        continue;
      }
      variants.push({ zordMaterialInstanceId: material.instanceId });
      continue;
    }
    variants.push({
      zordMaterialInstanceIds: set.map((card) => card.instanceId),
    });
  }

  return variants;
}

export function applyMultipleZordDownMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceIds: string[],
  destination?: ZordMaterialDestination,
): PlayerState | null {
  let nextPlayer = player;
  for (const materialId of materialInstanceIds) {
    const applied = applyZordDownMaterial(
      nextPlayer,
      definitions,
      rushingCardId,
      rushingInstanceId,
      materialId,
      destination,
    );
    if (!applied) return null;
    nextPlayer = applied;
  }
  return nextPlayer;
}

export function usesZordDownZeroCost(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  zordMaterialInstanceId?: string,
  zordMaterialInstanceIds?: string[],
): boolean {
  const def = getDefinition(definitions, cardId);
  if (!def || !isZordDownCost(def.powerCost)) return false;
  return Boolean(zordMaterialInstanceId || (zordMaterialInstanceIds?.length ?? 0) > 0);
}
