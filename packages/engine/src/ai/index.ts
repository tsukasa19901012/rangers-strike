import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import type { CpuLevel } from "./types";
import { getCpuLevelConfig } from "./types";
import { pickCpuAction as pickCpuActionLevel1, isCpuTurn } from "./level1";
import { withLegalActionsCache } from "../core/legalActions";

export type { CpuLevel, CpuLevelConfig } from "./types";
export { CPU_LEVELS, getCpuLevelConfig } from "./types";
export { isCpuTurn } from "./level1";
export { pickCpuFallbackAction } from "./helpers";
export { evaluateState } from "./scoring";

export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  level: CpuLevel = 1,
): GameAction | null {
  const config = getCpuLevelConfig(level);
  // 探索の間は状態を書き換えないので、同じ状態の合法手の一覧を使い回す（core/legalActions.ts）。
  return withLegalActionsCache(() => pickCpuActionLevel1(state, playerId, config));
}
