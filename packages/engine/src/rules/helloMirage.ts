import type { Category } from "@rangers-strike/cards";
import { cardCategories } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";

const HELLO_MIRAGE_CARD_ID = "RS-407";

const STRIKE_POSITION_BY_CATEGORY: Record<Category, number> = {
  DA: 1,
  WB: 2,
  MA: 3,
  OT: 4,
  ET: 5,
};

export function helloMirageActive(state: GameState, playerId: PlayerId): boolean {
  return state.players[playerId].rush.some((card) => card.cardId === HELLO_MIRAGE_CARD_ID);
}

/** RS-407: Sユニットは全カテゴリ分の並び順制限を満たす必要がある。 */
export function canStrikeWithHelloMirage(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): boolean {
  if (!helloMirageActive(state, playerId)) return true;
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || !isSmallUnit(state.definitions, instance.cardId)) return true;

  const categories = cardCategories(def);
  if (categories.length === 0) return true;

  const requiredPositions = categories.map((cat) => STRIKE_POSITION_BY_CATEGORY[cat]);
  const unique = new Set(requiredPositions);
  if (unique.size !== 1) return false;

  const battleIndex = state.players[playerId].battle.findIndex(
    (card) => card.instanceId === instance.instanceId,
  );
  if (battleIndex < 0) return true;

  return battleIndex + 1 === requiredPositions[0];
}
