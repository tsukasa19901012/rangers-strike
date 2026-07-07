import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { getLegalActions } from "../src/core/legalActions";
import { applyAction } from "../src/core/applyAction";

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

const initial = createHybridPromotedGame({
  rng: mulberry32(144),
  firstPlayer: "player1",
  swapCount: 35,
});

const result = playStarterMatchUntilEnd(initial, { maxSteps: 15_000 });
const s = result.state;

console.log("reason:", result.reason);
console.log("last 5 logs:", s.log.slice(-5).join('\n'));

// Get legal actions and try applying each to find the failing one
const legal = getLegalActions(s);
console.log("legal actions:", legal.map(a => a.type));

// simulate what playStarterMatch does - try applying random actions
// Let's try each legal action and see which fails
for (const action of legal) {
  const res = applyAction(s, action);
  if ("error" in res) {
    console.log("FAILING action:", JSON.stringify(action), "error:", res.error);
  } else {
    console.log("OK action:", action.type);
  }
}
