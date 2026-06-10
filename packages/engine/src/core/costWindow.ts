import type { PlayerState } from "../types/game";
import type { CostWindowKind, CostWindowMetadata } from "../types/costWindow";

export type { CostWindow, CostWindowKind, CostWindowMetadata, PlayerCostWindows } from "../types/costWindow";

export function isCostWindowSatisfied(
  player: PlayerState,
  kind: CostWindowKind,
): boolean {
  return player.costWindows?.[kind]?.satisfied === true;
}

export function getCostWindowMetadata(
  player: PlayerState,
  kind: CostWindowKind,
): CostWindowMetadata | undefined {
  return player.costWindows?.[kind]?.metadata;
}

export function satisfyCostWindow(
  player: PlayerState,
  kind: CostWindowKind,
  metadata?: CostWindowMetadata,
): PlayerState {
  const costWindows = {
    ...player.costWindows,
    [kind]: { kind, satisfied: true, metadata },
  };
  return {
    ...player,
    costWindows,
  };
}

export function clearCostWindow(
  player: PlayerState,
  kind: CostWindowKind,
): PlayerState {
  const costWindows = { ...player.costWindows };
  delete costWindows[kind];
  return {
    ...player,
    costWindows: Object.keys(costWindows).length > 0 ? costWindows : undefined,
  };
}

export function clearAllCostWindows(player: PlayerState): PlayerState {
  return {
    ...player,
    costWindows: undefined,
  };
}
