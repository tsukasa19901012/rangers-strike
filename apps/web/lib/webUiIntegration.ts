import { getCardEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "@rangers-strike/engine";
import {
  buildPaymentFromInitiateAction,
  explainCannotEnterBattle,
  getBattleEntryPaymentNeeds,
  getLegalActions,
  getLightningGravityHoldNotice,
} from "@rangers-strike/engine";

/** GameApp.attemptMoveToBattle と同じ分岐（ラッシュ→バトル DnD）。 */
export type BattleEntryUiRoute =
  | { kind: "move_to_battle" }
  | { kind: "command_payment" }
  | { kind: "lightning_gravity_notice" }
  | { kind: "blocked"; reason: string | null };

export function resolveBattleEntryUiRoute(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): BattleEntryUiRoute {
  if (state.phase !== "battle") {
    return { kind: "blocked", reason: "wrong_phase" };
  }

  const legalActions = getLegalActions(state);
  if (
    legalActions.some(
      (action) =>
        action.type === "move_to_battle" && action.instanceId === instanceId,
    )
  ) {
    return { kind: "move_to_battle" };
  }

  const card = state.players[playerId].rush.find(
    (entry) => entry.instanceId === instanceId,
  );
  if (!card) {
    return { kind: "blocked", reason: "card_not_in_rush" };
  }

  if (getBattleEntryPaymentNeeds(state, playerId, card)) {
    const pending = buildPaymentFromInitiateAction(state, {
      type: "initiate_command_payment",
      playerId,
      kind: "battle_entry",
      sourceInstanceId: instanceId,
    });
    if (pending) {
      return { kind: "command_payment" };
    }
  }

  const lgNotice = getLightningGravityHoldNotice(state, playerId, card);
  if (lgNotice) {
    return { kind: "lightning_gravity_notice" };
  }

  return {
    kind: "blocked",
    reason: explainCannotEnterBattle(state, playerId, card, "rush"),
  };
}

export function resolveOperationPlayUiRoute(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): "play_operation" | "category_payment" | "blocked" {
  const legalActions = getLegalActions(state);
  if (
    legalActions.some(
      (action) =>
        action.type === "play_operation" &&
        action.instanceId === operationInstanceId,
    )
  ) {
    return "play_operation";
  }
  if (
    legalActions.some(
      (action) =>
        action.type === "initiate_command_payment" &&
        action.kind === "category_use" &&
        action.sourceInstanceId === operationInstanceId,
    )
  ) {
    return "category_payment";
  }
  return "blocked";
}

export function cardHasOperationEffect(cardId: string): boolean {
  return getCardEffect(cardId) !== undefined;
}

export function isBattleEntryHoldUnit(card: CardInstance, holdCount: number): boolean {
  return holdCount > 0;
}
