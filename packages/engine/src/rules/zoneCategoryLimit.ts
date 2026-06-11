import type { Category } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { effectiveCommandCategories } from "../core/catalog";
import { opponent } from "../core/helpers";

export function countDistinctCategoriesInCommandZone(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
): number {
  const cats = new Set<Category>();
  for (const cmd of player.command) {
    for (const cat of effectiveCommandCategories(player, definitions, cmd.cardId)) {
      cats.add(cat);
    }
  }
  return cats.size;
}

/** atwiki 1559: カテゴリ数削減時はマルチカテゴリを優先的に捨てる。 */
export function sortCommandZoneForCategoryReduction(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  cards: CardInstance[],
): CardInstance[] {
  return [...cards].sort((a, b) => {
    const aCount = effectiveCommandCategories(player, definitions, a.cardId).length;
    const bCount = effectiveCommandCategories(player, definitions, b.cardId).length;
    return bCount - aCount;
  });
}

export function categoriesAfterRemovingCommandCards(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  removeInstanceIds: Set<string>,
): Set<Category> {
  const cats = new Set<Category>();
  for (const cmd of player.command) {
    if (removeInstanceIds.has(cmd.instanceId)) continue;
    for (const cat of effectiveCommandCategories(player, definitions, cmd.cardId)) {
      cats.add(cat);
    }
  }
  return cats;
}

export function mustDiscardMultiCategoryFirst(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  candidateId: string,
  alreadySelected: Set<string>,
  targetMaxCategories: number,
): boolean {
  const remaining = player.command.filter((c) => !alreadySelected.has(c.instanceId));
  const withoutCandidate = new Set(alreadySelected);
  withoutCandidate.add(candidateId);
  const withCandidate = categoriesAfterRemovingCommandCards(
    player,
    definitions,
    withoutCandidate,
  );
  if (withCandidate.size <= targetMaxCategories) return true;

  const candidateCats = effectiveCommandCategories(
    player,
    definitions,
    player.command.find((c) => c.instanceId === candidateId)!.cardId,
  ).length;
  const hasMandatoryMulti = remaining.some((c) => {
    if (c.instanceId === candidateId || alreadySelected.has(c.instanceId)) return false;
    const count = effectiveCommandCategories(player, definitions, c.cardId).length;
    return count > 1;
  });
  if (!hasMandatoryMulti) return true;
  return candidateCats > 1;
}

export function dinoSlasherNeedsDiscard(
  state: GameState,
  effectOwnerId: PlayerId,
): { opponentId: PlayerId; targetCount: number; discardNeeded: boolean } | null {
  const opponentId = opponent(effectOwnerId);
  const selfCount = countDistinctCategoriesInCommandZone(
    state.players[effectOwnerId],
    state.definitions,
  );
  const enemyCount = countDistinctCategoriesInCommandZone(
    state.players[opponentId],
    state.definitions,
  );
  if (enemyCount <= selfCount) return null;
  return {
    opponentId,
    targetCount: selfCount,
    discardNeeded: true,
  };
}

export function assaultVectorDestroyLimit(
  state: GameState,
  effectOwnerId: PlayerId,
): number {
  return countDistinctCategoriesInCommandZone(
    state.players[opponent(effectOwnerId)],
    state.definitions,
  );
}
