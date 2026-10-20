// Graphical match screen state: a focus cursor over card tiles and an action
// menu. Every human option comes from GameSession.humanOptions() (the engine's
// legal actions), so the GUI never decides legality itself:
// - a tile's menu lists the options that name that card,
// - R lists the options that name no tile on the board (phase end, passes,
//   picks from hidden zones such as the discard pile),
// - △ lists every option, so nothing the engine allows is unreachable.
import type { EngineApi } from "../engineApi";
import type { LogicalInput } from "../input/actions";
import { ListCursor } from "../input/actions";
import type { ActionOption, GameSession, StepResult } from "../session/session";
import { fitLine, wrapText, type WrapOptions } from "../text/wrap";
import { buildPendingView } from "../view/board";
import {
  actionInstanceIds,
  buildGuiRows,
  computeGuiGeometry,
  playerStrip,
  tileRect,
  topBarText,
  type GuiGeometry,
  type GuiRow,
  type GuiTile,
} from "../view/gui";
import type { Rect, Viewport } from "../view/layout";
import { CPU, HUMAN } from "../engineApi";

export type GuiTileView = GuiTile & { rect: Rect; focused: boolean };

export type GuiRowView = {
  key: string;
  label: string;
  rect: Rect;
  /** Row holds the focus cursor. */
  active: boolean;
  tiles: GuiTileView[];
  /** Tiles hidden left / right of the visible window. */
  moreLeft: number;
  moreRight: number;
};

export type PanelTone = "head" | "body" | "dim" | "accent";
export type PanelLine = { text: string; tone: PanelTone; rect: Rect };
export type MenuRowView = { text: string; selected: boolean; rect: Rect };

export type GuiView = {
  geometry: GuiGeometry;
  topBar: string;
  strips: [string, string];
  rows: GuiRowView[];
  panelLines: PanelLine[];
  menuTitle: string;
  menuTitleRect: Rect;
  menuRows: MenuRowView[];
  menuOpen: boolean;
  footer: string;
};

type MenuSource = { kind: "tile"; instanceId: string } | { kind: "global" } | { kind: "all" };
type MenuItem = { option: ActionOption; index: number };

const TYPE_LABELS: Record<string, string> = {
  unit: "ユニット",
  operation: "オペレーション",
  vehicle: "ビークル",
  commander: "コマンダー",
};
const PASS_LIKE = /^(pass_|skip_|cancel_|end_phase$)/;
const MENU_ROWS_BOARD = 4;
const MENU_ROWS_OPEN = 7;

export class GuiMatch {
  geometry: GuiGeometry;
  private rows: GuiRow[] = [];
  private focusRow = 5;
  private focusIndex = 0;
  private readonly offsets = new Map<string, number>();
  private focusedId: string | null = null;
  private menu: MenuSource | null = null;
  private readonly menuCursor = new ListCursor();
  private showLog = false;
  private syncedVersion = -1;
  message = "";

  constructor(
    private readonly engine: EngineApi,
    private readonly session: GameSession,
    viewport: Viewport,
  ) {
    this.geometry = computeGuiGeometry(viewport);
  }

  setViewport(viewport: Viewport): void {
    this.geometry = computeGuiGeometry(viewport);
    this.syncedVersion = -1;
  }

  // ------------------------------------------------------------ state sync

  private humanActive(): boolean {
    return this.session.turnOwner() === "human";
  }

  private options(): ActionOption[] {
    return this.humanActive() ? this.session.humanOptions() : [];
  }

  private sync(): void {
    if (this.syncedVersion === this.session.version) return;
    this.syncedVersion = this.session.version;
    this.rows = buildGuiRows(
      this.engine,
      this.session.state,
      this.geometry,
      this.options().map((o) => o.action),
    );
    if (this.menu?.kind === "tile" && !this.findTile(this.menu.instanceId)) this.closeMenu();
    const kept = this.focusedId ? this.findTile(this.focusedId) : null;
    const firstActionable = this.firstActionable();
    if (kept && (kept.tile.actionable || !firstActionable)) {
      this.setFocus(kept.row, kept.index);
    } else if (firstActionable) {
      this.setFocus(firstActionable.row, firstActionable.index);
    } else if (!kept) {
      const fallback = this.nearestNonEmptyRow(this.focusRow);
      if (fallback >= 0) this.setFocus(fallback, Math.min(this.focusIndex, this.rows[fallback]!.tiles.length - 1));
      else this.focusedId = null;
    }
  }

