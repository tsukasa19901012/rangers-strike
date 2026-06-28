import { createFullPromotedGame } from "../src/verticalSlice/createPromotedGame";
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

for (let seed = 1; seed <= 50; seed += 1) {
  const result = playStarterMatchUntilEnd(
    createFullPromotedGame({
      rng: mulberry32(seed),
      firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    }),
    { maxSteps: 20_000 },
  );
  if (result.reason === "winner") continue;
  const top = Object.entries(result.trace.actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log(
    "seed",
    seed,
    result.reason,
    "steps",
    result.steps,
    "phase",
    result.state.phase,
    top,
  );
}
