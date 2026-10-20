// Device-to-logical adapters that only need numbers: a held-button repeater
// (D-pad / keyboard) and a tap recognizer plus hit test (touch / mouse).
import type { LogicalInput } from "./actions";
import type { ScreenView } from "../app/controller";
import type { GuiView } from "../app/guiMatch";

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
 * Touch for the graphical match screen: a tile focuses it and opens its menu,
 * a menu row picks and applies it, the top bar toggles the log panel.
 * Uses the rectangles in GuiView, i.e. exactly what the renderer drew.
 */
export function hitTestGui(view: GuiView, point: Point): LogicalInput | null {
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h;
  for (let r = 0; r < view.menuRows.length; r++) {
    if (inside(view.menuRows[r]!.rect)) return { type: "select", row: r, confirm: true };
  }
  for (let row = 0; row < view.rows.length; row++) {
    const tiles = view.rows[row]!.tiles;
    for (let slot = 0; slot < tiles.length; slot++) {
      if (inside(tiles[slot]!.rect)) return { type: "focusTile", row, slot, open: true };
    }
  }
  if (inside(view.geometry.topBar)) return { type: "toggleLog" };
  if (inside(view.geometry.footer)) return { type: "menu" };
  return null;
}
