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
  | { type: "selectTab"; tab: number };

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
