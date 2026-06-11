import type { GameState, PlayerId } from "../types/game";
import { findInZone } from "../core/helpers";
import { findCardOwner } from "../rules/fieldLookup";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  breakerBlocksEffectTarget,
  cardHasNotSelectableExceptAttack,
} from "./battleKeywords";

/** 敵効果の対象にできるユニットか（ブレイカー / not_selectable 等）。 */
export function isSelectableByOpponentEffect(
  state: GameState,
  selectorPlayerId: PlayerId,
  targetInstanceId: string,
  sourceCardId?: string,
): boolean {
  const located = findCardOwner(state, targetInstanceId);
  if (!located) return false;
  if (located.playerId === selectorPlayerId) return true;

  const owner = state.players[located.playerId];
  const found = findInZone(owner, located.zone, targetInstanceId);
  if (!found) return false;

  if (cardHasGrantKeyword(found.card.cardId, "not_selectable")) return false;
  if (cardHasNotSelectableExceptAttack(found.card.cardId)) return false;
  if (breakerBlocksEffectTarget(state.definitions, found.card.cardId, sourceCardId)) {
    return false;
  }
  return true;
}
