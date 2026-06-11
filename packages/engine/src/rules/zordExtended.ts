import type { CardDefinition, RushAdditionalCondition, ZordConditionId } from "@rangers-strike/cards";
import {
  cardHasCategory,
  isExtendedZordMaterialCondition,
  isSendSUnitZordCondition,
  resolveRushAdditionalCondition,
} from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  getDefinition,
  isLargeUnit,
  isOperation,
  isSmallUnit,
  isUnit,
} from "../core/catalog";
import { findInZone, opponent, performDeckDraws, removeAt } from "../core/helpers";
import {
  applyZordMaterial,
  collectZordMaterials,
  findZordMaterial,
  isValidZordUpMaterial,
} from "./zord";

export type ExtendedZordZone =
  | "hand"
  | "command"
  | "operation"
  | "power"
  | "rush"
  | "battle";

const FIELD_ZONES: ExtendedZordZone[] = ["rush", "battle"];

function normalizeName(value: string): string {
  return value.replace(/\s/g, "");
}

function matchesPartnerName(def: CardDefinition | undefined, partnerName: string): boolean {
  if (!def) return false;
  return normalizeName(def.name).includes(normalizeName(partnerName));
}

function resolveCondition(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): RushAdditionalCondition | undefined {
  const def = getDefinition(definitions, rushingCardId);
  return resolveRushAdditionalCondition(rushingCardId, def);
}

export function isStateGateCondition(conditionId: ZordConditionId): boolean {
  return conditionId === "state_gate";
}

export function isHoldExtraCommandCondition(conditionId: ZordConditionId): boolean {
  return conditionId === "hold_extra_command";
}

export function isOpponentDrawCondition(conditionId: ZordConditionId): boolean {
  return conditionId === "opponent_draw";
}

export function needsZordExtendedMaterial(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const condition = resolveCondition(definitions, cardId);
  return Boolean(condition && isExtendedZordMaterialCondition(condition.conditionId));
}

export function needsZordStateGate(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const condition = resolveCondition(definitions, cardId);
  return Boolean(condition && isStateGateCondition(condition.conditionId));
}

export function needsHoldExtraCommand(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const condition = resolveCondition(definitions, cardId);
  return Boolean(condition && isHoldExtraCommandCondition(condition.conditionId));
}

export function needsOpponentDrawCost(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const condition = resolveCondition(definitions, cardId);
  return Boolean(condition && isOpponentDrawCondition(condition.conditionId));
}

function selfFieldCards(player: PlayerState): CardInstance[] {
  return [
    ...player.rush,
    ...player.battle,
    ...player.command,
    ...player.power,
    ...player.operation,
  ];
}

function countFieldUnits(state: GameState): number {
  let count = 0;
  for (const player of Object.values(state.players)) {
    for (const zone of ["rush", "battle"] as const) {
      for (const card of player[zone]) {
        const def = getDefinition(state.definitions, card.cardId);
        if (def && isUnit(def)) count += 1;
      }
    }
  }
  return count;
}

function hasSelfCardNamed(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  name: string,
): boolean {
  return selfFieldCards(player).some((card) =>
    matchesPartnerName(getDefinition(definitions, card.cardId), name),
  );
}

function hasSelfUnitWithFeature(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  feature: string,
  size?: "S",
): boolean {
  for (const zone of FIELD_ZONES) {
    for (const card of player[zone]) {
      const def = getDefinition(definitions, card.cardId);
      if (!def || !isUnit(def)) continue;
      if (size === "S" && !isSmallUnit(definitions, card.cardId)) continue;
      if ((def.features ?? []).includes(feature)) return true;
    }
  }
  return false;
}

function hasSelfCommandWithFeature(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  features: string[],
): boolean {
  return player.command.some((card) => {
    const def = getDefinition(definitions, card.cardId);
    if (!def || !isOperation(def)) return false;
    return features.some((feature) => (def.features ?? []).includes(feature));
  });
}

