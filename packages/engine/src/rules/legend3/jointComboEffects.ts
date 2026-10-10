import { getJointLNamedEffect, getJointRNamedEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../../types/game";
import { openOptionalEffectConfirm, registerOptionalEffect } from "../optionalEffects";
import { shuffleCards } from "../errataCardEffects";
import { getDefinition } from "../../core/catalog";
import { opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  startCrossThunderChoice,
  startSelectCommandChoice,
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
      const withChoice = startCrossThunderChoice(
        nextState,
        playerId,
        rCardId,
        phasePlayerId,
      );
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
      // 「次の効果を発動できる⇒相手は…全て山札に戻してシャッフルする。その後、戻した枚数を山札の上からひいて、
      // コマンドゾーンにホールド状態で置く」（atwiki/page-355）— 発動するかを選ぶ。
      if (nextState.players[enemyId].command.length > 0) {
        nextState = openOptionalEffectConfirm(nextState, {
          playerId,
          effectId: "wall_shoot",
          sourceCardId: rCardId,
          phasePlayerId,
        });
      }
      logs.push(
        buildLogEntry(playerId, "joint_combo_r", rCardId, state.definitions, "wall_shoot"),
      );
      break;
    }
    case "lift_up": {
      // 「次の効果を発動できる⇒自軍コマンドゾーンからカードを1枚選んで手札に戻す。その後、山札から1枚ひいて
      // 自軍コマンドゾーンに置く」（atwiki/page-356）。選んだあとで山札から置く（pendingChoices の lift_up）。
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

registerOptionalEffect("wall_shoot", {
  apply: (state, pending) => {
    const enemyId = opponent(pending.playerId);
    const enemy = state.players[enemyId];
    const returned = enemy.command.length;
    let nextState: GameState = {
      ...state,
      ...updatePlayer(state, enemyId, {
        ...enemy,
        command: [],
        deck: shuffleCards([...enemy.command.map((c) => ({ ...c, commandHeld: undefined })), ...enemy.deck]),
      }),
    };
    for (let i = 0; i < returned; i++) {
      const p = nextState.players[enemyId];
      if (p.deck.length === 0 || p.command.length >= 5) break;
      const [drawn, deck] = removeAt(p.deck, 0);
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, enemyId, {
          ...p,
          deck,
          command: [...p.command, { ...drawn!, commandHeld: true }],
        }),
      };
    }
    return nextState;
  },
});

/** RS-174【リフトアップ】の後半: 山札から1枚ひいて自軍コマンドゾーンに置く。 */
export function liftUpPlaceFromDeck(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  if (player.deck.length === 0 || player.command.length >= 5) return state;
  const [drawn, rest] = removeAt(player.deck, 0);
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck: rest,
      command: [...player.command, { ...drawn!, commandHeld: false }],
    }),
  };
}
