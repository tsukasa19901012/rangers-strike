// Deck builder over the full card pool, as a graphical screen like GuiMatch:
// a filterable grid of cards, the focused card's image and text on the left,
// and a menu for starting points, saving and leaving. Deck rules (40 cards,
// copies per same name) come from the engine's DeckApi; the core only counts.
//
// Controls (Vita): D-pad moves over the grid (pages flip at the edges),
// ○ adds one copy, □ removes one, L switches catalog / deck, R cycles the
// category filter, △ the type filter, × opens the menu (every filter is under
// its 絞り込み item). Tapping a filter chip opens that filter's choices.
//
// Free-text search (card number, name, features, effect text) and the deck
// name are typed in the shell: the web shell puts text fields over
// geometry.search / geometry.nameField and calls setText(). Filters and
// search live in cardSearch.ts.
import type { CardDefinition, DeckApi, DeckEntry, EngineApi } from "../engineApi";
import { ListCursor, type LogicalInput } from "../input/actions";
import type { CustomDeck } from "../platform/settings";
import { fitLine, wrapText, type WrapOptions } from "../text/wrap";
import { effectParagraphs } from "../view/cardFields";
import { detailArtWidth, isWideDetail } from "../view/gui";
import type { Rect, Viewport } from "../view/layout";
import { TYPE_LABELS, type GuiBox, type MenuRowView, type PanelLine, type PanelTone } from "./guiMatch";
import { cardFilters, cardSearchText, matchesTerms, searchTerms, type CardFilter, type FilterKey } from "./cardSearch";

const FONT_PX = 12;
const LINE_H = 15;
const CARD_ASPECT = 190 / 130;
const TOAST_FRAMES = 120;
const MENU_ROWS = 12;

/**
 * What a filter chip does: "view" switches catalog / deck, a filter key opens
 * that filter's choices, "filters" opens the menu of every filter, "clear"
 * resets the filters and the search text.
 */
export type DeckChipKey = "view" | FilterKey | "filters" | "clear";
const DEFAULT_CHIPS: readonly DeckChipKey[] = ["view", "type", "category"];
/** Console button names on the default (Vita) chips. */
const CHIP_BUTTONS: Partial<Record<DeckChipKey, string>> = { view: "L", type: "△", category: "R" };
export const DECK_NAME_MAX = 24;

/** A text field the shell draws (the core only keeps the text). */
export type DeckTextField = { id: "search" | "name"; rect: Rect; text: string; placeholder: string; maxLength: number };

export type DeckGeometry = {
  width: number;
  height: number;
  fontPx: number;
  lineHeight: number;
  topBar: Rect;
  footer: Rect;
  detail: Rect;
  chips: Rect[];
  /** What each chip rect is (default: view, type, category). */
  chipKeys?: readonly DeckChipKey[];
  /** Where the shell shows a text field for free-text search (none on Vita). */
  search?: Rect;
  /** Where the shell shows a text field for the deck name (none on Vita). */
  nameField?: Rect;
  grid: Rect;
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
};

export type DeckTileView = {
  cardId: string;
  rect: Rect;
  /** Copies of this card in the deck. */
  count: number;
  /** "2/3" style badge; empty when nothing is in the deck and the card can be added. */
  badge: string;
  /** No copy can be added (same-name limit reached) and none is in the deck. */
  dimmed: boolean;
  focused: boolean;
  /** Short name for builds without card images. */
  name: string;
};

export type DeckBuilderView = {
  geometry: DeckGeometry;
  topBar: string;
  /** The deck is legal (40+ cards, copy limits). */
  valid: boolean;
  toast: string;
  chips: { key: DeckChipKey; text: string; rect: Rect; active: boolean }[];
  /** Search and deck-name fields, when the geometry has them (hidden while a menu is open). */
  textFields: DeckTextField[];
  tiles: DeckTileView[];
  pageText: string;
  emptyText: string;
  detailArt?: { cardId: string; hidden: boolean; rect: Rect };
  detailLines: PanelLine[];
  menu?: GuiBox;
  footer: string;
};

