import type { GameState, PlayerId, PlayerState } from "../types/game";
import { hasOperationEffect } from "../core/catalog";
import { requestDrawFromDeck } from "../rules/drawFromDeck";

export type SuperBrainDrawResult = {
  state: GameState;
  detail: string;
  pending?: boolean;
};

export function applySuperBrainDraw(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  phasePlayerId: PlayerId,
): SuperBrainDrawResult {
  const usesSuperBrain = hasOperationEffect(
    player,
    "super_brain",
    state.definitions,
  );

  if (!usesSuperBrain || player.deck.length < 2) {
    if (player.deck.length === 0) {
      return { state, detail: "empty_deck" };
    }
    const result = requestDrawFromDeck(state, playerId, phasePlayerId, {
      count: 1,
      sourceCardId: "RS-014",
    });
    if (result.pending) {
      return { state: result.state, detail: "seabed_pending", pending: true };
    }
    return { state: result.state, detail: "draw:1" };
  }

  const result = requestDrawFromDeck(state, playerId, phasePlayerId, {
    count: 2,
    superBrainDiscardSecond: true,
    sourceCardId: "RS-014",
  });
  if (result.pending) {
    return { state: result.state, detail: "seabed_pending", pending: true };
  }
  return { state: result.state, detail: "super_brain:1" };
}
