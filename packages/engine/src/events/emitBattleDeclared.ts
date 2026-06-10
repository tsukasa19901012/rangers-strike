import type { GameState, PendingBattle } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { findInZone } from "../core/helpers";
import { buildBattleDeclaredEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitBattleDeclaredAndResolve(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  const defenderOwner = pending.defenderPlayerId;
  const defenderZone = findInZone(
    state.players[defenderOwner],
    "rush",
    pending.defenderInstanceId,
  )
    ? "rush"
    : "battle";
  const defender = findInZone(
    state.players[defenderOwner],
    defenderZone,
    pending.defenderInstanceId,
  );

  const event = buildBattleDeclaredEvent({
    state,
    phasePlayerId: pending.phasePlayerId,
    attackerPlayerId: pending.attackerPlayerId,
    attackerInstanceId: pending.attackerInstanceId,
    attackerCardId: attacker?.card.cardId ?? pending.attackerInstanceId,
    defenderPlayerId: pending.defenderPlayerId,
    defenderInstanceId: pending.defenderInstanceId,
    defenderCardId: defender?.card.cardId ?? pending.defenderInstanceId,
    pending,
  });

  // 解決時点で pendingBattle / pendingBattleEntry が開いていることがあるため、
  // resolveUntilBlocked ではなく直接 dispatch する（旧 resolveBattlePending と同義）。
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return {
    state: withSyncedEffectStack(outcome.state),
    log: outcome.logs?.[0] ?? "",
  };
}
