import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, isSmallUnit, unitEffectiveCategories } from "../core/catalog";

const HELLO_MIRAGE_CARD_ID = "RS-407";

const STRIKE_POSITION_BY_CATEGORY: Record<Category, number> = {
  DA: 1,
  WB: 2,
  MA: 3,
  OT: 4,
  ET: 5,
};

/**
 * 「これが自軍ラッシュエリアにある間、すべてのSユニットは…」— どちらのプレイヤーのマジエルでも、
 * 両軍の S ユニットが制限を受ける（faq-card-6 RS-407: コロンでナンバーが変わっても並び順の制限はテキスト通り）。
 */
export function helloMirageActive(state: GameState, _playerId?: PlayerId): boolean {
  return (["player1", "player2"] as const).some((pid) =>
    state.players[pid].rush.some((card) => card.cardId === HELLO_MIRAGE_CARD_ID),
  );
}

/** RS-407: Sユニットは全カテゴリ分の並び順制限を満たす必要がある。 */
export function canStrikeWithHelloMirage(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): boolean {
  if (!helloMirageActive(state, playerId)) return true;
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || !isSmallUnit(state.definitions, instance)) return true;

  // 効果で追加されたカテゴリ（RS-339 闇のヤイバの DA 等）も含める（faq-card-6 RS-407 Q1）。
  const categories = unitEffectiveCategories(state, playerId, instance, "battle");
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
