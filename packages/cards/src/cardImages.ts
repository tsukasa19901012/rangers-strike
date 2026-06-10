import {
  isFullPlayableCardId,
  resolvePlayableCard,
} from "./extendedCatalog";
import type { CardDefinition } from "./schema";

export const GRNRNGR_CARD_IMAGE_BASE =
  "https://www.grnrngr.com/cards/rangers-strike/cards";

export function grnrngrCardImageUrl(cardId: string): string {
  return `${GRNRNGR_CARD_IMAGE_BASE}/${cardId}.jpg`;
}

/** core catalog imageUrl → grnrngr 慣例 URL（full-playable のみ） */
export function resolveCardImageUrl(
  idOrCard: string | CardDefinition,
): string | undefined {
  const card =
    typeof idOrCard === "string" ? resolvePlayableCard(idOrCard) : idOrCard;

  if (card?.imageUrl) {
    return card.imageUrl;
  }

  const id = typeof idOrCard === "string" ? idOrCard : card?.id;
  if (id && isFullPlayableCardId(id)) {
    return grnrngrCardImageUrl(id);
  }

  return undefined;
}
