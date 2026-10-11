import {
  isCardDslReady,
  isCorePlayableCardId,
  resolvePlayableCard,
} from "@rangers-strike/cards";

export type CardImplementationStatus = "core" | "promoted" | "ui-uncertain";

export function getCardImplementationStatus(
  cardId: string,
): CardImplementationStatus | null {
  if (isCorePlayableCardId(cardId)) return "core";
  if (resolvePlayableCard(cardId)) {
    return isCardDslReady(cardId) ? "promoted" : "ui-uncertain";
  }
  return null;
}
