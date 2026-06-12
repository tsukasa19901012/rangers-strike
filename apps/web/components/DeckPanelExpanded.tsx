"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { getFullPlayableCardById } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { remainingCopiesForCard } from "@/lib/deckBuilder";
import { CardImage } from "./CardImage";
import { CardStatusBadges } from "./CardStatusBadges";

type DeckPanelExpandedProps = {
  entries: DeckEntry[];
  onAdd: (card: CardDefinition) => void;
  onRemove: (cardId: string) => void;
  onPreview: (card: CardDefinition) => void;
};

export function DeckPanelExpanded({
  entries,
  onAdd,
  onRemove,
  onPreview,
}: DeckPanelExpandedProps) {
  if (entries.length === 0) {
    return (
      <p className="deck-builder__empty">カードを追加してください</p>
    );
  }

  return (
    <div className="deck-builder__deck-list" role="list">
      {entries.map((entry) => {
        const card = getFullPlayableCardById(entry.cardId);
        if (!card) return null;
        const canAdd = remainingCopiesForCard(card, entries) > 0;
        return (
          <div key={entry.cardId} className="deck-builder__deck-row" role="listitem">
            <div className="deck-builder__deck-card">
              <CardImage card={card} small onPreview={() => onPreview(card)} />
              <span className="deck-builder__deck-name">
                {card.name}
                <CardStatusBadges cardId={card.id} max={1} />
              </span>
            </div>
            <div className="deck-builder__deck-controls">
              <button
                type="button"
                className="btn btn--icon"
                aria-label={`${card.name} を減らす`}
                onClick={() => onRemove(entry.cardId)}
              >
                −
              </button>
              <span className="deck-builder__deck-count">{entry.count}</span>
              <button
                type="button"
                className="btn btn--icon"
                aria-label={`${card.name} を増やす`}
                onClick={() => onAdd(card)}
                disabled={!canAdd}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
