import type { CardDocument, EffectDefinition, ImplementationMeta } from "./types";
import { assertValidCardDocument } from "./validator";

export function inferImplementation(card: CardDocument): ImplementationMeta {
  const hasDslPrimitives = card.effects?.some((e) =>
    e.effects.some((p) => p.type !== "fallback_handler"),
  );
  const hasFallbackOnly = card.effects?.every((e) =>
    e.effects.every((p) => p.type === "fallback_handler"),
  );
  const hasLegacyOp = card.type === "operation" && !!card.effectId;

  if (hasDslPrimitives) {
    return { source: "dsl", handler: "interpreter" };
  }
  if (hasLegacyOp && card.effects?.length) {
    return { source: "hybrid", handler: "typescript" };
  }
  if (hasLegacyOp) {
    return { source: "legacy_operation", handler: "typescript" };
  }
  if (hasFallbackOnly && (card.effects?.length ?? 0) > 0) {
    return { source: "legacy_unit_effects", handler: "typescript" };
  }
  if (
    (card.effects?.length ?? 0) === 0 &&
    (card.rushAdditionalCondition || (card.unnamedRules?.length ?? 0) > 0)
  ) {
    return { source: "dsl", handler: "interpreter" };
  }
  if ((card.effects?.length ?? 0) === 0 && !card.effectId) {
    return { source: "dsl", handler: "unimplemented" };
  }
  return { source: "legacy_unit_effects", handler: "typescript" };
}

/** DSL JSON ファイルのマージ（上書き） */
export function mergeCardDocument(
  base: CardDocument,
  overlay: Partial<CardDocument>,
): CardDocument {
  const merged: CardDocument = {
    ...base,
    ...overlay,
    id: base.id,
    effects: overlay.effects ?? base.effects,
    unnamedRules: overlay.unnamedRules ?? base.unnamedRules,
    tags: overlay.tags ?? base.tags,
    features: overlay.features ?? base.features,
  };
  assertValidCardDocument(merged);
  merged.implementation =
    overlay.implementation ?? base.implementation ?? inferImplementation(merged);
  return merged;
}

/** primitives のみを持つ DSL 効果か */
export function isFullyDslEffect(effect: EffectDefinition): boolean {
  return effect.effects.every((p) => p.type !== "fallback_handler");
}
