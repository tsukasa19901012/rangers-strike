import { createGame, getLegalActions } from "../src/index";
import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";
import { applyAction } from "../src/core/applyAction";

const DECK_BUILDERS = [buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, () => buildStarterDeck("roaring-wings"), () => buildStarterDeck("silver-adventurer")] as const;
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

for (const seed of [24, 59]) {
  const rng = mulberry32(seed);
  const deckA = DECK_BUILDERS[seed % DECK_BUILDERS.length]!();
  const deckB = DECK_BUILDERS[(seed + 1) % DECK_BUILDERS.length]!();
  let state = createGame({ player1Deck: deckA, player2Deck: deckB, firstPlayer: seed % 2 === 0 ? "player1" : "player2", rng });
  
  for (let step = 0; step < 12000; step++) {
    if (state.winner) break;
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      console.log(`\nseed=${seed} step=${step} error=${result.error} phase=${state.phase}`);
      console.log("failed action:", JSON.stringify(action));
      console.log("legal actions count:", actions.length);
      console.log("legal actions:", JSON.stringify(actions).slice(0, 300));
      console.log("pendingCommandPayment:", JSON.stringify(state.pendingCommandPayment ? { kind: state.pendingCommandPayment.kind, playerId: state.pendingCommandPayment.playerId, source: state.pendingCommandPayment.sourceCardId } : null));
      console.log("activePlayer:", state.activePlayer);
      break;
    }
    state = result.state;
  }
}
