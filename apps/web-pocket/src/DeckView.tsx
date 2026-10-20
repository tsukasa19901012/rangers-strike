// The deck builder: draws DeckBuilderView (client-core) at the rectangles of
// the web geometry (computeWebDeckGeometry). The app turns clicks into the
// builder's logical inputs. No deck rules here.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import type { DeckBuilderView, DeckGeometry } from "@rangers-strike/client-core";
import { MenuBox, TONE } from "./MatchView";
import { at, CardFace, type Box } from "./ui";

/** Header and pager buttons (not part of DeckBuilderView; the app handles their clicks). */
export function deckButtons(g: DeckGeometry): { menu: Box; prev: Box; next: Box; pager: Box } {
  const y = g.grid.y + g.grid.h + 6;
  return {
    menu: { x: g.width - 168, y: 6, w: 160, h: 32 },
    prev: { x: g.grid.x, y, w: 120, h: 30 },
    next: { x: g.grid.x + g.grid.w - 120, y, w: 120, h: 30 },
    pager: { x: g.grid.x + 130, y, w: g.grid.w - 260, h: 30 },
  };
}

/** Chip captions without the console button names ("(L)", "(△)", "(R)"). */
const chipText = (text: string) => text.replace(/\s*\([^)]*\)$/, "");

const BUTTON = "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]";
const BUTTON_HOT = "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400";

export function DeckView(props: { view: DeckBuilderView; hot: string | null; footer: string }) {
  const v = () => props.view;
  const g = () => props.view.geometry;
  const b = () => deckButtons(g());
  return (
    <View class="w-full h-full bg-gradient-to-b from-[#0b1426] to-[#04070d]">
      <View class="absolute flex-row items-center px-[16] gap-4 bg-[#0f172acc] border border-[#1e293b]" style={at(g().topBar)}>
        <Text class="text-base text-sky-300 font-bold">デッキ構築</Text>
        <Text class={v().valid ? "text-sm text-emerald-300 font-bold" : "text-sm text-amber-300 font-bold"}>{v().topBar}</Text>
      </View>
      <Show when={v().toast}>
        <View
          class="absolute flex-row items-center px-[14] rounded-[16] bg-gradient-to-r from-emerald-600 to-teal-700 shadow-md"
          style={at({ x: Math.round(g().width * 0.45), y: 8, w: Math.round(g().width * 0.32), h: 28 })}
        >
          <Text class="text-sm text-white font-bold">{v().toast}</Text>
        </View>
      </Show>
      <View class={props.hot === "menu" ? BUTTON_HOT : BUTTON} style={at(b().menu)}>
        <Text class="text-sm text-slate-100">保存・メニュー</Text>
      </View>

      {/* detail */}
      <View class="absolute rounded-[10] bg-[#0b1220e0] border border-[#1e293b]" style={at(g().detail)} />
      <Show when={v().detailArt}>{(art) => <CardFace cardId={art().cardId} rect={art().rect} />}</Show>
      <Index each={v().detailLines}>
        {(line) => (
          <View class="absolute flex-row items-center" style={at(line().rect)}>
            <Text class={TONE[line().tone]}>{line().text}</Text>
          </View>
        )}
      </Index>

      {/* filters */}
      <Index each={v().chips}>
        {(chip, i) => (
          <View
            class={
              chip().active
                ? "absolute flex-row items-center justify-center rounded-[16] bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-400"
                : props.hot === `chip${i}`
                  ? "absolute flex-row items-center justify-center rounded-[16] bg-slate-700 border border-slate-400"
                  : "absolute flex-row items-center justify-center rounded-[16] bg-[#1e293b] border border-[#334155]"
            }
            style={at(chip().rect)}
          >
            <Text class={chip().active ? "text-sm text-white font-bold" : "text-sm text-slate-200"}>{chipText(chip().text)}</Text>
          </View>
        )}
      </Index>

      {/* grid */}
      <Index each={v().tiles}>
        {(tile) => (
          <>
            <CardFace cardId={tile().cardId} name={tile().name} rect={tile().rect} />
            <Show when={tile().dimmed}>
              <View class="absolute rounded-[5] bg-[#020617c0]" style={at(tile().rect)} />
            </Show>
            <Show when={tile().badge}>
              <View
                class="absolute flex-row items-center justify-center rounded-[12] bg-gradient-to-r from-amber-400 to-orange-500 border-[2] border-white"
                style={at({ x: tile().rect.x + tile().rect.w - 46, y: tile().rect.y + tile().rect.h - 30, w: 42, h: 24 })}
              >
                <Text class="text-xs text-slate-950 font-bold">{tile().badge}</Text>
              </View>
            </Show>
            <Show when={tile().focused}>
              <View
                class="absolute rounded-[8] border-[3] border-white"
                style={at({ x: tile().rect.x - 3, y: tile().rect.y - 3, w: tile().rect.w + 6, h: tile().rect.h + 6 })}
              />
            </Show>
          </>
        )}
      </Index>
      <Show when={v().emptyText}>
        <View class="absolute flex-row items-center justify-center" style={at(g().grid)}>
          <Text class="text-sm text-slate-400">{v().emptyText}</Text>
        </View>
      </Show>
      <View class={props.hot === "prev" ? BUTTON_HOT : BUTTON} style={at(b().prev)}>
        <Text class="text-sm text-slate-100">‹ 前のページ</Text>
      </View>
      <View class="absolute flex-row items-center justify-center" style={at(b().pager)}>
        <Text class="text-sm text-slate-400">{v().pageText}</Text>
      </View>
      <View class={props.hot === "next" ? BUTTON_HOT : BUTTON} style={at(b().next)}>
        <Text class="text-sm text-slate-100">次のページ ›</Text>
      </View>

      <Show when={v().menu}>
        {(menu) => (
          <>
            <View class="absolute bg-[#020617b0]" style={{ insetL: 0, insetT: 0, width: g().width, height: g().height }} />
            <MenuBox box={menu()} accent />
          </>
        )}
      </Show>

      <View class="absolute flex-row items-center px-[16] bg-[#0f172acc]" style={at(g().footer)}>
        <Text class="text-xs text-slate-400">{props.footer}</Text>
      </View>
    </View>
  );
}
