import {
  getBattleEntryHandDiscardCount,
  hasUnnamedRule,
  needsBattleEntryHandDiscard,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { isCostWindowSatisfied } from "../../core/costWindow";
import { COMMAND_ZONE_MAX } from "../../types/game";
import {
  cardCategories,
  getDefinition,
  isSmallUnit,
  isVehicle,
  parsePowerCost,
} from "../../core/catalog";
import {
  cardHasGrantKeyword,
  promotedAttackerCannotTarget,
  promotedDefenderBlocksAttack,
} from "../../dsl/promotedKeywordBridge";
import { scrumBlocksAttack } from "../../keywords";
import { canWingAttackFromRush } from "../../keywords/battleKeywords";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { countAvailablePower, effectivePowerCost } from "../../core/power";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { countReleasedCommands } from "../restrictions";
import { getBattleEntryPowerDiscardCount } from "../batch07FieldEffects";
import {
  collectFieldUnitIds,
  startSelectUnitChoice,
} from "../pendingChoices";
import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import { keywordAllowsAttackIntoRush } from "../keywordGapRuntime";

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
  let budget = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(unitDefinition.powerCost));
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

/** 戦闘進入時に捨てる別の自軍S（進入ユニット自身は不可）。 */
export function hasBattleEntryRushDiscardTarget(
  player: PlayerState,
  definitions: GameState["definitions"],
  enteringInstanceId: string,
): boolean {
  return player.rush.some(
    (c) => isSmallUnit(definitions, c.cardId) && c.instanceId !== enteringInstanceId,
  );
}

export function battleEntryRushDiscardSatisfied(player: PlayerState, cardId: string): boolean {
  if (!needsBattleEntryRushDiscard(cardId)) return true;
  return isCostWindowSatisfied(player, "battle_entry_rush_discard");
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
  return isCostWindowSatisfied(player, "battle_entry_hand_discard");
}

export function needsBattleEntryPowerDiscard(cardId: string): boolean {
  return getBattleEntryPowerDiscardCount(cardId) > 0;
}

export function canPayBattleEntryPowerDiscard(
  player: PlayerState,
  cardId: string,
): boolean {
  const count = getBattleEntryPowerDiscardCount(cardId);
  if (count <= 0) return true;
  const nonDamage = player.power.filter((c) => !c.faceDown).length;
  return nonDamage >= count;
}

export function battleEntryPowerDiscardSatisfied(
  player: PlayerState,
  cardId: string,
): boolean {
  if (!needsBattleEntryPowerDiscard(cardId)) return true;
  return isCostWindowSatisfied(player, "battle_entry_power_discard");
}

