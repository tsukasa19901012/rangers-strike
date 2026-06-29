import { getRidingComboEffect } from "@rangers-strike/cards";
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

/** move_to_battle + 進入効果の後: アクションプロンプトを開くか、効果選択を経由して延期。 */
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

/** ライド中かつ RC ありなら、バトルアクション前にライドオフ選択を挟む。 */
export function shouldPromptRideOffChoice(
  state: GameState,
  entry: PendingBattleEntry,
): boolean {
  const unit = state.players[entry.playerId].battle.find(
    (c) => c.instanceId === entry.instanceId,
  );
  if (!unit?.mountedOnInstanceId) return false;
  return !!getRidingComboEffect(unit.cardId);
}

/** 進入効果完了後: ライドオフ選択またはバトルアクションプロンプトへ。 */
export function openBattleEntryOrRideOffChoice(
  state: GameState,
  entry: PendingBattleEntry,
): GameState {
  if (state.pendingEffectChoice) {
    return { ...state, deferredBattleEntry: entry };
  }
  if (shouldPromptRideOffChoice(state, entry)) {
    const unit = state.players[entry.playerId].battle.find(
      (c) => c.instanceId === entry.instanceId,
    )!;
    return {
      ...state,
      pendingRideOffChoice: {
        playerId: entry.playerId,
        instanceId: entry.instanceId,
        phasePlayerId: entry.phasePlayerId,
        vehicleInstanceId: unit.mountedOnInstanceId!,
        battleEntry: entry,
      },
      activePlayer: entry.playerId,
    };
  }
  return afterEnterBattle(state, entry);
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

  return openBattleEntryOrRideOffChoice(nextState, {
    playerId: entry.playerId,
    instanceId: entry.instanceId,
    phasePlayerId: entry.phasePlayerId,
    resumeEnterBattle: entry.resumeEnterBattle,
    requiredDefenderInstanceId: entry.requiredDefenderInstanceId,
  });
}

export function hasBlockingPendingInteraction(state: GameState): boolean {
  return !!(
    state.pendingDamagePayment ||
    state.pendingLeave ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingRideOffChoice ||
    state.pendingChase
  );
}

/** ダメージ支払いなど別プレイヤーへの操作委譲中は activePlayer を上書きしない。 */
export function restorePhaseActivePlayerUnlessBlocked(
  state: GameState,
  phasePlayerId: PlayerId,
): GameState {
  if (hasBlockingPendingInteraction(state)) {
    return state;
  }
  return { ...state, activePlayer: phasePlayerId };
}

export function finishBattleEntryIf(state: GameState, instanceId: string): GameState {
  const entry = state.pendingBattleEntry;
  if (!entry || entry.instanceId !== instanceId) return state;
  const cleared: GameState = { ...state, pendingBattleEntry: undefined };
  return restorePhaseActivePlayerUnlessBlocked(cleared, entry.phasePlayerId);
}

export function hasPendingBattleEntry(state: GameState): boolean {
  return !!state.pendingBattleEntry;
}
