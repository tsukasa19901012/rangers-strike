import { applyAction, createGame, getLegalActions, isLegalAction } from "../src/index";
import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";
import { isResolveCommandPaymentLegal, validatePaymentSelection } from "../src/rules/commandPayment";

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

for (const seed of [4]) {
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
      console.log("action:", JSON.stringify(action));
      const pending = state.pendingCommandPayment;
      if (pending) {
        console.log("pending:", JSON.stringify({
          sourceCardId: pending.sourceCardId,
          kind: pending.kind,
          totalNeeded: pending.totalNeeded,
          validInstanceIds: pending.validInstanceIds,
          continuation: pending.continuation.type,
        }));
        const err = validatePaymentSelection(state, pending, (action as any).commandInstanceIds);
        console.log("validatePaymentSelection:", err);
        const legal = isResolveCommandPaymentLegal(state, { playerId: action.playerId, commandInstanceIds: (action as any).commandInstanceIds });
        console.log("isResolveCommandPaymentLegal:", legal);
        const legalFull = isLegalAction(state, action);
        console.log("isLegalAction:", legalFull);
      }
      break;
    }
    state = result.state;
  }
}