export type DeckBuilderResult = { kind: "saved"; deck: CustomDeck } | { kind: "deleted"; id: string } | { kind: "closed" };

type MenuItem = { label: string; run: () => void };

export function computeDeckGeometry(viewport: Viewport): DeckGeometry {
  const width = Math.max(400, Math.floor(viewport.width));
  const height = Math.max(240, Math.floor(viewport.height));
  const topBar = { x: 0, y: 0, w: width, h: LINE_H };
  const footer = { x: 0, y: height - LINE_H, w: width, h: LINE_H };
  const detailW = Math.round(width * 0.245);
  const detail = { x: 0, y: LINE_H, w: detailW, h: footer.y - LINE_H };
  const left = detailW + 2;
  const chipW = Math.floor((width - left - 2 * 3) / 3);
  const chips = [0, 1, 2].map((i) => ({ x: left + i * (chipW + 2), y: LINE_H + 1, w: chipW, h: LINE_H }));
  const grid = { x: left, y: LINE_H * 2 + 3, w: width - left - 2, h: footer.y - (LINE_H * 2 + 3) - 2 };
  const gap = 2;
  const cols = Math.max(4, Math.floor((grid.w + gap) / (40 + gap)));
  const tileW = Math.floor((grid.w + gap) / cols) - gap;
  const tileH = Math.round(tileW * CARD_ASPECT);
  const rows = Math.max(1, Math.floor((grid.h + gap) / (tileH + gap)));
  return { width, height, fontPx: FONT_PX, lineHeight: LINE_H, topBar, footer, detail, chips, grid, cols, rows, tileW, tileH, gap };
}

export class DeckBuilder {
  private geometry: DeckGeometry;
  private readonly deck: DeckApi;
  private entries = new Map<string, number>();
  private deckId: string | null = null;
  private deckName = "";
  /** A deck is open (the start menu has been answered). */
  private loaded = false;
  private dirty = false;
  private showDeck = false;
  private readonly filters: CardFilter[];
  /** Chosen option per filter (0 = all). */
  private filterIndex: Record<FilterKey, number> = { type: 0, category: 0, set: 0, cost: 0, bp: 0 };
  private query = "";
  private terms: string[] = [];
  private searchIndex: Map<string, string> | null = null;
  private index = 0;
  private page = 0;
  private menu: { title: string; items: MenuItem[]; cursor: ListCursor } | null = null;
  private toastText = "";
  private toastFrames = 0;
  private listCache: { key: string; cards: CardDefinition[] } | null = null;
  private countsByName = new Map<string, number>();
  private validation = { ok: false, total: 0, errors: [] as string[] };
  private readonly byId: Map<string, CardDefinition>;
  /** Set when the builder wants to close; the controller reads and clears it. */
  result: DeckBuilderResult | null = null;

  constructor(
    private readonly engine: EngineApi,
    viewport: Viewport,
    private readonly saved: () => CustomDeck[],
    private readonly cardArt = false,
    /** Screen geometry for a viewport (the Vita layout unless a shell supplies its own). */
    private readonly layout: (viewport: Viewport) => DeckGeometry = computeDeckGeometry,
  ) {
    this.deck = engine.deckApi;
    this.byId = new Map(this.deck.cards.map((card) => [card.id, card]));
    this.filters = cardFilters(this.deck.cards);
    this.geometry = layout(viewport);
    this.recount();
    this.openStartMenu();
  }

  setViewport(viewport: Viewport): void {
    this.geometry = this.layout(viewport);
  }

  /** Call once per frame (toast timer). Returns true when the view changed. */
  frame(): boolean {
    if (this.toastFrames <= 0) return false;
    this.toastFrames--;
    return this.toastFrames === 0;
  }

  // ------------------------------------------------------------ deck state

