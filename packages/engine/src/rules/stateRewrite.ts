import type { GameState } from "../types/game";
import { updatePlayer } from "../core/helpers";

export type StateRewriteKind =
  | "deck_size_change"
  | "copy_card"
  | "commander_zone_write";

export type PendingStateRewrite = {
  kind: StateRewriteKind;
  sourceCardId: string;
  playerId?: import("../types/game").PlayerId;
  detail?: string;
  deckDelta?: number;
};

/** 裁定依存 state 書き換え — Phase 5（deck_size_change のみ実装）。 */
export function applyStateRewrite(
  state: GameState,
  rewrite: PendingStateRewrite,
): { state: GameState; applied: boolean } {
  if (rewrite.kind === "deck_size_change" && rewrite.playerId && rewrite.deckDelta) {
    const player = state.players[rewrite.playerId];
    const delta = rewrite.deckDelta;
    if (delta > 0) {
      return { state, applied: false };
    }
    const nextDeck = player.deck.slice(0, Math.max(0, player.deck.length + delta));
    return {
      state: {
        ...state,
        ...updatePlayer(state, rewrite.playerId, { ...player, deck: nextDeck }),
      },
      applied: true,
    };
  }
  return { state, applied: false };
}

export function canApplyStateRewrite(state: GameState, rewrite: PendingStateRewrite): boolean {
  if (rewrite.kind !== "deck_size_change" || !rewrite.playerId || !rewrite.deckDelta) {
    return false;
  }
  return state.players[rewrite.playerId].deck.length + rewrite.deckDelta >= 0;
}
