import type { CardDefinition } from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import {
  canPlayOperation,
  canPlayOperationExceptCommandHold,
  cardCategories,
  getDefinition,
  isCounterOperation,
  isOperation,
  isPermanentOperation,
  parsePowerCost,
} from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/helpers";
import { hasCommandForCardUse } from "./restrictions";
import type { CardInstance, GameState, PlayerId } from "../types/game";

/** wiki p581: 通常/常駐オペは自軍ラッシュフェイズのみ。 */
export function isOperationPlayPhase(state: GameState): boolean {
  return state.phase === "rush";
}

/** wiki: カウンターは敵軍ターン中のみ。 */
export function isCounterPlayPhase(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayer !== playerId;
}

export function operationCardsToDiscardWithStack(card: CardInstance): CardInstance[] {
  const stacked = card.stackedCards ?? [];
  return [card, ...stacked.map((stackedCard) => ({ ...stackedCard, stackedCards: undefined }))];
}

export function canPayOperationPowerCost(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): boolean {
  const cost = effectivePowerCost(state, playerId, parsePowerCost(definition.powerCost));
  return countAvailablePower(state, playerId) >= cost;
}

export function canSatisfyOperationCommandHold(
  state: GameState,
  playerId: PlayerId,
  definition: CardDefinition,
): boolean {
  return hasCommandForCardUse(
    state.players[playerId],
    state.definitions,
    cardCategories(definition),
    "lead",
  );
}

export type OperationPlayBlockReason =
  | "wrong_phase"
  | "not_operation"
  | "counter_in_own_turn"
  | "insufficient_power"
  | "command_not_ready";

export function explainOperationPlayBlock(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  options?: { counter?: boolean },
): OperationPlayBlockReason | null {
  const definition = getDefinition(state.definitions, cardId);
  if (!definition || !isOperation(definition)) return "not_operation";

  if (options?.counter || isCounterOperation(definition)) {
    if (!isCounterPlayPhase(state, playerId)) return "counter_in_own_turn";
  } else if (!isOperationPlayPhase(state)) {
    return "wrong_phase";
  }

  if (!canPayOperationPowerCost(state, playerId, definition)) {
    return "insufficient_power";
  }

  if (!canSatisfyOperationCommandHold(state, playerId, definition)) {
    return "command_not_ready";
  }

  return null;
}

/** 手札から play_operation 可能（パワー+コマンドホールド済み）。 */
export function canPlayOperationFromHand(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const definition = getDefinition(state.definitions, cardId);
  if (!definition || !isOperation(definition)) return false;
  if (!isOperationPlayPhase(state)) return false;
  return canPlayOperation(state, playerId, definition);
}

/** 手札から initiate_command_payment(category_use) でオペ使用可能。 */
export function canInitiateOperationCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const definition = getDefinition(state.definitions, cardId);
  if (!definition || !isOperation(definition)) return false;
  if (!isOperationPlayPhase(state)) return false;
  if (canPlayOperation(state, playerId, definition)) return false;
  return canPlayOperationExceptCommandHold(state, playerId, definition);
}

export function shouldDiscardOperationAfterResolve(
  cardId: string,
  isPermanent: boolean,
  hasPendingChoice: boolean,
  discardOperation: boolean | undefined,
): boolean {
  if (isPermanent) return discardOperation === true;
  if (hasPendingChoice) return false;
  return discardOperation !== false;
}

export function isInstantOperationCard(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const definition = getDefinition(definitions, cardId);
  if (!definition || !isOperation(definition)) return false;
  if (isPermanentOperation(definition)) return false;
  if (isCounterOperation(definition)) return false;
  const kind = getCardEffect(cardId)?.kind;
  return kind !== "permanent" && kind !== "counter";
}

/** 常駐 OP の上にカードを重ねる（wiki: 常駐置き場の重ね）。 */
export function stackCardOnPermanentOperation(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  card: CardInstance,
  position: "top" | "bottom" = "top",
): GameState | null {
  const player = state.players[playerId];
  const index = player.operation.findIndex((op) => op.instanceId === operationInstanceId);
  if (index < 0) return null;

  const target = player.operation[index]!;
  const stacked = [...(target.stackedCards ?? [])];
  if (position === "top") {
    stacked.push(card);
  } else {
    stacked.unshift(card);
  }

  const operation = [...player.operation];
  operation[index] = { ...target, stackedCards: stacked };

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, operation },
    },
  };
}
