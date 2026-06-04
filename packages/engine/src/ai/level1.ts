import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { effectiveBp } from "../core/catalog";
import { getLegalActions } from "../core/legalActions";
import { opponent } from "../core/helpers";
import { strikeDamageFor } from "../rules/combo";
import {
  actionsOfType,
  affordableRushes,
  endPhase,
  pickBestCounter,
  pickBestOperation,
  pickBestRushByScore,
  pickBestStrike,
  pickChargeAction,
  pickCommandPaymentResolve,
  pickEffectChoice,
  pickZordSetupStep,
  pickFavorableBattle,
  pickHoldBeforeBattle,
  pickHoldBeforeRush,
  pickMandatoryBattleMove,
  pickSimpleReaction,
  pickStrikeReaction,
  pickWinningBattle,
} from "./helpers";
import { dedupeActions, pickBestBySearch } from "./simulation";

export type PickCpuActionOptions = {
  /** When false, skip opponent-response simulation (used internally to avoid recursion). */
  enableSearch?: boolean;
};

function pickReactionAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
  enableSearch: boolean,
): GameAction | null {
  if (!enableSearch) {
    return pickSimpleReaction(state, playerId, actions, passType);
  }

  const pass = actions.find((a) => a.type === passType);

  if (passType === "pass_strike_reaction") {
    const strikeCandidates = dedupeActions([
      ...actionsOfType(actions, "five_tech_intercept"),
      ...actionsOfType(actions, "use_plasma_energy"),
      ...actionsOfType(actions, "play_counter"),
      ...(pass ? [pass] : []),
    ]);
    const searched = pickBestBySearch(state, playerId, strikeCandidates);
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

  return pickBestBySearch(state, playerId, candidates) ?? heuristic ?? pass ?? null;
}

function collectRushCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const candidates: GameAction[] = [];
  const rushes = affordableRushes(state, playerId, actions);

  const rankedRushes = [...rushes].sort((a, b) => {
    const scoreA =
      a.type === "rush"
        ? (() => {
            const card = state.players[a.playerId].hand.find((c) => c.instanceId === a.instanceId);
            if (!card) return 0;
            const bp = effectiveBp(state, a.playerId, card);
            const sp = strikeDamageFor(state.definitions, card, state, a.playerId);
            return bp + sp * 2_000;
          })()
        : 0;
    const scoreB =
      b.type === "rush"
        ? (() => {
            const card = state.players[b.playerId].hand.find((c) => c.instanceId === b.instanceId);
            if (!card) return 0;
            const bp = effectiveBp(state, b.playerId, card);
            const sp = strikeDamageFor(state.definitions, card, state, b.playerId);
            return bp + sp * 2_000;
          })()
        : 0;
    return scoreB - scoreA;
  });

  for (const rush of rankedRushes.slice(0, 10)) {
    const hold = pickHoldBeforeRush(state, playerId, actions, rush);
    if (hold) candidates.push(hold);
    candidates.push(rush);
  }

  const bestOp = pickBestOperation(state, actions);
  if (bestOp) {
    candidates.push(bestOp);
  } else {
    candidates.push(...actionsOfType(actions, "play_operation").slice(0, 2));
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
 * Level 1 CPU: heuristics plus opponent-response simulation for key decisions.
 */
export function pickCpuAction(
  state: GameState,
  playerId: PlayerId = state.activePlayer,
  options: PickCpuActionOptions = {},
): GameAction | null {
  const enableSearch = options.enableSearch ?? true;

  if (state.winner) return null;

  const payment = pickCommandPaymentResolve(state, playerId);
  if (payment) return payment;

  const zordStep = pickZordSetupStep(state, playerId);
  if (zordStep) return zordStep;

  if (state.pendingLeave) {
    if (playerId !== state.pendingLeave.ownerPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_leave_reaction", enableSearch);
  }

  if (state.pendingEffectChoice) {
    if (playerId !== state.pendingEffectChoice.playerId) return null;
    const actions = getLegalActions(state);
    const pending = state.pendingEffectChoice;

    if (enableSearch && pending.kind === "deck_top_or_bottom") {
      const placements = actionsOfType(actions, "resolve_ruin_survey");
      if (placements.length > 0) {
        return pickBestBySearch(state, playerId, placements) ?? pickEffectChoice(state, pending, actions);
      }
    }

    if (enableSearch && pending.effectId === "earth_force" && pending.optional) {
      const pay = actions.find((a) => a.type === "resolve_effect_choice");
      const skip = actions.find((a) => a.type === "skip_effect_choice");
      if (pay && skip) {
        return pickBestBySearch(state, playerId, [pay, skip]);
      }
    }

    return pickEffectChoice(state, pending, actions);
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
      const searched = pickBestBySearch(state, playerId, candidates);
      if (searched) return searched;
    } else {
      const battle = pickWinningBattle(state, actions);
      if (battle) return battle;
      const favorable = pickFavorableBattle(state, actions);
      if (favorable) return favorable;
      return actions.find((a) => a.type === "pass_battle_entry") ?? null;
    }

    return (
      pickWinningBattle(state, actions) ??
      pickFavorableBattle(state, actions) ??
      actions.find((a) => a.type === "pass_battle_entry") ??
      null
    );
  }

  if (state.pendingRush) {
    if (playerId !== opponent(state.pendingRush.rusherPlayerId)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_rush_reaction", enableSearch);
  }

  if (state.pendingBattle) {
    if (playerId !== state.pendingBattle.defenderPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_battle_reaction", enableSearch);
  }

  if (state.pendingStrike) {
    if (playerId !== opponent(state.pendingStrike.strikerPlayerId)) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_strike_reaction", enableSearch);
  }

  if (state.activePlayer !== playerId) return null;

  const actions = getLegalActions(state);
  if (actions.length === 0) return null;

  switch (state.phase) {
    case "start": {
      const release = actions.find((action) => action.type === "release_start_commands");
      if (release) return release;
      const returnBattle = actions.find((action) => action.type === "return_battle_to_rush");
      if (returnBattle) return returnBattle;
      const draw = actions.find((action) => action.type === "draw");
      if (draw) return draw;
      const upkeep = actions.find((action) => action.type === "resolve_effect_choice");
      if (upkeep) return upkeep;
      const bonus = actions.find((action) => action.type === "bonus_draw");
      if (bonus) return bonus;
      return endPhase(actions);
    }

    case "charge":
      return pickChargeAction(state, playerId, actions) ?? endPhase(actions);

    case "rush": {
      if (enableSearch) {
        const candidates = collectRushCandidates(state, playerId, actions);
        const best = pickBestBySearch(state, playerId, candidates);
        if (best) return best;
      }

      const rush = pickBestRushByScore(state, affordableRushes(state, playerId, actions));
      if (rush) {
        const hold = pickHoldBeforeRush(state, playerId, actions, rush);
        return hold ?? rush;
      }
      return endPhase(actions);
    }

    case "battle": {
      const hold = pickHoldBeforeBattle(state, playerId, actions);
      if (hold) return hold;

      if (enableSearch) {
        const candidates = collectBattleCandidates(state, playerId, actions);
        const best = pickBestBySearch(state, playerId, candidates);
        if (best) return best;
      }

      const battle = pickWinningBattle(state, actions);
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
  if (state.pendingEffectChoice) {
    return state.pendingEffectChoice.playerId === cpuPlayer;
  }
  if (state.pendingBattleEntry) {
    return state.pendingBattleEntry.playerId === cpuPlayer;
  }
  if (state.pendingLeave) {
    return state.pendingLeave.ownerPlayerId === cpuPlayer;
  }
  if (state.pendingRush) {
    return opponent(state.pendingRush.rusherPlayerId) === cpuPlayer;
  }
  if (state.pendingBattle) {
    return state.pendingBattle.defenderPlayerId === cpuPlayer;
  }
  if (state.pendingStrike) {
    return opponent(state.pendingStrike.strikerPlayerId) === cpuPlayer;
  }
  return state.activePlayer === cpuPlayer;
}
