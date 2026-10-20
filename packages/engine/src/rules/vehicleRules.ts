import { hasUnnamedRule } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  getDefinition,
  isSmallUnit,
  isUnit,
  isVehicle,
} from "../core/catalog";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { vehicleMayBattleWithoutRide } from "./bkOperationTurnRules";
import { xg4VehicleEntersWithoutRide } from "./xg4/xg4Fields";
import { xg2VehicleMayEnterUnridden } from "./xg2/xg2Fields";

/** ラッシュ上でこのビークルにライドしているユニットがいるか。 */
export function hasRiderInRush(
  player: PlayerState,
  vehicleInstanceId: string,
): boolean {
  return player.rush.some(
    (c) =>
      c.mountedOnInstanceId === vehicleInstanceId &&
      c.instanceId !== vehicleInstanceId,
  );
}

export function isVehicleCard(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return isVehicle(getDefinition(definitions, cardId));
}

/**
 * ビークルがライドなしでバトルエリアに出られるか（wiki: 基本的にユニットにライドされなければ出られない）。
 * 例外: BK-009 ターン効果、can_enter_battle_without_ride（味方S在戦が条件のカード）。
 */
export function canVehicleEnterBattleFromRush(
  state: GameState,
  playerId: PlayerId,
  vehicle: CardInstance,
): boolean {
  const player = state.players[playerId];
  if (hasRiderInRush(player, vehicle.instanceId)) return false;

  if (vehicleMayBattleWithoutRide(player, vehicle.instanceId)) return true;
  // クロスギャザー ザ・ジェットアクセル XG4-049・XG4-062（条件なし。rules/xg4/xg4Fields.ts）。
  if (xg4VehicleEntersWithoutRide(vehicle.cardId)) return true;
  // XG2-074 クウガゴウラム（自軍「仮面ライダーディケイド」があれば。rules/xg2/xg2Fields.ts）。
  if (xg2VehicleMayEnterUnridden(state, playerId, vehicle)) return true;

  const cardId = vehicle.cardId;
  const maySelfEnter =
    cardHasGrantKeyword(cardId, "can_enter_battle_without_ride") ||
    hasUnnamedRule(cardId, "can_enter_battle_without_ride");
  if (!maySelfEnter) return false;

  return player.battle.some((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def && isUnit(def) && isSmallUnit(state.definitions, c);
  });
}
