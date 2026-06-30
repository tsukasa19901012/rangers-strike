import { getCardEffect } from "@rangers-strike/cards";
import {
  canActivateResidentOperation,
  canInitiateShironLight,
  listResidentActivationEffects,
  type CardInstance,
  type GameAction,
  type GameState,
  type PlayerId,
} from "@rangers-strike/engine";

const WIRED_CLICKABLE_EFFECT_IDS = new Set([
  "shiron_light",
  "hidora_egg",
  "battle_dance",
]);

export function hasPermanentOperationActivation(cardId: string): boolean {
  const wired = getCardEffect(cardId);
  if (wired?.effectId && WIRED_CLICKABLE_EFFECT_IDS.has(wired.effectId)) {
    return true;
  }
  return listResidentActivationEffects(cardId).length > 0;
}

export function canActivatePermanentOperationUi(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  legalActions: GameAction[],
): boolean {
  const wired = getCardEffect(card.cardId);
  if (wired?.effectId === "hidora_egg") {
    return legalActions.some((action) => action.type === "hidora_egg");
  }
  if (wired?.effectId === "shiron_light") {
    return canInitiateShironLight(state, playerId, card.instanceId);
  }
  return legalActions.some(
    (action) =>
      action.type === "activate_resident_operation" &&
      action.operationInstanceId === card.instanceId,
  );
}

export function findActivateResidentOperationAction(
  legalActions: GameAction[],
  operationInstanceId: string,
): Extract<GameAction, { type: "activate_resident_operation" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "activate_resident_operation" }> =>
      action.type === "activate_resident_operation" &&
      action.operationInstanceId === operationInstanceId,
  );
}

export function permanentOperationActivateLabel(cardId: string): string {
  const wired = getCardEffect(cardId);
  if (wired?.effectId === "hidora_egg") return "発動（山札から1枚）";
  return "発動";
}

export function shouldOpenPermanentOperationModal(
  card: CardInstance,
  phase: GameState["phase"],
): boolean {
  if (phase === "battle") {
    return getCardEffect(card.cardId)?.effectId === "battle_dance";
  }
  if (phase !== "rush") return false;
  return hasPermanentOperationActivation(card.cardId);
}

export function canActivateResidentOperationUi(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): boolean {
  return canActivateResidentOperation(state, playerId, operationInstanceId);
}
