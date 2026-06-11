import type { GameState, PlayerId } from "../types/game";
import { isSmallUnit } from "../core/catalog";
import { updatePlayer } from "../core/helpers";

/** 捨札から手札へ S ユニットを加えたとき RS-382 用カウンタを増やす。 */
export function recordSUnitRecoveredFromDiscardToHand(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): GameState {
  if (!isSmallUnit(state.definitions, cardId)) return state;
  const player = state.players[playerId];
  const count = (player.sUnitsRecoveredFromDiscardThisTurn ?? 0) + 1;
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      sUnitsRecoveredFromDiscardThisTurn: count,
    }),
  };
}
