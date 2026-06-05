import { getOnAttackNamedEffect, getJointLNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit, parsePowerCost } from "../../core/catalog";
import { findInZone, opponent, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startMultiCommandChoice,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { ComboOutcome } from "../comboTypes";

export function legend3AttackerBpBonus(
  state: GameState,
  pending: PendingBattle,
): number {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  if (!attacker) return 0;

  const effect = getOnAttackNamedEffect(attacker.card.cardId);
  let bonus = 0;
  if (effect?.effectId === "super_live_crush") bonus += 4000;
  if (effect?.effectId === "surging_chopper" && state.activePlayer === pending.attackerPlayerId) {
    const defenderZone = findInZone(
      state.players[pending.defenderPlayerId],
      "battle",
      pending.defenderInstanceId,
    )
      ? "battle"
      : "rush";
    const defender = findInZone(
      state.players[pending.defenderPlayerId],
      defenderZone,
      pending.defenderInstanceId,
    );
    if (defender && isSmallUnit(state.definitions, defender.card.cardId)) {
      bonus += 5000;
    }
  }

  return bonus + legend3JointComboBpBonus(state, pending.attackerPlayerId, attacker.card);
}

function legend3JointComboBpBonus(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): number {
  const player = state.players[playerId];
  const index = player.battle.findIndex((c) => c.instanceId === card.instanceId);
  if (index <= 0) return 0;
  const partner = player.battle[index - 1];
  if (!partner || getDefinition(state.definitions, partner.cardId)?.size !== "L") return 0;

  const joint = getJointLNamedEffect(partner.cardId);
  if (
    joint?.effectId !== "oni_neck_last" &&
    joint?.effectId !== "maximum_penetration"
  ) {
    return 0;
  }
  if (state.activePlayer !== playerId) return 0;
  return 4000;
}

export function canAttackRushWithMoonlightSonic(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
): boolean {
  const attacker = findInZone(
    state.players[attackerPlayerId],
    "battle",
    attackerInstanceId,
  );
  return getOnAttackNamedEffect(attacker?.card.cardId ?? "")?.effectId === "moonlight_sonic";
}

export function legend3UsePrintedDefenderBp(
  state: GameState,
  pending: PendingBattle,
): boolean {
  const attacker = findInZone(
    state.players[pending.attackerPlayerId],
    "battle",
    pending.attackerInstanceId,
  );
  if (!attacker || !isSmallUnit(state.definitions, attacker.card.cardId)) return false;
  return !!state.players[pending.attackerPlayerId].turnModifiers?.superDynamiteActive;
}

export function resolveLegend3EnterBattle(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  effectId: string,
): ComboOutcome {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "anti_bio_cannon": {
      const discarded = state.players[playerId].battleEntryDiscardedCardId;
      if (discarded !== "RS-079") return { state, logs: [] };
      const player = state.players[playerId];
      const battle = player.battle.map((c) =>
        c.cardId === cardId
          ? {
              ...c,
              spModifier: (c.spModifier ?? 0) + 1,
              bpModifier: (c.bpModifier ?? 0) + 5000,
            }
          : c,
      );
      return {
        state: { ...state, ...updatePlayer(state, playerId, { ...player, battle }) },
        logs: [
          buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId),
        ],
      };
    }
    case "fire_dance": {
      const damage = state.players[enemyId].power.filter((c) => c.faceDown).length;
      if (damage === 0) return { state, logs: [] };
      const held = collectCommandIds(state, enemyId, "released");
      if (held.length === 0) return { state, logs: [] };
      const withChoice = startMultiCommandChoice(state, {
        playerId: enemyId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId: playerId,
        selectCount: Math.min(damage, held.length),
        commandFilter: "released",
        commandAction: "hold",
        optional: false,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    case "crown_final_crush": {
      const player = state.players[playerId];
      const nextPlayer = {
        ...player,
        command: player.command.map((c) => ({ ...c, commandHeld: false })),
      };
      return {
        state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        logs: [
          buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId),
        ],
      };
    }
    case "hyper_civilization_guard": {
      if (state.activePlayer !== playerId) return { state, logs: [] };
      const player = state.players[playerId];
      const nextPlayer = {
        ...player,
        command: player.command.map((c) => ({ ...c, commandHeld: false })),
      };
      return {
        state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        logs: [
          buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId),
        ],
      };
    }
    case "steel_horn": {
      const maxBp = state.players[enemyId].power.filter((c) => c.faceDown).length;
      const targets = [
        ...state.players[enemyId].battle,
        ...state.players[enemyId].rush,
      ]
        .filter((c) => {
          const cost = getDefinition(state.definitions, c.cardId)?.powerCost ?? 99;
          const n = typeof cost === "number" ? cost : parsePowerCost(cost);
          return n <= maxBp;
        })
        .map((c) => c.instanceId);
      if (targets.length === 0) return { state, logs: [] };
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "discard",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    case "bio_particle_slash": {
      const otCommands = state.players[playerId].command
        .filter((c) => {
          const def = getDefinition(state.definitions, c.cardId);
          return def?.category === "OT";
        })
        .map((c) => c.instanceId);
      if (otCommands.length < 2) return { state, logs: [] };
      const withChoice = startMultiCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId: playerId,
        selectCount: 2,
        commandFilter: "any",
        commandAction: "power",
        validInstanceIds: otCommands,
      });
      return {
        state: withChoice ?? state,
        logs: withChoice
          ? [buildLogEntry(playerId, "enter_battle", cardId, state.definitions, effectId)]
          : [],
      };
    }
    default:
      return { state, logs: [] };
  }
}

function collectCommandIds(
  state: GameState,
  playerId: PlayerId,
  filter: "held" | "released" | "any",
): string[] {
  return state.players[playerId].command
    .filter((c) => {
      if (filter === "held") return c.commandHeld;
      if (filter === "released") return !c.commandHeld;
      return true;
    })
    .map((c) => c.instanceId);
}

export function shouldRunConditionalOnEnter(effectId: string): boolean {
  return !["red_boot", "jet_skateboard", "falcon_claw", "sagas_sniper", "dark_deal"].includes(
    effectId,
  );
}

export function tryStartLegend3ConditionalChoice(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "string_fist": {
      const targets = state.players[enemyId].battle.map((c) => c.instanceId);
      if (targets.length === 0) return null;
      return {
        ...state,
        pendingEffectChoice: {
          playerId,
          effectId,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          kind: "select_unit_step",
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "rush",
          step: "own",
          optional: true,
          selectCount: 1,
        },
        activePlayer: playerId,
      };
    }
    default:
      return null;
  }
}

export function isLegend3EnterBattleEffect(effectId: string): boolean {
  return [
    "fire_dance",
    "crown_final_crush",
    "hyper_civilization_guard",
    "steel_horn",
    "bio_particle_slash",
    "anti_bio_cannon",
  ].includes(effectId);
}
