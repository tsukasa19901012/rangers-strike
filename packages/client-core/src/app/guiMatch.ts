// Graphical match screen, operated like a commercial card game:
// - pick a card with the D-pad (or tap it), ○ opens a small popup of what that
//   card can do next to it;
// - a move that needs a target (attack, operation target, vehicle...) switches
//   to targeting: valid targets light up and ○ picks one;
// - decisions the engine is waiting on (effect choices, payments, reactions)
//   open a selection window with the candidate cards and buttons;
// - R is the phase-end button; CPU moves show up as a toast in the top bar.
//
// Every choice offered comes from GameSession.humanOptions() (the engine's
// legal actions). The GUI only groups them, it never decides legality, and △
// always lists every option so nothing the engine allows is unreachable.
import type { EngineApi, GameAction, GameState } from "../engineApi";
import { CPU, HUMAN } from "../engineApi";
import type { LogicalInput } from "../input/actions";
import { ListCursor } from "../input/actions";
import type { ActionOption, GameSession, StepResult } from "../session/session";
import { ACTION_LABELS, PHASE_LABELS } from "../text/labels";
import { clipLine, fitLine, measureText, wrapText, type WrapOptions } from "../text/wrap";
import { buildPendingView } from "../view/board";
import {
  actionExtrasKey,
  actionInstanceIds,
  actionSubjectId,
  actionTargetId,
  buildGuiRows,
  cardTile,
  computeGuiGeometry,
  detailArtWidth,
  isWideDetail,
  locateInstance,
  PHASE_ORDER,
  playerStrip,
  tileRect,
  topBarText,
  zoneLabel,
  type GuiGeometry,
  type GuiRow,
  type GuiTile,
} from "../view/gui";
import type { Rect, Viewport } from "../view/layout";

export type PanelTone = "head" | "body" | "dim" | "accent";
export type PanelLine = { text: string; tone: PanelTone; rect: Rect };
export type MenuRowView = { text: string; selected: boolean; rect: Rect };

export type GuiTileView = GuiTile & {
  rect: Rect;
  focused: boolean;
  /** Valid pick for the current targeting / selection window. */
  targetable: boolean;
  /** Not a valid pick while targeting (drawn faded). */
  dimmed: boolean;
  /** Raised (focused card in the hand). */
  raised: boolean;
};

export type GuiRowView = {
  key: string;
  zone: string;
  rect: Rect;
  active: boolean;
  tiles: GuiTileView[];
  moreLeft: number;
  moreRight: number;
};

export type GuiBox = { rect: Rect; title: string; titleRect: Rect; rows: MenuRowView[] };

export type GuiDialogView = {
  rect: Rect;
  titleLines: PanelLine[];
  cards: (GuiTile & { rect: Rect; focused: boolean; caption: string; captionRect: Rect })[];
  buttons: MenuRowView[];
  /** Index of the first visible button among all buttons. */
  buttonOffset: number;
  moreLeft: number;
  moreRight: number;
};

export type GuiView = {
  geometry: GuiGeometry;
  topBar: string;
  toast: string;
  phases: { label: string; active: boolean; rect: Rect }[];
  endButton: { lines: string[]; enabled: boolean; rect: Rect };
  strips: [string, string];
  rows: GuiRowView[];
  detailLines: PanelLine[];
  /** Card image at the top of the detail panel (only with `cardArt`). */
  detailArt?: { cardId: string; hidden: boolean; rect: Rect };
  popup?: GuiBox;
  list?: GuiBox;
  dialog?: GuiDialogView;
  footer: string;
  footerAccent: boolean;
  /** Any overlay (popup / list / dialog / targeting) has the input. */
  menuOpen: boolean;
};

type MenuItem = { option: ActionOption; index: number };
type Verb = { label: string; items: MenuItem[] };
type Target = { id: string; row: number; index: number; items: MenuItem[] };

type Mode =
  | { kind: "board" }
  | { kind: "popup"; title: string; anchor: Rect; verbs: Verb[]; cursor: ListCursor }
  | { kind: "target"; prompt: string; targets: Target[]; cursor: number }
  | { kind: "list"; title: string; items: MenuItem[]; labels: string[]; cursor: ListCursor };

type DialogItem = { kind: "card"; id: string; items: MenuItem[] } | { kind: "button"; items: MenuItem[] };

const BOARD_MOVES = new Set(["battle", "strike", "pass_battle_entry", "move_to_battle", "end_phase", "charge_power", "rush"]);
const PASS_LIKE = /^(pass_|skip_|cancel_|end_phase$)/;
export const TYPE_LABELS: Record<string, string> = {
  unit: "ユニット",
  operation: "オペレーション",
  vehicle: "ビークル",
  commander: "コマンダー",
};
const TARGET_PROMPTS: Record<string, string> = {
  battle: "アタックする相手を選ぶ",
  play_operation: "オペレーションの対象を選ぶ",
  mount_ride: "ライドするビークルを選ぶ",
};
const POPUP_ROWS = 6;
const LIST_ROWS = 12;
const DIALOG_BUTTONS = 5;
const TOAST_FRAMES = 150;

