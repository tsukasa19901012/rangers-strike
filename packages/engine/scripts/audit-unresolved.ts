import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { collectEffectResolutionMetrics, mergeEffectResolutionTraces } from "../src/verticalSlice/effectResolutionMetrics";

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

const traces = [];
for (let seed = 1; seed <= 500; seed++) {
  const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
  const p2 = LEGEND1_STARTER_IDS[(seed + 3) % LEGEND1_STARTER_IDS.length]!;
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Starter: p1,
    player2Starter: p2,
    swapCount: 35,
  });
  const result = playStarterMatchUntilEnd(initial, { maxSteps: 20_000 });
  traces.push(collectEffectResolutionMetrics(result.state.log));
}

const merged = mergeEffectResolutionTraces(traces);
console.log(`Games: ${merged.games}`);
console.log(`Total effect resolutions: ${merged.effectLogCount}`);
console.log(`Unresolved: ${merged.unresolvedCount} (${(merged.unresolvedRate * 100).toFixed(1)}%)`);
console.log();
console.log("Top unresolved by effectId:");
for (const { effectId, count } of merged.topUnresolvedByEffectId.slice(0, 30)) {
  console.log(`  ${effectId}: ${count}`);
}
console.log();
console.log("Top unresolved by cardId:");
for (const { cardId, count } of merged.topUnresolvedByCardId.slice(0, 30)) {
  console.log(`  ${cardId}: ${count}`);
}
