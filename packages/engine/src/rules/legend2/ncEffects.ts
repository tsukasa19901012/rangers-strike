import type { NumberComboEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import {
  effectiveBp,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
  unitBp,
} from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import {
  collectCommandIds,
  startJuuKunDoChoice,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import {
  grantBpBoostToBattleUnit,
  grantSp1ToBattleUnit,
} from "../namedUnitEffects";
import { withTurnModifiers } from "../turnModifiers";
import type { ComboOutcome } from "../comboTypes";

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

function powerCostNumber(definitions: GameState["definitions"], cardId: string): number {
  const def = getDefinition(definitions, cardId);
  const cost = def?.powerCost;
  return typeof cost === "number" ? cost : parsePowerCost(cost ?? 0);
}

function applyCompetition(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const p1 = state.players[playerId];
  const p2 = state.players[enemyId];
  if (p1.deck.length === 0 || p2.deck.length === 0) {
    return { state, logs: [ncLog(playerId, card.cardId, state.definitions, "competition:none")] };
  }

  const [c1, d1] = removeAt(p1.deck, 0);
  const [c2, d2] = removeAt(p2.deck, 0);
  const n1 = powerCostNumber(state.definitions, c1!.cardId);
  const n2 = powerCostNumber(state.definitions, c2!.cardId);

  let nextP1 = p1;
  let nextP2 = p2;
  if (n1 > n2) {
    nextP1 = { ...p1, deck: d1, hand: [...p1.hand, c1!] };
    nextP2 = { ...p2, deck: [...d2, c2!] };
  } else if (n2 > n1) {
    nextP2 = { ...p2, deck: d2, hand: [...p2.hand, c2!] };
    nextP1 = { ...p1, deck: [...d1, c1!] };
  } else {
    nextP1 = { ...p1, deck: [c1!, ...d1] };
    nextP2 = { ...p2, deck: [c2!, ...d2] };
  }

  return {
    state: {
      ...state,
      players: { ...state.players, [playerId]: nextP1, [enemyId]: nextP2 },
    },
    logs: [ncLog(playerId, card.cardId, state.definitions, "competition")],
  };
}

function applyRyuuGekiKen(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const heldCount = state.players[enemyId].command.filter((c) => c.commandHeld).length;
  let nextState = state;
  if (heldCount > 0) {
    nextState = grantBpBoostToBattleUnit(nextState, playerId, card.instanceId, heldCount * 1000);
  }
  const unit = findInZone(nextState.players[playerId], "battle", card.instanceId);
  if (!unit) {
    return {
      state: nextState,
      logs: [ncLog(playerId, card.cardId, state.definitions, "ryuu_geki_ken")],
    };
  }
  const bp =
    unitBp(getDefinition(state.definitions, unit.card.cardId)) +
    (unit.card.bpModifier ?? 0);
  if (bp >= 5000) {
    nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
  }
  return {
    state: nextState,
    logs: [ncLog(playerId, card.cardId, state.definitions, "ryuu_geki_ken")],
  };
}

function destroyAllEnemyAtBp(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  maxBp: number,
  effectId: string,
): ComboOutcome {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const destroyIds = new Set<string>();
  for (const zone of ["rush", "battle"] as const) {
    for (const unit of enemy[zone]) {
      if (unitBp(getDefinition(state.definitions, unit.cardId)) <= maxBp) {
        destroyIds.add(unit.instanceId);
      }
    }
  }
  if (destroyIds.size === 0) {
    return { state, logs: [ncLog(playerId, card.cardId, state.definitions, `${effectId}:none`)] };
  }

  let nextEnemy = { ...enemy };
  for (const zone of ["rush", "battle"] as const) {
    const kept = nextEnemy[zone].filter((c) => !destroyIds.has(c.instanceId));
    const removed = nextEnemy[zone].filter((c) => destroyIds.has(c.instanceId));
    nextEnemy = {
      ...nextEnemy,
      [zone]: kept,
      discard: [...nextEnemy.discard, ...removed],
    };
  }

  return {
    state: { ...state, ...updatePlayer(state, enemyId, nextEnemy) },
    logs: [ncLog(playerId, card.cardId, state.definitions, effectId)],
  };
}

export function applyLegend2NcEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: NumberComboEffectId,
): ComboOutcome {
  const enemyId = opponent(playerId);

  switch (effectId) {
    case "competition":
      return applyCompetition(state, playerId, card);
    case "ryuu_geki_ken":
      return applyRyuuGekiKen(state, playerId, card);
    case "tricera_lance": {
      const targets = collectCommandIds(state, enemyId, "released");
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "released",
        commandAction: "hold",
        validInstanceIds: targets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "tricera_lance")],
      };
    }
    case "ptera_arrow": {
      const targets = collectCommandIds(state, enemyId, "held");
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "held",
        commandAction: "discard",
        validInstanceIds: targets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "ptera_arrow")],
      };
    }
    case "life_rescue": {
      const targets = state.players[playerId].discard
        .filter((c) => isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId);
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "hand_from_discard",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "life_rescue")],
      };
    }
    case "super_ninpo_water_transform": {
      const targets = state.players[enemyId].rush
        .filter((c) => isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId);
      const withChoice = startSelectUnitChoice(state, {
        playerId: enemyId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "hand",
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "super_ninpo_water_transform")],
      };
    }
    case "dark_dual_blade": {
      const enemy = state.players[enemyId];
      const powerTargets = enemy.power.filter((c) => !c.faceDown).map((c) => c.instanceId);
      const commandTargets = collectCommandIds(state, enemyId, "any");
      if (powerTargets.length === 0 && commandTargets.length === 0) {
        return { state, logs: [ncLog(playerId, card.cardId, state.definitions, "dark_dual_blade:none")] };
      }
      const withChoice = startSelectCommandChoice(state, {
        playerId,
        effectId: "dark_dual_blade",
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        commandFilter: "any",
        commandAction: "discard",
        validInstanceIds: powerTargets.length > 0 ? powerTargets : commandTargets,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "dark_dual_blade")],
      };
    }
    case "space_ninpo_rope_skull":
      return destroyAllEnemyAtBp(state, playerId, card, 3000, "space_ninpo_rope_skull");
    case "green_crush": {
      const targets = state.players[enemyId].rush
        .filter((c) => isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId)
        .slice(0, 2);
      const withChoice = startSelectUnitChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        validInstanceIds: targets,
        unitDestination: "enemy_battle",
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "green_crush")],
      };
    }
    case "backup_request": {
      let nextState = grantSp1ToBattleUnit(state, playerId, card.instanceId);
      const targets = nextState.players[playerId].power
        .filter((c) => !c.faceDown && isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId,
          effectId,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId: playerId,
          validInstanceIds: targets,
          unitDestination: "hand_from_power",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      return {
        state: nextState,
        logs: [ncLog(playerId, card.cardId, state.definitions, "backup_request")],
      };
    }
    case "zenibomb": {
      const enemy = withTurnModifiers(state.players[enemyId], { zenibombActive: true });
      return {
        state: { ...state, ...updatePlayer(state, enemyId, enemy) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "zenibomb")],
      };
    }
    case "deace_sniper": {
      const enemy = withTurnModifiers(state.players[enemyId], { deaceSniperActive: true });
      return {
        state: { ...state, ...updatePlayer(state, enemyId, enemy) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "deace_sniper")],
      };
    }
    case "juu_kun_do": {
      const withChoice = startJuuKunDoChoice(state, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        phasePlayerId: playerId,
        optional: true,
      });
      return {
        state: withChoice ?? state,
        logs: [ncLog(playerId, card.cardId, state.definitions, "juu_kun_do")],
      };
    }
    case "super_ninpo_lion_dance": {
      const deckCard = state.players[playerId].deck.find(
        (c) => getDefinition(state.definitions, c.cardId)?.name === "ハリケンイエロー",
      );
      if (!deckCard) {
        return {
          state,
          logs: [ncLog(playerId, card.cardId, state.definitions, "super_ninpo_lion_dance:none")],
        };
      }
      const player = state.players[playerId];
      const deck = player.deck.filter((c) => c.instanceId !== deckCard.instanceId);
      const nextPlayer = {
        ...player,
        deck,
        battle: [...player.battle, deckCard],
      };
      return {
        state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
        logs: [ncLog(playerId, card.cardId, state.definitions, "super_ninpo_lion_dance")],
      };
    }
    default:
      return { state, logs: [] };
  }
}

export function isLegend2NcEffect(effectId: string): boolean {
  return [
    "competition",
    "ryuu_geki_ken",
    "tricera_lance",
    "ptera_arrow",
    "life_rescue",
    "super_ninpo_lion_dance",
    "super_ninpo_water_transform",
    "dark_dual_blade",
    "space_ninpo_rope_skull",
    "juu_kun_do",
    "deace_sniper",
    "green_crush",
    "backup_request",
    "zenibomb",
  ].includes(effectId);
}
