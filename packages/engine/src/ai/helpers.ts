import type { Category } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
import { findMandatoryBattleEntries, hasCommandForCardUse } from "../rules/restrictions";
import { findCardOwner } from "../rules/fieldLookup";
import { strikeDamageFor } from "../rules/combo";
import { WIN_DAMAGE } from "../types/game";

export function endPhase(actions: GameAction[]): GameAction | null {
  return actions.find((action) => action.type === "end_phase") ?? null;
}

export function actionsOfType<T extends GameAction["type"]>(
  actions: GameAction[],
  type: T,
): Extract<GameAction, { type: T }>[] {
  return actions.filter((action): action is Extract<GameAction, { type: T }> => action.type === type);
}

function categoriesNeededFromHand(
  state: GameState,
  playerId: PlayerId,
): Category[] {
  const player = state.players[playerId];
  const needed = new Set<Category>();
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def) continue;
    if (def.type === "unit" || def.type === "operation") {
      for (const cat of cardCategories(def)) {
        needed.add(cat);
      }
    }
  }
  return [...needed];
}

function handNeedsCommandSupport(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const neededCats = categoriesNeededFromHand(state, playerId);
  if (neededCats.length === 0) return false;
  const player = state.players[playerId];
  return neededCats.some(
    (cat) => !hasCommandForCardUse(player, state.definitions, [cat]),
  );
}

function handNeedsPowerForRush(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  for (const card of player.hand) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || def.type !== "unit") continue;
    if (!hasCommandForCardUse(player, state.definitions, cardCategories(def))) {
      continue;
    }
    const cost = parsePowerCost(def.powerCost);
    if (player.power.length < cost) return true;
  }
  return false;
}

function scoreChargeCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  mode: "command" | "power",
): number {
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === instanceId);
  if (!card) return -1;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def) return -1;

  let score = 0;
  const neededCats = categoriesNeededFromHand(state, playerId);

  if (def.type === "operation") score += 40;

  for (const cat of cardCategories(def)) {
    if (neededCats.includes(cat)) score += 25;
  }

  if (mode === "power" && def.type === "unit") score -= 20;

  return score;
}

function pickBestChargeAction(
  state: GameState,
  playerId: PlayerId,
  actions: Extract<GameAction, { type: "charge_command" | "charge_power" }>[],
  mode: "command" | "power",
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    const score = scoreChargeCard(state, playerId, action.instanceId, mode);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

/** Pick charge_power vs charge_command during the charge phase. */
export function pickChargeAction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const player = state.players[playerId];
  const commands = actionsOfType(actions, "charge_command");
  const powers = actionsOfType(actions, "charge_power");
  const end = endPhase(actions);

  const emptyCommandZone = player.command.length === 0;
  const needsCommand = handNeedsCommandSupport(state, playerId);
  const needsPower = handNeedsPowerForRush(state, playerId);
  const hasPlayableHand =
    categoriesNeededFromHand(state, playerId).length > 0;

  if (
    commands.length > 0 &&
    (emptyCommandZone || needsCommand) &&
    (hasPlayableHand || emptyCommandZone)
  ) {
    if (!(needsPower && !needsCommand && !emptyCommandZone)) {
      return pickBestChargeAction(state, playerId, commands, "command");
    }
  }

  if (needsPower && powers.length > 0) {
    return pickBestChargeAction(state, playerId, powers, "power");
  }

  if (powers.length > 0) {
    return pickBestChargeAction(state, playerId, powers, "power");
  }

  if (commands.length > 0) {
    return pickBestChargeAction(state, playerId, commands, "command");
  }

  return end;
}

export function pickMandatoryBattleMove(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const mandatory = new Set(
    findMandatoryBattleEntries(state, playerId).map((card) => card.instanceId),
  );
  if (mandatory.size === 0) return null;

  const moves = actionsOfType(actions, "move_to_battle").filter((action) =>
    mandatory.has(action.instanceId),
  );
  if (moves.length === 0) return null;

  let best = moves[0]!;
  let bestBp = -1;
  for (const move of moves) {
    const player = state.players[playerId];
    const card =
      player.rush.find((c) => c.instanceId === move.instanceId) ??
      player.hand.find((c) => c.instanceId === move.instanceId);
    if (!card) continue;
    const bp = effectiveBp(state, playerId, card);
    if (bp > bestBp) {
      bestBp = bp;
      best = move;
    }
  }
  return best;
}

export function pickHoldBeforeRush(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  rushAction: GameAction,
): GameAction | null {
  if (rushAction.type !== "rush") return null;
  const player = state.players[playerId];
  const card = player.hand.find((c) => c.instanceId === rushAction.instanceId);
  if (!card) return null;
  const unitDef = getDefinition(state.definitions, card.cardId);
  if (!unitDef) return null;

  const unitCats = cardCategories(unitDef);
  const hasHeld = player.command.some((cmd) => {
    if (!cmd.commandHeld) return false;
    const cmdCats = cardCategories(getDefinition(state.definitions, cmd.cardId));
    return unitCats.some((cat) => cmdCats.includes(cat));
  });
  if (hasHeld) return null;

  return actionsOfType(actions, "hold_command")[0] ?? null;
}

export function pickCommandSetup(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const player = state.players[playerId];
  const holds = actionsOfType(actions, "hold_command");
  const unreleased = player.command.filter((c) => !c.commandHeld);
  if (unreleased.length > 0 && holds.length > 0) {
    return holds[0] ?? null;
  }

  if (player.command.length === 0) {
    const charges = actionsOfType(actions, "charge_command");
    if (charges.length > 0) return charges[0] ?? null;
  }

  return null;
}

