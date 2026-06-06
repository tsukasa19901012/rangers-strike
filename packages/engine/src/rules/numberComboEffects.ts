import type { CardDefinition } from "@rangers-strike/cards";
import { findNcNamedEffect, getNumberComboEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  cardName,
  effectiveComboNumber,
  getDefinition,
} from "../core/catalog";
import { requestDrawFromDeck } from "./drawFromDeck";
import { buildLogEntry } from "../log/formatLog";
import { startRuinSurvey } from "./ruinSurvey";
import {
  blowKnuckleReturnReleasedCommands,
  grantBpBoostToBattleUnit,
  grantSp1ToBattleUnit,
  tryStartGreenGroundChoice,
  tryStartMossBreakerChoice,
  tryStartPinkStormChoice,
  tryStartPitInDiveChoice,
  tryStartRadialHammerChoice,
} from "./namedUnitEffects";
import {
  findBattleUnit,
  grantBpBoostOnPlayer,
  grantSp1OnPlayer,
  patchPlayer,
} from "./playerPatches";
import { applyLegend2NcEffect, isLegend2NcEffect } from "./legend2/ncEffects";
import { applyLegend3NcEffect, isLegend3NcEffect } from "./legend3/ncEffects";
import type { ComboOutcome } from "./comboTypes";

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

export function numberComboTriggers(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): boolean {
  const effectiveNumber =
    typeof definition.comboNumber === "number"
      ? effectiveComboNumber(state, playerId, definition.comboNumber)
      : -1;

  return !!findNcNamedEffect(
    card.cardId,
    battlePosition,
    effectiveNumber,
    battleBeforeEnter,
    card.instanceId,
  );
}

export function resolveNamedNcEffectId(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): ReturnType<typeof getNumberComboEffect> {
  const effectiveNumber =
    typeof definition.comboNumber === "number"
      ? effectiveComboNumber(state, playerId, definition.comboNumber)
      : -1;
  const named = findNcNamedEffect(
    card.cardId,
    battlePosition,
    effectiveNumber,
    battleBeforeEnter,
    card.instanceId,
  );
  if (named && getNumberComboEffect(card.cardId) === named.effectId) {
    return named.effectId as ReturnType<typeof getNumberComboEffect>;
  }
  return getNumberComboEffect(card.cardId);
}

export function applyNumberComboEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: ReturnType<typeof getNumberComboEffect>,
): ComboOutcome {
  if (!effectId) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "grant_sp1": {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantSp1OnPlayer(player, card.instanceId),
      );
      logs.push(ncLog(playerId, card.cardId, state.definitions, "sp1"));
      break;
    }
    case "eagle_diving": {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantBpBoostOnPlayer(
          grantSp1OnPlayer(player, card.instanceId),
          card.instanceId,
          2000,
        ),
      );
      logs.push(ncLog(playerId, card.cardId, state.definitions, "eagle_diving"));
      break;
    }
    case "moss_breaker": {
      const withChoice = tryStartMossBreakerChoice(
        nextState,
        playerId,
        card.cardId,
        playerId,
      );
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "moss_breaker"));
      break;
    }
    case "ruin_survey": {
      const withPending = startRuinSurvey(nextState, playerId, card.cardId);
      if (withPending) {
        nextState = withPending;
        const top = nextState.players[playerId].deck[0]!;
        logs.push(
          ncLog(
            playerId,
            card.cardId,
            state.definitions,
            `ruin_survey:${cardName(state.definitions, top.cardId)}`,
          ),
        );
      }
      break;
    }
    case "pit_in_dive": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartPitInDiveChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "pit_in_dive"));
      break;
    }
    case "red_fire":
    case "yellow_thunder":
    case "bouken_javelin": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "future_sight": {
      const beforeDeck = nextState.players[playerId].deck;
      const drawResult = requestDrawFromDeck(nextState, playerId, playerId, {
        count: 1,
        sourceCardId: card.cardId,
      });
      nextState = drawResult.state;
      const afterHand = nextState.players[playerId].hand;
      const drawnCard = afterHand[afterHand.length - 1];
      const drawnName =
        !drawResult.pending &&
        drawnCard &&
        beforeDeck.some((c) => c.instanceId === drawnCard.instanceId)
          ? cardName(state.definitions, drawnCard.cardId)
          : undefined;
      logs.push(
        ncLog(
          playerId,
          card.cardId,
          state.definitions,
          drawnName ? `future_sight:${drawnName}` : "future_sight",
        ),
      );
      break;
    }
    case "pink_storm": {
      const withChoice = tryStartPinkStormChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "pink_storm"));
      break;
    }
    case "green_ground": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartGreenGroundChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "green_ground"));
      break;
    }
    case "radial_hammer": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const withChoice = tryStartRadialHammerChoice(nextState, playerId, card.instanceId);
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "radial_hammer"));
      break;
    }
    case "blow_knuckle": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const blow = blowKnuckleReturnReleasedCommands(nextState);
      nextState = blow.state;
      logs.push(ncLog(playerId, card.cardId, state.definitions, "blow_knuckle"), ...blow.logs);
      break;
    }
    case "magical_dragon_shoot": {
      nextState = grantBpBoostToBattleUnit(nextState, playerId, card.instanceId, 4000);
      logs.push(
        ncLog(playerId, card.cardId, state.definitions, "magical_dragon_shoot"),
      );
      break;
    }
    default: {
      if (effectId && isLegend3NcEffect(effectId)) {
        const legend3 = applyLegend3NcEffect(nextState, playerId, card, effectId);
        nextState = legend3.state;
        logs.push(...legend3.logs);
      } else if (effectId && isLegend2NcEffect(effectId)) {
        const legend2 = applyLegend2NcEffect(nextState, playerId, card, effectId);
        nextState = legend2.state;
        logs.push(...legend2.logs);
      }
      break;
    }
  }

  return { state: nextState, logs };
}

/** NC後の戦闘ユニットを読み取り（テストアサーション用）。 */
export function battleUnitAfterNc(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  return findBattleUnit(state.players[playerId], instanceId);
}
