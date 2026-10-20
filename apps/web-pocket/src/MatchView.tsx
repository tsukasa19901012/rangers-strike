// The match screen: draws GuiView (client-core) at the rectangles of the web
// geometry (computeWebGuiGeometry). Every element sits where the core put it,
// so the core's hit test (hitTestGui) matches what is on screen. No game logic.
import { For, Index, Show } from "solid-js";
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
import { at, CardFace, type Box } from "./ui";

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
export function matchButtons(g: GuiGeometry): { all: Box; log: Box; leave: Box } {
  const e = g.endButton;
  if (isPortrait(g)) {
    const w = Math.floor((e.x - 8 - 8 - 6) / 2);
    return {
      leave: { x: g.width - 116, y: 6, w: 108, h: 28 },
      all: { x: 8, y: e.y, w, h: e.h },
      log: { x: 8 + w + 6, y: e.y, w, h: e.h },
    };
  }
  return {
    leave: { x: g.width - 176, y: 7, w: 168, h: 30 },
    all: { x: e.x, y: e.y + e.h + 14, w: e.w, h: 36 },
    log: { x: e.x, y: e.y + e.h + 58, w: e.w, h: 36 },
  };
}

const CARD_RATIO = 190 / 130;

/**
 * Deck and discard as cards, the power zone as a fan of cards (face-down ones
 * show their back), the other hidden zones as counts. A narrow column (phone
 * portrait) shows only the deck and stacks the power cards downwards.
 */
function PilePanel(props: { state: GameState; player: PlayerId; rect: Box }) {
  const p = () => props.state.players[props.player];
  const narrow = () => props.rect.w < 110;
  const cardW = () => (narrow() ? props.rect.w - 12 : Math.floor((props.rect.w - 18) / 2));
  const card = (i: number): Box => ({ x: props.rect.x + 6 + i * (cardW() + 6), y: props.rect.y + 8, w: cardW(), h: Math.round(cardW() * CARD_RATIO) });
  const topDiscard = () => p().discard[p().discard.length - 1];
  const faceDown = () => p().power.filter((c) => c.faceDown).length;
  const lines = () =>
    narrow()
      ? [`山札 ${p().deck.length}`, `捨札 ${p().discard.length}`, `パワー ${p().power.length}`]
      : [`パワー ${p().power.length}${faceDown() ? `（裏${faceDown()}）` : ""}`, p().operation.length ? `常駐 ${p().operation.length}` : ""].filter(Boolean);
  const linesTop = () => card(0).y + card(0).h + (narrow() ? 4 : 26);
  const powerIndex = () => (narrow() ? 2 : 0);
  // The power fan fills what is left of the column.
  const fan = (): Box[] => {
    const n = p().power.length;
    if (n === 0) return [];
    const top = linesTop() + lines().length * 18 + 4;
    const availW = props.rect.w - 12;
    const availH = props.rect.y + props.rect.h - 6 - top;
    if (availH < 24) return [];
    const x0 = props.rect.x + 6;
    if (narrow()) {
      const w = Math.min(availW, Math.floor(availH / CARD_RATIO));
      const h = Math.round(w * CARD_RATIO);
      const step = n > 1 ? Math.min(h + 4, Math.floor((availH - h) / (n - 1))) : 0;
      return p().power.map((_, i) => ({ x: x0, y: top + i * step, w, h }));
    }
    const w = Math.min(60, Math.floor(availH / CARD_RATIO));
    const h = Math.round(w * CARD_RATIO);
    const step = n > 1 ? Math.min(w + 4, Math.floor((availW - w) / (n - 1))) : 0;
    return p().power.map((_, i) => ({ x: x0 + i * step, y: top, w, h }));
  };
  return (
    <>
      <View class="absolute rounded-[8] bg-[#0b1220d0] border border-[#25324d]" style={at(props.rect)} />
      <Show when={p().deck.length > 0}>
        <CardFace cardId="back" hidden rect={card(0)} />
      </Show>
      <Show when={!narrow()}>
        <Show when={topDiscard()}>{(top) => <CardFace cardId={top().cardId} rect={card(1)} />}</Show>
        <View class="absolute flex-row items-center justify-center" style={at({ ...card(0), y: card(0).y + card(0).h + 2, h: 20 })}>
          <Text class="text-xs text-slate-300">{`山札 ${p().deck.length}`}</Text>
        </View>
        <View class="absolute flex-row items-center justify-center" style={at({ ...card(1), y: card(1).y + card(1).h + 2, h: 20 })}>
          <Text class="text-xs text-slate-300">{`捨札 ${p().discard.length}`}</Text>
        </View>
      </Show>
      <Index each={lines()}>
        {(line, i) => (
          <View class={narrow() ? "absolute flex-row items-center justify-center" : "absolute flex-row items-center px-[8]"} style={at({ x: props.rect.x, y: linesTop() + i * 18, w: props.rect.w, h: 18 })}>
            <Text class={i === powerIndex() ? "text-xs text-amber-300 font-bold" : "text-xs text-slate-300"}>{line()}</Text>
          </View>
        )}
      </Index>
      <For each={fan()}>{(rect, i) => <CardFace cardId={p().power[i()]?.cardId ?? "back"} hidden={!!p().power[i()]?.faceDown} rect={rect} />}</For>
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

export function MatchView(props: { view: GuiView; state: GameState; hot: string | null; footer: string; leaving: boolean }) {
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
        class={props.hot === "all" ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400" : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"}
        style={at(buttons().all)}
      >
        <Text class="text-sm text-slate-100">すべての操作</Text>
      </View>
      <View
        class={props.hot === "log" ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400" : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"}
        style={at(buttons().log)}
      >
        <Text class="text-sm text-slate-100">ログ / 詳細</Text>
      </View>

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

      <Show when={v().popup}>{(box) => <MenuBox box={box()} accent={false} />}</Show>
      <Show when={v().list}>{(box) => <MenuBox box={box()} accent />}</Show>

      <View class={v().footerAccent ? "absolute flex-row items-center px-[16] bg-[#451a03e0]" : "absolute flex-row items-center px-[16] bg-[#0f172acc]"} style={at(g().footer)}>
        <Text class={v().footerAccent ? "text-xs text-amber-200" : "text-xs text-slate-400"}>{props.footer}</Text>
      </View>
    </View>
  );
}
