import { describe, expect, it } from "vitest";
import {
  isComplexityPromotedCardId,
  isVanillaPromotedCardId,
} from "@rangers-strike/cards";
import type { Phase } from "../types/game";
import { LEGEND1_STARTER_IDS } from "./createStarterGame";
import { createHybridPromotedGame } from "./createPromotedGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

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
  noLegalActions: number;
  stepLimit: number;
  withStrike: number;
  withBattle: number;
  promotedInDeck: number;
  phaseCoverage: Record<Phase, number>;
};

function countPromotedCards(deck: { cardId: string }[]): number {
  return deck.filter(
    (c) => isVanillaPromotedCardId(c.cardId) || isComplexityPromotedCardId(c.cardId),
  ).length;
}

function runSimulation(count: number, swapCount: number): SimReport {
  const report: SimReport = {
    total: count,
    winner: 0,
    applyFailed: 0,
    noLegalActions: 0,
    stepLimit: 0,
    withStrike: 0,
    withBattle: 0,
    promotedInDeck: 0,
    phaseCoverage: {
      start: 0,
      charge: 0,
      rush: 0,
      battle: 0,
      end: 0,
    },
  };

  for (let seed = 1; seed <= count; seed += 1) {
    const p1 = LEGEND1_STARTER_IDS[seed % LEGEND1_STARTER_IDS.length]!;
    const p2 = LEGEND1_STARTER_IDS[(seed + 1) % LEGEND1_STARTER_IDS.length]!;

    const initial = createHybridPromotedGame({
      rng: mulberry32(seed),
      firstPlayer: seed % 2 === 0 ? "player1" : "player2",
      player1Starter: p1,
      player2Starter: p2,
      swapCount,
    });

    report.promotedInDeck += countPromotedCards(initial.players.player1.deck);

    const result = playStarterMatchUntilEnd(initial, { maxSteps: MAX_STEPS });

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

describe("vertical slice — hybrid promoted simulation (M16/M17)", () => {
  const tiers = [
    { label: "light (10 promoted)", count: 20, swapCount: 10 },
    { label: "heavy (25 promoted)", count: 20, swapCount: 25 },
    { label: "full (35 promoted)", count: 15, swapCount: 35 },
  ] as const;

  for (const tier of tiers) {
    it(
      `runs ${tier.count} games — ${tier.label}`,
      () => {
        const report = runSimulation(tier.count, tier.swapCount);

        console.info(`\n=== Hybrid Promoted Simulation: ${tier.label} ===`);
        console.info(`total:           ${report.total}`);
        console.info(`winner:          ${report.winner}`);
        console.info(`apply_failed:    ${report.applyFailed}`);
        console.info(`no_legal_actions:${report.noLegalActions}`);
        console.info(`step_limit:      ${report.stepLimit}`);
        console.info(`games_with_strike: ${report.withStrike}`);
        console.info(`games_with_battle: ${report.withBattle}`);
        console.info(
          `avg_promoted_in_p1_deck: ${Math.round(report.promotedInDeck / report.total)}`,
        );
        console.info("phase_coverage:", report.phaseCoverage);

        expect(report.applyFailed).toBe(0);
        expect(report.noLegalActions).toBe(0);
        expect(report.winner).toBe(tier.count);
        expect(report.phaseCoverage.rush).toBe(tier.count);
        expect(report.phaseCoverage.battle).toBe(tier.count);
        expect(report.promotedInDeck / report.total).toBeGreaterThan(5);
      },
      tier.swapCount >= 25 ? 90_000 : 60_000,
    );
  }
});
