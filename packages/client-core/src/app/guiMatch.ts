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
import { ACTION_LABELS, PHASE_LABELS, revealDestination, revealSummary } from "../text/labels";
import { cardFieldLines, effectParagraphs } from "../view/cardFields";
import { clipLine, fitLine, fitLineKeepTail, measureText, wrapText, type WrapOptions } from "../text/wrap";
import { buildPendingView, viewedCardIds } from "../view/board";
import { assistMove, DEFAULT_ASSIST, endTurnMove, type AssistSettings } from "./assist";
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
  rowFit,
  rowMaxOffset,
  rowTileRects,
  rowTiles,
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

/** A tappable "more above / below" mark of a window that shows only part of its cards or rows. */
export type ScrollMark = { text: string; rect: Rect; area: "cards" | "rows"; direction: 1 | -1 };

export type GuiBox = { rect: Rect; title: string; titleRect: Rect; rows: MenuRowView[]; marks?: ScrollMark[] };

export type GuiDialogView = {
  rect: Rect;
  titleLines: PanelLine[];
  /** `note`: a caption that is not where the card is (「見ている」, a revealed card's destination); the card can't be picked. */
  cards: (GuiTile & { rect: Rect; focused: boolean; caption: string; captionRect: Rect; note?: string })[];
  buttons: MenuRowView[];
  /** Index of the first visible button among all buttons. */
  buttonOffset: number;
  moreLeft: number;
  moreRight: number;
  marks: ScrollMark[];
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
  /** The detail panel cut the card's text: the whole of it, for a shell to show on request. */
  detailFull?: { name: string; fields: string[]; text: string };
  popup?: GuiBox;
  list?: GuiBox;
  dialog?: GuiDialogView;
  footer: string;
  footerAccent: boolean;
  /** Any overlay (popup / list / dialog / targeting) has the input. */
  menuOpen: boolean;
  /** The popup asks what the unit that just entered the battle area does: a tap on a lit enemy unit attacks it. */
  battleEntry: boolean;
  /** The popup lists the start phase's steps (opened on its own when the phase begins). */
  startPhase: boolean;
  /** The detail panel shows the log, not a card. */
  logShown: boolean;
};

type MenuItem = { option: ActionOption; index: number };
type Verb = { label: string; items: MenuItem[] };
type Target = { id: string; row: number; index: number; items: MenuItem[] };

type Mode =
  | { kind: "board" }
  | {
      kind: "popup";
      title: string;
      anchor: Rect;
      verbs: Verb[];
      cursor: ListCursor;
      /** The unit that just entered the battle area: its attack / strike / pass, asked once (entryPopup). */
      entry?: string;
      /** The start phase's steps, asked once when the phase begins and assist leaves a choice (askStartPhase). */
      start?: boolean;
    }
  | { kind: "target"; prompt: string; targets: Target[]; cursor: number }
  | { kind: "list"; title: string; items: MenuItem[]; labels: string[]; cursor: ListCursor };

type DialogItem = { kind: "card"; id: string; items: MenuItem[] } | { kind: "button"; items: MenuItem[] };

