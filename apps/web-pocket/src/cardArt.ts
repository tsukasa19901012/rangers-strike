// Card images, decoded and uploaded by the host page (host/host.js
// globalThis.__rsCardArt). A texture appears a few frames after it is first
// asked for; artRevision changes then, so views that read it redraw.
import { createSignal } from "solid-js";

type CardArtHost = { texture(cardId: string): number; version(): number };
const host = (globalThis as unknown as { __rsCardArt?: CardArtHost }).__rsCardArt;

const [revision, setRevision] = createSignal(0);
export const artRevision = revision;

/** Texture handle for a card ("back" for the card back), or -1 while it loads. */
export function cardTexture(cardId: string): number {
  revision();
  return host ? host.texture(cardId) : -1;
}

/** Call once per frame: picks up textures that finished loading. */
export function pollCardArt(): void {
  const v = host?.version() ?? 0;
  if (v !== revision()) setRevision(v);
}
