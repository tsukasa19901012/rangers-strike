import type { GameState, PendingBattle } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { applyResidentOpsOnAllyAttacked } from "../rules/residentOps";
import { findInZone, updatePlayer } from "../core/helpers";
import { buildBattleDeclaredEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

export function emitBattleDeclaredAndResolve(
  state: GameState,
  pending: PendingBattle,
): { state: GameState; log: string } {
  // 常駐オペによる「バトルは行われない」（クロックアップ等）。
  // カウンター解決後・バトル解決の直前に適用される（wiki Q&A: 否定文優先）。
  const prevented = applyResidentOpsOnAllyAttacked(state, pending);
  if (prevented?.preventBattle) {
    let next = prevented.state;
    const attackerOwner = next.players[pending.attackerPlayerId];
    const markActed = (cards: typeof attackerOwner.battle) =>
      cards.map((c) =>
        c.instanceId === pending.attackerInstanceId ? { ...c, battleActed: true } : c,
      );
    next = {
      ...next,
      ...updatePlayer(next, pending.attackerPlayerId, {
        ...attackerOwner,
        battle: markActed(attackerOwner.battle),
        rush: markActed(attackerOwner.rush),
      }),
    };
    return {
      state: withSyncedEffectStack(next),
      log: prevented.log ?? "バトルは行われない",
    };
  }

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
