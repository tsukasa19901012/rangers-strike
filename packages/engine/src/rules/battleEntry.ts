import type { GameState, PendingBattleEntry, PlayerId } from "../types/game";
import { continueEnterBattleEffects } from "./combo";

export function createBattleEntryPrompt(
  playerId: PlayerId,
  instanceId: string,
  resumeEnterBattle?: PendingBattleEntry["resumeEnterBattle"],
): PendingBattleEntry {
  return {
    playerId,
    instanceId,
    phasePlayerId: playerId,
    resumeEnterBattle,
  };
}

/** After move_to_battle + enter effects: open action prompt or defer through effect choice. */
export function afterEnterBattle(state: GameState, entry: PendingBattleEntry): GameState {
  if (state.pendingEffectChoice) {
    return { ...state, deferredBattleEntry: entry };
  }
  return {
    ...state,
    pendingBattleEntry: entry,
    activePlayer: entry.playerId,
  };
}

export function promoteDeferredBattleEntry(state: GameState): GameState {
  if (!state.deferredBattleEntry || state.pendingEffectChoice) return state;

  const entry = state.deferredBattleEntry;
  let nextState: GameState = { ...state, deferredBattleEntry: undefined };

  if (entry.resumeEnterBattle) {
    const continued = continueEnterBattleEffects(nextState, entry);
    nextState = {
      ...continued.state,
      log: [...continued.state.log, ...continued.logs],
    };
    if (nextState.pendingEffectChoice && continued.enterResumeFrom) {
      return afterEnterBattle(nextState, {
        playerId: entry.playerId,
        instanceId: entry.instanceId,
        phasePlayerId: entry.phasePlayerId,
        resumeEnterBattle: {
          ...entry.resumeEnterBattle,
          from: continued.enterResumeFrom,
        },
      });
    }
  }

  return {
    ...nextState,
    pendingBattleEntry: {
      playerId: entry.playerId,
      instanceId: entry.instanceId,
      phasePlayerId: entry.phasePlayerId,
    },
    activePlayer: entry.playerId,
  };
}

export function finishBattleEntryIf(state: GameState, instanceId: string): GameState {
  const entry = state.pendingBattleEntry;
  if (!entry || entry.instanceId !== instanceId) return state;
  return {
    ...state,
    pendingBattleEntry: undefined,
    activePlayer: entry.phasePlayerId,
  };
}

export function hasPendingBattleEntry(state: GameState): boolean {
  return !!state.pendingBattleEntry;
}
