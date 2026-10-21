// The match screen: draws GuiView (client-core) at the rectangles of the web
// geometry (computeWebGuiGeometry). Every element sits where the core put it,
// so the core's hit test (hitTestGui) matches what is on screen. No game logic.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import {
  CPU,
  HUMAN,
  isPortrait,
  locateInstance,
  webPileRect,
  zoneLabel,
  type GameState,
  type GuiBox,
  type GuiGeometry,
  type GuiTile,
  type GuiView,
  type PanelTone,
  type PlayerId,
} from "@rangers-strike/client-core";
import { at, CardFace, inside, type Box } from "./ui";

const ROW_LABELS: Record<string, [string, string]> = {
  [`${CPU}:command`]: ["CPU", "コマンド"],
  [`${CPU}:rush`]: ["CPU", "ラッシュ"],
  [`${CPU}:battle`]: ["CPU", "バトル"],
  "player1:battle": ["自分", "バトル"],
  "player1:rush": ["自分", "ラッシュ"],
  "player1:command": ["自分", "コマンド"],
  "player1:hand": ["自分", "手札"],
};

// Class literals must be complete strings (PocketJS bakes them at build time).
const ROW_BG: Record<string, string> = {
  battle: "absolute rounded-[8] bg-gradient-to-r from-[#3b0d16] to-[#1a0a10] border border-[#7f1d1d]",
  rush: "absolute rounded-[8] bg-gradient-to-r from-[#0c1f4a] to-[#0a1024] border border-[#1e3a8a]",
  command: "absolute rounded-[8] bg-gradient-to-r from-[#073b2c] to-[#06161a] border border-[#065f46]",
  hand: "absolute rounded-[8] bg-gradient-to-r from-[#1e293b] to-[#0f172a] border border-[#334155]",
};
const ROW_LABEL_TEXT: Record<string, string> = {
  battle: "text-xs text-rose-300 font-bold",
  rush: "text-xs text-sky-300 font-bold",
  command: "text-xs text-emerald-300 font-bold",
  hand: "text-xs text-slate-300 font-bold",
};

export const TONE: Record<PanelTone, string> = {
  head: "text-sm text-white font-bold",
  body: "text-sm text-slate-200",
  dim: "text-sm text-slate-400",
  accent: "text-sm text-amber-300 font-bold",
};

/** Buttons beside the end-phase button (not part of GuiView; the app handles their clicks). */
export function matchButtons(g: GuiGeometry): { turn: Box; all: Box; log: Box; leave: Box } {
  const e = g.endButton;
  if (isPortrait(g)) {
    const w = Math.floor((e.x - 8 - 8 - 12) / 3);
    return {
      leave: { x: g.width - 116, y: 6, w: 108, h: 28 },
      turn: { x: 8, y: e.y, w, h: e.h },
      all: { x: 8 + w + 6, y: e.y, w, h: e.h },
      log: { x: 8 + (w + 6) * 2, y: e.y, w, h: e.h },
    };
  }
  return {
    leave: { x: g.width - 176, y: 7, w: 168, h: 30 },
    turn: { x: e.x, y: e.y + e.h + 14, w: e.w, h: 36 },
    all: { x: e.x, y: e.y + e.h + 58, w: e.w, h: 36 },
    log: { x: e.x, y: e.y + e.h + 102, w: e.w, h: 36 },
  };
}

/** A card being dragged: drawn under the pointer. */
export type DragView = { cardId: string; x: number; y: number; w: number; h: number };

const CARD_RATIO = 190 / 130;

/** Cards stacked on an operation card (クロックアップ: face down, ミラーワールド: face up). */
type PileStack = { count: number; hidden: number; topId: string };
/** `peek`: an operation card shows itself and the cards stacked on it when hovered or tapped. */
export type PileCard = { cardId: string; hidden: boolean; rect: Box; stack?: PileStack; peek?: { title: string; cards: PeekCard[]; ids: string[] } };
/** A card in the enlarged view; a caption says what is stacked on what. */
export type PeekCard = { cardId: string; hidden: boolean; caption?: string };
type PileSection = { title: string; label: string; tone: string; labelRect: Box; cards: PileCard[]; all: PeekCard[]; count: number; ids: string[] };
export type PileLayout = { narrow: boolean; deck: Box | null; discard: PileCard | null; discardIds: string[]; discardTap: { rect: Box; top: PeekCard } | null; counts: { text: string; rect: Box }[]; sections: PileSection[] };
/** Cards shown enlarged together: a whole zone, so both cards of a tag operation are side by side. `ids`: the cards a tap can act on. */
export type PilePeek = { key: string; title: string; cards: PeekCard[]; anchor: Box; ids: string[] };

