// Vercel Function: 対人戦（オンライン対戦）の部屋。盤面・シード・両者の手札はここ（Upstash）にだけあり、
// ブラウザには自分に見える表示（engine match.ts matchView）だけを返す。仕様: 対人戦（C案）仕様書。
//
//   POST /api/match {"op":"create","deck":{...},"first":"host|guest|random"} -> {"id","token","view"}  部屋を作る（ホスト = player1）
//   POST /api/match {"op":"join","id","deck":{...}}                           -> {"token","view"}       参加する（ゲスト = player2）
//   GET  /api/match?id=&t=<token>[&v=<version>]                               -> {"view"} | {"unchanged":true}
// 成功した答えには、サーバーの時刻 now（ミリ秒）も付ける（画面の残り時間はサーバーの時計で数える）。
//   POST /api/match {"op":"act","id","t","seq","version","action"}            -> {"result","view"}
//   POST /api/match {"op":"resign","id","t"}                                  -> {"view"}
//   POST /api/match {"op":"cancel","id","t"}                                  -> {"ok":true}   相手を待つのをやめる（ホストだけ、参加前だけ）
//
// deck は {"starter":"<スターターの id>"} か {"cards":["RS-001",...]}（同じ番号を枚数分）。
// 部屋の鍵は match:<id>、値は「改訂番号|JSON」。書き込みは改訂番号が読んだときのままなら（Lua で比べて）だけ通し、
// 同時に書かれたら読み直してやり直す（同じ操作は seq で一度しか適用されない）。トークンは SHA-256 だけを保存する。
// 期限（持ち時間）は誰かが読むか送るたびに matchTick で確かめ、過ぎていれば自動で進めて保存する。
import {
  ENGINE_VERSION,
  MatchError,
  createMatch,
  deserializeMatch,
  joinMatch,
  matchAct,
  matchResign,
  matchTick,
  matchView,
  serializeMatch,
} from "../server/match-engine.mjs";

/** Rooms are deleted this long after their last write (a finished match stays to show its result). */
export const MATCH_TTL_SECONDS = 6 * 60 * 60;
/** A request body larger than this is not a move or a deck. */
const MAX_BODY = 64 * 1024;
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const ID_LENGTH = 8;
const TOKEN_LENGTH = 24;
const ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9]{24}$/;

const CAS_SCRIPT = `
local cur = redis.call("GET", KEYS[1])
local rev = 0
if cur then rev = tonumber(string.match(cur, "^(%d+)|")) or -1 end
if rev ~= tonumber(ARGV[1]) then return 0 end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1`;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function randomText(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

async function sha256(text) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The match's randomness and clock: crypto for aliases and the seed, the server's clock for time limits. */
export function serverDeps(now = Date.now()) {
  return {
    now,
    newAliasBody: () => {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
    },
    randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
  };
}

/** Rooms over Upstash (REST, no client library): read, create if absent, write if unchanged since read. */
export function upstashMatchStore(env = process.env) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const command = async (args) => {
    const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    return (await res.json()).result;
  };
  return {
    get: async (key) => (await command(["GET", key])) ?? null,
    create: async (key, value, ttl) => (await command(["SET", key, value, "EX", String(ttl), "NX"])) === "OK",
    /** Writes `value` when the stored revision is still `rev` (0: absent). */
    swap: async (key, rev, value, ttl) => (await command(["EVAL", CAS_SCRIPT, "1", key, String(rev), value, String(ttl)])) === 1,
  };
}

/** The same store in memory (dev server and tests). */
export function memoryMatchStore() {
  const map = new Map();
  const revOf = (value) => (value ? Number(/^(\d+)\|/.exec(value)?.[1] ?? -1) : 0);
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    create: async (key, value) => (map.has(key) ? false : (map.set(key, value), true)),
    swap: async (key, rev, value) => (revOf(map.get(key)) === rev ? (map.set(key, value), true) : false),
  };
}

function encode(rev, room) {
  return `${rev}|${JSON.stringify(room)}`;
}

function decode(value) {
  const bar = value.indexOf("|");
  return { rev: Number(value.slice(0, bar)), room: JSON.parse(value.slice(bar + 1)) };
}

/** The player a token belongs to (null: not this room's). */
async function playerOf(room, token) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const hash = await sha256(token);
  if (room.tokens.player1 === hash) return "player1";
  if (room.tokens.player2 === hash) return "player2";
  return null;
}

function isDeckSpec(deck) {
  if (!deck || typeof deck !== "object") return false;
  if ("starter" in deck) return typeof deck.starter === "string" && deck.starter.length <= 64;
  return Array.isArray(deck.cards) && deck.cards.length <= 200 && deck.cards.every((c) => typeof c === "string" && c.length <= 16);
}

