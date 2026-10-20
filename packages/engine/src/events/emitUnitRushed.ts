import type { EffectRushTrigger, GameState, PlayerId } from "../types/game";
import { findInZone, updatePlayer } from "../core/helpers";
import { effectiveBp } from "../core/catalog";
import type { RushEffectOutcome } from "../rules/rushEffects";
import { openMorphReactionWindow } from "../keywords/morphReaction";
import { openRushCounterWindow } from "../rules/rushEffects";
import { applyPassiveRushTriggers } from "../rules/onRushUnitEffects";
import { markRushedThisTurn } from "../rules/turnModifiers";
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
  options: { silent?: boolean; viaEffect?: boolean } = {},
): RushEffectOutcome & { counterPending: boolean } {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) {
    return { state, logs: [], counterPending: false };
  }

  // ルール: 「ラッシュされた時点」の BP を記録する（「ラッシュしたとき」の BP 修正より前。atwiki/page-424 Q11）。
  state = {
    ...state,
    rushedBpSnapshot: { instanceId: rushedInstanceId, bp: effectiveBp(state, rusherPlayerId, found.card) },
  };
  const queue = new EventQueue();
  queue.enqueue(
    buildUnitRushedEvent({
      state,
      phasePlayerId,
      rusherPlayerId,
      instanceId: rushedInstanceId,
      cardId: found.card.cardId,
      selfEffectsSuppressed: options.silent,
      viaEffect: options.viaEffect,
    }),
  );

  const resolved = resolveUntilBlocked(state, queue, getEngineEventDispatcher());
  if (hasPendingPromptBlockingEffectRush(resolved.state)) {
    // ルール: R-RUSH-30 — 「ラッシュされたとき」の窓は、ラッシュしたユニットの「ラッシュしたとき」の
    // 効果とそれに誘発する処理をすべて終えてから開く。選択待ちが解けたら窓を開く（applyAction の後処理）。
    return {
      state: {
        ...resolved.state,
        effectRushTriggerQueue: [
          { rusherPlayerId, instanceId: rushedInstanceId, phasePlayerId, windowOnly: true },
          ...(resolved.state.effectRushTriggerQueue ?? []),
        ],
      },
      logs: resolved.logs,
      counterPending: false,
    };
  }
  const windows = openRushReactionWindows(resolved.state, rusherPlayerId, rushedInstanceId, phasePlayerId);
  return { state: windows.state, logs: resolved.logs, counterPending: windows.counterPending };
}

/** 「ラッシュされたとき」の窓（モーフ → カウンター）を開く。 */
function openRushReactionWindows(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; counterPending: boolean } {
  // ルール: R-TIME-01 — 「ラッシュしたとき」の効果（選択を含む）をすべて解決したあとの「ラッシュされたとき」。
  // RS-318 ドギー・クルーガー【出動指令】の選択が開けば、それを解決してからモーフ・カウンターの窓を開く
  // （deferredRushReaction → core/applyAction.ts の後処理 openDeferredRushReaction）。
  if (!state.pendingEffectChoice) {
    const passive = applyPassiveRushTriggers(state, rusherPlayerId, rushedInstanceId, phasePlayerId);
    const withLogs =
      passive.logs.length > 0 ? { ...passive.state, log: [...passive.state.log, ...passive.logs] } : passive.state;
    if (hasPendingPromptBlockingEffectRush(withLogs)) {
      return {
        state: { ...withLogs, deferredRushReaction: { rusherPlayerId, rushedInstanceId, phasePlayerId } },
        counterPending: false,
      };
    }
    state = withLogs;
  }
  const beforePending = state.pendingRush;
  const withMorph = openMorphReactionWindow(
    state,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );
  if (withMorph.pendingMorph || withMorph.pendingEffectChoice) {
    return { state: withMorph, counterPending: false };
  }

  const withCounter = openRushCounterWindow(
    withMorph,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );

  return {
    state: withCounter,
    counterPending: !beforePending && !!withCounter.pendingRush,
  };
}

/**
 * 置き換え（モーフ等）でエリアに出たユニットを、applyAction 後処理の効果ラッシュ検出から外す。
 * 置き換え側が「ラッシュしたとき」等を自前で処理する。
 */
export function markFieldEntryHandled(state: GameState, instanceIds: string[]): GameState {
  if (instanceIds.length === 0) return state;
  return {
    ...state,
    fieldEntryHandledIds: [...(state.fieldEntryHandledIds ?? []), ...instanceIds],
  };
}

/** 効果ラッシュの誘発を止める（先に解決すべき操作待ちがある）状態か。 */
export function hasPendingPromptBlockingEffectRush(state: GameState): boolean {
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
    state.pendingStrike ||
    state.winner
  );
}

/**
 * 「ラッシュするとき可能ならバトルエリアに置く」（レッドレーサー等）の自動進入。
 * applyAction 側で登録する（循環 import を避けるため）。
 */
type AutoBattleEntryHandler = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
) => GameState;

let autoBattleEntryHandler: AutoBattleEntryHandler | null = null;

export function registerAutoBattleEntryOnRush(handler: AutoBattleEntryHandler): void {
  autoBattleEntryHandler = handler;
}

export function applyAutoBattleEntryOnRushHook(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  return autoBattleEntryHandler ? autoBattleEntryHandler(state, playerId, instanceId) : state;
}

