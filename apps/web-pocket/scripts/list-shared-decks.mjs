// 「共有する」で短い URL にしたデッキ（Upstash の deck:<id>）を全部読み出して一覧にする。読むだけで、何も書き換えない。
//   cd apps/web-pocket && vercel env pull .env.local   # KV_REST_API_URL / KV_REST_API_TOKEN を手元に出す
//   （Sensitive の変数は [SENSITIVE] になるので、そのときは Upstash の URL と Read-Only Token を .env 形式のファイルに書いて --env で渡す）
//   node scripts/list-shared-decks.mjs [--env .env.local] [--out shared-decks.json] [--arena ../../packages/engine/arena-decks]
// --out: 一覧（id・名前・枚数・カード）を JSON で書く。--arena: 対戦台のデッキ（shared-<id>.json）としても書く。
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isDeckCode } from "../api/share.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** .env 形式のファイル（KEY="value"）を読む。 */
function readEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = { ...process.env, ...readEnvFile(arg("env", ".env.local")) };
// 読むだけなので、読み取り専用の鍵（KV_REST_API_READ_ONLY_TOKEN）があればそちらを使う。
const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const token = env.KV_REST_API_READ_ONLY_TOKEN ?? env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token || token === "[SENSITIVE]") {
  console.error("KV_REST_API_URL と KV_REST_API_READ_ONLY_TOKEN（または KV_REST_API_TOKEN）がありません");
  process.exit(1);
}
async function command(args) {
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json()).result;
}

const keys = [];
let cursor = "0";
do {
  const [next, batch] = await command(["SCAN", cursor, "MATCH", "deck:*", "COUNT", "1000"]);
  keys.push(...batch);
  cursor = next;
} while (cursor !== "0");

const decks = [];
for (let i = 0; i < keys.length; i += 100) {
  const chunk = keys.slice(i, i + 100);
  const values = await command(["MGET", ...chunk]);
  chunk.forEach((key, k) => {
    const code = values[k];
    if (!isDeckCode(code)) return;
    const deck = JSON.parse(gunzipSync(Buffer.from(code.slice(4), "base64url")).toString("utf8"));
    const entries = deck.cards.split(",").map((s) => {
      const [cardId, n] = s.split("*");
      return { cardId, count: Number(n ?? 1) };
    });
    decks.push({ id: key.slice(5), name: deck.name, total: entries.reduce((t, e) => t + e.count, 0), entries });
  });
}
decks.sort((a, b) => a.name.localeCompare(b.name, "ja"));

console.log(`共有されたデッキ: ${decks.length} 個`);
for (const d of decks) console.log(`${d.id}\t${d.total} 枚\t${d.name}\t/?d=${d.id}`);

const out = arg("out", "");
if (out) writeFileSync(out, JSON.stringify(decks, null, 2) + "\n");
const arena = arg("arena", "");
if (arena) {
  for (const d of decks) {
    writeFileSync(`${arena}/shared-${d.id}.json`, JSON.stringify({ id: `shared-${d.id}`, name: d.name, source: `共有デッキ /?d=${d.id}`, entries: d.entries }, null, 2) + "\n");
  }
}
