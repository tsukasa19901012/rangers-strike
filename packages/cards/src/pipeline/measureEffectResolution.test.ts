import { describe, expect, it } from "vitest";
import type { CardDocument, EffectDefinition } from "../dsl/types";
import {
  evaluateG35Gate,
  isRematchSuccess,
  isUnresolvedRematchPrimitives,
  measureEffectResolution,
  type EffectResolutionMetrics,
  wouldRuntimeRematchResolve,
} from "./measureEffectResolution";

describe("measureEffectResolution", () => {
  it("isUnresolvedRematchPrimitives matches runtime stub rules", () => {
    expect(isUnresolvedRematchPrimitives([{ type: "interpret_effect" }])).toBe(false);
    expect(
      isUnresolvedRematchPrimitives([
        { type: "grant_keyword", keyword: "effect_foo", duration: "permanent" },
      ]),
    ).toBe(true);
    expect(isUnresolvedRematchPrimitives([{ type: "enqueue_trigger", effectId: "x" }])).toBe(true);
    expect(
      isRematchSuccess([{ type: "grant_keyword", keyword: "register", duration: "permanent" }]),
    ).toBe(true);
  });

  it("counts interpret_effect markers and rematch coverage", () => {
    const effect: EffectDefinition = {
      id: "test_effect",
      text: "※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい）",
      trigger: { type: "while_in_field" },
      effects: [{ type: "interpret_effect" }],
    };
    const card: CardDocument = {
      id: "RK-TEST",
      name: "Test",
      type: "unit",
      category: "MA",
      rarity: "N",
      expansion: "legend1",
      text: effect.text ?? "",
      effects: [effect],
    };

    expect(wouldRuntimeRematchResolve(effect)).toBe(true);

    const metrics = measureEffectResolution([card], new Set());
    expect(metrics.interpretEffectMarkers).toBe(1);
    expect(metrics.markersRematchResolved).toBe(1);
    expect(metrics.markersRematchUnresolved).toBe(0);
    expect(metrics.markerUnresolvedRate).toBe(0);
    expect(metrics.rematchCoverageRate).toBe(1);
    expect(evaluateG35Gate(metrics)).toBe("pass");
  });

  it("evaluates gate fail when effective rematch rate is low", () => {
    const metrics: EffectResolutionMetrics = {
      scope: "promoted",
      totalEffectsInCorpus: 100,
      promotedCards: 50,
      effectsWithText: 100,
      interpretEffectMarkers: 20,
      markersRematchResolved: 10,
      markersRematchUnresolved: 10,
      markerUnresolvedRate: 0.6,
      rematchCoverageResolved: 50,
      rematchCoverageUnresolved: 50,
      rematchCoverageRate: 0.5,
      rematchEffectiveResolved: 40,
      rematchCatchallFallback: 10,
      effectiveRematchRate: 0.4,
      dslRematchedEffects: 80,
      topUnresolvedSamples: [],
    };
    expect(evaluateG35Gate(metrics)).toBe("fail");
  });
});
