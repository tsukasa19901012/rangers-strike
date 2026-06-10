import type {
  EffectCondition,
  EffectDefinition,
  EffectPrimitive,
  OperationTiming,
} from "@rangers-strike/cards/dsl/types";
import type { GameState, PlayerId } from "../types/game";
import { getCardDslDocument } from "./effectLookup";
import { SUPPORTED_GRANT_KEYWORDS } from "./grantKeyword";
import { collectTargetInstanceIds } from "./targetSelectors";

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
): boolean {
  if (!condition || condition.type === "always") return true;
  if (condition.type === "has_target") {
    return (
      collectTargetInstanceIds(state, playerId, condition.target, operationInstanceId)
        .length > 0
    );
  }
  if (condition.type === "controller_is_phase_player") {
    return playerId === state.activePlayer;
  }
  return true;
}