  private findTile(instanceId: string): { row: number; index: number; tile: GuiTile } | null {
    for (let row = 0; row < this.rows.length; row++) {
      const index = this.rows[row]!.tiles.findIndex((t) => t.instanceId === instanceId);
      if (index >= 0) return { row, index, tile: this.rows[row]!.tiles[index]! };
    }
    return null;
  }

  private firstActionable(): { row: number; index: number } | null {
    for (let row = 0; row < this.rows.length; row++) {
      const index = this.rows[row]!.tiles.findIndex((t) => t.actionable);
      if (index >= 0) return { row, index };
    }
    return null;
  }

  private nearestNonEmptyRow(from: number): number {
    for (let d = 0; d < this.rows.length; d++) {
      for (const row of [from + d, from - d]) {
        if (row >= 0 && row < this.rows.length && this.rows[row]!.tiles.length > 0) return row;
      }
    }
    return -1;
  }

  private setFocus(row: number, index: number): void {
    const tiles = this.rows[row]?.tiles ?? [];
    if (tiles.length === 0) return;
    this.focusRow = row;
    this.focusIndex = Math.max(0, Math.min(index, tiles.length - 1));
    this.focusedId = tiles[this.focusIndex]!.instanceId;
    const key = this.rows[row]!.key;
    const per = this.geometry.tilesPerRow;
    let offset = this.offsets.get(key) ?? 0;
    if (this.focusIndex < offset) offset = this.focusIndex;
    if (this.focusIndex >= offset + per) offset = this.focusIndex - per + 1;
    offset = Math.max(0, Math.min(offset, Math.max(0, tiles.length - per)));
    this.offsets.set(key, offset);
  }

  private focusedTile(): GuiTile | null {
    return this.rows[this.focusRow]?.tiles[this.focusIndex] ?? null;
  }

  // ------------------------------------------------------------ menus

  private menuItems(source: MenuSource | null = this.menu): MenuItem[] {
    const options = this.options();
    const items = options.map((option, index) => ({ option, index }));
    if (!source) return [];
    if (source.kind === "all") return items;
    if (source.kind === "tile") {
      return items.filter((item) => actionInstanceIds(item.option.action).includes(source.instanceId));
    }
    const visible = new Set(this.rows.flatMap((r) => r.tiles.map((t) => t.instanceId)));
    return items.filter((item) => !actionInstanceIds(item.option.action).some((id) => visible.has(id)));
  }

  private openMenu(source: MenuSource, preferPass = false): void {
    const items = this.menuItems(source);
    if (items.length === 0) {
      this.message =
        source.kind === "tile" ? "このカードでできる操作はありません" : this.humanActive() ? "操作はありません" : "CPU の手番です";
      return;
    }
    this.menu = source;
    this.menuCursor.reset(items.length, MENU_ROWS_OPEN);
    if (preferPass) {
      const pass = items.findIndex((item) => PASS_LIKE.test(item.option.action.type));
      if (pass >= 0) {
        this.menuCursor.index = pass;
        this.menuCursor.move(0);
      }
    }
  }

  /** What ○ opens: the focused card's actions, or the global menu when it has none (e.g. the start-phase draw). */
  private confirmSource(): MenuSource {
    const tile = this.focusedTile();
    const source: MenuSource = tile ? { kind: "tile", instanceId: tile.instanceId } : { kind: "global" };
    return this.menuItems(source).length > 0 ? source : { kind: "global" };
  }

  private closeMenu(): void {
    this.menu = null;
  }

  // ------------------------------------------------------------ input

