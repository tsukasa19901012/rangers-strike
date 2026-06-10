import { describe, expect, it } from "vitest";
import {
  collectEffectResolutionMetrics,
  INTERPRET_EFFECT_UNRESOLVED,
  mergeEffectResolutionTraces,
} from "./effectResolutionMetrics";

describe("effectResolutionMetrics", () => {
  it("counts interpret_effect_unresolved with effectId suffix", () => {
    const metrics = collectEffectResolutionMetrics([
      "game_created",
      `player1|named_effect|RK-162|test|${INTERPRET_EFFECT_UNRESOLVED}:named_e383a9e382a4`,
      "player1|number_combo|RS-001|unit|named_sp1",
    ]);

    expect(metrics.unresolvedCount).toBe(1);
    expect(metrics.effectLogCount).toBe(2);
    expect(metrics.byEffectId["named_e383a9e382a4"]).toBe(1);
    expect(metrics.byCardId["RK-162"]).toBe(1);
    expect(metrics.unresolvedRate).toBeCloseTo(0.5);
  });

  it("detects unresolved in resolve_effect_choice log format", () => {
    const metrics = collectEffectResolutionMetrics([
      `player1|resolve_effect_choice|RS-060|ピンク|pink_storm:${INTERPRET_EFFECT_UNRESOLVED}`,
    ]);

    expect(metrics.unresolvedCount).toBe(1);
    expect(metrics.byEffectId["pink_storm"]).toBe(1);
  });

  it("merges traces across games", () => {
    const merged = mergeEffectResolutionTraces([
      collectEffectResolutionMetrics([
        `player1|named_effect|A|a|${INTERPRET_EFFECT_UNRESOLVED}:eff_a`,
      ]),
      collectEffectResolutionMetrics([
        `player2|named_effect|B|b|${INTERPRET_EFFECT_UNRESOLVED}:eff_b`,
        `player2|named_effect|B|b|resolved_ok`,
      ]),
    ]);

    expect(merged.games).toBe(2);
    expect(merged.unresolvedCount).toBe(2);
    expect(merged.effectLogCount).toBe(3);
    expect(merged.topUnresolvedByEffectId).toHaveLength(2);
  });
});
