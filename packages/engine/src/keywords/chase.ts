import type { CardInstance, GameState, PendingChase, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { buildSimpleLogEntry } from "../log/formatLog";
import { findInZone, updatePlayer } from "../core/helpers";
import {
  finalizeLeaveReaction,
  type LeaveIntent,
} from "../rules/operationCounters";
import { cardHasKeyword, playerHasChaseUnitInField } from "./cardKeywords";

export function listValidChaseVehicleIds(
  state: GameState,
  pending: PendingChase,
): string[] {
  const player = state.players[pending.chaserPlayerId];
  return pending.validVehicleInstanceIds.filter((instanceId) => {
    if (!findInZone(player, "rush", instanceId)) return false;
    const chaser = findInZone(player, pending.leaveIntent.fromZone, pending.chaserInstanceId);
    if (!chaser) return false;
    return instanceId !== chaser.card.mountedOnInstanceId;
  });
}

export function applyResolveChase(
  state: GameState,
  pending: PendingChase,
  newVehicleInstanceId: string,
): { state: GameState; log: string } {
  if (pending.mode === "vehicle_destroyed") {
    return applyResolveVehicleChase(state, pending, newVehicleInstanceId);
  }

  const playerId = pending.chaserPlayerId;
  const player = state.players[playerId];
  const chaserZone = pending.leaveIntent.fromZone;

  const chaserFound = findInZone(player, chaserZone, pending.chaserInstanceId);
  const oldVehicle = findInZone(player, "rush", pending.targetInstanceId);
  const newVehicle = findInZone(player, "rush", newVehicleInstanceId);

  if (!chaserFound || !oldVehicle || !newVehicle) {
    return { state, log: "" };
  }

  const rushAfterVehicleRemoval = player.rush.filter(
    (c) => c.instanceId !== pending.targetInstanceId,
  );
  const chaserSource =
    chaserZone === "rush" ? rushAfterVehicleRemoval : player[chaserZone];
  const updatedChaserZone = chaserSource.map((c) =>
    c.instanceId === pending.chaserInstanceId
      ? { ...c, mountedOnInstanceId: newVehicleInstanceId }
      : c,
  );

  const nextPlayer =
    chaserZone === "rush"
      ? {
          ...player,
          rush: updatedChaserZone,
          discard: [...player.discard, oldVehicle.card],
        }
      : {
          ...player,
          rush: rushAfterVehicleRemoval,
          [chaserZone]: updatedChaserZone,
          discard: [...player.discard, oldVehicle.card],
        };

  const log = buildSimpleLogEntry(playerId, "resolve_chase", pending.chaserInstanceId);

  return {
    state: {
      ...state,
      pendingChase: undefined,
      activePlayer: pending.phasePlayerId,
      ...updatePlayer(state, playerId, nextPlayer),
      log: [...state.log, log],
    },
    log,
  };
}

export function applyPassChase(state: GameState, pending: PendingChase): GameState {
  if (pending.mode === "vehicle_destroyed") {
    return applyPassVehicleChase(state, pending);
  }
  return finalizeLeaveReaction({ ...state, pendingChase: undefined }, pending.leaveIntent, false);
}

function findChaseRiderOnVehicle(
  state: GameState,
  ownerPlayerId: PlayerId,
  vehicleInstanceId: string,
): { card: CardInstance; zone: "rush" | "battle" } | null {
  const player = state.players[ownerPlayerId];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (
        card.mountedOnInstanceId === vehicleInstanceId &&
        cardHasKeyword(state.definitions, card.cardId, "chase")
      ) {
        return { card, zone };
      }
    }
  }
  return null;
}

/** ビークル破壊時: ライド中チェイスユニットの乗り換え窓。 */
export function buildPendingChaseOnVehicleDestroyed(
  state: GameState,
  intent: LeaveIntent,
): PendingChase | null {
  const def = getDefinition(state.definitions, intent.leavingCardId);
  if (def?.type !== "vehicle" || intent.toZone !== "discard" || intent.fromZone !== "rush") {
    return null;
  }
  if (!playerHasChaseUnitInField(state, intent.ownerPlayerId)) return null;

  const rider = findChaseRiderOnVehicle(state, intent.ownerPlayerId, intent.instanceId);
  if (!rider) return null;

  const player = state.players[intent.ownerPlayerId];
  const validVehicleInstanceIds = player.rush
    .filter(
      (c) =>
        getDefinition(state.definitions, c.cardId)?.type === "vehicle" &&
        c.instanceId !== intent.instanceId,
    )
    .map((c) => c.instanceId);
  if (validVehicleInstanceIds.length === 0) return null;

  return {
    chaserPlayerId: intent.ownerPlayerId,
    chaserInstanceId: rider.card.instanceId,
    targetPlayerId: intent.ownerPlayerId,
    targetInstanceId: intent.instanceId,
    phasePlayerId: intent.phasePlayerId,
    leaveIntent: intent,
    validVehicleInstanceIds,
    mode: "vehicle_destroyed",
  };
}

