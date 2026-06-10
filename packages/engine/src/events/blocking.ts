import type { GameState } from "../types/game";
import { hasOpenEffectStack } from "../rules/effectStack";

/**
 * Event 解決ループを停止すべきか。
 * Pending が正 — EffectStack 導出 + スタック外ブロックを含む。
 */
export function shouldStopEventResolution(state: GameState): boolean {
  if (state.winner) return true;
  if (hasOpenEffectStack(state)) return true;
  if (state.deferredBattleEntry) return true;
  if ((state.pendingBattleToRushQueue?.length ?? 0) > 0) return true;
  return false;
}

export type EventResolutionStopReason =
  | "queue_empty"
  | "pending_blocked"
  | "winner"
  | "listener_stop"
  | "max_iterations";

export function resolutionStopReason(
  state: GameState,
  queueEmpty: boolean,
  listenerStopped: boolean,
  hitMaxIterations: boolean,
): EventResolutionStopReason {
  if (hitMaxIterations) return "max_iterations";
  if (listenerStopped) return "listener_stop";
  if (state.winner) return "winner";
  if (!queueEmpty && shouldStopEventResolution(state)) return "pending_blocked";
  if (queueEmpty) return "queue_empty";
  return "pending_blocked";
}
