// A deck shared from one player to another (web: the deck builder's 共有する).
// Two forms carry the same thing, a name and a card list:
//   - the payload ({ name, cards: "RS-004,RS-005*2,…" }), which the web shell
//     compresses into a URL (#d=RD1.… or a short /?d=<id>);
//   - a text list, one "枚数 カードID カード名" line per card, for chats and
//     hand-written lists. Reading it only needs the card ids.
// Both come from outside, so reading them checks every id against the catalog.
import type { DeckEntry } from "../engineApi";

export const DECK_SHARE_VERSION = 1;
export const DECK_SHARE_NAME_MAX = 40;
/** More copies than any deck holds: a larger count is a typo, not a card list. */
const MAX_COUNT = 99;

export type DeckSharePayload = { v: typeof DECK_SHARE_VERSION; name: string; cards: string };

/** A deck read from a payload or a text list. */
export type ImportedDeck = {
  name: string;
  entries: DeckEntry[];
  /** Lines (text) or card ids (payload) that could not be read. */
  unreadable: string[];
};

const ENTRY = /^([A-Za-z]{2}\d?-\d{3})(?:\*(\d{1,2}))?$/;
const CARD_ID = /([A-Za-z]{2}\d?-\d{3})(?![0-9])/;

function addEntry(counts: Map<string, number>, cardId: string, count: number): void {
  counts.set(cardId, Math.min(MAX_COUNT, (counts.get(cardId) ?? 0) + count));
}

const toEntries = (counts: Map<string, number>): DeckEntry[] => [...counts].map(([cardId, count]) => ({ cardId, count }));

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, DECK_SHARE_NAME_MAX);

export function buildDeckSharePayload(name: string, entries: readonly DeckEntry[]): DeckSharePayload {
  const cards = entries
    .filter((e) => e.count > 0)
    .map((e) => (e.count > 1 ? `${e.cardId}*${e.count}` : e.cardId))
    .join(",");
  return { v: DECK_SHARE_VERSION, name: cleanName(name), cards };
}

/** Checks a decoded payload (it comes from a URL anyone can write). Null when it is not a deck at all. */
export function parseDeckSharePayload(value: unknown, knownIds: ReadonlySet<string>): ImportedDeck | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<DeckSharePayload>;
  if (p.v !== DECK_SHARE_VERSION || typeof p.cards !== "string") return null;
  const counts = new Map<string, number>();
  const unreadable: string[] = [];
  for (const part of p.cards.split(",")) {
    if (!part) continue;
    const m = ENTRY.exec(part);
    const cardId = m?.[1]!.toUpperCase();
    if (!m || !cardId || !knownIds.has(cardId)) {
      unreadable.push(part.slice(0, 20));
      continue;
    }
    addEntry(counts, cardId, Math.max(1, Number(m[2] ?? 1)));
  }
  if (counts.size === 0) return null;
  return { name: cleanName(typeof p.name === "string" ? p.name : ""), entries: toEntries(counts), unreadable };
}

/** The text list: "# デッキ名", one "枚数 カードID カード名" line per card, "# 計N枚". */
export function formatDeckText(name: string, entries: readonly DeckEntry[], cardName: (cardId: string) => string | undefined): string {
  const lines = entries.filter((e) => e.count > 0).map((e) => `${e.count} ${e.cardId} ${cardName(e.cardId) ?? ""}`.trimEnd());
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.count), 0);
  return [`# ${cleanName(name) || "デッキ"}`, ...lines, `# 計${total}枚`].join("\n");
}

/**
 * Reads a pasted card list. A line is a card when it has a card id; its count
 * is a number before the id ("3 RS-057"), or after it with ×, x, * or 枚
 * ("RS-057 ×3", "RS-057 3枚"), else 1. The first "#" line before any card is
 * the deck name; other "#" lines are notes.
 */
export function parseDeckText(text: string, knownIds: ReadonlySet<string>): ImportedDeck {
  const counts = new Map<string, number>();
  const unreadable: string[] = [];
  let name = "";
  for (const raw of text.split(/\r?\n/)) {
    // Full-width ids and digits read as half-width ones; the deck name keeps its own characters.
    const line = raw.normalize("NFKC").trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const note = raw.trim().replace(/^[#＃]+/, "").trim();
      if (!name && counts.size === 0 && unreadable.length === 0 && note && !/^計\s*\d+\s*枚/.test(note)) name = cleanName(note);
      continue;
    }
    const id = CARD_ID.exec(line);
    const cardId = id?.[1]!.toUpperCase();
    if (!id || !cardId || !knownIds.has(cardId)) {
      unreadable.push(line.slice(0, 40));
      continue;
    }
    const before = line.slice(0, id.index).trim();
    const after = line.slice(id.index + id[0].length);
    const lead = /^(\d{1,2})\s*(?:枚|[x×*])?$/i.exec(before);
    const tail = /(?:[x×*]\s*(\d{1,2})|(\d{1,2})\s*枚)/i.exec(after);
    const count = Number(lead?.[1] ?? tail?.[1] ?? tail?.[2] ?? 1);
    if (count < 1) {
      unreadable.push(line.slice(0, 40));
      continue;
    }
    addEntry(counts, cardId, count);
  }
  return { name, entries: toEntries(counts), unreadable };
}

/** Same cards in the same numbers (order does not matter). */
export function sameDeckEntries(a: readonly DeckEntry[], b: readonly DeckEntry[]): boolean {
  const key = (entries: readonly DeckEntry[]) =>
    entries
      .filter((e) => e.count > 0)
      .map((e) => `${e.cardId}*${e.count}`)
      .sort()
      .join(",");
  return key(a) === key(b);
}
