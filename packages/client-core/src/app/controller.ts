// Top-level client state machine: title (deck select) -> match -> result.
// Consumes logical input, schedules CPU moves on frame ticks and produces a
// renderer-agnostic ScreenView. A shell only maps input and draws the view.
import type { CpuLevel, EngineApi } from "../engineApi";
import { HUMAN } from "../engineApi";
import { ListCursor, type LogicalInput } from "../input/actions";
import type { Platform } from "../platform/interfaces";
import { SettingsStore, type Settings } from "../platform/settings";
import { GameSession } from "../session/session";
import { PLAYER_LABELS } from "../text/labels";
import { fitLine, wrapText, type WrapOptions } from "../text/wrap";
import { boardLines, buildBoardView, buildPendingView, pendingLines } from "../view/board";
import { computeLayout, type FontPx, type Layout, type Viewport } from "../view/layout";
import { GuiMatch, type GuiView } from "./guiMatch";

export type Row = { text: string; selected: boolean };

export type ScreenView = {
  screen: "title" | "loading" | "match" | "result";
  layout: Layout;
  header: string;
  footer: string;
  tabs: string[];
  activeTab: number;
  infoLines: string[];
  promptLines: string[];
  rows: Row[];
  /** e.g. "3/12" for the action list position. */
  rowsCaption: string;
  busy: boolean;
  /** Increments on every visible change. */
  revision: number;
  /** Graphical match screen (card tiles + action menu) when the controller runs with `gui`. */
  gui?: GuiView;
};

export type ControllerOptions = {
  platform: Platform;
  viewport: Viewport;
  fontPx?: FontPx;
  /** Frames between CPU moves so a person can follow the match (0 = every frame). */
  cpuDelayFrames?: number;
  /** Seed source for new matches (defaults to the clock). */
  seed?: () => number;
  defaults?: Partial<Settings>;
  /** Draw the match as card tiles with an action menu instead of the text list. */
  gui?: boolean;
  /** With `gui`: the shell draws card images (see GuiView.detailArt). */
  cardArt?: boolean;
};

const MATCH_TABS = ["盤面:CPU", "盤面:自分", "ログ", "詳細"];
const TITLE_TABS = ["説明", "記録"];
const CPU_LEVEL_MAX = 5;

export class AppController {
  private readonly platform: Platform;
  private layout: Layout;
  private readonly fontPx?: FontPx;
  private readonly settingsStore: SettingsStore;
  private settings: Settings;
  private engine: EngineApi | null = null;
  private screen: ScreenView["screen"] = "title";
  session: GameSession | null = null;
  private readonly cursor = new ListCursor();
  private tab = 0;
  private message = "";
  private framesSinceCpu = 0;
  private readonly cpuDelayFrames: number;
  private readonly seed: () => number;
  private revision = 0;
  private cachedView: ScreenView | null = null;
  private deckIds: string[] = [];
  private viewport: Viewport;
  private readonly guiEnabled: boolean;
  private readonly cardArt: boolean;
  private gui: GuiMatch | null = null;

  constructor(options: ControllerOptions) {
    this.platform = options.platform;
    this.viewport = options.viewport;
    this.guiEnabled = !!options.gui;
    this.cardArt = !!options.cardArt;
    this.fontPx = options.fontPx;
    this.layout = computeLayout(options.viewport, options.fontPx);
    this.cpuDelayFrames = options.cpuDelayFrames ?? 8;
    this.seed = options.seed ?? (() => Math.floor(options.platform.clock()) % 1_000_000);
    this.settingsStore = new SettingsStore(options.platform.storage);
    this.settings = this.settingsStore.load({
      humanDeck: options.defaults?.humanDeck ?? "abarenoh",
      cpuDeck: options.defaults?.cpuDeck ?? "dekaranger",
      cpuLevel: options.defaults?.cpuLevel ?? 2,
    });
    // Deck list comes from the engine; the title screen loads it eagerly.
    const loaded = this.platform.assets.loadMatchData({ decks: [] });
    if (isPromise(loaded)) {
      this.screen = "loading";
      loaded.then((engine) => {
        this.setEngine(engine);
        this.screen = "title";
        this.touch();
      });
    } else {
      this.setEngine(loaded);
    }
    this.resetCursor();
  }

  private setEngine(engine: EngineApi): void {
    this.engine = engine;
    this.deckIds = [...engine.ALL_STARTER_DECK_IDS];
    if (!this.deckIds.includes(this.settings.humanDeck)) this.settings.humanDeck = this.deckIds[0] ?? "";
    if (!this.deckIds.includes(this.settings.cpuDeck)) this.settings.cpuDeck = this.deckIds[1] ?? "";
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.layout = computeLayout(viewport, this.fontPx);
    this.gui?.setViewport(viewport);
    this.touch();
  }