export class GuiMatch {
  geometry: GuiGeometry;
  private rows: GuiRow[] = [];
  private focusRow = 5;
  private focusIndex = 0;
  private readonly offsets = new Map<string, number>();
  private focusedId: string | null = null;
  private mode: Mode = { kind: "board" };
  private dialogCursor = 0;
  private dialogOffset = 0;
  private dialogHidden = false;
  private dialogVersion = -1;
  private showLog = false;
  private syncedVersion = -1;
  private toastText = "";
  private toastFrames = 0;

  constructor(
    private readonly engine: EngineApi,
    private readonly session: GameSession,
    viewport: Viewport,
    /** The shell can draw card images: the detail panel leaves room for one. */
    private readonly cardArt = false,
    /** Screen geometry for a viewport (the Vita layout unless a shell supplies its own). */
    private readonly layout: (viewport: Viewport) => GuiGeometry = computeGuiGeometry,
  ) {
    this.geometry = layout(viewport);
  }

  setViewport(viewport: Viewport): void {
    this.geometry = this.layout(viewport);
    this.syncedVersion = -1;
  }

  /** Shows a short notice (CPU moves, results) in the top bar. */
  set message(text: string) {
    this.toastText = text;
    this.toastFrames = text ? TOAST_FRAMES : 0;
  }

  get message(): string {
    return this.toastText;
  }

  /** Call once per frame (toast timer). Returns true when the view changed. */
  frame(): boolean {
    if (this.toastFrames <= 0) return false;
    this.toastFrames--;
    return this.toastFrames === 0;
  }

  // ------------------------------------------------------------ state sync

  private state(): GameState {
    return this.session.state;
  }

  private humanActive(): boolean {
    return this.session.turnOwner() === "human";
  }

  private options(): ActionOption[] {
    return this.humanActive() ? this.session.humanOptions() : [];
  }

  private allItems(): MenuItem[] {
    return this.options().map((option, index) => ({ option, index }));
  }

