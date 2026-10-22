// PocketJS web shell over @rangers-strike/client-core.
// - input: mouse / pen / touch arrive from the host page over the overlay
//   service channel. Title and result screens use focusable views (hover =
//   focus, click = onPress); the match and deck builder hit-test the raw
//   position against the core's rectangles. Keys arrive as console buttons.
// - view: one component per screen draws the core's view model.
// The game logic (legal moves, CPU, deck rules) all lives in client-core and
// the engine; this file only maps input and picks the screen.
import { createSignal, Match, Show, Switch } from "solid-js";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { View } from "@pocketjs/framework/solid/components";
import { BTN } from "@pocketjs/framework/input";
import { getOps } from "@pocketjs/framework/solid";
import { connectOverlay } from "@pocketjs/framework/overlay-host";
import {
  AppController,
  ButtonRepeater,
  computeWebDeckGeometry,
  computeWebGuiGeometry,
  hitTestDeck,
  hitTestGui,
  input,
  isPortrait,
  CPU,
  HUMAN,
  webPileRect,
  type DeckBuilderView,
  type DeckTextField,
  type GuiView,
  type LogicalInput,
  type ScreenView,
  type PlayerId,
} from "@rangers-strike/client-core";
import { webPlatform } from "./platform";
import { pollCardArt } from "./cardArt";
import { MatchView, matchButtons, peekLayout, pileHit, pileLayout, rowMarks, type DragView, type PilePeek } from "./MatchView";
import { DeckView, deckButtons } from "./DeckView";
import { TitleView } from "./TitleView";
import { ResultView } from "./ResultView";
import { inside } from "./ui";
import { applySettingsAction, SettingsPanel, settingsHit, settingsLayout } from "./SettingsPanel";

/** A pointer event as host/host.js sends it (logical px). */
type PointerEvent = { kind: "move" | "down" | "up" | "wheel" | "leave"; x: number; y: number; button?: number; dy?: number };
/** Text typed into one of the host's inputs (deck builder search / deck name). */
type TextEvent = { kind: "text"; id: "search" | "name"; text: string };
/** Commands to the host: the pointer cursor, and where to show text inputs. */
type HostCommand = { type: "rs.cursor"; pointer: boolean } | { type: "rs.fields"; fields: DeckTextField[] };

/**
 * Keys (host/host.js maps them to these buttons): arrows move over cards,
 * Enter = confirm, Esc = back / pass, Space = end the phase, Tab = every
 * action, L = log, Delete = remove a copy (deck builder).
 */
const BINDINGS = [
  { mask: BTN.UP, input: input.prev, repeat: true },
  { mask: BTN.DOWN, input: input.next, repeat: true },
  { mask: BTN.LEFT, input: input.pagePrev, repeat: true },
  { mask: BTN.RIGHT, input: input.pageNext, repeat: true },
  { mask: BTN.CIRCLE, input: input.confirm },
  { mask: BTN.CROSS, input: input.cancel },
  { mask: BTN.LTRIGGER, input: input.toggleLog },
  { mask: BTN.RTRIGGER, input: input.menu },
  { mask: BTN.TRIANGLE, input: input.allActions },
  { mask: BTN.SQUARE, input: input.alt },
];

function readViewport(): { width: number; height: number } {
  const vp = (getOps() as unknown as { __viewport?: { w: number; h: number } }).__viewport;
  return vp && vp.w > 0 && vp.h > 0 ? { width: vp.w, height: vp.h } : { width: 1280, height: 720 };
}

/** Hover on the match screen: highlight a menu row, or show a board card in the detail panel. */
function hoverMatch(view: GuiView, point: { x: number; y: number }): LogicalInput | null {
  const event = hitTestGui(view, point);
  if (event?.type === "select") return { ...event, confirm: false };
  // The battle-entry popup keeps the board readable: the hovered card still goes to the detail panel.
  if (event?.type === "focusTile" && (!view.menuOpen || view.battleEntry)) return { ...event, open: false };
  return null;
}

