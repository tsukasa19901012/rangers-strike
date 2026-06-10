import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { findInZone, opponent } from "../core/helpers";
import { hasRushCounterReactions } from "./operationCounters";
import { buildUnitRushedEvent } from "../events/builders";
import { EventQueue } from "../events/EventQueue";
import { getEngineEventDispatcher } from "../events/globalDispatcher";
import { resolveUntilBlocked } from "../events/EventResolver";
import { emitUnitRushedAndFinalize } from "../events/emitUnitRushed";

export type RushEffectOutcome = {
  state: GameState;
  logs: string[];
};

/** ラッシュ時に発火するユニット効果（Q10: 疾風カウンターの前）。 */
export const ON_RUSH_EFFECTS: Partial<Record<string, "draw_1">> = {};

/** @deprecated RS-124 は legend3/rushEffects.applySuperRadarOnRush で処理 */
export const ON_ENEMY_RUSH_PERMANENTS: Partial<Record<string, "power_to_hand">> = {};

/**
 * RS-026 カウンターウィンドウを開く前に、ラッシュ起因の効果をすべて解決する。
 * `UnitRushed` イベント経由（後方互換 API）。
 * @see RS-026 Q6/Q10 — ラッシュ効果を先に、その後カウンター。
 */
export function resolveRushTriggeredEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): RushEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state, logs: [] };

  const queue = new EventQueue();
  queue.enqueue(
    buildUnitRushedEvent({
      state,
      phasePlayerId: state.activePlayer,
      rusherPlayerId,
      instanceId: rushedInstanceId,
      cardId: found.card.cardId,
    }),
  );

  const resolved = resolveUntilBlocked(state, queue, getEngineEventDispatcher());
  return { state: resolved.state, logs: resolved.logs };
}

export function openRushCounterWindow(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const defenderId = opponent(rusherPlayerId);
  if (
    !hasRushCounterReactions(
      state,
      defenderId,
      rushedInstanceId,
      rusherPlayerId,
    )
  ) {
    return state;
  }

  return {
    ...state,
    pendingRush: {
      rusherPlayerId,
      rushedInstanceId,
      phasePlayerId,
    },
    activePlayer: defenderId,
  };
}

/** @deprecated applyAction は emitUnitRushedAndFinalize を使用すること。 */
export function finalizeRushAction(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): RushEffectOutcome & { counterPending: boolean } {
  return emitUnitRushedAndFinalize(
    state,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );
}

export function categoriesOverlap(
  a: CardDefinition["category"],
  b: CardDefinition["category"],
): boolean {
  const catsA = Array.isArray(a) ? a : [a];
  const catsB = Array.isArray(b) ? b : [b];
  return catsA.some((c) => catsB.includes(c));
}
