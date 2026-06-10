import {
  addTurnRestrictionModifier,
  clearRushPhaseScopedModifiers,
  hasRushPhaseRuleModifier,
  hasScopedRestriction,
  hasTurnRuleModifier,
} from "../core/scopedModifiers";
import { RESTRICTION_IDS, RUSH_PHASE_RULE_IDS, TURN_RULE_IDS } from "../types/scopedModifiers";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";

export function isBattleBlocked(player: PlayerState, instanceId: string): boolean {
  return hasScopedRestriction(player, instanceId, RESTRICTION_IDS.CANNOT_ENTER_BATTLE, "turn");
}

export function markBattleBlocked(player: PlayerState, instanceId: string): PlayerState {
  if (isBattleBlocked(player, instanceId)) return player;
  return addTurnRestrictionModifier(
    player,
    instanceId,
    RESTRICTION_IDS.CANNOT_ENTER_BATTLE,
  );
}

export function resetRushPhaseFlags(player: PlayerState): PlayerState {
  return clearRushPhaseScopedModifiers({
    ...player,
    shironLightRushInstanceId: undefined,
    operation: player.operation.map((card) => {
      if (!card.shironLightUsedThisRush) return card;
      const { shironLightUsedThisRush: _used, ...rest } = card;
      return rest;
    }),
  });
}

export function markRushedThisTurn(player: PlayerState, instanceId: string): PlayerState {
  if (wasRushedThisTurn(player, instanceId)) return player;
  return addTurnRestrictionModifier(
    player,
    instanceId,
    RESTRICTION_IDS.RUSHED_THIS_TURN,
  );
}

export function wasRushedThisTurn(player: PlayerState, instanceId: string): boolean {
  return hasScopedRestriction(player, instanceId, RESTRICTION_IDS.RUSHED_THIS_TURN, "turn");
}

export function isHidoraEggUsed(player: PlayerState): boolean {
  return hasRushPhaseRuleModifier(player, RUSH_PHASE_RULE_IDS.HIDORA_EGG);
}

export function isInfiniteChainActive(state: GameState, playerId: PlayerId): boolean {
  return hasTurnRuleModifier(state.players[playerId], TURN_RULE_IDS.INFINITE_CHAIN);
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