type ZoneCard = GameState["players"][PlayerId]["power"][number];

function pileStack(card: ZoneCard): PileStack | undefined {
  const stacked = card.stackedCards ?? [];
  if (stacked.length === 0) return undefined;
  const top = stacked[stacked.length - 1]!;
  return { count: stacked.length, hidden: stacked.filter((c) => c.faceDown).length, topId: top.faceDown ? "back" : top.cardId };
}

function operationPeek(state: GameState, who: string, card: ZoneCard): { title: string; cards: PeekCard[]; ids: string[] } {
  const name = state.definitions[card.cardId]?.name ?? card.cardId;
  const stacked = card.stackedCards?.length ?? 0;
  return { title: `${who}の常駐：${name}${stacked ? `（重ね${stacked}枚）` : ""}`, cards: peekCards([card]), ids: [card.instanceId] };
}

/**
 * A zone's cards for the enlarged view. Cards stacked on an operation follow
 * it: face-up ones one by one, face-down ones as one back with their count
 * (nobody looks at them).
 */
function peekCards(cards: readonly ZoneCard[]): PeekCard[] {
  return cards.flatMap((card) => {
    const stacked = card.stackedCards ?? [];
    if (stacked.length === 0) return [{ cardId: card.cardId, hidden: !!card.faceDown }];
    const down = stacked.filter((c) => c.faceDown).length;
    return [
      { cardId: card.cardId, hidden: false, caption: `重ね ${stacked.length}枚` },
      ...stacked.filter((c) => !c.faceDown).map((c) => ({ cardId: c.cardId, hidden: false, caption: "↑表向きで重ね" })),
      ...(down > 0 ? [{ cardId: "back", hidden: true, caption: `↑裏向き ${down}枚` }] : []),
    ];
  });
}

/**
 * The pile column of one player: deck and top discard as cards, then the
 * power zone (face-down cards show their back) and the operation zone (常駐)
 * as small cards. The narrow column of a phone held upright has no room for
 * the deck image or a power fan: it shows counts and the operation cards
 * one under the other, never overlapping. Hovering or tapping a zone shows
 * all of its cards enlarged (pileHit / PeekPanel).
 */
