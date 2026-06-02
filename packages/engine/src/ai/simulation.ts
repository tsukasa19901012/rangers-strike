import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { quickActionPriority } from "./helpers";
import { isCpuTurn, pickCpuAction } from "./level1";
import { evaluateState } from "./scoring";

const MAX_CANDIDATES = 42;
const MAX_RESPONSE_DEPTH = 10;

function actionKey(action: GameAction): string {
  switch (action.type) {
    case "battle":
      return `${action.type}:${action.attackerInstanceId}:${action.defenderInstanceId}`;
    case "rush":
      return `${action.type}:${action.instanceId}:${action.zordMaterialInstanceId ?? ""}`;
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

/** Resolve opponent reaction windows using heuristics (no nested simulation). */
export function resolveOpponentResponses(
  state: GameState,
  playerId: PlayerId,
): GameState {
  let current = state;
  const enemyId = playerId === "player1" ? "player2" : "player1";

  for (let i = 0; i < MAX_RESPONSE_DEPTH; i++) {
    if (current.winner) return current;
    if (!isCpuTurn(current, enemyId)) break;

    const action = pickCpuAction(current, enemyId, { enableSearch: false });
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
): number {
  const result = applyAction(state, action);
  if (!result.ok) return Number.NEGATIVE_INFINITY;
  const resolved = resolveOpponentResponses(result.state, playerId);
  return evaluateState(resolved, playerId);
}

export function rankCandidatesForSearch(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
): GameAction[] {
  return dedupeActions(candidates)
    .sort(
      (a, b) =>
        quickActionPriority(state, playerId, b) - quickActionPriority(state, playerId, a),
    )
    .slice(0, MAX_CANDIDATES);
}

export function pickBestBySearch(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
): GameAction | null {
  const unique = rankCandidatesForSearch(state, playerId, candidates);
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of unique) {
    const score = scoreAction(state, playerId, action);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}
