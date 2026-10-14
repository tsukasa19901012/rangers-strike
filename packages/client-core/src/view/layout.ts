// Screen-size/orientation adaptive layout in logical pixels. Renderers place
// panes at the returned rectangles; line counts and wrap widths derive from the
// same numbers so text never overflows a pane.

export type Viewport = { width: number; height: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Font sizes every renderer must support (PocketJS font slots 12/14/16). */
export const FONT_SIZES = [12, 14, 16] as const;
export type FontPx = (typeof FONT_SIZES)[number];

export type Layout = {
  orientation: "landscape" | "portrait";
  fontPx: FontPx;
  lineHeight: number;
  padding: number;
  header: Rect;
  footer: Rect;
  /** Board / log / detail tab pane. */
  info: Rect;
  /** Prompt + action list. */
  side: Rect;
  infoLines: number;
  sideLines: number;
  /** Usable text width inside a pane (px). */
  infoTextWidth: number;
  sideTextWidth: number;
};

export function chooseFontPx(viewport: Viewport): FontPx {
  const short = Math.min(viewport.width, viewport.height);
  if (short >= 600) return 16;
  if (short >= 360) return 14;
  return 12;
}

export function computeLayout(viewport: Viewport, fontOverride?: FontPx): Layout {
  const width = Math.max(240, Math.floor(viewport.width));
  const height = Math.max(160, Math.floor(viewport.height));
  const fontPx = fontOverride ?? chooseFontPx({ width, height });
  const lineHeight = Math.round(fontPx * 1.25);
  const padding = fontPx >= 16 ? 6 : 3;
  const orientation = width >= height ? "landscape" : "portrait";
  const header: Rect = { x: 0, y: 0, w: width, h: lineHeight + padding };
  const footer: Rect = { x: 0, y: height - (lineHeight + padding), w: width, h: lineHeight + padding };
  const bodyY = header.h;
  const bodyH = height - header.h - footer.h;
  let info: Rect;
  let side: Rect;
  if (orientation === "landscape") {
    const infoW = Math.round(width * 0.5);
    info = { x: 0, y: bodyY, w: infoW, h: bodyH };
    side = { x: infoW, y: bodyY, w: width - infoW, h: bodyH };
  } else {
    const infoH = Math.round(bodyH * 0.5);
    info = { x: 0, y: bodyY, w: width, h: infoH };
    side = { x: 0, y: bodyY + infoH, w: width, h: bodyH - infoH };
  }
  const lines = (r: Rect) => Math.max(1, Math.floor((r.h - padding * 2) / lineHeight));
  return {
    orientation,
    fontPx,
    lineHeight,
    padding,
    header,
    footer,
    info,
    side,
    infoLines: lines(info),
    sideLines: lines(side),
    infoTextWidth: info.w - padding * 2,
    sideTextWidth: side.w - padding * 2,
  };
}
