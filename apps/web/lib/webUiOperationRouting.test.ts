import { describe, expect, it } from "vitest";
import { listImplementedOperations } from "@rangers-strike/cards";
import { needsOperationTarget } from "@rangers-strike/engine";
import { resolveOperationDropRoute } from "./webUiOperationRouting";

describe("Web UI operation drop routing", () => {
  for (const op of listImplementedOperations()) {
    if (op.kind !== "instant") continue;

    it(`${op.cardId} (${op.effectId}) matches needsOperationTarget`, () => {
      const route = resolveOperationDropRoute(op.cardId);
      if (op.effectId === "cyber_s_rider") {
        expect(route.kind).toBe("cyber_s_rider_modal");
        return;
      }
      if (needsOperationTarget(op.cardId)) {
        expect(route.kind).toBe("target_modal");
        return;
      }
      expect(route.kind).toBe("direct_play");
    });
  }
});