export function tryStartBattleEntryPowerDiscard(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState | null {
  const count = getBattleEntryPowerDiscardCount(entering.cardId);
  if (count <= 0) return null;
  const player = state.players[playerId];
  const valid = player.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
  if (valid.length < count) return null;

  return {
    ...state,
    pendingEffectChoice: {
      playerId,
      effectId: "battle_entry_power_discard",
      sourceCardId: entering.cardId,
      sourceInstanceId: entering.instanceId,
      kind: "select_power",
      phasePlayerId: playerId,
      validInstanceIds: valid,
      selectCount: count,
      optional: false,
    },
    activePlayer: playerId,
  };
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

/** Returns true if a note_other_* nc restriction blocks this attacker→defender pairing. */
function noteOtherNcAttackRestriction(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerCard: CardInstance,
  defenderPlayerId: PlayerId,
  defenderCard: CardInstance,
): boolean {
  const atkId = attackerCard.cardId;
  const defId = defenderCard.cardId;
  const atkDef = getDefinition(state.definitions, atkId);
  const defDef = getDefinition(state.definitions, defId);
  const atkFeatures = atkDef?.features ?? [];
  const defFeatures = defDef?.features ?? [];
  const atkPlayer = state.players[attackerPlayerId];
  const defPlayer = state.players[defenderPlayerId];

  // RK-067: can't attack 男/女 units without own 女 in discard
  if (atkId === "RK-067") {
    const hasFemaleInDiscard = atkPlayer.discard.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.type === "unit" && d.features?.includes("女");
    });
    if (!hasFemaleInDiscard && (defFeatures.includes("男") || defFeatures.includes("女"))) {
      return true;
    }
  }

  // RK-198: if defender is RK-198 and defender's owner has レイヨウ型 in battle, S-units can't attack
  if (defId === "RK-198") {
    const hasReiyo = defPlayer.battle.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("レイヨウ型");
    });
    if (hasReiyo && atkDef?.type === "unit" && atkDef.size === "S") {
      return true;
    }
  }

  // RK-255: if defender is RK-255 and defender's owner has 仮面ライダー in battle, S-units can't attack
  if (defId === "RK-255") {
    const hasRider = defPlayer.battle.some((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("仮面ライダー");
    });
    if (hasRider && atkDef?.type === "unit" && atkDef.size === "S") {
      return true;
    }
  }

  // RK-287: can only attack 仮面ライダー units
  if (atkId === "RK-287") {
    if (!defFeatures.includes("仮面ライダー")) return true;
  }

  // RK-308: can't attack 獣 units
  if (atkId === "RK-308") {
    if (defFeatures.includes("獣")) return true;
  }

  // RK-311: can't attack if own unit count > enemy unit count
  if (atkId === "RK-311") {
    const ownCount = atkPlayer.rush.length + atkPlayer.battle.length;
    const enemyCount = defPlayer.rush.length + defPlayer.battle.length;
    if (ownCount > enemyCount) return true;
  }

  // RM-044: can't attack 男 or 女 units
  if (atkId === "RM-044") {
    if (defFeatures.includes("男") || defFeatures.includes("女")) return true;
  }

  // RS-442: can't be attacked by 女 units
  if (defId === "RS-442") {
    if (atkFeatures.includes("女")) return true;
  }

  // RS-544: can't be attacked by units with 3+ features
  if (defId === "RS-544") {
    if (atkFeatures.length >= 3) return true;
  }

  // XG1-014: can't attack held units (commandHeld: true)
  if (atkId === "XG1-014") {
    if (defenderCard.commandHeld) return true;
  }

  // XG1-049: can't be attacked by non-wing units
  if (defId === "XG1-049") {
    const attackerHasWing = cardHasKeyword(state.definitions, atkId, "wing", {
      state,
      playerId: attackerPlayerId,
    });
    if (!attackerHasWing) return true;
  }

  // XG1-077: can't attack released units (commandHeld: false or undefined)
  if (atkId === "XG1-077") {
    if (!defenderCard.commandHeld) return true;
  }

  // XG1-094: can't be attacked by held units (commandHeld: true)
  if (defId === "XG1-094") {
    if (attackerCard.commandHeld) return true;
  }

  // XG3-030: can only attack SP1+ units (sp is defined and not 0)
  if (atkId === "XG3-030") {
    const sp = defDef?.sp;
    if (sp === undefined || sp === 0) return true;
  }

  // RS-419 (聖剣ズバーン): cannot attack at all
  if (atkId === "RS-419") return true;

  return false;
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
  const attackerPlayer = state.players[attackerPlayerId];
  const attacker =
    findInZone(attackerPlayer, "battle", attackerInstanceId) ??
    findInZone(attackerPlayer, "rush", attackerInstanceId);
  if (!attacker) return false;

  if (isVehicle(getDefinition(state.definitions, attacker.card.cardId))) return false;

  const attackerInRush = findInZone(attackerPlayer, "rush", attackerInstanceId);
  if (
    attackerInRush &&
    !canWingAttackFromRush(state, attackerPlayerId, attackerInRush.card)
  ) {
    return false;
  }

  const enemy = state.players[defenderPlayerId];
  const inBattle = findInZone(enemy, "battle", defenderInstanceId);
  const inRush = findInZone(enemy, "rush", defenderInstanceId);

  if (inRush) {
    if (isVehicle(getDefinition(state.definitions, inRush.card.cardId))) return false;
    if (
      promotedDefenderBlocksAttack(
        state,
        attackerPlayerId,
        attackerInstanceId,
        defenderPlayerId,
        defenderInstanceId,
      ) ||
      promotedAttackerCannotTarget(
        state,
        attackerPlayerId,
        attackerInstanceId,
        defenderPlayerId,
        defenderInstanceId,
      )
    ) {
      return false;
    }
    if (noteOtherNcAttackRestriction(state, attackerPlayerId, attacker.card, defenderPlayerId, inRush.card)) {
      return false;
    }
    if (cardHasGrantKeyword(attacker.card.cardId, "wing_attack_enemy_rush")) {
      return true;
    }
    if (
      keywordAllowsAttackIntoRush(
        state,
        attacker.card.cardId,
        defenderPlayerId,
        defenderInstanceId,
      )
    ) {
      return true;
    }
    if (
      hasUnnamedRule(attacker.card.cardId, "can_attack_enemy_rush_s") &&
      isSmallUnit(state.definitions, inRush.card.cardId)
    ) {
      return true;
    }
    return canAttackRushFn(state, attackerPlayerId, attackerInstanceId);
  }

  if (!inBattle) return false;

  if (isVehicle(getDefinition(state.definitions, inBattle.card.cardId))) return false;

  if (scrumBlocksAttack(state, defenderPlayerId, defenderInstanceId)) {
    return false;
  }

  if (
    promotedDefenderBlocksAttack(
      state,
      attackerPlayerId,
      attackerInstanceId,
      defenderPlayerId,
      defenderInstanceId,
    )
  ) {
    return false;
  }

  if (
    promotedAttackerCannotTarget(
      state,
      attackerPlayerId,
      attackerInstanceId,
      defenderPlayerId,
      defenderInstanceId,
    )
  ) {
    return false;
  }

  if (noteOtherNcAttackRestriction(state, attackerPlayerId, attacker.card, defenderPlayerId, inBattle.card)) {
    return false;
  }

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
