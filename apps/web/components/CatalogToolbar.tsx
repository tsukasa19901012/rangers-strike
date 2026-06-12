"use client";

import type { RefObject } from "react";
import type { CatalogFilterType, CatalogSort, CatalogViewMode } from "@/lib/deckBuilderCatalog";
import { CategoryFilterChips } from "./CategoryFilterChips";
import type { Category } from "@rangers-strike/cards";

type CategoryOption = { id: Category; label: string };

type CatalogToolbarProps = {
  total: number;
  minDeckSize: number;
  search: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  filter: CatalogFilterType;
  onFilterChange: (value: CatalogFilterType) => void;
  categoryFilter: "all" | Category;
  onCategoryFilterChange: (value: "all" | Category) => void;
  availableCategories: CategoryOption[];
  expansionLabel: string;
  onOpenExpansion: () => void;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  resultCount: number;
  poolCount: number;
  hasSearch: boolean;
};

export function CatalogToolbar({
  total,
  minDeckSize,
  search,
  searchInputRef,
  onSearchChange,
  filter,
  onFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
  expansionLabel,
  onOpenExpansion,
  viewMode,
  onViewModeChange,
  sort,
  onSortChange,
  resultCount,
  poolCount,
  hasSearch,
}: CatalogToolbarProps) {
  return (
    <div className="deck-builder__catalog-toolbar">
      <div className="deck-builder__catalog-toolbar-row">
        <span className="deck-builder__catalog-count" aria-live="polite">
          {total}/{minDeckSize}
        </span>
        <div className="deck-builder__view-toggle" role="group" aria-label="表示形式">
          <button
            type="button"
            className={`deck-builder__view-btn ${viewMode === "list" ? "deck-builder__view-btn--active" : ""}`}
            onClick={() => onViewModeChange("list")}
            aria-pressed={viewMode === "list"}
          >
            リスト
          </button>
          <button
            type="button"
            className={`deck-builder__view-btn ${viewMode === "grid" ? "deck-builder__view-btn--active" : ""}`}
            onClick={() => onViewModeChange("grid")}
            aria-pressed={viewMode === "grid"}
          >
            グリッド
          </button>
        </div>
        <label className="deck-builder__search-wrap">
          <span className="visually-hidden">名前または ID で検索</span>
          <input
            ref={searchInputRef}
            className="deck-builder__input deck-builder__search-input"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="検索"
          />
          {search && (
            <button
              type="button"
              className="deck-builder__search-clear"
              onClick={() => onSearchChange("")}
              aria-label="検索をクリア"
            >
              ×
            </button>
          )}
        </label>
      </div>
      <div className="deck-builder__catalog-toolbar-row">
        <button type="button" className="deck-builder__expansion-btn" onClick={onOpenExpansion}>
          収録: {expansionLabel}
        </button>
        <label className="deck-builder__sort">
          <span className="visually-hidden">並び順</span>
          <select
            className="deck-builder__sort-select"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as CatalogSort)}
          >
            <option value="id">ID順</option>
            <option value="name">名前順</option>
          </select>
        </label>
      </div>
      <div className="deck-builder__filters">
        {(
          [
            ["all", "すべて"],
            ["unit", "ユニット"],
            ["operation", "オペ"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`deck-builder__filter-chip ${filter === value ? "deck-builder__filter-chip--active" : ""}`}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <CategoryFilterChips
        availableCategories={availableCategories}
        categoryFilter={categoryFilter}
        onChange={onCategoryFilterChange}
      />
      <p className="deck-builder__search-count" role="status">
        {hasSearch
          ? `${resultCount.toLocaleString()} 件（${poolCount.toLocaleString()} 枚中）`
          : `全 ${resultCount.toLocaleString()} 枚を表示中。検索で絞り込めます`}
      </p>
    </div>
  );
}
