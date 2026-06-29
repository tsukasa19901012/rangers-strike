import { describe, expect, it } from "vitest";
import { LEGEND1_STARTER_IDS, createStarterGame } from "../verticalSlice/createStarterGame";
import { playStarterMatchUntilEnd } from "../verticalSlice/playStarterMatch";
import type { CpuLevel } from "./types";

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

describe("CPU level comparison", () => {
  it("reports combat metrics by level", () => {
    for (const lv of [1, 3, 5] as CpuLevel[]) {
      const r = playStarterMatchUntilEnd(
        createStarterGame({
          rng: mulberry32(1),
          firstPlayer: "player2",
          player1Starter: LEGEND1_STARTER_IDS[1]!,
          player2Starter: LEGEND1_STARTER_IDS[2]!,
        }),
        { maxSteps: 15_000, cpuLevel: lv },
      );
      console.info(
        `Lv${lv}`,
        {
          steps: r.steps,
          strikes: r.trace.strikes,
          battles: r.trace.battles,
          battleActions: r.trace.actionCounts.battle ?? 0,
          strikeActions: r.trace.actionCounts.strike ?? 0,
          endPhase: r.trace.actionCounts.end_phase ?? 0,
          moveToBattle: r.trace.actionCounts.move_to_battle ?? 0,
          rush: r.trace.actionCounts.rush ?? 0,
          playOp: r.trace.actionCounts.play_operation ?? 0,
        },
      );
    }
    expect(true).toBe(true);
  });
});
