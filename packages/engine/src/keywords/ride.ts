import type { CardDefinition } from "@rangers-strike/cards";
import { FEATURE_KEYWORDS } from "../dsl/featureKeywords";
import type { CardInstance, GameState, PlayerId, PlayerState, ZoneName } from "../types/game";
import { getDefinition, isUnit } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { updatePlayer } from "../core/helpers";
import { canMoveUnitToBattle } from "../rules/restrictions";
import { getCardDslDocument } from "../dsl/effectLookup";
import { hasKamenRiderTitle } from "../rules/rk/rk1Features";
import { rk8BlocksMount } from "../rules/rk/rk8UnitEffects";
import {
  cardHasGrantKeyword,
  listCardGrantKeywords,
  listRideWithoutRcFeatures,
  riderMatchesVehicleRideWithoutRc,
  vehicleRideWithoutRcNeedsHold,
} from "../dsl/promotedKeywordBridge";

function isVehicle(definitions: Record<string, CardDefinition>, cardId: string): boolean {
  return getDefinition(definitions, cardId)?.type === "vehicle";
}

/** ライダー側キーワード: RC がなくてもライドできる（XG7-034 等 / SX-004 は「車両」ビークル限定）。 */
function riderKeywordAllowsRide(
  riderCardId: string,
  vehicleDef: CardDefinition | undefined,
): boolean {
  if (cardHasGrantKeyword(riderCardId, "can_ride_vehicle")) return true;
  if (
    cardHasGrantKeyword(riderCardId, FEATURE_KEYWORDS.canRideVehicleCar) &&
    (vehicleDef?.features ?? []).includes("車両")
  ) {
    return true;
  }
  return false;
}

/** ビークル側キーワード: 特徴 X の S ユニットはコマンド1ホールドでライド可（XG4-027/099）。 */
function vehicleFeatureHoldRideFeature(vehicleCardId: string): string | null {
  for (const keyword of listCardGrantKeywords(vehicleCardId)) {
    const match = keyword.match(/^feature_s_ride_vehicle_hold_1_commands::(.+)$/);
    if (match) {
      if (match[1] === "ma") return "マシン";
      if (match[1] === "meka") return "メカ";
      return match[1]!;
    }
  }
  return null;
}

function vehicleRideIsExclusive(
  definitions: Record<string, CardDefinition>,
  vehicleCardId: string,
): boolean {
  return /それ以外のユニットはライドできない/.test(getDefinition(definitions, vehicleCardId)?.text ?? "");
}

/** 「※本来のカテゴリに○○を持つSユニットは、ＲＣを持っていなくてもこのビークルにライドでき」の○○。 */
function vehicleCategoryRideWithoutRc(
  definitions: Record<string, CardDefinition>,
  vehicleCardId: string,
): string | undefined {
  const text = getDefinition(definitions, vehicleCardId)?.text ?? "";
  return text.match(/本来のカテゴリに([A-Z]+)を持つSユニットは、[ＲR][ＣC]を持っていなくてもこのビークルにライドでき/)?.[1];
}

/** 「※○○のSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」（○○はカテゴリ略号）の○○。 */
function vehiclePlainCategoryRideWithoutRc(
  definitions: Record<string, CardDefinition>,
  vehicleCardId: string,
): string | undefined {
  const text = getDefinition(definitions, vehicleCardId)?.text ?? "";
  return text.match(/(?:^|※|\s)(WB|MA|OT|ET|DA)のSユニットは、[ＲR][ＣC]を持っていなくてもこのビークルにライドでき/)?.[1];
}