  private load(entries: readonly DeckEntry[], name: string, id: string | null): void {
    this.entries = new Map(entries.filter((e) => e.count > 0).map((e) => [e.cardId, e.count]));
    this.deckName = name;
    this.loaded = true;
    this.deckId = id;
    this.dirty = false;
    this.index = 0;
    this.page = 0;
    this.recount();
  }

  private deckEntries(): DeckEntry[] {
    return [...this.entries].map(([cardId, count]) => ({ cardId, count })).sort((a, b) => a.cardId.localeCompare(b.cardId));
  }

  private recount(): void {
    this.countsByName.clear();
    for (const [cardId, count] of this.entries) {
      const card = this.byId.get(cardId);
      if (!card) continue;
      const key = this.deck.sameNameKey(card);
      this.countsByName.set(key, (this.countsByName.get(key) ?? 0) + count);
    }
    this.validation = this.deck.validate(this.deckEntries());
    this.listCache = null;
  }

  private remaining(card: CardDefinition): number {
    return Math.max(0, this.deck.maxCopies(card) - (this.countsByName.get(this.deck.sameNameKey(card)) ?? 0));
  }

  private add(card: CardDefinition): void {
    if (this.remaining(card) <= 0) {
      this.toast(`${card.name} はこれ以上入れられません`);
      return;
    }
    this.entries.set(card.id, (this.entries.get(card.id) ?? 0) + 1);
    this.dirty = true;
    this.recount();
    this.toast(`${card.name} を入れた（${this.validation.total}枚）`);
  }

  private remove(card: CardDefinition): void {
    const count = this.entries.get(card.id) ?? 0;
    if (count <= 0) return;
    if (count === 1) this.entries.delete(card.id);
    else this.entries.set(card.id, count - 1);
    this.dirty = true;
    this.recount();
    this.toast(`${card.name} を抜いた（${this.validation.total}枚）`);
    this.clampIndex();
  }

  private toast(text: string): void {
    this.toastText = text;
    this.toastFrames = TOAST_FRAMES;
  }

  // ------------------------------------------------------------ list / cursor

  private list(): CardDefinition[] {
    const key = `${this.showDeck}|${Object.values(this.filterIndex).join(",")}|${this.terms.join(" ")}`;
    if (this.listCache?.key === key) return this.listCache.cards;
    const source = this.showDeck
      ? this.deckEntries().map((e) => this.byId.get(e.cardId)).filter((c): c is CardDefinition => !!c)
      : this.deck.cards;
    const active = this.filters.map((f) => f.options[this.filterIndex[f.key]]!).filter((o) => o.id !== "all");
    const index = this.terms.length ? this.searchText() : null;
    const cards = source.filter((card) => {
      if (active.length) {
        const categories = this.deck.categories(card);
        if (!active.every((option) => option.test(card, categories))) return false;
      }
      return !index || matchesTerms(index.get(card.id) ?? "", this.terms);
    });
    this.listCache = { key, cards };
    return cards;
  }

  /** Folded search text per card id, built on the first search. */
  private searchText(): Map<string, string> {
    this.searchIndex ??= new Map(this.deck.cards.map((card) => [card.id, cardSearchText(card)]));
    return this.searchIndex;
  }

  // ------------------------------------------------------------ filters / search

  /** Free-text search over number, name, features and effect text (space-separated words must all match). */
  setSearch(text: string): void {
    if (text === this.query) return;
    this.query = text;
    const terms = searchTerms(text);
    if (terms.join(" ") === this.terms.join(" ")) return;
    this.terms = terms;
    this.resetList();
  }

  get searchQuery(): string {
    return this.query;
  }

  /** Text typed into a shell's field (search or deck name). */
  setText(id: DeckTextField["id"], text: string): void {
    if (id === "search") this.setSearch(text);
    else this.setName(text);
  }

  /** Renames the deck; saving uses the trimmed name (an empty one falls back to a default). */
  setName(text: string): void {
    const name = [...text].slice(0, DECK_NAME_MAX).join("");
    if (name === this.deckName) return;
    this.deckName = name;
    this.dirty = true;
  }

  get name(): string {
    return this.deckName;
  }

