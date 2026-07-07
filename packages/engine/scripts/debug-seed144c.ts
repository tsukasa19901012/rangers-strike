import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { getLegalActions } from "../src/core/legalActions";
import { validatePaymentSelection, isResolveCommandPaymentLegal } from "../src/rules/commandPayment";

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
const pending = s.pendingCommandPayment!;
const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);

console.log("pending:", {
  kind: pending.kind,
  categories: pending.categories,
  totalNeeded: pending.totalNeeded,
  eligibleNeeded: pending.eligibleNeeded,
  validInstanceIds: pending.validInstanceIds,
  continuation: pending.continuation,
  sourceCardId: pending.sourceCardId,
});
console.log("ids to try:", ids);
console.log("validatePaymentSelection:", validatePaymentSelection(s, pending, ids));
console.log("isResolveCommandPaymentLegal:", isResolveCommandPaymentLegal(s, { playerId: 'player1', commandInstanceIds: ids }));
console.log("pendingLeave:", JSON.stringify(s.pendingLeave, null, 2));
console.log("getLegalActions for player1:", getLegalActions(s, 'player1').map(a => a.type));
