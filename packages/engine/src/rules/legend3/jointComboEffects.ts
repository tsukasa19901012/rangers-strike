import { getJointLNamedEffect, getJointRNamedEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { requestDrawFromDeck } from "../drawFromDeck";
import {
  collectFieldUnitIds,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { ComboOutcome } from "../comboTypes";

export function resolveLegend3JointCombo(
  state: GameState,
  playerId: PlayerId,
  lCardId: string,
  lEffectId: string,
  partnerInstanceId: string,
): ComboOutcome {
  let nextState = state;
  const logs: string[] = [];

  switch (lEffectId) {
    case "oni_neck_last":
    case "maximum_penetration":
    case "baki_baki_punch":
      logs.push(
        buildLogEntry(playerId, "joint_combo_l", lCardId, state.definitions, partnerInstanceId),
      );
      break;
    default:
      break;
  }

  return { state: nextState, logs };
}

export function resolveLegend3JointComboR(
  state: GameState,
  playerId: PlayerId,
  rCardId: string,
  rEffectId: string,
  phasePlayerId: PlayerId,
): ComboOutcome {
  const enemyId = opponent(playerId);
  let nextState = state;
  const logs: string[] = [];

  switch (rEffectId) {
    case "elephant_shield":
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "elephant_shield"),
      );
      break;
    case "cross_thunder": {
      const ownTargets = collectFieldUnitIds(nextState, playerId, 5000);
      const enemyTargets = collectFieldUnitIds(nextState, enemyId, 5000);
      const withChoice = startSelectUnitChoice(nextState, {
        playerId,
        effectId: rEffectId,
        sourceCardId: rCardId,
        phasePlayerId,
        validInstanceIds: ownTargets.length > 0 ? ownTargets : enemyTargets,
        unitDestination: "discard",
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "cross_thunder"),
      );
      break;
    }
    case "shovel_defense":
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "shovel_defense"),
      );
      break;
    case "wall_shoot": {
      const enemy = nextState.players[enemyId];
      const returned = enemy.command.length;
      if (returned > 0) {
        const nextEnemy: PlayerState = {
          ...enemy,
          command: [],
          deck: [...enemy.command, ...enemy.deck],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, enemyId, nextEnemy) };
        for (let i = 0; i < returned && nextState.players[enemyId].deck.length > 0; i++) {
          const draw = requestDrawFromDeck(nextState, enemyId, phasePlayerId, { count: 1 });
          nextState = draw.state;
          const drawn = draw.drawn?.[0];
          if (!drawn) break;
          const p = nextState.players[enemyId];
          if (p.command.length >= 5) break;
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, enemyId, {
              ...p,
              command: [...p.command, { ...drawn, commandHeld: true }],
            }),
          };
        }
      }
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "wall_shoot"),
      );
      break;
    }
    case "lift_up": {
      const player = nextState.players[playerId];
      if (player.command.length > 0) {
        const withChoice = startSelectCommandChoice(nextState, {
          playerId,
          effectId: rEffectId,
          sourceCardId: rCardId,
          phasePlayerId,
          commandFilter: "any",
          commandAction: "return_hand",
          optional: true,
          validInstanceIds: player.command.map((c) => c.instanceId),
        });
        if (withChoice) nextState = withChoice;
      }
      const afterPlayer = nextState.players[playerId];
      if (afterPlayer.deck.length > 0) {
        const [drawn, rest] = removeAt(afterPlayer.deck, 0);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, playerId, {
            ...afterPlayer,
            deck: rest,
            command: [...afterPlayer.command, { ...drawn!, commandHeld: false }],
          }),
        };
      }
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "lift_up"),
      );
      break;
    }
    default:
      break;
  }

  return { state: nextState, logs };
}

export function getLegend3JointLEffect(cardId: string): string | undefined {
  const named = getJointLNamedEffect(cardId);
  if (!named) return undefined;
  if (["oni_neck_last", "maximum_penetration", "baki_baki_punch"].includes(named.effectId)) {
    return named.effectId;
  }
  return undefined;
}

export function getLegend3JointREffect(cardId: string): string | undefined {
  const named = getJointRNamedEffect(cardId);
  if (!named) return undefined;
  if (
    [
      "elephant_shield",
      "cross_thunder",
      "shovel_defense",
      "wall_shoot",
      "lift_up",
    ].includes(named.effectId)
  ) {
    return named.effectId;
  }
  return undefined;
}

export function isLegend3JointLEffect(effectId: string): boolean {
  return ["oni_neck_last", "maximum_penetration", "baki_baki_punch"].includes(effectId);
}

export function isLegend3JointREffect(effectId: string): boolean {
  return [
    "elephant_shield",
    "cross_thunder",
    "shovel_defense",
    "wall_shoot",
    "lift_up",
  ].includes(effectId);
}
