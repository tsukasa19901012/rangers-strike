import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { effectiveBp } from "../core/catalog";
import { getLegalActions } from "../core/legalActions";
import { opponent } from "../core/helpers";
import { damagePaymentChoosingPlayer } from "../rules/damagePayment";
import { strikeDamageFor } from "../rules/combo";
import {
  actionsOfType,
  affordableRushes,
  endPhase,
  pickBestCounter,
  pickBestOperation,
  pickBestRushByScore,
  pickBestStrike,
  scoreRushAction,
  pickChargeAction,
  pickCommandPaymentResolve,
  pickDamagePayment,
  pickEffectChoice,
  pickBeginZordSetup,
  pickZordSetupStep,
  pickFavorableBattle,
  pickHoldBeforeBattle,
  pickHoldBeforeRush,
  handHasRushUnits,
  pickRushCategoryPayment,
  pickMandatoryBattleMove,
  pickCpuFallbackAction,
  pickSimpleReaction,
  pickStrikeReaction,
  pickWinningBattle,
} from "./helpers";
import { dedupeActions, pickBestBySearch, type SearchOptions } from "./simulation";

export type PickCpuActionOptions = {
  /** false のとき相手応答シミュレーションをスキップ（再帰回避の内部用）。 */
  enableSearch?: boolean;
  maxCandidates?: number;
  maxResponseDepth?: number;
  simulationDepth?: number;
};

function searchOptions(options: PickCpuActionOptions): SearchOptions | undefined {
  if (
    options.maxCandidates === undefined &&
    options.maxResponseDepth === undefined &&
    options.simulationDepth === undefined
  ) {
    return undefined;
  }
  return {
    maxCandidates: options.maxCandidates,
    maxResponseDepth: options.maxResponseDepth,
    simulationDepth: options.simulationDepth,
  };
}

function pickReactionAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
  enableSearch: boolean,
  options: PickCpuActionOptions,
): GameAction | null {
  if (!enableSearch) {
    return pickSimpleReaction(state, playerId, actions, passType);
  }

  const pass = actions.find((a) => a.type === passType);
  const sim = searchOptions(options);

  if (passType === "pass_strike_reaction") {
    const strikeCandidates = dedupeActions([
      ...actionsOfType(actions, "five_tech_intercept"),
      ...actionsOfType(actions, "use_plasma_energy"),
      ...actionsOfType(actions, "play_counter"),
      ...(pass ? [pass] : []),
    ]);
    const searched = pickBestBySearch(state, playerId, strikeCandidates, sim);
    return (
      searched ??
      pickStrikeReaction(state, playerId, actions) ??
      pickBestCounter(state, playerId, actions, passType) ??
      pass ??
      null
    );
  }

  const heuristic = pickBestCounter(state, playerId, actions, passType);
  const candidates = actions.filter((a) => a.type !== passType);
  if (pass) candidates.push(pass);

  return pickBestBySearch(state, playerId, candidates, sim) ?? heuristic ?? pass ?? null;
}

function collectRushCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const candidates: GameAction[] = [];
  const rushes = affordableRushes(state, playerId, actions);

  const rankedRushes = [...rushes].sort(
    (a, b) => scoreRushAction(state, b) - scoreRushAction(state, a),
  );

  for (const rush of rankedRushes) {
    const hold = pickHoldBeforeRush(state, playerId, actions, rush);
    if (hold) candidates.push(hold);
    candidates.push(rush);
  }

  if (rankedRushes.length === 0) {
    const categoryPay = pickRushCategoryPayment(state, playerId, actions);
    if (categoryPay) {
      candidates.push(categoryPay);
    } else if (!handHasRushUnits(state, playerId)) {
      const bestOp = pickBestOperation(state, actions);
      if (bestOp) {
        candidates.push(bestOp);
      } else {
        candidates.push(...actionsOfType(actions, "play_operation").slice(0, 2));
      }
    }
  }

  const end = endPhase(actions);
  if (end) candidates.push(end);

  return candidates;
}

function battleActionDelta(
  state: GameState,
  action: Extract<GameAction, { type: "battle" }>,
): number {
  const player = state.players[action.playerId];
  const enemy = state.players[opponent(action.playerId)];
  const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
  const defender =
    enemy.battle.find((c) => c.instanceId === action.defenderInstanceId) ??
    enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
  if (!attacker || !defender) return Number.NEGATIVE_INFINITY;
  return (
    effectiveBp(state, action.playerId, attacker) -
    effectiveBp(state, opponent(action.playerId), defender)
  );
}

function collectBattleCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const mandatory = pickMandatoryBattleMove(state, playerId, actions);
  if (mandatory) return [mandatory];

  const candidates: GameAction[] = [
    ...actionsOfType(actions, "strike"),
    ...actionsOfType(actions, "battle")
      .sort((a, b) => battleActionDelta(state, b) - battleActionDelta(state, a))
      .slice(0, 14),
    ...actionsOfType(actions, "move_to_battle")
      .sort((a, b) => {
        const player = state.players[playerId];
        const cardA =
          player.rush.find((c) => c.instanceId === a.instanceId) ??
          player.hand.find((c) => c.instanceId === a.instanceId);
        const cardB =
          player.rush.find((c) => c.instanceId === b.instanceId) ??
          player.hand.find((c) => c.instanceId === b.instanceId);
        const bpA = cardA ? effectiveBp(state, playerId, cardA) : 0;
        const bpB = cardB ? effectiveBp(state, playerId, cardB) : 0;
        return bpB - bpA;
      })
      .slice(0, 8),
  ];

  const end = endPhase(actions);
  if (end) candidates.push(end);

  return candidates;
}

/**
 * レベル1 CPU: ヒューリスティックと主要局面での相手応答シミュレーション。
 */
export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  options: PickCpuActionOptions = {},
): GameAction | null {
  return (
    pickCpuActionInner(state, playerId, options) ??
    pickCpuFallbackAction(state, playerId)
  );
}

