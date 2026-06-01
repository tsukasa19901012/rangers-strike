import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { getLegalActions } from "../core/legalActions";
import { opponent } from "../core/helpers";
import {
  actionsOfType,
  affordableRushes,
  endPhase,
  pickBestRushByScore,
  pickBestStrike,
  pickChargeAction,
  pickCommandSetup,
  pickEffectChoice,
  pickHoldBeforeRush,
  pickMandatoryBattleMove,
  pickSimpleReaction,
  pickWinningBattle,
} from "./helpers";
import { pickBestBySearch } from "./simulation";

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
  const candidates = actions.filter((a) => a.type !== passType);
  if (pass) candidates.push(pass);

  return pickBestBySearch(state, playerId, candidates) ?? pass ?? null;
}

function collectRushCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const candidates: GameAction[] = [];
  const rushes = affordableRushes(state, playerId, actions);

  for (const rush of rushes) {
    const hold = pickHoldBeforeRush(state, playerId, actions, rush);
    if (hold) candidates.push(hold);
    candidates.push(rush);
  }

  const cmdSetup = pickCommandSetup(state, playerId, actions);
  if (cmdSetup) candidates.push(cmdSetup);

  const ops = actionsOfType(actions, "play_operation");
  candidates.push(...ops);

  const end = endPhase(actions);
  if (end) candidates.push(end);

  return candidates;
}

function collectBattleCandidates(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction[] {
  const mandatory = pickMandatoryBattleMove(state, playerId, actions);
  if (mandatory) return [mandatory];

  const candidates: GameAction[] = [
    ...actionsOfType(actions, "move_to_battle"),
    ...actionsOfType(actions, "battle"),
    ...actionsOfType(actions, "strike"),
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

  if (state.pendingLeave) {
    if (playerId !== state.pendingLeave.ownerPlayerId) return null;
    const actions = getLegalActions(state);
    return pickReactionAction(state, playerId, actions, "pass_leave_reaction", enableSearch);
  }

  if (state.pendingEffectChoice) {
    if (playerId !== state.pendingEffectChoice.playerId) return null;
    const actions = getLegalActions(state);
    const pending = state.pendingEffectChoice;

    if (enableSearch && pending.effectId === "earth_force") {
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

    if (!enableSearch) {
      const battle = pickWinningBattle(state, actions);
      if (battle) return battle;
      return actions.find((a) => a.type === "pass_battle_entry") ?? null;
    }

    const candidates = [
      ...actionsOfType(actions, "strike"),
      ...actionsOfType(actions, "battle"),
      ...actions.filter((a) => a.type === "pass_battle_entry"),
    ];
    return pickBestBySearch(state, playerId, candidates);
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
