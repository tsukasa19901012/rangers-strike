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
import { isAttackHoldSelfEffect } from "../rules/attackHoldBonus";
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
    // 「アタックするとき、自軍コマンドを好きな数ホールド…」は rules/attackHoldBonus のホールド数選択で扱う。
    if (isAttackHoldSelfEffect(cardId, effect.id)) return false;
    const wired = getWiredOnAttackEffect(cardId);
    if (wired && wired.effectId === effect.id) return false;
  }

  if (triggerType === "nc" && LEGACY_NC_EFFECT_IDS.has(effect.id)) {
    return false;
  }

  // 「自軍ユニットが撃破されたとき（かわりに…）」の置き換えは離場の応答（pendingLeave）で扱い、
  // これ自身が撃破されたときの誘発ではない（RS-324【ジルマ・マジュナ】: rules/legend1/set5NamedEffects.ts）。
  if (triggerType === "on_destroy" && NAMED_LEAVE_REPLACEMENT_EFFECTS.has(`${cardId}:${effect.id}`)) {
    return false;
  }

  return true;
}

const NAMED_LEAVE_REPLACEMENT_EFFECTS = new Set(["RS-324:jirumamajuna"]);

/** TS 専用ハンドラがある wired オペは DSL スタブよりネイティブ解決を優先する。 */
export function shouldUseDslOperation(
  cardId: string,
  effect: EffectDefinition | undefined,
): boolean {
  if (!effect || !isDslInterpretableEffect(effect)) return false;
  if (dslOperationOpensChoose(effect)) return true;
  // RK-174 プットオン（rk9:: のカード固有の効果。本文の「その後、このカードを自軍パワーゾーンに置く」から読む place_in_power より優先。
  // rules/rk/rk9UnitEffects.ts）。
  if (effect.effects?.some((p) => p.type === "grant_keyword" && typeof p.keyword === "string" && p.keyword.startsWith("rk9::"))) return true;
  // スペシャルメタルエディション RM-001〜RM-021（rm1:: のカード固有の効果。本文の再録から読む既存の効果より優先。rules/rm/rm1Effects.ts）。
  if (effect.effects?.some((p) => p.type === "grant_keyword" && typeof p.keyword === "string" && p.keyword.startsWith("rm1::"))) return true;
  // RM-022〜RM-042（rm2::。rules/rm/rm2Effects.ts）。
  if (effect.effects?.some((p) => p.type === "grant_keyword" && typeof p.keyword === "string" && p.keyword.startsWith("rm2::"))) return true;
  // RM-043〜RM-062（rm3::。rules/rm/rm3Effects.ts）。
  if (effect.effects?.some((p) => p.type === "grant_keyword" && typeof p.keyword === "string" && p.keyword.startsWith("rm3::"))) return true;
  // ベルトコレクション BK-001〜BK-019（bk1::。rules/bk/bk1Effects.ts）。
  if (effect.effects?.some((p) => p.type === "grant_keyword" && typeof p.keyword === "string" && p.keyword.startsWith("bk1::"))) return true;
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
  if (condition.type === "and") {
    return condition.conditions.every((c) =>
      evaluateDslCondition(state, playerId, c, operationInstanceId, effectEffects),
    );
  }
  if (condition.type === "not") {
    return !evaluateDslCondition(state, playerId, condition.condition, operationInstanceId, effectEffects);
  }
  return true;
}
