import {
  cardHasCategory,
  jaguarMothershipAllowedWithMaterial,
  MOTHERSHIP_CONFIG,
  mothershipHoldsRequiredForRush,
  mothershipHoldCountForRush,
  mothershipKindForZordRush,
  zordSlotsFilledByMaterial,
  type MothershipKind,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { Category } from "@rangers-strike/cards";
import { getZordCondition, isSendSUnitZordCondition } from "@rangers-strike/cards";
import type { ZordMaterialDestination } from "../types/actions";
import type { CardInstance, PlayerState } from "../types/game";
import { getDefinition, isMediumUnit, isOperation } from "../core/catalog";
import { findZordMaterial } from "./zord";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { COMMAND_ZONE_MAX } from "../types/game";
import {
  evaluateStateGate,
  listExtendedZordRushVariants,
  listFieldZordRushVariants,
  listHoldExtraCommandVariants,
  validateFieldZordMaterials,
} from "./zordExtended";
import { collectZordMaterials, requiresAllFusionPartners } from "./zord";

export type MothershipHoldZone = "command" | "rush";

export function canUseMothershipForZordRush(
  definitions: Record<string, CardDefinition>,
  player: PlayerState,
  rushingCardId: string,
): MothershipKind | null {
  if (!isMediumUnit(definitions, rushingCardId)) return null;
  const rushIds = player.rush.map((c) => c.cardId);
  return mothershipKindForZordRush(rushingCardId, rushIds);
}

export function isMothershipEligibleCommand(
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  category: Category,
): boolean {
  if (card.commandHeld) return false;
  const def = getDefinition(definitions, card.cardId);
  return (
    def !== undefined &&
    isOperation(def) &&
    cardHasCategory(def, category)
  );
}

/** 未ホールドのカテゴリコマンド（コマンドまたはラッシュ内）（Q3: コマンドがラッシュへ移動）。 */
export function collectMothershipEligibleCommands(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  category: Category,
): Array<{ zone: MothershipHoldZone; card: CardInstance }> {
  const results: Array<{ zone: MothershipHoldZone; card: CardInstance }> = [];

  for (const card of player.command) {
    if (isMothershipEligibleCommand(definitions, card, category)) {
      results.push({ zone: "command", card });
    }
  }
  for (const card of player.rush) {
    if (isMothershipEligibleCommand(definitions, card, category)) {
      results.push({ zone: "rush", card });
    }
  }

  return results;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  if (size === 1) return items.map((item) => [item]);

  const sets: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    const head = items[i]!;
    for (const tail of combinations(items.slice(i + 1), size - 1)) {
      sets.push([head, ...tail]);
    }
  }
  return sets;
}

/** 合法ラッシュアクション用の指定枚数の異なるホールドセット。 */
export function listMothershipHoldSets(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  kind: MothershipKind,
  holdsRequired: number,
): string[][] {
  if (holdsRequired <= 0) return [[]];

  const category = MOTHERSHIP_CONFIG[kind].commandCategory;
  const eligible = collectMothershipEligibleCommands(player, definitions, category);
  if (eligible.length < holdsRequired) return [];

  return combinations(eligible, holdsRequired).map((entries) =>
    entries.map((entry) => entry.card.instanceId),
  );
}

export function applyMothershipHolds(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  holdInstanceIds: string[],
  kind: MothershipKind,
): PlayerState | null {
  const category = MOTHERSHIP_CONFIG[kind].commandCategory;
  if (holdInstanceIds.length === 0) return player;

  let nextPlayer = player;
  const used = new Set<string>();

  for (const instanceId of holdInstanceIds) {
    if (used.has(instanceId)) return null;
    used.add(instanceId);

    const commandIndex = nextPlayer.command.findIndex((c) => c.instanceId === instanceId);
    if (commandIndex >= 0) {
      const card = nextPlayer.command[commandIndex]!;
      if (card.mothershipHold) {
        continue;
      }
      if (!isMothershipEligibleCommand(definitions, card, category)) return null;
      const command = [...nextPlayer.command];
      command[commandIndex] = { ...card, commandHeld: true, mothershipHold: true };
      nextPlayer = { ...nextPlayer, command };
      continue;
    }

    const rushIndex = nextPlayer.rush.findIndex((c) => c.instanceId === instanceId);
    if (rushIndex >= 0) {
      const card = nextPlayer.rush[rushIndex]!;
      if (card.mothershipHold) {
        continue;
      }
      if (!isMothershipEligibleCommand(definitions, card, category)) return null;
      const rush = [...nextPlayer.rush];
      rush[rushIndex] = { ...card, commandHeld: true, mothershipHold: true };
      nextPlayer = { ...nextPlayer, rush };
      continue;
    }

    return null;
  }

  return nextPlayer;
}