export function pileLayout(state: GameState, player: PlayerId, rect: Box): PileLayout {
  const p = state.players[player];
  const who = player === HUMAN ? "自分" : "CPU";
  const narrow = rect.w < 110;
  const x0 = rect.x + 6;
  const availW = rect.w - 12;
  const counts: { text: string; rect: Box }[] = [];
  const faceDown = p.power.filter((c) => c.faceDown).length;
  const all = (cards: readonly ZoneCard[]) => peekCards(cards);
  const bottom = rect.y + rect.h - 6;
  const sections: PileSection[] = [];
  if (narrow) {
    let y = rect.y + 6;
    let discardRow: Box | null = null;
    for (const text of [`山札 ${p.deck.length}`, `捨札 ${p.discard.length}`]) {
      counts.push({ text, rect: { x: rect.x, y, w: rect.w, h: 18 } });
      discardRow = { x: rect.x, y, w: rect.w, h: 18 };
      y += 18;
    }
    const lastDiscard = p.discard[p.discard.length - 1];
    // No room for the discard image: its count row takes the tap instead.
    const discardTap = lastDiscard && discardRow ? { rect: discardRow, top: { cardId: lastDiscard.cardId, hidden: false } } : null;
    sections.push({ title: `${who}のパワー`, label: `パワー ${p.power.length}`, tone: "text-xs text-amber-300 font-bold", labelRect: { x: rect.x, y, w: rect.w, h: 18 }, cards: [], all: all(p.power), count: p.power.length, ids: p.power.map((c) => c.instanceId) });
    y += 22;
    if (p.operation.length) {
      const labelRect = { x: rect.x, y, w: rect.w, h: 18 };
      y += 18;
      const n = p.operation.length;
      const w = Math.min(availW - 4, Math.floor((bottom - y - 4 * (n - 1)) / n / CARD_RATIO));
      const h = Math.round(w * CARD_RATIO);
      const cards = p.operation.map((c, i) => ({ cardId: c.cardId, hidden: false, rect: { x: rect.x + Math.round((rect.w - w) / 2), y: y + i * (h + 4), w, h }, stack: pileStack(c), peek: operationPeek(state, who, c) }));
      sections.push({ title: `${who}の常駐`, label: `常駐 ${n}`, tone: "text-xs text-violet-300 font-bold", labelRect, cards, all: all(p.operation), count: n, ids: p.operation.map((c) => c.instanceId) });
    }
    return { narrow, deck: null, discard: null, discardIds: p.discard.map((c) => c.instanceId), discardTap, counts, sections };
  }
  const cardW = Math.min(64, Math.floor((rect.w - 18) / 2));
  const deckRect: Box = { x: x0, y: rect.y + 8, w: cardW, h: Math.round(cardW * CARD_RATIO) };
  const top = p.discard[p.discard.length - 1];
  const discardRect: Box = { ...deckRect, x: rect.x + rect.w - 6 - cardW };
  let y = deckRect.y + deckRect.h + 2;
  counts.push({ text: `山札 ${p.deck.length}`, rect: { ...deckRect, y, h: 20 } });
  counts.push({ text: `捨札 ${p.discard.length}`, rect: { ...discardRect, y, h: 20 } });
  y += 22;
  const zones = [
    { title: `${who}のパワー`, label: `パワー ${p.power.length}${faceDown ? `（裏${faceDown}）` : ""}`, tone: "text-xs text-amber-300 font-bold", cards: p.power, operation: false },
    ...(p.operation.length ? [{ title: `${who}の常駐`, label: `常駐 ${p.operation.length}`, tone: "text-xs text-violet-300 font-bold", cards: p.operation, operation: true }] : []),
  ];
  const share = Math.floor((bottom - y) / zones.length);
  zones.forEach((zone, zi) => {
    const sy = y + zi * share;
    const labelRect: Box = { x: rect.x, y: sy, w: rect.w, h: 18 };
    const fanTop = sy + 18;
    const fanH = share - 22;
    const n = zone.cards.length;
    const cards: PileCard[] = [];
    if (n > 0 && fanH >= 20) {
      // Side by side while they fit (a tag operation's two cards), overlapping beyond that.
      const w = Math.min(60, Math.floor(fanH / CARD_RATIO));
      const h = Math.round(w * CARD_RATIO);
      const step = n > 1 ? Math.min(w + 4, Math.floor((availW - w) / (n - 1))) : 0;
      zone.cards.forEach((c, i) => cards.push({ cardId: c.cardId, hidden: !!c.faceDown, rect: { x: x0 + i * step, y: fanTop, w, h }, stack: pileStack(c), peek: zone.operation ? operationPeek(state, who, c) : undefined }));
    }
    sections.push({ title: zone.title, label: zone.label, tone: zone.tone, labelRect, cards, all: all(zone.cards), count: n, ids: zone.cards.map((c) => c.instanceId) });
  });
  return {
    narrow,
    deck: p.deck.length > 0 ? deckRect : null,
    discard: top ? { cardId: top.cardId, hidden: false, rect: discardRect } : null,
    // A tap on the discard pile opens what its cards can do (self-rush from the discard, discard-paid commands).
    discardIds: p.discard.map((c) => c.instanceId),
    discardTap: null,
    counts,
    sections,
  };
}

/** The zone under a point (a pile card or a zone label), as the cards to show enlarged. */
export function pileHit(layouts: PileLayout[], point: { x: number; y: number }): PilePeek | null {
  for (const layout of layouts) {
    if (layout.discardTap && inside(layout.discardTap.rect, point)) {
      const tap = layout.discardTap;
      return { key: `d:${tap.rect.x}:${tap.rect.y}`, title: "捨札の一番上", cards: [tap.top], anchor: tap.rect, ids: layout.discardIds };
    }
    if (layout.discard && inside(layout.discard.rect, point)) {
      return { key: `d:${layout.discard.rect.x}:${layout.discard.rect.y}`, title: "捨札の一番上", cards: [layout.discard], anchor: layout.discard.rect, ids: layout.discardIds };
    }
    for (const section of layout.sections) {
      // The last card drawn is on top where cards overlap.
      const card = [...section.cards].reverse().find((c) => inside(c.rect, point));
      if (card?.peek) {
        return { key: `${card.peek.title}:${card.rect.x}:${card.rect.y}`, title: card.peek.title, cards: card.peek.cards, anchor: card.rect, ids: card.peek.ids };
      }
      const hit = inside(section.labelRect, point) ? section.labelRect : card?.rect;
      if (hit && section.all.length > 0) {
        return { key: `${section.title}:${section.all.map((c) => c.caption ?? c.cardId).join(",")}`, title: `${section.title}（${section.count}枚）`, cards: section.all, anchor: hit, ids: section.ids };
      }
    }
  }
  return null;
}

