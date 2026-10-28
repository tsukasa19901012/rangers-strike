// 終わった対戦の記録（Upstash の game:<時刻>-<id>、api/share.js が保存）を全部読み出す。読むだけで、何も書き換えない。
//   node scripts/list-game-records.mjs --env <KV_REST_API_URL と KV_REST_API_READ_ONLY_TOKEN を書いたファイル> [--out game-records.json] [--since 2026-10-28]
// --out: 記録（client-core app/gameRecord.ts の GameRecord に key を足したもの）を JSON の配列で書く。
//   packages/engine/scripts/replay-game-records.ts に渡すと、エンジンで再生して CPU の負けた対戦を並べる。
// --since: その日時より後に終わった対戦だけ。
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isGameCode } from "../api/share.js";

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

const since = arg("since", "") ? Date.parse(arg("since", "")) : 0;
const keys = [];
let cursor = "0";
do {
  const [next, batch] = await command(["SCAN", cursor, "MATCH", "game:*", "COUNT", "1000"]);
  keys.push(...batch);
  cursor = next;
} while (cursor !== "0");

const records = [];
for (let i = 0; i < keys.length; i += 50) {
  const chunk = keys.slice(i, i + 50);
  const values = await command(["MGET", ...chunk]);
  chunk.forEach((key, k) => {
    const code = values[k];
    if (!isGameCode(code)) return;
    const record = JSON.parse(gunzipSync(Buffer.from(code.slice(4), "base64url")).toString("utf8"));
    if (record.at > since) records.push({ key, ...record });
  });
}
records.sort((a, b) => a.at - b.at);

const cpuWins = records.filter((r) => r.winner === "player2").length;
console.log(`対戦の記録: ${records.length} 件（CPU の勝ち ${cpuWins}、負け ${records.length - cpuWins}）`);
const byLevel = new Map();
for (const r of records) {
  const s = byLevel.get(r.cpuLevel) ?? { games: 0, cpuWins: 0 };
  s.games++;
  if (r.winner === "player2") s.cpuWins++;
  byLevel.set(r.cpuLevel, s);
}
for (const [level, s] of [...byLevel].sort((a, b) => a[0] - b[0])) console.log(`Lv${level}\t${s.games} 戦\tCPU 勝率 ${((100 * s.cpuWins) / s.games).toFixed(1)}%`);

const out = arg("out", "");
if (out) writeFileSync(out, JSON.stringify(records) + "\n");
