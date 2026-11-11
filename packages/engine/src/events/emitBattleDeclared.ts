import type { GameState, PendingBattle } from "../types/game";
import { withSyncedEffectStack } from "../rules/effectStack";
import { applyResidentOpsOnAllyAttacked } from "../rules/residentOps";
import { findInZone } from "../core/helpers";
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
    // バトルは行われない扱い（battleCancelled）で解決し、アタックした側の行動済み・反応ウィンドウ（pendingBattle）の後始末・手番の戻しを
    // 通常のバトル解決と同じ手順で行う。カウンター（隠流忍術等）の反応ウィンドウを経た後でも pendingBattle が残って
    // クロックアップが繰り返し発動しないようにする（atwiki/page-173 Q2・grnrngr/faq-rider-1 RK-021 Q2: 否定文優先でバトルは行われない）。
    const cancelled: PendingBattle = { ...pending, battleCancelled: true };
    const next = prevented.state;
    const event = buildBattleDeclaredEvent({
      state: next,
      phasePlayerId: cancelled.phasePlayerId,
      attackerPlayerId: cancelled.attackerPlayerId,
      attackerInstanceId: cancelled.attackerInstanceId,
      attackerCardId: findInZone(next.players[cancelled.attackerPlayerId], "battle", cancelled.attackerInstanceId)?.card.cardId ?? cancelled.attackerInstanceId,
      defenderPlayerId: cancelled.defenderPlayerId,
      defenderInstanceId: cancelled.defenderInstanceId,
      defenderCardId: cancelled.defenderInstanceId,
      pending: cancelled,
    });
    const outcome = getEngineEventDispatcher().dispatch(event, next);
    return {
      state: withSyncedEffectStack(outcome.state),
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
