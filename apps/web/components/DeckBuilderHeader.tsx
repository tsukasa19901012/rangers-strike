"use client";

import { MIN_DECK_SIZE } from "@/lib/deckBuilder";

type DeckBuilderHeaderProps = {
  total: number;
  validationOk: boolean;
  isDirty: boolean;
  onBack: () => void;
};

export function DeckBuilderHeader({
  total,
  validationOk,
  isDirty,
  onBack,
}: DeckBuilderHeaderProps) {
  const progress = Math.min(total / MIN_DECK_SIZE, 1);
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference * (1 - progress);
  const ringClass =
    total >= MIN_DECK_SIZE && validationOk
      ? "deck-builder__progress-ring--complete"
      : !validationOk && total > 0
        ? "deck-builder__progress-ring--error"
        : "";

  return (
    <header className="deck-builder__header">
      <button type="button" className="btn btn--ghost deck-builder__back" onClick={onBack}>
        戻る
      </button>
      <div className="deck-builder__header-main">
        <div className="deck-builder__header-titles">
          <h1 className="deck-builder__title">デッキ作成</h1>
          {isDirty && (
            <span className="deck-builder__unsaved" aria-live="polite">
              未保存
            </span>
          )}
        </div>
        <p className="deck-builder__count">
          {total} / {MIN_DECK_SIZE} 枚
        </p>
      </div>
      <div
        className={`deck-builder__progress-ring ${ringClass}`}
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={MIN_DECK_SIZE}
        aria-label="デッキ枚数"
      >
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <circle
            className="deck-builder__progress-track"
            cx="20"
            cy="20"
            r="16"
            fill="none"
            strokeWidth="3"
          />
          <circle
            className="deck-builder__progress-fill"
            cx="20"
            cy="20"
            r="16"
            fill="none"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 20 20)"
          />
        </svg>
        <span className="deck-builder__progress-value">{total}</span>
      </div>
    </header>
  );
}