  private sync(): void {
    if (this.syncedVersion === this.session.version) return;
    this.syncedVersion = this.session.version;
    this.rows = buildGuiRows(this.engine, this.state(), this.geometry, this.options().map((o) => o.action));
    this.mode = { kind: "board" };
    if (this.dialogVersion !== this.session.version) {
      this.dialogVersion = this.session.version;
      this.dialogCursor = 0;
      this.dialogOffset = 0;
      this.dialogHidden = false;
    }
    const kept = this.focusedId ? this.findTile(this.focusedId) : null;
    const firstActionable = this.firstActionable();
    if (kept && (kept.tile.actionable || !firstActionable)) this.setFocus(kept.row, kept.index);
    else if (firstActionable) this.setFocus(firstActionable.row, firstActionable.index);
    else if (!kept) {
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

  private visibleIds(): Set<string> {
    return new Set(this.rows.flatMap((r) => r.tiles.map((t) => t.instanceId)));
  }

  // ------------------------------------------------------------ selection window

  /** The engine waits on a decision (effect choice, payment, reaction) the human must answer. */
  private dialogActive(): boolean {
    if (!this.humanActive()) return false;
    const options = this.options();
    // The human's own battle entry is played on the board (attack targeting, strike, pass).
    if (options.some((o) => BOARD_MOVES.has(o.action.type))) return false;
    return buildPendingView(this.engine, this.state()) !== null && options.length > 0;
  }

  private dialogShown(): boolean {
    return this.dialogActive() && !this.dialogHidden && this.mode.kind === "board";
  }

  private dialogItems(): DialogItem[] {
    const cards = new Map<string, MenuItem[]>();
    const buttons: DialogItem[] = [];
    const pass: DialogItem[] = [];
    for (const item of this.allItems()) {
      const id = actionTargetId(item.option.action) ?? actionSubjectId(item.option.action) ?? actionInstanceIds(item.option.action)[0];
      if (id && locateInstance(this.state(), id)) {
        const list = cards.get(id) ?? [];
        list.push(item);
        cards.set(id, list);
      } else (PASS_LIKE.test(item.option.action.type) ? pass : buttons).push({ kind: "button", items: [item] });
    }
    return [...[...cards].map(([id, items]) => ({ kind: "card" as const, id, items })), ...buttons, ...pass];
  }

  // ------------------------------------------------------------ popups

  /** What the focused card can do, grouped into verbs. */
  private cardVerbs(instanceId: string): Verb[] {
    const groups = new Map<string, Verb>();
    for (const item of this.allItems()) {
      const action = item.option.action;
      const ids = actionInstanceIds(action);
      if (!ids.includes(instanceId)) continue;
      const asSubject = actionSubjectId(action) === instanceId;
      const key = `${action.type}|${asSubject ? "s" : "t"}`;
      const base = ACTION_LABELS[action.type] ?? action.type;
      const verb = groups.get(key) ?? { label: asSubject ? base : `${base}（このカードへ）`, items: [] };
      verb.items.push(item);
      groups.set(key, verb);
    }
    // A verb with a single move is labelled with its full description.
    return [...groups.values()].map((verb) =>
      verb.items.length === 1 ? { label: verb.items[0]!.option.label, items: verb.items } : verb,
    );
  }

  private globalVerbs(): Verb[] {
    const visible = this.visibleIds();
    return this.allItems()
      .filter((item) => !actionInstanceIds(item.option.action).some((id) => visible.has(id)))
      .map((item) => ({ label: item.option.label, items: [item] }));
  }

  private openPopup(title: string, anchor: Rect, verbs: Verb[], preferPass = false): void {
    if (verbs.length === 0) {
      this.message = this.humanActive() ? "できる操作はありません" : "CPU の手番です";
      return;
    }
    const cursor = new ListCursor();
    cursor.reset(verbs.length, POPUP_ROWS);
    if (preferPass) {
      const pass = verbs.findIndex((v) => v.items.some((i) => PASS_LIKE.test(i.option.action.type)));
      if (pass >= 0) {
        cursor.index = pass;
        cursor.move(0);
      }
    }
    this.mode = { kind: "popup", title, anchor, verbs, cursor };
  }

  /** `variants`: the moves of one verb; rows drop the start they share, so a narrow screen still shows what differs. */
  private openList(title: string, items: MenuItem[], variants = false): void {
    if (items.length === 0) return;
    const cursor = new ListCursor();
    cursor.reset(items.length, LIST_ROWS);
    const labels = items.map((i) => i.option.label);
    this.mode = { kind: "list", title, items, labels: this.placeDuplicates(items, labels, variants ? variantLabels(labels) : labels), cursor };
  }

  private focusedRect(): Rect {
    const row = this.rows[this.focusRow];
    const offset = row ? (this.offsets.get(row.key) ?? 0) : 0;
    return tileRect(this.geometry, this.focusRow, this.focusIndex - offset);
  }

  private openCardPopup(): void {
    const tile = this.focusedTile();
    const verbs = tile ? this.cardVerbs(tile.instanceId) : [];
    if (tile && verbs.length > 0) {
      // The popup title already names the card, so drop it from each row.
      const name = this.cardName(tile.cardId);
      const short = verbs.map((verb) => ({ ...verb, label: dropCardName(verb.label, name) }));
      this.openPopup(name, this.focusedRect(), short);
    } else {
      this.openPopup("全体の操作", this.geometry.endButton, this.globalVerbs());
    }
  }

  /** Runs a verb: one move applies, moves that differ only by target start targeting, others list variants. */
  /**
   * Rows that read the same (two copies of a card, オーラパワー on one of several CS-S1) get where
   * the card they differ by is: "（自ラッシュ2）".
   */
  private placeDuplicates(items: MenuItem[], labels: string[], shown: string[]): string[] {
    const state = this.state();
    const groups = new Map<string, number[]>();
    labels.forEach((label, i) => groups.set(label, [...(groups.get(label) ?? []), i]));
    const where = (id: string) => {
      const at = locateInstance(state, id);
      if (!at) return null;
      const zone = (state.players[at.player] as unknown as Record<string, { instanceId: string }[]>)[at.zone] ?? [];
      return { place: `${at.player === HUMAN ? "自" : "敵"}${zoneLabel(at.zone)}`, position: zone.findIndex((c) => c.instanceId === id) + 1 };
    };
    return labels.map((label, i) => {
      const group = groups.get(label)!;
      if (group.length < 2) return shown[i]!;
      // The cards this row names and not every row of the group does (ゴードム: 2 of 3 戦闘員 → 「自ラッシュ2・3」).
      const idSets = group.map((j) => new Set(actionInstanceIds(items[j]!.option.action)));
      const own = actionInstanceIds(items[i]!.option.action).filter((id) => !idSets.every((set) => set.has(id)));
      const places = own.map(where).filter((w): w is { place: string; position: number } => w !== null);
      if (places.length === 0) return shown[i]!;
      const samePlace = places.every((w) => w.place === places[0]!.place);
      const text = samePlace
        ? `${places[0]!.place}${places.map((w) => w.position).join("・")}`
        : places.map((w) => `${w.place}${w.position}`).join("・");
      return `${shown[i]}（${text}）`;
    });
  }

  private runVerb(verb: Verb): StepResult | null {
    if (verb.items.length === 1) return this.execute(verb.items[0]!);
    // Moves that differ by their target pick it on the board. On the target's own popup
    // ("アタック（このカードへ）" with several attackers) they differ by their subject instead.
    const type = verb.items[0]!.option.action.type;
    const byTarget = this.boardTargets(verb.items, actionTargetId);
    const bySubject = byTarget && byTarget.length === 1 ? this.boardTargets(verb.items, actionSubjectId) : null;
    const targets = bySubject && bySubject.length > 1 ? bySubject : byTarget;
    if (targets && targets.length > 0 && !(targets.length === 1 && targets[0]!.items.length > 1)) {
      targets.sort((a, b) => a.row - b.row || a.index - b.index);
      const prompt = targets === bySubject ? `${verb.label}: 使うカードを選ぶ` : (TARGET_PROMPTS[type] ?? `${verb.label}: 対象を選ぶ`);
      this.mode = { kind: "target", prompt, targets, cursor: 0 };
      this.setFocus(targets[0]!.row, targets[0]!.index);
      return null;
    }
    this.openList(verb.label, verb.items, true);
    return null;
  }

  /** Items grouped by the board card `key` names, or null when one has no such card on the board. */
  private boardTargets(items: MenuItem[], key: (action: GameAction) => string | undefined): Target[] | null {
    const byId = new Map<string, MenuItem[]>();
    for (const item of items) {
      const id = key(item.option.action);
      if (!id) return null;
      const list = byId.get(id) ?? [];
      list.push(item);
      byId.set(id, list);
    }
    const targets: Target[] = [];
    for (const [id, grouped] of byId) {
      const at = this.findTile(id);
      if (!at) return null;
      targets.push({ id, row: at.row, index: at.index, items: grouped });
    }
    return targets;
  }

  private runItems(items: MenuItem[], title: string): StepResult | null {
    if (items.length === 1) return this.execute(items[0]!);
    // Variants that differ only in extra fields (material, substitute...) are listed by their full labels.
    const distinct = new Set(items.map((i) => actionExtrasKey(i.option.action)));
    if (distinct.size <= 1) return this.execute(items[0]!);
    this.openList(title, items, true);
    return null;
  }

  private execute(item: MenuItem): StepResult {
    this.mode = { kind: "board" };
    const result = this.session.chooseHuman(item.index);
    this.message = result.ok ? `あなた: ${result.label}` : `エラー: ${result.error}`;
    return result;
  }

  /** What the R button does: end the phase or the battle entry, or the only move there is (the draw). */
  private primaryItem(): MenuItem | undefined {
    const items = this.allItems();
    return (
      items.find((item) => item.option.action.type === "end_phase") ??
      items.find((item) => item.option.action.type === "pass_battle_entry") ??
      (items.length === 1 ? items[0] : undefined)
    );
  }

  private endPhase(): StepResult | null {
    const primary = this.primaryItem();
    if (primary) return this.execute(primary);
    this.openPopup("全体の操作", this.geometry.endButton, this.globalVerbs(), true);
    return null;
  }

  // ------------------------------------------------------------ input

  /** Handles one input. Returns the step result when an action was applied. */
  dispatch(event: LogicalInput): StepResult | null {
    this.sync();
    switch (this.mode.kind) {
      case "popup":
        return this.dispatchPopup(this.mode, event);
      case "list":
        return this.dispatchList(this.mode, event);
      case "target":
        return this.dispatchTarget(this.mode, event);
      default:
        break;
    }
    if (this.dialogShown()) return this.dispatchDialog(event);
    return this.dispatchBoard(event);
  }

  private dispatchBoard(event: LogicalInput): StepResult | null {
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
      case "confirm":
        this.openCardPopup();
        break;
      case "cancel":
        if (this.dialogActive()) this.dialogHidden = false;
        else this.openPopup("全体の操作", this.geometry.endButton, this.globalVerbs(), true);
        break;
      case "menu":
        if (this.dialogActive()) this.dialogHidden = false;
        else return this.endPhase();
        break;
      case "allActions":
        this.openList("すべての操作", this.allItems());
        break;
      case "toggleLog":
      case "tabNext":
      case "tabPrev":
        if (this.dialogActive()) this.dialogHidden = false;
        else this.showLog = !this.showLog;
        break;
      case "focusTile": {
        const row = this.rows[event.row];
        if (!row) break;
        const index = (this.offsets.get(row.key) ?? 0) + event.slot;
        if (index >= row.tiles.length) break;
        this.setFocus(event.row, index);
        if (event.open) this.openCardPopup();
        break;
      }
      case "openCards": {
        const verbs = event.instanceIds.flatMap((id) => {
          const name = this.instanceName(id);
          const own = this.cardVerbs(id);
          // One card: the title names it; several: each row keeps its card name.
          return event.instanceIds.length === 1 ? own.map((verb) => ({ ...verb, label: dropCardName(verb.label, name) })) : own;
        });
        if (verbs.length > 0) this.openPopup(event.title, event.anchor, verbs);
        break;
      }
      case "select":
      case "selectTab":
        break;
    }
    return null;
  }

  private dispatchDialog(event: LogicalInput): StepResult | null {
    const items = this.dialogItems();
    const cards = items.filter((i) => i.kind === "card").length;
    const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));
    const onCards = this.dialogCursor < cards;
    switch (event.type) {
      case "pagePrev":
        if (onCards) this.dialogCursor = clamp(this.dialogCursor - 1);
        break;
      case "pageNext":
        if (onCards && this.dialogCursor + 1 < cards) this.dialogCursor++;
        break;
      case "prev":
        // From the first button back up to the card row; otherwise one button up.
        if (!onCards) this.dialogCursor = this.dialogCursor === cards ? Math.max(0, cards > 0 ? this.dialogOffset : 0) : this.dialogCursor - 1;
        break;
      case "next":
        if (onCards) {
          if (cards < items.length) this.dialogCursor = cards;
        } else this.dialogCursor = clamp(this.dialogCursor + 1);
        break;
      case "confirm":
        return this.pickDialog(items[this.dialogCursor]);
      case "select":
        this.dialogCursor = clamp(event.row);
        return event.confirm ? this.pickDialog(items[this.dialogCursor]) : null;
      case "cancel": {
        const pass = items.findIndex((i) => i.kind === "button" && PASS_LIKE.test(i.items[0]!.option.action.type));
        if (pass >= 0) this.dialogCursor = pass;
        break;
      }
      case "toggleLog":
      case "tabNext":
      case "tabPrev":
        this.dialogHidden = true;
        break;
      case "allActions":
        this.openList("すべての操作", this.allItems());
        break;
      default:
        break;
    }
    // Keep the focused card inside the visible window of the card rows.
    const per = this.dialogVisibleCards(cards);
    if (this.dialogCursor < cards) {
      if (this.dialogCursor < this.dialogOffset) this.dialogOffset = this.dialogCursor;
      if (this.dialogCursor >= this.dialogOffset + per) this.dialogOffset = this.dialogCursor - per + 1;
    }
    return null;
  }

  private pickDialog(item: DialogItem | undefined): StepResult | null {
    if (!item) return null;
    const title = item.kind === "card" ? this.instanceName(item.id) : item.items[0]!.option.label;
    return this.runItems(item.items, title);
  }

  private dispatchPopup(mode: Extract<Mode, { kind: "popup" }>, event: LogicalInput): StepResult | null {
    switch (event.type) {
      case "prev":
        mode.cursor.move(-1);
        return null;
      case "next":
        mode.cursor.move(1);
        return null;
      case "confirm":
        return this.runVerb(mode.verbs[mode.cursor.index]!);
      case "select": {
        const index = mode.cursor.rowToIndex(event.row);
        if (index < 0) return null;
        mode.cursor.index = index;
        return event.confirm ? this.runVerb(mode.verbs[index]!) : null;
      }
      case "cancel":
        this.mode = { kind: "board" };
        return null;
      case "menu":
        this.mode = { kind: "board" };
        return this.endPhase();
      case "allActions":
        this.openList("すべての操作", this.allItems());
        return null;
      case "focusTile":
        this.mode = { kind: "board" };
        return this.dispatchBoard(event);
      default:
        return null;
    }
  }

  private dispatchList(mode: Extract<Mode, { kind: "list" }>, event: LogicalInput): StepResult | null {
    switch (event.type) {
      case "prev":
        mode.cursor.move(-1);
        return null;
      case "next":
        mode.cursor.move(1);
        return null;
      case "pagePrev":
        mode.cursor.page(-1);
        return null;
      case "pageNext":
        mode.cursor.page(1);
        return null;
      case "confirm":
        return this.execute(mode.items[mode.cursor.index]!);
      case "select": {
        const index = mode.cursor.rowToIndex(event.row);
        if (index < 0) return null;
        mode.cursor.index = index;
        return event.confirm ? this.execute(mode.items[index]!) : null;
      }
      case "cancel":
        this.mode = { kind: "board" };
        return null;
      default:
        return null;
    }
  }

  private dispatchTarget(mode: Extract<Mode, { kind: "target" }>, event: LogicalInput): StepResult | null {
    const step = (delta: number) => {
      mode.cursor = (mode.cursor + delta + mode.targets.length) % mode.targets.length;
      const t = mode.targets[mode.cursor]!;
      this.setFocus(t.row, t.index);
    };
    switch (event.type) {
      case "prev":
      case "pagePrev":
        step(-1);
        return null;
      case "next":
      case "pageNext":
        step(1);
        return null;
      case "confirm": {
        const t = mode.targets[mode.cursor]!;
        return this.runItems(t.items, this.instanceName(t.id));
      }
      case "focusTile": {
        const row = this.rows[event.row];
        if (!row) return null;
        const id = row.tiles[(this.offsets.get(row.key) ?? 0) + event.slot]?.instanceId;
        const t = mode.targets.find((x) => x.id === id);
        if (!t) {
          this.mode = { kind: "board" };
          return null;
        }
        return this.runItems(t.items, this.instanceName(t.id));
      }
      case "cancel":
        this.mode = { kind: "board" };
        return null;
      default:
        return null;
    }
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

  // ------------------------------------------------------------ view helpers

  private cardName(cardId: string): string {
    return this.state().definitions[cardId]?.name ?? cardId;
  }

  private instanceName(id: string): string {
    const at = locateInstance(this.state(), id);
    return at ? this.cardName(at.card.cardId) : id;
  }

  private dialogRect(): Rect {
    const b = this.geometry.board;
    return { x: b.x + 4, y: b.y + 18, w: b.w - 8, h: 0 };
  }

  /** Cards the selection window shows at once: rows of cards while the board has room (a phone shows few per row). */
  private dialogVisibleCards(count: number): number {
    const per = this.dialogCardsPerRow();
    const g = this.geometry;
    const rowH = g.tileH + g.lineHeight + 2;
    const room = g.board.y + g.board.h - this.dialogRect().y - g.lineHeight * 6;
    const rows = Math.max(1, Math.min(3, Math.ceil(count / per), Math.floor(room / rowH)));
    return per * rows;
  }

  private dialogCardsPerRow(): number {
    return Math.max(1, Math.floor((this.dialogRect().w - 8 + this.geometry.tileGap) / (this.geometry.tileW + this.geometry.tileGap)));
  }

  private detailFor(cardId: string | null, hidden = false): string[] {
    if (hidden) return ["裏向きのカード"];
    if (!cardId) return [];
    const def = this.state().definitions[cardId];
    if (!def) return [cardId];
    const stats = [
      TYPE_LABELS[def.type] ?? def.type,
      def.powerCost !== undefined ? `P${def.powerCost}` : "",
      def.bp !== undefined ? `BP${def.bp}` : "",
      def.size ? `${def.size}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [def.name, `${def.id} ${stats}`, def.text ?? ""];
  }

  private boxRows(cursor: ListCursor, labels: string[], top: number, x: number, w: number, wrap: WrapOptions): MenuRowView[] {
    const g = this.geometry;
    const rows: MenuRowView[] = [];
    for (let r = 0; r < cursor.rows; r++) {
      const index = cursor.rowToIndex(r);
      if (index < 0) break;
      rows.push({
        text: fitLine(labels[index]!, wrap),
        selected: index === cursor.index,
        rect: { x, y: top + r * g.lineHeight, w, h: g.lineHeight },
      });
    }
    return rows;
  }

  // ------------------------------------------------------------ view

  view(): GuiView {
    this.sync();
    const g = this.geometry;
    const state = this.state();
    const mode = this.mode;
    const dialogShown = this.dialogShown();
    const dialogItems = this.dialogActive() ? this.dialogItems() : [];
    const targetIds = new Set<string>(
      mode.kind === "target"
        ? mode.targets.map((t) => t.id)
        : dialogItems.flatMap((i) => (i.kind === "card" ? [i.id] : [])),
    );
    const targeting = mode.kind === "target";

    const rows: GuiRowView[] = this.rows.map((row, r) => {
      const offset = this.offsets.get(row.key) ?? 0;
      const visible = row.tiles.slice(offset, offset + g.tilesPerRow);
      return {
        key: row.key,
        zone: row.zone,
        rect: g.rows[r]!,
        active: r === this.focusRow && !dialogShown,
        tiles: visible.map((tile, slot) => {
          const focused = !dialogShown && r === this.focusRow && offset + slot === this.focusIndex;
          const rect = tileRect(g, r, slot);
          const raised = focused && row.zone === "hand";
          return {
            ...tile,
            rect: raised ? { ...rect, y: rect.y - 3 } : rect,
            focused,
            targetable: targetIds.has(tile.instanceId),
            dimmed: targeting && !targetIds.has(tile.instanceId),
            raised,
          };
        }),
        moreLeft: offset,
        moreRight: Math.max(0, row.tiles.length - offset - visible.length),
      };
    });

    const wrapDetail: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.detailTextWidth };

    // --- selection window
    let dialog: GuiDialogView | undefined;
    const focused = this.focusedTile();
    let detailCard: { cardId: string | null; hidden: boolean } = {
      cardId: focused?.cardId ?? null,
      hidden: focused?.kind === "hidden",
    };
    if (dialogShown) {
      const base = this.dialogRect();
      const pending = buildPendingView(this.engine, state);
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: base.w - 8 };
      const titleTexts = pending
        ? [...wrapText(pending.title, { ...wrap, maxLines: 2 }), ...(pending.source ? [fitLine(`カード: ${pending.source}`, wrap)] : [])]
        : ["選択"];
      let y = base.y + 4;
      const titleLines: PanelLine[] = titleTexts.map((text, i) => {
        const line = { text, tone: (i === 0 ? "accent" : "dim") as PanelTone, rect: { x: base.x + 4, y, w: base.w - 8, h: g.lineHeight } };
        y += g.lineHeight;
        return line;
      });
      const cardItems = dialogItems.filter((i): i is Extract<DialogItem, { kind: "card" }> => i.kind === "card");
      const buttonItems = dialogItems.filter((i) => i.kind === "button");
      const per = this.dialogCardsPerRow();
      const visible = this.dialogVisibleCards(cardItems.length);
      const cards: GuiDialogView["cards"] = [];
      const fitTile: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.tileW - 4 };
      if (cardItems.length > 0) {
        y += 2;
        const shown = cardItems.slice(this.dialogOffset, this.dialogOffset + visible);
        shown.forEach((item, slot) => {
          const at = locateInstance(state, item.id)!;
          const tile = cardTile(this.engine, state, at.player, at.zone, at.card, fitTile, true, false);
          const index = this.dialogOffset + slot;
          const rect = { x: base.x + 4 + (slot % per) * (g.tileW + g.tileGap), y: y + Math.floor(slot / per) * (g.tileH + g.lineHeight + 2), w: g.tileW, h: g.tileH };
          cards.push({
            ...tile,
            rect,
            focused: index === this.dialogCursor,
            caption: clipLine(`${at.player === HUMAN ? "自" : "敵"}${zoneLabel(at.zone)}`, fitTile),
            captionRect: { x: rect.x, y: rect.y + rect.h, w: rect.w, h: g.lineHeight },
          });
          if (index === this.dialogCursor) detailCard = { cardId: tile.kind === "hidden" ? null : at.card.cardId, hidden: tile.kind === "hidden" };
        });
        y += Math.ceil(shown.length / per) * (g.tileH + g.lineHeight + 2);
      }
      const cursor = new ListCursor();
      // As many buttons as the board has room for (a number choice can offer 0〜9 and 選ばない), at least DIALOG_BUTTONS.
      const board = this.geometry.board;
      cursor.reset(buttonItems.length, Math.max(DIALOG_BUTTONS, Math.floor((board.y + board.h - y - 8) / g.lineHeight)));
      const buttonCursor = this.dialogCursor - cardItems.length;
      if (buttonCursor >= 0) {
        cursor.index = buttonCursor;
        cursor.move(0);
      }
      const buttons = this.boxRows(cursor, buttonItems.map((i) => i.items[0]!.option.label), y, base.x + 4, base.w - 8, wrap).map(
        (row) => ({ ...row, selected: row.selected && buttonCursor >= 0 }),
      );
      y += buttons.length * g.lineHeight + 4;
      if (buttonCursor >= 0 || cardItems.length === 0) {
        const sourceId = state.pendingEffectChoice?.sourceCardId ?? state.pendingCommandPayment?.sourceCardId ?? null;
        detailCard = { cardId: sourceId, hidden: false };
      }
      dialog = {
        rect: { ...base, h: y - base.y },
        titleLines,
        cards,
        buttons,
        buttonOffset: cursor.offset,
        moreLeft: this.dialogOffset,
        moreRight: Math.max(0, cardItems.length - this.dialogOffset - visible),
      };
    }

    // --- detail panel (left)
    const detailLines: PanelLine[] = [];
    let detailArt: GuiView["detailArt"];
    let lineY = g.detail.y + 3;
    let textX = g.detail.x + 4;
    let textW = g.detail.w - 6;
    const detailBottom = g.detail.y + g.detail.h - 2;
    const pushDetail = (tone: PanelTone, texts: string[]) => {
      for (const text of texts) {
        if (lineY + g.lineHeight > detailBottom) return;
        detailLines.push({ text, tone, rect: { x: textX, y: lineY, w: textW, h: g.lineHeight } });
        lineY += g.lineHeight;
      }
    };
    if (this.showLog && !dialogShown) {
      const lines = this.session.log.slice(-g.detailLines * 2).flatMap((l) => wrapText(l, wrapDetail));
      pushDetail("dim", ["── ログ ──"]);
      pushDetail("body", lines.slice(-(g.detailLines - 1)));
    } else {
      const [name, stats, text] = this.detailFor(detailCard.cardId, detailCard.hidden);
      if (this.cardArt && (detailCard.cardId || detailCard.hidden)) {
        // Card image on the left, its stats one per line beside it. A wide,
        // short panel (phone portrait) puts all of the text beside the image.
        const beside = isWideDetail(g.detail);
        const artW = beside ? detailArtWidth(g.detail) : Math.round(g.detail.w * 0.5);
        const rect = { x: g.detail.x + 4, y: g.detail.y + 4, w: artW, h: Math.round((artW * 190) / 130) };
        detailArt = { cardId: detailCard.cardId ?? "", hidden: detailCard.hidden, rect };
        const sideX = rect.x + rect.w + 4;
        const sideW = g.detail.x + g.detail.w - sideX - 2;
        if (beside) {
          textX = sideX;
          textW = sideW;
          lineY = rect.y;
          const wrapSide: WrapOptions = { ...wrapDetail, maxWidthPx: sideW };
          if (name) pushDetail("head", wrapText(name, { ...wrapSide, maxLines: 1 }));
          if (stats) pushDetail("dim", wrapText(stats, { ...wrapSide, maxLines: 1 }));
          if (text) pushDetail("body", wrapText(text, wrapSide));
        } else {
          const tokens = stats ? stats.split(" ") : [];
          tokens.slice(0, Math.floor(rect.h / g.lineHeight)).forEach((token, i) => {
            detailLines.push({
              text: fitLine(token, { fontPx: g.fontPx, maxWidthPx: sideW }),
              tone: i === 0 ? "dim" : "body",
              rect: { x: sideX, y: rect.y + i * g.lineHeight, w: sideW, h: g.lineHeight },
            });
          });
          lineY = rect.y + rect.h + 3;
          if (name) pushDetail("head", wrapText(name, { ...wrapDetail, maxLines: 2 }));
          if (text) pushDetail("body", wrapText(text, wrapDetail));
        }
      } else {
        if (name) pushDetail("head", wrapText(name, { ...wrapDetail, maxLines: 2 }));
        if (stats) pushDetail("dim", wrapText(stats, { ...wrapDetail, maxLines: 2 }));
        if (text) pushDetail("body", wrapText(text, wrapDetail));
      }
    }

    // --- popup / list
    let popup: GuiBox | undefined;
    let list: GuiBox | undefined;
    if (mode.kind === "popup") {
      // Fit the widest row, between a small card-sized popup and the whole board.
      const widest = Math.max(...[mode.title, ...mode.verbs.map((v) => v.label)].map((t) => measureText(t, g.fontPx)));
      const w = Math.min(g.board.w, Math.max(110, Math.ceil(widest) + 12));
      const rowsShown = Math.min(mode.verbs.length, POPUP_ROWS);
      const h = (rowsShown + 1) * g.lineHeight + 4;
      const a = mode.anchor;
      const below = a.y + a.h + 2;
      const above = a.y - h - 2;
      const y = a.y < g.board.y + g.board.h / 2 ? Math.min(below, g.footer.y - h) : Math.max(g.board.y, above);
      const x = Math.max(g.board.x, Math.min(a.x, g.side.x + g.side.w - w - 2));
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: w - 8 };
      popup = {
        rect: { x, y, w, h },
        title: fitLine(mode.title, wrap),
        titleRect: { x: x + 4, y: y + 2, w: w - 8, h: g.lineHeight },
        rows: this.boxRows(mode.cursor, mode.verbs.map((v) => v.label), y + 2 + g.lineHeight, x + 4, w - 8, wrap),
      };
    } else if (mode.kind === "list") {
      const b = g.board;
      const rowsShown = Math.min(mode.items.length, LIST_ROWS);
      const h = (rowsShown + 1) * g.lineHeight + 6;
      const rect = { x: b.x + 4, y: Math.max(b.y + 2, b.y + Math.floor((b.h - h) / 2)), w: b.w - 8, h };
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: rect.w - 8 };
      list = {
        rect,
        title: fitLine(`${mode.title} ${mode.cursor.index + 1}/${mode.items.length}`, wrap),
        titleRect: { x: rect.x + 4, y: rect.y + 3, w: rect.w - 8, h: g.lineHeight },
        rows: this.boxRows(mode.cursor, mode.labels, rect.y + 3 + g.lineHeight, rect.x + 4, rect.w - 8, wrap),
      };
    }

    // --- side column and hints
    const primary = this.primaryItem();
    const endEnabled = primary !== undefined;
    const endsPhase = primary?.option.action.type === "end_phase";
    const phaseLabel = PHASE_LABELS[state.phase] ?? state.phase;
    const footer =
      mode.kind === "target"
        ? `${mode.prompt}（十字:切替 ○:決定 ×:やめる）`
        : mode.kind === "popup" || mode.kind === "list"
          ? "↑↓:選ぶ ○:決定 ×:閉じる"
          : dialogShown
            ? "十字:選ぶ ○:決定 ×:パスへ L:盤面を見る △:全操作"
            : this.dialogActive()
              ? "盤面を確認中（L / × / R で選択ウィンドウに戻る）"
              : !this.humanActive()
                ? "CPU の手番"
                : "十字:カード ○:操作 R:フェイズ終了 ×:全体 L:ログ △:全操作";

    return {
      geometry: g,
      topBar: fitLine(topBarText(state), { fontPx: g.fontPx, maxWidthPx: g.width * 0.4 }),
      toast: this.toastFrames > 0 ? fitLine(this.toastText, { fontPx: g.fontPx, maxWidthPx: g.width * 0.58 }) : "",
      phases: PHASE_ORDER.map((phase, i) => ({ label: PHASE_LABELS[phase] ?? phase, active: phase === state.phase, rect: g.phaseRects[i]! })),
      endButton: {
        lines: endEnabled
          ? endsPhase
            ? [clipLine(phaseLabel, { fontPx: g.fontPx, maxWidthPx: g.endButton.w - 2 }), "終了", "R"]
            : [...wrapText(primary!.option.label, { fontPx: g.fontPx, maxWidthPx: g.endButton.w - 2 }).slice(0, 2), "R"]
          : state.activePlayer === CPU
            ? ["CPU", "の番", ""]
            : ["", "×:操作", ""],
        enabled: endEnabled,
        rect: g.endButton,
      },
      strips: [
        fitLine(playerStrip(this.engine, state, CPU), { fontPx: g.fontPx, maxWidthPx: g.strips[0].w - 8 }),
        fitLine(playerStrip(this.engine, state, HUMAN), { fontPx: g.fontPx, maxWidthPx: g.strips[1].w - 8 }),
      ],
      rows,
      detailLines,
      detailArt,
      popup,
      list,
      dialog,
      footer: fitLine(footer, { fontPx: g.fontPx, maxWidthPx: g.footer.w - 8 }),
      footerAccent: mode.kind === "target" || dialogShown,
      menuOpen: mode.kind !== "board" || dialogShown,
    };
  }
}

/**
 * Labels of a verb's variants without the start they all share (card name,
 * verb), cut at the last bracket or separator inside it:
 * "コマンドを支払って使う: A / B（種類:カテゴリ・捨札）" → "（種類:カテゴリ・捨札）".
 */
export function variantLabels(labels: string[]): string[] {
  if (labels.length < 2) return labels;
  let common = labels[0]!;
  for (const label of labels) {
    let n = 0;
    while (n < common.length && n < label.length && common[n] === label[n]) n++;
    common = common.slice(0, n);
  }
  const at = (sep: string, skip: number) => {
    const i = common.lastIndexOf(sep);
    return i < 0 ? -1 : i + skip;
  };
  const cut = Math.max(at("（", 0), at(": ", 1), at(" / ", 2));
  if (cut <= 0) return labels;
  const short = labels.map((label) => label.slice(cut).trim());
  // Rows that still read the same get their cards' places added (placeDuplicates).
  return short.some((label) => label.length === 0) || new Set(short).size < new Set(labels).size ? labels : short;
}

/**
 * A popup row without the card name its title already shows. Only the whole
 * name goes: "ラッシュ: アバレッドAM / アバレッド" on アバレッド's popup stays as is.
 */
export function dropCardName(label: string, name: string): string {
  const at = label.indexOf(`: ${name}`);
  if (at < 0) return label;
  const end = at + 2 + name.length;
  if (end < label.length && !/[\s（(→/]/.test(label[end]!)) return label;
  return (label.slice(0, at) + label.slice(end)).trim() || label;
}
