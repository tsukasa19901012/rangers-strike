import {
  canInitiateOperationCategoryPayment,
  canPlayOperationFromHand,
  explainOperationPlayBlock,
  type GameAction,
  type GameState,
  type PlayerId,
} from "@rangers-strike/engine";

export function canPlayOperationFromHandUi(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  return (
    canPlayOperationFromHand(state, playerId, cardId) ||
    canInitiateOperationCategoryPayment(state, playerId, cardId)
  );
}

export function explainOperationPlayBlockUi(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): string | null {
  const reason = explainOperationPlayBlock(state, playerId, cardId);
  switch (reason) {
    case "wrong_phase":
      return "ラッシュフェイズでのみ使用できます";
    case "insufficient_power":
      return "必要パワーが足りません";
    case "command_not_ready":
      return "カテゴリに合うコマンドのホールドが必要です";
    case "counter_in_own_turn":
      return "カウンターは相手ターン中のみ使用できます";
    case "not_operation":
      return "オペレーションカードではありません";
    default:
      return null;
  }
}

export function findPlayOperationAction(
  legalActions: GameAction[],
  instanceId: string,
  targetInstanceId?: string,
  extraInstanceId?: string,
): Extract<GameAction, { type: "play_operation" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "play_operation" }> =>
      action.type === "play_operation" &&
      action.instanceId === instanceId &&
      (targetInstanceId
        ? action.targetInstanceId === targetInstanceId
        : !action.targetInstanceId) &&
      (extraInstanceId
        ? action.extraInstanceId === extraInstanceId
        : !action.extraInstanceId),
  );
}

export function findOperationCategoryPaymentAction(
  legalActions: GameAction[],
  instanceId: string,
  targetInstanceId?: string,
  extraInstanceId?: string,
): Extract<GameAction, { type: "initiate_command_payment" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "initiate_command_payment" }> =>
      action.type === "initiate_command_payment" &&
      action.kind === "category_use" &&
      action.sourceInstanceId === instanceId &&
      (targetInstanceId
        ? action.targetInstanceId === targetInstanceId
        : !action.targetInstanceId) &&
      (extraInstanceId
        ? action.extraInstanceId === extraInstanceId
        : !action.extraInstanceId),
  );
}
