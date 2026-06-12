"use client";

import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CardDefinition } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { maxCopiesForCard, remainingCopiesForCard } from "@/lib/deckBuilder";
import { CardImage } from "./CardImage";

type DeckBuilderCatalogGridProps = {
  cards: CardDefinition[];
  counts: Map<string, number>;
  entries: DeckEntry[];
  columns: number;
  onAdd: (card: CardDefinition) => void;
  onRemove: (card: CardDefinition) => void;
  onPreview: (card: CardDefinition) => void;
};

const ROW_HEIGHT = 108;
const ROW_GAP = 8;

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
  columns,
  onAdd,
  onRemove,
  onPreview,
}: DeckBuilderCatalogGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => chunkCards(cards, columns), [cards, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: ROW_GAP,
    overscan: 3,
  });

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      virtualizer.measure();
    });
    observer.observe(element);
    virtualizer.measure();
    return () => observer.disconnect();
  }, [virtualizer, rows.length]);

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
              className="deck-builder__grid-row"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
              role="listitem"
            >
              {rowCards.map((card) => {
                const current = counts.get(card.id) ?? 0;
                const max = maxCopiesForCard(card);
                const remaining = remainingCopiesForCard(card, entries);
                const inDeck = current > 0;
                return (
                  <div
                    key={card.id}
                    className={`deck-builder__grid-cell ${inDeck ? "deck-builder__grid-cell--in-deck" : ""}`}
                  >
                    <button
                      type="button"
                      className="deck-builder__grid-preview"
                      onClick={() => onPreview(card)}
                      aria-label={`${card.name} の詳細`}
                    >
                      <CardImage card={card} small hideMeta />
                    </button>
                    <span className="deck-builder__grid-name">{card.name}</span>
                    {inDeck && (
                      <span className="deck-builder__grid-overlay">
                        {current}/{max}
                      </span>
                    )}
                    <div className="deck-builder__grid-actions">
                      {inDeck && (
                        <button
                          type="button"
                          className="btn btn--icon deck-builder__catalog-remove"
                          aria-label={`${card.name} を減らす`}
                          onClick={() => onRemove(card)}
                        >
                          −
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--icon"
                        aria-label={`${card.name} を追加`}
                        disabled={remaining <= 0}
                        onClick={() => onAdd(card)}
                      >
                        +
                      </button>
                    </div>
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