  private filter(key: FilterKey): CardFilter {
    return this.filters.find((f) => f.key === key)!;
  }

  private setFilter(key: FilterKey, index: number): void {
    this.filterIndex[key] = index;
    this.resetList();
  }

  private cycleFilter(key: FilterKey): void {
    this.setFilter(key, (this.filterIndex[key] + 1) % this.filter(key).options.length);
  }

  private activeFilters(): number {
    return this.filters.filter((f) => this.filterIndex[f.key] > 0).length;
  }

  private clearFilters(): void {
    for (const f of this.filters) this.filterIndex[f.key] = 0;
    this.query = "";
    this.terms = [];
    this.resetList();
    this.toast("絞り込みを解除しました");
  }

  private filterChoice(key: FilterKey): string {
    const f = this.filter(key);
    const option = f.options[this.filterIndex[key]]!;
    return option.chip ?? option.label;
  }

  private openFilterChoices(key: FilterKey): void {
    const f = this.filter(key);
    this.openMenu(
      `${f.title}で絞り込む`,
      f.options.map((option, i) => ({ label: option.label, run: () => this.setFilter(key, i) })),
    );
    this.menu!.cursor.move(this.filterIndex[key]);
  }

  private openFiltersMenu(): void {
    const items: MenuItem[] = this.filters.map((f) => ({
      label: `${f.title}: ${f.options[this.filterIndex[f.key]]!.label}`,
      run: () => this.openFilterChoices(f.key),
    }));
    if (this.query.trim()) items.push({ label: `検索語を消す（${this.query.trim()}）`, run: () => this.setSearch("") });
    items.push({ label: "絞り込みをすべて解除", run: () => this.clearFilters() }, { label: "閉じる", run: () => {} });
    this.openMenu("絞り込み", items);
  }

  private chipKeys(): readonly DeckChipKey[] {
    return this.geometry.chipKeys ?? DEFAULT_CHIPS;
  }

  private pressChip(key: DeckChipKey | undefined): void {
    if (!key) return;
    if (key === "view") {
      this.showDeck = !this.showDeck;
      this.resetList();
    } else if (key === "filters") this.openFiltersMenu();
    else if (key === "clear") this.clearFilters();
    else this.openFilterChoices(key);
  }

  private perPage(): number {
    return this.geometry.cols * this.geometry.rows;
  }

  private clampIndex(): void {
    const count = this.list().length;
    this.index = Math.min(this.index, Math.max(0, count - 1));
    this.page = Math.floor(this.index / this.perPage());
  }

  private moveCursor(delta: number): void {
    const count = this.list().length;
    if (count === 0) return;
    this.index = Math.min(count - 1, Math.max(0, this.index + delta));
    this.page = Math.floor(this.index / this.perPage());
  }

  private focusedCard(): CardDefinition | undefined {
    return this.list()[this.index];
  }

  private resetList(): void {
    this.listCache = null;
    this.index = 0;
    this.page = 0;
  }

  // ------------------------------------------------------------ menus

  private openMenu(title: string, items: MenuItem[]): void {
    const cursor = new ListCursor();
    cursor.reset(items.length, MENU_ROWS);
    this.menu = { title, items, cursor };
  }

  private openStartMenu(): void {
    const starters = Object.values(this.engine.starterDecks).sort((a, b) => a.name.localeCompare(b.name, "ja"));
    const items: MenuItem[] = [
      ...this.saved().map((deck) => ({
        label: `編集: ${deck.name}`,
        run: () => this.load(deck.entries, deck.name, deck.id),
      })),
      { label: "空のデッキから作る", run: () => this.load([], this.nextName("自作デッキ"), null) },
      ...starters.map((deck) => ({
        label: `元にする: ${deck.name}`,
        run: () => this.load(deck.entries, this.nextName(`${deck.name}改`), null),
      })),
      { label: "やめる（タイトルへ）", run: () => (this.result = { kind: "closed" }) },
    ];
    this.openMenu("デッキ構築: 始め方を選ぶ", items);
  }

