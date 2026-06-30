import type { GameAction, GameState, PlayerId } from "@rangers-strike/engine";
import {
  getLegalActions,
  getMorphReactionActorId,
  morphOrderChooserPlayerId,
  morphReplacementChooserPlayerId,
  shouldMorphOrderChooserAct,
} from "@rangers-strike/engine";

export type MorphUiState = {
  pending: boolean;
  actorPlayerId: PlayerId | null;
  orderChooserPlayerId: PlayerId | null;
  replacementChooserPlayerId: PlayerId | null;
  morphUnitInstanceIds: string[];
  replacementInstanceIds: string[];
  canPass: boolean;
  isOrderPhase: boolean;
  isReplacementPhase: boolean;
};

export function resolveMorphUiState(
  state: GameState,
  humanPlayerId: PlayerId,
): MorphUiState | null {
  const pending = state.pendingMorph;
  if (!pending) return null;

  const legalActions = getLegalActions(state);
  const actorPlayerId = getMorphReactionActorId(state, pending);
  const replacementInstanceIds =
    state.pendingEffectChoice?.effectId === "morph_replacement"
      ? (state.pendingEffectChoice.validInstanceIds ?? [])
      : [];

  return {
    pending: true,
    actorPlayerId,
    orderChooserPlayerId: morphOrderChooserPlayerId(pending) ?? null,
    replacementChooserPlayerId: morphReplacementChooserPlayerId(pending),
    morphUnitInstanceIds: pending.morphUnitInstanceIds,
    replacementInstanceIds,
    canPass: legalActions.some(
      (action) =>
        action.type === "pass_morph_reaction" && action.playerId === humanPlayerId,
    ),
    isOrderPhase:
      shouldMorphOrderChooserAct(pending) && actorPlayerId === humanPlayerId,
    isReplacementPhase:
      state.pendingEffectChoice?.effectId === "morph_replacement" &&
      state.pendingEffectChoice.playerId === humanPlayerId,
  };
}

export function findSelectMorphUnitAction(
  legalActions: GameAction[],
  morphUnitInstanceId: string,
  playerId: PlayerId,
): Extract<GameAction, { type: "select_morph_unit" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "select_morph_unit" }> =>
      action.type === "select_morph_unit" &&
      action.playerId === playerId &&
      action.morphUnitInstanceId === morphUnitInstanceId,
  );
}

export function findPassMorphReactionAction(
  legalActions: GameAction[],
  playerId: PlayerId,
): Extract<GameAction, { type: "pass_morph_reaction" }> | undefined {
  return legalActions.find(
    (action): action is Extract<GameAction, { type: "pass_morph_reaction" }> =>
      action.type === "pass_morph_reaction" && action.playerId === playerId,
  );
}

export function morphOrderHint(defenderIsHuman: boolean): string {
  return defenderIsHuman
    ? "相手のモーフユニットを選び、解決順を決めてください"
    : "モーフの解決順を選んでください";
}

export function morphReplacementHint(): string {
  return "特徴が一致するユニットカードを選び、モーフで置き換えてください";
}
