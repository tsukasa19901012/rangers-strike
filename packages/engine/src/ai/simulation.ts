import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { quickActionPriority } from "./helpers";
import { isCpuTurn, pickCpuAction, type PickCpuActionOptions } from "./level1";
import { evaluateState } from "./scoring";

export type SearchOptions = {
  maxCandidates?: number;
  maxResponseDepth?: number;
  /** 探索の入れ子深さ。1以上で相手応答はヒューリスティックのみ（再帰防止）。 */
  simulationDepth?: number;
};

const DEFAULT_MAX_CANDIDATES = 50;
const DEFAULT_MAX_RESPONSE_DEPTH = 100;
const OPPONENT_SEARCH_MAX_CANDIDATES = 10;
const OPPONENT_SEARCH_MAX_RESPONSE_DEPTH = 3;

function actionKey(action: GameAction): string {
  switch (action.type) {
    case "battle":
      return `${action.type}:${action.attackerInstanceId}:${action.defenderInstanceId}`;
    case "rush":
      const holds = [...(action.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
      return `${action.type}:${action.instanceId}:${action.zordMaterialInstanceId ?? ""}:${action.zordMaterialDestination ?? ""}:${holds}`;
    case "play_operation":
      return `${action.type}:${action.instanceId}:${action.targetInstanceId ?? ""}:${action.extraInstanceId ?? ""}`;
    case "move_to_battle":
      return `${action.type}:${action.instanceId}:${action.rideOff ?? false}`;
    case "five_tech_intercept":
      return `${action.type}:${action.interceptInstanceId}`;
    case "play_counter":
      return `${action.type}:${action.instanceId}:${action.substituteInstanceId ?? ""}`;
    case "resolve_effect_choice":
      return `${action.type}:${action.instanceId}`;
    case "resolve_ruin_survey":
      return `${action.type}:${action.placement}`;
    default:
      if ("instanceId" in action) {
        return `${action.type}:${action.instanceId}`;
      }
      return action.type;
  }
}

export function dedupeActions(actions: GameAction[]): GameAction[] {
  const seen = new Set<string>();
  const unique: GameAction[] = [];
  for (const action of actions) {
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(action);
  }
  return unique;
}

function opponentSearchOptions(
  options: SearchOptions | undefined,
  simulationDepth: number,
): PickCpuActionOptions {
  if (simulationDepth >= 1) {
    return { enableSearch: false };
  }

  const maxCandidates = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const maxResponseDepth = options?.maxResponseDepth ?? DEFAULT_MAX_RESPONSE_DEPTH;
  if (maxCandidates <= 0 || maxResponseDepth <= 0) {
    return { enableSearch: false };
  }

  return {
    enableSearch: true,
    maxCandidates: Math.min(OPPONENT_SEARCH_MAX_CANDIDATES, maxCandidates),
    maxResponseDepth: Math.min(OPPONENT_SEARCH_MAX_RESPONSE_DEPTH, maxResponseDepth),
    simulationDepth: simulationDepth + 1,
  };
}

/** 相手のリアクションウィンドウを解決。浅い探索で相手の最善手も考慮する。 */
export function resolveOpponentResponses(
  state: GameState,
  playerId: PlayerId,
  options?: SearchOptions,
): GameState {
  let current = state;
  const enemyId = playerId === "player1" ? "player2" : "player1";
  const maxDepth = options?.maxResponseDepth ?? DEFAULT_MAX_RESPONSE_DEPTH;
  const simulationDepth = options?.simulationDepth ?? 0;
  const opponentOptions = opponentSearchOptions(options, simulationDepth);

  for (let i = 0; i < maxDepth; i++) {
    if (current.winner) return current;
    if (!isCpuTurn(current, enemyId)) break;

    const action = pickCpuAction(current, enemyId, opponentOptions);
    if (!action) break;

    const result = applyAction(current, action);
    if (!result.ok) break;
    current = result.state;
  }

  return current;
}

export function scoreAction(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
  options?: SearchOptions,
): number {
  const result = applyAction(state, action);
  if (!result.ok) return Number.NEGATIVE_INFINITY;
  const resolved = resolveOpponentResponses(result.state, playerId, {
    ...options,
    simulationDepth: options?.simulationDepth ?? 0,
  });
  return evaluateState(resolved, playerId);
}

export function rankCandidatesForSearch(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  options?: SearchOptions,
): GameAction[] {
  const maxCandidates = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  return dedupeActions(candidates)
    .sort(
      (a, b) =>
        quickActionPriority(state, playerId, b) - quickActionPriority(state, playerId, a),
    )
    .slice(0, maxCandidates);
}

export function pickBestBySearch(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  options?: SearchOptions,
): GameAction | null {
  const unique = rankCandidatesForSearch(state, playerId, candidates, options);
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of unique) {
    const score = scoreAction(state, playerId, action, options);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}
