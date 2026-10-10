/**
 * 「ストライクしてダメージを与えたとき」の誘発（R-TIME-01）。
 *
 * 5つのタイミング（atwiki/page-1828）では「～したとき」は行動のあと。「ストライクしてダメージを与えたとき」は
 * ストライクの宣言（「ストライクしたとき」）ではなく、ストライクのダメージを与えたあとに発動する。
 * DSL では on_strike に載っているので、ストライク宣言時（events/listeners/strikeDeclaredListener.ts）には解決せず、
 * ダメージを与えたあと（core/applyAction.ts finishStrikeResolution）にここで解決する。
 * ダメージが無効になった・0点のときは発動しない。
 */
import type { GameState, PendingStrike } from "../types/game";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";

const STRIKE_DAMAGE_DEALT_RE = /ストライク(?:して|で)ダメージを与えたとき/;

/** 効果文が「（これが）ストライクしてダメージを与えたとき」の誘発か。 */
export function isStrikeDamageDealtTriggerText(text: string | undefined): boolean {
  return !!text && STRIKE_DAMAGE_DEALT_RE.test(text);
}

/** ストライクのダメージを与えたあと: ストライクしたユニットの「ストライクしてダメージを与えたとき」（DSL on_strike）。 */
export function applyStrikeDamageDealtDslTriggers(state: GameState, pending: PendingStrike): GameState {
  if (state.winner || pending.damageCancelled || pending.damage <= 0) return state;
  if (state.pendingEffectChoice || state.pendingDamagePayment) return state;
  const striker = state.players[pending.strikerPlayerId].battle.find(
    (c) => c.instanceId === pending.strikerInstanceId,
  );
  if (!striker) return state;
  const result = tryResolveDslTriggeredEffects({
    state,
    cardId: striker.cardId,
    instanceId: striker.instanceId,
    playerId: pending.strikerPlayerId,
    phasePlayerId: pending.battlePhasePlayer,
    triggerType: "on_strike",
    logAction: "strike_effect",
    effectFilter: (effect) => isStrikeDamageDealtTriggerText(effect.text),
  });
  return result.logs.length > 0 ? { ...result.state, log: [...result.state.log, ...result.logs] } : result.state;
}
