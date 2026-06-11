import { applyAction } from "../core/applyAction";
import { getLegalActions, isLegalAction } from "../core/legalActions";
import { pickCpuAction, type CpuLevel } from "../ai/index";
import type { GameAction } from "../types/actions";
import type { GameState, Phase, PlayerId } from "../types/game";
import { WIN_DAMAGE } from "../types/game";
import {
  collectEffectResolutionMetrics,
  type EffectResolutionTrace,
} from "./effectResolutionMetrics";

export type StarterMatchStopReason =
  | "winner"
  | "no_legal_actions"
  | "apply_failed"
  | "step_limit";

export type StarterMatchResult = {
  state: GameState;
  steps: number;
  reason: StarterMatchStopReason;
  error?: string;
  trace: {
    phasesSeen: Set<Phase>;
    actionCounts: Record<string, number>;
    strikes: number;
    battles: number;
    winType?: "damage" | "deck_out" | "unknown";
    effectResolution: EffectResolutionTrace;
  };
};

function buildTrace(
  phasesSeen: Set<Phase>,
  actionCounts: Record<string, number>,
  strikes: number,
  battles: number,
  log: string[],
  winType?: "damage" | "deck_out" | "unknown",
): StarterMatchResult["trace"] {
  return {
    phasesSeen,
    actionCounts,
    strikes,
    battles,
    winType,
    effectResolution: collectEffectResolutionMetrics(log),
  };
}

function classifyWin(state: GameState): "damage" | "deck_out" | "unknown" {
  if (!state.winner) return "unknown";
  const loser: PlayerId = state.winner === "player1" ? "player2" : "player1";
  if (state.players[loser].damage >= WIN_DAMAGE) return "damage";
  if (state.players[loser].deck.length === 0) return "deck_out";
  return "unknown";
}

/**
 * CPU ヒューリスティックで双方を進め、勝敗または停止条件まで進める。
 */
export function playStarterMatchUntilEnd(
  initial: GameState,
  options: { maxSteps?: number; cpuLevel?: CpuLevel } = {},
): StarterMatchResult {
  const maxSteps = options.maxSteps ?? 12_000;
  const cpuLevel = options.cpuLevel ?? 1;
  let state = initial;
  const phasesSeen = new Set<Phase>();
  const actionCounts: Record<string, number> = {};
  let strikes = 0;
  let battles = 0;

  for (let steps = 0; steps < maxSteps; steps += 1) {
    phasesSeen.add(state.phase);

    if (state.winner) {
      return {
        state,
        steps,
        reason: "winner",
        trace: buildTrace(
          phasesSeen,
          actionCounts,
          strikes,
          battles,
          state.log,
          classifyWin(state),
        ),
      };
    }

    const actions = getLegalActions(state);
    if (actions.length === 0) {
      return {
        state,
        steps,
        reason: "no_legal_actions",
        trace: buildTrace(phasesSeen, actionCounts, strikes, battles, state.log),
      };
    }

    const actor = actions[0]!.playerId;
    const picked = pickCpuAction(state, actor, cpuLevel);
    const action: GameAction =
      picked && isLegalAction(state, picked) ? picked : actions[0]!;

    actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1;
    if (action.type === "strike") strikes += 1;
    if (action.type === "battle") battles += 1;

    const result = applyAction(state, action);
    if (
      !result.ok &&
      action.type === "resolve_command_payment" &&
      state.pendingCommandPayment?.playerId === action.playerId
    ) {
      const cancelled = applyAction(state, {
        type: "cancel_command_payment",
        playerId: action.playerId,
      });
      if (cancelled.ok) {
        state = cancelled.state;
        actionCounts.cancel_command_payment =
          (actionCounts.cancel_command_payment ?? 0) + 1;
        continue;
      }
    }
    if (!result.ok) {
      return {
        state,
        steps,
        reason: "apply_failed",
        error: result.error,
        trace: buildTrace(phasesSeen, actionCounts, strikes, battles, state.log),
      };
    }
    state = result.state;
  }

  return {
    state,
    steps: maxSteps,
    reason: "step_limit",
    trace: buildTrace(phasesSeen, actionCounts, strikes, battles, state.log),
  };
}
