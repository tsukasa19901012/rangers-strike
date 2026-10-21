// Logical input. Shells translate their raw input (Vita buttons, touch,
// mouse, keyboard) into these; the controller never sees device events.

export type LogicalInput =
  | { type: "prev" }
  | { type: "next" }
  | { type: "pagePrev" }
  | { type: "pageNext" }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "tabPrev" }
  | { type: "tabNext" }
  /** Direct pick of a visible row (touch/click). `confirm` applies it at once. */
  | { type: "select"; row: number; confirm?: boolean }
  | { type: "selectTab"; tab: number }
  /** GUI: open the menu of actions that name no card on the board (phase end, pass, hidden-zone picks). */
  | { type: "menu" }
  /** GUI: open the menu of every legal action (always reaches everything the engine allows). */
  | { type: "allActions" }
  /** GUI: switch the side panel between card detail and the log. */
  | { type: "toggleLog" }
  /** Secondary button (□): deck builder removes a copy. */
  | { type: "alt" }
  /** GUI: direct pick of a visible tile (touch). `open` also opens its action menu. */
  | { type: "focusTile"; row: number; slot: number; open?: boolean }
  /** GUI: open the action menu of cards outside the board rows (power zone, 常駐), anchored at their pile. */
  | { type: "openCards"; instanceIds: string[]; title: string; anchor: { x: number; y: number; w: number; h: number } }
  /** GUI (touch): show the next / previous page of a window's cards or rows (a swipe, or a tap on its ▲▼ mark). */
  | { type: "scroll"; area: "cards" | "rows"; direction: 1 | -1 };

export const input = {
  prev: { type: "prev" } as LogicalInput,
  next: { type: "next" } as LogicalInput,
  pagePrev: { type: "pagePrev" } as LogicalInput,
  pageNext: { type: "pageNext" } as LogicalInput,
  confirm: { type: "confirm" } as LogicalInput,
  cancel: { type: "cancel" } as LogicalInput,
  tabPrev: { type: "tabPrev" } as LogicalInput,
  tabNext: { type: "tabNext" } as LogicalInput,
  select: (row: number, confirm = false): LogicalInput => ({ type: "select", row, confirm }),
  selectTab: (tab: number): LogicalInput => ({ type: "selectTab", tab }),
  menu: { type: "menu" } as LogicalInput,
  allActions: { type: "allActions" } as LogicalInput,
  toggleLog: { type: "toggleLog" } as LogicalInput,
  alt: { type: "alt" } as LogicalInput,
  focusTile: (row: number, slot: number, open = false): LogicalInput => ({ type: "focusTile", row, slot, open }),
  scroll: (area: "cards" | "rows", direction: 1 | -1): LogicalInput => ({ type: "scroll", area, direction }),
  openCards: (instanceIds: string[], title: string, anchor: { x: number; y: number; w: number; h: number }): LogicalInput => ({
    type: "openCards",
    instanceIds,
    title,
    anchor,
  }),
};

/** A scrolling cursor over `count` items with a visible window of `rows`. */
export class ListCursor {
  index = 0;
  offset = 0;
  constructor(public count = 0, public rows = 8) {}

  reset(count: number, rows = this.rows): void {
    this.count = count;
    this.rows = Math.max(1, rows);
    this.index = 0;
    this.offset = 0;
  }

  resize(count: number, rows: number): void {
    this.count = count;
    this.rows = Math.max(1, rows);
    this.index = Math.min(this.index, Math.max(0, count - 1));
    this.clampOffset();
  }

  move(delta: number): void {
    if (this.count === 0) return;
    this.index = (((this.index + delta) % this.count) + this.count) % this.count;
    this.clampOffset();
  }

  page(direction: 1 | -1): void {
    if (this.count === 0) return;
    this.index = Math.min(this.count - 1, Math.max(0, this.index + direction * this.rows));
    this.clampOffset();
  }

  /** Visible row -> absolute index (or -1). */
  rowToIndex(row: number): number {
    const index = this.offset + row;
    return row >= 0 && row < this.rows && index < this.count ? index : -1;
  }

  private clampOffset(): void {
    if (this.index < this.offset) this.offset = this.index;
    if (this.index >= this.offset + this.rows) this.offset = this.index - this.rows + 1;
    this.offset = Math.max(0, Math.min(this.offset, Math.max(0, this.count - this.rows)));
  }
}
