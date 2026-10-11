import type { EventListener, StrikeDeclaredEvent } from "../types";
import { tryResolveDslTriggeredEffects } from "../../dsl/triggerResolver";
import { isStrikeDamageDealtTriggerText } from "../../rules/strikeDamageTriggers";
import { openHamsterStrikeDraw } from "../../rules/legend1/set7NamedEffectsC";

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
    // ルール: R-TIME-01 — 「ストライクしてダメージを与えたとき」はダメージのあと（rules/strikeDamageTriggers.ts）。
    effectFilter: (effect) => !isStrikeDamageDealtTriggerText(effect.text),
  });

  // RS-485 ハムスター館長【疾風流の継承】: 特徴「忍者」を持つユニットがストライクしたとき、その持ち主は1枚ドローしてもよい。
  const hamster = openHamsterStrikeDraw(result.state, strikeEvent.strikerPlayerId, card);

  return {
    state: hamster,
    logs: result.logs.length > 0 ? result.logs : undefined,
  };
};
