import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";
import { removeAt, updatePlayer } from "../core/helpers";

/** コマンダーゾーンへ配置（フレームワーク — ゲームルール未接続）。 */
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
