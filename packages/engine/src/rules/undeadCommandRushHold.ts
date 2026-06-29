import type { CardDefinition } from "@rangers-strike/cards";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import type { CardInstance, PlayerState } from "../types/game";
import { getDefinition } from "../core/catalog";

const UNDEAD_FEATURE = "アンデッド";

export function unitHasUndeadFeature(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return def?.features?.includes(UNDEAD_FEATURE) ?? false;
}

export function hasUndeadCommandRushHoldKeyword(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "undead_command_rush_hold");
}

/** ラッシュ支払い候補: フィールド上の undead_command_rush_hold ユニット（未ホールド）。 */
export function collectUndeadCommandRushHoldUnits(player: PlayerState): CardInstance[] {
  const results: CardInstance[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (card.commandHeld || card.mothershipHold) continue;
      if (hasUndeadCommandRushHoldKeyword(card.cardId)) {
        results.push(card);
      }
    }
  }
  return results;
}

export function heldUndeadCommandRushHoldMatches(
  player: PlayerState,
  rushingCardId: string,
  definitions: Record<string, CardDefinition>,
): boolean {
  if (!unitHasUndeadFeature(definitions, rushingCardId)) return false;
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (!card.commandHeld || card.mothershipHold) continue;
      if (hasUndeadCommandRushHoldKeyword(card.cardId)) return true;
    }
  }
  return false;
}

export function paymentSourceIsUndeadCommandRushHold(
  player: PlayerState,
  instanceId: string,
  rushingCardId: string,
  definitions: Record<string, CardDefinition>,
): boolean {
  if (!unitHasUndeadFeature(definitions, rushingCardId)) return false;
  for (const zone of ["rush", "battle"] as const) {
    const card = player[zone].find((c) => c.instanceId === instanceId);
    if (card && hasUndeadCommandRushHoldKeyword(card.cardId)) return true;
  }
  return false;
}
