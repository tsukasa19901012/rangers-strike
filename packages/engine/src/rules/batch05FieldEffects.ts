import type { Category } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardCategories, cardName, getDefinition, isSmallUnit, parsePowerCost } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { getCardDslDocument } from "../dsl/effectLookup";
import { markBattleNcEffect } from "./namedUnitEffects";
import {
  openEffectChoice,
  startBeastRodChoice,
  startClimberBallChoice,
  startFireGeneralChoice,
  startAkaRedSoulChoice,
} from "./pendingChoices";

export function applyBeastRodOperation(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const withChoice = startBeastRodChoice(state, {
    playerId,
    effectId: "geki_e78da3",
    sourceCardId: "RS-518",
    sourceInstanceId: operationInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyAkaRedSoulEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startAkaRedSoulChoice(state, {
    playerId,
    effectId: "souru",
    sourceCardId: "RS-421",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyClimberBallEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startClimberBallChoice(state, {
    playerId,
    effectId: "boru",
    sourceCardId: "RS-616",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyFireGeneralEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startFireGeneralChoice(state, {
    playerId,
    effectId: "hi",
    sourceCardId: "RS-662",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

/** RS-518: 敵コマンドSをホールドなら撃破、リリースならホールド。 */
export function applyBeastRodToEnemyCommand(
  state: GameState,
  enemyId: PlayerId,
  instanceId: string,
): GameState | null {
  const enemy = state.players[enemyId];
  const found = findInZone(enemy, "command", instanceId);
  if (!found || !isSmallUnit(state.definitions, found.card.cardId)) return null;

  if (found.card.commandHeld || found.card.mothershipHold) {
    const [, command] = removeAt(enemy.command, found.index);
    return {
      ...state,
      ...updatePlayer(state, enemyId, {
        ...enemy,
        command,
        discard: [...enemy.discard, found.card],
      }),
    };
  }

  const command = [...enemy.command];
  command[found.index] = { ...found.card, commandHeld: true, mothershipHold: false };
  return {
    ...state,
    ...updatePlayer(state, enemyId, { ...enemy, command }),
  };
}

/** RS-421 ソウル降臨: ホールド後にストライク不可。 */
export function applyAkaRedSoulHold(
  state: GameState,
  playerId: PlayerId,
  commandInstanceId: string,
  battleInstanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "command", commandInstanceId);
  if (!found) return null;
  const command = [...player.command];
  command[found.index] = { ...found.card, commandHeld: true, mothershipHold: false };
  let next = {
    ...state,
    ...updatePlayer(state, playerId, { ...player, command }),
  };
  next = markBattleNcEffect(next, playerId, battleInstanceId, "souru_no_strike");
  return next;
}

export function commandUnitHasNcEffect(cardId: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some(
      (effect) =>
        effect.trigger?.type === "nc" &&
        effect.effects.some((p) => p.type !== "grant_keyword" || !String(p.keyword).startsWith("note_")),
    ) ?? false
  );
}

export function collectEnemyCommandsMatchingPower(
  state: GameState,
  enemyId: PlayerId,
  powerValue: number,
): string[] {
  const enemy = state.players[enemyId];
  const ids: string[] = [];
  for (const card of enemy.command) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def) continue;
    if (parsePowerCost(def.powerCost) === powerValue) {
      ids.push(card.instanceId);
    }
  }
  return ids;
}

export function collectNamedUnitsInDiscard(
  state: GameState,
  playerId: PlayerId,
  partnerName: string,
): string[] {
  const player = state.players[playerId];
  return player.discard
    .filter((c) => cardName(state.definitions, c.cardId) === partnerName)
    .map((c) => c.instanceId);
}

export function collectOwnRedNcCommands(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  const ids: string[] = [];
  for (const card of player.command) {
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type !== "unit") continue;
    if (!(def.features ?? []).includes("レッド")) continue;
    if (!commandUnitHasNcEffect(card.cardId)) continue;
    ids.push(card.instanceId);
  }
  return ids;
}

export function collectOwnRushByName(
  state: GameState,
  playerId: PlayerId,
  unitName: string,
  count: number,
): string[] {
  const player = state.players[playerId];
  const valid = player.rush
    .filter((c) => cardName(state.definitions, c.cardId) === unitName)
    .map((c) => c.instanceId);
  return valid.length >= count ? valid : [];
}

export function collectEnemyCommandSmallUnits(state: GameState, enemyId: PlayerId): string[] {
  const enemy = state.players[enemyId];
  return enemy.command
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

export function collectEnemyBattleCategoryM(
  state: GameState,
  enemyId: PlayerId,
  category: Category,
): string[] {
  const player = state.players[enemyId];
  const ids: string[] = [];
  for (const card of player.battle) {
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type === "unit" && def.size === "M" && cardCategories(def).includes(category)) {
      ids.push(card.instanceId);
    }
  }
  return ids;
}
