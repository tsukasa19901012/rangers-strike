import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { getReactionChooserPlayerId } from "../src/core/legalActions";
import { hasOpenReactionWindow, getStackActorPlayerId, peekEffectStackTop } from "../src/rules/effectStack";

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

console.log("hasOpenReactionWindow:", hasOpenReactionWindow(s));
console.log("effectStack top:", JSON.stringify(peekEffectStackTop(s), null, 2));
console.log("getStackActorPlayerId:", getStackActorPlayerId(s));
console.log("getReactionChooserPlayerId:", getReactionChooserPlayerId(s));
console.log("playerId resolved:", getReactionChooserPlayerId(s) ?? s.activePlayer);
console.log("pendingCommandPayment.playerId:", s.pendingCommandPayment?.playerId);
