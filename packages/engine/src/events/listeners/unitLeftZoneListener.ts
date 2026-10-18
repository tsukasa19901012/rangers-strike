import type { EventListener, UnitLeftZoneEvent } from "../types";
import { resolveUnitLeftZoneEffectsImpl } from "../../rules/leaveEffects";
import { applyGegeruOnEnemyDestroyed } from "../../rules/residentOps";
import { opponent } from "../../core/helpers";
import { openRk10OmegaDraw } from "../../rules/rk/rk10UnitEffects";

export const unitLeftZoneListener: EventListener = (event, state) => {
  const leaveEvent = event as UnitLeftZoneEvent;
  const result = resolveUnitLeftZoneEffectsImpl(state, {
    ownerPlayerId: leaveEvent.ownerPlayerId,
    instanceId: leaveEvent.instanceId,
    cardId: leaveEvent.cardId,
    fromZone: leaveEvent.fromZone,
    toZone: leaveEvent.toZone,
    phasePlayerId: leaveEvent.phasePlayerId,
    destroyed: leaveEvent.destroyed,
    battleOpponentInstanceId: leaveEvent.battleOpponentInstanceId,
  });
  let nextState = result.state;
  // RK-081 ゲゲル: 敵軍ユニットが（撃破されて）捨札になったとき、撃破側で発火
  if (
    leaveEvent.toZone === "discard" &&
    leaveEvent.destroyed !== false &&
    (leaveEvent.fromZone === "battle" || leaveEvent.fromZone === "rush")
  ) {
    nextState = applyGegeruOnEnemyDestroyed(nextState, opponent(leaveEvent.ownerPlayerId));
    // RK-199 オメガゼール【ゼール種の統率】: 相手は「レイヨウ型」のユニットを撃破したとき、1枚ドローしてもよい（rules/rk/rk10UnitEffects.ts）。
    nextState = openRk10OmegaDraw(nextState, leaveEvent.ownerPlayerId, leaveEvent.cardId, leaveEvent.phasePlayerId ?? nextState.activePlayer);
  }
  return {
    state: nextState,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
