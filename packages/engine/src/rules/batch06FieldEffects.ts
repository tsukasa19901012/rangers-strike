import type { GameState, PendingBattleEntry, PlayerId } from "../types/game";
import {
  cardCategories,
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
} from "../core/catalog";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { getCardDslDocument } from "../dsl/effectLookup";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import {
  canAttackDefender,
} from "./legend3/restrictions";
import { canAttackRushWithYellowThunder } from "./namedUnitEffects";
import {
  startBenGHandChoice,
  startBoukenSilverEnterChoice,
  startHikarimaruWingChoice,
  startRedLadderDiscardChoice,
  startSuperGekiFantasticChoice,
  startZorobAntGeneChoice,
  startZubazubanDestroyChoice,
} from "./pendingChoices";

export function collectOwnWingCommands(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && cardHasKeyword(state.definitions, c.cardId, "wing");
    })
    .map((c) => c.instanceId);
}

export function collectEnemyBattleAtMostBp(
  state: GameState,
  enemyId: PlayerId,
  maxBp: number,
): string[] {
  const enemy = state.players[enemyId];
  const ids: string[] = [];
  for (const card of enemy.battle) {
    if (effectiveBp(state, enemyId, card) <= maxBp) ids.push(card.instanceId);
  }
  return ids;
}

export function collectDiscardSmallUnits(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].discard
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .map((c) => c.instanceId);
}

export function collectHandMediumWithAdditional(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.hand
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "M") return false;
      const doc = getCardDslDocument(c.cardId);
      return !!doc?.rushAdditionalCondition;
    })
    .map((c) => c.instanceId);
}

export function collectRushWbMWithOnRush(state: GameState, playerId: PlayerId): string[] {
  const player = state.players[playerId];
  return player.rush
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (def?.type !== "unit" || def.size !== "M") return false;
      if (!cardCategories(def).includes("WB")) return false;
      const doc = getCardDslDocument(c.cardId);
      return doc?.effects?.some((e) => e.trigger?.type === "on_rush") ?? false;
    })
    .map((c) => c.instanceId);
}

export function playerHasRs420OnRush(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === "RS-420");
}

export function playerHasRs374OnRush(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].rush.some((c) => c.cardId === "RS-374");
}

export function playerHasRs304OnBattle(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].battle.some((c) => c.cardId === "RS-304");
}

function cardHasDslKeyword(cardId: string, keyword: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some((e) =>
      e.effects.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
    ) ?? false
  );
}

export function countOwnFieldSmallUnits(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  return [...player.rush, ...player.battle].filter((c) =>
    isSmallUnit(state.definitions, c.cardId),
  ).length;
}

