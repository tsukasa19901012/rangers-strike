"use client";

type CatalogBarProps = {
  deckTotal: number;
  minDeckSize: number;
  resultCount: number;
  activeFilterCount: number;
  onOpenFilters: () => void;
};

export function CatalogBar({
  deckTotal,
  minDeckSize,
  resultCount,
  activeFilterCount,
  onOpenFilters,
}: CatalogBarProps) {
  return (
    <div className="deck-builder__catalog-bar">
      <span className="deck-builder__catalog-count" aria-live="polite">
        {deckTotal}/{minDeckSize}
      </span>
      <button
        type="button"
        className="deck-builder__catalog-search-btn"
        onClick={onOpenFilters}
        aria-label="検索・フィルタ"
      >
        <span className="deck-builder__catalog-search-icon" aria-hidden="true">
          🔍
        </span>
        {activeFilterCount > 0 && (
          <span className="deck-builder__catalog-filter-dot" aria-hidden="true">
            {activeFilterCount}
          </span>
        )}
      </button>
      <p className="deck-builder__search-count" role="status">
        {resultCount.toLocaleString()} 件
      </p>
    </div>
  );
}