export function validateMothershipHolds(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  kind: MothershipKind,
  holdInstanceIds: string[],
  holdsRequired: number,
): boolean {
  if (holdInstanceIds.length !== holdsRequired) return false;
  if (holdsRequired === 0) return holdInstanceIds.length === 0;

  const allowed = listMothershipHoldSets(
    player,
    definitions,
    rushingCardId,
    kind,
    holdsRequired,
  );
  const key = [...holdInstanceIds].sort().join(",");
  return allowed.some((set) => [...set].sort().join(",") === key);
}

/** コマンド支払い中に既に適用された母艦ホールド（ラッシュ解決前）。 */
export function mothershipHoldsSatisfiedOnPlayer(
  player: PlayerState,
  holdInstanceIds: string[],
  holdsRequired: number,
): boolean {
  if (holdInstanceIds.length !== holdsRequired) return false;
  return holdInstanceIds.every((instanceId) => {
    const card =
      player.command.find((c) => c.instanceId === instanceId) ??
      player.rush.find((c) => c.instanceId === instanceId);
    return card?.mothershipHold === true && card.commandHeld === true;
  });
}

export function validateZordAdditionalPayment(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materialInstanceId?: string,
  materialDestination?: ZordMaterialDestination,
  mothershipHoldInstanceIds?: string[],
  materialInstanceIds?: string[],
): boolean {
  const condition = getZordCondition(rushingCardId);
  if (!condition) return true;
  if (
    condition === "state_gate" ||
    condition === "hold_extra_command" ||
    condition === "opponent_draw"
  ) {
    return true;
  }

  const unitSlots = mothershipHoldCountForRush(rushingCardId);
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);
  const materialIds =
    materialInstanceIds ?? (materialInstanceId ? [materialInstanceId] : []);
  const hasMaterial = materialIds.length > 0;
  const holdIds = mothershipHoldInstanceIds ?? [];

  if (hasMaterial) {
    if (
      !validateFieldZordMaterials(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        materialIds,
        materialDestination,
      )
    ) {
      return false;
    }
  }

  const slotsFilled =
    hasMaterial && condition && isSendSUnitZordCondition(condition)
      ? materialIds.length
      : zordSlotsFilledByMaterial(rushingCardId, hasMaterial, materialDestination);

  if (
    kind === "jaguar" &&
    hasMaterial &&
    materialDestination === "discard"
  ) {
    if (holdIds.length > 0) return false;
    return slotsFilled >= unitSlots;
  }

  const holdsRequired =
    kind && hasMaterial && !jaguarMothershipAllowedWithMaterial(rushingCardId, materialDestination)
      ? 0
      : kind
        ? mothershipHoldsRequiredForRush(rushingCardId, slotsFilled)
        : 0;

  if (holdsRequired > 0) {
    if (!kind) return false;
    if (mothershipHoldsSatisfiedOnPlayer(player, holdIds, holdsRequired)) {
      return true;
    }
    return validateMothershipHolds(
      player,
      definitions,
      rushingCardId,
      kind,
      holdIds,
      holdsRequired,
    );
  }

  if (holdIds.length > 0) return false;

  if (slotsFilled >= unitSlots) return true;

  if (!hasMaterial && kind) {
    return canPayZordWithMothership(player, definitions, rushingCardId);
  }

  return false;
}

export function canPayZordWithMothership(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): boolean {
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);
  if (!kind) return false;
  const required = mothershipHoldsRequiredForRush(rushingCardId, 0);
  return (
    listMothershipHoldSets(player, definitions, rushingCardId, kind, required).length > 0
  );
}

export type ZordRushPaymentVariant = {
  zordMaterialInstanceId?: string;
  zordMaterialInstanceIds?: string[];
  zordMaterialDestination?: ZordMaterialDestination;
  zordMothershipHoldInstanceIds?: string[];
  zordExtraCommandHoldInstanceIds?: string[];
};

