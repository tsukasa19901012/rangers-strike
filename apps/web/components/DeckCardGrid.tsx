"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { getFullPlayableCardById } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { remainingCopiesForCard } from "@/lib/deckBuilder";
import { DeckCardThumb } from "./DeckCardThumb";

export type DeckDisplayLayout = "wrap" | "row";

type DeckCardGridProps = {
  entries: DeckEntry[];
  total: number;
  layout: DeckDisplayLayout;
  showLayoutToggle: boolean;
  onLayoutToggle: () => void;
  selectedCardId: string | null;
  onSelectCardId: (cardId: string | null) => void;
  onAdd: (card: CardDefinition) => void;
  onRemove: (cardId: string) => void;
  onPreview: (card: CardDefinition) => void;
};

export function DeckCardGrid({
  entries,
  total,
  layout,
  showLayoutToggle,
  onLayoutToggle,
  selectedCardId,
  onSelectCardId,
  onAdd,
  onRemove,
  onPreview,
}: DeckCardGridProps) {
  const uniqueCount = entries.length;
  const layoutToggleLabel = layout === "wrap" ? "1行" : "全体を表示";

  return (
    <div className="deck-builder__deck-grid-panel">
      <div className="deck-builder__deck-grid-header">
        <span className="deck-builder__deck-grid-label">
          {uniqueCount > 0 ? `${uniqueCount}種 · ${total}枚` : "デッキは空です"}
        </span>
        {showLayoutToggle && (
          <button
            type="button"
            className="btn btn--ghost deck-builder__deck-layout-toggle"
            onClick={onLayoutToggle}
            aria-pressed={layout === "row"}
          >
            {layoutToggleLabel}
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="deck-builder__deck-grid-empty" aria-hidden="true">
          <span className="deck-builder__deck-grid-slot" />
          <span className="deck-builder__deck-grid-slot" />
          <span className="deck-builder__deck-grid-slot" />
        </div>
      ) : (
        <div
          className={`deck-builder__deck-grid ${layout === "row" ? "deck-builder__deck-grid--row" : ""}`}
          role="list"
        >
          {entries.map((entry) => {
            const card = getFullPlayableCardById(entry.cardId);
            if (!card) return null;
            const isSelected = selectedCardId === entry.cardId;
            const canAdd = remainingCopiesForCard(card, entries) > 0;

            return (
              <div
                key={entry.cardId}
                className={`deck-builder__deck-cell ${isSelected ? "deck-builder__deck-cell--selected" : ""}`}
                role="listitem"
              >
                <DeckCardThumb
                  card={card}
                  count={entry.count}
                  canAdd={canAdd}
                  isSelected={isSelected}
                  onToggleSelect={() =>
                    onSelectCardId(isSelected ? null : entry.cardId)
                  }
                  onAdd={() => onAdd(card)}
                  onRemove={() => onRemove(entry.cardId)}
                  onPreview={() => onPreview(card)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
