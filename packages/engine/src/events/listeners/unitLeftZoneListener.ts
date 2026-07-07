import type { EventListener, UnitLeftZoneEvent } from "../types";
import { resolveUnitLeftZoneEffectsImpl } from "../../rules/leaveEffects";
import { applyGegeruOnEnemyDestroyed } from "../../rules/residentOps";
import { opponent } from "../../core/helpers";

export const unitLeftZoneListener: EventListener = (event, state) => {
  const leaveEvent = event as UnitLeftZoneEvent;
  const result = resolveUnitLeftZoneEffectsImpl(state, {
    ownerPlayerId: leaveEvent.ownerPlayerId,
    instanceId: leaveEvent.instanceId,
    cardId: leaveEvent.cardId,
    fromZone: leaveEvent.fromZone,
    toZone: leaveEvent.toZone,
    phasePlayerId: leaveEvent.phasePlayerId,
  });
  let nextState = result.state;
  // RK-081 ゲゲル: 敵軍ユニットが（撃破されて）捨札になったとき、撃破側で発火
  if (
    leaveEvent.toZone === "discard" &&
    (leaveEvent.fromZone === "battle" || leaveEvent.fromZone === "rush")
  ) {
    nextState = applyGegeruOnEnemyDestroyed(nextState, opponent(leaveEvent.ownerPlayerId));
  }
  return {
    state: nextState,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