export function pickBestRushByScore(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "rush") continue;
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) continue;
    const def = getDefinition(state.definitions, card.cardId);
    const bp = effectiveBp(state, action.playerId, card);
    const sp = strikeDamageFor(state.definitions, card, state, action.playerId);
    const score = bp + sp * 2_000;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

export function pickWinningBattle(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestDelta = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "battle") continue;
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
    const defender = enemy.battle.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) continue;

    const attackerBp = effectiveBp(state, action.playerId, attacker);
    const defenderBp = effectiveBp(state, opponent(action.playerId), defender);
    const delta = attackerBp - defenderBp;
    if (delta <= 0) continue;
    if (delta > bestDelta) {
      bestDelta = delta;
      best = action;
    }
  }

  return best;
}

export function pickBestStrike(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const enemy = state.players[opponent(playerId)];
  let best: GameAction | null = null;
  let bestPriority = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "strike") continue;
    const player = state.players[action.playerId];
    const card = player.battle.find((c) => c.instanceId === action.instanceId);
    if (!card) continue;

    const damage = strikeDamageFor(state.definitions, card, state, action.playerId);
    const lethal = enemy.damage + damage >= WIN_DAMAGE;
    const priority = (lethal ? 10_000 : 0) + damage * 100;
    if (priority > bestPriority) {
      bestPriority = priority;
      best = action;
    }
  }

  return best;
}

export function pickWeakestEffectTarget(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let weakestBp = Number.POSITIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    const located = findCardOwner(state, action.instanceId);
    if (!located) continue;
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, action.instanceId);
    if (!found) continue;
    const bp = effectiveBp(state, located.playerId, found.card);
    if (bp < weakestBp) {
      weakestBp = bp;
      best = action;
    }
  }

  return best;
}

export function pickBestOperationTarget(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  const destroyOps = actionsOfType(actions, "play_operation").filter((action) => {
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    return card && ["RS-007", "RS-028", "RS-009", "RS-024"].includes(card.cardId);
  });
  if (destroyOps.length === 0) return null;

  let best = destroyOps[0]!;
  let weakestBp = Number.POSITIVE_INFINITY;
  for (const action of destroyOps) {
    if (!action.targetInstanceId) continue;
    const located = findCardOwner(state, action.targetInstanceId);
    if (!located) continue;
    const owner = state.players[located.playerId];
    const found = findInZone(owner, located.zone, action.targetInstanceId);
    if (!found) continue;
    const bp = effectiveBp(state, located.playerId, found.card);
    if (bp < weakestBp) {
      weakestBp = bp;
      best = action;
    }
  }
  return best;
}

export function pickBestOperation(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  const targeted = pickBestOperationTarget(state, actions);
  if (targeted) return targeted;

  const ops = actionsOfType(actions, "play_operation");
  const powerAccel = ops.find((a) => {
    const player = state.players[a.playerId];
    const card = player.hand.find((c) => c.instanceId === a.instanceId);
    return card?.cardId === "RS-020";
  });
  if (powerAccel) return powerAccel;

  const permanent = ops.find((a) => {
    const player = state.players[a.playerId];
    const card = player.hand.find((c) => c.instanceId === a.instanceId);
    if (!card) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.tags?.includes("常駐");
  });
  if (permanent) return permanent;

  return ops[0] ?? null;
}

export function pickEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  if (pending.effectId === "earth_force") {
    return (
      actions.find((a) => a.type === "resolve_effect_choice") ??
      actions.find((a) => a.type === "skip_effect_choice") ??
      null
    );
  }

  if (pending.kind === "select_unit" || pending.kind === "select_unit_step") {
    return pickWeakestEffectTarget(state, actions);
  }

  return (
    actions.find((a) => a.type === "resolve_effect_choice") ??
    actions.find((a) => a.type === "skip_effect_choice") ??
    null
  );
}

export function pickStrikeReaction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  const pending = state.pendingStrike;
  if (!pending) return actions.find((a) => a.type === "pass_strike_reaction") ?? null;

  const strikerPlayer = state.players[pending.strikerPlayerId];
  const striker = strikerPlayer.battle.find((c) => c.instanceId === pending.strikerInstanceId);
  const strikerBp = striker ? effectiveBp(state, pending.strikerPlayerId, striker) : 0;
  const incomingDamage = pending.damage;

  for (const action of actions) {
    if (action.type !== "five_tech_intercept") continue;
    const defender = state.players[playerId];
    const interceptor = defender.rush.find((c) => c.instanceId === action.interceptInstanceId);
    if (!interceptor) continue;
    const interceptorBp = effectiveBp(state, playerId, interceptor);
    if (interceptorBp >= strikerBp) {
      return action;
    }
  }

  const self = state.players[playerId];
  if (
    actions.some((a) => a.type === "use_plasma_energy") &&
    incomingDamage > 0 &&
    self.damage + incomingDamage < WIN_DAMAGE
  ) {
    return actions.find((a) => a.type === "use_plasma_energy") ?? null;
  }

  return actions.find((a) => a.type === "pass_strike_reaction") ?? null;
}

export function pickSimpleReaction(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
): GameAction | null {
  if (passType === "pass_strike_reaction") {
    return pickStrikeReaction(state, playerId, actions);
  }

  return (
    actions.find((a) => a.type === "play_counter") ??
    actions.find((a) => a.type === passType) ??
    null
  );
}

export function affordableRushes(state: GameState, playerId: PlayerId, actions: GameAction[]): GameAction[] {
  const player = state.players[playerId];
  return actionsOfType(actions, "rush").filter((action) => {
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return false;
    const cost = parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost ?? 99);
    return player.power.length >= cost;
  });
}
