// Card textures for the match screen. The build bakes every starter card into
// a CLUT8 IMG pak entry `app:card.<id>` (scripts/bake-card-images.ts) that the
// host does NOT upload at boot. A match uploads only the cards of both decks
// (preloadCards), uploads a card lazily if one appears from elsewhere, and
// frees everything when the match screen closes (releaseCards).
import { entries, get } from "@pocketjs/framework/pak";
import { getOps } from "@pocketjs/framework/solid";

const PREFIX = "app:card.";
const handles = new Map<string, number>();
let available: Set<string> | null = null;

function keys(): Set<string> {
  available ??= new Set(entries(PREFIX).map((key) => key.slice(PREFIX.length)));
  return available;
}

/** True when the build baked card images into the pak. */
export function hasCardArt(): boolean {
  return keys().size > 0;
}

/** Texture handle for a card ("back" for the card back), or -1 without an image. */
export function cardTexture(cardId: string): number {
  const cached = handles.get(cardId);
  if (cached !== undefined) return cached;
  let handle = -1;
  if (keys().has(cardId)) {
    const ops = getOps();
    const blob = get(PREFIX + cardId);
    handle = ops.uploadImgEntry
      ? ops.uploadImgEntry(blob)
      : ops.uploadTexture(blob.subarray(8), blob[0]! | (blob[1]! << 8), blob[2]! | (blob[3]! << 8), blob[4]!);
  }
  handles.set(cardId, handle);
  return handle;
}

/** Upload the given cards (both decks at match start) plus the card back. */
export function preloadCards(cardIds: Iterable<string>): number {
  cardTexture("back");
  for (const id of cardIds) cardTexture(id);
  return handles.size;
}

export function releaseCards(): void {
  const ops = getOps();
  for (const handle of handles.values()) if (handle >= 0) ops.freeTexture?.(handle);
  handles.clear();
}
