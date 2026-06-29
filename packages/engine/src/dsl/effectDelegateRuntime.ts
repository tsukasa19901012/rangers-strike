import type { GameState } from "../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "./grantKeyword";
import { setEffectDelegateResolver } from "./effectDelegateSlot";
import { tryInterpretEffectDefinition, type InterpretFn } from "./interpretEffectRuntime";
import { isCatchallGrantKeyword } from "./hashGrantKeywordStub";
import { isStableCardDelegateKeyword } from "./effectCardGrantKeywordBridge";

function tryResolveEffectDelegate(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
  interpret: InterpretFn,
): GrantKeywordResult | null {
  let effectId: string | null = null;
  if (isStableCardDelegateKeyword(keyword)) {
    effectId = ctx.effectId;
  } else if (keyword.startsWith("effect_")) {
    effectId = keyword.slice("effect_".length);
  } else if (isCatchallGrantKeyword(keyword)) {
    effectId = ctx.effectId;
  } else {
    return null;
  }

  const outcome = tryInterpretEffectDefinition(
    state,
    {
      effectId,
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
  if (!outcome) return null;
  return { state: outcome.state, detail: outcome.detail ?? keyword };
}

/** cardInterpreter 初期化後に呼び出し（循環 import 回避）。 */
export function wireEffectDelegateResolver(interpret: InterpretFn): void {
  setEffectDelegateResolver((state, ctx, keyword) =>
    tryResolveEffectDelegate(state, ctx, keyword, interpret),
  );
}
