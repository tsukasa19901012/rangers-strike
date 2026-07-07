import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import { getLegalActions } from "../src/core/legalActions";

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
  firstPlayer: "player1",  // <-- stress test uses seed%2===0 for player1; 144%2=0 so firstPlayer=player1
  swapCount: 35,
});

const result = playStarterMatchUntilEnd(initial, { maxSteps: 15_000 });
const s = result.state;

console.log("reason:", result.reason);
console.log("phase:", s.phase);
console.log("activePlayer:", s.activePlayer);
console.log("pendingCommandPayment:", JSON.stringify(s.pendingCommandPayment, null, 2));
console.log("lastLogs:", s.log.slice(-10).join('\n'));

const legal = getLegalActions(s);
console.log("legal actions:", legal.length, legal.map(a => a.type));
if (legal.length === 0) {
  const p1 = s.players['player1'];
  const p2 = s.players['player2'];
  console.log("p1 battle:", p1.battle.map(c => c.cardId));
  console.log("p2 battle:", p2.battle.map(c => c.cardId));
  console.log("p1 rush:", p1.rush.map(c => c.cardId));
  console.log("p2 rush:", p2.rush.map(c => c.cardId));
  console.log("p1 command:", p1.command.map(c => `${c.cardId}(held=${c.commandHeld})`));
  console.log("p2 command:", p2.command.map(c => `${c.cardId}(held=${c.commandHeld})`));
  console.log("p1 hand:", p1.hand.map(c => c.cardId));
  console.log("p2 hand:", p2.hand.map(c => c.cardId));
  console.log("pendingLeave:", s.pendingLeave);
  console.log("pendingStrike:", s.pendingStrike);
  console.log("pendingBattle:", s.pendingBattle);
  console.log("pendingBattleEntry:", s.pendingBattleEntry);
}
