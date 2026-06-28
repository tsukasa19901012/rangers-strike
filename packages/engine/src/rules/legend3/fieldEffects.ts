import {
  findNamedEffectByEffectId,
  getJointLNamedEffect,
  hasUnnamedRule,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import {
  effectiveBp,
  getDefinition,
  isMediumUnit,
  isSmallUnit,
  unitEffectiveCategories,
} from "../../core/catalog";
import { countReleasedCommands } from "../restrictions";
import { opponent } from "../../core/helpers";
import { promotedKeywordSpFloor } from "../../dsl/promotedKeywordBridge";
import { legend2EffectiveSp } from "../legend2/fieldEffects";

export function legend3FieldBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  role: "general" | "attacking" | "defending",
): number {
  let bonus = 0;
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def) return 0;

  if (findNamedEffectByEffectId(instance.cardId, "furious_shark_shot") ||
      findNamedEffectByEffectId(instance.cardId, "heaven_earth_animal_heart")) {
    const wbMCount = state.players[playerId].battle.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.category === "WB" && isMediumUnit(state.definitions, c.cardId);
    }).length;
    bonus += wbMCount * 2000;
  }

  if (role === "attacking" || role === "general") {
    if (findNamedEffectByEffectId(instance.cardId, "star_raiser") && state.activePlayer === playerId) {
      bonus += countReleasedCommands(state.players[playerId]) * 2000;
    }
    if (findNamedEffectByEffectId(instance.cardId, "iron_broken") && state.activePlayer === playerId) {
      bonus += 3000;
    }
    if (findNamedEffectByEffectId(instance.cardId, "blazing_fire") && state.activePlayer === playerId) {
      bonus += 2000;
    }
  }

  if (role === "general" && state.activePlayer !== playerId) {
    const hasMoaLoader = state.players[playerId].rush.some(
      (c) => findNamedEffectByEffectId(c.cardId, "super_moa_cannon"),
    );
    if (
      hasMoaLoader &&
      instance.cardId !== "RS-147" &&
      isMediumUnit(state.definitions, instance.cardId) &&
      unitEffectiveCategories(state, playerId, instance, "battle").includes("MA")
    ) {
      bonus += 1000;
    }
  }

  return bonus;
}

export function isStealthUnit(state: GameState, instanceId: string): boolean {
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const zone of ["battle", "rush"] as const) {
      const found = player[zone].find((c) => c.instanceId === instanceId);
      if (found && findNamedEffectByEffectId(found.cardId, "stealth")) {
        return true;
      }
    }
  }
  return false;
}

function hasScorchingRoarOnField(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    if (
      player[zone].some((c) =>
        findNamedEffectByEffectId(c.cardId, "scorching_roar"),
      )
    ) {
      return true;
    }
  }
  return false;
}

/** RS-152 灼熱の咆哮: 場のガオライオンが WB M の※ホールド進入を無効化（捨札に同名あり）。 */
export function scorchingRoarBypassesHold(
  cardId: string,
  state: GameState,
  playerId: PlayerId,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.category !== "WB" || !isMediumUnit(state.definitions, cardId)) return false;
  if (!hasScorchingRoarOnField(state, playerId)) return false;
  const unitName = def.name;
  return state.players[playerId].discard.some(
    (c) => getDefinition(state.definitions, c.cardId)?.name === unitName,
  );
}

export function legend3EnemySComboDelta(state: GameState, playerId: PlayerId): number {
  let delta = 0;
  const enemyId = playerId === "player1" ? "player2" : "player1";
  for (const card of state.players[enemyId].battle) {
    if (findNamedEffectByEffectId(card.cardId, "data_analysis")) {
      delta += 1;
    }
  }
  for (const card of state.players[enemyId].rush) {
    if (findNamedEffectByEffectId(card.cardId, "data_analysis")) {
      delta += 1;
    }
  }
  return delta;
}

