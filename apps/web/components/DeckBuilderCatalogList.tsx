"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardImplementationStatus } from "@/lib/cardImplementationStatus";
import { maxCopiesForCard } from "@/lib/deckBuilder";
import { CardImage } from "./CardImage";

type DeckBuilderCatalogListProps = {
  cards: CardDefinition[];
  counts: Map<string, number>;
  onAdd: (card: CardDefinition) => void;
  onPreview: (card: CardDefinition) => void;
};

const ROW_HEIGHT = 72;
const ROW_GAP = 8;

export function DeckBuilderCatalogList({
  cards,
  counts,
  onAdd,
  onPreview,
}: DeckBuilderCatalogListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    gap: ROW_GAP,
  });

  return (
    <div ref={parentRef} className="deck-builder__catalog">
      <div
        className="deck-builder__catalog-virtual"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const card = cards[virtualRow.index];
          const current = counts.get(card.id) ?? 0;
          const max = maxCopiesForCard(card);
          const disabled = current >= max;
          const implementationStatus = getCardImplementationStatus(card.id);

          return (
            <div
              key={card.id}
              className="deck-builder__catalog-item"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="deck-builder__catalog-card">
                <CardImage card={card} small onPreview={() => onPreview(card)} />
              </div>
              <div className="deck-builder__catalog-meta">
                <span className="deck-builder__catalog-name">
                  {card.name}
                  {implementationStatus === "ui-uncertain" && (
                    <span className="deck-builder__status-badge">UI未確認</span>
                  )}
                </span>
                <span className="deck-builder__catalog-id">
                  {card.id} · {current}/{max}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--icon"
                aria-label={`${card.name} を追加`}
                disabled={disabled}
                onClick={() => onAdd(card)}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
