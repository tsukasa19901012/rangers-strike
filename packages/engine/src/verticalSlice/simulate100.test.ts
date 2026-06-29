import { describe, expect, it } from "vitest";
import type { Phase } from "../types/game";
import { LEGEND1_STARTER_IDS, createStarterGame } from "./createStarterGame";
import { playStarterMatchUntilEnd, type StarterMatchResult } from "./playStarterMatch";

const GAME_COUNT = 100;
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
  damageWin: number;
  deckOutWin: number;
  unknownWin: number;
  stepLimit: number;
  noLegalActions: number;
  applyFailed: number;
  withStrike: number;
  withBattle: number;
  phaseCoverage: Record<Phase, number>;
  failures: Array<{
    seed: number;
    reason: string;
    steps: number;
    phase: string;
    detail?: string;
    phasesSeen: string[];
    strikes: number;
  }>;
  stepStats: { min: number; max: number; avg: number };
};

function runSimulation(count: number): SimReport {
  const report: SimReport = {
    total: count,
    winner: 0,
    damageWin: 0,
    deckOutWin: 0,
    unknownWin: 0,
    stepLimit: 0,
    noLegalActions: 0,
    applyFailed: 0,
    withStrike: 0,
    withBattle: 0,
    phaseCoverage: {
      start: 0,
      charge: 0,
      rush: 0,
      battle: 0,
      end: 0,
    },
    failures: [],
    stepStats: { min: Infinity, max: 0, avg: 0 },
  };
  let stepSum = 0;

  for (let seed = 1; seed <= count; seed += 1) {
    const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
    const p2 = LEGEND1_STARTER_IDS[(seed + 1) % LEGEND1_STARTER_IDS.length]!;

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

    if (result.reason === "winner") {
      report.winner += 1;
      stepSum += result.steps;
      report.stepStats.min = Math.min(report.stepStats.min, result.steps);
      report.stepStats.max = Math.max(report.stepStats.max, result.steps);
      if (result.trace.winType === "damage") report.damageWin += 1;
      else if (result.trace.winType === "deck_out") report.deckOutWin += 1;
      else report.unknownWin += 1;
    } else if (result.reason === "step_limit") {
      report.stepLimit += 1;
    } else if (result.reason === "no_legal_actions") {
      report.noLegalActions += 1;
    } else if (result.reason === "apply_failed") {
      report.applyFailed += 1;
    }

    const corePhasesOk =
      result.trace.phasesSeen.has("charge") &&
      result.trace.phasesSeen.has("rush") &&
      result.trace.phasesSeen.has("battle");

    const hasProblem = result.reason !== "winner" || !corePhasesOk;

    if (hasProblem) {
      report.failures.push({
        seed,
        reason: result.reason,
        steps: result.steps,
        phase: result.state.phase,
        detail: result.error,
        phasesSeen: [...result.trace.phasesSeen],
        strikes: result.trace.strikes,
      });
    }
  }

  report.stepStats.avg = report.winner > 0 ? Math.round(stepSum / report.winner) : 0;
  if (report.stepStats.min === Infinity) report.stepStats.min = 0;
  return report;
}

describe("vertical slice — 100-game AI simulation (L5 starters)", () => {
  it(
    `runs ${GAME_COUNT} CPU vs CPU games and reports`,
    () => {
    const report = runSimulation(GAME_COUNT);

    console.info("\n=== Vertical Slice 100-Game Simulation (L5 Starters) ===");
    console.info(`total:           ${report.total}`);
    console.info(`winner:          ${report.winner}`);
    console.info(`  damage_win:    ${report.damageWin}`);
    console.info(`  deck_out_win:  ${report.deckOutWin}`);
    console.info(`  unknown_win:   ${report.unknownWin}`);
    console.info(`step_limit:      ${report.stepLimit}`);
    console.info(`no_legal_actions:${report.noLegalActions}`);
    console.info(`apply_failed:    ${report.applyFailed}`);
    console.info(`games_with_strike: ${report.withStrike}`);
    console.info(`games_with_battle: ${report.withBattle}`);
    console.info(
      `steps (winner):  min=${report.stepStats.min} max=${report.stepStats.max} avg=${report.stepStats.avg}`,
    );
    console.info("phase_coverage (games that visited):", report.phaseCoverage);

    if (report.failures.length > 0) {
      console.info(`\n--- Notable cases (${report.failures.length}) ---`);
      for (const f of report.failures.slice(0, 15)) {
        console.info(
          `seed=${f.seed} reason=${f.reason} steps=${f.steps} phase=${f.phase} strikes=${f.strikes} phases=[${f.phasesSeen.join(",")}] detail=${f.detail ?? ""}`,
        );
      }
    }

    expect(report.applyFailed).toBe(0);
    expect(report.noLegalActions).toBe(0);
    expect(report.stepLimit).toBe(0);
    expect(report.winner).toBe(GAME_COUNT);
    expect(report.phaseCoverage.rush).toBe(GAME_COUNT);
    expect(report.phaseCoverage.battle).toBe(GAME_COUNT);
    expect(report.withStrike).toBeGreaterThan(25);
    },
    120_000,
  );
});

export type { SimReport, StarterMatchResult };
