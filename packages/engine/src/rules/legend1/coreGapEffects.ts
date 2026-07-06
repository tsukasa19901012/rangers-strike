import type { CardInstance, GameState, PlayerId, ScopedModifier } from "../../types/game";
import {
  cardName,
  getDefinition,
  isSmallUnit,
} from "../../core/catalog";
import { opponent, removeAt, updatePlayer } from "../../core/helpers";
import { addTurnRuleModifier } from "../../core/scopedModifiers";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import {
  grantSp1ToBattleUnit,
  markBattleNcEffect,
} from "../namedUnitEffects";
import {
  collectCommandIds,
  openEffectChoice,
  startSelectCommandChoice,
  startSelectUnitChoice,
} from "../pendingChoices";
import { buildLogEntry } from "../../log/formatLog";
import type { ComboOutcome } from "../comboTypes";
import { sameCardName } from "../../core/cardNames";

export const FLOWER_BOMB_RULE = "flower_bomb_power_cost";

export type FlowerBombPayload = { declaredCost: number };

function isFlowerBombModifier(
  m: ScopedModifier,
): m is Extract<ScopedModifier, { kind: "rule" }> {
  return m.kind === "rule" && m.ruleId === FLOWER_BOMB_RULE && m.scope === "turn";
}

export function getFlowerBombDeclaredCost(
  state: Pick<GameState, "players">,
  effectOwnerId: PlayerId,
): number | null {
  const player = state.players[effectOwnerId];
  const mod = player.modifiers?.find(isFlowerBombModifier);
  const payload = mod?.payload as FlowerBombPayload | undefined;
  return typeof payload?.declaredCost === "number" ? payload.declaredCost : null;
}

export function flowerBombPowerCostOverride(
  state: Pick<GameState, "players" | "definitions">,
  rusherPlayerId: PlayerId,
  cardId: string,
): number | null {
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.size !== "S") return null;
  const ownerId = opponent(rusherPlayerId);
  return getFlowerBombDeclaredCost(state, ownerId);
}

function ncLog(
  playerId: PlayerId,
  cardId: string,
  definitions: GameState["definitions"],
  detail: string,
): string {
  return buildLogEntry(playerId, "number_combo", cardId, definitions, detail);
}

function unitsWithoutRushAdditionalCondition(state: GameState): string[] {
  const ids: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const zone of ["rush", "battle"] as const) {
      for (const card of player[zone]) {
        const def = getDefinition(state.definitions, card.cardId);
        if (!resolveRushAdditionalCondition(card.cardId, def)) {
          ids.push(card.instanceId);
        }
      }
    }
  }
  return ids;
}

export function startMagiBlueSelfDrawChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
  step: 1 | 2,
  drewAny: boolean,
): GameState | null {
  if (state.players[playerId].deck.length === 0) {
    return drewAny
      ? startMagiBlueOpponentDrawChoice(state, opponent(playerId), sourceCardId, phasePlayerId)
      : null;
  }
  return openEffectChoice(state, {
    playerId,
    effectId: step === 1 ? "magi_blue_self_draw_1" : "magi_blue_self_draw_2",
    sourceCardId,
    kind: "optional_deck_draw",
    phasePlayerId,
    validInstanceIds: ["draw"],
    optional: true,
    magiBlueMeta: { drewAny },
  });
}

export function startMagiBlueOpponentDrawChoice(
  state: GameState,
  enemyId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
): GameState | null {
  if (state.players[enemyId].deck.length === 0) return null;
  return openEffectChoice(state, {
    playerId: enemyId,
    effectId: "magi_blue_opponent_draw",
    sourceCardId,
    kind: "optional_deck_draw",
    phasePlayerId,
    validInstanceIds: ["draw"],
    optional: true,
  });
}

export function continueMagiBlueAfterSelfDraw(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
  step: 1 | 2,
  drew: boolean,
): GameState {
  if (step === 1 && drew) {
    const second = startMagiBlueSelfDrawChoice(
      state,
      playerId,
      sourceCardId,
      phasePlayerId,
      2,
      true,
    );
    if (second) return second;
  }
  const drewAny = drew || step === 2;
  if (drewAny) {
    const opponentDraw = startMagiBlueOpponentDrawChoice(
      state,
      opponent(playerId),
      sourceCardId,
      phasePlayerId,
    );
    if (opponentDraw) return opponentDraw;
  }
  return state;
}

