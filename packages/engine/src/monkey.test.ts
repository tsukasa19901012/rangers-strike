import { describe, expect, it } from "vitest";
import {
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
} from "@rangers-strike/cards";
import { applyAction, createGame, getLegalActions } from "./index";
const DEFAULT_GAMES = Number(process.env.MONKEY_GAMES ?? 80);
const MAX_STEPS = Number(process.env.MONKEY_MAX_STEPS ?? 12_000);

const DECK_BUILDERS = [
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
] as const;

/** Deterministic RNG for reproducible failures. */
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

type MonkeyFailure = {
  seed: number;
  step: number;
  reason: string;
  phase: string;
  legalCount: number;
};

function runMonkeyGame(seed: number): MonkeyFailure | null {
  const rng = mulberry32(seed);
  const deckA = DECK_BUILDERS[seed % DECK_BUILDERS.length]!();
  const deckB = DECK_BUILDERS[(seed + 1) % DECK_BUILDERS.length]!();

  let state = createGame({
    player1Deck: deckA,
    player2Deck: deckB,
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    rng,
  });

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (state.winner) return null;

    const actions = getLegalActions(state);
    if (actions.length === 0) {
      return {
        seed,
        step,
        reason: "no_legal_actions",
        phase: state.phase,
        legalCount: 0,
      };
    }

    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      return {
        seed,
        step,
        reason: `apply_failed:${result.error}`,
        phase: state.phase,
        legalCount: actions.length,
      };
    }

    state = result.state;
  }

  return {
    seed,
    step: MAX_STEPS,
    reason: "step_limit",
    phase: state.phase,
    legalCount: getLegalActions(state).length,
  };
}

describe("monkey test (random legal actions)", () => {
  it(
    `completes ${DEFAULT_GAMES} games without engine errors`,
    { timeout: 120_000 },
    () => {
      const failures: MonkeyFailure[] = [];
      let finished = 0;
      let timedOut = 0;

      for (let seed = 1; seed <= DEFAULT_GAMES; seed += 1) {
        const failure = runMonkeyGame(seed);
        if (!failure) {
          finished += 1;
          continue;
        }
        if (failure.reason === "step_limit") {
          timedOut += 1;
          continue;
        }
        failures.push(failure);
      }

      if (failures.length > 0) {
        const sample = failures
          .slice(0, 5)
          .map(
            (f) =>
              `seed=${f.seed} step=${f.step} ${f.reason} phase=${f.phase} legal=${f.legalCount}`,
          )
          .join("\n");
        expect.fail(`${failures.length} monkey failure(s):\n${sample}`);
      }

      expect(finished + timedOut).toBe(DEFAULT_GAMES);
      // Pure random play often stalls; step_limit is acceptable if apply/legal stay sound.
      expect(finished).toBeGreaterThan(0);

      console.info(
        `[monkey] games=${DEFAULT_GAMES} won=${finished} step_limit=${timedOut} errors=0`,
      );
    },
  );
});
