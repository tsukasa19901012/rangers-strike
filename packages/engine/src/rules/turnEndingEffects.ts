import type { GameState, PlayerId } from "../types/game";
import { applyAdventureEndTurn } from "./turnModifiers";
import { applyOnTurnEndBattleEffects } from "./legend2/destroyEffects";
import { applyResidentOperationTurnEnd } from "./residentOperation";
import { applyRocketBoosterEndTurnRushReturn } from "./rocketBooster";

/** TurnEnding リスナー本体: ターン終了時の常駐・バトル効果。 */
export function resolveTurnEndingEffectsImpl(
  state: GameState,
  endingPlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  let nextState = applyAdventureEndTurn(state, endingPlayerId);
  if (!nextState.pendingEffectChoice) {
    nextState = applyResidentOperationTurnEnd(nextState, endingPlayerId);
  }
  nextState = applyOnTurnEndBattleEffects(nextState, endingPlayerId);
  nextState = applyRocketBoosterEndTurnRushReturn(nextState, endingPlayerId);
  return { state: nextState, logs: [] };
}