  get currentScreen(): ScreenView["screen"] {
    return this.screen;
  }

  // ---------------------------------------------------------------- input

  dispatch(event: LogicalInput): void {
    if (this.gui && this.screen === "match") {
      if (this.gui.dispatch(event)) this.afterStateChange();
      this.touch();
      return;
    }
    switch (event.type) {
      case "prev":
        this.cursor.move(-1);
        break;
      case "next":
        this.cursor.move(1);
        break;
      case "pagePrev":
        if (this.screen === "title") this.adjustTitleRow(-1);
        else this.cursor.page(-1);
        break;
      case "pageNext":
        if (this.screen === "title") this.adjustTitleRow(1);
        else this.cursor.page(1);
        break;
      case "tabPrev":
        this.tab = (this.tab + this.tabs().length - 1) % this.tabs().length;
        break;
      case "tabNext":
      case "menu":
      case "allActions":
        this.tab = (this.tab + 1) % this.tabs().length;
        break;
      case "toggleLog":
        this.tab = (this.tab + this.tabs().length - 1) % this.tabs().length;
        break;
      case "selectTab":
        if (event.tab >= 0 && event.tab < this.tabs().length) this.tab = event.tab;
        break;
      case "select": {
        const index = this.cursor.rowToIndex(event.row);
        if (index < 0) return;
        this.cursor.index = index;
        if (event.confirm) this.confirm();
        break;
      }
      case "confirm":
        this.confirm();
        break;
      case "cancel":
        this.cancel();
        break;
    }
    this.touch();
  }

  private confirm(): void {
    if (this.screen === "title") {
      if (this.cursor.index === 3) this.startMatch();
      else this.adjustTitleRow(1);
      return;
    }
    if (this.screen === "result") {
      this.screen = "title";
      this.session = null;
      this.message = "";
      this.tab = 0;
      this.resetCursor();
      return;
    }
    if (this.screen !== "match" || !this.session) return;
    if (this.session.turnOwner() !== "human") return;
    const result = this.session.chooseHuman(this.cursor.index);
    this.message = result.ok ? `あなた: ${result.label}` : `エラー: ${result.error}`;
    this.afterStateChange();
  }

  private cancel(): void {
    if (this.screen !== "match" || !this.session) return;
    // Jump the cursor to a "skip/pass/cancel" style option when present.
    const options = this.session.humanOptions();
    const passIndex = options.findIndex((o) => /^(pass_|skip_|cancel_)/.test(o.action.type));
    if (passIndex >= 0) {
      this.cursor.index = passIndex;
      this.cursor.resize(options.length, this.cursor.rows);
    }
  }

  private adjustTitleRow(direction: 1 | -1): void {
    const cycle = (list: string[], current: string) =>
      list[(list.indexOf(current) + direction + list.length) % list.length] ?? current;
    if (this.cursor.index === 0) this.settings.humanDeck = cycle(this.deckIds, this.settings.humanDeck);
    else if (this.cursor.index === 1) this.settings.cpuDeck = cycle(this.deckIds, this.settings.cpuDeck);
    else if (this.cursor.index === 2) {
      this.settings.cpuLevel = ((this.settings.cpuLevel - 1 + direction + CPU_LEVEL_MAX) % CPU_LEVEL_MAX) + 1;
    }
    this.settingsStore.save(this.settings);
  }

  startMatch(): void {
    const loaded = this.platform.assets.loadMatchData({
      decks: [this.settings.humanDeck, this.settings.cpuDeck],
    });
    const begin = (engine: EngineApi) => {
      this.engine = engine;
      this.session = new GameSession({
        engine,
        humanDeck: this.settings.humanDeck,
        cpuDeck: this.settings.cpuDeck,
        seed: this.seed(),
        cpuLevel: this.settings.cpuLevel as CpuLevel,
        clock: this.platform.clock,
        memory: this.platform.memory,
        log: this.platform.log,
      });
      this.gui = this.guiEnabled ? new GuiMatch(engine, this.session, this.viewport, this.cardArt) : null;
      this.screen = "match";
      this.tab = 1;
      this.message = "対戦開始";
      this.framesSinceCpu = 0;
      this.afterStateChange();
    };
    if (isPromise(loaded)) {
      this.screen = "loading";
      loaded.then((engine) => {
        begin(engine);
        this.touch();
      });
    } else {
      begin(loaded);
    }
  }

