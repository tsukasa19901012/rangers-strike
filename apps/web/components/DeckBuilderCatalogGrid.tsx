"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CardDefinition } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { remainingCopiesForCard } from "@/lib/deckBuilder";
import {
  CATALOG_CARD_WIDTH,
  CATALOG_GRID_GAP,
  CATALOG_ROW_HEIGHT,
  CATALOG_ROW_HEIGHT_SELECTED,
  computeCatalogGridColumns,
} from "@/lib/catalogGridLayout";
import { DeckCardThumb } from "./DeckCardThumb";

type DeckBuilderCatalogGridProps = {
  cards: CardDefinition[];
  counts: Map<string, number>;
  entries: DeckEntry[];
  selectedCardId: string | null;
  onSelectCardId: (cardId: string | null) => void;
  onAdd: (card: CardDefinition) => void;
  onRemove: (card: CardDefinition) => void;
  onPreview: (card: CardDefinition) => void;
};

function chunkCards(cards: CardDefinition[], columns: number): CardDefinition[][] {
  const rows: CardDefinition[][] = [];
  for (let i = 0; i < cards.length; i += columns) {
    rows.push(cards.slice(i, i + columns));
  }
  return rows;
}

export function DeckBuilderCatalogGrid({
  cards,
  counts,
  entries,
  selectedCardId,
  onSelectCardId,
  onAdd,
  onRemove,
  onPreview,
}: DeckBuilderCatalogGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  const rows = useMemo(() => chunkCards(cards, columns), [cards, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const rowCards = rows[index];
      if (!rowCards) return CATALOG_ROW_HEIGHT;
      return rowCards.some((card) => card.id === selectedCardId)
        ? CATALOG_ROW_HEIGHT_SELECTED
        : CATALOG_ROW_HEIGHT;
    },
    gap: CATALOG_GRID_GAP,
    overscan: 3,
  });

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateLayout = () => {
      setColumns(computeCatalogGridColumns(element.clientWidth));
      virtualizer.measure();
    };

    const observer = new ResizeObserver(updateLayout);
    observer.observe(element);
    updateLayout();
    return () => observer.disconnect();
  }, [virtualizer, rows.length]);

  useEffect(() => {
    virtualizer.measure();
  }, [selectedCardId, virtualizer, rows.length]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className="deck-builder__catalog deck-builder__catalog--grid"
      role="list"
      aria-rowcount={rows.length}
    >
      <div
        className="deck-builder__catalog-virtual"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowCards = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              className="deck-builder__catalog-grid-row"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, ${CATALOG_CARD_WIDTH}px)`,
              }}
              role="listitem"
            >
              {rowCards.map((card) => {
                const current = counts.get(card.id) ?? 0;
                const isSelected = selectedCardId === card.id;
                const canAdd = remainingCopiesForCard(card, entries) > 0;

                return (
                  <div
                    key={card.id}
                    className={`deck-builder__deck-cell ${isSelected ? "deck-builder__deck-cell--selected" : ""}`}
                  >
                    <DeckCardThumb
                      card={card}
                      count={current}
                      canAdd={canAdd}
                      isSelected={isSelected}
                      onToggleSelect={() =>
                        onSelectCardId(isSelected ? null : card.id)
                      }
                      onAdd={() => onAdd(card)}
                      onRemove={() => onRemove(card)}
                      onPreview={() => onPreview(card)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