export function applyCoreGapNcEffect(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  effectId: string,
): ComboOutcome {
  const enemyId = opponent(playerId);
  let nextState = state;
  const logs: string[] = [];

  switch (effectId) {
    case "magi_red_bolt": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "magi_blue_bolt": {
      const withChoice = startMagiBlueSelfDrawChoice(
        nextState,
        playerId,
        card.cardId,
        playerId,
        1,
        false,
      );
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "magi_pink_bolt": {
      const targets = unitsWithoutRushAdditionalCondition(nextState);
      if (targets.length > 0) {
        const withChoice = startSelectUnitChoice(nextState, {
          playerId,
          effectId,
          sourceCardId: card.cardId,
          sourceInstanceId: card.instanceId,
          phasePlayerId: playerId,
          validInstanceIds: targets,
          unitDestination: "deck_top",
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "magi_green_bolt": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const commands = collectCommandIds(nextState, enemyId, "any");
      if (commands.length > 0) {
        const withChoice = startSelectCommandChoice(nextState, {
          playerId: enemyId,
          effectId,
          sourceCardId: card.cardId,
          phasePlayerId: playerId,
          commandFilter: "any",
          commandAction: "return_hand",
          validInstanceIds: commands,
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "new_red_beet": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const targets = nextState.players[enemyId].command
        .filter((c) => isSmallUnit(state.definitions, c.cardId))
        .map((c) => c.instanceId);
      if (targets.length > 0) {
        const withChoice = startSelectCommandChoice(nextState, {
          playerId: enemyId,
          effectId,
          sourceCardId: card.cardId,
          phasePlayerId: playerId,
          commandFilter: "any",
          commandAction: "battle_silent",
          validInstanceIds: targets,
          optional: true,
        });
        if (withChoice) nextState = withChoice;
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "scorching_lion": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      const ownCommands = nextState.players[playerId].command.length;
      const enemyCommands = nextState.players[enemyId].command.length;
      if (enemyCommands > ownCommands) {
        const targets = collectCommandIds(nextState, enemyId, "any");
        if (targets.length > 0) {
          const withChoice = startSelectCommandChoice(nextState, {
            playerId: enemyId,
            effectId,
            sourceCardId: card.cardId,
            phasePlayerId: playerId,
            commandFilter: "any",
            commandAction: "discard",
            validInstanceIds: targets,
            optional: false,
          });
          if (withChoice) nextState = withChoice;
        }
      }
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "flower_bomb": {
      const withChoice = openEffectChoice(nextState, {
        playerId,
        effectId,
        sourceCardId: card.cardId,
        kind: "declare_number",
        phasePlayerId: playerId,
        validInstanceIds: Array.from({ length: 13 }, (_, n) => String(n)),
        optional: true,
      });
      if (withChoice) nextState = withChoice;
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    case "disco_dance": {
      nextState = grantSp1ToBattleUnit(nextState, playerId, card.instanceId);
      nextState = markBattleNcEffect(nextState, playerId, card.instanceId, effectId);
      logs.push(ncLog(playerId, card.cardId, state.definitions, effectId));
      break;
    }
    default:
      break;
  }

  return { state: nextState, logs };
}

export function applyFlowerBombDeclaredNumber(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  declared: number,
): GameState {
  const player = addTurnRuleModifier(state.players[playerId], FLOWER_BOMB_RULE, {
    sourceCardId,
    payload: { declaredCost: declared } satisfies FlowerBombPayload,
  });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

export function moveCommandUnitToBattleSilent(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[ownerId];
  const found = player.command.find((c) => c.instanceId === instanceId);
  if (!found) return null;
  const index = player.command.findIndex((c) => c.instanceId === instanceId);
  const [, command] = removeAt(player.command, index);
  return {
    ...state,
    ...updatePlayer(state, ownerId, {
      ...player,
      command,
      battle: [...player.battle, { ...found, battleActed: true }],
    }),
  };
}

export function magiRedBoltAttackBpBonus(
  state: GameState,
  attackerPlayerId: PlayerId,
  card: CardInstance,
): number {
  if (!card.activatedNcEffects?.includes("magi_red_bolt")) return 0;
  const released = state.players[attackerPlayerId].command.filter((c) => !c.commandHeld).length;
  return released * 1000;
}

export function reanimateNamedFromDiscardOnDestroy(
  state: GameState,
  ctx: {
    ownerPlayerId: PlayerId;
    cardId: string;
    phasePlayerId: PlayerId;
  },
  partnerName: string,
  effectId: string,
): { state: GameState; log: string | null } {
  const player = state.players[ctx.ownerPlayerId];
  const inDiscard = player.discard.filter(
    (c) => sameCardName(cardName(state.definitions, c.cardId), partnerName),
  );
  if (inDiscard.length === 0) return { state, log: null };

  if (inDiscard.length === 1) {
    const target = inDiscard[0]!;
    const idx = player.discard.findIndex((c) => c.instanceId === target.instanceId);
    const [, discard] = removeAt(player.discard, idx);
    const nextState = {
      ...state,
      ...updatePlayer(state, ctx.ownerPlayerId, {
        ...player,
        discard,
        rush: [...player.rush, target],
      }),
    };
    return {
      state: nextState,
      log: buildLogEntry(
        ctx.ownerPlayerId,
        "destroy_effect",
        ctx.cardId,
        nextState.definitions,
        effectId,
      ),
    };
  }

  const withChoice = startSelectUnitChoice(state, {
    playerId: ctx.ownerPlayerId,
    effectId,
    sourceCardId: ctx.cardId,
    phasePlayerId: ctx.phasePlayerId,
    validInstanceIds: inDiscard.map((c) => c.instanceId),
    unitDestination: "rush_from_discard",
    optional: false,
  });
  if (withChoice) {
    return {
      state: withChoice,
      log: buildLogEntry(
        ctx.ownerPlayerId,
        "destroy_effect",
        ctx.cardId,
        withChoice.definitions,
        `${effectId}_choice`,
      ),
    };
  }
  return { state, log: null };
}
