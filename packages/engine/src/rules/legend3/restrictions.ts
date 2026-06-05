import {
  getBattleEntryHandDiscardCount,
  hasUnnamedRule,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { COMMAND_ZONE_MAX } from "../../types/game";
import {
  cardCategories,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
} from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { countReleasedCommands } from "../restrictions";
import {
  collectFieldUnitIds,
  startSelectUnitChoice,
} from "../pendingChoices";
import { findNamedEffectByEffectId } from "@rangers-strike/cards";

export function hasDarkDealInRush(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].rush.some(
    (c) => findNamedEffectByEffectId(c.cardId, "dark_deal"),
  );
}

export function darkDealRushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): number {
  let budget = player.power.length;
  const cost = parsePowerCost(unitDefinition.powerCost);
  if (budget >= cost) return budget;
  if (!hasDarkDealInRush(state, playerId)) return budget;
  const cats = cardCategories(unitDefinition);
  if (!cats.includes("DA")) return budget;
  return budget + countReleasedCommands(player);
}

export function applyDarkDealRushHolds(
  player: PlayerState,
  shortage: number,
): PlayerState | null {
  if (shortage <= 0) return player;
  let remaining = shortage;
  const command = [...player.command];
  for (let i = 0; i < command.length && remaining > 0; i++) {
    const card = command[i]!;
    if (card.commandHeld) continue;
    command[i] = { ...card, commandHeld: true, mothershipHold: false };
    remaining -= 1;
  }
  if (remaining > 0) return null;
  return { ...player, command };
}

export function needsBattleEntryRushDiscard(cardId: string): boolean {
  return hasUnnamedRule(cardId, "battle_entry_discard_s_from_rush");
}

export function canPayBattleEntryRushDiscard(player: PlayerState, definitions: GameState["definitions"]): boolean {
  return player.rush.some((c) => isSmallUnit(definitions, c.cardId));
}

export function battleEntryRushDiscardSatisfied(player: PlayerState, cardId: string): boolean {
  if (!needsBattleEntryRushDiscard(cardId)) return true;
  return player.battleEntryRushDiscardReady === true;
}

export function canPayBattleEntryHandDiscard(
  player: PlayerState,
  cardId: string,
): boolean {
  const count = getBattleEntryHandDiscardCount(cardId);
  return count <= 0 || player.hand.length >= count;
}

export function battleEntryHandDiscardSatisfied(
  player: PlayerState,
  cardId: string,
): boolean {
  if (!needsBattleEntryHandDiscard(cardId)) return true;
  return player.battleEntryHandDiscardReady === true;
}

export function tryStartBattleEntryHandDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const count = getBattleEntryHandDiscardCount(entering.cardId);
  if (count <= 0) return null;
  const player = state.players[playerId];
  const valid = player.hand.map((c) => c.instanceId);
  if (valid.length < count) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_hand_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_hand",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: count,
      optional: false,
    },
    activePlayer: playerId,
  };
}

export function tryStartBattleEntryRushDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const player = state.players[playerId];
  const targets = player.rush
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
  if (targets.length === 0) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_unit",
      phasePlayerId: playerId,
      validInstanceIds: targets,
      unitDestination: "discard",
      optional: false,
      selectCount: 1,
    },
    activePlayer: playerId,
  };
}

export function canAttackEnemyRushS(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  if (!attacker) return false;
  return hasUnnamedRule(attacker.card.cardId, "can_attack_enemy_rush_s");
}

export function cannotAttackEnemyBattleS(attackerCardId: string): boolean {
  return hasUnnamedRule(attackerCardId, "cannot_attack_enemy_battle_s");
}

export function defenderRequiresAircraftAttacker(defenderCardId: string): boolean {
  return hasUnnamedRule(defenderCardId, "requires_aircraft_attacker");
}

export function attackerHasAircraftFeature(
  definitions: GameState["definitions"],
  attackerCardId: string,
): boolean {
  return (getDefinition(definitions, attackerCardId)?.features ?? []).includes("航空機");
}

export function canAttackDefender(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
  canAttackRushFn: (
    state: GameState,
    attackerPlayerId: PlayerId,
    attackerInstanceId: string,
  ) => boolean,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  if (!attacker) return false;

  const enemy = state.players[defenderPlayerId];
  const inBattle = findInZone(enemy, "battle", defenderInstanceId);
  const inRush = findInZone(enemy, "rush", defenderInstanceId);

  if (inRush) {
    return canAttackRushFn(state, attackerPlayerId, attackerInstanceId);
  }

  if (!inBattle) return false;

  if (
    cannotAttackEnemyBattleS(attacker.card.cardId) &&
    isSmallUnit(state.definitions, inBattle.card.cardId)
  ) {
    return false;
  }

  if (
    defenderRequiresAircraftAttacker(inBattle.card.cardId) &&
    !attackerHasAircraftFeature(state.definitions, attacker.card.cardId)
  ) {
    return false;
  }

  return true;
}

export function tryLegend3BattleToRush(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  phasePlayerId: PlayerId,
): GameState {
  if (!findNamedEffectByEffectId(card.cardId, "falcon_claw")) return state;

  const enemyId = opponent(playerId);
  const targets = collectFieldUnitIds(state, enemyId, Number.MAX_SAFE_INTEGER, ["rush"]);
  if (targets.length === 0) return state;

  const withChoice = startSelectUnitChoice(state, {
    playerId,
    effectId: "falcon_claw",
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: "enemy_battle",
    optional: true,
  });
  return withChoice ?? state;
}

export function applyAssaultToCommandHold(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
): GameState {
  const owner = state.players[ownerId];
  const found = findInZone(owner, "battle", instanceId);
  if (!found) return state;

  const [, battle] = removeAt(owner.battle, found.index);
  let nextOwner: PlayerState;
  if (owner.command.length < COMMAND_ZONE_MAX) {
    nextOwner = {
      ...owner,
      battle,
      command: [...owner.command, { ...found.card, commandHeld: true }],
    };
  } else {
    nextOwner = {
      ...owner,
      battle,
      discard: [...owner.discard, found.card],
    };
  }
  return { ...state, ...updatePlayer(state, ownerId, nextOwner) };
}
