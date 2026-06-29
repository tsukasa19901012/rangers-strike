import type { GameState, PlayerId } from "../types/game";
import { findCardInField } from "../rules/fieldLookup";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  breakerBlocksEffectTarget,
  cardHasNotSelectableExceptAttack,
} from "./battleKeywords";
import { rs627NotSelectable } from "../rules/rs/rsCatchallField";

/** 敵効果の対象にできるユニットか（ブレイカー / not_selectable 等）。 */
export function isSelectableByOpponentEffect(
  state: GameState,
  selectorPlayerId: PlayerId,
  targetInstanceId: string,
  sourceCardId?: string,
): boolean {
  const located = findCardInField(state, targetInstanceId);
  if (!located) return false;
  if (located.playerId === selectorPlayerId) return true;

  const found = located;

  if (cardHasGrantKeyword(found.card.cardId, "not_selectable")) return false;
  if (cardHasNotSelectableExceptAttack(found.card.cardId)) return false;
  if (rs627NotSelectable(state, found.playerId, targetInstanceId)) return false;
  if (breakerBlocksEffectTarget(state.definitions, found.card.cardId, sourceCardId)) {
    return false;
  }
  return true;
}
