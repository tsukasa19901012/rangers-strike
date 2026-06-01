import { getOnAttackNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import {
  getDefinition,
  isSmallUnit,
  unitBp,
} from "../../core/catalog";
import { findInZone, opponent, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectCommandIds,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import { resolveSkyMagicSlash } from "../namedUnitEffects";
import type { NamedEffectOutcome } from "../namedUnitEffects";
import type { ComboOutcome } from "../comboTypes";

/** RS-095: return all enemy rush S to hand. */
export function resolveManeHurricane(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): NamedEffectOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const toReturn = enemy.rush.filter((c) => isSmallUnit(state.definitions, c.cardId));
  if (toReturn.length === 0) {
    return { state, logs: [] };
  }

  const returnIds = new Set(toReturn.map((c) => c.instanceId));
  const nextEnemy = {
    ...enemy,
    rush: enemy.rush.filter((c) => !returnIds.has(c.instanceId)),
    hand: [...enemy.hand, ...toReturn],
  };

  return {
    state: { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
    logs: [
      buildLogEntry(playerId, "enter_battle", cardId, state.definitions, "mane_hurricane"),
    ],
  };
}

/** RS-121: opponent may rush unit from command (effects suppressed). */
export function resolveRuinExcavation(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): NamedEffectOutcome {
  const enemyId = opponent(playerId);
  const targets = state.players[enemyId].command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && (def.size === "S" || def.size === "M");
    })
    .map((c) => c.instanceId);

  if (targets.length === 0) {
    return { state, logs: [] };
  }

  const withChoice = startSelectCommandChoice(state, {
    playerId: enemyId,
    effectId: "ruin_excavation",
    sourceCardId: cardId,
    phasePlayerId: playerId,
    commandFilter: "any",
    commandAction: "rush_silent",
    optional: true,
    validInstanceIds: targets,
  });

  if (!withChoice) return { state, logs: [] };

  return {
    state: withChoice,
    logs: [
      buildLogEntry(playerId, "enter_battle", cardId, state.definitions, "ruin_excavation"),
    ],
  };
}

export function resolveLegend2EnterBattle(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  effectId: string,
): ComboOutcome {
  switch (effectId) {
    case "mane_hurricane": {
      const result = resolveManeHurricane(state, playerId, cardId);
      return { state: result.state, logs: result.logs };
    }
    case "sky_magic_slash":
    case "phantom_illusion": {
      const result = resolveSkyMagicSlash(state, playerId, cardId);
      return { state: result.state, logs: result.logs };
    }
    case "ruin_excavation": {
      const result = resolveRuinExcavation(state, playerId, cardId);
      return { state: result.state, logs: result.logs };
    }
    default:
      return { state, logs: [] };
  }
}

export function legend2AttackerBpBonus(
  state: GameState,
  pending: PendingBattle,
): number {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  if (!attacker) return 0;

  let bonus = 0;
  const atkEffect = getOnAttackNamedEffect(attacker.card.cardId);

  if (atkEffect?.effectId === "dump_punch") bonus += 2000;
  if (atkEffect?.effectId === "adventure_drive_sword") bonus += 4000;

  const mods = state.players[pending.attackerPlayerId].turnModifiers?.ghostAbsorptionBp;
  if (mods?.[attacker.card.instanceId]) {
    return (
      mods[attacker.card.instanceId]! -
      unitBp(getDefinition(state.definitions, attacker.card.cardId))
    );
  }

  return bonus;
}

export function legend2UsePrintedDefenderBp(
  state: GameState,
  pending: PendingBattle,
): boolean {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  if (!attacker) return false;

  const effect = getOnAttackNamedEffect(attacker.card.cardId);
  return effect?.effectId === "val_cannon" || effect?.effectId === "ptera_dagger";
}

export function legend2BlocksDefenderCounters(
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

  const effect = getOnAttackNamedEffect(attacker.card.cardId);
  if (effect?.effectId !== "val_cannon") return false;

  const player = state.players[attackerPlayerId];
  return player.rush.some((c) => c.cardId === "RS-075");
}

export function tryStartLegend2ConditionalChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  switch (effectId) {
    case "ghost_absorption": {
      const enemyId = opponent(playerId);
      const targets = state.players[enemyId].discard
        .filter((c) => isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId);
      if (targets.length === 0) return null;
      return startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "hand_from_discard",
        optional: true,
      });
    }
    case "shift_up": {
      const targets = collectCommandIds(state, playerId, "released");
      if (targets.length < 5) return null;
      return startSelectCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId,
        commandFilter: "released",
        commandAction: "hold",
        optional: true,
        validInstanceIds: targets.slice(0, 5),
      });
    }
    case "precious_guardian": {
      const targets = state.players[playerId].battle
        .filter(
          (c) =>
            isSmallUnit(state.definitions, c.cardId) &&
            c.instanceId !== card.instanceId,
        )
        .map((c) => c.instanceId);
      if (targets.length === 0) return null;
      return startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "swap_battle",
        optional: true,
      });
    }
    default:
      return null;
  }
}

export function applyLegend2ConditionalModifiers(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
): CardInstance {
  /** val_shield / dance_of_darkness are computed dynamically in legend2EffectiveSp. */
  if (effectId === "val_shield" || effectId === "dance_of_darkness") {
    return card;
  }
  return card;
}
