// Vercel Function: stores shared boards (the 共有 button) under short ids.
//   POST /api/share  {"code": "RS1...."}  -> {"id": "k3F9xQ2a"}
//   GET  /api/share?id=k3F9xQ2a           -> {"code": "RS1...."}
// The store is Upstash Redis (Vercel Marketplace): the connection sets
// KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN).
// Without them the POST answers 503 and the app copies the long URL instead.

/** Boards are deleted after this many seconds. */
export const TTL_SECONDS = 30 * 24 * 60 * 60;
/** A late-game board with its whole log is about 4 KB; anything far larger is not a board. */
export const MAX_CODE_LENGTH = 64 * 1024;
const PREFIX = "RS1.";
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ID_LENGTH = 8;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
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
    /** Stores the value unless the key exists; true when stored. */
    put: async (key, value, ttl) => (await command(["SET", key, value, "EX", String(ttl), "NX"])) === "OK",
    get: async (key) => (await command(["GET", key])) ?? null,
  };
}

/** The GET / POST handlers over a store (the dev server passes an in-memory one). */
export function createShareHandlers(getStore) {
  return {
    async POST(request) {
      const store = getStore();
      if (!store) return json(503, { error: "no_store" });
      let code;
      try {
        code = (await request.json())?.code;
      } catch {
        return json(400, { error: "bad_json" });
      }
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
      const id = new URL(request.url).searchParams.get("id") ?? "";
      if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return json(400, { error: "bad_id" });
      const code = await store.get(`share:${id}`);
      return code ? json(200, { code }) : json(404, { error: "not_found" });
    },
  };
}

const handlers = createShareHandlers(() => upstashStore());
export const POST = (request) => handlers.POST(request);
export const GET = (request) => handlers.GET(request);
