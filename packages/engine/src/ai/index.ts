import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import type { CpuLevel } from "./types";
import { getCpuLevelConfig } from "./types";
import { pickCpuAction as pickCpuActionLevel1, isCpuTurn } from "./level1";

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
  return pickCpuActionLevel1(state, playerId, config);
}
