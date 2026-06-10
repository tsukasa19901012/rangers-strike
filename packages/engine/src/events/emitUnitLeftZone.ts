import type { GameState, PlayerId } from "../types/game";
import type { ZoneName } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { buildUnitLeftZoneEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitUnitLeftZoneAndResolve(
  state: GameState,
  input: {
    ownerPlayerId: PlayerId;
    instanceId: string;
    cardId: string;
    fromZone: "rush" | "battle";
    toZone: ZoneName;
    phasePlayerId: PlayerId;
  },
): { state: GameState; logs: string[] } {
  const event = buildUnitLeftZoneEvent({
    state,
    phasePlayerId: input.phasePlayerId,
    ownerPlayerId: input.ownerPlayerId,
    instanceId: input.instanceId,
    cardId: input.cardId,
    fromZone: input.fromZone,
    toZone: input.toZone,
  });
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return {
    state: withSyncedEffectStack(outcome.state),
    logs: outcome.logs ?? [],
  };
}