/**
 * 効果でラッシュエリアに出したユニットの「ラッシュしたとき」誘発と「ラッシュされたとき」カウンター窓。
 * ルール: R-RUSH-01 — 効果でエリアに出たユニットも「ラッシュされた」扱い（ラッシュ記録を付ける）。
 * ルール: R-RUSH-22 — 効果でラッシュしたユニットにも「ラッシュしたとき」は発動し、
 * 「ラッシュされたとき」のカウンターも発動できる（通常ラッシュと同じ `emitUnitRushedAndFinalize`）。
 * ルール: R-RUSH-24 — 「このとき出したユニットの効果は発動しない」効果は `silent` を付ける
 * （出たユニット自身の効果と「可能ならバトルエリアに置く」だけを止める）。
 * ルール: R-RUSH-30 — 窓は「ラッシュしたとき」の効果をすべて終えてから開く。
 *
 * 複数体を出した場合は出した順に処理する。先に解決すべき操作待ち（選択・カウンター窓など）が
 * あれば残りは `effectRushTriggerQueue` に積み、操作待ちが解けた時点（applyAction の後処理）で続ける。
 */
export function finalizeEffectRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceIds: string[],
  phasePlayerId: PlayerId,
  options: { silent?: boolean } = {},
): RushEffectOutcome {
  let owner = state.players[rusherPlayerId];
  for (const instanceId of rushedInstanceIds) {
    owner = markRushedThisTurn(owner, instanceId);
  }
  const marked: GameState = {
    ...state,
    ...updatePlayer(state, rusherPlayerId, owner),
    effectRushTriggerQueue: [
      ...(state.effectRushTriggerQueue ?? []),
      ...rushedInstanceIds.map(
        (instanceId): EffectRushTrigger => ({
          rusherPlayerId,
          instanceId,
          phasePlayerId,
          ...(options.silent ? { silent: true } : {}),
        }),
      ),
    ],
  };
  return drainEffectRushTriggers(marked);
}

/** 積まれた効果ラッシュの誘発を、操作待ちが無い間だけ順に処理する。 */
export function drainEffectRushTriggers(state: GameState): RushEffectOutcome {
  let nextState = state;
  const logs: string[] = [];
  for (let guard = 0; guard < 32; guard += 1) {
    const queue = nextState.effectRushTriggerQueue ?? [];
    if (queue.length === 0) break;
    if (hasPendingPromptBlockingEffectRush(nextState)) break;
    const head = queue[0]!;
    const rest = queue.slice(1);
    nextState = {
      ...nextState,
      effectRushTriggerQueue: rest.length > 0 ? rest : undefined,
    };
    if (!findInZone(nextState.players[head.rusherPlayerId], "rush", head.instanceId)) continue;
    if (head.windowOnly) {
      nextState = openRushReactionWindows(
        nextState,
        head.rusherPlayerId,
        head.instanceId,
        head.phasePlayerId,
      ).state;
      continue;
    }
    // バトルエリアに出たユニットのアタック／ストライク選択待ち（pendingBattleEntry）はイベント解決を
    // 止めるが、「バトルエリアに出たとき」の効果で出したユニットの誘発はその前に解決する。
    const parkedEntry = nextState.pendingBattleEntry;
    const parkedDeferred = nextState.deferredBattleEntry;
    const result = emitUnitRushedAndFinalize(
      parkedEntry || parkedDeferred
        ? { ...nextState, pendingBattleEntry: undefined, deferredBattleEntry: undefined }
        : nextState,
      head.rusherPlayerId,
      head.instanceId,
      head.phasePlayerId,
      { silent: head.silent, viaEffect: true },
    );
    nextState = result.state;
    if (parkedEntry && !nextState.pendingBattleEntry) {
      nextState = { ...nextState, pendingBattleEntry: parkedEntry };
    }
    if (parkedDeferred && !nextState.deferredBattleEntry) {
      nextState = { ...nextState, deferredBattleEntry: parkedDeferred };
    }
    logs.push(...result.logs);
    if (!head.silent && !hasPendingPromptBlockingEffectRush(nextState)) {
      // ルール: R-RUSH-22 — 効果で出したレッドレーサーも「ラッシュするとき可能ならバトルエリアに置く」に従う。
      nextState = applyAutoBattleEntryOnRushHook(nextState, head.rusherPlayerId, head.instanceId);
    }
  }
  if (nextState.effectRushTriggerQueue && nextState.effectRushTriggerQueue.length === 0) {
    nextState = { ...nextState, effectRushTriggerQueue: undefined };
  }
  return { state: nextState, logs };
}

/**
 * 遅らせていた「ラッシュされたとき」の反応（モーフ・カウンター）を、操作待ちがなくなった時点で開く。
 */
export function openDeferredRushReaction(state: GameState): GameState {
  const deferred = state.deferredRushReaction;
  if (!deferred || hasPendingPromptBlockingEffectRush(state)) return state;
  const cleared: GameState = { ...state, deferredRushReaction: undefined };
  const rushed = findInZone(cleared.players[deferred.rusherPlayerId], "rush", deferred.rushedInstanceId);
  if (!rushed) return { ...cleared, activePlayer: deferred.phasePlayerId };
  const withMorph = openMorphReactionWindow(
    { ...cleared, activePlayer: deferred.phasePlayerId },
    deferred.rusherPlayerId,
    deferred.rushedInstanceId,
    deferred.phasePlayerId,
  );
  if (withMorph.pendingMorph || withMorph.pendingEffectChoice) return withMorph;
  return openRushCounterWindow(
    withMorph,
    deferred.rusherPlayerId,
    deferred.rushedInstanceId,
    deferred.phasePlayerId,
  );
}
