import type { EffectDefinition, EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { rematchEffectPrimitives } from "@rangers-strike/cards/pipeline/extractEffects";
import { isCatchallGrantKeyword, isHashGrantKeywordStub } from "./hashGrantKeywordStub";
import type { GameState } from "../types/game";
import { getDslEffectById } from "./effectLookup";
import type { DslCardContext } from "./cardInterpreter";
import type { InterpretFn } from "./interpretEffectRuntime";

export function isRematchedHashStub(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) => p.type === "grant_keyword" && isCatchallGrantKeyword(p.keyword),
  );
}

export function rematchEffectFromDsl(
  sourceCardId: string,
  effectId: string,
): EffectPrimitive[] | null {
  const effect = getDslEffectById(sourceCardId, effectId);
  if (!effect?.text) return null;
  return rematchEffectPrimitives(effect.text, {
    name: effect.name,
    kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });
}

/** catchall grant_keyword を rematch → interpret で解決する。 */
export function tryResolveHashGrantKeyword(
  state: GameState,
  ctx: DslCardContext,
  keyword: string,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  if (!isCatchallGrantKeyword(keyword)) return null;

  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  if (!effect?.text) return null;

  const rematched = rematchEffectFromDsl(ctx.sourceCardId, ctx.effectId);
  if (rematched && !isRematchedHashStub(rematched)) {
    return interpret(
      state,
      { ...ctx, optional: effect.optional ?? ctx.optional },
      rematched,
    );
  }

  return null;
}

export function isUnresolvedEffectPrimitive(primitives: EffectPrimitive[]): boolean {
  if (primitives.length !== 1) return false;
  const only = primitives[0];
  if (!only) return false;
  if (only.type === "interpret_effect") return false;
  if (only.type === "grant_keyword") {
    if (only.keyword.startsWith("effect_")) return true;
    if (isCatchallGrantKeyword(only.keyword)) return true;
  }
  if (only.type === "enqueue_trigger") return true;
  return false;
}

export function buildRematchContext(
  effect: EffectDefinition,
  ctx: DslCardContext,
): DslCardContext {
  return { ...ctx, optional: effect.optional ?? ctx.optional };
}
