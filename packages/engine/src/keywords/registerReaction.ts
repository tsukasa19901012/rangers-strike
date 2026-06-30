import { hasResist } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { findInZone } from "../core/helpers";
import { cardHasDslGrantKeyword } from "../dsl/promotedKeywordBridge";
import { cardHasKeyword } from "./cardKeywords";
import { srBigBatonRegisterActive } from "../rules/srEffects";

/** レジスト: 場に留まる（反撃不能・離場阻止等）。 */
export function unitHasRegister(state: GameState, ownerId: PlayerId, instanceId: string): boolean {
  const card =
    findInZone(state.players[ownerId], "battle", instanceId)?.card ??
    findInZone(state.players[ownerId], "rush", instanceId)?.card;
  if (!card) return false;
  return card.registerHeld === true;
}

export function cardHasRegisterKeyword(
  state: GameState,
  cardId: string,
  ownerId?: PlayerId,
): boolean {
  if (ownerId && srBigBatonRegisterActive(state, ownerId, cardId)) return true;
  return (
    cardHasDslGrantKeyword(cardId, "register") ||
    cardHasKeyword(state.definitions, cardId, "register") ||
    hasResist(state.definitions, cardId)
  );
}

export function canRegisterUnit(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
): boolean {
  const found =
    findInZone(state.players[ownerId], "battle", instanceId) ??
    findInZone(state.players[ownerId], "rush", instanceId);
  if (!found) return false;
  return cardHasRegisterKeyword(state, found.card.cardId, ownerId);
}

export function applyRegisterHoldToCard(card: CardInstance): CardInstance {
  return { ...card, registerHeld: true, commandHeld: true, battleActed: true };
}
