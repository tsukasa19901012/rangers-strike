"use client";

import { useEffect, useMemo, useState } from "react";
import {
  allCardsCatalog,
  getCardById,
  getCatalogByExpansion,
  type CardDefinition,
  type Category,
  type ExpansionId,
  type StarterDeckId,
} from "@rangers-strike/cards";
import { CATEGORY_OPTIONS, STARTER_OPTIONS } from "@/lib/labels";
import {
  cardHasCategory,
  countEntries,
  createDeckId,
  MIN_DECK_SIZE,
  deleteCustomDeck,
  entriesToMap,
  getCustomDeck,
  mapToEntries,
  maxCopiesForCard,
  saveCustomDeck,
  starterTemplateEntries,
  validateDeckEntries,
  type CustomDeck,
} from "@/lib/deckBuilder";
import { CardImage } from "./CardImage";
import { CardModal } from "./CardModal";

type FilterType = "all" | "unit" | "operation";
type ExpansionFilter = "all" | ExpansionId;
type CategoryFilter = "all" | Category;

type DeckBuilderScreenProps = {
  editDeckId?: string | null;
  onBack: () => void;
  onSaved: () => void;
};

export function DeckBuilderScreen({ editDeckId, onBack, onSaved }: DeckBuilderScreenProps) {
  const existing = editDeckId ? getCustomDeck(editDeckId) : undefined;

  const [name, setName] = useState(existing?.name ?? "マイデッキ");
  const [counts, setCounts] = useState(() => entriesToMap(existing?.entries ?? []));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expansionFilter, setExpansionFilter] = useState<ExpansionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const entries = useMemo(() => mapToEntries(counts), [counts]);
  const total = useMemo(() => countEntries(entries), [entries]);
  const validation = useMemo(() => validateDeckEntries(entries), [entries]);

  const deckCards = useMemo(
    () =>
      entries.flatMap((entry) => {
        const card = getCardById(entry.cardId);
        if (!card) return [];
        return Array.from({ length: entry.count }, () => card);
      }),
    [entries],
  );

  const catalogSource = useMemo(
    () =>
      expansionFilter === "all"
        ? allCardsCatalog.cards
        : getCatalogByExpansion(expansionFilter).cards,
    [expansionFilter],
  );

  const availableCategories = useMemo(() => {
    const present = new Set<Category>();
    for (const card of catalogSource) {
      const categories = Array.isArray(card.category) ? card.category : [card.category];
      for (const category of categories) {
        present.add(category);
      }
    }
    return CATEGORY_OPTIONS.filter((option) => present.has(option.id));
  }, [catalogSource]);

  useEffect(() => {
    if (
      categoryFilter !== "all" &&
      !availableCategories.some((option) => option.id === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [availableCategories, categoryFilter]);

  const catalogCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogSource.filter((card) => {
      if (filter === "unit" && card.type !== "unit") return false;
      if (filter === "operation" && card.type !== "operation") return false;
      if (categoryFilter !== "all" && !cardHasCategory(card, categoryFilter)) return false;
      if (!query) return true;
      return (
        card.id.toLowerCase().includes(query) ||
        card.name.toLowerCase().includes(query)
      );
    });
  }, [catalogSource, categoryFilter, filter, search]);

  const addCard = (card: CardDefinition) => {
    const current = counts.get(card.id) ?? 0;
    const max = maxCopiesForCard(card);
    if (current >= max) return;
    setCounts((prev) => {
      const next = new Map(prev);
      next.set(card.id, current + 1);
      return next;
    });
    setSaveError(null);
  };

  const removeCard = (cardId: string) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(cardId) ?? 0;
      if (current <= 1) next.delete(cardId);
      else next.set(cardId, current - 1);
      return next;
    });
    setSaveError(null);
  };

  const loadStarter = (starterId: StarterDeckId) => {
    setCounts(entriesToMap(starterTemplateEntries(starterId)));
    setSaveError(null);
  };

  const clearDeck = () => {
    setCounts(new Map());
    setSaveError(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setSaveError("デッキ名を入力してください");
      return;
    }
    if (!validation.ok) {
      setSaveError(validation.errors[0] ?? "デッキが完成していません");
      return;
    }

    const deck: CustomDeck = {
      id: existing?.id ?? createDeckId(),
      name: name.trim(),
      entries,
      updatedAt: Date.now(),
    };
    saveCustomDeck(deck);
    onSaved();
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!window.confirm(`「${existing.name}」を削除しますか？`)) return;
    deleteCustomDeck(existing.id);
    onSaved();
  };

  return (
    <div className="deck-builder">
      {previewCard && (
        <CardModal card={previewCard} onClose={() => setPreviewCard(null)} />
      )}

      <header className="deck-builder__header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          戻る
        </button>
        <div>
          <h1 className="deck-builder__title">デッキ作成</h1>
          <p className="deck-builder__count">
            {total} 枚（最低 {MIN_DECK_SIZE} 枚）
          </p>
        </div>
      </header>

      <label className="deck-builder__field">
        <span className="deck-builder__label">デッキ名</span>
        <input
          className="deck-builder__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="マイデッキ"
        />
      </label>

      <div className="deck-builder__toolbar">
        <label className="deck-builder__field deck-builder__field--inline">
          <span className="deck-builder__label">スターターから読込</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as StarterDeckId;
              if (value) loadStarter(value);
              event.target.value = "";
            }}
          >
            <option value="">選択…</option>
            {STARTER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={clearDeck}>
          クリア
        </button>
      </div>

      {!validation.ok && validation.errors.length > 0 && total > 0 && (
        <div className="deck-builder__hint" role="status">
          {validation.errors[0]}
        </div>
      )}

      <div className="deck-builder__panels">
      <section className="deck-builder__section" aria-label="デッキ内容">
        <h2 className="deck-builder__section-title">デッキ内容</h2>
        {deckCards.length === 0 ? (
          <p className="deck-builder__empty">カードを追加してください</p>
        ) : (
          <div className="deck-builder__deck-list">
            {entries.map((entry) => {
              const card = getCardById(entry.cardId);
              if (!card) return null;
              return (
                <div key={entry.cardId} className="deck-builder__deck-row">
                  <button
                    type="button"
                    className="deck-builder__deck-card"
                    onClick={() => setPreviewCard(card)}
                  >
                    <CardImage card={card} small />
                    <span className="deck-builder__deck-name">{card.name}</span>
                  </button>
                  <div className="deck-builder__deck-controls">
                    <button
                      type="button"
                      className="btn btn--icon"
                      aria-label={`${card.name} を減らす`}
                      onClick={() => removeCard(entry.cardId)}
                    >
                      −
                    </button>
                    <span>{entry.count}</span>
                    <button
                      type="button"
                      className="btn btn--icon"
                      aria-label={`${card.name} を増やす`}
                      onClick={() => addCard(card)}
                      disabled={entry.count >= maxCopiesForCard(card)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="deck-builder__section" aria-label="カード一覧">
        <h2 className="deck-builder__section-title">カードを追加</h2>
        <input
          className="deck-builder__input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="名前または ID で検索"
        />
        <div className="deck-builder__filters">
          {(
            [
              ["all", "全弾"],
              ["legend1", "第1弾"],
              ["legend2", "第2弾"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn ${expansionFilter === value ? "btn--primary" : ""}`}
              onClick={() => setExpansionFilter(value)}
            >
              {label}
            </button>
          ))}
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
              className={`btn ${filter === value ? "btn--primary" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="deck-builder__filters" aria-label="カテゴリー">
          <button
            type="button"
            className={`btn ${categoryFilter === "all" ? "btn--primary" : ""}`}
            onClick={() => setCategoryFilter("all")}
          >
            全カテゴリー
          </button>
          {availableCategories.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`btn ${categoryFilter === option.id ? "btn--primary" : ""}`}
              onClick={() => setCategoryFilter(option.id)}
              title={option.label}
            >
              {option.id}
            </button>
          ))}
        </div>
        <div className="deck-builder__catalog">
          {catalogCards.map((card) => {
            const current = counts.get(card.id) ?? 0;
            const max = maxCopiesForCard(card);
            const disabled = current >= max;
            return (
              <div key={card.id} className="deck-builder__catalog-item">
                <button
                  type="button"
                  className="deck-builder__catalog-card"
                  onClick={() => setPreviewCard(card)}
                >
                  <CardImage card={card} small />
                </button>
                <div className="deck-builder__catalog-meta">
                  <span className="deck-builder__catalog-name">{card.name}</span>
                  <span className="deck-builder__catalog-id">
                    {card.id} · {current}/{max}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label={`${card.name} を追加`}
                  disabled={disabled}
                  onClick={() => addCard(card)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      </section>
      </div>

      {saveError && (
        <div className="action-error" role="alert">
          {saveError}
        </div>
      )}

      <footer className="deck-builder__footer">
        {existing && (
          <button type="button" className="btn btn--danger" onClick={handleDelete}>
            削除
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary deck-builder__save"
          onClick={handleSave}
          disabled={!validation.ok || !name.trim()}
        >
          保存
        </button>
      </footer>
    </div>
  );
}
