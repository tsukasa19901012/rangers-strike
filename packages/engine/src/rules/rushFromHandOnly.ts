import { hasUnnamedRule } from "@rangers-strike/cards";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";

export function rushFromHandOnly(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "rush_from_hand_only") ||
    cardHasGrantKeyword(cardId, "rush_from_hand_only")
  );
}

export function canMoveCardToRushFromZone(
  cardId: string,
  fromZone: "hand" | "discard" | "power" | "command" | "rush" | "battle" | "deck",
): boolean {
  if (!rushFromHandOnly(cardId)) return true;
  return fromZone === "hand";
}
