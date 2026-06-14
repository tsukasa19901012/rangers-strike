"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fullPlayableCatalog,
  getWikiSetLabel,
  getWikiSetLabels,
  type CardDefinition,
  type Category,
} from "@rangers-strike/cards";
import { CATEGORY_OPTIONS } from "@/lib/labels";
import {
  countEntries,
  createDeckId,
  MIN_DECK_SIZE,
  deleteCustomDeck,
  entriesToMap,
  getCustomDeck,
  mapToEntries,
  remainingCopiesForCard,
  saveCustomDeck,
  validateDeckEntries,
  type CustomDeck,
} from "@/lib/deckBuilder";
import {
  filterCatalogCards,
  sortCatalogCards,
  type CatalogFilterType,
  type CatalogSort,
} from "@/lib/deckBuilderCatalog";
import { useCardAdjustSelection } from "@/lib/useCardAdjustSelection";
import { formatDeckValidationMessage } from "@/lib/formatDeckValidation";
import { CardModal } from "./CardModal";
import { CatalogBar } from "./CatalogBar";
import {
  CatalogFilterModal,
  countActiveCatalogFilters,
} from "./CatalogFilterModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeckBuilderCatalogGrid } from "./DeckBuilderCatalogGrid";
import { DeckBuilderHeader } from "./DeckBuilderHeader";
import { DeckCardGrid, type DeckDisplayLayout } from "./DeckCardGrid";
import { DeckWarningBanner } from "./DeckWarningBanner";

type ExpansionFilter = "all" | string;
type CategoryFilter = "all" | Category;
type PendingConfirm = { type: "back" } | { type: "clear" };

type DeckBuilderScreenProps = {
  editDeckId?: string | null;
  onBack: () => void;
  onSaved: () => void;
};

function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if ((b.get(key) ?? 0) !== value) return false;
  }
  return true;
}

