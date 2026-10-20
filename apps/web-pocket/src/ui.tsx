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
 * A whole card at `rect`: its image once loaded, a framed placeholder with the
 * name until then (and for cards without an image).
 */
export function CardFace(props: { cardId: string; hidden?: boolean; name?: string; rect: Box }) {
  const texture = () => cardTexture(props.hidden ? "back" : props.cardId);
  return (
    <View class="absolute overflow-hidden rounded-[5] bg-slate-800 border border-slate-600" style={at(props.rect)}>
      <Show
        when={texture() >= 0}
        fallback={
          <View class="absolute flex-col p-[4] bg-gradient-to-b from-slate-700 to-slate-900" style={{ insetL: 0, insetT: 0, width: props.rect.w, height: props.rect.h }}>
            <Text class="text-xs text-slate-300">{props.hidden ? "" : (props.name ?? props.cardId)}</Text>
          </View>
        }
      >
        <TextureImage texture={texture()} style={{ posType: 1, insetL: 0, insetT: 0, width: props.rect.w, height: props.rect.h }} />
      </Show>
    </View>
  );
}
