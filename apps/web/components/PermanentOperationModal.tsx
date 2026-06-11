"use client";

import Image from "next/image";
import { getCardEffect, type CardDefinition } from "@rangers-strike/cards";
import { formatCardCategories } from "@/lib/labels";
import { GameModalBackdrop } from "./GameModalBackdrop";

type PermanentOperationModalProps = {
  card: CardDefinition;
  canActivate: boolean;
  activateLabel?: string;
  onActivate: () => void;
  onClose: () => void;
};

export function PermanentOperationModal({
  card,
  canActivate,
  activateLabel = "発動",
  onActivate,
  onClose,
}: PermanentOperationModalProps) {
  const operationEffect = getCardEffect(card.id);
  const categoryLabel = formatCardCategories(card.category);

  return (
    <GameModalBackdrop>
      <div
        className="modal modal--card"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
      >
        <button type="button" className="modal__close" onClick={onClose}>
          ✕
        </button>
        <div className="modal__content modal__content--card">
          {card.imageUrl && (
            <div className="modal__media">
              <Image
                src={card.imageUrl}
                alt={card.name}
                width={220}
                height={308}
                className="modal__image"
                unoptimized
              />
            </div>
          )}
          <div className="modal__info">
            <h3>{card.name}</h3>
            <p className="modal__id">{card.id}</p>
            {categoryLabel && (
              <p className="modal__category">
                カテゴリ: {categoryLabel}
              </p>
            )}
            {(operationEffect?.text || card.text) && (
              <section className="modal__effect">
                <h4>効果</h4>
                <p>{operationEffect?.text ?? card.text}</p>
              </section>
            )}
            {card.tags && card.tags.length > 0 && (
              <p className="modal__tags">{card.tags.join(" / ")}</p>
            )}
            <div className="effect-action-modal__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canActivate}
                onClick={onActivate}
              >
                {activateLabel}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                閉じる
              </button>
            </div>
            {!canActivate && (
              <p className="effect-action-modal__hint">
                今は発動できません（ラッシュフェイズ・手札あり・未使用が必要です）
              </p>
            )}
          </div>
        </div>
      </div>
    </GameModalBackdrop>
  );
}