export function DeckBuilderScreen({ editDeckId, onBack, onSaved }: DeckBuilderScreenProps) {
  const existing = editDeckId ? getCustomDeck(editDeckId) : undefined;

  const initialName = existing?.name ?? "マイデッキ";
  const initialCounts = useMemo(() => entriesToMap(existing?.entries ?? []), [existing?.entries]);

  const [name, setName] = useState(initialName);
  const [counts, setCounts] = useState(() => entriesToMap(existing?.entries ?? []));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CatalogFilterType>("all");
  const [expansionFilter, setExpansionFilter] = useState<ExpansionFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<CatalogSort>("id");
  const [deckLayout, setDeckLayout] = useState<DeckDisplayLayout>("wrap");
  const [isDesktop, setIsDesktop] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [adjustCardId, setAdjustCardId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const prevTotalRef = useRef(countEntries(existing?.entries ?? []));

  const entries = useMemo(() => mapToEntries(counts), [counts]);
  const total = useMemo(() => countEntries(entries), [entries]);
  const validation = useMemo(() => validateDeckEntries(entries), [entries]);
  const isDirty = name !== initialName || !mapsEqual(counts, initialCounts);

  useCardAdjustSelection(adjustCardId, setAdjustCardId);

  const wikiSetOptions = useMemo(() => getWikiSetLabels(), []);

  const catalogSource = useMemo(() => {
    if (expansionFilter === "all") return fullPlayableCatalog.cards;
    return fullPlayableCatalog.cards.filter(
      (card) => getWikiSetLabel(card.id) === expansionFilter,
    );
  }, [expansionFilter]);

  const availableCategories = useMemo(() => {
    const present = new Set<Category>();
    for (const card of catalogSource) {
      const categories = Array.isArray(card.category) ? card.category : [card.category];
      for (const category of categories) {
        if (category) present.add(category);
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

  const searchQuery = search.trim().toLowerCase();

  const catalogCards = useMemo(() => {
    const filtered = filterCatalogCards(catalogSource, {
      filter,
      categoryFilter,
      searchQuery,
    });
    return sortCatalogCards(filtered, sort);
  }, [catalogSource, categoryFilter, filter, searchQuery, sort]);

  const activeFilterCount = countActiveCatalogFilters({
    search,
    filter,
    categoryFilter,
    expansionFilter,
  });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        event.preventDefault();
        setFilterModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (prevTotalRef.current < MIN_DECK_SIZE && total >= MIN_DECK_SIZE) {
      setStatusMessage("40枚になりました。内容を確認して保存してください。");
    }
    prevTotalRef.current = total;
  }, [total]);

  useEffect(() => {
    if (!adjustCardId) return;
    if (!catalogCards.some((card) => card.id === adjustCardId)) {
      if (!entries.some((entry) => entry.cardId === adjustCardId)) {
        setAdjustCardId(null);
      }
    }
  }, [adjustCardId, catalogCards, entries]);

  const addCard = useCallback((card: CardDefinition) => {
    setCounts((prev) => {
      const current = prev.get(card.id) ?? 0;
      const nextEntries = mapToEntries(prev);
      if (remainingCopiesForCard(card, nextEntries) <= 0) return prev;
      const next = new Map(prev);
      next.set(card.id, current + 1);
      return next;
    });
    setSaveError(null);
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(cardId) ?? 0;
      if (current <= 1) next.delete(cardId);
      else next.set(cardId, current - 1);
      return next;
    });
    setSaveError(null);
  }, []);

  const removeCardByDefinition = useCallback(
    (card: CardDefinition) => removeCard(card.id),
    [removeCard],
  );

  const clearDeck = useCallback(() => {
    setCounts(new Map());
    setSaveError(null);
    setAdjustCardId(null);
  }, []);

  const handleSave = () => {
    if (!name.trim()) {
      setSaveError("デッキ名を入力してください");
      return;
    }
    if (!validation.ok) {
      setSaveError(formatDeckValidationMessage(validation.errors));
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

  const handleBack = () => {
    if (isDirty) {
      setPendingConfirm({ type: "back" });
      return;
    }
    onBack();
  };

  const handleClearRequest = () => {
    if (total === 0) return;
    setPendingConfirm({ type: "clear" });
  };

  const resolveConfirm = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === "back") onBack();
    if (pendingConfirm.type === "clear") clearDeck();
    setPendingConfirm(null);
  };

  return (
    <div className="deck-builder">
      {previewCard && (
        <CardModal card={previewCard} onClose={() => setPreviewCard(null)} />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.type === "back" ? "変更を破棄" : "デッキを空にする"}
          message={
            pendingConfirm.type === "back"
              ? "保存していない変更があります。破棄して戻りますか？"
              : "デッキをすべて空にしますか？元に戻せません。"
          }
          confirmLabel={pendingConfirm.type === "back" ? "破棄して戻る" : "空にする"}
          danger={pendingConfirm.type !== "back"}
          onConfirm={resolveConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {filterModalOpen && (
        <CatalogFilterModal
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          availableCategories={availableCategories}
          expansionFilter={expansionFilter}
          onExpansionFilterChange={setExpansionFilter}
          expansionSets={wikiSetOptions}
          sort={sort}
          onSortChange={setSort}
          onClose={() => setFilterModalOpen(false)}
        />
      )}

      <DeckBuilderHeader
        total={total}
        validationOk={validation.ok}
        isDirty={isDirty}
        onBack={handleBack}
      />

      <label className="deck-builder__field deck-builder__name-field">
        <span className="deck-builder__label">デッキ名</span>
        <input
          className="deck-builder__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="マイデッキ"
        />
      </label>

      <div className="deck-builder__layout">
        <section className="deck-builder__deck-pane" aria-label="デッキ内容">
          <DeckCardGrid
            entries={entries}
            total={total}
            layout={deckLayout}
            showLayoutToggle={isDesktop}
            onLayoutToggle={() =>
              setDeckLayout((prev) => (prev === "wrap" ? "row" : "wrap"))
            }
            selectedCardId={adjustCardId}
            onSelectCardId={setAdjustCardId}
            onAdd={addCard}
            onRemove={removeCard}
            onPreview={setPreviewCard}
          />
          <button
            type="button"
            className="btn deck-builder__clear-btn"
            onClick={handleClearRequest}
            disabled={total === 0}
          >
            すべて外す
          </button>
          {!validation.ok && validation.errors.length > 0 && total > 0 && (
            <ul className="deck-builder__hint" role="alert">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="deck-builder__catalog-pane" aria-label="カード一覧">
          <CatalogBar
            deckTotal={total}
            minDeckSize={MIN_DECK_SIZE}
            resultCount={catalogCards.length}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFilterModalOpen(true)}
          />
          {searchQuery && catalogCards.length === 0 && (
            <p className="deck-builder__empty" role="status">
              「{search.trim()}」に一致するカードはありません
            </p>
          )}
          <DeckBuilderCatalogGrid
            cards={catalogCards}
            counts={counts}
            entries={entries}
            selectedCardId={adjustCardId}
            onSelectCardId={setAdjustCardId}
            onAdd={addCard}
            onRemove={removeCardByDefinition}
            onPreview={setPreviewCard}
          />
        </section>
      </div>

      {statusMessage && (
        <p className="deck-builder__status-toast" role="status">
          {statusMessage}
        </p>
      )}

      {saveError && (
        <div className="action-error" role="alert">
          {saveError}
        </div>
      )}

      <DeckWarningBanner entries={entries} />

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
          title={
            !validation.ok && validation.errors[0] ? validation.errors[0] : undefined
          }
        >
          保存（{total}/{MIN_DECK_SIZE}）
        </button>
      </footer>
    </div>
  );
}
