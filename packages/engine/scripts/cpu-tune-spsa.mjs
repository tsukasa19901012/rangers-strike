// 評価の重みを SPSA で調整する（各重みを対数で ±c ずらした 2 組を対戦させ、勝ち越した向きへ動かす）。
//   node scripts/cpu-tune-spsa.mjs [iterations] [games] [level]  -> .cache/spsa.log に途中経過
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const iterations = Number(process.argv[2] ?? 30);
const games = Number(process.argv[3] ?? 72);
const level = process.argv[4] ?? "2";
const decks = "abarenoh,dekaranger,magiking,five-dragons-a,seven-ninja-a,blue-nine-a";
const out = execFileSync("npx", ["tsx", "-e", 'import("./src/ai/scoring.ts").then(m=>console.log(JSON.stringify(m.DEFAULT_EVAL_WEIGHTS)))'], { encoding: "utf8" });
const base = JSON.parse(out.trim().split("\n").pop());
const names = Object.keys(base);
const theta = Object.fromEntries(names.map((n) => [n, 0]));
const c = 0.35, a0 = 0.8;
mkdirSync(".cache", { recursive: true });
const log = ".cache/spsa.log";
const weights = (shift) => Object.fromEntries(names.map((n) => [n, +(base[n] * Math.exp(theta[n] + (shift[n] ?? 0))).toPrecision(4)]));

for (let k = 0; k < iterations; k++) {
  const delta = Object.fromEntries(names.map((n) => [n, Math.random() < 0.5 ? -1 : 1]));
  const plus = weights(Object.fromEntries(names.map((n) => [n, c * delta[n]])));
  const minus = weights(Object.fromEntries(names.map((n) => [n, -c * delta[n]])));
  const res = execFileSync("scripts/cpu-arena-par.sh", ["--a", level, "--b", level, "--games", String(games), "--decks", decks, "--seed", String(1000 + k * 97), "--wa", JSON.stringify(plus), "--wb", JSON.stringify(minus)], { encoding: "utf8" });
  const m = res.match(/A (\d+) - (\d+) B/);
  const wa = Number(m[1]), wb = Number(m[2]);
  const diff = (wa - wb) / Math.max(1, wa + wb);
  const ak = a0 / Math.pow(k + 1, 0.3);
  for (const n of names) theta[n] = Math.max(-1.6, Math.min(1.6, theta[n] + ak * diff * delta[n] / 2));
  appendFileSync(log, `#${k} +${wa} -${wb} diff=${diff.toFixed(2)}\n`);
  writeFileSync(".cache/spsa-weights.json", JSON.stringify(weights({}), null, 1));
}
appendFileSync(log, "done\n");
