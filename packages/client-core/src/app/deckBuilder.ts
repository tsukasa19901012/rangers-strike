// Deck builder over the full card pool, as a graphical screen like GuiMatch:
// a filterable grid of cards, the focused card's image and text on the left,
// and a menu for starting points, saving and leaving. Deck rules (40 cards,
// copies per same name) come from the engine's DeckApi; the core only counts.
//
// Controls (Vita): D-pad moves over the grid (pages flip at the edges),
// ○ adds one copy, □ removes one, L switches catalog / deck, R cycles the
// category filter, △ the type filter, × opens the menu.
import type { CardDefinition, DeckApi, DeckEntry, EngineApi } from "../engineApi";
import { ListCursor, type LogicalInput } from "../input/actions";
import type { CustomDeck } from "../platform/settings";
import { fitLine, wrapText, type WrapOptions } from "../text/wrap";
import { detailArtWidth, isWideDetail } from "../view/gui";
import type { Rect, Viewport } from "../view/layout";
import { TYPE_LABELS, type GuiBox, type MenuRowView, type PanelLine, type PanelTone } from "./guiMatch";

const FONT_PX = 12;
const LINE_H = 15;
const CARD_ASPECT = 190 / 130;
const TOAST_FRAMES = 120;
const MENU_ROWS = 12;

const TYPE_FILTERS = [
  { id: "all", label: "全種類" },
  { id: "unit", label: "ユニット" },
  { id: "operation", label: "オペレーション" },
  { id: "vehicle", label: "ビークル" },
] as const;
const CATEGORY_FILTERS = ["all", "ET", "WB", "OT", "MA", "DA"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  all: "全カテゴリ",
  ET: "ET アーステクノロジー",
  WB: "WB ワイルドビースト",
  OT: "OT オーバーテクノロジー",
  MA: "MA ミスティックアームズ",
  DA: "DA ダークアライアンス",
};

export type DeckGeometry = {
  width: number;
  height: number;
  fontPx: number;
  lineHeight: number;
  topBar: Rect;
  footer: Rect;
  detail: Rect;
  chips: Rect[];
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
  chips: { text: string; rect: Rect; active: boolean }[];
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
  private dirty = false;
  private showDeck = false;
  private typeFilter = 0;
  private categoryFilter = 0;
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
    const type = TYPE_FILTERS[this.typeFilter]!.id;
    const category = CATEGORY_FILTERS[this.categoryFilter]!;
    const key = `${this.showDeck}|${type}|${category}`;
    if (this.listCache?.key === key) return this.listCache.cards;
    const source = this.showDeck
      ? this.deckEntries().map((e) => this.byId.get(e.cardId)).filter((c): c is CardDefinition => !!c)
      : this.deck.cards;
    const cards = source.filter(
      (card) => (type === "all" || card.type === type) && (category === "all" || this.deck.categories(card).includes(category)),
    );
    this.listCache = { key, cards };
    return cards;
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

  private nextName(base: string): string {
    const names = new Set(this.saved().map((d) => d.name));
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
      { label: "別のデッキを開く", run: () => this.openStartMenu() },
    ];
    if (this.deckId) {
      const id = this.deckId;
      items.push({ label: "このデッキを削除", run: () => (this.result = { kind: "deleted", id }) });
    }
    this.openMenu(`${this.deckName}（${this.validation.total}枚）`, items);
  }

  private save(): void {
    const deck: CustomDeck = {
      id: this.deckId ?? `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
      name: this.deckName,
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
          if (this.deckName) this.menu = null;
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
        this.categoryFilter = (this.categoryFilter + 1) % CATEGORY_FILTERS.length;
        this.resetList();
        break;
      case "allActions":
        this.typeFilter = (this.typeFilter + 1) % TYPE_FILTERS.length;
        this.resetList();
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
        if (event.tab === 0) this.showDeck = !this.showDeck;
        else if (event.tab === 1) this.typeFilter = (this.typeFilter + 1) % TYPE_FILTERS.length;
        else this.categoryFilter = (this.categoryFilter + 1) % CATEGORY_FILTERS.length;
        this.resetList();
        break;
      default:
        break;
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
      push("body", wrapText(card.text ?? "", wrap));
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
      topBar: fitLine(`${v.total}枚 ${status}${this.dirty ? "（未保存）" : ""} ${this.deckName || "デッキ構築"}`, {
        fontPx: g.fontPx,
        maxWidthPx: g.width * 0.55,
      }),
      valid: v.ok,
      toast: this.toastFrames > 0 ? fitLine(this.toastText, { fontPx: g.fontPx, maxWidthPx: g.width * 0.44 }) : "",
      chips: [
        { text: this.showDeck ? "デッキ (L)" : "カード一覧 (L)", active: this.showDeck },
        { text: `${TYPE_FILTERS[this.typeFilter]!.label} (△)`, active: this.typeFilter > 0 },
        { text: `${CATEGORY_LABELS[CATEGORY_FILTERS[this.categoryFilter]!]} (R)`, active: this.categoryFilter > 0 },
      ].map((chip, i) => ({
        ...chip,
        text: fitLine(chip.text, { fontPx: g.fontPx, maxWidthPx: g.chips[i]!.w - 6 }),
        rect: g.chips[i]!,
      })),
      tiles,
      pageText: list.length ? `${this.index + 1}/${list.length} ${this.page + 1}/${pages}頁` : "",
      emptyText: list.length ? "" : this.showDeck ? "デッキにカードがありません（L で一覧へ）" : "条件に合うカードがありません",
      detailArt,
      detailLines,
      menu,
      footer: this.menu
        ? "↑↓:選ぶ ○:決定 ×:閉じる"
        : "○:1枚入れる □:1枚抜く L:一覧/デッキ △:種類 R:カテゴリ ×:メニュー",
    };
  }
}
