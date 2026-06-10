import type { EventListener, StrikeDeclaredEvent } from "../types";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";

/**
 * StrikeDeclared: on_strike DSL 効果（RS-067 等）。
 * 反応窓は applyAction が Pending で開く。
 */
export const strikeDeclaredListener: EventListener = (event, state) => {
  const strikeEvent = event as StrikeDeclaredEvent;
  const striker = state.players[strikeEvent.strikerPlayerId];
  const card = striker.battle.find((c) => c.instanceId === strikeEvent.strikerInstanceId);
  if (!card) return { state };

  const result = tryResolveDslTriggeredEffects({
    state,
    cardId: card.cardId,
    instanceId: card.instanceId,
    playerId: strikeEvent.strikerPlayerId,
    phasePlayerId: strikeEvent.phasePlayerId,
    triggerType: "on_strike",
    logAction: "strike_effect",
  });

  return {
    state: result.state,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
