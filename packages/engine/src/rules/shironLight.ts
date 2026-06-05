import { getCardEffect } from "@rangers-strike/cards";
import type {
  GameState,
  PendingEffectChoice,
  PlayerId,
  PlayerState,
} from "../types/game";
import {
  getDefinition,
  hasOperationEffect,
  isUnit,
} from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { openEffectChoice } from "./pendingChoices";

export type ChoiceOutcome =
  | { state: GameState; log?: string; logs?: string[] }
  | { error: string };

export function isShironLightRushTarget(
  player: PlayerState,
  handInstanceId: string,
): boolean {
  return player.shironLightRushInstanceId === handInstanceId;
}

export function hasUnusedShironLightOperation(player: PlayerState): boolean {
  return player.operation.some(
    (card) =>
      getCardEffect(card.cardId)?.effectId === "shiron_light" &&
      !card.shironLightUsedThisRush,
  );
}

export function canInitiateShironLight(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId?: string,
): boolean {
  if (state.phase !== "rush") return false;
  if (state.pendingEffectChoice || state.pendingCommandPayment || state.pendingZordSetup) {
    return false;
  }
  const player = state.players[playerId];
  if (player.hand.length === 0) return false;
  if (!hasOperationEffect(player, "shiron_light", state.definitions, { state, playerId })) {
    return false;
  }
  if (!hasUnusedShironLightOperation(player)) return false;
  if (operationInstanceId) {
    const op = player.operation.find((c) => c.instanceId === operationInstanceId);
    if (!op || getCardEffect(op.cardId)?.effectId !== "shiron_light") return false;
    if (op.shironLightUsedThisRush) return false;
  }
  return true;
}

export function isShironRevealAudience(
  pending: PendingEffectChoice,
  viewerId: PlayerId,
): boolean {
  if (pending.effectId !== "shiron_light" || pending.kind !== "shiron_light") {
    return false;
  }
  const meta = pending.shironLightMeta;
  return meta?.step === "reveal" && (meta.audiencePlayerIds?.includes(viewerId) ?? false);
}

export function canActOnShironChoice(
  pending: PendingEffectChoice,
  playerId: PlayerId,
): boolean {
  return pending.effectId === "shiron_light" && pending.playerId === playerId;
}

function markOperationUsed(
  player: PlayerState,
  operationInstanceId: string,
): PlayerState {
  return {
    ...player,
    operation: player.operation.map((card) =>
      card.instanceId === operationInstanceId
        ? { ...card, shironLightUsedThisRush: true }
        : card,
    ),
  };
}

function finishShironLight(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
  rushInstanceId?: string,
): ChoiceOutcome {
  const ownerId = pending.shironLightMeta?.ownerId ?? pending.phasePlayerId;
  const operationInstanceId = pending.shironLightMeta?.operationInstanceId;
  let owner = state.players[ownerId];
  if (operationInstanceId) {
    owner = markOperationUsed(owner, operationInstanceId);
  }
  if (rushInstanceId) {
    owner = { ...owner, shironLightRushInstanceId: rushInstanceId };
  }
  const log = buildLogEntry(
    ownerId,
    "shiron_light",
    pending.sourceCardId,
    state.definitions,
    detail,
  );
  return {
    state: {
      ...state,
      ...updatePlayer(state, ownerId, owner),
      pendingEffectChoice: undefined,
      activePlayer: ownerId,
    },
    log,
  };
}

export function startShironLightChoice(
  state: GameState,
  ownerId: PlayerId,
  operationInstanceId: string,
): GameState | null {
  if (!canInitiateShironLight(state, ownerId, operationInstanceId)) return null;

  const owner = state.players[ownerId];
  const pickerId = opponent(ownerId);
  const handIds = owner.hand.map((c) => c.instanceId);

  return openEffectChoice(state, {
    playerId: pickerId,
    effectId: "shiron_light",
    sourceCardId: "RS-013",
    sourceInstanceId: operationInstanceId,
    kind: "shiron_light",
    phasePlayerId: ownerId,
    validInstanceIds: handIds,
    shironLightMeta: {
      step: "pick",
      ownerId,
      operationInstanceId,
      audiencePlayerIds: [pickerId, ownerId],
    },
  });
}

export function applyShironPickSelect(
  state: GameState,
  pickerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "shiron_light") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== pickerId) return { error: "wrong_player" };
  const meta = pending.shironLightMeta;
  if (!meta || meta.step !== "pick") return { error: "invalid_step" };
  if (!pending.validInstanceIds.includes(instanceId)) {
    return { error: "invalid_target" };
  }

  const owner = state.players[meta.ownerId];
  const found = findInZone(owner, "hand", instanceId);
  if (!found) return { error: "invalid_target" };

  return {
    state: {
      ...state,
      pendingEffectChoice: {
        ...pending,
        playerId: pickerId,
        validInstanceIds: [],
        viewedInstanceIds: [instanceId],
        shironLightMeta: {
          ...meta,
          step: "reveal",
          pickedInstanceId: instanceId,
        },
      },
      activePlayer: pickerId,
    },
    log: buildLogEntry(
      meta.ownerId,
      "shiron_light",
      pending.sourceCardId,
      state.definitions,
      "picked",
    ),
  };
}

export function applyConfirmShironReveal(
  state: GameState,
  confirmerId: PlayerId,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "shiron_light") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== confirmerId) return { error: "wrong_player" };
  const meta = pending.shironLightMeta;
  if (!meta || meta.step !== "reveal" || !meta.pickedInstanceId) {
    return { error: "invalid_step" };
  }

  const owner = state.players[meta.ownerId];
  const found = findInZone(owner, "hand", meta.pickedInstanceId);
  if (!found) return { error: "invalid_target" };

  const definition = getDefinition(state.definitions, found.card.cardId);
  if (isUnit(definition)) {
    return finishShironLight(
      state,
      pending,
      cardNameOrId(state, found.card.cardId),
      meta.pickedInstanceId,
    );
  }

  return finishShironLight(state, pending, "not_unit");
}

function cardNameOrId(state: GameState, cardId: string): string {
  return getDefinition(state.definitions, cardId)?.name ?? cardId;
}

export function clearShironLightRushTarget(player: PlayerState): PlayerState {
  if (!player.shironLightRushInstanceId) return player;
  return { ...player, shironLightRushInstanceId: undefined };
}
