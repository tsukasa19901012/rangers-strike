"use client";

import type { StarterDeckId } from "@rangers-strike/cards";
import { STARTER_OPTIONS } from "@/lib/labels";

type StarterChipRowProps = {
  onSelect: (starterId: StarterDeckId) => void;
};

export function StarterChipRow({ onSelect }: StarterChipRowProps) {
  return (
    <div className="deck-builder__starter-chips" role="group" aria-label="スターターデッキ">
      {STARTER_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="deck-builder__starter-chip"
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
