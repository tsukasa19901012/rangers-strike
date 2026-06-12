import { describe, expect, it } from "vitest";
import { RK_BATCH_01 } from "./rkUiTestSpecs/batch01";
import {
  assertRkCardCatalog,
  assertRkCardEffectMeta,
  assertRkCardUiCoverage,
  assertRkCardUiLogic,
  assertRkDeckBuilder,
  assertRkDslKeywords,
  assertRkOperationUiRouting,
  resolvePromotedOperationUiMechanisms,
} from "./rkUiLogic";

describe("RK UI logic batch 01 (RK-001〜RK-010)", () => {
  it("defines 10 cards", () => {
    expect(RK_BATCH_01).toHaveLength(10);
    expect(RK_BATCH_01.map((s) => s.cardId)).toEqual([
      "RK-001",
      "RK-002",
      "RK-003",
      "RK-004",
      "RK-005",
      "RK-006",
      "RK-007",
      "RK-008",
      "RK-009",
      "RK-010",
    ]);
  });

  for (const spec of RK_BATCH_01) {
    describe(spec.cardId, () => {
      it("matches full-playable catalog (wiki)", () => {
        assertRkCardCatalog(spec);
      });

      it("is DSL ready with promoted-ui coverage", () => {
        assertRkCardUiCoverage(spec);
      });

      it("getCardEffect kind matches wiki timing", () => {
        assertRkCardEffectMeta(spec);
      });

      it("routes to expected Web UI mechanisms", () => {
        assertRkOperationUiRouting(spec);
        const mechanisms = resolvePromotedOperationUiMechanisms(spec.cardId);
        expect(mechanisms.length).toBeGreaterThan(0);
      });

      if (spec.expectedDslKeywords?.length) {
        it("DSL grant_keyword markers match wiki effect class", () => {
          assertRkDslKeywords(spec);
        });
      }

      it("is not flagged UI-uncertain in deck builder", () => {
        assertRkDeckBuilder(spec);
      });

      it("passes combined UI logic assertions", () => {
        assertRkCardUiLogic(spec);
      });

      if (spec.engineGaps?.length) {
        it("documents known engine gaps", () => {
          expect(spec.engineGaps!.length).toBeGreaterThan(0);
        });
      }
    });
  }
});