export function elephantShieldMustTarget(
  state: GameState,
  defenderPlayerId: PlayerId,
): string | null {
  const player = state.players[defenderPlayerId];
  for (let i = 0; i < player.battle.length; i++) {
    const card = player.battle[i]!;
    if (getDefinition(state.definitions, card.cardId)?.comboNumber !== "R") continue;
    const partner = player.battle[i - 1];
    if (!partner) continue;
    const joint = findNamedEffectByEffectId(card.cardId, "elephant_shield");
    if (joint) return card.instanceId;
  }
  return null;
}

export function shovelDefenseBlocksStrike(state: GameState, strikerPlayerId: PlayerId): boolean {
  const enemyId = strikerPlayerId === "player1" ? "player2" : "player1";
  const player = state.players[enemyId];
  for (let i = 0; i < player.battle.length; i++) {
    const card = player.battle[i]!;
    if (getDefinition(state.definitions, card.cardId)?.comboNumber !== "R") continue;
    if (findNamedEffectByEffectId(card.cardId, "shovel_defense")) {
      const partner = player.battle[i - 1];
      if (partner && getDefinition(state.definitions, partner.cardId)?.size === "L") {
        return true;
      }
    }
  }
  return false;
}

export function cannotEnterBattleOwnTurn(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (state.activePlayer !== playerId) return false;
  return hasUnnamedRule(cardId, "cannot_enter_battle_own_turn");
}

function jointLEffectIdForUnit(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): string | undefined {
  const player = state.players[playerId];
  const index = player.battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index <= 0) return undefined;
  const partner = player.battle[index - 1];
  if (!partner || getDefinition(state.definitions, partner.cardId)?.size !== "L") {
    return undefined;
  }
  return getJointLNamedEffect(partner.cardId)?.effectId;
}

/** RS-157 oni_neck_last: BP20000+ で自ターンにSP2付与。 */
export function legend3EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  let sp = legend2EffectiveSp(state, playerId, instance);
  if (state.activePlayer !== playerId) return sp;

  const joint = jointLEffectIdForUnit(state, playerId, instance);
  if (joint === "oni_neck_last") {
    const bp = effectiveBp(state, playerId, instance);
    if (bp >= 20000) {
      sp = Math.max(sp, 2);
    }
  }

  const promotedFloor = promotedKeywordSpFloor(state, playerId, instance);
  if (promotedFloor > 0) {
    sp = Math.max(sp, promotedFloor);
  }

  if (
    instance.cardId === "RS-382" &&
    instance.activatedNcEffects?.includes("victory_robo_strike")
  ) {
    sp += state.players[playerId].sUnitsRecoveredFromDiscardThisTurn ?? 0;
  }

  // RS-612: SP1 if own メカ command cards ≥ 4
  if (instance.cardId === "RS-612") {
    const mechaCommandCount = state.players[playerId].command.filter((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      return d?.features?.includes("メカ");
    }).length;
    if (mechaCommandCount >= 4) sp = Math.max(sp, 1);
  }

  // RK-184: SP1 when in held state (commandHeld=true in battle zone)
  if (instance.cardId === "RK-184" && instance.commandHeld) {
    sp = Math.max(sp, 1);
  }

  // RK-329: SP1 if all enemy units are S-units (no M or L)
  if (instance.cardId === "RK-329") {
    const enemyId = opponent(playerId);
    const enemyUnits = [...state.players[enemyId].rush, ...state.players[enemyId].battle];
    const allEnemyAreS = enemyUnits.length > 0 && enemyUnits.every((c) =>
      isSmallUnit(state.definitions, c.cardId),
    );
    if (allEnemyAreS) sp = Math.max(sp, 1);
  }

  // XG4-008: SP1 while riding (mountedOnInstanceId is set)
  if (instance.cardId === "XG4-008" && instance.mountedOnInstanceId) {
    sp = Math.max(sp, 1);
  }

  return sp;
}
