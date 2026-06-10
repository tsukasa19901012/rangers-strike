import type { EventListener, UnitLeftZoneEvent } from "../types";
import { resolveUnitLeftZoneEffectsImpl } from "../../rules/leaveEffects";

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
  return {
    state: result.state,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
