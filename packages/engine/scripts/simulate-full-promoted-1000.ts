import { createFullPromotedGame } from "../src/verticalSlice/createPromotedGame";
import {
  mergeEffectResolutionTraces,
  type EffectResolutionTrace,
} from "../src/verticalSlice/effectResolutionMetrics";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";

const GAME_COUNT = 1000;
const MAX_STEPS = 15_000;
const UNRESOLVED_RATE_WARN_THRESHOLD = 0.25;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SeedRow = {
  seed: number;
  unresolved: number;
  effectLogCount: number;
  reason: string;
  topCard?: string;
};

const effectTraces: EffectResolutionTrace[] = [];
const perSeed: SeedRow[] = [];
let applyFailed = 0;
let simFailures = 0;

for (let seed = 1; seed <= GAME_COUNT; seed += 1) {
  const result = playStarterMatchUntilEnd(
    createFullPromotedGame({
      rng: mulberry32(seed),
      firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    }),
    { maxSteps: MAX_STEPS },
  );

  const trace = result.trace.effectResolution;
  effectTraces.push(trace);

  if (result.reason === "apply_failed") applyFailed += 1;
  if (result.reason !== "winner") simFailures += 1;

  const topCardEntry = Object.entries(trace.byCardId).sort((a, b) => b[1] - a[1])[0];
  perSeed.push({
    seed,
    unresolved: trace.unresolvedCount,
    effectLogCount: trace.effectLogCount,
    reason: result.reason,
    topCard: topCardEntry?.[0],
  });

  const seedRate =
    trace.effectLogCount > 0 ? trace.unresolvedCount / trace.effectLogCount : 0;
  if (seedRate >= UNRESOLVED_RATE_WARN_THRESHOLD) {
    console.warn(
      `[seed ${seed}] unresolved_rate ${(seedRate * 100).toFixed(2)}% >= ${(UNRESOLVED_RATE_WARN_THRESHOLD * 100).toFixed(0)}%`,
    );
  }
}

const effectMetrics = mergeEffectResolutionTraces(effectTraces);

const passSeeds = perSeed.filter((r) => r.unresolved === 0 && r.reason === "winner").length;
const failSeeds = perSeed.filter((r) => r.unresolved > 0 || r.reason !== "winner").length;

const topByUnresolved = [...perSeed]
  .filter((r) => r.unresolved > 0)
  .sort((a, b) => b.unresolved - a.unresolved)
  .slice(0, 10);

console.log("\n=== Full Promoted Deck Simulation (1000 games) ===");
console.log(`games:              ${GAME_COUNT}`);
console.log(`apply_failed:       ${applyFailed}`);
console.log(`sim_non_winner:     ${simFailures}`);
console.log(`unresolvedCount:    ${effectMetrics.unresolvedCount}`);
console.log(`effectLogCount:     ${effectMetrics.effectLogCount}`);
console.log(
  `unresolvedRate:     ${(effectMetrics.unresolvedRate * 100).toFixed(4)}%`,
);
console.log(`seeds_pass (u=0):   ${passSeeds}`);
console.log(`seeds_fail:         ${failSeeds}`);

console.log("\ntopUnresolvedByCardId (top 15):");
for (const row of effectMetrics.topUnresolvedByCardId.slice(0, 15)) {
  console.log(`  ${row.cardId}: ${row.count}`);
}

console.log("\nfirst 10 seeds with highest unresolved counts:");
for (const row of topByUnresolved) {
  console.log(
    `  seed=${row.seed} unresolved=${row.unresolved} topCard=${row.topCard ?? "—"} reason=${row.reason}`,
  );
}

if (effectMetrics.unresolvedRate >= UNRESOLVED_RATE_WARN_THRESHOLD) {
  console.warn(
    `[aggregate] unresolved_rate ${(effectMetrics.unresolvedRate * 100).toFixed(2)}% >= warn threshold`,
  );
}
