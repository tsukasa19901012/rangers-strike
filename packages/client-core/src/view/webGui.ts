// Geometry for pointer-first, large-screen shells (the PocketJS web app):
// the same GuiGeometry / DeckGeometry the match and deck builder already use,
// laid out like a desktop card game instead of the 480x272 Vita screen.
//
//   [top bar: turn, phases                                        ]
//   [card detail | CPU rush / battle                  | phase list ]
//   [ (art+text) | ---- strips ----                   | end button ]
//   [            | own battle / rush / command / hand |            ]
//   [footer hints                                                 ]
//
// Tiles keep the printed card's 130:190 aspect so the whole card image fits.
import type { DeckGeometry } from "../app/deckBuilder";
import { GUI_ROWS, PHASE_ORDER, type GuiGeometry } from "./gui";
import type { Rect, Viewport } from "./layout";
import { HUMAN } from "../engineApi";

export const WEB_FONT_PX = 14;
export const WEB_LINE_H = 24;
const CARD_ASPECT = 190 / 130;
const TOP_H = 44;
const FOOTER_H = 26;
const STRIP_H = 26;
const ROW_GAP = 6;
const TILE_GAP = 6;

/** The smallest logical screen the web layouts are designed for; shells scale below it. */
export const WEB_MIN_VIEWPORT: Viewport = { width: 1024, height: 640 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Width of the pile column at the right end of the board rows (web match screen). */
export function webPileWidth(tileW: number): number {
  return clamp(tileW * 2 + 18, 120, 170);
}

export function computeWebGuiGeometry(viewport: Viewport): GuiGeometry {
  const width = Math.max(WEB_MIN_VIEWPORT.width, Math.floor(viewport.width));
  const height = Math.max(WEB_MIN_VIEWPORT.height, Math.floor(viewport.height));
  const detailW = clamp(Math.round(width * 0.22), 250, 380);
  const sideW = clamp(Math.round(width * 0.11), 132, 180);
  const topBar: Rect = { x: 0, y: 0, w: width, h: TOP_H };
  const footer: Rect = { x: 0, y: height - FOOTER_H, w: width, h: FOOTER_H };
  const body = { y: TOP_H + 8, h: footer.y - TOP_H - 16 };
  const detail: Rect = { x: 8, y: body.y, w: detailW, h: body.h };
  const side: Rect = { x: width - sideW - 8, y: body.y, w: sideW, h: body.h };
  const board: Rect = { x: detail.x + detail.w + 10, y: body.y, w: side.x - 10 - (detail.x + detail.w + 10), h: body.h };

  // Six card rows and two player strips share the board height.
  const rowCount = GUI_ROWS.length;
  const tileH = Math.floor((board.h - STRIP_H * 2 - 12 - ROW_GAP * (rowCount - 1)) / rowCount);
  const tileW = Math.floor(tileH / CARD_ASPECT);
  const rows: Rect[] = [];
  let y = board.y;
  const cpuStrip: Rect = { x: board.x, y, w: board.w, h: STRIP_H };
  y += STRIP_H + 4;
  let humanStrip = cpuStrip;
  for (const def of GUI_ROWS) {
    if (def.player === HUMAN && def.zone === "battle") {
      y += 4;
      humanStrip = { x: board.x, y, w: board.w, h: STRIP_H };
      y += STRIP_H + 4;
    }
    rows.push({ x: board.x, y, w: board.w, h: tileH });
    y += tileH + ROW_GAP;
  }
  // Rows keep a label column on the left and the piles (deck, discard,
  // power...) on the right; tiles go between.
  const labelW = 64;
  const pileW = webPileWidth(tileW);
  rows.forEach((row) => {
    row.x += labelW;
    row.w -= labelW + pileW + 10;
  });
  const rowW = rows[0]!.w;
  const tilesPerRow = Math.max(3, Math.floor((rowW + TILE_GAP) / (tileW + TILE_GAP)));

  const phaseH = 30;
  const phaseRects = PHASE_ORDER.map((_, i) => ({ x: side.x, y: side.y + 30 + i * (phaseH + 6), w: side.w, h: phaseH }));
  const endTop = phaseRects[phaseRects.length - 1]!.y + phaseH + 20;
  const endButton: Rect = { x: side.x, y: endTop, w: side.w, h: 96 };
  return {
    width,
    height,
    fontPx: WEB_FONT_PX,
    lineHeight: WEB_LINE_H,
    topBar,
    footer,
    detail,
    board,
    side,
    strips: [cpuStrip, humanStrip],
    rows,
    tileW,
    tileH,
    tileGap: TILE_GAP,
    tilesPerRow,
    phaseRects,
    endButton,
    detailLines: Math.max(4, Math.floor((detail.h - 12) / WEB_LINE_H)),
    detailTextWidth: detail.w - 24,
  };
}

export function computeWebDeckGeometry(viewport: Viewport): DeckGeometry {
  const width = Math.max(WEB_MIN_VIEWPORT.width, Math.floor(viewport.width));
  const height = Math.max(WEB_MIN_VIEWPORT.height, Math.floor(viewport.height));
  const topBar: Rect = { x: 0, y: 0, w: width, h: TOP_H };
  const footer: Rect = { x: 0, y: height - FOOTER_H, w: width, h: FOOTER_H };
  const detailW = clamp(Math.round(width * 0.24), 260, 400);
  const detail: Rect = { x: 8, y: TOP_H + 8, w: detailW, h: footer.y - TOP_H - 16 };
  const left = detail.x + detail.w + 12;
  const right = width - 8;
  const chipW = Math.min(240, Math.floor((right - left - 2 * 8) / 3));
  const chips = [0, 1, 2].map((i) => ({ x: left + i * (chipW + 8), y: TOP_H + 8, w: chipW, h: 32 }));
  const gridTop = TOP_H + 8 + 32 + 10;
  const pagerH = 36;
  const grid: Rect = { x: left, y: gridTop, w: right - left, h: footer.y - gridTop - pagerH - 8 };
  const gap = 8;
  // Rows of about 170 px fill the height; as many columns as fit the width.
  const rows = Math.max(2, Math.round(grid.h / 170));
  const tileH = Math.floor((grid.h + gap) / rows) - gap;
  const tileW = Math.floor(tileH / CARD_ASPECT);
  const cols = Math.max(4, Math.floor((grid.w + gap) / (tileW + gap)));
  return { width, height, fontPx: WEB_FONT_PX, lineHeight: WEB_LINE_H, topBar, footer, detail, chips, grid, cols, rows, tileW, tileH, gap };
}