/** A press held this many frames without moving shows the card under it whole (CardSheet). */
const LONG_PRESS_FRAMES = 27;
/** A swipe over a row released within this many ms is a flick: it pages the row at least a screenful. */
const FLICK_MS = 300;

/** The band of board row `index`, its label column included (drops and swipes over it count). */
function inRowBand(view: GuiView, index: number, p: { x: number; y: number }): boolean {
  const row = view.rows[index];
  return !!row && p.y >= row.rect.y && p.y < row.rect.y + row.rect.h && p.x >= view.geometry.board.x && p.x < row.rect.x + row.rect.w;
}

/** The board row under a point that keeps some of its cards out of view (a swipe or the wheel pages it), or -1. */
function scrollableRow(view: GuiView, p: { x: number; y: number }): number {
  const covered = [view.list?.rect, view.popup?.rect, view.dialog?.rect].some((r) => r && inside(r, p));
  if (covered) return -1;
  return view.rows.findIndex((row, i) => row.moreLeft + row.moreRight > 0 && inRowBand(view, i, p));
}

/** Where a dragged card was dropped: a card on the board, a board row, or the own pile column (power zone). */
function dropTarget(view: GuiView, p: { x: number; y: number }): { instanceId?: string; zone?: string } {
  for (const row of view.rows) {
    // Last first: a riding unit is drawn over its vehicle.
    const tile = [...row.tiles].reverse().find((t) => inside(t.rect, p));
    if (tile) return { instanceId: tile.instanceId, zone: row.key };
    // The row's band, label column included, takes drops between and beside its cards.
    if (inRowBand(view, view.rows.indexOf(row), p)) return { zone: row.key };
  }
  if (inside(webPileRect(view.geometry, HUMAN), p)) return { zone: `${HUMAN}:power` };
  return {};
}

function matchFooter(v: GuiView): string {
  if (isPortrait(v.geometry)) return touchFooter(v);
  if (v.battleEntry) return "クリック: 決定 / 光っている敵ユニットをクリック: そのままアタック / 右クリック・Esc: 閉じて盤面を見る";
  if (v.list || v.popup) return "クリック: 決定 / 右クリック・Esc: 閉じる / ホイール・↑↓: 選ぶ";
  if (v.dialog) return "カードかボタンをクリックして選ぶ / L・枠の外をクリック: 盤面を見る / Tab: すべての操作";
  if (v.footerAccent) return `${v.footer.replace(/（[^）]*）$/, "")}（クリック: 決定 / 右クリック・Esc: やめる）`;
  if (v.footer.startsWith("盤面を確認中")) return "盤面を確認中（L・Esc・Space で選択ウィンドウに戻る）";
  if (v.footer === "CPU の手番") return "CPU の手番です…";
  return "マウスを乗せると詳細 / クリック: 操作 / ドラッグ: 登場・移動・アタック / Space: フェイズ終了 / Tab: すべての操作 / L: ログ";
}

/** Phone (portrait) hints: no mouse, no keyboard. */
function touchFooter(v: GuiView): string {
  if (v.battleEntry) return "タップ: 決定 / 光る敵をタップ: そのままアタック";
  if (v.list || v.popup) return "タップ: 決定 / 枠の外: 閉じる";
  if (v.dialog) return "タップ: 選ぶ / 長押し: カードの詳細";
  if (v.footerAccent) return v.footer.replace(/（[^）]*）$/, "");
  if (v.footer === "CPU の手番") return "CPU の手番です… / 長押し: カードの詳細";
  return "タップ: 操作 / 長押し: 詳細 / 左右スワイプ: 送る";
}

const DECK_TOUCH_FOOTER = "タップ: 1枚入れる / 下の枠: カードの詳細";
const DECK_FOOTER = "クリック: 1枚入れる / 右クリック: 1枚抜く / マウスを乗せると詳細 / ホイール: スクロール / /: 検索 / Esc: メニュー";

