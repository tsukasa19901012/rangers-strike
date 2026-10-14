#!/usr/bin/env node
// Plays the same seeded CPU-vs-CPU matches on the pruned and the full engine
// bundle and requires identical logs and results. Run build-engine.mjs (both
// variants) first, or pass --build.
//
//   node scripts/verify-engine-prune.mjs [--build] [--matches=56] [--level=2]
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./toolchain.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
if (args.includes("--build")) {
  execFileSync(process.execPath, [join(APP_ROOT, "scripts/build-engine.mjs")], { stdio: "inherit" });
  execFileSync(process.execPath, [join(APP_ROOT, "scripts/build-engine.mjs"), "--full"], { stdio: "inherit" });
}
const matches = Number(opt("matches", "56"));
const level = Number(opt("level", "2"));
const maxSteps = 4000;

const pruned = await import(pathToFileURL(join(APP_ROOT, "src/generated/engine.js")).href);
const full = await import(pathToFileURL(join(APP_ROOT, ".cache/engine-full.js")).href);

function play(E, p1, p2, seed) {
  let state = E.createStarterGame({ player1Starter: p1, player2Starter: p2, seed });
  let steps = 0;
  for (; steps < maxSteps && !state.winner; steps++) {
    const actor = E.getActionPlayerId(state);
    const legal = E.getLegalActions(state);
    if (legal.length === 0) break;
    let action = E.pickCpuAction(state, actor, level) ?? E.pickCpuFallbackAction(state, actor) ?? legal[0];
    let r = E.applyAction(state, action);
    if (!r.ok) {
      const alt = E.pickCpuFallbackAction(state, actor);
      r = alt ? E.applyAction(state, alt) : r;
      if (!r.ok) {
        const any = legal.map((a) => E.applyAction(state, a)).find((x) => x.ok);
        if (!any) break;
        r = any;
      }
    }
    state = r.state;
  }
  return { winner: state.winner, steps, turn: state.turn, log: state.log.join("\n") };
}

const ids = full.ALL_STARTER_DECK_IDS;
let diffs = 0;
let finished = 0;
const started = Date.now();
for (let i = 0; i < matches; i++) {
  const p1 = ids[i % ids.length];
  const p2 = ids[(i * 7 + 3) % ids.length];
  const seed = 1000 + i;
  const a = play(pruned, p1, p2, seed);
  const b = play(full, p1, p2, seed);
  if (a.winner) finished++;
  if (a.log !== b.log || a.winner !== b.winner || a.steps !== b.steps) {
    diffs++;
    console.log(`DIFF ${p1} vs ${p2} seed ${seed}: pruned=${a.winner}/${a.steps} full=${b.winner}/${b.steps}`);
  }
}
console.log(
  `verify-engine-prune: ${matches} matches (CPU Lv${level}), ${finished} reached a winner, ` +
    `${diffs} differ between pruned and full bundles (${Date.now() - started} ms)`,
);
process.exit(diffs === 0 ? 0 : 1);
