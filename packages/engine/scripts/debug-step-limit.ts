import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";

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

for (let seed = 1; seed <= 20; seed += 1) {
  const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
  const p2 = LEGEND1_STARTER_IDS[(seed + 1) % LEGEND1_STARTER_IDS.length]!;
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Starter: p1,
    player2Starter: p2,
    swapCount: 25,
  });
  const result = playStarterMatchUntilEnd(initial, { maxSteps: 30_000 });
  if (result.reason !== "step_limit") continue;
  const counts = result.trace.actionCounts;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("seed", seed, "steps", result.steps, "phase", result.state.phase, top);
}
