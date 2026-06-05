import type { CardInstance, GameState, PlayerId, PlayerState, TurnModifiers } from "../types/game";

export function emptyTurnModifiers(): TurnModifiers {
  return {
    comboNumberDelta: 0,
    battleBlockedInstanceIds: [],
    shironLightUsed: false,
    rushedThisTurnInstanceIds: [],
  };
}

export function getTurnModifiers(player: PlayerState): TurnModifiers {
  return player.turnModifiers ?? emptyTurnModifiers();
}

export function withTurnModifiers(
  player: PlayerState,
  patch: Partial<TurnModifiers>,
): PlayerState {
  return {
    ...player,
    turnModifiers: { ...getTurnModifiers(player), ...patch },
  };
}

export function isBattleBlocked(player: PlayerState, instanceId: string): boolean {
  return getTurnModifiers(player).battleBlockedInstanceIds.includes(instanceId);
}

export function markBattleBlocked(player: PlayerState, instanceId: string): PlayerState {
  const mods = getTurnModifiers(player);
  if (mods.battleBlockedInstanceIds.includes(instanceId)) return player;
  return withTurnModifiers(player, {
    battleBlockedInstanceIds: [...mods.battleBlockedInstanceIds, instanceId],
  });
}

export function resetRushPhaseFlags(player: PlayerState): PlayerState {
  return {
    ...withTurnModifiers(player, { shironLightUsed: false, hidoraEggUsed: false }),
    shironLightRushInstanceId: undefined,
    operation: player.operation.map((card) => {
      if (!card.shironLightUsedThisRush) return card;
      const { shironLightUsedThisRush: _used, ...rest } = card;
      return rest;
    }),
  };
}

export function markRushedThisTurn(player: PlayerState, instanceId: string): PlayerState {
  const mods = getTurnModifiers(player);
  const ids = mods.rushedThisTurnInstanceIds ?? [];
  if (ids.includes(instanceId)) return player;
  return withTurnModifiers(player, {
    rushedThisTurnInstanceIds: [...ids, instanceId],
  });
}

export function wasRushedThisTurn(player: PlayerState, instanceId: string): boolean {
  return (getTurnModifiers(player).rushedThisTurnInstanceIds ?? []).includes(instanceId);
}

export function isInfiniteChainActive(state: GameState, playerId: PlayerId): boolean {
  return !!getTurnModifiers(state.players[playerId]).infiniteChainActive;
}

export function opponentInfiniteChainBlocks(
  state: GameState,
  targetPlayerId: PlayerId,
): boolean {
  const opponentId = targetPlayerId === "player1" ? "player2" : "player1";
  return isInfiniteChainActive(state, opponentId);
}

export function countAdventureReturns(state: GameState): number {
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    if (state.players[pid].operation.some((c) => c.cardId === "RS-030")) {
      count += 1;
    }
  }
  return count;
}

export function applyAdventureEndTurn(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const returns = countAdventureReturns(state);
  if (returns === 0) return state;

  let player = state.players[endingPlayerId];
  for (let i = 0; i < returns; i += 1) {
    const heldIndex = player.command.findIndex((c) => c.commandHeld);
    if (heldIndex < 0) break;

    const command = [...player.command];
    const [card] = command.splice(heldIndex, 1);
    player = {
      ...player,
      command,
      hand: [...player.hand, { ...card!, commandHeld: false }],
    };
  }

  return {
    ...state,
    players: { ...state.players, [endingPlayerId]: player },
  };
}

export function isSOnlyComboLine(
  definitions: GameState["definitions"],
  battle: CardInstance[],
): boolean {
  if (battle.length === 0) return false;
  return battle.every((card) => {
    const def = definitions[card.cardId];
    return def?.size === "S";
  });
}
