import { createStarterGame, LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
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

const seed = 15;
let state = createStarterGame({ rng: mulberry32(seed), firstPlayer: seed % 2 === 0 ? "player1" : "player2" });

for (let step = 0; step < 20_000; step++) {
  if (state.winner) { console.log("winner:", state.winner, "at step", step); break; }
  const actions = getLegalActions(state);
  if (actions.length === 0) { console.log("no legal actions at step", step); break; }
  const actor = actions[0]!.playerId;
  const picked = pickCpuAction(state, actor, 1 as CpuLevel);
  const action = (picked && isLegalAction(state, picked)) ? picked : actions[0]!;
  
  const result = applyAction(state, action);
  if (!result.ok) {
    console.log(`FAILED at step ${step}:`);
    console.log("  action:", JSON.stringify(action));
    console.log("  error:", result.error);
    console.log("  phase:", state.phase);
    console.log("  pendingLeave:", JSON.stringify(state.pendingLeave));
    console.log("  pendingStrike:", !!state.pendingStrike);
    console.log("  pendingBattle:", !!state.pendingBattle);
    console.log("  pendingRush:", !!state.pendingRush);
    console.log("  pendingCommandPayment:", JSON.stringify(state.pendingCommandPayment));
    console.log("  pendingDamagePayment:", JSON.stringify(state.pendingDamagePayment));
    console.log("  pendingEffectChoice:", JSON.stringify(state.pendingEffectChoice));
    console.log("  reactionResolutionOrder:", state.reactionResolutionOrder);
    console.log("  activeSimultaneousGroupId:", state.activeSimultaneousGroupId);
    console.log("  all legal actions:", JSON.stringify(actions));
    console.log("  last 5 logs:", state.log.slice(-5));
    break;
  }
  state = result.state;
}
