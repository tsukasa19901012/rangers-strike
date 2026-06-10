import type { EventListener, DamageAppliedEvent } from "../types";
import { applyPostDamageTriggers } from "../../rules/postDamageEffects";

export const damageAppliedListener: EventListener = (event, state) => {
  const damageEvent = event as DamageAppliedEvent;
  const nextState = applyPostDamageTriggers(state, damageEvent.playerId);
  return { state: nextState };
};
