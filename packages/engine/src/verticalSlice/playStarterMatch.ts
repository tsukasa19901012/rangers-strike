import { applyAction } from "../core/applyAction";
import { getActionPlayerId, getLegalActions, isLegalAction } from "../core/legalActions";
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

function stallFingerprint(state: GameState): string {
  const payment = state.pendingCommandPayment;
  return JSON.stringify({
    phase: state.phase,
    paymentSource: payment?.sourceInstanceId ?? null,
    zordVehicle: state.pendingZordSetup?.zordInstanceId ?? null,
    effect: state.pendingEffectChoice?.effectId ?? null,
    battleEntry: state.pendingBattleEntry?.instanceId ?? null,
  });
}

function forceStallRecovery(state: GameState, actor: PlayerId): GameAction | null {
  if (state.phase === "rush" || state.phase === "start") {
    const endPhase = getLegalActions(state).find((a) => a.type === "end_phase");
    if (endPhase) return endPhase;
    const draw = getLegalActions(state).find((a) => a.type === "draw");
    if (draw) return draw;
  }
  if (state.pendingCommandPayment?.playerId === actor) {
    return { type: "cancel_command_payment", playerId: actor };
  }
  if (state.pendingZordSetup?.playerId === actor) {
    return { type: "cancel_zord_setup", playerId: actor };
  }
  if (state.pendingEffectChoice?.playerId === actor && state.pendingEffectChoice.optional) {
    return { type: "skip_effect_choice", playerId: actor };
  }
  if (state.pendingBattleEntry?.playerId === actor) {
    return { type: "pass_battle_entry", playerId: actor };
  }
  const endPhase = getLegalActions(state).find((a) => a.type === "end_phase");
  if (endPhase) return endPhase;
  return null;
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
  let blockedRushPaymentSourceId: string | undefined;
  const blockedPaymentSources = new Set<string>();
  const blockedZordInstances = new Set<string>();
  let rushPaymentLoopCount = 0;
  let zordSetupLoopCount = 0;
  let lastRushPaymentSource: string | null = null;
  let lastZordVehicleId: string | null = null;
  let lastFingerprint = "";
  let sameFingerprintCount = 0;

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

    const actor = getActionPlayerId(state);
    const fingerprint = stallFingerprint(state);
    if (fingerprint === lastFingerprint) {
      sameFingerprintCount += 1;
    } else {
      sameFingerprintCount = 0;
      lastFingerprint = fingerprint;
    }

    let action: GameAction;
    if (
      rushPaymentLoopCount >= 8 &&
      state.phase === "rush" &&
      state.pendingCommandPayment
    ) {
      const cancel = actions.find(
        (a) =>
          a.type === "cancel_command_payment" &&
          isLegalAction(state, a) &&
          applyAction(state, a).ok,
      );
      const endPhase = actions.find((a) => a.type === "end_phase");
      action = cancel ?? endPhase ?? actions[0]!;
      rushPaymentLoopCount = 0;
    } else if (
      zordSetupLoopCount >= 8 &&
      state.pendingZordSetup &&
      state.pendingZordSetup.playerId === actor
    ) {
      const cancel = actions.find(
        (a) =>
          a.type === "cancel_zord_setup" &&
          isLegalAction(state, a) &&
          applyAction(state, a).ok,
      );
      action = cancel ?? actions[0]!;
      zordSetupLoopCount = 0;
    } else if (sameFingerprintCount > 40) {
      const forced = forceStallRecovery(state, actor);
      action =
        forced && isLegalAction(state, forced) && applyAction(state, forced).ok
          ? forced
          : actions[0]!;
      sameFingerprintCount = 0;
    } else {
      const picked = pickCpuAction(state, actor, cpuLevel);
      action = picked && isLegalAction(state, picked) ? picked : actions[0]!;
    }

    if (
      action.type === "begin_zord_setup" &&
      blockedZordInstances.has(action.zordInstanceId)
    ) {
      const fallback = actions.find(
        (candidate) =>
          candidate.type !== "begin_zord_setup" ||
          !blockedZordInstances.has(
            (candidate as { zordInstanceId?: string }).zordInstanceId ?? "",
          ),
      );
      if (fallback) action = fallback;
    }

    if (
      (blockedRushPaymentSourceId &&
        action.type === "initiate_command_payment" &&
        action.sourceInstanceId === blockedRushPaymentSourceId) ||
      (action.type === "initiate_command_payment" &&
        blockedPaymentSources.has(action.sourceInstanceId))
    ) {
      const fallback = actions.find(
        (candidate) =>
          candidate.type !== "initiate_command_payment" ||
          (!blockedPaymentSources.has(candidate.sourceInstanceId) &&
            candidate.sourceInstanceId !== blockedRushPaymentSourceId),
      );
      if (fallback) action = fallback;
      blockedRushPaymentSourceId = undefined;
    }

    actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1;
    if (action.type === "strike") strikes += 1;
    if (action.type === "battle") battles += 1;

    const result = applyAction(state, action);
    if (
      action.type === "cancel_command_payment" &&
      state.pendingCommandPayment?.sourceInstanceId
    ) {
      blockedPaymentSources.add(state.pendingCommandPayment.sourceInstanceId);
    }
    if (action.type === "cancel_zord_setup" && state.pendingZordSetup) {
      blockedZordInstances.add(state.pendingZordSetup.zordInstanceId);
    }
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
        const sourceId = state.pendingCommandPayment?.sourceInstanceId;
        if (sourceId) blockedPaymentSources.add(sourceId);
        blockedRushPaymentSourceId = sourceId;
        state = cancelled.state;
        actionCounts.cancel_command_payment =
          (actionCounts.cancel_command_payment ?? 0) + 1;
        continue;
      }
    }
    if (!result.ok) {
      if (result.error === "cannot_enter_battle" && action.type === "move_to_battle") {
        continue;
      }
      if (result.error === "cannot_enter_battle") {
        const recovery =
          actions.find(
            (candidate) =>
              candidate.type === "pass_battle_entry" &&
              isLegalAction(state, candidate) &&
              applyAction(state, candidate).ok,
          ) ??
          actions.find(
            (candidate) =>
              candidate.type === "end_phase" &&
              isLegalAction(state, candidate) &&
              applyAction(state, candidate).ok,
          );
        if (recovery) {
          const recovered = applyAction(state, recovery);
          if (recovered.ok) {
            state = recovered.state;
            actionCounts[recovery.type] = (actionCounts[recovery.type] ?? 0) + 1;
            continue;
          }
        }
      }
      const fallback = actions.find(
        (candidate) =>
          candidate !== action &&
          candidate.type !== "move_to_battle" &&
          isLegalAction(state, candidate) &&
          applyAction(state, candidate).ok,
      );
      if (fallback) {
        const recovered = applyAction(state, fallback);
        if (recovered.ok) {
          state = recovered.state;
          actionCounts[fallback.type] = (actionCounts[fallback.type] ?? 0) + 1;
          if (fallback.type === "strike") strikes += 1;
          if (fallback.type === "battle") battles += 1;
          continue;
        }
      }
      return {
        state,
        steps,
        reason: "apply_failed",
        error: result.error,
        trace: buildTrace(phasesSeen, actionCounts, strikes, battles, state.log),
      };
    }
    state = result.state;
    if (state.pendingCommandPayment) {
      const source = state.pendingCommandPayment.sourceInstanceId;
      if (source === lastRushPaymentSource) rushPaymentLoopCount += 1;
      else {
        lastRushPaymentSource = source;
        rushPaymentLoopCount = 1;
      }
    } else if (
      action.type === "cancel_command_payment" ||
      action.type === "resolve_command_payment"
    ) {
      rushPaymentLoopCount += 1;
    } else if (action.type === "end_phase") {
      rushPaymentLoopCount = 0;
      lastRushPaymentSource = null;
      zordSetupLoopCount = 0;
      lastZordVehicleId = null;
    }
    if (state.pendingZordSetup) {
      const zordId = state.pendingZordSetup.zordInstanceId;
      if (zordId === lastZordVehicleId) zordSetupLoopCount += 1;
      else {
        lastZordVehicleId = zordId;
        zordSetupLoopCount = 1;
      }
    } else if (action.type === "cancel_zord_setup" || action.type === "resolve_zord_setup") {
      zordSetupLoopCount += 1;
    }
  }

  return {
    state,
    steps: maxSteps,
    reason: "step_limit",
    trace: buildTrace(phasesSeen, actionCounts, strikes, battles, state.log),
  };
}
