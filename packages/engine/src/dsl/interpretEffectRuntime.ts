import { rematchEffectPrimitives } from "@rangers-strike/cards/pipeline/extractEffects";
import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import type { GameState } from "../types/game";
import { getCardDslDocument } from "./effectLookup";
import type { DslCardContext } from "./cardInterpreter";
import {
  buildRematchContext,
  isUnresolvedEffectPrimitive,
  tryResolveHashGrantKeyword,
} from "./hashGrantKeywordBridge";

export type InterpretFn = (
  state: GameState,
  ctx: DslCardContext,
  primitives: EffectPrimitive[],
) => { state: GameState; detail?: string };

function isUnresolvedStub(primitives: EffectPrimitive[]): boolean {
  return isUnresolvedEffectPrimitive(primitives);
}

export function tryInterpretEffectDefinition(
  state: GameState,
  ctx: DslCardContext,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  const doc = getCardDslDocument(ctx.sourceCardId);
  const effect = doc?.effects?.find((e) => e.id === ctx.effectId);
  if (!effect?.text) return null;

  const rematched = rematchEffectPrimitives(effect.text, {
    name: effect.name,
    kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });

  if (!rematched || isUnresolvedStub(rematched)) {
    const hashResolved = tryResolveHashGrantKeyword(state, ctx, `stub:${ctx.effectId}`, interpret);
    if (hashResolved && hashResolved.detail !== "interpret_effect_unresolved") {
      return hashResolved;
    }
    return { state, detail: "interpret_effect_unresolved" };
  }

  return interpret(state, buildRematchContext(effect, ctx), rematched);
}
