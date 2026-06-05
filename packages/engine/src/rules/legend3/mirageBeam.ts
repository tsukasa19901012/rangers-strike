import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { getDefinition, unitBp } from "../../core/catalog";
import { removeAt, updatePlayer } from "../../core/helpers";

export type MirageBeamPrep = {
  state: GameState;
  bpOverride?: number;
  revealedCard?: CardInstance;
};

/** RS-131: reveal deck top before battle; unit cards override attacker BP. */
export function prepareMirageBeamForBattle(
  state: GameState,
  playerId: PlayerId,
  attackerCardId: string,
): MirageBeamPrep {
  if (!findNamedEffectByEffectId(attackerCardId, "mirage_beam")) {
    return { state };
  }

  const player = state.players[playerId];
  if (player.deck.length === 0) return { state };

  const top = player.deck[0];
  if (!top) return { state };
  const rest = player.deck.slice(1);
  const def = getDefinition(state.definitions, top.cardId);
  const bpOverride =
    def?.type === "unit" ? unitBp(def) : undefined;

  return {
    state: {
      ...state,
      ...updatePlayer(state, playerId, { ...player, deck: rest }),
    },
    bpOverride,
    revealedCard: top,
  };
}

export function discardMirageBeamCard(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance | undefined,
): GameState {
  if (!card) return state;
  const player = state.players[playerId];
  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      discard: [...player.discard, card],
    }),
  };
}

export function mirageBeamBpOverride(pending: PendingBattle): number | undefined {
  return pending.mirageBeamBpOverride;
}
