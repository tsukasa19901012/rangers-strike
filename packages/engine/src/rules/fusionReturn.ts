import {
  fusionPartnerReturnCount,
  isFusionUnit,
  listZordFusionPartnerIds,
  requiresFusionPartnerReturn,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { removeAt, updatePlayer } from "../core/helpers";
import {
  autoHoldForBattleEntry,
  canMoveUnitToBattle,
  markBattleEntryHoldReadyIfNoteSatisfied,
} from "./restrictions";

export type FusionReturnDestination = "battle" | "hand";

function findNextFusionMaterialIndex(
  discard: CardInstance[],
  destroyedCardId: string,
  usedInstanceIds: Set<string>,
): number {
  const partners = listZordFusionPartnerIds(destroyedCardId);
  if (partners.length > 0) {
    for (const partnerId of partners) {
      const index = discard.findIndex(
        (card) => card.cardId === partnerId && !usedInstanceIds.has(card.instanceId),
      );
      if (index >= 0) return index;
    }
    return -1;
  }
  return discard.findIndex(
    (card) => isFusionUnit(card.cardId) && !usedInstanceIds.has(card.instanceId),
  );
}

/** Return fusion partners from discard after a fusion zord leaves the field. */
export function returnFusionPartnersFromDiscard(
  state: GameState,
  ownerId: PlayerId,
  destroyedCardId: string,
  destination: FusionReturnDestination,
): GameState {
  if (!requiresFusionPartnerReturn(destroyedCardId)) {
    return state;
  }

  let owner = state.players[ownerId];
  let discard = [...owner.discard];
  let battle = [...owner.battle];
  let hand = [...owner.hand];
  const quota = fusionPartnerReturnCount(destroyedCardId);
  const used = new Set<string>();
  let returned = 0;

  while (returned < quota) {
    const index = findNextFusionMaterialIndex(discard, destroyedCardId, used);
    if (index < 0) break;

    const [card, rest] = removeAt(discard, index);
    discard = rest;
    used.add(card.instanceId);

    if (destination === "hand") {
      hand = [...hand, card];
      returned += 1;
      continue;
    }

    const prepared = autoHoldForBattleEntry(owner, card);
    if (!prepared) {
      discard = [...discard, card];
      break;
    }
    owner = markBattleEntryHoldReadyIfNoteSatisfied(prepared, card);
    const withPrepared = { ...state, ...updatePlayer(state, ownerId, owner) };
    if (!canMoveUnitToBattle(withPrepared, ownerId, card, "rush")) {
      discard = [...discard, card];
      break;
    }
    battle = [...battle, { ...card, battleActed: false }];
    owner = { ...owner, battleEntryHoldReady: false };
    returned += 1;
  }

  return {
    ...state,
    ...updatePlayer(state, ownerId, { ...owner, discard, battle, hand }),
  };
}