const BOARD_MOVES = new Set(["battle", "strike", "pass_battle_entry", "move_to_battle", "end_phase", "charge_power", "rush"]);
const PASS_LIKE = /^(pass_|skip_|cancel_|end_phase$)/;
/** Drag and drop: the moves a card dropped on a zone (not on a card) can mean. */
const DROP_ZONES: Record<string, (action: GameAction) => boolean> = {
  [`${HUMAN}:rush`]: (a) => a.type === "rush" || (a.type === "initiate_command_payment" && a.kind === "category_use"),
  [`${HUMAN}:battle`]: (a) => a.type === "move_to_battle" || (a.type === "initiate_command_payment" && a.kind === "battle_entry"),
  [`${HUMAN}:command`]: (a) => a.type === "charge_command",
  [`${HUMAN}:power`]: (a) => a.type === "charge_power",
  [`${CPU}:rush`]: (a) => a.type === "battle" || a.type === "strike",
  [`${CPU}:battle`]: (a) => a.type === "battle" || a.type === "strike",
  [`${CPU}:command`]: (a) => a.type === "strike",
};
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
  /** Buttons the selection window showed at once (a page for scrolling them). */
  private dialogButtonRows = DIALOG_BUTTONS;
  /** Seq of the last reveal notice (GameState.lastReveal) shown; a newer one opens the reveal window. */
  private revealSeen: number;
  private revealOpen: NonNullable<GameState["lastReveal"]> | null = null;
  /** A card the shell points at outside the board rows (a discard or power zone card): shown in the detail panel. */
  inspectCardId: string | null = null;
  private showLog = false;
  private syncedVersion = -1;
  private toastText = "";
  private toastFrames = 0;
  /** Moves the GUI makes for the human on its own (assist.ts). */
  assist: AssistSettings = { ...DEFAULT_ASSIST };
  /** Turn number the "end turn" button was pressed on, while it is still ending phases. */
  private endTurnOn: number | null = null;
  /** Session version the battle-entry popup was opened on (it opens once per entry; closed, the board plays as before). */
  private entryAsked = -1;
  /** Session version the start-phase popup was opened on (it opens again after each step). */
  private startAsked = -1;

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
    this.revealSeen = session.state.lastReveal?.seq ?? 0;
  }

  /** A reveal window is open: the controller holds CPU and assist moves until it is closed. */
  get revealShown(): boolean {
    this.sync();
    return this.revealOpen !== null;
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
    const reveal = this.state().lastReveal;
    if (reveal && reveal.seq > this.revealSeen) {
      this.revealSeen = reveal.seq;
      this.revealOpen = reveal;
    }
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
    this.askBattleEntry();
    this.askStartPhase();
  }

  /**
   * The human's start phase leaves a choice (start-phase abilities, the order battle units
   * return in, or every step with 自動進行 for the start phase off): its steps open as a popup
   * by the end button, without a tap on the button first, and again after each step; closed, the
   * board plays as before until the next step. Not while the end-turn button, a reveal or a selection window runs.
   */
  private askStartPhase(): void {
    const state = this.state();
    if (state.phase !== "start" || state.activePlayer !== HUMAN || this.startAsked === this.session.version) return;
    if (this.mode.kind !== "board" || this.endTurnOn !== null || this.revealOpen || !this.humanActive() || this.dialogActive()) return;
    const options = this.options();
    if (!options.some((o) => o.action.type !== "end_phase")) return;
    // The move assist makes on its own comes first; the popup waits for a real choice.
    if (assistMove(state, options, this.assist) !== null) return;
    this.startAsked = this.session.version;
    this.openStartPopup();
  }

  private openStartPopup(): void {
    const rank = (item: MenuItem) => (item.option.action.type === "end_phase" ? 1 : 0);
    const verbs = [...this.allItems()].sort((a, b) => rank(a) - rank(b)).map((item) => ({ label: item.option.label, items: [item] }));
    this.openPopup("スタートフェイズ", this.geometry.endButton, verbs);
    if (this.mode.kind === "popup") this.mode.start = true;
  }

  /**
   * A unit of the human's just entered the battle area: its one decision (attack, strike or
   * nothing) opens as a popup by the unit, without a tap on it first. Not while the end-turn
   * button or a reveal window runs, and not when passing is all there is (assist plays that).
   */
  private askBattleEntry(): void {
    const pending = this.state().pendingBattleEntry;
    if (!pending || pending.playerId !== HUMAN || this.entryAsked === this.session.version) return;
    if (this.mode.kind !== "board" || this.endTurnOn !== null || this.revealOpen || !this.humanActive()) return;
    if (!this.options().some((o) => o.action.type !== "pass_battle_entry")) return;
    const at = this.findTile(pending.instanceId);
    if (!at) return;
    this.entryAsked = this.session.version;
    this.setFocus(at.row, at.index);
    this.openEntryPopup(pending.instanceId);
  }

  private openEntryPopup(instanceId: string): void {
    const name = this.instanceName(instanceId);
    const verbs = this.cardVerbs(instanceId).map((verb) => {
      const type = verb.items[0]!.option.action.type;
      if (type === "battle" && verb.items.length > 1) return { ...verb, label: "アタック（相手を選ぶ）" };
      return { ...verb, label: dropCardName(verb.label, name) };
    });
    const rank = (verb: Verb) => ["battle", "strike"].indexOf(verb.items[0]!.option.action.type) >>> 0;
    verbs.sort((a, b) => rank(a) - rank(b));
    const pass = this.allItems().find((item) => item.option.action.type === "pass_battle_entry");
    if (pass) verbs.push({ label: "何もしない", items: [pass] });
    this.openPopup(`${name}がバトルエリアへ`, this.focusedRect(), verbs);
    if (this.mode.kind === "popup") this.mode.entry = instanceId;
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
    let offset = this.offsets.get(key) ?? 0;
    if (this.focusIndex < offset) offset = this.focusIndex;
    while (this.focusIndex >= offset + rowFit(this.geometry, row, tiles, offset)) offset++;
    offset = Math.max(0, Math.min(offset, rowMaxOffset(this.geometry, row, tiles)));
    this.offsets.set(key, offset);
  }

  /**
   * Shows the cards of board row `row` that are `delta` cards further right (left when negative):
   * a swipe over the row, or a tap on its ‹n / n› mark. A focus in the row stays on a shown card.
   */
  scrollRow(row: number, delta: number): boolean {
    this.sync();
    const target = this.rows[row];
    if (!target) return false;
    const before = this.offsets.get(target.key) ?? 0;
    const offset = Math.max(0, Math.min(before + delta, rowMaxOffset(this.geometry, row, target.tiles)));
    if (offset === before) return false;
    this.offsets.set(target.key, offset);
    if (this.focusRow === row && target.tiles.length > 0) {
      this.focusIndex = Math.max(offset, Math.min(this.focusIndex, offset + rowFit(this.geometry, row, target.tiles, offset) - 1));
      this.focusedId = target.tiles[this.focusIndex]!.instanceId;
    }
    return true;
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
    return this.pendingView() !== null && options.length > 0;
  }

  /**
   * What the selection window asks. Besides the engine's pending decisions, the
   * start-phase bonus draw is asked here: on the board it was only a menu behind
   * the end button and easy to miss (more so once the draw before it is automatic).
   */
  private pendingView(): { title: string; source?: string } | null {
    const pending = buildPendingView(this.engine, this.state());
    if (pending) return pending;
    if (this.options().some((o) => o.action.type === "bonus_draw")) {
      const p = this.state().players[HUMAN];
      return { title: `追加ドロー: 手札（${p.hand.length}枚）がダメージ（${p.damage}）より少ないので、もう1枚引けます` };
    }
    return null;
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
    // Deck cards the choice is about ("山札の上から1枚を見る"): shown first, only to look at.
    const viewed = viewedCardIds(this.state())
      .filter((id) => !cards.has(id))
      .map((id) => ({ kind: "card" as const, id, items: [] as MenuItem[] }));
    return [...viewed, ...[...cards].map(([id, items]) => ({ kind: "card" as const, id, items })), ...buttons, ...pass];
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
    if (!row) return tileRect(this.geometry, this.focusRow, 0);
    const visible = row.tiles.slice(offset, offset + rowFit(this.geometry, this.focusRow, row.tiles, offset));
    return rowTileRects(this.geometry, this.focusRow, visible)[this.focusIndex - offset] ?? tileRect(this.geometry, this.focusRow, this.focusIndex - offset);
  }

  private openCardPopup(): void {
    const tile = this.focusedTile();
    const pending = this.state().pendingBattleEntry;
    if (tile && pending?.playerId === HUMAN && tile.instanceId === pending.instanceId && this.humanActive()) {
      this.openEntryPopup(tile.instanceId);
      return;
    }
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

  // ------------------------------------------------------------ automatic moves

  /** The "end turn" button: ends phases and passes battle entries until the turn is over or a choice comes up. */
  requestEndTurn(): void {
    if (!this.humanActive() || this.state().activePlayer !== HUMAN) {
      this.message = "自分のターンではありません";
      return;
    }
    this.mode = { kind: "board" };
    this.endTurnOn = this.state().turn;
  }

  /** The "end turn" button is still working. */
  get endingTurn(): boolean {
    return this.endTurnOn !== null;
  }

  /**
   * The move the GUI would make for the human now (assist settings, the end-turn
   * button), or null. Nothing happens while a popup, list or targeting is open.
   */
  private autoItem(): { item: MenuItem; endTurn: boolean } | null {
    if (!this.humanActive() || this.mode.kind !== "board") return null;
    const options = this.options();
    if (this.endTurnOn !== null) {
      const index = this.state().turn === this.endTurnOn ? endTurnMove(this.state(), options) : null;
      if (index !== null) return { item: { option: options[index]!, index }, endTurn: true };
      if (this.state().turn === this.endTurnOn) this.message = "ターン終了を止めました: 選ぶ操作があります";
      this.endTurnOn = null;
    }
    const index = assistMove(this.state(), options, this.assist);
    return index === null ? null : { item: { option: options[index]!, index }, endTurn: false };
  }

  /** There is a move the GUI will make on its own (the controller paces it like a CPU move). */
  hasAutoMove(): boolean {
    this.sync();
    return this.autoItem() !== null;
  }

  /** Makes that move. */
  autoMove(): StepResult | null {
    this.sync();
    const auto = this.autoItem();
    if (!auto) return null;
    const result = this.execute(auto.item);
    if (result.ok) this.message = `自動: ${result.label}`;
    else this.endTurnOn = null;
    return result;
  }

  /**
   * Drag and drop: `fromId` (a card the human can act with) dropped on a card
   * (`to.instanceId`) or a zone (`to.zone`: a row key such as "player1:battle",
   * or "player1:power"). The moves of that card that fit the drop run as if
   * picked from its popup; several of them open the list to pick from.
   */
  dropCard(fromId: string, to: { instanceId?: string; zone?: string }): StepResult | null {
    this.sync();
    if (!this.humanActive() || this.dialogShown()) return null;
    this.mode = { kind: "board" };
    const own = this.allItems().filter((item) => actionSubjectId(item.option.action) === fromId);
    const onCard = to.instanceId && to.instanceId !== fromId ? own.filter((item) => actionInstanceIds(item.option.action).includes(to.instanceId!)) : [];
    const fits = DROP_ZONES[to.zone ?? ""];
    const items = onCard.length > 0 ? onCard : fits ? own.filter((item) => fits(item.option.action)) : [];
    if (items.length === 0) {
      if (own.length > 0) this.message = "そこへは動かせません";
      return null;
    }
    const at = this.findTile(fromId);
    if (at) this.setFocus(at.row, at.index);
    if (items.length === 1) return this.execute(items[0]!);
    this.openList(this.instanceName(fromId), items, true);
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
    if (this.revealOpen) return this.dispatchReveal(event);
    if (this.dialogShown()) return this.dispatchDialog(event);
    return this.dispatchBoard(event);
  }

  /** The reveal window closes on a tap, ○ or ×; other input waits until it does. */
  private dispatchReveal(event: LogicalInput): StepResult | null {
    if (event.type === "confirm" || event.type === "cancel" || event.type === "select") {
      this.revealOpen = null;
      this.askBattleEntry();
      this.askStartPhase();
    }
    return null;
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
      case "scroll":
        if (event.area === "cards" && cards > 0) {
          // A page of cards: the first card of the next (previous) page gets the cursor.
          const page = this.dialogVisibleCards(cards);
          const from = onCards ? this.dialogOffset : 0;
          this.dialogCursor = Math.max(0, Math.min(cards - 1, from + event.direction * page));
          this.dialogOffset = Math.max(0, Math.min(this.dialogCursor, Math.max(0, cards - page)));
          if (event.direction < 0) this.dialogCursor = this.dialogOffset;
          return null;
        }
        if (event.area === "rows" && items.length > cards) {
          const button = onCards ? 0 : this.dialogCursor - cards;
          this.dialogCursor = cards + Math.max(0, Math.min(items.length - cards - 1, button + event.direction * this.dialogButtonRows));
        }
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
    if (!item || item.items.length === 0) return null;
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
      case "scroll":
        mode.cursor.page(event.direction);
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
      case "focusTile": {
        // The battle-entry popup leaves the attack targets lit on the board: a tap on one attacks it.
        const row = this.rows[event.row];
        const id = row?.tiles[(this.offsets.get(row.key) ?? 0) + event.slot]?.instanceId;
        // Pointing at a card (mouse hover) shows it in the detail panel and keeps the popup.
        if ((mode.entry || mode.start) && !event.open) {
          if (id) this.setFocus(event.row, (this.offsets.get(row!.key) ?? 0) + event.slot);
          return null;
        }
        const attacks = mode.entry && id ? this.attackItems(mode.entry, id) : [];
        if (attacks.length > 0) return this.runItems(attacks, this.instanceName(id!));
        this.mode = { kind: "board" };
        return this.dispatchBoard(event);
      }
      default:
        return null;
    }
  }

  private attackItems(attackerId: string, defenderId: string): MenuItem[] {
    return this.allItems().filter((item) => {
      const a = item.option.action;
      return a.type === "battle" && a.attackerInstanceId === attackerId && a.defenderInstanceId === defenderId;
    });
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
      case "scroll":
        mode.cursor.page(event.direction);
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

  /** Name, one-line stats, text, and the wiki-style attribute lines (cardFieldLines). */
  private detailFor(cardId: string | null, hidden = false): { name: string; stats: string; text: string; fields: string[] } {
    const empty = { name: "", stats: "", text: "", fields: [] as string[] };
    if (hidden) return { ...empty, name: "裏向きのカード" };
    if (!cardId) return empty;
    const def = this.state().definitions[cardId];
    if (!def) return { ...empty, name: cardId };
    const stats = [
      TYPE_LABELS[def.type] ?? def.type,
      def.powerCost !== undefined ? `P${def.powerCost}` : "",
      def.bp !== undefined ? `BP${def.bp}` : "",
      def.size ? `${def.size}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return { name: def.name, stats: `${def.id} ${stats}`, text: effectParagraphs(def.text ?? ""), fields: cardFieldLines(def) };
  }

  private boxRows(cursor: ListCursor, labels: string[], top: number, x: number, w: number, wrap: WrapOptions): MenuRowView[] {
    const g = this.geometry;
    const rows: MenuRowView[] = [];
    for (let r = 0; r < cursor.rows; r++) {
      const index = cursor.rowToIndex(r);
      if (index < 0) break;
      rows.push({
        text: fitLineKeepTail(labels[index]!, wrap),
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
    const reveal = this.revealOpen;
    const dialogShown = this.dialogShown() && !reveal;
    const dialogItems = this.dialogActive() ? this.dialogItems() : [];
    const targetIds = new Set<string>(
      mode.kind === "target"
        ? mode.targets.map((t) => t.id)
        : dialogItems.flatMap((i) => (i.kind === "card" ? [i.id] : [])),
    );
    const targeting = mode.kind === "target";

    const rows: GuiRowView[] = this.rows.map((row, r) => {
      const offset = this.offsets.get(row.key) ?? 0;
      const visible = row.tiles.slice(offset, offset + rowFit(g, r, row.tiles, offset));
      const rects = rowTileRects(g, r, visible);
      return {
        key: row.key,
        zone: row.zone,
        rect: g.rows[r]!,
        active: r === this.focusRow && !dialogShown,
        tiles: visible.map((tile, slot) => {
          const focused = !dialogShown && r === this.focusRow && offset + slot === this.focusIndex;
          const rect = rects[slot]!;
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
      const pending = this.pendingView();
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
      const marks: ScrollMark[] = [];
      const fitTile: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.tileW - 4 };
      if (cardItems.length > 0) {
        y += 2;
        const shown = cardItems.slice(this.dialogOffset, this.dialogOffset + visible);
        shown.forEach((item, slot) => {
          const at = locateInstance(state, item.id)!;
          const viewing = item.items.length === 0;
          // A card the human is looking at is face up to them, even from the enemy deck.
          const tile = cardTile(this.engine, state, viewing ? HUMAN : at.player, at.zone, at.card, fitTile, !viewing, false);
          const index = this.dialogOffset + slot;
          const rect = { x: base.x + 4 + (slot % per) * (g.tileW + g.tileGap), y: y + Math.floor(slot / per) * (g.tileH + g.lineHeight + 2), w: g.tileW, h: g.tileH };
          cards.push({
            ...tile,
            rect,
            focused: index === this.dialogCursor,
            caption: clipLine(viewing ? "見ている" : `${at.player === HUMAN ? "自" : "敵"}${zoneLabel(at.zone)}`, fitTile),
            ...(viewing ? { note: "見ている" } : {}),
            captionRect: { x: rect.x, y: rect.y + rect.h, w: rect.w, h: g.lineHeight },
          });
          if (index === this.dialogCursor) detailCard = { cardId: tile.kind === "hidden" ? null : at.card.cardId, hidden: tile.kind === "hidden" };
        });
        y += Math.ceil(shown.length / per) * (g.tileH + g.lineHeight + 2);
        const moreRight = Math.max(0, cardItems.length - this.dialogOffset - visible);
        if (this.dialogOffset > 0 || moreRight > 0) {
          marks.push(...scrollMarks("cards", this.dialogOffset, moreRight, "枚", { x: base.x + 4, y, w: base.w - 8, h: g.lineHeight }));
          y += g.lineHeight + 2;
        }
      }
      const cursor = new ListCursor();
      // As many buttons as the board has room for (a number choice can offer 0〜9 and 選ばない), at least DIALOG_BUTTONS.
      const board = this.geometry.board;
      const room = Math.max(DIALOG_BUTTONS, Math.floor((board.y + board.h - y - 8) / g.lineHeight));
      // A line for the ▲▼ marks when the buttons don't all fit.
      cursor.reset(buttonItems.length, buttonItems.length > room ? room - 1 : room);
      this.dialogButtonRows = cursor.rows;
      const buttonCursor = this.dialogCursor - cardItems.length;
      if (buttonCursor >= 0) {
        cursor.index = buttonCursor;
        cursor.move(0);
      }
      const buttons = this.boxRows(cursor, buttonItems.map((i) => i.items[0]!.option.label), y, base.x + 4, base.w - 8, wrap).map(
        (row) => ({ ...row, selected: row.selected && buttonCursor >= 0 }),
      );
      y += buttons.length * g.lineHeight;
      const below = Math.max(0, buttonItems.length - cursor.offset - cursor.rows);
      if (cursor.offset > 0 || below > 0) {
        marks.push(...scrollMarks("rows", cursor.offset, below, "件", { x: base.x + 4, y, w: base.w - 8, h: g.lineHeight }));
        y += g.lineHeight;
      }
      y += 4;
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
        marks,
      };
    }

    // --- reveal window: cards an effect turned face up, for both players to see
    if (reveal) {
      const base = this.dialogRect();
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: base.w - 8 };
      let y = base.y + 4;
      const titleLines: PanelLine[] = wrapText(revealSummary(state, reveal), { ...wrap, maxLines: 2 }).map((text, i) => {
        const line = { text, tone: (i === 0 ? "accent" : "dim") as PanelTone, rect: { x: base.x + 4, y, w: base.w - 8, h: g.lineHeight } };
        y += g.lineHeight;
        return line;
      });
      const per = this.dialogCardsPerRow();
      const shown = reveal.cards.slice(0, this.dialogVisibleCards(reveal.cards.length));
      const fitTile: WrapOptions = { fontPx: g.fontPx, maxWidthPx: g.tileW - 4 };
      y += 2;
      const cards: GuiDialogView["cards"] = shown.map((card, slot) => {
        const tile = cardTile(this.engine, state, HUMAN, "revealed", { instanceId: card.instanceId, cardId: card.cardId } as never, fitTile, false, false);
        const rect = { x: base.x + 4 + (slot % per) * (g.tileW + g.tileGap), y: y + Math.floor(slot / per) * (g.tileH + g.lineHeight + 2), w: g.tileW, h: g.tileH };
        const note = revealDestination(card.destination);
        return { ...tile, rect, focused: slot === 0, caption: clipLine(note, fitTile), note, captionRect: { x: rect.x, y: rect.y + rect.h, w: rect.w, h: g.lineHeight } };
      });
      if (shown[0]) detailCard = { cardId: shown[0].cardId, hidden: false };
      y += Math.ceil(shown.length / per) * (g.tileH + g.lineHeight + 2);
      const buttons: MenuRowView[] = [{ text: "閉じる", selected: true, rect: { x: base.x + 4, y, w: base.w - 8, h: g.lineHeight } }];
      y += g.lineHeight + 4;
      dialog = { rect: { ...base, h: y - base.y }, titleLines, cards, buttons, buttonOffset: 0, moreLeft: 0, moreRight: Math.max(0, reveal.cards.length - shown.length), marks: [] };
    }

    if (this.inspectCardId && !reveal && !dialogShown) detailCard = { cardId: this.inspectCardId, hidden: false };

    // --- detail panel (left)
    const detailLines: PanelLine[] = [];
    let detailArt: GuiView["detailArt"];
    let lineY = g.detail.y + 3;
    let textX = g.detail.x + 4;
    let textW = g.detail.w - 6;
    const detailBottom = g.detail.y + g.detail.h - 2;
    let detailClipped = false;
    const pushDetail = (tone: PanelTone, texts: string[]) => {
      for (const text of texts) {
        if (lineY + g.lineHeight > detailBottom) {
          detailClipped = true;
          return;
        }
        detailLines.push({ text, tone, rect: { x: textX, y: lineY, w: textW, h: g.lineHeight } });
        lineY += g.lineHeight;
      }
    };
    let detailFull: GuiView["detailFull"];
    if (this.showLog && !dialogShown) {
      const lines = this.session.log.slice(-g.detailLines * 2).flatMap((l) => wrapText(l, wrapDetail));
      pushDetail("dim", ["── ログ ──"]);
      pushDetail("body", lines.slice(-(g.detailLines - 1)));
    } else {
      const { name, stats, text, fields } = this.detailFor(detailCard.cardId, detailCard.hidden);
      const def = detailCard.cardId && !detailCard.hidden ? this.state().definitions[detailCard.cardId] : undefined;
      detailClipped = false;
      let beside = false;
      if (this.cardArt && (detailCard.cardId || detailCard.hidden)) {
        // Card image on the left, its stats one per line beside it. A wide,
        // short panel (phone portrait) puts all of the text beside the image.
        beside = isWideDetail(g.detail);
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
          // Beside the image: number, type and size; under it the name, the wiki-style attributes and the text.
          const tokens = def ? [def.id, TYPE_LABELS[def.type] ?? def.type, def.size ? `サイズ：${def.size}` : ""].filter(Boolean) : stats ? stats.split(" ") : [];
          tokens.slice(0, Math.floor(rect.h / g.lineHeight)).forEach((token, i) => {
            detailLines.push({
              text: fitLine(token, { fontPx: g.fontPx, maxWidthPx: sideW }),
              tone: i === 0 ? "dim" : "body",
              rect: { x: sideX, y: rect.y + i * g.lineHeight, w: sideW, h: g.lineHeight },
            });
          });
          lineY = rect.y + rect.h + 3;
          if (name) pushDetail("head", wrapText(name, { ...wrapDetail, maxLines: 2 }));
          for (const field of fields) pushDetail("dim", wrapText(field, wrapDetail));
          if (text) pushDetail("body", wrapText(text, wrapDetail));
        }
      } else {
        if (name) pushDetail("head", wrapText(name, { ...wrapDetail, maxLines: 2 }));
        if (stats) pushDetail("dim", wrapText(stats, { ...wrapDetail, maxLines: 2 }));
        if (text) pushDetail("body", wrapText(text, wrapDetail));
      }
      // A phone's short panel leaves out the attributes, and a long text may not fit: the last
      // line says the whole card can be opened (the shell shows `detailFull`).
      if (this.cardArt && def && (detailClipped || beside)) {
        const hint = detailClipped ? "▼ タップで全文" : "▼ タップで詳細";
        if (!detailClipped) pushDetail("accent", [hint]);
        const last = detailLines[detailLines.length - 1];
        if (last && last.text !== hint) detailLines[detailLines.length - 1] = { ...last, text: hint, tone: "accent" };
        detailFull = { name, fields, text };
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
      const more = mode.verbs.length > POPUP_ROWS ? 1 : 0;
      const h = (rowsShown + 1 + more) * g.lineHeight + 4;
      const a = mode.anchor;
      const below = a.y + a.h + 2;
      const above = a.y - h - 2;
      const y = a.y < g.board.y + g.board.h / 2 || mode.entry ? Math.min(below, g.footer.y - h) : Math.max(g.board.y, above);
      const x = Math.max(g.board.x, Math.min(a.x, g.side.x + g.side.w - w - 2));
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: w - 8 };
      popup = {
        rect: { x, y, w, h },
        title: fitLine(mode.title, wrap),
        titleRect: { x: x + 4, y: y + 2, w: w - 8, h: g.lineHeight },
        rows: this.boxRows(mode.cursor, mode.verbs.map((v) => v.label), y + 2 + g.lineHeight, x + 4, w - 8, wrap),
        marks: boxMarks(mode.cursor, { x: x + 4, y: y + 2 + (rowsShown + 1) * g.lineHeight, w: w - 8, h: g.lineHeight }),
      };
    } else if (mode.kind === "list") {
      const b = g.board;
      const rowsShown = Math.min(mode.items.length, LIST_ROWS);
      const more = mode.items.length > LIST_ROWS ? 1 : 0;
      const h = (rowsShown + 1 + more) * g.lineHeight + 6;
      const rect = { x: b.x + 4, y: Math.max(b.y + 2, b.y + Math.floor((b.h - h) / 2)), w: b.w - 8, h };
      const wrap: WrapOptions = { fontPx: g.fontPx, maxWidthPx: rect.w - 8 };
      list = {
        rect,
        title: fitLine(`${mode.title} ${mode.cursor.index + 1}/${mode.items.length}`, wrap),
        titleRect: { x: rect.x + 4, y: rect.y + 3, w: rect.w - 8, h: g.lineHeight },
        rows: this.boxRows(mode.cursor, mode.labels, rect.y + 3 + g.lineHeight, rect.x + 4, rect.w - 8, wrap),
        marks: boxMarks(mode.cursor, { x: rect.x + 4, y: rect.y + 3 + (rowsShown + 1) * g.lineHeight, w: rect.w - 8, h: g.lineHeight }),
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
      detailFull,
      popup,
      list,
      dialog,
      footer: fitLine(footer, { fontPx: g.fontPx, maxWidthPx: g.footer.w - 8 }),
      footerAccent: mode.kind === "target" || dialogShown,
      menuOpen: mode.kind !== "board" || dialogShown || !!reveal,
      battleEntry: mode.kind === "popup" && !!mode.entry,
      startPhase: mode.kind === "popup" && !!mode.start,
      logShown: this.showLog && !dialogShown,
    };
  }
}

/** "▲ 前へ（3件）" on the left and "▼ 次へ（5件）" on the right of one line, for what is hidden above and below. */
function scrollMarks(area: ScrollMark["area"], above: number, below: number, unit: string, line: Rect): ScrollMark[] {
  const half = Math.floor(line.w / 2);
  const marks: ScrollMark[] = [];
  if (above > 0) marks.push({ text: `▲ 前へ（${above}${unit}）`, rect: { ...line, w: half - 2 }, area, direction: -1 });
  if (below > 0) marks.push({ text: `▼ 次へ（${below}${unit}）`, rect: { ...line, x: line.x + half + 2, w: line.w - half - 2 }, area, direction: 1 });
  return marks;
}

function boxMarks(cursor: ListCursor, line: Rect): ScrollMark[] {
  return scrollMarks("rows", cursor.offset, Math.max(0, cursor.count - cursor.offset - cursor.rows), "件", line);
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
