// Vercel Function: stores shared boards (the 共有 button) and shared decks
// (the deck builder's 共有する) under short ids.
//   POST /api/share  {"code": "RS1...."}  -> {"id": "k3F9xQ2a"}   board, kept 30 days
//   GET  /api/share?id=k3F9xQ2a           -> {"code": "RS1...."}
//   POST /api/share  {"deck": "RD1...."}  -> {"id": "Hq7mT2xa"}   deck, kept for good
//   GET  /api/share?d=Hq7mT2xa            -> {"deck": "RD1...."}
//   POST /api/share  {"game": "RG1...."}  -> {"ok": true}         finished match, kept a year
// A game record (client-core app/gameRecord.ts) is only written, never served: the developers read
// them with scripts/list-game-records.mjs to see how the CPU lost.
// A deck's id comes from its content, so sharing the same deck again gives the
// same URL and stores nothing new. Only a real deck is kept: the server
// decompresses it and checks it is a small {name, cards} list.
import { gunzipSync } from "node:zlib";
// The store is Upstash Redis (Vercel Marketplace): the connection sets
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// Without them the POST answers 503 and the app copies the long URL instead.

/** Boards are deleted after this many seconds. */
export const TTL_SECONDS = 30 * 24 * 60 * 60;
/** A late-game board with its whole log is about 4 KB; anything far larger is not a board. */
export const MAX_CODE_LENGTH = 64 * 1024;
const PREFIX = "RS1.";
const DECK_PREFIX = "RD1.";
const GAME_PREFIX = "RG1.";
/** Game records are deleted after this many seconds. */
export const GAME_TTL_SECONDS = 365 * 24 * 60 * 60;
/** A long match is a few thousand actions, about 20 KB gzipped. */
export const MAX_GAME_LENGTH = 256 * 1024;
/** A 40-card deck is about 300 characters; even 60 different cards stay far below this. */
export const MAX_DECK_LENGTH = 2048;
const DECK_CARDS = /^[A-Za-z]{2}\d?-\d{3}(\*\d{1,2})?(,[A-Za-z]{2}\d?-\d{3}(\*\d{1,2})?){0,199}$/;
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ID_LENGTH = 8;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

/** The deck's id: 8 characters of its SHA-256, so the same deck always gets the same URL. */
async function deckId(code) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)));
  return Array.from(digest.subarray(0, ID_LENGTH), (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

/** True when the code really is a shared deck (RD1. + gzip of {v:1, name, cards}). */
export function isDeckCode(code) {
  if (typeof code !== "string" || !code.startsWith(DECK_PREFIX) || code.length > MAX_DECK_LENGTH || !/^[A-Za-z0-9._-]+$/.test(code)) return false;
  try {
    const json = gunzipSync(Buffer.from(code.slice(DECK_PREFIX.length), "base64url"), { maxOutputLength: 8 * 1024 }).toString("utf8");
    const deck = JSON.parse(json);
    return deck?.v === 1 && typeof deck.name === "string" && deck.name.length <= 40 && typeof deck.cards === "string" && DECK_CARDS.test(deck.cards);
  } catch {
    return false;
  }
}

/** True when the code really is a game record (RG1. + gzip of {v:1, seed, decks, actions}). */
export function isGameCode(code) {
  if (typeof code !== "string" || !code.startsWith(GAME_PREFIX) || code.length > MAX_GAME_LENGTH || !/^[A-Za-z0-9._-]+$/.test(code)) return false;
  try {
    const json = gunzipSync(Buffer.from(code.slice(GAME_PREFIX.length), "base64url"), { maxOutputLength: 8 * 1024 * 1024 }).toString("utf8");
    const r = JSON.parse(json);
    return r?.v === 1 && Number.isInteger(r.seed) && typeof r.humanDeck === "string" && typeof r.cpuDeck === "string" && Array.isArray(r.actions);
  } catch {
    return false;
  }
}

/** Redis over Upstash's REST API (no client library). Null when the project has no store connected. */
export function upstashStore(env = process.env) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const command = async (args) => {
    const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    return (await res.json()).result;
  };
  return {
    /** Stores the value unless the key exists (for `ttl` seconds, or for good without one); true when stored. */
    put: async (key, value, ttl) => (await command(ttl ? ["SET", key, value, "EX", String(ttl), "NX"] : ["SET", key, value, "NX"])) === "OK",
    get: async (key) => (await command(["GET", key])) ?? null,
  };
}

/** The GET / POST handlers over a store (the dev server passes an in-memory one). */
export function createShareHandlers(getStore) {
  return {
    async POST(request) {
      const store = getStore();
      if (!store) return json(503, { error: "no_store" });
      let body;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "bad_json" });
      }
      if (body && "deck" in body) {
        const deck = body.deck;
        if (!isDeckCode(deck)) return json(400, { error: "bad_deck" });
        const id = await deckId(deck);
        const key = `deck:${id}`;
        // Already there: the same deck shared before (a different deck with the same id is next to impossible).
        if ((await store.put(key, deck)) || (await store.get(key)) === deck) return json(200, { id });
        return json(409, { error: "id_taken" });
      }
      if (body && "game" in body) {
        if (!isGameCode(body.game)) return json(400, { error: "bad_game" });
        for (let attempt = 0; attempt < 3; attempt++) {
          if (await store.put(`game:${Date.now().toString(36)}-${newId()}`, body.game, GAME_TTL_SECONDS)) return json(200, { ok: true });
        }
        return json(500, { error: "no_id" });
      }
      const code = body?.code;
      if (typeof code !== "string" || !code.startsWith(PREFIX) || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9._-]+$/.test(code)) {
        return json(400, { error: "bad_code" });
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const id = newId();
        if (await store.put(`share:${id}`, code, TTL_SECONDS)) return json(200, { id });
      }
      return json(500, { error: "no_id" });
    },
    async GET(request) {
      const store = getStore();
      if (!store) return json(503, { error: "no_store" });
      const params = new URL(request.url).searchParams;
      const deckKey = params.get("d");
      if (deckKey !== null) {
        if (!/^[A-Za-z0-9]{6,16}$/.test(deckKey)) return json(400, { error: "bad_id" });
        const deck = await store.get(`deck:${deckKey}`);
        return deck ? json(200, { deck }) : json(404, { error: "not_found" });
      }
      const id = params.get("id") ?? "";
      if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return json(400, { error: "bad_id" });
      const code = await store.get(`share:${id}`);
      return code ? json(200, { code }) : json(404, { error: "not_found" });
    },
  };
}

const handlers = createShareHandlers(() => upstashStore());
export const POST = (request) => handlers.POST(request);
export const GET = (request) => handlers.GET(request);
