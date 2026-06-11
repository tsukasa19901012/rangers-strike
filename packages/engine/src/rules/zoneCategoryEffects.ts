import type { GameState, PlayerId } from "../types/game";
import { opponent } from "../core/helpers";
import {
  countDistinctCategoriesInCommandZone,
  dinoSlasherNeedsDiscard,
  assaultVectorDestroyLimit,
  sortCommandZoneForCategoryReduction,
} from "./zoneCategoryLimit";
import { openEffectChoice, startMultiCommandChoice } from "./pendingChoices";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { cardHasComboNumber } from "@rangers-strike/cards";

export function beginOpponentHoldByCategoryCount(
  state: GameState,
  params: {
    effectOwnerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const enemyId = opponent(params.effectOwnerId);
  const limit = countDistinctCategoriesInCommandZone(
    state.players[enemyId],
    state.definitions,
  );
  if (limit <= 0) return null;

  const released = state.players[enemyId].command.filter((c) => !c.commandHeld);
  if (released.length === 0) return null;

  return startMultiCommandChoice(state, {
    playerId: enemyId,
    effectId: params.effectId,
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    selectCount: Math.min(limit, released.length),
    commandFilter: "released",
    commandAction: "hold",
    optional: false,
  });
}

export function beginDinoSlasherDiscard(
  state: GameState,
  params: {
    effectOwnerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    sourceInstanceId?: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const needs = dinoSlasherNeedsDiscard(state, params.effectOwnerId);
  if (!needs) return null;

  const enemy = state.players[needs.opponentId];
  const sorted = sortCommandZoneForCategoryReduction(
    enemy,
    state.definitions,
    enemy.command,
  );
  if (sorted.length === 0) return null;

  return openEffectChoice(state, {
    playerId: needs.opponentId,
    effectId: "dino_slasher_category_balance",
    sourceCardId: params.sourceCardId,
    sourceInstanceId: params.sourceInstanceId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_command",
    validInstanceIds: sorted.map((c) => c.instanceId),
    selectCount: 1,
    commandFilter: "any",
    commandAction: "discard",
    optional: false,
    zoneCategoryTargetCount: needs.targetCount,
    zoneCategoryBalanceOwnerId: params.effectOwnerId,
  });
}

export function beginAssaultVectorDestroy(
  state: GameState,
  params: {
    effectOwnerId: PlayerId;
    effectId: string;
    sourceCardId: string;
    phasePlayerId: PlayerId;
  },
): GameState | null {
  const limit = assaultVectorDestroyLimit(state, params.effectOwnerId);
  if (limit <= 0) return null;

  const enemyId = opponent(params.effectOwnerId);
  const valid: string[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of state.players[enemyId][zone]) {
      const def = getDefinition(state.definitions, card.cardId);
      if (!def || !isSmallUnit(state.definitions, card.cardId)) continue;
      if (cardHasComboNumber(card.cardId)) continue;
      valid.push(card.instanceId);
    }
  }
  if (valid.length === 0) return null;

  return openEffectChoice(state, {
    playerId: params.effectOwnerId,
    effectId: "assault_vector_destroy",
    sourceCardId: params.sourceCardId,
    phasePlayerId: params.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    optional: true,
    unitDestination: "discard",
    zoneCategoryDestroyLimit: limit,
  });
}
