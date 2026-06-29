import { hasToPowerOnDestroyNote } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PendingLeave } from "../types/game";
import { updatePlayer } from "../core/helpers";
import { emitUnitLeftZoneAndResolve } from "../events/emitUnitLeftZone";
import { buildLogEntry } from "../log/formatLog";
import { returnFusionPartnersFromDiscard } from "./fusionReturn";

export function shouldOfferToPowerOnDestroy(pending: PendingLeave): boolean {
  if (pending.toZone !== "discard") return false;
  if (pending.fromZone !== "battle") return false;
  if (pending.phasePlayerId === pending.ownerPlayerId) return false;
  return hasToPowerOnDestroyNote(pending.leavingCardId);
}

/** フィールドから除去済みのカードで任意パワー送り選択を開く。 */
export function startToPowerOnDestroyChoice(
  state: GameState,
  pending: PendingLeave,
  card: CardInstance,
  fromCards: CardInstance[],
): GameState {
  const owner = state.players[pending.ownerPlayerId];
  const nextOwner = {
    ...owner,
    [pending.fromZone]: fromCards,
  };
  return {
    ...state,
    pendingLeave: undefined,
    pendingEffectChoice: {
      playerId: pending.ownerPlayerId,
      effectId: "to_power_on_destroy",
      sourceCardId: pending.leavingCardId,
      sourceInstanceId: pending.instanceId,
      kind: "confirm",
      phasePlayerId: pending.phasePlayerId,
      validInstanceIds: ["place_in_power"],
      optional: true,
      selectedInstanceIds: [],
      toPowerOnDestroyMeta: {
        card,
        fromZone: pending.fromZone,
        pendingLeave: pending,
      },
    },
    activePlayer: pending.ownerPlayerId,
    ...updatePlayer(state, pending.ownerPlayerId, nextOwner),
  };
}

export function completeToPowerOnDestroyChoice(
  state: GameState,
  pending: PendingEffectChoice,
  placeInPower: boolean,
): { state: GameState; log: string } {
  const meta = pending.toPowerOnDestroyMeta;
  if (!meta) {
    return {
      state,
      log: buildLogEntry(
        pending.playerId,
        placeInPower ? "resolve_effect_choice" : "skip_effect_choice",
        pending.sourceCardId,
        state.definitions,
        "to_power_on_destroy:invalid_meta",
      ),
    };
  }

  const leave = meta.pendingLeave;
  const owner = state.players[leave.ownerPlayerId];
  const card = meta.card;
  const toZone = placeInPower ? "power" : "discard";
  const nextOwner = placeInPower
    ? { ...owner, power: [...owner.power, { ...card, faceDown: false }] }
    : { ...owner, discard: [...owner.discard, card] };

  let nextState: GameState = {
    ...state,
    pendingEffectChoice: undefined,
    activePlayer: leave.phasePlayerId,
    ...updatePlayer(state, leave.ownerPlayerId, nextOwner),
  };

  const leaveFx = emitUnitLeftZoneAndResolve(nextState, {
    ownerPlayerId: leave.ownerPlayerId,
    instanceId: leave.instanceId,
    cardId: card.cardId,
    fromZone: meta.fromZone,
    toZone,
    phasePlayerId: leave.phasePlayerId,
  });

  let resolvedState = leaveFx.state;
  if (
    leave.fusionReturnOnDiscard === "battle" &&
    toZone === "discard" &&
    nextOwner.discard.some((c) => c.instanceId === leave.instanceId)
  ) {
    resolvedState = returnFusionPartnersFromDiscard(
      resolvedState,
      leave.ownerPlayerId,
      card.cardId,
      "battle",
    );
  }

  const log = buildLogEntry(
    pending.playerId,
    placeInPower ? "resolve_effect_choice" : "skip_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `to_power_on_destroy:${toZone}`,
  );

  return {
    state: {
      ...resolvedState,
      log: [...resolvedState.log, ...leaveFx.logs, log],
    },
    log,
  };
}
