import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { getPlayerModifiers } from "../core/scopedModifiers";

const MIRROR_RIDER_RULE = "mirror_rider_power_minus";
const ACCELERATE_WAIVE_RULE = "accelerate_s_rush_waive";
const VEHICLE_BATTLE_RULE = "vehicle_battle_without_ride";

export function addMirrorRiderPowerMinusRule(
  player: PlayerState,
  sourceCardId?: string,
): PlayerState {
  if (getPlayerModifiers(player).some((m) => m.kind === "rule" && m.ruleId === MIRROR_RIDER_RULE)) {
    return player;
  }
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      { kind: "rule", ruleId: MIRROR_RIDER_RULE, scope: "turn", sourceCardId },
    ],
  };
}

export function addAccelerateRushWaiveRule(
  player: PlayerState,
  sourceCardId?: string,
): PlayerState {
  if (getPlayerModifiers(player).some((m) => m.kind === "rule" && m.ruleId === ACCELERATE_WAIVE_RULE)) {
    return player;
  }
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      { kind: "rule", ruleId: ACCELERATE_WAIVE_RULE, scope: "turn", sourceCardId },
    ],
  };
}

export function markVehicleBattleWithoutRide(
  player: PlayerState,
  vehicleInstanceId: string,
): PlayerState {
  return {
    ...player,
    modifiers: [
      ...getPlayerModifiers(player),
      {
        kind: "restriction",
        instanceId: vehicleInstanceId,
        restriction: VEHICLE_BATTLE_RULE,
        scope: "turn",
      },
    ],
  };
}

export function hasMirrorRiderPowerMinusRule(player: PlayerState): boolean {
  return getPlayerModifiers(player).some(
    (m) => m.kind === "rule" && m.ruleId === MIRROR_RIDER_RULE && m.scope === "turn",
  );
}

export function hasAccelerateRushWaiveRule(player: PlayerState): boolean {
  return getPlayerModifiers(player).some(
    (m) => m.kind === "rule" && m.ruleId === ACCELERATE_WAIVE_RULE && m.scope === "turn",
  );
}

export function vehicleMayBattleWithoutRide(player: PlayerState, instanceId: string): boolean {
  return getPlayerModifiers(player).some(
    (m) =>
      m.kind === "restriction" &&
      m.restriction === VEHICLE_BATTLE_RULE &&
      m.instanceId === instanceId &&
      m.scope === "turn",
  );
}

export function isAccelerateRushWaived(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!hasAccelerateRushWaiveRule(state.players[playerId])) return false;
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return false;
  if (!(def.features ?? []).includes("加速")) return false;
  if ((def.bp ?? 0) > 2000) return false;
  return true;
}

export function rushAdditionalConditionApplies(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const definition = getDefinition(state.definitions, cardId);
  if (!definition || !resolveRushAdditionalCondition(cardId, definition)) return false;
  return !isAccelerateRushWaived(state, playerId, cardId);
}

export function countMirrorMonstersOnField(state: GameState, player: PlayerState): number {
  let count = 0;
  for (const zone of ["rush", "battle", "command"] as const) {
    for (const card of player[zone]) {
      const def = getDefinition(state.definitions, card.cardId);
      if ((def?.features ?? []).includes("ミラーモンスター")) count += 1;
    }
  }
  return count;
}
