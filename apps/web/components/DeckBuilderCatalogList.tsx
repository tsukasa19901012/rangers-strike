"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CardDefinition } from "@rangers-strike/cards";
import type { DeckEntry } from "@rangers-strike/cards";
import { maxCopiesForCard, remainingCopiesForCard } from "@/lib/deckBuilder";
import { CardImage } from "./CardImage";
import { CardStatusBadges } from "./CardStatusBadges";

type DeckBuilderCatalogListProps = {
  cards: CardDefinition[];
  counts: Map<string, number>;
  entries: DeckEntry[];
  onAdd: (card: CardDefinition) => void;
  onRemove: (card: CardDefinition) => void;
  onPreview: (card: CardDefinition) => void;
};

const ROW_HEIGHT = 72;
const ROW_GAP = 8;

export function DeckBuilderCatalogList({
  cards,
  counts,
  entries,
  onAdd,
  onRemove,
  onPreview,
}: DeckBuilderCatalogListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: ROW_GAP,
    overscan: 5,
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
  }, [virtualizer, cards.length]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className="deck-builder__catalog"
      role="list"
      aria-rowcount={cards.length}
    >
      <div
        className="deck-builder__catalog-virtual"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const card = cards[virtualRow.index];
          const current = counts.get(card.id) ?? 0;
          const max = maxCopiesForCard(card);
          const remaining = remainingCopiesForCard(card, entries);
          const inDeck = current > 0;

          return (
            <div
              key={card.id}
              className={`deck-builder__catalog-item ${inDeck ? "deck-builder__catalog-item--in-deck" : ""}`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              role="listitem"
            >
              <div className="deck-builder__catalog-card">
                <CardImage card={card} small onPreview={() => onPreview(card)} />
              </div>
              <div className="deck-builder__catalog-meta">
                <span className="deck-builder__catalog-name">
                  {card.name}
                  <CardStatusBadges cardId={card.id} />
                </span>
                <span className="deck-builder__catalog-id">
                  {card.id} · {current}/{max}
                </span>
              </div>
              {inDeck && (
                <span className="deck-builder__in-deck-badge" aria-hidden="true">
                  {current}/{max}
                </span>
              )}
              <div className="deck-builder__catalog-actions">
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
    </div>
  );
}
