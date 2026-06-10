import { rematchEffectPrimitives } from "../../../cards/src/pipeline/extractEffects";
import type { EffectPrimitive } from "../../../cards/src/dsl/types";
import type { GameState } from "../types/game";
import { getCardDslDocument } from "./effectLookup";
import type { DslCardContext } from "./cardInterpreter";
import type { GrantKeywordContext, GrantKeywordResult } from "./grantKeyword";
import { setEffectDelegateResolver } from "./effectDelegateSlot";

type InterpretFn = (
  state: GameState,
  ctx: DslCardContext,
  primitives: EffectPrimitive[],
) => { state: GameState; detail?: string };

function isStillDelegate(primitives: EffectPrimitive[]): boolean {
  return (
    primitives.length === 1 &&
    primitives[0]?.type === "grant_keyword" &&
    primitives[0].keyword.startsWith("effect_")
  );
}

function tryResolveEffectDelegate(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
  interpret: InterpretFn,
): GrantKeywordResult | null {
  if (!keyword.startsWith("effect_")) return null;

  const effectId = keyword.slice("effect_".length);
  const doc = getCardDslDocument(ctx.sourceCardId);
  const effect = doc?.effects?.find((e) => e.id === effectId);
  if (!effect?.text) return null;

  const rematched = rematchEffectPrimitives(effect.text, {
    name: effect.name,
    kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });
  if (!rematched || isStillDelegate(rematched)) return null;

  const outcome = interpret(
    state,
    {
      effectId: effect.id,
      sourceCardId: ctx.sourceCardId,
      playerId: ctx.playerId,
      phasePlayerId: ctx.phasePlayerId,
      triggerSourceInstanceId: ctx.triggerSourceInstanceId,
      operationInstanceId: ctx.operationInstanceId,
      extraInstanceIds: ctx.extraInstanceIds,
      leavingCardId: ctx.leavingCardId,
      discardOperation: false,
      optional: effect.optional,
    },
    rematched,
  );

  return { state: outcome.state, detail: outcome.detail ?? keyword };
}

/** cardInterpreter 初期化後に呼び出し（循環 import 回避）。 */
export function wireEffectDelegateResolver(interpret: InterpretFn): void {
  setEffectDelegateResolver((state, ctx, keyword) =>
    tryResolveEffectDelegate(state, ctx, keyword, interpret),
  );
}
