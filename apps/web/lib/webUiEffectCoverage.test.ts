import { describe, expect, it } from "vitest";
import { listImplementedOperations } from "@rangers-strike/cards";
import {
  assertAllImplementedOperationsCovered,
  assertCatalogMatchesMechanisms,
  listOperationCoverageGaps,
  OPERATION_UI_MECHANISMS,
  summarizeOperationCoverage,
} from "./webUiEffectCoverage";
import { resolveOperationDropRoute } from "./webUiOperationRouting";

describe("Web UI operation effect coverage", () => {
  it("maps every implemented operation to a UI mechanism", () => {
    expect(listOperationCoverageGaps()).toEqual([]);
    assertAllImplementedOperationsCovered();
    assertCatalogMatchesMechanisms();
  });

  it("covers at least 35 operation cards", () => {
    const summary = summarizeOperationCoverage();
    expect(summary.total).toBeGreaterThanOrEqual(35);
    expect(summary.instant).toBeGreaterThanOrEqual(15);
    expect(summary.permanent).toBeGreaterThanOrEqual(12);
    expect(summary.counter).toBeGreaterThanOrEqual(5);
  });

  it("routes instant operations to the correct drop handler", () => {
    for (const op of listImplementedOperations()) {
      if (op.kind !== "instant") continue;
      const route = resolveOperationDropRoute(op.cardId);
      const mechanisms = OPERATION_UI_MECHANISMS[op.effectId] ?? [];

      if (op.effectId === "cyber_s_rider") {
        expect(route.kind).toBe("cyber_s_rider_modal");
        expect(mechanisms).toContain("operation_cyber_s_rider_modal");
        continue;
      }

      if (mechanisms.includes("operation_drag_target_modal")) {
        expect(route.kind).toBe("target_modal");
        continue;
      }

      if (mechanisms.includes("operation_drag_direct")) {
        expect(route.kind).toBe("direct_play");
      }
    }
  });
});
