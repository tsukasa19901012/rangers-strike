// The deck builder: draws DeckBuilderView (client-core) at the rectangles of
// the web geometry (computeWebDeckGeometry). The app turns clicks into the
// builder's logical inputs. No deck rules here. The search and deck-name
// fields are only boxes here: the host page puts real text inputs over them
// (app.tsx sends their rectangles), so phones get their own keyboard and IME.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { isPortrait, type DeckBuilderView, type DeckGeometry } from "@rangers-strike/client-core";
import { FullTextPanel, MenuBox, TONE } from "./MatchView";
import { at, CardFace, type Box } from "./ui";

/** Header and pager buttons (not part of DeckBuilderView; the app handles their clicks). */
export function deckButtons(g: DeckGeometry): { menu: Box; prev: Box; next: Box; pager: Box } {
  const y = g.grid.y + g.grid.h + 6;
  const pagerW = isPortrait(g) ? 96 : 120;
  return {
    menu: isPortrait(g) ? { x: g.width - 104, y: 5, w: 96, h: 30 } : { x: g.width - 168, y: 6, w: 160, h: 32 },
    prev: { x: g.grid.x, y, w: pagerW, h: 30 },
    next: { x: g.grid.x + g.grid.w - pagerW, y, w: pagerW, h: 30 },
    pager: { x: g.grid.x + pagerW + 10, y, w: g.grid.w - 2 * (pagerW + 10), h: 30 },
  };
}

/** Landscape toast: over the bottom of the grid, above the pager (the top bar holds the name field). */
function toastBox(g: DeckGeometry): Box {
  const w = Math.round(Math.min(g.grid.w * 0.7, g.width * 0.46));
  return { x: g.grid.x + Math.round((g.grid.w - w) / 2), y: g.grid.y + g.grid.h - 34, w, h: 28 };
}

/** Chip captions without the console button names ("(L)", "(△)", "(R)"). */
const chipText = (text: string) => text.replace(/\s*\([^)]*\)$/, "");

const BUTTON = "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]";
const BUTTON_HOT = "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400";

export function DeckView(props: { view: DeckBuilderView; hot: string | null; footer: string; fullText: boolean }) {
  const v = () => props.view;
  const g = () => props.view.geometry;
  const b = () => deckButtons(g());
  const portrait = () => isPortrait(g());
  return (
    <View class="w-full h-full bg-gradient-to-b from-[#0b1426] to-[#04070d]">
      <View class="absolute flex-row items-center px-[16] gap-4 bg-[#0f172acc] border border-[#1e293b]" style={at(g().topBar)}>
        <Show when={!portrait()}>
          <Text class="text-base text-sky-300 font-bold">デッキ構築</Text>
        </Show>
        <Text class={v().valid ? "text-sm text-emerald-300 font-bold" : "text-sm text-amber-300 font-bold"}>{v().topBar}</Text>
      </View>
      <View class={props.hot === "menu" ? BUTTON_HOT : BUTTON} style={at(b().menu)}>
        <Text class="text-sm text-slate-100">{portrait() ? "メニュー" : "保存・メニュー"}</Text>
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

      <Index each={v().detailButtons}>
        {(button) => (
          <View
            class={
              !button().enabled
                ? "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b80] border border-[#334155]"
                : button().id === "add"
                  ? "absolute flex-row items-center justify-center rounded-[8] bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-400"
                  : "absolute flex-row items-center justify-center rounded-[8] bg-gradient-to-r from-rose-600 to-red-700 border border-rose-400"
            }
            style={at(button().rect)}
          >
            <Text class={button().enabled ? "text-sm text-white font-bold" : "text-sm text-slate-500"}>{button().text}</Text>
          </View>
        )}
      </Index>

      {/* text fields (the host's inputs sit on top) */}
      <Index each={v().textFields}>
        {(field) => <View class="absolute rounded-[8] bg-[#0b1220] border border-[#475569]" style={at(field().rect)} />}
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
      {/* the toast over the grid's bottom (drawn after the cards so they do not cover it) */}
      <Show when={v().toast}>
        <View
          class="absolute flex-row items-center px-[14] rounded-[16] bg-gradient-to-r from-emerald-600 to-teal-700 shadow-md"
          style={at(portrait() ? { x: 8, y: 6, w: g().width - 120, h: 28 } : toastBox(g()))}
        >
          <Text class="text-sm text-white font-bold">{v().toast}</Text>
        </View>
      </Show>
      <View class={props.hot === "prev" ? BUTTON_HOT : BUTTON} style={at(b().prev)}>
        <Text class="text-sm text-slate-100">{portrait() ? "‹ 前へ" : "‹ 前のページ"}</Text>
      </View>
      <View class="absolute flex-row items-center justify-center" style={at(b().pager)}>
        <Text class="text-sm text-slate-400">{v().pageText}</Text>
      </View>
      <View class={props.hot === "next" ? BUTTON_HOT : BUTTON} style={at(b().next)}>
        <Text class="text-sm text-slate-100">{portrait() ? "次へ ›" : "次のページ ›"}</Text>
      </View>

      <Show when={props.fullText && !v().menu && v().detailFull}>{(full) => <FullTextPanel area={g().grid} full={full()} />}</Show>

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