function hasOpponentUnitWithFeature(
  state: GameState,
  playerId: PlayerId,
  feature: string,
): boolean {
  const opp = state.players[opponent(playerId)];
  for (const zone of FIELD_ZONES) {
    for (const card of opp[zone]) {
      const def = getDefinition(state.definitions, card.cardId);
      if (!def || !isUnit(def)) continue;
      if ((def.features ?? []).includes(feature)) return true;
    }
  }
  return false;
}

function hasSelfUnitNameContains(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  parts: string[],
): boolean {
  for (const zone of FIELD_ZONES) {
    for (const card of player[zone]) {
      const def = getDefinition(definitions, card.cardId);
      if (!def || !isUnit(def)) continue;
      const name = normalizeName(def.name);
      if (parts.some((part) => name.includes(normalizeName(part)))) return true;
    }
  }
  return false;
}

function hasSelfUnitOrCommandWithFeature(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  feature: string,
): boolean {
  return (
    hasSelfUnitWithFeature(player, definitions, feature) ||
    hasSelfCommandWithFeature(player, definitions, [feature])
  );
}

/** state_gate 追加条件の状態チェック（素材支払い不要）。 */
export function evaluateStateGate(
  state: GameState,
  playerId: PlayerId,
  condition: RushAdditionalCondition,
): boolean {
  const text = condition.text;
  const player = state.players[playerId];

  const unitCountMatch = text.match(/ユニットが(\d+)体以上ある/);
  if (unitCountMatch) {
    return countFieldUnits(state) >= Number(unitCountMatch[1]);
  }

  const discardTotalMatch = text.match(/捨札の合計が(\d+)枚以上ある/);
  if (discardTotalMatch) {
    const total =
      state.players.player1.discard.length + state.players.player2.discard.length;
    return total >= Number(discardTotalMatch[1]);
  }

  const namedAreaMatch = text.match(/自軍エリアに[「｢]([^」｣]+)[」｣]がある/);
  if (namedAreaMatch) {
    return hasSelfCardNamed(player, state.definitions, namedAreaMatch[1]!);
  }

  const featureSUnitMatch = text.match(/特徴[「｢]([^」｣]+)[」｣]を持つ自軍Sユニットがある/);
  if (featureSUnitMatch) {
    return hasSelfUnitWithFeature(
      player,
      state.definitions,
      featureSUnitMatch[1]!,
      "S",
    );
  }

  const featureUnitOrCommandMatch = text.match(
    /特徴[「｢]([^」｣]+)[」｣]を持つ、自軍ユニットまたは自軍コマンドがある/,
  );
  if (featureUnitOrCommandMatch) {
    return hasSelfUnitOrCommandWithFeature(
      player,
      state.definitions,
      featureUnitOrCommandMatch[1]!,
    );
  }

  const featureCommandOrMatch = text.match(
    /特徴[「｢]([^」｣]+)[」｣](?:または[「｢]([^」｣]+)[」｣])?を持つ自軍コマンドがある/,
  );
  if (featureCommandOrMatch) {
    const features = [featureCommandOrMatch[1]!, featureCommandOrMatch[2]].filter(
      Boolean,
    ) as string[];
    return hasSelfCommandWithFeature(player, state.definitions, features);
  }

  const featureUnitMatch = text.match(/特徴[「｢]([^」｣]+)[」｣]を持つ自軍ユニットがある/);
  if (featureUnitMatch) {
    return hasSelfUnitWithFeature(player, state.definitions, featureUnitMatch[1]!);
  }

  const enemyFeatureMatch = text.match(/特徴[「｢]([^」｣]+)[」｣]を持つ敵軍ユニットがある/);
  if (enemyFeatureMatch) {
    return hasOpponentUnitWithFeature(state, playerId, enemyFeatureMatch[1]!);
  }

  const nameContainsMatch = text.match(
    /カード名に[「｢]([^」｣]+)[」｣](?:または[「｢]([^」｣]+)[」｣])?を含む自軍ユニットがある/,
  );
  if (nameContainsMatch) {
    const parts = [nameContainsMatch[1]!, nameContainsMatch[2]].filter(Boolean) as string[];
    return hasSelfUnitNameContains(player, state.definitions, parts);
  }

  const looseNamed = text.match(/[「｢]([^」｣]+)[」｣]/)?.[1];
  if (looseNamed && text.includes("がある")) {
    return hasSelfCardNamed(player, state.definitions, looseNamed);
  }

  return false;
}

