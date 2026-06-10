import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { listDslEffectsForTrigger } from "./effectLookup";

type FieldZone = "rush" | "battle";

function cardHasWhileInFieldKeyword(cardId: string, keyword: string): boolean {
  const effects = listDslEffectsForTrigger(cardId, "while_in_field");
  return effects.some((effect) =>
    effect.effects.some(
      (primitive) =>
        primitive.type === "grant_keyword" && primitive.keyword === keyword,
    ),
  );
}

function legacyCardIdsForKeyword(keyword: string): string[] {
  switch (keyword) {
    case "over_technology_m_bp_plus_on_attacked":
      return ["RS-045"];
    case "block_m_battle_entry_bp5000_plus":
      return ["RS-047"];
    case "substitute_on_wb_destroy":
      return ["RS-052"];
    default:
      return [];
  }
}

export function findFieldInstanceByKeyword(
  state: GameState,
  playerId: PlayerId,
  keyword: string,
  zones: FieldZone[] = ["battle"],
  excludeInstanceId?: string,
): string | undefined {
  const player = state.players[playerId];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (excludeInstanceId && card.instanceId === excludeInstanceId) continue;
      if (
        cardHasWhileInFieldKeyword(card.cardId, keyword) ||
        legacyCardIdsForKeyword(keyword).includes(card.cardId)
      ) {
        return card.instanceId;
      }
    }
  }
  return undefined;
}

export function playerHasActiveFieldKeyword(
  state: GameState,
  playerId: PlayerId,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle"],
): boolean {
  const player = state.players[playerId];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (cardHasWhileInFieldKeyword(card.cardId, keyword)) return true;
      if (legacyCardIdsForKeyword(keyword).includes(card.cardId)) return true;
    }
  }
  return false;
}

export function anyPlayerHasActiveFieldKeyword(
  state: GameState,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle"],
): boolean {
  return (
    playerHasActiveFieldKeyword(state, "player1", keyword, zones) ||
    playerHasActiveFieldKeyword(state, "player2", keyword, zones)
  );
}

export function findFieldCardByKeyword(
  state: GameState,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle"],
): { playerId: PlayerId; cardId: string; name: string } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of zones) {
      for (const card of player[zone]) {
        if (
          cardHasWhileInFieldKeyword(card.cardId, keyword) ||
          legacyCardIdsForKeyword(keyword).includes(card.cardId)
        ) {
          const def = getDefinition(state.definitions, card.cardId);
          return { playerId, cardId: card.cardId, name: def?.name ?? card.cardId };
        }
      }
    }
  }
  return null;
}
