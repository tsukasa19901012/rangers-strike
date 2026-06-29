import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, isUnit } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { updatePlayer } from "../core/helpers";
import { canMoveUnitToBattle } from "../rules/restrictions";
import {
  listRideWithoutRcFeatures,
  riderMatchesVehicleRideWithoutRc,
} from "../dsl/promotedKeywordBridge";

function isVehicle(definitions: Record<string, CardDefinition>, cardId: string): boolean {
  return getDefinition(definitions, cardId)?.type === "vehicle";
}

function riderHasRc(definition: CardDefinition | undefined): boolean {
  return definition?.comboNumber === "RC";
}

function vehicleAlreadyRidden(
  rush: CardInstance[],
  vehicleInstanceId: string,
): boolean {
  return rush.some(
    (c) =>
      c.mountedOnInstanceId === vehicleInstanceId &&
      c.instanceId !== vehicleInstanceId,
  );
}

/** ラッシュ進入時にライド可能な未搭乗ビークル（自軍ラッシュ、未バトル進入）。 */
export function findRideVehicleForRider(
  state: GameState,
  playerId: PlayerId,
  rider: CardInstance,
): CardInstance | null {
  const player = state.players[playerId];
  const riderDef = getDefinition(state.definitions, rider.cardId);
  if (!riderDef || !isUnit(riderDef)) return null;
  if (rider.mountedOnInstanceId) return null;

  const candidates = player.rush.filter((c) => {
    if (c.instanceId === rider.instanceId) return false;
    if (!isVehicle(state.definitions, c.cardId)) return false;
    if (vehicleAlreadyRidden(player.rush, c.instanceId)) return false;
    return true;
  });

  for (const vehicle of candidates) {
    if (riderHasRc(riderDef)) return vehicle;
    if (
      riderMatchesVehicleRideWithoutRc(
        state.definitions,
        vehicle.cardId,
        rider.cardId,
      )
    ) {
      return vehicle;
    }
    const allowed = listRideWithoutRcFeatures(vehicle.cardId);
    if (allowed.length > 0) continue;
  }

  if (riderHasRc(riderDef)) {
    return candidates[0] ?? null;
  }

  return (
    candidates.find((vehicle) =>
      riderMatchesVehicleRideWithoutRc(
        state.definitions,
        vehicle.cardId,
        rider.cardId,
      ),
    ) ?? null
  );
}

/** チェイス等: ライダーが対象ビークルにライド可能か。 */
export function canRiderMountVehicle(
  state: GameState,
  playerId: PlayerId,
  rider: CardInstance,
  vehicleInstanceId: string,
): boolean {
  const player = state.players[playerId];
  const vehicle = findInZone(player, "rush", vehicleInstanceId);
  if (!vehicle) return false;
  if (vehicleAlreadyRidden(player.rush, vehicleInstanceId)) return false;

  const riderDef = getDefinition(state.definitions, rider.cardId);
  if (!riderDef || !isUnit(riderDef)) return false;

  if (riderHasRc(riderDef)) return true;

  if (
    riderMatchesVehicleRideWithoutRc(
      state.definitions,
      vehicle.card.cardId,
      rider.cardId,
    )
  ) {
    return true;
  }

  const allowed = listRideWithoutRcFeatures(vehicle.card.cardId);
  if (allowed.length > 0) return false;

  return false;
}

/** ライド状態を付与（バトル進入前検証用）。 */
export function attachRideIfEligible(
  state: GameState,
  playerId: PlayerId,
  rider: CardInstance,
  rideOff?: boolean,
): CardInstance {
  if (rideOff) {
    if (!rider.mountedOnInstanceId) return rider;
    return { ...rider, mountedOnInstanceId: undefined };
  }
  if (rider.mountedOnInstanceId) return rider;
  const vehicle = findRideVehicleForRider(state, playerId, rider);
  if (!vehicle) return rider;
  return { ...rider, mountedOnInstanceId: vehicle.instanceId };
}

