import { describe, expect, it } from "vitest";
import type { Phase } from "../types/game";
import { ALL_STARTER_DECK_IDS, createStarterGame } from "./createStarterGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

const GAME_COUNT = 150;
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

type SimReport = {
  total: number;
  winner: number;
  applyFailed: number;
  stepLimit: number;
  noLegalActions: number;
  withStrike: number;
  withBattle: number;
  phaseCoverage: Record<Phase, number>;
};

function runSimulation(count: number): SimReport {
  const report: SimReport = {
    total: count,
    winner: 0,
    applyFailed: 0,
    stepLimit: 0,
    noLegalActions: 0,
    withStrike: 0,
    withBattle: 0,
    phaseCoverage: {
      start: 0,
      charge: 0,
      rush: 0,
      battle: 0,
      end: 0,
    },
  };

  for (let seed = 1; seed <= count; seed += 1) {
    const p1 = ALL_STARTER_DECK_IDS[seed % ALL_STARTER_DECK_IDS.length]!;
    const p2 = ALL_STARTER_DECK_IDS[(seed + 3) % ALL_STARTER_DECK_IDS.length]!;

    const result = playStarterMatchUntilEnd(
      createStarterGame({
        rng: mulberry32(seed),
        firstPlayer: seed % 2 === 0 ? "player1" : "player2",
        player1Starter: p1,
        player2Starter: p2,
      }),
      { maxSteps: MAX_STEPS },
    );

    for (const phase of result.trace.phasesSeen) {
      report.phaseCoverage[phase] += 1;
    }
    if (result.trace.strikes > 0) report.withStrike += 1;
    if (result.trace.battles > 0) report.withBattle += 1;

    if (result.reason === "winner") report.winner += 1;
    else if (result.reason === "step_limit") report.stepLimit += 1;
    else if (result.reason === "no_legal_actions") report.noLegalActions += 1;
    else if (result.reason === "apply_failed") report.applyFailed += 1;
  }

  return report;
}

describe("vertical slice — all starter deck CPU simulation", () => {
  it(
    `runs ${GAME_COUNT} CPU vs CPU games across all ${ALL_STARTER_DECK_IDS.length} starters`,
    () => {
      const report = runSimulation(GAME_COUNT);

      console.info("\n=== All Starter Deck Simulation ===");
      console.info(`starters:        ${ALL_STARTER_DECK_IDS.length}`);
      console.info(`total:           ${report.total}`);
      console.info(`winner:          ${report.winner}`);
      console.info(`apply_failed:    ${report.applyFailed}`);
      console.info(`step_limit:      ${report.stepLimit}`);
      console.info(`no_legal_actions:${report.noLegalActions}`);
      console.info(`games_with_strike: ${report.withStrike}`);
      console.info(`games_with_battle: ${report.withBattle}`);
      console.info("phase_coverage:", report.phaseCoverage);

      expect(report.applyFailed).toBe(0);
      expect(report.noLegalActions).toBe(0);
      expect(report.winner + report.stepLimit).toBe(GAME_COUNT);
      expect(report.winner).toBeGreaterThan(GAME_COUNT * 0.9);
      expect(report.phaseCoverage.rush).toBe(GAME_COUNT);
      expect(report.phaseCoverage.battle).toBe(GAME_COUNT);
    },
    120_000,
  );
});
