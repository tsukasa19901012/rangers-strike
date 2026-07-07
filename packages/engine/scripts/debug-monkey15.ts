import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";
import { applyAction, createGame, getLegalActions } from "../src/index";

const DECK_BUILDERS = [
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
  () => buildStarterDeck("roaring-wings"),
  () => buildStarterDeck("silver-adventurer"),
] as const;

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
const rng = mulberry32(seed);
const deckA = DECK_BUILDERS[seed % DECK_BUILDERS.length]!();
const deckB = DECK_BUILDERS[(seed + 1) % DECK_BUILDERS.length]!();

let state = createGame({
  player1Deck: deckA, player2Deck: deckB,
  firstPlayer: seed % 2 === 0 ? "player1" : "player2", rng,
});

for (let step = 0; step < 12_000; step++) {
  if (state.winner) { console.log("winner:", state.winner); break; }
  const actions = getLegalActions(state);
  if (actions.length === 0) { console.log("no legal at step", step); break; }
  const action = actions[Math.floor(rng() * actions.length)]!;
  const result = applyAction(state, action);
  if (!result.ok) {
    console.log(`FAILED step ${step}:`, result.error);
    console.log("action:", JSON.stringify(action));
    console.log("phase:", state.phase);
    console.log("pendingLeave:", JSON.stringify(state.pendingLeave));
    console.log("pendingStrike:", !!state.pendingStrike);
    console.log("pendingBattle:", !!state.pendingBattle);
    console.log("pendingCommandPayment:", JSON.stringify(state.pendingCommandPayment));
    console.log("pendingDamagePayment:", !!state.pendingDamagePayment);
    console.log("pendingEffectChoice:", JSON.stringify(state.pendingEffectChoice));
    console.log("reactionResolutionOrder:", state.reactionResolutionOrder);
    console.log("legal actions:", JSON.stringify(actions));
    console.log("last 5 logs:", state.log.slice(-5));
    break;
  }
  state = result.state;
}
