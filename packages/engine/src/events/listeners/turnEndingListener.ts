import type { EventListener, TurnEndingEvent } from "../types";
import { resolveTurnEndingEffectsImpl } from "../../rules/turnEndingEffects";

export const turnEndingListener: EventListener = (event, state) => {
  const turnEvent = event as TurnEndingEvent;
  return resolveTurnEndingEffectsImpl(state, turnEvent.playerId);
};
