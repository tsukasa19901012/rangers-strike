// PocketJS web shell over @rangers-strike/client-core.
// - input: mouse / pen / touch arrive from the host page over the overlay
//   service channel. Title and result screens use focusable views (hover =
//   focus, click = onPress); the match and deck builder hit-test the raw
//   position against the core's rectangles. Keys arrive as console buttons.
// - view: one component per screen draws the core's view model.
// The game logic (legal moves, CPU, deck rules) all lives in client-core and
// the engine; this file only maps input and picks the screen.
import { createSignal, Match, Switch } from "solid-js";
import { onFrame } from "@pocketjs/framework/lifecycle";
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
  type GuiView,
  type LogicalInput,
  type ScreenView,
  type PlayerId,
} from "@rangers-strike/client-core";
import { webPlatform } from "./platform";
import { pollCardArt } from "./cardArt";
import { MatchView, matchButtons, pileHit, pileLayout, type PilePeek } from "./MatchView";
import { DeckView, deckButtons } from "./DeckView";
import { TitleView } from "./TitleView";
import { ResultView } from "./ResultView";
import { inside } from "./ui";

/** A pointer event as host/host.js sends it (logical px). */
type PointerEvent = { kind: "move" | "down" | "up" | "wheel" | "leave"; x: number; y: number; button?: number; dy?: number };

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
  if (event?.type === "focusTile" && !view.menuOpen) return { ...event, open: false };
  return null;
}

function matchFooter(v: GuiView): string {
  if (isPortrait(v.geometry)) return touchFooter(v);
  if (v.list || v.popup) return "クリック: 決定 / 右クリック・Esc: 閉じる / ホイール・↑↓: 選ぶ";
  if (v.dialog) return "カードかボタンをクリックして選ぶ / L・枠の外をクリック: 盤面を見る / Tab: すべての操作";
  if (v.footerAccent) return `${v.footer.replace(/（[^）]*）$/, "")}（クリック: 決定 / 右クリック・Esc: やめる）`;
  if (v.footer.startsWith("盤面を確認中")) return "盤面を確認中（L・Esc・Space で選択ウィンドウに戻る）";
  if (v.footer === "CPU の手番") return "CPU の手番です…";
  return "カードにマウスを乗せると詳細 / クリック: そのカードの操作 / Space: フェイズ終了 / Tab: すべての操作 / L: ログ";
}

/** Phone (portrait) hints: no mouse, no keyboard. */
function touchFooter(v: GuiView): string {
  if (v.list || v.popup) return "タップ: 決定 / 枠の外: 閉じる";
  if (v.dialog) return "カードかボタンをタップして選ぶ";
  if (v.footerAccent) return v.footer.replace(/（[^）]*）$/, "");
  if (v.footer === "CPU の手番") return "CPU の手番です…";
  return "カードをタップ: 詳細と操作";
}

const DECK_TOUCH_FOOTER = "タップ: 1枚入れる / 下の枠: カードの詳細";
const DECK_FOOTER = "クリック: 1枚入れる / 右クリック: 1枚抜く / マウスを乗せると詳細 / ホイール: スクロール / Esc: メニュー";

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
  const refresh = () => setView(controller.view());
  // For browser tests and debugging from the console.
  (globalThis as unknown as { __rsApp?: unknown }).__rsApp = {
    controller,
    pile: (player: PlayerId) => {
      const gui = controller.view().gui;
      return gui && controller.session ? pileLayout(controller.session.state, player, webPileRect(gui.geometry, player)) : null;
    },
  };
  const repeater = new ButtonRepeater(BINDINGS);

  const pointerEvents: PointerEvent[] = [];
  const overlay = connectOverlay<PointerEvent, { type: string; pointer: boolean }>((event) => pointerEvents.push(event));
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
  function onMatchPointer(e: PointerEvent, gui: GuiView): boolean {
    const p = { x: e.x, y: e.y };
    const buttons = matchButtons(gui.geometry);
    const state = controller.session!.state;
    const pileCard = () =>
      gui.menuOpen ? null : pileHit([CPU, HUMAN].map((player) => pileLayout(state, player, webPileRect(gui.geometry, player))), p);
    // A tapped zone stays open (a touch ends with a leave) until another tap or hovering another zone.
    if (e.kind === "leave") {
      if (!peekPinned) setPeek(null);
    } else if (e.kind === "move") {
      const hit = pileCard();
      if (hit || !peekPinned) {
        setPeek(hit);
        peekPinned = false;
      }
    }
    if (e.kind === "move" || e.kind === "leave") {
      const overlay = gui.list ?? gui.popup;
      const spot =
        e.kind === "leave" || (overlay && inside(overlay.rect, p))
          ? null
          : inside(gui.endButton.rect, p)
            ? "end"
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
      if (gui.popup || gui.list || gui.dialog) return dispatch((e.dy ?? 0) > 0 ? input.next : input.prev);
      return false;
    }
    if (e.kind === "down") {
      pressed = e;
      return false;
    }
    const down = pressed;
    pressed = null;
    if (!down || Math.abs(down.x - e.x) + Math.abs(down.y - e.y) > 12) return false;
    hoverKey = "";
    if (e.button === 2) return dispatch(input.cancel);
    if (e.button !== 0) return false;
    // Any tap closes the whole card text; a tap on a detail panel that cut its text opens it.
    if (fullText()) {
      setFullText(false);
      return true;
    }
    if (gui.detailFull && inside(gui.geometry.detail, p)) {
      setFullText(true);
      return true;
    }
    // A tap on a pile zone opens what its cards can do (self-rush from the power zone, 常駐 effects);
    // with nothing to do it shows them enlarged (phones have no hover). Any other tap hides them.
    const tapped = pileCard();
    if (tapped && tapped.ids.length > 0) {
      dispatch(input.openCards(tapped.ids, tapped.key.startsWith("d:") ? "捨札" : tapped.title, tapped.anchor));
      if (controller.view().gui?.popup) {
        // The discard pile stays shown under its menu, so every card in it can be seen on a phone too.
        const discard = tapped.key.startsWith("d:");
        setPeek(discard ? tapped : null);
        peekPinned = discard;
        return true;
      }
    }
    setPeek(tapped);
    peekPinned = !!tapped;
    if (tapped) return true;
    // An open popup can cover the buttons under the end button (全操作 / ログ): its rows come first.
    const overlay = gui.list ?? gui.popup;
    if (overlay && inside(overlay.rect, p)) return dispatch(hitTestGui(gui, p));
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
      const screen = controller.view();
      if (screen.gui) changed = onMatchPointer(event, screen.gui) || changed;
      else if (screen.deck) changed = onDeckPointer(event, screen.deck) || changed;
      else if (event.kind === "move") setCursor(false);
    }
    if (leaveFrames > 0 && --leaveFrames === 0) setLeaving(false);
    if (controller.tick()) changed = true;
    pollCardArt();
    if (changed) refresh();
  });

  return (
    <Switch
      fallback={<TitleView controller={controller} view={view} refresh={refresh} width={size().width} height={size().height} />}
    >
      <Match when={view().gui}>
        {(gui) => <MatchView view={gui()} state={(gui(), controller.session!.state)} hot={hot()} footer={matchFooter(gui())} leaving={leaving()} peek={peek()} fullText={fullText()} />}
      </Match>
      <Match when={view().deck}>{(deck) => <DeckView view={deck()} hot={hot()} footer={isPortrait(deck().geometry) ? DECK_TOUCH_FOOTER : DECK_FOOTER} />}</Match>
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
  );
}