function applyResolveVehicleChase(
  state: GameState,
  pending: PendingChase,
  newVehicleInstanceId: string,
): { state: GameState; log: string } {
  const playerId = pending.chaserPlayerId;
  const player = state.players[playerId];
  const rider = findChaseRiderOnVehicle(state, playerId, pending.targetInstanceId);
  const oldVehicle = findInZone(player, "rush", pending.targetInstanceId);
  const newVehicle = findInZone(player, "rush", newVehicleInstanceId);
  if (!rider || !oldVehicle || !newVehicle) {
    return { state, log: "" };
  }

  const rushWithoutVehicle = player.rush.filter(
    (c) => c.instanceId !== pending.targetInstanceId,
  );
  const updatedZone = (rider.zone === "rush" ? rushWithoutVehicle : player[rider.zone]).map(
    (c) =>
      c.instanceId === rider.card.instanceId
        ? { ...c, mountedOnInstanceId: newVehicleInstanceId }
        : c,
  );

  const nextPlayer =
    rider.zone === "rush"
      ? {
          ...player,
          rush: updatedZone,
          discard: [...player.discard, oldVehicle.card],
        }
      : {
          ...player,
          rush: rushWithoutVehicle,
          [rider.zone]: updatedZone,
          discard: [...player.discard, oldVehicle.card],
        };

  const log = buildSimpleLogEntry(playerId, "resolve_chase", rider.card.instanceId);
  return {
    state: {
      ...state,
      pendingChase: undefined,
      activePlayer: pending.phasePlayerId,
      ...updatePlayer(state, playerId, nextPlayer),
      log: [...state.log, log],
    },
    log,
  };
}

function applyPassVehicleChase(state: GameState, pending: PendingChase): GameState {
  const playerId = pending.chaserPlayerId;
  const player = state.players[playerId];
  const rider = findChaseRiderOnVehicle(state, playerId, pending.targetInstanceId);
  const oldVehicle = findInZone(player, "rush", pending.targetInstanceId);
  if (!oldVehicle) {
    return { ...state, pendingChase: undefined, activePlayer: pending.phasePlayerId };
  }

  const rushWithoutVehicle = player.rush.filter(
    (c) => c.instanceId !== pending.targetInstanceId,
  );
  let nextPlayer = {
    ...player,
    rush: rushWithoutVehicle,
    discard: [...player.discard, oldVehicle.card],
  };

  if (rider) {
    const updatedZone = nextPlayer[rider.zone].map((c) =>
      c.instanceId === rider.card.instanceId
        ? { ...c, mountedOnInstanceId: undefined }
        : c,
    );
    nextPlayer = { ...nextPlayer, [rider.zone]: updatedZone };
  }

  return {
    ...state,
    pendingChase: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, playerId, nextPlayer),
  };
}

export function buildPendingChaseFromIntent(
  state: GameState,
  intent: LeaveIntent,
): PendingChase | null {
  const owner = state.players[intent.ownerPlayerId];
  const found = findInZone(owner, intent.fromZone, intent.instanceId);
  if (!found?.card.mountedOnInstanceId) return null;

  const validVehicleInstanceIds = owner.rush
    .filter(
      (c) =>
        state.definitions[c.cardId]?.type === "vehicle" &&
        c.instanceId !== found.card.mountedOnInstanceId,
    )
    .map((c) => c.instanceId);

  if (validVehicleInstanceIds.length === 0) return null;

  return {
    chaserPlayerId: intent.ownerPlayerId,
    chaserInstanceId: intent.instanceId,
    targetPlayerId: intent.ownerPlayerId,
    targetInstanceId: found.card.mountedOnInstanceId!,
    phasePlayerId: intent.phasePlayerId,
    leaveIntent: intent,
    validVehicleInstanceIds,
    mode: "rider_leave",
  };
}
