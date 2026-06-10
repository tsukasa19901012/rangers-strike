import { describe, expect, it } from "vitest";
import { createFullPromotedGame } from "./createPromotedGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

const GAME_COUNT = 50;
const MAX_STEPS = 15_000;

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

describe("vertical slice — full promoted deck simulation (M18)", () => {
  it(
    `runs ${GAME_COUNT} CPU vs CPU games with 40-card promoted-only decks`,
    () => {
      let winner = 0;
      let applyFailed = 0;
      let withBattleAction = 0;
      let withStrike = 0;
      let withRushPhase = 0;
      let withBattlePhase = 0;

      for (let seed = 1; seed <= GAME_COUNT; seed += 1) {
        const result = playStarterMatchUntilEnd(
          createFullPromotedGame({
            rng: mulberry32(seed),
            firstPlayer: seed % 2 === 0 ? "player1" : "player2",
          }),
          { maxSteps: MAX_STEPS },
        );

        if (result.reason === "winner") winner += 1;
        if (result.reason === "apply_failed") applyFailed += 1;
        if (result.trace.battles > 0) withBattleAction += 1;
        if (result.trace.strikes > 0) withStrike += 1;
        if (result.trace.phasesSeen.has("rush")) withRushPhase += 1;
        if (result.trace.phasesSeen.has("battle")) withBattlePhase += 1;
      }

      console.info("\n=== Full Promoted Deck Simulation (M18/M19) ===");
      console.info(`total:             ${GAME_COUNT}`);
      console.info(`winner:            ${winner}`);
      console.info(`apply_failed:      ${applyFailed}`);
      console.info(`games_with_rush:   ${withRushPhase}`);
      console.info(`games_with_battle: ${withBattlePhase}`);
      console.info(`battle_actions:    ${withBattleAction}`);
      console.info(`games_with_strike: ${withStrike}`);

      expect(applyFailed).toBe(0);
      expect(winner).toBe(GAME_COUNT);
      expect(withRushPhase).toBe(GAME_COUNT);
      expect(withBattlePhase).toBe(GAME_COUNT);
    },
    120_000,
  );
});
