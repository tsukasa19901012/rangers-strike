import type {
  EffectCondition,
  EffectDefinition,
  EffectPrimitive,
  OperationTiming,
} from "@rangers-strike/cards/dsl/types";
import type { GameState, PlayerId } from "../types/game";
import { getCardDslDocument } from "./effectLookup";
import { SUPPORTED_GRANT_KEYWORDS } from "./grantKeyword";
import { collectTargetInstanceIds, augmentChooseValidSelector } from "./targetSelectors";

export function getCardDocument(cardId: string) {
  return getCardDslDocument(cardId);
}

export function getDslOperationEffect(
  cardId: string,
  timing: OperationTiming = "rush",
): EffectDefinition | undefined {
  const doc = getCardDocument(cardId);
  if (doc?.implementation?.handler !== "interpreter") return undefined;
  return doc.effects?.find(
    (effect) =>
      effect.trigger.type === "operation" &&
      effect.trigger.timing === timing,
  );
}

/** while_in_field + resident 等、ラッシュ発動時に常駐置き場へ置く DSL オペ。 */
export function isDslPermanentOperation(cardId: string): boolean {
  const doc = getCardDocument(cardId);
  if (!doc || doc.type !== "operation") return false;
  if (doc.implementation?.handler !== "interpreter") return false;

  if (doc.text?.includes("※常駐")) return true;
  if (doc.unnamedRules?.some((rule) => rule.rule === "resident")) return true;
  if (getDslOperationEffect(cardId, "resident")) return true;

  for (const effect of doc.effects ?? []) {
    if (effect.trigger.type !== "while_in_field") continue;
    if (
      effect.effects.some(
        (primitive) =>
          primitive.type === "grant_keyword" && primitive.keyword === "resident",
      )
    ) {
      return true;
    }
  }
  return false;
}

function isSupportedPrimitive(primitive: EffectPrimitive): boolean {
  switch (primitive.type) {
    case "draw":
    case "move":
    case "modify_bp":
    case "modify_sp":
    case "discard":
    case "deal_damage":
    case "hold_command":
    case "cancel_damage":
      return true;
    case "grant_keyword":
      return (
        SUPPORTED_GRANT_KEYWORDS.has(primitive.keyword) ||
        primitive.keyword.startsWith("effect_") ||
        primitive.keyword.startsWith("runtime_") ||
        primitive.duration === "permanent" ||
        primitive.duration === "turn"
      );
    case "enqueue_trigger":
      return typeof primitive.effectId === "string" && primitive.effectId.length > 0;
    case "interpret_effect":
      return true;
    case "choose":
      return primitive.then.every(isSupportedPrimitive);
    case "fallback_handler":
      return false;
    default:
      return false;
  }
}

export function isDslInterpretableEffect(effect: EffectDefinition): boolean {
  if (effect.effects.some((p) => p.type === "fallback_handler")) return false;
  return effect.effects.every(isSupportedPrimitive);
}

export function dslOperationOpensChoose(effect: EffectDefinition): boolean {
  const first = effect.effects[0];
  return first?.type === "choose";
}

export function evaluateDslCondition(
  state: GameState,
  playerId: PlayerId,
  condition: EffectCondition | undefined,
  operationInstanceId?: string,
  effectEffects?: EffectPrimitive[],
): boolean {
  if (!condition || condition.type === "always") return true;
  if (condition.type === "has_target") {
    let target = condition.target;
    const chooseUnit = effectEffects?.find(
      (p): p is Extract<EffectPrimitive, { type: "choose" }> =>
        p.type === "choose" && p.kind === "select_unit",
    );
    if (chooseUnit) {
      target = augmentChooseValidSelector(target, "select_unit");
    }
    return (
      collectTargetInstanceIds(state, playerId, target, operationInstanceId)
        .length > 0
    );
  }
  if (condition.type === "controller_is_phase_player") {
    return playerId === state.activePlayer;
  }
  return true;
}
