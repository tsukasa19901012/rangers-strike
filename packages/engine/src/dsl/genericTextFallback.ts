/**
 * 未知の grant_keyword に対する最終フォールバック。
 * 付与元効果のテキストからパターン照合で構造化プリミティブを生成して実行する。
 * grant_keyword 原文は再実行しないため applyGrantKeyword と再帰しない。
 */
import type { GameState } from "../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "./grantKeyword";
import { tryCatchallPatternRuntime } from "./catchallPatternRuntime";
import { interpretEffectPrimitives, type DslCardContext } from "./cardInterpreter";

const inFlight = new Set<string>();

export function tryGenericTextFallback(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GrantKeywordResult | null {
  const interpret = interpretEffectPrimitives;
  const key = `${ctx.sourceCardId}:${ctx.effectId}:${keyword}`;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    const dslCtx: DslCardContext = {
      effectId: ctx.effectId,
      sourceCardId: ctx.sourceCardId,
      playerId: ctx.playerId,
      phasePlayerId: ctx.phasePlayerId,
      operationInstanceId: ctx.operationInstanceId,
      triggerSourceInstanceId: ctx.triggerSourceInstanceId,
      extraInstanceIds: ctx.extraInstanceIds,
      leavingCardId: ctx.leavingCardId,
      discardOperation: false,
      optional: ctx.optional,
    };
    const resolved = tryCatchallPatternRuntime(state, dslCtx, interpret);
    if (!resolved) return null;
    return { state: resolved.state, detail: resolved.detail ?? keyword };
  } finally {
    inFlight.delete(key);
  }
}