  /** Call once per frame. Runs at most one CPU move per call. Returns true if the view changed. */
  tick(): boolean {
    const session = this.session;
    if (this.screen !== "match" || !session) return false;
    if (session.winner) {
      this.finishMatch();
      return true;
    }
    const toastChanged = this.gui?.frame() ?? false;
    if (toastChanged) this.touch();
    if (session.turnOwner() !== "cpu") return toastChanged;
    this.framesSinceCpu++;
    if (this.framesSinceCpu < this.cpuDelayFrames) return false;
    this.framesSinceCpu = 0;
    const result = session.cpuStep();
    this.message = result.ok ? result.label : `CPUエラー: ${result.error}`;
    if (this.gui) this.gui.message = this.message;
    this.afterStateChange();
    return true;
  }

  private finishMatch(): void {
    const session = this.session;
    if (!session || this.screen !== "match") return;
    this.screen = "result";
    this.settingsStore.addRecord({
      humanDeck: session.options.humanDeck,
      cpuDeck: session.options.cpuDeck,
      winner: session.winner,
      turns: session.state.turn,
      cpuMoves: session.metrics.moves,
      avgThinkMs: Math.round(session.metrics.avgThinkMs * 10) / 10,
    });
    this.tab = 1;
    this.resetCursor();
    this.touch();
  }

  private afterStateChange(): void {
    if (this.session?.winner) {
      this.finishMatch();
      return;
    }
    this.resetCursor();
    this.touch();
  }

  private resetCursor(): void {
    this.cursor.reset(this.rowItems().length, this.visibleRows(this.promptLines().length));
  }

  private touch(): void {
    this.revision++;
    this.cachedView = null;
  }

  // ---------------------------------------------------------------- view

  private tabs(): string[] {
    return this.screen === "match" || this.screen === "result" ? MATCH_TABS : TITLE_TABS;
  }

  private wrapInfo(): WrapOptions {
    return { fontPx: this.layout.fontPx, maxWidthPx: this.layout.infoTextWidth };
  }

  private wrapSide(): WrapOptions {
    return { fontPx: this.layout.fontPx, maxWidthPx: this.layout.sideTextWidth };
  }

  private deckName(id: string): string {
    return this.engine?.starterDecks[id]?.name ?? id;
  }

  private rowItems(): string[] {
    if (this.screen === "title") {
      return [
        `あなた: ${this.deckName(this.settings.humanDeck)}`,
        `CPU: ${this.deckName(this.settings.cpuDeck)}`,
        `CPUレベル: Lv${this.settings.cpuLevel}`,
        "▶ 対戦開始",
      ];
    }
    if (this.screen === "result") return ["タイトルへ戻る"];
    if (this.screen === "match" && this.session?.turnOwner() === "human") {
      return this.session.humanOptions().map((o) => o.label);
    }
    return [];
  }

  private promptLines(): string[] {
    const wrap = this.wrapSide();
    const lines: string[] = [];
    if (this.message) lines.push(...wrapText(this.message, { ...wrap, maxLines: 2 }));
    if (this.screen === "match" && this.session && this.engine) {
      const pending = buildPendingView(this.engine, this.session.state);
      lines.push(...pendingLines(pending, wrap, 2));
      if (this.session.turnOwner() === "cpu") lines.push("CPU 思考中…");
      if (this.session.lastError) lines.push(...wrapText(`! ${this.session.lastError}`, wrap));
    }
    if (this.screen === "title") lines.push("デッキとレベルを選んで開始");
    if (this.screen === "result" && this.session) {
      lines.push(`勝者: ${this.session.winner ? PLAYER_LABELS[this.session.winner] : "-"}`);
    }
    // Keep at least 3 rows for the action list.
    const maxPrompt = Math.max(1, this.layout.sideLines - 4);
    return lines.slice(0, maxPrompt);
  }

  private visibleRows(promptCount: number): number {
    return Math.max(1, this.layout.sideLines - promptCount - 1);
  }

