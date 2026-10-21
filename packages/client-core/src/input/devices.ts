// Device-to-logical adapters that only need numbers: a held-button repeater
// (D-pad / keyboard) and a tap recognizer plus hit test (touch / mouse).
import type { LogicalInput } from "./actions";
import type { ScreenView } from "../app/controller";
import type { GuiView } from "../app/guiMatch";
import type { DeckBuilderView } from "../app/deckBuilder";

export type ButtonBinding = { mask: number; input: LogicalInput; repeat?: boolean };

/** Turns a per-frame held-button bitmask into logical inputs with auto-repeat. */
export class ButtonRepeater {
  private prev = 0;
  private heldFrames = new Map<number, number>();
  constructor(
    private readonly bindings: readonly ButtonBinding[],
    private readonly delayFrames = 18,
    private readonly intervalFrames = 5,
  ) {}

  frame(buttons: number): LogicalInput[] {
    const out: LogicalInput[] = [];
    for (const binding of this.bindings) {
      const down = (buttons & binding.mask) !== 0;
      const wasDown = (this.prev & binding.mask) !== 0;
      if (!down) {
        this.heldFrames.delete(binding.mask);
        continue;
      }
      if (!wasDown) {
        out.push(binding.input);
        this.heldFrames.set(binding.mask, 0);
        continue;
      }
      if (!binding.repeat) continue;
      const held = (this.heldFrames.get(binding.mask) ?? 0) + 1;
      this.heldFrames.set(binding.mask, held);
      if (held >= this.delayFrames && (held - this.delayFrames) % this.intervalFrames === 0) out.push(binding.input);
    }
    this.prev = buttons;
    return out;
  }
}

export type Point = { x: number; y: number };

/** Recognizes a tap (down and up within `slop` px) from per-frame contacts. */
export class TapRecognizer {
  private start: Point | null = null;
  private last: Point | null = null;
  private moved = false;
  constructor(private readonly slop = 10) {}

  /** Pass the first contact of this frame (or null). Returns the tap point on release. */
  frame(contact: Point | null): Point | null {
    if (contact) {
      if (!this.start) {
        this.start = { x: contact.x, y: contact.y };
        this.moved = false;
      } else if (Math.abs(contact.x - this.start.x) > this.slop || Math.abs(contact.y - this.start.y) > this.slop) {
        this.moved = true;
      }
      this.last = { x: contact.x, y: contact.y };
      return null;
    }
    const tap = this.start && !this.moved ? this.last : null;
    this.start = null;
    this.last = null;
    return tap;
  }
}

/**
 * Maps a point (logical px) to a logical input using the same geometry the
 * renderers use: info pane line 0 is the tab bar, the side pane shows the
 * prompt lines, one caption line, then the action rows.
 */
export function hitTest(view: ScreenView, point: Point): LogicalInput | null {
  const { layout } = view;
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h;
  if (inside(layout.info)) {
    const line = Math.floor((point.y - layout.info.y - layout.padding) / layout.lineHeight);
    if (line <= 0 && view.tabs.length > 0) {
      const tab = Math.floor(((point.x - layout.info.x) / layout.info.w) * view.tabs.length);
      return { type: "selectTab", tab: Math.min(view.tabs.length - 1, Math.max(0, tab)) };
    }
    return { type: "tabNext" };
  }
  if (inside(layout.side)) {
    const line = Math.floor((point.y - layout.side.y - layout.padding) / layout.lineHeight);
    const row = line - view.promptLines.length - 1;
    if (row >= 0 && row < view.rows.length) return { type: "select", row, confirm: true };
    return null;
  }
  return null;
}

/**
 * Touch for the graphical match screen, using the rectangles in GuiView (what
 * the renderer drew). Overlays take precedence: list / popup rows pick and
 * apply, a tap outside a popup closes it; selection-window cards and buttons
 * share one index (cards first); board tiles focus and open their popup.
 */
export function hitTestGui(view: GuiView, point: Point): LogicalInput | null {
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h;
  const box = view.list ?? view.popup;
  if (box) {
    for (let r = 0; r < box.rows.length; r++) if (inside(box.rows[r]!.rect)) return { type: "select", row: r, confirm: true };
    if (view.popup && !view.list) {
      for (let row = 0; row < view.rows.length; row++) {
        const tiles = view.rows[row]!.tiles;
        // Last first: a riding unit is drawn over its vehicle.
        for (let slot = tiles.length - 1; slot >= 0; slot--) if (inside(tiles[slot]!.rect)) return { type: "focusTile", row, slot, open: true };
      }
    }
    return inside(box.rect) ? null : { type: "cancel" };
  }
  if (view.dialog) {
    const d = view.dialog;
    for (let i = 0; i < d.cards.length; i++) if (inside(d.cards[i]!.rect)) return { type: "select", row: d.moreLeft + i, confirm: true };
    const cardCount = d.moreLeft + d.cards.length + d.moreRight;
    for (let i = 0; i < d.buttons.length; i++) {
      if (inside(d.buttons[i]!.rect)) return { type: "select", row: cardCount + d.buttonOffset + i, confirm: true };
    }
    if (!inside(d.rect)) return { type: "toggleLog" };
    return null;
  }
  for (let row = 0; row < view.rows.length; row++) {
    const tiles = view.rows[row]!.tiles;
    for (let slot = tiles.length - 1; slot >= 0; slot--) {
      if (inside(tiles[slot]!.rect)) return { type: "focusTile", row, slot, open: true };
    }
  }
  if (inside(view.endButton.rect)) return { type: "menu" };
  if (inside(view.geometry.topBar) || inside(view.geometry.detail)) return { type: "toggleLog" };
  return null;
}

/** Touch on the deck builder: menu rows, the filter chips, and grid tiles (tap a focused tile to add a copy). */
export function hitTestDeck(view: DeckBuilderView, point: Point): LogicalInput | null {
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h;
  if (view.menu) {
    const row = view.menu.rows.findIndex((r) => inside(r.rect));
    if (row >= 0) return { type: "select", row, confirm: true };
    return inside(view.menu.rect) ? null : { type: "cancel" };
  }
  const chip = view.chips.findIndex((c) => inside(c.rect));
  if (chip >= 0) return { type: "selectTab", tab: chip };
  const tile = view.tiles.findIndex((t) => inside(t.rect));
  if (tile >= 0) {
    const cols = view.geometry.cols;
    return { type: "focusTile", row: Math.floor(tile / cols), slot: tile % cols, open: true };
  }
  if (inside(view.geometry.topBar)) return { type: "cancel" };
  return null;
}