  /** Handles one input. Returns the step result when an action was applied. */
  dispatch(event: LogicalInput): StepResult | null {
    this.sync();
    if (this.menu) return this.dispatchMenu(event);
    switch (event.type) {
      case "prev":
        this.moveRow(-1);
        break;
      case "next":
        this.moveRow(1);
        break;
      case "pagePrev":
        this.setFocus(this.focusRow, this.focusIndex - 1);
        break;
      case "pageNext":
        this.setFocus(this.focusRow, this.focusIndex + 1);
        break;
      case "confirm": {
        this.openMenu(this.confirmSource());
        break;
      }
      case "cancel":
        this.openMenu({ kind: "global" }, true);
        break;
      case "menu":
        this.openMenu({ kind: "global" });
        break;
      case "allActions":
        this.openMenu({ kind: "all" });
        break;
      case "toggleLog":
      case "tabNext":
      case "tabPrev":
        this.showLog = !this.showLog;
        break;
      case "focusTile": {
        const row = this.rows[event.row];
        if (!row) break;
        const index = (this.offsets.get(row.key) ?? 0) + event.slot;
        if (index >= row.tiles.length) break;
        this.setFocus(event.row, index);
        if (event.open) this.openMenu({ kind: "tile", instanceId: row.tiles[index]!.instanceId });
        break;
      }
      case "select":
      case "selectTab":
        break;
    }
    return null;
  }

  private dispatchMenu(event: LogicalInput): StepResult | null {
    const items = this.menuItems();
    this.menuCursor.resize(items.length, MENU_ROWS_OPEN);
    switch (event.type) {
      case "prev":
        this.menuCursor.move(-1);
        return null;
      case "next":
        this.menuCursor.move(1);
        return null;
      case "pagePrev":
        this.menuCursor.page(-1);
        return null;
      case "pageNext":
        this.menuCursor.page(1);
        return null;
      case "cancel":
        this.closeMenu();
        return null;
      case "menu":
        this.openMenu({ kind: "global" });
        return null;
      case "allActions":
        this.openMenu({ kind: "all" });
        return null;
      case "select": {
        const index = this.menuCursor.rowToIndex(event.row);
        if (index < 0) return null;
        this.menuCursor.index = index;
        return event.confirm ? this.execute(items) : null;
      }
      case "confirm":
        return this.execute(items);
      case "focusTile":
        this.closeMenu();
        return this.dispatch(event);
      default:
        return null;
    }
  }

  private execute(items: MenuItem[]): StepResult | null {
    const item = items[this.menuCursor.index];
    if (!item) return null;
    this.closeMenu();
    const result = this.session.chooseHuman(item.index);
    this.message = result.ok ? `あなた: ${result.label}` : `エラー: ${result.error}`;
    return result;
  }

  private moveRow(direction: 1 | -1): void {
    const slot = this.focusIndex - (this.offsets.get(this.rows[this.focusRow]?.key ?? "") ?? 0);
    for (let row = this.focusRow + direction; row >= 0 && row < this.rows.length; row += direction) {
      const target = this.rows[row]!;
      if (target.tiles.length === 0) continue;
      const offset = this.offsets.get(target.key) ?? 0;
      this.setFocus(row, offset + slot);
      return;
    }
  }

  // ------------------------------------------------------------ view

  view(): GuiView {
    this.sync();
    const g = this.geometry;
    const state = this.session.state;
    const rows: GuiRowView[] = this.rows.map((row, r) => {
      const offset = this.offsets.get(row.key) ?? 0;
      const visible = row.tiles.slice(offset, offset + g.tilesPerRow);
      return {
        key: row.key,
        label: row.label,
        rect: g.rows[r]!,
        active: r === this.focusRow,
        tiles: visible.map((tile, slot) => ({
          ...tile,
          rect: tileRect(g, r, slot),
          focused: r === this.focusRow && offset + slot === this.focusIndex,
        })),
        moreLeft: offset,
        moreRight: Math.max(0, row.tiles.length - offset - visible.length),
      };
    });

    const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.panelTextWidth };
    const source = this.menu ?? this.confirmSource();
    const items = this.menuItems(source);
    const menuRowCount = this.menu ? MENU_ROWS_OPEN : MENU_ROWS_BOARD;
    if (this.menu) this.menuCursor.resize(items.length, MENU_ROWS_OPEN);
    const shownItems = this.menu
      ? Array.from({ length: this.menuCursor.rows }, (_, r) => this.menuCursor.rowToIndex(r))
          .filter((i) => i >= 0)
          .map((i) => ({ item: items[i]!, selected: i === this.menuCursor.index }))
      : items.slice(0, menuRowCount).map((item) => ({ item, selected: false }));

