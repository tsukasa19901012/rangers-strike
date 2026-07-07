import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { getLegalActions, getReactionChooserPlayerId } from "../src/core/legalActions";
import { hasOpenReactionWindow, peekEffectStackTop } from "../src/rules/effectStack";
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

// simulate the legalActions logic
const playerId = getReactionChooserPlayerId(s) ?? s.activePlayer;
console.log("resolved playerId:", playerId);
console.log("pendingCommandPayment exists:", !!s.pendingCommandPayment);
console.log("pendingCommandPayment.playerId:", s.pendingCommandPayment?.playerId);
console.log("pendingLeave exists:", !!s.pendingLeave);
console.log("pendingLeave.ownerPlayerId:", s.pendingLeave?.ownerPlayerId);

// Check pendingRegister
console.log("pendingRegister:", !!s.pendingRegister);
console.log("pendingChase:", !!s.pendingChase);
console.log("effectStack top:", JSON.stringify(peekEffectStackTop(s)));

// manually check pendingCommandPayment block
const pending = s.pendingCommandPayment!;
const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
console.log("\n--- Manual pendingCommandPayment check ---");
console.log("ids:", ids);
console.log("ids.length >= totalNeeded:", ids.length >= pending.totalNeeded);
console.log("validatePayment:", validatePaymentSelection(s, pending, ids));
console.log("isLegal:", isResolveCommandPaymentLegal(s, { playerId: pending.playerId, commandInstanceIds: ids }));

// The real question: does getLegalActions enter the pendingCommandPayment block?
// Since pendingRegister and pendingChase are null, and simultaneousOrder is null...
// Let's check what ELSE might be blocking it
console.log("\n--- What blocks the flow before pendingCommandPayment ---");
console.log("pendingDamagePayment:", !!s.pendingDamagePayment);
