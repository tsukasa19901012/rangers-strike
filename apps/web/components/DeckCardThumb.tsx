"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import { CardImage } from "./CardImage";
import { DeckCardAdjustBar } from "./DeckCardAdjustBar";

type DeckCardThumbProps = {
  card: CardDefinition;
  count: number;
  canAdd: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onPreview: () => void;
};

export function DeckCardThumb({
  card,
  count,
  canAdd,
  isSelected,
  onToggleSelect,
  onAdd,
  onRemove,
  onPreview,
}: DeckCardThumbProps) {
  return (
    <div
      className="deck-builder__deck-thumb"
      role={isSelected ? undefined : "button"}
      tabIndex={isSelected ? -1 : 0}
      aria-label={`${card.name} ${count}枚`}
      aria-pressed={isSelected ? undefined : false}
      onClick={onToggleSelect}
      onKeyDown={
        isSelected
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleSelect();
              }
            }
      }
    >
      <CardImage card={card} small hideMeta onPreview={onPreview} />
      {isSelected ? (
        <DeckCardAdjustBar
          card={card}
          current={count}
          canAdd={canAdd}
          onRemove={onRemove}
          onAdd={onAdd}
        />
      ) : (
        count > 0 && (
          <span className="deck-builder__deck-qty-badge" aria-hidden="true">
            {count}
          </span>
        )
      )}
    </div>
  );
}