export default function App() {
  let viewport = readViewport();
  const controller = new AppController({
    platform: webPlatform,
    viewport,
    fontPx: 14,
    cpuDelayFrames: 30,
    gui: true,
    cardArt: true,
    layouts: { match: computeWebGuiGeometry, deck: computeWebDeckGeometry },
  });
  const [view, setView] = createSignal<ScreenView>(controller.view(), { equals: false });
  const [size, setSize] = createSignal(viewport);
  const [hot, setHot] = createSignal<string | null>(null);
  // A pile zone (power, operation, top discard) shown enlarged: hovered, or tapped on a phone.
  const [peek, setPeek] = createSignal<PilePeek | null>(null, { equals: (a, b) => a?.key === b?.key });
  // The detail panel's card text shown whole over the board (it was cut on a phone).
  const [fullText, setFullText] = createSignal(false);
  // "Leave the match" asks for a second click within LEAVE_FRAMES.
  const LEAVE_FRAMES = 180;
  let leaveFrames = 0;
  const [leaving, setLeaving] = createSignal(false);
  // A card picked up by a drag (pointer down on a card the player can act with, then moved).
  const [drag, setDrag] = createSignal<DragView | null>(null);
  // A long-pressed card shown whole (MatchView's CardSheet); any tap closes it.
  const [sheet, setSheet] = createSignal<string | null>(null);
  // The press that may become a long press: the card under it and how long it has been held.
  let pressCard: string | null = null;
  let pressFrames = 0;
  let longPressed = false;
  // The board row a press started on, when it hides some cards: a sideways swipe over it moves its cards
  // with the finger (`swiping` once it has gone sideways), from the first card shown at the press.
  let swipeRow = -1;
  let swiping = false;
  let swipeStart = { offset: 0, at: 0 };
  // The automatic-move settings panel, over the title or the match. `settingsHot`: the row under the pointer (-2: close).
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [settingsHot, setSettingsHot] = createSignal(-1);
  let settingsPressed: PointerEvent | null = null;
  const openSettings = () => {
    settingsPressed = null;
    setSettingsHot(-1);
    setSettingsOpen(true);
  };
  const panelLayout = () => (view(), settingsLayout(size().width, size().height, controller.matchSettings));
  /** Pointer input while the panel is open: it takes every event (the screen under it waits). */
  function onSettingsPointer(e: PointerEvent): boolean {
    const layout = panelLayout();
    const p = { x: e.x, y: e.y };
    if (e.kind === "move" || e.kind === "leave") {
      const row = e.kind === "leave" ? -1 : layout.rows.findIndex((r) => inside(r.rect, p));
      const hot = e.kind !== "leave" && inside(layout.close, p) ? -2 : row;
      setCursor(hot !== -1);
      if (hot === settingsHot()) return false;
      setSettingsHot(hot);
      return true;
    }
    if (e.kind === "wheel") return false;
    if (e.kind === "down") {
      settingsPressed = e;
      return false;
    }
    const down = settingsPressed;
    settingsPressed = null;
    // A click that started before the panel opened (the press that opened it) does nothing here.
    if (!down || Math.abs(down.x - e.x) + Math.abs(down.y - e.y) > 12) return false;
    const action = settingsHit(layout, p);
    if (!action) return false;
    if (action.type === "close") setSettingsOpen(false);
    else applySettingsAction(controller, action);
    return true;
  }
  let dragFrom: { instanceId: string; cardId: string; w: number; h: number } | null = null;
  const refresh = () => setView(controller.view());
  // For browser tests and debugging from the console.
  (globalThis as unknown as { __rsApp?: unknown }).__rsApp = {
    controller,
    pile: (player: PlayerId) => {
      const gui = controller.view().gui;
      return gui && controller.session ? pileLayout(controller.session.state, player, webPileRect(gui.geometry, player)) : null;
    },
    peekCards: () => {
      const gui = controller.view().gui;
      const shown = peek();
      return gui && shown ? peekLayout(gui.geometry, shown).cards : null;
    },
  };
  const repeater = new ButtonRepeater(BINDINGS);

  const pointerEvents: (PointerEvent | TextEvent)[] = [];
  const overlay = connectOverlay<PointerEvent | TextEvent, HostCommand>((event) => pointerEvents.push(event));
  // The host's text inputs follow the deck builder's fields (none while a menu or the settings panel is open).
  let fieldsKey = "[]";
  const syncFields = () => {
    const fields = settingsOpen() ? [] : (view().deck?.textFields ?? []);
    const key = JSON.stringify(fields);
    if (key === fieldsKey) return;
    fieldsKey = key;
    overlay.send({ type: "rs.fields", fields });
  };
  let pressed: PointerEvent | null = null;
  let hoverKey = "";
  let pointerCursor = false;
  const setCursor = (pointer: boolean) => {
    if (pointer === pointerCursor) return;
    pointerCursor = pointer;
    overlay.send({ type: "rs.cursor", pointer });
  };

  const dispatch = (event: LogicalInput | null) => {
    if (!event) return false;
    controller.dispatch(event);
    return true;
  };

  let peekPinned = false;
  // The detail panel shows a discard or power card the pointer is on (re-rendered here: a hover may change nothing else).
  const inspect = (cardId: string | null) => {
    if (controller.inspectCard(cardId)) refresh();
  };
  /** Which part of an open window a point is on: its cards or its rows (buttons, menu rows). */
  function swipeArea(gui: GuiView, p: { x: number; y: number }): "cards" | "rows" | null {
    const box = gui.list ?? gui.popup;
    if (box) return inside(box.rect, p) ? "rows" : null;
    const d = gui.dialog;
    if (!d || !inside(d.rect, p)) return null;
    const cards = [...d.cards.map((c) => ({ ...c.rect, h: c.rect.h + 18 })), ...d.marks.filter((m) => m.area === "cards").map((m) => m.rect)];
    if (cards.length > 0) {
      const top = Math.min(...cards.map((r) => r.y));
      const bottom = Math.max(...cards.map((r) => r.y + r.h));
      if (p.y >= top && p.y < bottom) return "cards";
    }
    return "rows";
  }
  /** The face-up card a long press at `p` shows: in the selection window, the enlarged zone, the pile column or the board. */
  function cardUnder(gui: GuiView, p: { x: number; y: number }): string | null {
    const box = gui.list ?? gui.popup;
    if (box && inside(box.rect, p)) return null;
    const faceUp = (card: { cardId: string; hidden?: boolean; kind?: string; rect: { x: number; y: number; w: number; h: number } } | undefined) =>
      card && !card.hidden && card.kind !== "hidden" && card.cardId !== "back" ? card.cardId : null;
    if (gui.dialog && inside(gui.dialog.rect, p)) return faceUp(gui.dialog.cards.find((c) => inside(c.rect, p)));
    const shown = peek();
    if (shown && !gui.dialog) {
      const layout = peekLayout(gui.geometry, shown);
      if (inside(layout.panel, p)) return faceUp(layout.cards.find((c) => inside(c.rect, p)));
    }
    const state = controller.session!.state;
    for (const player of [CPU, HUMAN]) {
      const layout = pileLayout(state, player, webPileRect(gui.geometry, player));
      const card = [layout.discard, ...layout.sections.flatMap((section) => section.cards)].filter((c) => c && inside(c.rect, p)).pop();
      if (card) return faceUp(card);
    }
    return faceUp([...gui.rows.flatMap((row) => row.tiles)].reverse().find((t) => inside(t.rect, p)));
  }
  function onMatchPointer(e: PointerEvent, gui: GuiView): boolean {
    const p = { x: e.x, y: e.y };
    // The release of a long press only ends it; while the sheet is up, a tap closes it.
    if (e.kind === "up" && longPressed) {
      longPressed = false;
      pressed = null;
      return true;
    }
    if (sheet()) {
      if (e.kind === "down") pressed = e;
      if (e.kind !== "up") return false;
      pressed = null;
      setSheet(null);
      return true;
    }
    const buttons = matchButtons(gui.geometry);
    const state = controller.session!.state;
    const pileCard = () =>
      gui.menuOpen ? null : pileHit([CPU, HUMAN].map((player) => pileLayout(state, player, webPileRect(gui.geometry, player))), p);
    // A face-up card among the enlarged ones under the pointer (its text goes to the detail panel).
    const shown = peek();
    const shownLayout = shown ? peekLayout(gui.geometry, shown) : null;
    const peekCard = () => (shownLayout ? shownLayout.cards.find((c) => !c.hidden && inside(c.rect, p)) ?? null : null);
    // A tapped zone stays open (a touch ends with a leave) until another tap or hovering another zone.
    if (e.kind === "leave") {
      if (!peekPinned) {
        setPeek(null);
        inspect(null);
      }
    } else if (e.kind === "move") {
      const over = peekCard();
      const hit = pileCard();
      if (over) inspect(over.cardId);
      else {
        if (hit || !peekPinned) {
          setPeek(hit);
          peekPinned = false;
        }
        // Hovering a single zone card (a power card) shows it in the detail panel too,
        // and the discard pile its newest card.
        const first = hit?.cards[0];
        const single = hit && first && !first.hidden && (hit.cards.length === 1 || hit.key.startsWith("d:")) ? first.cardId : null;
        if (hit || !peekPinned) inspect(single);
      }
    }
    if (e.kind === "move" && pressed && Math.abs(pressed.x - e.x) + Math.abs(pressed.y - e.y) > 12) pressCard = null;
    // Sideways along a row that hides cards is a swipe through them, not a drag: the cards follow the finger.
    if (e.kind === "move" && pressed && swipeRow >= 0 && !drag()) {
      const dx = pressed.x - e.x;
      if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(pressed.y - e.y) && inRowBand(gui, swipeRow, p)) {
        swiping = true;
        dragFrom = null;
      }
      if (swiping) {
        const row = gui.rows[swipeRow]!;
        const step = (row.tiles[0]?.rect.w ?? 60) + gui.geometry.tileGap;
        controller.scrollRow(swipeRow, swipeStart.offset + Math.round(dx / step) - row.moreLeft);
        return true;
      }
    }
    if (e.kind === "move" && dragFrom && pressed && Math.abs(pressed.x - e.x) + Math.abs(pressed.y - e.y) > 12) {
      setDrag({ cardId: dragFrom.cardId, x: e.x, y: e.y, w: dragFrom.w, h: dragFrom.h });
      setCursor(true);
      return true;
    }
    if (e.kind === "move" || e.kind === "leave") {
      const overlay = gui.list ?? gui.popup;
      const spot =
        e.kind === "leave" || (overlay && inside(overlay.rect, p))
          ? null
          : inside(gui.endButton.rect, p)
            ? "end"
            : inside(buttons.turn, p)
              ? "turn"
              : inside(buttons.settings, p)
                ? "settings"
              : inside(buttons.all, p)
              ? "all"
              : inside(buttons.log, p)
                ? "log"
                : inside(buttons.leave, p)
                  ? "leave"
                  : null;
      setHot(spot);
      if (e.kind === "leave") return true;
      const hover = hoverMatch(gui, p);
      setCursor(!!spot || !!hitTestGui(gui, p));
      const key = hover ? JSON.stringify(hover) : "";
      if (key === hoverKey) return !!spot;
      hoverKey = key;
      return dispatch(hover) || true;
    }
    if (e.kind === "wheel") {
      // Over the selection window's cards the wheel moves through the cards, elsewhere through the rows.
      if (gui.dialog && !gui.popup && !gui.list && swipeArea(gui, p) === "cards") return dispatch((e.dy ?? 0) > 0 ? input.pageNext : input.pagePrev);
      if (gui.popup || gui.list || gui.dialog) return dispatch((e.dy ?? 0) > 0 ? input.next : input.prev);
      const row = scrollableRow(gui, p);
      return row >= 0 && controller.scrollRow(row, (e.dy ?? 0) > 0 ? 1 : -1);
    }
    if (e.kind === "down") {
      pressed = e;
      // A phone has no detail panel and no hover: a long press shows a card instead.
      pressCard = e.button === 0 && isPortrait(gui.geometry) ? cardUnder(gui, p) : null;
      pressFrames = 0;
      swipeRow = scrollableRow(gui, p);
      swiping = false;
      swipeStart = { offset: swipeRow >= 0 ? gui.rows[swipeRow]!.moreLeft : 0, at: webPlatform.clock() };
      let tile = !gui.menuOpen && !gui.dialog && e.button === 0 ? [...gui.rows.flatMap((row) => row.tiles)].reverse().find((t) => inside(t.rect, p)) : undefined;
      if (tile && !tile.actionable) tile = undefined;
      dragFrom = tile ? { instanceId: tile.instanceId, cardId: tile.cardId, w: tile.rect.w, h: tile.rect.h } : null;
      return false;
    }
    const down = pressed;
    pressed = null;
    pressCard = null;
    const from = dragFrom;
    dragFrom = null;
    if (drag()) setDrag(null);
    const row = swipeRow;
    swipeRow = -1;
    if (down && swiping) {
      swiping = false;
      // A quick flick goes on to the next screenful (all but one of the cards shown) in its direction.
      const dx = down.x - e.x;
      if (webPlatform.clock() - swipeStart.at <= FLICK_MS && Math.abs(dx) > 30) {
        const page = Math.max(1, gui.rows[row]!.tiles.length - 1);
        const moved = gui.rows[row]!.moreLeft - swipeStart.offset;
        const want = dx > 0 ? page : -page;
        if (Math.abs(moved) < page) controller.scrollRow(row, want - moved);
      }
      return true;
    }
    if (down && from && Math.abs(down.x - e.x) + Math.abs(down.y - e.y) > 12) {
      controller.dropCard(from.instanceId, dropTarget(gui, p));
      return true;
    }
    // A vertical swipe over a window pages through what it keeps out of view (a phone has no wheel).
    if (down && Math.abs(down.y - e.y) > 30 && Math.abs(down.y - e.y) > Math.abs(down.x - e.x)) {
      const area = swipeArea(gui, down);
      if (area) return dispatch(input.scroll(area, down.y > e.y ? 1 : -1));
    }
    if (!down || Math.abs(down.x - e.x) + Math.abs(down.y - e.y) > 12) return false;
    hoverKey = "";
    if (e.button === 2) return dispatch(input.cancel);
    if (e.button !== 0) return false;
    // Any tap closes the whole card text; a tap on a detail panel that cut its text opens it
    // (unless a popup or window drawn over the panel takes the tap).
    if (fullText()) {
      setFullText(false);
      return true;
    }
    const covering = [gui.list?.rect, gui.popup?.rect, gui.dialog?.rect].some((r) => r && inside(r, p));
    // A phone shows the log over the board: a tap on it puts it away.
    if (isPortrait(gui.geometry) && gui.logShown && inside(gui.geometry.detail, p) && !covering) return dispatch(input.toggleLog);
    if (!isPortrait(gui.geometry) && gui.detailFull && inside(gui.geometry.detail, p) && !covering) {
      setFullText(true);
      return true;
    }
    // A tap on one of the enlarged cards (the discard pile, the power zone) shows it in the detail panel.
    const tappedShown = !covering ? peekCard() : null;
    if (tappedShown) {
      // A phone has no detail panel: the card opens whole.
      if (isPortrait(gui.geometry)) setSheet(tappedShown.cardId);
      else inspect(tappedShown.cardId);
      peekPinned = true;
      return true;
    }
    if (shownLayout && !covering && inside(shownLayout.panel, p)) return true;
    inspect(null);
    // A tap on a pile zone opens what its cards can do (self-rush from the power zone, 常駐 effects);
    // with nothing to do it shows them enlarged (phones have no hover). Any other tap hides them.
    const tapped = pileCard();
    if (tapped && tapped.ids.length > 0) {
      dispatch(input.openCards(tapped.ids, tapped.key.startsWith("d:") ? "捨札" : tapped.title, tapped.anchor));
      if (controller.view().gui?.popup) {
        // The zone stays shown under its menu, so every card in it can be seen (and tapped) on a phone too.
        setPeek(tapped);
        peekPinned = true;
        return true;
      }
    }
    setPeek(tapped);
    peekPinned = !!tapped;
    if (tapped) return true;
    // An open popup can cover the buttons under the end button (全操作 / ログ): its rows come first.
    const overlay = gui.list ?? gui.popup;
    if (overlay && inside(overlay.rect, p)) return dispatch(hitTestGui(gui, p));
    // A tap on a row's ‹n / n› mark shows the next cards (as many as the row shows at once).
    if (!(gui.dialog && inside(gui.dialog.rect, p))) {
      for (let i = 0; i < gui.rows.length; i++) {
        const mark = rowMarks(gui.rows[i]!).find((m) => inside(m.tap, p));
        if (mark) return controller.scrollRow(i, mark.direction * Math.max(1, gui.rows[i]!.tiles.length - 1)) || true;
      }
    }
    if (inside(buttons.leave, p)) {
      if (leaving()) {
        setLeaving(false);
        controller.leaveMatch();
      } else {
        setLeaving(true);
        leaveFrames = LEAVE_FRAMES;
      }
      return true;
    }
    if (inside(buttons.settings, p)) {
      openSettings();
      return true;
    }
    if (inside(buttons.turn, p)) {
      controller.endTurn();
      return true;
    }
    if (inside(buttons.all, p)) return dispatch(input.allActions);
    if (inside(buttons.log, p)) return dispatch(input.toggleLog);
    return dispatch(hitTestGui(gui, p));
  }

  function onDeckPointer(e: PointerEvent, deck: DeckBuilderView): boolean {
    const p = { x: e.x, y: e.y };
    const g = deck.geometry;
    const b = deckButtons(g);
    const tileAt = () => {
      const i = deck.tiles.findIndex((t) => inside(t.rect, p));
      return i < 0 ? null : { row: Math.floor(i / g.cols), slot: i % g.cols };
    };
    if (e.kind === "move" || e.kind === "leave") {
      if (e.kind === "leave") {
        setHot(null);
        return true;
      }
      const chip = deck.chips.findIndex((c) => inside(c.rect, p));
      const spot = deck.menu ? null : inside(b.menu, p) ? "menu" : inside(b.prev, p) ? "prev" : inside(b.next, p) ? "next" : chip >= 0 ? `chip${chip}` : null;
      setHot(spot);
      let hover: LogicalInput | null = null;
      if (deck.menu) {
        const row = deck.menu.rows.findIndex((r) => inside(r.rect, p));
        if (row >= 0) hover = input.select(row, false);
      } else {
        const tile = tileAt();
        if (tile) hover = input.focusTile(tile.row, tile.slot, false);
      }
      setCursor(!!spot || !!hover);
      const key = hover ? JSON.stringify(hover) : "";
      if (key === hoverKey) return true;
      hoverKey = key;
      return dispatch(hover) || true;
    }
    if (e.kind === "wheel") {
      if (deck.menu) return dispatch((e.dy ?? 0) > 0 ? input.next : input.prev);
      return dispatch((e.dy ?? 0) > 0 ? input.next : input.prev);
    }
    if (e.kind === "down") {
      pressed = e;
      return false;
    }
    const down = pressed;
    pressed = null;
    if (!down || Math.abs(down.x - e.x) + Math.abs(down.y - e.y) > 12) return false;
    hoverKey = "";
    if (deck.menu) return dispatch(e.button === 2 ? input.cancel : hitTestDeck(deck, p));
    // Any tap closes the whole card text; a tap on a detail panel that left some out opens it.
    if (fullText()) {
      setFullText(false);
      return true;
    }
    if (e.button === 0 && deck.detailFull && inside(g.detail, p)) {
      setFullText(true);
      return true;
    }
    const tile = tileAt();
    if (e.button === 2) {
      if (!tile) return false;
      dispatch(input.focusTile(tile.row, tile.slot, false));
      return dispatch(input.alt);
    }
    if (e.button !== 0) return false;
    if (inside(b.menu, p)) return dispatch(input.cancel);
    if (inside(b.prev, p) || inside(b.next, p)) {
      const step = inside(b.prev, p) ? input.prev : input.next;
      for (let i = 0; i < g.rows; i++) controller.dispatch(step);
      return true;
    }
    if (tile) {
      dispatch(input.focusTile(tile.row, tile.slot, false));
      return dispatch(input.confirm);
    }
    return dispatch(hitTestDeck(deck, p));
  }

  onFrame((buttons) => {
    let changed = false;
    const next = readViewport();
    if (next.width !== viewport.width || next.height !== viewport.height) {
      viewport = next;
      controller.setViewport(next);
      setSize(next);
      changed = true;
    }
    const current = controller.view();
    // Keys drive the match and the deck builder; on the title and result
    // screens the framework moves focus between buttons itself.
    if (current.gui || current.deck) {
      for (const event of repeater.frame(buttons)) {
        controller.dispatch(event);
        changed = true;
      }
    } else repeater.frame(buttons);
    for (const event of pointerEvents.splice(0)) {
      if (event.kind === "text") {
        controller.setDeckText(event.id, event.text);
        changed = true;
        continue;
      }
      const screen = controller.view();
      if (settingsOpen()) changed = onSettingsPointer(event) || changed;
      else if (screen.gui) changed = onMatchPointer(event, screen.gui) || changed;
      else if (screen.deck) changed = onDeckPointer(event, screen.deck) || changed;
      else if (event.kind === "move") setCursor(false);
    }
    if (leaveFrames > 0 && --leaveFrames === 0) setLeaving(false);
    // A press held still on a card shows it whole (the drag it might have started is dropped).
    if (pressed && pressCard && !longPressed && ++pressFrames >= LONG_PRESS_FRAMES) {
      setSheet(pressCard);
      longPressed = true;
      pressCard = null;
      dragFrom = null;
      setDrag(null);
      changed = true;
    }
    if (sheet() && !controller.view().gui) setSheet(null);
    if (controller.tick()) changed = true;
    pollCardArt();
    if (changed) refresh();
    syncFields();
  });

  return (
    <>
    <Switch
      fallback={
        // The title's buttons take clicks through focus, so the title steps aside while the panel is open.
        <Show when={!settingsOpen()} fallback={<View class="w-full h-full bg-gradient-to-b from-[#0f1b33] to-[#04070d]" />}>
          <TitleView controller={controller} view={view} refresh={refresh} width={size().width} height={size().height} openSettings={openSettings} />
        </Show>
      }
    >
      <Match when={view().gui}>
        {(gui) => (
          <MatchView
            view={gui()}
            state={(gui(), controller.session!.state)}
            hot={hot()}
            footer={matchFooter(gui())}
            leaving={leaving()}
            peek={gui().dialog ? null : peek()}
            endingTurn={(gui(), controller.endingTurn)}
            drag={drag()}
            fullText={fullText()}
            sheet={sheet()}
          />
        )}
      </Match>
      <Match when={view().deck}>{(deck) => <DeckView view={deck()} hot={hot()} footer={isPortrait(deck().geometry) ? DECK_TOUCH_FOOTER : DECK_FOOTER} fullText={fullText()} />}</Match>
      <Match when={view().screen === "result"}>
        <ResultView
          controller={controller}
          width={size().width}
          onBack={() => {
            controller.backToTitle();
            refresh();
          }}
        />
      </Match>
    </Switch>
    <Show when={settingsOpen()}>
      <SettingsPanel layout={panelLayout()} width={size().width} height={size().height} hot={settingsHot()} />
    </Show>
    </>
  );
}
