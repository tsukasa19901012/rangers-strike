import { rematchEffectPrimitives } from "../../../cards/src/pipeline/extractEffects";
import type { EffectPrimitive } from "../../../cards/src/dsl/types";
import type { GameState } from "../types/game";
import { getCardDslDocument } from "./effectLookup";
import type { DslCardContext } from "./cardInterpreter";

export type InterpretFn = (
  state: GameState,
  ctx: DslCardContext,
  primitives: EffectPrimitive[],
) => { state: GameState; detail?: string };

function isUnresolvedStub(primitives: EffectPrimitive[]): boolean {
  if (primitives.length !== 1) return false;
  const only = primitives[0];
  if (!only) return false;
  if (only.type === "interpret_effect") return false;
  if (only.type === "grant_keyword" && only.keyword.startsWith("effect_")) return true;
  if (only.type === "enqueue_trigger") return true;
  return false;
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
    return { state, detail: "interpret_effect_unresolved" };
  }

  return interpret(
    state,
    {
      ...ctx,
      optional: effect.optional ?? ctx.optional,
    },
    rematched,
  );
}
