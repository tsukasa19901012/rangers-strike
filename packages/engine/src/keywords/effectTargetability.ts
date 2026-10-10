import type { GameState, PlayerId } from "../types/game";
import { findCardInField } from "../rules/fieldLookup";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import {
  breakerBlocksEffectTarget,
  cardHasNotSelectableExceptAttack,
} from "./battleKeywords";
import { rs627NotSelectable } from "../rules/rs/rsCatchallField";

/**
 * 敵効果の対象にできるユニットか（ブレイカー / not_selectable 等）。
 * sourceOwnerId は効果の発生源の持ち主（省略時は選ぶプレイヤー）。
 * ブレイカーは「敵軍ユニット／ビークルの効果」に選ばれないので、敵軍ユニットの効果で
 * 持ち主自身が選ぶ場合も選べない。ルール: R-KW-BREAKER-03
 */
export function isSelectableByOpponentEffect(
  state: GameState,
  selectorPlayerId: PlayerId,
  targetInstanceId: string,
  sourceCardId?: string,
  sourceOwnerId: PlayerId = selectorPlayerId,
): boolean {
  const found = findCardInField(state, targetInstanceId);
  if (!found) return false;

  // ブレイカーは「敵軍」（ブレイカーの持ち主から見て）の効果だけを防ぐ。選ぶのが持ち主でも防ぐ。
  if (
    found.playerId !== sourceOwnerId &&
    breakerBlocksEffectTarget(state.definitions, found.card.cardId, sourceCardId)
  ) {
    return false;
  }
  if (found.playerId === selectorPlayerId) return true;

  if (cardHasGrantKeyword(found.card.cardId, "not_selectable")) return false;
  if (cardHasNotSelectableExceptAttack(found.card.cardId)) return false;
  if (rs627NotSelectable(state, found.playerId, targetInstanceId)) return false;
  return true;
}
