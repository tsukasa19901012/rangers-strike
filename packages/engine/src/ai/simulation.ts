import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { memoizeInSearch } from "../core/searchCache";
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
  /**
   * ルートで評価の高い上位この数の手だけ、その後を簡易 CPU（探索なし）で
   * 相手の次のターンの終わりまで進めてから評価し直す（0／省略で行わない）。
   */
  rolloutTopK?: number;
};

const ROLLOUT_MAX_STEPS = 400;

function mix(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 山札の並びは CPU には見えないので、読みの中では両者の山札を混ぜ直す
 * （本物の並びを使うと、これから引くカードを知っている読みになる）。
 */
function hideDeckOrder(state: GameState, sample = 0): GameState {
  const rng = mix((state.turn * 7919 + state.log.length + sample * 104_729) | 0);
  const shuffled = (deck: GameState["players"]["player1"]["deck"]) => {
    const out = [...deck];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return {
    ...state,
    players: {
      player1: { ...state.players.player1, deck: shuffled(state.players.player1.deck) },
      player2: { ...state.players.player2, deck: shuffled(state.players.player2.deck) },
    },
  };
}

/** 探索なしの CPU で、相手の次のターンが終わるまで（または決着まで）進める。 */
function rollout(state: GameState, playerId: PlayerId, startTurn: number, sample = 0, turns = 2, maxSteps = ROLLOUT_MAX_STEPS): GameState {
  let current = hideDeckOrder(state, sample);
  // turns=2: 自分のターン中なら、残りと相手の次のターン。相手のターン中ならそのターンの終わりまで。
  const endTurn = startTurn + (state.activePlayer === playerId ? turns : Math.max(1, turns - 1));
  for (let i = 0; i < maxSteps; i++) {
    if (current.winner || current.turn >= endTurn) break;
    const legal = getLegalActions(current);
    const actor = legal[0]?.playerId;
    if (!actor) break;
    const action = pickCpuAction(current, actor, { enableSearch: false }) ?? legal[0]!;
    const result = applyAction(current, action);
    if (!result.ok) break;
    current = result.state;
  }
  return current;
}

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
    case "use_magi_ticket":
      return `${action.type}:${action.instanceId}:${action.targetInstanceId ?? ""}:${action.extraInstanceId ?? ""}`;
    case "use_super_shield":
      return `${action.type}:${action.substituteInstanceId ?? ""}`;
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
  // 同じ状態からの読みは同じ結果になる（探索の間だけ使い回す。core/searchCache.ts）。
  return memoizeInSearch(state, `responses:${playerId}:${JSON.stringify(options ?? null)}`, () =>
    resolveOpponentResponsesUncached(state, playerId, options),
  );
}

function resolveOpponentResponsesUncached(
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
  const scored: { action: GameAction; score: number }[] = [];

  for (const action of unique) {
    const score = scoreAction(state, playerId, action, options);
    scored.push({ action, score });
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  const topK = options?.rolloutTopK ?? 0;
  if (topK <= 0 || (options?.simulationDepth ?? 0) > 0 || scored.length < 2) return best;
  if (bestScore >= 100_000) return best;

  // 上位の手だけ先まで進めて比べ直す。
  let rolloutBest = best;
  let rolloutScore = Number.NEGATIVE_INFINITY;
  for (const { action } of scored.sort((a, b) => b.score - a.score).slice(0, topK)) {
    const after = scoreAfterAction(state, playerId, action, options);
    if (!after.ok) continue;
    const score = evaluateState(rollout(after.state, playerId, state.turn), playerId);
    if (score > rolloutScore) {
      rolloutScore = score;
      rolloutBest = action;
    }
  }
  return rolloutBest;
}

/**
 * 手番の大きな決定（チャージ・ラッシュ・バトルへの進入後の行動）を、それぞれの手のあと
 * 探索なしの CPU で相手の次のターンの終わりまで進めて（山札の並びは伏せて samples 通り）比べる。
 */
export function pickBestByRollout(
  state: GameState,
  playerId: PlayerId,
  candidates: GameAction[],
  samples: number,
  turns = 2,
  maxSteps = ROLLOUT_MAX_STEPS,
): GameAction | null {
  const unique = dedupeActions(candidates).filter((a) => a.playerId === playerId);
  if (unique.length <= 1) return unique[0] ?? null;
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of unique) {
    const result = applyAction(state, action);
    if (!result.ok) continue;
    let total = 0;
    for (let i = 0; i < samples; i++) {
      total += evaluateState(rollout(result.state, playerId, state.turn, i, turns, maxSteps), playerId);
    }
    const score = total / samples;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}
