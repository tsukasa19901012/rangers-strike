import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFullPromotedGame } from "./createPromotedGame";
import {
  mergeEffectResolutionTraces,
  type EffectResolutionTrace,
} from "./effectResolutionMetrics";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

const GAME_COUNT = 50;
const MAX_STEPS = 15_000;

/** 初回は warn のみ。週次イテレで下げて expect に昇格する。 */
const UNRESOLVED_RATE_WARN_THRESHOLD = 0.25;

const __dirname = dirname(fileURLToPath(import.meta.url));
const metricsOutputPath = join(
  __dirname,
  "../../../cards/pipeline/data/sim-metrics.json",
);

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
      const effectTraces: EffectResolutionTrace[] = [];

      for (let seed = 1; seed <= GAME_COUNT; seed += 1) {
        const result = playStarterMatchUntilEnd(
          createFullPromotedGame({
            rng: mulberry32(seed),
            firstPlayer: seed % 2 === 0 ? "player1" : "player2",
          }),
          { maxSteps: MAX_STEPS },
        );

        effectTraces.push(result.trace.effectResolution);

        if (result.reason === "winner") winner += 1;
        if (result.reason === "apply_failed") applyFailed += 1;
        if (result.trace.battles > 0) withBattleAction += 1;
        if (result.trace.strikes > 0) withStrike += 1;
        if (result.trace.phasesSeen.has("rush")) withRushPhase += 1;
        if (result.trace.phasesSeen.has("battle")) withBattlePhase += 1;
      }

      const effectMetrics = mergeEffectResolutionTraces(effectTraces);

      console.info("\n=== Full Promoted Deck Simulation (M18/M19) ===");
      console.info(`total:             ${GAME_COUNT}`);
      console.info(`winner:            ${winner}`);
      console.info(`apply_failed:      ${applyFailed}`);
      console.info(`games_with_rush:   ${withRushPhase}`);
      console.info(`games_with_battle: ${withBattlePhase}`);
      console.info(`battle_actions:    ${withBattleAction}`);
      console.info(`games_with_strike: ${withStrike}`);
      console.info(
        `unresolved:        ${effectMetrics.unresolvedCount} / ${effectMetrics.effectLogCount} (${(effectMetrics.unresolvedRate * 100).toFixed(2)}%)`,
      );

      if (effectMetrics.unresolvedRate >= UNRESOLVED_RATE_WARN_THRESHOLD) {
        console.warn(
          `[G3.5] unresolved_rate ${(effectMetrics.unresolvedRate * 100).toFixed(2)}% >= warn threshold ${(UNRESOLVED_RATE_WARN_THRESHOLD * 100).toFixed(0)}% — tighten extractEffects / bridge`,
        );
      }

      const report = {
        generatedAt: new Date().toISOString(),
        suite: "simulateFullPromoted",
        games: GAME_COUNT,
        unresolvedCount: effectMetrics.unresolvedCount,
        effectLogCount: effectMetrics.effectLogCount,
        unresolvedRate: effectMetrics.unresolvedRate,
        warnThreshold: UNRESOLVED_RATE_WARN_THRESHOLD,
        topUnresolvedByEffectId: effectMetrics.topUnresolvedByEffectId.slice(0, 15),
        topUnresolvedByCardId: effectMetrics.topUnresolvedByCardId.slice(0, 15),
        gameplay: {
          winner,
          applyFailed,
          withRushPhase,
          withBattlePhase,
          withBattleAction,
          withStrike,
        },
      };

      mkdirSync(dirname(metricsOutputPath), { recursive: true });
      writeFileSync(metricsOutputPath, `${JSON.stringify(report, null, 2)}\n`);
      console.info(`→ ${metricsOutputPath}`);

      expect(applyFailed).toBe(0);
      expect(winner).toBe(GAME_COUNT);
      expect(withRushPhase).toBe(GAME_COUNT);
      expect(withBattlePhase).toBe(GAME_COUNT);
      // G3.5: 閾値 assert は初回 warn のみ（上記 console.warn）。週次で expect 化する。
    },
    120_000,
  );
});
