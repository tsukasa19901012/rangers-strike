import { getUnitEffectBlock, hasUnnamedRule } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../../types/game";
import { getDefinition, isSmallUnit } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startDeckJointComboSearch,
  startSelectPowerChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { NamedEffectOutcome } from "../namedUnitEffects";

function rushPowerDiscardCount(cardId: string): number {
  const block = getUnitEffectBlock(cardId);
  const note = block?.unnamedText.find((u) => u.rule === "rush_power_to_discard");
  return note?.discardCount ?? 1;
}

function applyRushPowerToDiscard(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  rushedInstanceId: string,
  discardCount: number,
): NamedEffectOutcome {
  const player = state.players[playerId];
  const faceUp = player.power.filter((c) => !c.faceDown);
  if (faceUp.length === 0) return { state, logs: [] };

  const withChoice = startSelectPowerChoice(state, {
    playerId,
    effectId: "rush_power_to_discard",
    sourceCardId: cardId,
    sourceInstanceId: rushedInstanceId,
    phasePlayerId: playerId,
    selectCount: Math.min(discardCount, faceUp.length),
    optional: false,
  });
  if (!withChoice) return { state, logs: [] };

  return {
    state: withChoice,
    logs: [
      buildLogEntry(playerId, "rush_effect", cardId, state.definitions, "power_to_discard"),
    ],
  };
}

export function resolveLegend3UnnamedRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found || !hasUnnamedRule(found.card.cardId, "rush_power_to_discard")) {
    return { state, logs: [] };
  }
  return applyRushPowerToDiscard(
    state,
    rusherPlayerId,
    found.card.cardId,
    rushedInstanceId,
    rushPowerDiscardCount(found.card.cardId),
  );
}

export function isSuperRadarActive(state: GameState): boolean {
  return ["player1", "player2"].some((pid) =>
    state.players[pid as PlayerId].operation.some((c) => c.cardId === "RS-124"),
  );
}

/** RS-124: S rush → owner returns one non-damage power card to hand. */
export function applySuperRadarOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): NamedEffectOutcome {
  if (!isSuperRadarActive(state)) return { state, logs: [] };

  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found || !isSmallUnit(state.definitions, found.card.cardId)) {
    return { state, logs: [] };
  }

  const faceUpIndex = rusher.power.findIndex((c) => !c.faceDown);
  if (faceUpIndex < 0) return { state, logs: [] };

  const [card, restPower] = removeAt(rusher.power, faceUpIndex);
  const nextPlayer = {
    ...rusher,
    power: restPower,
    hand: [...rusher.hand, card!],
  };

  return {
    state: { ...state, ...updatePlayer(state, rusherPlayerId, nextPlayer) },
    logs: [
      buildLogEntry(
        rusherPlayerId,
        "rush_effect",
        "RS-124",
        state.definitions,
        "super_radar_power_to_hand",
      ),
    ],
  };
}

export function resolveLegend3OnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  cardId: string,
  effectId: string,
): NamedEffectOutcome {
  const enemyId = opponent(rusherPlayerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "great_assault": {
      const targets = collectFieldUnitIds(nextState, enemyId, Number.MAX_SAFE_INTEGER, [
        "battle",
      ]).filter((id) => {
        const inst = nextState.players[enemyId].battle.find((c) => c.instanceId === id);
        if (!inst) return false;
        return getDefinition(nextState.definitions, inst.cardId)?.size === "L";
      });
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "discard",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "airlift": {
      const withChoice = startDeckJointComboSearch(nextState, {
        playerId: rusherPlayerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId,
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "assault": {
      const targets = collectFieldUnitIds(nextState, enemyId, 8000, ["battle"]);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "enemy_command",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "submerge": {
      const rusher = nextState.players[rusherPlayerId];
      const units = rusher.discard
        .filter((c) => getDefinition(nextState.definitions, c.cardId)?.type === "unit")
        .slice(0, 3);
      if (units.length > 0) {
        const unitIds = new Set(units.map((c) => c.instanceId));
        const nextPlayer = {
          ...rusher,
          discard: rusher.discard.filter((c) => !unitIds.has(c.instanceId)),
          deck: [...rusher.deck, ...units],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, rusherPlayerId, nextPlayer) };
      }
      break;
    }
    case "taurus_dive": {
      const enemy = nextState.players[enemyId];
      const toReturn = enemy.rush.filter((c) => {
        if (!isSmallUnit(nextState.definitions, c.cardId)) return false;
        const sp = (c.spModifier ?? 0) + (getDefinition(nextState.definitions, c.cardId)?.sp ?? 0);
        return sp >= 1;
      });
      if (toReturn.length > 0) {
        const returnIds = new Set(toReturn.map((c) => c.instanceId));
        const nextEnemy = {
          ...enemy,
          rush: enemy.rush.filter((c) => !returnIds.has(c.instanceId)),
          hand: [...enemy.hand, ...toReturn],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, enemyId, nextEnemy) };
      }
      break;
    }
    case "earth_resource_absorb": {
      const rusher = nextState.players[rusherPlayerId];
      const released = rusher.command.filter((c) => !c.commandHeld);
      if (released.length > 0) {
        const nextPlayer = {
          ...rusher,
          command: rusher.command.filter((c) => c.commandHeld),
          deck: [...released.reverse(), ...rusher.deck],
        };
        nextState = { ...nextState, ...updatePlayer(nextState, rusherPlayerId, nextPlayer) };
      }
      break;
    }
    case "nature_big_bang_final": {
      const targets = collectFieldUnitIds(nextState, enemyId, 20000, ["battle", "rush"]);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "discard",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    default:
      break;
  }

  if (nextState.pendingEffectChoice && nextState !== state && logs.length === 0) {
    logs.push(
      buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, `choice:${effectId}`),
    );
  } else if (nextState !== state && logs.length === 0) {
    logs.push(buildLogEntry(rusherPlayerId, "rush_effect", cardId, state.definitions, effectId));
  }

  return { state: nextState, logs };
}

export function isLegend3OnRushEffect(effectId: string): boolean {
  return [
    "great_assault",
    "airlift",
    "assault",
    "submerge",
    "taurus_dive",
    "earth_resource_absorb",
    "nature_big_bang_final",
  ].includes(effectId);
}