function pickCpuActionInner(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  options: PickCpuActionOptions = {},
): GameAction | null {
  const enableSearch = options.enableSearch ?? true;
  const sim = searchOptions(options);

  if (state.winner) return null;

  const payment = pickCommandPaymentResolve(state, playerId);
  if (payment) return payment;

  const damagePay = pickDamagePayment(state, playerId);
  if (damagePay) return damagePay;

  const zordStep = pickZordSetupStep(state, playerId);
  if (zordStep) return zordStep;

  if (state.pendingLeave) {
    if (playerId !== state.pendingLeave.ownerPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_leave_reaction", enableSearch, options);
  }

  if (state.pendingEffectChoice) {
    if (playerId !== state.pendingEffectChoice.playerId) return null;
    const actions = getLegalActions(state);
    const pending = state.pendingEffectChoice;

    if (enableSearch && pending.kind === "deck_top_or_bottom") {
      const placements = actionsOfType(actions, "resolve_ruin_survey");
      if (placements.length > 0) {
        return pickBestBySearch(state, playerId, placements, sim) ?? pickEffectChoice(state, pending, actions);
      }
    }

    if (pending.kind === "denji_machine") {
      return pickEffectChoice(state, pending, actions);
    }

    if (pending.kind === "seabed_draw") {
      const placements = actionsOfType(actions, "resolve_seabed_draw");
      if (placements.length > 0) {
        return pickBestBySearch(state, playerId, placements, sim) ?? placements[0] ?? null;
      }
    }

    if (enableSearch && pending.effectId === "earth_force" && pending.optional) {
      const pay = actions.find((a) => a.type === "resolve_effect_choice");
      const skip = actions.find((a) => a.type === "skip_effect_choice");
      if (pay && skip) {
        return pickBestBySearch(state, playerId, [pay, skip], sim);
      }
    }

    return pickEffectChoice(state, pending, actions);
  }

  if (state.pendingRush) {
    if (playerId !== opponent(state.pendingRush.rusherPlayerId)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_rush_reaction", enableSearch, options);
  }

  if (state.pendingBattle) {
    if (playerId !== state.pendingBattle.defenderPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_battle_reaction", enableSearch, options);
  }

  if (state.pendingStrike) {
    if (playerId !== opponent(state.pendingStrike.strikerPlayerId)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_strike_reaction", enableSearch, options);
  }

  if (state.pendingBattleEntry) {
    if (playerId !== state.pendingBattleEntry.playerId) return null;
    const actions = getLegalActions(state);
    const lethal = pickBestStrike(state, playerId, actions);
    if (lethal) return lethal;

    if (enableSearch) {
      const candidates = [
        ...actionsOfType(actions, "strike"),
        ...actionsOfType(actions, "battle"),
        ...actions.filter((a) => a.type === "pass_battle_entry"),
      ];
      const searched = pickBestBySearch(state, playerId, candidates, sim);
      if (searched) return searched;
    }

    return (
      pickWinningBattle(state, actions) ??
      pickFavorableBattle(state, actions) ??
      actions.find((a) => a.type === "pass_battle_entry") ??
      null
    );
  }

  if (state.activePlayer !== playerId) return null;

  const actions = getLegalActions(state);
  if (actions.length === 0) return null;

  switch (state.phase) {
    case "start": {
      const release = actions.find((action) => action.type === "release_start_commands");
      if (release) return release;
      const returnBattle = actions.find(
        (action) => action.type === "return_all_battle_to_rush",
      );
      if (returnBattle) return returnBattle;
      const draw = actions.find((action) => action.type === "draw");
      if (draw) return draw;
      const upkeep = actions.find((action) => action.type === "resolve_effect_choice");
      if (upkeep) return upkeep;
      const bonus = actions.find((action) => action.type === "bonus_draw");
      if (bonus) return bonus;
      return null;
    }

    case "charge":
      return pickChargeAction(state, playerId, actions) ?? endPhase(actions);

    case "rush": {
      const beginZord = pickBeginZordSetup(state, playerId, actions);
      if (beginZord) return beginZord;

      const affordable = affordableRushes(state, playerId, actions);
      const rush = pickBestRushByScore(state, affordable);
      if (rush) {
        const hold = pickHoldBeforeRush(state, playerId, actions, rush);
        return hold ?? rush;
      }

      const categoryPay = pickRushCategoryPayment(state, playerId, actions);
      if (categoryPay) return categoryPay;

      if (enableSearch) {
        const candidates = collectRushCandidates(state, playerId, actions);
        const best = pickBestBySearch(state, playerId, candidates, sim);
        if (best) return best;
      }

      return endPhase(actions);
    }

    case "battle": {
      const hold = pickHoldBeforeBattle(state, playerId, actions);
      if (hold) return hold;

      const mandatory = pickMandatoryBattleMove(state, playerId, actions);
      if (mandatory) return mandatory;

      if (enableSearch) {
        let candidates = collectBattleCandidates(state, playerId, actions);
        const hasRushUnits = state.players[playerId].rush.length > 0;
        const hasCombat =
          actionsOfType(actions, "strike").length > 0 ||
          actionsOfType(actions, "battle").length > 0;
        if (hasRushUnits || hasCombat) {
          candidates = candidates.filter((a) => a.type !== "end_phase");
        }
        const best = pickBestBySearch(state, playerId, candidates, sim);
        if (best) return best;
      }

      const battle =
        pickWinningBattle(state, actions) ??
        pickFavorableBattle(state, actions);
      if (battle) return battle;
      return pickBestStrike(state, playerId, actions) ?? endPhase(actions);
    }

    case "end":
      return endPhase(actions);

    default:
      return endPhase(actions);
  }
}

export function isCpuTurn(state: GameState, cpuPlayer: PlayerId = "player2"): boolean {
  if (state.winner) return false;
  if (state.pendingCommandPayment) {
    return state.pendingCommandPayment.playerId === cpuPlayer;
  }
  if (state.pendingZordSetup) {
    return state.pendingZordSetup.playerId === cpuPlayer;
  }
  if (state.pendingDamagePayment) {
    return damagePaymentChoosingPlayer(state.pendingDamagePayment) === cpuPlayer;
  }
  if (state.pendingEffectChoice) {
    return state.pendingEffectChoice.playerId === cpuPlayer;
  }
  if (state.pendingLeave) {
    return state.pendingLeave.ownerPlayerId === cpuPlayer;
  }
  if (state.pendingRush) {
    const defenderId = opponent(state.pendingRush.rusherPlayerId);
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingBattle) {
    const defenderId = state.pendingBattle.defenderPlayerId;
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingStrike) {
    const defenderId = opponent(state.pendingStrike.strikerPlayerId);
    return state.activePlayer === defenderId && defenderId === cpuPlayer;
  }
  if (state.pendingBattleEntry) {
    return state.pendingBattleEntry.playerId === cpuPlayer;
  }
  return state.activePlayer === cpuPlayer;
}