function PilePanel(props: { state: GameState; player: PlayerId; rect: Box }) {
  const layout = () => pileLayout(props.state, props.player, props.rect);
  return (
    <>
      <View class="absolute rounded-[8] bg-[#0b1220d0] border border-[#25324d]" style={at(props.rect)} />
      <Show when={layout().deck}>{(deck) => <CardFace cardId="back" hidden rect={deck()} />}</Show>
      <Show when={layout().discard}>{(top) => <CardFace cardId={top().cardId} rect={top().rect} />}</Show>
      <Index each={layout().counts}>
        {(count) => (
          <View class="absolute flex-row items-center justify-center" style={at(count().rect)}>
            <Text class="text-xs text-slate-300">{count().text}</Text>
          </View>
        )}
      </Index>
      <Index each={layout().sections}>
        {(section) => (
          <>
            <View class={layout().narrow ? "absolute flex-row items-center justify-center" : "absolute flex-row items-center px-[8]"} style={at(section().labelRect)}>
              <Text class={section().tone}>{section().label}</Text>
            </View>
            <Index each={section().cards}>{(card) => <PileCardFace card={card()} />}</Index>
          </>
        )}
      </Index>
    </>
  );
}

/** A pile card; one with cards stacked on it shows the top of the stack behind it and their count. */
function PileCardFace(props: { card: PileCard }) {
  const r = () => props.card.rect;
  return (
    <>
      <Show when={props.card.stack}>
        {(stack) => <CardFace cardId={stack().topId} hidden={stack().topId === "back"} rect={{ x: r().x + 3, y: r().y - 3, w: r().w, h: r().h }} />}
      </Show>
      <CardFace cardId={props.card.cardId} hidden={props.card.hidden} rect={r()} />
      <Show when={props.card.stack}>
        {(stack) => (
          <View
            class={stack().hidden === stack().count ? "absolute flex-row items-center justify-center rounded-[3] bg-[#1e1b4bf0] border border-violet-400" : "absolute flex-row items-center justify-center rounded-[3] bg-[#422006f0] border border-amber-400"}
            style={at({ x: r().x + 1, y: r().y + r().h - 17, w: r().w - 2, h: 16 })}
          >
            <Text class="text-xs text-white font-bold">{`${stack().hidden === stack().count ? "裏" : "重"}${stack().count}`}</Text>
          </View>
        )}
      </Show>
    </>
  );
}

type TileState = { tile: GuiTile; rect: Box; focused: boolean; targetable: boolean; dimmed: boolean; actionable: boolean };

function Tile(props: TileState) {
  const badgeH = 20;
  return (
    <>
      <CardFace cardId={props.tile.cardId} hidden={props.tile.kind === "hidden"} name={props.tile.name} rect={props.rect} />
      <Show when={props.tile.kind !== "hidden" && props.tile.sub}>
        <View
          class="absolute flex-row items-center justify-center bg-[#000000c0] rounded-[3]"
          style={{ insetL: props.rect.x + 2, insetT: props.rect.y + props.rect.h - badgeH - 2, width: props.rect.w - 4, height: badgeH }}
        >
          <Text class={props.tile.held ? "text-xs text-amber-300 font-bold" : "text-xs text-white font-bold"}>{props.tile.sub}</Text>
        </View>
      </Show>
      <Show when={props.dimmed}>
        <View class="absolute rounded-[5] bg-[#020617b8]" style={at(props.rect)} />
      </Show>
      <Show when={props.tile.selected}>
        <View class="absolute rounded-[6] border-[3] border-sky-400" style={at(props.rect)} />
      </Show>
      <Show when={props.focused}>
        <View class="absolute rounded-[7] border-[3] border-white" style={at({ x: props.rect.x - 3, y: props.rect.y - 3, w: props.rect.w + 6, h: props.rect.h + 6 })} />
      </Show>
      <Show when={!props.focused && props.targetable}>
        <View class="absolute rounded-[7] border-[3] border-rose-400" style={at({ x: props.rect.x - 3, y: props.rect.y - 3, w: props.rect.w + 6, h: props.rect.h + 6 })} />
      </Show>
      <Show when={!props.focused && !props.targetable && props.actionable && !props.dimmed}>
        <View class="absolute rounded-[6] border-[2] border-amber-400" style={at({ x: props.rect.x - 2, y: props.rect.y - 2, w: props.rect.w + 4, h: props.rect.h + 4 })} />
      </Show>
    </>
  );
}