  private infoLines(): string[] {
    const wrap = this.wrapInfo();
    // Line 0 of the info pane is the tab bar.
    const max = Math.max(1, this.layout.infoLines - 1);
    if (this.screen === "title" || this.screen === "loading") {
      if (this.tab === 1) {
        const records = this.settingsStore.records();
        const lines = records.length
          ? records.map(
              (r) =>
                `${r.winner ? PLAYER_LABELS[r.winner as "player1"] : "-"}勝 ${this.deckName(r.humanDeck)} vs ${this.deckName(r.cpuDeck)} T${r.turns}`,
            )
          : ["記録なし"];
        if (!this.settingsStore.persistent) lines.push("（この端末では記録は終了時に消えます）");
        return lines.flatMap((l) => wrapText(l, wrap)).slice(0, max);
      }
      const help = [
        "レンジャーズストライク テキスト版",
        "上下: 選択 / 左右: 値の変更・ページ送り",
        "決定: 実行 / キャンセル: パス系へ移動",
        "L・R: 表示切替（盤面・ログ・詳細）",
        `カードデータ: ${this.platform.assets.chunks().map((c) => `${c.id}(${c.cardIds.length}枚)`).join(", ")}`,
      ];
      return help.flatMap((l) => wrapText(l, wrap)).slice(0, max);
    }
    const session = this.session;
    if (!session || !this.engine) return ["読み込み中…"];
    const board = buildBoardView(this.engine, session.state);
    switch (this.tab) {
      case 0:
      case 1: {
        const player = board.players[this.tab]!;
        return boardLines({ header: board.header, players: [player] }, wrap).slice(0, max);
      }
      case 2: {
        const lines = session.log.slice(-max * 2).flatMap((l) => wrapText(l, wrap));
        return lines.slice(-max);
      }
      default: {
        const detail = this.selectedCardDetail();
        return detail.flatMap((l) => wrapText(l, wrap)).slice(0, max);
      }
    }
  }

  /** Card text for the card referenced by the highlighted action (or pending source). */
  private selectedCardDetail(): string[] {
    const session = this.session;
    if (!session) return [];
    const state = session.state;
    const option = session.humanOptions()[this.cursor.index];
    const record = (option?.action ?? {}) as Record<string, unknown>;
    const instanceId =
      (record.instanceId as string | undefined) ??
      (record.attackerInstanceId as string | undefined) ??
      (record.sourceInstanceId as string | undefined);
    let cardId = instanceId?.replace(/-\d+$/, "");
    cardId ??= state.pendingEffectChoice?.sourceCardId ?? state.pendingCommandPayment?.sourceCardId;
    const def = cardId ? state.definitions[cardId] : undefined;
    if (!def) return ["選択中の操作にカードがありません"];
    const stats = [
      def.type,
      def.powerCost !== undefined ? `P${def.powerCost}` : "",
      def.bp !== undefined ? `BP${def.bp}` : "",
      def.size ? `${def.size}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [`${def.name}（${def.id}）`, stats, def.text ?? ""];
  }

  private footer(): string {
    const m = this.session?.metrics;
    if (!m) return `保存: ${this.settingsStore.persistent ? "有効" : "メモリのみ"}`;
    const mem = m.memory ? m.memory.label : "-";
    return `CPU思考 ${m.lastThinkMs.toFixed(0)}ms 平均${m.avgThinkMs.toFixed(1)} 最大${m.maxThinkMs.toFixed(0)} 手数${m.moves} | ${mem}`;
  }

  private header(): string {
    if (this.screen === "title") return "レンジャーズストライク (Vita試作)";
    if (this.screen === "loading") return "読み込み中…";
    if (!this.session || !this.engine) return "";
    const board = buildBoardView(this.engine, this.session.state);
    const me = this.session.state.players[HUMAN];
    return `${board.header} | 自分 D${me.damage} 手${me.hand.length}`;
  }

  view(): ScreenView {
    if (this.cachedView) return this.cachedView;
    const wrapLine = { fontPx: this.layout.fontPx, maxWidthPx: this.layout.header.w - this.layout.padding * 2 };
    const sideLine = this.wrapSide();
    const promptLines = this.promptLines();
    const items = this.rowItems();
    this.cursor.resize(items.length, this.visibleRows(promptLines.length));
    const rows: Row[] = [];
    for (let r = 0; r < this.cursor.rows; r++) {
      const index = this.cursor.rowToIndex(r);
      if (index < 0) break;
      rows.push({ text: fitLine(items[index]!, sideLine), selected: index === this.cursor.index });
    }
    this.cachedView = {
      screen: this.screen,
      layout: this.layout,
      header: fitLine(this.header(), wrapLine),
      footer: fitLine(this.footer(), wrapLine),
      tabs: this.tabs(),
      activeTab: this.tab,
      infoLines: this.infoLines(),
      promptLines,
      rows,
      rowsCaption: items.length ? `${this.cursor.index + 1}/${items.length}` : "",
      busy: this.session?.turnOwner() === "cpu",
      revision: this.revision,
      gui: this.gui && this.screen === "match" ? this.gui.view() : undefined,
    };
    return this.cachedView;
  }
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown })?.then === "function";
}

