"use client";

import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance } from "@rangers-strike/engine";
import { CardImage } from "./CardImage";

type PileModalProps = {
  title: string;
  cards: CardInstance[];
  definitions: Record<string, CardDefinition>;
  faceDown?: boolean;
  selectableIds?: Set<string>;
  onSelect?: (instanceId: string) => void;
  onPreview?: (card: CardDefinition) => void;
  onClose: () => void;
};

export function PileModal({
  title,
  cards,
  definitions,
  faceDown,
  selectableIds,
  onSelect,
  onPreview,
  onClose,
}: PileModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--pile"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" className="modal__close" onClick={onClose}>
          ✕
        </button>
        <div className="modal__content modal__content--pile">
          <h3 className="pile-modal__title">
            {title} ({cards.length}枚)
          </h3>
          <div className="pile-modal__grid">
            {cards.length === 0 ? (
              <p className="pile-modal__empty">カードがありません</p>
            ) : (
              cards.map((card) => {
                const definition = definitions[card.cardId];
                const selectable = selectableIds?.has(card.instanceId);
                return (
                  <div
                    key={card.instanceId}
                    className={[
                      "pile-modal__card",
                      selectable ? "pile-modal__card--target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <CardImage
                      card={definition}
                      small
                      faceDown={faceDown}
                      onPreview={
                        definition && onPreview && !faceDown
                          ? () => onPreview(definition)
                          : undefined
                      }
                      onSelect={
                        selectable && onSelect
                          ? () => onSelect(card.instanceId)
                          : undefined
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