export function applyHikarimaruOperation(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const withChoice = startHikarimaruWingChoice(state, {
    playerId,
    effectId: "kami_ken_hikarimaru",
    sourceCardId: "RS-606",
    sourceInstanceId: operationInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyRedLadderOnRush(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const withChoice = startRedLadderDiscardChoice(state, {
    playerId,
    effectId: "fx_unknown_e69591",
    sourceCardId: "RS-383",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyBoukenSilverEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startBoukenSilverEnterChoice(state, {
    playerId,
    effectId: "sagasupia",
    sourceCardId: "RS-585",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyBenGEnterBattle(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (state.activePlayer !== playerId) return state;
  const withChoice = startBenGHandChoice(state, {
    playerId,
    effectId: "fx_unknown_2",
    sourceCardId: "RS-322",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applySuperGekiFantasticOnRush(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const withChoice = startSuperGekiFantasticChoice(state, {
    playerId,
    effectId: "fuantasuteikutekuniku",
    sourceCardId: "RS-428",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyZorobAntGeneOnRush(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (countOwnFieldSmallUnits(state, playerId) > 5) return state;
  const withChoice = startZorobAntGeneChoice(state, {
    playerId,
    effectId: "arino",
    sourceCardId: "RS-367",
    sourceInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function releaseWingCommand(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): { state: GameState; releasedBp: number } | null {
  const player = state.players[playerId];
  const found = findInZone(player, "command", instanceId);
  if (!found) return null;
  const command = [...player.command];
  command[found.index] = {
    ...found.card,
    commandHeld: false,
    mothershipHold: false,
  };
  const releasedBp = effectiveBp(state, playerId, found.card);
  return {
    state: {
      ...state,
      ...updatePlayer(state, playerId, { ...player, command }),
    },
    releasedBp,
  };
}

function unitHasSp(def: ReturnType<typeof getDefinition>): boolean {
  if (!def || def.type !== "unit") return false;
  return def.sp !== undefined && def.sp !== null && def.sp !== "";
}

export function scryTop3ForSagasSpear(
  state: GameState,
  deckOwnerId: PlayerId,
): { hasSpUnit: boolean; top3: string[] } {
  const player = state.players[deckOwnerId];
  const top3 = player.deck.slice(0, 3);
  const hasSpUnit = top3.some((c) => unitHasSp(getDefinition(state.definitions, c.cardId)));
  return { hasSpUnit, top3: top3.map((c) => c.instanceId) };
}

export function applySagasSpearScryReturn(
  state: GameState,
  deckOwnerId: PlayerId,
  viewedIds: string[],
  orderedIds: string[],
): GameState {
  const player = state.players[deckOwnerId];
  const viewed = viewedIds
    .map((id) => player.deck.find((c) => c.instanceId === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const rest = player.deck.filter((c) => !viewedIds.includes(c.instanceId));
  const ordered = orderedIds
    .map((id) => viewed.find((c) => c.instanceId === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const tail = viewed.filter((c) => !orderedIds.includes(c.instanceId));
  return {
    ...state,
    ...updatePlayer(state, deckOwnerId, {
      ...player,
      deck: [...ordered, ...tail, ...rest],
    }),
  };
}

export function applyZorobTopDeckReveal(
  state: GameState,
  playerId: PlayerId,
  topInstanceId: string,
): GameState {
  const player = state.players[playerId];
  const top = player.deck[0];
  if (!top || top.instanceId !== topInstanceId) return state;
  const [, deck] = removeAt(player.deck, 0);
  const name = cardName(state.definitions, top.cardId);
  if (name === "ゾロー兵") {
    return {
      ...state,
      ...updatePlayer(state, playerId, {
        ...player,
        deck,
        rush: [...player.rush, top],
      }),
    };
  }
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      deck,
      discard: [...player.discard, top],
    }),
  };
}

export function tryZubazubanOnAllyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  if (!playerHasRs420OnRush(state, rusherPlayerId)) return state;
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return state;
  const def = getDefinition(state.definitions, found.card.cardId);
  if (def?.size !== "L" || !(def.features ?? []).includes("メカ")) return state;
  const withChoice = startZubazubanDestroyChoice(state, {
    playerId: rusherPlayerId,
    effectId: "zubazubankiku",
    sourceCardId: "RS-420",
    sourceInstanceId: rushedInstanceId,
    phasePlayerId,
  });
  return withChoice ?? state;
}

export function applyBandoraHeldCommandDiscard(
  state: GameState,
  rusherPlayerId: PlayerId,
  cardId: string,
): GameState {
  const def = getDefinition(state.definitions, cardId);
  const features = def?.features ?? [];
  if (!features.includes("魔法") && !features.includes("恐竜")) return state;
  const ownerId = opponent(rusherPlayerId);
  if (!playerHasRs374OnRush(state, ownerId)) return state;
  const player = state.players[rusherPlayerId];
  const held = player.command.filter((c) => c.commandHeld || c.mothershipHold);
  if (held.length === 0) return state;
  const heldIds = new Set(held.map((c) => c.instanceId));
  const command = player.command.filter((c) => !heldIds.has(c.instanceId));
  return {
    ...state,
    ...updatePlayer(state, rusherPlayerId, {
      ...player,
      command,
      discard: [...player.discard, ...held],
    }),
  };
}

export function cityGuardRushPowerSurcharge(
  state: GameState,
  rusherPlayerId: PlayerId,
  cardId: string,
): number {
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.type !== "unit" || def.size !== "S") return 0;
  if (!cardCategories(def).includes("DA")) return 0;
  const ownerId = opponent(rusherPlayerId);
  if (!playerHasRs304OnBattle(state, ownerId)) return 0;
  return 1;
}

export function triggerCopiedOnRushFromRush(
  state: GameState,
  playerId: PlayerId,
  copiedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  const found = findInZone(player, "rush", copiedInstanceId);
  if (!found) return state;
  const result = tryResolveDslTriggeredEffects({
    state,
    cardId: found.card.cardId,
    instanceId: copiedInstanceId,
    playerId,
    phasePlayerId,
    triggerType: "on_rush",
    logAction: "named_effect",
  });
  return result.state;
}

export function findShinobiBallOnBattle(state: GameState, playerId: PlayerId): string | null {
  const player = state.players[playerId];
  const card = player.battle.find(
    (c) =>
      c.cardId === "RS-451" ||
      cardHasDslKeyword(c.cardId, "while_in_battle_enemy_s_must_attack_self"),
  );
  return card?.instanceId ?? null;
}

/** RS-451: 敵ターン中、敵Sのバトル進入後は可能ならシノビドグラーへアタック。 */
export function applyShinobiBallRequiredDefender(
  state: GameState,
  enteringPlayerId: PlayerId,
  entry: PendingBattleEntry,
): PendingBattleEntry {
  if (state.activePlayer !== enteringPlayerId) return entry;
  const shinobiOwnerId = opponent(enteringPlayerId);
  const shinobiId = findShinobiBallOnBattle(state, shinobiOwnerId);
  if (!shinobiId) return entry;
  const unit = state.players[enteringPlayerId].battle.find(
    (c) => c.instanceId === entry.instanceId,
  );
  if (!unit) return entry;
  const def = getDefinition(state.definitions, unit.cardId);
  if (def?.size !== "S") return entry;
  if (
    !canAttackDefender(
      state,
      enteringPlayerId,
      entry.instanceId,
      shinobiOwnerId,
      shinobiId,
      canAttackRushWithYellowThunder,
    )
  ) {
    return entry;
  }
  return { ...entry, requiredDefenderInstanceId: shinobiId };
}
