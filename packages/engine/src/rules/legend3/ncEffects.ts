import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { startSelectCommandChoice } from "../pendingChoices";
import {
  grantBpBoostToBattleUnit,
  grantSp1ToBattleUnit,
} from "../namedUnitEffects";
import type { ComboOutcome } from "../comboTypes";

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

export function applyLegend3NcEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
): ComboOutcome {
  const enemyId = opponent(playerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "fire_sword": {
      for (const pid of [playerId, enemyId] as const) {
        const ops = nextState.players[pid].operation;
        if (ops.length === 0) continue;
        const [op, rest] = removeAt(ops, 0);
        const player = nextState.players[pid];
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pid, {
            ...player,
            operation: rest,
            power: [...player.power, { ...op!, faceDown: false }],
          }),
        };
        break;
      }
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, "fire_sword"));
      break;
    }
    case "blazing_fire": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      if (state.activePlayer === playerId) {
        nextState = grantBpBoostToBattleUnit(nextState, playerId, card.instanceId, 2000);
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, "blazing_fire"));
      break;
    }
    case "iron_broken": {
      if (state.activePlayer === playerId) {
        nextState = grantBpBoostToBattleUnit(nextState, playerId, card.instanceId, 3000);
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, "iron_broken"));
      break;
    }
    case "dolphin_arrow": {
      const held = state.players[enemyId].command
        .filter((c) => c.commandHeld)
        .map((c) => c.instanceId);
      if (held.length > 0) {
        const withChoice = startSelectCommandChoice(nextState, {
          playerId: enemyId,
          effectId,
          sourceCardId: card.cardId,
          phasePlayerId: playerId,
          commandFilter: "held",
          commandAction: "power",
          validInstanceIds: held,
        });
        if (withChoice) nextState = withChoice;
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, "dolphin_arrow"));
      break;
    }
    case "bumper_bow": {
      const enemy = nextState.players[enemyId];
      const faceUp = enemy.power.find((c) => !c.faceDown);
      if (faceUp && enemy.command.length < 5) {
        const power = enemy.power.filter((c) => c.instanceId !== faceUp.instanceId);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, enemyId, {
            ...enemy,
            power,
            command: [...enemy.command, { ...faceUp, commandHeld: true }],
          }),
        };
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, "bumper_bow"));
      break;
    }
    case "side_knuckle": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, "side_knuckle"));
      break;
    }
    case "star_raiser":
      logs.push(ncLog(playerId, card.cardId, state.definitions, "star_raiser"));
      break;
    default:
      break;
  }

  return { state: nextState, logs };
}

export function isLegend3NcEffect(effectId: string): boolean {
  return [
    "fire_sword",
    "blazing_fire",
    "iron_broken",
    "dolphin_arrow",
    "bumper_bow",
    "side_knuckle",
    "star_raiser",
  ].includes(effectId);
}