/** Popup next to a card, or the centred list (variants / every action). */
export function MenuBox(props: { box: GuiBox; accent: boolean }) {
  return (
    <>
      <View
        class={props.accent ? "absolute rounded-[10] bg-[#0b1220f2] border-[2] border-sky-400 shadow-lg" : "absolute rounded-[10] bg-[#0b1220f2] border-[2] border-slate-500 shadow-lg"}
        style={at({ x: props.box.rect.x - 6, y: props.box.rect.y - 6, w: props.box.rect.w + 20, h: props.box.rect.h + 12 })}
      />
      <View class="absolute flex-row items-center" style={at(props.box.titleRect)}>
        <Text class="text-sm text-sky-300 font-bold">{props.box.title}</Text>
      </View>
      <Index each={props.box.rows}>
        {(row) => (
          <View
            class={row().selected ? "absolute flex-row items-center px-[4] rounded-[5] bg-gradient-to-r from-sky-600 to-blue-700" : "absolute flex-row items-center px-[4] rounded-[5]"}
            style={at({ x: row().rect.x - 2, y: row().rect.y, w: row().rect.w + 12, h: row().rect.h })}
          >
            <Text class={row().selected ? "text-sm text-white font-bold" : "text-sm text-slate-100"}>{row().text}</Text>
          </View>
        )}
      </Index>
    </>
  );
}

/** A zone's cards enlarged in a row (wrapping): beside the pile column, or over the board on a phone. */
function PeekPanel(props: { g: GuiGeometry; peek: PilePeek }) {
  const layout = () => {
    const g = props.g;
    const n = props.peek.cards.length;
    const portrait = isPortrait(g);
    const maxW = portrait ? g.board.w - 16 : 420;
    const cols = Math.min(n, portrait ? 3 : 4);
    const gap = 8;
    const cardW = Math.min(portrait ? 130 : 150, Math.floor((maxW - 16 - gap * (cols - 1)) / cols));
    const cardH = Math.round(cardW * CARD_RATIO);
    const rows = Math.ceil(n / cols);
    const captionH = props.peek.cards.some((c) => c.caption) ? 18 : 0;
    const rowH = cardH + captionH + gap;
    const w = cols * cardW + gap * (cols - 1) + 16;
    const h = 30 + rows * rowH + 4;
    const pile = webPileRect(g, HUMAN);
    const x = portrait ? Math.round((g.width - w) / 2) : pile.x - w - 12;
    const y = portrait ? g.board.y + 8 : Math.max(g.board.y, Math.min(props.peek.anchor.y - 40, g.board.y + g.board.h - h));
    const cards = props.peek.cards.map((card, i) => ({
      ...card,
      rect: { x: x + 8 + (i % cols) * (cardW + gap), y: y + 30 + Math.floor(i / cols) * rowH, w: cardW, h: cardH },
    }));
    return { panel: { x, y, w, h }, cards };
  };
  return (
    <>
      <View class="absolute rounded-[12] bg-[#0b1220f5] border-[2] border-amber-300 shadow-lg" style={at(layout().panel)} />
      <View class="absolute flex-row items-center px-[10]" style={at({ ...layout().panel, h: 28 })}>
        <Text class="text-sm text-amber-200 font-bold">{props.peek.title}</Text>
      </View>
      <Index each={layout().cards}>
        {(card) => (
          <>
            <CardFace cardId={card().cardId} hidden={card().hidden} rect={card().rect} />
            <Show when={card().caption}>
              <View class="absolute flex-row items-center justify-center" style={at({ x: card().rect.x - 4, y: card().rect.y + card().rect.h + 1, w: card().rect.w + 8, h: 16 })}>
                <Text class="text-xs text-violet-200">{card().caption}</Text>
              </View>
            </Show>
          </>
        )}
      </Index>
    </>
  );
}