function isValidCategoryLUnit(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  requiredCategory?: string,
): boolean {
  const def = getDefinition(definitions, card.cardId);
  if (!def || !isLargeUnit(definitions, card.cardId)) return false;
  if (!requiredCategory) return true;
  if (cardHasCategory(def, requiredCategory as never)) return true;
  return normalizeName(requiredCategory).length > 0;
}

export function isValidExtendedZordMaterial(
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  zone: ExtendedZordZone,
  card: CardInstance,
): boolean {
  if (card.instanceId === rushingInstanceId) return false;
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || !isExtendedZordMaterialCondition(condition.conditionId)) return false;

  const def = getDefinition(definitions, card.cardId);
  if (!def) return false;

  switch (condition.conditionId) {
    case "discard_command_card":
      return zone === "command" || (zone === "hand" && isOperation(def));
    case "discard_hand_card":
      return zone === "hand";
    case "discard_all_hand":
      return zone === "hand";
    case "discard_generic_unit":
      return (zone === "rush" || zone === "battle") && isUnit(def);
    case "discard_all_face_up_power":
      return zone === "power" && !card.faceDown;
    case "discard_operation_cards":
      return zone === "operation";
    case "discard_category_l_unit":
      return (
        (zone === "rush" || zone === "battle") &&
        isValidCategoryLUnit(definitions, card, condition.requiredCategory)
      );
    case "return_named_to_hand":
      return (
        (zone === "rush" || zone === "battle") &&
        !!condition.partnerName &&
        matchesPartnerName(def, condition.partnerName)
      );
    default:
      return false;
  }
}

export function collectExtendedZordMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): Array<{ zone: ExtendedZordZone; card: CardInstance }> {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || !isExtendedZordMaterialCondition(condition.conditionId)) return [];

  if (condition.conditionId === "discard_all_hand") {
    return player.hand
      .filter((card) => card.instanceId !== rushingInstanceId)
      .map((card) => ({ zone: "hand" as const, card }));
  }

  if (condition.conditionId === "discard_all_face_up_power") {
    return player.power
      .filter((card) => !card.faceDown)
      .map((card) => ({ zone: "power" as const, card }));
  }

  const zones: ExtendedZordZone[] = ["hand", "command", "operation", "power", "rush", "battle"];
  const found: Array<{ zone: ExtendedZordZone; card: CardInstance }> = [];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (
        isValidExtendedZordMaterial(
          definitions,
          rushingCardId,
          rushingInstanceId,
          zone,
          card,
        )
      ) {
        found.push({ zone, card });
      }
    }
  }
  return found;
}

function combinations<T>(items: T[], count: number): T[][] {
  if (count <= 0) return [[]];
  if (count > items.length) return [];
  if (count === 1) return items.map((item) => [item]);
  const result: T[][] = [];
  for (let i = 0; i <= items.length - count; i += 1) {
    for (const rest of combinations(items.slice(i + 1), count - 1)) {
      result.push([items[i]!, ...rest]);
    }
  }
  return result;
}

export type ExtendedZordVariant = {
  zordMaterialInstanceIds?: string[];
};

export function listExtendedZordRushVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
): ExtendedZordVariant[] {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || !isExtendedZordMaterialCondition(condition.conditionId)) return [];

  const materials = collectExtendedZordMaterials(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
  );

  if (condition.conditionId === "discard_all_hand") {
    if (materials.length === 0) return [];
    return [{ zordMaterialInstanceIds: materials.map((m) => m.card.instanceId) }];
  }

  if (condition.conditionId === "discard_all_face_up_power") {
    if (materials.length === 0) return [];
    return [{ zordMaterialInstanceIds: materials.map((m) => m.card.instanceId) }];
  }

  const needed = condition.unitCount ?? 1;
  if (needed === 1) {
    return materials.map((material) => ({
      zordMaterialInstanceIds: [material.card.instanceId],
    }));
  }

  return combinations(materials, needed).map((set) => ({
    zordMaterialInstanceIds: set.map((entry) => entry.card.instanceId),
  }));
}

function findExtendedMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId: string,
): { zone: ExtendedZordZone; index: number; card: CardInstance } | null {
  const zones: ExtendedZordZone[] = ["hand", "command", "operation", "power", "rush", "battle"];
  for (const zone of zones) {
    const found = findInZone(player, zone, materialInstanceId);
    if (!found) continue;
    if (
      !isValidExtendedZordMaterial(
        definitions,
        rushingCardId,
        rushingInstanceId,
        zone,
        found.card,
      )
    ) {
      continue;
    }
    return { zone, index: found.index, card: found.card };
  }
  return null;
}

export function validateExtendedZordPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceIds: string[],
): boolean {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || !isExtendedZordMaterialCondition(condition.conditionId)) return false;

  if (condition.conditionId === "discard_all_hand") {
    const others = player.hand.filter((c) => c.instanceId !== rushingInstanceId);
    if (others.length === 0) return false;
    const ids = new Set(materialInstanceIds);
    return others.every((card) => ids.has(card.instanceId)) && ids.size === others.length;
  }

  if (condition.conditionId === "discard_all_face_up_power") {
    const faceUp = player.power.filter((c) => !c.faceDown);
    if (faceUp.length === 0) return false;
    const ids = new Set(materialInstanceIds);
    return faceUp.every((card) => ids.has(card.instanceId)) && ids.size === faceUp.length;
  }

  const needed = condition.unitCount ?? 1;
  if (materialInstanceIds.length !== needed) return false;
  const used = new Set<string>();
  for (const id of materialInstanceIds) {
    if (used.has(id)) return false;
    const material = findExtendedMaterial(
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

export function applyExtendedZordPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceIds: string[],
): PlayerState | null {
  if (
    !validateExtendedZordPayment(
      player,
      definitions,
      rushingCardId,
      rushingInstanceId,
      materialInstanceIds,
    )
  ) {
    return null;
  }

  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition) return null;

  let nextPlayer = player;
  for (const materialId of materialInstanceIds) {
    const material = findExtendedMaterial(
      nextPlayer,
      definitions,
      rushingCardId,
      rushingInstanceId,
      materialId,
    );
    if (!material) return null;

    const [, zoneCards] = removeAt(nextPlayer[material.zone], material.index);
    nextPlayer = { ...nextPlayer, [material.zone]: zoneCards };

    if (condition.conditionId === "return_named_to_hand") {
      nextPlayer = {
        ...nextPlayer,
        hand: [...nextPlayer.hand, material.card],
      };
    } else {
      nextPlayer = {
        ...nextPlayer,
        discard: [...nextPlayer.discard, material.card],
      };
    }
  }

  return nextPlayer;
}

export function collectHoldExtraCommandCandidates(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
): CardInstance[] {
  return player.command.filter((card) => {
    if (card.commandHeld) return false;
    const def = getDefinition(definitions, card.cardId);
    return def !== undefined && isOperation(def);
  });
}

export function validateHoldExtraCommandPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  holdInstanceIds: string[],
): boolean {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || condition.conditionId !== "hold_extra_command") return false;
  const needed = condition.unitCount ?? 1;
  if (holdInstanceIds.length !== needed) return false;
  const used = new Set<string>();
  for (const id of holdInstanceIds) {
    if (used.has(id)) return false;
    const card = player.command.find((c) => c.instanceId === id);
    if (!card || card.commandHeld) return false;
    const def = getDefinition(definitions, card.cardId);
    if (!def || !isOperation(def)) return false;
    used.add(id);
  }
  return true;
}

export function applyHoldExtraCommandPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  holdInstanceIds: string[],
): PlayerState | null {
  if (!validateHoldExtraCommandPayment(player, definitions, rushingCardId, holdInstanceIds)) {
    return null;
  }
  let nextCommand = [...player.command];
  for (const id of holdInstanceIds) {
    const index = nextCommand.findIndex((c) => c.instanceId === id);
    if (index < 0) return null;
    nextCommand[index] = { ...nextCommand[index]!, commandHeld: true };
  }
  return { ...player, command: nextCommand };
}

