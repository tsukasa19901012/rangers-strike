import { getCardEffect, type CardDefinition } from "@rangers-strike/cards";
import type { EffectDefinition } from "@rangers-strike/cards/dsl/types";
import { rematchExtractedEffect } from "@rangers-strike/cards/pipeline/extractEffects";
import {
  getDefinition,
  isPermanentOperation,
  hasOperationEffect,
} from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getCardDslDocument } from "../dsl/effectLookup";
import {
  type DslCardContext,
  interpretEffectPrimitives,
} from "../dsl/cardInterpreter";
import { evaluateDslCondition } from "../dsl/dslCatalog";
import { canInitiateShironLight } from "./shironLight";
import { isHidoraEggUsed } from "./turnModifiers";
import { operationCardsToDiscardWithStack } from "./operationProcedure";

const RUSH_ACTIVATION_TEXT =
  /(?:自軍|自分(?:の|自身の)?)ラッシュフェイズ(?:ごとに)?1度|自分のラッシュフェイズごとに1度/;

function isTagPermanentCard(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  if (def?.tags?.includes("タッグ")) return true;
  if (def?.text?.includes("※タッグ")) return true;

  const doc = getCardDslDocument(cardId);
  if (!doc?.effects) return false;
  return doc.effects.some((effect) =>
    effect.effects.some(
      (primitive) =>
        primitive.type === "grant_keyword" && primitive.keyword === "tag",
    ),
  );
}

/** wiki: タッグ常駐が関与するとき最大2枚、それ以外1枚。 */
export function permanentOperationSlotLimit(
  definitions: Record<string, CardDefinition>,
  player: PlayerState,
  incomingCardId: string,
): number {
  const hasTag =
    isTagPermanentCard(definitions, incomingCardId) ||
    player.operation.some((card) => isTagPermanentCard(definitions, card.cardId));
  return hasTag ? 2 : 1;
}

function isResidentMarkerEffect(effect: EffectDefinition): boolean {
  return (
    effect.effects.length > 0 &&
    effect.effects.every(
      (primitive) =>
        primitive.type === "grant_keyword" &&
        (primitive.keyword === "resident" || primitive.keyword === "tag"),
    )
  );
}

export function isResidentActivationEffect(effect: EffectDefinition): boolean {
  if (isResidentMarkerEffect(effect)) return false;
  return RUSH_ACTIVATION_TEXT.test(effect.text ?? "");
}

export function listResidentActivationEffects(cardId: string): EffectDefinition[] {
  const doc = getCardDslDocument(cardId);
  if (!doc?.effects) return [];
  return doc.effects.filter(isResidentActivationEffect);
}

export function requiresHandForResidentActivation(cardId: string): boolean {
  const wired = getCardEffect(cardId)?.effectId;
  if (wired === "shiron_light") return true;
  const text = listResidentActivationEffects(cardId)
    .map((effect) => effect.text)
    .join(" ");
  return /手札/.test(text);
}

export function isResidentActivatedThisRush(card: CardInstance): boolean {
  return !!(card.residentActivatedThisRush || card.shironLightUsedThisRush);
}

export function markResidentActivatedThisRush(
  player: PlayerState,
  operationInstanceId: string,
): PlayerState {
  return {
    ...player,
    operation: player.operation.map((card) =>
      card.instanceId === operationInstanceId
        ? { ...card, residentActivatedThisRush: true }
        : card,
    ),
  };
}

export function canActivateResidentOperation(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): boolean {
  if (state.phase !== "rush") return false;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup) {
    return false;
  }

  const player = state.players[playerId];
  const op = player.operation.find((card) => card.instanceId === operationInstanceId);
  if (!op) return false;
  if (isResidentActivatedThisRush(op)) return false;

  const wired = getCardEffect(op.cardId);
  if (wired?.effectId === "shiron_light") {
    return canInitiateShironLight(state, playerId, operationInstanceId);
  }
  if (wired?.effectId === "hidora_egg") {
    return (
      hasOperationEffect(player, "hidora_egg", state.definitions, { state, playerId }) &&
      !isHidoraEggUsed(player) &&
      player.deck.length > 0
    );
  }

  const activationEffects = listResidentActivationEffects(op.cardId);
  if (activationEffects.length === 0) return false;
  if (requiresHandForResidentActivation(op.cardId) && player.hand.length === 0) {
    return false;
  }

  return activationEffects.some((effect) =>
    evaluateDslCondition(
      state,
      playerId,
      effect.condition,
      operationInstanceId,
      effect.effects,
    ),
  );
}

export function hasActivatableResidentOperation(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  return player.operation.some((card) =>
    canActivateResidentOperation(state, playerId, card.instanceId),
  );
}

export function applyActivateResidentOperation(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): { state: GameState; ok: true } | { ok: false; error: string } {
  if (!canActivateResidentOperation(state, playerId, operationInstanceId)) {
    return { ok: false, error: "cannot_activate_resident" };
  }

  const player = state.players[playerId];
  const op = player.operation.find((card) => card.instanceId === operationInstanceId);
  if (!op) return { ok: false, error: "operation_not_found" };

  const wired = getCardEffect(op.cardId);
  if (wired?.effectId === "shiron_light" || wired?.effectId === "hidora_egg") {
    return { ok: false, error: "use_dedicated_action" };
  }

  const activationEffects = listResidentActivationEffects(op.cardId);
  let nextState = state;
  for (const effect of activationEffects) {
    if (
      !evaluateDslCondition(
        nextState,
        playerId,
        effect.condition,
        operationInstanceId,
        effect.effects,
      )
    ) {
      continue;
    }

    let primitives = effect.effects;
    if (primitives.every((p) => p.type === "interpret_effect" || p.type === "fallback_handler")) {
      const rematched = rematchExtractedEffect(effect.text ?? "", {
        trigger: { type: "operation", timing: "rush" },
        cardId: op.cardId,
      });
      if (rematched?.effects?.length) {
        primitives = rematched.effects;
      }
    }

    const ctx: DslCardContext = {
      effectId: effect.id,
      sourceCardId: op.cardId,
      playerId,
      phasePlayerId: playerId,
      operationInstanceId,
      triggerSourceInstanceId: operationInstanceId,
      discardOperation: false,
      optional: effect.optional,
    };

    const outcome = interpretEffectPrimitives(nextState, ctx, primitives);
    nextState = outcome.state;
    if (nextState.pendingEffectChoice) break;
  }

  const updatedPlayer = markResidentActivatedThisRush(
    nextState.players[playerId],
    operationInstanceId,
  );
  return {
    ok: true,
    state: {
      ...nextState,
      ...updatePlayer(nextState, playerId, updatedPlayer),
    },
  };
}

/** 常駐置き場へ配置（wiki: 上限超過時は古いカードから捨札）。 */
export function placePermanentOperation(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): GameState {
  const player = state.players[playerId];
  const limit = permanentOperationSlotLimit(state.definitions, player, card.cardId);
  let operation = [...player.operation];
  let discard = [...player.discard];

  while (operation.length >= limit) {
    const [removed, ...rest] = operation;
    if (!removed) break;
    discard = [...discard, ...operationCardsToDiscardWithStack(removed)];
    operation = rest;
  }

  operation.push(card);

  return {
    ...state,
    ...updatePlayer(state, playerId, { ...player, operation, discard }),
  };
}

export function isPermanentOperationCard(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return isPermanentOperation(getDefinition(definitions, cardId));
}
