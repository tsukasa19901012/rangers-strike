import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState, ZoneName } from "../types/game";
import { getDefinition, isUnit } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { updatePlayer } from "../core/helpers";
import { canMoveUnitToBattle } from "../rules/restrictions";
import { getCardDslDocument } from "../dsl/effectLookup";
import {
  listRideWithoutRcFeatures,
  riderMatchesVehicleRideWithoutRc,
} from "../dsl/promotedKeywordBridge";

function isVehicle(definitions: Record<string, CardDefinition>, cardId: string): boolean {
  return getDefinition(definitions, cardId)?.type === "vehicle";
}

function riderHasRc(definition: CardDefinition | undefined): boolean {
  if (!definition) return false;
  if (definition.comboNumber === "RC") return true;
  const doc = getCardDslDocument(definition.id);
  if (doc?.comboNumber === "RC") return true;
  return (
    doc?.effects?.some(
      (effect) =>
        effect.trigger &&
        "type" in effect.trigger &&
        effect.trigger.type === "riding_combo",
    ) ?? false
  );
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
  return (
    findRiddenVehicleInField(state, playerId, rider.mountedOnInstanceId)?.card ?? null
  );
}

/** ライド先ビークルがいるゾーン（ラッシュまたはバトル）。 */
export function findRiddenVehicleInField(
  state: GameState,
  playerId: PlayerId,
  vehicleInstanceId: string,
): { card: CardInstance; zone: "rush" | "battle" } | null {
  const player = state.players[playerId];
  const rush = findInZone(player, "rush", vehicleInstanceId);
  if (rush) return { card: rush.card, zone: "rush" };
  const battle = findInZone(player, "battle", vehicleInstanceId);
  if (battle) return { card: battle.card, zone: "battle" };
  return null;
}

/** ユニット離場時: ライド参照を外し、捨札に載せない。 */
export function sanitizeUnitLeavingField(
  card: CardInstance,
  fromZone: "rush" | "battle",
  toZone: ZoneName,
): CardInstance {
  const next: CardInstance = { ...card };
  if (fromZone === "rush" || fromZone === "battle") {
    if (toZone === "discard" || toZone === "power") {
      delete next.registerHeld;
      delete next.battleActed;
      delete next.mountedOnInstanceId;
      delete next.activatedNcEffects;
    }
  }
  return next;
}

/**
 * ライダーだけが捨札に行ったとき、誤って一緒に捨てられたビークルを元ゾーンへ戻す。
 * atwiki p141 Q7: ライド中ユニットが撃破されてもビークルはその場に残る。
 */
export function restoreMountedVehicleIfMistakenlyDiscarded(
  owner: PlayerState,
  riderBeforeLeave: CardInstance,
  fromZone: "rush" | "battle",
): PlayerState {
  const vehicleId = riderBeforeLeave.mountedOnInstanceId;
  if (!vehicleId) return owner;

  const discardIndex = owner.discard.findIndex((c) => c.instanceId === vehicleId);
  if (discardIndex < 0) return owner;

  const alreadyInField =
    owner[fromZone].some((c) => c.instanceId === vehicleId);
  if (alreadyInField) {
    const discard = owner.discard.filter((c) => c.instanceId !== vehicleId);
    return { ...owner, discard };
  }

  const vehicle = owner.discard[discardIndex]!;
  const discard = owner.discard.filter((c) => c.instanceId !== vehicleId);
  return {
    ...owner,
    discard,
    [fromZone]: [...owner[fromZone], vehicle],
  };
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
