// Card-data splitting. Pure functions over parsed JSON, shared by build tools
// (apps/vita/scripts/build-engine.ts prunes the bundled card data) and by any
// shell that wants to fetch per-deck chunks at runtime.
import type { CardDataChunk } from "../platform/interfaces";

export type DeckLike = { id: string; entries: { cardId: string; count: number }[] };

/** Union of card ids referenced by the given decks. */
export function collectDeckCardIds(decks: readonly DeckLike[]): Set<string> {
  const ids = new Set<string>();
  for (const deck of decks) for (const entry of deck.entries) ids.add(entry.cardId);
  return ids;
}

/** One chunk per deck (card ids sorted), e.g. for lazy loading on the web. */
export function buildDeckChunks(decks: readonly DeckLike[]): CardDataChunk[] {
  return decks.map((deck) => ({
    id: `deck:${deck.id}`,
    cardIds: [...new Set(deck.entries.map((e) => e.cardId))].sort(),
  }));
}

/** Chunks needed for a match between the given deck ids. */
export function chunksForMatch(chunks: readonly CardDataChunk[], deckIds: readonly string[]): CardDataChunk[] {
  const wanted = new Set(deckIds.map((id) => `deck:${id}`));
  return chunks.filter((chunk) => wanted.has(chunk.id));
}

type Json = Record<string, unknown>;

const keepKeys = (obj: Json, keep: ReadonlySet<string>): Json =>
  Object.fromEntries(Object.entries(obj).filter(([id]) => keep.has(id)));

const keepCards = (doc: Json, keep: ReadonlySet<string>): Json => ({
  ...doc,
  cards: (doc.cards as { id: string }[]).filter((card) => keep.has(card.id)),
});

/**
 * Generated card-data files (paths relative to packages/cards/src) that can be
 * pruned to a card-id set without changing engine behavior for those cards.
 * apps/vita/scripts/verify-engine-prune.mjs checks this by replaying seeded
 * matches against the unpruned data.
 */
export const PRUNABLE_CARD_DATA: Readonly<Record<string, (doc: Json, keep: ReadonlySet<string>) => Json>> = {
  "generated/dsl-stubs/stubs-bundle.json": keepKeys,
  "generated/wiki-set-labels.json": (doc, keep) => ({ ...doc, labels: keepKeys(doc.labels as Json, keep) }),
  "generated/catalog/full-playable/cards.json": keepCards,
  "generated/catalog/core-playable/cards.json": keepCards,
  "generated/catalog/complexity-promoted/cards.json": keepCards,
  "generated/catalog/vanilla-promoted/cards.json": keepCards,
  "generated/catalog/wiki-stubs/cards.json": keepCards,
};

/** Returns the pruned document, or null when `path` is not a prunable file. */
export function pruneCardData(path: string, doc: unknown, keep: ReadonlySet<string>): unknown | null {
  const transform = PRUNABLE_CARD_DATA[path];
  return transform ? transform(doc as Json, keep) : null;
}