/** 1回のラッシュに対する合法なゾード素材 / 母艦の全組み合わせ。 */
export function listZordRushPaymentVariants(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  rushingInstanceId: string,
  materials: CardInstance[],
  commandZoneHasSpace: boolean,
): ZordRushPaymentVariant[] {
  const variants: ZordRushPaymentVariant[] = [];
  const condition = getZordCondition(rushingCardId);
  const kind = canUseMothershipForZordRush(definitions, player, rushingCardId);

  const pushIfValid = (variant: ZordRushPaymentVariant) => {
    const materialIds =
      variant.zordMaterialInstanceIds ??
      (variant.zordMaterialInstanceId ? [variant.zordMaterialInstanceId] : []);
    if (
      validateZordAdditionalPayment(
        player,
        definitions,
        rushingCardId,
        rushingInstanceId,
        variant.zordMaterialInstanceId ?? materialIds[0],
        variant.zordMaterialDestination,
        variant.zordMothershipHoldInstanceIds,
        materialIds.length > 0 ? materialIds : undefined,
      )
    ) {
      variants.push(variant);
    }
  };

  const fieldVariants = listFieldZordRushVariants(
    player,
    definitions,
    rushingCardId,
    rushingInstanceId,
    commandZoneHasSpace,
  );

  for (const fieldVariant of fieldVariants) {
    const materialId =
      fieldVariant.zordMaterialInstanceId ?? fieldVariant.zordMaterialInstanceIds?.[0];
    const slotsFilled = materialId ? 1 : 0;
    const holdsRequired = kind
      ? mothershipHoldsRequiredForRush(rushingCardId, slotsFilled)
      : 0;

    if (kind && holdsRequired > 0) {
      for (const holdIds of listMothershipHoldSets(
        player,
        definitions,
        rushingCardId,
        kind,
        holdsRequired,
      )) {
        pushIfValid({
          ...fieldVariant,
          zordMothershipHoldInstanceIds: holdIds.length > 0 ? holdIds : undefined,
        });
      }
    } else {
      pushIfValid(fieldVariant);
    }
  }

  if (kind) {
    for (const holdIds of listMothershipHoldSets(
      player,
      definitions,
      rushingCardId,
      kind,
      mothershipHoldsRequiredForRush(rushingCardId, 0),
    )) {
      pushIfValid({
        zordMothershipHoldInstanceIds: holdIds.length > 0 ? holdIds : undefined,
      });
    }
  }

  return variants;
}

/** ゾードアップの全支払いパターン（state_gate / 拡張素材 / ホールド / フィールド素材）。 */
export function listZordUpRushPaymentVariants(
  state: GameState,
  playerId: PlayerId,
  rushingCardId: string,
  rushingInstanceId: string,
): ZordRushPaymentVariant[] {
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, rushingCardId);
  const condition = resolveRushAdditionalCondition(rushingCardId, def);
  if (!condition) return [];

  if (requiresAllFusionPartners(rushingCardId)) {
    return [{}];
  }

  if (condition.conditionId === "state_gate") {
    return evaluateStateGate(state, playerId, condition) ? [{}] : [];
  }

  if (condition.conditionId === "opponent_draw") {
    return [{}];
  }

  if (condition.conditionId === "hold_extra_command") {
    return listHoldExtraCommandVariants(player, state.definitions, rushingCardId);
  }

  if (
    condition.conditionId === "return_named_to_hand" ||
    condition.conditionId === "discard_operation_cards" ||
    condition.conditionId === "discard_category_l_unit" ||
    condition.conditionId === "discard_command_card" ||
    condition.conditionId === "discard_all_hand" ||
    condition.conditionId === "discard_hand_card" ||
    condition.conditionId === "discard_generic_unit" ||
    condition.conditionId === "discard_all_face_up_power"
  ) {
    return listExtendedZordRushVariants(
      player,
      state.definitions,
      rushingCardId,
      rushingInstanceId,
    );
  }

  const materials = collectZordMaterials(
    player,
    state.definitions,
    rushingCardId,
    rushingInstanceId,
  );
  return listZordRushPaymentVariants(
    player,
    state.definitions,
    rushingCardId,
    rushingInstanceId,
    materials,
    player.command.length < COMMAND_ZONE_MAX,
  );
}
