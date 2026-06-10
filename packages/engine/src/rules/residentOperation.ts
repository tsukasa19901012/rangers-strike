import type { GameState, PlayerId } from "../types/game";
import { isPermanentOperation } from "../core/catalog";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";

/** 常駐 OP（operation ゾーン）の on_turn_end 効果 — Phase 3 基盤。 */
export function applyResidentOperationTurnEnd(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  let nextState = state;
  for (const card of state.players[endingPlayerId].operation) {
    if (!isPermanentOperation(state.definitions, card.cardId)) continue;
    const result = tryResolveDslTriggeredEffects({
      state: nextState,
      cardId: card.cardId,
      instanceId: card.instanceId,
      playerId: endingPlayerId,
      phasePlayerId: endingPlayerId,
      triggerType: "on_turn_end",
      logAction: "resident_operation",
    });
    nextState = result.state;
    if (nextState.pendingEffectChoice) break;
  }
  return nextState;
}
