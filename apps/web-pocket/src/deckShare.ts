// Deck sharing in the browser: the deck as a URL (short /?d=<id> stored by
// api/share.js, or the long /#d=<code> that needs no server) and the URL the
// page was opened with. The code is the payload as gzip + base64url behind
// "RD1." (client-core deckShare.ts reads and checks what is inside).
import { buildDeckSharePayload, parseDeckSharePayload, type DeckEntry, type ImportedDeck } from "@rangers-strike/client-core";
import { fromBase64Url, pipe, toBase64Url } from "./share";

const PREFIX = "RD1.";

type BrowserGlobals = {
  location?: { origin: string; pathname: string; search: string; hash: string };
  history?: { replaceState(data: unknown, unused: string, url: string): void };
  fetch?: typeof fetch;
  CompressionStream?: new (format: "gzip") => GenericTransformStream;
  DecompressionStream?: new (format: "gzip") => GenericTransformStream;
  TextEncoder?: typeof TextEncoder;
};
const g = globalThis as unknown as BrowserGlobals;

export async function encodeDeck(name: string, entries: readonly DeckEntry[]): Promise<string> {
  const json = new g.TextEncoder!().encode(JSON.stringify(buildDeckSharePayload(name, entries)));
  return PREFIX + toBase64Url(await pipe(json, new g.CompressionStream!("gzip")));
}

export async function decodeDeck(code: string, knownIds: ReadonlySet<string>): Promise<ImportedDeck | null> {
  const body = code.trim();
  if (!body.startsWith(PREFIX)) return null;
  try {
    const bytes = await pipe(fromBase64Url(body.slice(PREFIX.length)), new g.DecompressionStream!("gzip"));
    return parseDeckSharePayload(JSON.parse(new TextDecoder().decode(bytes)), knownIds);
  } catch {
    return null;
  }
}

/** The deck's URL: short when the server stores it, else the long one (it works on its own). */
export async function deckUrl(name: string, entries: readonly DeckEntry[]): Promise<{ url: string; short: boolean }> {
  const code = await encodeDeck(name, entries);
  const origin = g.location?.origin ?? "";
  try {
    const res = await g.fetch!("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deck: code }) });
    const body = res.ok ? ((await res.json()) as { id?: string }) : null;
    if (body?.id && /^[A-Za-z0-9]{6,16}$/.test(body.id)) return { url: `${origin}/?d=${body.id}`, short: true };
  } catch {
    // no server (static hosting without the function, offline)
  }
  return { url: `${origin}/#d=${code}`, short: false };
}

/** The deck the page was opened with (?d=<id> or #d=<code>), if any. The address is cleaned so a reload starts normally. */
export async function sharedDeckFromLocation(knownIds: ReadonlySet<string>): Promise<ImportedDeck | null | "error"> {
  const loc = g.location;
  if (!loc) return null;
  const id = new URLSearchParams(loc.search).get("d");
  const hash = loc.hash.startsWith("#d=") ? loc.hash.slice(3) : null;
  if (!id && !hash) return null;
  g.history?.replaceState(null, "", loc.pathname);
  let code = hash;
  if (id) {
    try {
      const res = await g.fetch!(`/api/share?d=${encodeURIComponent(id)}`);
      code = res.ok ? (((await res.json()) as { deck?: string }).deck ?? null) : null;
    } catch {
      code = null;
    }
  }
  const deck = code ? await decodeDeck(code, knownIds) : null;
  return deck ?? "error";
}
