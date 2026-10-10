import type { GameState, PlayerId } from "../types/game";
import { findInZone } from "../core/helpers";
import type { RushEffectOutcome } from "../rules/rushEffects";
import { openMorphReactionWindow } from "../keywords/morphReaction";
import { openRushCounterWindow } from "../rules/rushEffects";
import { buildUnitRushedEvent } from "./builders";
import { EventQueue } from "./EventQueue";
import { getEngineEventDispatcher } from "./globalDispatcher";
import { resolveUntilBlocked } from "./EventResolver";

/**
 * ラッシュ配置後に `UnitRushed` を発火し、効果解決後にカウンター窓を開く。
 * applyAction の rush 経路はこの関数を経由する（直接 finalizeRushAction を呼ばない）。
 */
export function emitUnitRushedAndFinalize(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): RushEffectOutcome & { counterPending: boolean } {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) {
    return { state, logs: [], counterPending: false };
  }

  const queue = new EventQueue();
  queue.enqueue(
    buildUnitRushedEvent({
      state,
      phasePlayerId,
      rusherPlayerId,
      instanceId: rushedInstanceId,
      cardId: found.card.cardId,
    }),
  );

  const resolved = resolveUntilBlocked(state, queue, getEngineEventDispatcher());
  const beforePending = resolved.state.pendingRush;
  const withMorph = openMorphReactionWindow(
    resolved.state,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );
  if (withMorph.pendingMorph || withMorph.pendingEffectChoice) {
    return {
      state: withMorph,
      logs: resolved.logs,
      counterPending: false,
    };
  }

  const withCounter = openRushCounterWindow(
    withMorph,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );

  return {
    state: withCounter,
    logs: resolved.logs,
    counterPending: !beforePending && !!withCounter.pendingRush,
  };
}

/** 効果ラッシュの誘発を止める（先に解決すべき操作待ちがある）状態か。 */
function hasPendingPromptBlockingEffectRush(state: GameState): boolean {
  return !!(
    state.pendingDamagePayment ||
    state.pendingLeave ||
    state.pendingEffectChoice ||
    state.pendingCommandPayment ||
    state.pendingZordSetup ||
    state.pendingRideOffChoice ||
    state.pendingChase ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingRegister ||
    state.pendingBattle ||
    state.pendingStrike
  );
}

/**
 * 効果でラッシュエリアに出したユニットの「ラッシュしたとき」誘発と「ラッシュされたとき」カウンター窓。
 * ルール: R-RUSH-22 — 効果でラッシュしたユニットにも「ラッシュしたとき」は発動し、
 * 「ラッシュされたとき」のカウンターも発動できる（通常ラッシュと同じ `emitUnitRushedAndFinalize`）。
 * ルール: R-RUSH-24 — 「このとき出したユニットの効果は発動しない」効果からは呼ばないこと。
 *
 * 複数体を出した場合は出した順に処理し、カウンター窓や選択待ちが開いたら残りの誘発は行わない
 * （R-RUSH-23 の「1体ずつ出す」は呼び出し側が未対応のため）。操作待ちが残っている状態では何もしない。
 */
export function finalizeEffectRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceIds: string[],
  phasePlayerId: PlayerId,
): RushEffectOutcome {
  let nextState = state;
  const logs: string[] = [];
  for (const instanceId of rushedInstanceIds) {
    if (hasPendingPromptBlockingEffectRush(nextState)) break;
    const result = emitUnitRushedAndFinalize(nextState, rusherPlayerId, instanceId, phasePlayerId);
    nextState = result.state;
    logs.push(...result.logs);
  }
  return { state: nextState, logs };
}
