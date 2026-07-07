import { createGame, getLegalActions } from "../src/index";
import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";
import { applyCommandPaymentResolve, isResolveCommandPaymentLegal, validatePaymentSelection } from "../src/rules/commandPayment";
import { applyAction } from "../src/core/applyAction";
import { isLegalAction } from "../src/core/legalActions";
import { canPlayOperationExceptCommandHold, canPlayOperation, getDefinition } from "../src/core/catalog";

const DECK_BUILDERS = [buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, () => buildStarterDeck("roaring-wings"), () => buildStarterDeck("silver-adventurer")] as const;
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
      const pending = state.pendingCommandPayment!;
      const ids = (action as any).commandInstanceIds;
      const resolved = applyCommandPaymentResolve(state, pending.playerId, pending, ids);
      if ("error" in resolved) {
        console.log("applyCommandPaymentResolve error:", resolved.error);
        break;
      }
      const nextState = resolved.state;
      const cont = pending.continuation;
      console.log("continuation type:", cont.type);
      if (cont.type === "play_operation") {
        const innerAction = { type: "play_operation" as const, playerId: "player1" as const, instanceId: pending.sourceInstanceId, targetInstanceId: (cont as any).targetInstanceId, extraInstanceId: (cont as any).extraInstanceId };
        console.log("inner play_operation:", JSON.stringify(innerAction));
        const def = getDefinition(nextState.definitions, state.players["player1"].hand.find(c => c.instanceId === pending.sourceInstanceId)?.cardId ?? "");
        console.log("source card in hand:", !!nextState.players["player1"].hand.find(c => c.instanceId === pending.sourceInstanceId));
        if (def) {
          console.log("canPlayOperationExceptCommandHold:", canPlayOperationExceptCommandHold(nextState, "player1", def));
          console.log("canPlayOperation:", canPlayOperation(nextState, "player1", def));
        }
        console.log("isLegalAction for play_operation:", isLegalAction(nextState, innerAction));
        const innerResult = applyAction(nextState, innerAction);
        console.log("inner applyAction:", innerResult.ok ? "ok" : innerResult.error);
      }
      break;
    }
    state = result.state;
  }
}