/** The GET / POST handlers over a store and a clock (the dev server and tests pass their own). */
export function createMatchHandlers(getStore, clock = () => Date.now()) {
  /** A successful answer, with the server's clock (the browser's countdown is set by it). */
  const ok = (data) => json(200, { ...data, now: clock() });

  /**
   * Reads the room, runs `change` on the match (it returns the answer, and whether the match changed), and
   * saves the match when it changed and nobody wrote in between. Retries from a fresh read when someone did.
   */
  async function update(store, id, change) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const value = await store.get(`match:${id}`);
      if (!value) return json(404, { error: "not_found" });
      const { rev, room } = decode(value);
      const deps = serverDeps(clock());
      let m;
      try {
        m = deserializeMatch(room.match, ENGINE_VERSION, deps);
      } catch {
        return json(500, { error: "broken_match" });
      }
      const before = m.version;
      const out = await change(room, m, deps);
      if (out instanceof Response) return out;
      const changed = out.changed || m.version !== before;
      if (!changed) return ok(out.body);
      room.match = serializeMatch(m);
      if (await store.swap(`match:${id}`, rev, encode(rev + 1, room), MATCH_TTL_SECONDS)) return ok(out.body);
    }
    return json(409, { error: "busy" });
  }

  return {
    async GET(request) {
      const store = getStore();
      if (!store) return json(503, { error: "no_store" });
      const params = new URL(request.url).searchParams;
      const id = params.get("id") ?? "";
      if (!ID_PATTERN.test(id)) return json(400, { error: "bad_id" });
      const since = params.get("v");
      return update(store, id, async (room, m, deps) => {
        const player = await playerOf(room, params.get("t"));
        if (!player) return json(403, { error: "bad_token" });
        matchTick(m, deps);
        if (since !== null && String(m.version) === since) return { body: { unchanged: true } };
        return { body: { view: matchView(m, player, deps) } };
      });
    },

    async POST(request) {
      const store = getStore();
      if (!store) return json(503, { error: "no_store" });
      let body;
      try {
        const text = await request.text();
        if (text.length > MAX_BODY) return json(413, { error: "too_large" });
        body = JSON.parse(text);
      } catch {
        return json(400, { error: "bad_json" });
      }
      if (!body || typeof body !== "object") return json(400, { error: "bad_json" });

      if (body.op === "create") {
        if (!isDeckSpec(body.deck)) return json(400, { error: "bad_deck" });
        const first = ["host", "guest", "random"].includes(body.first) ? body.first : "random";
        const deps = serverDeps(clock());
        for (let attempt = 0; attempt < 3; attempt++) {
          const id = randomText(ID_LENGTH);
          const token = randomText(TOKEN_LENGTH);
          let m;
          try {
            m = createMatch({ id, engineVersion: ENGINE_VERSION, hostDeck: body.deck, firstPlayer: first, now: deps.now });
          } catch (error) {
            if (error instanceof MatchError) return json(400, { error: "bad_deck", detail: error.message });
            throw error;
          }
          const room = { v: 1, tokens: { player1: await sha256(token) }, match: serializeMatch(m) };
          if (await store.create(`match:${id}`, encode(1, room), MATCH_TTL_SECONDS)) {
            return ok({ id, token, view: matchView(m, "player1", deps) });
          }
        }
        return json(500, { error: "no_id" });
      }

      const id = typeof body.id === "string" ? body.id : "";
      if (!ID_PATTERN.test(id)) return json(400, { error: "bad_id" });

      if (body.op === "join") {
        if (!isDeckSpec(body.deck)) return json(400, { error: "bad_deck" });
        const token = randomText(TOKEN_LENGTH);
        return update(store, id, async (room, m, deps) => {
          if (room.cancelled) return json(404, { error: "not_found" });
          if (room.tokens.player2 || m.status !== "waiting") return json(409, { error: "taken" });
          try {
            joinMatch(m, body.deck, deps);
          } catch (error) {
            if (error instanceof MatchError) return json(400, { error: "bad_deck", detail: error.message });
            throw error;
          }
          room.tokens.player2 = await sha256(token);
          return { changed: true, body: { token, view: matchView(m, "player2", deps) } };
        });
      }

      if (body.op === "cancel") {
        // The host gives up waiting: nobody can join any more.
        return update(store, id, async (room, m) => {
          if ((await playerOf(room, body.t)) !== "player1") return json(403, { error: "bad_token" });
          if (m.status !== "waiting") return json(409, { error: "started" });
          if (room.cancelled) return { body: { ok: true } };
          room.cancelled = true;
          return { changed: true, body: { ok: true } };
        });
      }

      if (body.op === "act") {
        return update(store, id, async (room, m, deps) => {
          const player = await playerOf(room, body.t);
          if (!player) return json(403, { error: "bad_token" });
          const result = matchAct(m, player, { seq: body.seq, version: body.version, action: body.action }, deps);
          return { body: { result, view: matchView(m, player, deps) } };
        });
      }

      if (body.op === "resign") {
        return update(store, id, async (room, m, deps) => {
          const player = await playerOf(room, body.t);
          if (!player) return json(403, { error: "bad_token" });
          matchResign(m, player, deps);
          return { body: { view: matchView(m, player, deps) } };
        });
      }

      return json(400, { error: "bad_op" });
    },
  };
}

const handlers = createMatchHandlers(() => upstashMatchStore());
export const POST = (request) => handlers.POST(request);
export const GET = (request) => handlers.GET(request);
