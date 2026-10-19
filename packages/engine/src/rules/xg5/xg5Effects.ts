/**
 * クロスギャザー XG5 XG5-001〜XG5-096 のカード固有の効果の入口（中央のファイルからはこのモジュールだけを読み込む）。
 *
 * - `tryXg5CardEffect`: DSL の grant_keyword から呼ばれる起点（`xg5::cardId::name`。dsl/grantKeyword.ts）。
 * - `isXg5ChoiceEffect` / `tryResolveXg5Choice` / `trySkipXg5Choice` / `tryConfirmXg5Choice` / `canConfirmXg5Choice`: 選択の解決
 *   （rules/pendingChoices.ts・core/legalActions.ts）。
 * - `applyXg5AfterAction`: applyAction の後処理（core/applyAction.ts）。
 * - `applyXg5StrikeResolved`: ストライクの処理を終えたとき（core/applyAction.ts finishStrikeResolution）。
 * カードごとの処理は xg5aEffects.ts（XG5-001〜020）・xg5bEffects.ts（021〜040）・xg5cEffects.ts（041〜060）・xg5dEffects.ts（061〜080）・
 * xg5eEffects.ts（081〜096）。継続効果の判定は xg5Fields.ts。
 */
import type { GameState, PendingStrike } from "../../types/game";
import { type ApplyActionFn, AFTER_ACTION_HOOKS, STRIKE_RESOLVED_HOOKS, WATCH_HANDLERS } from "./xg5Core";
import { xg5Busy } from "./xg5Shared";
import "./xg5aEffects";

export { activateXg5HandEffect, listXg5HandActivations } from "./xg5Core";
export { canConfirmXg5Choice, isXg5ChoiceEffect, tryConfirmXg5Choice, tryResolveXg5Choice, trySkipXg5Choice, tryXg5CardEffect } from "./xg5Core";

/** 効果のラッシュを終えたら、「出した…そうしたとき」の続きを処理する。 */
function settleWatches(state: GameState): GameState {
  const watches = state.xg5?.watches;
  if (!watches?.length || xg5Busy(state)) return state;
  let next: GameState = { ...state, xg5: { ...state.xg5, watches: undefined } };
  for (const w of watches) {
    const p = next.players[w.playerId];
    const field = new Set([...p.rush, ...p.battle].map((c) => c.instanceId));
    const entered = w.candidates.filter((id) => field.has(id));
    const handler = WATCH_HANDLERS[w.kind];
    if (handler) next = handler(next, w, entered);
  }
  return next;
}

export function applyXg5AfterAction(before: GameState, after: GameState, apply: ApplyActionFn): GameState {
  let next = settleWatches(after);
  for (const hook of AFTER_ACTION_HOOKS) next = hook(before, next, apply);
  return next;
}

export function applyXg5StrikeResolved(state: GameState, pending: PendingStrike): GameState {
  let next = state;
  for (const hook of STRIKE_RESOLVED_HOOKS) next = hook(next, pending);
  return next;
}
