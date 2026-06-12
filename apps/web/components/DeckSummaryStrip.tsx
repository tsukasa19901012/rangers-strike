"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { getFullPlayableCardById } from "@rangers-strike/cards";
import { CardImage } from "./CardImage";

type DeckSummaryStripProps = {
  entries: DeckEntry[];
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onPreview: (card: CardDefinition) => void;
};

export function DeckSummaryStrip({
  entries,
  total,
  expanded,
  onToggleExpand,
  onPreview,
}: DeckSummaryStripProps) {
  const uniqueCount = entries.length;

  return (
    <div className="deck-builder__summary">
      <div className="deck-builder__summary-header">
        <span className="deck-builder__summary-label">
          {uniqueCount > 0 ? `${uniqueCount}種 · ${total}枚` : "デッキは空です"}
        </span>
        <button
          type="button"
          className="btn btn--ghost deck-builder__summary-toggle"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          {expanded ? "折りたたむ" : "一覧を開く"}
        </button>
      </div>
      {total === 0 ? (
        <div className="deck-builder__summary-empty" aria-hidden="true">
          <span className="deck-builder__summary-slot" />
          <span className="deck-builder__summary-slot" />
          <span className="deck-builder__summary-slot" />
        </div>
      ) : (
        <div className="deck-builder__summary-thumbs" role="list">
          {entries.map((entry) => {
            const card = getFullPlayableCardById(entry.cardId);
            if (!card) return null;
            return (
              <div key={entry.cardId} className="deck-builder__summary-thumb" role="listitem">
                <CardImage card={card} small onPreview={() => onPreview(card)} />
                {entry.count > 1 && (
                  <span className="deck-builder__summary-count">{entry.count}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
