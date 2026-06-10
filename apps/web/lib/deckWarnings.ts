import {
  getCardById,
  resolvePlayableCard,
  type DeckEntry,
} from "@rangers-strike/cards";

export type DeckWarningEstimate = {
  /** entries の count 加重 */
  uiUncertainCount: number;
  uncertainCardIds: string[];
};

export function estimateDeckWarnings(entries: DeckEntry[]): DeckWarningEstimate {
  let uiUncertainCount = 0;
  const uncertainCardIds: string[] = [];

  for (const entry of entries) {
    if (entry.count <= 0) continue;
    const resolved = resolvePlayableCard(entry.cardId);
    if (!resolved) continue;
    if (!getCardById(entry.cardId)) {
      uiUncertainCount += entry.count;
      uncertainCardIds.push(entry.cardId);
    }
  }

  return { uiUncertainCount, uncertainCardIds };
}

export function formatDeckWarningMessage(estimate: DeckWarningEstimate): string | null {
  if (estimate.uiUncertainCount <= 0) return null;
  return `UI 未確認カードが ${estimate.uiUncertainCount} 枚含まれます`;
}
