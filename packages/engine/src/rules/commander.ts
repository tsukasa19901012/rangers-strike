import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { removeAt, updatePlayer } from "../core/helpers";
import { checkCommanderDefeat } from "../keywords";

/** コマンダーゾーンへ配置。 */
export function moveToCommanderZone(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
): GameState {
  const player = state.players[playerId];
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.type !== "commander") {
    return state;
  }
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      commander: [...(player.commander ?? []), card],
    }),
  };
}

export function listCommanderCards(player: PlayerState): CardInstance[] {
  return player.commander ?? [];
}

export function findInCommanderZone(
  player: PlayerState,
  instanceId: string,
): { index: number; card: CardInstance } | null {
  const commander = player.commander ?? [];
  const index = commander.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return null;
  return { index, card: commander[index]! };
}

/** コマンダーを捨札に送り、敗北判定を行う。 */
export function leaveCommanderZone(
  state: GameState,
  ownerPlayerId: PlayerId,
  instanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const player = state.players[ownerPlayerId];
  const found = findInCommanderZone(player, instanceId);
  if (!found) return state;

  const [, remaining] = removeAt(player.commander ?? [], found.index);
  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, ownerPlayerId, {
      ...player,
      commander: remaining,
      discard: [...player.discard, found.card],
    }),
    activePlayer: phasePlayerId,
  };

  const winner = checkCommanderDefeat(
    nextState,
    ownerPlayerId,
    found.card.cardId,
    "commander",
  );
  if (winner) {
    nextState = { ...nextState, winner };
  }

  return nextState;
}
