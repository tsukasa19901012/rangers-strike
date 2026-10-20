// Draws the graphical match screen (GuiView from client-core). Every element is
// absolutely placed at the rectangle the core computed, so the core's touch hit
// test (hitTestGui) always matches what is on screen. No game logic here.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import type { GuiRowView, GuiTileView, GuiView, PanelTone } from "@rangers-strike/client-core";

type Box = { x: number; y: number; w: number; h: number };
const at = (r: Box) => ({ insetL: r.x, insetT: r.y, width: r.w, height: r.h });

// Class literals must be complete strings (PocketJS bakes them at build time).
const ROW_BG: Record<string, string> = {
  battle: "absolute bg-red-950 rounded-[3]",
  rush: "absolute bg-blue-950 rounded-[3]",
  command: "absolute bg-emerald-950 rounded-[3]",
  hand: "absolute bg-slate-900 rounded-[3]",
};
const ROW_BG_ACTIVE: Record<string, string> = {
  battle: "absolute bg-red-900 rounded-[3]",
  rush: "absolute bg-blue-900 rounded-[3]",
  command: "absolute bg-emerald-900 rounded-[3]",
  hand: "absolute bg-slate-800 rounded-[3]",
};

const TILE_BG: Record<string, string> = {
  unit: "absolute flex-col px-[2] bg-slate-700 rounded-[3]",
  command: "absolute flex-col px-[2] bg-teal-800 rounded-[3]",
  operation: "absolute flex-col px-[2] bg-violet-800 rounded-[3]",
  other: "absolute flex-col px-[2] bg-stone-700 rounded-[3]",
  hidden: "absolute flex-col px-[2] bg-slate-600 rounded-[3]",
};
const TILE_SELECTED = "absolute flex-col px-[2] bg-blue-700 rounded-[3]";
const RING_FOCUS = "absolute border-[2] border-white rounded-[3]";
const RING_ACTION = "absolute border-amber-400 rounded-[3]";

const TONE: Record<PanelTone, string> = {
  head: "text-xs text-white font-bold",
  body: "text-xs text-slate-100",
  dim: "text-xs text-slate-400",
  accent: "text-xs text-amber-300",
};

function zoneOf(row: GuiRowView): string {
  return row.key.slice(row.key.indexOf(":") + 1);
}

function Tile(props: { tile: GuiTileView }) {
  const t = () => props.tile;
  return (
    <>
      <View class={t().selected ? TILE_SELECTED : (TILE_BG[t().kind] ?? TILE_BG.other!)} style={at(t().rect)}>
        <View style={{ height: 15 }}>
          <Text class={t().kind === "hidden" ? "text-xs text-slate-400" : "text-xs text-white font-bold"}>
            {t().kind === "hidden" ? "■" : t().name}
          </Text>
        </View>
        <View style={{ height: 15 }}>
          <Text class={t().held ? "text-xs text-amber-300" : "text-xs text-slate-300"}>{t().sub}</Text>
        </View>
      </View>
      <Show when={t().focused}>
        <View class={RING_FOCUS} style={at(t().rect)} />
      </Show>
      <Show when={!t().focused && t().actionable}>
        <View class={RING_ACTION} style={at(t().rect)} />
      </Show>
    </>
  );
}

export function GuiMatchView(props: { view: GuiView }) {
  const v = () => props.view;
  const g = () => props.view.geometry;
  return (
    <View class="w-full h-full bg-slate-950">
      <View class="absolute flex-row items-center px-[4] bg-slate-800" style={at(g().topBar)}>
        <Text class="text-xs text-white font-bold">{v().topBar}</Text>
      </View>
      <View class="absolute flex-row items-center px-[4]" style={at(g().strips[0])}>
        <Text class="text-xs text-rose-300">{v().strips[0]}</Text>
      </View>
      <View class="absolute flex-row items-center px-[4]" style={at(g().strips[1])}>
        <Text class="text-xs text-sky-300">{v().strips[1]}</Text>
      </View>
      <Index each={v().rows}>
        {(row) => (
          <>
            <View class={row().active ? (ROW_BG_ACTIVE[zoneOf(row())] ?? ROW_BG_ACTIVE.hand!) : (ROW_BG[zoneOf(row())] ?? ROW_BG.hand!)} style={at(row().rect)} />
            <View class="absolute flex-col items-center" style={at({ x: row().rect.x, y: row().rect.y, w: g().tileX, h: row().rect.h })}>
              <View style={{ height: 15 }}>
                <Text class="text-xs text-slate-300 font-bold">{row().label}</Text>
              </View>
              <View style={{ height: 15 }}>
                <Text class="text-xs text-amber-300">
                  {row().moreLeft && row().moreRight ? "↔" : row().moreRight ? "›" : row().moreLeft ? "‹" : ""}
                </Text>
              </View>
            </View>
            <Index each={row().tiles}>{(tile) => <Tile tile={tile()} />}</Index>
          </>
        )}
      </Index>
      <View class="absolute bg-slate-900" style={at(g().panel)} />
      <Index each={v().panelLines}>
        {(line) => (
          <View class="absolute" style={at(line().rect)}>
            <Text class={TONE[line().tone]}>{line().text}</Text>
          </View>
        )}
      </Index>
      <View class="absolute bg-slate-800" style={at(v().menuTitleRect)}>
        <Text class={v().menuOpen ? "text-xs text-sky-300 font-bold" : "text-xs text-slate-400"}>{v().menuTitle}</Text>
      </View>
      <Index each={v().menuRows}>
        {(row) => (
          <View class={row().selected ? "absolute bg-blue-700 rounded-[2]" : "absolute"} style={at(row().rect)}>
            <Text class={row().selected ? "text-xs text-white font-bold" : v().menuOpen ? "text-xs text-slate-100" : "text-xs text-slate-400"}>
              {row().text}
            </Text>
          </View>
        )}
      </Index>
      <View class="absolute flex-row items-center px-[4] bg-slate-800" style={at(g().footer)}>
        <Text class="text-xs text-slate-400">{v().footer}</Text>
      </View>
    </View>
  );
}