    const reserved = 1 + Math.max(1, shownItems.length);
    const textBudget = Math.max(2, g.panelLines - reserved);
    const lines: { text: string; tone: PanelTone }[] = [];
    const push = (tone: PanelTone, texts: string[]) => {
      for (const text of texts) if (lines.length < textBudget) lines.push({ text, tone });
    };
    if (this.message) push("dim", wrapText(this.message, { ...wrap, maxLines: 2 }));
    const pending = buildPendingView(this.engine, state);
    if (pending) push("accent", wrapText(`${pending.actor ? `[${pending.actor}] ` : ""}${pending.title}`, { ...wrap, maxLines: 2 }));
    if (!this.humanActive() && !state.winner) push("dim", ["CPU 思考中…"]);
    if (this.session.lastError) push("accent", wrapText(`! ${this.session.lastError}`, { ...wrap, maxLines: 2 }));
    if (this.showLog) {
      const room = textBudget - lines.length;
      const logLines = this.session.log.slice(-room * 2).flatMap((l) => wrapText(l, wrap));
      push("body", logLines.slice(-room));
    } else {
      const detail = this.cardDetail(this.focusedTile());
      if (detail[0]) push("head", wrapText(detail[0], { ...wrap, maxLines: 2 }));
      if (detail[1]) push("dim", [fitLine(detail[1], wrap)]);
      if (detail[2]) push("body", wrapText(detail[2], wrap));
    }

    const lineRect = (i: number): Rect => ({
      x: g.panel.x + 4,
      y: g.panel.y + 2 + i * g.lineHeight,
      w: g.panel.w - 6,
      h: g.lineHeight,
    });
    const menuStart = g.panelLines - reserved;
    const sourceName = source.kind === "tile" ? "このカードの操作" : source.kind === "global" ? "全体の操作" : "すべての操作";
    const title = this.menu
      ? `${sourceName} ${this.menuCursor.index + 1}/${items.length}`
      : items.length
        ? `○: ${sourceName}（${items.length}）`
        : "";
    return {
      geometry: g,
      topBar: fitLine(topBarText(state), { fontPx: g.fontPx, maxWidthPx: g.topBar.w - 8 }),
      strips: [
        fitLine(playerStrip(this.engine, state, CPU), { fontPx: g.fontPx, maxWidthPx: g.strips[0].w - 8 }),
        fitLine(playerStrip(this.engine, state, HUMAN), { fontPx: g.fontPx, maxWidthPx: g.strips[1].w - 8 }),
      ],
      rows,
      panelLines: lines.map((line, i) => ({ ...line, rect: lineRect(i) })),
      menuTitle: fitLine(title, wrap),
      menuTitleRect: lineRect(menuStart),
      menuRows: shownItems.map(({ item, selected }, r) => ({
        text: fitLine(item.option.label, wrap),
        selected,
        rect: lineRect(menuStart + 1 + r),
      })),
      menuOpen: !!this.menu,
      footer: this.menu ? "↑↓選択 ○決定 ×戻る ←→ページ" : "十字:カード ○操作 ×パス R:全体 △:全操作 L:ログ",
    };
  }

  private cardDetail(tile: GuiTile | null): string[] {
    if (!tile) return [];
    if (tile.kind === "hidden") return ["裏向きのカード"];
    const def = this.session.state.definitions[tile.cardId];
    if (!def) return [tile.cardId];
    const stats = [
      TYPE_LABELS[def.type] ?? def.type,
      def.powerCost !== undefined ? `P${def.powerCost}` : "",
      tile.kind === "unit" && tile.sub ? `BP${tile.sub}` : "",
      def.size ? `${def.size}` : "",
      tile.held ? "ホールド中" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [`${def.name}（${def.id}）`, stats, def.text ?? ""];
  }
}