export function listHoldExtraCommandVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): Array<{ zordExtraCommandHoldInstanceIds: string[] }> {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || condition.conditionId !== "hold_extra_command") return [];
  const needed = condition.unitCount ?? 1;
  const candidates = collectHoldExtraCommandCandidates(player, definitions);
  return combinations(candidates, needed).map((set) => ({
    zordExtraCommandHoldInstanceIds: set.map((card) => card.instanceId),
  }));
}

export function applyOpponentDrawCost(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const oppId = opponent(playerId);
  const opp = state.players[oppId];
  const afterDraw = performDeckDraws(opp, 1, "top");
  return {
    ...state,
    players: {
      ...state.players,
      [oppId]: afterDraw,
    },
  };
}

export function validateFieldZordMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceIds: string[],
  materialDestination?: ZordMaterialDestination,
): boolean {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition || !isSendSUnitZordCondition(condition.conditionId)) {
    if (condition && isExtendedZordMaterialCondition(condition.conditionId)) {
      return validateExtendedZordPayment(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        materialInstanceIds,
      );
    }
    return materialInstanceIds.length === 1
      ? findZordMaterial(
          player,
          definitions,
          rushingCardId,
          rushingInstanceId,
          materialInstanceIds[0]!,
        ) !== null
      : false;
  }

  const needed = condition.unitCount ?? 1;
  if (materialInstanceIds.length !== needed) return false;
  const used = new Set<string>();
  for (const id of materialInstanceIds) {
    if (used.has(id)) return false;
    const material = findZordMaterial(
      player,
      definitions,
      rushingCardId,
      rushingInstanceId,
      id,
    );
    if (!material) return false;
    if (!isValidZordUpMaterial(definitions, rushingCardId, rushingInstanceId, material.card)) {
      return false;
    }
    used.add(id);
  }

  if (
    condition.conditionId === "send_s_unit_to_command_or_discard" &&
    materialDestination === "command" &&
    player.command.length >= COMMAND_ZONE_MAX
  ) {
    return false;
  }

  return true;
}

export function applyMultipleFieldZordMaterials(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceIds: string[],
  destination?: ZordMaterialDestination,
): PlayerState | null {
  let nextPlayer = player;
  for (const materialId of materialInstanceIds) {
    const applied = applyZordMaterial(
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

export function listFieldZordRushVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  commandZoneHasSpace: boolean,
): Array<{
  zordMaterialInstanceId?: string;
  zordMaterialInstanceIds?: string[];
  zordMaterialDestination?: ZordMaterialDestination;
}> {
  const condition = resolveCondition(definitions, rushingCardId);
  if (!condition) return [];

  const materials = collectZordMaterials(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
  );
  const needed = condition.unitCount ?? 1;
  const variants: Array<{
    zordMaterialInstanceId?: string;
    zordMaterialInstanceIds?: string[];
    zordMaterialDestination?: ZordMaterialDestination;
  }> = [];

  const materialSets =
    needed > 1 ? combinations(materials, needed) : materials.map((m) => [m]);

  for (const set of materialSets) {
    if (condition.conditionId === "send_s_unit_to_command_or_discard") {
      const ids = set.map((c) => c.instanceId);
      const materialRef =
        set.length === 1
          ? { zordMaterialInstanceId: ids[0], zordMaterialInstanceIds: ids }
          : { zordMaterialInstanceIds: ids };
      variants.push({
        ...materialRef,
        zordMaterialDestination: "discard",
      });
      if (commandZoneHasSpace) {
        variants.push({
          ...materialRef,
          zordMaterialDestination: "command",
        });
      }
      continue;
    }
    if (set.length === 1) {
      variants.push({ zordMaterialInstanceId: set[0]!.instanceId });
    } else {
      variants.push({ zordMaterialInstanceIds: set.map((c) => c.instanceId) });
    }
  }

  return variants;
}