  private nextName(base: string, except: string | null = null): string {
    const names = new Set(this.saved().filter((d) => d.id !== except).map((d) => d.name));
    if (!names.has(base)) return base;
    for (let n = 2; ; n++) if (!names.has(`${base}${n}`)) return `${base}${n}`;
  }

  private openMainMenu(): void {
    const items: MenuItem[] = [
      { label: "続ける", run: () => {} },
      {
        label: this.validation.ok ? "保存して戻る" : `保存して戻る（${this.validation.total}枚・対戦には40枚以上）`,
        run: () => this.save(),
      },
      { label: this.dirty ? "保存せずに戻る（変更を捨てる）" : "戻る", run: () => (this.result = { kind: "closed" }) },
      { label: "絞り込み", run: () => this.openFiltersMenu() },
      { label: "別のデッキを開く", run: () => this.openStartMenu() },
    ];
    if (this.deckId) {
      const id = this.deckId;
      items.push({ label: "このデッキを削除", run: () => (this.result = { kind: "deleted", id }) });
    }
    this.openMenu(`${this.deckName.trim() || "名前なし"}（${this.validation.total}枚）`, items);
  }

  private save(): void {
    const name = this.deckName.trim() || this.nextName("自作デッキ", this.deckId);
    const deck: CustomDeck = {
      id: this.deckId ?? `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
      name,
      entries: this.deckEntries(),
      updatedAt: Date.now(),
    };
    this.result = { kind: "saved", deck };
  }

  // ------------------------------------------------------------ input

  dispatch(event: LogicalInput): void {
    const menu = this.menu;
    if (menu) {
      switch (event.type) {
        case "prev":
          menu.cursor.move(-1);
          return;
        case "next":
          menu.cursor.move(1);
          return;
        case "pagePrev":
          menu.cursor.page(-1);
          return;
        case "pageNext":
          menu.cursor.page(1);
          return;
        case "select": {
          const index = menu.cursor.rowToIndex(event.row);
          if (index < 0) return;
          menu.cursor.index = index;
          if (event.confirm) this.runMenu();
          return;
        }
        case "confirm":
          this.runMenu();
          return;
        case "cancel":
          // The start menu has no deck behind it to return to.
          if (this.loaded) this.menu = null;
          else this.result = { kind: "closed" };
          return;
        default:
          return;
      }
    }
    const cols = this.geometry.cols;
    switch (event.type) {
      case "prev":
        this.moveCursor(-cols);
        break;
      case "next":
        this.moveCursor(cols);
        break;
      case "pagePrev":
        this.moveCursor(-1);
        break;
      case "pageNext":
        this.moveCursor(1);
        break;
      case "confirm": {
        const card = this.focusedCard();
        if (card) this.add(card);
        break;
      }
      case "alt": {
        const card = this.focusedCard();
        if (card) this.remove(card);
        break;
      }
      case "toggleLog":
      case "tabPrev":
        this.showDeck = !this.showDeck;
        this.resetList();
        break;
      case "menu":
      case "tabNext":
        this.cycleFilter("category");
        break;
      case "allActions":
        this.cycleFilter("type");
        break;
      case "cancel":
        this.openMainMenu();
        break;
      case "focusTile": {
        const index = this.page * this.perPage() + event.row * cols + event.slot;
        if (index >= this.list().length) break;
        const again = index === this.index;
        this.index = index;
        const card = this.focusedCard();
        if (again && event.open && card) this.add(card);
        break;
      }
      case "selectTab":
        this.pressChip(this.chipKeys()[event.tab]);
        break;
      default:
        break;
    }
  }

  private chipView(key: DeckChipKey): { text: string; active: boolean } {
    switch (key) {
      case "view":
        return { text: this.showDeck ? "デッキ" : "カード一覧", active: this.showDeck };
      case "filters": {
        const n = this.activeFilters();
        return { text: n ? `絞り込み(${n})` : "絞り込み", active: n > 0 };
      }
      case "clear":
        return { text: "解除", active: false };
      default:
        return { text: this.filterChoice(key), active: this.filterIndex[key] > 0 };
    }
  }

  private runMenu(): void {
    const menu = this.menu;
    if (!menu) return;
    const item = menu.items[menu.cursor.index];
    this.menu = null;
    item?.run();
  }

  // ------------------------------------------------------------ view

  view(): DeckBuilderView {
    const g = this.geometry;
    let wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.detail.w - 14 };
    const list = this.list();
    const perPage = this.perPage();
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    const start = this.page * perPage;

    const tiles: DeckTileView[] = list.slice(start, start + perPage).map((card, i) => {
      const count = this.entries.get(card.id) ?? 0;
      const remaining = this.remaining(card);
      const max = this.deck.maxCopies(card);
      return {
        cardId: card.id,
        rect: {
          x: g.grid.x + (i % g.cols) * (g.tileW + g.gap),
          y: g.grid.y + Math.floor(i / g.cols) * (g.tileH + g.gap),
          w: g.tileW,
          h: g.tileH,
        },
        count,
        badge: count > 0 ? (Number.isFinite(max) ? `${count}/${max}` : `${count}`) : "",
        dimmed: count === 0 && remaining === 0,
        focused: start + i === this.index,
        name: fitLine(card.name, { fontPx: g.fontPx, maxWidthPx: g.tileW - 2 }),
      };
    });

    // Detail panel: the focused card.
    const detailLines: PanelLine[] = [];
    let detailArt: DeckBuilderView["detailArt"];
    let y = g.detail.y + 4;
    let textX = g.detail.x + 4;
    let textW = g.detail.w - 6;
    const bottom = g.detail.y + g.detail.h - 2;
    const push = (tone: PanelTone, texts: string[]) => {
      for (const text of texts) {
        if (y + g.lineHeight > bottom) return;
        detailLines.push({ text, tone, rect: { x: textX, y, w: textW, h: g.lineHeight } });
        y += g.lineHeight;
      }
    };
    const card = this.focusedCard();
    if (card) {
      const stats = [
        card.id,
        TYPE_LABELS[card.type] ?? card.type,
        card.powerCost !== undefined ? `P${card.powerCost}` : "",
        card.bp !== undefined ? `BP${card.bp}` : "",
        this.deck.categories(card).join("/"),
      ].filter(Boolean);
      if (this.cardArt && isWideDetail(g.detail)) {
        // Wide, short panel (phone portrait): every line beside the image.
        const artW = detailArtWidth(g.detail);
        const rect = { x: g.detail.x + 4, y, w: artW, h: Math.round(artW * CARD_ASPECT) };
        detailArt = { cardId: card.id, hidden: false, rect };
        textX = rect.x + rect.w + 6;
        textW = g.detail.x + g.detail.w - textX - 2;
        wrap = { ...wrap, maxWidthPx: textW };
        push("head", wrapText(card.name, { ...wrap, maxLines: 1 }));
        push("dim", wrapText(stats.join(" "), { ...wrap, maxLines: 1 }));
      } else if (this.cardArt) {
        const artW = Math.round(g.detail.w * 0.5);
        const rect = { x: g.detail.x + 4, y, w: artW, h: Math.round(artW * CARD_ASPECT) };
        detailArt = { cardId: card.id, hidden: false, rect };
        const sideX = rect.x + rect.w + 4;
        const sideW = g.detail.x + g.detail.w - sideX - 2;
        stats.slice(0, Math.floor(rect.h / g.lineHeight)).forEach((text, i) =>
          detailLines.push({
            text: fitLine(text, { fontPx: g.fontPx, maxWidthPx: sideW }),
            tone: i === 0 ? "dim" : "body",
            rect: { x: sideX, y: rect.y + i * g.lineHeight, w: sideW, h: g.lineHeight },
          }),
        );
        y = rect.y + rect.h + 3;
        push("head", wrapText(card.name, { ...wrap, maxLines: 2 }));
      } else {
        push("head", wrapText(card.name, { ...wrap, maxLines: 2 }));
        push("dim", wrapText(stats.join(" "), { ...wrap, maxLines: 2 }));
      }
      const count = this.entries.get(card.id) ?? 0;
      const remaining = this.remaining(card);
      push("accent", wrapText(`デッキに${count}枚${Number.isFinite(remaining) ? ` あと${remaining}枚` : ""}`, { ...wrap, maxLines: 2 }));
      push("body", wrapText(effectParagraphs(card.text ?? ""), wrap));
    }

    let menu: GuiBox | undefined;
    if (this.menu) {
      const m = this.menu;
      const w = Math.min(g.width - 40, 300);
      const rowsShown = Math.min(m.items.length, m.cursor.rows);
      const h = (rowsShown + 1) * g.lineHeight + 6;
      const x = Math.round((g.width - w) / 2);
      const top = Math.max(g.topBar.h + 2, Math.round((g.height - h) / 2));
      const rowWrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: w - 8 };
      const rows: MenuRowView[] = [];
      for (let r = 0; r < m.cursor.rows; r++) {
        const index = m.cursor.rowToIndex(r);
        if (index < 0) break;
        rows.push({
          text: fitLine(m.items[index]!.label, rowWrap),
          selected: index === m.cursor.index,
          rect: { x: x + 4, y: top + 3 + (r + 1) * g.lineHeight, w: w - 8, h: g.lineHeight },
        });
      }
      menu = {
        rect: { x, y: top, w, h },
        title: fitLine(`${m.title}${m.items.length > rowsShown ? ` ${m.cursor.index + 1}/${m.items.length}` : ""}`, rowWrap),
        titleRect: { x: x + 4, y: top + 3, w: w - 8, h: g.lineHeight },
        rows,
      };
    }

    const v = this.validation;
    const status = v.ok ? "対戦可" : v.total < 40 ? `あと${40 - v.total}枚` : "枚数制限エラー";
    return {
      geometry: g,
      // With a name field the name is not repeated in the bar.
      topBar: fitLine(`${v.total}枚 ${status}${this.dirty ? "（未保存）" : ""}${g.nameField ? "" : ` ${this.deckName || "デッキ構築"}`}`, {
        fontPx: g.fontPx,
        maxWidthPx: g.width * 0.55,
      }),
      valid: v.ok,
      toast: this.toastFrames > 0 ? fitLine(this.toastText, { fontPx: g.fontPx, maxWidthPx: g.width * 0.44 }) : "",
      chips: g.chips.map((rect, i) => {
        const key = this.chipKeys()[i] ?? "filters";
        const chip = this.chipView(key);
        // Button names only on the default (console) chips.
        const button = g.chipKeys ? undefined : CHIP_BUTTONS[key];
        return {
          key,
          active: chip.active,
          text: fitLine(button ? `${chip.text} (${button})` : chip.text, { fontPx: g.fontPx, maxWidthPx: rect.w - 6 }),
          rect,
        };
      }),
      textFields: this.menu
        ? []
        : [
            g.nameField && { id: "name" as const, rect: g.nameField, text: this.deckName, placeholder: "デッキ名", maxLength: DECK_NAME_MAX },
            g.search && { id: "search" as const, rect: g.search, text: this.query, placeholder: "カード名・効果・特徴・番号で検索", maxLength: 60 },
          ].filter((f): f is DeckTextField => !!f),
      tiles,
      pageText: list.length ? `${this.index + 1}/${list.length} ${this.page + 1}/${pages}頁` : "",
      emptyText: list.length
        ? ""
        : this.showDeck && this.validation.total === 0
          ? "デッキにカードがありません（L で一覧へ）"
          : "条件に合うカードがありません",
      detailArt,
      detailLines,
      menu,
      footer: this.menu
        ? "↑↓:選ぶ ○:決定 ×:閉じる"
        : "○:1枚入れる □:1枚抜く L:一覧/デッキ △:種類 R:カテゴリ ×:メニュー",
    };
  }
}