function riderHasRc(definition: CardDefinition | undefined, rider?: Pick<CardInstance, "stackedCards">): boolean {
  if (!definition) return false;
  // RK-079 仮面ライダーの称号「このカードに重ねたユニットのナンバーはＲＣになり」（atwiki/page-661）。
  if (hasKamenRiderTitle(rider)) return true;
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

/** RS-381: RC を持たないライダーが、コマンドを1つホールドしてライドできるか。 */
function galeoPulsarHoldRideAllowed(state: GameState, playerId: PlayerId, riderDef: CardDefinition): boolean {
  return (
    riderDef.size === "S" &&
    (riderDef.features ?? []).includes("レッド") &&
    state.players[playerId].command.some((cmd) => !cmd.commandHeld)
  );
}

/** RS-381: RC を持たないライダーがガレオパルサーにライドしたら、自軍コマンドを1つホールドする（先頭のリリース状態のもの）。 */
export function holdCommandForGaleoPulsarRide(
  state: GameState,
  playerId: PlayerId,
  riderInstanceId: string,
  vehicleInstanceId: string,
): GameState {
  const player = state.players[playerId];
  const rider = player.battle.find((c) => c.instanceId === riderInstanceId);
  const vehicle = [...player.battle, ...player.rush].find((c) => c.instanceId === vehicleInstanceId);
  if (!rider || !vehicle || vehicle.cardId !== "RS-381" || rider.mountedOnInstanceId !== vehicleInstanceId) return state;
  if (riderHasRc(getDefinition(state.definitions, rider.cardId), rider)) return state;
  const index = player.command.findIndex((c) => !c.commandHeld);
  if (index < 0) return state;
  const command = player.command.map((c, i) => (i === index ? { ...c, commandHeld: true } : c));
  return { ...state, players: { ...state.players, [playerId]: { ...player, command } } };
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
    if (riderHasRc(riderDef, rider)) return vehicle;
    // RS-381 ガレオパルサーは、RC を持たない「レッド」の S ユニットが自軍コマンドを1つホールドしてライドする（mount_ride でホールド）。
    if (vehicle.cardId === "RS-381") {
      if (galeoPulsarHoldRideAllowed(state, playerId, riderDef)) return vehicle;
      continue;
    }
    if (
      riderMatchesVehicleRideWithoutRc(
        state.definitions,
        vehicle.cardId,
        rider.cardId,
      ) &&
      (!vehicleRideWithoutRcNeedsHold(vehicle.cardId) || player.command.some((cmd) => !cmd.commandHeld))
    ) {
      return vehicle;
    }
    if (
      riderKeywordAllowsRide(
        rider.cardId,
        getDefinition(state.definitions, vehicle.cardId),
      )
    ) {
      return vehicle;
    }
    const holdFeature = vehicleFeatureHoldRideFeature(vehicle.cardId);
    if (
      holdFeature &&
      riderDef.size === "S" &&
      (riderDef.features ?? []).includes(holdFeature) &&
      player.command.some((cmd) => !cmd.commandHeld)
    ) {
      return vehicle;
    }
    const allowed = listRideWithoutRcFeatures(vehicle.cardId);
    if (allowed.length > 0) continue;
  }

  if (riderHasRc(riderDef, rider)) {
    return candidates[0] ?? null;
  }

  return (
    candidates.find(
      (vehicle) =>
        riderMatchesVehicleRideWithoutRc(
          state.definitions,
          vehicle.cardId,
          rider.cardId,
        ) &&
        (!vehicleRideWithoutRcNeedsHold(vehicle.cardId) || player.command.some((cmd) => !cmd.commandHeld)),
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
  // RK-166 仮面ライダーG3「※これはホールド状態のときビークルにライドできない。」（rules/rk/rk8UnitEffects.ts）。
  if (rk8BlocksMount(rider)) return false;

  // RS-527 バルジオン（2nd）「※本来のカテゴリにDAを持つSユニットは、ＲＣを持っていなくてもこのビークルに
  // ライドでき、それ以外のユニットはライドできない」（atwiki/page-1156。page-474 Q3）。
  const categoryRide = vehicleCategoryRideWithoutRc(state.definitions, vehicle.card.cardId);
  if (categoryRide) {
    const cats = Array.isArray(riderDef.category) ? riderDef.category : riderDef.category ? [riderDef.category] : [];
    return riderDef.size === "S" && cats.includes(categoryRide as never);
  }

  // ルール: R-KW-RIDE-02 — ビークルに「それ以外のユニットはライドできない」とあれば、
  // RC を持っていても指定外のユニットはライドできない。
  if (vehicleRideIsExclusive(state.definitions, vehicle.card.cardId)) {
    return riderMatchesVehicleRideWithoutRc(state.definitions, vehicle.card.cardId, rider.cardId);
  }

  if (riderHasRc(riderDef, rider)) return true;

  // 「※ETのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。」（RS-393 コマンドアタッカー、atwiki/page-539）
  // 「※DAのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。」（RS-492 炎の騎馬、atwiki/page-815）
  const plainCategoryRide = vehiclePlainCategoryRideWithoutRc(state.definitions, vehicle.card.cardId);
  if (plainCategoryRide && riderDef.size === "S") {
    const cats = Array.isArray(riderDef.category) ? riderDef.category : riderDef.category ? [riderDef.category] : [];
    if (cats.includes(plainCategoryRide as never)) return true;
  }
  // RS-381 ガレオパルサーの※「特徴「レッド」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくても
  // このビークルにライドできる。」（atwiki/page-522）— ホールドできるリリース状態のコマンドが必要（ホールドは mount_ride で行う）。
  if (vehicle.card.cardId === "RS-381") return galeoPulsarHoldRideAllowed(state, playerId, riderDef);

  if (
    riderMatchesVehicleRideWithoutRc(
      state.definitions,
      vehicle.card.cardId,
      rider.cardId,
    )
  ) {
    // RS-381「自軍コマンドを1つホールドすれば」— ホールドできるリリース状態の自軍コマンドが必要。
    if (vehicleRideWithoutRcNeedsHold(vehicle.card.cardId)) {
      return player.command.some((cmd) => !cmd.commandHeld);
    }
    return true;
  }

  if (
    riderKeywordAllowsRide(
      rider.cardId,
      getDefinition(state.definitions, vehicle.card.cardId),
    )
  ) {
    return true;
  }

  const holdFeature = vehicleFeatureHoldRideFeature(vehicle.card.cardId);
  if (
    holdFeature &&
    riderDef.size === "S" &&
    (riderDef.features ?? []).includes(holdFeature) &&
    player.command.some((cmd) => !cmd.commandHeld)
  ) {
    return true;
  }

  const allowed = listRideWithoutRcFeatures(vehicle.card.cardId);
  if (allowed.length > 0) return false;

  return false;
}

/**
 * RC を持たないユニットが「自軍コマンドを1つホールドすれば」ライドできるビークル（RS-381）にライドするとき、
 * ホールドする自軍コマンドが要るか。
 */
export function rideNeedsCommandHold(
  state: GameState,
  rider: CardInstance,
  vehicleCardId: string,
): boolean {
  const riderDef = getDefinition(state.definitions, rider.cardId);
  if (!riderDef || riderHasRc(riderDef, rider)) return false;
  if (riderKeywordAllowsRide(rider.cardId, getDefinition(state.definitions, vehicleCardId))) return false;
  return vehicleRideWithoutRcNeedsHold(vehicleCardId);
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
  // ルール: R-KW-RIDE-03 — すでにライドしているユニットは別のビークルにライドできない。
  if (riderFound.card.mountedOnInstanceId) return false;
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
      delete next.jointComboGrants;
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
