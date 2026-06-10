import { getCardById, resolvePlayableCard } from "@rangers-strike/cards";

export type CardImplementationStatus = "core" | "promoted" | "ui-uncertain";

export function getCardImplementationStatus(
  cardId: string,
): CardImplementationStatus | null {
  if (getCardById(cardId)) return "core";
  if (resolvePlayableCard(cardId)) return "ui-uncertain";
  return null;
}
