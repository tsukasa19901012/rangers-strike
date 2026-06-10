import type { GameState, PendingBattle } from "../../types/game";
import type { EventListener, BattleDeclaredEvent } from "../types";

export type BattlePendingResolver = (
  state: GameState,
  pending: PendingBattle,
) => { state: GameState; log: string };

let battlePendingResolver: BattlePendingResolver | undefined;

export function registerBattlePendingResolver(resolver: BattlePendingResolver): void {
  battlePendingResolver = resolver;
}

export function resetBattlePendingResolverForTests(): void {
  battlePendingResolver = undefined;
}

function requireResolver(): BattlePendingResolver {
  if (!battlePendingResolver) {
    throw new Error("battle pending resolver not registered");
  }
  return battlePendingResolver;
}

/**
 * アタック宣言の解決（BP 比較・撃破・on_attack 系 battleEffects）。
 * 実装本体は `operationCounters.resolveBattlePendingCore`。
 */
export const battleDeclaredListener: EventListener = (event, state) => {
  const battleEvent = event as BattleDeclaredEvent;
  const result = requireResolver()(state, battleEvent.pending);
  return {
    state: result.state,
    logs: [result.log],
  };
};
