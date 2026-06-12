"use client";

import type { Category } from "@rangers-strike/cards";
import { categoryChipLabel } from "@/lib/deckBuilderCatalog";

type CategoryOption = { id: Category; label: string };

type CategoryFilterChipsProps = {
  availableCategories: CategoryOption[];
  categoryFilter: "all" | Category;
  onChange: (value: "all" | Category) => void;
};

export function CategoryFilterChips({
  availableCategories,
  categoryFilter,
  onChange,
}: CategoryFilterChipsProps) {
  return (
    <div className="deck-builder__category-chips" aria-label="カテゴリー">
      <button
        type="button"
        className={`deck-builder__filter-chip ${categoryFilter === "all" ? "deck-builder__filter-chip--active" : ""}`}
        onClick={() => onChange("all")}
      >
        全カテゴリー
      </button>
      {availableCategories.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`deck-builder__filter-chip ${categoryFilter === option.id ? "deck-builder__filter-chip--active" : ""}`}
          onClick={() => onChange(option.id)}
          title={option.label}
        >
          {categoryChipLabel(option.id, option.label)}
        </button>
      ))}
    </div>
  );
}
