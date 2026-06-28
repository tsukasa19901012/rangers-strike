import type { GameState, PlayerId } from "../types/game";
import { openEffectChoice } from "./pendingChoices";

let nextGroupSeq = 1;

export function newSimultaneousGroupId(): string {
  return `simul_${nextGroupSeq++}`;
}

/** 同時解決候補の反応フレーム ID（公式優先度とは別にターンプレイヤーが順序を選ぶ）。 */
export function listSimultaneousReactionFrameIds(state: GameState): string[] {
  const ids: string[] = [];
  if (state.pendingLeave) ids.push("pendingLeave");
  if (state.pendingStrike) ids.push("pendingStrike");
  if (state.pendingBattle) ids.push("pendingBattle");
  if (state.pendingRush) ids.push("pendingRush");
  return ids;
}

function simultaneousChoosingPlayer(state: GameState): PlayerId | undefined {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingRush) return state.pendingRush.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  return state.activePlayer;
}

/** 2 件以上の反応窓が同時に開いているときグループ ID を付与。 */
export function ensureSimultaneousReactionGroup(state: GameState): GameState {
  const frameIds = listSimultaneousReactionFrameIds(state);
  if (frameIds.length < 2) {
    const hasStaleState = !!state.activeSimultaneousGroupId || !!state.reactionResolutionOrder;
    if (!hasStaleState) return state;
    return {
      ...state,
      activeSimultaneousGroupId: undefined,
      reactionResolutionOrder: undefined,
    };
  }
  if (state.activeSimultaneousGroupId) return state;
  // Player already chose the resolution order for these frames — don't re-ask
  if (
    state.reactionResolutionOrder &&
    frameIds.every((id) => state.reactionResolutionOrder!.includes(id))
  ) {
    return state;
  }
  return { ...state, activeSimultaneousGroupId: newSimultaneousGroupId() };
}

/** 同時解決グループが 2 件以上あるとき、ターンプレイヤーに順序選択を開く。 */
export function tryOpenSimultaneousOrderChoice(
  state: GameState,
  choosingPlayerId: PlayerId,
): GameState | null {
  if (state.pendingEffectChoice) return null;
  if (!state.activeSimultaneousGroupId) return null;
  const frameIds = listSimultaneousReactionFrameIds(state);
  if (frameIds.length < 2) return null;

  return openEffectChoice(state, {
    playerId: choosingPlayerId,
    effectId: "simultaneous_order",
    sourceCardId: "engine",
    kind: "simultaneous_order",
    phasePlayerId: choosingPlayerId,
    validInstanceIds: frameIds,
    optional: false,
  });
}

export function applySimultaneousOrderChoice(
  state: GameState,
  firstFrameId: string,
): GameState {
  const frameIds = listSimultaneousReactionFrameIds(state);
  if (!frameIds.includes(firstFrameId)) return state;
  const rest = frameIds.filter((id) => id !== firstFrameId);
  return {
    ...state,
    reactionResolutionOrder: [firstFrameId, ...rest],
    activeSimultaneousGroupId: undefined,
  };
}

/** effectStack 同期後に同時順序選択を自動オープン。 */
export function maybeOpenSimultaneousOrderAfterSync(state: GameState): GameState {
  if (state.pendingEffectChoice?.kind === "simultaneous_order") return state;
  const chooser = simultaneousChoosingPlayer(state);
  if (!chooser) return state;
  return tryOpenSimultaneousOrderChoice(state, chooser) ?? state;
}
