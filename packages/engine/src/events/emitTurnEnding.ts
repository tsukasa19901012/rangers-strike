import type { GameState, PlayerId } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { buildTurnEndingEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitTurnEndingAndResolve(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const event = buildTurnEndingEvent({
    state,
    phasePlayerId: endingPlayerId,
    playerId: endingPlayerId,
  });
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return {
    state: withSyncedEffectStack(outcome.state),
    logs: outcome.logs ?? [],
  };
}
