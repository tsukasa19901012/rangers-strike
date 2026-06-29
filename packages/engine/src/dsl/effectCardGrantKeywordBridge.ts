import { isEffectCardKeyword, isNoteCardKeyword } from "./hashGrantKeywordStub";
import type { GameState } from "../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "./grantKeyword";
import { tryInterpretEffectDefinition, type InterpretFn } from "./interpretEffectRuntime";

export function isStableCardDelegateKeyword(keyword: string): boolean {
  return isEffectCardKeyword(keyword) || isNoteCardKeyword(keyword);
}

/** effect_card / note_card を rematch → interpret へ委譲する。 */
export function tryResolveStableCardGrantKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
  interpret: InterpretFn,
): GrantKeywordResult | null {
  if (!isStableCardDelegateKeyword(keyword)) return null;

  const outcome = tryInterpretEffectDefinition(
    state,
    {
      effectId: ctx.effectId,
      sourceCardId: ctx.sourceCardId,
      playerId: ctx.playerId,
      phasePlayerId: ctx.phasePlayerId,
      triggerSourceInstanceId: ctx.triggerSourceInstanceId,
      operationInstanceId: ctx.operationInstanceId,
      extraInstanceIds: ctx.extraInstanceIds,
      leavingCardId: ctx.leavingCardId,
      discardOperation: false,
      optional: ctx.optional,
    },
    interpret,
  );

  if (!outcome) return { state, detail: keyword };
  if (outcome.detail === "interpret_effect_unresolved") {
    return { state: outcome.state, detail: keyword };
  }
  return { state: outcome.state, detail: outcome.detail ?? keyword };
}
