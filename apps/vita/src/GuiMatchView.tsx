// Draws the graphical match screen (GuiView from client-core). Every element is
// absolutely placed at the rectangle the core computed, so the core's touch hit
// test (hitTestGui) always matches what is on screen. No game logic here.
import { createRenderEffect, Index, Show } from "solid-js";
import { Image, Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { getOps } from "@pocketjs/framework/solid";
import type { GuiBox, GuiTile, GuiView, PanelTone } from "@rangers-strike/client-core";
import { cardTexture } from "./cardTextures";

type Box = { x: number; y: number; w: number; h: number };
export const at = (r: Box) => ({ insetL: r.x, insetT: r.y, width: r.w, height: r.h });
const LINE = { height: 15 };

// Class literals must be complete strings (PocketJS bakes them at build time).
const ROW_BG: Record<string, string> = {
  battle: "absolute bg-red-950 rounded-[3]",
  rush: "absolute bg-blue-950 rounded-[3]",
  command: "absolute bg-emerald-950 rounded-[3]",
  hand: "absolute bg-slate-900 rounded-[3]",
};

const TILE_BG: Record<string, string> = {
  unit: "absolute flex-col px-[2] bg-slate-700 rounded-[3]",
  command: "absolute flex-col px-[2] bg-teal-800 rounded-[3]",
  operation: "absolute flex-col px-[2] bg-violet-800 rounded-[3]",
  other: "absolute flex-col px-[2] bg-stone-700 rounded-[3]",
  hidden: "absolute flex-col px-[2] bg-slate-600 rounded-[3]",
};
const TILE_DIM = "absolute flex-col px-[2] bg-slate-800 rounded-[3] opacity-40";
const TILE_SELECTED = "absolute flex-col px-[2] bg-blue-700 rounded-[3]";
const RING_FOCUS = "absolute border-[2] border-white rounded-[3]";
const RING_TARGET = "absolute border-[2] border-rose-400 rounded-[3]";
const RING_ACTION = "absolute border-amber-400 rounded-[3]";

export const TONE: Record<PanelTone, string> = {
  head: "text-xs text-white font-bold",
  body: "text-xs text-slate-100",
  dim: "text-xs text-slate-400",
  accent: "text-xs text-amber-300 font-bold",
};

// Card art: the texture is stretched over the image node, so the node keeps the
// card's 130:190 aspect. A tile shows the art band (about 10-50% of the card).
const CARD_ASPECT = 190 / 130;

export function CardImage(props: { texture: number; style: Record<string, number> }) {
  let node: NodeMirror | undefined;
  // Create the node first: the effect must see it on its first run.
  const image = <Image ref={(n: NodeMirror) => (node = n)} style={props.style} />;
  createRenderEffect(() => {
    const texture = props.texture;
    if (node) getOps().setImage(node.id, texture);
  });
  return image;
}

/** A held card lies on its side (rules: ホールド = 横向き): its long side spans the tile, centred. */
function sidewaysArt(rect: Box) {
  const long = rect.w;
  const short = Math.round(long / CARD_ASPECT);
  return { posType: 1, insetL: Math.round((rect.w - short) / 2), insetT: Math.round((rect.h - long) / 2), width: short, height: long, rotate: 90 };
}

function ArtTile(props: TileProps & { texture: number }) {
  const artH = () => Math.round(props.rect.w * CARD_ASPECT);
  return (
    <>
      <View class="absolute overflow-hidden rounded-[3] bg-slate-800" style={at(props.rect)}>
        <CardImage
          texture={props.texture}
          style={props.tile.held ? sidewaysArt(props.rect) : { posType: 1, insetL: 0, insetT: -Math.round(artH() * 0.1), width: props.rect.w, height: artH() }}
        />
        <Show when={props.tile.kind !== "hidden"}>
          <View class="absolute flex-row items-center px-[2] bg-[#000000b0]" style={{ insetL: 0, insetT: props.rect.h - 15, width: props.rect.w, height: 15 }}>
            <Text class={props.tile.held ? "text-xs text-amber-300 font-bold" : "text-xs text-white font-bold"}>{props.tile.sub}</Text>
          </View>
        </Show>
        <Show when={props.dimmed}>
          <View class="absolute bg-[#000000a8]" style={{ insetL: 0, insetT: 0, width: props.rect.w, height: props.rect.h }} />
        </Show>
      </View>
      <Show when={props.tile.selected}>
        <View class="absolute border-[2] border-blue-400 rounded-[3]" style={at(props.rect)} />
      </Show>
      <Rings {...props} />
    </>
  );
}

function Rings(props: TileProps) {
  return (
    <>
      <Show when={props.focused}>
        <View class={RING_FOCUS} style={at(props.rect)} />
      </Show>
      <Show when={!props.focused && props.targetable}>
        <View class={RING_TARGET} style={at(props.rect)} />
      </Show>
      <Show when={!props.focused && !props.targetable && props.tile.actionable && !props.dimmed}>
        <View class={RING_ACTION} style={at(props.rect)} />
      </Show>
    </>
  );
}

type TileProps = { tile: GuiTile; rect: Box; focused: boolean; targetable: boolean; dimmed: boolean };

function Tile(props: TileProps) {
  const texture = () => cardTexture(props.tile.kind === "hidden" ? "back" : props.tile.cardId);
  return (
    <Show when={texture() >= 0} fallback={<TextTile {...props} />}>
      <ArtTile {...props} texture={texture()} />
    </Show>
  );
}

function TextTile(props: TileProps) {
  return (
    <>
      <View
        class={props.dimmed ? TILE_DIM : props.tile.selected ? TILE_SELECTED : (TILE_BG[props.tile.kind] ?? TILE_BG.other!)}
        style={at(props.rect)}
      >
        <View style={LINE}>
          <Text class={props.tile.kind === "hidden" ? "text-xs text-slate-400" : "text-xs text-white font-bold"}>
            {props.tile.kind === "hidden" ? "■" : props.tile.name}
          </Text>
        </View>
        <View style={LINE}>
          <Text class={props.tile.held ? "text-xs text-amber-300" : "text-xs text-slate-300"}>{props.tile.sub}</Text>
        </View>
      </View>
      <Rings {...props} />
    </>
  );
}

/** Popup next to a card, or the centred list (variants / every action). */
export function MenuBox(props: { box: GuiBox; accent: boolean }) {
  return (
    <>
      <View class="absolute bg-slate-950 border-sky-500 rounded-[4] shadow-md" style={at(props.box.rect)} />
      <View class="absolute" style={at(props.box.titleRect)}>
        <Text class={props.accent ? "text-xs text-sky-300 font-bold" : "text-xs text-slate-300 font-bold"}>{props.box.title}</Text>
      </View>
      <Index each={props.box.rows}>
        {(row) => (
          <View class={row().selected ? "absolute bg-blue-700 rounded-[2]" : "absolute"} style={at(row().rect)}>
            <Text class={row().selected ? "text-xs text-white font-bold" : "text-xs text-slate-100"}>{row().text}</Text>
          </View>
        )}
      </Index>
    </>
  );
}

export function GuiMatchView(props: { view: GuiView }) {
  const v = () => props.view;
  const g = () => props.view.geometry;
  return (
    <View class="w-full h-full bg-slate-950">
      {/* top bar: turn / phase, CPU move toast */}
      <View class="absolute flex-row items-center px-[4] bg-slate-800" style={at(g().topBar)}>
        <Text class="text-xs text-white font-bold">{v().topBar}</Text>
      </View>
      <Show when={v().toast}>
        <View class="absolute flex-row items-center px-[4] bg-amber-900 rounded-[2]" style={at({ x: g().width * 0.41, y: 0, w: g().width * 0.59, h: g().topBar.h })}>
          <Text class="text-xs text-amber-100">{v().toast}</Text>
        </View>
      </Show>

      {/* left: card detail / log */}
      <View class="absolute bg-slate-900 rounded-[3]" style={at(g().detail)} />
      <Show when={v().detailArt}>
        {(art) => (
          <Show when={cardTexture(art().hidden ? "back" : art().cardId) >= 0}>
            <View class="absolute overflow-hidden rounded-[3]" style={at(art().rect)}>
              <CardImage
                texture={cardTexture(art().hidden ? "back" : art().cardId)}
                style={{ posType: 1, insetL: 0, insetT: 0, width: art().rect.w, height: art().rect.h }}
              />
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

      {/* board */}
      <View class="absolute flex-row items-center px-[4]" style={at(g().strips[0])}>
        <Text class="text-xs text-rose-300">{v().strips[0]}</Text>
      </View>
      <View class="absolute flex-row items-center px-[4]" style={at(g().strips[1])}>
        <Text class="text-xs text-sky-300">{v().strips[1]}</Text>
      </View>
      <Index each={v().rows}>
        {(row) => (
          <>
            <View class={ROW_BG[row().zone] ?? ROW_BG.hand!} style={at(row().rect)} />
            <Index each={row().tiles}>
              {(tile) => (
                <Tile tile={tile()} rect={tile().rect} focused={tile().focused} targetable={tile().targetable} dimmed={tile().dimmed} />
              )}
            </Index>
            <Show when={row().moreRight > 0}>
              <View class="absolute bg-slate-950 rounded-[2]" style={at({ x: row().rect.x + row().rect.w - 14, y: row().rect.y + 9, w: 14, h: 15 })}>
                <Text class="text-xs text-amber-300 font-bold">›</Text>
              </View>
            </Show>
            <Show when={row().moreLeft > 0}>
              <View class="absolute bg-slate-950 rounded-[2]" style={at({ x: row().rect.x, y: row().rect.y + 9, w: 10, h: 15 })}>
                <Text class="text-xs text-amber-300 font-bold">‹</Text>
              </View>
            </Show>
          </>
        )}
      </Index>

      {/* right: phases and the phase-end button */}
      <Index each={v().phases}>
        {(phase) => (
          <View class={phase().active ? "absolute flex-row justify-center bg-sky-600 rounded-[3]" : "absolute flex-row justify-center bg-slate-800 rounded-[3]"} style={at(phase().rect)}>
            <Text class={phase().active ? "text-xs text-white font-bold" : "text-xs text-slate-400"}>{phase().label}</Text>
          </View>
        )}
      </Index>
      <View
        class={v().endButton.enabled ? "absolute flex-col items-center justify-center bg-orange-600 rounded-[6] shadow-md" : "absolute flex-col items-center justify-center bg-slate-800 rounded-[6]"}
        style={at(v().endButton.rect)}
      >
        <Index each={v().endButton.lines}>
          {(text) => (
            <View style={LINE}>
              <Text class={v().endButton.enabled ? "text-xs text-white font-bold" : "text-xs text-slate-500"}>{text()}</Text>
            </View>
          )}
        </Index>
      </View>

      {/* selection window */}
      <Show when={v().dialog}>
        {(dialog) => (
          <>
            <View class="absolute bg-slate-950 border-amber-400 rounded-[4] shadow-lg" style={at(dialog().rect)} />
            <Index each={dialog().titleLines}>
              {(line) => (
                <View class="absolute" style={at(line().rect)}>
                  <Text class={TONE[line().tone]}>{line().text}</Text>
                </View>
              )}
            </Index>
            <Index each={dialog().cards}>
              {(card) => (
                <>
                  <Tile tile={card()} rect={card().rect} focused={card().focused} targetable={!card().focused} dimmed={false} />
                  <View class="absolute" style={at(card().captionRect)}>
                    <Text class="text-xs text-slate-400">{card().caption}</Text>
                  </View>
                </>
              )}
            </Index>
            <Index each={dialog().buttons}>
              {(row) => (
                <View class={row().selected ? "absolute bg-blue-700 rounded-[2]" : "absolute bg-slate-800 rounded-[2]"} style={at(row().rect)}>
                  <Text class={row().selected ? "text-xs text-white font-bold" : "text-xs text-slate-100"}>{row().text}</Text>
                </View>
              )}
            </Index>
          </>
        )}
      </Show>

      <Show when={v().popup}>{(box) => <MenuBox box={box()} accent={false} />}</Show>
      <Show when={v().list}>{(box) => <MenuBox box={box()} accent />}</Show>

      <View class={v().footerAccent ? "absolute flex-row items-center px-[4] bg-amber-950" : "absolute flex-row items-center px-[4] bg-slate-800"} style={at(g().footer)}>
        <Text class={v().footerAccent ? "text-xs text-amber-200" : "text-xs text-slate-400"}>{v().footer}</Text>
      </View>
    </View>
  );
}
