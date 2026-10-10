import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { getCardDslDocument, listDslEffectsForTrigger } from "./effectLookup";
import { namedTextNegated } from "../rules/legend1/set6NamedEffects348";

type FieldZone = "rush" | "battle" | "operation";

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

/** そのキーワードを与える効果が効果名を持つか（旧来の対応表のカードは名前つき効果）。 */
function keywordEffectIsNamed(cardId: string, keyword: string): boolean {
  if (legacyCardIdsForKeyword(keyword).includes(cardId)) return true;
  const effect = getCardDslDocument(cardId)?.effects?.find((e) =>
    e.effects.some((p) => p.type === "grant_keyword" && p.keyword === keyword),
  );
  return !!effect?.name;
}

/** RS-379【雷の雄叫び】等で、このカードのそのキーワード（効果名を持つテキスト）が無効か。 */
function keywordNegated(state: GameState, playerId: PlayerId, card: { cardId: string; instanceId: string }, keyword: string): boolean {
  return namedTextNegated(state, playerId, card) && keywordEffectIsNamed(card.cardId, keyword);
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
      if (keywordNegated(state, playerId, card, keyword)) continue;
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
  zones: FieldZone[] = ["rush", "battle", "operation"],
): boolean {
  const player = state.players[playerId];
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (keywordNegated(state, playerId, card, keyword)) continue;
      if (cardHasWhileInFieldKeyword(card.cardId, keyword)) return true;
      if (legacyCardIdsForKeyword(keyword).includes(card.cardId)) return true;
    }
  }
  return false;
}

/** 同じキーワードを持つ場のカードの枚数（ルール: R-CONT-01 同じ継続効果は枚数分重複する）。 */
export function countActiveFieldKeyword(
  state: GameState,
  playerId: PlayerId,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle", "operation"],
): number {
  const player = state.players[playerId];
  let count = 0;
  for (const zone of zones) {
    for (const card of player[zone]) {
      if (keywordNegated(state, playerId, card, keyword)) continue;
      if (
        cardHasWhileInFieldKeyword(card.cardId, keyword) ||
        legacyCardIdsForKeyword(keyword).includes(card.cardId)
      ) {
        count += 1;
      }
    }
  }
  return count;
}

export function anyPlayerHasActiveFieldKeyword(
  state: GameState,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle", "operation"],
): boolean {
  return (
    playerHasActiveFieldKeyword(state, "player1", keyword, zones) ||
    playerHasActiveFieldKeyword(state, "player2", keyword, zones)
  );
}

export function findFieldCardByKeyword(
  state: GameState,
  keyword: string,
  zones: FieldZone[] = ["rush", "battle", "operation"],
): { playerId: PlayerId; cardId: string; name: string } | null {
  for (const playerId of ["player1", "player2"] as const) {
    const player = state.players[playerId];
    for (const zone of zones) {
      for (const card of player[zone]) {
        if (keywordNegated(state, playerId, card, keyword)) continue;
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
