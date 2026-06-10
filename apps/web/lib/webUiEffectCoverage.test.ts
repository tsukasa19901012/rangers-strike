import { describe, expect, it } from "vitest";
import { listImplementedOperations } from "@rangers-strike/cards";
import type { PendingEffectChoice } from "@rangers-strike/engine";
import {
  assertAllImplementedOperationsCovered,
  assertCatalogMatchesMechanisms,
  isKnownEffectChoice,
  listOperationCoverageGaps,
  OPERATION_UI_MECHANISMS,
  summarizeOperationCoverage,
} from "./webUiEffectCoverage";
import { resolveOperationDropRoute } from "./webUiOperationRouting";

function stubPending(
  overrides: Partial<PendingEffectChoice>,
): PendingEffectChoice {
  return {
    playerId: "player1",
    effectId: "unknown_effect",
    sourceCardId: "BK-001",
    kind: "confirm",
    phasePlayerId: "player1",
    validInstanceIds: [],
    ...overrides,
  };
}

describe("isKnownEffectChoice", () => {
  it("returns true for wired L1–3 effect choices", () => {
    expect(
      isKnownEffectChoice(
        stubPending({ effectId: "armor_attack", kind: "select_unit" }),
      ),
    ).toBe(true);
  });

  it("returns false for unknown promoted effect ids", () => {
    expect(
      isKnownEffectChoice(
        stubPending({ effectId: "dsl_unknown_xyz", kind: "select_unit" }),
      ),
    ).toBe(false);
  });

  it("returns false for unsupported choice kinds", () => {
    expect(
      isKnownEffectChoice(
        stubPending({ effectId: "armor_attack", kind: "confirm" }),
      ),
    ).toBe(false);
  });
});

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
