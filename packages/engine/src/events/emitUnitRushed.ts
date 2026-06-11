import type { GameState, PlayerId } from "../types/game";
import { findInZone } from "../core/helpers";
import type { RushEffectOutcome } from "../rules/rushEffects";
import { openMorphReactionWindow } from "../keywords/morphReaction";
import { openRushCounterWindow } from "../rules/rushEffects";
import { buildUnitRushedEvent } from "./builders";
import { EventQueue } from "./EventQueue";
import { getEngineEventDispatcher } from "./globalDispatcher";
import { resolveUntilBlocked } from "./EventResolver";

/**
 * ラッシュ配置後に `UnitRushed` を発火し、効果解決後にカウンター窓を開く。
 * applyAction の rush 経路はこの関数を経由する（直接 finalizeRushAction を呼ばない）。
 */
export function emitUnitRushedAndFinalize(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): RushEffectOutcome & { counterPending: boolean } {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) {
    return { state, logs: [], counterPending: false };
  }

  const queue = new EventQueue();
  queue.enqueue(
    buildUnitRushedEvent({
      state,
      phasePlayerId,
      rusherPlayerId,
      instanceId: rushedInstanceId,
      cardId: found.card.cardId,
    }),
  );

  const resolved = resolveUntilBlocked(state, queue, getEngineEventDispatcher());
  const beforePending = resolved.state.pendingRush;
  const withMorph = openMorphReactionWindow(
    resolved.state,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );
  if (
    withMorph.pendingMorph ||
    withMorph.pendingEffectChoice?.effectId === "morph_replacement"
  ) {
    return {
      state: withMorph,
      logs: resolved.logs,
      counterPending: false,
    };
  }

  const withCounter = openRushCounterWindow(
    withMorph,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );

  return {
    state: withCounter,
    logs: resolved.logs,
    counterPending: !beforePending && !!withCounter.pendingRush,
  };
}
