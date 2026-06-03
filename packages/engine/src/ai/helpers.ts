import type { Category } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  hasReleasedCommandForCategories,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
import {
  countHeldCommands,
  findMandatoryBattleEntries,
} from "../rules/restrictions";
import { findCardOwner } from "../rules/fieldLookup";
import { strikeDamageFor } from "../rules/combo";
import { COMMAND_ZONE_MAX, WIN_DAMAGE } from "../types/game";
import { evaluateState } from "./scoring";
import {
  getBattleEntryPaymentNeeds,
  getCategoryPaymentOptions,
  needsEffectHoldPayment,
} from "../rules/commandPayment";

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
    (cat) => !hasReleasedCommandForCategories(player, state.definitions, [cat]),
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
    if (!hasReleasedCommandForCategories(player, state.definitions, cardCategories(def))) {
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

/** Pay battle-entry holds before moving a unit to battle. */
export function pickHoldBeforeBattle(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  for (const action of actionsOfType(actions, "move_to_battle")) {
    const card = state.players[playerId].rush.find(
      (c) => c.instanceId === action.instanceId,
    );
    if (!card) continue;
    if (getBattleEntryPaymentNeeds(state, playerId, card)) {
      return {
        type: "initiate_command_payment",
        playerId,
        kind: "battle_entry",
        sourceInstanceId: card.instanceId,
        rideOff: action.rideOff,
      };
    }
  }
  return null;
}

export function pickHoldBeforeRush(
  state: GameState,
  playerId: PlayerId,
  _actions: GameAction[],
  rushAction: GameAction,
): GameAction | null {
  if (rushAction.type !== "rush") return null;
  const card = state.players[playerId].hand.find(
    (c) => c.instanceId === rushAction.instanceId,
  );
  if (!card) return null;
  const unitDef = getDefinition(state.definitions, card.cardId);
  if (!unitDef) return null;
  const options = getCategoryPaymentOptions(
    state,
    playerId,
    cardCategories(unitDef),
    { perRushPayment: true },
  );
  if (!options) return null;
  return {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: rushAction.instanceId,
    zordMaterialInstanceId: rushAction.zordMaterialInstanceId,
    zordMaterialDestination: rushAction.zordMaterialDestination,
    zordMothershipHoldInstanceIds: rushAction.zordMothershipHoldInstanceIds,
  };
}

export function pickCommandPaymentResolve(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const pending = state.pendingCommandPayment;
  if (!pending || pending.playerId !== playerId) return null;
  const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
  if (ids.length < pending.totalNeeded) {
    return { type: "cancel_command_payment", playerId };
  }
  return {
    type: "resolve_command_payment",
    playerId,
    commandInstanceIds: ids,
  };
}

export function pickZordSetupStep(
  state: GameState,
  playerId: PlayerId,
): GameAction | null {
  const setup = state.pendingZordSetup;
  if (!setup || setup.playerId !== playerId) return null;
  if (setup.step === "destination") {
    const commandZoneHasSpace =
      state.players[playerId].command.length < COMMAND_ZONE_MAX;
    return {
      type: "resolve_zord_setup",
      playerId,
      destination: commandZoneHasSpace ? "command" : "discard",
    };
  }
  if (setup.step === "material" && setup.validInstanceIds[0]) {
    return {
      type: "resolve_zord_setup",
      playerId,
      materialInstanceId: setup.validInstanceIds[0],
    };
  }
  if (setup.step === "mothership") {
    return { type: "resolve_zord_setup", playerId };
  }
  return { type: "cancel_zord_setup", playerId };
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

/** Winning battle vs enemy battle or rush (yellow thunder etc.). */
export function pickFavorableBattle(
  state: GameState,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestDelta = Number.NEGATIVE_INFINITY;

  for (const action of actionsOfType(actions, "battle")) {
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
    const defender =
      enemy.battle.find((c) => c.instanceId === action.defenderInstanceId) ??
      enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) continue;

    const delta =
      effectiveBp(state, action.playerId, attacker) -
      effectiveBp(state, opponent(action.playerId), defender);
    if (delta > 0 && delta > bestDelta) {
      bestDelta = delta;
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

function powerDiscardPriority(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): number {
  const player = state.players[playerId];
  const card = player.power.find((c) => c.instanceId === instanceId);
  if (!card) return Number.POSITIVE_INFINITY;
  const def = getDefinition(state.definitions, card.cardId);
  const cost = def ? parsePowerCost(def.powerCost ?? 1) : 1;
  return cost + (card.faceDown ? 0 : 2);
}

function battleSourceStrikeValue(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string | undefined,
): number {
  if (!sourceInstanceId) return 0;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === sourceInstanceId);
  if (!unit) return 0;
  return strikeDamageFor(state.definitions, unit, state, playerId) + (unit.spModifier ?? 0);
}

function worthJudgmentSwordPayment(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
): boolean {
  const player = state.players[playerId];
  const need = pending.selectCount ?? 2;
  if (player.power.length < need) return false;
  return battleSourceStrikeValue(state, playerId, pending.sourceInstanceId) >= 2;
}

function worthJusticeFlasherPayment(
  state: GameState,
  playerId: PlayerId,
  pending: PendingEffectChoice,
): boolean {
  const player = state.players[playerId];
  const need = pending.selectCount ?? 5;
  if (player.power.length < need) return false;
  return battleSourceStrikeValue(state, playerId, pending.sourceInstanceId) >= 4;
}

function pickLowestPowerDiscard(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  exclude: Set<string>,
): GameAction | null {
  let best: GameAction | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    if (exclude.has(action.instanceId)) continue;
    const priority = powerDiscardPriority(state, playerId, action.instanceId);
    if (priority < bestPriority) {
      bestPriority = priority;
      best = action;
    }
  }

  return best;
}

export function pickScryKeepOne(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
): GameAction | null {
  let best: GameAction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  const viewedIds = state.pendingEffectChoice?.viewedInstanceIds ?? [];
  const player = state.players[playerId];
  const viewedCards = new Map(
    viewedIds
      .map((id) => player.deck.find((c) => c.instanceId === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => [c.instanceId, c] as const),
  );

  for (const action of actions) {
    if (action.type !== "resolve_effect_choice") continue;
    const card =
      viewedCards.get(action.instanceId) ??
      player.deck.find((c) => c.instanceId === action.instanceId);
    if (!card) continue;
    const bp = effectiveBp(state, playerId, card);
    const sp = strikeDamageFor(state.definitions, card, state, playerId);
    const score = bp * 10 + sp * 500;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return best;
}

export function pickEffectChoice(
  state: GameState,
  pending: PendingEffectChoice,
  actions: GameAction[],
): GameAction | null {
  const playerId = pending.playerId;
  const skip = actions.find((a) => a.type === "skip_effect_choice");

  if (pending.kind === "scry_keep_one") {
    return pickScryKeepOne(state, playerId, actions) ?? skip ?? null;
  }

  if (pending.kind === "select_power") {
    const selected = new Set(pending.selectedInstanceIds ?? []);
    const selectCount = pending.selectCount ?? 1;

    if (pending.effectId === "judgment_sword") {
      if (pending.optional && selected.size === 0 && !worthJudgmentSwordPayment(state, playerId, pending)) {
        return skip ?? null;
      }
    } else if (pending.effectId === "justice_flasher") {
      if (pending.optional && selected.size === 0 && !worthJusticeFlasherPayment(state, playerId, pending)) {
        return skip ?? null;
      }
    } else if (pending.effectId === "earth_force" && pending.optional) {
      const enemy = state.players[opponent(playerId)];
      if (enemy.damage < 2 && maxSelfStrikeThreat(state, playerId) < 2) {
        return skip ?? null;
      }
    }

    if (selected.size >= selectCount) {
      return skip ?? null;
    }

    return (
      pickLowestPowerDiscard(state, playerId, actions, selected) ??
      skip ??
      actions.find((a) => a.type === "resolve_effect_choice") ??
      null
    );
  }

  if (pending.effectId === "earth_force" && !pending.optional) {
    const picks: GameAction[] = [];
    const exclude = new Set<string>();
    const upkeepCount = pending.selectCount ?? 3;
    for (let i = 0; i < upkeepCount; i++) {
      const pick = pickLowestPowerDiscard(state, playerId, actions, exclude);
      if (!pick || pick.type !== "resolve_effect_choice") break;
      picks.push(pick);
      exclude.add(pick.instanceId);
    }
    return picks[0] ?? null;
  }

  if (pending.kind === "select_unit" || pending.kind === "select_unit_step") {
    return pickWeakestEffectTarget(state, actions);
  }

  if (needsEffectHoldPayment(pending)) {
    const initiate = actions.find(
      (a) =>
        a.type === "initiate_command_payment" &&
        "kind" in a &&
        a.kind === "effect_hold",
    );
    if (initiate) return initiate;
  }

  return skip ?? actions.find((a) => a.type === "resolve_effect_choice") ?? null;
}

function maxSelfStrikeThreat(state: GameState, playerId: PlayerId): number {
  let max = 0;
  for (const card of state.players[playerId].battle) {
    max = Math.max(max, strikeDamageFor(state.definitions, card, state, playerId));
  }
  return max;
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

export function pickBestCounter(
  state: GameState,
  playerId: PlayerId,
  actions: GameAction[],
  passType: GameAction["type"],
): GameAction | null {
  const pass = actions.find((a) => a.type === passType);
  const counters = actionsOfType(actions, "play_counter");

  let passScore = Number.NEGATIVE_INFINITY;
  if (pass) {
    const passResult = applyAction(state, pass);
    if (passResult.ok) {
      passScore = evaluateState(passResult.state, playerId);
    }
  }

  let bestCounter: GameAction | null = null;
  let bestCounterScore = Number.NEGATIVE_INFINITY;

  for (const counter of counters) {
    const result = applyAction(state, counter);
    if (!result.ok) continue;
    const score = evaluateState(result.state, playerId);
    if (score > bestCounterScore) {
      bestCounterScore = score;
      bestCounter = counter;
    }
  }

  if (bestCounter && bestCounterScore > passScore) {
    return bestCounter;
  }

  return pass ?? bestCounter ?? null;
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

  return pickBestCounter(state, playerId, actions, passType);
}

/** Fast ordering so search keeps the most promising actions. */
export function quickActionPriority(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): number {
  if (action.type === "end_phase") return -5_000;

  if (action.type === "rush") {
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return 0;
    const bp = effectiveBp(state, action.playerId, card);
    const sp = strikeDamageFor(state.definitions, card, state, action.playerId);
    return bp + sp * 2_000;
  }

  if (action.type === "strike") {
    const player = state.players[action.playerId];
    const card = player.battle.find((c) => c.instanceId === action.instanceId);
    if (!card) return 0;
    const enemy = state.players[opponent(action.playerId)];
    const damage = strikeDamageFor(state.definitions, card, state, action.playerId);
    const lethal = enemy.damage + damage >= WIN_DAMAGE;
    return (lethal ? 50_000 : 0) + damage * 500;
  }

  if (action.type === "battle") {
    const player = state.players[action.playerId];
    const enemy = state.players[opponent(action.playerId)];
    const attacker = player.battle.find((c) => c.instanceId === action.attackerInstanceId);
    const defender = enemy.battle.find((c) => c.instanceId === action.defenderInstanceId)
      ?? enemy.rush.find((c) => c.instanceId === action.defenderInstanceId);
    if (!attacker || !defender) return 0;
    const delta =
      effectiveBp(state, action.playerId, attacker) -
      effectiveBp(state, opponent(action.playerId), defender);
    return delta > 0 ? delta * 100 : delta;
  }

  if (action.type === "move_to_battle") {
    const player = state.players[action.playerId];
    const card =
      player.rush.find((c) => c.instanceId === action.instanceId) ??
      player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return 0;
    return effectiveBp(state, action.playerId, card);
  }

  if (action.type === "play_operation") {
    const player = state.players[action.playerId];
    const card = player.hand.find((c) => c.instanceId === action.instanceId);
    if (!card) return 1_000;
    if (["RS-007", "RS-028", "RS-009", "RS-024"].includes(card.cardId)) {
      return 3_000;
    }
    if (card.cardId === "RS-020") return 2_500;
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.tags?.includes("常駐")) return 2_200;
    return 1_500;
  }

  if (
    action.type === "initiate_command_payment" ||
    action.type === "resolve_command_payment"
  ) {
    return 600;
  }
  if (action.type === "charge_command") {
    return 800;
  }

  if (action.type === "use_plasma_energy") return 4_000;
  if (action.type === "five_tech_intercept") return 3_500;
  if (action.type === "play_counter") return 2_000;
  if (action.type === "pass_strike_reaction") return -500;
  if (action.type === "pass_battle_reaction" || action.type === "pass_rush_reaction") {
    return -200;
  }

  return 0;
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
