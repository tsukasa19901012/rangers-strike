import {
  isComplexityPromotedCardId,
  isVanillaPromotedCardId,
} from "@rangers-strike/cards";
import { applyAction } from "../src/core/applyAction";
import { getLegalActions, isLegalAction } from "../src/core/legalActions";
import { pickCpuAction } from "../src/ai/index";
import { LEGEND1_STARTER_IDS } from "../src/verticalSlice/createStarterGame";
import { createHybridPromotedGame } from "../src/verticalSlice/createPromotedGame";
import type { GameAction } from "../src/types/actions";

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

function describeAction(action: GameAction): string {
  return JSON.stringify(action);
}

const errors = new Map<string, number>();
for (let seed = 1; seed <= 50; seed += 1) {
  const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
  const p2 = LEGEND1_STARTER_IDS[(seed + 1) % LEGEND1_STARTER_IDS.length]!;
  const initial = createHybridPromotedGame({
    rng: mulberry32(seed),
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    player1Starter: p1,
    player2Starter: p2,
    swapCount: 35,
  });
  let state = initial;
  for (let step = 0; step < 15_000; step += 1) {
    if (state.winner) break;
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const actor = actions[0]!.playerId;
    const picked = pickCpuAction(state, actor, 1);
    const action =
      picked && isLegalAction(state, picked) ? picked : actions[0]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      const key = `${result.error ?? "unknown"}|${state.phase}|action:${action.type}|${describeAction(action).slice(0, 120)}|last:${state.log.at(-1)?.slice(0, 60) ?? ""}`;
      errors.set(key, (errors.get(key) ?? 0) + 1);
      if ((errors.get(key) ?? 0) === 1) {
        console.error(`seed=${seed} step=${step}`, key);
      }
      break;
    }
    state = result.state;
  }
}

console.log([...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
