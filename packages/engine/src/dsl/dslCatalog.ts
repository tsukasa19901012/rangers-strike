import type {
  EffectCondition,
  EffectDefinition,
  EffectPrimitive,
  EffectTrigger,
  OperationTiming,
} from "@rangers-strike/cards/dsl/types";
import {
  getCardEffect,
  getEnterBattleNamedEffect,
  getWiredEnterBattleEffect,
  getWiredOnAttackEffect,
  getWiredOnRushEffect,
  IMPLEMENTED_NC_EFFECT_IDS,
  isOperationImplemented,
} from "@rangers-strike/cards";
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
      if (primitive.keyword.startsWith("note_card::")) return false;
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

const LEGACY_NC_EFFECT_IDS = new Set<string>(IMPLEMENTED_NC_EFFECT_IDS);

const LEGEND2_ENTER_BATTLE_EFFECT_IDS = new Set([
  "mane_hurricane",
  "ruin_excavation",
  "phantom_illusion",
  "sky_magic_slash",
]);

export function dslOperationOpensChoose(effect: EffectDefinition): boolean {
  const first = effect.effects[0];
  return first?.type === "choose";
}

function dslTriggeredOpensUnitChoose(effect: EffectDefinition): boolean {
  return effect.effects.some(
    (p) => p.type === "choose" && p.kind === "select_unit",
  );
}

/** TS 専用ハンドラがある wired トリガーは DSL スタブよりネイティブ解決を優先する。 */
export function shouldUseDslTriggeredEffect(
  cardId: string,
  effect: EffectDefinition,
  triggerType: EffectTrigger["type"],
): boolean {
  if (!isDslInterpretableEffect(effect)) return false;
  if (effect.effects.some((p) => p.type === "interpret_effect")) return true;
  if (dslTriggeredOpensUnitChoose(effect)) return true;

  if (triggerType === "on_rush") {
    const wired = getWiredOnRushEffect(cardId);
    if (wired && wired.effectId === effect.id) return false;
  }

  if (triggerType === "enter_battle") {
    const wired = getWiredEnterBattleEffect(cardId);
    if (wired && wired.effectId === effect.id) return false;
    const named = getEnterBattleNamedEffect(cardId);
    if (named?.effectId === effect.id && LEGEND2_ENTER_BATTLE_EFFECT_IDS.has(named.effectId)) {
      return false;
    }
  }

  if (triggerType === "on_attack") {
    const wired = getWiredOnAttackEffect(cardId);
    if (wired && wired.effectId === effect.id) return false;
  }

  if (triggerType === "nc" && LEGACY_NC_EFFECT_IDS.has(effect.id)) {
    return false;
  }

  return true;
}

/** TS 専用ハンドラがある wired オペは DSL スタブよりネイティブ解決を優先する。 */
export function shouldUseDslOperation(
  cardId: string,
  effect: EffectDefinition | undefined,
): boolean {
  if (!effect || !isDslInterpretableEffect(effect)) return false;
  if (dslOperationOpensChoose(effect)) return true;
  const wiredId = getCardEffect(cardId)?.effectId;
  if (wiredId && isOperationImplemented(wiredId)) return false;
  return true;
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
