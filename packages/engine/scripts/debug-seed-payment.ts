import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction } from "../src/ai/index";
import { createFullPromotedGame } from "../src/verticalSlice/createPromotedGame";

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

const seed = Number(process.argv[2] ?? 48);
let state = createFullPromotedGame({
  rng: mulberry32(seed),
  firstPlayer: seed % 2 === 0 ? "player1" : "player2",
});

let paymentLoops = 0;
for (let step = 0; step < 500; step += 1) {
  if (state.winner) break;
  const actions = getLegalActions(state);
  if (actions.length === 0) {
    console.log("no legal at step", step, "phase", state.phase);
    break;
  }
  const actor = actions[0]!.playerId;
  const picked = pickCpuAction(state, actor, 1);
  const action = picked && isLegalAction(state, picked) ? picked : actions[0]!;

  if (action.type === "resolve_command_payment") {
    const pending = state.pendingCommandPayment;
    const result = applyAction(state, action);
    if (!result.ok) {
      paymentLoops += 1;
      if (paymentLoops <= 3) {
        console.log("resolve failed", result.error, {
          source: pending?.sourceCardId,
          kind: pending?.kind,
          cont: pending?.continuation,
          ids: action.commandInstanceIds,
        });
      }
      const cancelled = applyAction(state, {
        type: "cancel_command_payment",
        playerId: action.playerId,
      });
      if (cancelled.ok) state = cancelled.state;
      continue;
    }
    state = result.state;
    continue;
  }

  const result = applyAction(state, action);
  if (!result.ok) {
    console.log("apply failed", action.type, result.error);
    break;
  }
  state = result.state;
}

console.log("payment loop samples", paymentLoops);
