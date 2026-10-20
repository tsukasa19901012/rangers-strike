// Draws the deck builder (DeckBuilderView from client-core) at the rectangles
// the core computed, so hitTestDeck matches what is on screen. No deck logic here.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import type { DeckBuilderView as DeckView, DeckTileView } from "@rangers-strike/client-core";
import { cardTexture } from "./cardTextures";
import { at, CardImage, MenuBox, TONE } from "./GuiMatchView";

function DeckTile(props: { tile: DeckTileView }) {
  const t = () => props.tile;
  const texture = () => cardTexture(t().cardId);
  return (
    <>
      <Show
        when={texture() >= 0}
        fallback={
          <View class="absolute flex-col px-[2] bg-slate-700 rounded-[3]" style={at(t().rect)}>
            <Text class="text-xs text-white">{t().name}</Text>
          </View>
        }
      >
        <View class="absolute overflow-hidden rounded-[3] bg-slate-800" style={at(t().rect)}>
          <CardImage texture={texture()} style={{ posType: 1, insetL: 0, insetT: 0, width: t().rect.w, height: t().rect.h }} />
        </View>
      </Show>
      <Show when={t().dimmed}>
        <View class="absolute bg-[#000000b0] rounded-[3]" style={at(t().rect)} />
      </Show>
      <Show when={t().badge}>
        <View
          class="absolute flex-row justify-center bg-amber-500 rounded-[3]"
          style={{ insetL: t().rect.x + t().rect.w - 26, insetT: t().rect.y + t().rect.h - 15, width: 26, height: 15 }}
        >
          <Text class="text-xs text-slate-950 font-bold">{t().badge}</Text>
        </View>
      </Show>
      <Show when={t().focused}>
        <View class="absolute border-[2] border-white rounded-[3]" style={at(t().rect)} />
      </Show>
    </>
  );
}

export function DeckBuilderView(props: { view: DeckView }) {
  const v = () => props.view;
  const g = () => props.view.geometry;
  return (
    <View class="w-full h-full bg-slate-950">
      <View class="absolute flex-row items-center px-[4] bg-slate-800" style={at(g().topBar)}>
        <Text class={v().valid ? "text-xs text-emerald-300 font-bold" : "text-xs text-amber-300 font-bold"}>{v().topBar}</Text>
      </View>
      <Show when={v().toast}>
        <View class="absolute flex-row items-center px-[4] bg-amber-900 rounded-[2]" style={at({ x: g().width * 0.56, y: 0, w: g().width * 0.44, h: g().topBar.h })}>
          <Text class="text-xs text-amber-100">{v().toast}</Text>
        </View>
      </Show>

      <View class="absolute bg-slate-900 rounded-[3]" style={at(g().detail)} />
      <Show when={v().detailArt}>
        {(art) => (
          <Show when={cardTexture(art().cardId) >= 0}>
            <View class="absolute overflow-hidden rounded-[3]" style={at(art().rect)}>
              <CardImage texture={cardTexture(art().cardId)} style={{ posType: 1, insetL: 0, insetT: 0, width: art().rect.w, height: art().rect.h }} />
            </View>
          </Show>
        )}
      </Show>
      <Index each={v().detailLines}>
        {(line) => (
          <View class="absolute" style={at(line().rect)}>
            <Text class={TONE[line().tone]}>{line().text}</Text>
          </View>
        )}
      </Index>

      <Index each={v().chips}>
        {(chip) => (
          <View class={chip().active ? "absolute flex-row items-center px-[3] bg-sky-700 rounded-[3]" : "absolute flex-row items-center px-[3] bg-slate-800 rounded-[3]"} style={at(chip().rect)}>
            <Text class={chip().active ? "text-xs text-white font-bold" : "text-xs text-slate-300"}>{chip().text}</Text>
          </View>
        )}
      </Index>
      <Index each={v().tiles}>{(tile) => <DeckTile tile={tile()} />}</Index>
      <Show when={v().emptyText}>
        <View class="absolute flex-row justify-center" style={at({ x: g().grid.x, y: g().grid.y + 60, w: g().grid.w, h: 15 })}>
          <Text class="text-xs text-slate-400">{v().emptyText}</Text>
        </View>
      </Show>

      <Show when={v().menu}>{(box) => <MenuBox box={box()} accent />}</Show>

      <View class="absolute flex-row items-center justify-between px-[4] bg-slate-800" style={at(g().footer)}>
        <Text class="text-xs text-slate-400">{v().footer}</Text>
        <Text class="text-xs text-sky-300">{v().pageText}</Text>
      </View>
    </View>
  );
}
