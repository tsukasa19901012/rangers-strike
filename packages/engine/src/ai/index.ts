import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import type { CpuLevel } from "./types";
import { getCpuLevelConfig } from "./types";
import { pickCpuAction as pickCpuActionLevel1, isCpuTurn } from "./level1";
import { withSearchCache } from "../core/searchCache";
import { isLegalAction } from "../core/legalActions";
import { hideOpponentHand } from "./simulation";
import { getValueEvaluator, heuristicEvaluate, setValueEvaluator } from "./scoring";
import { createValueNet, type ValueNet } from "./valueNet";
import { VALUE_NET_V1 } from "./weights/valueNetV1";

export type { CpuLevel, CpuLevelConfig } from "./types";
export { CPU_LEVELS, getCpuLevelConfig, setCpuLevelOverrides } from "./types";
export { isCpuTurn } from "./level1";
export { pickCpuFallbackAction } from "./helpers";
export { evaluateState, heuristicEvaluate, setEvalWeights, setValueEvaluator, DEFAULT_EVAL_WEIGHTS, type EvalWeights } from "./scoring";
export { createValueNet, type ValueNet, type ValueNetWeights } from "./valueNet";

export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  level: CpuLevel = 1,
): GameAction | null {
  const config = getCpuLevelConfig(level);
  // 探索の間は状態を書き換えないので、同じ状態の合法手の一覧・アクションの適用結果を使い回す（core/searchCache.ts）。
  const pick = () =>
    withSearchCache(() => {
      if (!config.hideOpponentHand || !config.enableSearch) return pickCpuActionLevel1(state, playerId, config);
      // 相手の手札を伏せた盤面で選び、本物の盤面で指せない手（相手の手札のカードを指すものなど）なら、本物の盤面で選び直す。
      const picked = pickCpuActionLevel1(hideOpponentHand(state, playerId), playerId, config);
      return picked && isLegalAction(state, picked) ? picked : pickCpuActionLevel1(state, playerId, config);
    });
  // 対戦台などで評価を外から差し替えているときは、そちらを優先する。
  const blend = config.valueNetBlend ?? 0;
  if (blend <= 0 || getValueEvaluator()) return pick();
  const net = (bundledNet ??= createValueNet(VALUE_NET_V1));
  setValueEvaluator((s, p) => heuristicEvaluate(s, p) + blend * net.evaluate(s, p));
  try {
    return pick();
  } finally {
    setValueEvaluator(null);
  }
}

/** 同梱の価値ネットワーク。初めて使うときに重みを読む。 */
let bundledNet: ValueNet | null = null;
