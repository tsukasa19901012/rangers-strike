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

let failures = 0;
for (let seed = 1; seed <= 200; seed += 1) {
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    swapCount: 35,
  });
  const result = playStarterMatchUntilEnd(initial, { maxSteps: 15_000 });
  if (result.reason === "winner") continue;
  failures++;
  const s = result.state;
  console.log("seed", seed, result.reason, {
    phase: s.phase,
    pending: s.pendingEffectChoice?.effectId ?? s.pendingEffectChoice?.kind,
    lastLog: s.log.at(-1),
  });
}
console.log("failures:", failures, "/ 200");
