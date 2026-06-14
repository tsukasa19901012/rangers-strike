"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Category } from "@rangers-strike/cards";
import { type CatalogFilterType, type CatalogSort } from "@/lib/deckBuilderCatalog";
import { groupWikiSets } from "@/lib/expansionGroups";
import { CategoryFilterChips } from "./CategoryFilterChips";

type CategoryOption = { id: Category; label: string };

type CatalogFilterModalProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: CatalogFilterType;
  onFilterChange: (value: CatalogFilterType) => void;
  categoryFilter: "all" | Category;
  onCategoryFilterChange: (value: "all" | Category) => void;
  availableCategories: CategoryOption[];
  expansionFilter: "all" | string;
  onExpansionFilterChange: (value: "all" | string) => void;
  expansionSets: readonly string[];
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  onClose: () => void;
};

export function CatalogFilterModal({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
  expansionFilter,
  onExpansionFilterChange,
  expansionSets,
  sort,
  onSortChange,
  onClose,
}: CatalogFilterModalProps) {
  const [expansionQuery, setExpansionQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredGroups = useMemo(() => {
    const normalized = expansionQuery.trim().toLowerCase();
    return groupWikiSets(expansionSets)
      .map((group) => ({
        ...group,
        sets: normalized
          ? group.sets.filter((set) => set.toLowerCase().includes(normalized))
          : group.sets,
      }))
      .filter((group) => group.sets.length > 0);
  }, [expansionQuery, expansionSets]);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal deck-builder__filter-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-filter-title"
      >
        <div className="deck-builder__filter-modal-header">
          <h2 id="catalog-filter-title" className="deck-builder__filter-modal-title">
            検索・フィルタ
          </h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            閉じる
          </button>
        </div>

        <label className="deck-builder__field">
          <span className="deck-builder__label">名前または ID</span>
          <input
            ref={searchInputRef}
            className="deck-builder__input"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="例: BK-001, アバレ"
          />
        </label>

        <label className="deck-builder__field">
          <span className="deck-builder__label">並び順</span>
          <select
            className="deck-builder__sort-select deck-builder__input"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as CatalogSort)}
          >
            <option value="id">ID順</option>
            <option value="name">名前順</option>
          </select>
        </label>

        <div className="deck-builder__filters" aria-label="カード種別">
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

        <div className="deck-builder__field">
          <span className="deck-builder__label">収録セット</span>
          <input
            className="deck-builder__input"
            value={expansionQuery}
            onChange={(event) => setExpansionQuery(event.target.value)}
            placeholder="セット名で絞り込み"
          />
        </div>
        <div className="deck-builder__filter-modal-expansion">
          <button
            type="button"
            className={`deck-builder__expansion-option ${expansionFilter === "all" ? "deck-builder__expansion-option--active" : ""}`}
            onClick={() => onExpansionFilterChange("all")}
          >
            全件
          </button>
          {filteredGroups.map((group) => (
            <section key={group.id} className="deck-builder__expansion-group">
              <h3 className="deck-builder__expansion-group-title">{group.label}</h3>
              {group.sets.map((set) => (
                <button
                  key={set}
                  type="button"
                  className={`deck-builder__expansion-option ${expansionFilter === set ? "deck-builder__expansion-option--active" : ""}`}
                  onClick={() => onExpansionFilterChange(set)}
                >
                  {set}
                </button>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function countActiveCatalogFilters(options: {
  search: string;
  filter: CatalogFilterType;
  categoryFilter: "all" | Category;
  expansionFilter: "all" | string;
}): number {
  let count = 0;
  if (options.search.trim()) count += 1;
  if (options.filter !== "all") count += 1;
  if (options.categoryFilter !== "all") count += 1;
  if (options.expansionFilter !== "all") count += 1;
  return count;
}
