"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { maxCopiesForCard } from "@/lib/deckBuilder";

type DeckCardAdjustBarProps = {
  card: CardDefinition;
  current: number;
  canAdd: boolean;
  onRemove: () => void;
  onAdd: () => void;
};

export function DeckCardAdjustBar({
  card,
  current,
  canAdd,
  onRemove,
  onAdd,
}: DeckCardAdjustBarProps) {
  const max = maxCopiesForCard(card);

  return (
    <div
      className="deck-builder__deck-adjust"
      role="toolbar"
      aria-label={`${card.name} の枚数調整`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="deck-builder__deck-adjust-btn deck-builder__deck-adjust-btn--add"
        aria-label={`${card.name} を増やす`}
        onClick={onAdd}
        disabled={!canAdd}
      >
        +
      </button>
      <span className="deck-builder__deck-adjust-count" aria-live="polite">
        {current}/{max}
      </span>
      <button
        type="button"
        className="deck-builder__deck-adjust-btn deck-builder__deck-adjust-btn--remove"
        aria-label={`${card.name} を減らす`}
        onClick={onRemove}
      >
        −
      </button>
    </div>
  );
}
