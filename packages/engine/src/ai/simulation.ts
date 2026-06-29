import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { opponent } from "../core/helpers";
import { quickActionPriority } from "./helpers";
import { isCpuTurn, pickCpuAction, type PickCpuActionOptions } from "./level1";
import { evaluateState } from "./scoring";

export type SearchOptions = {
  maxCandidates?: number;
  maxResponseDepth?: number;
  /** 探索の入れ子深さ。1以上で相手応答は浅い探索に切り替え（再帰防止）。 */
  simulationDepth?: number;
  /** 2以上で相手の次手まで読む（ルートのみ）。 */
  searchPly?: number;
};

const DEFAULT_MAX_CANDIDATES = 64;
const DEFAULT_MAX_RESPONSE_DEPTH = 28;
const OPPONENT_SEARCH_MAX_CANDIDATES = 16;
const OPPONENT_SEARCH_MAX_RESPONSE_DEPTH = 6;
const INNER_PLY_CANDIDATE_RATIO = 0.38;

function actionKey(action: GameAction): string {
  switch (action.type) {
    case "battle":
      return `${action.type}:${action.attackerInstanceId}:${action.defenderInstanceId}`;
    case "rush": {
      const holds = [...(action.zordMothershipHoldInstanceIds ?? [])].sort().join(",");
      return `${action.type}:${action.instanceId}:${action.zordMaterialInstanceId ?? ""}:${action.zordMaterialDestination ?? ""}:${holds}`;
    }
    case "mount_ride":
      return `${action.type}:${action.riderInstanceId}:${action.vehicleInstanceId}`;
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

function innerCandidateLimit(options: SearchOptions | undefined): number {
  const maxCandidates = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  return Math.max(
    8,
    Math.min(OPPONENT_SEARCH_MAX_CANDIDATES, Math.floor(maxCandidates * INNER_PLY_CANDIDATE_RATIO)),
  );
}

function opponentSearchOptions(
  options: SearchOptions | undefined,
  simulationDepth: number,
): PickCpuActionOptions {
  if (simulationDepth >= 2) {
    return { enableSearch: false };
  }

  const maxCandidates = options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const maxResponseDepth = options?.maxResponseDepth ?? DEFAULT_MAX_RESPONSE_DEPTH;
  if (maxCandidates <= 0 || maxResponseDepth <= 0) {
    return { enableSearch: false };
  }

  const innerCandidates = innerCandidateLimit(options);
  const innerDepth = Math.min(
    OPPONENT_SEARCH_MAX_RESPONSE_DEPTH,
    Math.max(4, Math.floor(maxResponseDepth * 0.45)),
  );

  return {
    enableSearch: true,
    maxCandidates: innerCandidates,
    maxResponseDepth: innerDepth,
    searchPly: 1,
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

export function rankCandidatesForSearch(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  options?: SearchOptions,
  candidateCap?: number,
): GameAction[] {
  const maxCandidates = candidateCap ?? options?.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  return dedupeActions(candidates)
    .filter((action) => action.playerId === playerId)
    .sort(
      (a, b) =>
        quickActionPriority(state, playerId, b) - quickActionPriority(state, playerId, a),
    )
    .slice(0, maxCandidates);
}

function scoreAfterAction(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
  options?: SearchOptions,
): { ok: true; state: GameState } | { ok: false } {
  const result = applyAction(state, action);
  if (!result.ok) return { ok: false };
  const resolved = resolveOpponentResponses(result.state, playerId, {
    ...options,
    simulationDepth: options?.simulationDepth ?? 0,
  });
  return { ok: true, state: resolved };
}

/** 相手の応手を読む 2-ply 評価（非再帰・ルート専用）。 */
function scoreActionWithOpponentReply(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
  options: SearchOptions,
): number {
  const after = scoreAfterAction(state, playerId, action, options);
  if (!after.ok) return Number.NEGATIVE_INFINITY;
  if (after.state.winner) return evaluateState(after.state, playerId);

  const enemyId = opponent(playerId);
  const enemyLegal = getLegalActions(after.state).filter((a) => a.playerId === enemyId);
  const enemyCandidates = rankCandidatesForSearch(
    after.state,
    enemyId,
    enemyLegal,
    options,
    innerCandidateLimit(options),
  );

  if (enemyCandidates.length === 0) {
    return evaluateState(after.state, playerId);
  }

  let worst = Number.POSITIVE_INFINITY;
  for (const reply of enemyCandidates) {
    const afterReply = scoreAfterAction(after.state, enemyId, reply, {
      ...options,
      simulationDepth: 1,
      searchPly: 1,
    });
    const score = afterReply.ok
      ? evaluateState(afterReply.state, playerId)
      : evaluateState(after.state, playerId);
    worst = Math.min(worst, score);
  }

  return worst;
}

function scoreActionShallow(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
  options?: SearchOptions,
): number {
  const after = scoreAfterAction(state, playerId, action, options);
  if (!after.ok) return Number.NEGATIVE_INFINITY;
  return evaluateState(after.state, playerId);
}

export function scoreAction(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
  options?: SearchOptions,
): number {
  const ply = options?.searchPly ?? 1;
  const simDepth = options?.simulationDepth ?? 0;
  if (ply > 1 && simDepth === 0) {
    return scoreActionWithOpponentReply(state, playerId, action, options ?? { searchPly: ply });
  }
  return scoreActionShallow(state, playerId, action, options);
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