/** バトル進入時ライド — 進入不可ならライドを巻き戻す（ride.md）。 */
export function attachRideForBattleEntry(
  state: GameState,
  playerId: PlayerId,
  rider: CardInstance,
  rideOff?: boolean,
): CardInstance {
  const attached = attachRideIfEligible(state, playerId, rider, rideOff);
  if (rideOff || !attached.mountedOnInstanceId) return attached;
  if (!canMoveUnitToBattle(state, playerId, attached, "rush")) {
    return rider;
  }
  return attached;
}

/** 指定ビークルにライドしてバトル進入できるか（ride.md: 進入不可ならライド無効）。 */
export function canMountRideIntoBattle(
  state: GameState,
  playerId: PlayerId,
  riderInstanceId: string,
  vehicleInstanceId: string,
): boolean {
  const player = state.players[playerId];
  const riderFound = findInZone(player, "rush", riderInstanceId);
  if (!riderFound) return false;
  if (!canRiderMountVehicle(state, playerId, riderFound.card, vehicleInstanceId)) {
    return false;
  }
  const mounted = { ...riderFound.card, mountedOnInstanceId: vehicleInstanceId };
  return canMoveUnitToBattle(state, playerId, mounted, "rush");
}

/** ラッシュ上でユニットをビークルにライド（チェイス等の内部用。通常のライドはバトル進入時）。 */
export function applyMountRide(
  state: GameState,
  playerId: PlayerId,
  riderInstanceId: string,
  vehicleInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const riderFound = findInZone(player, "rush", riderInstanceId);
  const vehicleFound = findInZone(player, "rush", vehicleInstanceId);
  if (!riderFound || !vehicleFound) return null;
  if (!canRiderMountVehicle(state, playerId, riderFound.card, vehicleInstanceId)) {
    return null;
  }

  const rush = [...player.rush];
  rush[riderFound.index] = {
    ...riderFound.card,
    mountedOnInstanceId: vehicleInstanceId,
  };

  return {
    ...state,
    ...updatePlayer(state, playerId, { ...player, rush }),
  };
}

/** ライド中ビークルの instanceId（ラッシュまたはバトル）。 */
export function findMountedVehicle(
  state: GameState,
  playerId: PlayerId,
  rider: CardInstance,
): CardInstance | null {
  if (!rider.mountedOnInstanceId) return null;
  const player = state.players[playerId];
  return (
    findInZone(player, "rush", rider.mountedOnInstanceId)?.card ??
    findInZone(player, "battle", rider.mountedOnInstanceId)?.card ??
    null
  );
}

function riddenVehicleIds(cards: CardInstance[]): Set<string> {
  return new Set(
    cards
      .filter((c) => c.mountedOnInstanceId)
      .map((c) => c.mountedOnInstanceId!),
  );
}

/** 表示用: ライド先ビークルとして重ね表示するカードを rush 一覧から除外。 */
export function rushCardsForDisplay(cards: CardInstance[]): CardInstance[] {
  const ridden = riddenVehicleIds(cards);
  return cards.filter((c) => !ridden.has(c.instanceId));
}

/** 表示用: バトルエリアでもライド先ビークルを一覧から除外。 */
export function battleCardsForDisplay(cards: CardInstance[]): CardInstance[] {
  const ridden = riddenVehicleIds(cards);
  return cards.filter((c) => !ridden.has(c.instanceId));
}

/** ライド中ビークルをラッシュから取り除く（バトル進入時）。 */
export function extractMountedVehicleFromRush(
  rush: CardInstance[],
  vehicleInstanceId: string,
): { rush: CardInstance[]; vehicle: CardInstance | null } {
  const index = rush.findIndex((c) => c.instanceId === vehicleInstanceId);
  if (index < 0) return { rush, vehicle: null };
  const vehicle = rush[index]!;
  const next = [...rush];
  next.splice(index, 1);
  return { rush: next, vehicle };
}
