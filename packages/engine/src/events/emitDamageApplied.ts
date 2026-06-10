import type { GameState, PlayerId } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { buildDamageAppliedEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitDamageAppliedAndResolve(
  state: GameState,
  input: {
    playerId: PlayerId;
    amount: number;
    source?: string;
    phasePlayerId?: PlayerId;
  },
): GameState {
  const event = buildDamageAppliedEvent({
    state,
    phasePlayerId: input.phasePlayerId,
    playerId: input.playerId,
    amount: input.amount,
    source: input.source,
  });
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return withSyncedEffectStack(outcome.state);
}
