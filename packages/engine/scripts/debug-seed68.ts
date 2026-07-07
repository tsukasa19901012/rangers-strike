import { createGame, getLegalActions, isLegalAction } from "../src/index";
import { buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, buildStarterDeck } from "@rangers-strike/cards";
import { applyAction } from "../src/core/applyAction";
import { isResolveCommandPaymentLegal } from "../src/rules/commandPayment";

const DECK_BUILDERS = [buildAbarenohDeck, buildDekarangerDeck, buildMagikingDeck, () => buildStarterDeck("roaring-wings"), () => buildStarterDeck("silver-adventurer")] as const;
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const seed = 68;
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
    console.log(`step=${step} error=${result.error} phase=${state.phase}`);
    console.log("failed action:", JSON.stringify(action));
    console.log("all legal actions:", JSON.stringify(actions));
    const pending = state.pendingCommandPayment;
    if (pending) {
      console.log("pendingCommandPayment:", JSON.stringify({ kind: pending.kind, playerId: pending.playerId, source: pending.sourceCardId, cont: pending.continuation.type }));
      const resolved = (await import("../src/rules/commandPayment")).applyCommandPaymentResolve(state, pending.playerId, pending, (action as any).commandInstanceIds);
      if ("error" in resolved) { console.log("resolve error:", resolved.error); }
      else {
        const nextS = resolved.state;
        const cont = pending.continuation;
        if (cont.type === "play_operation") {
          const inner = { type: "play_operation" as const, playerId: pending.playerId, instanceId: pending.sourceInstanceId, targetInstanceId: (cont as any).targetInstanceId };
          console.log("inner action:", JSON.stringify(inner));
          console.log("isLegalAction inner:", isLegalAction(nextS, inner));
        }
      }
    }
    break;
  }
  state = result.state;
}
