import type { GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { applyPlayerDamage, findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectFieldUnitIds,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import type { NamedEffectOutcome } from "../namedUnitEffects";

/** Legend2 on-rush effect handlers. */
export function resolveLegend2OnRushEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
  cardId: string,
  effectId: string,
): NamedEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state, logs: [] };

  const enemyId = opponent(rusherPlayerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "rescue_activity": {
      const targets = rusher.discard
        .filter((c) => getDefinition(state.definitions, c.cardId)?.features?.includes("メカ"))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId: rusherPlayerId,
          effectId,
          sourceCardId: cardId,
          phasePlayerId,
          validInstanceIds: targets,
          unitDestination: "hand_from_discard",
        });
        if (withChoice) nextState = withChoice;
      }
      break;
    }
    case "sure_win_combination": {
      const damaged = applyPlayerDamage(state.players[enemyId], 2);
      nextState = { ...state, ...updatePlayer(state, enemyId, damaged) };
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "firefighting": {
      const powerTargets = rusher.power.filter((c) => c.faceDown).map((c) => c.instanceId);
      if (powerTargets.length > 0) {
        const player = nextState.players[rusherPlayerId];
        const idx = player.power.findIndex((c) => c.instanceId === powerTargets[0]);
        if (idx >= 0) {
          const power = [...player.power];
          power[idx] = { ...power[idx]!, faceDown: false };
          nextState = {
            ...nextState,
            ...updatePlayer(nextState, rusherPlayerId, { ...player, power }),
          };
        }
      }
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "dismantling": {
      const player = nextState.players[rusherPlayerId];
      const powerIdx = player.power.findIndex((c) => c.faceDown);
      if (powerIdx >= 0 && player.hand.length > 0) {
        const power = [...player.power];
        const [fromPower] = power.splice(powerIdx, 1);
        const hand = [...player.hand];
        const [toPower] = hand.splice(0, 1);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, rusherPlayerId, {
            ...player,
            power: [...power, { ...toPower!, faceDown: true }],
            hand: [...hand, fromPower!],
          }),
        };
      }
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "heavenly_disaster": {
      for (const pid of [rusherPlayerId, enemyId] as const) {
        const player = nextState.players[pid];
        const toDiscard = player.power.filter((c) => !c.faceDown);
        const faceDown = player.power.filter((c) => c.faceDown);
        nextState = {
          ...nextState,
          ...updatePlayer(nextState, pid, {
            ...player,
            power: [...faceDown, ...player.hand.map((c) => ({ ...c, faceDown: true }))],
            discard: [...player.discard, ...toDiscard],
            hand: [],
          }),
        };
      }
      logs.push(
        buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, effectId),
      );
      break;
    }
    case "karakuri_great_tsunami": {
      const targets = collectFieldUnitIds(nextState, enemyId, 3000, ["rush", "battle"]);
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: rusherPlayerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId,
        validInstanceIds: targets,
        unitDestination: "hand",
      });
      if (withChoice) nextState = withChoice;
      break;
    }
    case "air_transport": {
      const targets = rusher.command
        .filter((c) => {
          if (c.commandHeld) return false;
          const def = getDefinition(state.definitions, c.cardId);
          return def?.type === "unit" && def.size === "M";
        })
        .map((c) => c.instanceId);
      const withChoice = startSelectCommandChoice(nextState, {
        playerId: rusherPlayerId,
        effectId,
        sourceCardId: cardId,
        phasePlayerId,
        commandFilter: "released",
        commandAction: "rush",
        optional: true,
        validInstanceIds: targets,
      });
      if (withChoice) nextState = withChoice;
      break;
    }
  }

  if (nextState.pendingEffectChoice && nextState !== state && logs.length === 0) {
    logs.push(
      buildLogEntry(rusherPlayerId, "named_effect", cardId, state.definitions, `choice:${effectId}`),
    );
  }

  return { state: nextState, logs };
}
