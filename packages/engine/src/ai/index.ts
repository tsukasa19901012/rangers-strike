import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import type { CpuLevel } from "./types";
import { getCpuLevelConfig } from "./types";
import { pickCpuAction as pickCpuActionLevel1, isCpuTurn } from "./level1";
import { withSearchCache } from "../core/searchCache";

export type { CpuLevel, CpuLevelConfig } from "./types";
export { CPU_LEVELS, getCpuLevelConfig, setCpuLevelOverrides } from "./types";
export { isCpuTurn } from "./level1";
export { pickCpuFallbackAction } from "./helpers";
export { evaluateState, setEvalWeights, DEFAULT_EVAL_WEIGHTS, type EvalWeights } from "./scoring";

export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  level: CpuLevel = 1,
): GameAction | null {
  const config = getCpuLevelConfig(level);
  // 探索の間は状態を書き換えないので、同じ状態の合法手の一覧・アクションの適用結果を使い回す（core/searchCache.ts）。
  return withSearchCache(() => pickCpuActionLevel1(state, playerId, config));
}
