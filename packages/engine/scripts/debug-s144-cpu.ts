import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction } from "../src/ai/index";

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

let state = createHybridPromotedGame({ rng: mulberry32(144), firstPlayer: "player1", swapCount: 35 });

for (let step = 0; step < 15_000; step++) {
  if (state.winner) { console.log("winner:", state.winner); break; }
  const actions = getLegalActions(state);
  if (actions.length === 0) { console.log("no legal actions at step", step); break; }
  const actor = actions[0]!.playerId;
  const picked = pickCpuAction(state, actor, 1);
  const action = picked && isLegalAction(state, picked) ? picked : actions[0]!;
  const result = applyAction(state, action);
  if (!result.ok) {
    console.log(`FAILED at step ${step}:`);
    console.log("  action:", JSON.stringify(action));
    console.log("  error:", result.error);
    console.log("  phase:", state.phase);
    console.log("  pendingLeave:", JSON.stringify(state.pendingLeave));
    console.log("  pendingCommandPayment:", JSON.stringify(state.pendingCommandPayment));
    console.log("  pendingDamagePayment:", JSON.stringify(state.pendingDamagePayment));
    console.log("  pendingEffectChoice:", JSON.stringify(state.pendingEffectChoice));
    console.log("  all legal actions:", JSON.stringify(actions));
    console.log("  last 3 logs:", state.log.slice(-3));
    break;
  }
  state = result.state;
}
