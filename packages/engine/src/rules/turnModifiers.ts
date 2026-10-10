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
      let next = card;
      if (card.shironLightUsedThisRush) {
        const { shironLightUsedThisRush: _used, ...rest } = next;
        next = rest;
      }
      if (card.residentActivatedThisRush) {
        const { residentActivatedThisRush: _activated, ...rest } = next;
        next = rest;
      }
      return next;
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

/**
 * ルール: R-ERR-RS030 — 「自分も相手も次の制限を受ける」。両軍の常駐アドベンチャーの枚数だけ、
 * ターンを終えたプレイヤーが自分自身のホールド状態のコマンドを手札に戻す（重複する: card_1 RS-030 Q1）。
 */
export function countAdventureReturns(state: GameState): number {
  let count = 0;
  for (const pid of ["player1", "player2"] as const) {
    count += state.players[pid].operation.filter((c) => c.cardId === "RS-030").length;
  }
  return count;
}

/** ターン終了時のアドベンチャー。選び方に差がなければ自動で戻し、差があれば選択を開く。 */
export function applyAdventureEndTurn(
  state: GameState,
  endingPlayerId: PlayerId,
): GameState {
  const returns = countAdventureReturns(state);
  if (returns === 0) return state;

  const player = state.players[endingPlayerId];
  const heldCommands = player.command.filter((c) => c.commandHeld);
  if (heldCommands.length === 0) return state;
  const count = Math.min(returns, heldCommands.length);
  const noRealChoice =
    count === heldCommands.length ||
    heldCommands.every((c) => c.cardId === heldCommands[0]!.cardId);

  if (!noRealChoice) {
    const source = [...state.players.player1.operation, ...state.players.player2.operation].find(
      (c) => c.cardId === "RS-030",
    );
    return {
      ...state,
      pendingEffectChoice: {
        playerId: endingPlayerId,
        effectId: "adventure",
        sourceCardId: "RS-030",
        sourceInstanceId: source?.instanceId,
        kind: "select_commands",
        phasePlayerId: endingPlayerId,
        validInstanceIds: heldCommands.map((c) => c.instanceId),
        selectCount: count,
        selectedInstanceIds: [],
        commandFilter: "held",
        commandAction: "return_hand",
      },
      activePlayer: endingPlayerId,
    };
  }

  const returnIds = new Set(heldCommands.slice(0, count).map((c) => c.instanceId));
  const returned: CardInstance[] = player.command
    .filter((c) => returnIds.has(c.instanceId))
    .map((c) => ({ ...c, commandHeld: false }));
  return {
    ...state,
    players: {
      ...state.players,
      [endingPlayerId]: {
        ...player,
        command: player.command.filter((c) => !returnIds.has(c.instanceId)),
        hand: [...player.hand, ...returned],
      },
    },
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
