import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions } from "../src/core/legalActions";
import { pickCpuAction, type CpuLevel } from "../src/ai/index";

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

const seed = 144;
const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
const p2 = LEGEND1_STARTER_IDS[(seed + 3) % LEGEND1_STARTER_IDS.length]!;
let state = createHybridPromotedGame({ rng: mulberry32(seed), firstPlayer: seed % 2 === 0 ? "player1" : "player2", player1Starter: p1, player2Starter: p2, swapCount: 35 });

let consecutiveSimultaneous = 0;
for (let step = 0; step < 20_000; step++) {
  if (state.winner) { console.log("winner:", state.winner); break; }
  const actions = getLegalActions(state);
  if (actions.length === 0) { console.log("no legal actions at step", step); break; }
  const actor = actions[0]!.playerId;
  const picked = pickCpuAction(state, actor, 1 as CpuLevel);
  const action = (picked && actions.some(a => JSON.stringify(a) === JSON.stringify(picked))) ? picked : actions[0]!;
  
  if (state.pendingEffectChoice?.kind === "simultaneous_order") {
    consecutiveSimultaneous++;
    if (consecutiveSimultaneous > 5) {
      console.log(`\nLOOP DETECTED at step ${step}:`);
      console.log("  simultaneous count:", consecutiveSimultaneous);
      console.log("  action:", JSON.stringify(action));
      console.log("  pendingLeave:", JSON.stringify(state.pendingLeave));
      console.log("  pendingEffectChoice:", JSON.stringify(state.pendingEffectChoice));
      console.log("  reactionResolutionOrder:", state.reactionResolutionOrder);
      console.log("  activeSimultaneousGroupId:", state.activeSimultaneousGroupId);
      console.log("  last 5 logs:", state.log.slice(-5));
      
      // Apply and show result
      const r = applyAction(state, action);
      if (r.ok) {
        console.log("  after action pendingEffectChoice:", r.state.pendingEffectChoice?.kind);
        console.log("  after action reactionResolutionOrder:", r.state.reactionResolutionOrder);
        console.log("  after action activeSimultaneousGroupId:", r.state.activeSimultaneousGroupId);
        console.log("  after action pendingLeave:", JSON.stringify(r.state.pendingLeave));
      }
      break;
    }
  } else {
    consecutiveSimultaneous = 0;
  }
  
  const result = applyAction(state, action);
  if (!result.ok) { console.log("error:", result.error, "action:", JSON.stringify(action)); break; }
  state = result.state;
}
