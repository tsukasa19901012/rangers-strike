import { describe, it } from "vitest";
import type { RkUiTestSpec } from "./rkUiTestSpecs/types";
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

/** vitest describe ブロックをバッチ単位で生成する。 */
export function rkUiBatchTestBody(specs: RkUiTestSpec[]): void {
  for (const spec of specs) {
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
        if (resolvePromotedOperationUiMechanisms(spec.cardId).length === 0) {
          throw new Error(`${spec.cardId}: no UI mechanisms resolved`);
        }
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
          if (!spec.engineGaps?.length) {
            throw new Error(`${spec.cardId}: engineGaps should be non-empty`);
          }
        });
      }
    });
  }
}
