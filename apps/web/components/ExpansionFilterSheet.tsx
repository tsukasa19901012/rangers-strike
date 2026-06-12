"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { groupWikiSets } from "@/lib/expansionGroups";

type ExpansionFilterSheetProps = {
  sets: readonly string[];
  value: "all" | string;
  onChange: (value: "all" | string) => void;
  onClose: () => void;
};

export function ExpansionFilterSheet({
  sets,
  value,
  onChange,
  onClose,
}: ExpansionFilterSheetProps) {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return groupWikiSets(sets)
      .map((group) => ({
        ...group,
        sets: normalized
          ? group.sets.filter((set) => set.toLowerCase().includes(normalized))
          : group.sets,
      }))
      .filter((group) => group.sets.length > 0);
  }, [query, sets]);

  if (!mounted) return null;

  const select = (next: "all" | string) => {
    onChange(next);
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="deck-builder__expansion-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="収録セットを選択"
      >
        <div className="deck-builder__expansion-sheet-header">
          <h2 className="deck-builder__expansion-sheet-title">収録セット</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <input
          className="deck-builder__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="セット名で絞り込み"
          autoFocus
        />
        <div className="deck-builder__expansion-sheet-list">
          <button
            type="button"
            className={`deck-builder__expansion-option ${value === "all" ? "deck-builder__expansion-option--active" : ""}`}
            onClick={() => select("all")}
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
                  className={`deck-builder__expansion-option ${value === set ? "deck-builder__expansion-option--active" : ""}`}
                  onClick={() => select(set)}
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
