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
// A portrait viewport (phones) stacks the same parts instead: phases on top,
// the board in the middle, the card detail and the buttons at the bottom.
//
// Tiles keep the printed card's 130:190 aspect so the whole card image fits.
import type { DeckChipKey, DeckGeometry } from "../app/deckBuilder";
import { PHASE_ORDER, type GuiGeometry, type GuiRowDef } from "./gui";
import type { Rect, Viewport } from "./layout";
import { CPU, HUMAN, type PlayerId } from "../engineApi";

export const WEB_FONT_PX = 14;
export const WEB_LINE_H = 24;
const CARD_ASPECT = 190 / 130;
const TOP_H = 44;
const FOOTER_H = 26;
const STRIP_H = 26;
const ROW_GAP = 6;
const TILE_GAP = 6;

/** The smallest landscape screen the web layouts are designed for; shells scale below it. */
export const WEB_MIN_VIEWPORT: Viewport = { width: 1024, height: 640 };
/** The smallest portrait (phone) screen. */
export const WEB_MIN_PORTRAIT: Viewport = { width: 400, height: 640 };

/** Board rows of the web match screen: both players' command zones are open cards. */
export const WEB_GUI_ROWS: readonly GuiRowDef[] = [
  { player: CPU, zone: "command" },
  { player: CPU, zone: "rush" },
  { player: CPU, zone: "battle" },
  { player: HUMAN, zone: "battle" },
  { player: HUMAN, zone: "rush" },
  { player: HUMAN, zone: "command" },
  { player: HUMAN, zone: "hand" },
];

