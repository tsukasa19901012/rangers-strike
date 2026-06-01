import type { GameState, PlayerId, PlayerState } from "../types/game";
import { hasOperationEffect } from "../core/catalog";
import { removeAt, updatePlayer } from "../core/helpers";

export function applySuperBrainDraw(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
): { state: GameState; detail: string } {
  const usesSuperBrain = hasOperationEffect(
    player,
    "super_brain",
    state.definitions,
  );

  if (!usesSuperBrain || player.deck.length < 2) {
    if (player.deck.length === 0) {
      return { state, detail: "empty_deck" };
    }
    const [drawn, deck] = removeAt(player.deck, 0);
    const nextPlayer = { ...player, deck, hand: [...player.hand, drawn] };
    return {
      state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
      detail: "draw:1",
    };
  }

  const [first, restAfterFirst] = removeAt(player.deck, 0);
  const [second, deck] = removeAt(restAfterFirst, 0);
  const nextPlayer = {
    ...player,
    deck,
    hand: [...player.hand, first],
    discard: [...player.discard, second],
  };

  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    detail: "super_brain:1",
  };
}
