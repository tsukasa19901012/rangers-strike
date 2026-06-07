import { getCardEffect } from "@rangers-strike/cards";
import type { CardInstance, GameAction, GameState, PlayerId } from "@rangers-strike/engine";
import { cardTargetMetaLine, findCardTarget } from "./cardTargets";
import { commandPaymentTargetIds } from "./commandPaymentUi";
import {
  buildPaymentFromInitiateAction,
  collectFiveTechInterceptors,
  explainCannotEnterBattle,
  getBattleEntryPaymentNeeds,
  getLegalActions,
  getLightningGravityHoldNotice,
  getReactionChooserPlayerId,
  opponent,
} from "@rangers-strike/engine";

export type ReactionKind = "strike" | "battle" | "rush" | "leave";

export type ReactionModalUiState = {
  kind: ReactionKind | null;
  showModal: boolean;
  counterInstanceIds: string[];
  /** カウンター instanceId → 効果対象ユニットの表示文言 */
  counterTargetLabels: Record<string, string>;
  interceptInstanceIds: string[];
  canPass: boolean;
  canUsePlasma: boolean;
};

export function isHumanStrikeDefender(state: GameState, humanPlayerId: PlayerId): boolean {
  const pending = state.pendingStrike;
  if (!pending || state.pendingDamagePayment) return false;
  return (
    opponent(pending.strikerPlayerId) === humanPlayerId &&
    getReactionChooserPlayerId(state) === humanPlayerId
  );
}

export function resolveHumanReactionKind(
  state: GameState,
  humanPlayerId: PlayerId,
): ReactionKind | null {
  if (isHumanStrikeDefender(state, humanPlayerId)) return "strike";
  if (state.pendingBattle && getReactionChooserPlayerId(state) === humanPlayerId) {
    return "battle";
  }
  if (state.pendingRush && getReactionChooserPlayerId(state) === humanPlayerId) {
    return "rush";
  }
  if (state.pendingLeave && getReactionChooserPlayerId(state) === humanPlayerId) {
    return "leave";
  }
  return null;
}

function isHumanReactionTurn(state: GameState, humanPlayerId: PlayerId): boolean {
  if (state.winner || getReactionChooserPlayerId(state) !== humanPlayerId) return false;
  return !!(
    (state.pendingStrike && !state.pendingDamagePayment) ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingLeave
  );
}

export function resolveCounterInstanceIds(
  state: GameState,
  humanPlayerId: PlayerId,
  legalActions: GameAction[] = getLegalActions(state),
): string[] {
  if (getReactionChooserPlayerId(state) !== humanPlayerId) return [];
  const ids = new Set<string>();
  for (const action of legalActions) {
    if (action.type === "play_counter") {
      ids.add(action.instanceId);
    }
    if (
      action.type === "initiate_command_payment" &&
      action.kind === "category_use"
    ) {
      ids.add(action.sourceInstanceId);
    }
  }
  return [...ids];
}

function resolveCounterEffectTargetInstanceId(
  state: GameState,
  counterCardId: string,
): string | undefined {
  const effectId = getCardEffect(counterCardId)?.effectId;
  if (!effectId) return undefined;

  if (state.pendingRush && effectId === "shippu_ninja") {
    return state.pendingRush.rushedInstanceId;
  }
  if (
    state.pendingBattle &&
    (effectId === "new_gymnastics" || effectId === "hidden_ninja")
  ) {
    return state.pendingBattle.defenderInstanceId;
  }
  if (
    state.pendingLeave &&
    (effectId === "dino_chronicle" || effectId === "dino_guts")
  ) {
    return state.pendingLeave.instanceId;
  }
  return undefined;
}

export function resolveCounterEffectTargetLabels(
  state: GameState,
  humanPlayerId: PlayerId,
  counterInstanceIds: string[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  const player = state.players[humanPlayerId];

  for (const counterInstanceId of counterInstanceIds) {
    const counterCard = player.hand.find((c) => c.instanceId === counterInstanceId);
    if (!counterCard) continue;

    const targetInstanceId = resolveCounterEffectTargetInstanceId(
      state,
      counterCard.cardId,
    );
    if (!targetInstanceId) continue;

    const target = findCardTarget(state, targetInstanceId);
    if (!target) continue;

    labels[counterInstanceId] =
      `対象: ${target.card.name}（${cardTargetMetaLine(target, humanPlayerId)}）`;
  }

  return labels;
}

export function resolveReactionModalUi(
  state: GameState,
  humanPlayerId: PlayerId,
  options?: { pendingHiddenNinja?: boolean },
): ReactionModalUiState {
  const legalActions = getLegalActions(state);
  const kind = resolveHumanReactionKind(state, humanPlayerId);
  const counterInstanceIds = resolveCounterInstanceIds(state, humanPlayerId, legalActions);
  const counterTargetLabels = resolveCounterEffectTargetLabels(
    state,
    humanPlayerId,
    counterInstanceIds,
  );
  const interceptInstanceIds = isHumanStrikeDefender(state, humanPlayerId)
    ? collectFiveTechInterceptors(state, humanPlayerId)
    : [];
  const isReactionTurn = isHumanReactionTurn(state, humanPlayerId);
  const canPassBattleReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_battle_reaction");
  const canPassRushReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_rush_reaction");
  const canPassLeaveReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_leave_reaction");
  const canUsePlasma =
    isHumanStrikeDefender(state, humanPlayerId) &&
    legalActions.some((a) => a.type === "use_plasma_energy");
  const canPass =
    kind === "strike"
      ? isHumanStrikeDefender(state, humanPlayerId)
      : kind === "battle"
        ? canPassBattleReaction
        : kind === "rush"
          ? canPassRushReaction
          : kind === "leave"
            ? canPassLeaveReaction
            : false;

  const showModal =
    !!kind &&
    (options?.pendingHiddenNinja === true ||
      counterInstanceIds.length > 0 ||
      interceptInstanceIds.length > 0 ||
      canPass ||
      isHumanStrikeDefender(state, humanPlayerId));

  return {
    kind,
    showModal,
    counterInstanceIds,
    counterTargetLabels,
    interceptInstanceIds,
    canPass,
    canUsePlasma,
  };
}

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

/** 人間プレイヤーのコマンドホールド支払い中（相手ターンのカウンター支払いも含む）。 */
export function isHumanCommandPaymentActive(
  state: GameState,
  humanPlayerId: PlayerId,
): boolean {
  return (
    !state.winner &&
    state.pendingCommandPayment?.playerId === humanPlayerId
  );
}

/** 盤面タップ選択用のコマンド instanceId 集合。 */
export function resolveCommandPaymentBoardTargetIds(
  state: GameState,
  humanPlayerId: PlayerId,
): Set<string> | undefined {
  const pending = state.pendingCommandPayment;
  if (!pending || pending.playerId !== humanPlayerId || state.winner) return undefined;
  return commandPaymentTargetIds(pending);
}