/** Phones held upright get the stacked layout. */
export function isPortrait(viewport: { width: number; height: number }): boolean {
  return viewport.width < viewport.height;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Width of the pile column at the right end of the board rows (web match screen). */
export function webPileWidth(tileW: number): number {
  return clamp(tileW * 2 + 18, 120, 170);
}

/** Pile column (deck, discard, power) at the right end of a player's rows. */
export function webPileRect(g: GuiGeometry, player: PlayerId): Rect {
  const defs = g.rowDefs ?? WEB_GUI_ROWS;
  // A phone's hand row takes the whole width, under the pile column.
  const portrait = isPortrait(g);
  const rows = g.rows.filter((_, i) => defs[i]?.player === player && !(portrait && defs[i]?.zone === "hand"));
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const gap = isPortrait(g) ? 6 : 10;
  const x = first.x + first.w + gap;
  return { x, y: first.y - 3, w: g.board.x + g.board.w - x, h: last.y + last.h - first.y + 6 };
}

/** Height the card rows of a board `height` high share (the two strips and the gaps taken out). */
function rowsHeight(height: number, stripH: number, rowGap: number): number {
  return height - stripH * 2 - 12 - rowGap * (WEB_GUI_ROWS.length - 1);
}

/**
 * Rows and strips stacked from `top`, the tile size filling `height`.
 * `handH`: the hand row's own height (a phone's larger hand); the other rows share the rest.
 */
function stackRows(board: Rect, top: number, height: number, stripH: number, rowGap: number, handH?: number) {
  const rowCount = WEB_GUI_ROWS.length;
  const shared = rowsHeight(height, stripH, rowGap);
  const tileH = handH === undefined ? Math.floor(shared / rowCount) : Math.floor((shared - handH) / (rowCount - 1));
  const rows: Rect[] = [];
  let y = top;
  const cpuStrip: Rect = { x: board.x, y, w: board.w, h: stripH };
  y += stripH + 4;
  let humanStrip = cpuStrip;
  for (const def of WEB_GUI_ROWS) {
    if (def.player === HUMAN && def.zone === "battle") {
      y += 4;
      humanStrip = { x: board.x, y, w: board.w, h: stripH };
      y += stripH + 4;
    }
    const h = def.zone === "hand" && handH !== undefined ? handH : tileH;
    rows.push({ x: board.x, y, w: board.w, h });
    y += h + rowGap;
  }
  return { rows, tileH, strips: [cpuStrip, humanStrip] as [Rect, Rect] };
}

export function computeWebGuiGeometry(viewport: Viewport): GuiGeometry {
  if (isPortrait(viewport)) return computePortraitGuiGeometry(viewport);
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

  // Seven card rows and two player strips share the board height.
  const { rows, tileH, strips } = stackRows(board, board.y, board.h, STRIP_H, ROW_GAP);
  const tileW = Math.floor(tileH / CARD_ASPECT);
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
    strips,
    rows,
    rowDefs: WEB_GUI_ROWS,
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

//   [top bar: turn                    leave]
//   [phase pills                           ]
//   [CPU command / rush / battle     |piles]
//   [own battle / rush / command     |piles]
//   [hand: larger cards, the whole width   ]
//   [every action | log | end phase        ]
//   [footer hints                          ]
// The card detail has no place of its own: the shell shows it over the
// board when a card is long-pressed, and the log (`detail`) over the board's
// lower half when the log button is on.
const PORTRAIT_TOP_H = 40;
const PORTRAIT_PHASE_H = 28;
const PORTRAIT_BUTTONS_H = 48;
const PORTRAIT_FOOTER_H = 24;
/** Hand cards that fit across a phone held upright (more are a swipe away). */
const PORTRAIT_HAND_CARDS = 5;
/** Board cards that fit across one row beside the pile column. */
const PORTRAIT_BOARD_CARDS = 5;

function computePortraitGuiGeometry(viewport: Viewport): GuiGeometry {
  const width = Math.max(WEB_MIN_PORTRAIT.width, Math.floor(viewport.width));
  const height = Math.max(WEB_MIN_PORTRAIT.height, Math.floor(viewport.height));
  const pad = 8;
  const topBar: Rect = { x: 0, y: 0, w: width, h: PORTRAIT_TOP_H };
  const footer: Rect = { x: 0, y: height - PORTRAIT_FOOTER_H, w: width, h: PORTRAIT_FOOTER_H };
  const buttonsY = footer.y - 6 - PORTRAIT_BUTTONS_H;
  const phaseY = PORTRAIT_TOP_H + 4;
  const phaseW = Math.floor((width - pad * 2 - 4 * 4) / PHASE_ORDER.length);
  const phaseRects = PHASE_ORDER.map((_, i) => ({ x: pad + i * (phaseW + 4), y: phaseY, w: phaseW, h: PORTRAIT_PHASE_H }));
  const boardY = phaseY + PORTRAIT_PHASE_H + 6;
  const board: Rect = { x: pad, y: boardY, w: width - pad * 2, h: buttonsY - 6 - boardY };
  const detailY = board.y + Math.round(board.h * 0.45);
  const detail: Rect = { x: pad, y: detailY, w: board.w, h: board.y + board.h - detailY };
  // No side column: popups may use the whole width.
  const side: Rect = { x: width - pad, y: board.y, w: 0, h: board.h };
  const endW = Math.round(board.w * 0.42);
  const endButton: Rect = { x: width - pad - endW, y: buttonsY, w: endW, h: PORTRAIT_BUTTONS_H };

  const gap = 4;
  const stripH = 22;
  // The hand: PORTRAIT_HAND_CARDS across the whole width, at most 30% of the rows' height.
  const handFit = Math.floor((board.w + gap) / PORTRAIT_HAND_CARDS) - gap;
  const handH = Math.min(Math.round(handFit * CARD_ASPECT), Math.round(rowsHeight(board.h, stripH, gap) * 0.3));
  const handW = Math.floor(handH / CARD_ASPECT);
  const stacked = stackRows(board, board.y, board.h, stripH, gap, handH);
  const { rows, strips } = stacked;
  // Board tiles stay small enough for PORTRAIT_BOARD_CARDS across (a tall phone leaves room under them).
  const fitW = (w: number) => Math.floor((w + gap) / PORTRAIT_BOARD_CARDS) - gap;
  const pileFor = (tileW: number) => clamp(tileW + 12, 56, 80);
  let tileW = Math.floor(stacked.tileH / CARD_ASPECT);
  while (tileW > fitW(board.w - pileFor(tileW) - 6)) tileW--;
  const tileH = Math.min(stacked.tileH, Math.round(tileW * CARD_ASPECT));
  const pileW = pileFor(tileW);
  rows.forEach((row, i) => {
    if (WEB_GUI_ROWS[i]!.zone !== "hand") row.w -= pileW + 6;
  });
  const tilesPerRow = Math.max(3, Math.floor((rows[0]!.w + gap) / (tileW + gap)));
  const rowTiles = WEB_GUI_ROWS.map((def) =>
    def.zone === "hand" ? { tileW: handW, tileH: handH, tilesPerRow: Math.max(3, Math.floor((board.w + gap) / (handW + gap))) } : undefined,
  );
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
    strips,
    rows,
    rowDefs: WEB_GUI_ROWS,
    tileW,
    tileH,
    tileGap: gap,
    tilesPerRow,
    rowTiles,
    phaseRects,
    endButton,
    detailLines: Math.max(3, Math.floor((detail.h - 8) / WEB_LINE_H)),
    detailTextWidth: detail.w - 16,
  };
}

export function computeWebDeckGeometry(viewport: Viewport): DeckGeometry {
  if (isPortrait(viewport)) return computePortraitDeckGeometry(viewport);
  const width = Math.max(WEB_MIN_VIEWPORT.width, Math.floor(viewport.width));
  const height = Math.max(WEB_MIN_VIEWPORT.height, Math.floor(viewport.height));
  const topBar: Rect = { x: 0, y: 0, w: width, h: TOP_H };
  const footer: Rect = { x: 0, y: height - FOOTER_H, w: width, h: FOOTER_H };
  const detailW = clamp(Math.round(width * 0.24), 260, 400);
  const detail: Rect = { x: 8, y: TOP_H + 8, w: detailW, h: footer.y - TOP_H - 16 };
  const left = detail.x + detail.w + 12;
  const right = width - 8;
  // Top bar: title and count on the left, the deck name field, the menu button (DeckView) on the right.
  const nameField: Rect = { x: 380, y: 6, w: clamp(width - 380 - 184, 200, 360), h: 32 };
  // Row 1: view and filter chips. Row 2: the search field and "clear".
  const keys = LANDSCAPE_CHIPS;
  const chipW = Math.min(180, Math.floor((right - left - (keys.length - 1) * 8) / keys.length));
  const chips = keys.map((_, i) => ({ x: left + i * (chipW + 8), y: TOP_H + 8, w: chipW, h: 32 }));
  const clearW = 96;
  const searchY = TOP_H + 8 + 32 + 8;
  const search: Rect = { x: left, y: searchY, w: right - left - clearW - 8, h: 32 };
  chips.push({ x: right - clearW, y: searchY, w: clearW, h: 32 });
  const gridTop = searchY + 32 + 10;
  const pagerH = 36;
  const grid: Rect = { x: left, y: gridTop, w: right - left, h: footer.y - gridTop - pagerH - 8 };
  const gap = 8;
  // Rows of about 170 px fill the height; as many columns as fit the width.
  const rows = Math.max(2, Math.round(grid.h / 170));
  const tileH = Math.floor((grid.h + gap) / rows) - gap;
  const tileW = Math.floor(tileH / CARD_ASPECT);
  const cols = Math.max(4, Math.floor((grid.w + gap) / (tileW + gap)));
  return {
    width,
    height,
    fontPx: WEB_FONT_PX,
    lineHeight: WEB_LINE_H,
    topBar,
    footer,
    detail,
    chips,
    chipKeys: [...keys, "clear"],
    search,
    nameField,
    grid,
    cols,
    rows,
    tileW,
    tileH,
    gap,
  };
}

const LANDSCAPE_CHIPS: readonly DeckChipKey[] = ["view", "type", "category", "set", "cost", "bp"];

//   [top bar: count                  menu]
//   [deck name field          list/deck ]
//   [search field             filters   ]
//   [card grid                           ]
//   [prev        page              next  ]
//   [card detail (image + text)          ]
//   [footer hints                        ]
function computePortraitDeckGeometry(viewport: Viewport): DeckGeometry {
  const width = Math.max(WEB_MIN_PORTRAIT.width, Math.floor(viewport.width));
  const height = Math.max(WEB_MIN_PORTRAIT.height, Math.floor(viewport.height));
  const pad = 8;
  const topBar: Rect = { x: 0, y: 0, w: width, h: PORTRAIT_TOP_H };
  const footer: Rect = { x: 0, y: height - PORTRAIT_FOOTER_H, w: width, h: PORTRAIT_FOOTER_H };
  const detailH = clamp(Math.round(height * 0.18), 120, 190);
  const detail: Rect = { x: pad, y: footer.y - 6 - detailH, w: width - pad * 2, h: detailH };
  // Chips: list/deck beside the name, the filter menu beside the search field.
  const chipW = 110;
  const fieldW = width - pad * 2 - chipW - 6;
  const row1 = PORTRAIT_TOP_H + 6;
  const row2 = row1 + 32 + 6;
  const nameField: Rect = { x: pad, y: row1, w: fieldW, h: 32 };
  const search: Rect = { x: pad, y: row2, w: fieldW, h: 32 };
  const chips = [row1, row2].map((y) => ({ x: width - pad - chipW, y, w: chipW, h: 32 }));
  const gridTop = row2 + 32 + 8;
  const pagerH = 36;
  const grid: Rect = { x: pad, y: gridTop, w: width - pad * 2, h: detail.y - 8 - pagerH - gridTop };
  const gap = 6;
  const cols = 4;
  const tileW = Math.floor((grid.w + gap) / cols) - gap;
  const tileH = Math.floor(tileW * CARD_ASPECT);
  const rows = Math.max(1, Math.floor((grid.h + gap) / (tileH + gap)));
  const chipKeys: DeckChipKey[] = ["view", "filters"];
  return { width, height, fontPx: WEB_FONT_PX, lineHeight: WEB_LINE_H, topBar, footer, detail, chips, chipKeys, search, nameField, grid, cols, rows, tileW, tileH, gap };
}
