// Small drawing helpers shared by the screens.
import { createRenderEffect, Show } from "solid-js";
import { Image, Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { getOps } from "@pocketjs/framework/solid";
import { cardTexture } from "./cardArt";

export type Box = { x: number; y: number; w: number; h: number };

/** Absolute placement at a client-core rectangle (logical px). */
export const at = (r: Box) => ({ insetL: r.x, insetT: r.y, width: r.w, height: r.h });

export const inside = (r: Box, p: { x: number; y: number }) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** An image node showing a texture handle (the host uploads card images at runtime). */
export function TextureImage(props: { texture: number; style: Record<string, number> }) {
  let node: NodeMirror | undefined;
  const image = <Image ref={(n: NodeMirror) => (node = n)} style={props.style} />;
  createRenderEffect(() => {
    const texture = props.texture;
    if (node) getOps().setImage(node.id, texture);
  });
  return image;
}

/**
 * A held card lies on its side (rules: ホールド = 横向き). The upright card is
 * shrunk so that, turned 90°, its long side spans the slot width, and it sits
 * centred above the tile's bottom badge.
 */
function sidewaysSize(slot: Box) {
  return { w: Math.round((slot.w * slot.w) / slot.h), h: slot.w };
}

function sidewaysStyle(slot: Box) {
  const badge = 22;
  const { w: short, h: long } = sidewaysSize(slot);
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + Math.max(short / 2, (slot.h - badge) / 2);
  return { ...at({ x: cx - short / 2, y: cy - long / 2, w: short, h: long }), rotate: 90 };
}

/**
 * A whole card at `rect`: its image once loaded, a framed placeholder with the
 * name until then (and for cards without an image).
 */
export function CardFace(props: { cardId: string; hidden?: boolean; name?: string; rect: Box; sideways?: boolean }) {
  const texture = () => cardTexture(props.hidden ? "back" : props.cardId);
  const size = () => (props.sideways ? sidewaysSize(props.rect) : { w: props.rect.w, h: props.rect.h });
  return (
    <View class="absolute overflow-hidden rounded-[5] bg-slate-800 border border-slate-600" style={props.sideways ? sidewaysStyle(props.rect) : at(props.rect)}>
      <Show
        when={texture() >= 0}
        fallback={
          <View class="absolute flex-col p-[4] bg-gradient-to-b from-slate-700 to-slate-900" style={{ insetL: 0, insetT: 0, width: size().w, height: size().h }}>
            <Text class="text-xs text-slate-300">{props.hidden ? "" : (props.name ?? props.cardId)}</Text>
          </View>
        }
      >
        <TextureImage texture={texture()} style={{ posType: 1, insetL: 0, insetT: 0, width: size().w, height: size().h }} />
      </Show>
    </View>
  );
}