export function MatchView(props: {
  view: GuiView;
  state: GameState;
  hot: string | null;
  footer: string;
  leaving: boolean;
  peek: PilePeek | null;
  /** The end-turn button is still ending phases. */
  endingTurn: boolean;
  drag: DragView | null;
}) {
  const v = () => props.view;
  // Where a selection-window card is ("自コマンド"), unclipped: the 12px caption fits the tile.
  const caption = (instanceId: string) => {
    const where = locateInstance(props.state, instanceId);
    return where ? `${where.player === HUMAN ? "自" : "敵"}${zoneLabel(where.zone)}` : undefined;
  };
  const g = () => props.view.geometry;
  const portrait = () => isPortrait(g());
  // Several moves and none on a visible card (start phase: release commands or
  // draw): the button opens the list of moves, so it must look pressable.
  const choose = () =>
    !v().endButton.enabled && !v().dialog && v().endButton.lines.includes("×:操作") && !v().rows.some((row) => row.tiles.some((tile) => tile.actionable));
  const endLines = () => (choose() ? ["操作を選ぶ"] : v().endButton.lines.filter((line) => line && line !== "R" && line !== "×:操作"));
  const endLive = () => v().endButton.enabled || choose();
  const buttons = () => matchButtons(g());
  return (
    <View class="w-full h-full bg-gradient-to-b from-[#0b1426] to-[#04070d]">
      {/* top bar: turn */}
      <View class="absolute flex-row items-center px-[16] bg-[#0f172acc] border border-[#1e293b]" style={at(g().topBar)}>
        <Text class="text-base text-sky-300 font-bold">{v().topBar}</Text>
      </View>

      <View
        class={
          props.leaving
            ? "absolute flex-row items-center justify-center rounded-[8] bg-rose-700 border border-rose-400"
            : props.hot === "leave"
              ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400"
              : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"
        }
        style={at(buttons().leave)}
      >
        <Text class={props.leaving ? "text-xs text-white font-bold" : "text-xs text-slate-300"}>{props.leaving ? (portrait() ? "もう一度で退出" : "もう一度押すと退出") : "対戦をやめる"}</Text>
      </View>

      {/* left: card detail / log */}
      <View class="absolute rounded-[10] bg-[#0b1220e0] border border-[#1e293b]" style={at(g().detail)} />
      <Show when={v().detailArt}>{(art) => <CardFace cardId={art().cardId} hidden={art().hidden} rect={art().rect} />}</Show>
      <Index each={v().detailLines}>
        {(line) => (
          <View class="absolute flex-row items-center" style={at(line().rect)}>
            <Text class={TONE[line().tone]}>{line().text}</Text>
          </View>
        )}
      </Index>

      {/* board */}
      <Index each={v().rows}>
        {(row) => {
          const label = () => ROW_LABELS[row().key] ?? ["", ""];
          // Portrait rows have no label column: the zone name sits at the
          // right end of the row, under the cards when the row is full.
          const panel = () =>
            portrait()
              ? { x: row().rect.x - 3, y: row().rect.y - 2, w: row().rect.w + 6, h: row().rect.h + 4 }
              : { x: row().rect.x - 70, y: row().rect.y - 3, w: row().rect.w + 76, h: row().rect.h + 6 };
          return (
            <>
              <View class={ROW_BG[row().zone] ?? ROW_BG.hand!} style={at(panel())} />
              <Show
                when={portrait()}
                fallback={
                  <View class="absolute flex-col justify-center" style={at({ x: panel().x + 10, y: panel().y, w: 56, h: panel().h })}>
                    <Text class="text-xs text-slate-400">{label()[0]}</Text>
                    <Text class={ROW_LABEL_TEXT[row().zone] ?? ROW_LABEL_TEXT.hand!}>{label()[1]}</Text>
                  </View>
                }
              >
                <View class="absolute flex-col items-end justify-end px-[6]" style={at({ x: panel().x, y: panel().y, w: panel().w, h: panel().h - 4 })}>
                  <Text class="text-xs text-slate-500">{label()[0]}</Text>
                  <Text class={ROW_LABEL_TEXT[row().zone] ?? ROW_LABEL_TEXT.hand!}>{label()[1]}</Text>
                </View>
              </Show>
              <Index each={row().tiles}>
                {(tile) => (
                  <Tile
                    tile={tile()}
                    rect={tile().rect}
                    focused={tile().focused}
                    targetable={tile().targetable}
                    dimmed={tile().dimmed}
                    actionable={tile().actionable}
                  />
                )}
              </Index>
              <Show when={row().moreLeft > 0}>
                <View class="absolute flex-row items-center justify-center rounded-[10] bg-amber-500" style={at({ x: row().rect.x - 8, y: row().rect.y + row().rect.h / 2 - 12, w: 34, h: 24 })}>
                  <Text class="text-xs text-slate-950 font-bold">{`‹${row().moreLeft}`}</Text>
                </View>
              </Show>
              <Show when={row().moreRight > 0}>
                <View
                  class="absolute flex-row items-center justify-center rounded-[10] bg-amber-500"
                  style={at({ x: row().rect.x + row().rect.w - 28, y: row().rect.y + row().rect.h / 2 - 12, w: 34, h: 24 })}
                >
                  <Text class="text-xs text-slate-950 font-bold">{`${row().moreRight}›`}</Text>
                </View>
              </Show>
            </>
          );
        }}
      </Index>
      <PilePanel state={props.state} player={CPU} rect={webPileRect(g(), CPU)} />
      <PilePanel state={props.state} player={HUMAN} rect={webPileRect(g(), HUMAN)} />
      <View class="absolute flex-row items-center px-[12] rounded-[6] bg-[#2a0b12d0]" style={at(g().strips[0])}>
        <Text class="text-sm text-rose-200 font-bold">{v().strips[0]}</Text>
      </View>
      <View class="absolute flex-row items-center px-[12] rounded-[6] bg-[#0b1d3ad0]" style={at(g().strips[1])}>
        <Text class="text-sm text-sky-200 font-bold">{v().strips[1]}</Text>
      </View>

      {/* right: phases, phase end, every action, log */}

      <Show when={!portrait()}>
        <View class="absolute flex-row items-center" style={at({ x: g().side.x, y: g().side.y, w: g().side.w, h: 24 })}>
          <Text class="text-xs text-slate-400 font-bold">フェイズ</Text>
        </View>
      </Show>
      <Index each={v().phases}>
        {(phase, i) => (
          <View
            class={
              portrait()
                ? phase().active
                  ? "absolute flex-row items-center justify-center rounded-[6] bg-gradient-to-r from-amber-500 to-orange-600"
                  : "absolute flex-row items-center justify-center rounded-[6] bg-[#111827] border border-[#1f2937]"
                : phase().active
                  ? "absolute flex-row items-center px-[10] gap-2 rounded-[6] bg-gradient-to-r from-amber-500 to-orange-600"
                  : "absolute flex-row items-center px-[10] gap-2 rounded-[6] bg-[#111827] border border-[#1f2937]"
            }
            style={at(phase().rect)}
          >
            <Show when={!portrait()}>
              <Text class={phase().active ? "text-xs text-white font-bold" : "text-xs text-slate-500"}>{String(i + 1)}</Text>
            </Show>
            <Text class={phase().active ? "text-sm text-white font-bold" : "text-sm text-slate-400"}>{phase().label}</Text>
          </View>
        )}
      </Index>
      <View
        class={
          v().endButton.enabled
            ? props.hot === "end"
              ? "absolute flex-col items-center justify-center rounded-[14] bg-gradient-to-b from-sky-400 to-blue-600 border-[2] border-white shadow-lg"
              : "absolute flex-col items-center justify-center rounded-[14] bg-gradient-to-b from-sky-500 to-blue-700 border-[2] border-sky-300 shadow-lg"
            : choose()
              ? props.hot === "end"
                ? "absolute flex-col items-center justify-center rounded-[14] bg-gradient-to-b from-amber-400 to-orange-600 border-[2] border-white shadow-lg"
                : "absolute flex-col items-center justify-center rounded-[14] bg-gradient-to-b from-amber-500 to-orange-700 border-[2] border-amber-300 shadow-lg"
            : "absolute flex-col items-center justify-center rounded-[14] bg-[#111827] border border-[#1f2937]"
        }
        style={at(v().endButton.rect)}
      >
        <Show
          when={portrait()}
          fallback={
            <>
              <Index each={endLines()}>
                {(text) => <Text class={endLive() ? "text-base text-white font-bold" : "text-sm text-slate-500"}>{text()}</Text>}
              </Index>
              <Show when={endLive()}>
                <Text class="text-xs text-sky-100">Space</Text>
              </Show>
            </>
          }
        >
          <Text class={endLive() ? "text-base text-white font-bold" : "text-sm text-slate-500"}>{endLines().join("")}</Text>
        </Show>
      </View>
      <View
        class={
          props.endingTurn
            ? "absolute flex-row items-center justify-center rounded-[8] bg-amber-700 border border-amber-400"
            : props.hot === "turn"
              ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400"
              : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"
        }
        style={at(buttons().turn)}
      >
        <Text class={props.endingTurn ? "text-sm text-white font-bold" : "text-sm text-slate-100"}>{props.endingTurn ? "終了中…" : "ターン終了"}</Text>
      </View>
      <View
        class={props.hot === "all" ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400" : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"}
        style={at(buttons().all)}
      >
        <Text class="text-sm text-slate-100">{portrait() ? "全操作" : "すべての操作"}</Text>
      </View>
      <View
        class={props.hot === "log" ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400" : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"}
        style={at(buttons().log)}
      >
        <Text class="text-sm text-slate-100">{portrait() ? "ログ" : "ログ / 詳細"}</Text>
      </View>

      {/* a pile zone enlarged: hovered, or tapped on a phone */}
      <Show when={props.peek}>{(peek) => <PeekPanel g={g()} peek={peek()} />}</Show>

      {/* toast: over the top bar, or over the phase pills on a phone */}
      <Show when={v().toast}>
        <View
          class="absolute flex-row items-center px-[14] rounded-[16] bg-gradient-to-r from-amber-600 to-orange-700 shadow-md"
          style={at(
            portrait()
              ? { x: 8, y: g().phaseRects[0]!.y, w: g().width - 16, h: g().phaseRects[0]!.h }
              : { x: Math.round(g().width * 0.3), y: 8, w: Math.round(g().width * 0.45), h: 28 },
          )}
        >
          <Text class="text-sm text-white font-bold">{v().toast}</Text>
        </View>
      </Show>

      {/* selection window */}
      <Show when={v().dialog}>
        {(dialog) => (
          <>
            <View class="absolute rounded-[10] bg-[#020617a0]" style={at(g().board)} />
            <View
              class="absolute rounded-[12] bg-[#0b1220f5] border-[2] border-amber-400 shadow-lg"
              style={at({ x: dialog().rect.x - 6, y: dialog().rect.y - 6, w: dialog().rect.w + 12, h: dialog().rect.h + 12 })}
            />
            <Index each={dialog().titleLines}>
              {(line) => (
                <View class="absolute flex-row items-center" style={at(line().rect)}>
                  <Text class={line().tone === "accent" ? "text-sm text-amber-300 font-bold" : TONE[line().tone]}>{line().text}</Text>
                </View>
              )}
            </Index>
            <Index each={dialog().cards}>
              {(card) => (
                <>
                  <Tile tile={card()} rect={card().rect} focused={card().focused} targetable={!card().focused} dimmed={false} actionable={false} />
                  <View class="absolute flex-row justify-center" style={at(card().captionRect)}>
                    <Text class="text-xs text-slate-400">{caption(card().instanceId) ?? card().caption}</Text>
                  </View>
                </>
              )}
            </Index>
            <Index each={dialog().buttons}>
              {(row) => (
                <View
                  class={row().selected ? "absolute flex-row items-center px-[10] rounded-[6] bg-gradient-to-r from-sky-600 to-blue-700" : "absolute flex-row items-center px-[10] rounded-[6] bg-[#1e293b]"}
                  style={at({ x: row().rect.x, y: row().rect.y + 1, w: row().rect.w, h: row().rect.h - 2 })}
                >
                  <Text class={row().selected ? "text-sm text-white font-bold" : "text-sm text-slate-100"}>{row().text}</Text>
                </View>
              )}
            </Index>
          </>
        )}
      </Show>

      <Show when={props.drag}>
        {(drag) => (
          <View class="absolute rounded-[8] border-[2] border-amber-300 shadow-lg" style={at({ x: drag().x - drag().w / 2 - 2, y: drag().y - drag().h / 2 - 2, w: drag().w + 4, h: drag().h + 4 })}>
            <CardFace cardId={drag().cardId} rect={{ x: 2, y: 2, w: drag().w, h: drag().h }} />
          </View>
        )}
      </Show>

      <Show when={v().popup}>{(box) => <MenuBox box={box()} accent={false} />}</Show>
      <Show when={v().list}>{(box) => <MenuBox box={box()} accent />}</Show>

      <View class={v().footerAccent ? "absolute flex-row items-center px-[16] bg-[#451a03e0]" : "absolute flex-row items-center px-[16] bg-[#0f172acc]"} style={at(g().footer)}>
        <Text class={v().footerAccent ? "text-xs text-amber-200" : "text-xs text-slate-400"}>{props.footer}</Text>
      </View>
    </View>
  );
}
